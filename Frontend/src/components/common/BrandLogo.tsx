import React from 'react';

/**
 * The FSTV logo: a rounded mark with an "F" built from three bars (the middle one shorter, like a step) and the word FSTV.
 * `onDark` = white version for the brand-coloured side of the login screen.
 */
export const BrandLogo: React.FC<{ size?: 'md' | 'lg'; onDark?: boolean; markOnly?: boolean; className?: string }> = ({
  size = 'md', onDark = false, markOnly = false, className = ''
}) => {
  const box = size === 'lg' ? 'h-14 w-14' : 'h-10 w-10';
  const text = size === 'lg' ? 'text-4xl' : 'text-2xl';
  return (
    <div className={`inline-flex items-center gap-3 ${className}`} role="img" aria-label="FSTV">
      <svg viewBox="0 0 48 48" className={`${box} shrink-0`} aria-hidden>
        <rect width="48" height="48" rx="12" className={onDark ? 'fill-white' : 'fill-brand-600'} />
        <rect x="14" y="11" width="6" height="26" rx="2" className={onDark ? 'fill-brand-700' : 'fill-white'} />
        <rect x="14" y="11" width="21" height="6" rx="2" className={onDark ? 'fill-brand-700' : 'fill-white'} />
        <rect x="14" y="21" width="14" height="6" rx="2" className={onDark ? 'fill-brand-400' : 'fill-brand-200'} />
      </svg>
      {!markOnly && (
        <span className={`${text} font-black leading-none tracking-[0.12em] ${onDark ? 'text-white' : 'text-brand-700 dark:text-white'}`}>FSTV</span>
      )}
    </div>
  );
};
