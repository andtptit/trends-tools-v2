import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch_latest_log.json', 'utf-8'));
const prompt = data.prompt_used;

// In ra 2000 ký tự đầu của prompt
console.log("=== ĐẦU PROMPT ===");
console.log(prompt.substring(0, 1000));

// Tìm LÔ PHÂN TÍCH THỨ 2
const idx2 = prompt.indexOf('=== LÔ PHÂN TÍCH THỨ 2 ===');
if (idx2 !== -1) {
    console.log("\n=== PROMPT LÔ 2 ===");
    console.log(prompt.substring(idx2, idx2 + 1000));
}
