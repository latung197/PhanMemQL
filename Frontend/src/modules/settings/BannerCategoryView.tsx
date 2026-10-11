// Settings › Thanh thông báo hệ thống (sys_banners), on the shared catalog screen: the lines shown under the header of every
// signed-in user of the chosen units while they are in force (maintenance, deadlines, incidents).
import React, { useMemo } from 'react';
import { BellRing } from 'lucide-react';
import { Badge, type BadgeVariant } from '../../components/common/Badge';
import { recordStampColumns } from '../../components/common/recordStampColumns';
import { CatalogScreen } from '../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../components/catalog/catalogTypes';
import { useLanguage } from '../../context/LanguageContext';
import { bannersApi, type BannerLevel, type BannerRow, type SaveBannerInput } from '../../services/settingsApi';
import { formatDateTime } from '../../utils/format';
import { BannerForm } from './BannerForm';
import type { UserProfile } from '../../types';

const LEVELS: BannerLevel[] = ['INFO', 'WARNING', 'URGENT'];
const LEVEL_VARIANT: Record<BannerLevel, BadgeVariant> = { INFO: 'info', WARNING: 'warning', URGENT: 'danger' };

const splitCodes = (text: string): string[] => text.split(/[\s,;]+/).map(code => code.trim().toUpperCase()).filter(Boolean);

type State = 'off' | 'scheduled' | 'live' | 'ended';
const stateOf = (row: BannerRow): State => {
  if (!row.isActive) return 'off';
  const now = Date.now();
  if (row.startAt && new Date(row.startAt).getTime() > now) return 'scheduled';
  if (row.endAt && new Date(row.endAt).getTime() < now) return 'ended';
  return 'live';
};
const STATE_VARIANT: Record<State, BadgeVariant> = { off: 'slate', scheduled: 'info', live: 'success', ended: 'slate' };

export const BannerCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const levelOptions = useMemo(() => LEVELS.map(value => ({ value, label: t(`banners.level.${value}`) })), [t]);
  const toInput = (row: BannerRow): SaveBannerInput => ({
    code: row.code, message: row.message, messageEn: row.messageEn ?? '', level: row.level, startAt: row.startAt ?? null,
    endAt: row.endAt ?? null, unitCodes: row.unitCodes, sortOrder: row.sortOrder, isActive: row.isActive
  });

  const definition = useMemo((): CatalogDefinition<BannerRow, SaveBannerInput> => ({
    functionCode: 'sys_banners', api: bannersApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.message}`,
    icon: <BellRing className="h-4 w-4" />,
    texts: {
      title: t('banners.title'), subtitle: t('banners.subtitle'), noun: t('banners.noun'),
      add: t('banners.add'), searchPlaceholder: t('banners.search'),
      addTitle: t('banners.addTitle'), editTitle: row => t('banners.editTitle', { code: row.code }),
      fileName: 'ThanhThongBaoHeThong'
    },
    columns: [
      { key: 'code', header: t('banners.code'), width: '170px', sortable: true,
        render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'message', header: t('banners.message'), width: '380px', sortable: true,
        render: row => <span className="block truncate" title={row.message}>{row.message}</span> },
      { key: 'level', header: t('banners.levelField'), align: 'center', width: '130px', sortable: true,
        render: row => <Badge variant={LEVEL_VARIANT[row.level]} size="sm">{t(`banners.level.${row.level}`)}</Badge> },
      { key: 'startAt', header: t('banners.startAt'), width: '150px', sortable: true, render: row => row.startAt ? formatDateTime(row.startAt) : '—' },
      { key: 'endAt', header: t('banners.endAt'), width: '150px', sortable: true, render: row => row.endAt ? formatDateTime(row.endAt) : '—' },
      { key: 'unitCodes', header: t('banners.units'), width: '170px',
        render: row => row.unitCodes
          ? <span className="font-mono text-[11px]">{row.unitCodes.split(',').join(', ')}</span>
          : <Badge variant="slate" size="sm">{t('banners.allUnits')}</Badge> },
      { key: 'isActive', header: t('banners.status'), align: 'center', width: '140px', sortable: true,
        render: row => { const state = stateOf(row); return <Badge variant={STATE_VARIANT[state]} size="sm">{t(`banners.state.${state}`)}</Badge>; } },
      ...recordStampColumns<BannerRow>(t)
    ],
    // The level filter is a query parameter of the list and the export (level=URGENT).
    filters: [{ key: 'level', label: t('banners.levelField'), options: levelOptions }],
    searchText: row => `${row.code} ${row.message}`,
    excel: {
      columns: [
        { key: 'code', header: t('banners.code'), required: true, width: 20, example: 'BAOTRI-THU7' },
        { key: 'message', header: t('banners.message'), required: true, width: 60, example: 'System maintenance 22:00 - 23:00 Saturday' },
        { key: 'messageEn', header: t('banners.messageEn'), width: 60, example: '' },
        { key: 'level', header: t('banners.levelField'), width: 14, example: 'WARNING' },
        { key: 'startAt', header: t('banners.startAtUtc'), width: 24, example: '2026-10-17T12:00:00Z' },
        { key: 'endAt', header: t('banners.endAtUtc'), width: 24, example: '2026-10-17T16:30:00Z' },
        { key: 'unitCodes', header: t('banners.units'), width: 24, example: '' },
        { key: 'sortOrder', header: t('banners.sortOrder'), type: 'number', width: 10, example: 0 },
        { key: 'isActive', header: t('banners.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: toInput
    },
    emptyInput: { code: '', message: '', messageEn: '', level: 'INFO', startAt: null, endAt: null, unitCodes: '', sortOrder: 0, isActive: true },
    toInput,
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), message: input.message.trim(), messageEn: input.messageEn.trim(),
      level: (input.level || 'INFO').toString().trim().toUpperCase() as BannerLevel, unitCodes: splitCodes(input.unitCodes ?? '').join(',') }),
    renderForm: ({ form, setForm, editing }) => <BannerForm form={form} setForm={setForm} editing={editing} />,
    formWidth: '2xl'
  }), [t, levelOptions]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
