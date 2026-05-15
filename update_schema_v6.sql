-- 1. Bổ sung cột lưu danh sách ID các bài đăng liên quan vào bảng trends
ALTER TABLE public.trends 
ADD COLUMN IF NOT EXISTS related_ids JSONB DEFAULT '[]';

-- 2. Cập nhật Schema
NOTIFY pgrst, 'reload schema';
