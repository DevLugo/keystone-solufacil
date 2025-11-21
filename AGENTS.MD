# Guidelines for AI Coding Agents

## Project Overview

**Solufacil Keystone** is a financial management system built with KeystoneJS 6, designed to manage microloans, payments, routes, employees, and financial transactions. The system includes:

- **Backend**: KeystoneJS 6 with GraphQL API, PostgreSQL database, Prisma ORM
- **Frontend**: Custom React admin UI with Apollo Client for GraphQL queries
- **Key Features**:
  - Loan management (creation, tracking, payments, renewals)
  - Employee and route management
  - Transaction tracking (income/expenses)
  - Document photo uploads with Cloudinary integration
  - Telegram bot integration for notifications and reports
  - Automated report generation and scheduling
  - Audit logging for all critical operations
  - Multi-account financial tracking (bank, cash funds)

**Tech Stack**:
- Node.js 18+
- TypeScript
- KeystoneJS 6
- PostgreSQL
- Prisma
- React (admin UI)
- Apollo Client (GraphQL)
- Cloudinary (file storage)
- Telegram Bot API
- PDFKit (report generation)
- Jest & Cypress (testing)

## Build and Test Commands

### Development
```bash
# Start development server
npm run dev

# Start with test environment
npm run dev:test
```

### Build & Deploy
```bash
# Build for production
npm run build

# Build with production optimizations
npm run build:production

# Start production server
npm start

# Deploy (build + migrate + start)
npm run deploy
```

### Database
```bash
# Generate Prisma client
npm run generate

# Run migrations
npm run migrate

# Reset database (CAUTION: deletes all data)
npm run migrate:reset
```

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run unit tests only
npm run test:unit

# Run integration tests
npm run test:integration

# Run with coverage
npm run test:coverage

# E2E tests with Cypress
npm run test:e2e

# Open Cypress UI
npm run cypress:open

# Setup test database
npm run test:setup

# Teardown test database
npm run test:teardown
```

### Utilities
```bash
# Clean Cypress artifacts
npm run clean:cypress

# Clean all (node_modules + cypress)
npm run clean:all

# Setup environment files
npm run env:setup
```

## Code Style Guidelines

### Imports
Follow this import order:
```typescript
// 1. External libraries
import { list } from '@keystone-6/core';
import { text, relationship } from '@keystone-6/core/fields';
import { gql } from '@apollo/client';

// 2. Internal modules (absolute paths)
import { prisma } from './keystone';
import { calculateLoanProfitAmount } from './utils/loan';

// 3. Relative imports
import { CustomComponent } from '../components/CustomComponent';
import type { LoanType } from '../types/loan';

