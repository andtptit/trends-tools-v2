import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const { category_id, total_items } = await request.json();

    const { data: logEntry, error } = await supabaseAdmin.from('ai_logs').insert({
        status: 'processing',
        response_raw: 'Đang bắt đầu phân tích...',
        items_analyzed: 0,
        trends_found: 0,
        category_id: category_id === 'all' ? null : category_id
    }).select().single();

    if (error || !logEntry) {
        throw new Error(error?.message || "Không thể khởi tạo log");
    }

    return NextResponse.json({
        success: true,
        log_id: logEntry.id
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
