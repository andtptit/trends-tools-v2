import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

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

    // 2. Format tin nhắn Telegram bằng HTML (cho phép bôi đậm, in nghiêng)
    const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!telegramToken || !chatId) {
       return NextResponse.json({ error: 'Chưa cấu hình Telegram Bot' }, { status: 500 });
    }

    // Lấy link bài viết gốc nếu có
    const originalPostUrl = trend.crawled_data ? trend.crawled_data.post_url : '';
    const authorName = trend.crawled_data ? trend.crawled_data.author_name : 'Unknown';
    const views = trend.crawled_data ? trend.crawled_data.views_count : 0;

    const messageText = `
🔥 <b>XU HƯỚNG MỚI PHÁT HIỆN</b> 🔥

📌 <b>Tên Trend:</b> ${trend.trend_name}
🎯 <b>Điểm:</b> ${trend.trend_score}/100

💡 <b>Vì sao lại hot?</b>
${trend.viral_reason}

🎬 <b>Gợi ý Content cho KOL:</b>
${trend.content_ideas}

🔗 <b>Nguồn tham khảo:</b>
👤 Tác giả: ${authorName} (${views.toLocaleString()} views)
👉 <a href="${originalPostUrl}">Xem video gốc</a>
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
