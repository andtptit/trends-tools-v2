-- Kích hoạt extension pgcrypto để sinh UUID
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Bảng crawl_sources
CREATE TABLE crawl_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('tiktok_profile', 'tiktok_hashtag', 'facebook_page')),
    url TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Bảng crawled_data
CREATE TABLE crawled_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES crawl_sources(id),
    platform TEXT NOT NULL,
    post_url TEXT UNIQUE NOT NULL,
    author_name TEXT,
    author_username TEXT,
    text_content TEXT,
    views_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    shares_count INTEGER DEFAULT 0,
    comments_count INTEGER DEFAULT 0,
    posted_at TIMESTAMP WITH TIME ZONE,
    raw_json JSONB,
    is_analyzed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Bảng trends
CREATE TABLE trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crawled_data_id UUID REFERENCES crawled_data(id),
    trend_name TEXT NOT NULL,
    viral_reason TEXT,
    content_ideas TEXT,
    trend_score INTEGER CHECK (trend_score >= 0 AND trend_score <= 100),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bật Row Level Security (RLS)
ALTER TABLE crawl_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawled_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE trends ENABLE ROW LEVEL SECURITY;

-- Policies (Quyền truy cập)
-- Tạm thời cho phép full access để test MVP nhanh (Nên sửa lại bảo mật hơn khi lên Production).
CREATE POLICY "Enable all access for all users" ON crawl_sources FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON crawled_data FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON trends FOR ALL USING (true);
