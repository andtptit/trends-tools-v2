import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    const category_id = searchParams.get('category_id') || 'all';

    // 1. Xác thực bảo mật bằng secret token
    const cronSecret = process.env.CRON_SECRET || 'qua_trinh_phan_tich_tu_dong_2026';
    if (secret !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Tìm danh sách các nguồn cào đang hoạt động tương ứng với bộ lọc category_id
    let query = supabaseAdmin
      .from('crawl_sources')
      .select('id, name, last_crawl_status')
      .eq('is_active', true);

    if (category_id && category_id !== 'all') {
      if (category_id === 'global') {
        query = query.is('category_id', null);
      } else {
        query = query.eq('category_id', category_id);
      }
    }

    const { data: sources, error } = await query;
    if (error) throw error;

    // 3. Lọc ra các nguồn cào vẫn đang chạy (last_crawl_status = 'running')
    const runningSources = sources?.filter(s => s.last_crawl_status === 'running') || [];
    const isCompleted = runningSources.length === 0;

    return NextResponse.json({
      success: true,
      is_completed: isCompleted,
      running_sources_count: runningSources.length,
      running_sources: runningSources.map(s => s.name)
    });

  } catch (error: any) {
    console.error('Check Crawl Status Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Hỗ trợ cả POST
export async function POST(request: Request) {
  return GET(request);
}
