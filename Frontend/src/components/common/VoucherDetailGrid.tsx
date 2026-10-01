import React from 'react';
import { Search, Trash2, Plus } from 'lucide-react';
import { VoucherGridInfo, VoucherColumnConfig } from '../../types';
import { getVoucherGridConfig } from '../../mock/voucherGridConfigs';
import { Button, QuantityInput, NumberInput, ComboBox, DateTimePicker } from './index';
import { useNumberFormat } from '../../context/NumberFormatContext';
import { useLanguage } from '../../context/LanguageContext';
import { interpolate } from '../../utils/interpolate';

/**
 * PROPS VOUCHER DETAIL GRID CONTROL DÙNG CHUNG
 * Đã tích hợp cấu hình dữ liệu cột từ Bảng Hệ Thống `sys_voucher_grid` (qua gridId hoặc gridInfo)
 * Đầy đủ bộ Sự kiện Lifecycle Event Handlers cho từng mục đích nghiệp vụ chứng từ cụ thể.
 */
export interface VoucherDetailGridProps<T = Record<string, any>> {
  /** Mã Lưới Chứng Từ trong bảng `sys_voucher_grid` (VD: 'PNK_ITEMS', 'PNK_BOM', 'PXK_ITEMS', 'PXK_BOM') */
  gridId?: string;
  /** Cấu hình Lưới Chứng Từ truyền trực tiếp (Ưu tiên hơn gridId nếu được truyền) */
  gridInfo?: VoucherGridInfo;
  /** Danh sách dữ liệu các dòng chi tiết */
  data: T[];
  /** Callback cập nhật lại danh sách dữ liệu */
  onChange: (newData: T[]) => void;
  
  // ==========================================
  // SỰ KIỆN LIFECYCLE GRID (LIFECYCLE EVENT HANDLERS)
  // ==========================================
  
  /** Sự kiện chạy TRƯỚC KHI THÊM dòng mới (Trước khi thêm: Kiểm tra điều kiện hoặc trả về object dữ liệu mặc định tùy chỉnh. Trả về false để hủy) */
  beforeAdd?: (currentData: T[]) => boolean | Promise<boolean> | Partial<T> | void;
  /** Sự kiện chạy SAU KHI THÊM dòng mới thành công */
  afterAdd?: (newRow: T, updatedData: T[], newRowIndex: number) => void;
  
  /** Sự kiện chạy TRƯỚC KHI THAY ĐỔI giá trị ô (Sửa ô: Trả về false để ngăn không cho chỉnh sửa) */
  beforeEdit?: (rowIndex: number, field: string, oldValue: any, newValue: any, row: T) => boolean | Promise<boolean> | void;
  /** Sự kiện chạy SAU KHI THAY ĐỔI giá trị ô (Sau khi sửa: Dùng để tính toán lại giá trị, thuế, chiết khấu, tự động load danh mục liên quan) */
  afterEdit?: (rowIndex: number, field: string, oldValue: any, newValue: any, updatedRow: T, updatedData: T[]) => void;
  
  /** Sự kiện chạy TRƯỚC KHI XÓA dòng (Trả về false để ngăn không cho xóa) */
  beforeDelete?: (rowIndex: number, rowToDelete: T, currentData: T[]) => boolean | Promise<boolean> | void;
  /** Sự kiện chạy SAU KHI XÓA dòng thành công */
  afterDelete?: (deletedRow: T, remainingData: T[]) => void;
  
  /** Sự kiện khi Click vào ô / Cell */
  onCellClick?: (rowIndex: number, field: string, value: any, row: T) => void;
  /** Sự kiện khi Focus vào ô / Cell */
  onCellFocus?: (rowIndex: number, field: string, row: T) => void;
  /** Sự kiện khi Click vào nguyên dòng / Row */
  onRowClick?: (rowIndex: number, row: T) => void;

  /** Callback mở Modal tra cứu F2 */
  onLookupClick?: (rowIndex: number, column: VoucherColumnConfig, row: T) => void;
  
