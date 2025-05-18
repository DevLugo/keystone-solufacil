/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';
import { DatePicker as KeystoneDatePicker } from '@keystone-ui/fields';

/**
 * Componente DatePicker compatible con Keystone UI
 * Este componente simplemente pasa todas las props al DatePicker de Keystone
 */
export const DatePicker = (props) => {
  return <KeystoneDatePicker {...props} />;
}; 