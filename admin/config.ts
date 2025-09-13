// /admin/config.ts
import type { AdminConfig } from '@keystone-6/core/types';
import { CustomHeader } from './components/CustomHeader';

export const components: AdminConfig['components'] = {
  Logo: CustomHeader
};
