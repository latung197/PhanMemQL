import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
  ClipboardCheck,
  ArrowUpRight,
  Plus, 
  CheckCircle2, 
  Printer, 
  ShieldCheck, 
  Clock, 
  Eye, 
  Edit3, 
  Trash2, 
  Filter, 
  X, 
  RefreshCw, 
  FileText, 
  Download, 
  Upload, 
  Building2, 
  Package, 
  Calendar, 
  Tag, 
  Layers,
  CheckSquare,
  AlertOctagon,
  FileSpreadsheet,
  Search,
  ListFilter,
  Coins,
  TrendingUp,
  User,
  Info,
  Boxes,
  Save,
  Undo2,
  RotateCcw,
  XCircle
} from 'lucide-react';
import { Button } from '../../../../components/common/Button';
import { RowActionSlot } from '../../../../components/common/RowActionSlot';
import { CatalogLookup } from '../../../../components/catalog/CatalogLookup';
import { Modal } from '../../../../components/common/Modal';
import { Badge } from '../../../../components/common/Badge';
import { CategoryHeaderToolbar } from '../../../../components/common/CategoryHeaderToolbar';
import { DeleteConfirmModal } from '../../../../components/common/DeleteConfirmModal';
import { GridView, GridViewColumn } from '../../../../components/common/GridView';
import { MasterLookupModal, ColumnDef } from '../../../../components/common/MasterLookupModal';
import { NumberInput, QuantityInput, DateTimePicker, ComboBox, VoucherDetailGrid } from '../../../../components/common';
import { useConfirm } from '../../../../components/common/ConfirmDialog';
import { goodsIssueItemsGridConfig, goodsIssueMaterialsGridConfig } from '../../../../mock/voucherGridConfigs';
import { useNumberFormat } from '../../../../context/NumberFormatContext';
import { systemSettingsService } from '../../../../services/systemSettingsService';
import { PrintMenuButton } from '../PrintMenuButton';
import { printVoucher } from '../voucherPrint';
import { GoodsVoucher, VoucherItem, Product, Warehouse as WarehouseType, CompanyUnit, UserProfile } from '../../../../types';
import { SAVE_STATUS_LABELS, saveStatusChoices, saveStatusName, type SaveStatus } from '../SaveStatusSelect';
import { VoucherStatusBadge } from '../VoucherStatusBadge';
import { useVoucherStatuses, voucherStatusService } from '../../../../services/voucherStatusService';
import { reachesStatus } from '../../../../utils/documentPolicy';
import { getActionPermission } from '../../../../mock/initialRoles';
import { canApproveVoucher, hasRight, hasStatusRight, RIGHTS } from '../../../../utils/permissions';
import { useOpenDocumentRequest } from '../../../../utils/documentLinks';
import { showToast } from '../../../../utils/toast';
import { getErrorMessage } from '../../../../services/apiClient';
import { loadMaterialOptions } from '../../../../services/lookupOptions';
import { voucherNumberingApi, exchangeRatesApi } from '../../../../services/settingsApi';
import { goodsIssuesApi } from './api';
import type { OpenIssueRequest } from '../issue-requests/api';
import { IssueRequestPicker, type PickedRequestLine } from './IssueRequestPicker';
import { useDebounced } from '../../../../hooks/useDebounced';
import { usePagedList } from '../../../../hooks/usePagedList';
import { pagedQueryString, type PagedQuery } from '../../../../services/paging';

// Shared look of the header fields of a voucher form (goods receipt and goods issue keep the same layout).
const VOUCHER_LABEL = 'block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5 truncate';
const VOUCHER_INPUT = 'w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 font-medium text-[11px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[26px]';
const VOUCHER_LOOKUP_BUTTON = 'px-1.5 h-[26px] bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs';

interface GoodsIssueViewProps {
  companyUnits?: CompanyUnit[];
  activeUnitCode: string;
  currentUser?: UserProfile;
}

export const MOCK_CUSTOMERS = [
  { id: 'KH001', code: 'KH-VINFAST', name: 'Công ty Cổ phần Sản xuất và Kinh doanh VinFast', group: 'Ô tô & Xe điện', taxCode: '0108926224', phone: '1900 23 23 89', address: 'KĐT Vinhomes Riverside, Long Biên, Hà Nội' },
  { id: 'KH002', code: 'KH-MASAN', name: 'Tập đoàn Masan (Masan Group)', group: 'FMCG & Hàng tiêu dùng', taxCode: '0303595925', phone: '028 3822 5555', address: 'Tòa nhà Empress Tower, Q.1, TP.HCM' },
  { id: 'KH003', code: 'KH-THACO', name: 'Tập đoàn Trường Hải (THACO)', group: 'Cơ khí & Ô tô', taxCode: '4000326848', phone: '0235 3856 777', address: 'KCN Chu Lai, Núi Thành, Quảng Nam' },
  { id: 'KH004', code: 'KH-FPT', name: 'Công ty Cổ phần Bán lẻ Kỹ thuật số FPT', group: 'Bán lẻ & Công nghệ', taxCode: '0311609355', phone: '1800 6601', address: '261-263 Khánh Hội, Q.4, TP.HCM' },
  { id: 'KH005', code: 'KH-PETROLIMEX', name: 'Tập đoàn Xăng dầu Việt Nam (Petrolimex)', group: 'Năng lượng & Hóa chất', taxCode: '0100107321', phone: '024 3851 2603', address: 'Số 1 Khâm Thiên, Đống Đa, Hà Nội' },
  { id: 'KH006', code: 'KH-VIETTEL', name: 'Tập đoàn Công nghiệp - Viễn thông Quân đội (Viettel)', group: 'Viễn thông & Thiết bị', taxCode: '0100109106', phone: '1800 8098', address: 'Lô D26 KĐT mới Cầu Giấy, Yên Hòa, Hà Nội' },
  { id: 'KH007', code: 'KH-SAMSUNG-VN', name: 'Công ty TNHH Samsung Electronics Việt Nam Thái Nguyên', group: 'Điện tử xuất khẩu', taxCode: '4601118128', phone: '0208 3765 000', address: 'KCN Yên Bình, P. Đồng Tiến, Thái Nguyên' },
  { id: 'KH008', code: 'KH-GELEX', name: 'Tập đoàn GELEX - Thiết bị điện', group: 'Công nghiệp điện', taxCode: '0100100742', phone: '024 3826 6200', address: '52 Lê Đại Hành, Q. Hai Bà Trưng, Hà Nội' }
];

/** The status filter of the form holds the labels the screens keep; the server filters by the status name. */
const STATUS_OF_LABEL: Record<string, string> = {
  'Lập chứng từ': 'Draft', 'Chờ duyệt': 'Pending', 'Đã phê duyệt': 'Approved', 'Chuyển sổ kho': 'Posted', 'Hủy': 'Cancelled'
};

