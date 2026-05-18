import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    // 1. Xác thực API Key
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
    const validKey = process.env.CLAUDE_API_KEY;

    if (!validKey || apiKey !== validKey) {
      return NextResponse.json({ error: 'Unauthorized. Invalid API Key.' }, { status: 401 });
    }

    // 2. Lấy dữ liệu payload
    let payload;
    try {
        payload = await request.json();
    } catch(e) {
        return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    // Payload có thể là một mảng trực tiếp, hoặc nằm trong trường `trends`
    const trendsArray = Array.isArray(payload) ? payload : (payload.trends || []);

    if (!Array.isArray(trendsArray) || trendsArray.length === 0) {
        return NextResponse.json({ error: 'Payload must contain an array of trends.' }, { status: 400 });
    }

    const insertedTrends = [];
    const allCrawledIdsToUpdate: string[] = [];

    // 3. Insert các trends vào Database
    for (const trend of trendsArray) {
        // Validation cơ bản
        if (!trend.trend_name || !trend.crawled_data_ids || !Array.isArray(trend.crawled_data_ids)) {
            continue; // Bỏ qua trend lỗi cấu trúc
        }

        const mainDataId = trend.crawled_data_ids.length > 0 ? trend.crawled_data_ids[0] : null;
        if (!mainDataId) continue;

        const { data: newTrend, error: insertError } = await supabaseAdmin
            .from('trends')
            .insert({
                crawled_data_id: mainDataId,
                related_ids: trend.crawled_data_ids,
                trend_name: trend.trend_name,
                viral_reason: trend.viral_reason || '',
                content_ideas: trend.content_ideas || '',
                trend_score: trend.trend_score || 0,
                videos_count: trend.videos_count || trend.crawled_data_ids.length,
                channels_count: trend.channels_count || 1,
                channel_stats: trend.channel_stats || '',
                expert_commentary: trend.expert_commentary || '',
                category_id: trend.category_id || null, 
                status: 'pending' // Admin sẽ duyệt tay trên UI
            })
            .select()
            .single();

        if (insertError) {
             console.error("Lỗi insert trend từ Claude webhook:", insertError);
             continue;
        }
        
        insertedTrends.push(newTrend);
        allCrawledIdsToUpdate.push(...trend.crawled_data_ids);
    }

    // 4. Đánh dấu các bản ghi raw data đã được phân tích
    if (allCrawledIdsToUpdate.length > 0) {
        // Loại bỏ ID trùng lặp
        const uniqueIds = [...new Set(allCrawledIdsToUpdate)];
        
        await supabaseAdmin
            .from('crawled_data')
            .update({ is_analyzed: true })
            .in('id', uniqueIds);
    }

    // 5. Trả về kết quả
    return NextResponse.json({
        success: true,
        message: 'Trends received and saved successfully.',
        inserted_count: insertedTrends.length,
        updated_crawled_data_count: [...new Set(allCrawledIdsToUpdate)].length
    });

  } catch (error: any) {
    console.error('Claude Webhook Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
