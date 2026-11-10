import React from 'react';
import { SubMenuKey, UserProfile } from '../../types';
import { ProductionOperationCategoryView } from './categories/ProductionOperationCategoryView';
import { ProductionProcessCategoryView } from './categories/ProductionProcessCategoryView';
import { ProductStructureView } from './product-structures/ProductStructureView';
import { ProductionTeamCategoryView } from './categories/ProductionTeamCategoryView';
// [tao-danh-muc] Import màn của danh mục mới: thêm ngay trên dòng này.

interface ProductionModuleProps {
  subKey: SubMenuKey;
  currentUser?: UserProfile;
}

/** Production: the catalogs of production operations, teams, processes and product structures (the production vouchers come later). */
export const ProductionModule: React.FC<ProductionModuleProps> = ({ subKey, currentUser }) => {
  switch (subKey) {
    // [tao-danh-muc] Màn của danh mục mới: thêm case 'mã chức năng': return <...View currentUser={currentUser} />; ngay trên dòng này.
    case 'prod_operation_cat':
      return <ProductionOperationCategoryView currentUser={currentUser} />;
    case 'prod_team_cat':
      return <ProductionTeamCategoryView currentUser={currentUser} />;
    case 'prod_process_cat':
      return <ProductionProcessCategoryView currentUser={currentUser} />;
    case 'prod_structure_cat':
      return <ProductStructureView currentUser={currentUser} />;
    default:
      return null;
  }
};
