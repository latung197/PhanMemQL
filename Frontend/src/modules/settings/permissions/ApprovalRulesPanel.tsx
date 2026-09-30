// Settings › Người dùng & Phân quyền › Quy trình phê duyệt: who approves which documents.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Edit3, FlaskConical, GitBranch, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '../../../components/common/Button';
import { Badge } from '../../../components/common/Badge';
import { Checkbox } from '../../../components/common/Checkbox';
import { Modal } from '../../../components/common/Modal';
import { FormSection, SelectInput, TextInput } from '../../../components/common/FormField';
import { EmptyState, ErrorState, LoadingState } from '../../../components/common/StateViews';
import { useConfirm } from '../../../components/common/ConfirmDialog';
import { CompanyUnit, RoleDefinition, SubMenuKey, UserProfile } from '../../../types';
import {
  approvalRulesApi, ApprovalPreview, ApprovalRule, ApproverType, Department, RequesterType, SaveApprovalRuleInput, SpecialRightDef
} from '../../../services/settingsApi';
import { getErrorMessage } from '../../../services/apiClient';
import { showToast } from '../../../utils/toast';
import { cn } from '../../../lib/utils';
import { FUNCTIONS } from './permissionCatalog';

interface ApprovalRulesPanelProps {
  users: UserProfile[];
  roles: RoleDefinition[];
  companyUnits: CompanyUnit[];
  rightDefs: SpecialRightDef[];
  departments: Department[];
  canEdit: boolean;
}

const REQUESTER_LABELS: Record<RequesterType, string> = {
  ANY: 'Mọi người lập', USER: 'Người lập cụ thể', ROLE: 'Người lập thuộc vai trò', DEPARTMENT: 'Người lập thuộc phòng ban'
};

const money = (n?: number | null) => n == null ? '' : new Intl.NumberFormat('vi-VN').format(n);
const functionLabel = (fn: SubMenuKey) => FUNCTIONS.find(f => f.subKey === fn)?.label ?? fn;

