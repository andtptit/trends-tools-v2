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
        .limit(1);
    
    if (error) {
        console.error("LỖI:", error.message);
        return;
    }

    if (data && data.length > 0) {
        const latest = data[0];
        const localTime = new Date(latest.created_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        fs.writeFileSync('scratch_latest_log.json', JSON.stringify({
            id: latest.id,
            created_at: localTime,
            prompt_used: latest.prompt_used,
            response_raw: latest.response_raw
        }, null, 2));
        console.log(`Đã ghi log mới nhất thành công vào scratch_latest_log.json! ID: ${latest.id} | Thời gian: ${localTime}`);
    } else {
        console.log("Không có log nào.");
    }
}

check();
