# Hướng dẫn Kiểm thử (Testing) API Cron Tự động hóa

Tài liệu này hướng dẫn chi tiết cách kiểm thử bộ ba API tự động hóa cục bộ (localhost) hoặc trên môi trường Production (`https://trends-tools-v2.vercel.app`).

---

## 1. Chuẩn bị môi trường test

1. Đảm bảo mã bảo mật `CRON_SECRET` đã được cấu hình trong mục **Environment Variables** trên Vercel Dashboard (ví dụ: `andtptit`).
2. Nếu test local, đảm bảo file `.env.local` đã có `CRON_SECRET=andtptit` và đang chạy dev server (`npm run dev`).

---

## 2. Các kịch bản kiểm thử (Scenarios)

### Kịch bản 1: Kiểm thử chặn truy cập không hợp lệ (Bảo mật)
* **Mục tiêu**: Đảm bảo hệ thống chặn chính xác các yêu cầu thiếu hoặc sai mã bảo mật.
* **Câu lệnh gọi (Terminal/CMD)**:
  ```bash
  curl -i "https://trends-tools-v2.vercel.app/api/cron/trigger-analysis?secret=wrong_secret"
  ```
* **Kết quả mong đợi**:
  - HTTP Status: `401 Unauthorized`
  - Body trả về: `{"error":"Unauthorized"}`

---

### Kịch bản 2: Kiểm thử Kích hoạt cào dữ liệu (Apify Crawl)
* **Mục tiêu**: Kiểm tra API khởi động crawler Apify có phản hồi nhanh chóng (dưới 3s) và trả về thông tin các nguồn cào được trigger.
* **Câu lệnh gọi**:
  ```bash
  curl -i "https://trends-tools-v2.vercel.app/api/crawl/auto-run?secret=andtptit&category_id=all&limit=5"
  ```
* **Kết quả mong đợi**:
  - HTTP Status: `200 OK`
  - Body chứa thông tin kích hoạt thành công:
    ```json
    {
      "message": "Đã kích hoạt tự động cào cho 3/3 nguồn.",
      "details": [...]
    }
    ```

---

### Kịch bản 3: Kiểm thử Kiểm tra trạng thái cào (Status Check)
* **Mục tiêu**: Kiểm tra trạng thái của các nguồn cào thuộc niche xem đang chạy hay đã hoàn thành.
* **Câu lệnh gọi**:
  ```bash
  curl -i "https://trends-tools-v2.vercel.app/api/crawl/status?secret=andtptit&category_id=all"
  ```
* **Kết quả mong đợi**:
  - Nếu Apify vẫn đang cào: Trả về `"is_completed": false` kèm số lượng nguồn đang chạy.
  - Nếu Apify đã cào xong hết: Trả về `"is_completed": true`.

---

### Kịch bản 4: Chạy thử luồng AI phân tích & gộp xu hướng
* **Mục tiêu**: Giả lập dữ liệu thô chưa phân tích để kiểm thử luồng gọi AI và Webhook gửi sang n8n hoạt động thực tế.
* **Các bước thực hiện**:

1. **Bước 1**: Mở **Supabase Project Dashboard -> SQL Editor** và chạy câu lệnh SQL này để reset trạng thái chưa phân tích cho 3 bài viết gần nhất:
   ```sql
   UPDATE crawled_data 
   SET is_analyzed = false 
   WHERE id IN (
       SELECT id FROM crawled_data 
       ORDER BY created_at DESC 
       LIMIT 3
   );
   ```

2. **Bước 2**: Gọi API phân tích AI với tham số giới hạn và khoảng thời gian rộng (`hours=168` tương ứng 7 ngày qua để chắc chắn quét trúng 3 bài đăng vừa giả lập):
   ```bash
   curl -i "https://trends-tools-v2.vercel.app/api/cron/trigger-analysis?secret=andtptit&category_id=all&hours=168&limit=10&is_analyzed=false"
   ```

3. **Bước 3**: Kiểm tra kết quả trực quan trên các kênh:
   - **Phản hồi từ API**: Trả về `success: true` và `items_count: 3` kèm `log_id` cụ thể.
   - **Giao diện Dashboard**: Truy cập trang Nhật ký AI (`/ai-logs`). Bạn sẽ thấy một dòng nhật ký mới xuất hiện với trạng thái **⏳ Đang xử lý...** và nhãn nguồn chạy là **Tự động 🤖**.
   - **Kiểm duyệt cuối**: Sau khoảng 1-2 phút, dòng nhật ký này sẽ chuyển sang trạng thái **✅ Thành công** và n8n tự động bắn thông báo kết quả gộp lên group Telegram của bạn.
