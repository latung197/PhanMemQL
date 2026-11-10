import React from 'react';
import { SubMenuKey, UserProfile, CompanyUnit } from '../../types';
import { PurchaseRequestView } from './documents/purchase-requests';
import { PurchaseOrderView } from './documents/purchase-orders';
import { PurchaseInvoiceView } from './documents/purchase-invoices';
import { PurchaseInvoiceApprovalView } from './documents/approval-purchase-invoice/PurchaseInvoiceApprovalView';
import { PurchaseOrderApprovalView } from './documents/approval-purchase-order/PurchaseOrderApprovalView';
import { ProjectCostReportView } from './reports/ProjectCostReportView';
import { PayableReportView } from './reports/PayableReportView';
import { ProjectCategoryView } from './categories/ProjectCategoryView';
import { PaymentTermCategoryView, SupplierGroupCategoryView } from './categories/SimpleCategoryViews';
import { PurchaseRequestApprovalView } from './documents/approval-purchase-request/PurchaseRequestApprovalView';
import { SupplierEvaluationView } from './documents/supplier-evaluations/SupplierEvaluationView';
// [tao-danh-muc] Import màn của danh mục mới: thêm ngay trên dòng này.

interface PurchasingModuleProps {
  subKey: SubMenuKey;
  companyUnits?: CompanyUnit[];
  activeCompanyUnitCode?: string;
  currentUser?: UserProfile;
}

/** Purchasing: purchase requests, purchase orders, purchase invoices (and their approvals) and the purchasing catalogs. */
export const PurchasingModule: React.FC<PurchasingModuleProps> = ({ subKey, companyUnits, activeCompanyUnitCode, currentUser }) => {
  switch (subKey) {
    case 'pur_supplier_eval':
      return <SupplierEvaluationView currentUser={currentUser} />;
    // [tao-danh-muc] Màn của danh mục mới: thêm case 'mã chức năng': return <...View currentUser={currentUser} />; ngay trên dòng này.
    case 'pur_request':
      return <PurchaseRequestView companyUnits={companyUnits} activeUnitCode={activeCompanyUnitCode ?? ''} currentUser={currentUser} />;
    case 'pur_approve_request':
      return <PurchaseRequestApprovalView currentUser={currentUser} />;
    case 'pur_order':
      return <PurchaseOrderView companyUnits={companyUnits} activeUnitCode={activeCompanyUnitCode ?? ''} currentUser={currentUser} />;
    case 'pur_approve_order':
      return <PurchaseOrderApprovalView currentUser={currentUser} />;
    case 'pur_invoice':
      return <PurchaseInvoiceView companyUnits={companyUnits} activeUnitCode={activeCompanyUnitCode ?? ''} currentUser={currentUser} />;
    case 'pur_approve_invoice':
      return <PurchaseInvoiceApprovalView currentUser={currentUser} />;
    case 'pur_report_payable':
      return <PayableReportView currentUser={currentUser} />;
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