export const GoodsIssueView: React.FC<GoodsIssueViewProps> = ({
  companyUnits = [],
  activeUnitCode,
  currentUser
}) => {
  const [localVouchers, setLocalVouchers] = useState<GoodsVoucher[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [currencies, setCurrencies] = useState<{ code: string; name: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  // The status the form saves at: Draft, or further when the user's rights reach it (the server runs the steps and checks them).
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('Draft');
  // Set by the "Lưu Nháp" button: that save is a draft whatever the Trạng thái field holds.
  const saveAsDraftRef = useRef(false);
  // The pickers read the real catalogs through the lookups (materials; suppliers on a receipt).
  const [products, setProducts] = useState<Product[]>([]);

  // loadData also refreshes the list; the paging block below fills this in.
  const reloadListRef = useRef<() => void>(() => {});

  const loadData = async () => {
    try {
      const [options, materials] = await Promise.all([goodsIssuesApi.getOptions(), loadMaterialOptions()]);
      reloadListRef.current();
      setProducts(materials);
      setCurrencies(options.currencies);
      setWarehouses(options.warehouses.map(w => ({
        id: w.code, code: w.code, name: w.name, address: '',
        manager: '', capacity: '', status: 'Đang hoạt động' as const
      })));
    } catch (error) {
      showToast.error(getErrorMessage(error));
    }
  };

  useEffect(() => { void loadData(); }, [activeUnitCode]);

  // Filter & Search state
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Selected Items for Bulk Action
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [itemToDelete, setItemToDelete] = useState<GoodsVoucher | null>(null);
  const [bulkToDeleteIds, setBulkToDeleteIds] = useState<string[] | null>(null);

  // Modal / Form state (Create or Edit mode)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);

  // Active Tab in Detail Modal Form: 'items' (Chi tiết) | 'materials' (Nguyên vật liệu)
  const [activeTab, setActiveTab] = useState<'items' | 'materials'>('items');

  // Form Fields - Header Information
  // BÊN PHẢI: Mã đơn vị cơ sở, Ngày ct, Ngày lập ct, Số chứng từ, Trạng thái phiếu
  const [formCompanyUnitId, setFormCompanyUnitId] = useState('');
  const [formCompanyUnitName, setFormCompanyUnitName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formCreatedDate, setFormCreatedDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStatus, setFormStatus] = useState<string>('Lập chứng từ');

  // BÊN TRÁI: Loại xuất xuất, Kho xuất, Khách hàng, Người nhận, Loại tiền & Tỷ giá, Người lập, Ghi chú
  const [formVoucherType, setFormVoucherType] = useState('Xuất bán hàng');
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formWarehouseName, setFormWarehouseName] = useState('');
  // The approved issue request this issue carries out (empty = a free issue); its lines are the lines of the issue.
  const [formCustomerName, setFormCustomerName] = useState('');
  const [formReceiverName, setFormReceiverName] = useState('');
  const [formCurrencyCode, setFormCurrencyCode] = useState('VND');
  const [formExchangeRate, setFormExchangeRate] = useState<number>(1);
  const [formCreatedBy, setFormCreatedBy] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formProjectCode, setFormProjectCode] = useState('');

  // Form Fields - Line Items List (Tab 1: Chi Tiết Xuất Kho)
  const [formItems, setFormItems] = useState<VoucherItem[]>([]);
  // The requests the lines follow, read from the lines themselves (each carries the number of its request).
  const formRequestCode = useMemo(() => [...new Set(formItems.map(item => item.issueRequestCode).filter(Boolean) as string[])].join(','), [formItems]);
  // What each request line is already taken for by the lines of this form.
  const takenByForm = useMemo(() => formItems.reduce<Record<number, number>>((acc, item) => {
    if (item.issueRequestLineId) acc[item.issueRequestLineId] = (acc[item.issueRequestLineId] ?? 0) + (Number(item.quantity) || 0);
    return acc;
  }, {}), [formItems]);

  // Form Fields - Material Items List (Tab 2: Nguyên Vật Liệu / Cấu Trúc SP)
  const [formMaterialItems, setFormMaterialItems] = useState<VoucherItem[]>([]);

  // Master Lookup & Autocomplete States
  const [isMaterialLookupOpen, setIsMaterialLookupOpen] = useState(false);
  const [isWarehouseLookupOpen, setIsWarehouseLookupOpen] = useState(false);
  const [isCustomerLookupOpen, setIsCustomerLookupOpen] = useState(false);
  const [openRequests, setOpenRequests] = useState<OpenIssueRequest[]>([]);
  const [isRequestPickerOpen, setIsRequestPickerOpen] = useState(false);
  const [lookupTargetRowIndex, setLookupTargetRowIndex] = useState<number | null>(null);
  const [activeRowSearchIdx, setActiveRowSearchIdx] = useState<number | null>(null);

  useVoucherStatuses();
  const perm = getActionPermission(currentUser, 'inv_issue');
  // "Duyệt" on the voucher or on its approval screen (Phê duyệt xuất kho), as the backend.
  const canApprove = canApproveVoucher(currentUser, 'inv_issue');
  // Quyền đặc biệt "Xem đơn giá & thành tiền": không có thì ẩn mọi cột/ô giá trị trên phiếu.
  const canViewPrice = hasRight(currentUser, 'inv_issue', RIGHTS.VIEW_PRICE);
  const hiddenPriceFields = canViewPrice ? undefined : ['unitPrice', 'amount'];
  const statusChoices = saveStatusChoices(currentUser, 'inv_issue', { voucherType: 'PXK', posts: true });
  const approvalInUse = voucherStatusService.isEnabled('PXK', 'Pending');
  // A posted voucher can be changed with the right ST_EDIT_POSTED of the unit: the server reverses the posting, changes it and posts again, and
  // refuses the save when that would make the stock negative.
  const canEditPosted = hasStatusRight(currentUser, 'inv_issue', RIGHTS.ST_EDIT_POSTED);
  const editingPosted = !!editingVoucherId && formStatus === 'Chuyển sổ kho';
  const canSaveForm = !editingVoucherId ? perm.create : perm.edit && (formStatus === 'Lập chứng từ' || (editingPosted && canEditPosted));
  // The "Trạng thái" field of the form is the choice while the voucher is new or still a draft and the user's rights reach more than one status.
  const canChooseStatus = canSaveForm && !editingPosted && statusChoices.length > 1;
  const statusFromLabel = (label: string): SaveStatus =>
    (Object.keys(SAVE_STATUS_LABELS) as SaveStatus[]).find(key => SAVE_STATUS_LABELS[key] === label) ?? 'Draft';
  const shownStatus = canChooseStatus ? SAVE_STATUS_LABELS[saveStatus] : formStatus;

  // The server already lists only this voucher type of the unit.
  const issueVouchers = localVouchers;

  // Compute active filters count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (codeFilter.trim()) count++;
    if (voucherTypeFilter) count++;
    if (statusFilter) count++;
    if (warehouseFilter) count++;
    if (fromDate) count++;
    if (toDate) count++;
    return count;
  }, [codeFilter, voucherTypeFilter, statusFilter, warehouseFilter, fromDate, toDate]);


  // ---- The list: the server filters, sorts and cuts the pages (backend VoucherListQuery, services/paging.ts) ------------------
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const debouncedSearch = useDebounced(searchText, 300);
  const debouncedCode = useDebounced(codeFilter, 300);
  const listFilters = useMemo(() => ({
    status: STATUS_OF_LABEL[statusFilter] ?? '', warehouse: warehouseFilter, voucherType: voucherTypeFilter,
    code: debouncedCode.trim(), from: fromDate, to: toDate
  }), [statusFilter, warehouseFilter, voucherTypeFilter, debouncedCode, fromDate, toDate]);
  const filterKey = `${JSON.stringify(listFilters)}|${debouncedSearch}|${sort ? `${sort.key}:${sort.dir}` : ''}|${pageSize}|${activeUnitCode}`;
  // A new search, filter, sort or page size starts again at the first page.
  useEffect(() => { setPage(1); }, [filterKey]);
  const listQuery = useMemo<PagedQuery>(() => ({
    page, pageSize, sort: sort?.key, dir: sort?.dir, search: debouncedSearch, filters: listFilters
  }), [page, pageSize, sort, debouncedSearch, listFilters]);
  const fetchPage = useCallback((query: PagedQuery) => goodsIssuesApi.getPage(query), []);
  const { items: pageItems, total: totalVouchers, loading: listLoading, error: listError, reload: reloadList } = usePagedList(fetchPage, listQuery);
  reloadListRef.current = reloadList;
  useEffect(() => { setLocalVouchers(pageItems); }, [pageItems]);
  useEffect(() => { if (listError) showToast.error(listError); }, [listError]);

  const { formatQuantity, formatUnitPrice, formatNumber } = useNumberFormat();

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);
  };

  const formatMoney = (amount: number, curr: string = 'VND') => {
    if (curr === 'VND' || !curr) return formatVND(amount);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr }).format(amount || 0);
  };

  // Currency Change Handler
  const handleCurrencyChange = async (cCode: string) => {
    setFormCurrencyCode(cCode);
    try { setFormExchangeRate(await exchangeRatesApi.getRate(cCode, formDate)); }
    catch (error) { showToast.error(getErrorMessage(error)); setFormExchangeRate(1); }
  };

  // Filter actions
  const handleApplyFilter = () => {
    showToast.info('Đã áp dụng các bộ lọc nâng cao!');
  };

  const handleClearFilter = () => {
    setCodeFilter('');
    setVoucherTypeFilter('');
    setStatusFilter('');
    setWarehouseFilter('');
    setFromDate('');
    setToDate('');
    setSearchText('');
    showToast.info('Đã xóa tất cả bộ lọc!');
  };

  const handleRefresh = () => { void loadData(); };

  const handleExportExcel = async () => {
    if (!perm.export) {
      showToast.error('Tài khoản của bạn không có quyền Xuất Excel!');
      return;
    }
    try { await goodsIssuesApi.exportAll(listQuery); }
    catch (error) { showToast.error(getErrorMessage(error)); }
  };

  const emptyBlankItem: VoucherItem = { productId: '', productName: '', sku: '', unit: '', quantity: 1, unitPrice: 0, totalPrice: 0, lotNumber: '', position: '' };

  // Open Add Modal
  const handleOpenAdd = async () => {
    if (!perm.create) {
      showToast.error('Tài khoản của bạn không có quyền lập phiếu xuất kho mới!');
      return;
    }

    if (warehouses.length === 0) {
      showToast.error('Cần khai báo kho đang hoạt động trước khi lập phiếu xuất.');
      return;
    }
    const defaultUnit = companyUnits.find(c => c.code === activeUnitCode) || companyUnits[0];
    const defaultWh = warehouses[0];
    let newCode = 'Số tự động';
    try { newCode = await voucherNumberingApi.preview('PXK'); }
    catch (error) { showToast.error(getErrorMessage(error)); return; }

    setEditingVoucherId(null);
    setActiveTab('items');
    
    // Set Right column defaults
    setFormCompanyUnitId(activeUnitCode);
    setFormCompanyUnitName(defaultUnit?.name || activeUnitCode);
    setFormCode(newCode);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormCreatedDate(new Date().toISOString().split('T')[0]);
    setFormStatus('Lập chứng từ');

    // Set Left column defaults
    setFormVoucherType('Xuất bán hàng');
    setFormWarehouseId(defaultWh.id);
    setFormWarehouseName(defaultWh.name);
    setFormCustomerName('');
    setFormReceiverName('');
    setFormCurrencyCode('VND');
    setFormExchangeRate(1);
    setFormCreatedBy(currentUser?.fullName || 'Trần Thịnh (Admin)');
    setFormNote('');
    setFormProjectCode('');

    // Default 1 line item for Tab 1 + 1 empty row for quick entry
    const emptyItem: VoucherItem = {
      productId: '',
      productName: '',
      sku: '',
      unit: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      lotNumber: '',
      position: ''
    };
    setFormItems([emptyItem]);

    // Default empty array or sample for Tab 2 (Nguyên vật liệu)
    setFormMaterialItems([]);

    setSaveStatus('Draft');
    setIsModalOpen(true);
  };

  // Open Edit/View Modal
  // Opened from a notification (e.g. "Chờ duyệt: {mã phiếu}"): show that voucher.
  useOpenDocumentRequest('inv_issue', (documentId) => {
    const voucher = localVouchers.find(v => v.code === documentId || v.id === documentId);
    if (voucher) { handleOpenEdit(voucher); return; }
    // Not on the page shown: ask the server for the voucher with that code.
    void goodsIssuesApi.getPage({ page: 1, pageSize: 1, filters: { code: documentId } }).then(result => {
      const found = result.items.find(v => v.code === documentId);
      if (found) handleOpenEdit(found);
      else showToast.warning(`Không tìm thấy phiếu xuất kho ${documentId}.`, 'Phiếu có thể đã bị xóa hoặc thuộc đơn vị khác.');
    }).catch(error => showToast.error(getErrorMessage(error)));
  });

  const handleOpenEdit = (voucher: GoodsVoucher) => {
    if (voucher.status === 'Chuyển sổ kho' && canEditPosted) showToast.info('Phiếu đã ghi sổ: khi lưu, hệ thống bỏ ghi sổ, sửa rồi ghi sổ lại; nếu làm âm kho thì không lưu được.');
    setEditingVoucherId(voucher.id);
    setActiveTab('items');

    // Right column fields
    setFormCompanyUnitId(voucher.companyUnitId || 'DVCS01');
    setFormCompanyUnitName(voucher.companyUnitName || 'Trụ sở chính TP. Hồ Chí Minh');
    setFormCode(voucher.code);
    setFormDate(voucher.date || new Date().toISOString().split('T')[0]);
    setFormCreatedDate(voucher.createdDate || voucher.date || new Date().toISOString().split('T')[0]);
    setFormStatus(voucher.status || 'Chờ duyệt');

    // Left column fields
    setFormVoucherType(voucher.voucherType || 'Xuất bán hàng');
    setFormWarehouseId(voucher.warehouseId);
    setFormWarehouseName(voucher.warehouseName);
    setFormCustomerName(voucher.supplierName || '');
    setFormReceiverName(voucher.delivererName || '');
    setFormCurrencyCode(voucher.currencyCode || 'VND');
    setFormExchangeRate(voucher.exchangeRate || 1);
    setFormCreatedBy(voucher.createdBy || 'Administrator');
    setFormNote(voucher.note || '');
    setFormProjectCode(voucher.projectCode || '');

    const emptyItem: VoucherItem = {
      productId: '',
      productName: '',
      sku: '',
      unit: '',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      lotNumber: '',
      position: ''
    };

    // Map items for Tab 1 + append 1 blank row for fast entry
    if (voucher.items && voucher.items.length > 0) {
      const mapped: VoucherItem[] = voucher.items.map(it => {
        const prod = products.find(p => p.id === it.productId || p.name === it.productName);
        return {
          productId: it.productId || prod?.id || '',
          productName: it.productName,
          sku: it.sku || prod?.sku || '',
          unit: it.unit || prod?.unit || '',
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || 0,
          totalPrice: (it.quantity || 1) * (it.unitPrice || 0),
          lotNumber: it.lotNumber || '',
          position: it.position || prod?.position || '',
          issueRequestLineId: it.issueRequestLineId
        };
      });
      mapped.push({ ...emptyItem });
      setFormItems(mapped);
    } else {
      setFormItems([{ ...emptyItem }]);
    }

    // Map material items for Tab 2 + append 1 blank row
    if (voucher.materialItems && voucher.materialItems.length > 0) {
      const mappedMat: VoucherItem[] = voucher.materialItems.map(it => {
        const prod = products.find(p => p.id === it.productId || p.name === it.productName);
        return {
          productId: it.productId || prod?.id || '',
          productName: it.productName,
          sku: it.sku || prod?.sku || '',
          unit: it.unit || prod?.unit || '',
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || 0,
          totalPrice: (it.quantity || 1) * (it.unitPrice || 0),
          lotNumber: it.lotNumber || '',
          position: it.position || prod?.position || ''
        };
      });
      mappedMat.push({ ...emptyItem, unit: '' });
      setFormMaterialItems(mappedMat);
    } else {
      setFormMaterialItems([{ ...emptyItem, unit: '' }]);
    }

    setSaveStatus('Draft');
    setIsModalOpen(true);
  };

  // Material Lookup & Direct Code Input Handlers
  const handleCodeSubmit = (rowIndex: number, field: string, codeValue: string, targetTab: 'items' | 'materials' = activeTab): boolean => {
    const query = (codeValue || '').trim().toLowerCase();
    if (!query) {
      setLookupTargetRowIndex(rowIndex);
      setIsMaterialLookupOpen(true);
      return false;
    }

    const matchedProduct = products.find(p => 
      (p.sku && p.sku.toLowerCase() === query) ||
      (p.ma_vt && p.ma_vt.toLowerCase() === query) ||
      (p.id && p.id.toLowerCase() === query) ||
      (p.name && p.name.toLowerCase() === query)
    );

    if (matchedProduct) {
      handleApplyProductToItem(rowIndex, matchedProduct, targetTab);
      return true;
    } else {
      setLookupTargetRowIndex(rowIndex);
      setIsMaterialLookupOpen(true);
      showToast.info(`Mã vật tư "${codeValue}" chưa có trong danh mục. Đã mở cửa sổ tra cứu.`);
      return false;
    }
  };

  const handleApplyProductToItem = (index: number, prod: Product, targetTab: 'items' | 'materials' = activeTab) => {
    const defaultPrice = 0;
    
    if (targetTab === 'items') {
      setFormItems(prev => {
        const updated = [...prev];
        const qty = updated[index]?.quantity || 1;
        updated[index] = {
          ...updated[index],
          productId: prod.id,
          productName: prod.name || prod.ten_vt || '',
          sku: prod.sku || prod.ma_vt || '',
          unit: prod.unit || prod.dvt || '',
          unitPrice: defaultPrice,
          totalPrice: qty * defaultPrice,
          position: prod.position || ''
        };
        // Tự động thêm 1 dòng trống bên dưới nếu dòng hiện tại là dòng cuối cùng
        if (index === updated.length - 1) {
          updated.push({
            productId: '',
            productName: '',
            sku: '',
            unit: '',
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0,
            lotNumber: '',
            position: ''
          });
        }
        return updated;
      });
    } else {
      setFormMaterialItems(prev => {
        const updated = [...prev];
        const qty = updated[index]?.quantity || 1;
        updated[index] = {
          ...updated[index],
          productId: prod.id,
          productName: prod.name || prod.ten_vt || '',
          sku: prod.sku || prod.ma_vt || '',
          unit: prod.unit || prod.dvt || '',
          unitPrice: defaultPrice,
          totalPrice: qty * defaultPrice,
          position: prod.position || ''
        };
        // Tự động thêm 1 dòng trống bên dưới nếu dòng hiện tại là dòng cuối cùng
        if (index === updated.length - 1) {
          updated.push({
            productId: '',
            productName: '',
            sku: '',
            unit: '',
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0,
            lotNumber: '',
            position: ''
          });
        }
        return updated;
      });
    }
  };

  const handleSkuInputChange = (index: number, skuQuery: string, targetTab: 'items' | 'materials' = activeTab) => {
    if (targetTab === 'items') {
      setFormItems(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], sku: skuQuery };
        return updated;
      });
    } else {
      setFormMaterialItems(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], sku: skuQuery };
        return updated;
      });
    }

    if (skuQuery.trim()) {
      const exactMatch = products.find(p => 
        (p.sku && p.sku.toLowerCase() === skuQuery.trim().toLowerCase()) ||
        (p.ma_vt && p.ma_vt.toLowerCase() === skuQuery.trim().toLowerCase())
      );
      if (exactMatch) {
        handleApplyProductToItem(index, exactMatch, targetTab);
      }
    }
  };

  const handleConfirmMasterLookup = (selectedProducts: Product[]) => {
    if (!selectedProducts || selectedProducts.length === 0) {
      setIsMaterialLookupOpen(false);
      return;
    }

    if (lookupTargetRowIndex !== null) {
      // Single replacement for specific row
      const prod = selectedProducts[0];
      if (prod) {
        handleApplyProductToItem(lookupTargetRowIndex, prod, activeTab);
        const nextRowIndex = lookupTargetRowIndex + 1;
        setTimeout(() => {
          const element = document.querySelector<HTMLInputElement>(`[data-grid-row="${nextRowIndex}"][data-grid-col="sku"]`) ||
                          document.querySelector<HTMLInputElement>(`[data-grid-row="${nextRowIndex}"]`);
          if (element) {
            element.focus();
            element.select?.();
          }
        }, 120);
      }
    } else {
      // Bulk addition
      const newItems: VoucherItem[] = selectedProducts.map(prod => {
        const defaultPrice = 0;
        return {
          productId: prod.id,
          productName: prod.name || prod.ten_vt || '',
          sku: prod.sku || prod.ma_vt || '',
          unit: prod.unit || prod.dvt || (activeTab === 'materials' ? '' : ''),
          quantity: 1,
          unitPrice: defaultPrice,
          totalPrice: defaultPrice,
          lotNumber: '',
          position: prod.position || ''
        };
      });

      if (activeTab === 'items') {
        setFormItems(prev => {
          let updated = prev.filter(it => Boolean(it.productId || it.sku || it.productName));
          updated = [...updated, ...newItems];
          updated.push({
            productId: '',
            productName: '',
            sku: '',
            unit: '',
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0,
            lotNumber: '',
            position: ''
          });
          return updated;
        });
      } else {
        setFormMaterialItems(prev => {
          let updated = prev.filter(it => Boolean(it.productId || it.sku || it.productName));
          updated = [...updated, ...newItems];
          updated.push({
            productId: '',
            productName: '',
            sku: '',
            unit: '',
            quantity: 1,
            unitPrice: 0,
            totalPrice: 0,
            lotNumber: '',
            position: ''
          });
          return updated;
        });
      }

      showToast.success(`Đã thêm ${selectedProducts.length} vật tư từ danh mục vào tab ${activeTab === 'items' ? 'Chi tiết' : 'Nguyên vật liệu'}!`);
    }

    setIsMaterialLookupOpen(false);
    setLookupTargetRowIndex(null);
  };

  // "Lấy từ phiếu yêu cầu": the approved requests with something left, read fresh every time. Editing a saved issue, what it already
  // takes is not counted as issued (the picker takes off what the form holds).
  const handleOpenRequestPicker = async () => {
    try {
      setOpenRequests(await goodsIssuesApi.getOpenRequests(editingVoucherId ?? undefined));
      setIsRequestPickerOpen(true);
    } catch (error) { showToast.error(getErrorMessage(error)); }
  };

  /**
   * Carries the ticked materials (with the quantity chosen) into the lines: every line keeps the request line it carries out and the
   * number of its request. The header comes from the first request pulled; later ones must share its warehouse and currency (the
   * picker only lets those be ticked). A request line already in the form gets the quantity added to its line.
   */
  const handleConfirmRequest = (picked: PickedRequestLine[]) => {
    setIsRequestPickerOpen(false);
    if (picked.length === 0) return;
    const first = formRequestCode ? undefined : picked[0].request;
    const items = formItems.filter(item => (item.sku || item.productId || '').trim() !== '').map(item => ({ ...item }));
    picked.forEach(({ request, line, quantity }) => {
      const existing = items.find(item => item.issueRequestLineId === line.lineId);
      if (existing) {
        existing.quantity = (Number(existing.quantity) || 0) + quantity;
        existing.totalPrice = existing.quantity * (existing.unitPrice || 0);
        existing.amount = existing.totalPrice;
        return;
      }
      items.push({
        productId: line.materialCode, sku: line.materialCode, productName: line.materialName, unit: line.uomCode,
        quantity, unitPrice: line.unitPrice, totalPrice: quantity * line.unitPrice, amount: quantity * line.unitPrice, lotNumber: '', position: '',
        issueRequestLineId: line.lineId, issueRequestCode: request.code
      } as VoucherItem);
    });
    const codes = [...new Set(items.map(item => item.issueRequestCode).filter(Boolean) as string[])];
    if (first) {
      setFormVoucherType(first.voucherType);
      setFormWarehouseId(first.warehouseCode);
      setFormWarehouseName(first.warehouseName);
      setFormCustomerName(first.customerName || '');
      setFormReceiverName(first.requesterName || '');
      if (first.currencyCode !== formCurrencyCode) void handleCurrencyChange(first.currencyCode);
    }
    setFormNote(prev => prev.trim() && !formRequestCode && !prev.startsWith('Xuất theo phiếu yêu cầu') ? prev : `Xuất theo phiếu yêu cầu ${codes.join(', ')}`);
    setFormItems([...items, { ...emptyBlankItem }]);
    setActiveTab('items');
    showToast.success(`Đã lấy ${picked.length} vật tư từ ${new Set(picked.map(p => p.request.code)).size} phiếu yêu cầu. Có thể sửa số lượng ở bảng chi tiết.`);
  };

  /** Unlinks the issue from its requests: the lines stay but no longer follow a request line. */
  const handleClearRequest = () => {
    setFormItems(prev => prev.map(item => ({ ...item, issueRequestLineId: undefined, issueRequestCode: undefined })));
  };

  // Confirm Warehouse Lookup
  const handleConfirmWarehouseLookup = (selectedItems: WarehouseType[]) => {
    if (selectedItems.length > 0) {
      const selected = selectedItems[0];
      if (selected) {
        setFormWarehouseId(selected.id);
        setFormWarehouseName(selected.name);
        showToast.success(`Đã chọn kho: ${selected.name}`);
      }
    }
    setIsWarehouseLookupOpen(false);
  };

  // Confirm Customer Lookup
  const handleConfirmCustomerLookup = (selectedItems: typeof MOCK_CUSTOMERS) => {
    if (selectedItems.length > 0) {
      const selected = selectedItems[0];
      if (selected) {
        setFormCustomerName(selected.name);
        showToast.success(`Đã chọn khách hàng: ${selected.name}`);
      }
    }
    setIsCustomerLookupOpen(false);
  };

  // Warehouse Lookup Columns
  const warehouseLookupColumns: ColumnDef<WarehouseType>[] = [
    {
      key: 'code',
      label: 'Mã Kho',
      render: (w) => (
        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
          {w.code || w.id}
        </span>
      )
    },
    {
      key: 'name',
      label: 'Tên Kho Hàng',
      render: (w) => <span className="font-extrabold text-slate-800 dark:text-slate-100 text-xs">{w.name}</span>
    },
    {
      key: 'manager',
      label: 'Thủ Kho',
      render: (w) => <span className="text-slate-600 dark:text-slate-300 text-xs">{w.manager || 'N/A'}</span>
    },
    {
      key: 'address',
      label: 'Địa Chỉ Kho',
      render: (w) => <span className="text-slate-500 text-xs">{w.address || 'N/A'}</span>
    },
    {
      key: 'status',
      label: 'Trạng Thái',
      render: (w) => (
        <Badge variant={w.status?.includes('Hoạt động') || w.status?.includes('hoạt động') ? 'success' : 'neutral'} className="text-[10px]">
          {w.status || 'Đang hoạt động'}
        </Badge>
      )
    }
  ];

  // Customer Lookup Columns
  const customerLookupColumns: ColumnDef<typeof MOCK_CUSTOMERS[0]>[] = [
    {
      key: 'code',
      label: 'Mã Đối Tác',
      render: (s) => (
        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
          {s.code}
        </span>
      )
    },
    {
      key: 'name',
      label: 'Tên Khách Hàng / Đối Tác',
      render: (s) => <span className="font-extrabold text-slate-800 dark:text-slate-100 text-xs">{s.name}</span>
    },
    {
      key: 'group',
      label: 'Nhóm Ngành',
      render: (s) => <span className="text-indigo-600 dark:text-indigo-300 font-medium text-xs">{s.group}</span>
    },
    {
      key: 'taxCode',
      label: 'Mã Số Thuế',
      render: (s) => <span className="font-mono text-slate-600 dark:text-slate-400 text-xs">{s.taxCode}</span>
    },
    {
      key: 'address',
      label: 'Địa Chỉ Headquarters',
      render: (s) => <span className="text-slate-500 text-xs">{s.address}</span>
    }
  ];

  // Filter options for Master Lookup Modal
  const productCategoriesFilter = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    return [
      {
        key: 'category',
        label: 'Loại Vật Tư',
        options: [
          { label: '-- Tất cả loại vật tư --', value: 'ALL' },
          ...cats.map(c => ({ label: c, value: c }))
        ]
      }
    ];
  }, [products]);

  // Master Lookup Table Columns Definition
  const masterLookupColumns: ColumnDef<Product>[] = [
    {
      key: 'sku',
      label: 'Mã VT / SKU',
      render: (p) => (
        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs">
          {p.sku || p.ma_vt || p.id}
        </span>
      )
    },
    {
      key: 'name',
      label: 'Tên Vật Tư / Hàng Hóa',
      render: (p) => (
        <div>
          <div className="font-bold text-slate-800 dark:text-slate-100 text-xs">{p.name || p.ten_vt}</div>
          {p.position && <div className="text-[10px] text-slate-400">Vị trí kho: {p.position}</div>}
        </div>
      )
    },
    {
      key: 'unit',
      label: 'ĐVT',
      render: (p) => <span className="text-center font-medium text-xs">{p.unit || p.dvt || ''}</span>
    },
    {
      key: 'category',
      label: 'Loại Vật Tư',
      render: (p) => (
        <Badge variant="outline" className="text-[10px]">
          {p.category || 'Vật tư'}
        </Badge>
      )
    }
  ];

  // Tab 1 Row actions
  const handleAddFormItem = () => {
    const firstProd = products[0];
    const defaultPrice = 0;
    const newItem: VoucherItem = {
      productId: firstProd?.id || '',
      productName: firstProd?.name || '',
      sku: firstProd?.sku || '',
      unit: firstProd?.unit || '',
      quantity: 1,
      unitPrice: defaultPrice,
      totalPrice: defaultPrice,
      lotNumber: '',
      position: firstProd?.position || ''
    };
    setFormItems(prev => [...prev, newItem]);
  };

  const handleRemoveFormItem = (index: number) => {
    if (formItems.length <= 1) {
      showToast.error('Phiếu xuất kho phải chứa ít nhất 1 mặt hàng trong chi tiết!');
      return;
    }
    setFormItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemFieldChange = (index: number, field: keyof VoucherItem, value: any) => {
    setFormItems(prev => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: value };

      if (field === 'quantity' || field === 'unitPrice') {
        const q = Number(field === 'quantity' ? value : current.quantity) || 0;
        const p = Number(field === 'unitPrice' ? value : current.unitPrice) || 0;
        current.totalPrice = q * p;
      }

      updated[index] = current;
      return updated;
    });
  };

  // Tab 2 Row actions (Nguyên vật liệu)
  const handleAddMaterialItem = () => {
    const firstProd = products.find(p => p.category?.toLowerCase().includes('vật tư') || p.category?.toLowerCase().includes('nguyên')) || products[0];
    const defaultPrice = 0;
    const newItem: VoucherItem = {
      productId: firstProd?.id || '',
      productName: firstProd?.name || '',
      sku: firstProd?.sku || '',
      unit: firstProd?.unit || '',
      quantity: 1,
      unitPrice: defaultPrice,
      totalPrice: defaultPrice,
      lotNumber: '',
      position: firstProd?.position || ''
    };
    setFormMaterialItems(prev => [...prev, newItem]);
  };

  const handleRemoveMaterialItem = (index: number) => {
    setFormMaterialItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleMaterialItemFieldChange = (index: number, field: keyof VoucherItem, value: any) => {
    setFormMaterialItems(prev => {
      const updated = [...prev];
      const current = { ...updated[index], [field]: value };

      if (field === 'quantity' || field === 'unitPrice') {
        const q = Number(field === 'quantity' ? value : current.quantity) || 0;
        const p = Number(field === 'unitPrice' ? value : current.unitPrice) || 0;
        current.totalPrice = q * p;
      }

      updated[index] = current;
      return updated;
    });
  };

  // Form Total Calculation (convert to VNĐ using formExchangeRate)
  const formTotalValue = useMemo(() => {
    const rate = formExchangeRate && formExchangeRate > 0 ? formExchangeRate : 1;
    const itemsTotal = formItems.reduce((sum, item) => {
      if (!item.productId && !item.sku && !item.productName) return sum;
      const lineVal = item.totalPrice || ((item.quantity || 0) * (item.unitPrice || 0));
      return sum + lineVal;
    }, 0);
    return itemsTotal * rate;
  }, [formItems, formExchangeRate]);

  const formMaterialTotalValue = useMemo(() => {
    const rate = formExchangeRate && formExchangeRate > 0 ? formExchangeRate : 1;
    const matTotal = formMaterialItems.reduce((sum, item) => {
      if (!item.productId && !item.sku && !item.productName) return sum;
      const lineVal = item.totalPrice || ((item.quantity || 0) * (item.unitPrice || 0));
      return sum + lineVal;
    }, 0);
    return matTotal * rate;
  }, [formMaterialItems, formExchangeRate]);

  // Rows that already hold a material (the grid keeps one blank row at the end for the next entry).
  const filledItemCount = formItems.filter(it => Boolean(it.productId || it.sku || it.productName)).length;
  const filledMaterialCount = formMaterialItems.filter(it => Boolean(it.productId || it.sku || it.productName)).length;

  // Submit Form (Save Voucher)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const asDraft = saveAsDraftRef.current;
    saveAsDraftRef.current = false;
    if (!canSaveForm) return;
    if (!(editingVoucherId ? perm.edit : perm.create)) {
      showToast.error('Tài khoản của bạn không có quyền cập nhật dữ liệu!');
      return;
    }

    if (!formCode.trim()) {
      showToast.error('Vui lòng nhập số chứng từ!');
      return;
    }

    const validItems = formItems.filter(item => Boolean(item.productId || item.sku || item.productName));
    const validMaterialItems = formMaterialItems.filter(item => Boolean(item.productId || item.sku || item.productName));

    if (validItems.length === 0) {
      showToast.error('Vui lòng khai báo ít nhất một mặt hàng xuất kho!');
      return;
    }

    const companyUnitObj = companyUnits.find(cu => cu.id === formCompanyUnitId || cu.name === formCompanyUnitName);
    const warehouseObj = warehouses.find(w => w.id === formWarehouseId || w.name === formWarehouseName);

    const savedVoucher: GoodsVoucher = {
      id: editingVoucherId || '0',
      version: localVouchers.find(v => v.id === editingVoucherId)?.version,
      type: 'Xuất kho',
      code: formCode.trim(),
      date: formDate,
      createdDate: formCreatedDate,
      companyUnitId: formCompanyUnitId,
      companyUnitName: companyUnitObj?.name || formCompanyUnitName || 'Trụ sở chính TP. Hồ Chí Minh',
      voucherType: formVoucherType,
      currencyCode: formCurrencyCode,
      exchangeRate: formExchangeRate,
      issueRequestCode: formRequestCode || undefined,
      supplierName: formCustomerName.trim(),
      delivererName: formReceiverName.trim(),
      warehouseId: formWarehouseId,
      warehouseName: warehouseObj?.name || formWarehouseName || 'Kho Tổng TP. Hồ Chí Minh',
      items: validItems,
      materialItems: validMaterialItems,
      totalValue: formTotalValue,
      createdBy: formCreatedBy || currentUser?.fullName || 'Trần Thịnh (Admin)',
      status: editingVoucherId ? formStatus : 'Lập chứng từ',
      projectCode: formProjectCode, note: formNote.trim()
    };

    setIsSaving(true);
    try {
      const result = editingVoucherId
        ? await goodsIssuesApi.update(savedVoucher, asDraft ? 'Draft' : saveStatus)
        : await goodsIssuesApi.create(savedVoucher, asDraft ? 'Draft' : saveStatus);
      setLocalVouchers(prev => editingVoucherId
        ? prev.map(v => v.id === editingVoucherId ? result : v)
        : [result, ...prev]);
      reloadListRef.current();
      showToast.success(`Đã lưu phiếu xuất kho [${result.code}], trạng thái: ${result.status}.`);
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
        ? { title: `Hủy phiếu xuất kho ${code}?`, message: 'Phiếu bị hủy không dùng được nữa. Nếu hủy nhầm, bấm Khôi phục để đưa phiếu về Lập chứng từ.', tone: 'warning', confirmLabel: 'Hủy phiếu', cancelLabel: 'Không' }
        : { title: `Bỏ ghi sổ phiếu xuất kho ${code}?`, message: 'Sổ kho được đảo lại và phiếu quay về Đã phê duyệt. Nếu việc này làm âm kho thì không bỏ ghi sổ được.', tone: 'warning', confirmLabel: 'Bỏ ghi sổ', cancelLabel: 'Không' });
      if (!ok) return;
    }
    try {
      const result = await goodsIssuesApi.changeStatus(voucherId, action);
      setLocalVouchers(prev => prev.map(v => v.id === voucherId ? result : v));
      reloadListRef.current();
      showToast.success(`Phiếu ${result.code}: ${result.status}.`);
    } catch (error) {
      showToast.error(getErrorMessage(error));
      await loadData();
    }
  };

  // Single Delete
  const handleConfirmSingleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await goodsIssuesApi.remove(itemToDelete.id);
      setLocalVouchers(prev => prev.filter(v => v.id !== itemToDelete.id));
      reloadListRef.current();
      showToast.success(`Đã xóa phiếu xuất kho [${itemToDelete.code}].`);
      setItemToDelete(null);
    } catch (error) { showToast.error(getErrorMessage(error)); }
  };

  // Bulk Delete
  const handleConfirmBulkDelete = async () => {
    if (!bulkToDeleteIds || bulkToDeleteIds.length === 0) return;
    const results = await Promise.allSettled(bulkToDeleteIds.map(id => goodsIssuesApi.remove(id)));
    const deleted = bulkToDeleteIds.filter((_, index) => results[index].status === 'fulfilled');
    setLocalVouchers(prev => prev.filter(v => !deleted.includes(v.id)));
    reloadListRef.current();
    showToast.info(`Đã xóa ${deleted.length}/${bulkToDeleteIds.length} phiếu. Chỉ phiếu nháp đủ quyền mới được xóa.`);
    setSelectedIds([]);
    setBulkToDeleteIds(null);
  };

  /** Two print forms: with prices and amounts (needs VIEW_PRICE) and without. */
  const handlePrint = (code: string, withPrice: boolean) => {
    if (!perm.print) {
      showToast.error('Tài khoản của bạn không có quyền In chứng từ!');
      return;
    }
    const voucher = localVouchers.find(v => v.code === code);
    if (!voucher) return;
    const opened = printVoucher({
      kind: 'issue', withPrice: withPrice && canViewPrice, voucher, company: systemSettingsService.getCompanyProfile(),
      format: { quantity: formatQuantity, unitPrice: formatUnitPrice, amount: value => formatNumber(value) },
      printedBy: currentUser?.fullName
    });
    if (!opened) showToast.error('Trình duyệt đã chặn cửa sổ in.');
  };

  // Render Status Badge
  const renderStatusBadge = (status?: string) => <VoucherStatusBadge voucherType="PXK" label={status} />;

  // Table Columns Definition
  const columns: GridViewColumn<GoodsVoucher>[] = [
    {
      key: 'code',
      title: 'Số Chứng Từ / Ngày',
      sortable: true,
      render: (v) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-xs hover:underline cursor-pointer" onClick={() => handleOpenEdit(v)}>
              {v.code}
            </span>
            {v.currencyCode && v.currencyCode !== 'VND' && (
              <span className="px-1.5 py-0.2 rounded text-[10px] font-extrabold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                {v.currencyCode} ({new Intl.NumberFormat('vi-VN').format(v.exchangeRate || 1)})
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400">
            Ngày CT: <span className="font-semibold text-slate-600 dark:text-slate-300">{v.date}</span>
          </p>
          <p className="text-[10px] text-slate-400">
            Lập bởi: <span className="font-medium text-slate-500">{v.createdBy}</span>
          </p>
        </div>
      )
    },
    {
      key: 'companyUnitName', sortKey: 'warehouse',
      title: 'Đơn Vị Cơ Sở / Kho',
      sortable: true,
      render: (v) => (
        <div className="space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1">
            <Building2 className="h-3 w-3 text-slate-400" />
            {v.companyUnitName || 'Trụ sở chính TP.HCM'}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Package className="h-3 w-3 text-indigo-400" />
            {v.warehouseName}
          </p>
          {v.supplierName && (
            <p className="text-[10px] text-slate-400 truncate max-w-[200px]" title={v.supplierName}>
              KH: <span className="font-medium text-slate-600 dark:text-slate-300">{v.supplierName}</span>
            </p>
          )}
        </div>
      )
    },
    {
      key: 'voucherType',
      title: 'Loại Xuất Kho',
      sortable: true,
      render: (v) => (
        <Badge variant="outline" className="text-[10px] bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700">
          <Tag className="h-3 w-3 mr-1 text-indigo-500" />
          {v.voucherType || 'Xuất bán hàng'}
        </Badge>
      )
    },
    {
      key: 'items',
      title: 'Sản Phẩm & Nguyên Vật Liệu',
      render: (v) => {
        const count = v.items?.length || 0;
        const totalQty = v.items?.reduce((sum, i) => sum + i.quantity, 0) || 0;
        const firstTwo = v.items?.slice(0, 2) || [];
        const matCount = v.materialItems?.length || 0;

        return (
          <div className="space-y-1 max-w-xs">
            {firstTwo.map((it, idx) => (
              <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 truncate">
                • <span className="font-medium">{it.productName}</span> ({it.quantity} {it.unit || ''})
              </div>
            ))}
            {count > 2 && (
              <div className="text-[10px] font-semibold text-indigo-500 italic">
                + thêm {count - 2} mặt hàng khác (Tổng {totalQty} SP)
              </div>
            )}
            {matCount > 0 && (
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Layers className="h-3 w-3" />
                {matCount} nguyên vật liệu cấu thành (BOM)
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'totalValue',
      title: 'Tổng Giá Trị (VNĐ)',
      sortable: true,
      align: 'right',
      render: (v) => (
        <div className="text-right">
          <span className="font-mono font-extrabold text-emerald-600 dark:text-emerald-400 text-sm block">
            {formatVND(v.totalValue)}
          </span>
          {v.currencyCode && v.currencyCode !== 'VND' && (
            <span className="text-[10px] font-mono text-slate-400">
              ({v.currencyCode} rate {v.exchangeRate})
            </span>
          )}
        </div>
      )
    },
    {
      key: 'status',
      title: 'Trạng Thái Phiếu',
      sortable: true,
      render: (v) => renderStatusBadge(v.status)
    },
    {
      key: 'actions',
      title: 'Thao Tác',
      align: 'center',
      render: (v) => (
        <div className="flex items-center justify-center gap-1">
          <RowActionSlot>
              <button
                type="button"
                onClick={() => handleOpenEdit(v)}
                className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"
                title="Xem & Sửa phiếu xuất"
              >
                <Edit3 className="h-4 w-4" />
              </button>
          </RowActionSlot>
          <RowActionSlot>
              {v.status === 'Hủy' && reachesStatus(currentUser, 'inv_issue', 'Cancelled') && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'reopen')} title="Khôi phục phiếu đã hủy (về Lập chứng từ)"
                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"><RotateCcw className="h-4 w-4" /></button>
              )}
              {v.status === 'Lập chứng từ' && (perm.create || perm.edit) && approvalInUse && (
                <button
                  type="button"
                  onClick={() => void handleQuickStatusChange(v.id, 'submit')}
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                  title="Gửi duyệt phiếu xuất kho"
                >
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              )}
              {v.status === 'Chờ duyệt' && canApprove && (
                <button
                  type="button"
                  onClick={() => void handleQuickStatusChange(v.id, 'approve')}
                  className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                  title="Phê duyệt phiếu xuất kho"
                >
                  <ShieldCheck className="h-4 w-4" />
                </button>
              )}
              {v.status === 'Đã phê duyệt' && reachesStatus(currentUser, 'inv_issue', 'Posted') && (
                <button
                  type="button"
                  onClick={() => void handleQuickStatusChange(v.id, 'post')}
                  className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors cursor-pointer"
                  title="Chuyển sổ kho"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </button>
              )}
              {v.status === 'Chuyển sổ kho' && hasStatusRight(currentUser, 'inv_issue', RIGHTS.ST_UNPOST) && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'unpost')}
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" title="Bỏ ghi sổ kho">
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
          </RowActionSlot>
          <RowActionSlot>
              {v.status === 'Chờ duyệt' && v.createdBy === currentUser?.fullName && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'withdraw')}
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg" title="Rút phiếu khỏi quy trình duyệt">
                  <Undo2 className="h-4 w-4" />
                </button>
              )}
              {v.status === 'Đã phê duyệt' && reachesStatus(currentUser, 'inv_issue', 'Cancelled') && (
                <button type="button" onClick={() => void handleQuickStatusChange(v.id, 'cancel')}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg" title="Hủy phiếu xuất kho (chưa ghi sổ)">
                  <XCircle className="h-4 w-4" />
                </button>
              )}
          </RowActionSlot>
          <RowActionSlot>
              {perm.print && <PrintMenuButton canPrintPrice={canViewPrice} onPrint={withPrice => handlePrint(v.code, withPrice)} />}
          </RowActionSlot>
          <RowActionSlot>
              {perm.delete && (v.status !== 'Chuyển sổ kho' || canEditPosted) && (
                <button
                  type="button"
                  onClick={() => setItemToDelete(v)}
                  className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                  title="Xóa phiếu"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
          </RowActionSlot>
        </div>
      )
    }
  ];

  return (
    <div className="w-full min-w-0 flex-1 flex flex-col min-h-0 space-y-3">
      
      {/* Dark Modern Header Toolbar */}
      <CategoryHeaderToolbar
        icon={<ArrowUpRight className="h-6 w-6 text-rose-400" />}
        title="Danh Mục Phiếu Xuất Kho (Goods Issues)"
        subtitle="Quản lý, lập mới, xem, sửa, xóa, tìm kiếm & lọc chứng từ xuất kho vật tư hàng hóa"
        count={totalVouchers}
        countLabel="Phiếu Xuất"
        showAdvancedFilter={showAdvancedFilter}
        onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
        activeFilterCount={activeFilterCount}
        onRefresh={handleRefresh}
        onExportExcel={perm.export ? handleExportExcel : undefined}
        addLabel="Lập Phiếu Xuất Mới"
        canCreate={perm.create}
        onOpenAdd={handleOpenAdd}
        filterPanelContent={
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-0.5">Mã / Số Chứng Từ</label>
              <input
                type="text"
                placeholder="PXK-202605-01..."
                value={codeFilter}
                onChange={(e) => setCodeFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-0.5">Loại Xuất Kho</label>
              <select
                value={voucherTypeFilter}
                onChange={(e) => setVoucherTypeFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="">-- Tất cả loại xuất --</option>
                <option value="Xuất bán hàng">Xuất bán hàng</option>
                <option value="Xuất điều chuyển nội bộ">Xuất điều chuyển nội bộ</option>
                <option value="Xuất nguyên vật liệu sản xuất">Xuất nguyên vật liệu sản xuất</option>
                <option value="Xuất hàng mẫu / Khuyến mãi">Xuất hàng mẫu / Khuyến mãi</option>
                <option value="Xuất kiểm kê giảm / Hủy">Xuất kiểm kê giảm / Hủy</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-0.5">Trạng Thái Phiếu</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="">-- Tất cả trạng thái --</option>
                <option value="Lập chứng từ">Lập chứng từ</option>
                <option value="Chờ duyệt">Chờ duyệt</option>
                <option value="Đã phê duyệt">Đã phê duyệt</option>
                <option value="Chuyển sổ kho">Chuyển sổ kho</option>
                <option value="Hủy">Đã hủy</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-0.5">Kho Xuất Hàng</label>
              <select
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
              >
                <option value="">-- Tất cả kho --</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-0.5">Từ Ngày Chứng Từ</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-0.5">Đến Ngày Chứng Từ</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>
          </div>
        }
        onApplyFilter={handleApplyFilter}
        onClearFilter={handleClearFilter}
      />

      {/* GridView Data Table Component */}
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
        searchPlaceholder="Tìm kiếm mã phiếu, khách hàng, ghi chú, kho xuất, sản phẩm..."
        searchValue={searchText}
        onSearchChange={setSearchText}
        selectable={true}
        selectedIds={selectedIds}
        onSelectionChange={(ids) => setSelectedIds(ids.map(String))}
        batchActions={
          perm.delete ? [
            {
              label: 'Xóa các phiếu đã chọn',
              icon: <Trash2 className="h-3.5 w-3.5 text-rose-500" />,
              variant: 'danger',
              onClick: (_, ids) => setBulkToDeleteIds(ids.map(String))
            }
          ] : []
        }
        emptyText="Không tìm thấy chứng từ phiếu xuất kho nào phù hợp."
        pageSize={pageSize}
        pageSizeOptions={[10, 15, 20, 30, 50, 100]}
        dense={true}
      />

      {/* MODAL FORM: VIEW & EDIT / CREATE GOODS RECEIPT VOUCHER */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingVoucherId ? `Chi Tiết & Cập Nhật Phiếu Xuất Kho: [${formCode}]` : 'Lập Phiếu Xuất Kho Mới'}
        fullScreen={true}
        headerActions={
          <div className="flex items-center gap-2 shrink-0">
            {editingVoucherId && perm.print && <PrintMenuButton variant="button" canPrintPrice={canViewPrice} onPrint={withPrice => handlePrint(formCode, withPrice)} />}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsModalOpen(false)}
              icon={<XCircle className="h-3.5 w-3.5 text-slate-500" />}
              className="py-1 px-3 text-xs font-medium cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700"
            >
              Hủy
            </Button>
            {!editingPosted && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Save className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />}
                onClick={() => {
                  saveAsDraftRef.current = true;
                  (document.getElementById('goods-issue-form') as HTMLFormElement | null)?.requestSubmit();
                }}
                disabled={isSaving || !canSaveForm}
                title="Lưu phiếu ở trạng thái Lập chứng từ, dù ô Trạng thái đang chọn gì"
                className="py-1 px-3 text-xs font-semibold cursor-pointer bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900"
              >
                Lưu Nháp
              </Button>
            )}
            <Button
              type="submit"
              variant="success"
              size="sm"
              icon={<CheckCircle2 className="h-3.5 w-3.5 text-white" />}
              onClick={() => {
                (document.getElementById('goods-issue-form') as HTMLFormElement | null)?.requestSubmit();
              }}
              disabled={isSaving || !canSaveForm}
              className="py-1 px-4 text-xs font-bold cursor-pointer bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs border border-emerald-600"
            >
              {saveStatus === 'Draft' ? (editingVoucherId ? 'Lưu & Cập Nhật' : 'Lưu Phiếu Xuất Kho') : `Lưu và ${saveStatusName('PXK', saveStatus).toLowerCase()}`}
            </Button>
          </div>
        }
      >
        <form id="goods-issue-form" onSubmit={handleSubmitForm} className="flex-1 min-h-0 flex flex-col gap-2 text-xs overflow-y-auto custom-scrollbar pt-2 pr-1">

          {/* I. PHẦN THÔNG TIN CHUNG (HEADER) - BALANCED 8-4 GRID LAYOUT */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 text-xs shrink-0">
            
            {/* BÊN TRÁI (LG:COL-SPAN-8): THÔNG TIN NGHIỆP VỤ, KHO & ĐỐI TÁC */}
            <div className="md:col-span-8 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between h-6 pb-1 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Tag className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate">
                    I. Thông Tin Nghiệp Vụ & Đối Tác
                  </h4>
                </div>
                <span className="text-[10px] font-medium text-slate-400 shrink-0 hidden sm:inline">Nghiệp vụ kho & khách hàng</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 sm:gap-2 text-xs">
                {/* Loại xuất xuất */}
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5">
                    Loại Xuất Kho <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formVoucherType}
                    onChange={(e) => setFormVoucherType(e.target.value)}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 font-medium text-[11px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[26px]"
                  >
                    <option value="Xuất bán hàng">Xuất bán hàng</option>
                    <option value="Xuất điều chuyển nội bộ">Xuất điều chuyển nội bộ</option>
                    <option value="Xuất nguyên vật liệu sản xuất">Xuất nguyên vật liệu sản xuất</option>
                    <option value="Xuất hàng mẫu / Khuyến mãi">Xuất hàng mẫu / Khuyến mãi</option>
                    <option value="Xuất kiểm kê giảm / Hủy">Xuất kiểm kê giảm / Hủy</option>
                  </select>
                </div>

                {/* Kho xuất hàng (Lookup enabled) */}
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5">
                    Kho Xuất Hàng <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <select
                      required
                      value={formWarehouseId}
                      disabled={Boolean(formRequestCode)}
                      title={formRequestCode ? 'Phiếu xuất theo yêu cầu phải xuất từ kho của phiếu yêu cầu' : undefined}
                      onChange={(e) => {
                        setFormWarehouseId(e.target.value);
                        const wh = warehouses.find(w => w.id === e.target.value);
                        if (wh) setFormWarehouseName(wh.name);
                      }}
                      className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 font-medium text-[11px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[26px]"
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={Boolean(formRequestCode)}
                      onClick={() => setIsWarehouseLookupOpen(true)}
                      className="px-1.5 h-[26px] bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs"
                      title="Tra cứu danh mục Kho (F4)"
                    >
                      <Search className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Khách hàng / Đối tác (Lookup enabled) */}
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5">
                    Khách Hàng / Đối Tác
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="VinFast, Masan, FPT..."
                      value={formCustomerName}
                      onChange={(e) => setFormCustomerName(e.target.value)}
                      className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 font-medium text-[11px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[26px]"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomerLookupOpen(true)}
                      className="px-1.5 h-[26px] bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs"
                      title="Tra cứu danh mục Khách Hàng / Đối Tác (F4)"
                    >
                      <Search className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Người nhận hàng */}
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5">
                    Người Nhận Hàng
                  </label>
                  <input
                    type="text"
                    placeholder="Họ tên người nhận hàng..."
                    value={formReceiverName}
                    onChange={(e) => setFormReceiverName(e.target.value)}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 font-medium text-[11px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[26px]"
                  />
                </div>

                {formRequestCode && (
                  <div className="sm:col-span-2 xl:col-span-3 flex items-center justify-between gap-2 rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-2 py-1">
                    <span className="flex items-center gap-1.5 text-[11px] text-amber-800 dark:text-amber-300 min-w-0">
                      <ClipboardCheck className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Xuất theo phiếu yêu cầu <strong className="font-mono">{formRequestCode.split(',').join(', ')}</strong> (mỗi dòng gắn với một dòng yêu cầu, không xuất quá số còn lại)</span>
                    </span>
                    {canSaveForm && (
                      <button type="button" onClick={handleClearRequest} className="shrink-0 text-[10.5px] font-bold text-rose-600 hover:underline cursor-pointer">Bỏ liên kết</button>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5">Dự Án</label>
                  <CatalogLookup lookup="projects" value={formProjectCode} onChange={code => setFormProjectCode(code)} />
                </div>

                {/* Ghi chú / Diễn giải (Spans 2 cols) */}
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5">
                    Ghi Chú / Diễn Giải Nghiệp Vụ
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Xuất kho bán hàng theo đơn SO-2026-882..."
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 font-normal text-[11px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[26px]"
                  />
                </div>
              </div>
            </div>

            {/* BÊN PHẢI (LG:COL-SPAN-4): THẺ CHỨNG TỪ & TIỀN TỆ COMPACT 2-COL GRID */}
            <div className="md:col-span-4 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between h-6 pb-1 border-b border-slate-100 dark:border-slate-800/80 gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate">
                    II. Chứng Từ & Tiền Tệ
                  </h4>
                </div>
                <div className="shrink-0 scale-85 origin-right">
                  {renderStatusBadge(shownStatus)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-xs">
                {/* 1. Đơn Vị CS */}
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5 truncate">
                    Đơn Vị CS <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formCompanyUnitId}
                    disabled
                    onChange={() => {}}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 font-bold text-slate-800 dark:text-slate-100 text-[10.5px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all truncate h-[26px]"
                  >
                    <option value={activeUnitCode}>{activeUnitCode} - {formCompanyUnitName || activeUnitCode}</option>
                  </select>
                </div>

                {/* 2. Số Chứng Từ */}
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5 truncate">
                    Số Chứng Từ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formCode}
                    readOnly
                    placeholder="PXK-202608-001"
                    className="w-full bg-indigo-50/40 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 rounded-lg px-1.5 py-0.5 font-mono font-black text-indigo-700 dark:text-indigo-300 text-[10.5px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[26px]"
                  />
                </div>

                {/* 3. Trạng Thái */}
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5 truncate">
                    Trạng Thái <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={shownStatus}
                    disabled={!canChooseStatus}
                    onChange={e => setSaveStatus(statusFromLabel(e.target.value))}
                    title={canChooseStatus ? 'Chọn trạng thái lưu phiếu, theo quyền của bạn' : undefined}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 font-extrabold text-slate-800 dark:text-slate-100 text-[10.5px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[26px]"
                  >
                    {canChooseStatus
                      ? statusChoices.map(choice => <option key={choice} value={SAVE_STATUS_LABELS[choice]}>{saveStatusName('PXK', choice)}</option>)
                      : (
                        <>
                          <option value="Lập chứng từ">Lập chứng từ</option>
                          <option value="Chờ duyệt">Chờ duyệt</option>
                          <option value="Đã phê duyệt">Đã phê duyệt</option>
                          <option value="Chuyển sổ kho">Chuyển sổ kho</option>
                          <option value="Hủy">Hủy phiếu</option>
                        </>
                      )}
                  </select>
                </div>

                {/* 4. Người Lập */}
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5 truncate">
                    Người Lập
                  </label>
                  <input
                    type="text"
                    value={formCreatedBy}
                    readOnly
                    placeholder="NV Kho..."
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 font-medium text-[10.5px] focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all h-[26px]"
                  />
                </div>

                {/* 5. Ngày CT */}
                <div>
                  <DateTimePicker
                    label="Ngày CT"
                    type="date"
                    required
                    value={formDate}
                    onChange={(val) => {
                      setFormDate(val);
                      if (!editingVoucherId) voucherNumberingApi.preview('PXK', val).then(setFormCode)
                        .catch(error => showToast.error(getErrorMessage(error)));
                      exchangeRatesApi.getRate(formCurrencyCode, val).then(setFormExchangeRate)
                        .catch(error => showToast.error(getErrorMessage(error)));
                    }}
                  />
                </div>

                {/* 6. Ngày Lập */}
                <div>
                  <DateTimePicker
                    label="Ngày Lập"
                    type="date"
                    required
                    value={formCreatedDate}
                    onChange={() => {}}
                    disabled
                  />
                </div>

                {/* 7. Loại Tiền */}
                <div>
                  <ComboBox
                    label="Loại Tiền"
                    options={currencies.map(c => ({ value: c.code, label: `${c.code} - ${c.name}` }))}
                    value={formCurrencyCode}
                    onChange={(val) => handleCurrencyChange(val)}
                    clearable={false}
                    searchable={false}
                  />
                </div>

                {/* 8. Tỷ Giá */}
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5 truncate">
                    Tỷ Giá
                  </label>
                  <NumberInput
                    value={formExchangeRate}
                    onChange={() => {}}
                    readOnly
                    min={1}
                    decimals={2}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* II. CHI TIẾT: chiếm hết chỗ còn lại của cửa sổ */}
          <section className="flex-1 min-h-[300px] flex flex-col bg-white dark:bg-slate-900 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 gap-1.5">
            <div className="flex items-center justify-between gap-2 flex-wrap shrink-0">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab('items')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'items'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs border border-slate-200/80 dark:border-slate-700'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Package className="h-3.5 w-3.5" />
                  <span>Chi tiết mặt hàng</span>
                  <span className="px-1.5 rounded-full text-[9.5px] bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-black">{filledItemCount}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('materials')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'materials'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs border border-slate-200/80 dark:border-slate-700'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>NVL (BOM)</span>
                  <span className="px-1.5 rounded-full text-[9.5px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black">{filledMaterialCount}</span>
                </button>
              </div>

              {/* Bên phải: nút lấy dữ liệu ngay bên trái nút tra cứu vật tư */}
              <div className="flex items-center gap-1.5 flex-wrap ml-auto">
              {canSaveForm && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleOpenRequestPicker()}
                  icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                  title="Lấy dữ liệu từ phiếu yêu cầu xuất kho đã duyệt"
                  className="text-[10.5px] py-1 px-2.5 h-[26px] shadow-2xs font-semibold border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                >
                  Lấy từ phiếu yêu cầu
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => {
                  setLookupTargetRowIndex(null);
                  setIsMaterialLookupOpen(true);
                }}
                icon={<Search className="h-3.5 w-3.5" />}
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10.5px] py-1 px-2.5 h-[26px] shadow-2xs font-semibold"
              >
                Tra cứu vật tư (F2)
              </Button>
              </div>
            </div>

            {activeTab === 'items' && (
              <VoucherDetailGrid
                fill
                showAddButton={false}
                hiddenFields={hiddenPriceFields}
                gridInfo={goodsIssueItemsGridConfig}
                data={formItems}
                onChange={(newItems) => setFormItems(newItems as VoucherItem[])}
                onLookupClick={(rowIndex) => {
                  setLookupTargetRowIndex(rowIndex);
                  setIsMaterialLookupOpen(true);
                }}
                onCodeSubmit={(rowIndex, field, codeValue) => handleCodeSubmit(rowIndex, field, codeValue, 'items')}
                currencyCode={formCurrencyCode}
                exchangeRate={formExchangeRate}
              />
            )}

            {activeTab === 'materials' && (
              <VoucherDetailGrid
                fill
                showAddButton={false}
                hiddenFields={hiddenPriceFields}
                gridInfo={goodsIssueMaterialsGridConfig}
                data={formMaterialItems}
                onChange={(newItems) => setFormMaterialItems(newItems as VoucherItem[])}
                onLookupClick={(rowIndex) => {
                  setLookupTargetRowIndex(rowIndex);
                  setIsMaterialLookupOpen(true);
                }}
                onCodeSubmit={(rowIndex, field, codeValue) => handleCodeSubmit(rowIndex, field, codeValue, 'materials')}
                currencyCode={formCurrencyCode}
                exchangeRate={formExchangeRate}
              />
            )}
          </section>

          {/* Thanh tóm tắt: phiếu và tổng tiền (nút Lưu / Hủy nằm ở thanh tiêu đề của cửa sổ) */}
          <div className="shrink-0 flex items-center justify-between gap-3 flex-wrap px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="text-[11px] text-slate-500 font-medium">
              Phiếu <strong className="font-mono text-indigo-600 dark:text-indigo-400">{formCode}</strong>
              <span className="mx-1.5 text-slate-300">|</span>
              {filledItemCount} mặt hàng{filledMaterialCount > 0 ? `, ${filledMaterialCount} NVL` : ''}
            </span>
            {canViewPrice && (
              <span className="text-[11px] text-slate-500 font-medium">
                Tổng tiền: <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">{formTotalValue.toLocaleString('vi-VN')} {formCurrencyCode}</strong>
              </span>
            )}
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modals */}
      <DeleteConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmSingleDelete}
        itemCode={itemToDelete?.code}
        itemName={`Phiếu xuất kho ngày ${itemToDelete?.date}${canViewPrice ? ` (${formatVND(itemToDelete?.totalValue || 0)})` : ''}`}
      />

      <DeleteConfirmModal
        isOpen={!!bulkToDeleteIds && bulkToDeleteIds.length > 0}
        onClose={() => setBulkToDeleteIds(null)}
        onConfirm={handleConfirmBulkDelete}
        isBulk
        bulkCount={bulkToDeleteIds?.length || 0}
      />

      {/* Master Lookup Modal for Materials */}
      <MasterLookupModal
        isOpen={isMaterialLookupOpen}
        onClose={() => {
          setIsMaterialLookupOpen(false);
          setLookupTargetRowIndex(null);
        }}
        title="Tra Cứu & Chọn Vật Tư / Hàng Hóa Từ Danh Mục"
        subtitle={lookupTargetRowIndex !== null ? `Chọn 1 vật tư để gán cho dòng hiện tại (Tab ${activeTab === 'items' ? 'Chi tiết' : 'Nguyên vật liệu'})` : `Chọn một hoặc nhiều vật tư để thêm vào tab ${activeTab === 'items' ? 'Chi tiết' : 'Nguyên vật liệu'}`}
        data={products}
        columns={masterLookupColumns}
        idField="id"
        displayField="name"
        searchFields={['sku', 'ma_vt', 'name', 'ten_vt', 'category', 'position']}
        searchPlaceholder="Nhập mã vật tư, SKU, tên vật tư hoặc vị trí kho để tìm kiếm..."
        filters={productCategoriesFilter}
        selectionMode={lookupTargetRowIndex !== null ? 'single' : 'multiple'}
        selectedIds={
          lookupTargetRowIndex !== null
            ? activeTab === 'items'
              ? [formItems[lookupTargetRowIndex]?.productId].filter(Boolean) as string[]
              : [formMaterialItems[lookupTargetRowIndex]?.productId].filter(Boolean) as string[]
            : []
        }
        onConfirm={handleConfirmMasterLookup}
        pageSize={8}
      />

      {/* Approved issue requests with something left to issue: requests on top, their materials below */}
      <IssueRequestPicker
        isOpen={isRequestPickerOpen}
        onClose={() => setIsRequestPickerOpen(false)}
        requests={openRequests}
        taken={takenByForm}
        lockedWarehouse={formRequestCode ? formWarehouseId : undefined}
        lockedCurrency={formRequestCode ? formCurrencyCode : undefined}
        onConfirm={handleConfirmRequest}
      />

      {/* Master Lookup Modal for Warehouses */}
      <MasterLookupModal
        isOpen={isWarehouseLookupOpen}
        onClose={() => setIsWarehouseLookupOpen(false)}
        title="Tra Cứu & Chọn Kho Xuất Hàng Từ Danh Mục"
        subtitle="Chọn 1 kho hàng từ danh mục hệ thống để gán cho phiếu xuất"
        data={warehouses}
        columns={warehouseLookupColumns}
        idField="id"
        displayField="name"
        searchFields={['id', 'code', 'name', 'manager', 'address']}
        searchPlaceholder="Nhập mã kho, tên kho, thủ kho hoặc địa chỉ để tìm kiếm..."
        selectionMode="single"
        selectedIds={[formWarehouseId].filter(Boolean)}
        onConfirm={handleConfirmWarehouseLookup}
        pageSize={6}
      />

      {/* Master Lookup Modal for Customers */}
      <MasterLookupModal
        isOpen={isCustomerLookupOpen}
        onClose={() => setIsCustomerLookupOpen(false)}
        title="Tra Cứu & Chọn Khách Hàng / Đối Tác"
        subtitle="Chọn 1 khách hàng hoặc đối tác từ danh mục danh bạ"
        data={MOCK_CUSTOMERS}
        columns={customerLookupColumns}
        idField="id"
        displayField="name"
        searchFields={['id', 'code', 'name', 'taxCode', 'group', 'address']}
        searchPlaceholder="Nhập mã KH, tên đối tác, MST hoặc nhóm ngành để tìm kiếm..."
        selectionMode="single"
        selectedIds={[]}
        onConfirm={handleConfirmCustomerLookup}
        pageSize={6}
      />

    </div>
  );
};
