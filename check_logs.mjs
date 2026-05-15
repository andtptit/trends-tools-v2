import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Đọc file .env
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

const supabaseAdmin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
    console.log("Đang kiểm tra bảng ai_logs bằng quyền Admin...");
    const { data, error } = await supabaseAdmin.from('ai_logs').select('*');
    if (error) {
        console.error("LỖI KHI ĐỌC ai_logs:", error.message);
    } else {
        console.log(`Bảng ai_logs có ${data.length} dòng.`);
        if (data.length > 0) {
            console.log("Dòng đầu tiên:", JSON.stringify(data[0], null, 2));
        }
    }

    console.log("\nThử ghi một dòng mẫu vào ai_logs...");
    const { error: insertError } = await supabaseAdmin.from('ai_logs').insert({
        items_analyzed: 1,
        trends_found: 1,
        status: 'test',
        prompt_used: 'test',
        response_raw: 'test'
    });

    if (insertError) {
        console.error("LỖI KHI GHI ai_logs:", insertError.message);
    } else {
        console.log("Ghi dòng mẫu thành công!");
    }
}

check();
