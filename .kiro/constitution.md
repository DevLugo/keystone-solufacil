# Solufacil Keystone - Development Constitution

## Project Overview

**Solufacil Keystone** is a financial management system for microloans built with KeystoneJS 6, PostgreSQL, and React.

**Tech Stack:**
- Backend: KeystoneJS 6, GraphQL, PostgreSQL, Prisma
- Frontend: React, Apollo Client, CSS Modules
- Storage: Cloudinary
- Testing: Jest, Cypress

## Code Style Guidelines

### Import Order
```typescript
// 1. External libraries
import { list } from '@keystone-6/core';
import { gql } from '@apollo/client';

// 2. Internal modules
import { prisma } from './keystone';

// 3. Relative imports
import { CustomComponent } from '../components/CustomComponent';

// 4. CSS Modules (ALWAYS)
import styles from './MyComponent.module.css';
```

### Styling Rules
- ✅ **ALWAYS use CSS Modules** for component styles
- ✅ Create separate `.module.css` files
- ✅ Use semantic class names
- ❌ **NO inline styles** except for dynamic values
- ❌ **NO mixing** inline styles with CSS classes

### Modern Design System (2025)

**Inspired by: Vercel, Linear, Stripe, Notion, Dribbble**

**Typography:**
- Body: 13-15px, weight 400-500
- Emphasis: weight 600-700
- Minimal sizes for compact UI: 10-13px

**Spacing Scale:**
- 4px, 8px, 12px, 16px, 20px, 24px

**Colors:**
```css
--neutral-50: #fafafa;
--neutral-900: #171717;
--primary: #2563eb;
--success: #10b981;
--danger: #ef4444;
--warning: #f59e0b;
```

**Shadows:**
```css
--shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
```

**Transitions:**
- Fast: 150ms cubic-bezier(0.4, 0, 0.2, 1)
- Normal: 200ms cubic-bezier(0.4, 0, 0.2, 1)

**Border Radius:**
- Small: 6-8px
- Medium: 10-12px
- Large: 14-16px

### Autocomplete/Dropdown Design

**Key Principles:**
- Compact padding and spacing
- Light font weights (400)
- Horizontal layout: content left, badges right
- Subtle hover effects (translateX, light shadow)
- Solid colors for badges, no gradients
- Action buttons only visible when selected
- Native HTML with CSS Modules

**Typography:**
- Names: 12px, weight 400
- Badges: 10px, weight 400-500
- Avoid excessive bold

### Form Card Layout (2-Column)

```css
.formCard {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  padding: 20px;
  border-radius: 10px;
}

.leftColumn {
  border-right: 2px solid #f3f4f6;
}
```

**Use Cases:**
- Loan forms: Borrower + Guarantor (left) | Loan details (right)
- Clear visual separation
- No horizontal scrolling

### Formatting
- Indentation: 2 spaces
- Quotes: Single quotes
- Semicolons: Required
- Line length: 120 chars (soft)
- Trailing commas: Yes

### TypeScript
```typescript
// ✅ Explicit types
export const calculate = (value: Decimal, rate: number): number => {
  return parseFloat((value.toNumber() * rate).toFixed(2));
};

// ✅ Interfaces for objects
interface LoanData {
  id: string;
  amount: Decimal;
}

// ✅ Types for unions
type TransactionType = 'INCOME' | 'EXPENSE';

// ❌ NO 'any' - use 'unknown'
```

### Naming Conventions
- Files: kebab-case (`loan-calculations.ts`)
- Components: PascalCase (`AccountCard.tsx`)
- Functions: camelCase (`calculateAmount`)
- Constants: UPPER_SNAKE_CASE (`MAX_AMOUNT`)
- GraphQL: UPPER_SNAKE_CASE (`GET_LOANS`)

### Error Handling
```typescript
try {
  const result = await prisma.loan.create({ data });
  console.log('✅ Created:', result.id);
  return result;
} catch (error) {
  console.error('❌ Error:', error);
  throw new Error(`Failed: ${error.message}`);
}
```

### Clean Code
- ✅ **ALWAYS remove unused imports**
- ✅ **ALWAYS remove unused variables**
- ❌ **NO dead code**

## GraphQL Patterns

### Structure
- Queries: `admin/graphql/queries/`
- Mutations: `admin/graphql/mutations/`
- Export named constants

```typescript
export const GET_LOANS = gql`
  query GetLoans($leadId: ID!) {
    loans(where: { lead: { id: { equals: $leadId } } }) {
      id
      amount
    }
  }
`;
```

### Best Practices
1. Organize by domain
2. Export named constants
3. Reuse fragments
4. Optimize queries (only needed fields)
5. Handle loading/error states
6. Use variables (never interpolate)

## Critical Rules

1. **NEVER read `.env`** - Contains credentials
2. **Use audit hooks** - Log critical operations
3. **Handle Decimals** - Use `parseAmount()` helper
4. **Optimize queries** - Use `-optimized` versions
5. **Test database** - Use `npm run test:setup`

## Performance Tips

1. Use `-optimized` query variants
2. Avoid virtual fields in lists
3. `pollInterval` minimum 30s
4. Batch with `Promise.all()`
5. `setImmediate()` for non-critical async

## Build Commands

```bash
# Development
npm run dev

# Build
npm run build

# Test
npm test
npm run test:e2e

# Database
npm run migrate
npm run generate
```

## Restricted Files

**NEVER read:**
- `.env`
- `.env.test`
