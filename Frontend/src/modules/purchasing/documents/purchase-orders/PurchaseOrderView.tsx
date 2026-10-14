// Đơn mua hàng (pur_order): the order sent to a supplier. Same layout, statuses and approval as the other vouchers, but it never posts to
// the stock ledger (the goods receipts that receive it do). Lines can be pulled from approved purchase requests ("Lấy từ phiếu yêu
// cầu mua hàng"); the "Đã nhập" column shows what the goods receipts already receive. Project, payment term and tax are on the header.
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  ShoppingCart,
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
  User, RotateCcw } from 'lucide-react';
import { Button } from '../../../../components/common/Button';
import { RowActionSlot } from '../../../../components/common/RowActionSlot';
import { Modal } from '../../../../components/common/Modal';
import { Badge } from '../../../../components/common/Badge';
import { CategoryHeaderToolbar } from '../../../../components/common/CategoryHeaderToolbar';
import { DeleteConfirmModal } from '../../../../components/common/DeleteConfirmModal';
import { GridView, GridViewColumn } from '../../../../components/common/GridView';
import { MasterLookupModal, ColumnDef } from '../../../../components/common/MasterLookupModal';
import { NumberInput, DateTimePicker, ComboBox, VoucherDetailGrid } from '../../../../components/common';
import { useConfirm } from '../../../../components/common/ConfirmDialog';
import { purchaseOrderItemsGridConfig } from '../../../../mock/voucherGridConfigs';
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
import { purchaseOrdersApi, type OpenPurchaseRequest } from './api';
import { OpenDocumentPicker, type PickedLine, type PickerDocument } from '../OpenDocumentPicker';
import { CatalogLookup } from '../../../../components/catalog/CatalogLookup';

const FUNCTION = 'pur_order';

// Shared look of the header fields of a voucher form (same as the goods receipt and goods issue).
const VOUCHER_LABEL = 'block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5 truncate';
const VOUCHER_INPUT = 'w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 font-medium text-[11px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[26px]';
const VOUCHER_LOOKUP_BUTTON = 'px-1.5 h-[26px] bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs';

/** What the purchase is for. */
const PURPOSES = ['Mua hàng trong nước', 'Mua hàng nhập khẩu', 'Mua nguyên vật liệu sản xuất', 'Mua hàng hóa bán lại', 'Mua vật tư văn phòng / Công cụ'];

interface PurchaseOrderViewProps {
  companyUnits?: CompanyUnit[];
  activeUnitCode: string;
  currentUser?: UserProfile;
}

const today = () => new Date().toISOString().split('T')[0];
const emptyItem = (): VoucherItem => ({ productId: '', productName: '', sku: '', unit: '', quantity: 1, unitPrice: 0, totalPrice: 0, note: '', receivedQuantity: 0 });
const hasMaterial = (item: VoucherItem) => Boolean(item.productId || item.sku || item.productName);

/** The status filter of the form holds the labels the screens keep; the server filters by the status name. */
const STATUS_OF_LABEL: Record<string, string> = {
  'Lập chứng từ': 'Draft', 'Chờ duyệt': 'Pending', 'Đã phê duyệt': 'Approved', 'Hủy': 'Cancelled'
};

