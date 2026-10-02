# Kế hoạch triển khai Rebiomed Protocol

## Phạm vi sản phẩm

Rebiomed Protocol là kho quy trình thí nghiệm, tài liệu mẫu và công cụ tính cho nghiên cứu y sinh. Website hiển thị và cho phép chỉnh sửa nội dung mà không cần đăng nhập theo yêu cầu hiện hành. Trang thí nghiệm điều kiện đặc trưng phân loại Nuôi cấy Hypoxia và Nuôi cấy áp suất cao.

## Quyết định triển khai

- **Stack và serving:** React/Vite ở frontend; Express/tRPC và Drizzle/managed MySQL ở backend. Dev dùng cổng 3000; build tạo `dist/public` và `dist/index.js`. Preview/public dùng URL tương đối.
- **Truy cập:** các view, CRUD quy trình và công cụ tính là public; không giả định còn vai trò đăng nhập bảo vệ nội dung. Đây là chủ ý sản phẩm, không phải ranh giới bảo mật.
- **Dữ liệu:** quy trình, mẫu và calculator được lưu bền vững trong MySQL; category hiện có phân nhóm quy trình và tool theo điều kiện đặc trưng, không cần thêm cột mới. Seed nội dung mới theo slug, tôn trọng tool đã bị vô hiệu hóa.
- **Công cụ tính:** công cụ tế bào có quy đổi đơn vị theo từng phép tính. Công thức tùy chỉnh dùng parser số học giới hạn, sinh ô nhập từ tên biến và lưu nhãn đơn vị nhưng không tự xác thực thứ nguyên hay quy đổi đơn vị.
- **Hypoxia:** tính O₂ pha khí hệ kín từ thể tích headspace, áp suất tuyệt đối/gauge, nhiệt độ, %O₂ và nhu cầu OCR của nhiều nhóm đĩa. Thời gian tới ngưỡng O₂ là tình huống giả định lý tưởng (V/T không đổi, O₂ rời pha khí và không có khí thay thế); không đưa ra lịch bơm khí an toàn. UI cảnh báo giới hạn khuếch tán qua môi trường, oxy tại lớp tế bào, CO₂, pH và yêu cầu đo thực tế.

## Thiết kế

- **Design Movement:** Swiss laboratory editorial — dạng sổ tay phòng lab với dashboard hiện đại, nhấn vào thứ bậc thông tin và khoảng thở.
- **Core Principles:** tra cứu trước trang trí; số liệu có đơn vị và nguồn; quy trình theo bước; thao tác được phản hồi rõ.
- **Color Philosophy:** nền giấy `#F5F4EF`, ink `#18221F`, teal đặc trưng `#0D5C63` gợi thiết bị thủy tinh và độ tin cậy; amber `#C9822B` dùng cho cảnh báo.
- **Layout Paradigm:** sidebar như mục lục bên trái, canvas rộng bên phải; khối nội dung lệch nhịp thay vì một lưới đều ở giữa.
- **Signature Elements:** nhãn kỹ thuật uppercase, panel viền hairline, số bước quy trình dạng vòng tròn nối dọc.
- **Interaction Philosophy:** click mở chi tiết, chọn nhóm điều kiện nhanh, nhập/xóa có phản hồi rõ; xóa công thức và lịch sử yêu cầu hai lần xác nhận.
- **Animation:** fade nhẹ khi đổi view, hover nâng card 2px; không autoplay hoặc hiệu ứng làm phân tán việc đọc số liệu.
- **Typography:** DM Sans cho nội dung/điều hướng, IBM Plex Mono cho công thức, số và metadata; tiêu đề 30–40px, body 14px/1.6.
- **Brand Essence:** Rebiomed Protocol giúp đội ngũ nghiên cứu ghi chép và tính toán ngay bên cạnh quy trình; điềm tĩnh, chính xác, thực dụng.
- **Brand Voice:** ngắn gọn, có tính thao tác. Ví dụ: “Mở quy trình”; “Kiểm tra O₂ thực tế trước khi quyết định thay khí”.
- **Wordmark & Logo:** mark `RP` trên nền teal, bên cạnh chữ “Rebiomed Protocol”. Màu nhận diện là teal `#0D5C63`.

## Cấu trúc project

- `client/src/pages/Home.tsx`: shell, điều hướng, editor quy trình/nội dung và calculator có sẵn.
- `client/src/components/SpecialExperimentsView.tsx`: hai nhánh điều kiện, danh mục quy trình và tool.
- `client/src/components/HypoxiaCalculator.tsx`, `client/src/lib/hypoxiaMath.ts`: form và hàm tính pha khí thuần, có test tương ứng.
- `client/src/components/CustomCalculator.tsx`, `shared/formulaMath.ts`: tính công thức tùy chỉnh bằng parser, không chạy mã tùy ý.
- `server/routers.ts`, `server/db.ts`: API và thao tác managed MySQL.
- `client/index.html`, `client/public/manus-routes.json`, `app.config.ts`: metadata tên website, route manifest và logo project.
