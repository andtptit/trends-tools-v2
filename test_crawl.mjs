import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { ApifyClient } from 'apify-client';

// Parse .env manually
const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
});

const apifyClient = new ApifyClient({ token: env.APIFY_API_TOKEN });
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY && !env.SUPABASE_SERVICE_ROLE_KEY.includes('your_') ? env.SUPABASE_SERVICE_ROLE_KEY : env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey);

async function runTest() {
    console.log("=== TEST GIAI ĐOẠN 2: APIFY CRAWLER ===");
    try {
        console.log("1. Đang tạo một Nguồn Cào (Crawl Source) mẫu trong Database...");
        const { data: source, error: sourceError } = await supabase
            .from('crawl_sources')
            .insert([{ name: 'Test User TikTok', type: 'tiktok_profile', url: 'tiktok' }]) // Cào trang của TikTok
            .select()
            .single();
            
        if (sourceError) throw sourceError;
        console.log(`✅ Đã tạo nguồn cào ID: ${source.id}`);

        console.log("\n2. Đang gửi lệnh cho Apify cào dữ liệu (Sẽ mất từ 1 - 3 phút, vui lòng chờ)...");
        // Ở API thực tế ta dùng .start() để chạy ngầm và gọi webhook.
        // Ở đây ta dùng .call() để script đợi kết quả trực tiếp.
        const run = await apifyClient.actor("clockworks/tiktok-profile").call({
            profiles: ["tiktok"],
            resultsPerPage: 3 // Cào thử 3 video cho nhanh
        });
        
        console.log(`✅ Apify đã cào xong! Run ID: ${run.id}`);

        console.log("\n3. Đang lấy dữ liệu và lưu vào Supabase...");
        const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
        
        if (!items || items.length === 0) {
            console.log("⚠️ Không có video nào được cào về.");
            return;
        }

        const insertData = items.map((item) => ({
            source_id: source.id,
            platform: 'tiktok',
            post_url: item.webVideoUrl || item.videoWebUrl || `https://www.tiktok.com/@${item.authorMeta?.name}/video/${item.id}`,
            author_name: item.authorMeta?.nickName || item.authorMeta?.name || 'Unknown',
            author_username: item.authorMeta?.name || 'Unknown',
            text_content: item.text || item.desc || '',
            views_count: item.playCount || item.diggCount || 0,
            likes_count: item.diggCount || item.likes || 0,
            shares_count: item.shareCount || item.shares || 0,
            comments_count: item.commentCount || item.comments || 0,
            posted_at: item.createTimeISO || new Date().toISOString(),
            raw_json: item,
            is_analyzed: false
        }));

        const { error: insertError } = await supabase
            .from('crawled_data')
            .upsert(insertData, { onConflict: 'post_url', ignoreDuplicates: true });

        if (insertError) throw insertError;

        console.log(`✅ Đã lưu thành công ${insertData.length} video vào bảng 'crawled_data'!`);
        console.log("\n=== TEST HOÀN TẤT ===");
        console.log("Bạn có thể mở giao diện Supabase (mục Table Editor) để xem dữ liệu chui vào bảng nhé!");

    } catch (e) {
        console.log("❌ Lỗi Test:", e.message || e);
    }
}

runTest();
