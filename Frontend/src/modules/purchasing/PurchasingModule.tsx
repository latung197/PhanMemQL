import React from 'react';
import { SubMenuKey, UserProfile, CompanyUnit } from '../../types';
import { PurchaseRequestView } from './documents/purchase-requests';
import { PurchaseOrderView } from './documents/purchase-orders';
import { PurchaseOrderApprovalView } from './documents/approval-purchase-order/PurchaseOrderApprovalView';
import { ProjectCostReportView } from './reports/ProjectCostReportView';
import { ProjectCategoryView } from './categories/ProjectCategoryView';
import { PaymentTermCategoryView, SupplierGroupCategoryView } from './categories/SimpleCategoryViews';
import { PurchaseRequestApprovalView } from './documents/approval-purchase-request/PurchaseRequestApprovalView';

interface PurchasingModuleProps {
  subKey: SubMenuKey;
  companyUnits?: CompanyUnit[];
  activeCompanyUnitCode?: string;
  currentUser?: UserProfile;
}

/** Purchasing: purchase requests, purchase orders (and their approvals) and the purchasing catalogs. */
export const PurchasingModule: React.FC<PurchasingModuleProps> = ({ subKey, companyUnits, activeCompanyUnitCode, currentUser }) => {
  switch (subKey) {
    case 'pur_request':
      return <PurchaseRequestView companyUnits={companyUnits} activeUnitCode={activeCompanyUnitCode ?? ''} currentUser={currentUser} />;
    case 'pur_approve_request':
      return <PurchaseRequestApprovalView currentUser={currentUser} />;
    case 'pur_order':
      return <PurchaseOrderView companyUnits={companyUnits} activeUnitCode={activeCompanyUnitCode ?? ''} currentUser={currentUser} />;
    case 'pur_approve_order':
      return <PurchaseOrderApprovalView currentUser={currentUser} />;
    case 'pur_report_project':
      return <ProjectCostReportView currentUser={currentUser} />;
    case 'pur_project_cat':
      return <ProjectCategoryView currentUser={currentUser} />;
    case 'pur_payment_term_cat':
      return <PaymentTermCategoryView currentUser={currentUser} />;
    case 'pur_supplier_group_cat':
      return <SupplierGroupCategoryView currentUser={currentUser} />;
    default:
      return (
        <div className="flex-1 flex items-center justify-center p-10 text-sm text-slate-500">
          Chức năng này đang được phát triển.
        </div>
      );
  }
};
