import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { GoogleGenAI, Type } from '@google/genai';

// Khởi tạo Gemini AI SDK mới
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request: Request) {
  try {
    // Nhận tham số từ body
    let item_ids: string[] = [];
    let category_id: string | null = null;
    try {
        const body = await request.json();
        if (body.item_ids) item_ids = body.item_ids;
        if (body.category_id) category_id = body.category_id;
    } catch(e) { }

    // 0. Lấy cấu hình hệ thống
    const { data: settingsData } = await supabaseAdmin.from('system_settings').select('*');
    let base_prompt = "Bạn là một chuyên gia nghiên cứu xu hướng (Trend Analyst) trên mạng xã hội TikTok và Facebook.\nHãy phân tích danh sách các video/bài đăng dưới đây và nhận diện các XU HƯỚNG (Trends) đang nổi lên.\nLưu ý: Có thể gộp nhiều item có nội dung hoặc chủ đề tương tự nhau thành 1 trend. Bỏ qua các item rác không có ý nghĩa.";
    
    if (settingsData) {
        settingsData.forEach(setting => {
            if (setting.key === 'base_ai_prompt') base_prompt = setting.value;
        });
    }

    // Biến cấu hình AI theo Niche (Mặc định là 1 nếu không chọn Niche)
    let min_videos = 1;
    let min_channels = 1;

    // 1. Lấy dữ liệu chưa phân tích từ database
    let query = supabaseAdmin
      .from('crawled_data')
      .select('id, author_name, author_fans, author_verified, text_content, views_count, likes_count, collect_count, music_name, video_duration, is_slideshow');
      
    if (item_ids.length > 0) {
        query = query.in('id', item_ids);
    } else {
        query = query.eq('is_analyzed', false).limit(50);
    }

    const { data: rawData, error: fetchError } = await query;

    if (fetchError) throw fetchError;
    if (!rawData || rawData.length === 0) {
      return NextResponse.json({ message: 'Không có dữ liệu để phân tích.' });
    }

    // 2. Chuyển đổi dữ liệu thành chuỗi văn bản cho Prompt
    const dataContext = rawData.map((item, index) => {
      return `Item ${index + 1} (ID: ${item.id}):
- Kênh: ${item.author_name} (${item.author_fans?.toLocaleString()} fans${item.author_verified ? ', Verified' : ''})
- Content: ${item.text_content}
- Âm nhạc: ${item.music_name || 'N/A'}
- Định dạng: ${item.is_slideshow ? 'Slideshow' : 'Video'} (${item.video_duration}s)
- Metrics: ${item.views_count} views, ${item.likes_count} likes, ${item.collect_count} saved
`;
    }).join('\n---\n');

    let customPrompt = "";
    if (category_id) {
        const { data: cat } = await supabaseAdmin
            .from('categories')
            .select('custom_prompt, min_videos, min_channels')
            .eq('id', category_id)
            .single();
        if (cat) {
            if (cat.custom_prompt) {
                customPrompt = `\n\n[HƯỚNG DẪN CHUYÊN MÔN DÀNH RIÊNG CHO NICHE NÀY]:\n${cat.custom_prompt}`;
            }
            if (cat.min_videos) min_videos = cat.min_videos;
            if (cat.min_channels) min_channels = cat.min_channels;
        }
    }

    const prompt = `
${base_prompt}

ĐIỀU KIỆN LỌC TREND BẮT BUỘC:
- Một Trend phải xuất hiện trong ít nhất ${min_videos} video/bài đăng khác nhau.
- Một Trend phải được đăng tải bởi ít nhất ${min_channels} kênh (author) khác nhau.
Nếu không thỏa mãn cả 2 điều kiện này, tuyệt đối không tính là Trend.

${customPrompt}

Dữ liệu đầu vào:
${dataContext}
`;

    // 3. Gọi Gemini 2.5 Flash với Structured Output (đảm bảo JSON chuẩn 100%)
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
                        crawled_data_ids: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "Danh sách ID (chính xác như ID đã cho) của các item thuộc trend này"
                        },
                        trend_name: {
                            type: Type.STRING,
                            description: "Tên ngắn gọn, bắt tai cho trend này"
                        },
                        videos_count: {
                            type: Type.INTEGER,
                            description: "Số lượng video/bài đăng đã tạo nên trend này"
                        },
                        channels_count: {
                            type: Type.INTEGER,
                            description: "Số lượng kênh (author) khác nhau đã đăng tải nội dung thuộc trend này"
                        },
                        channel_stats: {
                            type: Type.STRING,
                            description: "Thống kê dạng chuỗi, liệt kê chi tiết tên kênh, kèm theo tổng View và Tim của kênh đó trong trend này. Ví dụ: '- Kênh A: 1M Views | 50K Tim.\\n- Kênh B: 500K Views | 20K Tim.'"
                        },
                        viral_reason: {
                            type: Type.STRING,
                            description: "Giải thích ngắn gọn lý do vì sao nội dung này đang viral hoặc có khả năng viral mạnh"
                        },
                        content_ideas: {
                            type: Type.STRING,
                            description: "Gợi ý 2-3 ý tưởng kịch bản hoặc góc nhìn để KOL/KOC có thể 'đu' trend này hiệu quả"
                        },
                        expert_commentary: {
                            type: Type.STRING,
                            description: "Lời bình/Nhận xét cá nhân của riêng bạn (AI) về tiềm năng thực sự của trend này. Có bền vững không? Có dễ chuyển đổi bán hàng không?"
                        },
                        trend_score: {
                            type: Type.INTEGER,
                            description: "Điểm số đánh giá độ hot của trend từ 0 đến 100 dựa trên các Metrics"
                        }
                    },
                    required: ["crawled_data_ids", "trend_name", "videos_count", "channels_count", "channel_stats", "viral_reason", "content_ideas", "expert_commentary", "trend_score"]
                }
            }
        }
    });

    const responseText = result.text || "";
    const trendsArray = JSON.parse(responseText);

    if (trendsArray.length === 0) {
        return NextResponse.json({ message: 'AI không phát hiện được trend nào rõ rệt từ tập dữ liệu này dựa trên cài đặt của bạn.' });
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
                related_ids: trend.crawled_data_ids || [], // Lưu toàn bộ danh sách ID
                trend_name: trend.trend_name,
                viral_reason: trend.viral_reason,
                content_ideas: trend.content_ideas,
                trend_score: trend.trend_score,
                videos_count: trend.videos_count,
                channels_count: trend.channels_count,
                channel_stats: trend.channel_stats,
                expert_commentary: trend.expert_commentary,
                category_id: category_id, // Lưu danh mục
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

    // 6. Ghi log AI
    const { error: logError } = await supabaseAdmin.from('ai_logs').insert({
        category_id: category_id || null, // Đảm bảo null nếu không có
        items_analyzed: rawData.length,
        trends_found: insertedTrends.length,
        status: 'success',
        prompt_used: prompt,
        response_raw: responseText
    });

    if (logError) {
        console.error("Lỗi ghi log AI:", logError);
    }

    return NextResponse.json({
        message: 'Phân tích AI hoàn tất!',
        trends_found: insertedTrends.length,
        trends: insertedTrends
    });

  } catch (error: any) {
    console.error('AI Analysis Error:', error);
    
    // Ghi log lỗi
    try {
       await supabaseAdmin.from('ai_logs').insert({
          status: 'error',
          error_message: error.message || 'Unknown error'
       });
    } catch(e) {
       console.error("Không thể ghi log lỗi AI:", e);
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
