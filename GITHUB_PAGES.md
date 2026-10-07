# Chạy Rebiomed Protocol trên GitHub Pages

GitHub Pages chỉ phục vụ **frontend tĩnh**. Chế độ này chạy độc lập trên tên miền GitHub Pages và không cần Manus, Express, tRPC, MySQL hoặc server riêng cho phần tra cứu và các công cụ tính toán.

## URL mặc định

Sau khi bật Pages bằng GitHub Actions, website dự kiến có địa chỉ:

`https://wstratos1101.github.io/RebiomedprotocolWeb-Test1/`

Tên owner/repository nằm trong workflow tại `.github/workflows/deploy-github-pages.yml`. Nếu đổi repository, cập nhật `GITHUB_PAGES_BASE`.

## Bật GitHub Pages

1. Mở repository `WStratos1101/RebiomedprotocolWeb-Test1` trên GitHub.
2. Vào **Settings → Pages**.
3. Chọn **Deploy from a branch**.
4. Chọn branch `gh-pages` và thư mục `/ (root)`, sau đó bấm **Save**.
5. Chờ GitHub Pages cấp URL.

Branch `gh-pages` hiện đã chứa artifact static đã build và có `.nojekyll`. Khi cập nhật nội dung, chạy `pnpm generate:github-pages`, build static rồi cập nhật branch này. Nếu GitHub App được cấp quyền `workflows`, file workflow local `.github/workflows/deploy-github-pages.yml` có thể được thêm vào repository để tự động hóa các bước này.

## Custom domain

Trong **Settings → Pages → Custom domain**, nhập tên miền đã trỏ DNS tới GitHub Pages. GitHub sẽ tạo file `CNAME`; không commit file này thủ công nếu chưa xác định tên miền cuối cùng. Workflow đã hỗ trợ `CNAME` khi file được GitHub tạo trong repository. Khi dùng custom domain ở root, có thể đổi `GITHUB_PAGES_BASE` thành `/`.

## Phạm vi hoạt động trên GitHub Pages

- Tra cứu các quy trình, ghi chú, bảng Zymography và dữ liệu hoá chất được đóng gói tại thời điểm build.
- Dùng các công cụ tính toán ở trình duyệt.
- Master Mix cDNA/qDNA và các bảng tính frontend hoạt động độc lập.
- Không lưu dữ liệu lên server; dữ liệu nhập trên bản static chỉ tồn tại trong phiên/trình duyệt nếu tính năng có hỗ trợ local storage.

## Giới hạn bắt buộc của GitHub Pages

GitHub Pages **không chạy được** Express/tRPC, MySQL, migration, cookie session, đăng nhập Admin/User, quản lý account, phê duyệt nội dung, nhật ký dùng chung giữa account, phản ánh đồng bộ hoặc upload server-side. Các chức năng đó vẫn cần bản self-hosting theo [SELF_HOSTING.md](SELF_HOSTING.md) hoặc một backend/API riêng.

Bản static hiển thị chế độ GitHub Pages để tránh người dùng hiểu nhầm rằng dữ liệu chỉnh sửa đã được lưu vào database. Không đưa secret, mật khẩu, `DATABASE_URL` hoặc mã vault vào GitHub Pages.

## Build local

```bash
pnpm install
pnpm generate:github-pages
GITHUB_PAGES_BASE=/RebiomedprotocolWeb-Test1/ pnpm build:github-pages
pnpm --dir dist/public exec serve .
```

Bản self-hosting đầy đủ vẫn dùng:

```bash
pnpm build
pnpm start
```
