// Comprehensive API Service for S-ERP Frontend & C# Backend Integration
import { ERPData, Product, Warehouse, SalesOrder, Customer, GoodsVoucher, UserProfile, SubMenuKey, ActionPermissions, RoleDefinition } from '../types';
import { initialERPData } from '../mock/initialERPData';
import { initialRoles } from '../mock/initialRoles';

const STORAGE_KEY = 'serp_database_v2';
const ROLES_STORAGE_KEY = 'serp_roles_v2';

// Helper to simulate network latency
const simulateApiCall = <T>(data: T, delay = 150): Promise<T> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(data);
    }, delay);
  });
};

// Initialize or get stored database
const getStoredDB = (): ERPData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error reading ERP database from localStorage:', err);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(initialERPData));
  return initialERPData;
};

const saveDB = (db: ERPData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
};

// ---------------------------
// 1. AUTH & PERMISSIONS API
// ---------------------------
export const authApi = {
  getCurrentUser: async (userId?: string): Promise<UserProfile> => {
    const db = getStoredDB();
    const user = db.users.find(u => u.id === (userId || 'USR-001')) || db.users[0];
    return simulateApiCall(user);
  },

  getRoles: async (): Promise<RoleDefinition[]> => {
    try {
      const raw = localStorage.getItem(ROLES_STORAGE_KEY);
      if (raw) {
        return simulateApiCall(JSON.parse(raw));
      }
    } catch (e) {
      // ignore
    }
    localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(initialRoles));
    return simulateApiCall(initialRoles);
  },

  updateUserPermissions: async (userId: string, permissions: UserProfile['permissions']): Promise<UserProfile> => {
    const db = getStoredDB();
    const index = db.users.findIndex(u => u.id === userId);
    if (index !== -1) {
      db.users[index] = {
        ...db.users[index],
        permissions
      };
      saveDB(db);
      return simulateApiCall(db.users[index]);
    }
    throw new Error('User not found in database');
  },

  checkPermission: async (userId: string, subKey: SubMenuKey, action: keyof ActionPermissions): Promise<boolean> => {
    const user = await authApi.getCurrentUser(userId);
    if (user.isSystemAdmin) return true;
    
    if (user.permissions && user.permissions[subKey]) {
      const perm = user.permissions[subKey];
      if (typeof perm === 'boolean') return perm;
      return !!perm[action];
    }
    return true;
  }
};

