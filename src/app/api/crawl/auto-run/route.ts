import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { supabaseAdmin } from '@/lib/supabase/admin';

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const category_id = searchParams.get('category_id') || 'all';
    const limitParam = searchParams.get('limit');

    // 1. Xác thực bảo mật bằng secret token
    const cronSecret = process.env.CRON_SECRET || 'andtptit';
    if (secret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Lấy danh sách các nguồn cào đang hoạt động tương ứng với bộ lọc category_id
    let query = supabaseAdmin
      .from('crawl_sources')
      .select('*')
      .eq('is_active', true);

    if (category_id && category_id !== 'all') {
      if (category_id === 'global') {
        query = query.is('category_id', null);
      } else {
        query = query.eq('category_id', category_id);
      }
    }

    const { data: activeSources, error: fetchError } = await query;

    if (fetchError) throw fetchError;
    
    if (!activeSources || activeSources.length === 0) {
      return NextResponse.json({ message: 'Không có nguồn cào nào thỏa mãn điều kiện và đang hoạt động.' });
    }

    // Lấy giới hạn mặc định và các actor_id từ cấu hình hệ thống
    const { data: settingsData } = await supabaseAdmin.from('system_settings').select('*');
    const settings: Record<string, string> = {};
    settingsData?.forEach(s => settings[s.key] = s.value);

    const limit = limitParam ? parseInt(limitParam) : parseInt(settings['crawl_limit'] || '5');
    const actorProfile = settings['actor_tiktok_profile'] || 'clockworks/tiktok-profile';
    const actorScraper = settings['actor_tiktok_scraper'] || 'clockworks/tiktok-scraper';

    // 3. Duyệt qua từng nguồn cào và kích hoạt Apify Actor song song bằng Promise.all
    const results = await Promise.all(activeSources.map(async (source) => {
      try {
        let actorId = actorScraper;
        let input: any = {};

        if (source.type === 'tiktok_profile') {
            actorId = actorProfile;
            input = { profiles: [source.url], resultsPerPage: limit }; 
        } else if (source.type === 'tiktok_profile_list') {
            actorId = actorProfile;
            const profilesArray = source.url.split(',').map((s: string) => s.trim()).filter((s: string) => s !== '');
            input = { profiles: profilesArray, resultsPerPage: limit };
        } else if (source.type === 'tiktok_hashtag') {
            actorId = actorScraper;
            input = { hashtags: [source.name], resultsPerPage: limit }; 
        } else {
            return { source_id: source.id, name: source.name, status: 'error', error: 'Loại nguồn không hỗ trợ' };
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://trends-tools-v2.vercel.app';
        const webhookUrl = `${baseUrl}/api/crawl/webhook?source_id=${source.id}`;

        // Trigger chạy ngầm và cài đặt Webhook trả về cho cả thành công và lỗi
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

        // Cập nhật trạng thái nguồn là 'running'
        await supabaseAdmin
            .from('crawl_sources')
            .update({ 
                last_crawl_status: 'running',
                last_crawl_at: new Date().toISOString(),
                last_crawl_run_id: run.id
            })
            .eq('id', source.id);

        return { source_id: source.id, name: source.name, status: 'triggered', run_id: run.id };

      } catch (sourceError: any) {
        console.error(`Lỗi khi kích hoạt nguồn ${source.name}:`, sourceError);
        return { source_id: source.id, name: source.name, status: 'error', error: sourceError.message };
      }
    }));

    return NextResponse.json({
      message: `Đã kích hoạt tự động cào cho ${results.filter(r => r.status === 'triggered').length}/${activeSources.length} nguồn.`,
      details: results
    });

  } catch (error: any) {
    console.error('Auto-run Crawl Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Hỗ trợ cả POST
export async function POST(request: Request) {
  return GET(request);
}
