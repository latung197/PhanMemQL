import { apiRequest } from '../../services/apiClient';
import type { Dashboard, DashboardRange } from './types';

export const dashboardApi = {
  get: (range: DashboardRange) => apiRequest<Dashboard>('GET', `/api/dashboard?range=${range}`)
};
