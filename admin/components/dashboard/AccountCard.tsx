/** @jsxRuntime classic */
/** @jsx jsx */

import { jsx } from '@keystone-ui/core';
import { formatCurrency } from '../../utils/format';

interface AccountCardProps {
  name: string;
  amount: string;
  type: 'BANK' | 'OFFICE_CASH_FUND' | 'EMPLOYEE_CASH_FUND';
}

const getBackgroundColor = (type: string) => {
  switch (type) {
    case 'BANK':
      return '#4F46E5'; // Indigo
    case 'OFFICE_CASH_FUND':
      return '#059669'; // Emerald
    case 'EMPLOYEE_CASH_FUND':
      return '#B45309'; // Amber
    default:
      return '#6B7280'; // Gray
  }
};

export const AccountCard = ({ name, amount, type }: AccountCardProps) => {
  const backgroundColor = getBackgroundColor(type);
  
  return (
    <div
      css={{
        backgroundColor,
        borderRadius: '12px',
        padding: '20px',
        color: 'white',
        minWidth: '250px',
        maxWidth: '300px',
        height: '150px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        transition: 'transform 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
        },
      }}
    >
      <div>
        <h3
          css={{
            margin: 0,
            fontSize: '1.25rem',
            fontWeight: 600,
            marginBottom: '4px',
          }}
        >
          {name}
        </h3>
        <span
          css={{
            fontSize: '0.875rem',
            opacity: 0.9,
          }}
        >
          {type.replace(/_/g, ' ')}
        </span>
      </div>
      <div
        css={{
          fontSize: '1.875rem',
          fontWeight: 700,
        }}
      >
        {formatCurrency(parseFloat(amount))}
      </div>
    </div>
  );
};
