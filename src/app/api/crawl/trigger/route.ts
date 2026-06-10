import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { supabaseAdmin } from '@/lib/supabase/admin';

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { source_id } = await request.json();

    // 1. Lấy thông tin nguồn cào từ DB
    const { data: source, error: sourceError } = await supabaseAdmin
      .from('crawl_sources')
      .select('*')
      .eq('id', source_id)
      .single();

    if (sourceError || !source) {
      return NextResponse.json({ error: 'Source not found' }, { status: 404 });
    }

    // Lấy giới hạn và actor_id từ cài đặt hệ thống
    const { data: settingsData } = await supabaseAdmin
      .from('system_settings')
      .select('key, value');
    
    const settings: Record<string, string> = {};
    settingsData?.forEach(s => settings[s.key] = s.value);

    const limit = parseInt(settings['crawl_limit'] || '5');
    const actorProfile = settings['actor_tiktok_profile'] || 'clockworks/tiktok-profile';
    const actorScraper = settings['actor_tiktok_scraper'] || 'clockworks/tiktok-scraper';

    // 2. Cấu hình Actor tuỳ theo loại nguồn
    let actorId = actorScraper; // Mặc định dùng scraper
    let input: any = {};

    if (source.type === 'tiktok_profile') {
        actorId = actorProfile;
        input = { profiles: [source.url], resultsPerPage: limit }; 
    } else if (source.type === 'tiktok_profile_list') {
        actorId = actorProfile;
        // Biến string "a, b, c" thành mảng ["a", "b", "c"]
        const profilesArray = source.url.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '');
        input = { profiles: profilesArray, resultsPerPage: limit };
    } else if (source.type === 'tiktok_hashtag') {
        actorId = actorScraper;
        input = { hashtags: [source.name], resultsPerPage: limit }; 
    } else {
        return NextResponse.json({ error: 'Loại nguồn này chưa được hỗ trợ.' }, { status: 400 });
    }

    // Lấy domain hiện tại (dùng Ngrok nếu test local, hoặc domain thật khi deploy)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://YOUR_NGROK_URL.ngrok.app';
    const webhookUrl = `${baseUrl}/api/crawl/webhook?source_id=${source.id}`;

    // 3. Trigger Apify chạy ngầm và cài đặt Webhook trả về cho cả thành công và lỗi
    const run = await apifyClient.actor(actorId).start(input, {
        webhooks: [{
            eventTypes: [
              'ACTOR.RUN.SUCCEEDED',
              'ACTOR.RUN.FAILED',
              'ACTOR.RUN.ABORTED',
              'ACTOR.RUN.TIMED_OUT'
            ],
            requestUrl: webhookUrl,
        }]
    });

    // 4. Cập nhật trạng thái nguồn đang chạy
    await supabaseAdmin
        .from('crawl_sources')
        .update({ 
            last_crawl_status: 'running',
            last_crawl_at: new Date().toISOString(),
            last_crawl_run_id: run.id
        })
        .eq('id', source.id);

    return NextResponse.json({ 
        message: 'Đã gửi lệnh cào dữ liệu đến Apify thành công!', 
        runId: run.id,
        sourceName: source.name
    });

  } catch (error: any) {
    console.error('Trigger Crawl Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
