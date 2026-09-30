import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyle = 'inline-flex items-center justify-center gap-2 font-semibold transition-all rounded-[5px] focus:outline-hidden cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const variantStyles = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-xs dark:bg-brand-600 dark:hover:bg-brand-500',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200',
    danger: 'bg-rose-500 hover:bg-rose-600 text-white shadow-xs',
    success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs',
    outline: 'border border-slate-300 dark:border-slate-700 bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800',
    ghost: 'bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
  };

  const sizeStyles = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-xs',
    lg: 'px-5 py-2.5 text-sm'
  };

  return (
    <button
      className={`${baseStyle} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </button>
  );
};
