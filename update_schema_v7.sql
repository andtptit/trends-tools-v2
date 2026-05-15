-- 1. Bổ sung các chỉ số đo lường chuyên sâu vào bảng crawled_data
ALTER TABLE public.crawled_data 
ADD COLUMN IF NOT EXISTS collect_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS author_fans INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS author_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS music_id TEXT,
ADD COLUMN IF NOT EXISTS music_name TEXT,
ADD COLUMN IF NOT EXISTS video_duration INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_slideshow BOOLEAN DEFAULT false;

-- 2. Cập nhật Schema
NOTIFY pgrst, 'reload schema';
