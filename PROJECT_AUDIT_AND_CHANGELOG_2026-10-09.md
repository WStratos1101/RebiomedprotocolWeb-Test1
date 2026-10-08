# Rebiomed Protocol — Báo cáo tổng kết UI/UX, tính năng và rủi ro

**Ngày lập báo cáo:** 09/10/2026  
**Repository:** `WStratos1101/RebiomedprotocolWeb-Test1`  
**Branch:** `main`  
**HEAD được rà soát:** `2364fcc` — `Prevent calculator choice overflow on mobile`  
**Phạm vi:** rà soát lịch sử Git, source hiện tại, tài liệu self-hosting/GitHub Pages, test/build và một lượt review độc lập read-only.

> Báo cáo này phân biệt giữa **đã xác nhận từ code/test**, **rủi ro suy luận cần kiểm thử thêm** và **feature gap**. Một rủi ro chưa được khai thác thực tế không được xem là bug đã tái hiện.

---

## 1. Tóm tắt điều hành

Rebiomed Protocol đã chuyển từ một kho quy trình thành một hệ thống quản lý phòng thí nghiệm độc lập, gồm:

- Kho quy trình, lý thuyết, mẫu tham chiếu và hóa chất.
- Hệ thống tài khoản User/Admin/Supporter và phê duyệt nội dung.
- Bộ công cụ tính toán chuyên ngành tế bào, hóa chất, PCR và điều kiện nuôi.
- Nhật ký thí nghiệm riêng theo tài khoản.
- Phản ánh hóa chất, thiết bị và vật tư.
- Chế độ self-hosting bằng Node.js + MySQL hoặc Docker Compose.
- Bản frontend tĩnh cho GitHub Pages.
- Giao diện responsive, sidebar thu gọn, công cụ gắn trực tiếp vào từng bước quy trình.

### Trạng thái kỹ thuật hiện tại

| Hạng mục | Kết quả |
|---|---|
| TypeScript | Đạt với `pnpm check` |
| Unit tests | **14 test files / 50 tests pass** |
| Production build | Đạt với `pnpm build` |
| Git diff check | Đạt ở checkpoint gần nhất |
| Working tree | Sạch tại thời điểm rà soát |
| Components chính | 15 file TSX ở `client/src/components` |
| Database migrations | 21 file SQL, từ `0000` đến `0020` |
| Browser E2E | Chưa có |
| DB integration test | Chưa có đầy đủ |
| GitHub Pages workflow | Chưa xác nhận có file workflow trong working tree; quy trình hiện vẫn phụ thuộc build/cập nhật artifact thủ công |

### Ba ưu tiên cần xử lý trước khi mở rộng người dùng

1. **Khóa các mutation nội dung/hóa chất đang có thể gọi công khai**, thêm kiểm tra quyền ở server và rate limit.
2. **Loại bỏ hoặc thay đổi cách bootstrap credential Admin cố định trong migration**, bắt buộc rotation/secret ngoài repository.
3. **Bổ sung E2E + DB integration test**, đặc biệt cho authorization, approval, journal isolation, export và mobile.

---

## 2. Các thay đổi UI/UX đã thực hiện

### 2.1. Branding và ngôn ngữ giao diện

- Đổi tên sản phẩm thành **Rebiomed Protocol**.
- Cập nhật tagline thành **From Researchers to Researchers**.
- Bổ sung dòng giới thiệu/presenter theo các yêu cầu lịch sử, sau đó chuẩn hóa thương hiệu về Rebiomed Protocol.
- Áp dụng font nội bộ:
  - **Be Vietnam Pro** cho nội dung, tiêu đề, biểu mẫu và giao diện tiếng Việt.
  - **IBM Plex Mono** cho số liệu, đơn vị, mã mẫu và kết quả tính.
- Nhúng font vào `client/public/fonts/`, không phụ thuộc hoàn toàn vào Google Fonts khi self-hosting/GitHub Pages.

