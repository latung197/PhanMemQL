import React, { useState, useMemo, useEffect } from 'react';
import { 
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
  XCircle,
  Truck,
  Users
} from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { Badge } from '../../../components/common/Badge';
import { CategoryHeaderToolbar } from '../../../components/common/CategoryHeaderToolbar';
import { DeleteConfirmModal } from '../../../components/common/DeleteConfirmModal';
import { GridView, GridViewColumn } from '../../../components/common/GridView';
import { MasterLookupModal, ColumnDef, FilterConfig } from '../../../components/common/MasterLookupModal';
import { NumberInput, QuantityInput, DateTimePicker, ComboBox, VoucherDetailGrid } from '../../../components/common';
import { goodsIssueItemsGridConfig, goodsIssueMaterialsGridConfig } from '../../../mock/voucherGridConfigs';
import { useNumberFormat } from '../../../context/NumberFormatContext';
import { GoodsVoucher, VoucherItem, Product, Warehouse as WarehouseType, CompanyUnit, UserProfile } from '../../../types';
import { getActionPermission } from '../../../mock/initialRoles';
import { hasRight, RIGHTS } from '../../../utils/permissions';
import { useOpenDocumentRequest } from '../../../utils/documentLinks';
import { showToast } from '../../../utils/toast';

interface GoodsIssueViewProps {
  vouchers: GoodsVoucher[];
  products: Product[];
  warehouses: WarehouseType[];
  companyUnits?: CompanyUnit[];
  onAddVoucher: (voucher: GoodsVoucher) => void;
  currentUser?: UserProfile;
}

export const CURRENCY_OPTIONS_ISSUE = [
  { code: 'VND', name: 'VNĐ - Đồng Việt Nam', defaultRate: 1, symbol: '₫' },
  { code: 'USD', name: 'USD - Đô la Mỹ', defaultRate: 25400, symbol: '$' },
  { code: 'EUR', name: 'EUR - Euro', defaultRate: 27200, symbol: '€' },
  { code: 'JPY', name: 'JPY - Yên Nhật', defaultRate: 165, symbol: '¥' },
  { code: 'CNY', name: 'CNY - Nhân dân tệ', defaultRate: 3550, symbol: '¥' },
  { code: 'GBP', name: 'GBP - Bảng Anh', defaultRate: 32100, symbol: '£' },
  { code: 'AUD', name: 'AUD - Đô la Úc', defaultRate: 16800, symbol: 'A$' },
  { code: 'SGD', name: 'SGD - Đô la Singapore', defaultRate: 18900, symbol: 'S$' },
];

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

