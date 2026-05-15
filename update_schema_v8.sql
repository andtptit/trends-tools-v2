-- Sửa lỗi Foreign Key Constraint khi xóa dữ liệu thô
-- Cho phép xóa crawled_data thì tự động xóa các trends liên quan (CASCADE)

ALTER TABLE public.trends 
DROP CONSTRAINT IF EXISTS trends_crawled_data_id_fkey;

ALTER TABLE public.trends 
ADD CONSTRAINT trends_crawled_data_id_fkey 
FOREIGN KEY (crawled_data_id) 
REFERENCES public.crawled_data(id) 
ON DELETE CASCADE;

-- Đồng thời áp dụng cho crawl_sources để khi xóa nguồn thì xóa luôn dữ liệu thô (tùy chọn nhưng nên có)
ALTER TABLE public.crawled_data
DROP CONSTRAINT IF EXISTS crawled_data_source_id_fkey;

ALTER TABLE public.crawled_data
ADD CONSTRAINT crawled_data_source_id_fkey
FOREIGN KEY (source_id)
REFERENCES public.crawl_sources(id)
ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';