### 2.2. Shell, sidebar và điều hướng

- Xây dựng sidebar/navigation chính thay cho bố cục đơn giản ban đầu.
- Đưa account icon lên góc trên bên phải và gom thao tác profile/logout vào khu vực tài khoản.
- Bỏ khu vực ghim nhanh và các tín hiệu tổng quan không còn cần thiết.
- Thêm nút **rút gọn/mở rộng các nhóm lớn** trên thanh công cụ.
- Mặc định một số nhóm quản trị nội dung được thu gọn, chỉ mở khi người dùng chọn Show.
- Thêm menu ba gạch cho chế độ mobile/landscape.
- Bổ sung layout chia đôi để bước quy trình và calculator gắn kèm có thể hiển thị song song trên màn hình ngang.

### 2.3. Calculator UI và lựa chọn dạng ô

- Chuẩn hóa Unit Converter, Seeding và các calculator đặc biệt vào cùng workbench layout.
- Thay các lựa chọn đơn vị/cách tính dạng dropdown bằng **choice cards**:
  - L/mL/µL.
  - g/mg/µg/ng.
  - mol/mmol/µmol.
  - Pa/kPa/atm/mmHg.
  - °C/°F.
  - cell, cell/mL, cell/giếng, cell/flask ở các nơi còn sử dụng.
  - Stock unit/% stock.
  - Hệ số pha loãng hoặc dùng thể tích ban đầu + thể tích pha thêm.
  - mL/µL cho Seeding.
  - L/mL/µL cho Pha hóa chất.
- Trạng thái đang chọn có màu xanh, viền nổi bật và thuộc tính `aria-pressed`.
- Xử lý responsive mobile:
  - Nút dài tự xuống dòng.
  - Nhóm lựa chọn nhiều mục chuyển thành lưới co giãn.
  - Nhóm C1/V1/C2/V2 chuyển thành lưới 2 cột.
  - Unit Converter chuyển thành bố cục một cột trên màn hình hẹp.
  - Hạn chế `min-width`, `max-width` và thêm `overflow-wrap` để tránh tràn ngang.

### 2.4. Quy trình và nội dung

- Tạo trình biên soạn quy trình không cần viết code.
- Mỗi quy trình có:
  - Tên.
  - Người viết.
  - Mô tả/tóm tắt.
  - Nhiều bước, thời gian/điều kiện và hướng dẫn chi tiết.
  - Tối đa 3 calculator được liên kết cho mỗi bước.
- Khi bấm một tool gắn kèm, tool đó hiển thị trực tiếp bên cạnh bước; có thể mở tối đa 3 tool cùng lúc theo nhu cầu.
- Phân nhóm quy trình thành:
  - Quy trình cho Tế bào.
  - Quy trình cho PCR.
  - Quy trình đánh giá.
  - Quy trình nhuộm.
  - Nuôi cấy Hypoxia.
  - Nuôi cấy áp suất cao.
- Thêm bảng ghi chú Zymography và các bảng/ghi chú liên quan.
- Điều chỉnh tiêu đề nhóm quy trình thành màu xanh và làm nổi bật tên quy trình.

### 2.5. Responsive và mobile

- Có breakpoint cho desktop, tablet, mobile portrait và mobile landscape.
- Sidebar có thể ẩn/mở trên thiết bị nhỏ.
- Tool gắn vào protocol được bố trí song song trong landscape.
- Sửa lỗi khoảng trống lớn/kéo toàn bộ nội dung sang trái khi mở tool trên điện thoại.
- Bổ sung kiểm soát overflow cho công thức dài, tên cell unit dài và choice cards.
- Checkpoint mới nhất đã xử lý riêng lỗi tràn chữ ở các ô lựa chọn mobile.

---

## 3. Các tính năng đã triển khai

### 3.1. Authentication và quản trị account

