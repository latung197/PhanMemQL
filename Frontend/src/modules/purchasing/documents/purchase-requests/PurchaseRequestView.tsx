// Phiếu yêu cầu mua hàng (pur_request): a department asks purchasing to buy goods. Same layout, statuses and approval as the other
// vouchers, but it never posts to the stock ledger: the purchase order (Đơn mua hàng) will pull the lines of an approved request.
// The "Đã đặt" column shows what the purchase orders already order.
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  ClipboardCheck,
  ArrowUpRight,
  CheckCircle2,
  ShieldCheck,
  Clock,
  Edit3,
  Trash2,
  Building2,
  Package,
  Tag,
  Search,
  Save,
  Undo2,
  XCircle,
  FileText,
  AlertOctagon,
  User
} from 'lucide-react';
import { Button } from '../../../../components/common/Button';
import { Modal } from '../../../../components/common/Modal';
import { Badge } from '../../../../components/common/Badge';
import { CategoryHeaderToolbar } from '../../../../components/common/CategoryHeaderToolbar';
import { DeleteConfirmModal } from '../../../../components/common/DeleteConfirmModal';
import { GridView, GridViewColumn } from '../../../../components/common/GridView';
import { MasterLookupModal, ColumnDef } from '../../../../components/common/MasterLookupModal';
import { NumberInput, DateTimePicker, ComboBox, VoucherDetailGrid } from '../../../../components/common';
import { purchaseRequestItemsGridConfig } from '../../../../mock/voucherGridConfigs';
import { useNumberFormat } from '../../../../context/NumberFormatContext';
import { systemSettingsService } from '../../../../services/systemSettingsService';
import { PrintMenuButton } from '../../../inventory/documents/PrintMenuButton';
import { printVoucher } from '../../../inventory/documents/voucherPrint';
import { GoodsVoucher, VoucherItem, Product, Warehouse as WarehouseType, CompanyUnit, UserProfile } from '../../../../types';
import { SAVE_STATUS_LABELS, saveStatusChoices, saveStatusName, type SaveStatus } from '../../../inventory/documents/SaveStatusSelect';
import { VoucherStatusBadge } from '../../../inventory/documents/VoucherStatusBadge';
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
import { loadMaterialOptions, loadSupplierOptions, type SupplierOption } from '../../../../services/lookupOptions';
import { voucherNumberingApi, exchangeRatesApi } from '../../../../services/settingsApi';
import { purchaseRequestsApi } from './api';

const FUNCTION = 'pur_request';

// Shared look of the header fields of a voucher form (same as the goods receipt and goods issue).
const VOUCHER_LABEL = 'block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5 truncate';
const VOUCHER_INPUT = 'w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 font-medium text-[11px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[26px]';
const VOUCHER_LOOKUP_BUTTON = 'px-1.5 h-[26px] bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs';

/** What the purchase is for. */
const PURPOSES = ['Mua hàng trong nước', 'Mua hàng nhập khẩu', 'Mua nguyên vật liệu sản xuất', 'Mua hàng hóa bán lại', 'Mua vật tư văn phòng / Công cụ'];

interface PurchaseRequestViewProps {
  companyUnits?: CompanyUnit[];
  activeUnitCode: string;
  currentUser?: UserProfile;
}

const today = () => new Date().toISOString().split('T')[0];
const emptyItem = (): VoucherItem => ({ productId: '', productName: '', sku: '', unit: '', quantity: 1, unitPrice: 0, totalPrice: 0, note: '', orderedQuantity: 0 });
const hasMaterial = (item: VoucherItem) => Boolean(item.productId || item.sku || item.productName);

/** The status filter of the form holds the labels the screens keep; the server filters by the status name. */
const STATUS_OF_LABEL: Record<string, string> = {
  'Lập chứng từ': 'Draft', 'Chờ duyệt': 'Pending', 'Đã phê duyệt': 'Approved', 'Hủy': 'Cancelled'
};

