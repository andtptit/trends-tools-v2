import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category_id = searchParams.get('category_id');

    // 1. Lấy cấu hình hệ thống mặc định
    const { data: settingsData } = await supabaseAdmin.from('system_settings').select('*');
    let quantitativeWeight = 0.7;
    let velocityWeight = 0.6;
    let minViewsViral = 15000;
    
    if (settingsData) {
        settingsData.forEach(setting => {
            if (setting.key === 'trend_score_quantitative_weight') quantitativeWeight = parseFloat(setting.value) / 100;
            if (setting.key === 'trend_score_velocity_weight') velocityWeight = parseFloat(setting.value) / 100;
            if (setting.key === 'trend_score_min_views_viral') minViewsViral = parseFloat(setting.value);
        });
    }

    let min_videos = 1;
    let min_channels = 1;

    // 2. Nếu có category_id, lấy cấu hình ghi đè của category đó
    if (category_id && category_id !== 'all') {
        const { data: catData } = await supabaseAdmin
            .from('categories')
            .select('min_videos, min_channels, trend_score_quantitative_weight, trend_score_velocity_weight, trend_score_min_views_viral')
            .eq('id', category_id)
            .single();
        if (catData) {
            if (catData.min_videos) min_videos = catData.min_videos;
            if (catData.min_channels) min_channels = catData.min_channels;

            if (catData.trend_score_quantitative_weight !== null && catData.trend_score_quantitative_weight !== undefined) {
                quantitativeWeight = parseFloat(catData.trend_score_quantitative_weight as any) / 100;
            }
            if (catData.trend_score_velocity_weight !== null && catData.trend_score_velocity_weight !== undefined) {
                velocityWeight = parseFloat(catData.trend_score_velocity_weight as any) / 100;
            }
            if (catData.trend_score_min_views_viral !== null && catData.trend_score_min_views_viral !== undefined) {
                minViewsViral = parseInt(catData.trend_score_min_views_viral as any);
            }
        }
    }

    // 3. Lấy danh sách trends thô có status = 'analyzed'
    let query = supabaseAdmin.from('trends').select('*').eq('status', 'analyzed');
    if (category_id && category_id !== 'all') {
        query = query.eq('category_id', category_id);
    } else {
        query = query.is('category_id', null);
    }
    const { data: rawTrends, error: fetchError } = await query;
    if (fetchError) throw fetchError;

    // 4. Lấy quy tắc bộ nhớ (ai_feedback_memory) hoạt động
    let memoryRules: any[] = [];
    try {
        const { data } = await supabaseAdmin
            .from('ai_feedback_memory')
            .select('rule_type, user_feedback, example_case')
            .eq('is_active', true)
            .limit(20);
        if (data) memoryRules = data;
    } catch (e) {}

    // 5. Lấy danh sách approved trends trong 3 ngày qua để tránh trùng lặp
    let approvedTrends: any[] = [];
    try {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
        const { data } = await supabaseAdmin
            .from('trends')
            .select('trend_name, viral_reason')
            .eq('status', 'approved')
            .gt('created_at', threeDaysAgo);
        if (data) approvedTrends = data;
    } catch (e) {}

    return NextResponse.json({
        success: true,
        gemini_api_key: process.env.GEMINI_API_KEY || '',
        raw_trends: rawTrends || [],
        memory_rules: memoryRules,
        approved_trends: approvedTrends,
        settings: {
            min_videos,
            min_channels,
            quantitative_weight: quantitativeWeight,
            velocity_weight: velocityWeight,
            min_views_viral: minViewsViral
        }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
