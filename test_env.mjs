import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Parse .env manually
const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const idx = trimmed.indexOf('=');
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        env[key] = val;
    }
});

async function runTests() {
    console.log("=== BẮT ĐẦU TEST KẾT NỐI ===");

    // 1. Test Supabase
    if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !env.NEXT_PUBLIC_SUPABASE_URL.includes('your_')) {
        console.log("⏳ Đang test kết nối Supabase...");
        try {
            const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
            const { data, error } = await supabase.from('crawl_sources').select('*').limit(1);
            if (error) {
                console.log("❌ Lỗi kết nối Supabase: ", error.message);
                if (error.code === '42P01') {
                   console.log("   -> Database hoạt động, nhưng bạn chưa chạy lệnh SQL tạo bảng. Hãy copy file database.sql chạy trên Supabase SQL Editor nhé!");
                }
            } else {
                console.log("✅ Kết nối Supabase THÀNH CÔNG! Cấu trúc bảng đã được tạo chuẩn.");
            }
        } catch (e) {
            console.log("❌ Lỗi kết nối Supabase: ", e.message);
        }
    } else {
        console.log("⚠️ Bỏ qua test Supabase do thiếu config.");
    }

    // 2. Test Apify
    if (env.APIFY_API_TOKEN && !env.APIFY_API_TOKEN.includes('your_')) {
        console.log("\n⏳ Đang test kết nối Apify...");
        try {
            const res = await fetch('https://api.apify.com/v2/users/me', {
                headers: { 'Authorization': `Bearer ${env.APIFY_API_TOKEN}` }
            });
            const json = await res.json();
            if (json.data && json.data.id) {
                console.log(`✅ Kết nối Apify THÀNH CÔNG! Tên tài khoản: ${json.data.username}`);
            } else {
                console.log("❌ Lỗi kết nối Apify. Vui lòng kiểm tra lại Token.");
            }
        } catch (e) {
            console.log("❌ Lỗi kết nối Apify: ", e.message);
        }
    } else {
        console.log("⚠️ Bỏ qua test Apify do thiếu config.");
    }

    // 3. Test Gemini
    if (env.GEMINI_API_KEY && !env.GEMINI_API_KEY.includes('your_')) {
        console.log("\n⏳ Đang test kết nối Gemini API...");
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: "Test connection. Reply 'OK'" }] }] })
            });
            const json = await res.json();
            if (json.candidates && json.candidates.length > 0) {
                console.log("✅ Kết nối Gemini THÀNH CÔNG!");
            } else {
                console.log("❌ Lỗi kết nối Gemini: ", json.error ? json.error.message : 'Unknown error');
            }
        } catch (e) {
            console.log("❌ Lỗi kết nối Gemini: ", e.message);
        }
    } else {
        console.log("⚠️ Bỏ qua test Gemini do thiếu config.");
    }

    console.log("\n=== HOÀN TẤT TEST ===");
}

runTests();
