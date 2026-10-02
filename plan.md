# Kế hoạch triển khai LabVault

## Phạm vi sản phẩm
LabVault là kho nội bộ private cho phòng thí nghiệm: tập trung quy trình thí nghiệm, thông tin mẫu, lý thuyết nền, hướng dẫn chi tiết và các công cụ tính số liệu. Khu vực quản trị cho phép chủ website cập nhật nội dung mà không cần sửa mã nguồn.

## Quyết định triển khai
- **Stack:** starter React/Express/tRPC/Drizzle với server và managed MySQL đã bật.
- **Truy cập:** dùng Manus OAuth và session starter; nội dung app yêu cầu đăng nhập. Vai trò `admin` là chủ website, các tài khoản còn lại là người dùng được cấp quyền đọc.
- **Dữ liệu:** thêm các bảng `protocols`, `samples`, `calculators`, `activityLog` theo schema Drizzle; CRUD qua tRPC, seed dữ liệu mẫu ở lớp query để UI có nội dung usable ngay cả khi database đang rỗng.
- **Tính toán:** calculator đầu tiên là pha loãng nồng độ `C1V1 = C2V2`, có kiểm tra số dương, đơn vị hiển thị rõ và lịch sử tính cục bộ theo phiên; cấu trúc công thức mở rộng được lưu trong bảng calculators.
- **MVP UX:** dashboard điều hướng một trang với các view `Tổng quan`, `Quy trình`, `Mẫu & lý thuyết`, `Công cụ tính`, `Quản trị`. Bộ lọc và tìm kiếm hoạt động tại client trên dataset lấy từ tRPC.
- **Private posture:** không dùng hình ảnh trang trí hay nội dung public; có banner trạng thái private, logout, và chỉ render admin actions khi user có role admin.

## Design system
### Design Movement
**Swiss laboratory editorial** — sự chính xác của sổ tay phòng thí nghiệm kết hợp editorial dashboard hiện đại: nhiều khoảng thở, đường kẻ mảnh, nhấn vào thứ bậc thông tin.

### Core Principles
1. **Tra cứu trước, trang trí sau:** nội dung, trạng thái và hành động luôn rõ ràng hơn ornament.
2. **Chính xác có thể kiểm chứng:** thông số, đơn vị, version và ngày cập nhật xuất hiện gần nội dung.
3. **Nhịp điệu phòng lab:** nhãn uppercase nhỏ, đường kẻ, số thứ tự và chip trạng thái tạo cảm giác quy trình.
4. **Một tay vận hành:** sidebar cố định, thao tác quan trọng nằm trong tầm nhìn và có phản hồi tức thì.

### Color Philosophy
Nền `#F5F4EF` như giấy archival, ink `#18221F` cho độ tương phản, teal đậm `#0D5C63` là **signature brand color** gợi glassware và kiểm soát quy trình. Amber `#C9822B` chỉ dành cho cảnh báo/điểm cần chú ý; xanh sage và xanh dương nhạt dùng cho trạng thái an toàn, không cạnh tranh với nội dung.

### Layout Paradigm
Bố cục **rail + canvas**: sidebar trái như mục lục sổ tay, canvas chính rộng với header context và các panel lệch nhịp; tránh mọi thứ nằm trong grid trung tâm đều nhau. Dashboard có một vùng “signal strip” ngang để đọc nhanh chỉ số trước khi đi vào danh sách.

### Signature Elements
- Wordmark có biểu tượng `LV` dạng hai vạch song song như giá đỡ ống nghiệm.
- Các panel dùng viền hairline, góc bo vừa phải và thanh màu teal 3px bên trái cho nội dung quan trọng.
- Số bước quy trình là vòng tròn outline + đường nối dọc, tạo cảm giác thao tác tuần tự.

### Interaction Philosophy
Tương tác phản ánh sự cẩn trọng: click vào card mở detail; filter/search cập nhật tức thì; calculator không cho ra kết quả nếu thiếu hoặc sai đơn vị; admin save có toast xác nhận và timestamp.

### Animation
Chỉ dùng chuyển động nhẹ: sidebar/view fade-slide 160ms, hover nâng card 2px, progress bar của step chạy 240ms. Không autoplay, không parallax, không animation làm phân tán thao tác số liệu.

### Typography System
- **Display:** `DM Sans` cho tiêu đề, số liệu, nhãn điều hướng; hình học và rõ ở kích thước lớn.
- **Body/technical:** `IBM Plex Mono` cho mã quy trình, công thức, đơn vị, metadata kỹ thuật; `DM Sans` cho đoạn đọc.
- Hierarchy: eyebrow 11px uppercase tracking rộng; title 30–40px; section 16px semibold; body 14px/1.6; metadata 11–12px.

### Brand Essence
**Kho tri thức thí nghiệm riêng tư giúp đội ngũ phòng lab làm đúng, nhanh và có căn cứ.**
Tính cách: **điềm tĩnh, chính xác, thực dụng**.

### Brand Voice
- Headline: “Kiến thức đúng chỗ. Thao tác đúng nhịp.”
- CTA/microcopy: “Mở quy trình”, “Tính lại với đơn vị khác”, “Lưu thay đổi vào kho”.

### Wordmark & Logo
Biểu tượng `LV` tối giản từ hai vạch dọc teal và một đường nối ngang, đặt cạnh chữ `labvault` lowercase. Dùng chữ và motif trong UI, không cần asset ảnh ngoài.

## Cấu trúc project
- `client/src/App.tsx`: routing và shell dashboard.
- `client/src/pages/Home.tsx`: dashboard view, mock/seed content, search/filter, calculator và admin forms.
- `client/src/index.css`: design tokens, layout, cards, typography, responsive rules.
- `server/routers.ts`: tRPC procedures cho auth, protocols, samples, calculators và admin mutations.
- `server/db.ts`: query helpers và kết nối Drizzle.
- `drizzle/schema.ts`: users và các bảng domain.
- `public/manus-routes.json`: manifest route `/` và `/404`.
- `app.config.ts`: logo metadata cho project.

## Serving
Dev dùng `pnpm dev` trên port 3000 và host `0.0.0.0`. Preview/public routes giữ relative; `/api/health` phục vụ readiness. Database migration được commit cùng schema; không ghi secrets vào frontend.


## Bổ sung phạm vi 02/10/2026
- **Phân quyền:** chuẩn hóa role app thành `admin`, `researcher`, `viewer` (giữ `user` cũ để tương thích); Admin quản lý nội dung và thành viên, Researcher tạo/chỉnh sửa bản nháp và chạy calculator, Viewer chỉ tra cứu.
- **Công thức:** hiển thị thư viện công thức gồm pha loãng, cell viability và molarity → mass; calculator có đầu vào, đơn vị, kiểm tra số dương và lịch sử phiên.
- **Trực quan hóa:** dashboard thêm biểu đồ xu hướng Ct/efficiency theo run từ dữ liệu thực nghiệm mẫu đã được gắn nhãn rõ là internal run data, không dùng dữ liệu ngẫu nhiên.
- **Bảng điều khiển:** khu vực Owner Console có inventory nội dung và bảng thành viên để đổi role theo mô hình quyền nêu trên.