- Đăng nhập Admin/User trong cùng luồng.
- Hỗ trợ email và username theo chế độ self-hosting.
- Account User có thể đổi email/mật khẩu nhưng không đổi username.
- Có role:
  - `User`.
  - `Admin`.
  - `Supporter` với quyền vận hành ngang Admin trong các luồng được bảo vệ.
- Bảo vệ riêng cho các account đặc biệt theo yêu cầu lịch sử:
  - Wstratos không bị hạ quyền.
  - Website Supporter có quyền đặc biệt và hiển thị “Hỗ trợ 24/7”.
- Admin có thể:
  - Duyệt account User.
  - Nâng/hạ quyền.
  - Thu hồi quyền truy cập.
  - Xóa User.
  - Reset mật khẩu.
  - Xem mật khẩu theo cơ chế re-auth và vault hiện có.
- Bổ sung bảng account Admin/User trong khu vực quản trị.
- Gom hành động quản lý account vào menu dấu ba chấm.

### 3.2. Approval và quản trị nội dung

- User chỉnh sửa nội dung đã duyệt sẽ tạo `pendingEdit`; bản đang duyệt không ghi đè bản đã duyệt.
- Admin/Supporter có thể duyệt hoặc từ chối nội dung.
- Admin có thể chỉnh trực tiếp nội dung trước khi duyệt.
- Xóa bản nháp và bản duyệt theo quyền.
- Sửa nhiều lỗi trước đây liên quan đến:
  - Mất quy trình đã duyệt.
  - Không xóa được protocol/tool.
  - Xóa một nội dung nhưng làm seed ghi đè toàn database.
  - Protocol bị tự tạo lại sau khi đã xóa.
- Thêm transaction/hardened approval flow để tránh mất dữ liệu.
- Thêm seed marker riêng cho các tool/protocol bổ sung nhằm tránh tái tạo nội dung đã xóa.

### 3.3. Kho quy trình và protocol đã thêm

Các nhóm nội dung đã được khôi phục hoặc bổ sung gồm:

- Perfusion.
- Tách Protein Tổng.
- Tách Protein từ nhân/tế bào chất/màng tế bào.
- Đo nồng độ Protein (BCA).
- Pha Gel SDS-PAGE.
- Western Blot.
- Zymography.
- Quy trình tách RNA bằng Trizol.
- Điện di RNA/DNA.
- cDNA Reverse-transcription.
- qPCR.
- Đo CCK8.
- Lập đường chuẩn CCK8.
- ALT/AST.
- Albumin.
- Đo lượng collagen do tế bào tiết ra.

### 3.4. Calculator và công cụ khoa học

Đã có hoặc đã mở rộng các công cụ:

- Pha loãng nồng độ C1/V1/C2/V2.
- Viability.
- Đếm tế bào bằng buồng đếm thủ công.
- Tính số tế bào cần.
- Tính thể tích cần lấy.
- Tính lượng thể tích cần bổ sung.
- Seeding.
- Unit Converter.
- Nycodenz một lớp/hai lớp, protocol-only.
- Pha Working Solution BCA, protocol-only.
- Hypoxia headspace/O₂.
- ICC staining:
  - Pha kháng thể sơ cấp.
  - Pha kháng thể thứ cấp.
  - Permeabilization.
  - Blocking buffer.
  - Pha DAPI.
- Master Mix cDNA.
- Master Mix qDNA.
- Tính toán qPCR.
- Custom calculator/formula builder.
- Chemical mixing và stock recipes.

Các cải tiến đáng chú ý:

- Hỗ trợ dấu phẩy thập phân theo locale người dùng.
- Hỗ trợ lựa chọn đơn vị riêng theo từng phép tính.
- Hỗ trợ giới hạn thể tích theo loại giếng/flask.
- Seeding có lựa chọn thể tích mỗi giếng và kiểm tra min/max.
- Master Mix có lưu tạm theo account trong 10 giờ bằng localStorage, thêm mẫu, sửa ký hiệu và xóa bản lưu.
- Formula parser dùng cơ chế an toàn, không dùng `eval`, hỗ trợ toán tử, ngoặc và căn bậc hai.

