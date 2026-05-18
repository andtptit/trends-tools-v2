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

    if (category_id && category_id !== 'all') {
        const { data: catData } = await supabaseAdmin.from('categories').select('prompt').eq('id', category_id).single();
        if (catData?.prompt) {
            base_prompt = catData.prompt;
        }
    }

    const dataContext = rawData.map((item, index) => {
        return `Item ${index + 1} (ID: ${item.id}):
- Kênh: ${item.author_name} (${item.author_fans} fans)
- Content: ${item.text_content}
- Âm nhạc: ${item.music_name || 'N/A'}
- Metrics: ${item.views_count} views, ${item.likes_count} likes, ${item.collect_count} saved
`;
    }).join('\n---\n');

    const prompt = `
${base_prompt}

ĐIỀU KIỆN LỌC TREND BẮT BUỘC:
- Một Trend phải xuất hiện trong ít nhất 1 video/bài đăng khác nhau.
- Một Trend phải được đăng tải bởi ít nhất 1 kênh (author) khác nhau.

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
                        content_ideas: { type: Type.STRING },
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
        
        const { data: currentLog, error: selectError } = await supabaseAdmin.from('ai_logs').select('items_analyzed, trends_found').eq('id', log_id).single();
        console.log(`[DEBUG] currentLog:`, currentLog, `Error:`, selectError);
        
        if (currentLog) {
            const newItems = (currentLog.items_analyzed || 0) + item_ids.length;
            const newTrends = (currentLog.trends_found || 0) + newTrendsCount;
            const newTokens = accumulated_tokens + tokensUsed;
            
            const { error: updateError } = await supabaseAdmin.from('ai_logs').update({
                items_analyzed: newItems,
                trends_found: newTrends,
                prompt_used: base_prompt,
                response_raw: is_final_batch 
                    ? `✅ Hoàn tất! Phân tích ${newItems} bài, tìm thấy ${newTrends} trends.\n\n📊 Tổng Tokens: ${newTokens.toLocaleString()}` 
                    : `⏳ Đang xử lý... Đã phân tích ${newItems} bài, tìm thấy ${newTrends} trends.\n\n📊 Tokens tích lũy: ${newTokens.toLocaleString()}`,
                status: is_final_batch ? 'success' : 'processing'
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
