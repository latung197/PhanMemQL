// Shape of GET /api/dashboard (Core.Application/Modules/Dashboard/DashboardContracts.cs). A part the user may not view is null; money is null
// without its VIEW_COST right.
import type { SubMenuKey } from '../../types';

export type DashboardRange = 'week' | 'month' | 'quarter' | 'year';

export interface DashboardVoucherCount { function: SubMenuKey; draft: number; pending: number; approved: number; posted: number; cancelled: number }
export interface DashboardWarehouse { code: string; name: string; itemCount: number; value: number | null }
export interface DashboardLowStock { materialCode: string; materialName: string; uomCode: string; quantity: number; minStock: number }
export interface DashboardTrend { month: string; receiptCount: number; issueCount: number; receiptValue: number | null; issueValue: number | null }
export interface DashboardStock {
  itemCount: number; lowStockCount: number; totalValue: number | null;
  warehouses: DashboardWarehouse[]; lowStock: DashboardLowStock[]; trend: DashboardTrend[];
}
export interface DashboardProject {
  code: string; name: string; status: string; budget: number | null; issuedValue: number | null; usedPercent: number | null;
}
export interface DashboardProjects { activeCount: number; budget: number | null; spent: number | null; top: DashboardProject[] }
export interface DashboardPendingApproval { function: SubMenuKey; documentId: string; title?: string | null; amount?: number | null; level: number; requestedAt: string; requestedBy: { username: string; fullName: string } }
export interface DashboardTodo { pendingApprovalCount: number; pendingApprovals: DashboardPendingApproval[]; draftCount: number }
export interface DashboardActivity { time: string; actorName?: string | null; function: string; action: string; label?: string | null }

export interface Dashboard {
  unitCode: string; range: DashboardRange; from: string; to: string; generatedAt: string;
  vouchers: DashboardVoucherCount[]; stock: DashboardStock | null; projects: DashboardProjects | null;
  todo: DashboardTodo; activity: DashboardActivity[] | null;
}
