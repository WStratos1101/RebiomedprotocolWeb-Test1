# Rebiomed Protocol

Website tra cứu và biên soạn quy trình, tài liệu mẫu và công cụ tính cho thí nghiệm nghiên cứu y sinh. Nội dung hiện được xem và chỉnh sửa công khai, không cần đăng nhập; chỉ xuất bản nếu phạm vi truy cập này là chủ đích.

## Chạy dự án

- `pnpm dev`: máy chủ phát triển trên cổng `PORT` (mặc định 3000).
- `pnpm check` và `pnpm test`: kiểm tra TypeScript và unit tests.
- `pnpm build` và `pnpm start`: build rồi phục vụ `dist/index.js` cùng `dist/public/`.
- `pnpm db:migrate`: áp dụng migrations đã commit; `pnpm db:push`: tạo và áp dụng thay đổi schema.

Ứng dụng dùng React, Express, tRPC, Drizzle và MySQL. Quy trình, mẫu và công thức tính được lưu trong database; dev và bản xuất bản dùng chung dữ liệu. Công cụ Hypoxia chỉ ước tính ngân sách O₂ pha khí và không thể thay thế đo oxy tại lớp tế bào.

`server/_core/publicConfig.ts` chỉ công bố các giá trị runtime dành cho frontend; không đưa secrets vào bundle. Khi chạy trong Webdev, cấu hình project được quản lý qua `webdev.config`.


## Chạy độc lập trong máy chủ nội bộ

Xem [SELF_HOSTING.md](SELF_HOSTING.md) để chạy bằng Docker Compose với MySQL nội bộ hoặc chạy trực tiếp bằng Node.js. Chế độ này dùng session và email login nội bộ; không cần Manus OAuth, Manus API hoặc Manus runtime.

## Chạy trên GitHub Pages

Bản frontend static đã được chuẩn bị trên branch `gh-pages`; chọn branch này tại **Settings → Pages → Deploy from a branch → gh-pages / root**. Xem [GITHUB_PAGES.md](GITHUB_PAGES.md) để biết URL, custom domain và giới hạn. Bản này phù hợp cho tra cứu quy trình và các công cụ tính chạy tại trình duyệt trên GitHub Pages; các chức năng cần database như đăng nhập, nhật ký dùng chung, phê duyệt và quản lý account vẫn cần backend self-hosting.
