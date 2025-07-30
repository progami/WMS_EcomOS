# Accessibility Implementation Plan for WMS

## Executive Summary

This document outlines a comprehensive plan to fix accessibility issues in the WMS application, prioritized by severity and business impact. The plan includes specific implementation details, timelines, and success metrics.

## 1. Prioritized Fix List

### P0 - Critical Issues (User-blocking on high-traffic pages)

These issues prevent users from completing critical workflows and must be fixed immediately.

#### 1.1 Operations Pages (Receive/Ship)
**Impact**: Blocks core warehouse operations
**Files**: 
- `/src/app/operations/receive/page.tsx`
- `/src/app/operations/ship/page.tsx`

**Issues**:
- Dynamic form rows lack unique IDs and proper labels
- File upload inputs missing accessible labels
- Select elements without proper associations
- Missing ARIA labels for icon-only buttons

**Specific Fixes**:
```tsx
// Before
<input type="text" value={ciNumber} onChange={...} />

// After
<input 
  id="ci-number"
  name="ciNumber"
  type="text" 
  value={ciNumber} 
  onChange={...}
  aria-label="Commercial Invoice Number"
  aria-required="true"
/>
```

**Estimated Time**: 4-6 hours per page

#### 1.2 Authentication Pages
**Impact**: Prevents login/access to system
**Files**: 
- `/src/app/auth/login/page.tsx`

**Issues**:
- Already has proper labels (uses htmlFor and id)
- Minor: Loading button lacks aria-label

**Estimated Time**: 30 minutes

### P1 - High Priority (Major accessibility barriers)

#### 1.3 Dashboard Components
**Files**:
- `/src/app/dashboard/page.tsx`
- `/src/components/dashboard/*.tsx`

**Issues**:
- Charts lack text alternatives
- Interactive elements missing keyboard navigation
- Color-only information conveyance

**Estimated Time**: 4 hours

#### 1.4 Inventory Management
**Files**:
- `/src/app/operations/inventory/page.tsx`
- `/src/app/operations/transactions/[id]/page.tsx`

**Issues**:
- Table headers not properly associated
- Sortable columns lack ARIA attributes
- Missing skip navigation links

**Estimated Time**: 3 hours

### P2 - Medium Priority (Important but not blocking)

#### 1.5 Configuration Pages
**Files**:
- `/src/app/config/**/*.tsx`
- `/src/app/admin/**/*.tsx`

**Issues**:
- Form validation messages not announced
- Modal dialogs lack proper ARIA attributes
- Focus management in modals

**Estimated Time**: 6 hours total

#### 1.6 Financial Pages
**Files**:
- `/src/app/finance/**/*.tsx`

**Issues**:
- Complex forms need better grouping
- Currency inputs lack proper formatting announcements

**Estimated Time**: 4 hours

### P3 - Low Priority (Nice-to-have improvements)

#### 1.7 Reports and Analytics
**Files**:
- `/src/app/admin/reports/*.tsx`
- Various export components

**Issues**:
- Data visualizations need better alternatives
- Export buttons could have better descriptions

**Estimated Time**: 3 hours

## 2. Fix Strategy

### 2.1 Helper Function for Unique IDs

Create a utility to generate consistent, unique IDs for form elements:

```typescript
// /src/lib/utils/accessibility.ts
export function generateFieldId(prefix: string, suffix?: string | number): string {
  const base = prefix.toLowerCase().replace(/\s+/g, '-');
  return suffix !== undefined ? `${base}-${suffix}` : base;
}

export function generateFieldName(prefix: string, index?: number, field?: string): string {
  if (index !== undefined && field) {
    return `${prefix}[${index}].${field}`;
  }
  return prefix;
}

// For dynamic form rows
export function generateDynamicFieldProps(
  prefix: string,
  index: number,
  field: string
): {
  id: string;
  name: string;
  'aria-describedby'?: string;
} {
  return {
    id: generateFieldId(`${prefix}-${field}`, index),
    name: generateFieldName(prefix, index, field),
  };
}
```

### 2.2 Update Base UI Components

