import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch_log_1719.json', 'utf-8'));
fs.writeFileSync('scratch_response_raw.txt', data.response_raw);
console.log("Đã ghi response_raw thành công vào scratch_response_raw.txt!");
