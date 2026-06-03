import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { supabaseAdmin } from '@/lib/supabase/admin';

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

export async function GET(request: Request) {
  try {
    // 1. Lấy danh sách các nguồn cào đang hoạt động
    const { data: activeSources, error: fetchError } = await supabaseAdmin
      .from('crawl_sources')
      .select('*')
      .eq('is_active', true);

    if (fetchError) throw fetchError;
    
    if (!activeSources || activeSources.length === 0) {
      return NextResponse.json({ message: 'Không có nguồn cào nào đang hoạt động.' });
    }

    // Lấy giới hạn và các actor_id từ cấu hình hệ thống
    const { data: settingsData } = await supabaseAdmin.from('system_settings').select('*');
    const settings: Record<string, string> = {};
    settingsData?.forEach(s => settings[s.key] = s.value);

    const limit = parseInt(settings['crawl_limit'] || '5');
    const actorProfile = settings['actor_tiktok_profile'] || 'clockworks/tiktok-profile';
    const actorScraper = settings['actor_tiktok_scraper'] || 'clockworks/tiktok-scraper';

    const results = [];

    // 2. Duyệt qua từng nguồn cào và kích hoạt Apify Actor
    for (const source of activeSources) {
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
            results.push({ source_id: source.id, name: source.name, status: 'error', error: 'Loại nguồn không hỗ trợ' });
            continue;
        }

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://trends-tools-v2.vercel.app';
        const webhookUrl = `${baseUrl}/api/crawl/webhook?source_id=${source.id}`;

        // Trigger chạy ngầm
        const run = await apifyClient.actor(actorId).start(input, {
            webhooks: [{
                eventTypes: ['ACTOR.RUN.SUCCEEDED'],
                requestUrl: webhookUrl,
            }]
        });

        // Cập nhật trạng thái
        await supabaseAdmin
            .from('crawl_sources')
            .update({ 
                last_crawl_status: 'running',
                last_crawl_at: new Date().toISOString(),
                last_crawl_run_id: run.id
            })
            .eq('id', source.id);

        results.push({ source_id: source.id, name: source.name, status: 'triggered', run_id: run.id });

      } catch (sourceError: any) {
        console.error(`Lỗi khi kích hoạt nguồn ${source.name}:`, sourceError);
        results.push({ source_id: source.id, name: source.name, status: 'error', error: sourceError.message });
      }
    }

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
