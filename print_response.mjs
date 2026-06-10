import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch_log_1719.json', 'utf-8'));

console.log("=== ID ===");
console.log(data.id);

console.log("\n=== created_at ===");
console.log(data.created_at);

console.log("\n=== response_raw ===");
console.log(data.response_raw);
