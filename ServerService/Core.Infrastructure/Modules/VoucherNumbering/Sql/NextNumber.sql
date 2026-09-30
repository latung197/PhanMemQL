-- Takes the next number of a series atomically: two users saving at the same moment never get the
-- same number. Runs in the caller's transaction (IUnitOfWork), so a failed save gives the number back.
INSERT INTO sys_voucher_sequence (voucher_type, unit_code, period_key, last_number)
VALUES (@voucherType, @unitCode, @periodKey, 1)
ON CONFLICT (voucher_type, unit_code, period_key)
DO UPDATE SET last_number = sys_voucher_sequence.last_number + 1
RETURNING last_number;