// 4. CSS/Styles (ALWAYS use CSS Modules)
import styles from './MyComponent.module.css';
```

**CRITICAL: Clean Up Unused Imports and Variables**
- ✅ **ALWAYS remove unused imports** before completing any file
- ✅ **ALWAYS remove unused variables** before completing any file
- ✅ **Run a final review** to check for:
  - Imported modules that are never referenced
  - Declared variables that are never used
  - Type imports that are not needed
  - Functions or constants that are defined but not called
- ❌ **DON'T leave dead code** - it creates confusion and maintenance issues
- 💡 **Use your IDE/linter** to identify unused imports automatically

### Styling Guidelines

**ALWAYS use CSS Modules for component styles:**
- ✅ **DO**: Create separate `.module.css` files for component styles
- ✅ **DO**: Use semantic class names (`.kpiBar`, `.modernButton`, `.badge`)
- ❌ **DON'T**: Use inline styles except for dynamic values
- ❌ **DON'T**: Mix inline styles with CSS classes

**Example structure:**
```
MyComponent.tsx
MyComponent.module.css
```

**Modern Design System (2025)**

Follow these design principles inspired by top tech companies:

**Vercel-inspired:**
- Subtle gradients: `linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)`
- Soft shadows: `0 10px 15px -3px rgb(0 0 0 / 0.1)`
- Generous border radius: 12-16px
- Backdrop blur effects: `backdrop-filter: blur(8px)`

**Linear-inspired:**
- Fast transitions: 150-200ms
- Micro-interactions on hover
- Elevation changes: `transform: translateY(-2px)`
- Smooth cubic-bezier: `cubic-bezier(0.4, 0, 0.2, 1)`

**Stripe-inspired:**
- Clear visual hierarchy
- Consistent spacing scale: 4px, 8px, 12px, 16px, 20px, 24px
- Professional color palette with subtle variations
- Focus on readability and contrast

**Notion-inspired:**
- Generous whitespace
- Refined typography (13-15px for body, 600-700 weight for emphasis)
- Subtle state changes
- Clean, minimal aesthetic

**Dribbble-inspired (Autocomplete/Dropdown UI):**
- Compact and clean design
- Minimal font sizes (10-12px for body, 12-13px for names)
- Light font weights (400 for normal text, avoid excessive bold)
- Subtle hover effects with micro-animations
- Horizontal layout: content left, badges/tags right
- Consistent spacing and alignment

**Color System:**
```css
/* Neutral palette */
--neutral-50: #fafafa;
--neutral-100: #f5f5f5;
--neutral-200: #e5e5e5;
--neutral-700: #404040;
--neutral-900: #171717;

/* Semantic colors */
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
```css
--transition-fast: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
--transition-normal: all 200ms cubic-bezier(0.4, 0, 0.2, 1);
```

### Autocomplete/Dropdown Design Guidelines

When designing autocomplete or dropdown components, follow these principles for a clean, professional look:

**Layout Structure:**
```css
/* Dropdown container - compact with subtle shadow */
.dropdown {
  padding: 4px;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  box-shadow: 
    0 10px 15px -3px rgba(0, 0, 0, 0.1),
    0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

/* Dropdown items - compact with hover effect */
.dropdownItem {
  padding: 8px 10px;
  margin-bottom: 1px;
  border-radius: 6px;
  cursor: pointer;
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.dropdownItem:hover {
  background: #f9fafb;
  transform: translateX(2px);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}
```

**Typography:**
- Main text (names): 12px, font-weight 400 (no bold)
- Badges/tags: 10px, font-weight 400-500
- Avoid excessive bold text - use weight 400 for most content
- Use weight 500-600 only for critical emphasis

**Horizontal Layout Pattern:**
```css
/* Content container - horizontal with name left, badges right */
.itemContent {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

/* Name takes 70% max width, can wrap */
.itemName {
  font-size: 12px;
  font-weight: 400;
  flex: 0 1 70%;
  word-wrap: break-word;
}

/* Badges always on the right */
.badgeRow {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: auto;
  flex: 0 0 auto;
}
```

**Badges/Tags:**
```css
.badge {
  padding: 2px 6px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 400;
  white-space: nowrap;
}

/* Semantic colors - solid backgrounds, no gradients */
.badgeDebt { background: #fecaca; color: #7f1d1d; }
.badgeNoDebt { background: #bbf7d0; color: #14532d; }
.badgeLocation { background: #bfdbfe; color: #1e3a8a; }
```

**Scrollbar:**
```css
.dropdown::-webkit-scrollbar {
  width: 5px;
}

.dropdown::-webkit-scrollbar-thumb {
  background: #d1d5db;
  border-radius: 3px;
}
```

**Action Buttons (Edit/Clear):**
```css
/* Modern action buttons - tech startup style */
.actionButton {
  width: 24px;
  height: 24px;
  border-radius: 5px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 120ms cubic-bezier(0.4, 0, 0.2, 1);
  color: #6b7280;
}

.actionButton:hover {
  background: #f3f4f6;
  color: #111827;
}

.actionButton:active {
  transform: scale(0.95);
}

/* Semantic hover colors */
.editButton:hover {
  background: #eff6ff;
  color: #2563eb;
}

.clearButton:hover {
  background: #fef2f2;
  color: #dc2626;
}
```