export const PurchaseRequestView: React.FC<PurchaseRequestViewProps> = ({ companyUnits = [], activeUnitCode, currentUser }) => {
  const [localVouchers, setLocalVouchers] = useState<GoodsVoucher[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [currencies, setCurrencies] = useState<{ code: string; name: string }[]>([]);
  const [departments, setDepartments] = useState<{ code: string; name: string }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  // The status the form saves at: Draft, or further when the user's rights reach it (the server runs the steps and checks them).
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('Draft');
  // Set by the "Lưu Nháp" button: that save is a draft whatever the Trạng thái field holds.
  const saveAsDraftRef = useRef(false);

  // loadData also refreshes the list; the paging block below fills this in.
  const reloadListRef = useRef<() => void>(() => {});

  const loadData = async () => {
    try {
      const [options, materials, supplierList] = await Promise.all([purchaseRequestsApi.getOptions(), loadMaterialOptions(), loadSupplierOptions()]);
      reloadListRef.current();
      setProducts(materials);
      setSuppliers(supplierList);
      setCurrencies(options.currencies);
      setDepartments(options.departments);
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
  const [purposeFilter, setPurposeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
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
  const [formRequiredDate, setFormRequiredDate] = useState('');
  const [formStatus, setFormStatus] = useState<string>('Lập chứng từ');
  const [formPurpose, setFormPurpose] = useState(PURPOSES[0]);
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formWarehouseName, setFormWarehouseName] = useState('');
  const [formDepartmentCode, setFormDepartmentCode] = useState('');
  const [formRequesterName, setFormRequesterName] = useState('');
  const [formSupplierCode, setFormSupplierCode] = useState('');
  const [formSupplierName, setFormSupplierName] = useState('');
  const [formCurrencyCode, setFormCurrencyCode] = useState('VND');
  const [formExchangeRate, setFormExchangeRate] = useState<number>(1);
  const [formCreatedBy, setFormCreatedBy] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formItems, setFormItems] = useState<VoucherItem[]>([]);

  // Pickers
  const [isMaterialLookupOpen, setIsMaterialLookupOpen] = useState(false);
  const [isWarehouseLookupOpen, setIsWarehouseLookupOpen] = useState(false);
  const [isSupplierLookupOpen, setIsSupplierLookupOpen] = useState(false);
  const [lookupTargetRowIndex, setLookupTargetRowIndex] = useState<number | null>(null);

  useVoucherStatuses();
  const perm = getActionPermission(currentUser, FUNCTION);
  // "Duyệt" on the voucher or on its approval screen (Phê duyệt yêu cầu mua hàng), as the backend.
  const canApprove = canApproveVoucher(currentUser, FUNCTION);
  const canViewPrice = hasRight(currentUser, FUNCTION, RIGHTS.VIEW_PRICE);
  const hiddenPriceFields = canViewPrice ? undefined : ['unitPrice', 'amount'];
  // A request is never posted: only Draft, Pending and Approved can be asked for.
  const statusChoices = saveStatusChoices(currentUser, FUNCTION, { voucherType: 'YCM', posts: false });
  const approvalInUse = voucherStatusService.isEnabled('YCM', 'Pending');
  const canSaveForm = !editingVoucherId ? perm.create : perm.edit && formStatus === 'Lập chứng từ';
  const canChooseStatus = canSaveForm && statusChoices.length > 1;
  const statusFromLabel = (label: string): SaveStatus =>
    (Object.keys(SAVE_STATUS_LABELS) as SaveStatus[]).find(key => SAVE_STATUS_LABELS[key] === label) ?? 'Draft';
  const shownStatus = canChooseStatus ? SAVE_STATUS_LABELS[saveStatus] : formStatus;

  // The server already lists only the requests of the unit.
  const requestVouchers = localVouchers;

  const activeFilterCount = useMemo(() => [codeFilter.trim(), purposeFilter, statusFilter, warehouseFilter, departmentFilter, fromDate, toDate]
    .filter(Boolean).length, [codeFilter, purposeFilter, statusFilter, warehouseFilter, departmentFilter, fromDate, toDate]);


  // ---- The list: the server filters, sorts and cuts the pages (backend VoucherListQuery, services/paging.ts) ------------------
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const debouncedSearch = useDebounced(searchText, 300);
  const debouncedCode = useDebounced(codeFilter, 300);
  const listFilters = useMemo(() => ({
    status: STATUS_OF_LABEL[statusFilter] ?? '', warehouse: warehouseFilter, voucherType: purposeFilter, department: departmentFilter,
    code: debouncedCode.trim(), from: fromDate, to: toDate
  }), [statusFilter, warehouseFilter, purposeFilter, departmentFilter, debouncedCode, fromDate, toDate]);
  const filterKey = `${JSON.stringify(listFilters)}|${debouncedSearch}|${sort ? `${sort.key}:${sort.dir}` : ''}|${pageSize}|${activeUnitCode}`;
  // A new search, filter, sort or page size starts again at the first page.
  useEffect(() => { setPage(1); }, [filterKey]);
  const listQuery = useMemo<PagedQuery>(() => ({
    page, pageSize, sort: sort?.key, dir: sort?.dir, search: debouncedSearch, filters: listFilters
  }), [page, pageSize, sort, debouncedSearch, listFilters]);
  const fetchPage = useCallback((query: PagedQuery) => purchaseRequestsApi.getPage(query), []);
  const { items: pageItems, total: totalVouchers, loading: listLoading, error: listError, reload: reloadList } = usePagedList(fetchPage, listQuery);
  reloadListRef.current = reloadList;
  useEffect(() => { setLocalVouchers(pageItems); }, [pageItems]);
  useEffect(() => { if (listError) showToast.error(listError); }, [listError]);

  const { formatQuantity, formatUnitPrice, formatNumber } = useNumberFormat();
  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);

  const handleCurrencyChange = async (cCode: string) => {
    setFormCurrencyCode(cCode);
    try { setFormExchangeRate(await exchangeRatesApi.getRate(cCode, formDate)); }
    catch (error) { showToast.error(getErrorMessage(error)); setFormExchangeRate(1); }
  };

  const handleClearFilter = () => {
    setCodeFilter(''); setPurposeFilter(''); setStatusFilter(''); setWarehouseFilter('');
    setDepartmentFilter(''); setFromDate(''); setToDate(''); setSearchText('');
    showToast.info('Đã xóa tất cả bộ lọc!');
  };

  // ---------------------------------------------------------------------------------------------- open the form
  const handleOpenAdd = async () => {
    if (!perm.create) { showToast.error('Tài khoản của bạn không có quyền lập phiếu yêu cầu mua hàng mới!'); return; }
    if (warehouses.length === 0) { showToast.error('Cần khai báo kho đang hoạt động trước khi lập phiếu yêu cầu mua hàng.'); return; }
    const defaultUnit = companyUnits.find(c => c.code === activeUnitCode) || companyUnits[0];
    const defaultWh = warehouses[0];
    let newCode = 'Số tự động';
    try { newCode = await voucherNumberingApi.preview('YCM'); }
    catch (error) { showToast.error(getErrorMessage(error)); return; }

    setEditingVoucherId(null);
    setFormCompanyUnitName(defaultUnit?.name || activeUnitCode);
    setFormCode(newCode);
    setFormDate(today());
    setFormCreatedDate(today());
    setFormRequiredDate('');
    setFormStatus('Lập chứng từ');
    setFormPurpose(PURPOSES[0]);
    setFormWarehouseId(defaultWh.id);
    setFormWarehouseName(defaultWh.name);
    setFormDepartmentCode('');
    setFormRequesterName(currentUser?.fullName || '');
    setFormSupplierCode('');
    setFormSupplierName('');
    setFormCurrencyCode('VND');
    setFormExchangeRate(1);
    setFormCreatedBy(currentUser?.fullName || '');
    setFormNote('');
    setFormItems([emptyItem()]);
    setSaveStatus('Draft');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (voucher: GoodsVoucher) => {
    setEditingVoucherId(voucher.id);
    setFormCompanyUnitName(voucher.companyUnitName || activeUnitCode);
    setFormCode(voucher.code);
    setFormDate(voucher.date || today());
    setFormCreatedDate(voucher.createdDate || voucher.date || today());
    setFormRequiredDate(voucher.requiredDate || '');
    setFormStatus(voucher.status || 'Chờ duyệt');
    setFormPurpose(voucher.voucherType || PURPOSES[0]);
    setFormWarehouseId(voucher.warehouseId);
    setFormWarehouseName(voucher.warehouseName);
    setFormDepartmentCode(voucher.departmentCode || '');
    setFormRequesterName(voucher.requesterName || '');
    setFormSupplierCode(voucher.supplierCode || '');
    setFormSupplierName(voucher.supplierName || '');
    setFormCurrencyCode(voucher.currencyCode || 'VND');
    setFormExchangeRate(voucher.exchangeRate || 1);
    setFormCreatedBy(voucher.createdBy || '');
    setFormNote(voucher.note || '');
    const mapped: VoucherItem[] = (voucher.items ?? []).map(it => ({
      productId: it.productId || '', productName: it.productName, sku: it.sku || '', unit: it.unit || '',
      quantity: it.quantity || 1, unitPrice: it.unitPrice || 0, totalPrice: (it.quantity || 1) * (it.unitPrice || 0),
      note: it.note || '', orderedQuantity: it.orderedQuantity ?? 0
    }));
    setFormItems([...mapped, emptyItem()]);
    setSaveStatus('Draft');
    setIsModalOpen(true);
  };

  // Opened from a notification (e.g. "Chờ duyệt: {mã phiếu}"): show that voucher.
  useOpenDocumentRequest(FUNCTION, (documentId) => {
    const voucher = requestVouchers.find(v => v.code === documentId || v.id === documentId);
    if (voucher) { handleOpenEdit(voucher); return; }
    // Not on the page shown: ask the server for the voucher with that code.
    void purchaseRequestsApi.getPage({ page: 1, pageSize: 1, filters: { code: documentId } }).then(result => {
      const found = result.items.find(v => v.code === documentId);
      if (found) handleOpenEdit(found);
      else showToast.warning(`Không tìm thấy phiếu yêu cầu mua hàng ${documentId}.`, 'Phiếu có thể đã bị xóa hoặc thuộc đơn vị khác.');
    }).catch(error => showToast.error(getErrorMessage(error)));
  });

  // The Excel file is made by the server from every row the filters leave (not only this page).
  const handleExportExcel = async () => {
    if (!perm.export) {
      showToast.error('Tài khoản của bạn không có quyền Xuất Excel!');
      return;
    }
    try { await purchaseRequestsApi.exportAll(listQuery); }
    catch (error) { showToast.error(getErrorMessage(error)); }
  };

  // ---------------------------------------------------------------------------------------------- lines
  const applyProductToRow = (index: number, prod: Product) => {
    setFormItems(prev => {
      const updated = [...prev];
      const qty = updated[index]?.quantity || 1;
      updated[index] = {
        ...updated[index], productId: prod.id, productName: prod.name || prod.ten_vt || '', sku: prod.sku || prod.ma_vt || '',
        unit: prod.unit || prod.dvt || '', unitPrice: 0, totalPrice: qty * 0
      };
      // One blank row stays at the end for the next entry.
      if (index === updated.length - 1) updated.push(emptyItem());
      return updated;
    });
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
      const next = lookupTargetRowIndex + 1;
      setTimeout(() => {
        const element = document.querySelector<HTMLInputElement>(`[data-grid-row="${next}"][data-grid-col="sku"]`) || document.querySelector<HTMLInputElement>(`[data-grid-row="${next}"]`);
        if (element) { element.focus(); element.select?.(); }
      }, 120);
    } else {
      const added: VoucherItem[] = selected.map(prod => ({
        productId: prod.id, productName: prod.name || prod.ten_vt || '', sku: prod.sku || prod.ma_vt || '', unit: prod.unit || prod.dvt || '',
        quantity: 1, unitPrice: 0, totalPrice: 0, note: '', orderedQuantity: 0
      }));
      setFormItems(prev => [...prev.filter(hasMaterial), ...added, emptyItem()]);
      showToast.success(`Đã thêm ${selected.length} vật tư từ danh mục.`);
    }
    setIsMaterialLookupOpen(false);
    setLookupTargetRowIndex(null);
  };

  const handleConfirmSupplierLookup = (selectedItems: SupplierOption[]) => {
    const selected = selectedItems[0];
    if (selected) { setFormSupplierCode(selected.code); setFormSupplierName(selected.name); }
    setIsSupplierLookupOpen(false);
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

  const supplierLookupColumns: ColumnDef<SupplierOption>[] = [
    { key: 'code', label: 'Mã NCC', render: (s) => <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">{s.code}</span> },
    { key: 'name', label: 'Tên Nhà Cung Cấp', render: (s) => <span className="font-bold text-slate-800 dark:text-slate-100 text-xs">{s.name}</span> }
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
  const formTotalValue = useMemo(() => {
    const rate = formExchangeRate && formExchangeRate > 0 ? formExchangeRate : 1;
    return rate * formItems.reduce((sum, item) => hasMaterial(item) ? sum + (item.totalPrice || (item.quantity || 0) * (item.unitPrice || 0)) : sum, 0);
  }, [formItems, formExchangeRate]);

  const filledItemCount = formItems.filter(hasMaterial).length;

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const asDraft = saveAsDraftRef.current;
    saveAsDraftRef.current = false;
    if (!canSaveForm) return;
    if (!(editingVoucherId ? perm.edit : perm.create)) { showToast.error('Tài khoản của bạn không có quyền cập nhật dữ liệu!'); return; }
    if (!formCode.trim()) { showToast.error('Vui lòng nhập số chứng từ!'); return; }
    const validItems = formItems.filter(hasMaterial);
    if (validItems.length === 0) { showToast.error('Vui lòng khai báo ít nhất một mặt hàng cần mua!'); return; }

    const warehouseObj = warehouses.find(w => w.id === formWarehouseId || w.name === formWarehouseName);
    const savedVoucher: GoodsVoucher = {
      id: editingVoucherId || '0',
      version: localVouchers.find(v => v.id === editingVoucherId)?.version,
      type: 'Yêu cầu mua hàng', code: formCode.trim(), date: formDate, createdDate: formCreatedDate, requiredDate: formRequiredDate,
      companyUnitId: activeUnitCode, companyUnitName: formCompanyUnitName,
      voucherType: formPurpose, currencyCode: formCurrencyCode, exchangeRate: formExchangeRate,
      departmentCode: formDepartmentCode, requesterName: formRequesterName.trim(), supplierCode: formSupplierCode || undefined, supplierName: formSupplierName.trim(),
      warehouseId: formWarehouseId, warehouseName: warehouseObj?.name || formWarehouseName,
      items: validItems, totalValue: formTotalValue, createdBy: formCreatedBy || currentUser?.fullName || '',
      status: editingVoucherId ? formStatus : 'Lập chứng từ', note: formNote.trim()
    };

    setIsSaving(true);
    try {
      const target = asDraft ? 'Draft' : saveStatus;
      const result = editingVoucherId ? await purchaseRequestsApi.update(savedVoucher, target) : await purchaseRequestsApi.create(savedVoucher, target);
      setLocalVouchers(prev => editingVoucherId ? prev.map(v => v.id === editingVoucherId ? result : v) : [result, ...prev]);
      reloadListRef.current();
      showToast.success(`Đã lưu phiếu yêu cầu mua hàng [${result.code}], trạng thái: ${result.status}.`);
      setIsModalOpen(false);
    } catch (error) {
      showToast.error(getErrorMessage(error));
      await loadData();
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickStatusChange = async (voucherId: string, action: 'submit' | 'withdraw' | 'approve' | 'cancel') => {
    try {
      const result = await purchaseRequestsApi.changeStatus(voucherId, action);
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
      await purchaseRequestsApi.remove(itemToDelete.id);
      setLocalVouchers(prev => prev.filter(v => v.id !== itemToDelete.id));
      reloadListRef.current();
      showToast.success(`Đã xóa phiếu yêu cầu mua hàng [${itemToDelete.code}].`);
      setItemToDelete(null);
    } catch (error) { showToast.error(getErrorMessage(error)); }
  };

  const handleConfirmBulkDelete = async () => {
    if (!bulkToDeleteIds || bulkToDeleteIds.length === 0) return;
    const results = await Promise.allSettled(bulkToDeleteIds.map(id => purchaseRequestsApi.remove(id)));
    const deleted = bulkToDeleteIds.filter((_, index) => results[index].status === 'fulfilled');
    setLocalVouchers(prev => prev.filter(v => !deleted.includes(v.id)));
    reloadListRef.current();
    showToast.info(`Đã xóa ${deleted.length}/${bulkToDeleteIds.length} phiếu. Chỉ phiếu nháp đủ quyền mới được xóa.`);
    setSelectedIds([]);
    setBulkToDeleteIds(null);
  };

  /** Two print forms: with prices and amounts (needs VIEW_PRICE) and without. */
  const handlePrint = (code: string, withPrice: boolean) => {
    if (!perm.print) { showToast.error('Tài khoản của bạn không có quyền In chứng từ!'); return; }
    const voucher = localVouchers.find(v => v.code === code);
    if (!voucher) return;
    const opened = printVoucher({
      kind: 'purchaseRequest', withPrice: withPrice && canViewPrice, voucher, company: systemSettingsService.getCompanyProfile(),
      format: { quantity: formatQuantity, unitPrice: formatUnitPrice, amount: value => formatNumber(value) },
      printedBy: currentUser?.fullName
    });
    if (!opened) showToast.error('Trình duyệt đã chặn cửa sổ in.');
  };

  // ---------------------------------------------------------------------------------------------- list
  const renderStatusBadge = (status?: string) => <VoucherStatusBadge voucherType="YCX" label={status} />;

  const columns: GridViewColumn<GoodsVoucher>[] = [
    {
      key: 'code', title: 'Số Chứng Từ / Ngày', sortable: true,
      render: (v) => (
        <div className="space-y-0.5">
          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs hover:underline cursor-pointer" onClick={() => handleOpenEdit(v)}>{v.code}</span>
          <p className="text-[10px] text-slate-400">Ngày CT: <span className="font-semibold text-slate-600 dark:text-slate-300">{v.date}</span></p>
          {v.requiredDate && <p className="text-[10px] text-slate-400">Cần hàng: <span className="font-semibold text-amber-600 dark:text-amber-400">{v.requiredDate}</span></p>}
          <p className="text-[10px] text-slate-400">Lập bởi: <span className="font-medium text-slate-500">{v.createdBy}</span></p>
        </div>
      )
    },
    {
      key: 'companyUnitName', sortKey: 'warehouse', title: 'Đơn Vị Cơ Sở / Kho', sortable: true,
      render: (v) => (
        <div className="space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1"><Building2 className="h-3 w-3 text-slate-400" />{v.companyUnitName}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1"><Package className="h-3 w-3 text-indigo-400" />{v.warehouseName}</p>
        </div>
      )
    },
    {
      key: 'requesterName', title: 'Bộ Phận / Người Yêu Cầu',
      render: (v) => (
        <div className="space-y-0.5 text-xs">
          <p className="font-semibold text-slate-800 dark:text-slate-200">{v.departmentName || '—'}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1"><User className="h-3 w-3" />{v.requesterName || '—'}</p>
          {v.supplierName && <p className="text-[10px] text-slate-400 truncate max-w-[200px]" title={v.supplierName}>NCC: <span className="font-medium text-slate-600 dark:text-slate-300">{v.supplierName}</span></p>}
        </div>
      )
    },
    {
      key: 'voucherType', title: 'Loại Mua', sortable: true,
      render: (v) => (
        <Badge variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700">
          <Tag className="h-3 w-3 mr-1 text-indigo-500" />{v.voucherType || PURPOSES[0]}
        </Badge>
      )
    },
    {
      key: 'items', title: 'Hàng Yêu Cầu / Đã Đặt',
      render: (v) => {
        const items = v.items ?? [];
        const requested = items.reduce((sum, i) => sum + i.quantity, 0);
        const ordered = items.reduce((sum, i) => sum + (i.orderedQuantity ?? 0), 0);
        const done = requested > 0 && ordered >= requested;
        return (
          <div className="space-y-1 max-w-xs">
            {items.slice(0, 2).map((it, idx) => (
              <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 truncate">• <span className="font-medium">{it.productName}</span> ({it.quantity} {it.unit || ''})</div>
            ))}
            {items.length > 2 && <div className="text-[10px] font-semibold text-indigo-500 italic">+ thêm {items.length - 2} mặt hàng khác</div>}
            <div className={`text-[10px] font-bold ${done ? 'text-emerald-600 dark:text-emerald-400' : ordered > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
              Đã đặt {formatQuantity(ordered)} / {formatQuantity(requested)}{done ? ' · xong' : ''}
            </div>
          </div>
        );
      }
    },
    {
      key: 'totalValue', title: 'Giá Trị Dự Kiến (VNĐ)', sortable: true, align: 'right',
      render: (v) => <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">{formatVND(v.totalValue)}</span>
    },
    { key: 'status', title: 'Trạng Thái Phiếu', sortable: true, render: (v) => renderStatusBadge(v.status) },
    {
      key: 'actions', title: 'Thao Tác', align: 'center',
      render: (v) => (
        <div className="flex items-center justify-center gap-1">
          <button type="button" onClick={() => handleOpenEdit(v)} title="Xem & Sửa phiếu yêu cầu"
            className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"><Edit3 className="h-4 w-4" /></button>
          {v.status === 'Lập chứng từ' && (perm.create || perm.edit) && approvalInUse && (
            <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'submit')} title="Gửi duyệt phiếu yêu cầu mua hàng"
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"><ArrowUpRight className="h-4 w-4" /></button>
          )}
          {v.status === 'Chờ duyệt' && canApprove && (
            <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'approve')} title="Phê duyệt phiếu yêu cầu mua hàng"
              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"><ShieldCheck className="h-4 w-4" /></button>
          )}
          {v.status === 'Chờ duyệt' && v.createdBy === currentUser?.fullName && (
            <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'withdraw')} title="Rút phiếu khỏi quy trình duyệt"
              className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg"><Undo2 className="h-4 w-4" /></button>
          )}
          {v.status === 'Đã phê duyệt' && reachesStatus(currentUser, FUNCTION, 'Cancelled') && (
            <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'cancel')} title="Hủy phiếu yêu cầu (khi chưa có đơn mua hàng)"
              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"><XCircle className="h-4 w-4" /></button>
          )}
          {perm.print && <PrintMenuButton canPrintPrice={canViewPrice} onPrint={withPrice => handlePrint(v.code, withPrice)} />}
          {perm.delete && (
            <button type="button" onClick={() => setItemToDelete(v)} title="Xóa phiếu"
              className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"><Trash2 className="h-4 w-4" /></button>
          )}
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
        title="Danh Mục Phiếu Yêu Cầu Mua Hàng (Purchase Requests)"
        subtitle="Bộ phận đề nghị mua hàng: lập, duyệt, theo dõi số đã đặt mua trên các đơn mua hàng"
        count={totalVouchers}
        countLabel="Phiếu Yêu Cầu"
        showAdvancedFilter={showAdvancedFilter}
        onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
        activeFilterCount={activeFilterCount}
        onRefresh={() => { void loadData(); }}
        onExportExcel={perm.export ? handleExportExcel : undefined}
        addLabel="Lập Phiếu Yêu Cầu Mới"
        canCreate={perm.create}
        onOpenAdd={handleOpenAdd}
        filterPanelContent={
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
            <div><label className={filterLabel}>Mã / Số Chứng Từ</label>
              <input type="text" placeholder="YCX-202610-01..." value={codeFilter} onChange={(e) => setCodeFilter(e.target.value)} className={filterInput} /></div>
            <div><label className={filterLabel}>Loại Mua</label>
              <select value={purposeFilter} onChange={(e) => setPurposeFilter(e.target.value)} className={filterInput}>
                <option value="">-- Tất cả loại mua --</option>
                {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
              </select></div>
            <div><label className={filterLabel}>Trạng Thái Phiếu</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterInput}>
                <option value="">-- Tất cả trạng thái --</option>
                <option value="Lập chứng từ">Lập chứng từ</option>
                <option value="Chờ duyệt">Chờ duyệt</option>
                <option value="Đã phê duyệt">Đã phê duyệt</option>
                <option value="Hủy">Đã hủy</option>
              </select></div>
            <div><label className={filterLabel}>Kho Nhận Hàng</label>
              <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)} className={filterInput}>
                <option value="">-- Tất cả kho --</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select></div>
            <div><label className={filterLabel}>Bộ Phận Yêu Cầu</label>
              <select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className={filterInput}>
                <option value="">-- Tất cả bộ phận --</option>
                {departments.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
              </select></div>
            <div><label className={filterLabel}>Từ Ngày Chứng Từ</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={filterInput} /></div>
            <div><label className={filterLabel}>Đến Ngày Chứng Từ</label>
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
        columns={canViewPrice ? columns : columns.filter(c => c.key !== 'totalValue')}
        keyExtractor={(item) => item.id}
        searchable={true}
        searchPlaceholder="Tìm kiếm mã phiếu, bộ phận, người yêu cầu, nhà cung cấp, kho, sản phẩm..."
        searchValue={searchText}
        onSearchChange={setSearchText}
        selectable={true}
        selectedIds={selectedIds}
        onSelectionChange={(ids) => setSelectedIds(ids.map(String))}
        batchActions={perm.delete ? [{
          label: 'Xóa các phiếu đã chọn', icon: <Trash2 className="h-3.5 w-3.5 text-rose-500" />, variant: 'danger',
          onClick: (_, ids) => setBulkToDeleteIds(ids.map(String))
        }] : []}
        emptyText="Không tìm thấy phiếu yêu cầu mua hàng nào phù hợp."
        pageSize={pageSize}
        pageSizeOptions={[10, 15, 20, 30, 50, 100]}
        dense={true}
      />

      {/* FORM: VIEW & EDIT / CREATE AN ISSUE REQUEST */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingVoucherId ? `Chi Tiết & Cập Nhật Phiếu Yêu Cầu Mua Hàng: [${formCode}]` : 'Lập Phiếu Yêu Cầu Mua Hàng Mới'}
        fullScreen={true}
        headerActions={
          <div className="flex items-center gap-2 shrink-0">
            {editingVoucherId && perm.print && <PrintMenuButton variant="button" canPrintPrice={canViewPrice} onPrint={withPrice => handlePrint(formCode, withPrice)} />}
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} icon={<XCircle className="h-3.5 w-3.5 text-slate-500" />}
              className="py-1 px-3 text-xs font-medium cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700">
              Hủy
            </Button>
            <Button type="button" variant="secondary" size="sm" icon={<Save className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
              onClick={() => { saveAsDraftRef.current = true; (document.getElementById('purchase-request-form') as HTMLFormElement | null)?.requestSubmit(); }}
              disabled={isSaving || !canSaveForm} title="Lưu phiếu ở trạng thái Lập chứng từ, dù ô Trạng thái đang chọn gì"
              className="py-1 px-3 text-xs font-semibold cursor-pointer bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900">
              Lưu Nháp
            </Button>
            <Button type="submit" variant="success" size="sm" icon={<CheckCircle2 className="h-3.5 w-3.5 text-white" />}
              onClick={() => { (document.getElementById('purchase-request-form') as HTMLFormElement | null)?.requestSubmit(); }}
              disabled={isSaving || !canSaveForm}
              className="py-1 px-4 text-xs font-bold cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-emerald-600">
              {saveStatus === 'Draft' ? (editingVoucherId ? 'Lưu & Cập Nhật' : 'Lưu Phiếu Yêu Cầu') : `Lưu và ${saveStatusName('YCM', saveStatus).toLowerCase()}`}
            </Button>
          </div>
        }
      >
        <form id="purchase-request-form" onSubmit={handleSubmitForm} className="flex-1 min-h-0 flex flex-col gap-2 text-xs overflow-y-auto custom-scrollbar pt-2 pr-1">

          {/* I. THÔNG TIN NGHIỆP VỤ (trái) và II. CHỨNG TỪ & TIỀN TỆ (phải), như phiếu nhập / xuất kho */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 text-xs shrink-0">
            <div className="md:col-span-8 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between h-6 pb-1 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Tag className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate">I. Thông Tin Nghiệp Vụ & Đề Nghị</h4>
                </div>
                <span className="text-[10px] font-medium text-slate-400 shrink-0 hidden sm:inline">Bộ phận đề nghị mua hàng</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 sm:gap-2 text-xs">
                <div>
                  <label className={VOUCHER_LABEL}>Loại Mua Hàng <span className="text-rose-500">*</span></label>
                  <select required value={formPurpose} onChange={(e) => setFormPurpose(e.target.value)} className={VOUCHER_INPUT}>
                    {PURPOSES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Kho Nhận Hàng <span className="text-rose-500">*</span></label>
                  <div className="flex items-center gap-1">
                    <select required value={formWarehouseId}
                      onChange={(e) => { setFormWarehouseId(e.target.value); const wh = warehouses.find(w => w.id === e.target.value); if (wh) setFormWarehouseName(wh.name); }}
                      className={VOUCHER_INPUT}>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setIsWarehouseLookupOpen(true)} className={VOUCHER_LOOKUP_BUTTON} title="Tra cứu danh mục Kho (F4)"><Search className="h-3 w-3" /></button>
                  </div>
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Bộ Phận Yêu Cầu</label>
                  <select value={formDepartmentCode} onChange={(e) => setFormDepartmentCode(e.target.value)} className={VOUCHER_INPUT}>
                    <option value="">-- Không chọn --</option>
                    {departments.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Người Yêu Cầu</label>
                  <input type="text" placeholder="Họ tên người đề nghị mua hàng..." value={formRequesterName}
                    onChange={(e) => setFormRequesterName(e.target.value)} className={VOUCHER_INPUT} />
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Nhà Cung Cấp Đề Nghị</label>
                  <div className="flex items-center gap-1">
                    <input type="text" placeholder="Không bắt buộc" value={formSupplierName}
                      onChange={(e) => { setFormSupplierName(e.target.value); setFormSupplierCode(''); }} className={VOUCHER_INPUT} />
                    <button type="button" onClick={() => setIsSupplierLookupOpen(true)} className={VOUCHER_LOOKUP_BUTTON} title="Tra cứu danh mục Nhà cung cấp"><Search className="h-3 w-3" /></button>
                  </div>
                </div>

                <div>
                  <DateTimePicker label="Ngày Cần Hàng" type="date" value={formRequiredDate} onChange={(val) => setFormRequiredDate(val)} />
                </div>

                <div className="sm:col-span-2 xl:col-span-3">
                  <label className={VOUCHER_LABEL}>Ghi Chú / Diễn Giải Nghiệp Vụ</label>
                  <input type="text" placeholder="Ví dụ: Mua bổ sung vật tư cho kế hoạch sản xuất tháng 11..." value={formNote}
                    onChange={(e) => setFormNote(e.target.value)} className={`${VOUCHER_INPUT} font-normal`} />
                </div>
              </div>
            </div>

            <div className="md:col-span-4 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between h-6 pb-1 border-b border-slate-100 dark:border-slate-800/80 gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate">II. Chứng Từ & Tiền Tệ</h4>
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
                  <input type="text" required value={formCode} readOnly placeholder="YCX-202610-001"
                    className="w-full bg-indigo-50/40 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 rounded-lg px-1.5 py-0.5 font-mono font-black text-indigo-700 dark:text-indigo-300 text-[10.5px] h-[26px]" />
                </div>
                <div>
                  <label className={VOUCHER_LABEL}>Trạng Thái <span className="text-rose-500">*</span></label>
                  <select required value={shownStatus} disabled={!canChooseStatus} onChange={e => setSaveStatus(statusFromLabel(e.target.value))}
                    title={canChooseStatus ? 'Chọn trạng thái lưu phiếu, theo quyền của bạn' : undefined}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 font-extrabold text-slate-800 dark:text-slate-100 text-[10.5px] h-[26px]">
                    {canChooseStatus
                      ? statusChoices.map(choice => <option key={choice} value={SAVE_STATUS_LABELS[choice]}>{saveStatusName('YCM', choice)}</option>)
                      : (<>
                          <option value="Lập chứng từ">Lập chứng từ</option>
                          <option value="Chờ duyệt">Chờ duyệt</option>
                          <option value="Đã phê duyệt">Đã phê duyệt</option>
                          <option value="Hủy">Hủy phiếu</option>
                        </>)}
                  </select>
                </div>
                <div>
                  <label className={VOUCHER_LABEL}>Người Lập</label>
                  <input type="text" value={formCreatedBy} readOnly placeholder="NV Kho..."
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 font-medium text-[10.5px] h-[26px]" />
                </div>
                <div>
                  <DateTimePicker label="Ngày CT" type="date" required value={formDate}
                    onChange={(val) => {
                      setFormDate(val);
                      if (!editingVoucherId) voucherNumberingApi.preview('YCM', val).then(setFormCode).catch(error => showToast.error(getErrorMessage(error)));
                      exchangeRatesApi.getRate(formCurrencyCode, val).then(setFormExchangeRate).catch(error => showToast.error(getErrorMessage(error)));
                    }} />
                </div>
                <div>
                  <DateTimePicker label="Ngày Lập" type="date" required value={formCreatedDate} onChange={() => {}} disabled />
                </div>
                <div>
                  <ComboBox label="Loại Tiền" options={currencies.map(c => ({ value: c.code, label: `${c.code} - ${c.name}` }))}
                    value={formCurrencyCode} onChange={(val) => handleCurrencyChange(val)} clearable={false} searchable={false} />
                </div>
                <div>
                  <label className={VOUCHER_LABEL}>Tỷ Giá</label>
                  <NumberInput value={formExchangeRate} onChange={() => {}} readOnly min={1} decimals={2} />
                </div>
              </div>
            </div>
          </div>

          {/* CHI TIẾT: chiếm hết chỗ còn lại của cửa sổ */}
          <section className="flex-1 min-h-[300px] flex flex-col bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 gap-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-extrabold bg-slate-100 dark:bg-slate-800/80 text-indigo-600 dark:text-indigo-400">
                <Package className="h-3.5 w-3.5" />
                <span>Chi tiết hàng cần mua</span>
                <span className="px-1.5 rounded-full text-[9.5px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black">{filledItemCount}</span>
              </div>
              <Button type="button" size="sm" variant="primary" onClick={() => { setLookupTargetRowIndex(null); setIsMaterialLookupOpen(true); }}
                icon={<Search className="h-3.5 w-3.5" />}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] py-1 px-2.5 h-[26px] shadow-2xs font-semibold">
                Tra cứu vật tư (F2)
              </Button>
            </div>

            <VoucherDetailGrid
              fill
              showAddButton={false}
              hiddenFields={hiddenPriceFields}
              gridInfo={purchaseRequestItemsGridConfig}
              data={formItems}
              onChange={(newItems) => setFormItems(newItems as VoucherItem[])}
              onLookupClick={(rowIndex) => { setLookupTargetRowIndex(rowIndex); setIsMaterialLookupOpen(true); }}
              onCodeSubmit={(rowIndex, field, codeValue) => handleCodeSubmit(rowIndex, field, codeValue)}
              currencyCode={formCurrencyCode}
              exchangeRate={formExchangeRate}
            />
          </section>

          {/* Thanh tóm tắt: phiếu và tổng tiền dự kiến (nút Lưu / Hủy nằm ở thanh tiêu đề của cửa sổ) */}
          <div className="shrink-0 flex items-center justify-between gap-3 flex-wrap px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] text-slate-500 font-medium">
              Phiếu <strong className="font-mono text-indigo-600 dark:text-indigo-400">{formCode}</strong>
              <span className="mx-1.5 text-slate-300">|</span>
              {filledItemCount} mặt hàng
            </span>
            {canViewPrice && (
              <span className="text-[11px] text-slate-500 font-medium">
                Giá trị dự kiến: <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">{formTotalValue.toLocaleString('vi-VN')} {formCurrencyCode}</strong>
              </span>
            )}
          </div>
        </form>
      </Modal>

      <DeleteConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmSingleDelete}
        itemCode={itemToDelete?.code}
        itemName={`Phiếu yêu cầu mua hàng ngày ${itemToDelete?.date}${canViewPrice ? ` (${formatVND(itemToDelete?.totalValue || 0)})` : ''}`}
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
        isOpen={isSupplierLookupOpen}
        onClose={() => setIsSupplierLookupOpen(false)}
        title="Tra Cứu & Chọn Nhà Cung Cấp Từ Danh Mục"
        subtitle="Chọn 1 nhà cung cấp đề nghị cho phiếu yêu cầu"
        data={suppliers}
        columns={supplierLookupColumns}
        idField="id"
        displayField="name"
        searchFields={['id', 'code', 'name', 'taxCode', 'phone']}
        searchPlaceholder="Nhập mã NCC, tên, MST hoặc số điện thoại..."
        selectionMode="single"
        selectedIds={[formSupplierCode].filter(Boolean)}
        onConfirm={handleConfirmSupplierLookup}
        pageSize={6}
      />

      <MasterLookupModal
        isOpen={isWarehouseLookupOpen}
        onClose={() => setIsWarehouseLookupOpen(false)}
        title="Tra Cứu & Chọn Kho Nhận Hàng Từ Danh Mục"
        subtitle="Chọn 1 kho hàng từ danh mục hệ thống để gán cho phiếu yêu cầu"
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
