import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface ComboBoxOption {
  value: string;
  label: string;
  subLabel?: string;
  badge?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface ComboBoxProps {
  label?: string;
  options: ComboBoxOption[];
  value?: string;
  onChange: (value: string, option?: ComboBoxOption) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  helperText?: string;
  className?: string;
  inputClassName?: string;
  labelClassName?: string;
  compact?: boolean;
}

export const ComboBox: React.FC<ComboBoxProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = 'Chọn một tùy chọn...',
  required = false,
  disabled = false,
  searchable = true,
  clearable = true,
  helperText,
  className = '',
  inputClassName = '',
  labelClassName = '',
  compact = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  const filteredOptions = options.filter(
    (opt) =>
      opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (opt.subLabel && opt.subLabel.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelect = (option: ComboBoxOption) => {
    if (option.disabled) return;
    onChange(option.value, option);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  const defaultLabelClass = compact
    ? "block text-[9.5px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-0.5 truncate"
    : "font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1 text-xs";

  const defaultBoxClass = compact
    ? "w-full flex items-center justify-between px-2 py-0.5 h-[26px] bg-slate-50/50 dark:bg-slate-800/60 border rounded-[5px] cursor-pointer transition-colors text-[10.5px] font-bold"
    : "w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-slate-900 border rounded-[5px] cursor-pointer transition-colors text-xs font-medium";

  return (
    <div className={`text-xs relative ${compact ? 'space-y-0.5' : 'space-y-1'} ${className}`} ref={containerRef}>
      {label && (
        <label className={labelClassName || defaultLabelClass}>
          {label}
          {required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Select Box Button */}
      <div
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`${inputClassName || defaultBoxClass} ${
          isOpen
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-white dark:bg-slate-900'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}`}
      >
        <div className="flex items-center gap-2 overflow-hidden truncate">
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          {selectedOption ? (
            <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
              {selectedOption.label}
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 truncate">{placeholder}</span>
          )}
          {selectedOption?.badge && (
            <span className="shrink-0 text-[10px] px-1.5 py-0.2 rounded font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              {selectedOption.badge}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0 ml-2">
          {clearable && value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-rose-500 rounded-[5px] hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-indigo-500' : ''
            }`}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-[8px] shadow-xl max-h-60 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
          {searchable && (
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm kiếm tùy chọn..."
                className="w-full bg-transparent border-none text-xs focus:outline-hidden text-slate-800 dark:text-slate-100 placeholder-slate-400"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          <div className="overflow-y-auto p-1 space-y-0.5 max-h-48">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => handleSelect(opt)}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors ${
                      opt.disabled
                        ? 'opacity-40 cursor-not-allowed'
                        : isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-semibold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="truncate">{opt.label}</span>
                          {opt.badge && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              {opt.badge}
                            </span>
                          )}
                        </div>
                        {opt.subLabel && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 font-normal truncate">
                            {opt.subLabel}
                          </p>
                        )}
                      </div>
                    </div>

                    {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 ml-2" />}
                  </div>
                );
              })
            ) : (
              <div className="p-4 text-center text-slate-400 dark:text-slate-500 text-xs">
                Không tìm thấy kết quả phù hợp
              </div>
            )}
          </div>
        </div>
      )}

      {helperText && (
        <p className="text-[11px] text-slate-400 dark:text-slate-500">{helperText}</p>
      )}
    </div>
  );
};
