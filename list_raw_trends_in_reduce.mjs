import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch_log_1719.json', 'utf-8'));
const prompt = data.prompt_used;

// Find the REDUCE section in prompt
const idx = prompt.indexOf('=== BƯỚC HỢP NHẤT TRENDS (REDUCE) ===');
if (idx !== -1) {
    const reducePrompt = prompt.substring(idx);
    const lines = reducePrompt.split('\n');
    // In ra các dòng bắt đầu bằng "Trend "
    lines.forEach(line => {
        if (line.trim().startsWith('Trend ') || line.trim().startsWith('- Tên:')) {
            console.log(line);
        }
    });
} else {
    console.log("Không tìm thấy BƯỚC HỢP NHẤT.");
}
