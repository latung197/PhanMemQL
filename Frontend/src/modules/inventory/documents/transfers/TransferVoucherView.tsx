// Điều chuyển kho: lệnh điều chuyển (inv_transfer_order), phiếu xuất điều chuyển (inv_transfer_issue) và phiếu nhập điều chuyển
// (inv_transfer_receipt) between two warehouses of the working company unit. One screen serves the three vouchers (they share the
// layout, statuses, approval and "save at a status" flow of the other vouchers):
//  - the order never posts: it says what must move; its statuses stop at "Đã phê duyệt";
//  - the issue posts stock OUT of the source warehouse ("Chuyển sổ kho"; the ledger values it at the warehouse average) and may take
//    its lines from approved orders ("Lấy từ lệnh điều chuyển");
//  - the receipt posts stock IN to the destination warehouse at the value of the issue and always takes its lines from posted issues
//    ("Lấy từ phiếu xuất điều chuyển"), partly if it wants: what is left stays open.
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  ArrowRightLeft, ArrowUpRight, CheckCircle2, ShieldCheck, Edit3, Trash2, Building2, Package, Tag, Search, Save, Undo2, XCircle,
  FileText, ClipboardCheck, Truck, BookCheck, BookX, RotateCcw } from 'lucide-react';
import { Button } from '../../../../components/common/Button';
import { RowActionSlot } from '../../../../components/common/RowActionSlot';
import { Modal } from '../../../../components/common/Modal';
import { Badge } from '../../../../components/common/Badge';
import { CategoryHeaderToolbar } from '../../../../components/common/CategoryHeaderToolbar';
import { DeleteConfirmModal } from '../../../../components/common/DeleteConfirmModal';
import { GridView, GridViewColumn } from '../../../../components/common/GridView';
import { MasterLookupModal, ColumnDef } from '../../../../components/common/MasterLookupModal';
import { DateTimePicker, VoucherDetailGrid } from '../../../../components/common';
import { useConfirm } from '../../../../components/common/ConfirmDialog';
import { transferOrderItemsGridConfig, transferIssueItemsGridConfig, transferReceiptItemsGridConfig } from '../../../../mock/voucherGridConfigs';
import { useNumberFormat } from '../../../../context/NumberFormatContext';
import { systemSettingsService } from '../../../../services/systemSettingsService';
import { PrintMenuButton } from '../PrintMenuButton';
import { printVoucher, type VoucherPrintKind } from '../voucherPrint';
import { GoodsVoucher, VoucherItem, Product, Warehouse as WarehouseType, CompanyUnit, UserProfile, SubMenuKey } from '../../../../types';
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
import { OpenDocumentPicker, type PickedLine, type PickerDocument } from '../../../purchasing/documents/OpenDocumentPicker';
import { transferApis, type OpenTransfer, type TransferKind } from './api';

// Shared look of the header fields of a voucher form (same as the other voucher screens).
const VOUCHER_LABEL = 'block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5 truncate';
const VOUCHER_INPUT = 'w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 font-medium text-[11px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[26px]';
const VOUCHER_LOOKUP_BUTTON = 'px-1.5 h-[26px] bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs';

/** Why goods move between two warehouses (the list of the "Lý do điều chuyển" field). */
const REASONS = ['Bổ sung kho sản xuất', 'Cân đối tồn kho giữa các kho', 'Chuyển hàng ra kho bán hàng', 'Chuyển hàng về kho tổng', 'Điều chuyển nội bộ khác'];

interface KindConfig {
  fn: SubMenuKey;
  /** Number series and status catalog code. */
  series: 'LDC' | 'PXDC' | 'PNDC';
  posts: boolean;
  gridInfo: typeof transferOrderItemsGridConfig;
  printKind: VoucherPrintKind;
  noun: string;
  title: string;
  subtitle: string;
  addLabel: string;
  personLabel: string;
  personPlaceholder: string;
  /** What the voucher follows ("Theo lệnh điều chuyển"); empty for the order. */
  sourceNoun?: string;
  sourceButton?: string;
  approvalScreen: string;
}

const KINDS: Record<TransferKind, KindConfig> = {
  order: {
    fn: 'inv_transfer_order', series: 'LDC', posts: false, gridInfo: transferOrderItemsGridConfig, printKind: 'transferOrder',
    noun: 'lệnh điều chuyển kho', title: 'Danh Mục Lệnh Điều Chuyển Kho (Transfer Orders)',
    subtitle: 'Đề nghị chuyển hàng từ kho này sang kho khác: lập, duyệt, theo dõi số đã xuất; phiếu xuất điều chuyển lấy dữ liệu từ lệnh đã duyệt',
    addLabel: 'Lập Lệnh Điều Chuyển Mới', personLabel: 'Người Đề Nghị', personPlaceholder: 'Họ tên người đề nghị điều chuyển...', approvalScreen: 'Phê duyệt điều chuyển'
  },
  issue: {
    fn: 'inv_transfer_issue', series: 'PXDC', posts: true, gridInfo: transferIssueItemsGridConfig, printKind: 'transferIssue',
    noun: 'phiếu xuất điều chuyển kho', title: 'Danh Mục Phiếu Xuất Điều Chuyển Kho (Transfer Issues)',
    subtitle: 'Xuất hàng khỏi kho đi: ghi sổ kho theo giá bình quân, hàng chờ nhập ở kho đến; có thể lấy từ lệnh điều chuyển đã duyệt',
    addLabel: 'Lập Phiếu Xuất Điều Chuyển Mới', personLabel: 'Người Vận Chuyển', personPlaceholder: 'Họ tên người nhận hàng đi giao...',
    sourceNoun: 'Lệnh Điều Chuyển', sourceButton: 'Lấy từ lệnh điều chuyển', approvalScreen: 'Phê duyệt điều chuyển'
  },
  receipt: {
    fn: 'inv_transfer_receipt', series: 'PNDC', posts: true, gridInfo: transferReceiptItemsGridConfig, printKind: 'transferReceipt',
    noun: 'phiếu nhập điều chuyển kho', title: 'Danh Mục Phiếu Nhập Điều Chuyển Kho (Transfer Receipts)',
    subtitle: 'Nhận hàng vào kho đến từ phiếu xuất điều chuyển đã ghi sổ: ghi sổ nhập theo đúng giá trị của phiếu xuất, nhận từng phần được',
    addLabel: 'Lập Phiếu Nhập Điều Chuyển Mới', personLabel: 'Người Giao Hàng', personPlaceholder: 'Họ tên người giao hàng đến kho...',
    sourceNoun: 'Phiếu Xuất Điều Chuyển', sourceButton: 'Lấy từ phiếu xuất điều chuyển', approvalScreen: 'Phê duyệt điều chuyển'
  }
};

