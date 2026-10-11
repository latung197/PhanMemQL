// Kho › Danh mục vật tư (inv_material_cat), on the shared catalog screen. Besides identity a material carries the flags
// the stock ledger follows (by lot, by location, expiry date, counted periodically) and its costing method.
// See docs/phat-trien/them-danh-muc.md.
import React, { useEffect, useMemo, useState } from 'react';
import { Package } from 'lucide-react';
import { Badge } from '../../../../components/common/Badge';
import { recordStampColumns } from '../../../../components/common/recordStampColumns';
import { lookupApi } from '../../../../components/catalog/CatalogLookup';
import { CatalogScreen } from '../../../../components/catalog/CatalogScreen';
import type { CatalogDefinition, CatalogFilter } from '../../../../components/catalog/catalogTypes';
import { useLanguage } from '../../../../context/LanguageContext';
import type { UserProfile } from '../../../../types';
import { materialsApi } from './api';
import { MaterialForm } from './MaterialForm';
import type { MaterialRecord, SaveMaterialInput } from './types';

const quantity = (n?: number | null) => (n === null || n === undefined ? '—' : n.toLocaleString('vi-VN', { maximumFractionDigits: 4 }));

const emptyInput: SaveMaterialInput = {
  code: '', name: '', uomCode: '', customerMaterialCode: '', partNo: '', materialTypeCode: '', materialGroupCode: '',
  vatTaxRateCode: '', importTaxRateCode: '', isStockItem: true, trackLot: false, hasExpiry: false, shelfLifeDays: null,
  trackLocation: false, isCycleCounted: false, costingMethod: 'AVERAGE', minStock: null, maxStock: null, length: null,
  width: null, height: null, weight: null, volume: null, note: '', isActive: true
};