**Key Principles:**
- ✅ Keep it compact - minimal padding and spacing
- ✅ Use light font weights (400) for readability
- ✅ Horizontal layout with content left, badges right
- ✅ Subtle hover effects (translateX, light shadow)
- ✅ Consistent border radius (6-8px)
- ✅ Solid colors for badges, avoid gradients
- ✅ Action buttons only visible when there's a selection
- ✅ Use semantic colors on hover (blue for edit, red for delete)
- ✅ Native HTML buttons with CSS Modules, avoid component libraries
- ❌ Avoid large font sizes (keep 10-13px range)
- ❌ Avoid excessive bold text
- ❌ Avoid vertical stacking of badges when possible
- ❌ Don't show action buttons when there's no selection

### Form Card Layout Pattern (2-Column Design)

When designing complex forms with multiple related entities, use a 2-column card layout:

**Structure:**
```css
/* Card container with 2 columns */
.formCard {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  padding: 20px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  transition: all 150ms cubic-bezier(0.4, 0, 0.2, 1);
}

.formCard:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

/* Left column: Related entities (e.g., people) */
.leftColumn {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-right: 24px;
  border-right: 2px solid #f3f4f6;
}

/* Right column: Main entity data */
.rightColumn {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-left: 4px;
}

/* Section headers with visual distinction */
.sectionHeader {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 8px;
}

.sectionHeader.primary {
  color: #2563eb;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  border: 1px solid #bfdbfe;
}

.sectionHeader.secondary {
  color: #7c3aed;
  background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
  border: 1px solid #ddd6fe;
}
```

**Use Cases:**
- Loan forms: Borrower + Guarantor (left) | Loan details (right)
- Order forms: Customer + Shipping (left) | Order items (right)
- Booking forms: Guest + Contact (left) | Reservation details (right)

**Benefits:**
- ✅ Clear visual separation of concerns
- ✅ No horizontal scrolling needed
- ✅ Better use of vertical space
- ✅ Easier to scan and understand
- ✅ Responsive and adaptable

### Formatting
- **Indentation**: 2 spaces (no tabs)
- **Quotes**: Single quotes for strings (`'text'`)
- **Semicolons**: Required at end of statements
- **Line length**: Max 120 characters (soft limit)
- **Trailing commas**: Use in multi-line objects/arrays

### TypeScript Types
```typescript
// ✅ DO: Use explicit types for function parameters and returns
export const calculateAmount = (value: Decimal, rate: number): number => {
  return parseFloat((value.toNumber() * rate).toFixed(2));
};

// ✅ DO: Use interfaces for object shapes
interface LoanData {
  id: string;
  amount: Decimal;
  rate: number;
}

// ✅ DO: Use type for unions and primitives
type TransactionType = 'INCOME' | 'EXPENSE';
type AccountId = string;

// ❌ DON'T: Use 'any' - use 'unknown' if type is truly unknown
// Bad: const data: any = await fetch();
// Good: const data: unknown = await fetch();
```