interface TransferVoucherViewProps {
  kind: TransferKind;
  companyUnits?: CompanyUnit[];
  activeUnitCode: string;
  currentUser?: UserProfile;
}

const today = () => new Date().toISOString().split('T')[0];
const emptyItem = (): VoucherItem => ({ productId: '', productName: '', sku: '', unit: '', quantity: 1, unitPrice: 0, totalPrice: 0, note: '', lotNumber: '', position: '', doneQuantity: 0 });
const hasMaterial = (item: VoucherItem) => Boolean(item.productId || item.sku || item.productName);

/** The status filter of the form holds the labels the screens keep; the server filters by the status name. */
const STATUS_OF_LABEL: Record<string, string> = {
  'Lập chứng từ': 'Draft', 'Chờ duyệt': 'Pending', 'Đã phê duyệt': 'Approved', 'Chuyển sổ kho': 'Posted', 'Hủy': 'Cancelled'
};

export const TransferVoucherView: React.FC<TransferVoucherViewProps> = ({ kind, companyUnits = [], activeUnitCode, currentUser }) => {
  const cfg = KINDS[kind];
  const api = transferApis[kind];
  const FUNCTION = cfg.fn;

  const [localVouchers, setLocalVouchers] = useState<GoodsVoucher[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  // The status the form saves at: Draft, or further when the user's rights reach it (the server runs the steps and checks them).
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('Draft');
  // Set by the "Lưu Nháp" button: that save is a draft whatever the Trạng thái field holds.
  const saveAsDraftRef = useRef(false);
  const reloadListRef = useRef<() => void>(() => {});

  const loadData = async () => {
    try {
      const [options, materials] = await Promise.all([api.getOptions(), loadMaterialOptions()]);
      reloadListRef.current();
      setProducts(materials);
      setWarehouses(options.warehouses.map(w => ({
        id: w.code, code: w.code, name: w.name, address: '', manager: '', capacity: '', status: 'Đang hoạt động' as const
      })));
    } catch (error) {
      showToast.error(getErrorMessage(error));
    }
  };

  useEffect(() => { void loadData(); }, [activeUnitCode, kind]);

  // Filter & search
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  const [reasonFilter, setReasonFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

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
  const [formReason, setFormReason] = useState(REASONS[0]);
  const [formFromId, setFormFromId] = useState('');
  const [formToId, setFormToId] = useState('');
  const [formPerson, setFormPerson] = useState('');
  const [formCreatedBy, setFormCreatedBy] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formItems, setFormItems] = useState<VoucherItem[]>([]);
  // The orders / issues the lines follow, read from the lines themselves (each carries the number of its source).
  const formSourceCode = useMemo(() => [...new Set(formItems.map(item => item.transferSourceCode).filter(Boolean) as string[])].join(','), [formItems]);
  // What each source line is already taken for by the lines of this form.
  const takenByForm = useMemo(() => formItems.reduce<Record<number, number>>((acc, item) => {
    if (item.transferSourceLineId) acc[item.transferSourceLineId] = (acc[item.transferSourceLineId] ?? 0) + (Number(item.quantity) || 0);
    return acc;
  }, {}), [formItems]);

  // Pickers
  const [isMaterialLookupOpen, setIsMaterialLookupOpen] = useState(false);
  const [warehouseLookup, setWarehouseLookup] = useState<'from' | 'to' | null>(null);
  const [lookupTargetRowIndex, setLookupTargetRowIndex] = useState<number | null>(null);
  const [isSourcePickerOpen, setIsSourcePickerOpen] = useState(false);
  const [openSources, setOpenSources] = useState<OpenTransfer[]>([]);

  useVoucherStatuses();
  const perm = getActionPermission(currentUser, FUNCTION);
  // "Duyệt" on the voucher or on its approval screen (Phê duyệt điều chuyển), as the backend.
  const canApprove = canApproveVoucher(currentUser, FUNCTION);
  const canViewValue = kind !== 'order' && hasRight(currentUser, FUNCTION, RIGHTS.VIEW_COST);
  const hiddenValueFields = canViewValue || kind === 'order' ? undefined : ['unitPrice', 'amount'];
  const statusChoices = saveStatusChoices(currentUser, FUNCTION, { voucherType: cfg.series, posts: cfg.posts });
  const approvalInUse = voucherStatusService.isEnabled(cfg.series, 'Pending');
  // A posted voucher can be changed with the right ST_EDIT_POSTED of the unit: the server reverses the posting, changes it and posts again, and
  // refuses the save when that would make the stock negative.
  const canEditPosted = hasStatusRight(currentUser, FUNCTION, RIGHTS.ST_EDIT_POSTED);
  const editingPosted = !!editingVoucherId && formStatus === 'Chuyển sổ kho';
  const canSaveForm = !editingVoucherId ? perm.create : perm.edit && (formStatus === 'Lập chứng từ' || (editingPosted && canEditPosted));
  const canChooseStatus = canSaveForm && !editingPosted && statusChoices.length > 1;
  const statusFromLabel = (label: string): SaveStatus =>
    (Object.keys(SAVE_STATUS_LABELS) as SaveStatus[]).find(key => SAVE_STATUS_LABELS[key] === label) ?? 'Draft';
  const shownStatus = canChooseStatus ? SAVE_STATUS_LABELS[saveStatus] : formStatus;
  // A receipt only exists as the receiving of posted issues: its lines come from the picker, not from the catalog.
  const linesFromSource = kind === 'receipt';

  const activeFilterCount = useMemo(() => [codeFilter.trim(), reasonFilter, statusFilter, warehouseFilter, fromDate, toDate]
    .filter(Boolean).length, [codeFilter, reasonFilter, statusFilter, warehouseFilter, fromDate, toDate]);

  // ---- The list: the server filters, sorts and cuts the pages (backend VoucherListQuery, services/paging.ts) ------------------
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const debouncedSearch = useDebounced(searchText, 300);
  const debouncedCode = useDebounced(codeFilter, 300);
  const listFilters = useMemo(() => ({
    status: STATUS_OF_LABEL[statusFilter] ?? '', warehouse: warehouseFilter, voucherType: reasonFilter,
    code: debouncedCode.trim(), from: fromDate, to: toDate
  }), [statusFilter, warehouseFilter, reasonFilter, debouncedCode, fromDate, toDate]);
  const filterKey = `${kind}|${JSON.stringify(listFilters)}|${debouncedSearch}|${sort ? `${sort.key}:${sort.dir}` : ''}|${pageSize}|${activeUnitCode}`;
  // A new search, filter, sort or page size starts again at the first page.
  useEffect(() => { setPage(1); }, [filterKey]);
  const listQuery = useMemo<PagedQuery>(() => ({
    page, pageSize, sort: sort?.key, dir: sort?.dir, search: debouncedSearch, filters: listFilters
  }), [page, pageSize, sort, debouncedSearch, listFilters]);
  const fetchPage = useCallback((query: PagedQuery) => api.getPage(query), [api]);
  const { items: pageItems, total: totalVouchers, loading: listLoading, error: listError, reload: reloadList } = usePagedList(fetchPage, listQuery);
  reloadListRef.current = reloadList;
  useEffect(() => { setLocalVouchers(pageItems); }, [pageItems]);
  useEffect(() => { if (listError) showToast.error(listError); }, [listError]);

  const { formatQuantity, formatUnitPrice, formatNumber } = useNumberFormat();
  const formatVND = (num: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);

  const handleClearFilter = () => {
    setCodeFilter(''); setReasonFilter(''); setStatusFilter(''); setWarehouseFilter(''); setFromDate(''); setToDate(''); setSearchText('');
    showToast.info('Đã xóa tất cả bộ lọc!');
  };

  const nameOf = (code: string) => warehouses.find(w => w.id === code)?.name || code;

  // ---------------------------------------------------------------------------------------------- open the form
  const handleOpenAdd = async () => {
    if (!perm.create) { showToast.error(`Tài khoản của bạn không có quyền lập ${cfg.noun} mới!`); return; }
    if (warehouses.length < 2) { showToast.error('Điều chuyển kho cần ít nhất hai kho đang hoạt động trong danh mục kho.'); return; }
    const defaultUnit = companyUnits.find(c => c.code === activeUnitCode) || companyUnits[0];
    let newCode = 'Số tự động';
    try { newCode = await voucherNumberingApi.preview(cfg.series); }
    catch (error) { showToast.error(getErrorMessage(error)); return; }

    setEditingVoucherId(null);
    setFormCompanyUnitName(defaultUnit?.name || activeUnitCode);
    setFormCode(newCode);
    setFormDate(today());
    setFormCreatedDate(today());
    setFormRequiredDate('');
    setFormStatus('Lập chứng từ');
    setFormReason(REASONS[0]);
    setFormFromId(warehouses[0].id);
    setFormToId(warehouses[1].id);
    setFormPerson(kind === 'order' ? currentUser?.fullName || '' : '');
    setFormCreatedBy(currentUser?.fullName || '');
    setFormNote('');
    setFormItems(linesFromSource ? [] : [emptyItem()]);
    setSaveStatus('Draft');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (voucher: GoodsVoucher) => {
    if (voucher.status === 'Chuyển sổ kho' && canEditPosted) showToast.info('Phiếu đã ghi sổ: khi lưu, hệ thống bỏ ghi sổ, sửa rồi ghi sổ lại; nếu làm âm kho thì không lưu được.');
    setEditingVoucherId(voucher.id);
    setFormCompanyUnitName(voucher.companyUnitName || activeUnitCode);
    setFormCode(voucher.code);
    setFormDate(voucher.date || today());
    setFormCreatedDate(voucher.createdDate || voucher.date || today());
    setFormRequiredDate(voucher.requiredDate || '');
    setFormStatus(voucher.status || 'Chờ duyệt');
    setFormReason(voucher.voucherType || REASONS[0]);
    setFormFromId(voucher.warehouseId);
    setFormToId(voucher.toWarehouseId || '');
    setFormPerson(voucher.delivererName || '');
    setFormCreatedBy(voucher.createdBy || '');
    setFormNote(voucher.note || '');
    const mapped: VoucherItem[] = (voucher.items ?? []).map(it => ({ ...it, quantity: it.quantity || 1, totalPrice: it.totalPrice ?? it.amount ?? 0 }));
    setFormItems(linesFromSource ? mapped : [...mapped, emptyItem()]);
    setSaveStatus('Draft');
    setIsModalOpen(true);
  };

  // Opened from a notification (e.g. "Chờ duyệt: {mã phiếu}"): show that voucher.
  useOpenDocumentRequest(FUNCTION, (documentId) => {
    const voucher = localVouchers.find(v => v.code === documentId || v.id === documentId);
    if (voucher) { handleOpenEdit(voucher); return; }
    // Not on the page shown: ask the server for the voucher with that code.
    void api.getPage({ page: 1, pageSize: 1, filters: { code: documentId } }).then(result => {
      const found = result.items.find(v => v.code === documentId);
      if (found) handleOpenEdit(found);
      else showToast.warning(`Không tìm thấy ${cfg.noun} ${documentId}.`, 'Phiếu có thể đã bị xóa hoặc thuộc đơn vị khác.');
    }).catch(error => showToast.error(getErrorMessage(error)));
  });

  // The Excel file is made by the server from every row the filters leave (not only this page).
  const handleExportExcel = async () => {
    if (!perm.export) { showToast.error('Tài khoản của bạn không có quyền Xuất Excel!'); return; }
    try { await api.exportAll(listQuery); }
    catch (error) { showToast.error(getErrorMessage(error)); }
  };

  // ---------------------------------------------------------------------------------------------- lines
  const applyProductToRow = (index: number, prod: Product) => {
    setFormItems(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index], productId: prod.id, productName: prod.name || prod.ten_vt || '', sku: prod.sku || prod.ma_vt || '',
        unit: prod.unit || prod.dvt || '', unitPrice: 0, totalPrice: 0
      };
      // One blank row stays at the end for the next entry.
      if (index === updated.length - 1) updated.push(emptyItem());
      return updated;
    });
  };

  const handleCodeSubmit = (rowIndex: number, _field: string, codeValue: string): boolean => {
    if (linesFromSource) return false;
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
        quantity: 1, unitPrice: 0, totalPrice: 0, note: '', lotNumber: '', position: '', doneQuantity: 0
      }));
      setFormItems(prev => [...prev.filter(hasMaterial), ...added, emptyItem()]);
      showToast.success(`Đã thêm ${selected.length} vật tư từ danh mục.`);
    }
    setIsMaterialLookupOpen(false);
    setLookupTargetRowIndex(null);
  };

  const handleConfirmWarehouseLookup = (selectedItems: WarehouseType[]) => {
    const selected = selectedItems[0];
    if (selected) {
      if (warehouseLookup === 'from') setFormFromId(selected.id); else setFormToId(selected.id);
      showToast.success(`Đã chọn kho: ${selected.name}`);
    }
    setWarehouseLookup(null);
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

  // ---------------------------------------------------------------------------------------------- "Lấy từ ..." (issue from orders, receipt from issues)
  // The sources with something left are read fresh every time. Editing a saved voucher, what it already takes is not counted as done
  // (the picker takes off what the form holds).
  const handleOpenSourcePicker = async () => {
    try {
      setOpenSources(kind === 'issue' ? await transferApis.issue.getOpenOrders(editingVoucherId ?? undefined)
        : await transferApis.receipt.getOpenIssues(editingVoucherId ?? undefined));
      setIsSourcePickerOpen(true);
    } catch (error) { showToast.error(getErrorMessage(error)); }
  };

  const pickerDocuments = useMemo(() => openSources.map(source => ({
    source,
    doc: {
      code: source.code, date: source.date, dueDate: source.requiredDate ? `Cần: ${source.requiredDate}` : null,
      info: [[`${source.fromWarehouseName} → ${source.toWarehouseName}`, ''], [source.reason, source.personName || ''], [source.note || '', '']],
      lockKey: `${source.fromWarehouseCode}|${source.toWarehouseCode}`,
      searchText: [source.code, source.fromWarehouseName, source.toWarehouseName, source.reason, source.personName,
        ...source.lines.flatMap(line => [line.materialCode, line.materialName])].join(' '),
      lines: source.lines.map(line => ({
        lineId: line.lineId, materialCode: line.materialCode, materialName: line.materialName, uomCode: line.uomCode,
        totalQuantity: line.quantity, remainingQuantity: line.remainingQuantity, unitPrice: line.unitPrice, note: line.note
      }))
    } as PickerDocument
  })), [openSources]);

  /**
   * Carries the ticked materials (with the quantity chosen) into the lines: every line keeps the source line it follows and the number
   * of its source. The warehouses come from the first source pulled; later ones must share them (the picker only lets those be ticked).
   * A source line already in the form gets the quantity added to its line.
   */
  const handleConfirmSource = (picked: PickedLine<OpenTransfer>[]) => {
    setIsSourcePickerOpen(false);
    if (picked.length === 0) return;
    const first = formSourceCode ? undefined : picked[0].source;
    const items = formItems.filter(hasMaterial).map(item => ({ ...item }));
    picked.forEach(({ source, line, quantity }) => {
      const existing = items.find(item => item.transferSourceLineId === line.lineId);
      if (existing) { existing.quantity = (Number(existing.quantity) || 0) + quantity; return; }
      const sourceLine = source.lines.find(l => l.lineId === line.lineId);
      items.push({
        productId: line.materialCode, sku: line.materialCode, productName: line.materialName, unit: line.uomCode, quantity,
        unitPrice: line.unitPrice, totalPrice: 0, amount: 0, note: line.note ?? '', doneQuantity: 0,
        // The lot travels with the goods: the receipt shows the lot of the issue line (the server copies it when saved).
        lotNumber: kind === 'receipt' ? sourceLine?.lotNumber ?? '' : '', position: '',
        transferSourceLineId: line.lineId, transferSourceCode: source.code
      });
    });
    const codes = [...new Set(items.map(item => item.transferSourceCode).filter(Boolean) as string[])];
    if (first) {
      setFormFromId(first.fromWarehouseCode);
      setFormToId(first.toWarehouseCode);
      setFormReason(first.reason);
      if (!formPerson.trim() && first.personName) setFormPerson(first.personName);
    }
    const prefix = kind === 'issue' ? 'Xuất theo lệnh điều chuyển' : 'Nhập theo phiếu xuất điều chuyển';
    setFormNote(prev => prev.trim() && !formSourceCode && !prev.startsWith(prefix) ? prev : `${prefix} ${codes.join(', ')}`);
    setFormItems(linesFromSource ? items : [...items, emptyItem()]);
    showToast.success(`Đã lấy ${picked.length} vật tư từ ${new Set(picked.map(p => p.source.code)).size} ${cfg.sourceNoun?.toLowerCase()}. Có thể sửa số lượng ở bảng chi tiết.`);
  };

  /** Unlinks the issue from its orders: the lines stay but no longer follow an order line (a receipt always follows an issue). */
  const handleClearSource = () => {
    setFormItems(prev => prev.map(item => ({ ...item, transferSourceLineId: undefined, transferSourceCode: undefined })));
  };

  // ---------------------------------------------------------------------------------------------- save
  const filledItemCount = formItems.filter(hasMaterial).length;
  const formTotalValue = useMemo(() => formItems.reduce((sum, item) => hasMaterial(item) ? sum + (item.totalPrice || item.amount || 0) : sum, 0), [formItems]);

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const asDraft = saveAsDraftRef.current;
    saveAsDraftRef.current = false;
    if (!canSaveForm) return;
    if (!(editingVoucherId ? perm.edit : perm.create)) { showToast.error('Tài khoản của bạn không có quyền cập nhật dữ liệu!'); return; }
    if (!formCode.trim()) { showToast.error('Vui lòng nhập số chứng từ!'); return; }
    if (!formFromId || !formToId) { showToast.error('Vui lòng chọn kho đi và kho đến!'); return; }
    if (formFromId === formToId) { showToast.error('Kho đi và kho đến phải khác nhau!'); return; }
    const validItems = formItems.filter(hasMaterial);
    if (validItems.length === 0) { showToast.error(linesFromSource ? 'Vui lòng lấy ít nhất một vật tư từ phiếu xuất điều chuyển!' : 'Vui lòng khai báo ít nhất một mặt hàng cần chuyển!'); return; }

    const savedVoucher: GoodsVoucher = {
      id: editingVoucherId || '0',
      version: localVouchers.find(v => v.id === editingVoucherId)?.version,
      type: kind === 'order' ? 'Lệnh điều chuyển kho' : kind === 'issue' ? 'Xuất điều chuyển kho' : 'Nhập điều chuyển kho',
      code: formCode.trim(), date: formDate, createdDate: formCreatedDate, requiredDate: formRequiredDate,
      companyUnitId: activeUnitCode, companyUnitName: formCompanyUnitName,
      voucherType: formReason, delivererName: formPerson.trim(),
      warehouseId: formFromId, warehouseName: nameOf(formFromId), toWarehouseId: formToId, toWarehouseName: nameOf(formToId),
      items: validItems, totalValue: formTotalValue, createdBy: formCreatedBy || currentUser?.fullName || '',
      status: editingVoucherId ? formStatus : 'Lập chứng từ', note: formNote.trim()
    };

    setIsSaving(true);
    try {
      const target = asDraft ? 'Draft' : saveStatus;
      const result = editingVoucherId ? await api.update(savedVoucher, target) : await api.create(savedVoucher, target);
      setLocalVouchers(prev => editingVoucherId ? prev.map(v => v.id === editingVoucherId ? result : v) : [result, ...prev]);
      reloadListRef.current();
      showToast.success(`Đã lưu ${cfg.noun} [${result.code}], trạng thái: ${result.status}.`);
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
    if (action === 'cancel' || action === 'unpost') {
      const code = localVouchers.find(v => v.id === voucherId)?.code ?? '';
      const ok = await confirm(action === 'cancel'
        ? { title: `Hủy ${cfg.noun} ${code}?`, message: 'Phiếu bị hủy không dùng được nữa. Nếu hủy nhầm, bấm Khôi phục để đưa phiếu về Lập chứng từ.', tone: 'warning', confirmLabel: 'Hủy phiếu', cancelLabel: 'Không' }
        : { title: `Bỏ ghi sổ ${cfg.noun} ${code}?`, message: 'Sổ kho được đảo lại và phiếu quay về Đã phê duyệt. Nếu việc này làm âm kho thì không bỏ ghi sổ được.', tone: 'warning', confirmLabel: 'Bỏ ghi sổ', cancelLabel: 'Không' });
      if (!ok) return;
    }
    try {
      const result = await api.changeStatus(voucherId, action);
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
      await api.remove(itemToDelete.id);
      setLocalVouchers(prev => prev.filter(v => v.id !== itemToDelete.id));
      reloadListRef.current();
      showToast.success(`Đã xóa ${cfg.noun} [${itemToDelete.code}].`);
      setItemToDelete(null);
    } catch (error) { showToast.error(getErrorMessage(error)); }
  };

  const handleConfirmBulkDelete = async () => {
    if (!bulkToDeleteIds || bulkToDeleteIds.length === 0) return;
    const results = await Promise.allSettled(bulkToDeleteIds.map(id => api.remove(id)));
    const deleted = bulkToDeleteIds.filter((_, index) => results[index].status === 'fulfilled');
    setLocalVouchers(prev => prev.filter(v => !deleted.includes(v.id)));
    reloadListRef.current();
    showToast.info(`Đã xóa ${deleted.length}/${bulkToDeleteIds.length} phiếu. Chỉ phiếu nháp đủ quyền mới được xóa.`);
    setSelectedIds([]);
    setBulkToDeleteIds(null);
  };

  /** Two print forms: with the value of the goods (needs VIEW_COST) and without. The print form shows the warehouse the stock moves in. */
  const handlePrint = (code: string, withPrice: boolean) => {
    if (!perm.print) { showToast.error('Tài khoản của bạn không có quyền In chứng từ!'); return; }
    const voucher = localVouchers.find(v => v.code === code);
    if (!voucher) return;
    const receipt = kind === 'receipt';
    const printable: GoodsVoucher = {
      ...voucher,
      warehouseName: receipt ? voucher.toWarehouseName || '' : voucher.warehouseName,
      supplierName: receipt ? voucher.warehouseName : voucher.toWarehouseName || ''
    };
    const opened = printVoucher({
      kind: cfg.printKind, withPrice: withPrice && canViewValue, voucher: printable, company: systemSettingsService.getCompanyProfile(),
      format: { quantity: formatQuantity, unitPrice: formatUnitPrice, amount: value => formatNumber(value) },
      printedBy: currentUser?.fullName
    });
    if (!opened) showToast.error('Trình duyệt đã chặn cửa sổ in.');
  };

  // ---------------------------------------------------------------------------------------------- list
  const renderStatusBadge = (status?: string) => <VoucherStatusBadge voucherType={cfg.series} label={status} />;

  const columns: GridViewColumn<GoodsVoucher>[] = [
    {
      key: 'code', title: 'Số Chứng Từ / Ngày', sortable: true,
      render: (v) => (
        <div className="space-y-0.5">
          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs hover:underline cursor-pointer" onClick={() => handleOpenEdit(v)}>{v.code}</span>
          <p className="text-[10px] text-slate-400">Ngày CT: <span className="font-semibold text-slate-600 dark:text-slate-300">{v.date}</span></p>
          {v.requiredDate && <p className="text-[10px] text-slate-400">Cần chuyển: <span className="font-semibold text-amber-600 dark:text-amber-400">{v.requiredDate}</span></p>}
          <p className="text-[10px] text-slate-400">Lập bởi: <span className="font-medium text-slate-500">{v.createdBy}</span></p>
        </div>
      )
    },
    {
      key: 'companyUnitName', sortKey: 'warehouse', title: 'Kho Đi → Kho Đến', sortable: true,
      render: (v) => (
        <div className="space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1"><Building2 className="h-3 w-3 text-slate-400" />{v.companyUnitName}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 flex-wrap"><Package className="h-3 w-3 text-indigo-400" />{v.warehouseName}
            <ArrowRightLeft className="h-3 w-3 text-slate-400" />{v.toWarehouseName}</p>
        </div>
      )
    },
    {
      key: 'voucherType', title: 'Lý Do / Người', sortable: true,
      render: (v) => (
        <div className="space-y-0.5 text-xs">
          <Badge variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700">
            <Tag className="h-3 w-3 mr-1 text-indigo-500" />{v.voucherType}
          </Badge>
          {v.delivererName && <p className="text-[11px] text-slate-500 dark:text-slate-400">{v.delivererName}</p>}
          {v.transferSourceCode && <p className="text-[10px] text-slate-400 truncate max-w-[200px]" title={v.transferSourceCode}>Theo: <span className="font-mono font-medium text-slate-600 dark:text-slate-300">{v.transferSourceCode}</span></p>}
        </div>
      )
    },
    {
      key: 'items', title: kind === 'order' ? 'Hàng Cần Chuyển / Đã Xuất' : kind === 'issue' ? 'Hàng Xuất / Đã Nhận' : 'Hàng Nhận',
      render: (v) => {
        const items = v.items ?? [];
        const total = items.reduce((sum, i) => sum + i.quantity, 0);
        const done = items.reduce((sum, i) => sum + (i.doneQuantity ?? 0), 0);
        const complete = total > 0 && done >= total;
        return (
          <div className="space-y-1 max-w-xs">
            {items.slice(0, 2).map((it, idx) => (
              <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 truncate">• <span className="font-medium">{it.productName}</span> ({it.quantity} {it.unit || ''})</div>
            ))}
            {items.length > 2 && <div className="text-[10px] font-semibold text-indigo-500 italic">+ thêm {items.length - 2} mặt hàng khác</div>}
            {kind !== 'receipt' && (
              <div className={`text-[10px] font-bold ${complete ? 'text-emerald-600 dark:text-emerald-400' : done > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
                {kind === 'order' ? 'Đã xuất' : 'Đã nhận'} {formatQuantity(done)} / {formatQuantity(total)}{complete ? ' · xong' : ''}
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'totalValue', title: 'Giá Trị Hàng (VNĐ)', sortable: true, align: 'right',
      render: (v) => <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-sm">{formatVND(v.totalValue)}</span>
    },
    { key: 'status', title: 'Trạng Thái Phiếu', sortable: true, render: (v) => renderStatusBadge(v.status) },
    {
      key: 'actions', title: 'Thao Tác', align: 'center',
      render: (v) => (
        <div className="flex items-center justify-center gap-1">
          <RowActionSlot>
              <button type="button" onClick={() => handleOpenEdit(v)} title={`Xem & Sửa ${cfg.noun}`}
                className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"><Edit3 className="h-4 w-4" /></button>
          </RowActionSlot>
          <RowActionSlot>
              {v.status === 'Hủy' && reachesStatus(currentUser, FUNCTION, 'Cancelled') && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'reopen')} title="Khôi phục phiếu đã hủy (về Lập chứng từ)"
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"><RotateCcw className="h-4 w-4" /></button>
              )}
              {v.status === 'Lập chứng từ' && (perm.create || perm.edit) && approvalInUse && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'submit')} title={`Gửi duyệt ${cfg.noun}`}
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"><ArrowUpRight className="h-4 w-4" /></button>
              )}
              {v.status === 'Chờ duyệt' && canApprove && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'approve')} title={`Phê duyệt ${cfg.noun}`}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"><ShieldCheck className="h-4 w-4" /></button>
              )}
              {cfg.posts && v.status === 'Đã phê duyệt' && reachesStatus(currentUser, FUNCTION, 'Posted') && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'post')} title="Chuyển sổ kho"
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"><BookCheck className="h-4 w-4" /></button>
              )}
              {cfg.posts && v.status === 'Chuyển sổ kho' && hasStatusRight(currentUser, FUNCTION, RIGHTS.ST_UNPOST) && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'unpost')} title="Bỏ ghi sổ kho"
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"><BookX className="h-4 w-4" /></button>
              )}
          </RowActionSlot>
          <RowActionSlot>
              {v.status === 'Chờ duyệt' && v.createdBy === currentUser?.fullName && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'withdraw')} title="Rút phiếu khỏi quy trình duyệt"
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg"><Undo2 className="h-4 w-4" /></button>
              )}
              {v.status === 'Đã phê duyệt' && reachesStatus(currentUser, FUNCTION, 'Cancelled') && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'cancel')} title={`Hủy ${cfg.noun}`}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg"><XCircle className="h-4 w-4" /></button>
              )}
          </RowActionSlot>
          <RowActionSlot>
              {perm.print && <PrintMenuButton canPrintPrice={canViewValue} onPrint={withPrice => handlePrint(v.code, withPrice)} />}
          </RowActionSlot>
          <RowActionSlot>
              {perm.delete && (v.status !== 'Chuyển sổ kho' || canEditPosted) && (
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
  const formId = `transfer-${kind}-form`;
  const submitForm = () => (document.getElementById(formId) as HTMLFormElement | null)?.requestSubmit();

  return (
    <div className="w-full min-w-0 flex-1 flex flex-col min-h-0 space-y-3">
      <CategoryHeaderToolbar
        icon={<Truck className="h-6 w-6 text-amber-400" />}
        title={cfg.title}
        subtitle={cfg.subtitle}
        count={totalVouchers}
        countLabel="Phiếu"
        showAdvancedFilter={showAdvancedFilter}
        onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
        activeFilterCount={activeFilterCount}
        onRefresh={() => { void loadData(); }}
        onExportExcel={perm.export ? handleExportExcel : undefined}
        addLabel={cfg.addLabel}
        canCreate={perm.create}
        onOpenAdd={handleOpenAdd}
        filterPanelContent={
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
            <div><label className={filterLabel}>Mã / Số Chứng Từ</label>
              <input type="text" placeholder={`${cfg.series}-202610-01...`} value={codeFilter} onChange={(e) => setCodeFilter(e.target.value)} className={filterInput} /></div>
            <div><label className={filterLabel}>Lý Do Điều Chuyển</label>
              <select value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)} className={filterInput}>
                <option value="">-- Tất cả lý do --</option>
                {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select></div>
            <div><label className={filterLabel}>Trạng Thái Phiếu</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={filterInput}>
                <option value="">-- Tất cả trạng thái --</option>
                <option value="Lập chứng từ">Lập chứng từ</option>
                <option value="Chờ duyệt">Chờ duyệt</option>
                <option value="Đã phê duyệt">Đã phê duyệt</option>
                {cfg.posts && <option value="Chuyển sổ kho">Chuyển sổ kho</option>}
                <option value="Hủy">Đã hủy</option>
              </select></div>
            <div><label className={filterLabel}>Kho (đi hoặc đến)</label>
              <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)} className={filterInput}>
                <option value="">-- Tất cả kho --</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
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
        columns={canViewValue ? columns : columns.filter(c => c.key !== 'totalValue')}
        keyExtractor={(item) => item.id}
        searchable={true}
        searchPlaceholder="Tìm kiếm mã phiếu, kho, lý do, người liên quan, vật tư..."
        searchValue={searchText}
        onSearchChange={setSearchText}
        selectable={true}
        selectedIds={selectedIds}
        onSelectionChange={(ids) => setSelectedIds(ids.map(String))}
        batchActions={perm.delete ? [{
          label: 'Xóa các phiếu đã chọn', icon: <Trash2 className="h-3.5 w-3.5 text-rose-500" />, variant: 'danger',
          onClick: (_, ids) => setBulkToDeleteIds(ids.map(String))
        }] : []}
        emptyText={`Không tìm thấy ${cfg.noun} nào phù hợp.`}
        pageSize={pageSize}
        pageSizeOptions={[10, 15, 20, 30, 50, 100]}
        dense={true}
      />

      {/* FORM: VIEW & EDIT / CREATE A TRANSFER VOUCHER */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingVoucherId ? `Chi Tiết & Cập Nhật ${cfg.noun.replace(/^./, c => c.toUpperCase())}: [${formCode}]` : cfg.addLabel}
        fullScreen={true}
        headerActions={
          <div className="flex items-center gap-2 shrink-0">
            {editingVoucherId && perm.print && <PrintMenuButton variant="button" canPrintPrice={canViewValue} onPrint={withPrice => handlePrint(formCode, withPrice)} />}
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)} icon={<XCircle className="h-3.5 w-3.5 text-slate-500" />}
              className="py-1 px-3 text-xs font-medium cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700">
              Hủy
            </Button>
            {!editingPosted && (
              <Button type="button" variant="secondary" size="sm" icon={<Save className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                onClick={() => { saveAsDraftRef.current = true; submitForm(); }}
                disabled={isSaving || !canSaveForm} title="Lưu phiếu ở trạng thái Lập chứng từ, dù ô Trạng thái đang chọn gì"
                className="py-1 px-3 text-xs font-semibold cursor-pointer bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900">
                Lưu Nháp
              </Button>
            )}
            <Button type="submit" variant="success" size="sm" icon={<CheckCircle2 className="h-3.5 w-3.5 text-white" />}
              onClick={submitForm}
              disabled={isSaving || !canSaveForm}
              className="py-1 px-4 text-xs font-bold cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-emerald-600">
              {saveStatus === 'Draft' ? (editingVoucherId ? 'Lưu & Cập Nhật' : 'Lưu Phiếu') : `Lưu và ${saveStatusName(cfg.series, saveStatus).toLowerCase()}`}
            </Button>
          </div>
        }
      >
        <form id={formId} onSubmit={handleSubmitForm} className="flex-1 min-h-0 flex flex-col gap-2 text-xs overflow-y-auto custom-scrollbar pt-2 pr-1">

          {/* I. THÔNG TIN ĐIỀU CHUYỂN (trái) và II. CHỨNG TỪ (phải), như các phiếu kho khác */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 text-xs shrink-0">
            <div className="md:col-span-8 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between h-6 pb-1 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Tag className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate">I. Thông Tin Điều Chuyển</h4>
                </div>
                <span className="text-[10px] font-medium text-slate-400 shrink-0 hidden sm:inline">Chuyển hàng giữa hai kho của đơn vị</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 sm:gap-2 text-xs">
                <div>
                  <label className={VOUCHER_LABEL}>Kho Đi <span className="text-rose-500">*</span></label>
                  <div className="flex items-center gap-1">
                    <select required value={formFromId} disabled={!!formSourceCode || linesFromSource} onChange={(e) => setFormFromId(e.target.value)} className={VOUCHER_INPUT}>
                      {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <button type="button" disabled={!!formSourceCode || linesFromSource} onClick={() => setWarehouseLookup('from')} className={VOUCHER_LOOKUP_BUTTON} title="Tra cứu danh mục Kho"><Search className="h-3 w-3" /></button>
                  </div>
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Kho Đến <span className="text-rose-500">*</span></label>
                  <div className="flex items-center gap-1">
                    <select required value={formToId} disabled={!!formSourceCode || linesFromSource} onChange={(e) => setFormToId(e.target.value)} className={VOUCHER_INPUT}>
                      {warehouses.filter(w => w.id !== formFromId || w.id === formToId).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                    <button type="button" disabled={!!formSourceCode || linesFromSource} onClick={() => setWarehouseLookup('to')} className={VOUCHER_LOOKUP_BUTTON} title="Tra cứu danh mục Kho"><Search className="h-3 w-3" /></button>
                  </div>
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>Lý Do Điều Chuyển <span className="text-rose-500">*</span></label>
                  <select required value={formReason} onChange={(e) => setFormReason(e.target.value)} className={VOUCHER_INPUT}>
                    {REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    {formReason && !REASONS.includes(formReason) && <option value={formReason}>{formReason}</option>}
                  </select>
                </div>

                <div>
                  <label className={VOUCHER_LABEL}>{cfg.personLabel}</label>
                  <input type="text" placeholder={cfg.personPlaceholder} value={formPerson} onChange={(e) => setFormPerson(e.target.value)} className={VOUCHER_INPUT} />
                </div>

                {kind === 'order' && (
                  <div>
                    <DateTimePicker label="Ngày Cần Chuyển" type="date" value={formRequiredDate} onChange={(val) => setFormRequiredDate(val)} />
                  </div>
                )}

                {cfg.sourceNoun && (
                  <div>
                    <label className={VOUCHER_LABEL}>Theo {cfg.sourceNoun}</label>
                    <div className="flex items-center gap-1">
                      <input type="text" readOnly value={formSourceCode} placeholder={`Chưa lấy từ ${cfg.sourceNoun.toLowerCase()}`} className={`${VOUCHER_INPUT} font-mono`} title={formSourceCode} />
                      {kind === 'issue' && formSourceCode && <button type="button" onClick={handleClearSource} className={VOUCHER_LOOKUP_BUTTON} title={`Bỏ liên kết với ${cfg.sourceNoun.toLowerCase()}`}><XCircle className="h-3 w-3" /></button>}
                    </div>
                  </div>
                )}

                <div className="sm:col-span-2 xl:col-span-3">
                  <label className={VOUCHER_LABEL}>Ghi Chú / Diễn Giải Nghiệp Vụ</label>
                  <input type="text" placeholder="Ví dụ: Chuyển vật tư bổ sung cho kho sản xuất tháng 11..." value={formNote}
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
                  <input type="text" required value={formCode} readOnly placeholder={`${cfg.series}-202610-001`}
                    className="w-full bg-indigo-50/40 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 rounded-lg px-1.5 py-0.5 font-mono font-black text-indigo-700 dark:text-indigo-300 text-[10.5px] h-[26px]" />
                </div>
                <div>
                  <label className={VOUCHER_LABEL}>Trạng Thái <span className="text-rose-500">*</span></label>
                  <select required value={shownStatus} disabled={!canChooseStatus} onChange={e => setSaveStatus(statusFromLabel(e.target.value))}
                    title={canChooseStatus ? 'Chọn trạng thái lưu phiếu, theo quyền của bạn' : undefined}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 font-extrabold text-slate-800 dark:text-slate-100 text-[10.5px] h-[26px]">
                    {canChooseStatus
                      ? statusChoices.map(choice => <option key={choice} value={SAVE_STATUS_LABELS[choice]}>{saveStatusName(cfg.series, choice)}</option>)
                      : (<>
                          <option value="Lập chứng từ">Lập chứng từ</option>
                          <option value="Chờ duyệt">Chờ duyệt</option>
                          <option value="Đã phê duyệt">Đã phê duyệt</option>
                          {cfg.posts && <option value="Chuyển sổ kho">Chuyển sổ kho</option>}
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
                      if (!editingVoucherId) voucherNumberingApi.preview(cfg.series, val).then(setFormCode).catch(error => showToast.error(getErrorMessage(error)));
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
                <span>Chi tiết hàng cần chuyển</span>
                <span className="px-1.5 rounded-full text-[9.5px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black">{filledItemCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {!linesFromSource && (
                  <Button type="button" size="sm" variant="primary" onClick={() => { setLookupTargetRowIndex(null); setIsMaterialLookupOpen(true); }}
                    icon={<Search className="h-3.5 w-3.5" />}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] py-1 px-2.5 h-[26px] shadow-2xs font-semibold">
                    Tra cứu vật tư (F2)
                  </Button>
                )}
                {cfg.sourceButton && (
                  <Button type="button" size="sm" variant="outline" onClick={() => void handleOpenSourcePicker()} icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                    disabled={!canSaveForm} className="text-[10.5px] py-1 px-2.5 h-[26px] font-semibold">
                    {cfg.sourceButton}
                  </Button>
                )}
              </div>
            </div>

            <VoucherDetailGrid
              fill
              showAddButton={false}
              hiddenFields={hiddenValueFields}
              gridInfo={cfg.gridInfo}
              data={formItems}
              onChange={(newItems) => setFormItems(newItems as VoucherItem[])}
              onLookupClick={(rowIndex) => { if (!linesFromSource) { setLookupTargetRowIndex(rowIndex); setIsMaterialLookupOpen(true); } }}
              onCodeSubmit={(rowIndex, field, codeValue) => handleCodeSubmit(rowIndex, field, codeValue)}
              currencyCode="VND"
              exchangeRate={1}
            />
          </section>

          {/* Thanh tóm tắt (nút Lưu / Hủy nằm ở thanh tiêu đề của cửa sổ) */}
          <div className="shrink-0 flex items-center justify-between gap-3 flex-wrap px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] text-slate-500 font-medium">
              Phiếu <strong className="font-mono text-indigo-600 dark:text-indigo-400">{formCode}</strong>
              <span className="mx-1.5 text-slate-300">|</span>
              {nameOf(formFromId)} → {nameOf(formToId)}
              <span className="mx-1.5 text-slate-300">|</span>
              {filledItemCount} mặt hàng
            </span>
            {canViewValue && formTotalValue > 0 && (
              <span className="text-[11px] text-slate-500 font-medium">
                Giá trị hàng: <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">{formTotalValue.toLocaleString('vi-VN')} VND</strong>
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
        itemName={`${cfg.noun.replace(/^./, c => c.toUpperCase())} ngày ${itemToDelete?.date}`}
      />
      <DeleteConfirmModal
        isOpen={!!bulkToDeleteIds && bulkToDeleteIds.length > 0}
        onClose={() => setBulkToDeleteIds(null)}
        onConfirm={handleConfirmBulkDelete}
        isBulk
        bulkCount={bulkToDeleteIds?.length || 0}
      />

      {/* Orders (issue) / posted issues (receipt) with something left: sources on top, their materials below */}
      {cfg.sourceNoun && (
        <OpenDocumentPicker<OpenTransfer>
          isOpen={isSourcePickerOpen}
          onClose={() => setIsSourcePickerOpen(false)}
          documents={pickerDocuments}
          taken={takenByForm}
          lockedKey={formSourceCode ? `${formFromId}|${formToId}` : undefined}
          texts={kind === 'issue' ? {
            title: 'Lấy Vật Tư Từ Lệnh Điều Chuyển Kho',
            help: 'Chọn một lệnh điều chuyển ở danh sách phía trên, rồi tích các vật tư cần xuất ở bảng phía dưới (đổi số lượng nếu chỉ xuất một phần). Có thể lấy từ nhiều lệnh, miễn là cùng kho đi và kho đến. Vật tư đã xuất đủ không hiện; vật tư còn thì hiện số lượng còn lại.',
            searchPlaceholder: 'Tìm số lệnh, kho, lý do, vật tư...',
            empty: 'Không có lệnh điều chuyển nào còn hàng chưa xuất.',
            codeHeader: 'Số lệnh điều chuyển', infoHeaders: ['Kho đi → kho đến', 'Lý do / người đề nghị', 'Ghi chú'],
            totalHeader: 'SL cần chuyển', doneHeader: 'Đã xuất', confirm: 'Lấy {n} vật tư sang phiếu xuất',
            lockedHint: 'khác kho đi hoặc kho đến với các vật tư đã chọn, không xuất chung một phiếu được', sourceName: 'lệnh điều chuyển'
          } : {
            title: 'Lấy Vật Tư Từ Phiếu Xuất Điều Chuyển Kho',
            help: 'Chọn một phiếu xuất điều chuyển đã ghi sổ ở danh sách phía trên, rồi tích các vật tư đã về đến kho ở bảng phía dưới (đổi số lượng nếu chỉ nhận một phần). Có thể nhận từ nhiều phiếu xuất, miễn là cùng kho đi và kho đến. Vật tư đã nhận đủ không hiện; vật tư còn thì hiện số lượng còn lại.',
            searchPlaceholder: 'Tìm số phiếu xuất, kho, lý do, vật tư...',
            empty: 'Không có phiếu xuất điều chuyển nào còn hàng chưa nhận.',
            codeHeader: 'Số phiếu xuất', infoHeaders: ['Kho đi → kho đến', 'Lý do / người vận chuyển', 'Ghi chú'],
            totalHeader: 'SL đã xuất', doneHeader: 'Đã nhận', confirm: 'Lấy {n} vật tư sang phiếu nhập',
            lockedHint: 'khác kho đi hoặc kho đến với các vật tư đã chọn, không nhận chung một phiếu được', sourceName: 'phiếu xuất'
          }}
          onConfirm={handleConfirmSource}
        />
      )}

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
        isOpen={warehouseLookup !== null}
        onClose={() => setWarehouseLookup(null)}
        title={warehouseLookup === 'from' ? 'Tra Cứu & Chọn Kho Đi Từ Danh Mục' : 'Tra Cứu & Chọn Kho Đến Từ Danh Mục'}
        subtitle="Chọn 1 kho hàng từ danh mục hệ thống"
        data={warehouses}
        columns={warehouseLookupColumns}
        idField="id"
        displayField="name"
        searchFields={['id', 'code', 'name']}
        searchPlaceholder="Nhập mã kho hoặc tên kho để tìm kiếm..."
        selectionMode="single"
        selectedIds={[warehouseLookup === 'from' ? formFromId : formToId].filter(Boolean)}
        onConfirm={handleConfirmWarehouseLookup}
        pageSize={6}
      />
    </div>
  );
};
