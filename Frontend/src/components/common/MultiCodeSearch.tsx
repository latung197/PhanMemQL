import React, { useState, useMemo } from 'react';
import { Search, X, Check, Copy, Filter, RotateCcw, ChevronDown, CheckSquare, Square, Layers } from 'lucide-react';
import { showToast } from '../../utils/toast';
import { useLanguage } from '../../context/LanguageContext';

export interface CodeOption {
  code: string;
  name?: string;
  subLabel?: string;
  category?: string;
}

interface MultiCodeSearchProps {
  options: (CodeOption | string)[];
  selectedCodes: string[];
  onChange: (selectedCodes: string[]) => void;
  title?: string;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

export const MultiCodeSearch: React.FC<MultiCodeSearchProps> = ({
  options,
  selectedCodes,
  onChange,
  title = 'Tra Cứu & Lọc Đa Mã',
  placeholder = 'Nhập các mã phân cách bằng phẩy, khoảng trắng hoặc xuống dòng...',
  className = '',
  compact = false
}) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'quick_paste' | 'select_list'>('select_list');

  // Normalize options to CodeOption objects
  const normalizedOptions: CodeOption[] = useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'string') {
        return { code: opt, name: opt };
      }
      return opt;
    });
  }, [options]);

  // Filter options based on inner search
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const term = searchTerm.toLowerCase();
    return normalizedOptions.filter(
      opt => opt.code.toLowerCase().includes(term) || (opt.name && opt.name.toLowerCase().includes(term))
    );
  }, [normalizedOptions, searchTerm]);

  // Toggle single code
  const handleToggleCode = (code: string) => {
    if (selectedCodes.includes(code)) {
      onChange(selectedCodes.filter(c => c !== code));
    } else {
      onChange([...selectedCodes, code]);
    }
  };

  // Toggle select all in current filtered list
  const handleSelectAllFiltered = () => {
    const filteredCodes = filteredOptions.map(o => o.code);
    const newSelected = Array.from(new Set([...selectedCodes, ...filteredCodes]));
    onChange(newSelected);
  };

  // Clear all selections
  const handleClearAll = () => {
    onChange([]);
    setInputText('');
  };

  // Parse typed / pasted text into codes
  const handleApplyPaste = () => {
    if (!inputText.trim()) return;
    const parsed = inputText
      .split(/[\n,;\s]+/)
      .map(s => s.trim())
      .filter(Boolean);

    if (parsed.length > 0) {
      const merged = Array.from(new Set([...selectedCodes, ...parsed]));
      onChange(merged);
      setInputText('');
      showToast.success(`Đã thêm ${parsed.length} mã vào danh sách lọc!`);
    }
  };

  // Copy codes to clipboard
  const handleCopyCodes = () => {
    if (selectedCodes.length === 0) return;
    navigator.clipboard.writeText(selectedCodes.join(', '));
    showToast.success('Đã sao chép các mã đã chọn vào clipboard!');
  };

  const isAllFilteredSelected =
    filteredOptions.length > 0 && filteredOptions.every(o => selectedCodes.includes(o.code));

  return (
    <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs ${className}`}>
      {/* Component Header / Trigger */}
      <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <Filter className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              {title}
              {selectedCodes.length > 0 && (
                <span className="bg-indigo-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  {selectedCodes.length} {t('selected')}
                </span>
              )}
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Chọn một hoặc nhiều mã vật tư/kho/chứng từ để tra cứu đồng thời
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          {selectedCodes.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleCopyCodes}
                className="p-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                title="Sao chép các mã đã chọn"
              >
                <Copy className="h-3.5 w-3.5 text-indigo-500" />
                <span className="hidden sm:inline text-[11px]">{t('copyCodes')}</span>
              </button>

              <button
                type="button"
                onClick={handleClearAll}
                className="p-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center gap-1 cursor-pointer"
                title="Xóa tất cả các mã đang lọc"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline text-[11px]">{t('clearAll')}</span>
              </button>
            </>
          )}

          {compact && (
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="p-1.5 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>{isOpen ? 'Thu gọn' : 'Mở rộng'}</span>
              <ChevronDown className={`h-4 w-4 transform transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {/* Selected Code Tags Bar */}
      {selectedCodes.length > 0 && (
        <div className="p-3 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Mã đã chọn:</span>
          {selectedCodes.map(code => (
            <span
              key={code}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60 shadow-2xs"
            >
              {code}
              <button
                type="button"
                onClick={() => handleToggleCode(code)}
                className="text-indigo-400 hover:text-rose-500 rounded p-0.5 cursor-pointer"
                title="Xóa mã này"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Content Area (Visible if not compact OR if compact and isOpen) */}
      {(!compact || isOpen) && (
        <div className="p-3 sm:p-4 space-y-3">
          {/* Tabs: Choose from list vs Quick Paste */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setActiveTab('select_list')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'select_list'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Chọn từ danh sách ({normalizedOptions.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('quick_paste')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeTab === 'quick_paste'
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Dán danh sách mã hàng loạt
              </button>
            </div>

            {activeTab === 'select_list' && (
              <button
                type="button"
                onClick={handleSelectAllFiltered}
                className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                {isAllFilteredSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                {isAllFilteredSelected ? 'Bỏ chọn danh sách này' : 'Chọn tất cả danh sách đang tìm'}
              </button>
            )}
          </div>

          {/* TAB 1: Select List */}
          {activeTab === 'select_list' && (
            <div className="space-y-2">
              {/* Inner Search Box */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Lọc danh sách mã hoặc tên cần tìm..."
                  className="w-full pl-8 pr-8 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Options Grid / Checkbox list */}
              <div className="max-h-48 overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 p-1 bg-slate-50/50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800">
                {filteredOptions.length === 0 ? (
                  <div className="col-span-full py-4 text-center text-xs text-slate-400">
                    Không tìm thấy mã phù hợp với "{searchTerm}"
                  </div>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = selectedCodes.includes(opt.code);
                    return (
                      <label
                        key={opt.code}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-indigo-50/80 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-200 font-bold'
                            : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-200'
                        }`}
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleCode(opt.code)}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                          />
                          <div className="truncate">
                            <span className="font-mono text-[11px] block truncate">{opt.code}</span>
                            {opt.name && opt.name !== opt.code && (
                              <span className="text-[10px] text-slate-400 dark:text-slate-400 block truncate font-normal">
                                {opt.name}
                              </span>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-indigo-600 shrink-0 ml-1" />}
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB 2: Quick Paste Textarea */}
          {activeTab === 'quick_paste' && (
            <div className="space-y-2">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={placeholder}
                rows={3}
                className="w-full p-2.5 text-xs font-mono rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
              />
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span>Ví dụ: VT001, VT002, SP-102 (Phân cách tự động)</span>
                <button
                  type="button"
                  onClick={handleApplyPaste}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                >
                  <Check className="h-3.5 w-3.5" />
                  Thêm vào danh sách lọc
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
