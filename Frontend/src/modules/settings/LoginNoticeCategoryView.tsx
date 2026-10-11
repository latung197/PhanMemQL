// Settings › Thông báo trang đăng nhập (sys_login_notices), on the shared catalog screen: the welcome, maintenance and rule
// notices shown beside the login form, each with an optional picture; the kind BACKGROUND is only a picture (the background
// of the login screen). Read without signing in, so never put internal data in them.
import React, { useMemo } from 'react';
import { Megaphone, Pin } from 'lucide-react';
import { Badge, type BadgeVariant } from '../../components/common/Badge';
import { recordStampColumns } from '../../components/common/recordStampColumns';
import { CatalogScreen } from '../../components/catalog/CatalogScreen';
import type { CatalogDefinition } from '../../components/catalog/catalogTypes';
import { useLanguage } from '../../context/LanguageContext';
import { formatDate } from '../../utils/format';
import { loginImageUrl, loginNoticesApi, type LoginNoticeKind, type LoginNoticeRow, type SaveLoginNoticeInput } from '../../services/settingsApi';
import { LoginNoticeForm } from './LoginNoticeForm';
import type { UserProfile } from '../../types';

const KINDS: LoginNoticeKind[] = ['WELCOME', 'INFO', 'RULE', 'MAINTENANCE', 'BACKGROUND'];
const KIND_VARIANT: Record<LoginNoticeKind, BadgeVariant> = {
  WELCOME: 'success', INFO: 'slate', RULE: 'warning', MAINTENANCE: 'danger', BACKGROUND: 'info'
};
const day = (value: string | null | undefined) => (value ? String(value).trim().slice(0, 10) : null);

export const LoginNoticeCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const kindOptions = useMemo(() => KINDS.map(value => ({ value, label: t(`loginNotices.kind.${value}`) })), [t]);
  const toInput = (row: LoginNoticeRow): SaveLoginNoticeInput => ({
    code: row.code, title: row.title, content: row.content, titleEn: row.titleEn ?? '', contentEn: row.contentEn ?? '',
    kind: row.kind, startDate: day(row.startDate), endDate: day(row.endDate), pinned: row.pinned,
    loginImageCode: row.loginImageCode ?? '', sortOrder: row.sortOrder, isActive: row.isActive
  });

  const definition = useMemo((): CatalogDefinition<LoginNoticeRow, SaveLoginNoticeInput> => ({
    functionCode: 'sys_login_notices', api: loginNoticesApi,
    keyOf: row => row.code, describe: row => `${row.code} - ${row.title}`,
    icon: <Megaphone className="h-4 w-4" />,
    texts: {
      title: t('loginNotices.title'), subtitle: t('loginNotices.subtitle'), noun: t('loginNotices.noun'),
      add: t('loginNotices.add'), searchPlaceholder: t('loginNotices.search'),
      addTitle: t('loginNotices.addTitle'), editTitle: row => t('loginNotices.editTitle', { code: row.code }),
      fileName: 'ThongBaoTrangDangNhap'
    },
    columns: [
      { key: 'code', header: t('loginNotices.code'), width: '170px', sortable: true,
        render: row => <span className="font-mono font-bold">{row.code}</span> },
      { key: 'title', header: t('loginNotices.titleField'), width: '340px', sortable: true,
        render: row => (
          <span className="flex min-w-0 items-center gap-2">
            {row.loginImageCode
              ? <img src={loginImageUrl(row.loginImageCode)} alt="" className="h-7 w-11 shrink-0 rounded-[3px] object-cover" />
              : <span className="h-7 w-11 shrink-0 rounded-[3px] bg-slate-100 dark:bg-slate-800" aria-hidden />}
            <span className="min-w-0 flex-1 truncate" title={row.title}>{row.title}</span>
            {row.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-label={t('loginNotices.pinned')} />}
          </span>
        ) },
      { key: 'kind', header: t('loginNotices.kindField'), align: 'center', width: '150px', sortable: true,
        render: row => <Badge variant={KIND_VARIANT[row.kind]} size="sm">{t(`loginNotices.kind.${row.kind}`)}</Badge> },
      { key: 'startDate', header: t('loginNotices.startDate'), width: '120px', sortable: true,
        render: row => row.startDate ? formatDate(row.startDate) : '—' },
      { key: 'endDate', header: t('loginNotices.endDate'), width: '120px', sortable: true,
        render: row => row.endDate ? formatDate(row.endDate) : '—' },
      { key: 'isActive', header: t('loginNotices.status'), align: 'center', width: '140px', sortable: true,
        render: row => row.isActive
          ? <Badge variant="success" size="sm">{t('loginNotices.active')}</Badge>
          : <Badge variant="slate" size="sm">{t('loginNotices.inactive')}</Badge> },
      ...recordStampColumns<LoginNoticeRow>(t)
    ],
    // The kind filter is a query parameter of the list and the export (kind=RULE).
    filters: [{ key: 'kind', label: t('loginNotices.kindField'), options: kindOptions }],
    searchText: row => `${row.code} ${row.title} ${row.content}`,
    excel: {
      columns: [
        { key: 'code', header: t('loginNotices.code'), required: true, width: 20, example: 'TET-2027' },
        { key: 'title', header: t('loginNotices.titleField'), required: true, width: 32, example: 'Happy new year' },
        { key: 'content', header: t('loginNotices.content'), width: 50, example: '' },
        { key: 'titleEn', header: t('loginNotices.titleEn'), width: 32, example: '' },
        { key: 'contentEn', header: t('loginNotices.contentEn'), width: 50, example: '' },
        { key: 'kind', header: t('loginNotices.kindField'), width: 16, example: 'WELCOME' },
        { key: 'startDate', header: t('loginNotices.startDate'), width: 16, example: '2027-01-25' },
        { key: 'endDate', header: t('loginNotices.endDate'), width: 16, example: '2027-02-05' },
        { key: 'pinned', header: t('loginNotices.pinned'), type: 'boolean', width: 10, example: false },
        // Kept in the file so that importing a file again does not drop the pictures.
        { key: 'loginImageCode', header: t('loginNotices.imageCode'), width: 24, example: '' },
        { key: 'sortOrder', header: t('loginNotices.sortOrder'), type: 'number', width: 10, example: 1 },
        { key: 'isActive', header: t('loginNotices.isActive'), type: 'boolean', width: 14, example: true }
      ],
      toRow: toInput
    },
    emptyInput: {
      code: '', title: '', content: '', titleEn: '', contentEn: '', kind: 'INFO', startDate: null, endDate: null,
      pinned: false, loginImageCode: '', sortOrder: 0, isActive: true
    },
    toInput,
    normalize: input => ({ ...input, code: input.code.trim().toUpperCase(), title: input.title.trim(), content: input.content.trim(),
      titleEn: input.titleEn.trim(), contentEn: input.contentEn.trim(), kind: (input.kind || 'INFO').toString().trim().toUpperCase() as LoginNoticeKind,
      startDate: day(input.startDate), endDate: day(input.endDate), loginImageCode: (input.loginImageCode ?? '').trim().toUpperCase() }),
    renderForm: ({ form, setForm, editing }) => (
      <LoginNoticeForm form={form} setForm={setForm} editing={editing} kindOptions={kindOptions} />
    ),
    formWidth: '3xl'
  }), [t, kindOptions]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};
