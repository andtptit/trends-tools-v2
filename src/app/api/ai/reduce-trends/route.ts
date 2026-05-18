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
    logId = log_id;

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
                        content_ideas: { type: Type.STRING },
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

        const { error: insertError } = await supabaseAdmin.from('trends').insert({
            crawled_data_id: mainDataId,
            related_ids: uniqueIds,
            trend_name: trend.trend_name,
            viral_reason: trend.viral_reason,
            content_ideas: trend.content_ideas,
            trend_score: trend.trend_score,
            videos_count: uniqueIds.length,
            channels_count: 1, // Will be updated correctly by UI later if needed, or we just put 1
            channel_stats: 'N/A',
            expert_commentary: trend.expert_commentary,
            category_id: category_id === 'all' ? null : category_id,
            status: 'pending'
        });
        if (!insertError) insertedCount++;
    }

    // 6. Update Log
    const totalTokens = accumulated_tokens + tokensUsed;
    if (log_id) {
        const { data: currentLog } = await supabaseAdmin.from('ai_logs').select('items_analyzed').eq('id', log_id).single();
        const finalItems = currentLog ? currentLog.items_analyzed : 0;
        
        await supabaseAdmin.from('ai_logs').update({
            trends_found: insertedCount,
            response_raw: `✅ Hoàn tất toàn bộ tiến trình (Map-Reduce)!\n\n- Tổng bài phân tích: ${finalItems}\n- Lọc rác và Gộp lại còn: ${insertedCount} Trends tinh hoa.\n- Xóa ${rawTrends.length} Trends rác/trùng lặp.\n\n📊 Tổng Tokens: ${totalTokens.toLocaleString()}`,
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
