import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch_latest_log.json', 'utf-8'));
fs.writeFileSync('scratch_latest_response_raw.txt', data.response_raw);
console.log("Đã ghi response_raw mới nhất thành công vào scratch_latest_response_raw.txt!");
