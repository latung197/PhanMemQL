import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  Edit, 
  Eye, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Printer, 
  Filter, 
  Save 
} from 'lucide-react';
import { CategoryHeaderToolbar } from '../../../components/common/CategoryHeaderToolbar';
import { GridView, GridViewColumn } from '../../../components/common/GridView';
import { Button } from '../../../components/common/Button';
import { Modal } from '../../../components/common/Modal';
import { Badge } from '../../../components/common/Badge';
import { DeleteConfirmModal } from '../../../components/common/DeleteConfirmModal';
import { UserProfile, SubMenuKey } from '../../../types';
import { getActionPermission } from '../../../mock/initialRoles';
import { showToast } from '../../../utils/toast';
import { VoucherMasterModel, VoucherDetailItem, VoucherFilterCriteria } from './types';

interface VoucherFeatureViewProps {
  initialVouchers?: VoucherMasterModel[];
  currentUser?: UserProfile;
  subKey?: SubMenuKey;
  onSaveVoucher?: (v: VoucherMasterModel) => void;
  onDeleteVoucher?: (id: string) => void;
}

const DEFAULT_MOCK_VOUCHERS: VoucherMasterModel[] = [
  {
    id: '1',
    voucherNumber: 'CT-2026-001',
    voucherDate: '2026-05-18',
    companyUnitId: 'DVCS01',
    partnerId: 'KH001',
    partnerName: 'Công ty TNHH Thép Việt Nhật',
    warehouseId: 'WH01',
    warehouseName: 'Kho Tổng TP.HCM',
    description: 'Nghiệp vụ giao dịch mẫu đợt 1',
    status: 'Đã phê duyệt',
    totalQuantity: 15,
    totalAmount: 185000000,
    creator: 'Nguyễn Văn Quản Trị',
    details: [
      {
        id: 'd1',
        itemId: 'IT01',
        itemCode: 'VT-INOX-01',
        itemName: 'Tấm Inox 304 tiêu chuẩn',
        unit: 'Tấm',
        quantity: 10,
        unitPrice: 12500000,
        amount: 125000000,
        note: 'Hàng chuẩn CO/CQ'
      },
      {
        id: 'd2',
        itemId: 'IT02',
        itemCode: 'VT-THEP-02',
        itemName: 'Thép hộp mạ kẽm Hòa Phát',
        unit: 'Cây',
        quantity: 5,
        unitPrice: 12000000,
        amount: 60000000,
        note: 'Giao trực tiếp'
      }
    ]
  },
  {
    id: '2',
    voucherNumber: 'CT-2026-002',
    voucherDate: '2026-05-20',
    companyUnitId: 'DVCS01',
    partnerId: 'KH002',
    partnerName: 'Tập Đoàn Xây Dựng An Phát',
    warehouseId: 'WH01',
    warehouseName: 'Kho Tổng TP.HCM',
    description: 'Nghiệp vụ chờ duyệt theo hợp đồng',
    status: 'Chờ duyệt',
    totalQuantity: 8,
    totalAmount: 96000000,
    creator: 'Trần Thị Thu Ngân',
    details: [
      {
        id: 'd3',
        itemId: 'IT02',
        itemCode: 'VT-THEP-02',
        itemName: 'Thép hộp mạ kẽm Hòa Phát',
        unit: 'Cây',
        quantity: 8,
        unitPrice: 12000000,
        amount: 96000000
      }
    ]
  }
];

