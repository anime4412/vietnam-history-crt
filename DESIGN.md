# Design System: Bảo tàng Lịch sử Quốc gia Việt Nam (VNMH)

## 1. Visual Theme & Atmosphere
- **Atmosphere:** Archival Sanctuary — trang trọng, tĩnh lặng và đậm chất giám tuyển (curatorial). Không gian tựa như phòng trưng bày ánh sáng tập trung (spotlight gallery), tôn vinh giá trị hiện vật nghìn năm của dân tộc mà không rơi vào lối mòn bảo tàng công quyền xơ cứng.
- **Density:** 4 (Gallery Airy) — Khoảng thở hào phóng, các hiện vật và thời kỳ lịch sử có không gian riêng biệt để truyền tải câu chuyện.
- **Variance:** 7 (Offset Asymmetric) — Bố cục lệch trục biên tập (editorial offset), các khối tư liệu đan xen bất đối xứng, phá bỏ sự rập khuôn của grid đều đặn.
- **Motion:** 6 (Fluid Spring Physics) — Chuyển động đầm, chắc, mượt mà như lật mở các trang văn kiện và ngắm nhìn hiện vật sau lồng kính chống lóa.

## 2. Color Palette & Roles
- **Obsidian Sanctuary** (`#0C0D10`) — Bề mặt nền chính (Canvas Background), sâu lắng, không dùng màu đen tuyền `#000000`.
- **Exhibition Stone** (`#15171D`) — Bề mặt thẻ hiện vật, khung bảo tồn (Surface / Card container).
- **Aged Silk Parchment** (`#F3EFE6`) — Màu chữ chính (Primary Typography), tương phản êm dịu, ấm áp như lụa cổ.
- **Patina Bronze** (`#9E9789`) — Màu chữ phụ, niên đại, phân loại khảo cổ (Secondary & Meta text).
- **Relic Border** (`rgba(243, 239, 230, 0.08)`) — Viền 1px tinh tế cho thẻ và vách ngăn phân đoạn lịch sử.
- **Single Accent: Cổ Đồng Đỏ (Imperial Terracotta & Bronze)** (`#BD4932`) — Điểm nhấn duy nhất cho chỉ số hiện vật, nút hành động chính, tab thời kỳ được chọn (Độ bão hòa < 75%, nghiêm cấm hiệu ứng neon/purple).

## 3. Typography Rules
- **Display / Tiêu đề chính:** `Playfair Display` kết hợp `Cinzel` — Track-tight, đĩnh đạc, mang âm hưởng văn bia và điêu khắc cổ.
- **Body / Nội dung tư liệu:** `Plus Jakarta Sans` — Cỡ chữ tối thiểu 15px, dãn dòng thư thái (leading: 1.7), giới hạn tối đa 65 ký tự/dòng.
- **Metadata / Niên đại khảo cổ:** `Space Mono` — Dành cho niên đại (TCN - SCN), số hiệu hiện vật quốc gia, tọa độ khai quật.
- **Banned:** Tuyệt đối cấm font `Inter`, `Times New Roman` mặc định, cấm font thư pháp sến súa hoặc phông chữ uốn lượn khó đọc.

## 4. Component Stylings
- **Buttons (Nút bấm):** Phẳng, không glow. Phản hồi xúc giác -1px khi nhấn (tactile push). Nút chính dùng nền `Cổ Đồng Đỏ` `#BD4932`, chữ sáng; nút phụ viền mảnh 1px `Relic Border`.
- **Cards (Thẻ hiện vật):** Bo góc tinh tế (12px), nền `Exhibition Stone`, bóng đổ tản nhiệt tự nhiên ngả màu bóng tối phòng trưng bày `rgba(0,0,0,0.4)`. Hover nâng nhẹ 3px kèm hiệu ứng làm ấm ánh sáng spotlight.
- **Timeline / Niên biểu:** Trục dẫn bất đối xứng, mốc thời gian dạng monospaced, không dùng biểu tượng hoạt hình.
- **Artifact Viewer / Modal:** Cửa sổ chi tiết toàn màn hình bán trong suốt với kính mờ (backdrop-blur 16px), tập trung vào hình ảnh độ phân giải cao và thẻ giám định lịch sử.
- **Loading & Empty States:** Khung xương (skeleton shimmer) tông than ấm, không dùng vòng xoay tròn quay tít.

## 5. Layout Principles
- **Hero Section:** Bố cục chia đôi bất đối xứng (Split Editorial). Tiêu đề hùng tráng kết hợp chi tiết hoa văn Đông Sơn tinh xảo, tuyệt đối không căn giữa (Centered layout is banned).
- **Phân đoạn hiện vật:** Bố cục ziczac 2 cột và bento bất đối xứng, cấm bố cục 3 cột đều chằn chặn ("3 equal cards").
- **Khoảng cách:** Khoảng đệm rộng rãi `clamp(4rem, 10vw, 8rem)` giữa các kỷ nguyên lịch sử.
- **Containment:** Giới hạn chiều rộng tối đa 1360px ở giữa khung hình. Chiều cao Hero dùng `min-h-[100dvh]`.

## 6. Motion & Interaction
- **Spring Physics:** `stiffness: 90, damping: 22` — Trọng lượng đằm, chuyển động thanh lịch.
- **Micro-Interactions:** Hiệu ứng hover soi rọi spotlight (radial-gradient theo con trỏ chuột) trên bề mặt thẻ hiện vật.
- **Choreography:** Hiện vật xuất hiện tuần tự (stagger delay 80ms) theo dòng thời gian khi cuộn trang.
- **Hiệu năng:** Chỉ animate `transform` và `opacity`, không giật lag CPU.

## 7. Anti-Patterns (Banned AI Tells)
- Không dùng icon emoji (❌ 🏛️ 🇻🇳 ⚔️). Thay bằng biểu tượng vector tối giản hoặc typography.
- Không dùng màu đen tuyền `#000000` hoặc màu tím/xanh neon AI.
- Không dùng văn phong sáo rỗng AI ("Khám phá chuyến hành trình vô tận", "Nền tảng đỉnh cao nâng tầm di sản").
- Không dùng văn bản thừa thãi: "Cuộn xuống để xem", "Click here", mũi tên nảy liên tục.
- Không dùng 3 thẻ ngang bằng nhau cạnh nhau.
- Không để link ảnh hỏng hoặc ảnh placeholder vô danh.
