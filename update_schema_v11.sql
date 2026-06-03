CREATE TABLE IF NOT EXISTS public.telegram_groups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    group_name TEXT NOT NULL,
    chat_id TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Cho phép tất cả thao tác (Insert, Update, Delete) từ trình duyệt
ALTER TABLE public.telegram_groups DISABLE ROW LEVEL SECURITY;
