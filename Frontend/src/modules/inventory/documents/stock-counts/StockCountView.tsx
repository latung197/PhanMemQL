// Phiếu kiểm kê (inv_audit_count): the stock of one warehouse at a date counted against the book stock of the stock ledger.
// Same layout, statuses and approval as the goods issue; it posts to the ledger (surplus comes in, shortage goes out, at the moving
// average cost). The user types only what was counted: "Lấy tồn sổ sách" fills the lines from the ledger, and the server works the
// book stock and the differences out again at every save and when posting, so a count never carries a figure the ledger does not hold.
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  ClipboardCheck,
  ArrowUpRight,
  CheckCircle2,
  ShieldCheck,
  Edit3,
  Trash2,
  Building2,
  Package,
  Users,
  Search,
  Save,
  Undo2,
  XCircle,
  FileText,
  RotateCcw,
  ListChecks,
  ScanLine } from 'lucide-react';
import { Button } from '../../../../components/common/Button';
import { RowActionSlot } from '../../../../components/common/RowActionSlot';
import { Modal } from '../../../../components/common/Modal';
import { CategoryHeaderToolbar } from '../../../../components/common/CategoryHeaderToolbar';
import { DeleteConfirmModal } from '../../../../components/common/DeleteConfirmModal';
import { GridView, GridViewColumn } from '../../../../components/common/GridView';
import { MasterLookupModal, ColumnDef } from '../../../../components/common/MasterLookupModal';
import { DateTimePicker, VoucherDetailGrid } from '../../../../components/common';
import { Badge } from '../../../../components/common/Badge';
import { useConfirm } from '../../../../components/common/ConfirmDialog';
import { stockCountItemsGridConfig } from '../../../../mock/voucherGridConfigs';
import { useNumberFormat } from '../../../../context/NumberFormatContext';
import { systemSettingsService } from '../../../../services/systemSettingsService';
import { PrintMenuButton } from '../PrintMenuButton';
import { printStockCount } from '../voucherPrint';
import { GoodsVoucher, VoucherItem, Product, Warehouse as WarehouseType, CompanyUnit, UserProfile } from '../../../../types';
import { SAVE_STATUS_LABELS, saveStatusChoices, saveStatusName, type SaveStatus } from '../SaveStatusSelect';
import { VoucherStatusBadge } from '../VoucherStatusBadge';
import { useVoucherStatuses, voucherStatusService } from '../../../../services/voucherStatusService';
import { reachesStatus } from '../../../../utils/documentPolicy';
import { getActionPermission } from '../../../../mock/initialRoles';
import { canApproveVoucher, hasRight, hasStatusRight, RIGHTS } from '../../../../utils/permissions';
import { useOpenDocumentRequest } from '../../../../utils/documentLinks';
import { useDebounced } from '../../../../hooks/useDebounced';
import { usePagedList } from '../../../../hooks/usePagedList';
import type { PagedQuery } from '../../../../services/paging';
import { showToast } from '../../../../utils/toast';
import { getErrorMessage } from '../../../../services/apiClient';
import { loadMaterialOptions } from '../../../../services/lookupOptions';
import { voucherNumberingApi } from '../../../../services/settingsApi';
import { parseStockLabel } from '../../../../utils/stockLabel';
import { stockCountsApi } from './api';

const FUNCTION = 'inv_audit_count';

// Shared look of the header fields of a voucher form (same as the goods receipt and goods issue).
const VOUCHER_LABEL = 'block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5 truncate';
const VOUCHER_INPUT = 'w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 font-medium text-[11px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[26px]';
const VOUCHER_LOOKUP_BUTTON = 'px-1.5 h-[26px] bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs';

interface StockCountViewProps {
  companyUnits?: CompanyUnit[];
  activeUnitCode: string;
  currentUser?: UserProfile;
}

const today = () => new Date().toISOString().split('T')[0];
const emptyItem = (): VoucherItem => ({ productId: '', productName: '', sku: '', unit: '', quantity: 0, unitPrice: 0, totalPrice: 0, amount: 0, note: '', lotNumber: '', position: '', bookQuantity: 0, diffQuantity: 0 });
const hasMaterial = (item: VoucherItem) => Boolean(item.productId || item.sku || item.productName);

/** Difference = counted - book; its value is at the cost of the line (the server does the same sum). */
const withDiff = (item: VoucherItem): VoucherItem => {
  const diff = (Number(item.quantity) || 0) - (Number(item.bookQuantity) || 0);
  const amount = Math.round(diff * (Number(item.unitPrice) || 0));
  return { ...item, diffQuantity: diff, amount, totalPrice: amount };
};

/** A line is told apart by material, lot and location (the same key the server uses). */
const lineKey = (item: { sku?: string; productId?: string; lotNumber?: string | null; position?: string | null }) =>
  `${(item.sku || item.productId || '').toUpperCase()}|${(item.lotNumber || '').toUpperCase()}|${(item.position || '').toUpperCase()}`;

/** The status filter of the form holds the labels the screens keep; the server filters by the status name. */
const STATUS_OF_LABEL: Record<string, string> = {
  'Lập chứng từ': 'Draft', 'Chờ duyệt': 'Pending', 'Đã phê duyệt': 'Approved', 'Chuyển sổ kho': 'Posted', 'Hủy': 'Cancelled'
};

