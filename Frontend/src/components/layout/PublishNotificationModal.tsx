import React, { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { CompanyUnit, ModuleCategoryKey, SystemNotification } from '../../types';
import { NotificationRecipient, notificationService } from '../../services/notificationService';
import { saveWithFeedback, showToast } from '../../utils/toast';
import { TextInput, SelectInput, TextArea } from '../common/FormField';
import { useLanguage } from '../../context/LanguageContext';

interface PublishNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyUnits: CompanyUnit[];
  /** Admin / "Gửi thông báo toàn hệ thống": any unit. Otherwise only the current unit. */
  allUnits: boolean;
  currentUnitCode?: string;
  onPublished: () => void;
}

/** Modules a notification can link to (names: modules.*). */
const MODULES: ModuleCategoryKey[] = ['overview', 'inventory', 'sales', 'finance', 'hr', 'reports', 'settings'];

const TYPES: SystemNotification['type'][] = ['info', 'success', 'warning', 'danger'];

/** Form to send a notification to a unit (or every unit) or to one person. */
export const PublishNotificationModal: React.FC<PublishNotificationModalProps> = ({
  isOpen,
  onClose,
  companyUnits,
  allUnits,
  currentUnitCode,
  onPublished
}) => {
  const { t } = useLanguage();
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
    }), () => showToast.success(t('layout.publish.sent')));
    setIsSending(false);
    if (!sent) return;
    setTitle('');
    setMessage('');
    setRecipientId('');
    onPublished();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('layout.publish.title')} maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        <TextInput label={t('layout.publish.subject')} required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} />
        <TextArea label={t('layout.publish.message')} required rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SelectInput label={t('layout.publish.level')} value={type} onChange={(e) => setType(e.target.value as SystemNotification['type'])}
            options={TYPES.map(value => ({ value, label: t(`layout.publish.types.${value}`) }))} />
          <SelectInput label={t('layout.publish.module')} value={linkModule}
            onChange={(e) => setLinkModule(e.target.value as ModuleCategoryKey | '')}
            options={[{ value: '', label: t('layout.publish.noModule') }, ...MODULES.map(value => ({ value, label: t(`modules.${value}`) }))]} />
          {allUnits ? (
            <SelectInput label={t('layout.publish.unit')} value={unitCode} onChange={(e) => setUnitCode(e.target.value)}
              placeholder={t('layout.publish.allUnits')}
              options={companyUnits.map(u => ({ value: u.code, label: unitLabel(u.code) }))} />
          ) : (
            <TextInput label={t('layout.publish.unit')} value={unitLabel(currentUnitCode)} disabled
              hint={t('layout.publish.ownUnitOnly')} />
          )}
          <SelectInput label={t('layout.publish.recipient')} value={recipientId} onChange={(e) => setRecipientId(e.target.value)}
            placeholder={targetUnit ? t('layout.publish.everyoneInUnit') : t('layout.publish.everyone')}
            options={recipients.map(r => ({
              value: String(r.id), label: `${r.fullName} (@${r.userName})${r.department ? ` · ${r.department}` : ''}`
            }))} />
        </div>
        <div className="pt-2 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>{t('layout.publish.cancel')}</Button>
          <Button type="submit" size="sm" disabled={isSending} icon={<Send className="h-3.5 w-3.5" />}>
            {t('layout.publish.title')}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
