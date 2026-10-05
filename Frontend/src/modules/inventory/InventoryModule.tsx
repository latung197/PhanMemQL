import React from 'react';
import { SubMenuKey, Product, Warehouse, GoodsVoucher, MaterialType, UnitOfMeasure, StockNorm, MaterialLot, StorageLocation, UserProfile, CompanyUnit } from '../../types';
import { MaterialCategoryView } from './categories/materials';
import { CompanyUnitCategoryView } from './categories/company-units/CompanyUnitCategoryView';
import { WarehouseCategoryView } from './categories/warehouses';
import { WarehouseTypeCategoryView } from './categories/warehouse-types';
import { SupplierCategoryView } from './categories/suppliers';
import { MaterialTypeCategoryView } from './categories/material-types';
import { MaterialGroupCategoryView } from './categories/material-groups';
import { UomCategoryView } from './categories/uom';
import { UomConversionCategoryView } from './categories/uom-conversions';
import { StockNormCategoryView } from './categories/stock-norms';
import { LotCategoryView } from './categories/lots';
import { LocationCategoryView } from './categories/locations';
import { GoodsReceiptView } from './documents/goods-receipts';
import { GoodsIssueView } from './documents/goods-issues';
import { StockReportView, NXTReportView } from './reports';
import { TransferOrderView } from './documents/transfer-order/TransferOrderView';
import { TransferIssueView } from './documents/transfer-issue/TransferIssueView';
import { TransferReceiptView } from './documents/transfer-receipt/TransferReceiptView';
import { StockAuditView } from './documents/audits/StockAuditView';
import { MonthlyCostCalcView } from './documents/monthly-cost/MonthlyCostCalcView';
import { InstantStockCalcView } from './documents/instant-stock/InstantStockCalcView';
import { ReceiptApprovalView } from './documents/approval-receipt/ReceiptApprovalView';
import { IssueApprovalView } from './documents/approval-issue/IssueApprovalView';
import { TransferApprovalView } from './documents/approval-transfer/TransferApprovalView';
import { InwardReportView } from './reports/inward/InwardReportView';
import { OutwardReportView } from './reports/outward/OutwardReportView';
import { InventoryAgingReportView } from './reports/aging/InventoryAgingReportView';

