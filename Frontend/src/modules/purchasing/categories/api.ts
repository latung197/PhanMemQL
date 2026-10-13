// Purchasing catalogs (backend: /api/purchasing/projects, payment-terms, supplier-groups). Every list is paged on the server.
import { createCatalogApi } from '../../../components/catalog/createCatalogApi';
import type { RecordStamp } from '../../../components/common/RecordStamp';

export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ONHOLD' | 'DONE' | 'CANCELLED';

export interface ProjectRecord {
  code: string;
  name: string;
  departmentCode?: string | null;
  departmentName?: string | null;
  customerName?: string | null;
  managerName?: string | null;
  /** yyyy-MM-dd */
  startDate?: string | null;
  endDate?: string | null;
  /** Planned cost in the base currency. */
  budget: number;
  status: ProjectStatus;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface SaveProjectInput {
  code: string;
  name: string;
  departmentCode: string;
  customerName: string;
  managerName: string;
  startDate: string | null;
  endDate: string | null;
  budget: number;
  status: ProjectStatus;
  note: string;
  isActive: boolean;
  version?: number;
}

export const projectsApi = createCatalogApi<ProjectRecord, SaveProjectInput>({
  url: '/api/purchasing/projects', fileName: 'DanhMucDuAn'
});

export interface PaymentTermRecord {
  code: string;
  name: string;
  /** Days to pay after the invoice (0 = at once). */
  days: number;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface SavePaymentTermInput {
  code: string;
  name: string;
  days: number;
  note: string;
  isActive: boolean;
  version?: number;
}

export const paymentTermsApi = createCatalogApi<PaymentTermRecord, SavePaymentTermInput>({
  url: '/api/purchasing/payment-terms', fileName: 'DanhMucDieuKhoanThanhToan'
});

export interface SupplierGroupRecord {
  code: string;
  name: string;
  note?: string | null;
  isActive: boolean;
  stamp: RecordStamp;
  version: number;
}

export interface SaveSupplierGroupInput {
  code: string;
  name: string;
  note: string;
  isActive: boolean;
  version?: number;
}

export const supplierGroupsApi = createCatalogApi<SupplierGroupRecord, SaveSupplierGroupInput>({
  url: '/api/purchasing/supplier-groups', fileName: 'DanhMucNhomNhaCungCap'
});
