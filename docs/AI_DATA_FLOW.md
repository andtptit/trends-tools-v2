# Tài liệu Kỹ thuật: Luồng Xử lý Dữ liệu AI Agent (Trend Analysis)

Tài liệu này mô tả chi tiết kiến trúc và luồng chảy dữ liệu (Data Flow) của hệ thống AI Trend Agent, từ lúc nhận dữ liệu thô (Raw Data) đến khi bóc tách thành các Xu hướng (Trends).

---

## 1. Kiến trúc Tổng quan (Orchestrated Batching)

Hệ thống sử dụng kiến trúc **Client-Orchestrated Batching** kết hợp giữa Next.js (Vercel) và n8n (Cloud Workflow).
- **Vercel / Next.js:** Đóng vai trò là "Bộ não" (AI Agent) chứa logic giao tiếp với Google Gemini 2.5 Flash và xử lý Database.
- **N8N:** Đóng vai trò là "Nhạc trưởng" (Orchestrator) chạy nền 24/7 để vòng lặp không bị chết do giới hạn timeout của serverless.

### Sơ đồ Luồng đi:
1. **User / Webhook:** Gửi danh sách toàn bộ ID bài viết thô (Ví dụ: 100 bài) sang cho n8n.
2. **N8N Loop:** N8N chia danh sách 100 bài này thành các lô nhỏ.
3. **Vercel API:** N8N gửi từng lô cho Vercel API (`POST /api/ai/analyze-batch`).
4. **Gemini AI:** Vercel định dạng lại dữ liệu thành văn bản (Context) và gửi cho Gemini.
5. **Supabase:** Nhận kết quả JSON từ Gemini và insert thành các bản ghi Trends mới.

---

## 2. Kích thước Lô (Batch Size)

- **Số lượng:** **15 bài viết / 1 lần gửi (Batch)**.
- **Lý do thiết kế:** 
  1. **Bypass Vercel Timeout:** Vercel Hobby/Pro có giới hạn Serverless Function (10-15s). Gửi 15 bài giúp AI xử lý và phản hồi trong khoảng 6-10s, đảm bảo an toàn tuyệt đối 100% không bị timeout.
  2. **Bypass LLM Context Limit:** Giữ cho Prompt không quá dài, giúp AI tập trung tốt hơn, giảm hiện tượng "ảo giác" (hallucination) hoặc bỏ sót dữ liệu khi đánh giá Trends.

---

## 3. Cấu trúc Dữ liệu gửi cho AI (Data Context)

Khi Vercel nhận được 15 ID từ n8n, hệ thống sẽ truy vấn Database để lấy thông tin chi tiết. Dữ liệu này được chuyển đổi thành chuỗi Text thân thiện với LLM theo định dạng sau:

**Các trường thông tin được gửi:**
- **Kênh (Author):** Tên kênh (`author_name`) và Số lượng người theo dõi (`author_fans`). (Giúp AI đánh giá được uy tín của nguồn).
- **Nội dung (Content):** Mô tả/Caption của bài viết (`text_content`).
- **Âm nhạc (Music):** Tên bài hát/âm thanh sử dụng (`music_name`).
- **Chỉ số hiệu suất (Metrics):** Lượt xem (`views_count`), Lượt thích (`likes_count`), Lượt lưu (`collect_count`).

**Ví dụ dữ liệu gửi đi (Prompt Context):**
```text
Item 1 (ID: uuid-xxx-xxx):
- Kênh: Nguyen Van A (150000 fans)
- Content: Review quán ăn ngon nhất Hà Nội...
- Âm nhạc: Nhạc nền TikTok Viral
- Metrics: 500000 views, 12000 likes, 400 saved
---
Item 2 (ID: uuid-yyy-yyy):
...
```

---

## 4. Tùy biến Prompt theo Ngách (Niche Customization)

Hệ thống hỗ trợ nạp Prompt động (Dynamic Prompting). Trước khi gửi cho Gemini, hệ thống gộp 3 phần lại với nhau:
1. **Base Prompt:** Prompt hướng dẫn chuyên gia mặc định (Lấy từ bảng `system_settings`).
2. **Custom Niche Prompt:** Nếu người dùng chọn Niche (vd: Du học, Bất động sản), hệ thống sẽ nạp thêm `custom_prompt` riêng của Niche đó.
3. **Hard Rules (Luật cứng):** Ép buộc AI tuân thủ `min_videos` (số video tối thiểu) và `min_channels` (số kênh tối thiểu) để được công nhận là 1 Trend.

---

## 5. Dữ liệu Đầu ra (Output Schema)

Gemini được cấu hình sử dụng **Structured Output (JSON Mode)** để luôn trả về mảng dữ liệu có cấu trúc cố định. Mỗi Trend bao gồm:
- `crawled_data_ids`: Mảng các ID bài viết thô tạo nên Trend này.
- `trend_name`: Tên xu hướng.
- `videos_count`: Số lượng video tham gia.
- `channels_count`: Số lượng kênh tham gia.
- `channel_stats`: Báo cáo chỉ số các kênh.
- `viral_reason`: Lý do cốt lõi khiến nội dung này Viral.
- `content_ideas`: Gợi ý ý tưởng kịch bản ăn theo Trend.
- `expert_commentary`: Bình luận chuyên sâu từ góc nhìn chuyên gia.
- `trend_score`: Điểm đánh giá độ nóng (0-100).
