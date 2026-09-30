import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Toaster } from 'sonner';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { useAppRouter } from './hooks/useAppRouter';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { NavigationHistoryBar } from './components/layout/NavigationHistoryBar';
import { getSubMenuMeta, NavHistoryItem } from './utils/navigationHelper';
import { LoginView } from './modules/auth/LoginView';
import { OverviewModule } from './modules/overview/OverviewModule';
import { InventoryModule } from './modules/inventory/InventoryModule';
import { SalesModule } from './modules/sales/SalesModule';
import { FinanceModule } from './modules/finance/FinanceModule';
import { HRModule } from './modules/hr/HRModule';
import { ReportsModule } from './modules/reports/ReportsModule';
import { AIConsultantView } from './modules/ai/AIConsultantView';
import { SettingsModule } from './modules/settings/SettingsModule';
import { initialERPData, getInitialERPData } from './mock/initialERPData';
import { showToast } from './utils/toast';
import { canView } from './utils/permissions';
import { authService } from './services/authService';
import { companyUnitsApi } from './services/settingsApi';
import { notificationService } from './services/notificationService';
import { startNotificationStream } from './services/notificationStream';
import { requestOpenDocument } from './utils/documentLinks';
import { systemSettingsService } from './services/systemSettingsService';
import { getErrorMessage, UNAUTHORIZED_EVENT } from './services/apiClient';
import { 
  ERPData, 
  UserProfile, 
  ModuleCategoryKey, 
  SubMenuKey, 
  Product, 
  Warehouse, 
  GoodsVoucher, 
  Customer, 
  Order, 
  FinancialTransaction, 
  Employee,
  CompanyUnit,
  SystemNotification
} from './types';
import { Lock, ShieldAlert, ArrowLeft, KeyRound } from 'lucide-react';
import { Button } from './components/common/Button';
import { ConfirmProvider } from './components/common/ConfirmDialog';
import { NumberFormatProvider, useNumberFormat } from './context/NumberFormatContext';

// The realtime stream delivers new notifications at once; polling is only the fallback.
const NOTIFICATION_POLL_MS = 180_000;

// Business data of the other modules is still demo data kept in the browser.
// Accounts, permissions, company units, settings and notifications come from the backend.
const loadDemoData = (): ERPData => {
  try {
    const saved = localStorage.getItem('s_erp_database_state');
    if (saved) {
      const { users: _legacyUsers, ...parsed } = JSON.parse(saved);
      return parsed;
    }
  } catch {
    // Fall back to the seed data.
  }
  const { users: _seedUsers, ...seed } = initialERPData;
  return seed;
};

