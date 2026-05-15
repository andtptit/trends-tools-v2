-- 1. Tạo bảng Categories (Danh mục Niche)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    custom_prompt TEXT, -- Lời nhắc tuỳ chỉnh cho AI
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Thêm cột category_id vào các bảng hiện tại
ALTER TABLE public.crawl_sources 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

ALTER TABLE public.crawled_data 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

ALTER TABLE public.trends 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;

-- 3. Tạo Policy (RLS) cho bảng categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to categories" ON public.categories USING (true) WITH CHECK (true);

-- 4. Chạy lệnh reload schema để Supabase API nhận diện
NOTIFY pgrst, 'reload schema';
