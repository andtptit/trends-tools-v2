CREATE TABLE IF NOT EXISTS public.ai_feedback_memory (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    rule_type TEXT NOT NULL DEFAULT 'general', -- 'grouping', 'naming', 'region', 'general'
    user_feedback TEXT NOT NULL,
    example_case TEXT,
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bật RLS và cấp quyền cho tất cả các thao tác (đọc, ghi, sửa, xóa)
ALTER TABLE public.ai_feedback_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.ai_feedback_memory;

CREATE POLICY "Enable all access for all users" ON public.ai_feedback_memory 
    FOR ALL 
    USING (true) 
    WITH CHECK (true);

-- Thêm cột lý do từ chối vào bảng trends
ALTER TABLE public.trends ADD COLUMN IF NOT EXISTS reject_reason TEXT;


