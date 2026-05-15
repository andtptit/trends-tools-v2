-- Drop the existing constraint
ALTER TABLE public.crawl_sources DROP CONSTRAINT IF EXISTS crawl_sources_type_check;

-- Add the updated constraint including 'tiktok_profile_list'
ALTER TABLE public.crawl_sources ADD CONSTRAINT crawl_sources_type_check 
CHECK (type IN ('tiktok_profile', 'tiktok_hashtag', 'facebook_page', 'tiktok_profile_list'));
