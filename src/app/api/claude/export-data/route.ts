import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    // 1. Xác thực API Key
    const apiKey = request.headers.get('x-api-key') || request.headers.get('authorization')?.replace('Bearer ', '');
    const validKey = process.env.CLAUDE_API_KEY;

    if (!validKey || apiKey !== validKey) {
      return NextResponse.json({ error: 'Unauthorized. Invalid API Key.' }, { status: 401 });
    }

    // 2. Lấy parameters từ URL
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const categoryId = searchParams.get('category_id');
    
    let limit = 50; // Mặc định 50 items để tránh quá tải token
    if (limitParam && !isNaN(parseInt(limitParam))) {
      limit = parseInt(limitParam);
    }
    
    // Giới hạn an toàn tối đa 500 items mỗi lần gọi
    if (limit > 500) limit = 500;

    // 3. Query dữ liệu thô chưa phân tích
    let query = supabaseAdmin
      .from('crawled_data')
      .select('id, author_name, author_fans, text_content, music_name, views_count, likes_count, collect_count, is_slideshow, video_duration, posted_at')
      .eq('is_analyzed', false)
      .order('views_count', { ascending: false })
      .limit(limit);

    if (categoryId) {
        query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Export Data Error (DB):', error);
      return NextResponse.json({ error: 'Lỗi truy xuất cơ sở dữ liệu' }, { status: 500 });
    }

    // 4. Trả về JSON sạch sẽ
    return NextResponse.json({
        success: true,
        count: data?.length || 0,
        message: "Hãy sử dụng danh sách này để phân tích Trend. Định dạng JSON đã được tối ưu hóa.",
        data: data || []
    });

  } catch (error: any) {
    console.error('Export Data Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
