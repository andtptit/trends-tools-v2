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
    console.log("Đang lấy các log gần nhất từ ai_logs...");
    const { data, error } = await supabaseAdmin
        .from('ai_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (error) {
        console.error("LỖI:", error.message);
        return;
    }

    console.log(`Tìm thấy ${data.length} logs.`);
    data.forEach((log, index) => {
        const localTime = new Date(log.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        console.log(`[${index}] ID: ${log.id} | Thời gian: ${localTime} | Niche: ${log.category_id} | Status: ${log.status}`);
    });

    // Tìm log gần nhất với 17:19 (tức là 2026-06-03 17:19:xx)
    const targetLog = data.find(log => {
        const timeStr = new Date(log.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        return timeStr.includes('17:19');
    });

    if (targetLog) {
        console.log("\n=========================================");
        console.log("ĐÃ TÌM THẤY LOG 17:19:");
        console.log("=========================================");
        console.log(`Prompt used:\n${targetLog.prompt_used}`);
        console.log("\n-----------------------------------------");
        console.log(`Response raw:\n${targetLog.response_raw}`);
        console.log("\n-----------------------------------------");
        console.log(`Error message:\n${targetLog.error_message}`);
    } else {
        console.log("\nKhông tìm thấy log nào có phút 17:19. Hãy in ra thông tin chi tiết của 3 log mới nhất:");
        data.slice(0, 3).forEach((log, idx) => {
            const localTime = new Date(log.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
            console.log(`\n--- LOG ${idx} (${localTime}) ---`);
            console.log(`Prompt used length: ${log.prompt_used?.length || 0}`);
            console.log(`Response raw snippet: ${log.response_raw?.substring(0, 2000)}`);
        });
    }
}

check();
