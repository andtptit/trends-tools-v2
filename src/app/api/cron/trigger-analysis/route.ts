import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const category_id = searchParams.get('category_id') || 'all';
    const hours = parseInt(searchParams.get('hours') || '48');
    const limit = parseInt(searchParams.get('limit') || '300');
    const isAnalyzedParam = searchParams.get('is_analyzed');
    const isAnalyzed = isAnalyzedParam === 'true'; // Mặc định là false (chỉ bài chưa phân tích)
    const pruneDaysParam = searchParams.get('prune_days');
    const pruneDays = pruneDaysParam ? parseInt(pruneDaysParam) : 14;

    // 1. Xác thực bảo mật bằng secret token
    const cronSecret = process.env.CRON_SECRET || 'qua_trinh_phan_tich_tu_dong_2026';
    if (secret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Tự động dọn dẹp các bài đăng cũ đã được phân tích để tránh tràn bộ nhớ DB
    if (pruneDays > 0) {
      const pruneThreshold = new Date(Date.now() - pruneDays * 24 * 60 * 60 * 1000).toISOString();
      const { error: pruneError } = await supabaseAdmin
        .from('crawled_data')
        .delete()
        .eq('is_analyzed', true)
        .lt('created_at', pruneThreshold);

      if (pruneError) {
        console.warn("Lỗi khi tự động dọn dẹp crawled_data cũ:", pruneError.message);
      }
    }

    // 2. Tìm danh sách bài viết theo bộ lọc phân tích (mặc định là chưa phân tích)
    let query = supabaseAdmin
      .from('crawled_data')
      .select('id')
      .eq('is_analyzed', isAnalyzed);

    // Lọc theo Niche/Category
    if (category_id) {
      if (category_id === 'global') {
        query = query.is('category_id', null);
      } else if (category_id !== 'all') {
        query = query.eq('category_id', category_id);
      }
    }

    // Lọc theo khoảng thời gian đăng tải/cào gần đây (tránh phân tích bài quá cũ)
    const hoursAgo = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    query = query.gt('created_at', hoursAgo);

    const { data: items, error: fetchError } = await query.limit(limit);

    if (fetchError) throw fetchError;

    if (!items || items.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Không có bài đăng mới nào thỏa mãn điều kiện cần phân tích.',
        items_count: 0
      });
    }

    const targetIds = items.map(item => item.id);

    // 3. Khởi tạo phiên phân tích (Start Session)
    // Dọn dẹp các trend thô cũ của trạng thái 'analyzed' thuộc danh mục này
    let deleteQuery = supabaseAdmin.from('trends').delete().eq('status', 'analyzed');
    if (category_id && category_id !== 'all') {
      if (category_id === 'global') {
        deleteQuery = deleteQuery.is('category_id', null);
      } else {
        deleteQuery = deleteQuery.eq('category_id', category_id);
      }
    }
    const { error: deleteError } = await deleteQuery;
    if (deleteError) {
      console.warn("Lỗi khi dọn dẹp các trend thô cũ:", deleteError.message);
    }

    // Ghi nhận log AI mới
    const { data: logEntry, error: logError } = await supabaseAdmin
      .from('ai_logs')
      .insert({
        status: 'processing',
        response_raw: 'Đang bắt đầu phân tích tự động qua cron...',
        items_analyzed: 0,
        trends_found: 0,
        category_id: category_id === 'all' || category_id === 'global' ? null : category_id,
        trigger_type: 'api'
      })
      .select()
      .single();

    if (logError || !logEntry) {
      throw new Error(logError?.message || "Không thể khởi tạo log phân tích");
    }

    const logId = logEntry.id;

    // 4. Kích hoạt Webhook gửi cho n8n chạy ngầm xử lý hàng loạt
    const webhookUrl = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL;
    if (!webhookUrl || webhookUrl.includes('your-n8n-url')) {
      throw new Error("Chưa cấu hình NEXT_PUBLIC_N8N_WEBHOOK_URL hợp lệ");
    }

    const webhookRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_ids: targetIds,
        category_id: category_id,
        log_id: logId
      })
    });

    if (!webhookRes.ok) {
      throw new Error("n8n Webhook không phản hồi hoặc trả về mã lỗi");
    }

    return NextResponse.json({
      success: true,
      message: `Đã kích hoạt phân tích tự động thành công cho ${targetIds.length} bài đăng.`,
      log_id: logId,
      items_count: targetIds.length
    });

  } catch (error: any) {
    console.error('Trigger Cron Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Hỗ trợ cả POST
export async function POST(request: Request) {
  return GET(request);
}
