// Hóa đơn mua hàng (pur_invoice): the invoice of a supplier, the ground of what is owed to it (công nợ phải trả). Same layout, statuses and
// approval as the other vouchers, but it never posts to a ledger yet. Lines are pulled from goods receipts ("Lấy từ phiếu nhập kho") and / or
// approved orders ("Lấy từ đơn mua hàng") of the same supplier and currency; the quantity billed never passes what was received or ordered.
// The invoice number / series / date are the ones printed on the supplier's invoice; the due date comes from the payment term when left empty.
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Receipt,
  ClipboardCheck,
  ArrowUpRight,
  CheckCircle2,
  ShieldCheck,
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
  CalendarClock,
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
import { purchaseInvoiceItemsGridConfig } from '../../../../mock/voucherGridConfigs';
import { useNumberFormat } from '../../../../context/NumberFormatContext';
import { systemSettingsService } from '../../../../services/systemSettingsService';
import { PrintMenuButton } from '../../../inventory/documents/PrintMenuButton';
import { printVoucher } from '../../../inventory/documents/voucherPrint';
import { GoodsVoucher, VoucherItem, Product, CompanyUnit, UserProfile } from '../../../../types';
import { SAVE_STATUS_LABELS, saveStatusChoices, saveStatusName, type SaveStatus } from '../../../inventory/documents/SaveStatusSelect';
import { VoucherStatusBadge } from '../../../inventory/documents/VoucherStatusBadge';
import { useVoucherStatuses, voucherStatusService } from '../../../../services/voucherStatusService';
import { reachesStatus } from '../../../../utils/documentPolicy';
import { getActionPermission } from '../../../../mock/initialRoles';
import { hasRight, RIGHTS } from '../../../../utils/permissions';
import { useOpenDocumentRequest } from '../../../../utils/documentLinks';
import { useDebounced } from '../../../../hooks/useDebounced';
import { usePagedList } from '../../../../hooks/usePagedList';
import type { PagedQuery } from '../../../../services/paging';
import { showToast } from '../../../../utils/toast';
import { getErrorMessage } from '../../../../services/apiClient';
import { loadMaterialOptions, loadSupplierOptions, type SupplierOption } from '../../../../services/lookupOptions';
import { voucherNumberingApi, exchangeRatesApi } from '../../../../services/settingsApi';
import { purchaseInvoicesApi, type OpenInvoiceOrder, type OpenInvoiceReceipt } from './api';
import { OpenDocumentPicker, type PickedLine, type PickerDocument } from '../OpenDocumentPicker';
import { CatalogLookup } from '../../../../components/catalog/CatalogLookup';

const FUNCTION = 'pur_invoice';

// Shared look of the header fields of a voucher form (same as the goods receipt and goods issue).
const VOUCHER_LABEL = 'block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5 truncate';
const VOUCHER_INPUT = 'w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 font-medium text-[11px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[26px]';
const VOUCHER_LOOKUP_BUTTON = 'px-1.5 h-[26px] bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs';

/** What the invoice is for. */
const KINDS = ['Hóa đơn hàng hóa', 'Hóa đơn dịch vụ', 'Hóa đơn hàng nhập khẩu', 'Hóa đơn tài sản / công cụ'];

interface PurchaseInvoiceViewProps {
  companyUnits?: CompanyUnit[];
  activeUnitCode: string;
  currentUser?: UserProfile;
}

const today = () => new Date().toISOString().split('T')[0];
const emptyItem = (): VoucherItem => ({ productId: '', productName: '', sku: '', unit: '', quantity: 1, unitPrice: 0, totalPrice: 0, note: '' });
const hasMaterial = (item: VoucherItem) => Boolean(item.productId || item.sku || item.productName);

/** The status filter of the form holds the labels the screens keep; the server filters by the status name. */
const STATUS_OF_LABEL: Record<string, string> = {
  'Lập chứng từ': 'Draft', 'Chờ duyệt': 'Pending', 'Đã phê duyệt': 'Approved', 'Hủy': 'Cancelled'
};

