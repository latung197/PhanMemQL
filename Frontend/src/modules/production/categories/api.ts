// Production catalogs (backend: /api/production/teams and /api/production/operations). Every list is paged on the server.
import { createCatalogApi } from '../../../components/catalog/createCatalogApi';
import type { RecordStamp } from '../../../components/common/RecordStamp';

export interface ProductionTeamRecord {
  code: string;
  name: string;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface SaveProductionTeamInput {
  code: string;
  name: string;
  note: string;
  isActive: boolean;
  version?: number;
}

export const productionTeamsApi = createCatalogApi<ProductionTeamRecord, SaveProductionTeamInput>({
  url: '/api/production/teams', fileName: 'DanhMucToSanXuat'
});

export interface ProductionOperationRecord {
  code: string;
  name: string;
  /** The second name ("Tên 2"). */
  nameEn?: string | null;
  productionTeamCode?: string | null;
  productionTeamName?: string | null;
  /** The production report of the operation must name the machine. */
  requireMachine: boolean;
  /** Heavy work (nặng nhọc). */
  isHeavy: boolean;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface SaveProductionOperationInput {
  code: string;
  name: string;
  nameEn: string;
  productionTeamCode: string;
  requireMachine: boolean;
  isHeavy: boolean;
  note: string;
  isActive: boolean;
  version?: number;
}

export const productionOperationsApi = createCatalogApi<ProductionOperationRecord, SaveProductionOperationInput>({
  url: '/api/production/operations', fileName: 'DanhMucCongDoanSanXuat'
});

export interface ProductionProcessLineRecord {
  lineNo: number;
  operationCode: string;
  operationName?: string | null;
  teamCode?: string | null;
  teamName?: string | null;
}

export interface ProductionProcessRecord {
  code: string;
  name: string;
  nameEn?: string | null;
  /** yyyy-MM-dd */
  effectiveFrom: string;
  effectiveTo?: string | null;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
  /** Company units the process applies to; empty = every unit. */
  unitCodes: string[];
  lines: ProductionProcessLineRecord[];
}

export interface SaveProductionProcessInput {
  code: string;
  name: string;
  nameEn: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  note: string;
  isActive: boolean;
  /** Comma separated (the form of an Excel cell); '' = every unit. */
  unitCodes: string;
  /** Operation codes in order, comma separated. */
  operationCodes: string;
  version?: number;
}

export const productionProcessesApi = createCatalogApi<ProductionProcessRecord, SaveProductionProcessInput>({
  url: '/api/production/processes', fileName: 'DanhMucQuyTrinhSanXuat'
});
