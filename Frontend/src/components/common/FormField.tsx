import React, { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useLanguage } from '../../context/LanguageContext';

/** Shared look of every text-like control (input, select, textarea). */
export const fieldControlClass = (hasError?: boolean, className?: string) => cn(
  'w-full bg-slate-50 dark:bg-slate-800 border rounded-[5px] px-3 py-2 text-xs font-medium',
  'text-slate-900 dark:text-slate-100 placeholder-slate-400 transition-colors',
  'focus:outline-hidden focus:ring-1',
  hasError
    ? 'border-rose-400 dark:border-rose-600 focus:border-rose-500 focus:ring-rose-500'
    : 'border-slate-300 dark:border-slate-700 focus:border-indigo-500 focus:ring-indigo-500',
  'disabled:opacity-60 disabled:cursor-not-allowed read-only:bg-slate-100 dark:read-only:bg-slate-800/60',
  className
);

export interface FormFieldProps {
  label?: React.ReactNode;
  required?: boolean;
  /** Help text under the control. Hidden while an error is shown. */
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  /** Receives the generated id to put on the control, so the label points to it. */
  children: (id: string) => React.ReactNode;
}

/** Label + control + hint/error. Use TextInput / SelectInput / TextArea for the common cases. */
export const FormField: React.FC<FormFieldProps> = ({ label, required, hint, error, className, children }) => {
  const id = useId();
  return (
    <div className={cn('space-y-1', className)}>
      {label && (
        <label htmlFor={id} className="block text-xs font-bold text-slate-700 dark:text-slate-300">
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      {children(id)}
      {error ? (
        <p className="text-[11px] text-rose-600 dark:text-rose-400">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
};

type FieldProps = Pick<FormFieldProps, 'label' | 'hint' | 'error'> & {
  /** Classes of the wrapper (label + control). `className` styles the control itself. */
  wrapperClassName?: string;
};

export type TextInputProps = FieldProps & React.InputHTMLAttributes<HTMLInputElement>;

export const TextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  ({ label, hint, error, wrapperClassName, className, required, ...props }, ref) => (
    <FormField label={label} required={required} hint={hint} error={error} className={wrapperClassName}>
      {(id) => (
        <input
          ref={ref}
          {...props}
          id={props.id ?? id}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          className={fieldControlClass(Boolean(error), className)}
        />
      )}
    </FormField>
  )
);
TextInput.displayName = 'TextInput';

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export type SelectInputProps = FieldProps & React.SelectHTMLAttributes<HTMLSelectElement> & {
  options?: SelectOption[];
  /** Adds a first empty option with this text. */
  placeholder?: string;
};

export const SelectInput = React.forwardRef<HTMLSelectElement, SelectInputProps>(
  ({ label, hint, error, wrapperClassName, className, required, options, placeholder, children, ...props }, ref) => (
    <FormField label={label} required={required} hint={hint} error={error} className={wrapperClassName}>
      {(id) => (
        <select
          ref={ref}
          {...props}
          id={props.id ?? id}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          className={fieldControlClass(Boolean(error), cn('cursor-pointer', className))}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options?.map(o => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
          ))}
          {children}
        </select>
      )}
    </FormField>
  )
);
SelectInput.displayName = 'SelectInput';

export type TextAreaProps = FieldProps & React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, hint, error, wrapperClassName, className, required, rows = 3, ...props }, ref) => (
    <FormField label={label} required={required} hint={hint} error={error} className={wrapperClassName}>
      {(id) => (
        <textarea
          ref={ref}
          {...props}
          id={props.id ?? id}
          rows={rows}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          className={fieldControlClass(Boolean(error), cn('resize-y', className))}
        />
      )}
    </FormField>
  )
);
TextArea.displayName = 'TextArea';

export type PasswordInputProps = Omit<TextInputProps, 'type'>;

/** Password field with a show / hide button. */
export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ label, hint, error, wrapperClassName, className, required, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    const { t } = useLanguage();
    return (
      <FormField label={label} required={required} hint={hint} error={error} className={wrapperClassName}>
        {(id) => (
          <div className="relative">
            <input
              ref={ref}
              {...props}
              id={props.id ?? id}
              type={visible ? 'text' : 'password'}
              required={required}
              aria-invalid={Boolean(error) || undefined}
              className={fieldControlClass(Boolean(error), cn('pr-9', className))}
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setVisible(v => !v)}
              title={visible ? t('controls.password.hide') : t('controls.password.show')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        )}
      </FormField>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';

/** Titled group of fields inside a form. */
export const FormSection: React.FC<{
  title: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}> = ({ title, description, icon, action, className, children }) => (
  <section className={cn('rounded-[5px] border border-slate-200 dark:border-slate-800', className)}>
    <header className="flex items-center justify-between gap-2 px-3 py-2 bg-brand-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 rounded-t-[5px]">
      <div className="min-w-0">
        <h4 className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800 dark:text-slate-100 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:text-indigo-600">
          {icon}{title}
        </h4>
        {description && <p className="text-[11px] text-slate-500 dark:text-slate-400">{description}</p>}
      </div>
      {action}
    </header>
    <div className="p-3 space-y-3">{children}</div>
  </section>
);