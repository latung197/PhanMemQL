import React from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { useLanguage } from '../../context/LanguageContext';
import { interpolate } from '../../utils/interpolate';

export interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  itemCode?: string;
  itemName?: string;
  isBulk?: boolean;
  bulkCount?: number;
  /** Own explanation, shown instead of the default sentence. */
  message?: React.ReactNode;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  itemCode,
  itemName,
  isBulk = false,
  bulkCount = 0,
  message
}) => {
  const { t } = useLanguage();
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || (isBulk ? t('controls.deleteConfirm.titleBulk') : t('controls.deleteConfirm.title'))}
      maxWidth="sm"
    >
      <div className="space-y-4 pt-1">
        <div className="flex items-start gap-3 p-3.5 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
          <Trash2 className="h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-sm text-rose-800 dark:text-rose-200">
              {isBulk ? t('controls.deleteConfirm.questionBulk', { n: bulkCount }) : t('controls.deleteConfirm.question')}
            </p>
            {message ? <p>{message}</p> : isBulk ? (
              <p>{t('controls.deleteConfirm.bulkInfo')}</p>
            ) : (
              <p>
                {interpolate(t('controls.deleteConfirm.item'), {
                  name: <span className="font-bold text-slate-900 dark:text-white">"{itemName || t('controls.deleteConfirm.itemFallback')}"</span>,
                  code: itemCode ? interpolate(t('controls.deleteConfirm.code'), {
                    code: <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">{itemCode}</span>
                  }) : ''
                })}
              </p>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t('controls.deleteConfirm.cancel')}
          </Button>
          <Button variant="danger" size="sm" onClick={onConfirm}>
            <Trash2 className="h-4 w-4 mr-1" /> {t('controls.deleteConfirm.confirm')} {isBulk && bulkCount > 0 ? `(${bulkCount})` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