const ERPAppContent: React.FC = () => {
  const [erpData, setErpData] = useState<ERPData>(loadDemoData);
  const { applyConfig: applyNumberFormat } = useNumberFormat();

  // Signed-in user from the backend; null shows the login screen.
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(authService.hasSession);
  const [companyUnits, setCompanyUnits] = useState<CompanyUnit[]>([]);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);

  // Navigation State
  const [activeCategory, setActiveCategory] = useState<ModuleCategoryKey>('overview');
  const [activeSubMenu, setActiveSubMenu] = useState<SubMenuKey>('overview_main');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Synchronize router hash
  const { navigateTo } = useAppRouter(activeCategory, activeSubMenu, (cat, subKey) => {
    setActiveCategory(cat);
    setActiveSubMenu(subKey);
  });
  /** Opens a function's screen; the module comes from the function registry. */
  const openFunction = (subKey: SubMenuKey) => navigateTo(getSubMenuMeta(subKey).category, subKey);

  // Recent Navigation History Steps
  const [navHistory, setNavHistory] = useState<NavHistoryItem[]>(() => {
    const meta = getSubMenuMeta('overview_main');
    return [{
      category: 'overview',
      subKey: 'overview_main',
      label: meta.label,
      moduleName: meta.moduleName,
      timestamp: Date.now()
    }];
  });

  // Track visited steps automatically
  useEffect(() => {
    const meta = getSubMenuMeta(activeSubMenu);
    const newItem: NavHistoryItem = {
      category: activeCategory,
      subKey: activeSubMenu,
      label: meta.label,
      moduleName: meta.moduleName,
      timestamp: Date.now()
    };

    setNavHistory(prev => {
      const filtered = prev.filter(item => item.subKey !== activeSubMenu);
      return [newItem, ...filtered].slice(0, 3);
    });
  }, [activeCategory, activeSubMenu]);

  const handleSelectHistoryStep = (cat: ModuleCategoryKey, subKey: SubMenuKey) => {
    navigateTo(cat, subKey);
  };

  const handleRemoveHistoryStep = (subKey: SubMenuKey, e: React.MouseEvent) => {
    e.stopPropagation();
    setNavHistory(prev => {
      const remaining = prev.filter(item => item.subKey !== subKey);
      if (remaining.length === 0) {
        const meta = getSubMenuMeta('overview_main');
        return [{
          category: 'overview',
          subKey: 'overview_main',
          label: meta.label,
          moduleName: meta.moduleName,
          timestamp: Date.now()
        }];
      }
      return remaining;
    });
  };

  const handleClearHistory = () => {
    const meta = getSubMenuMeta(activeSubMenu);
    setNavHistory([{
      category: activeCategory,
      subKey: activeSubMenu,
      label: meta.label,
      moduleName: meta.moduleName,
      timestamp: Date.now()
    }]);
  };

  useEffect(() => {
    localStorage.setItem('s_erp_database_state', JSON.stringify(erpData));
  }, [erpData]);

  // The working company unit is part of the token (user.ma_dvcs = unit of the session).
  const activeCompanyUnitCode = currentUser?.ma_dvcs || '';

  // Ids already shown to the user, so a poll only pops up what is really new (null = first load).
  const seenNotificationIds = useRef<Set<string> | null>(null);
  const popupsEnabled = useRef(true);
  popupsEnabled.current = currentUser?.notificationsEnabled !== false;

  const refreshNotifications = useCallback(async () => {
    try {
      const inbox = await notificationService.getInbox();
      const seen = seenNotificationIds.current;
      const fresh = seen ? inbox.filter(n => !n.read && !seen.has(n.id)) : [];
      seenNotificationIds.current = new Set([...(seen ?? []), ...inbox.map(n => n.id)]);
      setNotifications(inbox);
      if (fresh.length > 0 && popupsEnabled.current) {
        const [first] = fresh;
        const show = first.type === 'danger' ? showToast.error : first.type === 'warning' ? showToast.warning
          : first.type === 'success' ? showToast.success : showToast.info;
        if (fresh.length === 1) show(first.title, first.message);
        else showToast.info(`Bạn có ${fresh.length} thông báo mới`, first.title);
      }
    } catch {
      // The bell keeps the last list; the next poll retries.
    }
  }, []);

  const refreshCompanyUnits = useCallback(async () => {
    try {
      setCompanyUnits(await companyUnitsApi.getAll());
    } catch (error) {
      showToast.error(getErrorMessage(error));
    }
  }, []);

  /** Loads everything that depends on the session (and on its company unit). */
  const startSession = useCallback(async (user: UserProfile) => {
    setCurrentUser(user);
    try {
      await systemSettingsService.load();
    } catch (error) {
      showToast.warning('Không tải được cài đặt hệ thống, đang dùng giá trị mặc định.', getErrorMessage(error));
    }
    applyNumberFormat(systemSettingsService.getNumberFormat());
    await Promise.all([refreshCompanyUnits(), refreshNotifications()]);
  }, [refreshCompanyUnits, refreshNotifications, applyNumberFormat]);

  const handleLogout = useCallback(() => {
    authService.logout();
    systemSettingsService.clear();
    setCurrentUser(null);
    setNotifications([]);
    seenNotificationIds.current = null;
    setCompanyUnits([]);
  }, []);

  // Restore the session of a previous visit.
  useEffect(() => {
    localStorage.removeItem('s_erp_user_profile'); // profile cache of the old demo login
    if (!authService.hasSession()) return;
    authService.getMe()
      .then(startSession)
      .catch(() => handleLogout())
      .finally(() => setIsRestoringSession(false));
  }, [startSession, handleLogout]);

  // Any request rejected with 401 (expired token, locked account, changed password) signs out.
  useEffect(() => {
    const onUnauthorized = () => {
      handleLogout();
      showToast.warning('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, [handleLogout]);

  const signedIn = !!currentUser;
  // Realtime: the stream says "something changed", the inbox is then reloaded. Reopened per company
  // unit, because the token (and so what the user may see) changes with it.
  useEffect(() => {
    if (!signedIn) return;
    return startNotificationStream(() => void refreshNotifications());
  }, [signedIn, activeCompanyUnitCode, refreshNotifications]);

  // Poll while the tab is visible, and check at once when the user comes back to it.
  useEffect(() => {
    if (!signedIn) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshNotifications();
    }, NOTIFICATION_POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void refreshNotifications(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [signedIn, refreshNotifications]);

  const handleLoginSuccess = (user: UserProfile) => {
    // Keep the screen of the address bar (e.g. a shared link) when the user may open it.
    if (!canView(user, activeSubMenu)) openFunction('overview_main');
    void startSession(user);
  };

  const handleSelectCompanyUnit = async (unitCode: string) => {
    if (!currentUser || unitCode === activeCompanyUnitCode) return;
    try {
      const user = await authService.switchUnit(unitCode);
      await startSession(user);
      showToast.success(`Đã chuyển sang đơn vị cơ sở ${unitCode}`);
    } catch (error) {
      showToast.error(getErrorMessage(error));
    }
  };

  // ERP State Mutators
  const handleAddProduct = (prod: Omit<Product, 'id'>) => {
    const newP: Product = {
      ...prod,
      id: `PRD${String((erpData.products || []).length + 1).padStart(3, '0')}`
    };
    setErpData(prev => ({
      ...prev,
      products: [newP, ...(prev.products || [])]
    }));
  };

  const handleUpdateProduct = (id: string, updatedFields: Partial<Product>) => {
    setErpData(prev => ({
      ...prev,
      products: (prev.products || []).map(p => p.id === id ? { ...p, ...updatedFields } : p)
    }));
  };

  const handleDeleteProduct = (id: string) => {
    setErpData(prev => ({
      ...prev,
      products: (prev.products || []).filter(p => p.id !== id)
    }));
  };

  // Company units are saved by the backend; each handler resolves to true on success.
  const runUnitChange = async (change: Promise<unknown>): Promise<boolean> => {
    try {
      await change;
      await refreshCompanyUnits();
      return true;
    } catch (error) {
      showToast.error(getErrorMessage(error));
      return false;
    }
  };

  const handleAddCompanyUnit = (unit: Omit<CompanyUnit, 'id'>) => runUnitChange(companyUnitsApi.create(unit));

  const handleUpdateCompanyUnit = (id: string, updated: Partial<CompanyUnit>) => {
    const current = companyUnits.find(u => u.id === id);
    if (!current) return Promise.resolve(false);
    const { id: _id, ...fields } = { ...current, ...updated };
    return runUnitChange(companyUnitsApi.update(current.code, fields));
  };

  const handleDeleteCompanyUnit = (id: string) => {
    const current = companyUnits.find(u => u.id === id);
    return current ? runUnitChange(companyUnitsApi.remove(current.code)) : Promise.resolve(false);
  };

  const handleAdjustStock = (id: string, newQty: number) => {
    setErpData(prev => ({
      ...prev,
      products: prev.products.map(p => p.id === id ? { ...p, quantity: newQty } : p)
    }));
  };

  const handleAddWarehouse = (wh: Warehouse) => {
    setErpData(prev => ({
      ...prev,
      warehouses: [...prev.warehouses, wh]
    }));
  };

  const handleAddGoodsVoucher = (voucher: GoodsVoucher) => {
    setErpData(prev => {
      // Auto adjust stock for items in voucher
      const updatedProducts = [...prev.products];
      voucher.items.forEach(item => {
        const prodIndex = updatedProducts.findIndex(p => p.name === item.productName);
        if (prodIndex !== -1) {
          const delta = voucher.type === 'Nhập kho' ? item.quantity : -item.quantity;
          updatedProducts[prodIndex] = {
            ...updatedProducts[prodIndex],
            quantity: Math.max(0, updatedProducts[prodIndex].quantity + delta)
          };
        }
      });

      return {
        ...prev,
        products: updatedProducts,
        vouchers: [voucher, ...prev.vouchers]
      };
    });
  };

  const handleAddCustomer = (cust: Customer) => {
    setErpData(prev => ({
      ...prev,
      customers: [...prev.customers, cust]
    }));
  };

  const handleAddOrder = (ord: Order) => {
    setErpData(prev => ({
      ...prev,
      orders: [ord, ...prev.orders]
    }));
  };

  const handleUpdateOrderStatus = (orderId: string, status: Order['status']) => {
    setErpData(prev => ({
      ...prev,
      orders: prev.orders.map(o => o.id === orderId ? { ...o, status } : o)
    }));
  };

  const handleAddTransaction = (tx: FinancialTransaction) => {
    setErpData(prev => ({
      ...prev,
      transactions: [tx, ...prev.transactions]
    }));
  };

  const handleAddEmployee = (emp: Employee) => {
    setErpData(prev => ({
      ...prev,
      employees: [...prev.employees, emp]
    }));
  };

  const handleMarkNotificationRead = async (id: string) => {
    if (notifications.find(n => n.id === id)?.read) return;
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      await notificationService.markRead(id);
    } catch (error) {
      showToast.error(getErrorMessage(error));
      void refreshNotifications();
    }
  };

  const openModule = (mod: string) => {
    const firstScreen: Partial<Record<ModuleCategoryKey, SubMenuKey>> = {
      overview: 'overview_main', inventory: 'inv_material_cat', sales: 'sales_orders', finance: 'fin_report',
      hr: 'hr_list', reports: 'reports_main', settings: 'settings_main'
    };
    const subKey = firstScreen[mod as ModuleCategoryKey];
    if (subKey) navigateTo(mod as ModuleCategoryKey, subKey);
  };

  /** A notification linked to a document opens that document; otherwise its module. */
  const handleOpenNotification = (notification: SystemNotification) => {
    const fn = notification.linkFunction;
    if (fn) {
      if (!canView(currentUser, fn)) {
        showToast.warning('Bạn không có quyền xem chức năng này.');
        return;
      }
      openFunction(fn);
      if (notification.linkDocumentId) requestOpenDocument(fn, notification.linkDocumentId);
      return;
    }
    if (notification.linkModule) openModule(notification.linkModule);
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    try {
      await notificationService.markAllRead();
    } catch (error) {
      showToast.error(getErrorMessage(error));
      void refreshNotifications();
    }
  };

  const handleDismissNotification = async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    try {
      await notificationService.dismiss(id);
    } catch (error) {
      showToast.error(getErrorMessage(error));
      void refreshNotifications();
    }
  };

  const handleClearNotifications = async () => {
    try {
      await notificationService.dismissAll();
      setNotifications([]);
    } catch (error) {
      showToast.error(getErrorMessage(error));
    }
  };

  const handleResetData = () => {
    const { users: _seedUsers, ...freshData } = getInitialERPData();
    setErpData(freshData);
    localStorage.removeItem('s_erp_database_state');
    showToast.success('Đã khởi tạo & tái tạo lại toàn bộ dữ liệu mẫu ERP thành công!');
  };

  if (isRestoringSession) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-background text-xs text-slate-500">
        <span className="inline-block animate-spin h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full mr-3"></span>
        Đang khôi phục phiên đăng nhập...
      </div>
    );
  }

  // If not logged in -> render Login Screen
  if (!currentUser) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  // Check access permission for activeSubMenu
  const isAccessAllowed = canView(currentUser, activeSubMenu);

  // Other modules read company units from erpData; the list comes from the backend.
  const erpDataView: ERPData = { ...erpData, companyUnits };

  // Calculate badges
  const lowStockCount = erpData.products.filter(p => p.quantity <= p.minThreshold).length;
  const pendingOrderCount = erpData.orders.filter(o => o.status === 'Chờ xử lý' || o.status === 'Đang giao').length;

  // Title translation map
  const getSubTitleText = (): { title: string; subtitle: string } => {
    switch (activeCategory) {
      case 'inventory':
        return { title: 'Phân Hệ Quản Lý Kho Hàng', subtitle: 'Danh mục vật tư, Quản lý kho, Phiếu Nhập - Xuất và Báo cáo NXT' };
      case 'sales':
        return { title: 'Phân Hệ Bán Hàng & CRM', subtitle: 'Khách hàng, Hóa đơn đơn hàng, Vận chuyển và Báo cáo Doanh số' };
      case 'finance':
        return { title: 'Phân Hệ Kế Toán & Tài Chính', subtitle: 'Danh mục quỹ, Chứng từ Phiếu Thu/Chi và Báo cáo Sổ quỹ P&L' };
      case 'hr':
        return { title: 'Phân Hệ Quản Lý Nhân Sự & Lương', subtitle: 'Danh sách cán bộ nhân sự, Bảng chấm công quỹ lương và Báo cáo biến động' };
      case 'reports':
        return { title: 'Trung Tâm Báo Cáo Doanh Nghiệp', subtitle: 'Tổng hợp số liệu xuất tồn, doanh số và cân đối tài chính' };
      case 'ai':
        return { title: 'Trợ Lý AI Gemini Consultant 3.5 Flash', subtitle: 'Cố vấn kiểm toán tự động 24/7' };
      case 'settings':
        return { title: 'Cài Đặt Hệ Thống & Quản Lý Phân Quyền User', subtitle: 'Phân quyền từng chức năng cho từng nhân viên & cấu hình doanh nghiệp' };
      case 'overview':
      default:
        return { title: 'Bàn Điều Hành ERP Doanh Nghiệp', subtitle: 'Trực quan hóa toàn bộ chỉ số vận hành real-time' };
    }
  };

  const pageHeaders = getSubTitleText();

  return (
    <div className="flex h-dvh w-full min-w-0 bg-background text-slate-800 dark:text-slate-100 overflow-hidden font-sans transition-colors">
      
      {/* Multi-level Collapsible Sidebar */}
      <Sidebar
        activeCategory={activeCategory}
        activeSubMenu={activeSubMenu}
        currentUser={currentUser}
        onSelectSubMenu={(cat, subKey) => {
          navigateTo(cat, subKey);
        }}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        lowStockCount={lowStockCount}
        pendingOrderCount={pendingOrderCount}
      />

      {/* Main Workspace Area */}
      <div className="flex flex-col grow min-w-0 overflow-hidden">
        
        {/* Global Header */}
        <Header
          user={currentUser}
          activeTitle={pageHeaders.title}
          activeSubtitle={pageHeaders.subtitle}
          notifications={notifications}
          companyUnits={companyUnits.filter(u => u.status === 'Hoạt động'
            && (currentUser.isSystemAdmin || currentUser.ds_ma_dvcs?.includes(u.code)))}
          activeCompanyUnitCode={activeCompanyUnitCode}
          onSelectCompanyUnit={handleSelectCompanyUnit}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onDismissNotification={handleDismissNotification}
          onClearNotifications={handleClearNotifications}
          onOpenNotification={handleOpenNotification}
          onNavigateToModule={openModule}
          onResetData={currentUser.isSystemAdmin ? handleResetData : undefined}
          onLogout={handleLogout}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
          onNotificationPublished={refreshNotifications}
          onUserUpdated={setCurrentUser}
        />

        {/* Fixed Top Navigation History & Position Bar */}
        <NavigationHistoryBar
          history={navHistory}
          activeCategory={activeCategory}
          activeSubMenu={activeSubMenu}
          onSelectStep={handleSelectHistoryStep}
          onRemoveStep={handleRemoveHistoryStep}
          onClearHistory={handleClearHistory}
        />

        {/* Dynamic Module Workspace */}
        <main className="grow flex flex-col min-h-0 min-w-0 overflow-y-auto overflow-x-hidden md:overflow-hidden p-3 sm:p-4 custom-scrollbar">
          <div className="w-full min-w-0 max-w-[1920px] mx-auto space-y-3 animate-fade-in flex-1 flex flex-col min-h-0">
            
            {/* Guard Access Control Screen */}
            {!isAccessAllowed ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 sm:p-12 text-center max-w-2xl mx-auto shadow-xl space-y-5 my-12">
                <div className="inline-flex p-4 bg-rose-100 dark:bg-rose-950/60 text-rose-600 rounded-2xl">
                  <Lock className="h-12 w-12" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-extrabold text-slate-900 dark:text-slate-100">
                    Truy Cập Bị Khóa Do Phân Quyền Nâng Cao
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
                    Tài khoản hiện tại <strong className="text-indigo-600 dark:text-indigo-400">@{currentUser.username}</strong> ({currentUser.fullName} - {currentUser.role}) chưa được cấp quyền truy cập vào chức năng <span className="font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-rose-600 font-bold">[{activeSubMenu}]</span>.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl text-left border border-slate-150 dark:border-slate-700 text-xs space-y-2">
                  <p className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-amber-500" />
                    Hướng dẫn xử lý mở khóa:
                  </p>
                  <ul className="list-disc list-inside text-slate-500 space-y-1 pl-1 text-[11px]">
                    <li>Liên hệ quản trị viên để được cấp quyền chức năng này cho tài khoản <strong>@{currentUser.username}</strong>.</li>
                    <li>Quản trị viên cấp quyền trong mục <strong>Cài đặt › Phân Quyền & User</strong>; bạn chỉ cần tải lại trang.</li>
                  </ul>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    icon={<ArrowLeft className="h-4 w-4" />}
                    onClick={() => openFunction('overview_main')}
                  >
                    Về Bàn Điều Hành
                  </Button>
                  <Button
                    icon={<KeyRound className="h-4 w-4" />}
                    onClick={handleLogout}
                  >
                    Đăng Nhập Tài Khoản Khác
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {activeCategory === 'overview' && (
                  <OverviewModule
                    erpData={erpDataView}
                    activeCompanyUnitCode={activeCompanyUnitCode}
                    onSelectCompanyUnit={handleSelectCompanyUnit}
                    onNavigate={navigateTo}
                  />
                )}

                {activeCategory === 'inventory' && (
                  <InventoryModule
                    subKey={activeSubMenu}
                    currentUser={currentUser}
                    onSelectSubKey={openFunction}
                    products={erpData.products}
                    warehouses={erpData.warehouses}
                    vouchers={erpData.vouchers}
                    companyUnits={companyUnits}
                    activeCompanyUnitCode={activeCompanyUnitCode}
                    materialTypes={erpData.materialTypes}
                    unitsOfMeasure={erpData.unitsOfMeasure}
                    uomConversions={erpData.uomConversions}
                    stockNorms={erpData.stockNorms}
                    lots={erpData.lots}
                    storageLocations={erpData.storageLocations}
                    onAddProduct={handleAddProduct}
                    onUpdateProduct={handleUpdateProduct}
                    onDeleteProduct={handleDeleteProduct}
                    onAdjustStock={handleAdjustStock}
                    onAddWarehouse={handleAddWarehouse}
                    onAddVoucher={handleAddGoodsVoucher}
                    onAddCompanyUnit={handleAddCompanyUnit}
                    onUpdateCompanyUnit={handleUpdateCompanyUnit}
                    onDeleteCompanyUnit={handleDeleteCompanyUnit}
                  />
                )}

                {activeCategory === 'sales' && (
                  <SalesModule
                    subKey={activeSubMenu}
                    currentUser={currentUser}
                    onSelectSubKey={openFunction}
                    customers={erpData.customers}
                    orders={erpData.orders}
                    products={erpData.products}
                    onAddCustomer={handleAddCustomer}
                    onAddOrder={handleAddOrder}
                    onUpdateOrderStatus={handleUpdateOrderStatus}
                  />
                )}

                {activeCategory === 'finance' && (
                  <FinanceModule
                    subKey={activeSubMenu}
                    currentUser={currentUser}
                    onSelectSubKey={openFunction}
                    transactions={erpData.transactions}
                    onAddTransaction={handleAddTransaction}
                  />
                )}

                {activeCategory === 'hr' && (
                  <HRModule
                    subKey={activeSubMenu}
                    currentUser={currentUser}
                    onSelectSubKey={openFunction}
                    employees={erpData.employees}
                    onAddEmployee={handleAddEmployee}
                  />
                )}

                {activeCategory === 'reports' && (
                  <ReportsModule erpData={erpDataView} />
                )}

                {activeCategory === 'ai' && (
                  <AIConsultantView erpData={erpDataView} />
                )}

                {activeCategory === 'settings' && (
                  <SettingsModule
                    subKey={activeSubMenu}
                    user={currentUser}
                    companyUnits={companyUnits}
                    warehouses={erpData.warehouses}
                    onSelectSubKey={openFunction}
                    onAddCompanyUnit={handleAddCompanyUnit}
                    onUpdateCompanyUnit={handleUpdateCompanyUnit}
                    onDeleteCompanyUnit={handleDeleteCompanyUnit}
                    onResetData={handleResetData}
                  />
                )}
              </>
            )}

          </div>
        </main>

      </div>

    </div>
  );
};



export function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <NumberFormatProvider>
          <Toaster position="top-right" richColors closeButton />
          <ConfirmProvider>
            <ERPAppContent />
          </ConfirmProvider>
        </NumberFormatProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
