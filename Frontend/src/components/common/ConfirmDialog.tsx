import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmOptions {
  title: React.ReactNode;
  message?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** danger: delete / irreversible, warning: risky change, primary: normal question. */
  tone?: 'danger' | 'warning' | 'primary';
}

interface ConfirmDialogProps extends ConfirmOptions {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const TONE_ICON = {
  danger: <Trash2 className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />,
  warning: <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />,
  primary: <HelpCircle className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
};

const TONE_BOX = {
  danger: 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200',
  warning: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
  primary: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200'
};

/** Confirmation popup. Prefer the useConfirm() hook, which renders this for you. */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen, title, message, confirmLabel = 'Xác nhận', cancelLabel = 'Hủy bỏ', tone = 'primary', onConfirm, onCancel
}) => (
  <Modal isOpen={isOpen} onClose={onCancel} title={title}>
    <div className="space-y-4 text-xs">
      {message && (
        <div className={`flex items-start gap-3 p-3 rounded-[5px] border ${TONE_BOX[tone]}`}>
          {TONE_ICON[tone]}
          <div className="leading-relaxed">{message}</div>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel}>{cancelLabel}</Button>
        <Button variant={tone === 'danger' ? 'danger' : 'primary'} size="sm" onClick={onConfirm} autoFocus>
          {confirmLabel}
        </Button>
      </div>
    </div>
  </Modal>
);

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Mount once near the root (App). Enables useConfirm() everywhere below it. */
export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | undefined>(undefined);

  const confirm = useCallback<ConfirmFn>((next) => new Promise<boolean>(resolve => {
    resolver.current?.(false);
    resolver.current = resolve;
    setOptions(next);
  }), []);

  const close = (result: boolean) => {
    resolver.current?.(result);
    resolver.current = undefined;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && <ConfirmDialog isOpen {...options} onConfirm={() => close(true)} onCancel={() => close(false)} />}
    </ConfirmContext.Provider>
  );
};

/**
 * Promise-based confirmation, replacing window.confirm:
 *   if (!(await confirm({ title: 'Xóa tài khoản?', tone: 'danger' }))) return;
 */
export const useConfirm = (): ConfirmFn => {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm() cần ConfirmProvider ở cấp trên (App).');
  return confirm;
};
