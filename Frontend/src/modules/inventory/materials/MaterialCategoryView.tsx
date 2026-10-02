import React, { useState, useMemo } from 'react';
import { 
  Plus, 
  Package, 
  Search, 
  AlertTriangle, 
  Edit, 
  Trash2, 
  RefreshCw, 
  Download, 
  Upload, 
  Filter, 
  ChevronDown, 
  ChevronUp, 
  Building2, 
  Layers, 
  CheckSquare, 
  SlidersHorizontal,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { CategoryHeaderToolbar } from '../../../components/common/CategoryHeaderToolbar';
import { GridView, GridViewColumn } from '../../../components/common/GridView';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Checkbox } from '../../../components/common/Checkbox';
import { Product, Warehouse as WarehouseType, MaterialType, UnitOfMeasure, UserProfile, CompanyUnit } from '../../../types';
import { getActionPermission } from '../../../mock/initialRoles';
import { showToast } from '../../../utils/toast';
import { useLanguage } from '../../../context/LanguageContext';

interface MaterialCategoryViewProps {
  products: Product[];
  warehouses: WarehouseType[];
  materialTypes?: MaterialType[];
  unitsOfMeasure?: UnitOfMeasure[];
  companyUnits?: CompanyUnit[];
  activeCompanyUnitCode?: string;
  onAddProduct: (prod: Omit<Product, 'id'>) => void;
  onAdjustStock?: (id: string, qty: number) => void;
  onUpdateProduct?: (id: string, prod: Partial<Product>) => void;
  onDeleteProduct?: (id: string) => void;
  currentUser?: UserProfile;
}