export const PurchaseInvoiceView: React.FC<PurchaseInvoiceViewProps> = ({ companyUnits = [], activeUnitCode, currentUser }) => {
  const [localVouchers, setLocalVouchers] = useState<GoodsVoucher[]>([]);
  const [currencies, setCurrencies] = useState<{ code: string; name: string }[]>([]);
  const [taxRates, setTaxRates] = useState<{ code: string; name: string; rate: number }[]>([]);
  const [openReceipts, setOpenReceipts] = useState<OpenInvoiceReceipt[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenInvoiceOrder[]>([]);
  const [isReceiptPickerOpen, setIsReceiptPickerOpen] = useState(false);
  const [isOrderPickerOpen, setIsOrderPickerOpen] = useState(false);
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
      const [options, materials, supplierList] = await Promise.all([purchaseInvoicesApi.getOptions(), loadMaterialOptions(), loadSupplierOptions()]);
      reloadListRef.current();
      setProducts(materials);
      setSuppliers(supplierList);
      setCurrencies(options.currencies);
      setTaxRates(options.taxRates);
    } catch (error) {
      showToast.error(getErrorMessage(error));
    }
  };

  useEffect(() => { void loadData(); }, [activeUnitCode]);

  // Filter & search
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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
  const [formInvoiceNo, setFormInvoiceNo] = useState('');
  const [formInvoiceSeries, setFormInvoiceSeries] = useState('');
  const [formInvoiceDate, setFormInvoiceDate] = useState(today());
  // Empty = the server takes the invoice date plus the days of the payment term.
  const [formDueDate, setFormDueDate] = useState('');
  const [formStatus, setFormStatus] = useState<string>('Lập chứng từ');
  const [formKind, setFormKind] = useState(KINDS[0]);
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
  // The receipts and orders the lines bill, read from the lines themselves (each carries the number of its source).
  const formReceiptCode = useMemo(() => [...new Set(formItems.map(item => item.goodsReceiptCode).filter(Boolean) as string[])].join(','), [formItems]);
  const formOrderCode = useMemo(() => [...new Set(formItems.map(item => item.purchaseOrderCode).filter(Boolean) as string[])].join(','), [formItems]);
  // What each receipt line / order line is already taken for by the lines of this form (an order line also counts the lines that come from its receipts).
  const takenByReceiptLine = useMemo(() => formItems.reduce<Record<number, number>>((acc, item) => {
    if (item.goodsReceiptLineId) acc[item.goodsReceiptLineId] = (acc[item.goodsReceiptLineId] ?? 0) + (Number(item.quantity) || 0);
    return acc;
  }, {}), [formItems]);
  const takenByOrderLine = useMemo(() => formItems.reduce<Record<number, number>>((acc, item) => {
    if (item.purchaseOrderLineId) acc[item.purchaseOrderLineId] = (acc[item.purchaseOrderLineId] ?? 0) + (Number(item.quantity) || 0);
    return acc;
  }, {}), [formItems]);

  // Pickers
  const [isMaterialLookupOpen, setIsMaterialLookupOpen] = useState(false);
  const [isSupplierLookupOpen, setIsSupplierLookupOpen] = useState(false);
  const [lookupTargetRowIndex, setLookupTargetRowIndex] = useState<number | null>(null);

  useVoucherStatuses();
  const perm = getActionPermission(currentUser, FUNCTION);
  // "Duyệt" on the voucher or on its approval screen (Phê duyệt hóa đơn mua hàng), as the backend.
  // Approving is a status right of the unit (own vouchers too); the approval rules only say whom to notify.
  const canApprove = reachesStatus(currentUser, FUNCTION, 'Approved');
  const canViewPrice = hasRight(currentUser, FUNCTION, RIGHTS.VIEW_PRICE);
  const hiddenPriceFields = canViewPrice ? undefined : ['unitPrice', 'amount'];
  // An invoice is never posted: only Draft, Pending and Approved can be asked for.
  const statusChoices = saveStatusChoices(currentUser, FUNCTION, { voucherType: 'HDM', posts: false });
  const approvalInUse = voucherStatusService.isEnabled('HDM', 'Pending');
  const canSaveForm = !editingVoucherId ? perm.create : perm.edit && formStatus === 'Lập chứng từ';
  const canChooseStatus = canSaveForm && statusChoices.length > 1;
  const statusFromLabel = (label: string): SaveStatus =>
    (Object.keys(SAVE_STATUS_LABELS) as SaveStatus[]).find(key => SAVE_STATUS_LABELS[key] === label) ?? 'Draft';
  const shownStatus = canChooseStatus ? SAVE_STATUS_LABELS[saveStatus] : formStatus;

  // The server already lists only the invoices of the unit.
  const invoiceVouchers = localVouchers;

  const activeFilterCount = useMemo(() => [codeFilter.trim(), kindFilter, statusFilter, supplierFilter, projectFilter, fromDate, toDate]
    .filter(Boolean).length, [codeFilter, kindFilter, statusFilter, supplierFilter, projectFilter, fromDate, toDate]);

  // ---- The list: the server filters, sorts and cuts the pages (backend VoucherListQuery, services/paging.ts) ------------------
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const debouncedSearch = useDebounced(searchText, 300);
  const debouncedCode = useDebounced(codeFilter, 300);
  const listFilters = useMemo(() => ({
    status: STATUS_OF_LABEL[statusFilter] ?? '', voucherType: kindFilter, supplier: supplierFilter, project: projectFilter,
    code: debouncedCode.trim(), from: fromDate, to: toDate
  }), [statusFilter, kindFilter, supplierFilter, projectFilter, debouncedCode, fromDate, toDate]);
  const filterKey = `${JSON.stringify(listFilters)}|${debouncedSearch}|${sort ? `${sort.key}:${sort.dir}` : ''}|${pageSize}|${activeUnitCode}`;
  // A new search, filter, sort or page size starts again at the first page.
  useEffect(() => { setPage(1); }, [filterKey]);
  const listQuery = useMemo<PagedQuery>(() => ({
    page, pageSize, sort: sort?.key, dir: sort?.dir, search: debouncedSearch, filters: listFilters
  }), [page, pageSize, sort, debouncedSearch, listFilters]);
  const fetchPage = useCallback((query: PagedQuery) => purchaseInvoicesApi.getPage(query), []);
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
    setCodeFilter(''); setKindFilter(''); setStatusFilter('');
    setSupplierFilter(''); setProjectFilter(''); setFromDate(''); setToDate(''); setSearchText('');
    showToast.info('Đã xóa tất cả bộ lọc!');
  };

  // ---------------------------------------------------------------------------------------------- open the form
  const handleOpenAdd = async () => {
    if (!perm.create) { showToast.error('Tài khoản của bạn không có quyền lập hóa đơn mua hàng mới!'); return; }
    const defaultUnit = companyUnits.find(c => c.code === activeUnitCode) || companyUnits[0];
    let newCode = 'Số tự động';
    try { newCode = await voucherNumberingApi.preview('HDM'); }
    catch (error) { showToast.error(getErrorMessage(error)); return; }

    setEditingVoucherId(null);
    setFormCompanyUnitName(defaultUnit?.name || activeUnitCode);
    setFormCode(newCode);
    setFormDate(today());
    setFormCreatedDate(today());
    setFormInvoiceNo('');
    setFormInvoiceSeries('');
    setFormInvoiceDate(today());
    setFormDueDate('');
    setFormStatus('Lập chứng từ');
    setFormKind(KINDS[0]);
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
    setIsModalOpen(true);
  };

  const handleOpenEdit = (voucher: GoodsVoucher) => {
    setEditingVoucherId(voucher.id);
    setFormCompanyUnitName(voucher.companyUnitName || activeUnitCode);
    setFormCode(voucher.code);
    setFormDate(voucher.date || today());
    setFormCreatedDate(voucher.createdDate || voucher.date || today());
    setFormInvoiceNo(voucher.invoiceNo || '');
    setFormInvoiceSeries(voucher.invoiceSeries || '');
    setFormInvoiceDate(voucher.invoiceDate || voucher.date || today());
    setFormDueDate(voucher.dueDate || '');
    setFormStatus(voucher.status || 'Chờ duyệt');
    setFormKind(voucher.voucherType || KINDS[0]);
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
      quantity: it.quantity || 1, unitPrice: it.unitPrice || 0, totalPrice: (it.quantity || 1) * (it.unitPrice || 0), amount: (it.quantity || 1) * (it.unitPrice || 0),
      note: it.note || '', purchaseOrderLineId: it.purchaseOrderLineId, purchaseOrderCode: it.purchaseOrderCode,
      goodsReceiptLineId: it.goodsReceiptLineId, goodsReceiptCode: it.goodsReceiptCode
    }));
    setFormItems([...mapped, emptyItem()]);
    setSaveStatus('Draft');
    setIsModalOpen(true);
  };

  // Opened from a notification (e.g. "Chờ duyệt: {mã phiếu}"): show that voucher.
  useOpenDocumentRequest(FUNCTION, (documentId) => {
    const voucher = invoiceVouchers.find(v => v.code === documentId || v.id === documentId);
    if (voucher) { handleOpenEdit(voucher); return; }
    // Not on the page shown: ask the server for the voucher with that code.
    void purchaseInvoicesApi.getPage({ page: 1, pageSize: 1, filters: { code: documentId } }).then(result => {
      const found = result.items.find(v => v.code === documentId);
      if (found) handleOpenEdit(found);
      else showToast.warning(`Không tìm thấy hóa đơn mua hàng ${documentId}.`, 'Phiếu có thể đã bị xóa hoặc thuộc đơn vị khác.');
    }).catch(error => showToast.error(getErrorMessage(error)));
  });

  // The Excel file is made by the server from every row the filters leave (not only this page).
  const handleExportExcel = async () => {
    if (!perm.export) {
      showToast.error('Tài khoản của bạn không có quyền Xuất Excel!');
      return;
    }
    try { await purchaseInvoicesApi.exportAll(listQuery); }
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
        quantity: 1, unitPrice: 0, totalPrice: 0, note: ''
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

  // ---- "Lấy từ phiếu nhập kho" / "Lấy từ đơn mua hàng": read fresh every time, only the supplier of the form once it is chosen. Editing a
  // saved invoice, what it already bills is not counted as billed (the picker takes off what the form holds).
  const handleOpenReceiptPicker = async () => {
    try {
      setOpenReceipts(await purchaseInvoicesApi.getOpenReceipts(formSupplierCode || undefined, editingVoucherId ?? undefined));
      setIsReceiptPickerOpen(true);
    } catch (error) { showToast.error(getErrorMessage(error)); }
  };

  const handleOpenOrderPicker = async () => {
    try {
      setOpenOrders(await purchaseInvoicesApi.getOpenOrders(formSupplierCode || undefined, editingVoucherId ?? undefined));
      setIsOrderPickerOpen(true);
    } catch (error) { showToast.error(getErrorMessage(error)); }
  };

  const receiptDocuments = useMemo(() => openReceipts.map(receipt => ({
    source: receipt,
    doc: {
      code: receipt.code, date: receipt.date, dueDate: null,
      info: [[receipt.warehouseName, receipt.projectCode ? `Dự án ${receipt.projectCode}` : ''], [receipt.supplierName || receipt.supplierCode, receipt.supplierCode],
        [[...new Set(receipt.lines.map(line => line.purchaseOrderCode).filter(Boolean))].join(', ') || 'Không theo đơn', receipt.currencyCode]],
      lockKey: `${receipt.supplierCode}|${receipt.currencyCode}`,
      searchText: [receipt.code, receipt.supplierName, receipt.supplierCode, receipt.warehouseName,
        ...receipt.lines.flatMap(line => [line.materialCode, line.materialName, line.purchaseOrderCode ?? ''])].join(' '),
      lines: receipt.lines.map(line => ({
        lineId: line.lineId, materialCode: line.materialCode, materialName: line.materialName, uomCode: line.uomCode,
        totalQuantity: line.receivedQuantity, remainingQuantity: line.remainingQuantity, unitPrice: line.unitPrice, note: line.note
      }))
    } as PickerDocument
  })), [openReceipts]);

  const orderDocuments = useMemo(() => openOrders.map(order => ({
    source: order,
    doc: {
      code: order.code, date: order.date, dueDate: null,
      info: [[order.paymentTerms || '', order.projectCode ? `Dự án ${order.projectCode}` : ''], [order.supplierName || order.supplierCode, order.supplierCode],
        [order.taxRateCode || 'Không thuế', order.currencyCode]],
      lockKey: `${order.supplierCode}|${order.currencyCode}`,
      searchText: [order.code, order.supplierName, order.supplierCode, ...order.lines.flatMap(line => [line.materialCode, line.materialName])].join(' '),
      lines: order.lines.map(line => ({
        lineId: line.lineId, materialCode: line.materialCode, materialName: line.materialName, uomCode: line.uomCode,
        totalQuantity: line.orderedQuantity, remainingQuantity: line.remainingQuantity, unitPrice: line.unitPrice, note: line.note
      }))
    } as PickerDocument
  })), [openOrders]);

  /** The header of an empty form comes from the first document pulled: supplier, currency, tax, payment term and project. */
  const takeHeaderFrom = (source: { supplierCode: string; supplierName?: string | null; currencyCode: string; projectCode?: string | null;
    taxRateCode?: string | null; paymentTermCode?: string | null }) => {
    if (!formSupplierCode) { setFormSupplierCode(source.supplierCode); setFormSupplierName(source.supplierName || source.supplierCode); }
    if (source.currencyCode !== formCurrencyCode) void handleCurrencyChange(source.currencyCode);
    if (source.taxRateCode && !formTaxRateCode) setFormTaxRateCode(source.taxRateCode);
    if (source.paymentTermCode && !formPaymentTermCode) setFormPaymentTermCode(source.paymentTermCode);
    if (source.projectCode && !formProjectCode) setFormProjectCode(source.projectCode);
  };

  /** Carries the ticked receipt lines into the lines of the invoice; a receipt line already in the form gets the quantity added. */
  const handleConfirmReceipts = (picked: PickedLine<OpenInvoiceReceipt>[]) => {
    setIsReceiptPickerOpen(false);
    if (picked.length === 0) return;
    const items = formItems.filter(hasMaterial).map(item => ({ ...item }));
    picked.forEach(({ source, line, quantity }) => {
      const existing = items.find(item => item.goodsReceiptLineId === line.lineId);
      if (existing) {
        existing.quantity = (Number(existing.quantity) || 0) + quantity;
        existing.totalPrice = existing.quantity * (existing.unitPrice || 0);
        existing.amount = existing.totalPrice;
        return;
      }
      const from = source.lines.find(l => l.lineId === line.lineId);
      items.push({
        productId: line.materialCode, sku: line.materialCode, productName: line.materialName, unit: line.uomCode,
        quantity, unitPrice: line.unitPrice, totalPrice: quantity * line.unitPrice, amount: quantity * line.unitPrice, note: line.note ?? '',
        goodsReceiptLineId: line.lineId, goodsReceiptCode: source.code,
        purchaseOrderLineId: from?.purchaseOrderLineId ?? undefined, purchaseOrderCode: from?.purchaseOrderCode ?? undefined
      });
    });
    takeHeaderFrom(picked[0].source);
    const codes = [...new Set(picked.map(p => p.source.code))];
    setFormNote(prev => prev.trim() ? prev : `Hóa đơn theo phiếu nhập kho ${codes.join(', ')}`);
    setFormItems([...items, emptyItem()]);
    showToast.success(`Đã lấy ${picked.length} vật tư từ ${codes.length} phiếu nhập kho. Có thể sửa số lượng và đơn giá theo hóa đơn của nhà cung cấp.`);
  };

  /** Carries the ticked order lines into the lines (an invoice made before the goods arrive); an order line already in the form gets the quantity added. */
  const handleConfirmOrders = (picked: PickedLine<OpenInvoiceOrder>[]) => {
    setIsOrderPickerOpen(false);
    if (picked.length === 0) return;
    const items = formItems.filter(hasMaterial).map(item => ({ ...item }));
    picked.forEach(({ source, line, quantity }) => {
      const existing = items.find(item => item.purchaseOrderLineId === line.lineId && !item.goodsReceiptLineId);
      if (existing) {
        existing.quantity = (Number(existing.quantity) || 0) + quantity;
        existing.totalPrice = existing.quantity * (existing.unitPrice || 0);
        existing.amount = existing.totalPrice;
        return;
      }
      items.push({
        productId: line.materialCode, sku: line.materialCode, productName: line.materialName, unit: line.uomCode,
        quantity, unitPrice: line.unitPrice, totalPrice: quantity * line.unitPrice, amount: quantity * line.unitPrice, note: line.note ?? '',
        purchaseOrderLineId: line.lineId, purchaseOrderCode: source.code
      });
    });
    takeHeaderFrom(picked[0].source);
    const codes = [...new Set(picked.map(p => p.source.code))];
    setFormNote(prev => prev.trim() ? prev : `Hóa đơn theo đơn mua hàng ${codes.join(', ')}`);
    setFormItems([...items, emptyItem()]);
    showToast.success(`Đã lấy ${picked.length} vật tư từ ${codes.length} đơn mua hàng. Có thể sửa số lượng và đơn giá theo hóa đơn của nhà cung cấp.`);
  };

  /** Unlinks the invoice from its receipts and orders: the lines stay but no longer bill a source line. */
  const handleClearSources = () => {
    setFormItems(prev => prev.map(item => ({ ...item, goodsReceiptLineId: undefined, goodsReceiptCode: undefined, purchaseOrderLineId: undefined, purchaseOrderCode: undefined })));
  };

  // ---------------------------------------------------------------------------------------------- totals and save
  const formSubTotal = useMemo(() => formItems.reduce((sum, item) => hasMaterial(item) ? sum + (item.totalPrice || (item.quantity || 0) * (item.unitPrice || 0)) : sum, 0), [formItems]);
  const formTaxPercent = taxRates.find(rate => rate.code === formTaxRateCode)?.rate ?? 0;
  const formTaxAmount = Math.round(formSubTotal * formTaxPercent) / 100;
  // Total in the base currency: (goods + tax) x exchange rate.
  const formTotalValue = (formSubTotal + formTaxAmount) * (formExchangeRate && formExchangeRate > 0 ? formExchangeRate : 1);

  const filledItemCount = formItems.filter(hasMaterial).length;
  const hasSources = Boolean(formReceiptCode || formOrderCode);

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const asDraft = saveAsDraftRef.current;
    saveAsDraftRef.current = false;
    if (!canSaveForm) return;
    if (!(editingVoucherId ? perm.edit : perm.create)) { showToast.error('Tài khoản của bạn không có quyền cập nhật dữ liệu!'); return; }
    if (!formCode.trim()) { showToast.error('Vui lòng nhập số chứng từ!'); return; }
    const validItems = formItems.filter(hasMaterial);
    if (!formSupplierCode) { showToast.error('Vui lòng chọn nhà cung cấp trong danh mục!'); return; }
    if (!formInvoiceNo.trim()) { showToast.error('Vui lòng nhập số hóa đơn của nhà cung cấp!'); return; }
    if (formInvoiceDate > formDate) { showToast.error('Ngày hóa đơn không được sau ngày chứng từ!'); return; }
    if (formDueDate && formDueDate < formInvoiceDate) { showToast.error('Hạn thanh toán không được trước ngày hóa đơn!'); return; }
    if (validItems.length === 0) { showToast.error('Vui lòng khai báo ít nhất một mặt hàng trên hóa đơn!'); return; }

    const savedVoucher: GoodsVoucher = {
      id: editingVoucherId || '0',
      version: localVouchers.find(v => v.id === editingVoucherId)?.version,
      type: 'Hóa đơn mua hàng', code: formCode.trim(), date: formDate, createdDate: formCreatedDate,
      companyUnitId: activeUnitCode, companyUnitName: formCompanyUnitName,
      voucherType: formKind, currencyCode: formCurrencyCode, exchangeRate: formExchangeRate,
      supplierCode: formSupplierCode, supplierName: formSupplierName.trim(),
      invoiceNo: formInvoiceNo.trim(), invoiceSeries: formInvoiceSeries.trim(), invoiceDate: formInvoiceDate, dueDate: formDueDate,
      paymentTermCode: formPaymentTermCode, projectCode: formProjectCode, taxRateCode: formTaxRateCode,
      purchaseOrderCode: formOrderCode, goodsReceiptCode: formReceiptCode,
      warehouseId: '', warehouseName: '',
      items: validItems, totalValue: formTotalValue, subTotal: formSubTotal, taxAmount: formTaxAmount, taxRate: formTaxPercent, createdBy: formCreatedBy || currentUser?.fullName || '',
      status: editingVoucherId ? formStatus : 'Lập chứng từ', note: formNote.trim()
    };

    setIsSaving(true);
    try {
      const target = asDraft ? 'Draft' : saveStatus;
      const result = editingVoucherId ? await purchaseInvoicesApi.update(savedVoucher, target) : await purchaseInvoicesApi.create(savedVoucher, target);
      setLocalVouchers(prev => editingVoucherId ? prev.map(v => v.id === editingVoucherId ? result : v) : [result, ...prev]);
      reloadListRef.current();
      showToast.success(`Đã lưu hóa đơn mua hàng [${result.code}], trạng thái: ${result.status}.`);
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
    // Cancelling cannot be taken back with one click: ask first (a cancelled voucher can be restored with Khôi phục).
    if (action === 'cancel') {
      const code = localVouchers.find(v => v.id === voucherId)?.code ?? '';
      const ok = await confirm({ title: `Hủy hóa đơn mua hàng ${code}?`, message: 'Phiếu bị hủy không dùng được nữa và số lượng đã lập hóa đơn được trả lại cho phiếu nhập / đơn mua. Nếu hủy nhầm, bấm Khôi phục để đưa phiếu về Lập chứng từ.', tone: 'warning', confirmLabel: 'Hủy phiếu', cancelLabel: 'Không' });
      if (!ok) return;
    }
    try {
      const result = await purchaseInvoicesApi.changeStatus(voucherId, action);
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
      await purchaseInvoicesApi.remove(itemToDelete.id);
      setLocalVouchers(prev => prev.filter(v => v.id !== itemToDelete.id));
      reloadListRef.current();
      showToast.success(`Đã xóa hóa đơn mua hàng [${itemToDelete.code}].`);
      setItemToDelete(null);
    } catch (error) { showToast.error(getErrorMessage(error)); }
  };

  const handleConfirmBulkDelete = async () => {
    if (!bulkToDeleteIds || bulkToDeleteIds.length === 0) return;
    const results = await Promise.allSettled(bulkToDeleteIds.map(id => purchaseInvoicesApi.remove(id)));
    const deleted = bulkToDeleteIds.filter((_, index) => results[index].status === 'fulfilled');
    setLocalVouchers(prev => prev.filter(v => !deleted.includes(v.id)));
    reloadListRef.current();
    showToast.info(`Đã xóa ${deleted.length}/${bulkToDeleteIds.length} phiếu. Chỉ phiếu nháp đủ quyền mới được xóa.`);
    setSelectedIds([]);
    setBulkToDeleteIds(null);
  };

  /** Two print forms: with prices and amounts (needs VIEW_PRICE) and without. The "warehouse" line of the print form shows the due date. */
  const handlePrint = (code: string, withPrice: boolean) => {
    if (!perm.print) { showToast.error('Tài khoản của bạn không có quyền In chứng từ!'); return; }
    const voucher = localVouchers.find(v => v.code === code);
    if (!voucher) return;
    const label = `Hóa đơn số ${voucher.invoiceNo}${voucher.invoiceSeries ? ` ký hiệu ${voucher.invoiceSeries}` : ''} ngày ${voucher.invoiceDate}.`;
    const opened = printVoucher({
      kind: 'purchaseInvoice', withPrice: withPrice && canViewPrice,
      voucher: { ...voucher, warehouseName: voucher.dueDate || '', note: `${label} ${voucher.note || ''}`.trim() },
      company: systemSettingsService.getCompanyProfile(),
      format: { quantity: formatQuantity, unitPrice: formatUnitPrice, amount: value => formatNumber(value) },
      printedBy: currentUser?.fullName
    });
    if (!opened) showToast.error('Trình duyệt đã chặn cửa sổ in.');
  };

  // ---------------------------------------------------------------------------------------------- list
  const renderStatusBadge = (status?: string) => <VoucherStatusBadge voucherType="HDM" label={status} />;
  const todayText = today();

  const columns: GridViewColumn<GoodsVoucher>[] = [
    {
      key: 'code', title: 'Số Chứng Từ / Ngày', sortable: true,
      render: (v) => (
        <div className="space-y-0.5">
          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs hover:underline cursor-pointer" onClick={() => handleOpenEdit(v)}>{v.code}</span>
          <p className="text-[10px] text-slate-400">Ngày CT: <span className="font-semibold text-slate-600 dark:text-slate-300">{v.date}</span></p>
          <p className="text-[10px] text-slate-400">Lập bởi: <span className="font-medium text-slate-500">{v.createdBy}</span></p>
        </div>
      )
    },
    {
      key: 'invoiceNo', title: 'Hóa Đơn Nhà Cung Cấp', sortable: true,
      render: (v) => (
        <div className="space-y-0.5">
          <p className="font-mono font-bold text-slate-800 dark:text-slate-100 text-xs flex items-center gap-1"><FileText className="h-3 w-3 text-slate-400" />{v.invoiceNo}{v.invoiceSeries ? ` · ${v.invoiceSeries}` : ''}</p>
          <p className="text-[10px] text-slate-400">Ngày HĐ: <span className="font-semibold text-slate-600 dark:text-slate-300">{v.invoiceDate}</span></p>
        </div>
      )
    },
    {
      key: 'supplier', title: 'Nhà Cung Cấp / Dự Án', sortable: true,
      render: (v) => (
        <div className="space-y-0.5 text-xs">
          <p className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[220px]" title={v.supplierName}>{v.supplierName || v.supplierCode || '—'}</p>
          {v.projectCode && <p className="text-[10px] text-slate-400">Dự án: <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">{v.projectCode}</span></p>}
          {v.goodsReceiptCode && <p className="text-[10px] text-slate-400 truncate max-w-[220px]" title={v.goodsReceiptCode}>Theo phiếu nhập: <span className="font-mono">{v.goodsReceiptCode}</span></p>}
          {v.purchaseOrderCode && <p className="text-[10px] text-slate-400 truncate max-w-[220px]" title={v.purchaseOrderCode}>Theo đơn mua: <span className="font-mono">{v.purchaseOrderCode}</span></p>}
        </div>
      )
    },
    {
      key: 'voucherType', title: 'Loại Hóa Đơn', sortable: true,
      render: (v) => (
        <Badge variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700">
          <Tag className="h-3 w-3 mr-1 text-indigo-500" />{v.voucherType || KINDS[0]}
        </Badge>
      )
    },
    {
      key: 'dueDate', title: 'Hạn Thanh Toán', sortable: true,
      render: (v) => {
        const overdue = !!v.dueDate && v.dueDate < todayText && v.status === 'Đã phê duyệt';
        return (
          <div className={`text-xs font-mono font-semibold ${overdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
            <span className="flex items-center gap-1"><CalendarClock className="h-3 w-3" />{v.dueDate}</span>
            {overdue && <span className="text-[10px] font-bold">Quá hạn</span>}
          </div>
        );
      }
    },
    {
      key: 'totalValue', title: 'Phải Trả (VNĐ)', sortable: true, align: 'right',
      render: (v) => <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">{formatVND(v.totalValue)}</span>
    },
    { key: 'status', title: 'Trạng Thái Phiếu', sortable: true, render: (v) => renderStatusBadge(v.status) },
    {
      key: 'actions', title: 'Thao Tác', align: 'center',
      render: (v) => (
        <div className="flex items-center justify-center gap-1">
          <RowActionSlot>
              <button type="button" onClick={() => handleOpenEdit(v)} title="Xem & Sửa hóa đơn mua hàng"
                className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"><Edit3 className="h-4 w-4" /></button>
          </RowActionSlot>
          <RowActionSlot>
              {v.status === 'Hủy' && reachesStatus(currentUser, FUNCTION, 'Cancelled') && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'reopen')} title="Khôi phục phiếu đã hủy (về Lập chứng từ)"
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"><RotateCcw className="h-4 w-4" /></button>
              )}
              {v.status === 'Lập chứng từ' && (perm.create || perm.edit) && approvalInUse && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'submit')} title="Gửi duyệt hóa đơn mua hàng"
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"><ArrowUpRight className="h-4 w-4" /></button>
              )}
              {(v.status === 'Chờ duyệt' || v.status === 'Lập chứng từ') && canApprove && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'approve')} title="Phê duyệt hóa đơn mua hàng"
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"><ShieldCheck className="h-4 w-4" /></button>
              )}
          </RowActionSlot>
          <RowActionSlot>
              {v.status === 'Chờ duyệt' && v.createdBy === currentUser?.fullName && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'withdraw')} title="Rút phiếu khỏi quy trình duyệt"
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg"><Undo2 className="h-4 w-4" /></button>
              )}
              {v.status === 'Đã phê duyệt' && reachesStatus(currentUser, FUNCTION, 'Cancelled') && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'cancel')} title="Hủy hóa đơn mua hàng"
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
        icon={<Receipt className="h-6 w-6 text-amber-400" />}
        title="Danh Mục Hóa Đơn Mua Hàng (Purchase Invoices)"
        count={totalVouchers}
        countLabel="Hóa Đơn Mua Hàng"
        showAdvancedFilter={showAdvancedFilter}
        onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
        activeFilterCount={activeFilterCount}
        onRefresh={() => { void loadData(); }}
        onExportExcel={perm.export ? handleExportExcel : undefined}
        addLabel="Lập Hóa Đơn Mới"
        canCreate={perm.create}
        onOpenAdd={handleOpenAdd}
        filterPanelContent={
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
            <div><label className={filterLabel}>Mã / Số Chứng Từ</label>
              <input type="text" placeholder="HDM-202610-01..." value={codeFilter} onChange={(e) => setCodeFilter(e.target.value)} className={filterInput} /></div>
            <div><label className={filterLabel}>Loại Hóa Đơn</label>
              <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} className={filterInput}>
                <option value="">-- Tất cả loại hóa đơn --</option>
                {KINDS.map(p => <option key={p} value={p}>{p}</option>)}
              </select></div>
            <div><label className={filterLabel}>Trạng Thái Phiếu</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterInput}>
                <option value="">-- Tất cả trạng thái --</option>
                <option value="Lập chứng từ">Lập chứng từ</option>
                <option value="Chờ duyệt">Chờ duyệt</option>
                <option value="Đã phê duyệt">Đã phê duyệt</option>
                <option value="Hủy">Đã hủy</option>
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
        searchPlaceholder="Tìm kiếm số hóa đơn, nhà cung cấp, phiếu nhập, đơn mua, vật tư..."
        searchValue={searchText}
        onSearchChange={setSearchText}
        selectable={true}
        selectedIds={selectedIds}
        onSelectionChange={(ids) => setSelectedIds(ids.map(String))}
        batchActions={perm.delete ? [{
          label: 'Xóa các phiếu đã chọn', icon: <Trash2 className="h-3.5 w-3.5 text-rose-500" />, variant: 'danger',
          onClick: (_, ids) => setBulkToDeleteIds(ids.map(String))
        }] : []}
        emptyText="Không tìm thấy hóa đơn mua hàng nào phù hợp."
        pageSize={pageSize}
        pageSizeOptions={[10, 15, 20, 30, 50, 100]}
        dense={true}
      />

      {/* FORM: VIEW & EDIT / CREATE A PURCHASE INVOICE */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingVoucherId ? `Chi Tiết & Cập Nhật Hóa Đơn Mua Hàng: [${formCode}]` : 'Lập Hóa Đơn Mua Hàng Mới'}
        fullScreen={true}
        headerActions={
          <div className="flex items-center gap-2 shrink-0">
            {editingVoucherId && perm.print && <PrintMenuButton variant="button" canPrintPrice={canViewPrice} onPrint={withPrice => handlePrint(formCode, withPrice)} />}
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} icon={<XCircle className="h-3.5 w-3.5 text-slate-500" />}
              className="py-1 px-3 text-xs font-medium cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700">
              Hủy
            </Button>
            <Button type="button" variant="secondary" size="sm" icon={<Save className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
              onClick={() => { saveAsDraftRef.current = true; (document.getElementById('purchase-invoice-form') as HTMLFormElement | null)?.requestSubmit(); }}
              disabled={isSaving || !canSaveForm} title="Lưu phiếu ở trạng thái Lập chứng từ, dù ô Trạng thái đang chọn gì"
              className="py-1 px-3 text-xs font-semibold cursor-pointer bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900">
              Lưu Nháp
            </Button>
            <Button type="submit" variant="success" size="sm" icon={<CheckCircle2 className="h-3.5 w-3.5 text-white" />}
              onClick={() => { (document.getElementById('purchase-invoice-form') as HTMLFormElement | null)?.requestSubmit(); }}
              disabled={isSaving || !canSaveForm}
              className="py-1 px-4 text-xs font-bold cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-emerald-600">
              {saveStatus === 'Draft' ? (editingVoucherId ? 'Lưu & Cập Nhật' : 'Lưu Hóa Đơn') : `Lưu và ${saveStatusName('HDM', saveStatus).toLowerCase()}`}
            </Button>
          </div>
        }
      >
        <form id="purchase-invoice-form" onSubmit={handleSubmitForm} className="flex-1 min-h-0 flex flex-col gap-2 text-xs overflow-y-auto custom-scrollbar pt-2 pr-1">

          {/* I. THÔNG TIN HÓA ĐƠN (trái) và II. CHỨNG TỪ & TIỀN TỆ (phải), như phiếu nhập / xuất kho */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 text-xs shrink-0">
            <div className="md:col-span-8 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between h-6 pb-1 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Tag className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate">I. Thông Tin Hóa Đơn & Nhà Cung Cấp</h4>
                </div>
                <span className="text-[10px] font-medium text-slate-400 shrink-0 hidden sm:inline">Hóa đơn của nhà cung cấp</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 sm:gap-2 text-xs">
                <div>
                  <label className={VOUCHER_LABEL}>Nhà Cung Cấp <span className="text-rose-500">*</span></label>
                  <div className="flex items-center gap-1">
                    <input type="text" required placeholder="Chọn nhà cung cấp trong danh mục" value={formSupplierName} readOnly
                      onClick={() => !hasSources && setIsSupplierLookupOpen(true)} className={`${VOUCHER_INPUT} ${hasSources ? '' : 'cursor-pointer'}`}
                      title={hasSources ? 'Hóa đơn đã lấy từ phiếu nhập / đơn mua: nhà cung cấp theo chứng từ nguồn' : undefined} />
                    <button type="button" disabled={hasSources} onClick={() => setIsSupplierLookupOpen(true)} className={`${VOUCHER_LOOKUP_BUTTON} disabled:opacity-50`} title="Tra cứu danh mục Nhà cung cấp"><Search className="h-3 w-3" /></button>
                  </div>
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Số Hóa Đơn <span className="text-rose-500">*</span></label>
                  <input type="text" required maxLength={50} placeholder="Số ghi trên hóa đơn" value={formInvoiceNo}
                    onChange={(e) => setFormInvoiceNo(e.target.value)} className={`${VOUCHER_INPUT} font-mono font-bold`} />
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Ký Hiệu Hóa Đơn</label>
                  <input type="text" maxLength={30} placeholder="Ví dụ: AA/26E" value={formInvoiceSeries}
                    onChange={(e) => setFormInvoiceSeries(e.target.value)} className={`${VOUCHER_INPUT} font-mono`} />
                </div>

                <div>
                  <DateTimePicker label="Ngày Hóa Đơn" type="date" required value={formInvoiceDate} onChange={(val) => setFormInvoiceDate(val)} />
                </div>

                <div>
                  <DateTimePicker label="Hạn Thanh Toán (để trống: theo điều khoản)" type="date" value={formDueDate} onChange={(val) => setFormDueDate(val)} />
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Điều Khoản Thanh Toán</label>
                  <CatalogLookup lookup="paymentTerms" value={formPaymentTermCode} onChange={code => setFormPaymentTermCode(code)} />
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Loại Hóa Đơn <span className="text-rose-500">*</span></label>
                  <select required value={formKind} onChange={(e) => setFormKind(e.target.value)} className={VOUCHER_INPUT}>
                    {KINDS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Thuế Suất</label>
                  <select value={formTaxRateCode} onChange={(e) => setFormTaxRateCode(e.target.value)} className={VOUCHER_INPUT}>
                    <option value="">-- Không có thuế --</option>
                    {taxRates.map(rate => <option key={rate.code} value={rate.code}>{rate.name} ({rate.rate}%)</option>)}
                  </select>
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Dự Án</label>
                  <CatalogLookup lookup="projects" value={formProjectCode} onChange={code => setFormProjectCode(code)} />
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Theo Phiếu Nhập Kho</label>
                  <input type="text" readOnly value={formReceiptCode} placeholder="Chưa lấy từ phiếu nhập kho" className={`${VOUCHER_INPUT} font-mono`} title={formReceiptCode} />
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Theo Đơn Mua Hàng</label>
                  <div className="flex items-center gap-1">
                    <input type="text" readOnly value={formOrderCode} placeholder="Chưa lấy từ đơn mua hàng" className={`${VOUCHER_INPUT} font-mono`} title={formOrderCode} />
                    {hasSources && <button type="button" onClick={handleClearSources} className={VOUCHER_LOOKUP_BUTTON} title="Bỏ liên kết với phiếu nhập kho và đơn mua hàng"><XCircle className="h-3 w-3" /></button>}
                  </div>
                </div>

                <div className="sm:col-span-2 xl:col-span-3">
                  <label className={VOUCHER_LABEL}>Ghi Chú / Diễn Giải Nghiệp Vụ</label>
                  <input type="text" placeholder="Ví dụ: Hóa đơn tiền hàng đợt 1 tháng 11..." value={formNote}
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
                  <input type="text" required value={formCode} readOnly placeholder="HDM-202610-001"
                    className="w-full bg-indigo-50/40 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 rounded-lg px-1.5 py-0.5 font-mono font-black text-indigo-700 dark:text-indigo-300 text-[10.5px] h-[26px]" />
                </div>
                <div>
                  <label className={VOUCHER_LABEL}>Trạng Thái <span className="text-rose-500">*</span></label>
                  <select required value={shownStatus} disabled={!canChooseStatus} onChange={e => setSaveStatus(statusFromLabel(e.target.value))}
                    title={canChooseStatus ? 'Chọn trạng thái lưu phiếu, theo quyền của bạn' : undefined}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 font-extrabold text-slate-800 dark:text-slate-100 text-[10.5px] h-[26px]">
                    {canChooseStatus
                      ? statusChoices.map(choice => <option key={choice} value={SAVE_STATUS_LABELS[choice]}>{saveStatusName('HDM', choice)}</option>)
                      : (<>
                          <option value="Lập chứng từ">Lập chứng từ</option>
                          <option value="Chờ duyệt">Chờ duyệt</option>
                          <option value="Đã phê duyệt">Đã phê duyệt</option>
                          <option value="Hủy">Hủy phiếu</option>
                        </>)}
                  </select>
                </div>
                <div>
                  <label className={VOUCHER_LABEL}><User className="h-3 w-3 inline mr-0.5" />Người Lập</label>
                  <input type="text" value={formCreatedBy} readOnly placeholder="Kế toán..."
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 font-medium text-[10.5px] h-[26px]" />
                </div>
                <div>
                  <DateTimePicker label="Ngày CT" type="date" required value={formDate}
                    onChange={(val) => {
                      setFormDate(val);
                      if (!editingVoucherId) voucherNumberingApi.preview('HDM', val).then(setFormCode).catch(error => showToast.error(getErrorMessage(error)));
                      exchangeRatesApi.getRate(formCurrencyCode, val).then(setFormExchangeRate).catch(error => showToast.error(getErrorMessage(error)));
                    }} />
                </div>
                <div>
                  <DateTimePicker label="Ngày Lập" type="date" required value={formCreatedDate} onChange={() => {}} disabled />
                </div>
                <div>
                  <ComboBox label="Loại Tiền" options={currencies.map(c => ({ value: c.code, label: `${c.code} - ${c.name}` }))}
                    value={formCurrencyCode} onChange={(val) => handleCurrencyChange(val)} clearable={false} searchable={false} disabled={hasSources} />
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
                <span>Chi tiết hàng trên hóa đơn</span>
                <span className="px-1.5 rounded-full text-[9.5px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black">{filledItemCount}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap ml-auto">
                <Button type="button" size="sm" variant="outline" onClick={() => void handleOpenReceiptPicker()} icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                  disabled={!canSaveForm} className="text-[10.5px] py-1 px-2.5 h-[26px] font-semibold">
                  Lấy từ phiếu nhập kho
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => void handleOpenOrderPicker()} icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                  disabled={!canSaveForm} className="text-[10.5px] py-1 px-2.5 h-[26px] font-semibold">
                  Lấy từ đơn mua hàng
                </Button>
                <Button type="button" size="sm" variant="primary" onClick={() => { setLookupTargetRowIndex(null); setIsMaterialLookupOpen(true); }}
                  icon={<Search className="h-3.5 w-3.5" />}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] py-1 px-2.5 h-[26px] shadow-2xs font-semibold">
                  Tra cứu vật tư (F2)
                </Button>
              </div>
            </div>

            <VoucherDetailGrid
              fill
              showAddButton={false}
              hiddenFields={hiddenPriceFields}
              gridInfo={purchaseInvoiceItemsGridConfig}
              data={formItems}
              onChange={(newItems) => setFormItems(newItems as VoucherItem[])}
              onLookupClick={(rowIndex) => { setLookupTargetRowIndex(rowIndex); setIsMaterialLookupOpen(true); }}
              onCodeSubmit={(rowIndex, field, codeValue) => handleCodeSubmit(rowIndex, field, codeValue)}
              currencyCode={formCurrencyCode}
              exchangeRate={formExchangeRate}
            />
          </section>

          {/* Thanh tóm tắt: phiếu và tổng tiền phải trả (nút Lưu / Hủy nằm ở thanh tiêu đề của cửa sổ) */}
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
                Phải trả: <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">{(formSubTotal + formTaxAmount).toLocaleString('vi-VN')} {formCurrencyCode}</strong>
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
        itemName={`Hóa đơn mua hàng ngày ${itemToDelete?.date}${canViewPrice ? ` (${formatVND(itemToDelete?.totalValue || 0)})` : ''}`}
      />
      <DeleteConfirmModal
        isOpen={!!bulkToDeleteIds && bulkToDeleteIds.length > 0}
        onClose={() => setBulkToDeleteIds(null)}
        onConfirm={handleConfirmBulkDelete}
        isBulk
        bulkCount={bulkToDeleteIds?.length || 0}
      />

      {/* Goods receipts (approved or posted) of the supplier with something left to bill: receipts on top, their materials below */}
      <OpenDocumentPicker<OpenInvoiceReceipt>
        isOpen={isReceiptPickerOpen}
        onClose={() => setIsReceiptPickerOpen(false)}
        documents={receiptDocuments}
        taken={takenByReceiptLine}
        lockedKey={formSupplierCode ? `${formSupplierCode}|${formCurrencyCode}` : undefined}
        texts={{
          title: 'Lấy Vật Tư Từ Phiếu Nhập Kho',
          help: 'Chọn một phiếu nhập kho ở danh sách phía trên, rồi tích các vật tư cần lập hóa đơn ở bảng phía dưới (đổi số lượng nếu hóa đơn chỉ ghi một phần). Có thể lấy từ nhiều phiếu, miễn là cùng nhà cung cấp và cùng loại tiền. Vật tư đã lập hóa đơn đủ không hiện.',
          searchPlaceholder: 'Tìm số phiếu nhập, nhà cung cấp, kho, vật tư, đơn mua...',
          empty: 'Không có phiếu nhập kho nào còn hàng chưa lập hóa đơn (chỉ phiếu có nhà cung cấp, đã duyệt hoặc đã ghi sổ).',
          codeHeader: 'Số phiếu nhập kho', infoHeaders: ['Kho nhập / dự án', 'Nhà cung cấp', 'Theo đơn mua / loại tiền'],
          totalHeader: 'SL đã nhập', doneHeader: 'Đã lập HĐ', confirm: 'Lấy {n} vật tư sang hóa đơn',
          lockedHint: 'khác nhà cung cấp hoặc loại tiền với hóa đơn, không lập chung một hóa đơn được', sourceName: 'phiếu nhập kho'
        }}
        onConfirm={handleConfirmReceipts}
      />

      {/* Approved orders of the supplier with something left to bill */}
      <OpenDocumentPicker<OpenInvoiceOrder>
        isOpen={isOrderPickerOpen}
        onClose={() => setIsOrderPickerOpen(false)}
        documents={orderDocuments}
        taken={takenByOrderLine}
        lockedKey={formSupplierCode ? `${formSupplierCode}|${formCurrencyCode}` : undefined}
        texts={{
          title: 'Lấy Vật Tư Từ Đơn Mua Hàng',
          help: 'Dùng khi nhà cung cấp lập hóa đơn trước lúc hàng về (hoặc mua dịch vụ). Chọn một đơn mua hàng đã duyệt ở danh sách phía trên, rồi tích các vật tư cần lập hóa đơn ở bảng phía dưới. Hóa đơn của hàng đã nhập kho nên lấy từ phiếu nhập kho.',
          searchPlaceholder: 'Tìm số đơn mua, nhà cung cấp, vật tư...',
          empty: 'Không có đơn mua hàng đã duyệt nào còn hàng chưa lập hóa đơn.',
          codeHeader: 'Số đơn mua hàng', infoHeaders: ['Điều khoản / dự án', 'Nhà cung cấp', 'Thuế / loại tiền'],
          totalHeader: 'SL đặt', doneHeader: 'Đã lập HĐ', confirm: 'Lấy {n} vật tư sang hóa đơn',
          lockedHint: 'khác nhà cung cấp hoặc loại tiền với hóa đơn, không lập chung một hóa đơn được', sourceName: 'đơn mua hàng'
        }}
        onConfirm={handleConfirmOrders}
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
        subtitle="Chọn 1 nhà cung cấp cho hóa đơn mua hàng"
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
    </div>
  );
};
