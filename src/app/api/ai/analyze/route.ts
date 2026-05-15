import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { GoogleGenAI, Type } from '@google/genai';

// Khởi tạo Gemini AI SDK mới
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    // 1. Lấy dữ liệu chưa phân tích từ database
    const { data: rawData, error: fetchError } = await supabaseAdmin
      .from('crawled_data')
      .select('id, text_content, views_count, likes_count, shares_count, comments_count')
      .eq('is_analyzed', false)
      .limit(50); // Giới hạn 50 bài để tránh vượt token limit mỗi lần chạy

    if (fetchError) throw fetchError;
    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ message: 'Không có dữ liệu mới để phân tích.' });
    }

    // 2. Chuyển đổi dữ liệu thành chuỗi văn bản cho Prompt
    const dataContext = rawData.map((item, index) => {
      return `Item ${index + 1} (ID: ${item.id}):
Text/Caption: ${item.text_content}
Metrics: ${item.views_count} views, ${item.likes_count} likes, ${item.shares_count} shares, ${item.comments_count} comments
`;
    }).join('\n---\n');

    const prompt = `
Bạn là một chuyên gia nghiên cứu xu hướng (Trend Analyst) trên mạng xã hội TikTok và Facebook.
Hãy phân tích danh sách các video/bài đăng dưới đây và nhận diện các XU HƯỚNG (Trends) đang nổi lên.
Lưu ý: Có thể gộp nhiều item có nội dung hoặc chủ đề tương tự nhau thành 1 trend. Bỏ qua các item rác không có ý nghĩa.

Dữ liệu đầu vào:
${dataContext}
`;

    // 3. Gọi Gemini 2.5 Flash với Structured Output (đảm bảo JSON chuẩn 100%)
    const response = await ai.models.generateContent({
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
                        crawled_data_ids: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "Danh sách ID (chính xác như ID đã cho) của các item thuộc trend này"
                        },
                        trend_name: {
                            type: Type.STRING,
                            description: "Tên ngắn gọn, bắt tai cho trend này"
                        },
                        viral_reason: {
                            type: Type.STRING,
                            description: "Giải thích ngắn gọn lý do vì sao nội dung này đang viral hoặc có khả năng viral mạnh"
                        },
                        content_ideas: {
                            type: Type.STRING,
                            description: "Gợi ý 2-3 ý tưởng kịch bản hoặc góc nhìn để KOL/KOC có thể 'đu' trend này hiệu quả"
                        },
                        trend_score: {
                            type: Type.INTEGER,
                            description: "Điểm số đánh giá độ hot của trend từ 0 đến 100 dựa trên các Metrics"
                        }
                    },
                    required: ["crawled_data_ids", "trend_name", "viral_reason", "content_ideas", "trend_score"]
                }
            }
        }
    });

    if (!response.text) {
        throw new Error('Gemini không trả về kết quả văn bản.');
    }

    const trendsArray = JSON.parse(response.text);

    if (trendsArray.length === 0) {
        return NextResponse.json({ message: 'AI không phát hiện được trend nào rõ rệt từ tập dữ liệu này.' });
    }

    // 4. Lưu kết quả AI trả về vào Database
    const insertedTrends = [];
    for (const trend of trendsArray) {
        // MVP: Lưu 1 trend ánh xạ vào ID đầu tiên của mảng
        const mainDataId = trend.crawled_data_ids && trend.crawled_data_ids.length > 0 
            ? trend.crawled_data_ids[0] 
            : null;

        if (!mainDataId) continue;

        const { data: newTrend, error: insertError } = await supabaseAdmin
            .from('trends')
            .insert({
                crawled_data_id: mainDataId,
                trend_name: trend.trend_name,
                viral_reason: trend.viral_reason,
                content_ideas: trend.content_ideas,
                trend_score: trend.trend_score,
                status: 'pending' // Chờ Admin duyệt
            })
            .select()
            .single();

        if (insertError) {
             console.error("Lỗi insert trend:", insertError);
             continue;
        }
        insertedTrends.push(newTrend);
    }

    // 5. Đánh dấu các bản ghi raw data đã được phân tích
    const analyzedIds = rawData.map((r: any) => r.id);
    await supabaseAdmin
        .from('crawled_data')
        .update({ is_analyzed: true })
        .in('id', analyzedIds);

    return NextResponse.json({
        message: 'Phân tích AI hoàn tất!',
        trends_found: insertedTrends.length,
        trends: insertedTrends
    });

  } catch (error: any) {
    console.error('AI Analysis Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