interface InventoryModuleProps {
  subKey: SubMenuKey;
  onSelectSubKey: (key: SubMenuKey) => void;
  products: Product[];
  warehouses: Warehouse[];
  vouchers: GoodsVoucher[];
  companyUnits?: CompanyUnit[];
  activeCompanyUnitCode?: string;
  materialTypes?: MaterialType[];
  unitsOfMeasure?: UnitOfMeasure[];
  stockNorms?: StockNorm[];
  lots?: MaterialLot[];
  storageLocations?: StorageLocation[];
  onAddProduct: (prod: Omit<Product, 'id'>) => void;
  onUpdateProduct?: (id: string, prod: Partial<Product>) => void;
  onDeleteProduct?: (id: string) => void;
  onAdjustStock: (id: string, qty: number) => void;
  onAddVoucher: (voucher: GoodsVoucher) => void;
  onAddCompanyUnit?: (unit: Omit<CompanyUnit, 'id'>) => Promise<boolean>;
  onUpdateCompanyUnit?: (id: string, unit: Partial<CompanyUnit>) => Promise<boolean>;
  onDeleteCompanyUnit?: (id: string) => Promise<boolean>;
  onCompanyUnitsChanged?: () => void | Promise<void>;
  currentUser?: UserProfile;
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({
  subKey,
  onSelectSubKey,
  products,
  warehouses,
  vouchers,
  companyUnits = [],
  activeCompanyUnitCode = 'DVCS01',
  materialTypes = [],
  unitsOfMeasure = [],
  stockNorms = [],
  lots = [],
  storageLocations = [],
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAdjustStock,
  onAddVoucher,
  onCompanyUnitsChanged,
  currentUser
}) => {

  const renderActiveView = () => {
    switch (subKey) {
      // 1. Cập nhật số liệu
      case 'inv_receipt':
        return (
          <GoodsReceiptView
            products={products}
            companyUnits={companyUnits}
            activeUnitCode={activeCompanyUnitCode}
            currentUser={currentUser}
          />
        );
      case 'inv_issue':
        return (
          <GoodsIssueView
            vouchers={vouchers}
            products={products}
            warehouses={warehouses}
            companyUnits={companyUnits}
            onAddVoucher={onAddVoucher}
            currentUser={currentUser}
          />
        );
      case 'inv_transfer_order':
        return <TransferOrderView products={products} warehouses={warehouses} />;
      case 'inv_transfer_issue':
        return <TransferIssueView products={products} warehouses={warehouses} />;
      case 'inv_transfer_receipt':
        return <TransferReceiptView products={products} warehouses={warehouses} />;
      case 'inv_audit_count':
        return <StockAuditView />;
      case 'inv_calc_monthly_cost':
        return <MonthlyCostCalcView />;
      case 'inv_calc_instant_stock':
        return <InstantStockCalcView />;

      // 2. Phê duyệt
      case 'inv_approve_receipt':
        return <ReceiptApprovalView currentUser={currentUser} />;
      case 'inv_approve_issue':
        return <IssueApprovalView currentUser={currentUser} />;
      case 'inv_approve_transfer':
        return <TransferApprovalView currentUser={currentUser} />;

      // 3. Danh mục
      case 'inv_company_unit_cat':
        return <CompanyUnitCategoryView currentUser={currentUser} onChanged={onCompanyUnitsChanged} />;
      case 'inv_warehouse_cat':
        return <WarehouseCategoryView currentUser={currentUser} />;
      case 'inv_warehouse_type_cat':
        return <WarehouseTypeCategoryView currentUser={currentUser} />;
      case 'inv_supplier_cat':
        return <SupplierCategoryView currentUser={currentUser} />;
      case 'inv_material_type_cat':
        return <MaterialTypeCategoryView materialTypes={materialTypes} currentUser={currentUser} />;
      case 'inv_material_group_cat':
        return <MaterialGroupCategoryView currentUser={currentUser} />;
      case 'inv_uom_cat':
        return <UomCategoryView currentUser={currentUser} />;
      case 'inv_uom_conversion_cat':
        return <UomConversionCategoryView products={products} currentUser={currentUser} />;
      case 'inv_stock_norm_cat':
        return <StockNormCategoryView stockNorms={stockNorms} products={products} warehouses={warehouses} currentUser={currentUser} />;
      case 'inv_lot_cat':
        return <LotCategoryView lots={lots} products={products} currentUser={currentUser} />;
      case 'inv_location_cat':
        return <LocationCategoryView storageLocations={storageLocations} warehouses={warehouses} currentUser={currentUser} />;

      // 4. Báo cáo hàng nhập
      case 'inv_report_inward':
        return <InwardReportView />;

      // 5. Báo cáo hàng xuất
      case 'inv_report_outward':
        return <OutwardReportView />;

      // 6. Báo cáo hàng tồn
      case 'inv_report_stock':
        return <StockReportView products={products} />;
      case 'inv_report_nxt':
        return <NXTReportView products={products} vouchers={vouchers} />;
      case 'inv_report_aging':
        return <InventoryAgingReportView />;

      case 'inv_material_cat':
      default:
        return (
          <MaterialCategoryView
            products={products}
            warehouses={warehouses}
            materialTypes={materialTypes}
            unitsOfMeasure={unitsOfMeasure}
            companyUnits={companyUnits}
            activeCompanyUnitCode={activeCompanyUnitCode}
            onAddProduct={onAddProduct}
            onUpdateProduct={onUpdateProduct}
            onDeleteProduct={onDeleteProduct}
            onAdjustStock={onAdjustStock}
            currentUser={currentUser}
          />
        );
    }
  };

  return (
    <div className="w-full min-w-0 flex-1 flex flex-col min-h-0 space-y-3">
      {renderActiveView()}
    </div>
  );
};