export const MaterialCategoryView: React.FC<MaterialCategoryViewProps> = ({
  products: initialProducts,
  warehouses,
  materialTypes = [],
  unitsOfMeasure = [],
  companyUnits = [],
  activeCompanyUnitCode = 'DVCS01',
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  currentUser
}) => {
  const { t } = useLanguage();
  const perms = getActionPermission(currentUser, 'inv_material_cat');
  const [localProducts, setLocalProducts] = useState<Product[]>(initialProducts);

  React.useEffect(() => {
    setLocalProducts(initialProducts);
  }, [initialProducts]);

  const products = localProducts;

  // Deletion confirmation state
  const [itemToDelete, setItemToDelete] = useState<Product | null>(null);
  const [bulkToDeleteIds, setBulkToDeleteIds] = useState<(string | number)[] | null>(null);

  // Collapsible Advanced Filter State
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterMultiCodes, setFilterMultiCodes] = useState(''); // E.g. "VT001, VT002, LAP-DELL"
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterCompanyUnit, setFilterCompanyUnit] = useState<string>('ALL');

  // Applied Advanced Filters
  const [appliedFilters, setAppliedFilters] = useState({
    name: '',
    codes: [] as string[],
    status: 'ALL',
    type: 'ALL',
    companyUnit: 'ALL'
  });

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (appliedFilters.name) count++;
    if (appliedFilters.codes.length > 0) count++;
    if (appliedFilters.status !== 'ALL') count++;
    if (appliedFilters.type !== 'ALL') count++;
    if (appliedFilters.companyUnit !== 'ALL') count++;
    return count;
  }, [appliedFilters]);

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'uom_lots' | 'price_warehouse' | 'specs' | 'units_perm'>('basic');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Extensive Form States for All Requested Fields
  const [ma_vt, setMaVt] = useState('');
  const [ma_vt_kh, setMaVtKh] = useState('');
  const [ten_vt, setTenVt] = useState('');
  const [dvt, setDvt] = useState('Chiếc');
  const [loai_vt, setLoaiVt] = useState('Vật tư thương mại');
  const [nhom_sp, setNhomSp] = useState('Thiết bị Điện tử');
  const [model, setModel] = useState('');
  const [part_no, setPartNo] = useState('');
  const [ghi_chu, setGhiChu] = useState('');
  const [status, setStatus] = useState<'Hoạt động' | 'Tạm dừng'>('Hoạt động');

  // Checkboxes / Flags
  const [nhieu_dvt, setNhieuDvt] = useState(false);
  const [lo_yn, setLoYn] = useState(false);
  const [seri_yn, setSeriYn] = useState(false);
  const [kk_yn, setKkYn] = useState(true);
  const [vt_ton_kho, setVtTonKho] = useState(true);
  const [qc_yn, setQcYn] = useState(false);
  const [bo_yn, setBoYn] = useState(false);
  const [noi_dia_yn, setNoiDiaYn] = useState(true);
  const [tb_yn, setTbYn] = useState(false);

  // Warehouse & Pricing
  const [ma_kho, setMaKho] = useState(warehouses[0]?.id || 'KH001');
  const [ma_vi_tri, setMaViTri] = useState('Kệ A-01');
  const [gia_mua, setGiaMua] = useState(1000000);
  const [gia_ban, setGiaBan] = useState(1500000);
  const [gia_von, setGiaVon] = useState(800000);
  const [gia_ton, setGiaTon] = useState('Bình quân tức thời');
  const [ma_thue, setMaThue] = useState('VAT10');
  const [ma_thue_nk, setMaThueNk] = useState('NK00');
  const [ton_kho_min, setTonKhoMin] = useState(5);
  const [ton_kho_max, setTonKhoMax] = useState(100);
  const [sl_bs_dh, setSlBsDh] = useState(10);
  const [leadtime, setLeadtime] = useState(3);
  const [ton_kho, setTonKho] = useState(10);

  // Specs & Dimensions
  const [height, setHeight] = useState(0);
  const [length, setLength] = useState(0);
  const [width, setWidth] = useState(0);
  const [weight, setWeight] = useState(0);
  const [volume, setVolume] = useState(0);
  const [so_ngay_sp, setSoNgaySp] = useState(365);
  const [so_ngay_bh, setSoNgayBh] = useState(365);
  const [so_ngay_ton_kho, setSoNgayTonKho] = useState(180);
  const [dinh_luong, setDinhLuong] = useState('');
  const [ma_cau_truc, setMaCauTruc] = useState('');
  const [kieu_sx, setKieuSx] = useState('MTS');

  // Business Units Permissions
  const [ma_dvcs, setMaDvcs] = useState(activeCompanyUnitCode);
  const [ds_ma_dvcs, setDsMaDvcs] = useState<string[]>([activeCompanyUnitCode]);

  // Handle Search Execution
  const handleExecuteSearch = () => {
    const rawCodes = filterMultiCodes
      .split(',')
      .map(c => c.trim().toLowerCase())
      .filter(Boolean);

    setAppliedFilters({
      name: filterName.trim().toLowerCase(),
      codes: rawCodes,
      status: filterStatus,
      type: filterType,
      companyUnit: filterCompanyUnit
    });
    showToast.info('Đã áp dụng bộ lọc nâng cao');
  };

  const handleResetSearch = () => {
    setFilterName('');
    setFilterMultiCodes('');
    setFilterStatus('ALL');
    setFilterType('ALL');
    setFilterCompanyUnit('ALL');
    setAppliedFilters({
      name: '',
      codes: [],
      status: 'ALL',
      type: 'ALL',
      companyUnit: 'ALL'
    });
    showToast.info('Đã đặt lại bộ lọc');
  };

  // Filter Data
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const pCode = (p.ma_vt || p.sku || '').toLowerCase();
      const pName = (p.ten_vt || p.name || '').toLowerCase();
      const pStatus = p.status || 'Hoạt động';
      const pType = p.loai_vt || p.category || '';
      const pDvcs = p.ma_dvcs || 'DVCS01';
      const pDsDvcs = p.ds_ma_dvcs || [pDvcs];

      // Name match
      if (appliedFilters.name && !pName.includes(appliedFilters.name)) {
        return false;
      }

      // Multi code match (separated by commas)
      if (appliedFilters.codes.length > 0) {
        const matchAnyCode = appliedFilters.codes.some(code => pCode.includes(code));
        if (!matchAnyCode) return false;
      }

      // Status match
      if (appliedFilters.status !== 'ALL' && pStatus !== appliedFilters.status) {
        return false;
      }

      // Type match
      if (appliedFilters.type !== 'ALL' && !pType.includes(appliedFilters.type)) {
        return false;
      }

      // Company Unit match
      if (appliedFilters.companyUnit !== 'ALL') {
        const matchUnit = pDvcs === appliedFilters.companyUnit || pDsDvcs.includes(appliedFilters.companyUnit);
        if (!matchUnit) return false;
      }

      return true;
    });
  }, [products, appliedFilters]);

  // Reset form to defaults
  const handleOpenAddModal = () => {
    if (!perms.create) {
      showToast.error('Tài khoản của bạn không có quyền THÊM vật tư!');
      return;
    }
    setEditingProduct(null);
    setMaVt(`VT${Date.now().toString().slice(-5)}`);
    setMaVtKh('');
    setTenVt('');
    setDvt('Chiếc');
    setLoaiVt('Vật tư thương mại');
    setNhomSp('Thiết bị Điện tử');
    setModel('');
    setPartNo('');
    setGhiChu('');
    setStatus('Hoạt động');

    setNhieuDvt(false);
    setLoYn(false);
    setSeriYn(false);
    setKkYn(true);
    setVtTonKho(true);
    setQcYn(false);
    setBoYn(false);
    setNoiDiaYn(true);
    setTbYn(false);

    setMaKho(warehouses[0]?.id || 'KH001');
    setMaViTri('Kệ A-01');
    setGiaMua(1000000);
    setGiaBan(1500000);
    setGiaVon(800000);
    setGiaTon('Bình quân tức thời');
    setMaThue('VAT10');
    setMaThueNk('NK00');
    setTonKhoMin(5);
    setTonKhoMax(100);
    setSlBsDh(10);
    setLeadtime(3);
    setTonKho(10);

    setHeight(0);
    setLength(0);
    setWidth(0);
    setWeight(0);
    setVolume(0);
    setSoNgaySp(365);
    setSoNgayBh(365);
    setSoNgayTonKho(180);
    setDinhLuong('');
    setMaCauTruc('');
    setKieuSx('MTS');

    setMaDvcs(activeCompanyUnitCode);
    setDsMaDvcs([activeCompanyUnitCode]);

    setActiveTab('basic');
    setShowModal(true);
  };

  const handleOpenEditModal = (p: Product) => {
    if (!perms.edit) {
      showToast.error('Tài khoản của bạn chỉ có quyền XEM, không có quyền SỬA vật tư này!');
      return;
    }
    setEditingProduct(p);
    setMaVt(p.ma_vt || p.sku);
    setMaVtKh(p.ma_vt_kh || '');
    setTenVt(p.ten_vt || p.name);
    setDvt(p.dvt || p.unit || 'Chiếc');
    setLoaiVt(p.loai_vt || p.category || 'Vật tư thương mại');
    setNhomSp(p.nhom_sp || 'Thiết bị Điện tử');
    setModel(p.model || '');
    setPartNo(p.part_no || '');
    setGhiChu(p.ghi_chu || '');
    setStatus(p.status || 'Hoạt động');

    setNhieuDvt(!!p.nhieu_dvt);
    setLoYn(!!p.lo_yn);
    setSeriYn(!!p.seri_yn);
    setKkYn(p.kk_yn !== false);
    setVtTonKho(p.vt_ton_kho !== false);
    setQcYn(!!p.qc_yn);
    setBoYn(!!p.bo_yn);
    setNoiDiaYn(p.noi_dia_yn !== false);
    setTbYn(!!p.tb_yn);

    setMaKho(p.ma_kho || p.warehouseId || warehouses[0]?.id || 'KH001');
    setMaViTri(p.ma_vi_tri || p.position || 'Kệ A-01');
    setGiaMua(p.gia_mua || p.costPrice || 1000000);
    setGiaBan(p.gia_ban || p.price || 1500000);
    setGiaVon(p.gia_von || p.costPrice || 800000);
    setGiaTon(p.gia_ton || 'Bình quân tức thời');
    setMaThue(p.ma_thue || 'VAT10');
    setMaThueNk(p.ma_thue_nk || 'NK00');
    setTonKhoMin(p.ton_kho_min || p.minThreshold || 5);
    setTonKhoMax(p.ton_kho_max || 100);
    setSlBsDh(p.sl_bs_dh || 10);
    setLeadtime(p.leadtime || 3);
    setTonKho(p.ton_kho || p.quantity || 10);

    setHeight(p.height || 0);
    setLength(p.length || 0);
    setWidth(p.width || 0);
    setWeight(p.weight || 0);
    setVolume(p.volume || 0);
    setSoNgaySp(p.so_ngay_sp || 365);
    setSoNgayBh(p.so_ngay_bh || 365);
    setSoNgayTonKho(p.so_ngay_ton_kho || 180);
    setDinhLuong(p.dinh_luong || '');
    setMaCauTruc(p.ma_cau_truc || '');
    setKieuSx(p.kieu_sx || 'MTS');

    const mainDvcs = p.ma_dvcs || activeCompanyUnitCode;
    setMaDvcs(mainDvcs);
    setDsMaDvcs(p.ds_ma_dvcs || [mainDvcs]);

    setActiveTab('basic');
    setShowModal(true);
  };

  const handleDeleteItem = (p: Product) => {
    if (!perms.delete) {
      showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA vật tư!');
      return;
    }
    setItemToDelete(p);
  };

  const handleConfirmSingleDelete = () => {
    if (!itemToDelete) return;
    if (!perms.delete) {
      showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA vật tư!');
      setItemToDelete(null);
      return;
    }
    const name = itemToDelete.ten_vt || itemToDelete.name;
    const id = itemToDelete.id;

    if (onDeleteProduct) {
      onDeleteProduct(id);
    }
    setLocalProducts(prev => prev.filter(item => item.id !== id));
    showToast.success(`Đã xóa thành công vật tư "${name}"!`);
    setItemToDelete(null);
  };

  const handleConfirmBulkDelete = () => {
    if (!bulkToDeleteIds || bulkToDeleteIds.length === 0) return;
    if (!perms.delete) {
      showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA vật tư!');
      setBulkToDeleteIds(null);
      return;
    }
    const count = bulkToDeleteIds.length;
    bulkToDeleteIds.forEach(id => {
      if (onDeleteProduct) {
        onDeleteProduct(String(id));
      }
    });
    setLocalProducts(prev => prev.filter(item => !bulkToDeleteIds.includes(item.id)));
    showToast.success(`Đã xóa thành công ${count} vật tư đã chọn!`);
    setBulkToDeleteIds(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ma_vt.trim() || !ten_vt.trim()) {
      showToast.error('Vui lòng nhập Mã vật tư và Tên vật tư!');
      return;
    }

    const payload: Partial<Product> = {
      sku: ma_vt.trim().toUpperCase(),
      name: ten_vt.trim(),
      category: loai_vt,
      quantity: ton_kho,
      price: gia_ban,
      costPrice: gia_von,
      unit: dvt,
      warehouseId: ma_kho,
      warehouseName: warehouses.find(w => w.id === ma_kho)?.name || 'Kho Tổng',
      minThreshold: ton_kho_min,
      position: ma_vi_tri,

      // Extended ERP fields
      ma_vt: ma_vt.trim().toUpperCase(),
      ma_vt_kh: ma_vt_kh.trim(),
      ten_vt: ten_vt.trim(),
      dvt,
      nhieu_dvt,
      lo_yn,
      seri_yn,
      kk_yn,
      vt_ton_kho,
      gia_ton,
      nhom_sp,
      ghi_chu,
      status,
      ma_kho,
      ma_vi_tri,
      ma_thue,
      ma_thue_nk,
      so_ngay_sp,
      so_ngay_bh,
      height,
      length,
      width,
      weight,
      volume,
      loai_vt,
      ton_kho,
      ton_kho_min,
      ton_kho_max,
      sl_bs_dh,
      kieu_sx,
      ma_cau_truc,
      part_no,
      gia_mua,
      gia_ban,
      gia_von,
      bo_yn,
      ma_dvcs,
      ds_ma_dvcs,
      model,
      so_ngay_ton_kho,
      dinh_luong,
      qc_yn,
      noi_dia_yn,
      tb_yn,
      leadtime,
      updatetime: new Date().toISOString(),
      updateid: currentUser?.username || 'admin'
    };

    if (editingProduct) {
      if (onUpdateProduct) {
        onUpdateProduct(editingProduct.id, payload);
      } else {
        setLocalProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...p, ...payload } : p));
      }
      showToast.success('Cập nhật vật tư thành công!');
    } else {
      const newProduct: Omit<Product, 'id'> = {
        ...(payload as Omit<Product, 'id'>),
        creattime: new Date().toISOString(),
        createid: currentUser?.username || 'admin'
      };
      if (onAddProduct) {
        onAddProduct(newProduct);
      } else {
        setLocalProducts(prev => [...prev, { ...newProduct, id: `PROD-${Date.now()}` }]);
      }
      showToast.success('Thêm mới vật tư thành công!');
    }
    setShowModal(false);
  };

  // Export Excel / CSV
  const handleExportExcel = () => {
    const headers = ['Mã VT', 'Mã VT KH', 'Tên Vật Tư', 'ĐVT', 'Loại VT', 'Tồn Kho', 'Giá Bán', 'ĐVCS Chính', 'ĐVCS Phân Quyền'];
    const rows = filteredProducts.map(p => [
      p.ma_vt || p.sku,
      p.ma_vt_kh || '',
      p.ten_vt || p.name,
      p.dvt || p.unit,
      p.loai_vt || p.category,
      p.ton_kho || p.quantity,
      p.gia_ban || p.price,
      p.ma_dvcs || 'DVCS01',
      (p.ds_ma_dvcs || []).join(';')
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Danh_Muc_Vat_Tu_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast.success('Đã xuất file Excel thành công!');
  };

  // Import Excel simulated
  const handleImportExcel = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv, .xlsx, .xls';
    input.onchange = () => {
      showToast.success('Đã nạp file và cập nhật 3 mã vật tư mới vào danh mục!');
    };
    input.click();
  };

  // Grid columns definition
  const columns: GridViewColumn<Product>[] = [
    {
      key: 'ma_vt',
      title: 'Mã Vật Tư / SKU',
      sortable: true,
      width: '150px',
      render: (item) => (
        <div>
          <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
            {item.ma_vt || item.sku}
          </span>
          {item.ma_vt_kh && (
            <div className="text-[10px] text-slate-400 font-mono">KH: {item.ma_vt_kh}</div>
          )}
        </div>
      )
    },
    {
      key: 'ten_vt',
      title: 'Tên Vật Tư & Sản Phẩm',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-bold text-slate-800 dark:text-slate-100">{item.ten_vt || item.name}</div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-slate-500">{item.loai_vt || item.category}</span>
            {item.model && <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600">Model: {item.model}</span>}
          </div>
        </div>
      )
    },
    {
      key: 'dvt',
      title: 'ĐVT',
      width: '90px',
      align: 'center',
      render: (item) => (
        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
          {item.dvt || item.unit || 'Chiếc'}
        </span>
      )
    },
    {
      key: 'ma_dvcs',
      title: 'Đơn Vị Cơ Sở',
      width: '140px',
      render: (item) => {
        const mainDvcs = item.ma_dvcs || 'DVCS01';
        const sharedUnits = item.ds_ma_dvcs || [mainDvcs];
        return (
          <div className="space-y-1">
            <Badge variant="indigo">{mainDvcs}</Badge>
            {sharedUnits.length > 1 && (
              <div className="text-[10px] text-slate-400">
                Chung: {sharedUnits.filter(u => u !== mainDvcs).join(', ')}
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'gia_ban',
      title: 'Giá Bán',
      sortable: true,
      align: 'right',
      width: '130px',
      render: (item) => (
        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
          {(item.gia_ban || item.price || 0).toLocaleString('vi-VN')} đ
        </span>
      )
    },
    {
      key: 'ton_kho',
      title: 'Tồn Kho',
      sortable: true,
      align: 'right',
      width: '110px',
      render: (item) => {
        const qty = item.ton_kho !== undefined ? item.ton_kho : item.quantity;
        const minThreshold = item.ton_kho_min || item.minThreshold || 5;
        const isLow = qty <= minThreshold;
        return (
          <div className="text-right">
            <span className={`font-mono font-extrabold ${isLow ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
              {qty.toLocaleString('vi-VN')}
            </span>
            {isLow && (
              <div className="text-[10px] text-rose-500 flex items-center justify-end gap-0.5 font-bold">
                <AlertTriangle className="h-3 w-3" /> Dưới ngưỡng
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'status',
      title: 'Trạng Thái',
      sortable: true,
      width: '110px',
      render: (item) => (
        <Badge variant={(item.status || 'Hoạt động') === 'Hoạt động' ? 'success' : 'neutral'}>
          {item.status || 'Hoạt động'}
        </Badge>
      )
    },
    {
      key: 'actions',
      title: 'Thao Tác',
      width: '100px',
      align: 'center',
      render: (item) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => handleOpenEditModal(item)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-colors cursor-pointer"
            title="Sửa thông tin vật tư"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDeleteItem(item)}
            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg transition-colors cursor-pointer"
            title="Xóa vật tư"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="w-full min-w-full space-y-4">
      
      {/* Streamlined Compact Header Card - Pinned at top */}
      <div className="sticky top-0 z-20 w-full min-w-full space-y-2">
        <CategoryHeaderToolbar
          icon={<Package />}
          title="Khai Báo Danh Mục Vật Tư & Sản Phẩm (SKU Master)"
          count={filteredProducts.length}
          countLabel="Vật Tư"
          subtitle="Quản lý mã VT, phân loại, tồn kho & phân quyền theo đơn vị cơ sở"
          showAdvancedFilter={showAdvancedFilter}
          onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
          activeFilterCount={activeFilterCount}
          onRefresh={() => {
            setLocalProducts([...initialProducts]);
            showToast.info('Đã load lại danh mục dữ liệu vật tư mới nhất!');
          }}
          onExportExcel={perms.export ? handleExportExcel : undefined}
          onImportExcel={perms.create ? handleImportExcel : undefined}
          addLabel="Khai Báo Mới"
          onOpenAdd={handleOpenAddModal}
          canCreate={perms.create}
        />

        {/* Collapsible Compact Advanced Filter Panel (Phần Mở Rộng) */}
        {showAdvancedFilter && (
          <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-md space-y-3 animate-fade-in backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Filter className="h-4 w-4 text-indigo-500" />
                Bộ Lọc Tìm Kiếm Nâng Cao
              </span>
              <button
                onClick={() => setShowAdvancedFilter(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              
              {/* Search by Name */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Tìm Theo Tên Vật Tư</label>
                <input
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="Nhập tên vật tư..."
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Search by Multiple Codes with Commas */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Tìm Theo Mã (Nhập mã, phân cách dấu phẩy ,)</label>
                <input
                  type="text"
                  value={filterMultiCodes}
                  onChange={(e) => setFilterMultiCodes(e.target.value)}
                  placeholder="VD: VT001, PROD002, LAP-DELL..."
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Filter by Status */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Trạng Thái</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="ALL">-- Tất cả trạng thái --</option>
                  <option value="Hoạt động">Hoạt động</option>
                  <option value="Tạm dừng">Tạm dừng</option>
                </select>
              </div>

              {/* Filter by Material Type */}
              <div className="space-y-1">
                <label className="font-bold text-slate-600 dark:text-slate-400">Loại Vật Tư</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="ALL">-- Tất cả loại vật tư --</option>
                  {materialTypes.map(mt => (
                    <option key={mt.id} value={mt.name}>{mt.code} - {mt.name}</option>
                  ))}
                  <option value="Thiết bị Điện tử">Thiết bị Điện tử</option>
                  <option value="Phụ kiện máy tính">Phụ kiện máy tính</option>
                  <option value="Linh kiện phần cứng">Linh kiện phần cứng</option>
                </select>
              </div>

              {/* Filter by Company Unit */}
              {companyUnits.length > 0 && (
                <div className="space-y-1">
                  <label className="font-bold text-slate-600 dark:text-slate-400">Đơn Vị Cơ Sở Được Phép</label>
                  <select
                    value={filterCompanyUnit}
                    onChange={(e) => setFilterCompanyUnit(e.target.value)}
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] focus:ring-2 focus:ring-indigo-500 font-medium"
                  >
                    <option value="ALL">-- Tất cả đơn vị cơ sở --</option>
                    {companyUnits.map(unit => (
                      <option key={unit.id} value={unit.code}>{unit.code} - {unit.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button variant="outline" size="sm" onClick={handleResetSearch}>
                Đặt lại
              </Button>
              <Button variant="primary" size="sm" onClick={handleExecuteSearch}>
                <Search className="h-3.5 w-3.5 mr-1" />
                Tìm Kiếm
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* GridView table */}
      <GridView<Product>
        data={filteredProducts}
        columns={columns}
        searchPlaceholder="Tìm kiếm nhanh tên, mã vật tư..."
        keyExtractor={(item) => item.id}
        pageSize={10}
        dense
        selectable
        batchActions={[
          {
            label: 'Xóa hàng loạt',
            icon: <Trash2 className="h-4 w-4" />,
            variant: 'danger',
            onClick: (_items, selectedIds) => {
              if (!perms.delete) {
                showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA vật tư!');
                return;
              }
              setBulkToDeleteIds(selectedIds);
            }
          }
        ]}
      />

      {/* Structured Multi-Tab Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingProduct ? `Sửa Vật Tư: ${editingProduct.ma_vt || editingProduct.sku}` : 'Khai Báo Mới Vật Tư & Sản Phẩm (SKU Master)'}
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 overflow-x-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={`pb-2 text-xs font-bold border-b-2 px-3 transition-colors cursor-pointer ${
                activeTab === 'basic'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              1. Thông Tin Cơ Bản
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('uom_lots')}
              className={`pb-2 text-xs font-bold border-b-2 px-3 transition-colors cursor-pointer ${
                activeTab === 'uom_lots'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              2. ĐVT, Lô & Cờ Quản Lý
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('price_warehouse')}
              className={`pb-2 text-xs font-bold border-b-2 px-3 transition-colors cursor-pointer ${
                activeTab === 'price_warehouse'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              3. Kho, Giá Cả & Thuế
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('specs')}
              className={`pb-2 text-xs font-bold border-b-2 px-3 transition-colors cursor-pointer ${
                activeTab === 'specs'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              4. Kích Thước & Kỹ Thuật
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('units_perm')}
              className={`pb-2 text-xs font-bold border-b-2 px-3 transition-colors cursor-pointer ${
                activeTab === 'units_perm'
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-extrabold'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              5. Phân Quyền Đơn Vị Cơ Sở
            </button>
          </div>

          {/* Fixed Height Tab Content Container */}
          <div className="h-[430px] min-h-[430px] max-h-[430px] overflow-y-auto custom-scrollbar pr-1.5 pt-1">
            {/* Tab 1: Basic Info */}
            {activeTab === 'basic' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs animate-fade-in">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Mã Vật Tư (ma_vt) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ma_vt}
                  onChange={(e) => setMaVt(e.target.value)}
                  placeholder="VD: VT001, LAP-DELL..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Mã VT Khách Hàng (ma_vt_kh)</label>
                <input
                  type="text"
                  value={ma_vt_kh}
                  onChange={(e) => setMaVtKh(e.target.value)}
                  placeholder="VD: CUST-SKU-992"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">
                  Tên Vật Tư & Sản Phẩm (ten_vt) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={ten_vt}
                  onChange={(e) => setTenVt(e.target.value)}
                  placeholder="VD: Laptop Dell XPS 15 Ultra 2026"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Loại Vật Tư (loai_vt)</label>
                <select
                  value={loai_vt}
                  onChange={(e) => setLoaiVt(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Vật tư thương mại">Vật tư thương mại</option>
                  <option value="Nguyên vật liệu chính">Nguyên vật liệu chính (NVL)</option>
                  <option value="Linh kiện điện tử">Linh kiện điện tử (LKC)</option>
                  <option value="Bán thành phẩm">Bán thành phẩm (BTP)</option>
                  <option value="Thành phẩm hoàn chỉnh">Thành phẩm hoàn chỉnh (TP)</option>
                  <option value="Công cụ dụng cụ">Công cụ dụng cụ (CCDC)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Nhóm Sản Phẩm (nhom_sp)</label>
                <input
                  type="text"
                  value={nhom_sp}
                  onChange={(e) => setNhomSp(e.target.value)}
                  placeholder="VD: Thiết bị Điện tử"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Model</label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="VD: XPS-2026"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Part Number (part_no)</label>
                <input
                  type="text"
                  value={part_no}
                  onChange={(e) => setPartNo(e.target.value)}
                  placeholder="VD: PN-99201"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Trạng Thái (status)</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Hoạt động">Hoạt động</option>
                  <option value="Tạm dừng">Tạm dừng</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Ghi Chú (ghi_chu)</label>
                <textarea
                  rows={2}
                  value={ghi_chu}
                  onChange={(e) => setGhiChu(e.target.value)}
                  placeholder="Nhập ghi chú chi tiết..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Tab 2: UOM & Management Flags */}
          {activeTab === 'uom_lots' && (
            <div className="space-y-4 text-xs animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">Đơn Vị Tính Chính (dvt)</label>
                  <select
                    value={dvt}
                    onChange={(e) => setDvt(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Chiếc">Chiếc</option>
                    <option value="Cái">Cái</option>
                    <option value="Bộ">Bộ</option>
                    <option value="Hộp">Hộp</option>
                    <option value="Thùng">Thùng</option>
                    <option value="Kg">Kilogram (Kg)</option>
                    <option value="Mét">Mét (m)</option>
                  </select>
                </div>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-850 space-y-3">
                <span className="font-bold text-slate-800 dark:text-slate-200 block">Cờ Phân Loại & Cấu Hình Quản Lý</span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <Checkbox checked={nhieu_dvt} onChange={setNhieuDvt} label="Nhiều ĐVT (nhieu_dvt)" />
                  <Checkbox checked={lo_yn} onChange={setLoYn} label="Theo Dõi Lô (lo_yn)" />
                  <Checkbox checked={seri_yn} onChange={setSeriYn} label="Theo Dõi Series (seri_yn)" />
                  <Checkbox checked={kk_yn} onChange={setKkYn} label="Kiểm Kê Định Kỳ (kk_yn)" />
                  <Checkbox checked={vt_ton_kho} onChange={setVtTonKho} label="Vật Tư Tồn Kho (vt_ton_kho)" />
                  <Checkbox checked={qc_yn} onChange={setQcYn} label="Kiểm Định QC (qc_yn)" />
                  <Checkbox checked={bo_yn} onChange={setBoYn} label="Bộ Combo (bo_yn)" />
                  <Checkbox checked={noi_dia_yn} onChange={setNoiDiaYn} label="Hàng Nội Địa (noi_dia_yn)" />
                  <Checkbox checked={tb_yn} onChange={setTbYn} label="Thiết Bị / Tài Sản (tb_yn)" />
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Price & Warehouse */}
          {activeTab === 'price_warehouse' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs animate-fade-in">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Kho Chính (ma_kho)</label>
                <select
                  value={ma_kho}
                  onChange={(e) => setMaKho(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.code} - {w.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Vị Trí Lưu Kho (ma_vi_tri)</label>
                <input
                  type="text"
                  value={ma_vi_tri}
                  onChange={(e) => setMaViTri(e.target.value)}
                  placeholder="VD: Kệ A-01"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Tồn Kho Hiện Tại (ton_kho)</label>
                <input
                  type="number"
                  value={ton_kho}
                  onChange={(e) => setTonKho(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Giá Mua (gia_mua)</label>
                <input
                  type="number"
                  value={gia_mua}
                  onChange={(e) => setGiaMua(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Giá Bán Niêm Yết (gia_ban)</label>
                <input
                  type="number"
                  value={gia_ban}
                  onChange={(e) => setGiaBan(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold text-emerald-600 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Giá Vốn Nhập (gia_von)</label>
                <input
                  type="number"
                  value={gia_von}
                  onChange={(e) => setGiaVon(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">PP Tính Giá Tồn Kho (gia_ton)</label>
                <select
                  value={gia_ton}
                  onChange={(e) => setGiaTon(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Bình quân tức thời">Bình quân tức thời</option>
                  <option value="FIFO">Nhập trước xuất trước (FIFO)</option>
                  <option value="LIFO">Nhập sau xuất trước (LIFO)</option>
                  <option value="Đích danh">Giá đích danh</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Ngưỡng Tồn Min (ton_kho_min)</label>
                <input
                  type="number"
                  value={ton_kho_min}
                  onChange={(e) => setTonKhoMin(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Ngưỡng Tồn Max (ton_kho_max)</label>
                <input
                  type="number"
                  value={ton_kho_max}
                  onChange={(e) => setTonKhoMax(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Tab 4: Specs & Tech Dimensions */}
          {activeTab === 'specs' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs animate-fade-in">
              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Chiều Cao (height - cm)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Chiều Dài (length - cm)</label>
                <input
                  type="number"
                  value={length}
                  onChange={(e) => setLength(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Chiều Rộng (width - cm)</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Trọng Lượng (weight - kg)</label>
                <input
                  type="number"
                  value={weight}
                  onChange={(e) => setWeight(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Số Ngày Bảo Hành (so_ngay_bh)</label>
                <input
                  type="number"
                  value={so_ngay_bh}
                  onChange={(e) => setSoNgayBh(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700 dark:text-slate-300">Leadtime Cung Ứng (ngày)</label>
                <input
                  type="number"
                  value={leadtime}
                  onChange={(e) => setLeadtime(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          )}

          {/* Tab 5: Business Unit Role-Based Permissions (ma_dvcs & ds_ma_dvcs) */}
          {activeTab === 'units_perm' && (
            <div className="space-y-4 text-xs animate-fade-in">
              <div className="bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 p-3.5 rounded-2xl flex items-center gap-3">
                <Building2 className="h-6 w-6 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200">Phân Quyền Đơn Vị Cơ Sở Sử Dụng Danh Mục</p>
                  <p className="text-[11px] text-slate-500">Mặc định khi tạo mới sẽ chọn Đơn vị cơ sở hiện tại. Có thể tích chọn thêm các chi nhánh khác để dùng chung vật tư này.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Main Company Unit */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Đơn Vị Cơ Sở Trực Thuộc Chính (ma_dvcs) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={ma_dvcs}
                    onChange={(e) => {
                      const newMain = e.target.value;
                      setMaDvcs(newMain);
                      if (!ds_ma_dvcs.includes(newMain)) {
                        setDsMaDvcs(prev => [...prev, newMain]);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold focus:ring-2 focus:ring-indigo-500"
                  >
                    {companyUnits.map(unit => (
                      <option key={unit.id} value={unit.code}>
                        {unit.code} - {unit.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Multi-selection of Company Units */}
                <div className="space-y-2 md:col-span-2">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Chọn Các Đơn Vị Cơ Sở Được Phép Truy Cấp & Dùng Chung (ds_ma_dvcs)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-slate-200 dark:border-slate-800 p-3 rounded-xl bg-slate-50 dark:bg-slate-850">
                    {companyUnits.map(unit => {
                      const isChecked = ds_ma_dvcs.includes(unit.code);
                      const isMain = unit.code === ma_dvcs;
                      return (
                        <label
                          key={unit.id}
                          className={`flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
                            isChecked
                              ? 'bg-indigo-50/80 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              disabled={isMain}
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setDsMaDvcs(prev => [...prev, unit.code]);
                                } else {
                                  if (!isMain) {
                                    setDsMaDvcs(prev => prev.filter(c => c !== unit.code));
                                  }
                                }
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <div className="font-bold font-mono text-xs">{unit.code}</div>
                              <div className="text-[10px] text-slate-500">{unit.name}</div>
                            </div>
                          </div>
                          {isMain && (
                            <span className="text-[10px] font-bold bg-indigo-200 dark:bg-indigo-800 text-indigo-800 dark:text-indigo-200 px-1.5 py-0.5 rounded">
                              Đơn vị chính
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>
          )}
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2 shrink-0">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              {editingProduct ? 'Lưu Thay Đổi Vật Tư' : 'Khai Báo Mới SKU Master'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Single Delete Confirmation Modal */}
      <Modal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        title="Xác nhận xóa vật tư & sản phẩm"
        maxWidth="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm text-rose-800 dark:text-rose-200">Bạn có chắc chắn muốn xóa?</p>
              <p>
                Dữ liệu vật tư <span className="font-bold text-slate-900 dark:text-white">"{itemToDelete?.ten_vt || itemToDelete?.name}"</span> (Mã SKU: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{itemToDelete?.ma_vt || itemToDelete?.sku}</span>) sẽ bị xóa hoàn toàn khỏi danh mục hệ thống.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">Lưu ý: Thao tác này không thể hoàn tác.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setItemToDelete(null)}>
              Hủy bỏ
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmSingleDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              Xác Nhận Xóa
            </Button>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Confirmation Modal */}
      <Modal
        isOpen={!!bulkToDeleteIds && bulkToDeleteIds.length > 0}
        onClose={() => setBulkToDeleteIds(null)}
        title="Xác nhận xóa hàng loạt vật tư"
        maxWidth="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm text-rose-800 dark:text-rose-200">Xác nhận xóa {bulkToDeleteIds?.length} vật tư đã chọn?</p>
              <p>
                Toàn bộ <span className="font-bold text-slate-900 dark:text-white">{bulkToDeleteIds?.length} dòng vật tư</span> được chọn sẽ bị loại bỏ khỏi danh mục master data.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">Lưu ý: Thao tác này không thể hoàn tác.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setBulkToDeleteIds(null)}>
              Hủy bỏ
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmBulkDelete}>
              <Trash2 className="h-4 w-4 mr-1" />
              Xác Nhận Xóa ({bulkToDeleteIds?.length})
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
