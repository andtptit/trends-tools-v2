import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { GoogleGenAI, Type } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const maxDuration = 60; // 60 seconds Vercel timeout limit

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

    let query = supabaseAdmin.from('trends').select('*').eq('status', 'analyzed');
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

    // 1.5 Fetch memory rules (up to 20 active rules) and history approved trends safely
    let memoryPrompt = "";
    let historyPrompt = "";
    try {
        const { data: memoryRules } = await supabaseAdmin
            .from('ai_feedback_memory')
            .select('rule_type, user_feedback, example_case')
            .eq('is_active', true)
            .limit(20);

        if (memoryRules && memoryRules.length > 0) {
            memoryPrompt = `\nQUY TẮC BỘ NHỚ LỊCH SỬ TỪ NGƯỜI DÙNG (BẮT BUỘC TUÂN THỦ TUYỆT ĐỐI):\n`;
            memoryRules.forEach((rule, idx) => {
                memoryPrompt += `- [Quy tắc ${idx + 1} - Loại ${rule.rule_type}]: ${rule.user_feedback}`;
                if (rule.example_case) {
                    memoryPrompt += ` (Ví dụ: ${rule.example_case})`;
                }
                memoryPrompt += `\n`;
            });
        }
    } catch (e: any) {
        console.warn("Chưa tạo bảng ai_feedback_memory hoặc lỗi truy cập:", e.message);
    }

    try {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
        const { data: approvedTrends } = await supabaseAdmin
            .from('trends')
            .select('trend_name, viral_reason')
            .eq('status', 'approved')
            .gt('created_at', threeDaysAgo);

        if (approvedTrends && approvedTrends.length > 0) {
            historyPrompt = `\nDANH SÁCH CÁC TREND ĐÃ DUYỆT GẦN ĐÂY (TRÁNH TRÙNG LẶP HOẶC TẠO LẠI TRÙNG):
(Dưới đây là các chủ đề đã được duyệt đăng gần đây. Nếu các video mới thuộc một trong các sự kiện này, hãy cân nhắc xem có phải sự kiện mới hay không. Nếu là cùng một sự kiện cũ, hãy bỏ qua không tạo trend mới để tránh lặp lại tin cũ trên kênh):\n`;
            approvedTrends.forEach((t, idx) => {
                historyPrompt += `- Trend đã duyệt ${idx + 1}: ${t.trend_name} (${t.viral_reason})\n`;
            });
        }
    } catch (e: any) {
        console.warn("Lỗi truy vấn trends đã duyệt:", e.message);
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

LUẬT GỘP TREND & LỌC ĐIỀU KIỆN (BẮT BUỘC):
1. Định nghĩa "Trùng lặp" để gộp:
   - CHỈ gộp các Trend thô nói về cùng 1 sự việc/sự kiện cụ thể (ví dụ: cùng một vụ cháy ở xưởng mút Hương Lộ 2, cùng một vụ án mẹ kế ở Quảng Ninh, cùng một sự việc anh Hoàng dùng bình cứu hỏa cứu người ở Hải Phòng, cùng một vụ bão/sóng lớn ở thành phố Nichinan Nhật Bản).
   - CHỈ gộp các Trend thô sử dụng chung 1 bài nhạc nền (music), cùng 1 format kịch bản (ví dụ: nhờ bố trông cá và cái kết, nắp mì tôm bói quẻ).
   - TUYỆT ĐỐI KHÔNG được gộp các sự việc/tin tức/chủ đề khác nhau vào chung một nhóm lớn mang tên chung chung (ví dụ: KHÔNG được gom các vụ án, vụ cháy, phạt xe khách khác nhau thành một trend chung mang tên "Tin tức xã hội", "Vấn đề pháp luật", "Câu chuyện nhân văn", v.v.). Mỗi sự việc/sự kiện cụ thể phải là một Trend riêng biệt.

2. Phân rã (Split) các trend thô bị gom nhóm quá rộng:
   - Nếu trong danh sách các Trend thô đầu vào có chứa các trend bị gom nhóm quá rộng hoặc chứa nhiều sự việc khác nhau (ví dụ: 'Chuyện lạ đời/Tâm linh/Kỳ quái khó lý giải' chứa cả vụ chim lạ lẫn vụ giả chết và mì tôm; hoặc 'Tin tức xã hội' chứa cả vụ tôm chết lẫn cháy xưởng), bạn BẮT BUỘC phải phân rã (Split) chúng thành các trend cụ thể riêng biệt (ví dụ: tách thành 'Chú chim lạ đậu trên di ảnh ở Hưng Yên', 'Thanh niên giả chết để chia tay', 'Mì tôm bói quẻ Nhật Bản').

3. Đặt "Tên Trend" cụ thể và chi tiết:
   - Tên Trend phải phản ánh đúng sự việc/kịch bản cụ thể đó (ví dụ: "Hình ảnh sóng lớn dữ dội sau bão tại Nhật Bản", "Vụ cháy xưởng sản xuất mút tại Hương Lộ 2 TPHCM", "Anh hùng Hải Phòng dùng bình cứu hỏa giải cứu người phụ nữ bị đâm").
   - Tuyệt đối không đặt tên bao quát, mơ hồ, mang tính danh mục chung chung.

4. Bảo toàn và Lọc điều kiện tối thiểu:
   - Trend sau khi gộp hoặc đứng riêng lẻ phải thỏa mãn bộ lọc:
     * Có tổng cộng từ ${min_videos} bài viết (IDs) trở lên.
     * Xuất hiện ở từ ${min_channels} kênh khác nhau trở lên.
     Nếu không thỏa mãn cả hai điều kiện trên, hãy LOẠI BỎ hoàn toàn trend đó khỏi danh sách kết quả.
   - BẮT BUỘC giữ lại toàn bộ các trend riêng biệt thỏa mãn điều kiện lọc trên, tuyệt đối không được bỏ sót, tự ý xóa bỏ hoặc ngộp chung các trend đủ điều kiện vào nhau.

5. Số lượng kênh và video: Bạn không cần đếm chính xác, hệ thống sẽ tự đếm dựa trên IDs bài viết bạn trả về. Bạn chỉ cần trả về mảng crawled_data_ids chứa TẤT CẢ các ID của các video thuộc Trend đã gộp.

${memoryPrompt}
${historyPrompt}

BƯỚC TỰ KIỂM LỖI & SỬA SAI (REFLECTION LOOP):
Trước khi trả ra kết quả cuối cùng, hãy tự đóng vai trò là một người kiểm duyệt khó tính và đánh giá lại danh sách trend vừa dự thảo:
1. Đã có trend nào vi phạm quy tắc bộ nhớ ở trên chưa? (Ví dụ: Bạn có đang gom chung scandal trốn thuế của Ji Chang Wook và đám cưới của Hà Du Quân lại thành một nhóm "Tin tức người nổi tiếng" không? Nếu có, hãy tách chúng ra ngay lập tức thành hai trend riêng biệt!).
2. Tên các trend đã có địa danh cụ thể (ví dụ: Miền Tây, Hải Phòng, Đồng Nai...) nếu dữ liệu gốc có đề cập chưa? 
Hãy thực hiện sửa sai và chỉ trả về danh sách các trend đã được hoàn thiện 100%.

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

        // Truy vấn dữ liệu thực tế từ database để tính điểm định lượng cho trend tinh
        const { data: relatedItems } = await supabaseAdmin
            .from('crawled_data')
            .select('id, author_name, author_username, views_count, likes_count, comments_count, shares_count, collect_count, music_id, music_name, posted_at, created_at')
            .in('id', uniqueIds);

        // Lọc ra các ID thực sự tồn tại trong database (để tránh lỗi khóa ngoại do AI chép sai UUID)
        const validIds = relatedItems ? relatedItems.map((item: any) => item.id) : [];

        if (validIds.length === 0) {
            console.warn(`Bỏ qua trend "${trend.trend_name}" do không chứa ID bài viết hợp lệ nào trong DB.`);
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

        if (relatedItems && relatedItems.length > 0) {
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
        }

        const avgVelocity = (relatedItems && relatedItems.length > 0) ? (velocitySum / relatedItems.length) : 0;
        const velocityScore = Math.min(100, (avgVelocity / minViewsViral) * 100);

        const avgEngagementRate = totalViews > 0 ? (totalEngagement / totalViews) : 0;
        const engagementScore = Math.min(100, (avgEngagementRate / 0.15) * 100);

        const quantitativeScore = (velocityScore * velocityWeight) + (engagementScore * (1 - velocityWeight));
        let aiFactor = trend.trend_score || 50;
        // Nếu AI chấm thang điểm 10 (<= 10), quy đổi về thang điểm 100
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
