import { NextResponse } from 'next/server';
import { ApifyClient } from 'apify-client';
import { supabaseAdmin } from '@/lib/supabase/admin';

const apifyClient = new ApifyClient({
  token: process.env.APIFY_API_TOKEN,
});

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const source_id = searchParams.get('source_id');
    
    // Apify gửi webhook payload dưới dạng JSON
    const payload = await request.json();
    
    // Chỉ xử lý nếu crawl thành công
    if (payload.eventType !== 'ACTOR.RUN.SUCCEEDED') {
        if (source_id) {
            await supabaseAdmin
                .from('crawl_sources')
                .update({ last_crawl_status: 'error' })
                .eq('id', source_id);
        }
        return NextResponse.json({ message: 'Bỏ qua vì event không phải là SUCCEEDED' });
    }

    // 1. Lấy thông tin Run ID
    const runId = payload.eventData?.actorRunId;
    
    // 2. Lấy dữ liệu từ payload (debug) hoặc gọi Apify API
    let items = payload.items;
    let category_id = null;

    if (!items || items.length === 0) {
        if (!runId) return NextResponse.json({ error: 'Missing Run ID' }, { status: 400 });
        
        const run = await apifyClient.run(runId).get();
        if (!run || !run.defaultDatasetId) {
            return NextResponse.json({ error: 'Dataset ID not found' }, { status: 404 });
        }

        const dataset = await apifyClient.dataset(run.defaultDatasetId).listItems();
        items = dataset.items;
    }

    if (!items || items.length === 0) {
        if (source_id) {
            await supabaseAdmin.from('crawl_sources').update({ last_crawl_status: 'completed' }).eq('id', source_id);
        }
        return NextResponse.json({ message: 'No items found' });
    }

    // 2.5 Lấy thông tin category_id từ source_id
    if (source_id) {
        const { data: source } = await supabaseAdmin.from('crawl_sources').select('category_id').eq('id', source_id).single();
        if (source?.category_id) category_id = source.category_id;
    }

    // 3. Chuẩn bị dữ liệu và bóc tách Transcript (VTT/JSON)
    const insertData = await Promise.all(items.map(async (item: any) => {
        let transcript = null;
        const subtitles = item.videoMeta?.subtitleLinks || [];
        const vieSubtitle = subtitles.find((s: any) => s.language === "vie-VN");

        if (vieSubtitle?.downloadLink) {
            try {
                const subRes = await fetch(vieSubtitle.downloadLink, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://www.tiktok.com/'
                    }
                });
                
                if (subRes.ok) {
                    const contentType = subRes.headers.get('content-type') || '';
                    const subText = await subRes.text();
                    
                    if (contentType.includes('json') || subText.trim().startsWith('{')) {
                        const subJson = JSON.parse(subText);
                        if (subJson.utterances) {
                            transcript = subJson.utterances.map((u: any) => u.text).join(' ').replace(/\s+/g, ' ').trim();
                        }
                    } else {
                        // Parse WEBVTT format
                        transcript = subText
                            .replace(/WEBVTT/g, '')
                            .replace(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/g, '')
                            .split('\n')
                            .map(line => line.trim())
                            .filter(line => line && !line.includes('-->'))
                            .join(' ')
                            .replace(/\s+/g, ' ')
                            .trim();
                    }
                }
            } catch (subError) {
                console.error("Transcript fetch error:", subError);
            }
        }

        return {
            source_id: source_id,
            category_id: category_id,
            platform: 'tiktok',
            post_url: item.webVideoUrl || item.videoWebUrl || `https://www.tiktok.com/@${item.authorMeta?.name}/video/${item.id}`,
            author_name: item.authorMeta?.nickName || item.authorMeta?.name || 'Unknown',
            author_username: item.authorMeta?.name || 'Unknown',
            text_content: item.text || item.desc || '',
            views_count: item.playCount || 0,
            likes_count: item.diggCount || 0,
            shares_count: item.shareCount || 0,
            comments_count: item.commentCount || 0,
            collect_count: item.collectCount || 0,
            author_fans: item.authorMeta?.fans || 0,
            author_verified: item.authorMeta?.verified || false,
            music_id: item.musicMeta?.musicId || null,
            music_name: item.musicMeta?.musicName || null,
            video_duration: item.videoMeta?.duration || 0,
            is_slideshow: item.isSlideshow || false,
            posted_at: item.createTimeISO || new Date().toISOString(),
            raw_json: item,
            is_analyzed: false,
            transcript: transcript
        };
    }));

    // 4. Lưu vào Supabase (Bỏ ignoreDuplicates để cập nhật được transcript cho bài cũ)
    const { error } = await supabaseAdmin
        .from('crawled_data')
        .upsert(insertData, { onConflict: 'post_url' });

    if (error) {
        console.error("Lỗi khi lưu vào DB:", error);
        if (source_id) {
            await supabaseAdmin.from('crawl_sources').update({ last_crawl_status: 'error' }).eq('id', source_id);
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 5. Cập nhật trạng thái nguồn đã hoàn thành
    if (source_id) {
        await supabaseAdmin.from('crawl_sources').update({ last_crawl_status: 'completed' }).eq('id', source_id);
    }

    return NextResponse.json({ 
        message: 'Đã nhận webhook và lưu dữ liệu thành công!', 
        inserted_count: insertData.length 
    });

  } catch (error: any) {
    console.error('Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
