# Hệ thống tài khoản kế toán

Danh mục **tài khoản kế toán theo Thông tư 200/2014/TT-BTC**, nhiều cấp (cha - con), dùng chung cho toàn hệ thống. Tài khoản thuế (133, 3331, 3333...) có tài khoản con để theo dõi chi tiết; mỗi **mã thuế** chọn tài khoản thuế đầu vào và đầu ra của nó để sau này định khoản tự động.

Màn hình: Tài chính › 1. Danh mục › **Hệ thống tài khoản kế toán** (`fin_account_cat`). Mã thuế: Cài đặt › Mã thuế (`sys_tax_rates`).

## 1. Cấu trúc

| Cột (`erp_account`) | Ý nghĩa |
|---|---|
| `code` | Số hiệu tài khoản (khóa): `133`, `1331`, `33311`... Tối đa 20 ký tự |
| `name`, `name_en` | Tên tiếng Việt, tên tiếng Anh |
| `parent_account_code` | Tài khoản cha; trống nếu là tài khoản cấp 1 |
| `level` | Cấp: 1 cho tài khoản cấp 1, cấp của cha + 1 cho tài khoản con (máy chủ tự tính) |
| `account_type` | Loại: `ASSET` tài sản, `LIABILITY` nợ phải trả, `EQUITY` vốn chủ sở hữu, `REVENUE` doanh thu, `COST` chi phí sản xuất kinh doanh, `OTHER_INCOME` thu nhập khác, `OTHER_EXPENSE` chi phí khác, `PROFIT_LOSS` xác định kết quả kinh doanh, `OFF_BALANCE` ngoài bảng |
| `nature` | Tính chất số dư: `DEBIT` dư Nợ, `CREDIT` dư Có, `BOTH` lưỡng tính |
| `note`, `is_active`, `sort_order` | Ghi chú, đang sử dụng, thứ tự |

Script `sql/postgresql/50-chart-of-accounts.sql` nạp sẵn **236 tài khoản** theo Thông tư 200 (cấp 1 và cấp 2, thêm các tài khoản con cấp 3 của thuế: 33311, 33312, 33381, 33382). Chạy lại không ghi đè tài khoản đã có.

Tài khoản thuế có sẵn: **133** → 1331 (hàng hóa, dịch vụ), 1332 (TSCĐ); **3331** → 33311 (GTGT đầu ra), 33312 (GTGT hàng nhập khẩu); 3332 tiêu thụ đặc biệt, **3333** xuất nhập khẩu, 3334 thu nhập doanh nghiệp, 3335 thu nhập cá nhân, 3336 tài nguyên, 3337 nhà đất - tiền thuê đất, **3338** → 33381 bảo vệ môi trường, 33382 các loại thuế khác, 3339 phí lệ phí.

## 2. Quy tắc

- **Mã con bắt đầu bằng mã cha và dài hơn** (13311 dưới 1331). Nhờ vậy danh sách sắp theo số hiệu đọc được như cây: cha đứng trước con; tài khoản ngoài bảng (loại 0) xếp cuối như trong thông tư.
- **Tài khoản cha chỉ cộng dồn, chỉ tài khoản lá (không có con) mới hạch toán.** Cột "Hạch toán" của danh sách: *Chi tiết* (lá) hoặc *Tổng hợp* (có con).
- **Tài khoản cha không đổi được sau khi lưu**, để cấp không bao giờ phải tính lại. Muốn chuyển cấp thì tạo tài khoản mới đúng chỗ rồi ngừng tài khoản cũ.
- **Không thêm con vào tài khoản đang gắn mã thuế** (nó sẽ thôi là tài khoản lá). Chuyển mã thuế sang tài khoản khác trước, rồi mới thêm con.
- **Không ngừng sử dụng tài khoản cha khi còn con đang sử dụng**; tài khoản con không được đang sử dụng dưới một tài khoản cha đã ngừng.
- **Không xóa tài khoản còn con**, hoặc còn được mã thuế dùng (thông báo nêu *Mã thuế (n)*).
- Mã tài khoản không đổi mã / gộp mã được (số hiệu tài khoản sẽ được sổ cái dùng làm khóa).
- Lưu theo cơ chế chung: chống ghi đè (`version`), nhật ký thay đổi, nhập / xuất Excel, xóa nhiều.

## 3. Tài khoản của mã thuế

Mỗi mã thuế có hai ô **Tài khoản thuế đầu vào** và **Tài khoản thuế đầu ra** (Cài đặt › Mã thuế). Chỉ chọn được tài khoản **chi tiết đang sử dụng** (tra cứu `accounts?postable=true`); máy chủ kiểm lại khi lưu và từ chối tài khoản cha. Script 50 điền sẵn: mã thuế GTGT chịu thuế (VAT0, VAT5, VAT8, VAT10) đầu vào **1331**, đầu ra **33311**; thuế nhập khẩu (NK00, NK05, NK10) đầu ra **3333**; mã không chịu thuế (KCT) để trống. Các cột này chưa được chứng từ nào dùng để định khoản; chúng sẵn sàng cho phần hạch toán tự động sau này.

## 4. API

| Việc | Đường dẫn |
|---|---|
| Danh sách, xuất Excel, thêm, sửa, xóa, nhập, xóa nhiều | `GET/POST/PUT/DELETE api/finance/accounts` (`/export`, `/import`, `/delete-many`) |
| Bộ lọc riêng của danh sách | `level=2`, `type=ASSET`, `parent=333` (con của 333), `postable=true` (tài khoản chi tiết đang sử dụng) |
| Tra cứu | `GET api/lookups/accounts?postable=true&type=LIABILITY&q=333` (kèm cấp, loại, tính chất) |

Quyền theo khung danh mục: Xem, Thêm, Sửa, Xóa, Xuất; chức năng `fin_account_cat` (cấp quyền ở Cài đặt › Người dùng & phân quyền).

## 5. Mã nguồn

| Phần | Nơi |
|---|---|
| Bảng và dữ liệu Thông tư 200 | `ServerService/sql/postgresql/50-chart-of-accounts.sql` |
| Thực thể, loại và tính chất | `Core.Domain/Modules/Accounts/Account.cs` |
| Dịch vụ (quy tắc cha - con) | `Core.Infrastructure/Modules/Accounts/AccountService.cs`, tra cứu `AccountLookup.cs` |
| API | `Core/Modules/Accounts/AccountsController.cs` |
| Tài khoản của mã thuế | `TaxRate` (`InputAccountCode`, `OutputAccountCode`), `TaxRateService.PostingAccountAsync` |
| Màn hình | `Frontend/src/modules/finance/accounts/`, màn mã thuế `modules/settings/TaxRateCategoryView.tsx` |

Lỗi thường gặp: `account.codePrefix`, `account.parentLocked`, `account.parentUsedByTax`, `account.activeChildren`, `account.hasChildren`, `taxRate.accountNotLeaf`, `taxRate.accountInvalid`.

## 6. Chưa làm

Hạch toán (định khoản) chứng từ vào tài khoản, sổ cái, số dư đầu kỳ theo tài khoản, danh mục tài khoản riêng theo đơn vị cơ sở (hiện dùng chung toàn hệ thống), hiển thị dạng cây đóng / mở (danh sách hiện thụt lề theo cấp).
