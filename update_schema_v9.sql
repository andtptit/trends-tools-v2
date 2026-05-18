-- Sửa lỗi không cập nhật được tiến trình (Update AI Logs)
-- Do bảng ai_logs đang bị chặn bởi Row Level Security (RLS) đối với Anon Key

ALTER TABLE public.ai_logs DISABLE ROW LEVEL SECURITY;
NOTIFY pgrst, 'reload schema';
