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
    const { item_ids, category_id, log_id, is_final_batch, accumulated_tokens = 0 } = body;
    logId = log_id;

    if (!item_ids || !Array.isArray(item_ids) || item_ids.length === 0) {
        return NextResponse.json({ success: true, message: "Không có item nào để xử lý" });
    }

    // 1. Fetch data for this batch
    const { data: rawData, error: fetchError } = await supabaseAdmin
        .from('crawled_data')
        .select('*')
        .in('id', item_ids);

    if (fetchError || !rawData || rawData.length === 0) {
        throw new Error("Không thể fetch dữ liệu batch");
    }

    // 2. Build Prompt
    const { data: settingsData } = await supabaseAdmin.from('system_settings').select('*');
    let base_prompt = "Bạn là chuyên gia. Tìm Trends. Bỏ qua rác.";
    if (settingsData) {
        settingsData.forEach(setting => {
            if (setting.key === 'base_ai_prompt') base_prompt = setting.value;
        });
    }

    let customPrompt = "";
    let min_videos = 1;
    let min_channels = 1;

    if (category_id && category_id !== 'all') {
        const { data: catData } = await supabaseAdmin.from('categories').select('custom_prompt, min_videos, min_channels').eq('id', category_id).single();
        if (catData) {
            if (catData.custom_prompt) {
                customPrompt = `\n\n[HƯỚNG DẪN CHUYÊN MÔN DÀNH RIÊNG CHO NICHE NÀY]:\n${catData.custom_prompt}`;
            }
            if (catData.min_videos) min_videos = catData.min_videos;
            if (catData.min_channels) min_channels = catData.min_channels;
        }
    }

    const dataContext = rawData.map((item, index) => {
        const safeScript = item.transcript 
             ? item.transcript.substring(0, 2000) + (item.transcript.length > 2000 ? "..." : "")
             : "N/A";

        const hours = Math.max(1, (new Date(item.created_at || Date.now()).getTime() - new Date(item.posted_at || Date.now()).getTime()) / (1000 * 60 * 60));
        const viewsPerHour = Math.round((item.views_count || 0) / hours);

        return `Item ${index + 1} (ID: ${item.id}):
- Kênh: ${item.author_name} (${item.author_fans?.toLocaleString()} fans)
- Content: ${item.text_content}
- Kịch bản (Script): ${safeScript}
- Âm nhạc: ${item.music_name || 'N/A'}
- Metrics: ${item.views_count?.toLocaleString()} views, ${item.likes_count?.toLocaleString()} likes, ${item.collect_count?.toLocaleString()} saved
- Tốc độ tăng trưởng: ${viewsPerHour.toLocaleString()} views/giờ (Đăng tải cách đây ${Math.round(hours)} giờ)
`;
    }).join('\n---\n');

    const prompt = `
${base_prompt}
${customPrompt}

ĐIỀU KIỆN LỌC TREND (TUYỆT ĐỐI TUÂN THỦ):
1. ĐỊNH NGHĨA TREND: Một Trend là các chủ đề, sự việc, âm nhạc, đoạn text hoặc kịch bản có tính chất lan truyền, lặp lại hoặc có tiềm năng viral.
2. THU THẬP TIỀM NĂNG: Trong bước phân tích theo lô này, hãy liệt kê tất cả các chủ đề/trend tiềm năng (kể cả chủ đề đó chỉ mới xuất hiện ở 1 video hoặc 1 kênh trong lô này). ĐỪNG LỌC điều kiện tối thiểu số video hay số kênh ở bước này (bước đó sẽ do hệ thống lọc sau).
3. CHỐNG TRÙNG LẶP: Gom tất cả các video cùng chung một chủ đề trong lô này vào một kết quả duy nhất.

HƯỚNG DẪN ĐỌC KỊCH BẢN (SCRIPT):
- Bắt buộc phải soi kỹ trường "Kịch bản (Script)" của từng video.
- Hãy tìm kiếm các mẫu lặp lại (Patterns) nhỏ nhất: một câu nói đùa, một từ lóng, một cấu trúc kể chuyện (hook), hoặc một hành động cụ thể xuất hiện chéo ở nhiều kênh.

Dữ liệu đầu vào:
${dataContext}
`;

    // 3. Call AI
    const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.ARRAY,
                description: "Danh sách các trends phát hiện được",
                items: {
                    type: Type.OBJECT,
                    properties: {
                        crawled_data_ids: { type: Type.ARRAY, items: { type: Type.STRING } },
                        trend_name: { type: Type.STRING },
                        videos_count: { type: Type.INTEGER },
                        channels_count: { type: Type.INTEGER },
                        channel_stats: { type: Type.STRING },
                        viral_reason: { type: Type.STRING },
                        content_ideas: { 
                            type: Type.STRING, 
                            description: "Gợi ý chính xác 3 câu Hook (3 giây đầu) cực kỳ cuốn hút, kích thích sự tò mò để KOL/KOC bắt đầu video đu trend này hiệu quả (đánh số thứ tự 1, 2, 3)."
                        },
                        expert_commentary: { type: Type.STRING },
                        trend_score: { type: Type.INTEGER }
                    },
                    required: ["crawled_data_ids", "trend_name", "videos_count", "channels_count", "channel_stats", "viral_reason", "content_ideas", "expert_commentary", "trend_score"]
                }
            }
        }
    });

    const tokensUsed = (result.usageMetadata && result.usageMetadata.totalTokenCount) ? result.usageMetadata.totalTokenCount : 0;
    const responseText = result.text || "[]";
    let trendsArray = [];
    try {
        trendsArray = JSON.parse(responseText);
    } catch(e) {}

    let newTrendsCount = 0;
    
    for (const trend of trendsArray) {
        if (!trend.crawled_data_ids || trend.crawled_data_ids.length === 0) continue;
        const mainDataId = trend.crawled_data_ids[0];

        const { error: insertError } = await supabaseAdmin.from('trends').insert({
            crawled_data_id: mainDataId,
            related_ids: trend.crawled_data_ids,
            trend_name: trend.trend_name,
            viral_reason: trend.viral_reason,
            content_ideas: trend.content_ideas,
            trend_score: trend.trend_score,
            videos_count: trend.videos_count,
            channels_count: trend.channels_count,
            channel_stats: trend.channel_stats,
            expert_commentary: trend.expert_commentary,
            category_id: category_id === 'all' ? null : category_id,
            status: 'pending'
        });
        if (!insertError) newTrendsCount++;
    }

    await supabaseAdmin.from('crawled_data').update({ is_analyzed: true }).in('id', item_ids);

    // Update Log
    if (log_id) {
        console.log(`[DEBUG] Updating log_id: ${log_id}`);
        console.log(`[DEBUG] Using key starting with: ${serviceKey?.substring(0, 15)}... Is it Anon? ${serviceKey === process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`);
        
        const { data: currentLog, error: selectError } = await supabaseAdmin.from('ai_logs').select('items_analyzed, trends_found, prompt_used, response_raw').eq('id', log_id).single();
        console.log(`[DEBUG] currentLog:`, currentLog, `Error:`, selectError);
        
        if (currentLog) {
            const newItems = (currentLog.items_analyzed || 0) + item_ids.length;
            const newTrends = (currentLog.trends_found || 0) + newTrendsCount;
            const newTokens = accumulated_tokens + tokensUsed;
            
            const existingPrompt = currentLog.prompt_used || '';
            const existingResponse = currentLog.response_raw || '';
            
            const batchNum = existingPrompt ? (existingPrompt.split('=== LÔ').length) : 1;
            
            const newPromptUsed = existingPrompt 
              ? `${existingPrompt}\n\n=========================================\n=== LÔ PHÂN TÍCH THỨ ${batchNum} ===\n=========================================\n${prompt}`
              : `=========================================\n=== LÔ PHÂN TÍCH THỨ 1 ===\n=========================================\n${prompt}`;
              
            const newResponseRaw = (existingResponse && !existingResponse.startsWith('Đang bắt đầu'))
              ? `${existingResponse}\n\n=========================================\n=== PHẢN HỒI LÔ THỨ ${batchNum} (Raw JSON) ===\n=========================================\n${responseText}`
              : `=========================================\n=== PHẢN HỒI LÔ THỨ 1 (Raw JSON) ===\n=========================================\n${responseText}`;

            const { error: updateError } = await supabaseAdmin.from('ai_logs').update({
                items_analyzed: newItems,
                trends_found: newTrends,
                prompt_used: newPromptUsed,
                response_raw: newResponseRaw,
                status: 'processing'
            }).eq('id', log_id);
            
            console.log(`[DEBUG] Update Error:`, updateError);
        }
    }

    return NextResponse.json({
        success: true,
        trends_found: newTrendsCount,
        tokens_used: tokensUsed
    });

  } catch (error: any) {
    if (logId) {
        try {
            await supabaseAdmin.from('ai_logs').update({ 
                status: 'error', 
                error_message: error.message,
                response_raw: `❌ Lỗi tiến trình: ${error.message}`
            }).eq('id', logId);
        } catch(e) {}
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