### Naming Conventions
- **Files**: kebab-case (`loan-calculations.ts`, `use-auth.ts`)
- **Components**: PascalCase (`CustomNavigation.tsx`, `AccountCard.tsx`)
- **Functions**: camelCase (`calculateLoanAmount`, `fetchUserData`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_LOAN_AMOUNT`, `DEFAULT_RATE`)
- **Interfaces/Types**: PascalCase (`LoanType`, `TransactionData`)
- **GraphQL Operations**: UPPER_SNAKE_CASE (`GET_LOANS`, `CREATE_TRANSACTION`)

### Error Handling
```typescript
// ✅ DO: Use try-catch for async operations
try {
  const result = await context.prisma.loan.create({ data });
  console.log('✅ Loan created:', result.id);
  return result;
} catch (error) {
  console.error('❌ Error creating loan:', error);
  throw new Error(`Failed to create loan: ${error.message}`);
}

// ✅ DO: Validate input data
if (!data.amount || data.amount <= 0) {
  throw new Error('Invalid amount: must be greater than 0');
}

// ✅ DO: Use descriptive error messages
throw new Error(`Loan ${loanId} not found for borrower ${borrowerId}`);

// ❌ DON'T: Swallow errors silently
// Bad: catch (error) { }
// Good: catch (error) { console.error('Error:', error); }
```

### Async/Await
```typescript
// ✅ DO: Use async/await over promises
const loan = await context.prisma.loan.findUnique({ where: { id } });

// ✅ DO: Handle promise rejections
const loans = await Promise.all(
  loanIds.map(id => fetchLoan(id).catch(err => {
    console.error(`Failed to fetch loan ${id}:`, err);
    return null;
  }))
);

// ❌ DON'T: Mix async/await with .then()
// Bad: await fetchData().then(data => process(data));
// Good: const data = await fetchData(); process(data);
```

### Comments
```typescript
// ✅ DO: Use JSDoc for functions
/**
 * Calculate the total profit amount for a loan
 * @param loanId - The unique identifier of the loan
 * @param includeProjected - Whether to include projected future profit
 * @returns The total profit amount rounded to 2 decimals
 */
export const calculateLoanProfit = async (
  loanId: string, 
  includeProjected: boolean = false
): Promise<number> => {
  // Implementation
};

// ✅ DO: Explain complex logic
// Calculate weekly payment: (principal + profit) / duration
const weeklyPayment = (amountGived + profitAmount) / weekDuration;

// ❌ DON'T: State the obvious
// Bad: // Set the name variable to the user's name
// Good: // Normalize name by removing extra spaces and trimming
```

## GraphQL Patterns

### Common Query/Mutation Structure

Create reusable GraphQL operations in `admin/graphql/queries/` and `admin/graphql/mutations/`:

**Query Example** (`admin/graphql/queries/loans.ts`):
```typescript
import { gql } from '@apollo/client';

export const GET_LOANS = gql`
  query GetLoans($leadId: ID!, $finishedDate: DateTimeNullableFilter) {
    loans(where: { 
      lead: { id: { equals: $leadId } }, 
      finishedDate: $finishedDate 
    }) {
      id
      requestedAmount
      amountGived
      signDate
      borrower {
        id
        personalData {
          fullName
          phones {
            number
          }
        }
      }
    }
  }
`;
```

**Mutation Example** (`admin/graphql/mutations/transactions.ts`):
```typescript
import { gql } from '@apollo/client';

export const CREATE_TRANSACTION = gql`
  mutation CreateTransaction($data: TransactionCreateInput!) {
    createTransaction(data: $data) {
      id
      amount
      type
      date
      sourceAccount {
        id
        amount
      }
    }
  }
`;
```

### Using GraphQL in Components

```typescript
import { useQuery, useMutation } from '@apollo/client';
import { GET_LOANS } from '../graphql/queries/loans';
import { CREATE_TRANSACTION } from '../graphql/mutations/transactions';

export function MyComponent() {
  // Query with variables
  const { data, loading, error, refetch } = useQuery(GET_LOANS, {
    variables: { leadId: '123', finishedDate: null },
    pollInterval: 30000, // Auto-refresh every 30s
  });

  // Mutation with optimistic updates
  const [createTransaction, { loading: creating }] = useMutation(
    CREATE_TRANSACTION,
    {
      onCompleted: (data) => {
        console.log('✅ Transaction created:', data.createTransaction.id);
        refetch(); // Refresh query data
      },
      onError: (error) => {
        console.error('❌ Error:', error.message);
      }
    }
  );

  const handleCreate = async () => {
    await createTransaction({
      variables: {
        data: {
          amount: 100,
          type: 'INCOME',
          date: new Date().toISOString(),
        }
      }
    });
  };

  if (loading) return <LoadingDots />;
  if (error) return <div>Error: {error.message}</div>;

  return <div>{/* Render data */}</div>;
}
```

### GraphQL Best Practices

1. **Organize by domain**: Group related queries/mutations in the same file
2. **Export named constants**: Use `export const GET_LOANS` not default exports
3. **Reuse fragments**: For repeated field selections
4. **Optimize queries**: Only request fields you need
5. **Handle loading/error states**: Always check `loading` and `error`
6. **Use variables**: Never interpolate values directly in queries

## MCP Server Configuration

### Shadcn UI Integration

The shadcn MCP server is configured in `.vscode/mcp.json` (for VS Code) or `.kiro/settings/mcp.json` (for Kiro).

**Configuration for Kiro** (`.kiro/settings/mcp.json`):
```json
{
  "mcpServers": {
    "shadcn": {
      "command": "npx",
      "args": ["shadcn@latest", "mcp"],
      "env": {}
    }
  }
}
```

**What the shadcn MCP server provides**:
- Browse all available components from shadcn registry
- Search components by name or functionality
- Install components using natural language prompts
- Support for multiple registries (public, private, third-party)

**Usage examples**:
- "Show me all available components in the shadcn registry"
- "Add the button, dialog and card components to my project"
- "Create a contact form using components from the shadcn registry"
- "Add a login form with shadcn components"

**Official Documentation**: https://ui.shadcn.com/docs/mcp

## Usage Notes for AI Agents

### Critical Rules

1. **NEVER read `.env` file** - Contains sensitive credentials
2. **Use audit hooks** - All critical operations are logged via `createAuditHook`
3. **Handle Decimals carefully** - Use `parseAmount()` helper for Prisma Decimal types
4. **Optimize GraphQL queries** - Avoid virtual fields in list queries (use `-optimized` versions)
5. **Test database operations** - Use `npm run test:setup` before integration tests

### Common Patterns

**Creating a new Keystone list**:
```typescript
export const MyModel = list({
  access: allowAll,
  fields: {
    name: text({ validation: { isRequired: true } }),
    amount: decimal({ precision: 10, scale: 2 }),
    createdAt: timestamp({ defaultValue: { kind: 'now' } }),
  },
  hooks: createAuditHook('MyModel', 
    (item, operation) => `${operation} on ${item.name}`,
    (item) => ({ modelId: item.id })
  )
});
```

**Adding a custom GraphQL mutation** (in `graphql/extendGraphqlSchema.ts`):
```typescript
export const extendGraphqlSchema = graphql.extend((base) => ({
  mutation: {
    myCustomMutation: graphql.field({
      type: graphql.String,
      args: { input: graphql.arg({ type: graphql.String }) },
      resolve: async (source, { input }, context) => {
        // Your logic here
        return 'Success';
      }
    })
  }
}));
```

**Creating a new admin page**:
```typescript
// admin/pages/my-page.tsx
/** @jsxRuntime classic */
/** @jsx jsx */
import { jsx } from '@keystone-ui/core';
import { PageContainer } from '@keystone-6/core/admin-ui/components';

export default function MyPage() {
  return (
    <PageContainer header="My Page">
      <div css={{ padding: '24px' }}>
        {/* Your content */}
      </div>
    </PageContainer>
  );
}
```

### Performance Tips

1. Use `-optimized` query variants for large datasets
2. Avoid virtual fields in list queries (they're computed per-row)
3. Use `pollInterval` sparingly (30s minimum)
4. Batch database operations with `Promise.all()`
5. Use `setImmediate()` for non-critical async operations (audit logs)

### Debugging

```bash
# Check database connection
npm run migrate

# View GraphQL schema
# Navigate to http://localhost:3000/api/graphql

# Check Prisma queries
# Set DATABASE_URL with ?log=query

# Test Telegram integration
npm run dev
# Then visit /diagnostico-telegram
```

## Restricted Files

Files in the list contain sensitive data and MUST NOT be read:

- `.env`
- `.env.test` (use `env.test` template instead)