### 3.5. Nhật ký thí nghiệm

- Chuyển Tổng quan thành **Nhật ký Thí nghiệm**.
- Mỗi account có bảng nhật ký riêng.
- Chỉ chủ account có thể xem/sửa/xóa dữ liệu của mình.
- Lưu được cả entry chưa đầy đủ dữ liệu.
- Có:
  - Công việc đã làm.
  - Quy trình đã làm.
  - Số lượng cell đã seed.
  - Ngày làm.
  - Ghi chú.
  - Ghi chú số liệu.
  - Vấn đề bất cập.
- Có nút `+` để tạo entry.
- Xóa từng entry, xóa nhiều entry hoặc xóa toàn bộ.
- Có template nhật ký và template field tùy chỉnh.
- Có tab preview dữ liệu.
- Có export Excel phía client; dữ liệu export không được lưu lên server.

### 3.6. Phản ánh và trung tâm thông báo

- Gửi phản ánh theo nhóm:
  - Hóa chất.
  - Thiết bị.
  - Vật tư.
- Admin có queue chung và phân nhóm xử lý.
- Có người xử lý, xác nhận và thời gian xử lý.
- Phản ánh đã xử lý được giữ theo thời gian quy định rồi tự dọn.
- User có thể xóa phản ánh đã gửi.
- Thêm notification bell cho Admin.
- Notification center hỗ trợ:
  - Account mới.
  - Protocol/tool/chemical chờ duyệt.
  - Feedback.
  - Đánh dấu từng mục đã đọc.
  - Lọc theo loại.
  - Đánh dấu tất cả đã đọc.
  - Hiển thị thời gian/người tạo.

### 3.7. Self-hosting và GitHub Pages

- Docker Compose gồm app, MySQL và migration flow.
- Có `SELF_HOSTING.md` hướng dẫn:
  - `.env`.
  - Docker Compose.
  - Node.js trực tiếp.
  - Migration.
  - Health check.
  - Backup volume.
  - HTTPS reverse proxy.
- Có `GITHUB_PAGES.md` và branch `gh-pages` cho static artifact.
- GitHub Pages hỗ trợ:
  - Tra cứu protocol/note/chemical snapshot.
  - Calculator chạy trong browser.
  - Master Mix frontend.
  - Không cần Express/tRPC/MySQL cho phần tĩnh.
- GitHub Pages **không hỗ trợ** auth, Admin, approval, account journal dùng chung, feedback đồng bộ hoặc server-side upload.

---

## 4. Bất cập UX người dùng có thể gặp

### Mức cao

1. **Refresh hoặc deep link làm mất ngữ cảnh.** App hiện chỉ có route `/`; nhiều view, calculator đang chọn, filter và tab nằm trong React state. Refresh/bookmark/back-forward có thể không khôi phục đúng màn hình.
2. **Thông báo trạng thái approval chưa đủ trực quan trong mọi trường hợp.** User có thể không biết nội dung đang là draft, pending edit, bị từ chối hay đã được áp dụng.
3. **Quyền thay đổi trong tab đang mở có thể tạo cảm giác không nhất quán.** Admin thu hồi User hoặc User bị đổi role ở tab khác nhưng giao diện hiện tại chưa chắc cập nhật tức thời.

### Mức trung bình

4. **Nhật ký dài trên mobile khó đọc.** Nhiều field, bulk action, preview và export cùng xuất hiện ở header hẹp.
5. **Export phụ thuộc popup/tab mới.** Trình duyệt chặn popup có thể làm preview không mở.
6. **Bản lưu tạm Master Mix không đồng bộ giữa thiết bị/browser.** Xóa site data, dùng thiết bị khác hoặc nhiều tab có thể làm mất/ghi đè bản lưu.
7. **GitHub Pages có thể bị hiểu nhầm là dữ liệu live.** Đây là snapshot tại thời điểm build, không phải database đồng bộ thời gian thực.
8. **Các choice cards nhiều lựa chọn vẫn cần kiểm thử trên 320px và font hệ thống phóng lớn.** Đã có CSS chống overflow nhưng chưa có browser E2E chứng minh toàn bộ màn hình.

