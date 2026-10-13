import React from 'react';
import { SubMenuKey, UserProfile, CompanyUnit } from '../../types';
import { PurchaseRequestView } from './documents/purchase-requests';
import { PurchaseRequestApprovalView } from './documents/approval-purchase-request/PurchaseRequestApprovalView';

interface PurchasingModuleProps {
  subKey: SubMenuKey;
  companyUnits?: CompanyUnit[];
  activeCompanyUnitCode?: string;
  currentUser?: UserProfile;
}

/** Purchasing: purchase requests (done); purchase orders and their approval are the next steps. */
export const PurchasingModule: React.FC<PurchasingModuleProps> = ({ subKey, companyUnits, activeCompanyUnitCode, currentUser }) => {
  switch (subKey) {
    case 'pur_request':
      return <PurchaseRequestView companyUnits={companyUnits} activeUnitCode={activeCompanyUnitCode ?? ''} currentUser={currentUser} />;
    case 'pur_approve_request':
      return <PurchaseRequestApprovalView currentUser={currentUser} />;
    default:
      return (
        <div className="flex-1 flex items-center justify-center p-10 text-sm text-slate-500">
          Chức năng này đang được phát triển.
        </div>
      );
  }
};
