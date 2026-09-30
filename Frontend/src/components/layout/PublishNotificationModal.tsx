import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { CompanyUnit, ModuleCategoryKey, SystemNotification } from '../../types';
import { NotificationRecipient, notificationService } from '../../services/notificationService';
import { saveWithFeedback, showToast } from '../../utils/toast';
import { TextInput, SelectInput, TextArea } from '../common/FormField';

interface PublishNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyUnits: CompanyUnit[];
  /** Admin / "Gửi thông báo toàn hệ thống": any unit. Otherwise only the current unit. */
  allUnits: boolean;
  currentUnitCode?: string;
  onPublished: () => void;
}

const MODULE_OPTIONS: { value: ModuleCategoryKey | ''; label: string }[] = [
  { value: '', label: '— Không liên kết —' },
  { value: 'overview', label: 'Tổng quan' },
  { value: 'inventory', label: 'Kho hàng' },
  { value: 'sales', label: 'Bán hàng' },
  { value: 'finance', label: 'Tài chính' },
  { value: 'hr', label: 'Nhân sự' },
  { value: 'reports', label: 'Báo cáo' },
  { value: 'settings', label: 'Cài đặt' }
];

const TYPE_OPTIONS = [
  { value: 'info', label: 'Thông tin' },
  { value: 'success', label: 'Thành công' },
  { value: 'warning', label: 'Cảnh báo' },
  { value: 'danger', label: 'Khẩn cấp' }
];

/** Form to send a notification to a unit (or every unit) or to one person. */
export const PublishNotificationModal: React.FC<PublishNotificationModalProps> = ({
  isOpen,
  onClose,
  companyUnits,
  allUnits,
  currentUnitCode,
  onPublished
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<SystemNotification['type']>('info');
  const [linkModule, setLinkModule] = useState<ModuleCategoryKey | ''>('');
  const [unitCode, setUnitCode] = useState(allUnits ? '' : currentUnitCode ?? '');
  const [recipientId, setRecipientId] = useState('');
  const [recipients, setRecipients] = useState<NotificationRecipient[]>([]);
  const [isSending, setIsSending] = useState(false);

  const targetUnit = allUnits ? unitCode : currentUnitCode ?? '';
  const unitLabel = (code?: string) => {
    const unit = companyUnits.find(u => u.code === code);
    return unit ? `${unit.code} - ${unit.shortName || unit.name}` : code || '';
  };

  // People who can be addressed in the chosen unit (every unit when none is chosen).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    notificationService.getRecipients(targetUnit || undefined)
      .then(list => {
        if (cancelled) return;
        setRecipients(list);
        setRecipientId(prev => list.some(r => String(r.id) === prev) ? prev : '');
      })
      .catch(() => { if (!cancelled) setRecipients([]); });
    return () => { cancelled = true; };
  }, [isOpen, targetUnit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSending(true);
    const sent = await saveWithFeedback(notificationService.publish({
      title: title.trim(),
      message: message.trim(),
      type,
      linkModule: linkModule || null,
      unitCode: targetUnit || null,
      recipientUserId: recipientId ? Number(recipientId) : null
    }), () => showToast.success('Đã gửi thông báo!'));
    setIsSending(false);
    if (!sent) return;
    setTitle('');
    setMessage('');
    setRecipientId('');
    onPublished();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Gửi Thông Báo" maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <TextInput label="Tiêu đề" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextArea label="Nội dung" required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SelectInput label="Mức độ" value={type} onChange={(e) => setType(e.target.value as SystemNotification['type'])}
            options={TYPE_OPTIONS} />
          <SelectInput label="Phân hệ liên kết" value={linkModule}
            onChange={(e) => setLinkModule(e.target.value as ModuleCategoryKey | '')}
            options={MODULE_OPTIONS} />
          {allUnits ? (
            <SelectInput label="Gửi tới đơn vị" value={unitCode} onChange={(e) => setUnitCode(e.target.value)}
              placeholder="Tất cả đơn vị cơ sở"
              options={companyUnits.map(u => ({ value: u.code, label: unitLabel(u.code) }))} />
          ) : (
            <TextInput label="Gửi tới đơn vị" value={unitLabel(currentUnitCode)} disabled
              hint="Bạn chỉ được gửi trong đơn vị đang làm việc" />
          )}
          <SelectInput label="Người nhận" value={recipientId} onChange={(e) => setRecipientId(e.target.value)}
            placeholder={targetUnit ? 'Mọi người trong đơn vị' : 'Mọi người dùng'}
            options={recipients.map(r => ({
              value: String(r.id), label: `${r.fullName} (@${r.userName})${r.department ? ` · ${r.department}` : ''}`
            }))} />
        </div>
        <div className="pt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>Hủy</Button>
          <Button type="submit" size="sm" disabled={isSending} icon={<Send className="h-3.5 w-3.5" />}>
            Gửi Thông Báo
          </Button>
        </div>
      </form>
    </Modal>
  );
};