  /** 
   * Callback khi gõ xong Mã vật tư/hàng hóa (bấm Enter hoặc Blur rời khỏi ô):
   * - Kiểm tra xem mã có tồn tại trong CSDL hay không.
   * - Nếu mã hợp lệ (trả về true): điền thông tin + tự động thêm dòng mới nếu bấm Enter hoặc ở dòng cuối.
   * - Nếu mã không tồn tại (trả về false): tự động bật Popup Tra cứu (onLookupClick) để chọn.
   */
  onCodeSubmit?: (rowIndex: number, field: string, codeValue: string, row: T) => boolean | Promise<boolean>;

  /** Chế độ chỉ đọc */
  readOnly?: boolean;
  /** Mã tiền tệ (Mặc định: VND) */
  currencyCode?: string;
  /** Tỷ giá hối đoái */
  exchangeRate?: number;
  /** CSS class tùy chỉnh */
  className?: string;
  /** Chiều cao tối đa của khung bảng */
  maxHeight?: string;
  /** Hiển thị nút Thêm dòng ở toolbar bên dưới */
  showAddButton?: boolean;
  /** Các cột bị ẩn (VD: đơn giá, thành tiền khi người dùng không có quyền Xem giá) */
  hiddenFields?: string[];
}

const STANDARD_UOMS = [
  'Cái', 'Chiếc', 'Thùng', 'Hộp', 'Bộ', 'Kg', 'Mét', 'Thỏi', 'Lô',   // i18n-ignore: data
  'Chai', 'Lọ', 'Cuộn', 'Tấm', 'Bao', 'Gói', 'Kít', 'Thanh', 'Dây'  // i18n-ignore: data
];