export const VoucherFeatureView: React.FC<VoucherFeatureViewProps> = ({
  initialVouchers = DEFAULT_MOCK_VOUCHERS,
  currentUser,
  subKey = 'inv_receipt',
  onSaveVoucher,
  onDeleteVoucher
}) => {
  const currentSubKey: SubMenuKey = (subKey || 'inv_receipt') as SubMenuKey;
  const perms = getActionPermission(currentUser, currentSubKey);

  const [vouchers, setVouchers] = useState<VoucherMasterModel[]>(initialVouchers);
  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);

  // Bộ lọc
  const [filterCriteria, setFilterCriteria] = useState<VoucherFilterCriteria>({
    voucherNumber: '',
    companyUnitId: 'ALL',
    status: 'ALL',
    fromDate: '',
    toDate: '',
    partnerKeyword: ''
  });

  // Modal lập/sửa chứng từ
  const [showModal, setShowModal] = useState(false);
  const [editingVoucher, setEditingVoucher] = useState<VoucherMasterModel | null>(null);
  const [isViewOnly, setIsViewOnly] = useState(false);

  // Form State
  const [voucherNumber, setVoucherNumber] = useState('');
  const [voucherDate, setVoucherDate] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [warehouseName, setWarehouseName] = useState('Kho Tổng TP.HCM');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<VoucherMasterModel['status']>('Lập chứng từ');
  const [details, setDetails] = useState<VoucherDetailItem[]>([]);

  // Modal Xóa
  const [itemToDelete, setItemToDelete] = useState<VoucherMasterModel | null>(null);

  // Tính tổng tiền
  const totalAmount = useMemo(() => {
    return details.reduce((sum, d) => sum + (d.amount || 0), 0);
  }, [details]);

  const totalQuantity = useMemo(() => {
    return details.reduce((sum, d) => sum + (Number(d.quantity) || 0), 0);
  }, [details]);

  // Lọc dữ liệu
  const filteredVouchers = useMemo(() => {
    return vouchers.filter(v => {
      if (filterCriteria.voucherNumber.trim()) {
        if (!v.voucherNumber.toLowerCase().includes(filterCriteria.voucherNumber.trim().toLowerCase())) return false;
      }
      if (filterCriteria.partnerKeyword.trim()) {
        const kw = filterCriteria.partnerKeyword.toLowerCase();
        if (!v.partnerName?.toLowerCase().includes(kw)) return false;
      }
      if (filterCriteria.status !== 'ALL' && v.status !== filterCriteria.status) return false;
      if (filterCriteria.fromDate && v.voucherDate < filterCriteria.fromDate) return false;
      if (filterCriteria.toDate && v.voucherDate > filterCriteria.toDate) return false;
      return true;
    });
  }, [vouchers, filterCriteria]);

  // Mở modal tạo mới
  const handleOpenAdd = () => {
    if (!perms.createEdit) {
      showToast.error('Bạn không có quyền lập chứng từ mới!');
      return;
    }
    setEditingVoucher(null);
    setIsViewOnly(false);
    setVoucherNumber(`CT-${new Date().getFullYear()}-${(vouchers.length + 1).toString().padStart(3, '0')}`);
    setVoucherDate(new Date().toISOString().split('T')[0]);
    setPartnerName('');
    setWarehouseName('Kho Tổng TP.HCM');
    setDescription('');
    setStatus('Lập chứng từ');
    setDetails([
      {
        id: Date.now().toString(),
        itemId: 'IT01',
        itemCode: 'VT-SAMPLE-01',
        itemName: 'Hàng hóa mẫu tiêu chuẩn 01',
        unit: 'Cái',
        quantity: 1,
        unitPrice: 1000000,
        amount: 1000000
      }
    ]);
    setShowModal(true);
  };

  // Mở modal xem / sửa
  const handleOpenEdit = (v: VoucherMasterModel, viewOnly = false) => {
    setEditingVoucher(v);
    setIsViewOnly(viewOnly);
    setVoucherNumber(v.voucherNumber);
    setVoucherDate(v.voucherDate);
    setPartnerName(v.partnerName || '');
    setWarehouseName(v.warehouseName || 'Kho Tổng TP.HCM');
    setDescription(v.description);
    setStatus(v.status);
    setDetails([...v.details]);
    setShowModal(true);
  };

  // Thêm 1 dòng chi tiết
  const handleAddDetailRow = () => {
    const newRow: VoucherDetailItem = {
      id: Date.now().toString(),
      itemId: `IT-${Date.now().toString().slice(-3)}`,
      itemCode: '',
      itemName: '',
      unit: 'Cái',
      quantity: 1,
      unitPrice: 0,
      amount: 0
    };
    setDetails([...details, newRow]);
  };

  // Xóa 1 dòng chi tiết
  const handleRemoveDetailRow = (id: string) => {
    setDetails(details.filter(d => d.id !== id));
  };

  // Cập nhật giá trị ô trong dòng chi tiết
  const handleDetailChange = (id: string, field: keyof VoucherDetailItem, value: any) => {
    setDetails(prev => prev.map(row => {
      if (row.id !== id) return row;
      const updated = { ...row, [field]: value };
      if (field === 'quantity' || field === 'unitPrice') {
        const qty = field === 'quantity' ? Number(value) : row.quantity;
        const price = field === 'unitPrice' ? Number(value) : row.unitPrice;
        updated.amount = (qty || 0) * (price || 0);
      }
      return updated;
    }));
  };

  // Lưu chứng từ
  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherNumber.trim()) {
      showToast.error('Vui lòng nhập số chứng từ!');
      return;
    }
    if (details.length === 0) {
      showToast.error('Vui lòng thêm ít nhất 1 dòng chi tiết hàng hóa!');
      return;
    }

    if (editingVoucher) {
      const updated: VoucherMasterModel = {
        ...editingVoucher,
        voucherNumber,
        voucherDate,
        partnerName,
        warehouseName,
        description,
        status,
        details,
        totalQuantity,
        totalAmount
      };
      setVouchers(prev => prev.map(v => v.id === editingVoucher.id ? updated : v));
      onSaveVoucher?.(updated);
      showToast.success(`Đã cập nhật chứng từ [${updated.voucherNumber}]!`);
    } else {
      const newV: VoucherMasterModel = {
        id: Date.now().toString(),
        voucherNumber,
        voucherDate,
        companyUnitId: 'DVCS01',
        partnerName,
        warehouseName,
        description,
        status: 'Lập chứng từ',
        details,
        totalQuantity,
        totalAmount,
        creator: currentUser?.fullName || 'Người dùng ERP'
      };
      setVouchers([newV, ...vouchers]);
      onSaveVoucher?.(newV);
      showToast.success(`Đã tạo thành công chứng từ [${newV.voucherNumber}]!`);
    }
    setShowModal(false);
  };

  // Phê duyệt nhanh chứng từ
  const handleApprove = (v: VoucherMasterModel) => {
    if (!perms.approve) {
      showToast.error('Bạn không có quyền phê duyệt chứng từ này!');
      return;
    }
    const updated: VoucherMasterModel = { ...v, status: 'Đã phê duyệt' };
    setVouchers(prev => prev.map(item => item.id === v.id ? updated : item));
    showToast.success(`Chứng từ [${v.voucherNumber}] đã được phê duyệt thành công!`);
  };

  const getStatusBadge = (st: VoucherMasterModel['status']) => {
    switch (st) {
      case 'Đã phê duyệt':
        return <Badge variant="emerald"><CheckCircle2 className="h-3 w-3 mr-1 inline" /> Đã duyệt</Badge>;
      case 'Chờ duyệt':
        return <Badge variant="amber"><Clock className="h-3 w-3 mr-1 inline" /> Chờ duyệt</Badge>;
      case 'Hủy':
        return <Badge variant="rose"><XCircle className="h-3 w-3 mr-1 inline" /> Đã hủy</Badge>;
      default:
        return <Badge variant="indigo">Lập chứng từ</Badge>;
    }
  };

  // Cấu hình bảng GridView
  const columns: GridViewColumn<VoucherMasterModel>[] = [
    {
      key: 'voucherNumber',
      header: 'Số Chứng Từ',
      accessor: (it) => (
        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
          {it.voucherNumber}
        </span>
      ),
      sortable: true,
      width: '140px'
    },
    {
      key: 'voucherDate',
      header: 'Ngày Lập',
      accessor: (it) => <span className="font-mono text-slate-600 dark:text-slate-400">{it.voucherDate}</span>,
      sortable: true,
      width: '110px'
    },
    {
      key: 'partnerName',
      header: 'Đối Tác / Khách Hàng',
      accessor: (it) => (
        <div>
          <p className="font-semibold text-slate-800 dark:text-slate-100">{it.partnerName || '---'}</p>
          <p className="text-[10px] text-slate-500 truncate max-w-xs">{it.description}</p>
        </div>
      ),
      sortable: true
    },
    {
      key: 'warehouseName',
      header: 'Kho Hàng',
      accessor: (it) => it.warehouseName || '---',
      sortable: true,
      width: '140px'
    },
    {
      key: 'totalQuantity',
      header: 'Số Lượng',
      accessor: (it) => <span className="font-bold text-slate-800 dark:text-slate-200">{it.totalQuantity.toLocaleString()}</span>,
      align: 'right',
      width: '100px'
    },
    {
      key: 'totalAmount',
      header: 'Tổng Tiền (VNĐ)',
      accessor: (it) => (
        <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(it.totalAmount)}
        </span>
      ),
      align: 'right',
      width: '150px',
      sortable: true
    },
    {
      key: 'status',
      header: 'Trạng Thái',
      accessor: (it) => getStatusBadge(it.status),
      align: 'center',
      width: '130px',
      sortable: true
    },
    {
      key: 'actions',
      header: 'Thao Tác',
      align: 'center',
      width: '130px',
      accessor: (it) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => handleOpenEdit(it, true)}
            className="p-1 text-slate-500 hover:text-indigo-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-[5px]"
            title="Xem chi tiết"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {perms.createEdit && it.status !== 'Đã phê duyệt' && (
            <button
              onClick={() => handleOpenEdit(it, false)}
              className="p-1 text-slate-500 hover:text-amber-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-[5px]"
              title="Chỉnh sửa"
            >
              <Edit className="h-3.5 w-3.5" />
            </button>
          )}
          {perms.approve && it.status === 'Chờ duyệt' && (
            <button
              onClick={() => handleApprove(it)}
              className="p-1 text-slate-500 hover:text-emerald-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-[5px]"
              title="Phê duyệt"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </button>
          )}
          {perms.delete && it.status !== 'Đã phê duyệt' && (
            <button
              onClick={() => setItemToDelete(it)}
              className="p-1 text-slate-500 hover:text-rose-600 dark:text-slate-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-[5px]"
              title="Xóa"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="w-full min-w-full flex-1 flex flex-col min-h-0 space-y-3">
      {/* 1. Header Toolbar */}
      <div className="sticky top-0 z-20 w-full min-w-full space-y-2">
        <CategoryHeaderToolbar
          icon={<FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          title="Nghiệp Vụ Chứng Từ Giao Dịch (Voucher Template)"
          subtitle="Mẫu nghiệp vụ Master-Detail: Lập chứng từ, lưới chi tiết vật tư, duyệt và quản lý trạng thái"
          count={filteredVouchers.length}
          countLabel="Chứng từ"
          showAdvancedFilter={showAdvancedFilter}
          onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
          activeFilterCount={filterCriteria.status !== 'ALL' || filterCriteria.voucherNumber ? 1 : 0}
          onRefresh={() => {
            setVouchers([...initialVouchers]);
            showToast.info('Đã tải lại danh sách chứng từ!');
          }}
          onExportExcel={() => showToast.success(`Đã xuất Excel ${filteredVouchers.length} chứng từ!`)}
          addLabel="Lập Chứng Từ Mới"
          onOpenAdd={handleOpenAdd}
          canCreate={perms.createEdit}
          filterPanelContent={
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Số Chứng Từ</label>
                <input
                  type="text"
                  placeholder="VD: CT-2026..."
                  value={filterCriteria.voucherNumber}
                  onChange={(e) => setFilterCriteria({ ...filterCriteria, voucherNumber: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 font-mono text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Đối Tác / Khách Hàng</label>
                <input
                  type="text"
                  placeholder="Tên đối tác..."
                  value={filterCriteria.partnerKeyword}
                  onChange={(e) => setFilterCriteria({ ...filterCriteria, partnerKeyword: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Trạng Thái Chứng Từ</label>
                <select
                  value={filterCriteria.status}
                  onChange={(e) => setFilterCriteria({ ...filterCriteria, status: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs font-bold focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="Lập chứng từ">Lập chứng từ</option>
                  <option value="Chờ duyệt">Chờ duyệt</option>
                  <option value="Đã phê duyệt">Đã phê duyệt</option>
                  <option value="Hủy">Đã hủy</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Từ Ngày Lập</label>
                <input
                  type="date"
                  value={filterCriteria.fromDate}
                  onChange={(e) => setFilterCriteria({ ...filterCriteria, fromDate: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-[5px] px-3 py-1.5 text-xs font-mono focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>
          }
          onApplyFilter={() => showToast.info('Đã áp dụng bộ lọc chứng từ!')}
          onClearFilter={() => {
            setFilterCriteria({
              voucherNumber: '',
              companyUnitId: 'ALL',
              status: 'ALL',
              fromDate: '',
              toDate: '',
              partnerKeyword: ''
            });
            showToast.info('Đã xóa bộ lọc!');
          }}
        />
      </div>

      {/* 2. GridView Chứng Từ */}
      <GridView<VoucherMasterModel>
        data={filteredVouchers}
        columns={columns}
        searchPlaceholder="Tìm nhanh theo số chứng từ, đối tác hoặc diễn giải..."
        keyExtractor={(item) => item.id}
        pageSize={10}
        dense
      />

      {/* 3. Modal Lập / Xem / Sửa Chứng Từ Master-Detail */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={isViewOnly ? `Chi Tiết Chứng Từ [${voucherNumber}]` : (editingVoucher ? `Chỉnh Sửa Chứng Từ [${voucherNumber}]` : 'Lập Chứng Từ Nghiệp Vụ Mới')}
        maxWidth="5xl"
      >
        <form onSubmit={handleSave} className="space-y-4 text-xs">
          {/* Thông tin phần đầu Master */}
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-[7px] border border-slate-200 dark:border-slate-700 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Số Chứng Từ *</label>
              <input
                type="text"
                disabled={isViewOnly}
                value={voucherNumber}
                onChange={(e) => setVoucherNumber(e.target.value.toUpperCase())}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-2.5 py-1.5 font-mono font-bold focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Ngày Chứng Từ *</label>
              <input
                type="date"
                disabled={isViewOnly}
                value={voucherDate}
                onChange={(e) => setVoucherDate(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-2.5 py-1.5 font-mono focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Đối Tác / Khách Hàng</label>
              <input
                type="text"
                disabled={isViewOnly}
                placeholder="Nhập tên đối tác..."
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Kho Hàng</label>
              <input
                type="text"
                disabled={isViewOnly}
                value={warehouseName}
                onChange={(e) => setWarehouseName(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="sm:col-span-2 md:col-span-3">
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Diễn Giải Nội Dung</label>
              <input
                type="text"
                disabled={isViewOnly}
                placeholder="Lý do, số hợp đồng, ghi chú..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">Trạng Thái</label>
              <select
                disabled={isViewOnly}
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-2.5 py-1.5 font-bold focus:ring-1 focus:ring-indigo-500"
              >
                <option value="Lập chứng từ">Lập chứng từ</option>
                <option value="Chờ duyệt">Chờ duyệt</option>
                <option value="Đã phê duyệt">Đã phê duyệt</option>
                <option value="Hủy">Đã hủy</option>
              </select>
            </div>
          </div>

          {/* Lưới Chi Tiết Hàng Hóa (Detail Grid) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 dark:text-slate-200">
                Chi Tiết Hàng Hóa / Dịch Vụ ({details.length} dòng)
              </h4>
              {!isViewOnly && (
                <Button size="sm" variant="outline" type="button" onClick={handleAddDetailRow} icon={<Plus className="h-3.5 w-3.5" />}>
                  Thêm Dòng
                </Button>
              )}
            </div>

            <div className="border border-slate-300 dark:border-slate-700 rounded-[7px] overflow-x-auto max-h-60 custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-300 dark:border-slate-700 font-semibold">
                    <th className="p-2 w-10 text-center">STT</th>
                    <th className="p-2 w-32">Mã Vật Tư</th>
                    <th className="p-2 min-w-[200px]">Tên Vật Tư / Hàng Hóa</th>
                    <th className="p-2 w-20 text-center">ĐVT</th>
                    <th className="p-2 w-24 text-right">Số Lượng</th>
                    <th className="p-2 w-32 text-right">Đơn Giá</th>
                    <th className="p-2 w-36 text-right">Thành Tiền</th>
                    {!isViewOnly && <th className="p-2 w-10 text-center">Xóa</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {details.map((row, idx) => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="p-2 text-center text-slate-400 font-mono">{idx + 1}</td>
                      <td className="p-1">
                        <input
                          type="text"
                          disabled={isViewOnly}
                          value={row.itemCode}
                          onChange={(e) => handleDetailChange(row.id, 'itemCode', e.target.value.toUpperCase())}
                          placeholder="Mã..."
                          className="w-full px-2 py-1 bg-transparent border border-slate-200 dark:border-slate-700 rounded-[5px] font-mono text-xs focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          disabled={isViewOnly}
                          value={row.itemName}
                          onChange={(e) => handleDetailChange(row.id, 'itemName', e.target.value)}
                          placeholder="Tên hàng hóa..."
                          className="w-full px-2 py-1 bg-transparent border border-slate-200 dark:border-slate-700 rounded-[5px] text-xs focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="text"
                          disabled={isViewOnly}
                          value={row.unit}
                          onChange={(e) => handleDetailChange(row.id, 'unit', e.target.value)}
                          className="w-full px-1 py-1 text-center bg-transparent border border-slate-200 dark:border-slate-700 rounded-[5px] text-xs"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="number"
                          disabled={isViewOnly}
                          min={1}
                          value={row.quantity}
                          onChange={(e) => handleDetailChange(row.id, 'quantity', e.target.value)}
                          className="w-full px-2 py-1 text-right bg-transparent border border-slate-200 dark:border-slate-700 rounded-[5px] text-xs font-bold"
                        />
                      </td>
                      <td className="p-1">
                        <input
                          type="number"
                          disabled={isViewOnly}
                          min={0}
                          value={row.unitPrice}
                          onChange={(e) => handleDetailChange(row.id, 'unitPrice', e.target.value)}
                          className="w-full px-2 py-1 text-right bg-transparent border border-slate-200 dark:border-slate-700 rounded-[5px] text-xs font-mono"
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {row.amount.toLocaleString()} đ
                      </td>
                      {!isViewOnly && (
                        <td className="p-1 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveDetailRow(row.id)}
                            className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Tổng số tiền chân trang */}
            <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-2.5 rounded-[5px] border border-slate-200 dark:border-slate-700 font-bold">
              <span>Tổng Cộng ({totalQuantity.toLocaleString()} đơn vị)</span>
              <span className="text-base text-emerald-600 dark:text-emerald-400 font-mono">
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalAmount)}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>
              Đóng
            </Button>
            {!isViewOnly && (
              <Button type="submit" icon={<Save className="h-4 w-4" />}>
                Lưu Chứng Từ
              </Button>
            )}
          </div>
        </form>
      </Modal>

      {/* 4. Modal Xóa */}
      <DeleteConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => {
          if (!itemToDelete) return;
          setVouchers(vouchers.filter(v => v.id !== itemToDelete.id));
          onDeleteVoucher?.(itemToDelete.id);
          showToast.success(`Đã xóa chứng từ [${itemToDelete.voucherNumber}]!`);
          setItemToDelete(null);
        }}
        title="Xác Nhận Hủy / Xóa Chứng Từ"
        message={`Bạn có chắc chắn muốn xóa chứng từ số [${itemToDelete?.voucherNumber}]? Hành động này sẽ không thể hoàn tác.`}
      />
    </div>
  );
};
