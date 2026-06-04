import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  let logId: string | null = null;
  try {
    const body = await request.json();
    const { log_id, category_id, accumulated_tokens = 0, merged_trends = [], prompt_used = '', response_raw = '' } = body;
    logId = log_id;

    // 0. Lấy cấu hình hệ thống
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

    let min_videos = 1;
    let min_channels = 1;
    if (category_id && category_id !== 'all') {
        const { data: catData } = await supabaseAdmin
            .from('categories')
            .select('min_videos, min_channels, trend_score_quantitative_weight, trend_score_velocity_weight, trend_score_min_views_viral')
            .eq('id', category_id)
            .single();
        if (catData) {
            if (catData.min_videos) min_videos = catData.min_videos;
            if (catData.min_channels) min_channels = catData.min_channels;

            if (catData.trend_score_quantitative_weight !== null && catData.trend_score_quantitative_weight !== undefined) {
                quantitativeWeight = parseFloat(catData.trend_score_quantitative_weight as any) / 100;
            }
            if (catData.trend_score_velocity_weight !== null && catData.trend_score_velocity_weight !== undefined) {
                velocityWeight = parseFloat(catData.trend_score_velocity_weight as any) / 100;
            }
            if (catData.trend_score_min_views_viral !== null && catData.trend_score_min_views_viral !== undefined) {
                minViewsViral = parseInt(catData.trend_score_min_views_viral as any);
            }
        }
    }

    // 1. Lấy danh sách trends thô hiện tại có status = 'analyzed'
    let query = supabaseAdmin.from('trends').select('id').eq('status', 'analyzed');
    if (category_id && category_id !== 'all') {
        query = query.eq('category_id', category_id);
    } else {
        query = query.is('category_id', null);
    }
    const { data: rawTrends } = await query;
    const oldTrendIds = rawTrends ? rawTrends.map(t => t.id) : [];

    // Nếu không có merged_trends từ N8N (hoặc rỗng) thì chỉ xóa trends thô và hoàn tất log
    if (merged_trends.length === 0) {
        if (oldTrendIds.length > 0) {
            await supabaseAdmin.from('trends').delete().in('id', oldTrendIds);
        }
        if (logId) {
            await supabaseAdmin.from('ai_logs').update({
                status: 'success',
                response_raw: `✅ Hoàn tất! Không có trend nào được gộp.\n\n📊 Tổng Tokens: ${accumulated_tokens.toLocaleString()}`
            }).eq('id', logId);
        }
        return NextResponse.json({ success: true, message: "Hoàn tất lưu kết quả (Rỗng)" });
    }

    // 2. Xóa các trend thô cũ
    if (oldTrendIds.length > 0) {
        await supabaseAdmin.from('trends').delete().in('id', oldTrendIds);
    }

    let insertedCount = 0;

    // 3. Tính toán điểm số toán học và lưu các trend tinh mới
    for (const trend of merged_trends) {
        if (!trend.crawled_data_ids || trend.crawled_data_ids.length === 0) continue;
        
        const uniqueIds = [...new Set(trend.crawled_data_ids)];

        // Truy vấn dữ liệu từ DB để tính điểm định lượng
        const { data: relatedItems } = await supabaseAdmin
            .from('crawled_data')
            .select('id, author_name, author_username, views_count, likes_count, comments_count, shares_count, collect_count, music_id, music_name, posted_at, created_at')
            .in('id', uniqueIds);

        const validIds = relatedItems ? relatedItems.map((item: any) => item.id) : [];
        if (validIds.length === 0) {
            console.warn(`Bỏ qua trend "${trend.trend_name}" do không chứa ID bài viết hợp lệ trong DB.`);
            continue;
        }

        const mainDataId = validIds[0];

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
        let aiFactor = trend.trend_score || 50;
        if (aiFactor > 0 && aiFactor <= 10) {
            aiFactor = aiFactor * 10;
        }

        const finalTrendScore = Math.max(0, Math.min(100, Math.round(
            (quantitativeScore * quantitativeWeight) + (aiFactor * (1 - quantitativeWeight))
        )));

        const scoreBreakdown = {
            velocity_score: Math.round(velocityScore),
            velocity_weight: Math.round(velocityWeight * 100),
            engagement_score: Math.round(engagementScore),
            engagement_weight: Math.round((1 - velocityWeight) * 100),
            quantitative_score: Math.round(quantitativeScore),
            quantitative_weight: Math.round(quantitativeWeight * 100),
            ai_score: Math.round(aiFactor),
            ai_weight: Math.round((1 - quantitativeWeight) * 100),
            final_score: finalTrendScore
        };

        const channelsCount = uniqueChannels.size || 1;

        const channelStats = relatedItems.map((item: any) => 
            `- Kênh ${item.author_name || item.author_username}: ${(item.views_count || 0).toLocaleString()} views | ${(item.likes_count || 0).toLocaleString()} likes`
        ).join('\n');

        let expertCommentary = trend.expert_commentary || '';
        if (topMusicId && topMusicName) {
            const musicLink = `https://www.tiktok.com/music/-${topMusicId}`;
            expertCommentary = `${expertCommentary}\n\n🎵 <b>Âm thanh xu hướng:</b> <a href="${musicLink}">${topMusicName}</a>`;
        }

        const { error: insertError } = await supabaseAdmin.from('trends').insert({
            crawled_data_id: mainDataId,
            related_ids: validIds,
            trend_name: trend.trend_name,
            viral_reason: trend.viral_reason,
            content_ideas: trend.content_ideas,
            trend_score: finalTrendScore,
            score_breakdown: scoreBreakdown,
            videos_count: validIds.length,
            channels_count: channelsCount,
            channel_stats: channelStats,
            expert_commentary: expertCommentary,
            category_id: category_id === 'all' ? null : category_id,
            status: 'pending'
        });

        if (!insertError) insertedCount++;
    }

    // 4. Cập nhật Log thành công
    if (logId) {
        const { data: currentLog } = await supabaseAdmin.from('ai_logs').select('items_analyzed').eq('id', logId).single();
        const finalItems = currentLog ? currentLog.items_analyzed : 0;
        
        const finalResponseRaw = `${response_raw}\n\n=========================================\n=== TỔNG KẾT TIẾN TRÌNH (N8N ĐIỀU PHỐI) ===\n=========================================\n- Tổng bài phân tích: ${finalItems}\n- Lọc rác và Gộp lại còn: ${insertedCount} Trends tinh hoa.\n- Xóa ${oldTrendIds.length} Trends thô trùng lặp.\n📊 Tổng Tokens đã dùng: ${accumulated_tokens.toLocaleString()}`;

        await supabaseAdmin.from('ai_logs').update({
            trends_found: insertedCount,
            prompt_used: prompt_used,
            response_raw: finalResponseRaw,
            status: 'success'
        }).eq('id', logId);
    }

    return NextResponse.json({
        success: true,
        reduced_trends: insertedCount,
        message: "Hợp nhất và tính điểm hoàn tất thành công!"
    });

  } catch (error: any) {
    if (logId) {
        try {
            await supabaseAdmin.from('ai_logs').update({ 
                status: 'error', 
                response_raw: `❌ Lỗi ở bước Lưu kết quả: ${error.message}`
            }).eq('id', logId);
        } catch(e) {}
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
