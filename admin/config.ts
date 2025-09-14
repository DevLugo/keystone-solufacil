// /admin/config.ts
import type { AdminConfig } from '@keystone-6/core/types';
import { CustomHeader } from './components/CustomHeader';
import { CustomNavigation } from './components/CustomNavigation';

export const components: AdminConfig['components'] = {
  Logo: CustomHeader,
  Navigation: CustomNavigation
};
