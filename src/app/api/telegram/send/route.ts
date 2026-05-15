import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { format } from 'date-fns';

export async function POST(request: Request) {
  try {
    const { trendId } = await request.json();

    if (!trendId) {
      return NextResponse.json({ error: 'Thiếu trendId' }, { status: 400 });
    }

    // 1. Lấy thông tin Trend và dữ liệu gốc (URL video) từ DB
    const { data: trend, error: trendError } = await supabaseAdmin
      .from('trends')
      .select(`
        *,
        crawled_data (
          post_url,
          author_name,
          views_count
        )
      `)
      .eq('id', trendId)
      .single();

    if (trendError || !trend) {
      return NextResponse.json({ error: 'Không tìm thấy Trend' }, { status: 404 });
    }

    // 2. Lấy thông tin chi tiết của tất cả video liên quan
    let channelStatsText = "";
    if (trend.related_ids && Array.isArray(trend.related_ids) && trend.related_ids.length > 0) {
        const { data: relatedItems } = await supabaseAdmin
            .from('crawled_data')
            .select('author_name, views_count, likes_count, posted_at, post_url')
            .in('id', trend.related_ids);
        
        if (relatedItems) {
            channelStatsText = relatedItems.map(item => {
                const dateStr = item.posted_at ? format(new Date(item.posted_at), 'dd/MM') : '??';
                return `• <b>${item.author_name}</b>: ${item.views_count?.toLocaleString()} view | ${item.likes_count?.toLocaleString()} tim | ${dateStr}\n  👉 <a href="${item.post_url}">Xem clip</a>`;
            }).join('\n');
        }
    } else {
        channelStatsText = `• <b>${trend.crawled_data?.author_name || 'N/A'}</b>: ${trend.crawled_data?.views_count?.toLocaleString()} view\n  👉 <a href="${trend.crawled_data?.post_url}">Xem clip</a>`;
    }

    // 3. Format tin nhắn Telegram (Fix lỗi xuống dòng từ AI)
    const fixNL = (text: string) => text ? text.replace(/\\n/g, '\n') : '';

    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!telegramToken || !chatId) {
       return NextResponse.json({ error: 'Chưa cấu hình Telegram Bot' }, { status: 500 });
    }

    const authorName = trend.crawled_data ? trend.crawled_data.author_name : 'Unknown';
    const views = trend.crawled_data ? trend.crawled_data.views_count : 0;

    const messageText = `
🔥 <b>XU HƯỚNG MỚI: ${trend.trend_name}</b>
⚡️ Độ hot: ${trend.trend_score}/100

📊 <b>THỐNG KÊ 24H QUA:</b>
- Số video tham gia: ${trend.videos_count || 1} video
- Số kênh lan truyền: ${trend.channels_count || 1} kênh
- Chi tiết nguồn tham khảo:
${channelStatsText}

💡 <b>LÝ DO VIRAL:</b>
${fixNL(trend.viral_reason)}

🧐 <b>NHẬN XÉT TỪ AI CHUYÊN GIA:</b>
${fixNL(trend.expert_commentary)}

🎯 <b>KỊCH BẢN CHO KOL:</b>
${fixNL(trend.content_ideas)}
`;

    // 3. Gọi Telegram API để gửi tin
    const url = `https://api.telegram.org/bot${telegramToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: messageText,
        parse_mode: 'HTML',
        disable_web_page_preview: false // Cho phép hiện hình thu nhỏ của video
      }),
    });

    const result = await response.json();

    if (!result.ok) {
        throw new Error(result.description || 'Lỗi gửi tin nhắn Telegram');
    }

    return NextResponse.json({ message: 'Gửi Telegram thành công' });

  } catch (error: any) {
    console.error('Telegram Send Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
