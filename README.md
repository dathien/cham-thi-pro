# CHẤM THI THÔNG MINH (`chamthi-smart`)

Hệ thống chấm thi trắc nghiệm OMR bằng OpenCV.js, quản lý kết quả và phân tích chất lượng đề kiểm tra.
**Chấm nhanh – Chính xác – Bảo mật – Miễn phí.**

## Tính năng chính

- **100% xử lý cục bộ & ngoại tuyến (PWA + IndexedDB)**: Toàn bộ dữ liệu học sinh, ảnh bài thi và bộ máy nhận dạng OpenCV.js chạy trực tiếp trên trình duyệt, không gửi dữ liệu lên máy chủ mặc định.
- **Thư viện mẫu phiếu đa dạng**:
  - Phiếu theo cấu trúc thi tốt nghiệp THPT từ năm 2025 (Phần I Trắc nghiệm, Phần II Đúng/Sai 4 ý, Phần III Trả lời ngắn).
  - Phiếu truyền thống: 10, 15, 20, 25, 30, 40, 50, 60, 80, 100 câu và số câu tùy chỉnh.
  - Phiếu ghép đôi (A4 chứa 2 phiếu A5 độc lập).
  - Phiếu rọc phách (A3/tùy chỉnh, chấm ẩn danh theo mã phách và ghép phách).
- **Trình thiết kế phiếu trực quan**: Tùy chỉnh khổ giấy, lưới ô tô, điểm định vị, tải ảnh/PDF ngoài để đánh dấu tọa độ, xuất PDF in trực tiếp.
- **Bộ máy OMR OpenCV.js thực tế**: Kiểm tra độ sáng/mờ, chuẩn hóa ánh sáng khử bóng, phát hiện điểm định vị, nhận hướng xoay (0°/90°/180°/270°), biến đổi phối cảnh (`warpPerspective`), đo mật độ ô tô, phát hiện tô mờ/tẩy xóa/tô nhiều đáp án.
- **Chấm Camera thông minh & Chấm hàng loạt PDF/Ảnh (Web Worker)**: Tự động chụp khi ổn định, chống chụp trùng, xử lý PDF nhiều trang không tràn bộ nhớ.
- **Scan tài liệu tích hợp**: Kéo chỉnh 4 góc, khử bóng, xuất PDF đa trang.
- **Kiểm duyệt, Bảng điểm, Phiếu trả bài PDF & Phân tích đề thi**: Phiếu trả bài PDF tiếng Việt vẽ chú thích trực tiếp trên ảnh bài thi, xuất Excel chuẩn vnEdu/SMAS, phân tích độ khó, độ phân biệt và KR-20.

## Cài đặt và phát triển

```bash
npm install
npm run dev
```

## Build và triển khai Vercel

```bash
npm run build
```

- Repository: `chamthi-smart`
- Project Vercel: `chamthi-smart`
- Miền dự kiến: `chamthi-smart.vercel.app`
