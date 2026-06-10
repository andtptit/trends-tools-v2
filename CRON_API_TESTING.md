# Hướng dẫn Kiểm thử (Testing) API Cron Tự động trên Production

Tài liệu này hướng dẫn chi tiết cách test trực tiếp API `/api/cron/trigger-analysis` trên môi trường Production (`https://trends-tools-v2.vercel.app`).

---

## 1. Chuẩn bị môi trường test

1. Đảm bảo bạn đã push code lên git và Vercel đã hoàn tất deploy phiên bản mới nhất.
2. Mã bảo mật `CRON_SECRET` đã được cấu hình trong mục **Environment Variables** trên Vercel Dashboard (ví dụ: `qua_trinh_phan_tich_tu_dong_2026`).

---

## 2. Các Kịch bản kiểm thử (Scenarios)

### Kịch bản 1: Chặn truy cập không hợp lệ (Bảo mật)
* **Mục tiêu**: Kiểm tra xem API trên Production có chặn chính xác các truy cập không có secret hoặc sai secret hay không.
* **Cách thực hiện (gõ trong Terminal/CMD)**:
  ```bash
  curl -i "https://trends-tools-v2.vercel.app/api/cron/trigger-analysis?secret=wrong_secret"
  ```
* **Kết quả mong đợi**:
  - HTTP Status: `401 Unauthorized`
  - Body trả về: `{"error":"Unauthorized"}`

---

### Kịch bản 2: Gọi API thành công nhưng không có bài mới
* **Mục tiêu**: Kiểm tra phản hồi của Production khi toàn bộ dữ liệu cào cũ đã được phân tích hết (không có bài mới).
* **Cách thực hiện**:
  ```bash
  curl -i "https://trends-tools-v2.vercel.app/api/cron/trigger-analysis?secret=qua_trinh_phan_tich_tu_dong_2026"
  ```
* **Kết quả mong đợi**:
  - HTTP Status: `200 OK`
  - Body trả về:
    ```json
    {
      "success": true,
      "message": "Không có bài đăng mới nào thỏa mãn điều kiện cần phân tích.",
      "items_count": 0
    }
    ```

---

### Kịch bản 3: Chạy thử luồng AI phân tích thực tế (Simulate Pipeline Run)
* **Mục tiêu**: Giả lập bài đăng mới trên Production để kiểm thử luồng AI & Webhook gửi sang n8n hoạt động thực tế.
* **Cách thực hiện**:

1. **Bước 1: Chuyển 3 bài đăng gần đây thành trạng thái chưa phân tích**
   Mở **Supabase Project Dashboard -> SQL Editor** của dự án production và chạy câu lệnh SQL này:
   ```sql
   UPDATE crawled_data 
   SET is_analyzed = false 
   WHERE id IN (
       SELECT id FROM crawled_data 
       ORDER BY created_at DESC 
       LIMIT 3
   );
   ```

2. **Bước 2: Gọi API kích hoạt trên Production**
   ```bash
   curl -i "https://trends-tools-v2.vercel.app/api/cron/trigger-analysis?secret=qua_trinh_phan_tich_tu_dong_2026&hours=72"
   ```
   *(Tham số `hours=72` giúp quét được cả các bài cũ ta vừa giả lập lại trạng thái)*

3. **Bước 3: Kiểm tra kết quả trực quan**
   - **Phản hồi từ API**: Trả về `success: true` và `items_count: 3` cùng một mã `log_id` cụ thể.
   - **Giao diện Dashboard**: Vào trang Nhật ký AI (`/ai-logs`) trên web của bạn, bạn sẽ thấy một dòng nhật ký mới xuất hiện ở trạng thái **⏳ Đang xử lý...** (thể hiện n8n đang cào và gọi AI phân tích).
   - **Kết quả cuối**: Sau 1 - 2 phút, trạng thái trên Dashboard chuyển sang **✅ Thành công** và n8n tự động bắn thông báo kết quả gộp lên group Telegram của bạn.
