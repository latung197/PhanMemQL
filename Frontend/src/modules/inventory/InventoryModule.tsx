import React from 'react';
import { SubMenuKey, Product, Warehouse, GoodsVoucher, MaterialType, UnitOfMeasure, UomConversion, StockNorm, MaterialLot, StorageLocation, UserProfile, CompanyUnit } from '../../types';
import { MaterialCategoryView } from './materials';
import { CompanyUnitCategoryView } from './company-units/CompanyUnitCategoryView';
import { WarehouseCategoryView } from './warehouses';
import { MaterialTypeCategoryView } from './material-types';
import { UomCategoryView } from './uom';
import { UomConversionCategoryView } from './uom-conversions';
import { StockNormCategoryView } from './stock-norms';
import { LotCategoryView } from './lots';
import { LocationCategoryView } from './locations';
import { GoodsReceiptView } from './goods-receipts';
import { GoodsIssueView } from './goods-issues';
import { StockReportView, NXTReportView } from './reports';
import { TransferVouchersView } from './transfers/TransferVouchersView';
import { StockAuditView } from './audits/StockAuditView';
import { MonthlyCostCalcView } from './costing/MonthlyCostCalcView';
import { InstantStockCalcView } from './costing/InstantStockCalcView';
import { InventoryApprovalView } from './approvals/InventoryApprovalView';
import { InwardReportView } from './reports/InwardReportView';
import { OutwardReportView } from './reports/OutwardReportView';
import { InventoryAgingReportView } from './reports/InventoryAgingReportView';

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
  uomConversions?: UomConversion[];
  stockNorms?: StockNorm[];
  lots?: MaterialLot[];
  storageLocations?: StorageLocation[];
  onAddProduct: (prod: Omit<Product, 'id'>) => void;
  onUpdateProduct?: (id: string, prod: Partial<Product>) => void;
  onDeleteProduct?: (id: string) => void;
  onAdjustStock: (id: string, qty: number) => void;
  onAddWarehouse: (wh: Warehouse) => void;
  onAddVoucher: (voucher: GoodsVoucher) => void;
  onAddCompanyUnit?: (unit: Omit<CompanyUnit, 'id'>) => Promise<boolean>;
  onUpdateCompanyUnit?: (id: string, unit: Partial<CompanyUnit>) => Promise<boolean>;
  onDeleteCompanyUnit?: (id: string) => Promise<boolean>;
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
  uomConversions = [],
  stockNorms = [],
  lots = [],
  storageLocations = [],
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAdjustStock,
  onAddWarehouse,
  onAddVoucher,
  onAddCompanyUnit,
  onUpdateCompanyUnit,
  onDeleteCompanyUnit,
  currentUser
}) => {

  const renderActiveView = () => {
    switch (subKey) {
      // 1. Cập nhật số liệu
      case 'inv_receipt':
        return (
          <GoodsReceiptView
            vouchers={vouchers}
            products={products}
            warehouses={warehouses}
            companyUnits={companyUnits}
            onAddVoucher={onAddVoucher}
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
        return <TransferVouchersView typeFilter="order" products={products} warehouses={warehouses} />;
      case 'inv_transfer_issue':
        return <TransferVouchersView typeFilter="issue" products={products} warehouses={warehouses} />;
      case 'inv_transfer_receipt':
        return <TransferVouchersView typeFilter="receipt" products={products} warehouses={warehouses} />;
      case 'inv_audit_count':
        return <StockAuditView />;
      case 'inv_calc_monthly_cost':
        return <MonthlyCostCalcView />;
      case 'inv_calc_instant_stock':
        return <InstantStockCalcView />;

      // 2. Phê duyệt
      case 'inv_approve_receipt':
        return <InventoryApprovalView typeFilter="receipt" currentUser={currentUser} />;
      case 'inv_approve_issue':
        return <InventoryApprovalView typeFilter="issue" currentUser={currentUser} />;
      case 'inv_approve_transfer':
        return <InventoryApprovalView typeFilter="transfer" currentUser={currentUser} />;

      // 3. Danh mục
      case 'inv_company_unit_cat':
        return (
          <CompanyUnitCategoryView
            companyUnits={companyUnits}
            onAddCompanyUnit={onAddCompanyUnit}
            onUpdateCompanyUnit={onUpdateCompanyUnit}
            onDeleteCompanyUnit={onDeleteCompanyUnit}
            currentUser={currentUser}
          />
        );
      case 'inv_warehouse_cat':
        return <WarehouseCategoryView warehouses={warehouses} onAddWarehouse={onAddWarehouse} currentUser={currentUser} />;
      case 'inv_material_type_cat':
        return <MaterialTypeCategoryView materialTypes={materialTypes} currentUser={currentUser} />;
      case 'inv_uom_cat':
        return <UomCategoryView currentUser={currentUser} />;
      case 'inv_uom_conversion_cat':
        return <UomConversionCategoryView conversions={uomConversions} products={products} unitsOfMeasure={unitsOfMeasure} currentUser={currentUser} />;
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
