
# Nền tảng AI Research Trends cho KOL/KOC

## Tổng quan

Xây dựng một web app giúp tự động nghiên cứu và tổng hợp các trends từ TikTok và Facebook bằng AI, sau đó gửi insight nhanh chóng cho KOL/KOC thông qua Telegram.

Mục tiêu:

* Giúp KOL tiết kiệm thời gian research trends
* Cập nhật xu hướng nhanh hơn
* Gợi ý ý tưởng content có khả năng viral
* Tập trung vào insight thay vì phải tự tìm kiếm thủ công

---

# Chức năng chính

## 1. Crawl dữ liệu mạng xã hội

Sử dụng Apify để crawl dữ liệu từ:

* TikTok profiles
* TikTok hashtags
* Facebook pages
* Facebook posts

Hệ thống cần hỗ trợ:

* Chạy crawl theo lịch cố định
* Chạy thủ công từ dashboard
* Lưu toàn bộ dữ liệu raw vào Supabase

---

## 2. Phân tích trends bằng AI

Sử dụng Gemini 2.5 Flash cho phiên bản đầu tiên.

AI cần thực hiện:

* Phát hiện nội dung đang có xu hướng tăng trưởng
* Gom nhóm các nội dung tương tự
* Phân tích lý do trend đang viral
* Đánh giá mức độ tiềm năng của trend
* Đề xuất ý tưởng content cho KOL
* Sinh summary ngắn gọn dễ đọc
* Chấm điểm trend (trend score)

Ví dụ output:

* Tên trend
* Vì sao trend tăng trưởng
* Đối tượng phù hợp
* Ý tưởng triển khai content
* Link nguồn tham khảo

---

## 3. Dashboard quản trị

Xây dựng bằng React + Next.js.

Dashboard cần có:

* Danh sách bài viết/video đã crawl
* Danh sách trends được AI phát hiện
* Review kết quả AI phân tích
* Approve / Reject trend
* Quản lý nguồn crawl
* Thiết lập lịch chạy
* Theo dõi logs và trạng thái hệ thống
* Trigger crawl hoặc AI analysis thủ công

---

## 4. Hệ thống gửi Telegram

Sử dụng Telegram Bot API để gửi trend report.

Tin nhắn Telegram cần bao gồm:

* Tên trend
* Tóm tắt nhanh
* Vì sao đang viral
* Gợi ý content angles
* Link nguồn
* Trend score

Hỗ trợ:

* Gửi tự động theo lịch
* Gửi theo từng niche/group riêng
* Chỉ gửi các trend đã approve hoặc đạt score cao

---

# Tech Stack

## Frontend

* React
* Next.js
* TailwindCSS
* shadcn/ui

## Backend

* Supabase Database
* Supabase Auth
* Supabase Edge Functions
* Supabase Cron

## External Services

* Apify (crawl dữ liệu)
* Gemini 2.5 Flash (AI analysis)
* Telegram Bot API

---

# Kiến trúc hệ thống

Apify Crawlers
→ Supabase Database
→ AI Analysis Worker
→ Trend Processing
→ Admin Dashboard
→ Telegram Delivery

---

# Phạm vi MVP

## Ưu tiên version đầu

* TikTok trước
* AI trend detection cơ bản
* Telegram notification
* Dashboard đơn giản
* Manual review flow

## Chưa cần ở V1

* Training model riêng
* Recommendation system phức tạp
* Multi-platform optimization
* Prediction engine
* Auto content generation nâng cao

---

# Định hướng tương lai

* Cá nhân hóa trends theo niche
* Auto scoring thông minh hơn
* Subscription system
* Multi-language support
* AI gợi ý script/video hook
* Dự đoán trend sắp viral
* Dashboard analytics nâng cao