export const ApprovalRulesPanel: React.FC<ApprovalRulesPanelProps> = ({ users, roles, departments, companyUnits, rightDefs, canEdit }) => {
  const confirm = useConfirm();
  const [rules, setRules] = useState<ApprovalRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ApprovalRule | 'new' | null>(null);

  // Documents that go through approval = functions that have document-status rights.
  const documentFunctions = useMemo(() =>
    [...new Set(rightDefs.filter(d => d.group === 'status').map(d => d.function))], [rightDefs]);
  const [selected, setSelected] = useState<SubMenuKey>('inv_receipt');

  const load = useCallback(async () => {
    try {
      setRules(await approvalRulesApi.getAll());
      setError('');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const userName = (id?: string | null) => users.find(u => u.id === id)?.fullName ?? `#${id}`;
  const roleName = (id?: string | null) => roles.find(r => r.id === id)?.name ?? `#${id}`;
  const describeRequester = (r: ApprovalRule) =>
    r.requesterType === 'ANY' ? 'Mọi người lập'
      : r.requesterType === 'USER' ? userName(r.requesterValue)
      : r.requesterType === 'ROLE' ? `Vai trò ${roleName(r.requesterValue)}`
      : `Phòng ${departments.find(d => d.code === r.requesterValue)?.name ?? r.requesterValue}`;
  const describeApprover = (r: ApprovalRule) => r.approverType === 'ROLE' ? `Vai trò ${roleName(r.approverValue)}` : userName(r.approverValue);

  const selectedRules = rules.filter(r => r.function === selected).sort((a, b) => a.level - b.level || Number(a.id) - Number(b.id));
  const levels = [...new Set(selectedRules.map(r => r.level))];

  const handleDelete = async (rule: ApprovalRule) => {
    if (!(await confirm({ title: 'Xóa quy tắc phê duyệt?', message: `Cấp ${rule.level}: ${describeRequester(rule)} → ${describeApprover(rule)}`, tone: 'danger', confirmLabel: 'Xóa' }))) return;
    try {
      await approvalRulesApi.remove(rule.id);
      setRules(prev => prev.filter(r => r.id !== rule.id));
      showToast.success('Đã xóa quy tắc');
    } catch (e) {
      showToast.error(getErrorMessage(e));
    }
  };

  if (loading) return <LoadingState label="Đang tải quy trình phê duyệt..." />;
  if (error) return <ErrorState message={error} onRetry={() => { setLoading(true); void load(); }} />;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-2 min-h-0 lg:h-full">
      {/* Document types */}
      <div className="border-r border-slate-200 dark:border-slate-800 overflow-y-auto custom-scrollbar max-h-[40vh] lg:max-h-none">
        <p className="px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-500 border-b border-slate-200 dark:border-slate-800">Loại chứng từ</p>
        {documentFunctions.map(fn => {
          const count = rules.filter(r => r.function === fn && r.isActive).length;
          const active = fn === selected;
          return (
            <button key={fn} type="button" onClick={() => setSelected(fn)}
              className={cn('w-full text-left px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 cursor-pointer',
                active ? 'bg-indigo-50 dark:bg-indigo-950/50 border-l-2 border-l-indigo-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border-l-2 border-l-transparent')}>
              <span className={cn('text-xs font-bold', active ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-100')}>{functionLabel(fn)}</span>
              <span className={cn('text-[10px] shrink-0', count ? 'text-emerald-600 font-bold' : 'text-slate-400')}>
                {count ? `${count} quy tắc` : 'Mặc định'}
              </span>
            </button>
          );
        })}
      </div>

      {/* Rules of the selected document type */}
      <div className="p-3 space-y-3 overflow-y-auto custom-scrollbar">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <GitBranch className="h-4 w-4 text-indigo-600" /> Quy trình duyệt: {functionLabel(selected)}
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Phiếu được duyệt lần lượt từ cấp 1. Các quy tắc cùng cấp được gộp người duyệt; quy tắc có "Giá trị từ" chỉ áp dụng khi tổng tiền đạt mức đó.
              Người lập không bao giờ tự duyệt phiếu của mình.
            </p>
          </div>
          {canEdit && (
            <Button size="sm" className="h-7 shrink-0" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing('new')}>Thêm quy tắc</Button>
          )}
        </div>

        {selectedRules.length === 0 ? (
          <EmptyState title="Chưa có quy trình riêng"
            description="Phiếu loại này sẽ do bất kỳ ai có quyền Duyệt chức năng này (trong cùng đơn vị) phê duyệt, một cấp." />
        ) : (
          <div className="border border-slate-200 dark:border-slate-800 rounded-[5px] overflow-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2 text-left w-16">Cấp</th>
                  <th className="px-3 py-2 text-left">Áp dụng cho</th>
                  <th className="px-3 py-2 text-right w-32">Giá trị từ</th>
                  <th className="px-3 py-2 text-left w-28">Đơn vị</th>
                  <th className="px-3 py-2 text-left">Người duyệt</th>
                  <th className="px-3 py-2 text-left w-24">Trạng thái</th>
                  {canEdit && <th className="px-3 py-2 w-20"></th>}
                </tr>
              </thead>
              <tbody>
                {levels.map(level => selectedRules.filter(r => r.level === level).map((r, i) => (
                  <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-1.5">{i === 0 && <Badge variant="indigo" size="sm">Cấp {level}</Badge>}</td>
                    <td className="px-3 py-1.5">
                      <span className="font-medium text-slate-800 dark:text-slate-200">{describeRequester(r)}</span>
                      {r.note && <span className="block text-[10px] text-slate-400">{r.note}</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono">{r.minAmount != null ? `≥ ${money(r.minAmount)}` : 'Mọi giá trị'}</td>
                    <td className="px-3 py-1.5">{r.unitCode ?? 'Tất cả'}</td>
                    <td className="px-3 py-1.5 font-bold text-indigo-700 dark:text-indigo-300">{describeApprover(r)}</td>
                    <td className="px-3 py-1.5">{r.isActive ? <Badge variant="success" size="sm">Đang dùng</Badge> : <Badge variant="slate" size="sm">Tạm tắt</Badge>}</td>
                    {canEdit && (
                      <td className="px-3 py-1.5 text-right whitespace-nowrap">
                        <button type="button" className="p-1 text-slate-500 hover:text-indigo-600 cursor-pointer" title="Sửa" onClick={() => setEditing(r)}><Edit3 className="h-3.5 w-3.5" /></button>
                        <button type="button" className="p-1 text-slate-500 hover:text-rose-600 cursor-pointer" title="Xóa" onClick={() => void handleDelete(r)}><Trash2 className="h-3.5 w-3.5" /></button>
                      </td>
                    )}
                  </tr>
                )))}
              </tbody>
            </table>
          </div>
        )}

        <PreviewBox fn={selected} users={users} companyUnits={companyUnits} />
      </div>

      {editing && (
        <RuleModal
          rule={editing === 'new' ? undefined : editing}
          fn={selected}
          users={users}
          roles={roles}
          companyUnits={companyUnits}
          departments={departments}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setRules(prev => editing === 'new' ? [...prev, saved] : prev.map(r => r.id === saved.id ? saved : r));
            setEditing(null);
            showToast.success('Đã lưu quy tắc phê duyệt');
          }}
        />
      )}
    </div>
  );
};

/** "Người A lập phiếu X đồng thì ai duyệt?" */
const PreviewBox: React.FC<{ fn: SubMenuKey; users: UserProfile[]; companyUnits: CompanyUnit[] }> = ({ fn, users, companyUnits }) => {
  const activeUsers = users.filter(u => u.isActive !== false);
  const [requester, setRequester] = useState(activeUsers.find(u => !u.isSystemAdmin)?.id ?? activeUsers[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState('');
  const [result, setResult] = useState<ApprovalPreview | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => setResult(null), [fn]);

  const run = async () => {
    setRunning(true);
    try {
      setResult(await approvalRulesApi.preview(fn, Number(requester), amount ? Number(amount) : null, unit || null));
    } catch (e) {
      showToast.error(getErrorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  return (
    <FormSection icon={<FlaskConical />} title="Thử quy trình" description="Xem trước ai sẽ duyệt khi một người lập phiếu với giá trị cụ thể">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
        <SelectInput label="Người lập phiếu" value={requester} onChange={(e) => setRequester(e.target.value)}
          options={activeUsers.map(u => ({ value: u.id, label: `${u.fullName} (@${u.username})` }))} />
        <TextInput label="Tổng giá trị phiếu" type="number" min={0} placeholder="vd: 60000000" value={amount}
          onChange={(e) => setAmount(e.target.value)} hint={amount ? `${money(Number(amount))} đ` : undefined} />
        <SelectInput label="Đơn vị" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Đơn vị đang làm việc"
          options={companyUnits.map(u => ({ value: u.code, label: `${u.code} - ${u.shortName || u.name}` }))} />
        <Button size="sm" variant="outline" className="h-8" disabled={!requester || running} onClick={() => void run()}
          icon={<ArrowRight className="h-3.5 w-3.5" />}>Xem ai duyệt</Button>
      </div>
      {result && (
        <div className="space-y-1.5">
          {result.usesDefaultApprovers && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300">Không có quy tắc nào khớp, phiếu dùng người duyệt mặc định.</p>
          )}
          <div className="flex flex-wrap items-stretch gap-2">
            {result.levels.map((l, i) => (
              <React.Fragment key={l.level}>
                {i > 0 && <ArrowRight className="h-4 w-4 text-slate-400 self-center" />}
                <div className={cn('rounded-[5px] border px-3 py-2 text-xs min-w-[180px]',
                  l.approvers.length ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-950/30' : 'border-rose-300 bg-rose-50 dark:bg-rose-950/30')}>
                  <p className="font-extrabold text-slate-800 dark:text-slate-100">Cấp {l.level}</p>
                  <p className="text-[10px] text-slate-500 mb-1">{l.label}</p>
                  {l.approvers.length
                    ? l.approvers.map(a => <p key={a.id} className="font-medium">{a.fullName} <span className="text-slate-400">@{a.username}</span></p>)
                    : <p className="text-rose-600 font-bold">Không có người duyệt hợp lệ — phiếu sẽ không trình được</p>}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </FormSection>
  );
};

const RuleModal: React.FC<{
  rule?: ApprovalRule;
  fn: SubMenuKey;
  users: UserProfile[];
  roles: RoleDefinition[];
  companyUnits: CompanyUnit[];
  departments: Department[];
  onClose: () => void;
  onSaved: (rule: ApprovalRule) => void;
}> = ({ rule, fn, users, roles, companyUnits, departments, onClose, onSaved }) => {
  const [form, setForm] = useState<SaveApprovalRuleInput>(rule ?? {
    function: fn, level: 1, requesterType: 'ANY', requesterValue: null, minAmount: null, unitCode: null,
    approverType: 'ROLE', approverValue: roles.find(r => !r.isSystemRole)?.id ?? '', note: '', isActive: true
  });
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof SaveApprovalRuleInput>(key: K, value: SaveApprovalRuleInput[K]) => setForm(prev => ({ ...prev, [key]: value }));
  const userOptions = users.filter(u => u.isActive !== false).map(u => ({ value: u.id, label: `${u.fullName} (@${u.username})` }));
  const roleOptions = roles.map(r => ({ value: r.id, label: `${r.name} [${r.code}]` }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const input = { ...form, requesterValue: form.requesterType === 'ANY' ? null : form.requesterValue };
      onSaved(rule ? await approvalRulesApi.update(rule.id, input) : await approvalRulesApi.create(input));
    } catch (error) {
      showToast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} maxWidth="2xl" title={<><GitBranch className="h-5 w-5 text-indigo-600" /> {rule ? 'Sửa' : 'Thêm'} quy tắc duyệt — {functionLabel(fn)}</>}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <FormSection title="Khi nào áp dụng">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SelectInput label="Cấp duyệt" required value={String(form.level)} onChange={(e) => set('level', Number(e.target.value))}
              options={[1, 2, 3, 4, 5].map(n => ({ value: String(n), label: `Cấp ${n}` }))} hint="Cấp 1 duyệt trước" />
            <TextInput label="Giá trị phiếu từ" type="number" min={0} placeholder="Để trống = mọi giá trị"
              value={form.minAmount ?? ''} onChange={(e) => set('minAmount', e.target.value === '' ? null : Number(e.target.value))}
              hint={form.minAmount != null ? `≥ ${money(form.minAmount)} đ` : undefined} />
            <SelectInput label="Đơn vị" value={form.unitCode ?? ''} onChange={(e) => set('unitCode', e.target.value || null)}
              placeholder="Tất cả đơn vị" options={companyUnits.map(u => ({ value: u.code, label: `${u.code} - ${u.shortName || u.name}` }))} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SelectInput label="Áp dụng cho phiếu do" value={form.requesterType}
              onChange={(e) => { set('requesterType', e.target.value as RequesterType); set('requesterValue', null); }}
              options={(Object.keys(REQUESTER_LABELS) as RequesterType[]).map(k => ({ value: k, label: REQUESTER_LABELS[k] }))} />
            {form.requesterType === 'USER' && (
              <SelectInput label="Người lập" required value={form.requesterValue ?? ''} placeholder="— Chọn người —"
                onChange={(e) => set('requesterValue', e.target.value)} options={userOptions} />
            )}
            {form.requesterType === 'ROLE' && (
              <SelectInput label="Vai trò người lập" required value={form.requesterValue ?? ''} placeholder="— Chọn vai trò —"
                onChange={(e) => set('requesterValue', e.target.value)} options={roleOptions} />
            )}
            {form.requesterType === 'DEPARTMENT' && (
              <SelectInput label="Phòng ban người lập" required value={form.requesterValue ?? ''} placeholder="— Chọn phòng ban —"
                onChange={(e) => set('requesterValue', e.target.value)} options={departments.map(d => ({ value: d.code, label: d.name }))} />
            )}
          </div>
        </FormSection>

        <FormSection title="Ai duyệt">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SelectInput label="Người duyệt là" value={form.approverType}
              onChange={(e) => { set('approverType', e.target.value as ApproverType); set('approverValue', ''); }}
              options={[{ value: 'ROLE', label: 'Mọi người thuộc vai trò' }, { value: 'USER', label: 'Một người cụ thể' }]} />
            <SelectInput label={form.approverType === 'ROLE' ? 'Vai trò duyệt' : 'Người duyệt'} required value={form.approverValue}
              placeholder="— Chọn —" onChange={(e) => set('approverValue', e.target.value)}
              options={form.approverType === 'ROLE' ? roleOptions : userOptions}
              hint="Người duyệt cũng cần quyền Duyệt trên chức năng này và được vào đơn vị của phiếu" />
          </div>
          <TextInput label="Ghi chú" value={form.note ?? ''} onChange={(e) => set('note', e.target.value)} placeholder="vd: Phiếu lớn cần giám đốc duyệt" />
          <Checkbox label="Đang sử dụng" checked={form.isActive} onChange={(on) => set('isActive', on)} />
        </FormSection>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" type="button" onClick={onClose}>Hủy</Button>
          <Button type="submit" size="sm" disabled={saving} icon={<Save className="h-3.5 w-3.5" />}>Lưu quy tắc</Button>
        </div>
      </form>
    </Modal>
  );
};
