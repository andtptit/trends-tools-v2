-- 1. Bổ sung các cột lưu thông tin phân tích chi tiết vào bảng trends
ALTER TABLE public.trends 
ADD COLUMN IF NOT EXISTS videos_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS channels_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS channel_stats TEXT,
ADD COLUMN IF NOT EXISTS expert_commentary TEXT;

-- 2. Chạy lệnh reload schema để Supabase API nhận diện cấu trúc mới
NOTIFY pgrst, 'reload schema';