### Mức thấp

9. **Accessibility chưa được kiểm thử đầy đủ.** Cần kiểm tra keyboard focus, screen reader, Escape, focus trap và trạng thái disabled.
10. **`maximum-scale=1` có thể hạn chế zoom trên mobile.** Điều này ảnh hưởng người dùng thị lực kém.
11. **Ngày nhật ký và thứ tự lịch sử cần thống nhất với kỳ vọng người dùng.** Cần xác nhận hiển thị mới nhất trước hay cũ nhất trước và xử lý timezone rõ ràng.
12. **Thông báo lỗi đôi khi mang tính kỹ thuật.** Cần chuẩn hóa message người dùng và log kỹ thuật tách riêng.

---

## 5. Bug/rủi ro kỹ thuật tiềm ẩn

### High — cần ưu tiên xử lý

#### 5.1. Mutation nội dung/hóa chất còn mở cho anonymous

Review code cho thấy một số procedure tạo/sửa/xóa nội dung và chemical recipe đang là public procedure hoặc chưa gắn ownership đủ chặt. Điều này có thể cho phép:

- Anonymous tạo hàng loạt draft.
- Anonymous sửa/xóa draft của người khác.
- Spam database.
- Làm nhiễu hàng đợi approval.
- Gây chi phí/storage tăng.

**Khuyến nghị:** chuyển mutation sang `protectedProcedure`, kiểm tra `userId`/ownership ở server, giới hạn rate/payload và ghi audit log.

#### 5.2. Bootstrap Admin credential nằm trong migration Git

`drizzle/0009_seed_admin.sql` chứa identity Admin cố định và password hash bootstrap. Hash không phải plaintext, nhưng việc gắn credential đặc quyền vào repository/migration tạo rủi ro:

- Credential bootstrap bị tái sử dụng giữa môi trường.
- Migration cũ có thể tái đặt quyền ở môi trường mới.
- Khó audit việc rotation.

**Khuyến nghị:** bootstrap Admin bằng secret/runtime setup, bắt buộc đổi mật khẩu lần đầu, không commit identity/credential đặc quyền trong migration.

#### 5.3. Password vault có thể giải mã

Thiết kế hiện tại lưu password theo cơ chế vault để Admin được phép xem theo quyền. Đây là dữ liệu nhạy cảm hơn reset password thông thường.

**Rủi ro:** nếu database + vault key hoặc Admin session bị lộ, password có thể được khôi phục. Cần rate limit, audit log, re-auth rõ ràng, không log secret và cân nhắc thay bằng reset token không thể đọc lại mật khẩu cũ.

#### 5.4. Runtime schema/seed trong request path

`server/db.ts` vẫn có runtime table creation/backfill/seed marker bên cạnh Drizzle migrations. Với nhiều replica hoặc request đầu tiên đồng thời, select-then-insert marker có thể race.

**Rủi ro:** request đầu tiên lỗi, schema drift, seed trùng hoặc deployment không đồng nhất.

**Khuyến nghị:** chuyển schema/backfill/seed thành migration/startup job duy nhất trước khi phục vụ traffic; thêm test cold database và multi-instance.

### Medium — cần đưa vào backlog gần

#### 5.5. Session cookie Secure/SameSite trong self-host HTTP

Cookie đang dùng `SameSite=None; Secure`. Self-host bằng `http://localhost:3000` có thể làm browser không gửi cookie trong một số môi trường.

**Khuyến nghị:** xác định rõ local HTTP exception an toàn hoặc yêu cầu HTTPS local/reverse proxy; test Chrome, Safari và iOS.

#### 5.6. Build warning trong `client/index.html`