export const GoodsIssueView: React.FC<GoodsIssueViewProps> = ({
  vouchers,
  products,
  warehouses,
  companyUnits = [],
  onAddVoucher,
  currentUser
}) => {
  // Sync local vouchers with prop vouchers
  const [localVouchers, setLocalVouchers] = useState<GoodsVoucher[]>(vouchers);

  useEffect(() => {
    setLocalVouchers(vouchers);
  }, [vouchers]);

  // Filter & Search state
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [codeFilter, setCodeFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Selected Items for Bulk Action
  const [selectedIds, setSelectedIds] = useState<(string | number)[]>([]);
  const [itemToDelete, setItemToDelete] = useState<GoodsVoucher | null>(null);
  const [bulkToDeleteIds, setBulkToDeleteIds] = useState<string[] | null>(null);

  // Modal / Form state (Create or Edit mode)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVoucherId, setEditingVoucherId] = useState<string | null>(null);

  // Active Tab in Detail Modal Form: 'items' (Chi tiết hàng hóa xuất) | 'materials' (Nguyên vật liệu)
  const [activeTab, setActiveTab] = useState<'items' | 'materials'>('items');

  // Print Preview Modal State
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printVoucher, setPrintVoucher] = useState<GoodsVoucher | null>(null);

  // Form Fields - Header Information
  // BÊN PHẢI: Mã đơn vị cơ sở, Ngày ct, Ngày lập ct, Số chứng từ, Trạng thái phiếu
  const [formCompanyUnitId, setFormCompanyUnitId] = useState('');
  const [formCompanyUnitName, setFormCompanyUnitName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formCreatedDate, setFormCreatedDate] = useState(new Date().toISOString().split('T')[0]);
  const [formStatus, setFormStatus] = useState<string>('Lập chứng từ');

  // BÊN TRÁI: Loại xuất kho, Kho xuất, Khách hàng / Đối tác, Người nhận, Loại tiền & Tỷ giá, Người lập, Ghi chú
  const [formVoucherType, setFormVoucherType] = useState('Xuất bán hàng');
  const [formWarehouseId, setFormWarehouseId] = useState('');
  const [formWarehouseName, setFormWarehouseName] = useState('');
  const [formPartnerName, setFormPartnerName] = useState('');
  const [formRecipientName, setFormRecipientName] = useState('');
  const [formCurrencyCode, setFormCurrencyCode] = useState('VND');
  const [formExchangeRate, setFormExchangeRate] = useState<number>(1);
  const [formCreatedBy, setFormCreatedBy] = useState('');
  const [formNote, setFormNote] = useState('');

  // Form Fields - Line Items List (Tab 1: Chi Tiết Xuất Kho)
  const [formItems, setFormItems] = useState<VoucherItem[]>([]);

  // Form Fields - Material Items List (Tab 2: Nguyên Vật Liệu / Cấu Trúc SP)
  const [formMaterialItems, setFormMaterialItems] = useState<VoucherItem[]>([]);

  // Master Lookup & Autocomplete States
  const [isMaterialLookupOpen, setIsMaterialLookupOpen] = useState(false);
  const [isWarehouseLookupOpen, setIsWarehouseLookupOpen] = useState(false);
  const [isCustomerLookupOpen, setIsCustomerLookupOpen] = useState(false);
  const [lookupTargetRowIndex, setLookupTargetRowIndex] = useState<number | null>(null);

  const perm = getActionPermission(currentUser, 'inv_issue');
  // Quyền đặc biệt "Xem đơn giá & thành tiền": không có thì ẩn mọi cột/ô giá trị trên phiếu.
  const canViewPrice = hasRight(currentUser, 'inv_issue', RIGHTS.VIEW_PRICE);
  const hiddenPriceFields = canViewPrice ? undefined : ['unitPrice', 'amount'];

  // Filter issue vouchers only (type === 'Xuất kho')
  const issueVouchers = useMemo(() => {
    return localVouchers.filter(v => v.type === 'Xuất kho');
  }, [localVouchers]);

  // Compute active filters count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (codeFilter.trim()) count++;
    if (unitFilter) count++;
    if (voucherTypeFilter) count++;
    if (statusFilter) count++;
    if (warehouseFilter) count++;
    if (fromDate) count++;
    if (toDate) count++;
    return count;
  }, [codeFilter, unitFilter, voucherTypeFilter, statusFilter, warehouseFilter, fromDate, toDate]);

  // Filtered vouchers array
  const filteredVouchers = useMemo(() => {
    return issueVouchers.filter(v => {
      // General Search
      if (searchText.trim()) {
        const term = searchText.toLowerCase();
        const matchesCode = v.code.toLowerCase().includes(term);
        const matchesNote = (v.note || '').toLowerCase().includes(term);
        const matchesWh = (v.warehouseName || '').toLowerCase().includes(term);
        const matchesUnit = (v.companyUnitName || '').toLowerCase().includes(term);
        const matchesPartner = (v.partnerName || v.supplierName || '').toLowerCase().includes(term);
        const matchesProduct = v.items?.some(it => it.productName.toLowerCase().includes(term) || (it.sku || '').toLowerCase().includes(term));
        if (!matchesCode && !matchesNote && !matchesWh && !matchesUnit && !matchesPartner && !matchesProduct) {
          return false;
        }
      }

      // Code filter
      if (codeFilter.trim()) {
        const codes = codeFilter.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        if (codes.length > 0 && !codes.some(c => v.code.toLowerCase().includes(c))) {
          return false;
        }
      }

      // Company Unit filter
      if (unitFilter && v.companyUnitId !== unitFilter && v.companyUnitName !== unitFilter) {
        return false;
      }

      // Voucher Type filter
      if (voucherTypeFilter && (v.voucherType || 'Xuất bán hàng') !== voucherTypeFilter) {
        return false;
      }

      // Status filter
      if (statusFilter) {
        const currentStatus = v.status || 'Đã phê duyệt';
        if (currentStatus !== statusFilter) return false;
      }

      // Warehouse filter
      if (warehouseFilter && v.warehouseId !== warehouseFilter) {
        return false;
      }

      // From date filter
      if (fromDate && v.date < fromDate) {
        return false;
      }

      // To date filter
      if (toDate && v.date > toDate) {
        return false;
      }

      return true;
    });
  }, [issueVouchers, searchText, codeFilter, unitFilter, voucherTypeFilter, statusFilter, warehouseFilter, fromDate, toDate]);

  const { formatQuantity } = useNumberFormat();

  const formatVND = (num: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num || 0);
  };

  const formatMoney = (amount: number, curr: string = 'VND') => {
    if (curr === 'VND' || !curr) return formatVND(amount);
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr }).format(amount || 0);
  };

  // Currency Change Handler
  const handleCurrencyChange = (cCode: string) => {
    setFormCurrencyCode(cCode);
    const matched = CURRENCY_OPTIONS_ISSUE.find(c => c.code === cCode);
    if (matched) {
      setFormExchangeRate(matched.defaultRate);
    }
  };

  // Filter actions
  const handleApplyFilter = () => {
    showToast.info('Đã áp dụng các bộ lọc nâng cao!');
  };

  const handleClearFilter = () => {
    setCodeFilter('');
    setUnitFilter('');
    setVoucherTypeFilter('');
    setStatusFilter('');
    setWarehouseFilter('');
    setFromDate('');
    setToDate('');
    setSearchText('');
    showToast.info('Đã xóa tất cả bộ lọc!');
  };

  const handleRefresh = () => {
    setLocalVouchers([...vouchers]);
    showToast.success('Đã làm mới dữ liệu danh sách phiếu xuất kho!');
  };

  const handleExportExcel = () => {
    if (!perm.printExport) {
      showToast.error('Tài khoản của bạn không có quyền Xuất Excel!');
      return;
    }
    showToast.success('Đã xuất file dữ liệu danh mục Phiếu Xuất Kho (.xlsx) thành công!');
  };

  const handleImportExcel = () => {
    if (!perm.createEdit) {
      showToast.error('Tài khoản của bạn không có quyền Nhập Excel!');
      return;
    }
    showToast.info('Vui lòng chọn file Excel (.xlsx, .csv) chứa dữ liệu chứng từ xuất kho để tải lên.');
  };

  // Open Add Modal
  const handleOpenAdd = () => {
    if (!perm.createEdit) {
      showToast.error('Tài khoản của bạn không có quyền lập phiếu xuất kho mới!');
      return;
    }

    const defaultUnit = companyUnits[0] || { id: 'DVCS01', name: 'Trụ sở chính TP. Hồ Chí Minh' };
    const defaultWh = warehouses[0] || { id: 'KH001', name: 'Kho Tổng TP. Hồ Chí Minh' };
    const newCode = `PXK-${new Date().toISOString().slice(0,7).replace('-','')}-${String(issueVouchers.length + 1).padStart(2, '0')}`;

    setEditingVoucherId(null);
    setActiveTab('items');
    
    // Set Right column defaults
    setFormCompanyUnitId(defaultUnit.id);
    setFormCompanyUnitName(defaultUnit.name);
    setFormCode(newCode);
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormCreatedDate(new Date().toISOString().split('T')[0]);
    setFormStatus('Lập chứng từ');

    // Set Left column defaults
    setFormVoucherType('Xuất bán hàng');
    setFormWarehouseId(defaultWh.id);
    setFormWarehouseName(defaultWh.name);
    setFormPartnerName('Công ty Cổ phần Bán lẻ Kỹ thuật số FPT');
    setFormRecipientName('Nguyễn Văn Tuấn (Khách hàng)');
    setFormCurrencyCode('VND');
    setFormExchangeRate(1);
    setFormCreatedBy(currentUser?.fullName || 'Trần Thịnh (Admin)');
    setFormNote('Xuất kho bán hàng theo đơn đặt hàng');

    // Default 1 line item for Tab 1
    const firstProd = products[0];
    setFormItems([
      {
        productId: firstProd?.id || '',
        productName: firstProd?.name || '',
        sku: firstProd?.sku || '',
        unit: firstProd?.unit || 'Chiếc',
        quantity: 5,
        unitPrice: firstProd?.price || firstProd?.costPrice || 1200000,
        totalPrice: 5 * (firstProd?.price || firstProd?.costPrice || 1200000),
        lotNumber: 'LO-2026-01',
        position: firstProd?.position || ''
      }
    ]);

    // Default empty array or sample for Tab 2 (Nguyên vật liệu)
    setFormMaterialItems([]);

    setIsModalOpen(true);
  };

  // Open Edit/View Modal
  // Opened from a notification (e.g. "Chờ duyệt: {mã phiếu}"): show that voucher.
  useOpenDocumentRequest('inv_issue', (documentId) => {
    const voucher = issueVouchers.find(v => v.code === documentId || v.id === documentId);
    if (voucher) handleOpenEdit(voucher);
    else showToast.warning(`Không tìm thấy phiếu xuất kho ${documentId}.`, 'Phiếu có thể đã bị xóa hoặc thuộc đơn vị khác.');
  });

  const handleOpenEdit = (voucher: GoodsVoucher) => {
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
    setFormPartnerName(voucher.partnerName || voucher.supplierName || '');
    setFormRecipientName(voucher.delivererName || '');
    setFormCurrencyCode(voucher.currencyCode || 'VND');
    setFormExchangeRate(voucher.exchangeRate || 1);
    setFormCreatedBy(voucher.createdBy || 'Administrator');
    setFormNote(voucher.note || '');

    // Map items for Tab 1
    if (voucher.items && voucher.items.length > 0) {
      setFormItems(voucher.items.map(it => {
        const prod = products.find(p => p.id === it.productId || p.name === it.productName);
        return {
          productId: it.productId || prod?.id || '',
          productName: it.productName,
          sku: it.sku || prod?.sku || '',
          unit: it.unit || prod?.unit || 'Chiếc',
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || 0,
          totalPrice: (it.quantity || 1) * (it.unitPrice || 0),
          lotNumber: it.lotNumber || '',
          position: it.position || prod?.position || ''
        };
      }));
    } else {
      setFormItems([]);
    }

    // Map material items for Tab 2
    if (voucher.materialItems && voucher.materialItems.length > 0) {
      setFormMaterialItems(voucher.materialItems.map(it => {
        const prod = products.find(p => p.id === it.productId || p.name === it.productName);
        return {
          productId: it.productId || prod?.id || '',
          productName: it.productName,
          sku: it.sku || prod?.sku || '',
          unit: it.unit || prod?.unit || 'Kg',
          quantity: it.quantity || 1,
          unitPrice: it.unitPrice || 0,
          totalPrice: (it.quantity || 1) * (it.unitPrice || 0),
          lotNumber: it.lotNumber || '',
          position: it.position || prod?.position || ''
        };
      }));
    } else {
      setFormMaterialItems([]);
    }

    setIsModalOpen(true);
  };

  // Material Lookup Handler
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
    const defaultPrice = prod.price || prod.costPrice || 100000;
    
    if (targetTab === 'items') {
      setFormItems(prev => {
        const updated = [...prev];
        const qty = updated[index]?.quantity || 1;
        updated[index] = {
          ...updated[index],
          productId: prod.id,
          productName: prod.name || prod.ten_vt || '',
          sku: prod.sku || prod.ma_vt || '',
          unit: prod.unit || prod.dvt || 'Chiếc',
          unitPrice: defaultPrice,
          totalPrice: qty * defaultPrice,
          position: prod.position || ''
        };
        if (index === updated.length - 1) {
          updated.push({
            productId: '',
            productName: '',
            sku: '',
            unit: 'Chiếc',
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
          unit: prod.unit || prod.dvt || 'Kg',
          unitPrice: defaultPrice,
          totalPrice: qty * defaultPrice,
          position: prod.position || ''
        };
        if (index === updated.length - 1) {
          updated.push({
            productId: '',
            productName: '',
            sku: '',
            unit: 'Kg',
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
        const defaultPrice = prod.price || prod.costPrice || 100000;
        return {
          productId: prod.id,
          productName: prod.name || prod.ten_vt || '',
          sku: prod.sku || prod.ma_vt || '',
          unit: prod.unit || prod.dvt || (activeTab === 'materials' ? 'Kg' : 'Chiếc'),
          quantity: 1,
          unitPrice: defaultPrice,
          totalPrice: defaultPrice,
          lotNumber: '',
          position: prod.position || ''
        };
      });

      if (activeTab === 'items') {
        setFormItems(prev => {
          if (prev.length === 1 && !prev[0].productId && !prev[0].sku) {
            return newItems;
          }
          return [...prev, ...newItems];
        });
      } else {
        setFormMaterialItems(prev => {
          if (prev.length === 1 && !prev[0].productId && !prev[0].sku) {
            return newItems;
          }
          return [...prev, ...newItems];
        });
      }

      showToast.success(`Đã thêm ${selectedProducts.length} vật tư từ danh mục vào tab ${activeTab === 'items' ? 'Chi tiết hàng hóa xuất' : 'Nguyên vật liệu'}!`);
    }

    setIsMaterialLookupOpen(false);
    setLookupTargetRowIndex(null);
  };

  // Confirm Warehouse Lookup
  const handleConfirmWarehouseLookup = (selectedItems: WarehouseType[]) => {
    if (selectedItems.length > 0) {
      const selected = selectedItems[0];
      if (selected) {
        setFormWarehouseId(selected.id);
        setFormWarehouseName(selected.name);
        showToast.success(`Đã chọn kho xuất: ${selected.name}`);
      }
    }
    setIsWarehouseLookupOpen(false);
  };

  // Confirm Customer / Partner Lookup
  const handleConfirmCustomerLookup = (selectedItems: typeof MOCK_CUSTOMERS) => {
    if (selectedItems.length > 0) {
      const selected = selectedItems[0];
      if (selected) {
        setFormPartnerName(selected.name);
        showToast.success(`Đã chọn khách hàng / đối tác: ${selected.name}`);
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
        <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
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
      label: 'Mã Khách Hàng',
      render: (s) => (
        <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
          {s.code}
        </span>
      )
    },
    {
      key: 'name',
      label: 'Tên Khách Hàng / Đơn Vị Nhận',
      render: (s) => <span className="font-extrabold text-slate-800 dark:text-slate-100 text-xs">{s.name}</span>
    },
    {
      key: 'group',
      label: 'Lĩnh Vực Hoạt Động',
      render: (s) => <span className="text-rose-600 dark:text-rose-300 font-medium text-xs">{s.group}</span>
    },
    {
      key: 'taxCode',
      label: 'Mã Số Thuế',
      render: (s) => <span className="font-mono text-slate-600 dark:text-slate-400 text-xs">{s.taxCode}</span>
    },
    {
      key: 'address',
      label: 'Địa Chỉ Đơn Vị',
      render: (s) => <span className="text-slate-500 text-xs">{s.address}</span>
    }
  ];

  // Filter options for Master Lookup Modal
  const productCategoriesFilter: FilterConfig[] = useMemo(() => {
    const cats = Array.from(new Set(products.map(p => p.category).filter(Boolean)));
    return [
      {
        key: 'category',
        label: 'Nhóm Vật Tư / Hàng Hóa',
        options: [
          { label: '-- Tất cả nhóm vật tư --', value: 'ALL' },
          ...cats.map(c => ({ label: c as string, value: c as string }))
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
        <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
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
      render: (p) => <span className="text-center font-medium text-xs">{p.unit || p.dvt || 'Chiếc'}</span>
    },
    {
      key: 'category',
      label: 'Nhóm Hàng Hóa',
      render: (p) => (
        <Badge variant="outline" className="text-[10px]">
          {p.category || 'Vật tư'}
        </Badge>
      )
    },
    {
      key: 'price',
      label: 'Đơn Giá Xuất (VNĐ)',
      render: (p) => (
        <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs">
          {formatVND(p.price || p.costPrice || 0)}
        </span>
      )
    },
    {
      key: 'quantity',
      label: 'Tồn Kho Khả Dụng',
      render: (p) => (
        <span className="font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          {formatQuantity(p.quantity || 0)}
        </span>
      )
    }
  ];

  // Form Total Calculation (convert to VNĐ using formExchangeRate)
  const formTotalValue = useMemo(() => {
    const rate = formExchangeRate && formExchangeRate > 0 ? formExchangeRate : 1;
    const itemsTotal = formItems.reduce((sum, item) => {
      const lineVal = item.totalPrice || ((item.quantity || 0) * (item.unitPrice || 0));
      return sum + lineVal;
    }, 0);
    return itemsTotal * rate;
  }, [formItems, formExchangeRate]);

  const formMaterialTotalValue = useMemo(() => {
    const rate = formExchangeRate && formExchangeRate > 0 ? formExchangeRate : 1;
    const matTotal = formMaterialItems.reduce((sum, item) => {
      const lineVal = item.totalPrice || ((item.quantity || 0) * (item.unitPrice || 0));
      return sum + lineVal;
    }, 0);
    return matTotal * rate;
  }, [formMaterialItems, formExchangeRate]);

  // Submit Form (Save Voucher)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!perm.createEdit) {
      showToast.error('Tài khoản của bạn không có quyền cập nhật dữ liệu!');
      return;
    }

    if (!formCode.trim()) {
      showToast.error('Vui lòng nhập số chứng từ xuất kho!');
      return;
    }

    if (formItems.length === 0) {
      showToast.error('Vui lòng khai báo ít nhất một mặt hàng xuất kho!');
      return;
    }

    const companyUnitObj = companyUnits.find(cu => cu.id === formCompanyUnitId || cu.name === formCompanyUnitName);
    const warehouseObj = warehouses.find(w => w.id === formWarehouseId || w.name === formWarehouseName);

    const savedVoucher: GoodsVoucher = {
      id: editingVoucherId || `PXK${String(localVouchers.length + 1).padStart(3, '0')}`,
      type: 'Xuất kho',
      code: formCode.trim(),
      date: formDate,
      createdDate: formCreatedDate,
      companyUnitId: formCompanyUnitId,
      companyUnitName: companyUnitObj?.name || formCompanyUnitName || 'Trụ sở chính TP. Hồ Chí Minh',
      voucherType: formVoucherType,
      currencyCode: formCurrencyCode,
      exchangeRate: formExchangeRate,
      partnerName: formPartnerName.trim(),
      supplierName: formPartnerName.trim(),
      delivererName: formRecipientName.trim(),
      warehouseId: formWarehouseId,
      warehouseName: warehouseObj?.name || formWarehouseName || 'Kho Tổng TP. Hồ Chí Minh',
      items: formItems,
      materialItems: formMaterialItems,
      totalValue: formTotalValue,
      createdBy: formCreatedBy || currentUser?.fullName || 'Trần Thịnh (Admin)',
      approvedBy: formStatus === 'Đã phê duyệt' || formStatus === 'Chuyển sổ kho' ? (currentUser?.fullName || 'Trần Thịnh (Admin)') : undefined,
      status: formStatus as any,
      note: formNote.trim()
    };

    if (editingVoucherId) {
      // Update existing
      setLocalVouchers(prev => prev.map(v => v.id === editingVoucherId ? savedVoucher : v));
      showToast.success(`Đã cập nhật chứng từ xuất kho [${savedVoucher.code}] thành công!`);
    } else {
      // Create new
      onAddVoucher(savedVoucher);
      setLocalVouchers(prev => [savedVoucher, ...prev]);
      showToast.success(`Đã tạo mới chứng từ xuất kho [${savedVoucher.code}] thành công!`);
    }

    setIsModalOpen(false);
  };

  // Status Change Quick Action
  const handleQuickStatusChange = (voucherId: string, newStatus: string) => {
    if (!perm.approve && (newStatus === 'Đã phê duyệt' || newStatus === 'Chuyển sổ kho')) {
      showToast.error('Tài khoản của bạn không có quyền duyệt / chuyển sổ kho!');
      return;
    }

    setLocalVouchers(prev => prev.map(v => {
      if (v.id === voucherId) {
        return {
          ...v,
          status: newStatus as any,
          approvedBy: newStatus === 'Đã phê duyệt' || newStatus === 'Chuyển sổ kho' ? (currentUser?.fullName || 'Administrator') : v.approvedBy
        };
      }
      return v;
    }));

    showToast.success(`Đã cập nhật trạng thái phiếu xuất thành "${newStatus}"!`);
  };

  // Single Delete
  const handleConfirmSingleDelete = () => {
    if (!itemToDelete) return;
    setLocalVouchers(prev => prev.filter(v => v.id !== itemToDelete.id));
    showToast.success(`Đã xóa phiếu xuất kho [${itemToDelete.code}] thành công!`);
    setItemToDelete(null);
  };

  // Bulk Delete
  const handleConfirmBulkDelete = () => {
    if (!bulkToDeleteIds || bulkToDeleteIds.length === 0) return;
    setLocalVouchers(prev => prev.filter(v => !bulkToDeleteIds.includes(v.id)));
    showToast.success(`Đã xóa thành công ${bulkToDeleteIds.length} phiếu xuất kho đã chọn!`);
    setSelectedIds([]);
    setBulkToDeleteIds(null);
  };

  // Print PDF simulation / modal
  const handlePrint = (voucherOrCode: GoodsVoucher | string) => {
    if (!perm.printExport) {
      showToast.error('Tài khoản của bạn không có quyền In chứng từ!');
      return;
    }
    if (typeof voucherOrCode === 'string') {
      const found = localVouchers.find(v => v.code === voucherOrCode || v.id === voucherOrCode);
      if (found) {
        setPrintVoucher(found);
        setIsPrintModalOpen(true);
      } else if (editingVoucherId) {
        const foundById = localVouchers.find(v => v.id === editingVoucherId);
        if (foundById) {
          setPrintVoucher(foundById);
          setIsPrintModalOpen(true);
        }
      }
    } else {
      setPrintVoucher(voucherOrCode);
      setIsPrintModalOpen(true);
    }
  };

  // Render Status Badge
  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'Chuyển sổ kho':
      case 'Đã phê duyệt':
      case 'Hoàn thành':
        return (
          <Badge variant="success" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 shadow-2xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {status}
          </Badge>
        );
      case 'Chờ duyệt':
        return (
          <Badge variant="warning" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 shadow-2xs">
            <Clock className="h-3 w-3 mr-1" />
            Chờ Duyệt
          </Badge>
        );
      case 'Lập chứng từ':
      case 'Nháp':
        return (
          <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 shadow-2xs">
            <FileText className="h-3 w-3 mr-1" />
            Lập Chứng Từ
          </Badge>
        );
      case 'Hủy':
      case 'Đã hủy':
        return (
          <Badge variant="danger" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 shadow-2xs">
            <XCircle className="h-3 w-3 mr-1" />
            Hủy Phiếu
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
            {status || 'Lập chứng từ'}
          </Badge>
        );
    }
  };

  // Table Columns Definition
  const columns: GridViewColumn<GoodsVoucher>[] = [
    {
      key: 'code',
      title: 'Số Chứng Từ / Ngày',
      sortable: true,
      render: (v) => (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="font-mono font-bold text-rose-600 dark:text-rose-400 text-xs hover:underline cursor-pointer" onClick={() => handleOpenEdit(v)}>
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
      key: 'companyUnitName',
      title: 'Đơn Vị Cơ Sở / Kho Xuất',
      sortable: true,
      render: (v) => (
        <div className="space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1">
            <Building2 className="h-3 w-3 text-slate-400" />
            {v.companyUnitName || 'Trụ sở chính TP.HCM'}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Package className="h-3 w-3 text-rose-500" />
            {v.warehouseName}
          </p>
          {(v.partnerName || v.supplierName) && (
            <p className="text-[10px] text-slate-400 truncate max-w-[200px]" title={v.partnerName || v.supplierName}>
              Đơn vị nhận: <span className="font-medium text-slate-600 dark:text-slate-300">{v.partnerName || v.supplierName}</span>
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
        <Badge variant="outline" className="text-[10px] bg-rose-50/50 dark:bg-slate-800 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-slate-700">
          <Tag className="h-3 w-3 mr-1 text-rose-500" />
          {v.voucherType || 'Xuất bán hàng'}
        </Badge>
      )
    },
    {
      key: 'items',
      title: 'Sản Phẩm & Vật Tư Xuất',
      render: (v) => {
        const count = v.items?.length || 0;
        const totalQty = v.items?.reduce((sum, i) => sum + i.quantity, 0) || 0;
        const firstTwo = v.items?.slice(0, 2) || [];
        const matCount = v.materialItems?.length || 0;

        return (
          <div className="space-y-1 max-w-xs">
            {firstTwo.map((it, idx) => (
              <div key={idx} className="text-xs text-slate-700 dark:text-slate-300 truncate">
                • <span className="font-medium">{it.productName}</span> ({it.quantity} {it.unit || 'Chiếc'})
              </div>
            ))}
            {count > 2 && (
              <div className="text-[10px] font-semibold text-rose-500 italic">
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
          <span className="font-mono font-extrabold text-rose-600 dark:text-rose-400 text-sm block">
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
          <button
            type="button"
            onClick={() => handleOpenEdit(v)}
            className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
            title="Xem & Sửa phiếu xuất"
          >
            <Edit3 className="h-4 w-4" />
          </button>

          {v.status === 'Chờ duyệt' && perm.approve && (
            <button
              type="button"
              onClick={() => handleQuickStatusChange(v.id, 'Chuyển sổ kho')}
              className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors cursor-pointer"
              title="Phê duyệt & Chuyển sổ kho"
            >
              <CheckCircle2 className="h-4 w-4" />
            </button>
          )}

          {perm.printExport && (
            <button
              type="button"
              onClick={() => handlePrint(v)}
              className="p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="In phiếu PDF"
            >
              <Printer className="h-4 w-4" />
            </button>
          )}

          {perm.delete && (
            <button
              type="button"
              onClick={() => setItemToDelete(v)}
              className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
              title="Xóa phiếu"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
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
        subtitle="Quản lý, lập mới, xem, sửa, xóa, tìm kiếm & lọc chứng từ xuất kho vật tư bán hàng, chuyển kho hoặc sản xuất"
        count={filteredVouchers.length}
        countLabel="Phiếu Xuất"
        showAdvancedFilter={showAdvancedFilter}
        onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
        activeFilterCount={activeFilterCount}
        onRefresh={handleRefresh}
        onExportExcel={handleExportExcel}
        onImportExcel={handleImportExcel}
        addLabel="Lập Phiếu Xuất Mới"
        canCreate={perm.createEdit}
        onOpenAdd={handleOpenAdd}
        filterPanelContent={
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-0.5">Mã / Số Chứng Từ</label>
              <input
                type="text"
                placeholder="PXK-202608-01..."
                value={codeFilter}
                onChange={(e) => setCodeFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-0.5">Đơn Vị Cơ Sở</label>
              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 font-medium"
              >
                <option value="">-- Tất cả ĐVCS --</option>
                {companyUnits.map(cu => (
                  <option key={cu.id} value={cu.id}>{cu.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-0.5">Loại Xuất Kho</label>
              <select
                value={voucherTypeFilter}
                onChange={(e) => setVoucherTypeFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 font-medium"
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
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 font-medium"
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
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 font-medium"
              >
                <option value="">-- Tất cả kho xuất --</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-0.5">Từ Ngày CT</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-slate-600 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider mb-0.5">Đến Ngày CT</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-[5px] px-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-500 font-medium"
              />
            </div>
          </div>
        }
        onApplyFilter={handleApplyFilter}
        onClearFilter={handleClearFilter}
        searchValue={searchText}
        onSearchChange={setSearchText}
        searchPlaceholder="Tìm kiếm mã phiếu, đơn vị, kho xuất, khách hàng, tên vật tư..."
      />

      {/* Bulk Action Controls */}
      {selectedIds.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-2.5 flex items-center justify-between text-xs animate-fadeIn">
          <span className="font-semibold text-rose-700 dark:text-rose-300">
            Đã chọn <strong className="font-extrabold text-rose-600 dark:text-rose-400">{selectedIds.length}</strong> phiếu xuất kho
          </span>
          <div className="flex items-center gap-2">
            {perm.delete && (
              <Button
                size="sm"
                variant="danger"
                icon={<Trash2 className="h-3.5 w-3.5" />}
                onClick={() => setBulkToDeleteIds(selectedIds as string[])}
              >
                Xóa Các Phiếu Đã Chọn
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setSelectedIds([])}>
              Bỏ Chọn
            </Button>
          </div>
        </div>
      )}

      {/* Main Data Table Area */}
      <GridView
        data={filteredVouchers}
        columns={canViewPrice ? columns : columns.filter(c => c.key !== 'totalValue')}
        keyExtractor={(item) => item.id}
        searchable={true}
        searchPlaceholder="Tìm kiếm mã phiếu, đơn vị, kho xuất, khách hàng, tên vật tư..."
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
        emptyText="Không tìm thấy chứng từ xuất kho nào phù hợp với bộ lọc."
        pageSize={15}
        pageSizeOptions={[10, 15, 20, 30, 50, 100]}
        dense={true}
      />

      {/* MASTER MODAL FORM FOR CREATING / EDITING GOODS ISSUE VOUCHER */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingVoucherId ? `Chi Tiết & Cập Nhật Phiếu Xuất Kho: [${formCode}]` : 'Lập Phiếu Xuất Kho Mới (Goods Issue Voucher)'}
        fullScreen={true}
        headerActions={
          <div className="flex items-center gap-2 shrink-0">
            {editingVoucherId && perm.printExport && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePrint(formCode)}
                icon={<Printer className="h-3.5 w-3.5" />}
                className="py-1 px-2.5 text-xs font-medium cursor-pointer"
              >
                In PDF
              </Button>
            )}
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
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Save className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />}
              onClick={() => {
                setFormStatus('Lập chứng từ');
                setTimeout(() => {
                  const formEl = document.querySelector('form');
                  if (formEl) formEl.requestSubmit();
                }, 50);
              }}
              className="py-1 px-3 text-xs font-semibold cursor-pointer bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900"
            >
              Lưu Nháp
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="sm"
              icon={<CheckCircle2 className="h-3.5 w-3.5 text-white" />}
              onClick={() => {
                const formEl = document.querySelector('form');
                if (formEl) formEl.requestSubmit();
              }}
              className="py-1 px-4 text-xs font-bold cursor-pointer bg-rose-600 hover:bg-rose-700 text-white shadow-xs border border-rose-600"
            >
              {editingVoucherId ? 'Lưu & Cập Nhật' : 'Lưu Phiếu Xuất Kho'}
            </Button>
          </div>
        }
      >
        <form onSubmit={handleSubmitForm} className="flex-1 min-h-0 flex flex-col text-xs overflow-hidden pt-2">
          <div className="overflow-y-auto custom-scrollbar space-y-3 pr-1 pb-1 flex-1 min-h-0 flex flex-col">
          
          {/* I. PHẦN THÔNG TIN CHUNG (HEADER) - BALANCED 8-4 GRID LAYOUT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 text-xs shrink-0">
            
            {/* BÊN TRÁI (LG:COL-SPAN-8): THÔNG TIN NGHIỆP VỤ, KHO & ĐỐI TÁC */}
            <div className="lg:col-span-8 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between h-6 pb-1 border-b border-slate-100 dark:border-slate-800/80">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Tag className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate">
                    I. Thông Tin Nghiệp Vụ & Đối Tác
                  </h4>
                </div>
                <span className="text-[10px] font-medium text-slate-400 shrink-0 hidden sm:inline">Nghiệp vụ kho & đối tác</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 sm:gap-2 text-xs">
                {/* Loại xuất kho */}
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5">
                    Loại Nhập Xuất <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formVoucherType}
                    onChange={(e) => setFormVoucherType(e.target.value)}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 font-medium text-[11px] focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all h-[26px]"
                  >
                    <option value="Xuất bán hàng">Xuất bán hàng</option>
                    <option value="Xuất điều chuyển nội bộ">Xuất điều chuyển nội bộ</option>
                    <option value="Xuất nguyên vật liệu sản xuất">Xuất nguyên vật liệu sản xuất</option>
                    <option value="Xuất hàng mẫu / Khuyến mãi">Xuất hàng mẫu / Khuyến mãi</option>
                    <option value="Xuất kiểm kê giảm / Hủy">Xuất kiểm kê giảm / Hủy</option>
                  </select>
                </div>

                {/* Kho xuất hàng */}
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5">
                    Kho Xuất Hàng <span className="text-rose-500">*</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <select
                      required
                      value={formWarehouseId}
                      onChange={(e) => {
                        setFormWarehouseId(e.target.value);
                        const wh = warehouses.find(w => w.id === e.target.value);
                        if (wh) setFormWarehouseName(wh.name);
                      }}
                      className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 font-medium text-[11px] focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all h-[26px]"
                    >
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsWarehouseLookupOpen(true)}
                      className="px-1.5 h-[26px] bg-rose-50 hover:bg-rose-100 dark:bg-rose-950 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs"
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
                      placeholder="Công ty FPT, VinFast, Samsung..."
                      value={formPartnerName}
                      onChange={(e) => setFormPartnerName(e.target.value)}
                      className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 font-medium text-[11px] focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all h-[26px]"
                    />
                    <button
                      type="button"
                      onClick={() => setIsCustomerLookupOpen(true)}
                      className="px-1.5 h-[26px] bg-rose-50 hover:bg-rose-100 dark:bg-rose-950 dark:hover:bg-rose-900 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 rounded-lg flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs"
                      title="Tra cứu danh mục Khách Hàng (F4)"
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
                    placeholder="Họ tên người nhận hàng / đại diện..."
                    value={formRecipientName}
                    onChange={(e) => setFormRecipientName(e.target.value)}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 font-medium text-[11px] focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all h-[26px]"
                  />
                </div>

                {/* Ghi chú / Diễn giải (Spans 2 cols) */}
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5">
                    Ghi Chú / Diễn Giải Nghiệp Vụ
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Xuất kho bán hàng theo đơn đặt hàng..."
                    value={formNote}
                    onChange={(e) => setFormNote(e.target.value)}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-0.5 font-normal text-[11px] focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all h-[26px]"
                  />
                </div>
              </div>
            </div>

            {/* BÊN PHẢI (LG:COL-SPAN-4): THẺ CHỨNG TỪ & TIỀN TỆ COMPACT 2-COL GRID */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-xl border border-slate-200/90 dark:border-slate-800 space-y-1.5 shadow-2xs">
              <div className="flex items-center justify-between h-6 pb-1 border-b border-slate-100 dark:border-slate-800/80 gap-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <FileText className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <h4 className="font-extrabold text-[11px] text-slate-800 dark:text-slate-100 uppercase tracking-wide truncate">
                    II. Chứng Từ & Tiền Tệ
                  </h4>
                </div>
                <div className="shrink-0 scale-85 origin-right">
                  {renderStatusBadge(formStatus)}
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
                    onChange={(e) => {
                      setFormCompanyUnitId(e.target.value);
                      const cu = companyUnits.find(c => c.id === e.target.value);
                      if (cu) setFormCompanyUnitName(cu.name);
                    }}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 font-bold text-slate-800 dark:text-slate-100 text-[10.5px] focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all truncate h-[26px]"
                  >
                    {companyUnits.length > 0 ? (
                      companyUnits.map(cu => (
                        <option key={cu.id} value={cu.id}>{cu.code || cu.id} - {cu.name}</option>
                      ))
                    ) : (
                      <option value="DVCS01">DVCS01 - Trụ sở chính TP.HCM</option>
                    )}
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
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="PXK-202608-001"
                    className="w-full bg-rose-50/40 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/70 rounded-lg px-1.5 py-0.5 font-mono font-black text-rose-700 dark:text-rose-300 text-[10.5px] focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all h-[26px]"
                  />
                </div>

                {/* 3. Trạng Thái */}
                <div>
                  <label className="block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5 truncate">
                    Trạng Thái <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 font-extrabold text-slate-800 dark:text-slate-100 text-[10.5px] focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all h-[26px]"
                  >
                    <option value="Lập chứng từ">Lập chứng từ</option>
                    <option value="Chờ duyệt">Chờ duyệt</option>
                    <option value="Đã phê duyệt">Đã phê duyệt</option>
                    <option value="Chuyển sổ kho">Chuyển sổ kho</option>
                    <option value="Hủy">Hủy phiếu</option>
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
                    onChange={(e) => setFormCreatedBy(e.target.value)}
                    placeholder="NV Kho..."
                    className="w-full bg-slate-50/50 dark:bg-slate-800/60 border border-slate-300 dark:border-slate-700 rounded-lg px-1.5 py-0.5 font-medium text-[10.5px] focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all h-[26px]"
                  />
                </div>

                {/* 5. Ngày CT */}
                <div>
                  <DateTimePicker
                    label="Ngày CT"
                    type="date"
                    required
                    value={formDate}
                    onChange={(val) => setFormDate(val)}
                  />
                </div>

                {/* 6. Ngày Lập */}
                <div>
                  <DateTimePicker
                    label="Ngày Lập"
                    type="date"
                    required
                    value={formCreatedDate}
                    onChange={(val) => setFormCreatedDate(val)}
                  />
                </div>

                {/* 7. Loại Tiền */}
                <div>
                  <ComboBox
                    label="Loại Tiền"
                    options={CURRENCY_OPTIONS_ISSUE.map(c => ({ value: c.code, label: `${c.code} - ${c.name}` }))}
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
                    onChange={(val) => setFormExchangeRate(val || 1)}
                    min={1}
                    decimals={2}
                  />
                </div>
              </div>
            </div>

          </div>

          {/* II. PHẦN THÔNG TIN CHI TIẾT - CHIA THÀNH 2 TAB (TAB 1: CHI TIẾT, TAB 2: NGUYÊN VẬT LIỆU) */}
          <div className="bg-white dark:bg-slate-900 p-1.5 sm:p-2 rounded-xl border border-slate-200 dark:border-slate-800 space-y-1.5 flex-1 flex flex-col min-h-[200px]">
            
            {/* TABS HEADER BAR - COMPACT HEIGHT */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 pb-1 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-lg flex-wrap">
                
                {/* TAB 1: CHI TIẾT */}
                <button
                  type="button"
                  onClick={() => setActiveTab('items')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
                    activeTab === 'items'
                      ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-2xs border border-slate-200/80 dark:border-slate-700'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Package className="h-3 w-3" />
                  <span>Tab 1: Chi Tiết Mặt Hàng</span>
                  <span className="ml-0.5 px-1.5 py-0 rounded-full text-[9px] bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 font-black">
                    {formItems.length}
                  </span>
                </button>

                {/* TAB 2: NGUYÊN VẬT LIỆU (CẤU TRÚC SP / BOM) */}
                <button
                  type="button"
                  onClick={() => setActiveTab('materials')}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
                    activeTab === 'materials'
                      ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-2xs border border-slate-200/80 dark:border-slate-700'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <Layers className="h-3 w-3" />
                  <span>Tab 2: NVL (Cấu Trúc SP / BOM)</span>
                  <span className="ml-0.5 px-1.5 py-0 rounded-full text-[9px] bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-black">
                    {formMaterialItems.length}
                  </span>
                </button>

              </div>

              {/* ACTION BUTTONS FOR ACTIVE TAB */}
              <div className="flex items-center gap-1 flex-wrap self-end sm:self-auto">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setLookupTargetRowIndex(null);
                    setIsMaterialLookupOpen(true);
                  }}
                  icon={<Search className="h-3.5 w-3.5" />}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-[10.5px] py-1 px-2.5 h-[26px] shadow-2xs font-semibold"
                >
                  Tra Cứu Từ Danh Mục Vật Tư
                </Button>
              </div>
            </div>

            {/* TAB 1 CONTENT: CHI TIẾT MẶT HÀNG / VẬT TƯ XUẤT KHO TRỰC TIẾP */}
            {activeTab === 'items' && (
              <div className="flex-1 flex flex-col min-h-0 space-y-1">
                <VoucherDetailGrid
                  hiddenFields={hiddenPriceFields}
                  gridInfo={goodsIssueItemsGridConfig}
                  data={formItems}
                  onChange={(newItems) => setFormItems(newItems as VoucherItem[])}
                  onLookupClick={(rowIndex) => {
                    setLookupTargetRowIndex(rowIndex);
                    setIsMaterialLookupOpen(true);
                  }}
                  onCodeSubmit={(rowIndex, field, codeValue) => 
                    handleCodeSubmit(rowIndex, field, codeValue, 'items')
                  }
                  currencyCode={formCurrencyCode}
                  exchangeRate={formExchangeRate}
                  maxHeight="250px"
                />
              </div>
            )}

            {/* TAB 2 CONTENT: NGUYÊN VẬT LIỆU (CẤU TRÚC SẢN PHẨM / BOM) */}
            {activeTab === 'materials' && (
              <div className="flex-1 flex flex-col min-h-0 space-y-1">
                <VoucherDetailGrid
                  hiddenFields={hiddenPriceFields}
                  gridInfo={goodsIssueMaterialsGridConfig}
                  data={formMaterialItems}
                  onChange={(newItems) => setFormMaterialItems(newItems as VoucherItem[])}
                  onLookupClick={(rowIndex) => {
                    setLookupTargetRowIndex(rowIndex);
                    setIsMaterialLookupOpen(true);
                  }}
                  onCodeSubmit={(rowIndex, field, codeValue) => 
                    handleCodeSubmit(rowIndex, field, codeValue, 'materials')
                  }
                  currencyCode={formCurrencyCode}
                  exchangeRate={formExchangeRate}
                  maxHeight="250px"
                />
              </div>
            )}

          </div>
          </div>

          {/* Modal Footer Bar - Status, Summary Info & Secondary Actions */}
          <div className="flex items-center justify-between pt-2 pb-1 px-1 mt-1 border-t border-slate-200 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 z-30 text-xs gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-slate-500 font-medium">
                Mã phiếu: <strong className="font-mono text-rose-600 dark:text-rose-400 font-bold">{formCode}</strong>
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">|</span>
              <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                Người lập: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{formCreatedBy || 'N/A'}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3">
              {canViewPrice && (
                <span className="text-[11px] text-slate-500 font-medium mr-1">
                  Tổng tiền: <strong className="font-mono text-rose-600 dark:text-rose-400 font-extrabold text-xs sm:text-sm">{formTotalValue.toLocaleString('vi-VN')} {formCurrencyCode}</strong>
                </span>
              )}

              <div className="flex items-center gap-1.5 border-l border-slate-200 dark:border-slate-700 pl-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  className="py-1 px-2.5 text-xs font-medium cursor-pointer"
                >
                  Hủy
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFormStatus('Lập chứng từ');
                    setTimeout(() => {
                      const formEl = document.querySelector('form');
                      if (formEl) formEl.requestSubmit();
                    }, 50);
                  }}
                  className="py-1 px-2.5 text-xs font-semibold cursor-pointer"
                >
                  Lưu Nháp
                </Button>
                <Button
                  type="submit"
                  variant="danger"
                  size="sm"
                  className="py-1 px-3 text-xs font-bold cursor-pointer bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {editingVoucherId ? 'Lưu & Cập Nhật' : 'Lưu Phiếu Xuất Kho'}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      {/* MASTER LOOKUP MODAL FOR PRODUCTS / MATERIALS */}
      <MasterLookupModal
        isOpen={isMaterialLookupOpen}
        onClose={() => {
          setIsMaterialLookupOpen(false);
          setLookupTargetRowIndex(null);
        }}
        title={lookupTargetRowIndex !== null ? "Chọn Vật Tư Chọn Dòng" : "Tra Cứu & Chọn Hàng Hóa / Vật Tư Xuất Kho"}
        data={products}
        columns={canViewPrice ? masterLookupColumns : masterLookupColumns.filter(c => c.key !== 'price')}
        idField="id"
        displayField="name"
        onConfirm={handleConfirmMasterLookup}
        selectionMode={lookupTargetRowIndex === null ? 'multiple' : 'single'}
        searchPlaceholder="Tìm mã SKU, tên vật tư, vị trí kho..."
        filters={productCategoriesFilter}
      />

      {/* WAREHOUSE LOOKUP MODAL */}
      <MasterLookupModal
        isOpen={isWarehouseLookupOpen}
        onClose={() => setIsWarehouseLookupOpen(false)}
        title="Tra Cứu & Chọn Kho Xuất Hàng"
        data={warehouses}
        columns={warehouseLookupColumns}
        idField="id"
        displayField="name"
        onConfirm={handleConfirmWarehouseLookup}
        selectionMode="single"
        searchPlaceholder="Tìm mã kho, tên kho, địa chỉ..."
      />

      {/* CUSTOMER / PARTNER LOOKUP MODAL */}
      <MasterLookupModal
        isOpen={isCustomerLookupOpen}
        onClose={() => setIsCustomerLookupOpen(false)}
        title="Tra Cứu & Chọn Khách Hàng / Đơn Vị Nhận Hàng"
        data={MOCK_CUSTOMERS}
        columns={customerLookupColumns}
        idField="id"
        displayField="name"
        onConfirm={handleConfirmCustomerLookup}
        selectionMode="single"
        searchPlaceholder="Tìm mã đối tác, tên khách hàng, MST..."
      />

      {/* PRINT PREVIEW MODAL */}
      <Modal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={`In Chứng Từ Phiếu Xuất Kho [${printVoucher?.code || ''}]`}
        maxWidth="4xl"
      >
        {printVoucher && (
          <div className="space-y-4 text-xs p-4 bg-white text-slate-900 rounded-lg shadow-inner font-serif">
            {/* Printable Document Header */}
            <div className="flex justify-between items-start border-b border-slate-300 pb-3">
              <div>
                <p className="font-bold text-sm uppercase">CÔNG TY CỔ PHẦN CÔNG NGHỆ VÀ THIẾT BỊ HÒA PHÁT</p>
                <p className="text-[11px] text-slate-600">Đơn vị: {printVoucher.companyUnitName || 'Trụ sở chính TP.HCM'}</p>
                <p className="text-[11px] text-slate-600">Địa chỉ: KCN Tân Bình, Q. Tân Phú, TP. Hồ Chí Minh</p>
              </div>
              <div className="text-right font-sans">
                <p className="font-bold text-xs uppercase">Mẫu số: 02-VT</p>
                <p className="text-[10px] text-slate-500">(Thông tư số 200/2014/TT-BTC)</p>
                <p className="font-mono font-bold text-rose-600 text-sm mt-1">{printVoucher.code}</p>
              </div>
            </div>

            {/* Document Title */}
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold uppercase tracking-wide">PHIẾU XUẤT KHO</h2>
              <p className="italic text-slate-600 text-xs">
                Ngày {printVoucher.date.split('-')[2] || '10'} tháng {printVoucher.date.split('-')[1] || '08'} năm {printVoucher.date.split('-')[0] || '2026'}
              </p>
            </div>

            {/* General Info Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs border-y border-slate-200 py-2">
              <div>- Họ tên người nhận hàng: <strong>{printVoucher.delivererName || printVoucher.partnerName || 'Khách hàng'}</strong></div>
              <div>- Kho xuất hàng: <strong>{printVoucher.warehouseName}</strong></div>
              <div>- Đơn vị / Khách hàng nhận: <strong>{printVoucher.partnerName || printVoucher.supplierName || 'Công ty Khách Hàng'}</strong></div>
              <div>- Diễn giải: <strong>{printVoucher.note || 'Xuất kho bán hàng'}</strong></div>
            </div>

            {/* Table of Items */}
            <table className="w-full text-left border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 text-center font-bold border-b border-slate-300">
                  <th className="border border-slate-300 p-1.5 w-8">STT</th>
                  <th className="border border-slate-300 p-1.5">Tên, nhãn hiệu, quy cách vật tư</th>
                  <th className="border border-slate-300 p-1.5 w-20">Mã số</th>
                  <th className="border border-slate-300 p-1.5 w-16">ĐVT</th>
                  <th className="border border-slate-300 p-1.5 w-20">Số lượng</th>
                  {canViewPrice && <th className="border border-slate-300 p-1.5 w-24">Đơn giá</th>}
                  {canViewPrice && <th className="border border-slate-300 p-1.5 w-28">Thành tiền</th>}
                </tr>
              </thead>
              <tbody>
                {printVoucher.items?.map((it, idx) => (
                  <tr key={idx} className="border-b border-slate-200">
                    <td className="border border-slate-300 p-1.5 text-center">{idx + 1}</td>
                    <td className="border border-slate-300 p-1.5 font-semibold">{it.productName}</td>
                    <td className="border border-slate-300 p-1.5 text-center font-mono">{it.sku || '-'}</td>
                    <td className="border border-slate-300 p-1.5 text-center">{it.unit || 'Chiếc'}</td>
                    <td className="border border-slate-300 p-1.5 text-right font-mono">{it.quantity}</td>
                    {canViewPrice && <td className="border border-slate-300 p-1.5 text-right font-mono">{formatVND(it.unitPrice)}</td>}
                    {canViewPrice && <td className="border border-slate-300 p-1.5 text-right font-mono font-bold">{formatVND((it.quantity || 0) * (it.unitPrice || 0))}</td>}
                  </tr>
                ))}
                {canViewPrice && <tr className="font-bold bg-slate-50">
                  <td colSpan={6} className="border border-slate-300 p-1.5 text-right uppercase">Cộng Tổng Giá Trị Xuất Kho:</td>
                  <td className="border border-slate-300 p-1.5 text-right font-mono text-rose-600 text-sm">{formatVND(printVoucher.totalValue)}</td>
                </tr>}
              </tbody>
            </table>

            {/* Signatures Area */}
            <div className="grid grid-cols-5 gap-2 text-center pt-4 pb-8 text-[11px] font-sans">
              <div>
                <p className="font-bold">Người lập phiếu</p>
                <p className="italic text-slate-500">(Ký, họ tên)</p>
                <p className="mt-12 font-medium">{printVoucher.createdBy}</p>
              </div>
              <div>
                <p className="font-bold">Người nhận hàng</p>
                <p className="italic text-slate-500">(Ký, họ tên)</p>
                <p className="mt-12 font-medium">{printVoucher.delivererName || 'Khách hàng'}</p>
              </div>
              <div>
                <p className="font-bold">Thủ kho</p>
                <p className="italic text-slate-500">(Ký, họ tên)</p>
                <p className="mt-12 font-medium">Trần Văn Nam</p>
              </div>
              <div>
                <p className="font-bold">Kế toán trưởng</p>
                <p className="italic text-slate-500">(Ký, họ tên)</p>
                <p className="mt-12 font-medium">Nguyễn Thị Mai</p>
              </div>
              <div>
                <p className="font-bold">Giám đốc / Trưởng BP</p>
                <p className="italic text-slate-500">(Ký, họ tên, đóng dấu)</p>
                <p className="mt-12 font-medium">{printVoucher.approvedBy || 'Đã duyệt'}</p>
              </div>
            </div>

            {/* Print Buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 font-sans">
              <Button variant="outline" size="sm" onClick={() => setIsPrintModalOpen(false)}>
                Đóng
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<Printer className="h-4 w-4" />}
                onClick={() => {
                  window.print();
                  showToast.success('Đã gửi lệnh in chứng từ xuất kho thành công!');
                }}
              >
                In Chứng Từ PDF
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* SINGLE DELETE CONFIRM MODAL */}
      <DeleteConfirmModal
        isOpen={itemToDelete !== null}
        onClose={() => setItemToDelete(null)}
        onConfirm={handleConfirmSingleDelete}
        title="Xác Nhận Xóa Phiếu Xuất Kho"
        message={`Bạn có chắc chắn muốn xóa chứng từ xuất kho [${itemToDelete?.code || ''}]? Thao tác này không thể hoàn tác.`}
      />

      {/* BULK DELETE CONFIRM MODAL */}
      <DeleteConfirmModal
        isOpen={bulkToDeleteIds !== null}
        onClose={() => setBulkToDeleteIds(null)}
        onConfirm={handleConfirmBulkDelete}
        title="Xác Nhận Xóa Nhiều Phiếu Xuất Kho"
        message={`Bạn có chắc chắn muốn xóa ${bulkToDeleteIds?.length || 0} chứng từ xuất kho đã chọn? Thao tác này không thể hoàn tác.`}
      />

    </div>
  );
};
