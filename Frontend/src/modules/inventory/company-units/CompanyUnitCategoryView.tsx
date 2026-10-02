import React, { useState, useMemo } from 'react';
import { Plus, Edit, Trash2, Building2, RefreshCw, Download, Upload, Filter, X } from 'lucide-react';
import { CategoryHeaderToolbar } from '../../../components/common/CategoryHeaderToolbar';
import { GridView, GridViewColumn } from '../../../components/common/GridView';
import { Modal } from '../../../components/common/Modal';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { CompanyUnit, UserProfile } from '../../../types';
import { getActionPermission } from '../../../mock/initialRoles';
import { showToast } from '../../../utils/toast';
import { useLanguage } from '../../../context/LanguageContext';

interface CompanyUnitCategoryViewProps {
  companyUnits: CompanyUnit[];
  /** Each handler saves through the API and resolves to true on success (errors are shown by the caller). */
  onAddCompanyUnit: (unit: Omit<CompanyUnit, 'id'>) => Promise<boolean>;
  onUpdateCompanyUnit?: (id: string, unit: Partial<CompanyUnit>) => Promise<boolean>;
  onDeleteCompanyUnit?: (id: string) => Promise<boolean>;
  currentUser?: UserProfile;
}

export const CompanyUnitCategoryView: React.FC<CompanyUnitCategoryViewProps> = ({
  companyUnits: initialUnits,
  onAddCompanyUnit,
  onUpdateCompanyUnit,
  onDeleteCompanyUnit,
  currentUser
}) => {
  const { t } = useLanguage();
  const perms = getActionPermission(currentUser, 'inv_company_unit_cat');
  const [localUnits, setLocalUnits] = useState<CompanyUnit[]>(initialUnits);

  React.useEffect(() => {
    setLocalUnits(initialUnits);
  }, [initialUnits]);

  const [showAdvancedFilter, setShowAdvancedFilter] = useState(false);
  const [filterName, setFilterName] = useState('');
  const [filterCode, setFilterCode] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const filteredUnits = useMemo(() => {
    return localUnits.filter(unit => {
      if (filterName && !unit.name.toLowerCase().includes(filterName.toLowerCase()) && !(unit.shortName || '').toLowerCase().includes(filterName.toLowerCase())) return false;
      if (filterCode && !unit.code.toLowerCase().includes(filterCode.toLowerCase())) return false;
      if (filterStatus !== 'ALL' && unit.status !== filterStatus) return false;
      return true;
    });
  }, [localUnits, filterName, filterCode, filterStatus]);

  const activeFilterCount = (filterName ? 1 : 0) + (filterCode ? 1 : 0) + (filterStatus !== 'ALL' ? 1 : 0);

  const units = filteredUnits;

  const [showModal, setShowModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<CompanyUnit | null>(null);

  // Deletion confirmation state
  const [unitToDelete, setUnitToDelete] = useState<CompanyUnit | null>(null);
  const [bulkToDeleteIds, setBulkToDeleteIds] = useState<(string | number)[] | null>(null);

  // Form states
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [shortName, setShortName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [taxCode, setTaxCode] = useState('');
  const [status, setStatus] = useState<'Hoạt động' | 'Tạm dừng'>('Hoạt động');

  const handleOpenAdd = () => {
    if (!perms.create) {
      showToast.error('Tài khoản của bạn không có quyền THÊM Đơn vị cơ sở!');
      return;
    }
    setEditingUnit(null);
    setCode(`DVCS${(units.length + 1).toString().padStart(2, '0')}`);
    setName('');
    setShortName('');
    setAddress('');
    setPhone('');
    setEmail('');
    setTaxCode('');
    setStatus('Hoạt động');
    setShowModal(true);
  };

  const handleOpenEdit = (unit: CompanyUnit) => {
    if (!perms.edit) {
      showToast.error('Tài khoản của bạn chỉ có quyền XEM, không có quyền SỬA!');
      return;
    }
    setEditingUnit(unit);
    setCode(unit.code);
    setName(unit.name);
    setShortName(unit.shortName || '');
    setAddress(unit.address || '');
    setPhone(unit.phone || '');
    setEmail(unit.email || '');
    setTaxCode(unit.taxCode || '');
    setStatus(unit.status);
    setShowModal(true);
  };

  const handleDelete = (unit: CompanyUnit) => {
    if (!perms.delete) {
      showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA Đơn vị cơ sở!');
      return;
    }
    setUnitToDelete(unit);
  };

  const handleConfirmSingleDelete = async () => {
    if (!unitToDelete) return;
    if (!perms.delete || !onDeleteCompanyUnit) {
      showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA Đơn vị cơ sở!');
      setUnitToDelete(null);
      return;
    }
    const { id, name } = unitToDelete;
    setUnitToDelete(null);
    if (await onDeleteCompanyUnit(id)) {
      showToast.success(`Đã xóa thành công Đơn vị cơ sở "${name}"!`);
    }
  };

  const handleConfirmBulkDelete = async () => {
    if (!bulkToDeleteIds || bulkToDeleteIds.length === 0) return;
    if (!perms.delete || !onDeleteCompanyUnit) {
      showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA Đơn vị cơ sở!');
      setBulkToDeleteIds(null);
      return;
    }
    const ids = bulkToDeleteIds.map(String);
    setBulkToDeleteIds(null);
    let deleted = 0;
    for (const id of ids) {
      if (await onDeleteCompanyUnit(id)) deleted++;
    }
    if (deleted > 0) showToast.success(`Đã xóa thành công ${deleted}/${ids.length} Đơn vị cơ sở đã chọn!`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) {
      showToast.error('Vui lòng nhập Mã và Tên Đơn vị cơ sở!');
      return;
    }

    const fields = {
      name: name.trim(),
      shortName: shortName.trim(),
      address: address.trim(),
      phone: phone.trim(),
      email: email.trim(),
      taxCode: taxCode.trim(),
      status
    };
    if (editingUnit) {
      if (!onUpdateCompanyUnit) return;
      // The code is the key of the unit and cannot be changed.
      if (!(await onUpdateCompanyUnit(editingUnit.id, { ...editingUnit, ...fields }))) return;
      showToast.success('Cập nhật Đơn vị cơ sở thành công!');
    } else {
      if (!(await onAddCompanyUnit({ ...fields, code: code.trim().toUpperCase(), isDefault: false }))) return;
      showToast.success('Thêm mới Đơn vị cơ sở thành công!');
    }
    setShowModal(false);
  };

  const columns: GridViewColumn<CompanyUnit>[] = [
    {
      key: 'code',
      title: 'Mã ĐVCS',
      sortable: true,
      width: '120px',
      render: (item) => (
        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
          {item.code}
        </span>
      )
    },
    {
      key: 'name',
      title: 'Tên Đơn vị cơ sở',
      sortable: true,
      render: (item) => (
        <div>
          <div className="font-bold text-slate-800 dark:text-slate-100">{item.name}</div>
          {item.address && <div className="text-xs text-slate-500">{item.address}</div>}
        </div>
      )
    },
    {
      key: 'shortName',
      title: 'Tên viết tắt',
      width: '130px',
      render: (item) => <span className="text-xs text-slate-600 dark:text-slate-400">{item.shortName || '-'}</span>
    },
    {
      key: 'taxCode',
      title: 'Mã số thuế',
      width: '130px',
      render: (item) => <span className="font-mono text-xs">{item.taxCode || '-'}</span>
    },
    {
      key: 'phone',
      title: 'Điện thoại / Email',
      width: '180px',
      render: (item) => (
        <div className="text-xs">
          <div>{item.phone || '-'}</div>
          <div className="text-slate-400">{item.email}</div>
        </div>
      )
    },
    {
      key: 'status',
      title: 'Trạng thái',
      sortable: true,
      width: '120px',
      render: (item) => (
        <Badge variant={item.status === 'Hoạt động' ? 'success' : 'neutral'}>
          {item.status}
        </Badge>
      )
    },
    {
      key: 'actions',
      title: 'Thao tác',
      width: '100px',
      align: 'center',
      render: (item) => (
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => handleOpenEdit(item)}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg transition-colors"
            title="Sửa ĐVCS"
          >
            <Edit className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleDelete(item)}
            className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg transition-colors"
            title="Xóa ĐVCS"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="sticky top-0 z-20 w-full min-w-full space-y-2">
        <CategoryHeaderToolbar
          icon={<Building2 />}
          title="Khai Báo Danh Mục Đơn Vị Cơ Sở"
          count={units.length}
          countLabel="ĐVCS"
          subtitle="Quản lý chi nhánh, trụ sở, nhà máy và phân quyền dữ liệu toàn hệ thống"
          showAdvancedFilter={showAdvancedFilter}
          onToggleAdvancedFilter={() => setShowAdvancedFilter(!showAdvancedFilter)}
          activeFilterCount={activeFilterCount}
          onRefresh={() => {
            setLocalUnits([...initialUnits]);
            showToast.info('Đã tải lại danh sách Đơn vị cơ sở!');
          }}
          onExportExcel={perms.export ? () => showToast.success('Đã xuất Excel danh mục Đơn vị cơ sở!') : undefined}
          onImportExcel={perms.create ? () => showToast.info('Tính năng nhập Excel đang xử lý!') : undefined}
          addLabel="Thêm ĐVCS"
          onOpenAdd={handleOpenAdd}
          canCreate={perms.create}
          filterPanelContent={
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Mã ĐVCS</label>
                <input
                  type="text"
                  placeholder="Mã ĐVCS..."
                  value={filterCode}
                  onChange={(e) => setFilterCode(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Từ Khóa Tên / Tên Viết Tắt</label>
                <input
                  type="text"
                  placeholder="Nhập tên ĐVCS..."
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-600 dark:text-slate-400 font-medium mb-1">Trạng Thái</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-[5px] px-3 py-1.5 text-xs font-semibold focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="Hoạt động">Hoạt động</option>
                  <option value="Tạm dừng">Tạm dừng</option>
                </select>
              </div>
            </div>
          }
          onClearFilter={() => {
            setFilterCode('');
            setFilterName('');
            setFilterStatus('ALL');
          }}
        />
      </div>

      {/* GridView */}
      <GridView<CompanyUnit>
        data={units}
        columns={columns}
        searchPlaceholder="Tìm theo mã, tên, địa chỉ, mã số thuế ĐVCS..."
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
                showToast.error('Tài khoản của bạn KHÔNG CÓ QUYỀN XÓA Đơn vị cơ sở!');
                return;
              }
              setBulkToDeleteIds(selectedIds);
            }
          }
        ]}
      />

      {/* Add / Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingUnit ? `Chỉnh Sửa Đơn Vị Cơ Sở: ${editingUnit.code}` : 'Khai Báo Thêm Mới Đơn Vị Cơ Sở'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Mã Đơn Vị Cơ Sở (ma_dvcs) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={!!editingUnit}
                title={editingUnit ? 'Mã đơn vị cơ sở không thể thay đổi sau khi tạo' : undefined}
                placeholder="VD: DVCS01, DVCS_HN..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono font-bold uppercase focus:ring-2 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Tên Đơn Vị Cơ Sở (ten_dvcs) <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Trụ sở chính TP. Hồ Chí Minh"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tên Viết Tắt</label>
              <input
                type="text"
                value={shortName}
                onChange={(e) => setShortName(e.target.value)}
                placeholder="VD: HCMC HO"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Mã Số Thuế</label>
              <input
                type="text"
                value={taxCode}
                onChange={(e) => setTaxCode(e.target.value)}
                placeholder="VD: 0301234567"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Số Điện Thoại</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 028 3822 1111"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Liện Hệ</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="VD: ho@erp-enterprise.vn"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="md:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Địa Chỉ Trụ Sở</label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="VD: Tòa nhà S-ERP, Quận 1, TP. Hồ Chí Minh"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Trạng Thái</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Hoạt động">Hoạt động</option>
                <option value="Tạm dừng">Tạm dừng</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>
              Hủy
            </Button>
            <Button variant="primary" type="submit">
              {editingUnit ? 'Lưu Thay Đổi' : 'Thêm Đơn Vị Cơ Sở'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Single Delete Confirmation Modal */}
      <Modal
        isOpen={!!unitToDelete}
        onClose={() => setUnitToDelete(null)}
        title="Xác nhận xóa Đơn vị cơ sở"
        maxWidth="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
            <Trash2 className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm text-rose-800 dark:text-rose-200">Bạn có chắc chắn muốn xóa?</p>
              <p>
                Đơn vị cơ sở <span className="font-bold text-slate-900 dark:text-white">"{unitToDelete?.name}"</span> (Mã: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{unitToDelete?.code}</span>) sẽ bị loại bỏ khỏi hệ thống.
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">Lưu ý: Thao tác này không thể hoàn tác.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button variant="outline" size="sm" onClick={() => setUnitToDelete(null)}>
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
        title="Xác nhận xóa hàng loạt Đơn vị cơ sở"
        maxWidth="sm"
      >
        <div className="space-y-4 pt-1">
          <div className="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
            <Trash2 className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-sm text-rose-800 dark:text-rose-200">Xác nhận xóa {bulkToDeleteIds?.length} Đơn vị cơ sở?</p>
              <p>
                Toàn bộ <span className="font-bold text-slate-900 dark:text-white">{bulkToDeleteIds?.length} ĐVCS</span> đã chọn sẽ bị loại bỏ.
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