Enhance the existing UI components to enforce accessibility:

```typescript
// /src/components/ui/input.tsx
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  required?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, error, required, id, ...props }, ref) => {
    const inputId = id || generateFieldId(label || 'input', Math.random());
    const errorId = error ? `${inputId}-error` : undefined;
    
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="block text-sm font-medium mb-1">
            {label}
            {required && <span className="text-red-500 ml-1" aria-label="required">*</span>}
          </label>
        )}
        <input
          type={type}
          id={inputId}
          className={cn(
            "flex h-10 w-full rounded-md border...",
            error && "border-red-500",
            className
          )}
          ref={ref}
          aria-invalid={!!error}
          aria-describedby={errorId}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-sm text-red-500 mt-1" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
```

### 2.3 Dynamic Form Row Strategy

For pages with dynamic form rows (receive/ship), implement a consistent pattern:

```typescript
// Pattern for dynamic rows
interface DynamicRowProps {
  index: number;
  item: ItemType;
  onChange: (index: number, field: string, value: any) => void;
  onRemove: (index: number) => void;
}

function DynamicItemRow({ index, item, onChange, onRemove }: DynamicRowProps) {
  const rowPrefix = `item-${index}`;
  
  return (
    <tr>
      <td>
        <label htmlFor={`${rowPrefix}-sku`} className="sr-only">
          SKU Code for item {index + 1}
        </label>
        <select
          id={`${rowPrefix}-sku`}
          name={`items[${index}].skuCode`}
          value={item.skuCode}
          onChange={(e) => onChange(index, 'skuCode', e.target.value)}
          aria-label={`SKU Code for item ${index + 1}`}
          required
        >
          <option value="">Select SKU...</option>
          {/* options */}
        </select>
      </td>
      {/* More fields with similar pattern */}
      <td>
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label={`Remove item ${index + 1}`}
          disabled={items.length === 1}
        >
          <X className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}
```

### 2.4 Naming Conventions

Establish consistent naming conventions:

- **IDs**: `{page}-{section}-{field}-{index?}`
  - Example: `receive-shipment-ci-number`, `receive-item-sku-0`
- **Names**: Use dot notation for nested objects, brackets for arrays
  - Example: `shipment.ciNumber`, `items[0].skuCode`
- **ARIA Labels**: Clear, descriptive text
  - Example: "Commercial Invoice Number", "SKU Code for item 1"

## 3. Technical Considerations

### 3.1 Unique IDs in Dynamic Lists

- Use array index combined with a stable prefix
- For newly added items, use timestamp or UUID
- Store IDs in component state if items can be reordered

### 3.2 Backward Compatibility

- Form field names must remain unchanged to maintain API compatibility
- Add IDs and ARIA attributes without changing existing name attributes
- Test form submissions thoroughly after changes

### 3.3 Testing Approach

**Manual Testing**:
- Keyboard navigation (Tab, Enter, Space, Arrow keys)
- Screen reader testing (NVDA/JAWS on Windows, VoiceOver on Mac)
- Browser dev tools accessibility audit

