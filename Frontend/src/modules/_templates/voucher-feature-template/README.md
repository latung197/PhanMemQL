# HƯỚNG DẪN TỰ PHÁT TRIỂN CHỨC NĂNG CHỨNG TỪ (VOUCHER TEMPLATE)

Thư mục này được đóng gói độc lập cho nghiệp vụ **Chứng Từ Giao Dịch Master-Detail** (Hóa đơn, phiếu nhập/xuất, đề nghị thanh toán, hợp đồng, lệnh sản xuất).

---

## 📁 Cấu trúc đóng gói:
```
my-new-voucher/
├── VoucherFeatureView.tsx  # Giao diện chính (GridView danh sách + Modal tạo Master-Detail + duyệt)
├── types.ts                # Định nghĩa VoucherMasterModel, VoucherDetailItem, FilterCriteria
├── index.ts                # Export barrel
└── README.md               # Hướng dẫn chi tiết
```

---

## 🚀 Các tính năng tích hợp sẵn:
1. **Bảng danh sách chứng từ (GridView):**
   - Phân trang, tìm kiếm số chứng từ / đối tác / diễn giải.
   - Hiển thị badge trạng thái (Lập chứng từ, Chờ duyệt, Đã duyệt, Hủy).
   - Nút Xem chi tiết, Sửa, Phê duyệt nhanh, Xóa.
2. **Modal lập chứng từ 2 phần:**
   - Phần đầu (Master): Số chứng từ, ngày, đối tác, kho, diễn giải, trạng thái.
   - Phần chi tiết (Details Grid): Bảng dòng hàng hóa tự động tính số lượng x đơn giá = thành tiền.
3. **Phân quyền người dùng:**
   - Tự động kiểm tra quyền xem, quyền lập/sửa, quyền duyệt chứng từ theo vai trò tài khoản (`getActionPermission`).
