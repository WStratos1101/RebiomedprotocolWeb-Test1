# Rebiomed Protocol — self-hosting

Rebiomed Protocol có thể chạy trên máy chủ nội bộ bằng Node.js + MySQL hoặc Docker Compose. Chế độ self-hosting dùng đăng nhập email/username của ứng dụng; không cần Manus OAuth, Manus API, Manus storage hay Manus runtime.

## Cách khuyến nghị: Docker Compose

1. Sao chép cấu hình mẫu:

   ```bash
   cp .env.example .env
   ```

2. Đổi các giá trị `SESSION_SECRET`, `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD` và `REBIOMED_PASSWORD_VAULT_KEY` trong `.env`. Không commit `.env`.

3. Build và khởi động:

   ```bash
   docker compose up -d --build
   ```

   Compose sẽ chờ MySQL healthy, chạy migrations một lần, sau đó khởi động web ở `http://localhost:3000`.

4. Kiểm tra:

   ```bash
   curl http://localhost:3000/api/health
   ```

   Kết quả mong đợi: `{"status":"ok"}`.

5. Xem log hoặc dừng dịch vụ:

   ```bash
   docker compose logs -f app
   docker compose down
   ```

   Dữ liệu MySQL nằm trong volume `rebiomed_mysql`; `docker compose down -v` sẽ xóa volume và dữ liệu.

## Chạy trực tiếp trên Node.js

Yêu cầu Node.js 22+, pnpm 10.18+ và MySQL 8+.

```bash
cp .env.example .env
# Đổi DATABASE_URL thành host MySQL nội bộ, ví dụ mysql://rebiomed:...@127.0.0.1:3306/rebiomed
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pnpm start
```

## Biến môi trường bắt buộc

- `DATABASE_URL`: kết nối MySQL.
- `SESSION_SECRET`: khóa ký session JWT nội bộ.
- `REBIOMED_PASSWORD_VAULT_KEY`: mã riêng để mã hóa mật khẩu được phép xem theo quyền; không dùng lại ví dụ trong tài liệu.
- `PORT`: cổng HTTP, mặc định `3000`.

`APP_ID` là định danh cục bộ tùy chọn, mặc định `rebiomed-local`. Các biến `MANUS_*` đều tùy chọn và có thể để trống khi chạy nội bộ. Khi không có `MANUS_OAUTH_API_URL`, callback OAuth ngoài bị vô hiệu hóa và email login vẫn hoạt động.

## Vận hành

- Chạy `pnpm db:migrate` trước mỗi phiên bản có migration mới.
- Đặt reverse proxy HTTPS ở phía trước nếu truy cập ngoài mạng nội bộ.
- Backup volume MySQL định kỳ.
- Không đưa `.env`, session secret, database password hoặc vault key vào Git.
- Chỉ mở cổng ứng dụng; không cần công khai cổng MySQL.
