-- 1. Tạo bảng ai_logs
CREATE TABLE IF NOT EXISTS public.ai_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    items_analyzed INT DEFAULT 0,
    trends_found INT DEFAULT 0,
    status TEXT NOT NULL, -- 'success' hoặc 'error'
    error_message TEXT,
    prompt_used TEXT,
    response_raw TEXT
);

-- 2. Chạy lệnh reload schema để Supabase API nhận diện bảng mới
NOTIFY pgrst, 'reload schema';
