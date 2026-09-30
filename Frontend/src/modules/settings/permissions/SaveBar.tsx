import React from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { Button } from '../../../components/common/Button';

interface SaveBarProps {
  changes: number;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saveLabel?: string;
}

/** Sticky bar shown while there are unsaved edits. */
export const SaveBar: React.FC<SaveBarProps> = ({ changes, saving, onSave, onDiscard, saveLabel = 'Lưu thay đổi' }) => {
  if (changes === 0) return null;
  return (
    <div className="sticky bottom-0 z-20 -mx-3 -mb-3 px-3 py-2 bg-amber-50/95 dark:bg-amber-950/80 backdrop-blur-xs border-t border-amber-200 dark:border-amber-800 flex items-center justify-between gap-2 rounded-b-lg">
      <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">
        Có {changes} thay đổi chưa lưu
      </span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" className="h-7" disabled={saving} onClick={onDiscard}
          icon={<RotateCcw className="h-3.5 w-3.5" />}>
          Hủy thay đổi
        </Button>
        <Button size="sm" className="h-7" disabled={saving} onClick={onSave} icon={<Save className="h-3.5 w-3.5" />}>
          {saving ? 'Đang lưu...' : saveLabel}
        </Button>
      </div>
    </div>
  );
};