// ---------------------------
// 2. INVENTORY & PRODUCTS API
// ---------------------------
export const inventoryApi = {
  getMaterials: async (params?: { multiCodes?: string[]; category?: string; search?: string }): Promise<Product[]> => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          let list: Product[] = json.data;
          if (params?.multiCodes && params.multiCodes.length > 0) {
            const codes = params.multiCodes.map(c => c.toLowerCase());
            list = list.filter(p => codes.includes(p.sku.toLowerCase()) || codes.some(c => p.name.toLowerCase().includes(c)));
          }
          if (params?.category && params.category !== 'all') {
            list = list.filter(p => p.category === params.category);
          }
          if (params?.search) {
            const q = params.search.toLowerCase();
            list = list.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
          }
          return list;
        }
      }
    } catch (e) {
      console.warn('Falling back to local DB for materials:', e);
    }

    const db = getStoredDB();
    let list = db.products || [];

    if (params?.multiCodes && params.multiCodes.length > 0) {
      const codes = params.multiCodes.map(c => c.toLowerCase());
      list = list.filter(p => 
        codes.includes(p.sku.toLowerCase()) || 
        codes.some(c => p.name.toLowerCase().includes(c) || p.id.toLowerCase() === c)
      );
    }

    if (params?.category && params.category !== 'all') {
      list = list.filter(p => p.category === params.category);
    }

    if (params?.search) {
      const q = params.search.toLowerCase();
      list = list.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.sku.toLowerCase().includes(q) || 
        p.warehouseName.toLowerCase().includes(q)
      );
    }

    return simulateApiCall(list);
  },

  saveMaterial: async (material: Partial<Product>): Promise<Product> => {
    const db = getStoredDB();
    let updated: Product;

    if (material.id) {
      const idx = db.products.findIndex(p => p.id === material.id);
      if (idx !== -1) {
        db.products[idx] = { ...db.products[idx], ...material } as Product;
        updated = db.products[idx];
      } else {
        updated = material as Product;
        db.products.push(updated);
      }
    } else {
      updated = {
        id: `PROD-${Date.now()}`,
        name: material.name || 'Vật tư mới',
        sku: material.sku || `VT-${Math.floor(1000 + Math.random() * 9000)}`,
        category: material.category || 'Vật tư chính',
        quantity: material.quantity || 0,
        price: material.price || 0,
        costPrice: material.costPrice || 0,
        unit: material.unit || 'Cái',
        warehouseId: material.warehouseId || 'WH-001',
        warehouseName: material.warehouseName || 'Kho Tổng HCMC',
        minThreshold: material.minThreshold || 10,
        position: material.position || 'Kệ A-1',
        ...material
      } as Product;
      db.products.unshift(updated);
    }

    saveDB(db);
    return simulateApiCall(updated);
  },

  deleteMaterial: async (id: string): Promise<boolean> => {
    const db = getStoredDB();
    db.products = db.products.filter(p => p.id !== id);
    saveDB(db);
    return simulateApiCall(true);
  },

  getWarehouses: async (multiCodes?: string[]): Promise<Warehouse[]> => {
    try {
      const res = await fetch('/api/warehouses');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          let list: Warehouse[] = json.data;
          if (multiCodes && multiCodes.length > 0) {
            const codes = multiCodes.map(c => c.toLowerCase());
            list = list.filter(w => codes.includes(w.code.toLowerCase()) || codes.some(c => w.name.toLowerCase().includes(c)));
          }
          return list;
        }
      }
    } catch (e) {
      console.warn('Falling back to local DB for warehouses:', e);
    }

    const db = getStoredDB();
    let list = db.warehouses || [];

    if (multiCodes && multiCodes.length > 0) {
      const codes = multiCodes.map(c => c.toLowerCase());
      list = list.filter(w => codes.includes(w.code.toLowerCase()) || codes.some(c => w.name.toLowerCase().includes(c)));
    }

    return simulateApiCall(list);
  },

  saveWarehouse: async (wh: Partial<Warehouse>): Promise<Warehouse> => {
    const db = getStoredDB();
    let updated: Warehouse;

    if (wh.id) {
      const idx = db.warehouses.findIndex(w => w.id === wh.id);
      if (idx !== -1) {
        db.warehouses[idx] = { ...db.warehouses[idx], ...wh } as Warehouse;
        updated = db.warehouses[idx];
      } else {
        updated = wh as Warehouse;
        db.warehouses.push(updated);
      }
    } else {
      updated = {
        id: `WH-${Date.now()}`,
        code: wh.code || `KHO-${Math.floor(100 + Math.random() * 900)}`,
        name: wh.name || 'Kho mới',
        address: wh.address || 'Hồ Chí Minh',
        manager: wh.manager || 'Quản Kho',
        capacity: wh.capacity || '1,000 m2',
        status: wh.status || 'Đang hoạt động'
      };
      db.warehouses.unshift(updated);
    }

    saveDB(db);
    return simulateApiCall(updated);
  },

  getGoodsReceipts: async (multiCodes?: string[]): Promise<GoodsVoucher[]> => {
    try {
      const res = await fetch('/api/vouchers?type=RECEIPT');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data) && json.data.length > 0) {
          let list: GoodsVoucher[] = json.data;
          if (multiCodes && multiCodes.length > 0) {
            const codes = multiCodes.map(c => c.toLowerCase());
            list = list.filter(v => codes.includes(v.code.toLowerCase()));
          }
          return list;
        }
      }
    } catch (e) {
      console.warn('Falling back to local DB for vouchers:', e);
    }

    const db = getStoredDB();
    let list = (db.vouchers || []).filter(v => v.type === 'Nhập kho');

    if (multiCodes && multiCodes.length > 0) {
      const codes = multiCodes.map(c => c.toLowerCase());
      list = list.filter(v => codes.includes(v.code.toLowerCase()));
    }

    return simulateApiCall(list);
  },

  createGoodsReceipt: async (receipt: Partial<GoodsVoucher>): Promise<GoodsVoucher> => {
    const db = getStoredDB();
    const newVoucher: GoodsVoucher = {
      id: `PNK-${Date.now()}`,
      type: 'Nhập kho',
      code: receipt.code || `PNK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: receipt.date || new Date().toISOString().split('T')[0],
      warehouseId: receipt.warehouseId || 'WH-001',
      warehouseName: receipt.warehouseName || 'Kho Tổng HCMC',
      items: receipt.items || [],
      totalValue: receipt.totalValue || 0,
      createdBy: receipt.createdBy || 'Admin',
      status: 'Đã phê duyệt',
      note: receipt.note || 'Nhập kho mới'
    };

    db.vouchers.unshift(newVoucher);
    saveDB(db);
    return simulateApiCall(newVoucher);
  }
};

// ---------------------------
// 3. SALES API
// ---------------------------
export const salesApi = {
  getCustomers: async (multiCodes?: string[]): Promise<Customer[]> => {
    const db = getStoredDB();
    let list = db.customers || [];

    if (multiCodes && multiCodes.length > 0) {
      const codes = multiCodes.map(c => c.toLowerCase());
      list = list.filter(c => codes.some(code => c.name.toLowerCase().includes(code) || c.company.toLowerCase().includes(code) || c.id.toLowerCase() === code));
    }

    return simulateApiCall(list);
  },

  getSalesOrders: async (multiCodes?: string[]): Promise<SalesOrder[]> => {
    const db = getStoredDB();
    let list = db.orders || [];

    if (multiCodes && multiCodes.length > 0) {
      const codes = multiCodes.map(c => c.toLowerCase());
      list = list.filter(o => codes.includes(o.id.toLowerCase()) || codes.some(c => o.customerName.toLowerCase().includes(c)));
    }

    return simulateApiCall(list);
  },

  createSalesOrder: async (order: Partial<SalesOrder>): Promise<SalesOrder> => {
    const db = getStoredDB();
    const newOrder: SalesOrder = {
      id: `DH-${Date.now()}`,
      customerName: order.customerName || 'Khách hàng mới',
      date: order.date || new Date().toISOString().split('T')[0],
      items: order.items || [],
      totalAmount: order.totalAmount || 0,
      status: order.status || 'Chờ xử lý',
      paymentMethod: order.paymentMethod || 'Chuyển khoản'
    };

    db.orders.unshift(newOrder);
    saveDB(db);
    return simulateApiCall(newOrder);
  }
};

// ---------------------------
// 4. SYSTEM DATABASE & METADATA API
// ---------------------------
export const systemApi = {
  getERPDatabase: async (): Promise<ERPData> => {
    return simulateApiCall(getStoredDB());
  },

  resetDatabaseToDefaults: async (): Promise<ERPData> => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialERPData));
    localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(initialRoles));
    return simulateApiCall(initialERPData);
  },

  getGridColumns: async (gridCode?: string) => {
    try {
      const res = await fetch(`/api/system/columns${gridCode ? `?gridCode=${gridCode}` : ''}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) return json.data;
      }
    } catch (e) {
      console.warn('Backend API /api/system/columns error:', e);
    }
    return [];
  },

  getLookupData: async (lookupCode: string) => {
    try {
      const res = await fetch(`/api/system/lookups/${lookupCode}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) return json.data;
      }
    } catch (e) {
      console.warn(`Backend API /api/system/lookups/${lookupCode} error:`, e);
    }
    return null;
  },

  getReportData: async (reportCode: string) => {
    try {
      const res = await fetch(`/api/system/reports/${reportCode}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) return json.data;
      }
    } catch (e) {
      console.warn(`Backend API /api/system/reports/${reportCode} error:`, e);
    }
    return null;
  }
};