export const PurchaseOrderView: React.FC<PurchaseOrderViewProps> = ({ companyUnits = [], activeUnitCode, currentUser }) => {
  const [localVouchers, setLocalVouchers] = useState<GoodsVoucher[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [currencies, setCurrencies] = useState<{ code: string; name: string }[]>([]);
  const [taxRates, setTaxRates] = useState<{ code: string; name: string; rate: number }[]>([]);
  const [openRequests, setOpenRequests] = useState<OpenPurchaseRequest[]>([]);
  const [isRequestPickerOpen, setIsRequestPickerOpen] = useState(false);
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
      const [options, materials, supplierList] = await Promise.all([purchaseOrdersApi.getOptions(), loadMaterialOptions(), loadSupplierOptions()]);
      reloadListRef.current();
      setProducts(materials);
      setSuppliers(supplierList);
      setCurrencies(options.currencies);
      setTaxRates(options.taxRates);
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
  const [supplierFilter, setSupplierFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
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
  const [formDeliveryDate, setFormDeliveryDate] = useState('');
  // Two tabs under the header: the lines, and the delivery schedule (expected receipt date per line).
  const [detailTab, setDetailTab] = useState<'items' | 'delivery'>('items');
  const [formStatus, setFormStatus] = useState<string>('Lập chứng từ');
  const [formPurpose, setFormPurpose] = useState(PURPOSES[0]);
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formWarehouseName, setFormWarehouseName] = useState('');
  const [formPaymentTermCode, setFormPaymentTermCode] = useState('');
  const [formProjectCode, setFormProjectCode] = useState('');
  const [formTaxRateCode, setFormTaxRateCode] = useState('');
  const [formSupplierCode, setFormSupplierCode] = useState('');
  const [formSupplierName, setFormSupplierName] = useState('');
  const [formCurrencyCode, setFormCurrencyCode] = useState('VND');
  const [formExchangeRate, setFormExchangeRate] = useState<number>(1);
  const [formCreatedBy, setFormCreatedBy] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formItems, setFormItems] = useState<VoucherItem[]>([]);
  // The purchase requests the lines follow, read from the lines themselves (each carries the number of its request).
  const formRequestCode = useMemo(() => [...new Set(formItems.map(item => item.purchaseRequestCode).filter(Boolean) as string[])].join(','), [formItems]);
  // What each request line is already taken for by the lines of this form.
  const takenByForm = useMemo(() => formItems.reduce<Record<number, number>>((acc, item) => {
    if (item.purchaseRequestLineId) acc[item.purchaseRequestLineId] = (acc[item.purchaseRequestLineId] ?? 0) + (Number(item.quantity) || 0);
    return acc;
  }, {}), [formItems]);

  // Pickers
  const [isMaterialLookupOpen, setIsMaterialLookupOpen] = useState(false);
  const [isWarehouseLookupOpen, setIsWarehouseLookupOpen] = useState(false);
  const [isSupplierLookupOpen, setIsSupplierLookupOpen] = useState(false);
  const [lookupTargetRowIndex, setLookupTargetRowIndex] = useState<number | null>(null);

  useVoucherStatuses();
  const perm = getActionPermission(currentUser, FUNCTION);
  // "Duyệt" on the voucher or on its approval screen (Phê duyệt đơn mua hàng), as the backend.
  const canApprove = canApproveVoucher(currentUser, FUNCTION);
  const canViewPrice = hasRight(currentUser, FUNCTION, RIGHTS.VIEW_PRICE);
  const hiddenPriceFields = canViewPrice ? undefined : ['unitPrice', 'amount'];
  // An order is never posted: only Draft, Pending and Approved can be asked for.
  const statusChoices = saveStatusChoices(currentUser, FUNCTION, { voucherType: 'DMH', posts: false });
  const approvalInUse = voucherStatusService.isEnabled('DMH', 'Pending');
  const canSaveForm = !editingVoucherId ? perm.create : perm.edit && formStatus === 'Lập chứng từ';
  const canChooseStatus = canSaveForm && statusChoices.length > 1;
  const statusFromLabel = (label: string): SaveStatus =>
    (Object.keys(SAVE_STATUS_LABELS) as SaveStatus[]).find(key => SAVE_STATUS_LABELS[key] === label) ?? 'Draft';
  const shownStatus = canChooseStatus ? SAVE_STATUS_LABELS[saveStatus] : formStatus;

  // The server already lists only the orders of the unit.
  const orderVouchers = localVouchers;

  const activeFilterCount = useMemo(() => [codeFilter.trim(), purposeFilter, statusFilter, warehouseFilter, supplierFilter, projectFilter, fromDate, toDate]
    .filter(Boolean).length, [codeFilter, purposeFilter, statusFilter, warehouseFilter, supplierFilter, projectFilter, fromDate, toDate]);


  // ---- The list: the server filters, sorts and cuts the pages (backend VoucherListQuery, services/paging.ts) ------------------
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const debouncedSearch = useDebounced(searchText, 300);
  const debouncedCode = useDebounced(codeFilter, 300);
  const listFilters = useMemo(() => ({
    status: STATUS_OF_LABEL[statusFilter] ?? '', warehouse: warehouseFilter, voucherType: purposeFilter, supplier: supplierFilter, project: projectFilter,
    code: debouncedCode.trim(), from: fromDate, to: toDate
  }), [statusFilter, warehouseFilter, purposeFilter, supplierFilter, projectFilter, debouncedCode, fromDate, toDate]);
  const filterKey = `${JSON.stringify(listFilters)}|${debouncedSearch}|${sort ? `${sort.key}:${sort.dir}` : ''}|${pageSize}|${activeUnitCode}`;
  // A new search, filter, sort or page size starts again at the first page.
  useEffect(() => { setPage(1); }, [filterKey]);
  const listQuery = useMemo<PagedQuery>(() => ({
    page, pageSize, sort: sort?.key, dir: sort?.dir, search: debouncedSearch, filters: listFilters
  }), [page, pageSize, sort, debouncedSearch, listFilters]);
  const fetchPage = useCallback((query: PagedQuery) => purchaseOrdersApi.getPage(query), []);
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
    setSupplierFilter(''); setProjectFilter(''); setFromDate(''); setToDate(''); setSearchText('');
    showToast.info('Đã xóa tất cả bộ lọc!');
  };

  // ---------------------------------------------------------------------------------------------- open the form
  const handleOpenAdd = async () => {
    if (!perm.create) { showToast.error('Tài khoản của bạn không có quyền lập đơn mua hàng mới!'); return; }
    if (warehouses.length === 0) { showToast.error('Cần khai báo kho đang hoạt động trước khi lập đơn mua hàng.'); return; }
    const defaultUnit = companyUnits.find(c => c.code === activeUnitCode) || companyUnits[0];
    const defaultWh = warehouses[0];
    let newCode = 'Số tự động';
    try { newCode = await voucherNumberingApi.preview('DMH'); }
    catch (error) { showToast.error(getErrorMessage(error)); return; }

    setEditingVoucherId(null);
    setFormCompanyUnitName(defaultUnit?.name || activeUnitCode);
    setFormCode(newCode);
    setFormDate(today());
    setFormCreatedDate(today());
    setFormDeliveryDate('');
    setFormStatus('Lập chứng từ');
    setFormPurpose(PURPOSES[0]);
    setFormWarehouseId(defaultWh.id);
    setFormWarehouseName(defaultWh.name);
    setFormPaymentTermCode('');
    setFormProjectCode('');
    setFormTaxRateCode('');
    setFormSupplierCode('');
    setFormSupplierName('');
    setFormCurrencyCode('VND');
    setFormExchangeRate(1);
    setFormCreatedBy(currentUser?.fullName || '');
    setFormNote('');
    setFormItems([emptyItem()]);
    setSaveStatus('Draft');
    setDetailTab('items');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (voucher: GoodsVoucher) => {
    setEditingVoucherId(voucher.id);
    setFormCompanyUnitName(voucher.companyUnitName || activeUnitCode);
    setFormCode(voucher.code);
    setFormDate(voucher.date || today());
    setFormCreatedDate(voucher.createdDate || voucher.date || today());
    setFormDeliveryDate(voucher.deliveryDate || '');
    setFormStatus(voucher.status || 'Chờ duyệt');
    setFormPurpose(voucher.voucherType || PURPOSES[0]);
    setFormWarehouseId(voucher.warehouseId);
    setFormWarehouseName(voucher.warehouseName);
    setFormPaymentTermCode(voucher.paymentTermCode || '');
    setFormProjectCode(voucher.projectCode || '');
    setFormTaxRateCode(voucher.taxRateCode || '');
    setFormSupplierCode(voucher.supplierCode || '');
    setFormSupplierName(voucher.supplierName || '');
    setFormCurrencyCode(voucher.currencyCode || 'VND');
    setFormExchangeRate(voucher.exchangeRate || 1);
    setFormCreatedBy(voucher.createdBy || '');
    setFormNote(voucher.note || '');
    const mapped: VoucherItem[] = (voucher.items ?? []).map(it => ({
      productId: it.productId || '', productName: it.productName, sku: it.sku || '', unit: it.unit || '',
      quantity: it.quantity || 1, unitPrice: it.unitPrice || 0, totalPrice: (it.quantity || 1) * (it.unitPrice || 0),
      note: it.note || '', receivedQuantity: it.receivedQuantity ?? 0,
      purchaseRequestLineId: it.purchaseRequestLineId, purchaseRequestCode: it.purchaseRequestCode, deliveryDate: it.deliveryDate || ''
    }));
    setFormItems([...mapped, emptyItem()]);
    setSaveStatus('Draft');
    setIsModalOpen(true);
  };

  // Opened from a notification (e.g. "Chờ duyệt: {mã phiếu}"): show that voucher.
  useOpenDocumentRequest(FUNCTION, (documentId) => {
    const voucher = orderVouchers.find(v => v.code === documentId || v.id === documentId);
    if (voucher) { handleOpenEdit(voucher); return; }
    // Not on the page shown: ask the server for the voucher with that code.
    void purchaseOrdersApi.getPage({ page: 1, pageSize: 1, filters: { code: documentId } }).then(result => {
      const found = result.items.find(v => v.code === documentId);
      if (found) handleOpenEdit(found);
      else showToast.warning(`Không tìm thấy đơn mua hàng ${documentId}.`, 'Phiếu có thể đã bị xóa hoặc thuộc đơn vị khác.');
    }).catch(error => showToast.error(getErrorMessage(error)));
  });

  // The Excel file is made by the server from every row the filters leave (not only this page).
  const handleExportExcel = async () => {
    if (!perm.export) {
      showToast.error('Tài khoản của bạn không có quyền Xuất Excel!');
      return;
    }
    try { await purchaseOrdersApi.exportAll(listQuery); }
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
        quantity: 1, unitPrice: 0, totalPrice: 0, note: '', receivedQuantity: 0
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

  // "Lấy từ phiếu yêu cầu mua hàng": the approved requests with something left, read fresh every time. Editing a saved order, what it
  // already takes is not counted as ordered (the picker takes off what the form holds).
  const handleOpenRequestPicker = async () => {
    try {
      setOpenRequests(await purchaseOrdersApi.getOpenRequests(editingVoucherId ?? undefined));
      setIsRequestPickerOpen(true);
    } catch (error) { showToast.error(getErrorMessage(error)); }
  };

  const pickerDocuments = useMemo(() => openRequests.map(request => ({
    source: request,
    doc: {
      code: request.code, date: request.date, dueDate: request.requiredDate ? `Cần: ${request.requiredDate}` : null,
      info: [[request.departmentName || '', request.requesterName || ''], [request.supplierName || '', request.supplierCode || ''],
        [request.warehouseName, `${request.voucherType}${request.currencyCode !== 'VND' ? ` · ${request.currencyCode}` : ''}`]],
      lockKey: `${request.warehouseCode}|${request.currencyCode}`,
      searchText: [request.code, request.departmentName, request.requesterName, request.supplierName, request.warehouseName, request.voucherType,
        ...request.lines.flatMap(line => [line.materialCode, line.materialName])].join(' '),
      lines: request.lines.map(line => ({
        lineId: line.lineId, materialCode: line.materialCode, materialName: line.materialName, uomCode: line.uomCode,
        totalQuantity: line.requestedQuantity, remainingQuantity: line.remainingQuantity, unitPrice: line.unitPrice, note: line.note
      }))
    } as PickerDocument
  })), [openRequests]);

  /**
   * Carries the ticked materials (with the quantity chosen) into the lines: every line keeps the request line it carries out and the
   * number of its request. The header comes from the first request pulled; later ones must share its warehouse and currency (the
   * picker only lets those be ticked). A request line already in the form gets the quantity added to its line.
   */
  const handleConfirmRequest = (picked: PickedLine<OpenPurchaseRequest>[]) => {
    setIsRequestPickerOpen(false);
    if (picked.length === 0) return;
    const first = formRequestCode ? undefined : picked[0].source;
    const items = formItems.filter(hasMaterial).map(item => ({ ...item }));
    picked.forEach(({ source, line, quantity }) => {
      const existing = items.find(item => item.purchaseRequestLineId === line.lineId);
      if (existing) {
        existing.quantity = (Number(existing.quantity) || 0) + quantity;
        existing.totalPrice = existing.quantity * (existing.unitPrice || 0);
        existing.amount = existing.totalPrice;
        return;
      }
      items.push({
        productId: line.materialCode, sku: line.materialCode, productName: line.materialName, unit: line.uomCode,
        quantity, unitPrice: line.unitPrice, totalPrice: quantity * line.unitPrice, amount: quantity * line.unitPrice, note: line.note ?? '',
        receivedQuantity: 0, purchaseRequestLineId: line.lineId, purchaseRequestCode: source.code
      });
    });
    const codes = [...new Set(items.map(item => item.purchaseRequestCode).filter(Boolean) as string[])];
    if (first) {
      setFormPurpose(first.voucherType);
      setFormWarehouseId(first.warehouseCode);
      setFormWarehouseName(first.warehouseName);
      if (first.supplierCode && !formSupplierCode) { setFormSupplierCode(first.supplierCode); setFormSupplierName(first.supplierName || ''); }
      if (first.currencyCode !== formCurrencyCode) void handleCurrencyChange(first.currencyCode);
    }
    setFormNote(prev => prev.trim() && !formRequestCode && !prev.startsWith('Đặt hàng theo phiếu yêu cầu') ? prev : `Đặt hàng theo phiếu yêu cầu ${codes.join(', ')}`);
    setFormItems([...items, emptyItem()]);
    showToast.success(`Đã lấy ${picked.length} vật tư từ ${new Set(picked.map(p => p.source.code)).size} phiếu yêu cầu. Có thể sửa số lượng và đơn giá ở bảng chi tiết.`);
  };

  /** Unlinks the order from its requests: the lines stay but no longer follow a request line. */
  const handleClearRequest = () => {
    setFormItems(prev => prev.map(item => ({ ...item, purchaseRequestLineId: undefined, purchaseRequestCode: undefined })));
  };

  // ---------------------------------------------------------------------------------------------- totals and save
  const formSubTotal = useMemo(() => formItems.reduce((sum, item) => hasMaterial(item) ? sum + (item.totalPrice || (item.quantity || 0) * (item.unitPrice || 0)) : sum, 0), [formItems]);
  const formTaxPercent = taxRates.find(rate => rate.code === formTaxRateCode)?.rate ?? 0;
  const formTaxAmount = Math.round(formSubTotal * formTaxPercent) / 100;
  // Total in the base currency: (goods + tax) x exchange rate.
  const formTotalValue = (formSubTotal + formTaxAmount) * (formExchangeRate && formExchangeRate > 0 ? formExchangeRate : 1);

  const filledItemCount = formItems.filter(hasMaterial).length;
  // A line without its own date takes the delivery date of the header (changing a line by hand keeps it).
  useEffect(() => {
    if (!formDeliveryDate) return;
    if (formItems.some(item => hasMaterial(item) && !item.deliveryDate)) {
      setFormItems(prev => prev.map(item => hasMaterial(item) && !item.deliveryDate ? { ...item, deliveryDate: formDeliveryDate } : item));
    }
  }, [formItems, formDeliveryDate]);
  // Changing the header date moves the lines that still follow it; lines changed by hand keep their own date.
  const handleHeaderDeliveryDate = (value: string) => {
    setFormItems(prev => prev.map(item => hasMaterial(item) && (!item.deliveryDate || item.deliveryDate === formDeliveryDate) ? { ...item, deliveryDate: value } : item));
    setFormDeliveryDate(value);
  };
  const setLineDeliveryDate = (index: number, value: string) =>
    setFormItems(prev => prev.map((item, i) => i === index ? { ...item, deliveryDate: value } : item));
  const todayText = today();

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const asDraft = saveAsDraftRef.current;
    saveAsDraftRef.current = false;
    if (!canSaveForm) return;
    if (!(editingVoucherId ? perm.edit : perm.create)) { showToast.error('Tài khoản của bạn không có quyền cập nhật dữ liệu!'); return; }
    if (!formCode.trim()) { showToast.error('Vui lòng nhập số chứng từ!'); return; }
    const validItems = formItems.filter(hasMaterial);
    if (!formSupplierCode) { showToast.error('Vui lòng chọn nhà cung cấp trong danh mục!'); return; }
    if (validItems.length === 0) { showToast.error('Vui lòng khai báo ít nhất một mặt hàng cần mua!'); return; }

    const warehouseObj = warehouses.find(w => w.id === formWarehouseId || w.name === formWarehouseName);
    const savedVoucher: GoodsVoucher = {
      id: editingVoucherId || '0',
      version: localVouchers.find(v => v.id === editingVoucherId)?.version,
      type: 'Đơn mua hàng', code: formCode.trim(), date: formDate, createdDate: formCreatedDate, deliveryDate: formDeliveryDate,
      companyUnitId: activeUnitCode, companyUnitName: formCompanyUnitName,
      voucherType: formPurpose, currencyCode: formCurrencyCode, exchangeRate: formExchangeRate,
      supplierCode: formSupplierCode, supplierName: formSupplierName.trim(), paymentTermCode: formPaymentTermCode, projectCode: formProjectCode, taxRateCode: formTaxRateCode,
      purchaseRequestCode: formRequestCode,
      warehouseId: formWarehouseId, warehouseName: warehouseObj?.name || formWarehouseName,
      items: validItems, totalValue: formTotalValue, subTotal: formSubTotal, taxAmount: formTaxAmount, taxRate: formTaxPercent, createdBy: formCreatedBy || currentUser?.fullName || '',
      status: editingVoucherId ? formStatus : 'Lập chứng từ', note: formNote.trim()
    };

    setIsSaving(true);
    try {
      const target = asDraft ? 'Draft' : saveStatus;
      const result = editingVoucherId ? await purchaseOrdersApi.update(savedVoucher, target) : await purchaseOrdersApi.create(savedVoucher, target);
      setLocalVouchers(prev => editingVoucherId ? prev.map(v => v.id === editingVoucherId ? result : v) : [result, ...prev]);
      reloadListRef.current();
      showToast.success(`Đã lưu đơn mua hàng [${result.code}], trạng thái: ${result.status}.`);
      setIsModalOpen(false);
    } catch (error) {
      showToast.error(getErrorMessage(error));
      await loadData();
    } finally {
      setIsSaving(false);
    }
  };

  const confirm = useConfirm();
  const handleQuickStatusChange = async (voucherId: string, action: 'submit' | 'withdraw' | 'approve' | 'cancel' | 'reopen') => {
    // Cancelling and unposting cannot be taken back with one click: ask first (a cancelled voucher can be restored with Khôi phục).
    if (action === 'cancel') {
      const code = localVouchers.find(v => v.id === voucherId)?.code ?? '';
      const ok = await confirm({ title: `Hủy đơn mua hàng ${code}?`, message: 'Phiếu bị hủy không dùng được nữa. Nếu hủy nhầm, bấm Khôi phục để đưa phiếu về Lập chứng từ.', tone: 'warning', confirmLabel: 'Hủy phiếu', cancelLabel: 'Không' });
      if (!ok) return;
    }
    try {
      const result = await purchaseOrdersApi.changeStatus(voucherId, action);
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
      await purchaseOrdersApi.remove(itemToDelete.id);
      setLocalVouchers(prev => prev.filter(v => v.id !== itemToDelete.id));
      reloadListRef.current();
      showToast.success(`Đã xóa đơn mua hàng [${itemToDelete.code}].`);
      setItemToDelete(null);
    } catch (error) { showToast.error(getErrorMessage(error)); }
  };

  const handleConfirmBulkDelete = async () => {
    if (!bulkToDeleteIds || bulkToDeleteIds.length === 0) return;
    const results = await Promise.allSettled(bulkToDeleteIds.map(id => purchaseOrdersApi.remove(id)));
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
      kind: 'purchaseOrder', withPrice: withPrice && canViewPrice, voucher, company: systemSettingsService.getCompanyProfile(),
      format: { quantity: formatQuantity, unitPrice: formatUnitPrice, amount: value => formatNumber(value) },
      printedBy: currentUser?.fullName
    });
    if (!opened) showToast.error('Trình duyệt đã chặn cửa sổ in.');
  };

  // ---------------------------------------------------------------------------------------------- list
  const renderStatusBadge = (status?: string) => <VoucherStatusBadge voucherType="DMH" label={status} />;

  const columns: GridViewColumn<GoodsVoucher>[] = [
    {
      key: 'code', title: 'Số Chứng Từ / Ngày', sortable: true,
      render: (v) => (
        <div className="space-y-0.5">
          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs hover:underline cursor-pointer" onClick={() => handleOpenEdit(v)}>{v.code}</span>
          <p className="text-[10px] text-slate-400">Ngày CT: <span className="font-semibold text-slate-600 dark:text-slate-300">{v.date}</span></p>
          {v.deliveryDate && <p className="text-[10px] text-slate-400">Giao hàng: <span className="font-semibold text-amber-600 dark:text-amber-400">{v.deliveryDate}</span></p>}
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
      key: 'supplier', title: 'Nhà Cung Cấp / Dự Án', sortable: true,
      render: (v) => (
        <div className="space-y-0.5 text-xs">
          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[220px]" title={v.supplierName}>{v.supplierName || v.supplierCode || '—'}</p>
          {v.projectCode && <p className="text-[10px] text-slate-400">Dự án: <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">{v.projectCode}</span></p>}
          {v.purchaseRequestCode && <p className="text-[10px] text-slate-400 truncate max-w-[220px]" title={v.purchaseRequestCode}>Theo YC: <span className="font-mono">{v.purchaseRequestCode}</span></p>}
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
      key: 'items', title: 'Hàng Đặt / Đã Nhập',
      render: (v) => {
        const items = v.items ?? [];
        const requested = items.reduce((sum, i) => sum + i.quantity, 0);
        const received = items.reduce((sum, i) => sum + (i.receivedQuantity ?? 0), 0);
        const done = requested > 0 && received >= requested;
        return (
          <div className="space-y-1 max-w-xs">
            {items.slice(0, 2).map((it, idx) => (
              <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 truncate">• <span className="font-medium">{it.productName}</span> ({it.quantity} {it.unit || ''})</div>
            ))}
            {items.length > 2 && <div className="text-[10px] font-semibold text-indigo-500 italic">+ thêm {items.length - 2} mặt hàng khác</div>}
            <div className={`text-[10px] font-bold ${done ? 'text-emerald-600 dark:text-emerald-400' : received > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
              Đã nhập {formatQuantity(received)} / {formatQuantity(requested)}{done ? ' · đủ' : ''}
            </div>
          </div>
        );
      }
    },
    {
      key: 'totalValue', title: 'Giá Trị Đơn (VNĐ)', sortable: true, align: 'right',
      render: (v) => <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">{formatVND(v.totalValue)}</span>
    },
    { key: 'status', title: 'Trạng Thái Phiếu', sortable: true, render: (v) => renderStatusBadge(v.status) },
    {
      key: 'actions', title: 'Thao Tác', align: 'center',
      render: (v) => (
        <div className="flex items-center justify-center gap-1">
          <RowActionSlot>
              <button type="button" onClick={() => handleOpenEdit(v)} title="Xem & Sửa đơn mua hàng"
                className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"><Edit3 className="h-4 w-4" /></button>
          </RowActionSlot>
          <RowActionSlot>
              {v.status === 'Hủy' && reachesStatus(currentUser, FUNCTION, 'Cancelled') && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'reopen')} title="Khôi phục phiếu đã hủy (về Lập chứng từ)"
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"><RotateCcw className="h-4 w-4" /></button>
              )}
              {v.status === 'Lập chứng từ' && (perm.create || perm.edit) && approvalInUse && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'submit')} title="Gửi duyệt đơn mua hàng"
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"><ArrowUpRight className="h-4 w-4" /></button>
              )}
              {v.status === 'Chờ duyệt' && canApprove && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'approve')} title="Phê duyệt đơn mua hàng"
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"><ShieldCheck className="h-4 w-4" /></button>
              )}
          </RowActionSlot>
          <RowActionSlot>
              {v.status === 'Chờ duyệt' && v.createdBy === currentUser?.fullName && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'withdraw')} title="Rút phiếu khỏi quy trình duyệt"
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg"><Undo2 className="h-4 w-4" /></button>
              )}
              {v.status === 'Đã phê duyệt' && reachesStatus(currentUser, FUNCTION, 'Cancelled') && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'cancel')} title="Hủy đơn mua hàng (khi chưa có phiếu nhập)"
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"><XCircle className="h-4 w-4" /></button>
              )}
          </RowActionSlot>
          <RowActionSlot>
              {perm.print && <PrintMenuButton canPrintPrice={canViewPrice} onPrint={withPrice => handlePrint(v.code, withPrice)} />}
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
        icon={<ShoppingCart className="h-6 w-6 text-amber-400" />}
        title="Danh Mục Đơn Mua Hàng (Purchase Orders)"
        subtitle="Đặt hàng nhà cung cấp: lập, duyệt, theo dõi số đã nhập kho theo các phiếu nhập"
        count={totalVouchers}
        countLabel="Đơn Mua Hàng"
        showAdvancedFilter={showAdvancedFilter}
        onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
        activeFilterCount={activeFilterCount}
        onRefresh={() => { void loadData(); }}
        onExportExcel={perm.export ? handleExportExcel : undefined}
        addLabel="Lập Đơn Mua Hàng Mới"
        canCreate={perm.create}
        onOpenAdd={handleOpenAdd}
        filterPanelContent={
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
            <div><label className={filterLabel}>Mã / Số Chứng Từ</label>
              <input type="text" placeholder="DMH-202610-01..." value={codeFilter} onChange={(e) => setCodeFilter(e.target.value)} className={filterInput} /></div>
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
            <div><label className={filterLabel}>Nhà Cung Cấp</label>
              <select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className={filterInput}>
                <option value="">-- Tất cả nhà cung cấp --</option>
                {suppliers.map(sup => <option key={sup.code} value={sup.code}>{sup.name}</option>)}
              </select></div>
            <div><label className={filterLabel}>Dự Án</label>
              <CatalogLookup lookup="projects" value={projectFilter} onChange={code => setProjectFilter(code)} /></div>
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
        searchPlaceholder="Tìm kiếm số đơn, nhà cung cấp, dự án, kho, sản phẩm..."
        searchValue={searchText}
        onSearchChange={setSearchText}
        selectable={true}
        selectedIds={selectedIds}
        onSelectionChange={(ids) => setSelectedIds(ids.map(String))}
        batchActions={perm.delete ? [{
          label: 'Xóa các phiếu đã chọn', icon: <Trash2 className="h-3.5 w-3.5 text-rose-500" />, variant: 'danger',
          onClick: (_, ids) => setBulkToDeleteIds(ids.map(String))
        }] : []}
        emptyText="Không tìm thấy đơn mua hàng nào phù hợp."
        pageSize={pageSize}
        pageSizeOptions={[10, 15, 20, 30, 50, 100]}
        dense={true}
      />

      {/* FORM: VIEW & EDIT / CREATE AN ISSUE REQUEST */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingVoucherId ? `Chi Tiết & Cập Nhật Đơn Mua Hàng: [${formCode}]` : 'Lập Đơn Mua Hàng Mới'}
        fullScreen={true}
        headerActions={
          <div className="flex items-center gap-2 shrink-0">
            {editingVoucherId && perm.print && <PrintMenuButton variant="button" canPrintPrice={canViewPrice} onPrint={withPrice => handlePrint(formCode, withPrice)} />}
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} icon={<XCircle className="h-3.5 w-3.5 text-slate-500" />}
              className="py-1 px-3 text-xs font-medium cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700">
              Hủy
            </Button>
            <Button type="button" variant="secondary" size="sm" icon={<Save className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
              onClick={() => { saveAsDraftRef.current = true; (document.getElementById('purchase-order-form') as HTMLFormElement | null)?.requestSubmit(); }}
              disabled={isSaving || !canSaveForm} title="Lưu phiếu ở trạng thái Lập chứng từ, dù ô Trạng thái đang chọn gì"
              className="py-1 px-3 text-xs font-semibold cursor-pointer bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900">
              Lưu Nháp
            </Button>
            <Button type="submit" variant="success" size="sm" icon={<CheckCircle2 className="h-3.5 w-3.5 text-white" />}
              onClick={() => { (document.getElementById('purchase-order-form') as HTMLFormElement | null)?.requestSubmit(); }}
              disabled={isSaving || !canSaveForm}
              className="py-1 px-4 text-xs font-bold cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-emerald-600">
              {saveStatus === 'Draft' ? (editingVoucherId ? 'Lưu & Cập Nhật' : 'Lưu Đơn Mua Hàng') : `Lưu và ${saveStatusName('DMH', saveStatus).toLowerCase()}`}
            </Button>
          </div>
        }
      >
        <form id="purchase-order-form" onSubmit={handleSubmitForm} className="flex-1 min-h-0 flex flex-col gap-2 text-xs overflow-y-auto custom-scrollbar pt-2 pr-1">

          {/* I. THÔNG TIN NGHIỆP VỤ (trái) và II. CHỨNG TỪ & TIỀN TỆ (phải), như phiếu nhập / xuất kho */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 text-xs shrink-0">
            <div className="md:col-span-8 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between h-6 pb-1 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Tag className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate">I. Thông Tin Nghiệp Vụ & Nhà Cung Cấp</h4>
                </div>
                <span className="text-[10px] font-medium text-slate-400 shrink-0 hidden sm:inline">Đặt hàng nhà cung cấp</span>
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
                  <label className={VOUCHER_LABEL}>Nhà Cung Cấp <span className="text-rose-500">*</span></label>
                  <div className="flex items-center gap-1">
                    <input type="text" required placeholder="Chọn nhà cung cấp trong danh mục" value={formSupplierName} readOnly
                      onClick={() => setIsSupplierLookupOpen(true)} className={`${VOUCHER_INPUT} cursor-pointer`} />
                    <button type="button" onClick={() => setIsSupplierLookupOpen(true)} className={VOUCHER_LOOKUP_BUTTON} title="Tra cứu danh mục Nhà cung cấp"><Search className="h-3 w-3" /></button>
                  </div>
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Điều Khoản Thanh Toán</label>
                  <CatalogLookup lookup="paymentTerms" value={formPaymentTermCode} onChange={code => setFormPaymentTermCode(code)} />
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Dự Án</label>
                  <CatalogLookup lookup="projects" value={formProjectCode} onChange={code => setFormProjectCode(code)} />
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Thuế Suất</label>
                  <select value={formTaxRateCode} onChange={(e) => setFormTaxRateCode(e.target.value)} className={VOUCHER_INPUT}>
                    <option value="">-- Không có thuế --</option>
                    {taxRates.map(rate => <option key={rate.code} value={rate.code}>{rate.name} ({rate.rate}%)</option>)}
                  </select>
                </div>

                <div>
                  <DateTimePicker label="Ngày Dự Kiến Nhận Hàng (mặc định cho các dòng)" type="date" value={formDeliveryDate} onChange={(val) => handleHeaderDeliveryDate(val)} />
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Theo Phiếu Yêu Cầu</label>
                  <div className="flex items-center gap-1">
                    <input type="text" readOnly value={formRequestCode} placeholder="Chưa lấy từ phiếu yêu cầu" className={`${VOUCHER_INPUT} font-mono`} title={formRequestCode} />
                    {formRequestCode && <button type="button" onClick={handleClearRequest} className={VOUCHER_LOOKUP_BUTTON} title="Bỏ liên kết với phiếu yêu cầu"><XCircle className="h-3 w-3" /></button>}
                  </div>
                </div>

                <div className="sm:col-span-2 xl:col-span-3">
                  <label className={VOUCHER_LABEL}>Ghi Chú / Diễn Giải Nghiệp Vụ</label>
                  <input type="text" placeholder="Ví dụ: Đặt vật tư cho dự án lắp đặt tháng 11..." value={formNote}
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
                  <input type="text" required value={formCode} readOnly placeholder="DMH-202610-001"
                    className="w-full bg-indigo-50/40 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 rounded-lg px-1.5 py-0.5 font-mono font-black text-indigo-700 dark:text-indigo-300 text-[10.5px] h-[26px]" />
                </div>
                <div>
                  <label className={VOUCHER_LABEL}>Trạng Thái <span className="text-rose-500">*</span></label>
                  <select required value={shownStatus} disabled={!canChooseStatus} onChange={e => setSaveStatus(statusFromLabel(e.target.value))}
                    title={canChooseStatus ? 'Chọn trạng thái lưu phiếu, theo quyền của bạn' : undefined}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 font-extrabold text-slate-800 dark:text-slate-100 text-[10.5px] h-[26px]">
                    {canChooseStatus
                      ? statusChoices.map(choice => <option key={choice} value={SAVE_STATUS_LABELS[choice]}>{saveStatusName('DMH', choice)}</option>)
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
                      if (!editingVoucherId) voucherNumberingApi.preview('DMH', val).then(setFormCode).catch(error => showToast.error(getErrorMessage(error)));
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
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setDetailTab('items')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-extrabold cursor-pointer ${detailTab === 'items' ? 'bg-slate-100 dark:bg-slate-800/80 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                  <Package className="h-3.5 w-3.5" />
                  <span>Chi tiết hàng đặt mua</span>
                  <span className="px-1.5 rounded-full text-[9.5px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black">{filledItemCount}</span>
                </button>
                <button type="button" onClick={() => setDetailTab('delivery')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-extrabold cursor-pointer ${detailTab === 'delivery' ? 'bg-slate-100 dark:bg-slate-800/80 text-indigo-600 dark:text-indigo-400' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                  <Clock className="h-3.5 w-3.5" />
                  <span>Lịch giao hàng</span>
                </button>
              </div>
              {detailTab === 'items' && <><Button type="button" size="sm" variant="primary" onClick={() => { setLookupTargetRowIndex(null); setIsMaterialLookupOpen(true); }}
                icon={<Search className="h-3.5 w-3.5" />}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] py-1 px-2.5 h-[26px] shadow-2xs font-semibold">
                Tra cứu vật tư (F2)
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => void handleOpenRequestPicker()} icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                disabled={!canSaveForm} className="text-[10.5px] py-1 px-2.5 h-[26px] font-semibold">
                Lấy từ phiếu yêu cầu mua hàng
              </Button></>}
            </div>

            {detailTab === 'delivery' ? (
              <div className="flex-1 min-h-0 overflow-auto border border-slate-200 dark:border-slate-800 rounded-[5px]">
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
                  <span>Mỗi dòng mặc định theo ngày ở đầu đơn; sửa riêng ngày của vật tư nào giao khác. Dòng quá hạn mà còn thiếu hàng được tô đỏ.</span>
                  <Button type="button" size="sm" variant="outline" disabled={!canSaveForm || !formDeliveryDate} className="text-[10.5px] py-1 px-2.5 h-[26px] font-semibold"
                    onClick={() => setFormItems(prev => prev.map(item => hasMaterial(item) ? { ...item, deliveryDate: formDeliveryDate } : item))}>
                    Đặt lại theo ngày đầu đơn
                  </Button>
                </div>
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-left">
                    <tr><th className="px-2 py-1.5 w-10">#</th><th className="px-2 py-1.5">Mã VT</th><th className="px-2 py-1.5">Tên vật tư</th><th className="px-2 py-1.5 text-center">ĐVT</th>
                      <th className="px-2 py-1.5 text-right">SL đặt</th><th className="px-2 py-1.5 text-right">Đã nhập</th><th className="px-2 py-1.5 text-right">Còn thiếu</th>
                      <th className="px-2 py-1.5 w-44">Ngày dự kiến nhận</th></tr>
                  </thead>
                  <tbody>
                    {formItems.map((item, index) => {
                      if (!hasMaterial(item)) return null;
                      const missing = (item.quantity || 0) - (item.receivedQuantity ?? 0);
                      const late = !!item.deliveryDate && item.deliveryDate < todayText && missing > 0 && !!editingVoucherId;
                      return (
                        <tr key={index} className={`border-t border-slate-100 dark:border-slate-800 ${late ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''}`}>
                          <td className="px-2 py-1.5 text-slate-400">{index + 1}</td>
                          <td className="px-2 py-1.5 font-mono font-bold">{item.sku || item.productId}</td>
                          <td className="px-2 py-1.5">{item.productName}</td>
                          <td className="px-2 py-1.5 text-center">{item.unit}</td>
                          <td className="px-2 py-1.5 text-right font-mono">{formatQuantity(item.quantity || 0)}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-slate-500">{formatQuantity(item.receivedQuantity ?? 0)}</td>
                          <td className={`px-2 py-1.5 text-right font-mono font-bold ${missing > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-emerald-700 dark:text-emerald-400'}`}>{formatQuantity(Math.max(missing, 0))}</td>
                          <td className="px-2 py-1.5">
                            <input type="date" value={item.deliveryDate || ''} min={formDate || undefined} disabled={!canSaveForm}
                              onChange={e => setLineDeliveryDate(index, e.target.value)} title={late ? 'Đã quá ngày dự kiến nhận mà còn thiếu hàng' : undefined}
                              className={`w-full rounded-[5px] border px-1.5 py-0.5 font-mono bg-white dark:bg-slate-900 ${late ? 'border-rose-500 text-rose-600 font-bold' : 'border-slate-300 dark:border-slate-700'}`} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
            <VoucherDetailGrid
              fill
              showAddButton={false}
              hiddenFields={hiddenPriceFields}
              gridInfo={purchaseOrderItemsGridConfig}
              data={formItems}
              onChange={(newItems) => setFormItems(newItems as VoucherItem[])}
              onLookupClick={(rowIndex) => { setLookupTargetRowIndex(rowIndex); setIsMaterialLookupOpen(true); }}
              onCodeSubmit={(rowIndex, field, codeValue) => handleCodeSubmit(rowIndex, field, codeValue)}
              currencyCode={formCurrencyCode}
              exchangeRate={formExchangeRate}
            />
            )}
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
                Tiền hàng: <strong className="font-mono">{formSubTotal.toLocaleString('vi-VN')}</strong>
                <span className="mx-1.5 text-slate-300">|</span>
                Thuế{formTaxPercent ? ` ${formTaxPercent}%` : ''}: <strong className="font-mono">{formTaxAmount.toLocaleString('vi-VN')}</strong>
                <span className="mx-1.5 text-slate-300">|</span>
                Tổng cộng: <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">{(formSubTotal + formTaxAmount).toLocaleString('vi-VN')} {formCurrencyCode}</strong>
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
        itemName={`Đơn mua hàng ngày ${itemToDelete?.date}${canViewPrice ? ` (${formatVND(itemToDelete?.totalValue || 0)})` : ''}`}
      />
      <DeleteConfirmModal
        isOpen={!!bulkToDeleteIds && bulkToDeleteIds.length > 0}
        onClose={() => setBulkToDeleteIds(null)}
        onConfirm={handleConfirmBulkDelete}
        isBulk
        bulkCount={bulkToDeleteIds?.length || 0}
      />

      {/* Approved purchase requests with something left to order: requests on top, their materials below */}
      <OpenDocumentPicker<OpenPurchaseRequest>
        isOpen={isRequestPickerOpen}
        onClose={() => setIsRequestPickerOpen(false)}
        documents={pickerDocuments}
        taken={takenByForm}
        lockedKey={formRequestCode ? `${formWarehouseId}|${formCurrencyCode}` : undefined}
        texts={{
          title: 'Lấy Vật Tư Từ Phiếu Yêu Cầu Mua Hàng',
          help: 'Chọn một phiếu yêu cầu ở danh sách phía trên, rồi tích các vật tư cần đặt ở bảng phía dưới (đổi số lượng nếu chỉ đặt một phần). Có thể lấy từ nhiều phiếu, miễn là cùng kho nhận và cùng loại tiền. Vật tư đã đặt đủ không hiện; vật tư còn thì hiện số lượng còn lại.',
          searchPlaceholder: 'Tìm số phiếu, bộ phận, người yêu cầu, nhà cung cấp, vật tư...',
          empty: 'Không có phiếu yêu cầu mua hàng nào còn hàng chưa đặt.',
          codeHeader: 'Số phiếu yêu cầu', infoHeaders: ['Bộ phận / người yêu cầu', 'Nhà cung cấp đề nghị', 'Kho / loại mua'],
          totalHeader: 'SL yêu cầu', doneHeader: 'Đã đặt', confirm: 'Lấy {n} vật tư sang đơn mua hàng',
          lockedHint: 'khác kho hoặc loại tiền với các vật tư đã chọn, không đặt chung một đơn được', sourceName: 'phiếu yêu cầu'
        }}
        onConfirm={handleConfirmRequest}
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
        subtitle="Chọn 1 nhà cung cấp cho đơn mua hàng"
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
        subtitle="Chọn 1 kho hàng từ danh mục hệ thống để gán cho đơn mua hàng"
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
