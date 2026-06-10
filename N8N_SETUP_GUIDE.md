# Hướng dẫn Thiết lập và Cấu hình n8n Workflows

Tài liệu này hướng dẫn chi tiết cách cài đặt, cấu hình biến môi trường, và thiết lập luồng chạy tự động (Cron) cho n8n nhằm tự động hóa quy trình phân tích xu hướng bằng AI.

---

## 1. Import Workflow xử lý chính (Gemini Batch & Reduce)

Hệ thống đã có sẵn mẫu Workflow được tối ưu hóa trong tệp [n8n-workflow-v2.json](file:///d:/AN/AN-BACKUP/CODE/ANTIGRAVITY/trending-tools/n8n-workflow-v2.json). Tệp này xử lý việc lặp theo lô dữ liệu thô, gọi Gemini AI phân tích, sau đó gộp (reduce) các trend trùng lặp và lưu kết quả vào database.

### Các bước Import:
1. Mở giao diện quản trị n8n của bạn.
2. Tạo một Workflow mới trống.
3. Ở góc trên bên phải, nhấn vào biểu tượng **ba chấm** (More Actions) -> Chọn **Import from File**.
4. Chọn tệp [n8n-workflow-v2.json](file:///d:/AN/AN-BACKUP/CODE/ANTIGRAVITY/trending-tools/n8n-workflow-v2.json) trong thư mục dự án của bạn để tải luồng lên.
5. Nhấn **Save** và kích hoạt trạng thái **Active** cho workflow này.

---

## 2. Cài đặt các biến đầu vào trong n8n

Trong Workflow chính vừa import, ở Node **"Khởi tạo Data"** (Code Node), bạn có thể tùy chỉnh biến `app_url` trỏ về tên miền production Vercel của bạn:
```javascript
app_url: 'https://trends-tools-v2.vercel.app'
```

Đồng thời, hãy đảm bảo bạn đã cung cấp các Credential cần thiết trong n8n:
* **Gemini API Key**: Sẽ được đọc tự động từ payload gửi sang hoặc bạn có thể cấu hình trực tiếp key của mình trong các node gọi HTTP của n8n.
* **Webhook path**: Nút trigger Webhook đầu tiên của n8n mặc định lắng nghe ở đường dẫn path `trend-agent`. Đảm bảo URL Webhook này được điền vào biến môi trường `NEXT_PUBLIC_N8N_WEBHOOK_URL` trên Vercel của bạn (ví dụ: `https://n8n.yourdomain.com/webhook/trend-agent`).

---

## 3. Cấu hình chạy tự động định kỳ (Cron Automation)

Để luồng cào dữ liệu và phân tích AI hoạt động tự động hàng ngày, bạn có hai lựa chọn thiết lập sau:

### Cách 1: Thiết lập tự động bằng n8n (Khuyên dùng)
Tạo thêm một Workflow phụ trên n8n có nhiệm vụ làm "Bộ điều phối tuần tự" để tránh bị lỗi tranh chấp dữ liệu khi gọi API.

1. **Tạo Workflow mới** đặt tên là `[Cron] Trigger Crawl & Analysis`.
2. **Thêm Node `Schedule Trigger` (Cron Node)**:
   - Thiết lập thời gian chạy định kỳ (Ví dụ: Chạy lúc **06:00 AM** hàng ngày).
3. **Thêm Node `HTTP Request` (Kích hoạt cào)**:
   - **Method**: `GET`
   - **URL**: Lấy link sinh ra từ Tab **Công cụ tích hợp API** trên web của bạn (ví dụ: `https://trends-tools-v2.vercel.app/api/crawl/auto-run?secret=andtptit&category_id=all&limit=50`).
4. **Thêm Node `Wait` (Chờ cào xong)**:
   - **Resume**: Chọn **After time interval**
   - **Interval**: Thiết lập chờ **3 - 5 phút** để đảm bảo quá trình cào dữ liệu thô từ Apify hoàn thành và webhook trả dữ liệu về cơ sở dữ liệu xong xuôi.
5. **Thêm Node `HTTP Request` (Kích hoạt phân tích AI)**:
   - **Method**: `GET`
   - **URL**: Lấy link sinh ra từ Tab **Công cụ tích hợp API** (ví dụ: `https://trends-tools-v2.vercel.app/api/cron/trigger-analysis?secret=andtptit&category_id=all&hours=24&limit=30&is_analyzed=false`).
6. **Lưu & Kích hoạt Workflow phụ này**.

---

### Cách 2: Thiết lập tự động bằng dịch vụ ngoài (cron-job.org)
Nếu bạn không muốn duy trì tiến trình chờ (`Wait`) trên n8n để tiết kiệm tài nguyên RAM/CPU:

1. Đăng nhập vào trang [cron-job.org](https://cron-job.org/).
2. **Tạo Job 1 (Cào dữ liệu)**:
   - Chạy lúc **06:00 AM** hàng ngày.
   - URL gọi: `GET https://trends-tools-v2.vercel.app/api/crawl/auto-run?secret=andtptit&category_id=all&limit=50`
3. **Tạo Job 2 (Phân tích AI - lệch 20 - 30 phút)**:
   - Chạy lúc **06:25 AM** hàng ngày.
   - URL gọi: `GET https://trends-tools-v2.vercel.app/api/cron/trigger-analysis?secret=andtptit&category_id=all&hours=24&limit=30&is_analyzed=false`

---

## 4. Xử lý sự cố thường gặp (Troubleshooting)

* **Lỗi n8n không nhận Webhook từ Vercel**: 
  - Hãy kiểm tra xem biến môi trường `NEXT_PUBLIC_N8N_WEBHOOK_URL` trên Vercel của bạn đã được khai báo chính xác chưa.
  - Hãy đảm bảo bạn đã dùng URL dạng Production của n8n (`.../webhook/...`) chứ không phải URL Test (`.../webhook-test/...`).
* **Lỗi Timeout**:
  - Do tiến trình phân tích AI tốn rất nhiều thời gian (gọi API Gemini hàng chục lần), chúng tôi đã thiết kế API của Vercel lập tức phản hồi về `200 OK` ngay khi kích hoạt để tránh timeout 10s trên Vercel. Toàn bộ tiến trình chạy nặng tiếp theo sẽ do n8n xử lý chạy ngầm.
