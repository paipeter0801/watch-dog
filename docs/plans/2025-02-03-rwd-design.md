# RWD (Responsive Web Design) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Watch-Dog Sentinel's frontend fully responsive across mobile (<640px), tablet (640-1024px), and desktop (>1024px) screen sizes.

**Architecture:** Add CSS media queries to existing inline styles without modifying HTML structure or JavaScript logic. Use a mobile-first approach with breakpoint additions.

**Tech Stack:** Vanilla CSS media queries, no external libraries (Pico.css already handles basic responsive).

---

## Task 1: Add Responsive CSS to Dashboard (Main Page)

**Files:**
- Modify: `src/index.tsx:50-248` (CSS in `<style>` block)

**Step 1: Add mobile breakpoint media queries**

Add these media queries at the end of the `<style>` block (before line `</style>`):

```css
/* Mobile (< 640px) */
@media (max-width: 639px) {
  /* Header: stack vertically, hide last updated on very small screens */
  .header-actions {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  /* Stats cards: single column */
  [style*="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))"] {
    grid-template-columns: 1fr !important;
  }

  /* Dashboard grid: single column */
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  /* Project card: reduce padding */
  .project-card {
    padding: 1rem;
  }

  /* Maintenance controls: stack buttons */
  .maintenance-controls {
    flex-direction: column;
  }

  /* Project header: adjust font size */
  .project-title {
    font-size: 1rem;
  }
}

/* Tablet (640px - 1024px) */
@media (min-width: 640px) and (max-width: 1024px) {
  /* Dashboard grid: 2 columns */
  .dashboard-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  /* Stats cards: 2-3 columns depending on space */
  [style*="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr))"] {
    grid-template-columns: repeat(3, 1fr) !important;
  }
}
```

**Step 2: Verify CSS syntax**

Check for any syntax errors in the added CSS.

**Step 3: Commit**

```bash
git add src/index.tsx
git commit -m "style: add responsive CSS for main dashboard"
```

---

## Task 2: Add Responsive CSS for Admin Dashboard

**Files:**
- Modify: `src/index.tsx:50-248` (CSS in `<style>` block)

**Step 1: Add admin-specific media queries**

Add these media queries after the dashboard media queries:

```css
/* Admin Dashboard - Mobile */
@media (max-width: 639px) {
  /* Admin tabs: stack buttons vertically */
  .admin-dashboard nav[style*="display: flex; gap: 0.5rem"] {
    flex-direction: column;
  }

  .admin-dashboard nav button {
    width: 100%;
  }

  /* Admin header: stack back button */
  .admin-dashboard header > div > div[style*="display: flex; justify-content: space-between"] {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  /* Projects table: make horizontally scrollable */
  .admin-dashboard table {
    font-size: 0.75rem;
  }

  .admin-dashboard table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* Settings form: single column */
  .admin-dashboard .grid {
    grid-template-columns: 1fr !important;
  }

  /* Projects tab: stack New Project button */
  .admin-dashboard [style*="display: flex; justify-content: space-between"][style*="align-items: center"] {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .admin-dashboard [style*="display: flex; justify-content: space-between"] button {
    width: 100%;
  }
}

/* Admin Dashboard - Tablet */
@media (min-width: 640px) and (max-width: 1024px) {
  /* Settings form: 2 columns */
  .admin-dashboard .grid {
    grid-template-columns: repeat(2, 1fr) !important;
  }
}
```

**Step 2: Commit**

```bash
git add src/index.tsx
git commit -m "style: add responsive CSS for admin dashboard"
```

---

## Task 3: Fix Dialog/Modal Responsiveness

**Files:**
- Modify: `src/index.tsx:210-217` (`.admin-dialog dialog` styles)

**Step 1: Update dialog styles**

Replace the existing `.admin-dialog dialog` styles with:

```css
.admin-dialog dialog {
  border: 1px solid #333;
  border-radius: 0.5rem;
  max-width: 500px;
  width: 90%;
}

/* Mobile: full-width dialog with margin */
@media (max-width: 639px) {
  .admin-dialog dialog {
    max-width: 95vw;
    width: 95%;
    margin: 1rem;
  }

  /* Also fix the inline-styled dialog from new-project endpoint */
  [style*="position: fixed"][style*="max-width: 500px"] {
    max-width: 95vw !important;
    width: 95% !important;
    padding: 1rem !important;
  }
}
```

**Step 2: Commit**

```bash
git add src/index.tsx
git commit -m "style: make dialogs responsive on mobile"
```

---

## Task 4: Wrap Tables in Scrollable Containers (Admin)

**Files:**
- Modify: `src/index.tsx:886-920` (Projects table)
- Modify: `src/index.tsx:950-1000` (Checks table)

**Step 1: Wrap Projects table**

Find the Projects table (around line 886) and wrap it:

```tsx
<!-- Before -->
<table class="striped">
  <thead>...</thead>
  <tbody>...</tbody>
</table>

<!-- After -->
<div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
  <table class="striped">
    <thead>...</thead>
    <tbody>...</tbody>
  </table>
</div>
```

**Step 2: Wrap Checks table (inside expanded project card)**

Find the Checks table inside the expanded card (around line 951) and wrap it similarly.

**Step 3: Commit**

```bash
git add src/index.tsx
git commit -m "style: wrap tables in scrollable containers for mobile"
```

---

## Task 5: Add Container Max-Width for Large Screens

**Files:**
- Modify: `src/index.tsx:251` (`.container` wrapper)

**Step 1: Add max-width to main container**

The main container is at line 251 `<main class="container">`. Add a style:

```css
/* At the end of <style> block */
@media (min-width: 1400px) {
  .container {
    max-width: 1400px;
    margin: 0 auto;
  }
}
```

**Step 2: Commit**

```bash
git add src/index.tsx
git commit -m "style: add max-width for large screens"
```

---

## Task 6: Final Verification

**Step 1: Run type check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 2: Manual testing checklist**

Test on different screen sizes (use browser DevTools):

- **Mobile (375px)**:
  - [ ] Header elements stack vertically
  - [ ] Stats cards show in single column
  - [ ] Project cards show in single column
  - [ ] Maintenance buttons stack vertically
  - [ ] Admin tabs stack vertically
  - [ ] Tables scroll horizontally
  - [ ] Dialog takes 95% width
  - [ ] Settings form shows single column

- **Tablet (768px)**:
  - [ ] Dashboard shows 2 columns
  - [ ] Stats cards show 3 columns
  - [ ] Settings form shows 2 columns
  - [ ] Tables fit without scrolling

- **Desktop (1440px)**:
  - [ ] Dashboard shows auto-fit grid
  - [ ] All elements properly spaced
  - [ ] Container centered on large screens

**Step 3: Fix any issues found**

If issues are found during testing, create additional commits to fix them.

**Step 4: Final commit**

```bash
git add src/index.tsx
git commit -m "style: final RWD adjustments based on testing"
```

---

## Summary of Changes

1. **Mobile (< 640px)**: Single column layouts, stacked buttons, scrollable tables
2. **Tablet (640-1024px)**: 2-3 column grids, balanced layout
3. **Desktop (> 1024px)**: Original layout preserved
4. **Large screens (> 1400px)**: Max-width container for readability

All changes are CSS-only. No HTML structure changes beyond adding scroll wrappers for tables.
