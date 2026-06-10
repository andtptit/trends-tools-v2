# Hướng dẫn Sử dụng API Cron Tự động Hóa

Hệ thống cung cấp bộ ba API bảo mật giúp các dịch vụ bên ngoài (như `cron-job.org` hoặc các công cụ tự động hóa như n8n) tự động kích hoạt luồng cào dữ liệu, kiểm tra tiến độ, và phân tích AI gom nhóm xu hướng theo lịch trình định kỳ.

---

## 1. Danh sách các API Endpoint

### API 1: Kích hoạt cào dữ liệu (Apify Crawl API)
* **Đường dẫn**: `/api/crawl/auto-run`
* **Phương thức**: `GET` hoặc `POST`
* **Tham số**:
  - `secret` (Bắt buộc): Mã khóa bảo mật so khớp với `CRON_SECRET` trên Vercel (mặc định là `andtptit`).
  - `category_id` (Không bắt buộc, mặc định là `all`): 
    - `all`: Cào mọi nguồn cào đang hoạt động.
    - `global`: Chỉ cào các nguồn không thuộc danh mục nào.
    - `[Category UUID]`: Chỉ cào các nguồn thuộc Niche tương ứng.
  - `limit` (Không bắt buộc): Giới hạn số lượng bài viết tối đa cào về trên mỗi nguồn (ví dụ: `50`). Nếu bỏ trống sẽ dùng giới hạn mặc định trong cấu hình hệ thống.

---

### API 2: Kiểm tra trạng thái cào (Status Check API)
* **Đường dẫn**: `/api/crawl/status`
* **Phương thức**: `GET` hoặc `POST`
* **Tham số**:
  - `secret` (Bắt buộc): Mã bảo mật `CRON_SECRET` (`andtptit`).
  - `category_id` (Không bắt buộc, mặc định là `all`): Phải khớp với `category_id` dùng lúc cào ở API 1.
* **Nội dung trả về (JSON)**:
  - Trả về `is_completed: true` nếu tất cả các nguồn cào thuộc danh mục này đã cào xong (không có nguồn nào ở trạng thái `running`).
  - Trả về `is_completed: false` kèm danh sách các nguồn đang chạy (`running_sources`) nếu tiến trình cào vẫn chưa xong.

---

### API 3: Phân tích & Gộp xu hướng bằng AI (Gemini Analysis API)
* **Đường dẫn**: `/api/cron/trigger-analysis`
* **Phương thức**: `GET` hoặc `POST`
* **Tham số**:
  - `secret` (Bắt buộc): Mã bảo mật `CRON_SECRET` (`andtptit`).
  - `category_id` (Không bắt buộc, mặc định là `all`): Lọc dữ liệu thô của Niche cần đem đi phân tích AI.
  - `hours` (Không bắt buộc, mặc định là `48`): Khoảng thời gian cào dữ liệu gần đây (tính theo giờ) để lấy đi phân tích.
  - `limit` (Không bắt buộc, mặc định là `300`): Giới hạn tối đa số lượng bài viết gửi lên Gemini trong phiên chạy này để kiểm soát token.
  - `is_analyzed` (Không bắt buộc, mặc định là `false`):
    - `false`: Chỉ quét phân tích những bài đăng thô chưa từng được phân tích.
    - `true`: Cho phép phân tích cả các bài đăng cũ đã phân tích trước đó (dùng để kiểm thử lại dữ liệu thô).

---

## 2. Cấu hình biến bảo mật (Environment Variables)

Để đổi mã khóa bảo mật hoặc tên miền, hãy khai báo trong file cấu hình `.env.local` (local) hoặc thêm vào mục **Environment Variables** trên Vercel Dashboard:

```env
CRON_SECRET=andtptit
```

> [!WARNING]
> Tuyệt đối không chia sẻ mã `CRON_SECRET` ra ngoài để phòng ngừa spam API gây tốn chi phí cào Apify và Token Gemini AI.

---

## 3. Quy trình tích hợp khuyên dùng

Để quy trình cào dữ liệu và phân tích AI hoạt động mượt mà mà không làm Vercel Serverless Function bị timeout (giới hạn 10 giây):

1. **Kích hoạt cào:** Gọi API 1 để khởi động tiến trình cào ngầm trên Apify. API này sẽ trả về phản hồi lập tức.
2. **Kiểm tra trạng thái:** Thiết lập vòng lặp gọi API 2 định kỳ mỗi 30 giây để kiểm tra xem Apify đã cào xong dữ liệu thô vào cơ sở dữ liệu hay chưa.
3. **Kích hoạt phân tích:** Khi API 2 trả về `is_completed: true`, tiến hành gọi API 3 để khởi chạy luồng phân tích gộp xu hướng bằng AI ngầm thông qua n8n.