Vite vẫn cảnh báo script `api/platform/config.js` không có `type="module"`. Build không fail nhưng cần kiểm tra path, MIME type và cache trên self-host/GitHub Pages.

#### 5.7. Không có rate limit theo route

Body limit hiện khá lớn cho toàn app. Khi kết hợp với public mutation, có nguy cơ request abuse, DB spam hoặc memory pressure.

**Khuyến nghị:** giới hạn riêng cho mutation, upload/JSON body, reverse proxy và IP/account rate limit.

#### 5.8. CORS/CSRF chưa có bằng chứng kiểm thử đầy đủ

Cookie cross-site và mutation tRPC cần được kiểm thử với Origin lạ, browser cookie policy và CSRF scenario.

#### 5.9. LocalStorage chứa dữ liệu mẫu lab dạng plaintext

Master Mix temporary draft có thể chứa sample information trong localStorage. Dữ liệu có thể bị đọc bởi script cùng origin hoặc người dùng khác trên máy dùng chung.

**Khuyến nghị:** cảnh báo dữ liệu nhạy cảm, xóa khi logout nếu phù hợp, cân nhắc mã hóa/không lưu sample identifiers nhạy cảm.

#### 5.10. Một pending slot cho mỗi record

`pendingEdit` là một slot duy nhất. Hai User sửa liên tiếp có thể thay thế pending trước đó hoặc làm mất context người gửi.

**Khuyến nghị:** lưu approval requests thành bảng riêng theo version, có diff, người tạo, trạng thái và lịch sử.

### Low hoặc feature gap

11. Hiện export journal có preview/XLSX; chưa có PDF/CSV export thực tế trong code hiện tại.
12. GitHub Pages snapshot có nguy cơ stale nếu không tự động hóa build branch.
13. Chưa thấy E2E đảm bảo generator static không đưa draft/private content vào artifact.
14. Parser formula an toàn nhưng cần property tests cho precedence, sqrt, divide-by-zero, Infinity và input cực lớn.
15. App chỉ có route `/` và `/404`; deep-link semantics còn hạn chế.

> Tại thời điểm review chưa có bug Critical tái hiện được. Điều này không đồng nghĩa hệ thống đã được kiểm thử an toàn toàn diện.

---

## 6. Ma trận kiểm thử đề xuất

### P0 — kiểm thử trước khi mở rộng sử dụng

- Gọi trực tiếp mọi mutation bằng anonymous, User thường và Admin.
- Kiểm tra ownership/authorization với draft, approved record và record của account khác.
- Test account bị revoke giữa lúc tab đang mở.
- Test Wstratos/Supporter không bị hạ quyền ngoài ý muốn.
- Test password reveal/reset: sai mật khẩu, burst request, audit log và không lộ secret.
- Test database rỗng, migration lại, hai process khởi động đồng thời và backup/restore.

### P1 — kiểm thử tính đúng của dữ liệu

- Calculator với số 0, âm, NaN, Infinity, số rất lớn, dấu phẩy/dấu chấm.
- Pha loãng theo factor và theo volume.
- Giới hạn thể tích từng loại giếng/flask.
- Nycodenz một lớp/hai lớp và tổng thể tích không hợp lệ.
- Master Mix không tạo thể tích âm, rounding hợp lý.
- qPCR với thiếu gene, thiếu replicate, gene reference sai.
- Công thức custom với precedence, sqrt, ngoặc và chia cho 0.

### P1 — dữ liệu riêng tư và export

- Cross-account journal isolation.
- Bulk delete với ID trộn giữa nhiều owner.
- Nội dung HTML/Unicode/newline và chuỗi bắt đầu bằng `=`, `+`, `-`, `@` trong Excel.
- Popup blocker, download permission, file XLSX lỗi hoặc entry rỗng.
- Timezone/date sort và nhật ký rất lớn.

### P1 — mobile/accessibility

