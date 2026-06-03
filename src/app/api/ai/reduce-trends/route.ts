import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('your_') 
    ? process.env.SUPABASE_SERVICE_ROLE_KEY 
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey!,
    { auth: { persistSession: false }, global: { fetch: fetch } }
  );
  
  let logId: string | null = null;
  
  try {
    const body = await request.json();
    const { log_id, category_id, accumulated_tokens = 0 } = body;
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

    // 1. Fetch all pending trends for this category
    let query = supabaseAdmin.from('trends').select('*').eq('status', 'pending');
    if (category_id && category_id !== 'all') {
        query = query.eq('category_id', category_id);
    } else {
        query = query.is('category_id', null);
    }

    const { data: rawTrends, error: fetchError } = await query;

    if (fetchError) throw new Error("Không thể fetch dữ liệu trends để reduce");
    
    // Nếu không có trend nào hoặc chỉ có 1 trend thì không cần reduce
    if (!rawTrends || rawTrends.length <= 1) {
        if (logId) {
            await supabaseAdmin.from('ai_logs').update({
                status: 'success',
                response_raw: `✅ Hoàn tất! Không có đủ trend rác để hợp nhất.\n\n📊 Tổng Tokens: ${accumulated_tokens.toLocaleString()}`
            }).eq('id', logId);
        }
        return NextResponse.json({ success: true, message: "Bỏ qua Reduce do không đủ dữ liệu" });
    }

    // 2. Build Prompt for Reduce
    const trendsContext = rawTrends.map((t, index) => {
        return `Trend ${index + 1}:
- Tên: ${t.trend_name}
- Lý do Viral: ${t.viral_reason}
- Video count: ${t.videos_count}
- IDs bài viết: ${t.related_ids ? t.related_ids.join(', ') : t.crawled_data_id}
`;
    }).join('\n---\n');

    const prompt = `
Bạn là chuyên gia phân tích dữ liệu mạng xã hội (Data Scientist).
Nhiệm vụ của bạn là gộp (Reduce) danh sách các Trend thô bị trùng lặp dưới đây thành một danh sách các Trend tinh hoa duy nhất.

LUẬT GỘP TREND (BẮT BUỘC):
1. Nhận diện các Trend trùng lặp: Nếu nhiều Trend thô nói về cùng 1 bài nhạc, cùng 1 format, hoặc cùng 1 sự kiện -> GỘP CHÚNG LẠI THÀNH 1 TREND.
2. Cộng dồn số liệu: Khi gộp, phải gộp toàn bộ danh sách "IDs bài viết" của chúng lại với nhau (để không bị sót bài nào).
3. Viết lại thông tin: Viết lại "Tên Trend" và "Lý do Viral" sao cho bao quát và chuyên nghiệp nhất.
4. Lọc rác: Xóa bỏ hoàn toàn các Trend quá chung chung, không có điểm nhấn, hoặc chỉ có 1 video.
5. Số lượng kênh và video: Bạn không cần đếm chính xác, hệ thống sẽ tự đếm dựa trên IDs bài viết bạn trả về. Bạn chỉ cần trả về mảng crawled_data_ids chứa TẤT CẢ các ID của các video thuộc Trend đã gộp.

DỮ LIỆU CÁC TREND THÔ:
${trendsContext}
`;

    // 3. Call AI
    const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                description: "Danh sách các trends sau khi đã được gộp và lọc trùng",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        crawled_data_ids: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Gộp toàn bộ ID của các video thuộc trend này" },
                        trend_name: { type: Type.STRING },
                        viral_reason: { type: Type.STRING },
                        content_ideas: { 
                            type: Type.STRING, 
                            description: "Gợi ý chính xác 3 câu Hook (3 giây đầu) cực kỳ cuốn hút, kích thích sự tò mò để KOL/KOC bắt đầu video đu trend này hiệu quả (đánh số thứ tự 1, 2, 3)."
                        },
                        expert_commentary: { type: Type.STRING },
                        trend_score: { type: Type.INTEGER }
                    },
                    required: ["crawled_data_ids", "trend_name", "viral_reason", "content_ideas", "expert_commentary", "trend_score"]
                }
            }
        }
    });

    const tokensUsed = (result.usageMetadata && result.usageMetadata.totalTokenCount) ? result.usageMetadata.totalTokenCount : 0;
    const responseText = result.text || "[]";
    let mergedTrends = [];
    try {
        mergedTrends = JSON.parse(responseText);
    } catch(e) {}

    let insertedCount = 0;
    
    // 4. Delete old pending trends
    const oldTrendIds = rawTrends.map(t => t.id);
    await supabaseAdmin.from('trends').delete().in('id', oldTrendIds);

    // 5. Insert new merged trends
    for (const trend of mergedTrends) {
        if (!trend.crawled_data_ids || trend.crawled_data_ids.length === 0) continue;
        
        // Remove duplicates from crawled_data_ids array
        const uniqueIds = [...new Set(trend.crawled_data_ids)];
        const mainDataId = uniqueIds[0];

        // Truy vấn dữ liệu thực tế từ database để tính điểm định lượng cho trend tinh
        const { data: relatedItems } = await supabaseAdmin
            .from('crawled_data')
            .select('author_name, author_username, views_count, likes_count, comments_count, shares_count, collect_count, music_id, music_name, posted_at')
            .in('id', uniqueIds);

        let totalViews = 0;
        let totalEngagement = 0;
        let velocitySum = 0;
        const uniqueChannels = new Set<string>();
        const musicMap: Record<string, { name: string, count: number }> = {};
        let topMusicId = '';
        let topMusicName = '';
        let maxMusicCount = 0;

        if (relatedItems && relatedItems.length > 0) {
            relatedItems.forEach((item: any) => {
                totalViews += item.views_count || 0;
                totalEngagement += (item.likes_count || 0) + (item.comments_count || 0) + (item.shares_count || 0) + (item.collect_count || 0);
                
                const channelKey = item.author_username || item.author_name || 'Unknown';
                uniqueChannels.add(channelKey);

                const hours = Math.max(1, (Date.now() - new Date(item.posted_at || Date.now()).getTime()) / (1000 * 60 * 60));
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
        }

        const avgVelocity = (relatedItems && relatedItems.length > 0) ? (velocitySum / relatedItems.length) : 0;
        const velocityScore = Math.min(100, (avgVelocity / minViewsViral) * 100);

        const avgEngagementRate = totalViews > 0 ? (totalEngagement / totalViews) : 0;
        const engagementScore = Math.min(100, (avgEngagementRate / 0.15) * 100);

        const quantitativeScore = (velocityScore * velocityWeight) + (engagementScore * (1 - velocityWeight));
        const aiFactor = trend.trend_score || 50;

        const finalTrendScore = Math.max(0, Math.min(100, Math.round(
            (quantitativeScore * quantitativeWeight) + (aiFactor * (1 - quantitativeWeight))
        )));

        const channelsCount = uniqueChannels.size || 1;

        // Build actual channel stats
        const channelStats = (relatedItems && relatedItems.length > 0)
            ? relatedItems.map((item: any) => 
                `- Kênh ${item.author_name || item.author_username}: ${(item.views_count || 0).toLocaleString()} views | ${(item.likes_count || 0).toLocaleString()} likes`
              ).join('\n')
            : 'N/A';

        // Append music trend link to expert commentary
        let expertCommentary = trend.expert_commentary || '';
        if (topMusicId && topMusicName) {
            const musicLink = `https://www.tiktok.com/music/-${topMusicId}`;
            expertCommentary = `${expertCommentary}\n\n🎵 <b>Âm thanh xu hướng:</b> <a href="${musicLink}">${topMusicName}</a>`;
        }

        const { error: insertError } = await supabaseAdmin.from('trends').insert({
            crawled_data_id: mainDataId,
            related_ids: uniqueIds,
            trend_name: trend.trend_name,
            viral_reason: trend.viral_reason,
            content_ideas: trend.content_ideas,
            trend_score: finalTrendScore,
            videos_count: uniqueIds.length,
            channels_count: channelsCount,
            channel_stats: channelStats,
            expert_commentary: expertCommentary,
            category_id: category_id === 'all' ? null : category_id,
            status: 'pending'
        });
        if (!insertError) insertedCount++;
    }

    // 6. Update Log
    const totalTokens = accumulated_tokens + tokensUsed;
    if (log_id) {
        const { data: currentLog } = await supabaseAdmin.from('ai_logs').select('items_analyzed, prompt_used, response_raw').eq('id', log_id).single();
        const finalItems = currentLog ? currentLog.items_analyzed : 0;
        const existingPrompt = currentLog?.prompt_used || '';
        const existingResponse = currentLog?.response_raw || '';
        
        const newPromptUsed = `${existingPrompt}\n\n=========================================\n=== BƯỚC HỢP NHẤT TRENDS (REDUCE) ===\n=========================================\n${prompt}`;
        
        const newResponseRaw = `${existingResponse}\n\n=========================================\n=== PHẢN HỒI HỢP NHẤT (REDUCE Raw JSON) ===\n=========================================\n${responseText}\n\n=========================================\n=== TỔNG KẾT TIẾN TRÌNH ===\n=========================================\n- Tổng bài phân tích: ${finalItems}\n- Lọc rác và Gộp lại còn: ${insertedCount} Trends tinh hoa.\n- Xóa ${rawTrends.length} Trends trùng lặp.\n📊 Tổng Tokens đã dùng: ${totalTokens.toLocaleString()}`;

        await supabaseAdmin.from('ai_logs').update({
            trends_found: insertedCount,
            prompt_used: newPromptUsed,
            response_raw: newResponseRaw,
            status: 'success'
        }).eq('id', log_id);
    }

    return NextResponse.json({
        success: true,
        reduced_trends: insertedCount,
        tokens_used: tokensUsed
    });

  } catch (error: any) {
    if (logId) {
        try {
            await supabaseAdmin.from('ai_logs').update({ 
                status: 'error', 
                response_raw: `❌ Lỗi ở bước Reduce: ${error.message}`
            }).eq('id', logId);
        } catch(e) {}
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
