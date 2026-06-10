import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

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
    const { data, error } = await supabaseAdmin
        .from('ai_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
    
    if (error) {
        console.error("LỖI:", error.message);
        return;
    }

    const targetLog = data.find(log => {
        const timeStr = new Date(log.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        return timeStr.includes('17:19');
    }) || data[0]; // fallback to the latest one if not found

    if (targetLog) {
        fs.writeFileSync('scratch_log_1719.json', JSON.stringify({
            id: targetLog.id,
            created_at: new Date(targetLog.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
            prompt_used: targetLog.prompt_used,
            response_raw: targetLog.response_raw
        }, null, 2));
        console.log(`Đã ghi log thành công vào scratch_log_1719.json! ID: ${targetLog.id}`);
    } else {
        console.log("Không tìm thấy log.");
    }
}

check();