export function VoucherDetailGrid<T extends Record<string, any>>({
  gridId,
  gridInfo: propGridInfo,
  data = [],
  onChange,
  beforeAdd,
  afterAdd,
  beforeEdit,
  afterEdit,
  beforeDelete,
  afterDelete,
  onCellClick,
  onCellFocus,
  onRowClick,
  onLookupClick,
  onCodeSubmit,
  readOnly = false,
  currencyCode = 'VND',
  exchangeRate = 1,
  className = '',
  maxHeight = '280px',
  showAddButton = true,
  hiddenFields
}: VoucherDetailGridProps<T>) {
  const { t } = useLanguage();
  const { formatNumber, formatCurrency } = useNumberFormat();

  // Load cấu hình cột từ Bảng Hệ Thống `sys_voucher_grid` (Registry DB Metadata)
  const hiddenKey = (hiddenFields ?? []).join('|');
  const gridConfig: VoucherGridInfo = React.useMemo(() => {
    const base = propGridInfo ?? getVoucherGridConfig(gridId ?? 'PNK_ITEMS');
    const hidden = new Set(hiddenKey ? hiddenKey.split('|') : []);
    return hidden.size ? { ...base, columns: base.columns.filter(c => !hidden.has(c.field)) } : base;
  }, [propGridInfo, gridId, hiddenKey]);

  // THÊM MỘT DÒNG MỚI (Xử lý BeforeAdd & AfterAdd)
  const handleAddRow = async () => {
    if (readOnly || gridConfig.allowAddRow === false) return;

    let customDefaultRow: Partial<T> = {};

    if (beforeAdd) {
      const result = await beforeAdd(data);
      if (result === false) return; // Hủy thao tác thêm
      if (typeof result === 'object' && result !== null) {
        customDefaultRow = result;
      }
    }

    const newRow = { 
      ...gridConfig.defaultNewRow, 
      ...customDefaultRow 
    } as T;

    const updatedData = [...data, newRow];
    onChange(updatedData);

    const newRowIndex = updatedData.length - 1;
    afterAdd?.(newRow, updatedData, newRowIndex);
  };

  // XÓA MỘT DÒNG (Xử lý BeforeDelete & AfterDelete)
  const handleDeleteRow = async (index: number) => {
    if (readOnly || gridConfig.allowDeleteRow === false) return;

    const rowToDelete = data[index];
    if (!rowToDelete) return;

    if (beforeDelete) {
      const canDelete = await beforeDelete(index, rowToDelete, data);
      if (canDelete === false) return; // Hủy thao tác xóa
    }

    let updatedData: T[];
    if (data.length <= 1) {
      // Giữ tối thiểu 1 dòng trống mặc định
      const blankRow = { ...gridConfig.defaultNewRow } as T;
      updatedData = [blankRow];
    } else {
      updatedData = data.filter((_, idx) => idx !== index);
    }

    onChange(updatedData);
    afterDelete?.(rowToDelete, updatedData);
  };

  // HÀM TỰ ĐỘNG CHUYỂN FOCUS XUỐNG DÒNG BÊN DƯỚI
  const focusCell = (targetRowIndex: number, fieldName?: string) => {
    setTimeout(() => {
      if (fieldName) {
        const fieldSelector = `[data-grid-row="${targetRowIndex}"][data-grid-col="${fieldName}"]`;
        const element = document.querySelector<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>(fieldSelector);
        if (element) {
          element.focus();
          if ('select' in element && typeof element.select === 'function') {
            element.select();
          }
          return;
        }
      }
      // Fallback: focus first input in target row
      const rowInputs = document.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>(
        `[data-grid-row="${targetRowIndex}"]`
      );
      if (rowInputs.length > 0) {
        rowInputs[0].focus();
        if ('select' in rowInputs[0] && typeof rowInputs[0].select === 'function') {
          rowInputs[0].select();
        }
      }
    }, 80);
  };

  // XỬ LÝ NHẬP MÃ (ENTER HOẶC BLUR XÁC NHẬN MÃ VẬT TƯ)
  const handleLookupCodeSubmit = async (rowIndex: number, col: VoucherColumnConfig, codeValue: string, row: T) => {
    if (readOnly) return;
    const trimmedCode = (codeValue || '').trim();

    if (!trimmedCode) {
      // Bấm Enter khi ô trống -> Bật Popup Tra Cứu để người dùng chọn
      onLookupClick?.(rowIndex, col, row);
      return;
    }

    if (onCodeSubmit) {
      const isFound = await onCodeSubmit(rowIndex, col.field, trimmedCode, row);
      if (isFound) {
        const nextRowIndex = rowIndex + 1;
        // Mã hợp lệ trong DB -> Nếu ở dòng cuối cùng thì tự động thêm dòng mới
        if (rowIndex === data.length - 1 && gridConfig.allowAddRow !== false) {
          handleAddRow();
        }
        // Focus xuống ô nhập liệu ở dòng bên dưới
        focusCell(nextRowIndex, col.field);
      } else {
        // Mã KHÔNG tồn tại trong DB -> Tự động bật Popup Tra Cứu để người dùng chọn
        onLookupClick?.(rowIndex, col, row);
      }
    }
  };

  // CẬP NHẬT GIÁ TRỊ Ô TRONG LÚC ĐANG NHẬP (Chỉ cập nhật giá trị hiển thị)
  const handleCellChange = async (rowIndex: number, field: string, newValue: any) => {
    if (readOnly) return;

    const currentRow = data[rowIndex];
    if (!currentRow) return;

    const oldValue = currentRow[field];

    if (beforeEdit) {
      const canEdit = await beforeEdit(rowIndex, field, oldValue, newValue, currentRow);
      if (canEdit === false) return; // Hủy thay đổi ô
    }

    const updatedData = [...data];
    updatedData[rowIndex] = { ...updatedData[rowIndex], [field]: newValue };
    onChange(updatedData);
  };

  // KẾT THÚC SỬA Ô (BLUR / ENTER) -> THỰC HIỆN TÍNH TOÁN CÁC CHỈ SỐ BỔ SUNG VÀ KÍCH HOẠT AFTEREDIT
  const handleCellCommit = async (rowIndex: number, field: string, commitValue?: any) => {
    if (readOnly) return;

    const currentRow = data[rowIndex];
    if (!currentRow) return;

    const finalVal = commitValue !== undefined ? commitValue : currentRow[field];
    const oldValue = currentRow[field];

    const updatedData = [...data];
    const updatedRow = { ...updatedData[rowIndex], [field]: finalVal };

    // Tự động tính toán Thành tiền mặc định nếu thay đổi Số lượng hoặc Đơn giá
    if (field === 'quantity' || field === 'unitPrice' || field === 'actualQuantity') {
      const qty = parseFloat((updatedRow as any).quantity ?? (updatedRow as any).actualQuantity ?? 0) || 0;
      const price = parseFloat((updatedRow as any).unitPrice ?? 0) || 0;
      const calcTotal = Math.round(qty * price);
      (updatedRow as any).amount = calcTotal;
      (updatedRow as any).totalPrice = calcTotal;
    }

    updatedData[rowIndex] = updatedRow;
    onChange(updatedData);

    // Kích hoạt sự kiện AfterEdit sau khi sửa ô hoàn tất
    afterEdit?.(rowIndex, field, oldValue, finalVal, updatedRow, updatedData);
  };

  // Tính tổng cho cột summary ở footer
  const calculateColumnSummary = (col: VoucherColumnConfig) => {
    if (!col.summary || col.summary === 'none') return null;

    if (col.summary === 'count') {
      return data.length;
    }

    const total = data.reduce((sum, item) => {
      const val = parseFloat(item[col.field]) || 0;
      return sum + val;
    }, 0);

    if (col.summaryFormat === 'currency') {
      return currencyCode === 'VND' 
        ? formatCurrency(total) 
        : `${formatNumber(total, col.decimals || 2)} ${currencyCode}`;
    }

    return formatNumber(total, col.decimals ?? (col.type === 'quantity' ? 3 : 2));
  };

  return (
    <div className={`flex flex-col w-full text-xs ${className}`}>
      
      {/* Table Container Scrollable - Fixed Layout Height */}
      <div 
        className="overflow-x-auto overflow-y-auto border border-slate-300 dark:border-slate-700 rounded-xl custom-scrollbar shadow-xs bg-white dark:bg-slate-900"
        style={{ height: maxHeight || '250px', maxHeight: maxHeight || '250px' }}
      >
        <table className="w-full min-h-full text-left border-collapse text-xs min-w-[700px]">
          
          {/* Dynamic Table Header from sys_voucher_grid Metadata */}
          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800/95 backdrop-blur-xs text-slate-700 dark:text-slate-200 font-bold border-b-2 border-slate-300 dark:border-slate-700 z-10 shadow-xs">
            <tr className="text-[10px] uppercase tracking-wider divide-x divide-slate-200 dark:divide-slate-700">
              
              {/* Index Column */}
              <th className="py-2 px-1.5 w-8 text-center bg-slate-200/60 dark:bg-slate-800">
                #
              </th>

              {/* Dynamic Columns from sys_voucher_grid */}
              {gridConfig.columns.map((col) => {
                let headerTitle = col.headerName;
                if (col.field === 'unitPrice' && currencyCode) {
                  headerTitle = `${col.headerName} (${currencyCode})`;
                }

                return (
                  <th
                    key={col.field}
                    style={{ 
                      width: col.width ? (typeof col.width === 'number' ? `${col.width}px` : col.width) : undefined,
                      minWidth: col.minWidth ? (typeof col.minWidth === 'number' ? `${col.minWidth}px` : col.minWidth) : undefined 
                    }}
                    className={`py-2 px-2 font-extrabold ${
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    <span className="truncate block">
                      {headerTitle}
                      {col.required && <span className="text-rose-500 ml-0.5">*</span>}
                    </span>
                  </th>
                );
              })}

              {/* Action Column */}
              {!readOnly && (
                <th className="py-2 px-1.5 w-9 text-center">
                  {t('controls.voucherGrid.delete')}
                </th>
              )}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {data.length === 0 ? (
              <tr style={{ height: '100%' }}>
                <td 
                  colSpan={gridConfig.columns.length + (readOnly ? 1 : 2)} 
                  className="py-6 text-center text-slate-400 italic font-medium"
                >
                  {t('controls.voucherGrid.empty')}
                </td>
              </tr>
            ) : (
              <>
                {data.map((row, rowIndex) => (
                  <tr 
                    key={rowIndex} 
                    onClick={() => onRowClick?.(rowIndex, row)}
                    className="hover:bg-indigo-50/30 dark:hover:bg-slate-800/50 divide-x divide-slate-200 dark:divide-slate-800 transition-colors cursor-pointer"
                  >
                    {/* Row Index */}
                    <td className="py-1 px-1 text-center font-bold text-slate-400 text-[10px] bg-slate-50/50 dark:bg-slate-800/30">
                      {rowIndex + 1}
                    </td>

                    {/* Render Cells dynamically based on Column Type */}
                    {gridConfig.columns.map((col) => {
                      const value = row[col.field];
                      const isReadOnlyCol = readOnly || col.readOnly;

                      return (
                        <td 
                          key={col.field} 
                          onClick={() => onCellClick?.(rowIndex, col.field, value, row)}
                          onFocus={() => onCellFocus?.(rowIndex, col.field, row)}
                          className={`py-1 px-1.5 ${
                            col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                          }`}
                        >
                          {/* 1. TYPE: LOOKUP (Input Code + F2 Search Button) */}
                          {col.type === 'lookup' && (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                data-grid-row={rowIndex}
                                data-grid-col={col.field}
                                disabled={isReadOnlyCol}
                                placeholder={col.placeholder || t('controls.voucherGrid.codePlaceholder')}
                                value={value ?? ''}
                                onChange={(e) => handleCellChange(rowIndex, col.field, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'F2') {
                                    e.preventDefault();
                                    onLookupClick?.(rowIndex, col, row);
                                  } else if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleLookupCodeSubmit(rowIndex, col, e.currentTarget.value, row);
                                  }
                                }}
                                onBlur={(e) => {
                                  if (e.target.value && e.target.value.trim()) {
                                    handleLookupCodeSubmit(rowIndex, col, e.target.value, row);
                                  }
                                }}
                                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[11px] focus:ring-1 focus:ring-indigo-500 uppercase h-[24px]"
                              />
                              {!isReadOnlyCol && onLookupClick && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onLookupClick(rowIndex, col, row);
                                  }}
                                  className="p-0.5 bg-indigo-50 dark:bg-indigo-950 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 rounded border border-indigo-200 dark:border-indigo-800 transition-colors shrink-0 cursor-pointer h-[24px] w-[24px] flex items-center justify-center !px-0"
                                  title={t('controls.voucherGrid.lookup')}
                                >
                                  <Search className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          )}

                          {/* 2. TYPE: TEXT (Excludes field 'unit') */}
                          {col.type === 'text' && col.field !== 'unit' && (
                            isReadOnlyCol ? (
                              <span className="font-medium text-slate-800 dark:text-slate-200 text-[11px] px-1 block truncate">
                                {value || '—'}
                              </span>
                            ) : (
                              <input
                                type="text"
                                data-grid-row={rowIndex}
                                data-grid-col={col.field}
                                placeholder={col.placeholder || ''}
                                value={value ?? ''}
                                onChange={(e) => handleCellChange(rowIndex, col.field, e.target.value)}
                                onBlur={(e) => handleCellCommit(rowIndex, col.field, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCellCommit(rowIndex, col.field, e.currentTarget.value);
                                    const nextRowIndex = rowIndex + 1;
                                    if (rowIndex === data.length - 1 && gridConfig.allowAddRow !== false) {
                                      if (row.productId || row.sku || row.productName || row.itemCode) {
                                        handleAddRow();
                                      }
                                    }
                                    focusCell(nextRowIndex, col.field);
                                  }
                                }}
                                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 font-medium text-slate-800 dark:text-slate-100 text-[11px] focus:ring-1 focus:ring-indigo-500 h-[24px]"
                              />
                            )
                          )}

                          {/* 2.5 TYPE: UOM / ĐVT (Defaulted from DMVT & Selectable from UOM List) */}
                          {(col.type === 'uom' || col.field === 'unit') && (
                            isReadOnlyCol ? (
                              <span className="font-semibold text-slate-800 dark:text-slate-200 text-[11px] block text-center truncate">
                                {value || '—'}
                              </span>
                            ) : (
                              <select
                                data-grid-row={rowIndex}
                                data-grid-col={col.field}
                                value={value || ''}
                                onChange={(e) => {
                                  handleCellChange(rowIndex, col.field, e.target.value);
                                  handleCellCommit(rowIndex, col.field, e.target.value);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCellCommit(rowIndex, col.field, e.currentTarget.value);
                                    const nextRowIndex = rowIndex + 1;
                                    if (rowIndex === data.length - 1 && gridConfig.allowAddRow !== false) {
                                      handleAddRow();
                                    }
                                    focusCell(nextRowIndex, col.field);
                                  }
                                }}
                                className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 rounded px-1 py-0.5 font-bold text-slate-800 dark:text-slate-100 text-[11px] text-center focus:ring-1 focus:ring-indigo-500 h-[24px] cursor-pointer"
                              >
                                {!value && <option value="">{t('controls.voucherGrid.uom')}</option>}
                                {value && !STANDARD_UOMS.includes(value) && (
                                  <option key={value} value={value}>{value}</option>
                                )}
                                {STANDARD_UOMS.map((u) => (
                                  <option key={u} value={u}>{u}</option>
                                ))}
                              </select>
                            )
                          )}

                          {/* 3. TYPE: QUANTITY (Numeric input custom control without suffix - calculates after edit) */}
                          {col.type === 'quantity' && (
                            isReadOnlyCol ? (
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-100 text-[11.5px]">
                                {formatNumber(parseFloat(value) || 0, col.decimals ?? 3)}
                              </span>
                            ) : (
                              <QuantityInput
                                value={parseFloat(value) || 0}
                                onChange={(val) => handleCellChange(rowIndex, col.field, val)}
                                onBlur={() => handleCellCommit(rowIndex, col.field)}
                                step={0.001}
                                min={0}
                                showStepper={false}
                                unit=""
                                dataGridRow={rowIndex}
                                dataGridCol={col.field}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCellCommit(rowIndex, col.field);
                                    const nextRowIndex = rowIndex + 1;
                                    if (rowIndex === data.length - 1 && gridConfig.allowAddRow !== false) {
                                      handleAddRow();
                                    }
                                    focusCell(nextRowIndex, col.field);
                                  }
                                }}
                              />
                            )
                          )}

                          {/* 4. TYPE: CURRENCY */}
                          {col.type === 'currency' && (
                            isReadOnlyCol ? (
                              <span className="font-mono font-extrabold text-indigo-600 dark:text-indigo-400 text-[11.5px]">
                                {currencyCode === 'VND' 
                                  ? formatCurrency(parseFloat(value) || 0)
                                  : formatNumber(parseFloat(value) || 0, col.decimals ?? 2)}
                              </span>
                            ) : (
                              <NumberInput
                                value={parseFloat(value) || 0}
                                onChange={(val) => handleCellChange(rowIndex, col.field, val)}
                                onBlur={() => handleCellCommit(rowIndex, col.field)}
                                min={0}
                                decimals={col.decimals ?? 0}
                                dataGridRow={rowIndex}
                                dataGridCol={col.field}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCellCommit(rowIndex, col.field);
                                    const nextRowIndex = rowIndex + 1;
                                    if (rowIndex === data.length - 1 && gridConfig.allowAddRow !== false) {
                                      handleAddRow();
                                    }
                                    focusCell(nextRowIndex, col.field);
                                  }
                                }}
                              />
                            )
                          )}

                          {/* 5. TYPE: NUMBER */}
                          {col.type === 'number' && (
                            isReadOnlyCol ? (
                              <span className="font-mono font-bold text-slate-800 dark:text-slate-100 text-[11px]">
                                {formatNumber(parseFloat(value) || 0, col.decimals ?? 2)}
                              </span>
                            ) : (
                              <NumberInput
                                value={parseFloat(value) || 0}
                                onChange={(val) => handleCellChange(rowIndex, col.field, val)}
                                onBlur={() => handleCellCommit(rowIndex, col.field)}
                                decimals={col.decimals ?? 2}
                                dataGridRow={rowIndex}
                                dataGridCol={col.field}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleCellCommit(rowIndex, col.field);
                                    const nextRowIndex = rowIndex + 1;
                                    if (rowIndex === data.length - 1 && gridConfig.allowAddRow !== false) {
                                      handleAddRow();
                                    }
                                    focusCell(nextRowIndex, col.field);
                                  }
                                }}
                              />
                            )
                          )}

                          {/* 6. TYPE: SELECT */}
                          {col.type === 'select' && (
                            isReadOnlyCol ? (
                              <span className="font-medium text-slate-800 dark:text-slate-200 text-[11px]">
                                {col.selectOptions?.find(o => o.value === value)?.label || value || '—'}
                              </span>
                            ) : (
                              <ComboBox
                                options={col.selectOptions || []}
                                value={value ?? ''}
                                onChange={(val) => handleCellChange(rowIndex, col.field, val)}
                                clearable={false}
                                searchable={false}
                                compact={true}
                              />
                            )
                          )}

                          {/* 7. TYPE: DATE */}
                          {col.type === 'date' && (
                            isReadOnlyCol ? (
                              <span className="font-medium text-slate-800 dark:text-slate-200 text-[11px]">
                                {value || '—'}
                              </span>
                            ) : (
                              <DateTimePicker
                                type="date"
                                value={value ?? ''}
                                onChange={(val) => handleCellChange(rowIndex, col.field, val)}
                                compact={true}
                              />
                            )
                          )}

                          {/* 8. TYPE: CHECKBOX */}
                          {col.type === 'checkbox' && (
                            <div className="flex justify-center items-center">
                              <input
                                type="checkbox"
                                disabled={isReadOnlyCol}
                                checked={!!value}
                                onChange={(e) => handleCellChange(rowIndex, col.field, e.target.checked)}
                                className="h-3.5 w-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                              />
                            </div>
                          )}

                          {/* 9. TYPE: READONLY CELL */}
                          {col.type === 'readonly' && (
                            <span className="font-mono font-bold text-slate-700 dark:text-slate-300 text-[11px] px-1 block truncate">
                              {value || '—'}
                            </span>
                          )}
                        </td>
                      );
                    })}

                    {/* Delete Button Cell */}
                    {!readOnly && (
                      <td className="py-1 px-1 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRow(rowIndex);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors cursor-pointer inline-flex items-center justify-center !px-0 !py-0 h-6 w-6"
                          title={t('controls.voucherGrid.deleteRow')}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                {/* Empty spacer row to absorb remaining vertical space and push tfoot to the bottom without stretching data rows */}
                <tr style={{ height: '100%' }}>
                  <td 
                    colSpan={gridConfig.columns.length + (readOnly ? 1 : 2)} 
                    className="p-0 border-0 pointer-events-none" 
                  />
                </tr>
              </>
            )}
          </tbody>

          {/* Dynamic Table Summary Footer */}
          <tfoot className="sticky bottom-0 bg-slate-100 dark:bg-slate-800/95 backdrop-blur-xs border-t-2 border-slate-300 dark:border-slate-700 font-extrabold text-[11px] text-slate-800 dark:text-slate-100 z-10 shadow-xs">
            <tr className="divide-x divide-slate-200 dark:divide-slate-700">
              <td className="py-1.5 px-1.5 text-center bg-slate-200/80 dark:bg-slate-700/80">
                ∑
              </td>

              {gridConfig.columns.map((col, idx) => {
                const summaryVal = calculateColumnSummary(col);

                return (
                  <td 
                    key={col.field}
                    className={`py-1.5 px-2 font-mono font-black ${
                      col.align === 'right' ? 'text-right text-indigo-600 dark:text-indigo-400' : col.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  >
                    {idx === 0 && !col.summary ? (
                      <span className="text-slate-600 dark:text-slate-400 font-sans font-extrabold uppercase text-[10px]">
                        {t('controls.voucherGrid.total', { n: data.length })}
                      </span>
                    ) : (
                      summaryVal !== null ? summaryVal : ''
                    )}
                  </td>
                );
              })}

              {!readOnly && <td className="py-1.5 px-1.5"></td>}
            </tr>
          </tfoot>

        </table>
      </div>

      {/* Grid Toolbar Footer */}
      {!readOnly && (
        <div className="flex items-center justify-between pt-1.5 px-1 gap-2">
          <div className="text-[10px] text-slate-500 font-semibold flex items-center gap-2">
            <span>{interpolate(t('controls.voucherGrid.tip'), { f2: <kbd className="bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded text-indigo-600 dark:text-indigo-300 font-mono text-[9px]">F2</kbd> })}</span>
          </div>
          {showAddButton && gridConfig.allowAddRow !== false && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRow}
              icon={<Plus className="h-3.5 w-3.5" />}
              className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/80 hover:bg-indigo-100 dark:hover:bg-indigo-900 border-indigo-200 dark:border-indigo-800 py-1 px-2.5"
            >
              {t('controls.voucherGrid.addRow')}
            </Button>
          )}
        </div>
      )}

    </div>
  );
}