export const MaterialCategoryView: React.FC<{ currentUser?: UserProfile }> = ({ currentUser }) => {
  const { t } = useLanguage();
  const [typeOptions, setTypeOptions] = useState<{ value: string; label: string }[]>([]);
  const [groupOptions, setGroupOptions] = useState<{ value: string; label: string }[]>([]);

  // Choices of the type and group filters (a handful of rows each, read through the lookups).
  useEffect(() => {
    let alive = true;
    const toOptions = (items: { code: string; name: string }[]) => items.map(x => ({ value: x.code, label: `${x.code} - ${x.name}` }));
    void lookupApi.search('materialTypes', '', 1, 200, true).then(page => { if (alive) setTypeOptions(toOptions(page.items)); }).catch(() => {});
    void lookupApi.search('materialGroups', '', 1, 200, true).then(page => { if (alive) setGroupOptions(toOptions(page.items)); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  const definition = useMemo((): CatalogDefinition<MaterialRecord, SaveMaterialInput> => {
    const flag = (on: boolean, label: string) => on ? <Badge variant="info" size="sm">{label}</Badge> : null;
    const costingLabel = (method: string) => method === 'FIFO' ? t('materials.costingFifo') : t('materials.costingAverage');
    return {
      functionCode: 'inv_material_cat', api: materialsApi,
      keyOf: row => row.code, describe: row => `${row.code} - ${row.name}`,
      icon: <Package className="h-4 w-4" />,
      texts: {
        title: t('materials.title'), subtitle: t('materials.subtitle'), noun: t('materials.noun'),
        add: t('materials.add'), searchPlaceholder: t('materials.search'),
        addTitle: t('materials.addTitle'), editTitle: row => t('materials.editTitle', { code: row.code }),
        fileName: 'DanhMucVatTu'
      },
      columns: [
        { key: 'code', header: t('materials.code'), width: '170px', sortable: true,
          render: row => <span className="font-mono font-bold">{row.code}</span> },
        { key: 'name', header: t('materials.name'), sortable: true },
        { key: 'uomCode', header: t('materials.uom'), width: '110px', sortable: true, render: row => row.uomName || row.uomCode },
        { key: 'materialTypeName', header: t('materials.type'), sortable: true, render: row => row.materialTypeName || row.materialTypeCode || '—' },
        { key: 'materialGroupName', header: t('materials.group'), sortable: true, render: row => row.materialGroupName || row.materialGroupCode || '—' },
        { key: 'tracking', header: t('materials.tracking'), width: '230px',
          render: row => !row.isStockItem
            ? <Badge variant="slate" size="sm">{t('materials.notStock')}</Badge>
            : <span className="flex flex-wrap gap-1">
                {flag(row.trackLot, t('materials.trackingLot'))}
                {flag(row.trackLocation, t('materials.trackingLocation'))}
                {flag(row.hasExpiry, t('materials.trackingExpiry'))}
                {!row.trackLot && !row.trackLocation && !row.hasExpiry && '—'}
              </span> },
        { key: 'costingMethod', header: t('materials.costing'), sortable: true, render: row => costingLabel(row.costingMethod) },
        { key: 'minStock', header: t('materials.minStock'), align: 'right', sortable: true, render: row => <span className="font-mono">{quantity(row.minStock)}</span> },
        { key: 'maxStock', header: t('materials.maxStock'), align: 'right', sortable: true, render: row => <span className="font-mono">{quantity(row.maxStock)}</span> },
        { key: 'isActive', header: t('materials.status'), align: 'center', width: '140px', sortable: true,
          render: row => row.isActive
            ? <Badge variant="success" size="sm">{t('materials.active')}</Badge>
            : <Badge variant="slate" size="sm">{t('materials.inactive')}</Badge> },
        ...recordStampColumns<MaterialRecord>(t)
      ],
      filters: [
        { key: 'typeCode', label: t('materials.type'), options: typeOptions },
        { key: 'groupCode', label: t('materials.group'), options: groupOptions },
        { key: 'tracking', label: t('materials.trackingFilter'), options: [
          { value: 'lot', label: t('materials.trackingLot') },
          { value: 'location', label: t('materials.trackingLocation') },
          { value: 'expiry', label: t('materials.trackingExpiry') },
          { value: 'none', label: t('materials.trackingNone') }
        ] }
      ] as CatalogFilter<MaterialRecord>[],
      excel: {
        columns: [
          { key: 'code', header: t('materials.code'), required: true, width: 22, example: 'LAP-DELL-XPS15' },
          { key: 'name', header: t('materials.name'), required: true, width: 40, example: 'Laptop Dell XPS 15' },
          { key: 'uomCode', header: t('materials.uom'), required: true, width: 16, example: 'CHIEC' },
          { key: 'customerMaterialCode', header: t('materials.customerCode'), width: 20, example: '' },
          { key: 'partNo', header: t('materials.partNo'), width: 20, example: '' },
          { key: 'materialTypeCode', header: t('materials.type'), width: 16, example: 'TP' },
          { key: 'materialGroupCode', header: t('materials.group'), width: 16, example: '' },
          { key: 'vatTaxRateCode', header: t('materials.vatTax'), width: 16, example: '' },
          { key: 'importTaxRateCode', header: t('materials.importTax'), width: 16, example: '' },
          { key: 'isStockItem', header: t('materials.isStockItem'), type: 'boolean', width: 14, example: true },
          { key: 'trackLot', header: t('materials.trackLot'), type: 'boolean', width: 14, example: false },
          { key: 'hasExpiry', header: t('materials.hasExpiry'), type: 'boolean', width: 14, example: false },
          { key: 'shelfLifeDays', header: t('materials.shelfLifeDays'), type: 'number', width: 14, example: '' },
          { key: 'trackLocation', header: t('materials.trackLocation'), type: 'boolean', width: 14, example: false },
          { key: 'isCycleCounted', header: t('materials.isCycleCounted'), type: 'boolean', width: 14, example: false },
          { key: 'costingMethod', header: t('materials.costing'), width: 14, example: 'AVERAGE' },
          { key: 'minStock', header: t('materials.minStock'), type: 'number', width: 14, example: '' },
          { key: 'maxStock', header: t('materials.maxStock'), type: 'number', width: 14, example: '' },
          { key: 'length', header: t('materials.length'), type: 'number', width: 12, example: '' },
          { key: 'width', header: t('materials.width'), type: 'number', width: 12, example: '' },
          { key: 'height', header: t('materials.height'), type: 'number', width: 12, example: '' },
          { key: 'weight', header: t('materials.weight'), type: 'number', width: 12, example: '' },
          { key: 'volume', header: t('materials.volume'), type: 'number', width: 12, example: '' },
          { key: 'note', header: t('materials.note'), width: 40, example: '' },
          { key: 'isActive', header: t('materials.isActive'), type: 'boolean', width: 14, example: true }
        ],
        toRow: row => ({ ...toInput(row) })
      },
      emptyInput,
      toInput,
      normalize: input => ({
        ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(),
        uomCode: input.uomCode.trim().toUpperCase(),
        materialTypeCode: (input.materialTypeCode ?? '').trim().toUpperCase(),
        materialGroupCode: (input.materialGroupCode ?? '').trim().toUpperCase(),
        vatTaxRateCode: (input.vatTaxRateCode ?? '').trim().toUpperCase(),
        importTaxRateCode: (input.importTaxRateCode ?? '').trim().toUpperCase(),
        customerMaterialCode: (input.customerMaterialCode ?? '').trim(), partNo: (input.partNo ?? '').trim(),
        costingMethod: (input.costingMethod || 'AVERAGE').toString().trim().toUpperCase() as SaveMaterialInput['costingMethod'],
        note: (input.note ?? '').trim()
      }),
      renderForm: props => <MaterialForm {...props} />,
      formWidth: '2xl'
    };
  }, [t, typeOptions, groupOptions]);
  return <CatalogScreen definition={definition} currentUser={currentUser} />;
};

const toInput = (row: MaterialRecord): SaveMaterialInput => ({
  code: row.code, name: row.name, uomCode: row.uomCode, customerMaterialCode: row.customerMaterialCode ?? '',
  partNo: row.partNo ?? '', materialTypeCode: row.materialTypeCode ?? '', materialGroupCode: row.materialGroupCode ?? '',
  vatTaxRateCode: row.vatTaxRateCode ?? '', importTaxRateCode: row.importTaxRateCode ?? '', isStockItem: row.isStockItem,
  trackLot: row.trackLot, hasExpiry: row.hasExpiry, shelfLifeDays: row.shelfLifeDays ?? null, trackLocation: row.trackLocation,
  isCycleCounted: row.isCycleCounted, costingMethod: row.costingMethod, minStock: row.minStock ?? null, maxStock: row.maxStock ?? null,
  length: row.length ?? null, width: row.width ?? null, height: row.height ?? null, weight: row.weight ?? null,
  volume: row.volume ?? null, note: row.note ?? '', isActive: row.isActive
});