export const StockCountView: React.FC<StockCountViewProps> = ({ companyUnits = [], activeUnitCode, currentUser }) => {
  const [localVouchers, setLocalVouchers] = useState<GoodsVoucher[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [materialGroups, setMaterialGroups] = useState<{ code: string; name: string }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  // The status the form saves at: Draft, or further when the user's rights reach it (the server runs the steps and checks them).
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('Draft');
  // Set by the "Lưu Nháp" button: that save is a draft whatever the Trạng thái field holds.
  const saveAsDraftRef = useRef(false);

  // loadData also refreshes the list; the paging block below fills this in.
  const reloadListRef = useRef<() => void>(() => {});

  const loadData = async () => {
    try {
      const [options, materials] = await Promise.all([stockCountsApi.getOptions(), loadMaterialOptions()]);
      reloadListRef.current();
      setProducts(materials);
      setMaterialGroups(options.materialGroups);
      setWarehouses(options.warehouses.map(w => ({
        id: w.code, code: w.code, name: w.name, address: '', manager: '', capacity: '', status: 'Đang hoạt động' as const
      })));
    } catch (error) {
      showToast.error(getErrorMessage(error));
    }
  };

  useEffect(() => { void loadData(); }, [activeUnitCode]);

  // Filter & search
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Selection for bulk delete
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [itemToDelete, setItemToDelete] = useState<GoodsVoucher | null>(null);
  const [bulkToDeleteIds, setBulkToDeleteIds] = useState<string[] | null>(null);

  // Form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);
  const [formCompanyUnitName, setFormCompanyUnitName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDate, setFormDate] = useState(today());
  const [formCreatedDate, setFormCreatedDate] = useState(today());
  const [formStatus, setFormStatus] = useState<string>('Lập chứng từ');
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formWarehouseName, setFormWarehouseName] = useState('');
  const [formCounterName, setFormCounterName] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formCreatedBy, setFormCreatedBy] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formItems, setFormItems] = useState<VoucherItem[]>([]);

  // Pickers
  const [isMaterialLookupOpen, setIsMaterialLookupOpen] = useState(false);
  const [isWarehouseLookupOpen, setIsWarehouseLookupOpen] = useState(false);
  const [lookupTargetRowIndex, setLookupTargetRowIndex] = useState<number | null>(null);

  // Scanning stock labels (a handheld scanner types the code and Enter into the box): the first scan of a line in a count sets its counted
  // quantity, the next ones add to it; lines never scanned keep what they have until "Đặt 0 cho dòng chưa quét".
  const [scanText, setScanText] = useState('');
  const [scanQty, setScanQty] = useState(1);
  const [scanLog, setScanLog] = useState<{ ok: boolean; text: string } | null>(null);
  const scannedRef = useRef<Set<string>>(new Set());
  const [scannedCount, setScannedCount] = useState(0);

  // "Lấy tồn sổ sách"
  const [isBookOpen, setIsBookOpen] = useState(false);
  const [bookGroup, setBookGroup] = useState('');
  const [bookCycleOnly, setBookCycleOnly] = useState(false);
  const [bookIncludeZero, setBookIncludeZero] = useState(false);
  const [bookLoading, setBookLoading] = useState(false);

  useVoucherStatuses();
  const perm = getActionPermission(currentUser, FUNCTION);
  // "Duyệt" on the voucher or on its approval screen (Phê duyệt kiểm kê), as the backend.
  const canApprove = canApproveVoucher(currentUser, FUNCTION);
  // The values of a count are costs (cost of the stock found in surplus or missing).
  const canViewCost = hasRight(currentUser, FUNCTION, RIGHTS.VIEW_COST);
  const hiddenCostFields = canViewCost ? undefined : ['unitPrice', 'amount'];
  const statusChoices = saveStatusChoices(currentUser, FUNCTION, { voucherType: 'PKK', posts: true });
  const approvalInUse = voucherStatusService.isEnabled('PKK', 'Pending');
  const canSaveForm = !editingVoucherId ? perm.create : perm.edit && formStatus === 'Lập chứng từ';
  const canChooseStatus = canSaveForm && statusChoices.length > 1;
  const statusFromLabel = (label: string): SaveStatus =>
    (Object.keys(SAVE_STATUS_LABELS) as SaveStatus[]).find(key => SAVE_STATUS_LABELS[key] === label) ?? 'Draft';
  const shownStatus = canChooseStatus ? SAVE_STATUS_LABELS[saveStatus] : formStatus;

  const activeFilterCount = useMemo(() => [codeFilter.trim(), statusFilter, warehouseFilter, fromDate, toDate]
    .filter(Boolean).length, [codeFilter, statusFilter, warehouseFilter, fromDate, toDate]);

  // ---- The list: the server filters, sorts and cuts the pages (backend VoucherListQuery, services/paging.ts) ------------------
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const debouncedSearch = useDebounced(searchText, 300);
  const debouncedCode = useDebounced(codeFilter, 300);
  const listFilters = useMemo(() => ({
    status: STATUS_OF_LABEL[statusFilter] ?? '', warehouse: warehouseFilter, code: debouncedCode.trim(), from: fromDate, to: toDate
  }), [statusFilter, warehouseFilter, debouncedCode, fromDate, toDate]);
  const filterKey = `${JSON.stringify(listFilters)}|${debouncedSearch}|${sort ? `${sort.key}:${sort.dir}` : ''}|${pageSize}|${activeUnitCode}`;
  // A new search, filter, sort or page size starts again at the first page.
  useEffect(() => { setPage(1); }, [filterKey]);
  const listQuery = useMemo<PagedQuery>(() => ({
    page, pageSize, sort: sort?.key, dir: sort?.dir, search: debouncedSearch, filters: listFilters
  }), [page, pageSize, sort, debouncedSearch, listFilters]);
  const fetchPage = useCallback((query: PagedQuery) => stockCountsApi.getPage(query), []);
  const { items: pageItems, total: totalVouchers, loading: listLoading, error: listError, reload: reloadList } = usePagedList(fetchPage, listQuery);
  reloadListRef.current = reloadList;
  useEffect(() => { setLocalVouchers(pageItems); }, [pageItems]);
  useEffect(() => { if (listError) showToast.error(listError); }, [listError]);

  const { formatQuantity, formatUnitPrice, formatNumber } = useNumberFormat();
  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);

  const handleClearFilter = () => {
    setCodeFilter(''); setStatusFilter(''); setWarehouseFilter(''); setFromDate(''); setToDate(''); setSearchText('');
    showToast.info('Đã xóa tất cả bộ lọc!');
  };

  // ---------------------------------------------------------------------------------------------- open the form
  const handleOpenAdd = async () => {
    if (!perm.create) { showToast.error('Tài khoản của bạn không có quyền lập phiếu kiểm kê mới!'); return; }
    if (warehouses.length === 0) { showToast.error('Cần khai báo kho đang hoạt động trước khi lập phiếu kiểm kê.'); return; }
    const defaultUnit = companyUnits.find(c => c.code === activeUnitCode) || companyUnits[0];
    const defaultWh = warehouses[0];
    let newCode = 'Số tự động';
    try { newCode = await voucherNumberingApi.preview('PKK'); }
    catch (error) { showToast.error(getErrorMessage(error)); return; }

    setEditingVoucherId(null);
    setFormCompanyUnitName(defaultUnit?.name || activeUnitCode);
    setFormCode(newCode);
    setFormDate(today());
    setFormCreatedDate(today());
    setFormStatus('Lập chứng từ');
    setFormWarehouseId(defaultWh.id);
    setFormWarehouseName(defaultWh.name);
    setFormCounterName('');
    setFormReason('');
    setFormCreatedBy(currentUser?.fullName || '');
    setFormNote('');
    setFormItems([emptyItem()]);
    setSaveStatus('Draft');
    scannedRef.current = new Set(); setScannedCount(0); setScanLog(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (voucher: GoodsVoucher) => {
    setEditingVoucherId(voucher.id);
    setFormCompanyUnitName(voucher.companyUnitName || activeUnitCode);
    setFormCode(voucher.code);
    setFormDate(voucher.date || today());
    setFormCreatedDate(voucher.createdDate || voucher.date || today());
    setFormStatus(voucher.status || 'Lập chứng từ');
    setFormWarehouseId(voucher.warehouseId);
    setFormWarehouseName(voucher.warehouseName);
    setFormCounterName(voucher.counterName || '');
    setFormReason(voucher.countReason || '');
    setFormCreatedBy(voucher.createdBy || '');
    setFormNote(voucher.note || '');
    setFormItems([...(voucher.items ?? []).map(it => ({ ...it, productId: it.productId || '', sku: it.sku || '', unit: it.unit || '' })), emptyItem()]);
    setSaveStatus('Draft');
    scannedRef.current = new Set(); setScannedCount(0); setScanLog(null);
    setIsModalOpen(true);
  };

  // Opened from a notification (e.g. "Chờ duyệt: {mã phiếu}"): show that voucher.
  useOpenDocumentRequest(FUNCTION, (documentId) => {
    const voucher = localVouchers.find(v => v.code === documentId || v.id === documentId);
    if (voucher) { handleOpenEdit(voucher); return; }
    // Not on the page shown: ask the server for the voucher with that code.
    void stockCountsApi.getPage({ page: 1, pageSize: 1, filters: { code: documentId } }).then(result => {
      const found = result.items.find(v => v.code === documentId);
      if (found) handleOpenEdit(found);
      else showToast.warning(`Không tìm thấy phiếu kiểm kê ${documentId}.`, 'Phiếu có thể đã bị xóa hoặc thuộc đơn vị khác.');
    }).catch(error => showToast.error(getErrorMessage(error)));
  });

  // The Excel file is made by the server from every row the filters leave (not only this page).
  const handleExportExcel = async () => {
    if (!perm.export) {
      showToast.error('Tài khoản của bạn không có quyền Xuất Excel!');
      return;
    }
    try { await stockCountsApi.exportAll(listQuery); }
    catch (error) { showToast.error(getErrorMessage(error)); }
  };

  // ---------------------------------------------------------------------------------------------- book stock
  /**
   * Fills the lines from the stock ledger at the counting date. The counted quantity starts equal to the book stock (so only the
   * lines that differ need typing); a line already typed for the same material / lot / location keeps its counted quantity, and
   * lines typed by hand that the ledger does not list (a new lot, a material without stock) stay.
   */
  const handleLoadBookStock = async () => {
    if (!formWarehouseId) { showToast.error('Chọn kho kiểm kê trước.'); return; }
    setBookLoading(true);
    try {
      const rows = await stockCountsApi.getBookStock({
        warehouseCode: formWarehouseId, date: formDate, group: bookGroup || undefined, cycleOnly: bookCycleOnly, includeZero: bookIncludeZero
      });
      if (rows.length === 0) { showToast.info('Kho không có tồn nào theo bộ lọc này tại ngày kiểm kê.'); return; }
      const typed = new Map(formItems.filter(hasMaterial).map(item => [lineKey(item), item]));
      const fromLedger = rows.map(row => {
        const old = typed.get(lineKey({ sku: row.materialCode, lotNumber: row.lotNumber, position: row.position }));
        return withDiff({
          productId: row.materialCode, sku: row.materialCode, productName: row.materialName, unit: row.uomCode,
          lotNumber: row.lotNumber ?? '', position: row.position ?? '', bookQuantity: row.bookQuantity,
          quantity: old ? old.quantity : row.bookQuantity, unitPrice: row.unitCost, note: old?.note ?? ''
        });
      });
      const listed = new Set(rows.map(row => lineKey({ sku: row.materialCode, lotNumber: row.lotNumber, position: row.position })));
      const extra = formItems.filter(hasMaterial).filter(item => !listed.has(lineKey(item)));
      setFormItems([...fromLedger, ...extra, emptyItem()]);
      setIsBookOpen(false);
      showToast.success(`Đã lấy ${rows.length} dòng tồn sổ sách tại ngày ${formDate}. Sửa số lượng ở những dòng kiểm kê lệch.`);
    } catch (error) {
      showToast.error(getErrorMessage(error));
    } finally {
      setBookLoading(false);
    }
  };

  // ---------------------------------------------------------------------------------------------- scanning
  const beep = (good: boolean) => {
    try {
      const audio = new AudioContext();
      const oscillator = audio.createOscillator();
      oscillator.frequency.value = good ? 880 : 220;
      oscillator.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + (good ? 0.08 : 0.3));
      oscillator.onended = () => { void audio.close(); };
    } catch { /* a sound is only a hint */ }
  };

  /** One scanned label (MATERIAL#LOT#LOCATION): finds the line of that material / lot / location, or adds one. */
  const handleScan = () => {
    const parsed = parseStockLabel(scanText);
    setScanText('');
    if (!parsed) return;
    const product = products.find(p => (p.sku || p.id || '').toUpperCase() === parsed.material);
    if (!product) { beep(false); setScanLog({ ok: false, text: `Mã ${parsed.material} không có trong danh mục vật tư.` }); return; }
    const sku = product.sku || product.id;
    const key = lineKey({ sku, lotNumber: parsed.lot, position: parsed.position });
    const qty = scanQty > 0 ? scanQty : 1;
    const first = !scannedRef.current.has(key);
    scannedRef.current.add(key);
    setScannedCount(scannedRef.current.size);
    // The line of the label: the same material, lot and location; or a line of the material that still has no lot / location (the label gives them).
    const current = formItems.filter(hasMaterial);
    let index = current.findIndex(item => lineKey(item) === key);
    if (index < 0) index = current.findIndex(item => (item.sku || item.productId) === sku && !item.lotNumber && !item.position && (parsed.lot || parsed.position));
    const counted = index >= 0 ? (first ? qty : (Number(current[index].quantity) || 0) + qty) : qty;
    setFormItems(prev => {
      const lines = prev.filter(hasMaterial);
      if (index >= 0 && lines[index]) {
        lines[index] = withDiff({ ...lines[index], lotNumber: parsed.lot || lines[index].lotNumber, position: parsed.position || lines[index].position, quantity: counted });
      } else {
        lines.push(withDiff({
          productId: product.id, productName: product.name || product.ten_vt || '', sku, unit: product.unit || product.dvt || '',
          lotNumber: parsed.lot, position: parsed.position, bookQuantity: 0, quantity: counted, unitPrice: 0, note: ''
        }));
      }
      return [...lines, emptyItem()];
    });
    beep(true);
    setScanLog({ ok: true, text: `${sku}${parsed.lot ? ` · lô ${parsed.lot}` : ''}${parsed.position ? ` · ${parsed.position}` : ''} → thực tế ${counted}` });
    // A line added by the scan reads its book stock from the ledger (the grid shows it; the server works it out again when saving).
    if (index < 0 && formWarehouseId) {
      void stockCountsApi.getBookStock({ warehouseCode: formWarehouseId, date: formDate, search: sku, includeZero: true }).then(rows => {
        const hit = rows.find(row => row.materialCode === sku && (row.lotNumber ?? '').toUpperCase() === parsed.lot && (row.position ?? '').toUpperCase() === parsed.position);
        // A lot or location the ledger does not hold has no book stock, but the material has an average cost in the warehouse.
        const cost = hit?.unitCost || rows.find(row => row.materialCode === sku && row.unitCost > 0)?.unitCost || 0;
        if (!hit && cost === 0) return;
        setFormItems(prev => prev.map(item => lineKey(item) === key ? withDiff({ ...item, bookQuantity: hit?.bookQuantity ?? 0, unitPrice: cost || item.unitPrice }) : item));
      }).catch(() => { /* the server works the book stock out when the count is saved */ });
    }
  };

  /** Counting by scanning: what was not scanned was not found, so its counted quantity goes to 0. */
  const handleZeroUnscanned = async () => {
    const lines = formItems.filter(hasMaterial);
    const rest = lines.filter(item => !scannedRef.current.has(lineKey(item)) && (Number(item.quantity) || 0) !== 0);
    if (rest.length === 0) { showToast.info('Mọi dòng đã được quét hoặc đã bằng 0.'); return; }
    const ok = await confirm({ title: `Đặt số thực tế = 0 cho ${rest.length} dòng chưa quét?`, message: 'Dòng nào chưa quét tem coi như không tìm thấy hàng; chênh lệch sẽ là thiếu toàn bộ tồn sổ sách của dòng đó.', tone: 'warning', confirmLabel: 'Đặt về 0', cancelLabel: 'Không' });
    if (!ok) return;
    setFormItems(prev => prev.map(item => hasMaterial(item) && !scannedRef.current.has(lineKey(item)) ? withDiff({ ...item, quantity: 0 }) : item));
  };

  // ---------------------------------------------------------------------------------------------- lines
  /** The book stock of a material typed by hand (materials without lots / locations): read from the ledger once it is chosen. */
  const fetchBookForRow = async (index: number, sku: string) => {
    if (!formWarehouseId) return;
    try {
      const rows = await stockCountsApi.getBookStock({ warehouseCode: formWarehouseId, date: formDate, search: sku, includeZero: true });
      const hit = rows.find(row => row.materialCode === sku && !row.lotNumber && !row.position);
      if (!hit) return;
      setFormItems(prev => prev.map((item, i) => i === index && (item.sku || item.productId) === sku
        ? withDiff({ ...item, bookQuantity: hit.bookQuantity, unitPrice: hit.unitCost || item.unitPrice }) : item));
    } catch { /* the server works the book stock out when the count is saved */ }
  };

  const applyProductToRow = (index: number, prod: Product) => {
    const sku = prod.sku || prod.ma_vt || '';
    const unit = prod.unit || prod.dvt || '';
    setFormItems(prev => {
      const updated = [...prev];
      updated[index] = withDiff({
        ...updated[index], productId: prod.id, productName: prod.name || prod.ten_vt || '', sku, unit,
        bookQuantity: 0, quantity: updated[index]?.quantity ?? 0, unitPrice: 0
      });
      // One blank row stays at the end for the next entry.
      if (index === updated.length - 1) updated.push(emptyItem());
      return updated;
    });
    void fetchBookForRow(index, sku);
  };

  const handleCodeSubmit = (rowIndex: number, _field: string, codeValue: string): boolean => {
    const query = (codeValue || '').trim().toLowerCase();
    if (!query) { setLookupTargetRowIndex(rowIndex); setIsMaterialLookupOpen(true); return false; }
    const matched = products.find(p => (p.sku && p.sku.toLowerCase() === query) || (p.id && p.id.toLowerCase() === query) || (p.name && p.name.toLowerCase() === query));
    if (matched) { applyProductToRow(rowIndex, matched); return true; }
    setLookupTargetRowIndex(rowIndex);
    setIsMaterialLookupOpen(true);
    showToast.info(`Mã vật tư "${codeValue}" chưa có trong danh mục. Đã mở cửa sổ tra cứu.`);
    return false;
  };

  const handleConfirmMasterLookup = (selected: Product[]) => {
    if (!selected || selected.length === 0) { setIsMaterialLookupOpen(false); return; }
    if (lookupTargetRowIndex !== null) {
      applyProductToRow(lookupTargetRowIndex, selected[0]);
    } else {
      const added: VoucherItem[] = selected.map(prod => withDiff({
        productId: prod.id, productName: prod.name || prod.ten_vt || '', sku: prod.sku || prod.ma_vt || '', unit: prod.unit || prod.dvt || '',
        quantity: 0, unitPrice: 0, note: '', lotNumber: '', position: '', bookQuantity: 0
      }));
      setFormItems(prev => [...prev.filter(hasMaterial), ...added, emptyItem()]);
      showToast.success(`Đã thêm ${selected.length} vật tư từ danh mục. Nhập số lượng kiểm kê cho từng dòng.`);
    }
    setIsMaterialLookupOpen(false);
    setLookupTargetRowIndex(null);
  };

  const handleConfirmWarehouseLookup = (selectedItems: WarehouseType[]) => {
    const selected = selectedItems[0];
    if (selected) {
      setFormWarehouseId(selected.id);
      setFormWarehouseName(selected.name);
      showToast.success(`Đã chọn kho: ${selected.name}`);
    }
    setIsWarehouseLookupOpen(false);
  };

  const warehouseLookupColumns: ColumnDef<WarehouseType>[] = [
    { key: 'code', label: 'Mã Kho', render: (w) => <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">{w.code || w.id}</span> },
    { key: 'name', label: 'Tên Kho Hàng', render: (w) => <span className="font-extrabold text-slate-800 dark:text-slate-100 text-xs">{w.name}</span> }
  ];

  const productCategoriesFilter = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    return [{ key: 'category', label: 'Loại Vật Tư', options: [{ label: '-- Tất cả loại vật tư --', value: 'ALL' }, ...cats.map(c => ({ label: c, value: c }))] }];
  }, [products]);

  const masterLookupColumns: ColumnDef<Product>[] = [
    { key: 'sku', label: 'Mã VT / SKU', render: (p) => <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">{p.sku || p.ma_vt || p.id}</span> },
    { key: 'name', label: 'Tên Vật Tư / Hàng Hóa', render: (p) => <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">{p.name || p.ten_vt}</span> },
    { key: 'unit', label: 'ĐVT', render: (p) => <span className="text-center font-medium text-xs">{p.unit || p.dvt || ''}</span> },
    { key: 'category', label: 'Loại Vật Tư', render: (p) => <Badge variant="outline" className="text-[10px]">{p.category || 'Vật tư'}</Badge> }
  ];

  // ---------------------------------------------------------------------------------------------- totals and save
  const filledItems = formItems.filter(hasMaterial);
  const filledItemCount = filledItems.length;
  const differingCount = filledItems.filter(item => (Number(item.diffQuantity) || 0) !== 0).length;
  const formSurplus = filledItems.reduce((sum, item) => sum + Math.max(0, Number(item.amount) || 0), 0);
  const formShortage = filledItems.reduce((sum, item) => sum + Math.max(0, -(Number(item.amount) || 0)), 0);

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const asDraft = saveAsDraftRef.current;
    saveAsDraftRef.current = false;
    if (!canSaveForm) return;
    if (!(editingVoucherId ? perm.edit : perm.create)) { showToast.error('Tài khoản của bạn không có quyền cập nhật dữ liệu!'); return; }
    if (!formCode.trim()) { showToast.error('Vui lòng nhập số chứng từ!'); return; }
    if (!formWarehouseId) { showToast.error('Vui lòng chọn kho kiểm kê!'); return; }
    const validItems = filledItems;
    if (validItems.length === 0) { showToast.error('Vui lòng khai báo ít nhất một vật tư kiểm kê (bấm "Lấy tồn sổ sách" hoặc tra cứu vật tư)!'); return; }
    if (validItems.some(item => (Number(item.quantity) || 0) < 0)) { showToast.error('Số lượng kiểm kê không được âm!'); return; }

    const warehouseObj = warehouses.find(w => w.id === formWarehouseId || w.name === formWarehouseName);
    const savedVoucher: GoodsVoucher = {
      id: editingVoucherId || '0',
      version: localVouchers.find(v => v.id === editingVoucherId)?.version,
      type: 'Phiếu kiểm kê', code: formCode.trim(), date: formDate, createdDate: formCreatedDate,
      companyUnitId: activeUnitCode, companyUnitName: formCompanyUnitName,
      warehouseId: formWarehouseId, warehouseName: warehouseObj?.name || formWarehouseName,
      counterName: formCounterName.trim(), countReason: formReason.trim(),
      items: validItems, totalValue: formSurplus + formShortage, createdBy: formCreatedBy || currentUser?.fullName || '',
      status: editingVoucherId ? formStatus : 'Lập chứng từ', note: formNote.trim()
    };

    setIsSaving(true);
    try {
      const target = asDraft ? 'Draft' : saveStatus;
      const result = editingVoucherId ? await stockCountsApi.update(savedVoucher, target) : await stockCountsApi.create(savedVoucher, target);
      setLocalVouchers(prev => editingVoucherId ? prev.map(v => v.id === editingVoucherId ? result : v) : [result, ...prev]);
      reloadListRef.current();
      showToast.success(`Đã lưu phiếu kiểm kê [${result.code}], trạng thái: ${result.status}.`);
      setIsModalOpen(false);
    } catch (error) {
      showToast.error(getErrorMessage(error));
      await loadData();
    } finally {
      setIsSaving(false);
    }
  };

  const confirm = useConfirm();
  const handleQuickStatusChange = async (voucherId: string, action: 'submit' | 'withdraw' | 'approve' | 'post' | 'unpost' | 'cancel' | 'reopen') => {
    // Cancelling and unposting cannot be taken back with one click: ask first (a cancelled voucher can be restored with Khôi phục).
    if (action === 'cancel' || action === 'unpost' || action === 'post') {
      const code = localVouchers.find(v => v.id === voucherId)?.code ?? '';
      const ok = await confirm(action === 'cancel'
        ? { title: `Hủy phiếu kiểm kê ${code}?`, message: 'Phiếu bị hủy không dùng được nữa. Nếu hủy nhầm, bấm Khôi phục để đưa phiếu về Lập chứng từ.', tone: 'warning', confirmLabel: 'Hủy phiếu', cancelLabel: 'Không' }
        : action === 'post'
          ? { title: `Chuyển sổ kho phiếu kiểm kê ${code}?`, message: 'Tồn sổ sách được tính lại tại ngày kiểm kê, rồi phần thừa được nhập kho và phần thiếu được xuất kho theo giá bình quân.', tone: 'warning', confirmLabel: 'Chuyển sổ', cancelLabel: 'Không' }
          : { title: `Bỏ ghi sổ phiếu kiểm kê ${code}?`, message: 'Sổ kho được đảo lại và phiếu quay về Đã phê duyệt. Nếu việc này làm âm kho thì không bỏ ghi sổ được.', tone: 'warning', confirmLabel: 'Bỏ ghi sổ', cancelLabel: 'Không' });
      if (!ok) return;
    }
    try {
      const result = await stockCountsApi.changeStatus(voucherId, action);
      setLocalVouchers(prev => prev.map(v => v.id === voucherId ? result : v));
      reloadListRef.current();
      showToast.success(`Phiếu ${result.code}: ${result.status}.`);
    } catch (error) {
      showToast.error(getErrorMessage(error));
      await loadData();
    }
  };

  const handleConfirmSingleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await stockCountsApi.remove(itemToDelete.id);
      setLocalVouchers(prev => prev.filter(v => v.id !== itemToDelete.id));
      reloadListRef.current();
      showToast.success(`Đã xóa phiếu kiểm kê [${itemToDelete.code}].`);
      setItemToDelete(null);
    } catch (error) { showToast.error(getErrorMessage(error)); }
  };

  const handleConfirmBulkDelete = async () => {
    if (!bulkToDeleteIds || bulkToDeleteIds.length === 0) return;
    const results = await Promise.allSettled(bulkToDeleteIds.map(id => stockCountsApi.remove(id)));
    const deleted = bulkToDeleteIds.filter((_, index) => results[index].status === 'fulfilled');
    setLocalVouchers(prev => prev.filter(v => !deleted.includes(v.id)));
    reloadListRef.current();
    showToast.info(`Đã xóa ${deleted.length}/${bulkToDeleteIds.length} phiếu. Chỉ phiếu nháp đủ quyền mới được xóa.`);
    setSelectedIds([]);
    setBulkToDeleteIds(null);
  };

  /** Two print forms: with cost and difference value (needs VIEW_COST) and without. */
  const handlePrint = (code: string, withPrice: boolean) => {
    if (!perm.print) { showToast.error('Tài khoản của bạn không có quyền In chứng từ!'); return; }
    const voucher = localVouchers.find(v => v.code === code);
    if (!voucher) return;
    const opened = printStockCount({
      withPrice: withPrice && canViewCost, voucher, company: systemSettingsService.getCompanyProfile(),
      format: { quantity: formatQuantity, unitPrice: formatUnitPrice, amount: value => formatNumber(value) },
      printedBy: currentUser?.fullName
    });
    if (!opened) showToast.error('Trình duyệt đã chặn cửa sổ in.');
  };

  // ---------------------------------------------------------------------------------------------- list
  const renderStatusBadge = (status?: string) => <VoucherStatusBadge voucherType="PKK" label={status} />;
  const canUnpost = hasStatusRight(currentUser, FUNCTION, RIGHTS.ST_UNPOST);

  const columns: GridViewColumn<GoodsVoucher>[] = [
    {
      key: 'code', title: 'Số Chứng Từ / Ngày', sortable: true,
      render: (v) => (
        <div className="space-y-0.5">
          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs hover:underline cursor-pointer" onClick={() => handleOpenEdit(v)}>{v.code}</span>
          <p className="text-[10px] text-slate-400">Ngày kiểm kê: <span className="font-semibold text-slate-600 dark:text-slate-300">{v.date}</span></p>
          <p className="text-[10px] text-slate-400">Lập bởi: <span className="font-medium text-slate-500">{v.createdBy}</span></p>
        </div>
      )
    },
    {
      key: 'companyUnitName', sortKey: 'warehouse', title: 'Đơn Vị Cơ Sở / Kho Kiểm Kê', sortable: true,
      render: (v) => (
        <div className="space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1"><Building2 className="h-3 w-3 text-slate-400" />{v.companyUnitName}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1"><Package className="h-3 w-3 text-indigo-400" />{v.warehouseName}</p>
        </div>
      )
    },
    {
      key: 'counter', title: 'Người Kiểm Kê / Lý Do', sortable: true,
      render: (v) => (
        <div className="space-y-0.5 text-xs">
          <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1 truncate max-w-[220px]" title={v.counterName}><Users className="h-3 w-3 text-slate-400 shrink-0" />{v.counterName || '—'}</p>
          {v.countReason && <p className="text-[10px] text-slate-500 truncate max-w-[220px]" title={v.countReason}>{v.countReason}</p>}
        </div>
      )
    },
    {
      key: 'items', title: 'Vật Tư Kiểm Kê',
      render: (v) => {
        const items = v.items ?? [];
        const differing = items.filter(i => (i.diffQuantity ?? 0) !== 0).length;
        return (
          <div className="space-y-1 max-w-xs">
            {items.slice(0, 2).map((it, idx) => (
              <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 truncate">• <span className="font-medium">{it.productName}</span> ({formatQuantity(it.bookQuantity ?? 0)} → {formatQuantity(it.quantity)} {it.unit || ''})</div>
            ))}
            {items.length > 2 && <div className="text-[10px] font-semibold text-indigo-500 italic">+ thêm {items.length - 2} vật tư khác</div>}
            <div className={`text-[10px] font-bold ${differing > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {items.length} dòng · {differing > 0 ? `${differing} dòng lệch` : 'khớp sổ sách'}
            </div>
          </div>
        );
      }
    },
    {
      key: 'totalValue', title: 'Thừa / Thiếu (VNĐ)', sortable: true, align: 'right',
      render: (v) => (
        <div className="text-right text-xs font-mono">
          <p className="font-bold text-emerald-600 dark:text-emerald-400">+ {formatVND(v.surplusValue ?? 0)}</p>
          <p className="font-bold text-rose-600 dark:text-rose-400">− {formatVND(v.shortageValue ?? 0)}</p>
        </div>
      )
    },
    { key: 'status', title: 'Trạng Thái Phiếu', sortable: true, render: (v) => renderStatusBadge(v.status) },
    {
      key: 'actions', title: 'Thao Tác', align: 'center',
      render: (v) => (
        <div className="flex items-center justify-center gap-1">
          <RowActionSlot>
              <button type="button" onClick={() => handleOpenEdit(v)} title="Xem & Sửa phiếu kiểm kê"
                className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"><Edit3 className="h-4 w-4" /></button>
          </RowActionSlot>
          <RowActionSlot>
              {v.status === 'Hủy' && reachesStatus(currentUser, FUNCTION, 'Cancelled') && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'reopen')} title="Khôi phục phiếu đã hủy (về Lập chứng từ)"
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"><RotateCcw className="h-4 w-4" /></button>
              )}
              {v.status === 'Lập chứng từ' && (perm.create || perm.edit) && approvalInUse && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'submit')} title="Gửi duyệt phiếu kiểm kê"
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"><ArrowUpRight className="h-4 w-4" /></button>
              )}
              {v.status === 'Chờ duyệt' && canApprove && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'approve')} title="Phê duyệt phiếu kiểm kê"
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"><ShieldCheck className="h-4 w-4" /></button>
              )}
              {v.status === 'Đã phê duyệt' && reachesStatus(currentUser, FUNCTION, 'Posted') && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'post')} title="Chuyển sổ kho (nhập phần thừa, xuất phần thiếu)"
                  className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors cursor-pointer"><CheckCircle2 className="h-4 w-4" /></button>
              )}
              {v.status === 'Chuyển sổ kho' && canUnpost && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'unpost')} title="Bỏ ghi sổ kho"
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg cursor-pointer"><RotateCcw className="h-4 w-4" /></button>
              )}
          </RowActionSlot>
          <RowActionSlot>
              {v.status === 'Chờ duyệt' && v.createdBy === currentUser?.fullName && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'withdraw')} title="Rút phiếu khỏi quy trình duyệt"
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg"><Undo2 className="h-4 w-4" /></button>
              )}
              {v.status === 'Đã phê duyệt' && reachesStatus(currentUser, FUNCTION, 'Cancelled') && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'cancel')} title="Hủy phiếu kiểm kê (chưa ghi sổ)"
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"><XCircle className="h-4 w-4" /></button>
              )}
          </RowActionSlot>
          <RowActionSlot>
              {perm.print && <PrintMenuButton canPrintPrice={canViewCost} onPrint={withPrice => handlePrint(v.code, withPrice)} />}
          </RowActionSlot>
          <RowActionSlot>
              {perm.delete && (
                <button type="button" onClick={() => setItemToDelete(v)} title="Xóa phiếu"
                  className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"><Trash2 className="h-4 w-4" /></button>
              )}
          </RowActionSlot>
        </div>
      )
    }
  ];

  const filterLabel = 'block text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-0.5';
  const filterInput = 'w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium';

  return (
    <div className="w-full min-w-0 flex-1 flex flex-col min-h-0 space-y-3">
      <CategoryHeaderToolbar
        icon={<ClipboardCheck className="h-6 w-6 text-amber-400" />}
        title="Danh Mục Phiếu Kiểm Kê (Stock Counts)"
        count={totalVouchers}
        countLabel="Phiếu Kiểm Kê"
        showAdvancedFilter={showAdvancedFilter}
        onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
        activeFilterCount={activeFilterCount}
        onRefresh={() => { void loadData(); }}
        onExportExcel={perm.export ? handleExportExcel : undefined}
        addLabel="Lập Phiếu Kiểm Kê Mới"
        canCreate={perm.create}
        onOpenAdd={handleOpenAdd}
        filterPanelContent={
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 text-xs">
            <div><label className={filterLabel}>Mã / Số Chứng Từ</label>
              <input type="text" placeholder="PKK-202610-01..." value={codeFilter} onChange={(e) => setCodeFilter(e.target.value)} className={filterInput} /></div>
            <div><label className={filterLabel}>Trạng Thái Phiếu</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterInput}>
                <option value="">-- Tất cả trạng thái --</option>
                <option value="Lập chứng từ">Lập chứng từ</option>
                <option value="Chờ duyệt">Chờ duyệt</option>
                <option value="Đã phê duyệt">Đã phê duyệt</option>
                <option value="Chuyển sổ kho">Chuyển sổ kho</option>
                <option value="Hủy">Đã hủy</option>
              </select></div>
            <div><label className={filterLabel}>Kho Kiểm Kê</label>
              <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)} className={filterInput}>
                <option value="">-- Tất cả kho --</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select></div>
            <div><label className={filterLabel}>Từ Ngày Kiểm Kê</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={filterInput} /></div>
            <div><label className={filterLabel}>Đến Ngày Kiểm Kê</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={filterInput} /></div>
          </div>
        }
        onApplyFilter={() => showToast.info('Đã áp dụng các bộ lọc nâng cao!')}
        onClearFilter={handleClearFilter}
      />

      <GridView<GoodsVoucher>
        data={localVouchers}
        serverSide
        loading={listLoading}
        currentPage={page}
        totalItems={totalVouchers}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        sortColumn={sort?.key ?? ''}
        sortDirection={sort?.dir ?? 'asc'}
        onSort={(key, dir) => setSort({ key, dir })}
        columns={canViewCost ? columns : columns.filter(c => c.key !== 'totalValue')}
        keyExtractor={(item) => item.id}
        searchable={true}
        searchPlaceholder="Tìm kiếm số phiếu, người kiểm kê, lý do, kho, vật tư..."
        searchValue={searchText}
        onSearchChange={setSearchText}
        selectable={true}
        selectedIds={selectedIds}
        onSelectionChange={(ids) => setSelectedIds(ids.map(String))}
        batchActions={perm.delete ? [{
          label: 'Xóa các phiếu đã chọn', icon: <Trash2 className="h-3.5 w-3.5 text-rose-500" />, variant: 'danger',
          onClick: (_, ids) => setBulkToDeleteIds(ids.map(String))
        }] : []}
        emptyText="Không tìm thấy phiếu kiểm kê nào phù hợp."
        pageSize={pageSize}
        pageSizeOptions={[10, 15, 20, 30, 50, 100]}
        dense={true}
      />

      {/* FORM: VIEW & EDIT / CREATE A STOCK COUNT */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingVoucherId ? `Chi Tiết & Cập Nhật Phiếu Kiểm Kê: [${formCode}]` : 'Lập Phiếu Kiểm Kê Mới'}
        fullScreen={true}
        headerActions={
          <div className="flex items-center gap-2 shrink-0">
            {editingVoucherId && perm.print && <PrintMenuButton variant="button" canPrintPrice={canViewCost} onPrint={withPrice => handlePrint(formCode, withPrice)} />}
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} icon={<XCircle className="h-3.5 w-3.5 text-slate-500" />}
              className="py-1 px-3 text-xs font-medium cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700">
              Hủy
            </Button>
            <Button type="button" variant="secondary" size="sm" icon={<Save className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
              onClick={() => { saveAsDraftRef.current = true; (document.getElementById('stock-count-form') as HTMLFormElement | null)?.requestSubmit(); }}
              disabled={isSaving || !canSaveForm} title="Lưu phiếu ở trạng thái Lập chứng từ, dù ô Trạng thái đang chọn gì"
              className="py-1 px-3 text-xs font-semibold cursor-pointer bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900">
              Lưu Nháp
            </Button>
            <Button type="submit" variant="success" size="sm" icon={<CheckCircle2 className="h-3.5 w-3.5 text-white" />}
              onClick={() => { (document.getElementById('stock-count-form') as HTMLFormElement | null)?.requestSubmit(); }}
              disabled={isSaving || !canSaveForm}
              className="py-1 px-4 text-xs font-bold cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-emerald-600">
              {saveStatus === 'Draft' ? (editingVoucherId ? 'Lưu & Cập Nhật' : 'Lưu Phiếu Kiểm Kê') : `Lưu và ${saveStatusName('PKK', saveStatus).toLowerCase()}`}
            </Button>
          </div>
        }
      >
        <form id="stock-count-form" onSubmit={handleSubmitForm} className="flex-1 min-h-0 flex flex-col gap-2 text-xs overflow-y-auto custom-scrollbar pt-2 pr-1">

          {/* I. THÔNG TIN KIỂM KÊ (trái) và II. CHỨNG TỪ (phải), như phiếu nhập / xuất kho */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 text-xs shrink-0">
            <div className="md:col-span-8 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between h-6 pb-1 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5 min-w-0">
                  <ClipboardCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate">I. Thông Tin Kiểm Kê</h4>
                </div>
                <span className="text-[10px] font-medium text-slate-400 shrink-0 hidden sm:inline">Đối chiếu tồn sổ sách với tồn thực tế</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 text-xs">
                <div>
                  <label className={VOUCHER_LABEL}>Kho Kiểm Kê <span className="text-rose-500">*</span></label>
                  <div className="flex items-center gap-1">
                    <select required value={formWarehouseId} disabled={!canSaveForm}
                      onChange={(e) => { setFormWarehouseId(e.target.value); const wh = warehouses.find(w => w.id === e.target.value); if (wh) setFormWarehouseName(wh.name); }}
                      className={VOUCHER_INPUT}>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setIsWarehouseLookupOpen(true)} disabled={!canSaveForm} className={VOUCHER_LOOKUP_BUTTON} title="Tra cứu danh mục Kho (F4)"><Search className="h-3 w-3" /></button>
                  </div>
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Người / Ban Kiểm Kê</label>
                  <input type="text" maxLength={200} placeholder="Họ tên người kiểm kê hoặc tên ban kiểm kê" value={formCounterName} disabled={!canSaveForm}
                    onChange={(e) => setFormCounterName(e.target.value)} className={`${VOUCHER_INPUT} font-normal`} />
                </div>

                <div className="sm:col-span-2">
                  <label className={VOUCHER_LABEL}>Lý Do / Phạm Vi Kiểm Kê</label>
                  <input type="text" maxLength={300} placeholder="Ví dụ: Kiểm kê định kỳ cuối tháng 10 toàn kho" value={formReason} disabled={!canSaveForm}
                    onChange={(e) => setFormReason(e.target.value)} className={`${VOUCHER_INPUT} font-normal`} />
                </div>

                <div className="sm:col-span-2">
                  <label className={VOUCHER_LABEL}>Ghi Chú / Diễn Giải Nghiệp Vụ</label>
                  <input type="text" placeholder="Ví dụ: Chênh lệch do xuất nhầm mã, đã xác nhận với thủ kho..." value={formNote} disabled={!canSaveForm}
                    onChange={(e) => setFormNote(e.target.value)} className={`${VOUCHER_INPUT} font-normal`} />
                </div>
              </div>
            </div>

            <div className="md:col-span-4 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between h-6 pb-1 border-b border-slate-100 dark:border-slate-800/80 gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate">II. Chứng Từ</h4>
                </div>
                <div className="shrink-0 scale-85 origin-right">{renderStatusBadge(shownStatus)}</div>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
                <div>
                  <label className={VOUCHER_LABEL}>Đơn Vị CS <span className="text-rose-500">*</span></label>
                  <select required value={activeUnitCode} disabled onChange={() => {}}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 font-bold text-slate-800 dark:text-slate-100 text-[10.5px] truncate h-[26px]">
                    <option value={activeUnitCode}>{activeUnitCode} - {formCompanyUnitName || activeUnitCode}</option>
                  </select>
                </div>
                <div>
                  <label className={VOUCHER_LABEL}>Số Chứng Từ <span className="text-rose-500">*</span></label>
                  <input type="text" required value={formCode} readOnly placeholder="PKK-202610-001"
                    className="w-full bg-indigo-50/40 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 rounded-lg px-1.5 py-0.5 font-mono font-black text-indigo-700 dark:text-indigo-300 text-[10.5px] h-[26px]" />
                </div>
                <div>
                  <label className={VOUCHER_LABEL}>Trạng Thái <span className="text-rose-500">*</span></label>
                  <select required value={shownStatus} disabled={!canChooseStatus} onChange={e => setSaveStatus(statusFromLabel(e.target.value))}
                    title={canChooseStatus ? 'Chọn trạng thái lưu phiếu, theo quyền của bạn' : undefined}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 font-extrabold text-slate-800 dark:text-slate-100 text-[10.5px] h-[26px]">
                    {canChooseStatus
                      ? statusChoices.map(choice => <option key={choice} value={SAVE_STATUS_LABELS[choice]}>{saveStatusName('PKK', choice)}</option>)
                      : (<>
                          <option value="Lập chứng từ">Lập chứng từ</option>
                          <option value="Chờ duyệt">Chờ duyệt</option>
                          <option value="Đã phê duyệt">Đã phê duyệt</option>
                          <option value="Chuyển sổ kho">Chuyển sổ kho</option>
                          <option value="Hủy">Hủy phiếu</option>
                        </>)}
                  </select>
                </div>
                <div>
                  <label className={VOUCHER_LABEL}>Người Lập</label>
                  <input type="text" value={formCreatedBy} readOnly placeholder="Thủ kho..."
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 font-medium text-[10.5px] h-[26px]" />
                </div>
                <div>
                  <DateTimePicker label="Ngày Kiểm Kê (Chốt Tồn)" type="date" required value={formDate}
                    onChange={(val) => {
                      setFormDate(val);
                      if (!editingVoucherId) voucherNumberingApi.preview('PKK', val).then(setFormCode).catch(error => showToast.error(getErrorMessage(error)));
                    }} />
                </div>
                <div>
                  <DateTimePicker label="Ngày Lập" type="date" required value={formCreatedDate} onChange={() => {}} disabled />
                </div>
              </div>
            </div>
          </div>

          {/* CHI TIẾT: chiếm hết chỗ còn lại của cửa sổ */}
          <section className="flex-1 min-h-[300px] flex flex-col bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 gap-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-slate-100 dark:bg-slate-800/80 text-indigo-600 dark:text-indigo-400">
                <Package className="h-3.5 w-3.5" />
                <span>Chi tiết kiểm kê</span>
                <span className="px-1.5 rounded-full text-[9.5px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black">{filledItemCount}</span>
                {differingCount > 0 && <span className="px-1.5 rounded-full text-[9.5px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 font-black">{differingCount} lệch</span>}
              </div>
              <div className="flex items-center gap-2 flex-wrap ml-auto">
                <Button type="button" size="sm" variant="outline" onClick={() => setIsBookOpen(true)} icon={<ListChecks className="h-3.5 w-3.5" />}
                  disabled={!canSaveForm} title="Điền các dòng từ tồn sổ sách của kho tại ngày kiểm kê"
                  className="text-[10.5px] py-1 px-2.5 h-[26px] font-semibold">
                  Lấy tồn sổ sách
                </Button>
                <Button type="button" size="sm" variant="primary" onClick={() => { setLookupTargetRowIndex(null); setIsMaterialLookupOpen(true); }}
                  icon={<Search className="h-3.5 w-3.5" />}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] py-1 px-2.5 h-[26px] shadow-2xs font-semibold">
                  Tra cứu vật tư (F2)
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 shrink-0">
              Chỉ nhập cột <strong>Tồn Thực Tế</strong>. Tồn sổ sách và chênh lệch được máy chủ tính lại khi lưu và khi chuyển sổ; thừa thì nhập kho, thiếu thì xuất kho theo giá bình quân.
            </p>

            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <div className="relative flex-1 min-w-[220px] max-w-md">
                <ScanLine className="h-3.5 w-3.5 text-indigo-500 absolute left-2 top-1/2 -translate-y-1/2" />
                <input type="text" value={scanText} disabled={!canSaveForm} autoComplete="off" spellCheck={false}
                  onChange={e => setScanText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleScan(); } }}
                  placeholder="Quét tem (hoặc gõ MÃ#LÔ#VỊ TRÍ) rồi Enter"
                  title="Máy quét cầm tay gõ mã vào ô này; quét lần đầu đặt số thực tế của dòng, các lần sau cộng thêm"
                  className="w-full bg-white dark:bg-slate-800 border border-indigo-300 dark:border-indigo-700 rounded-lg pl-7 pr-2 py-0.5 font-mono text-[11px] h-[26px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500" />
              </div>
              <label className="flex items-center gap-1 text-[10.5px] font-semibold text-slate-600 dark:text-slate-300">
                SL mỗi lần quét
                <input type="number" min={0.0001} step="any" value={scanQty} onChange={e => setScanQty(Number(e.target.value))} disabled={!canSaveForm}
                  className="w-16 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 text-right font-mono text-[11px] h-[26px]" />
              </label>
              {scannedCount > 0 && (
                <Button type="button" size="sm" variant="outline" onClick={() => void handleZeroUnscanned()} disabled={!canSaveForm}
                  title="Dòng chưa quét coi như không tìm thấy hàng" className="text-[10.5px] py-1 px-2.5 h-[26px] font-semibold">
                  Đặt 0 cho dòng chưa quét
                </Button>
              )}
              {scanLog && <span className={`text-[10.5px] font-semibold ${scanLog.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{scanLog.text}</span>}
            </div>

            <VoucherDetailGrid
              fill
              showAddButton={false}
              hiddenFields={hiddenCostFields}
              gridInfo={stockCountItemsGridConfig}
              data={formItems}
              onChange={(newItems) => setFormItems((newItems as VoucherItem[]).map(item => hasMaterial(item) ? withDiff(item) : item))}
              onLookupClick={(rowIndex) => { setLookupTargetRowIndex(rowIndex); setIsMaterialLookupOpen(true); }}
              onCodeSubmit={(rowIndex, field, codeValue) => handleCodeSubmit(rowIndex, field, codeValue)}
              currencyCode="VND"
              exchangeRate={1}
            />
          </section>

          {/* Thanh tóm tắt: phiếu và giá trị chênh lệch (nút Lưu / Hủy nằm ở thanh tiêu đề của cửa sổ) */}
          <div className="shrink-0 flex items-center justify-between gap-3 flex-wrap px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] text-slate-500 font-medium">
              Phiếu <strong className="font-mono text-indigo-600 dark:text-indigo-400">{formCode}</strong>
              <span className="mx-1.5 text-slate-300">|</span>
              {filledItemCount} vật tư, {differingCount} dòng lệch
            </span>
            {canViewCost && (
              <span className="text-[11px] text-slate-500 font-medium">
                Thừa: <strong className="font-mono text-emerald-600 dark:text-emerald-400">{formSurplus.toLocaleString('vi-VN')}</strong>
                <span className="mx-1.5 text-slate-300">|</span>
                Thiếu: <strong className="font-mono text-rose-600 dark:text-rose-400">{formShortage.toLocaleString('vi-VN')}</strong>
                <span className="mx-1.5 text-slate-300">|</span>
                Chênh lệch: <strong className="font-mono font-extrabold text-sm">{(formSurplus - formShortage).toLocaleString('vi-VN')} VND</strong>
              </span>
            )}
          </div>
        </form>
      </Modal>

      {/* "LẤY TỒN SỔ SÁCH": which materials of the warehouse to list */}
      <Modal isOpen={isBookOpen} onClose={() => setIsBookOpen(false)} title="Lấy Tồn Sổ Sách Để Kiểm Kê" maxWidth="md">
        <div className="space-y-3 text-xs">
          <p className="text-slate-500">
            Lấy tồn của kho <strong>{formWarehouseName || formWarehouseId}</strong> tại ngày <strong>{formDate}</strong> từ sổ kho. Số lượng thực tế điền sẵn bằng tồn sổ sách,
            bạn chỉ cần sửa các dòng kiểm kê lệch. Dòng đã nhập số lượng thực tế giữ nguyên.
          </p>
          <div>
            <label className={filterLabel}>Nhóm Vật Tư</label>
            <select value={bookGroup} onChange={e => setBookGroup(e.target.value)} className={filterInput}>
              <option value="">-- Tất cả nhóm vật tư --</option>
              {materialGroups.map(group => <option key={group.code} value={group.code}>{group.name}</option>)}
            </select>
          </div>
          <label className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={bookCycleOnly} onChange={e => setBookCycleOnly(e.target.checked)} />
            Chỉ vật tư đánh dấu kiểm kê định kỳ
          </label>
          <label className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={bookIncludeZero} onChange={e => setBookIncludeZero(e.target.checked)} />
            Cả vật tư có tồn sổ sách bằng 0 (để ghi nhận hàng tìm thấy ngoài sổ)
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsBookOpen(false)} className="text-xs">Đóng</Button>
            <Button type="button" variant="primary" size="sm" disabled={bookLoading} onClick={() => void handleLoadBookStock()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
              {bookLoading ? 'Đang lấy...' : 'Lấy tồn sổ sách'}
            </Button>
          </div>
        </div>
      </Modal>

      <DeleteConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmSingleDelete}
        itemCode={itemToDelete?.code}
        itemName={`Phiếu kiểm kê ngày ${itemToDelete?.date}`}
      />
      <DeleteConfirmModal
        isOpen={!!bulkToDeleteIds && bulkToDeleteIds.length > 0}
        onClose={() => setBulkToDeleteIds(null)}
        onConfirm={handleConfirmBulkDelete}
        isBulk
        bulkCount={bulkToDeleteIds?.length || 0}
      />

      <MasterLookupModal
        isOpen={isMaterialLookupOpen}
        onClose={() => { setIsMaterialLookupOpen(false); setLookupTargetRowIndex(null); }}
        title="Tra Cứu & Chọn Vật Tư / Hàng Hóa Từ Danh Mục"
        subtitle={lookupTargetRowIndex !== null ? 'Chọn 1 vật tư để gán cho dòng hiện tại' : 'Chọn một hoặc nhiều vật tư để thêm vào phiếu'}
        data={products}
        columns={masterLookupColumns}
        idField="id"
        displayField="name"
        searchFields={['sku', 'ma_vt', 'name', 'ten_vt', 'category']}
        searchPlaceholder="Nhập mã vật tư, SKU hoặc tên vật tư để tìm kiếm..."
        filters={productCategoriesFilter}
        selectionMode={lookupTargetRowIndex !== null ? 'single' : 'multiple'}
        selectedIds={lookupTargetRowIndex !== null ? [formItems[lookupTargetRowIndex]?.productId].filter(Boolean) as string[] : []}
        onConfirm={handleConfirmMasterLookup}
        pageSize={8}
      />

      <MasterLookupModal
        isOpen={isWarehouseLookupOpen}
        onClose={() => setIsWarehouseLookupOpen(false)}
        title="Tra Cứu & Chọn Kho Kiểm Kê Từ Danh Mục"
        subtitle="Chọn 1 kho hàng từ danh mục hệ thống để gán cho phiếu kiểm kê"
        data={warehouses}
        columns={warehouseLookupColumns}
        idField="id"
        displayField="name"
        searchFields={['id', 'code', 'name']}
        searchPlaceholder="Nhập mã kho hoặc tên kho để tìm kiếm..."
        selectionMode="single"
        selectedIds={[formWarehouseId].filter(Boolean)}
        onConfirm={handleConfirmWarehouseLookup}
        pageSize={6}
      />
    </div>
  );
};
