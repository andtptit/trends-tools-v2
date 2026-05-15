-- 1. Bổ sung cấu hình AI vào bảng Danh mục Niche
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS min_videos INT DEFAULT 1,
ADD COLUMN IF NOT EXISTS min_channels INT DEFAULT 1;

-- 2. Chạy lệnh reload schema để Supabase API nhận diện cấu trúc mới
NOTIFY pgrst, 'reload schema';
