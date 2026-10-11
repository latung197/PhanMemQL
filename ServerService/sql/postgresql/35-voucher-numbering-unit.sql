-- Mẫu số chứng từ phải có {DVCS}: dải số chạy riêng theo đơn vị cơ sở nhưng số chứng từ là duy nhất toàn hệ thống, nên hai đơn
-- vị cùng lập phiếu đầu tháng sẽ trùng số nếu mẫu không có mã đơn vị. Chạy lại được; chạy sau 09-voucher-numbering.sql.
-- Mẫu cũ không có {DVCS}: chèn ngay sau {PREFIX} (hoặc đứng đầu nếu không có {PREFIX}). Số đã cấp giữ nguyên; số mới của kỳ đang
-- chạy đếm tiếp nên không trùng số cũ vì có thêm mã đơn vị.
UPDATE sys_voucher_numbering
SET pattern = CASE WHEN pattern LIKE '%{PREFIX}%' THEN replace(pattern, '{PREFIX}', '{PREFIX}-{DVCS}') ELSE '{DVCS}-' || pattern END
WHERE pattern NOT LIKE '%{DVCS}%';