- Viewport 320, 375, 414, 768px; portrait/landscape.
- iOS Safari và Android Chrome.
- Keyboard ảo không che input/action.
- Choice cards không overflow ngang.
- Sidebar Escape/focus trap/tab order.
- Screen reader labels, contrast, zoom và font size lớn.

### P2 — GitHub Pages/deployment

- Root path và `/RebiomedprotocolWeb-Test1/`.
- Hard refresh/deep link/404.
- Snapshot thiếu hoặc lỗi fetch phải có banner rõ ràng.
- `config.js` đúng path/content-type/cache.
- Không có secret, API key, database URL hoặc draft/private content trong static bundle.
- HTTPS headers: CSP, HSTS, frame policy, CORS/CSRF.

---

## 7. Backlog khuyến nghị theo thứ tự

### Sprint 1 — bảo mật và integrity

1. Đóng toàn bộ public content/chemical mutations.
2. Tách bootstrap Admin khỏi migration Git và bắt buộc rotation.
3. Thêm rate limit, audit log và payload validation.
4. Kiểm thử authorization matrix trực tiếp ở tRPC.
5. Xác định chính sách password: ưu tiên reset token thay vì xem lại password.

### Sprint 2 — độ tin cậy dữ liệu

1. Di chuyển runtime DDL/seed/backfill ra migration/startup job.
2. Tạo bảng approval request/version riêng thay vì một `pendingEdit`.
3. Thêm DB integration test với MySQL 8.4.
4. Thêm concurrency test cho seed/delete/approve/edit.

### Sprint 3 — UX và accessibility

1. Đồng bộ view/tab/filter với URL hoặc query state.
2. Thêm trạng thái pending/approved/rejected rõ ở mọi editor.
3. Bổ sung fallback export khi popup bị chặn.
4. Hiển thị thời gian bản lưu tạm và cảnh báo phạm vi localStorage.
5. Cho phép zoom mobile và hoàn tất keyboard/screen-reader audit.

### Sprint 4 — vận hành và static deployment

1. Thêm GitHub Actions chính thức nếu muốn tự động deploy Pages.
2. Hiển thị `generatedAt`, commit và cảnh báo snapshot cũ.
3. Thêm PDF/CSV nếu vẫn giữ yêu cầu export đó.
4. Thêm security headers và quy trình backup/restore định kỳ.

---

## 8. Checkpoint và bằng chứng gần nhất

Các checkpoint gần nhất liên quan trực tiếp đến UI/UX và responsive:

| Commit | Nội dung |
|---|---|
| `f4b0506` | Áp dụng Be Vietnam Pro và IBM Plex Mono |
| `4a5aaf9` | Chuyển lựa chọn calculator thành choice cards |
| `2364fcc` | Chống tràn choice cards trên mobile |

Các kiểm tra gần nhất:

- `pnpm check`: pass.
- `pnpm test`: **50/50 tests pass**.
- `pnpm build`: pass; còn cảnh báo script config của Vite cần xử lý riêng.
- `git status`: sạch tại thời điểm rà soát.

---

## 9. Kết luận

Project đã đạt mức **feature-rich internal lab management system** với nền tảng UI/UX và domain calculators khá rộng. Các thay đổi gần đây đã cải thiện rõ khả năng dùng trên mobile và tính nhất quán của calculator.

Tuy nhiên, trước khi coi hệ thống là production-ready cho nhiều người dùng, cần ưu tiên:

1. **Khóa mutation public và ownership ở server.**
2. **Xử lý credential bootstrap/password vault.**
3. **Tách runtime schema mutation khỏi request path.**
4. **Bổ sung E2E, DB integration và authorization tests.**
5. **Hoàn thiện deep-link, export fallback, accessibility và stale snapshot warning.**

Các bài test hiện tại chứng minh nhiều công thức và một số luồng server quan trọng đang chạy đúng, nhưng chưa đủ để chứng minh toàn bộ ứng dụng an toàn, bền vững và không có lỗi trong môi trường production nhiều account/replica.
