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
        return NextResponse.json({ message: 'Bỏ qua vì event không phải là SUCCEEDED' });
    }

    const runId = payload.eventData.actorRunId;
    
    // 1. Lấy thông tin Run từ Apify
    const run = await apifyClient.run(runId).get();
    if (!run || !run.defaultDatasetId) {
        return NextResponse.json({ error: 'Không tìm thấy Dataset ID' }, { status: 404 });
    }

    // 2. Lấy dữ liệu (các video) từ Dataset
    const dataset = await apifyClient.dataset(run.defaultDatasetId).listItems();
    const items = dataset.items;

    if (!items || items.length === 0) {
         return NextResponse.json({ message: 'Không cào được item nào.' });
    }

    // 3. Chuẩn bị dữ liệu để insert vào Supabase
    // Format JSON trả về sẽ phụ thuộc vào actor (ở đây map dựa trên clockwork/tiktok-scraper)
    const insertData = items.map((item: any) => ({
        source_id: source_id,
        platform: 'tiktok',
        // Gắn fallback ID nếu thiếu url
        post_url: item.webVideoUrl || item.videoWebUrl || `https://www.tiktok.com/@${item.authorMeta?.name}/video/${item.id}`,
        author_name: item.authorMeta?.nickName || item.authorMeta?.name || 'Unknown',
        author_username: item.authorMeta?.name || 'Unknown',
        text_content: item.text || item.desc || '',
        views_count: item.playCount || item.diggCount || 0,
        likes_count: item.diggCount || item.likes || 0,
        shares_count: item.shareCount || item.shares || 0,
        comments_count: item.commentCount || item.comments || 0,
        posted_at: item.createTimeISO || new Date().toISOString(),
        raw_json: item, // Lưu cục JSON raw để AI xử lý sau
        is_analyzed: false
    }));

    // 4. Lưu vào Supabase (dùng upsert để tránh trùng URL)
    const { error } = await supabaseAdmin
        .from('crawled_data')
        .upsert(insertData, { onConflict: 'post_url', ignoreDuplicates: true });

    if (error) {
        console.error("Lỗi khi lưu vào DB:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
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
