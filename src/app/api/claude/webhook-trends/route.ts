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

    // 2.5 Lấy cấu hình hệ thống và dữ liệu raw liên quan để tính toán Score 2.0
    const { data: settingsData } = await supabaseAdmin.from('system_settings').select('*');
    let quantitativeWeight = 0.7;
    let velocityWeight = 0.6;
    let minViewsViral = 15000;
    
    if (settingsData) {
        settingsData.forEach(setting => {
            if (setting.key === 'trend_score_quantitative_weight') quantitativeWeight = parseFloat(setting.value) / 100;
            if (setting.key === 'trend_score_velocity_weight') velocityWeight = parseFloat(setting.value) / 100;
            if (setting.key === 'trend_score_min_views_viral') minViewsViral = parseFloat(setting.value);
        });
    }

    // Thu thập tất cả crawled_data_ids từ payload để query hàng loạt
    const allCrawledIds: string[] = [];
    trendsArray.forEach((trend: any) => {
      if (trend.crawled_data_ids && Array.isArray(trend.crawled_data_ids)) {
        allCrawledIds.push(...trend.crawled_data_ids);
      }
    });

    let rawData: any[] = [];
    if (allCrawledIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('crawled_data')
        .select('id, author_name, author_username, views_count, likes_count, comments_count, shares_count, collect_count, music_id, music_name, posted_at, created_at')
        .in('id', [...new Set(allCrawledIds)]);
      if (data) rawData = data;
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

        // Trích xuất video liên quan từ DB để tính điểm định lượng
        const relatedItems = rawData.filter((item: any) => trend.crawled_data_ids.includes(item.id));
        
        let totalViews = 0;
        let totalEngagement = 0;
        let velocitySum = 0;
        const uniqueChannels = new Set<string>();
        const musicMap: Record<string, { name: string, count: number }> = {};
        let topMusicId = '';
        let topMusicName = '';
        let maxMusicCount = 0;

        relatedItems.forEach((item: any) => {
            totalViews += item.views_count || 0;
            totalEngagement += (item.likes_count || 0) + (item.comments_count || 0) + (item.shares_count || 0) + (item.collect_count || 0);
            
            const channelKey = item.author_username || item.author_name || 'Unknown';
            uniqueChannels.add(channelKey);

            const hours = Math.max(1, (new Date(item.created_at || Date.now()).getTime() - new Date(item.posted_at || Date.now()).getTime()) / (1000 * 60 * 60));
            velocitySum += (item.views_count || 0) / hours;

            if (item.music_id && item.music_name) {
                if (!musicMap[item.music_id]) {
                    musicMap[item.music_id] = { name: item.music_name, count: 0 };
                }
                musicMap[item.music_id].count++;
                if (musicMap[item.music_id].count > maxMusicCount) {
                    maxMusicCount = musicMap[item.music_id].count;
                    topMusicId = item.music_id;
                    topMusicName = item.music_name;
                }
            }
        });

        const avgVelocity = relatedItems.length > 0 ? (velocitySum / relatedItems.length) : 0;
        const velocityScore = Math.min(100, (avgVelocity / minViewsViral) * 100);

        const avgEngagementRate = totalViews > 0 ? (totalEngagement / totalViews) : 0;
        const engagementScore = Math.min(100, (avgEngagementRate / 0.15) * 100);

        const quantitativeScore = (velocityScore * velocityWeight) + (engagementScore * (1 - velocityWeight));
        const aiFactor = trend.trend_score || 50;

        const finalTrendScore = Math.max(0, Math.min(100, Math.round(
            (quantitativeScore * quantitativeWeight) + (aiFactor * (1 - quantitativeWeight))
        )));

        const channelsCount = uniqueChannels.size || trend.channels_count || 1;

        // Build actual channel stats if not provided
        let channelStats = trend.channel_stats || '';
        if (!channelStats && relatedItems.length > 0) {
            channelStats = relatedItems.map((item: any) => 
                `- Kênh ${item.author_name || item.author_username}: ${(item.views_count || 0).toLocaleString()} views | ${(item.likes_count || 0).toLocaleString()} likes`
            ).join('\n');
        }

        // Append music link
        let expertCommentary = trend.expert_commentary || '';
        if (topMusicId && topMusicName && !expertCommentary.includes('🎵 <b>Âm thanh xu hướng:</b>')) {
            const musicLink = `https://www.tiktok.com/music/-${topMusicId}`;
            expertCommentary = `${expertCommentary}\n\n🎵 <b>Âm thanh xu hướng:</b> <a href="${musicLink}">${topMusicName}</a>`;
        }

        const { data: newTrend, error: insertError } = await supabaseAdmin
            .from('trends')
            .insert({
                crawled_data_id: mainDataId,
                related_ids: trend.crawled_data_ids,
                trend_name: trend.trend_name,
                viral_reason: trend.viral_reason || '',
                content_ideas: trend.content_ideas || '',
                trend_score: finalTrendScore,
                videos_count: relatedItems.length || trend.videos_count || trend.crawled_data_ids.length,
                channels_count: channelsCount,
                channel_stats: channelStats,
                expert_commentary: expertCommentary,
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
