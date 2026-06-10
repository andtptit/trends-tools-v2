# Hướng dẫn Sử dụng API Cron Tự động Phân tích AI

Hệ thống cung cấp một API bảo mật `/api/cron/trigger-analysis` giúp các dịch vụ bên ngoài (như `cron-job.org` hoặc Vercel Crons) tự động kích hoạt luồng AI phân tích & gộp xu hướng thông qua n8n theo định kỳ hàng ngày.

---

## 1. Thông tin Endpoint

* **Đường dẫn**: `/api/cron/trigger-analysis`
* **Phương thức hỗ trợ**: `GET` hoặc `POST`
* **Mục đích**: Tự động lấy các bài viết cào mới chưa phân tích, khởi tạo phiên chạy log, và gửi lệnh sang n8n xử lý ngầm (đảm bảo không bị timeout).

---

## 2. Các tham số yêu cầu (Query Parameters)

Bạn có thể truyền các tham số này trực tiếp trên URL gọi API:

| Tham số | Loại | Bắt buộc | Mặc định | Mô tả |
| :--- | :--- | :--- | :--- | :--- |
| `secret` | String | **Có** | Không | Mã khóa bảo mật so khớp với biến môi trường `CRON_SECRET` để chống spam API. |
| `category_id` | String | Không | `all` | Lọc bài đăng theo Niche:<br>- `all`: Phân tích mọi nguồn.<br>- `global`: Chỉ cào các nguồn không thuộc niche nào.<br>- `[UUID của Niche]`: Chỉ phân tích riêng cho Niche tương ứng (AI áp dụng prompt chuyên biệt). |
| `hours` | Number | Không | `48` | Khoảng thời gian đăng tải/cào bài đăng gần đây (tính bằng giờ) để tránh phân tích lại bài quá cũ. |
| `limit` | Number | Không | `300` | Giới hạn tối đa số lượng bài viết gửi đi xử lý trong một phiên. |

---

## 3. Cấu hình Biến môi trường (Environment)

Để thiết lập mã khóa bảo mật, thêm biến sau vào tệp cấu hình `.env.local` (hoặc cấu hình Environment Variables trên Vercel Dashboard):

```env
CRON_SECRET=qua_trinh_phan_tich_tu_dong_2026
```

---

## 4. Các định dạng phản hồi (API Responses)

### Trường hợp 1: Truy cập trái phép (Sai hoặc thiếu `secret`)
* **Mã lỗi**: `401 Unauthorized`
* **Nội dung trả về**:
```json
{
  "error": "Unauthorized"
}
```

### Trường hợp 2: Thành công nhưng không có bài viết mới để phân tích
* **Mã lỗi**: `200 OK`
* **Nội dung trả về**:
```json
{
  "success": true,
  "message": "Không có bài đăng mới nào thỏa mãn điều kiện cần phân tích.",
  "items_count": 0
}
```

### Trường hợp 3: Thành công kích hoạt phân tích ngầm qua n8n
* **Mã lỗi**: `200 OK`
* **Nội dung trả về**:
```json
{
  "success": true,
  "message": "Đã kích hoạt phân tích tự động thành công cho 42 bài đăng.",
  "log_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3d4f55",
  "items_count": 42
}
```

---

## 5. Hướng dẫn thiết lập chạy tự động hàng ngày (Cron Job)

Để hệ thống hoạt động hoàn toàn tự động hàng ngày (ví dụ chạy lúc 6:00 sáng):

1. **Bước 1: Lập lịch cào bài viết**
   - Đăng ký công việc (Job) trên `cron-job.org` chạy lúc **6:00 AM**.
   - URL gọi: `GET https://[domain-cua-ban]/api/crawl/auto-run`
   - Nhiệm vụ: Tự động chạy Apify để cào các bài đăng mới lưu vào database (mất từ 3 - 5 phút).

2. **Bước 2: Lập lịch phân tích AI & Gộp bài viết**
   - Đăng ký công việc (Job) trên `cron-job.org` chạy lúc **6:30 AM** (lệch 30 phút để cào xong dữ liệu).
   - URL gọi: `GET https://[domain-cua-ban]/api/cron/trigger-analysis?secret=qua_trinh_phan_tich_tu_dong_2026&hours=24`
   - Nhiệm vụ: Gom tất cả bài cào mới trong 24h qua và gọi n8n phân tích.