**Automated Testing**:
```typescript
// Add to existing test files
import { axe, toHaveNoViolations } from 'jest-axe';

expect.extend(toHaveNoViolations);

test('should have no accessibility violations', async () => {
  const { container } = render(<ReceivePage />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

### 3.4 Impact on Form Submissions

- No impact - only adding IDs and ARIA attributes
- Form data structure remains the same
- Validation logic unchanged

## 4. Phased Rollout Plan

### Phase 1: Critical Operations (Week 1)
**Timeline**: 3-4 days
**Focus**: P0 issues on receive/ship pages

1. Day 1-2: Create accessibility utilities and update base components
2. Day 2-3: Fix receive page
3. Day 3-4: Fix ship page
4. Day 4: Testing and verification

**Deliverables**:
- Accessibility utility functions
- Updated Input, Select, and Button components
- Fixed receive/ship pages with full accessibility

### Phase 2: Core Workflows (Week 2)
**Timeline**: 4-5 days
**Focus**: P1 issues on dashboard and inventory

1. Day 1-2: Fix dashboard accessibility
2. Day 2-3: Update inventory and transaction pages
3. Day 4: Fix data tables and navigation
4. Day 5: Integration testing

**Deliverables**:
- Accessible dashboard with chart alternatives
- Keyboard-navigable tables
- Proper focus management

### Phase 3: Long-term Improvements (Week 3-4)
**Timeline**: 1-2 weeks
**Focus**: P2 and P3 issues

1. Week 3: Configuration and admin pages
2. Week 4: Reports, analytics, and polish

**Deliverables**:
- Fully accessible admin interface
- Enhanced reporting with text alternatives
- Complete accessibility documentation

## 5. Success Metrics

### Quantitative Metrics

1. **Accessibility Score**
   - Target: 95+ on Lighthouse accessibility audit
   - Current: ~75-80 (estimated)
   - Tools: Lighthouse, axe DevTools

2. **WCAG Compliance**
   - Target: WCAG 2.1 Level AA
   - Zero critical violations in automated testing
   - Pass manual keyboard navigation tests

3. **Form Completion Rate**
   - Monitor for any changes in form submission success
   - Target: No degradation in completion rates

### Qualitative Metrics

1. **User Feedback**
   - Survey users about ease of use
   - Monitor support tickets for accessibility issues

2. **Developer Experience**
   - Time to add new accessible forms reduced by 50%
   - Consistent patterns across codebase

### Validation Tools

1. **Automated Testing**:
   - axe DevTools Chrome extension
   - Lighthouse (built into Chrome DevTools)
   - jest-axe for unit tests
   - Playwright accessibility testing

2. **Manual Testing Checklist**:
   - [ ] All form inputs have labels
   - [ ] All buttons have accessible names
   - [ ] Keyboard navigation works throughout
   - [ ] Screen reader announces all content properly
   - [ ] Focus indicators are visible
   - [ ] Error messages are announced
   - [ ] Color is not the only conveyor of information

## 6. Implementation Guidelines

### For Developers

1. **Always include**:
   - `id` and `name` attributes on all form inputs
   - `htmlFor` on all labels pointing to input IDs
   - `aria-label` or `aria-labelledby` for complex widgets
   - `aria-describedby` for help text and errors

2. **Test every change**:
   - Tab through the interface
   - Use screen reader to verify announcements
   - Run axe DevTools scan

3. **Use the utilities**:
   - Import accessibility helpers for consistent IDs
   - Use enhanced UI components
   - Follow established patterns for dynamic forms

### Code Review Checklist

- [ ] All inputs have associated labels
- [ ] Dynamic elements have unique IDs
- [ ] ARIA attributes used correctly
- [ ] Keyboard navigation tested
- [ ] No accessibility violations in automated tests

## Next Steps

1. Review and approve this plan
2. Create accessibility utility functions
3. Begin Phase 1 implementation
4. Set up automated accessibility testing in CI/CD
5. Schedule accessibility training for team

## Appendix: Common Patterns

### Pattern 1: Basic Form Input
```tsx
<div className="form-group">
  <label htmlFor="field-name">Field Label</label>
  <input
    id="field-name"
    name="fieldName"
    type="text"
    aria-required="true"
    aria-describedby="field-name-help"
  />
  <span id="field-name-help" className="help-text">
    Helper text
  </span>
</div>
```

### Pattern 2: Dynamic Table Row
```tsx
<tr>
  <td>
    <label htmlFor={`row-${index}-field`} className="sr-only">
      Field for row {index + 1}
    </label>
    <input
      id={`row-${index}-field`}
      name={`items[${index}].field`}
      type="text"
      aria-label={`Field for row ${index + 1}`}
    />
  </td>
</tr>
```

### Pattern 3: File Upload
```tsx
<div className="file-upload">
  <label htmlFor="file-upload">
    <span>Upload Document</span>
    <input
      id="file-upload"
      name="document"
      type="file"
      className="sr-only"
      aria-describedby="file-help"
    />
  </label>
  <span id="file-help">PDF, DOC, or DOCX (max 5MB)</span>
</div>
```