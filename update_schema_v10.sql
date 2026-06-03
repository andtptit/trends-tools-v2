-- Thêm cột telegram_chat_id vào bảng categories
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;

-- Cập nhật Schema để PostgREST tải lại cấu trúc mới
NOTIFY pgrst, 'reload schema';
