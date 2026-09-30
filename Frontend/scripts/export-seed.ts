/**
 * Exports the frontend mock data to ../ServerService/Core/SeedData/seed.json.
 * The API imports that file into an empty database when Seed:DemoData = true,
 * so the demo roles, users, company units and settings stay identical on both sides.
 *
 *   npm run export-seed
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initialCompanyUnits, initialNotifications, initialUsers } from '../src/mock/initialERPData';
import { initialRoles, FULL_ACTIONS, FORBIDDEN_ACTIONS } from '../src/mock/initialRoles';
import {
  DEFAULT_SYSTEM_CONFIG,
  DEFAULT_FISCAL_CONFIG,
  DEFAULT_NUMBER_FORMAT_CONFIG,
  DEFAULT_COMPANY_PROFILE
} from '../src/services/systemSettingsService';
import { DEMO_CURRENCIES, DEMO_DEPARTMENTS, DEMO_EXCHANGE_RATES } from '../src/mock/initialSettingsData';
import type { ActionPermissions, SubKeyPermissions } from '../src/types';

const toActions = (value: SubKeyPermissions | undefined): ActionPermissions => {
  if (value === true) return FULL_ACTIONS;
  if (!value) return FORBIDDEN_ACTIONS;
  return value;
};

const toMatrix = (permissions?: Partial<Record<string, SubKeyPermissions>>) =>
  permissions
    ? Object.fromEntries(Object.entries(permissions).map(([key, value]) => [key, toActions(value)]))
    : null;

const seed = {
  companyUnits: initialCompanyUnits.map(({ id: _id, ...unit }) => unit),
  roles: initialRoles.map(role => ({
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    permissions: toMatrix(role.permissions)
  })),
  users: initialUsers.map(user => ({
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    roleId: user.isSystemAdmin ? 'ROLE_ADMIN' : user.roleId ?? null,
    department: user.department,
    departmentCode: DEMO_DEPARTMENTS.find(d => d.name === user.department)?.code ?? null,
    phone: user.phone,
    avatar: user.avatar,
    themePref: user.themePref,
    notificationsEnabled: user.notificationsEnabled,
    isSystemAdmin: Boolean(user.isSystemAdmin),
    permissions: user.isSystemAdmin ? null : toMatrix(user.permissions),
    ma_dvcs: user.ma_dvcs ?? null,
    ds_ma_dvcs: user.ds_ma_dvcs ?? null
  })),
  notifications: initialNotifications.map(n => ({
    title: n.title,
    message: n.message,
    type: n.type,
    linkModule: n.linkModule ?? null
  })),
  systemConfig: {
    systemDefaults: DEFAULT_SYSTEM_CONFIG,
    fiscalConfig: DEFAULT_FISCAL_CONFIG,
    companyProfile: DEFAULT_COMPANY_PROFILE,
    numberFormat: DEFAULT_NUMBER_FORMAT_CONFIG
  },
  departments: DEMO_DEPARTMENTS,
  currencies: DEMO_CURRENCIES,
  exchangeRates: DEMO_EXCHANGE_RATES
};

const target = resolve(dirname(fileURLToPath(import.meta.url)), '../../ServerService/Core/SeedData/seed.json');
mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, `${JSON.stringify(seed, null, 2)}\n`, 'utf8');
console.log(`Seed data written to ${target}`);
