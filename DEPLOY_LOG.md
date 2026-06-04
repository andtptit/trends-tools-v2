# Deployment Log

File này dùng để theo dõi các bản cập nhật phiên bản của hệ thống Trending Tools.

## Version 2.6 Premium (04/06/2026)
- **Kiến trúc & Sửa lỗi:**
  - Khắc phục triệt để lỗi treo pipeline ở trạng thái `processing` bằng cách tăng giới hạn thời gian chạy hàm (`maxDuration = 60`) trên Vercel và sửa lỗi logic gán `logId` khi gặp Exception.
  - Tách biệt hoàn toàn trends trung gian của từng lô nhỏ bằng trạng thái `'analyzed'` mới. Giao diện Admin (`/trends`) sẽ chỉ hiển thị các trend tinh hoa cuối cùng sau bước gộp (Reduce) ở trạng thái `'pending'`.
- **Tối ưu AI Agent & Memory:**
  - Đồng bộ cơ sở dữ liệu `ai_feedback_memory` để nạp các quy tắc học từ người dùng (Memory) và lịch sử các trend đã duyệt trong 3 ngày qua vào Prompt của AI bước Reduce.
  - Tích hợp vòng lặp tự phản chỉnh (Reflection Loop) giúp AI tự kiểm tra và sửa lỗi đặt tên bao quát hoặc gộp nhóm quá rộng trước khi xuất kết quả.
  - Hỗ trợ giao diện Bộ nhớ AI riêng biệt và Modal Từ chối kèm lý do / dạy học tự động.

## Version 2.3 Premium (18/05/2026)
- **Kiến trúc:** Nâng cấp AI Pipeline lên mô hình **Map-Reduce**.
- **Tính năng mới:** Thêm API `/api/ai/reduce-trends` để tự động gom nhóm, gộp các Trends trùng lặp sinh ra từ các lô nhỏ lẻ.
- **AI Agent:** Cập nhật Prompt khắt khe hơn để loại bỏ rác và ép AI nhận diện Micro-Trends từ Transcript/Script của video. Truncate Script ở mức 2000 ký tự để tiết kiệm token và chống lỗi.
- **N8N Workflow:** Thêm Node HTTP Request "Hợp nhất Trends (Reduce)" ở cổng `done` của vòng lặp để kích hoạt cơ chế gom nhóm tự động.

## Version 2.2 Premium (18/05/2026)
- **Kiến trúc:** Chuyển đổi từ Agent chạy ngầm (spawn process) sang **Client-Orchestrated Batching** qua Vercel API và N8N Webhook.
- **Tính năng mới:** Bổ sung chức năng gửi tiến trình (Progress) qua `ai_logs` trong Supabase.
- **UI:** Thiết kế lại Modal "Nhật ký AI" gọn gàng hơn, bóc tách Regex để hiển thị Token tiêu thụ trực quan thay vì hiển thị JSON thô.

## Version 2.1
- **Tính năng mới:** Tích hợp giao diện Quản lý Trends (`/trends`). Hỗ trợ thao tác xóa hàng loạt (Bulk Delete).

## Version 2.0
- **Core:** Ra mắt giao diện Next.js thay thế cho phiên bản Tool cào cũ.
- **Tính năng mới:** Tích hợp tính năng cào dữ liệu thô và đồng bộ Subtitle/Transcript tự động từ nền tảng Tiktok.
