-- Bổ sung các trường theo dõi trạng thái cào dữ liệu
ALTER TABLE public.crawl_sources 
ADD COLUMN IF NOT EXISTS last_crawl_status TEXT DEFAULT 'idle', -- idle, running, completed, error
ADD COLUMN IF NOT EXISTS last_crawl_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_crawl_run_id TEXT;

-- Bật realtime cho bảng crawl_sources để frontend nhận thông báo
ALTER publication supabase_realtime ADD TABLE crawl_sources;

NOTIFY pgrst, 'reload schema';
