# Fix Checks Tab HTML Escaping Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the Checks tab in the Admin dashboard where nested `html``` template strings are being HTML-escaped and displayed as plain text instead of rendered as interactive HTML elements.

**Architecture:** The issue occurs because Hono's `html` function escapes HTML by default. When using `.map()` to generate HTML snippets that are embedded within another `html` template, the inner HTML gets escaped. The solution is to use Hono's `raw()` function to wrap the inner HTML content so it's not escaped.

**Tech Stack:** Hono v4+, Hono JSX, Cloudflare Workers, TypeScript

---

### Task 1: Import `raw` function from `hono/html`

**Files:**
- Modify: `src/index.tsx:6`

**Step 1: Add `raw` to the existing import statement**

The current import is:
```typescript
import { html } from 'hono/html';
```

Change to:
```typescript
import { html, raw } from 'hono/html';
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/index.tsx
git commit -m "feat: import raw function from hono/html for unescaped HTML"
```

---

### Task 2: Wrap `.map()` results with `raw()` in Checks Tab

**Files:**
- Modify: `src/index.tsx:930-1003`

**Step 1: Update the project cards generation to use `raw()`**

Find the `checks-list` section and wrap the `.map().join('')` result with `raw()`:

Current code (line 929-1004):
```typescript
    <div class="checks-list">
      ${projectsWithChecks
        .filter((p: any) => true)
        .map((p: any) => {
          // ... full html template
        })
        .join('')}
    </div>
```

Change to:
```typescript
    <div class="checks-list">
      ${raw(projectsWithChecks
        .filter((p: any) => true)
        .map((p: any) => {
          const statusOrder: any = { dead: 3, error: 2, ok: 1 };
          const sortedChecks = [...p.checks].sort((a: any, b: any) => statusOrder[b.status] - statusOrder[a.status]);
          return html`<div class="project-card" x-data="{ expanded: false }" x-show="filterProject === 'all' || filterProject === '${p.id}'">
      <div
        @click="expanded = !expanded"
        style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #2a2a2a; border-radius: 0.5rem; cursor: pointer; border-left: 4px solid ${p.projectStatus === 'dead' ? '#e74c3c' : p.projectStatus === 'error' ? '#f39c12' : '#2ecc71'};"
      >
        <div style="display: flex; align-items: center; gap: 1rem;">
          <span x-text="expanded ? '▼' : '▶'" style="font-size: 1.5rem;"></span>
          <div>
            <div style="font-weight: bold;">${p.display_name}</div>
            <small style="color: #888;">${p.checks.length} checks</small>
          </div>
        </div>
        <span class="status-badge ${p.projectStatus}">${p.projectStatus.toUpperCase()}</span>
      </div>

      <div x-show="expanded" style="margin-top: 0.5rem; padding: 0 1rem 1rem 1rem; background: #1a1a1a; border-radius: 0 0 0.5rem 0.5rem;">
        <table class="striped" style="font-size: 0.8rem;">
          <thead>
            <tr>
              <th>Check Name</th>
              <th>Type</th>
              <th>Interval</th>
              <th>Grace</th>
              <th>Threshold</th>
              <th>Cooldown</th>
              <th>Status</th>
              <th>Monitor</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${sortedChecks.map((check: any) => html`
              <tr>
                <td>${check.display_name || check.name}</td>
                <td>${check.type}</td>
                <td>${check.interval}s</td>
                <td>${check.grace}s</td>
                <td>${check.threshold}</td>
                <td>${check.cooldown}s</td>
                <td>
                  <span class="status-badge ${check.status}">${check.status}</span>
                </td>
                <td style="text-align: center;">
                  <input
                    type="checkbox"
                    ${check.monitor ? 'checked' : ''}
                    hx-post="/admin/checks/${check.id}/toggle"
                    hx-vals='{"monitor": ${check.monitor ? 0 : 1}}'
                    hx-swap="none"
                  />
                </td>
                <td>
                  <button
                    hx-delete="/admin/checks/${check.id}"
                    hx-confirm="確認刪除檢查「${check.display_name || check.name}」？此操作無法復原。"
                    hx-headers='{"X-Requested-With": "XMLHttpRequest"}'
                    hx-on::after-request="if(this.getResponseHeader('X-Deleted') === 'true') window.location.href='/admin'"
                    class="outline secondary"
                    style="font-size: 0.7rem;"
                  >Delete</button>
                </td>
              </tr>
            `)}
          </tbody>
        </table>
      </div>
    </div>`}).join(''))}
    </div>
```

**Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Deploy to production**

Run: `npx wrangler deploy`
Expected: Deployment succeeds with URL https://watch-dog.paipeter-gui.workers.dev

**Step 4: Manual verification test**

1. Visit https://watch-dog.paipeter-gui.workers.dev/admin
2. Click on "Checks" tab
3. Verify:
   - Project cards are rendered as interactive HTML elements (not plain text)
   - Arrow icons (▶/▼) are clickable and toggle
   - Clicking a project card expands/collapses the checks table
   - Filter dropdown works correctly

**Step 5: Commit**

```bash
git add src/index.tsx
git commit -m "fix: use raw() to prevent HTML escaping in nested map for Checks tab"
```

---

### Task 3: Verify No Similar Issues in Other Tabs

**Files:**
- Review: `src/index.tsx:876-917` (Projects Tab)
- Review: `src/index.tsx:805-873` (Settings Tab)

**Step 1: Check Settings tab for nested `.map()` patterns**

Search for: `settings tab` section in `/admin` route
Verify: No nested `.map()` inside `html``` templates that might be escaped

Expected result: Settings tab uses form inputs directly, no dynamic HTML generation

**Step 2: Check Projects tab for nested `.map()` patterns**

Search for: Projects tab section (around line 876)
Current code uses:
```typescript
${projectsWithChecks.map(p => html`
  <tr>
    ...
  </tr>
`)}
```

This is INSIDE a `<tbody>` tag which is already within an `html``` template.
This works because `<tbody>` is a standard HTML element that handles child nodes correctly.

**Step 3: Verify Projects tab renders correctly**

Manual test: Visit /admin and check Projects tab shows table rows correctly

Expected result: Projects tab works (no changes needed)

**Step 4: Document findings**

If no issues found, commit a note:
```bash
git commit --allow-empty -m "test: verified Settings and Projects tabs render correctly"
```

---

### Task 4: Final Integration Test

**Files:**
- Test: Manual browser testing

**Step 1: Full admin page functionality test**

1. Visit https://watch-dog.paipeter-gui.workers.dev/admin
2. Test each tab:
   - **Settings**: Edit Slack settings, click Save, verify success message
   - **Projects**: View projects list, create new project, delete project
   - **Checks**: Use project filter, click project cards to expand, toggle Monitor checkboxes, delete checks

**Step 2: Verify Alpine.js functionality**

- Tab switching works (Settings/Projects/Checks buttons)
- Project filter dropdown works
- Project card expand/collapse toggles arrow icon
- Monitor checkbox toggles without page reload

**Step 3: Verify HTMX functionality**

- Save Settings button returns success message inline
- Delete buttons show confirmation dialog
- After deletion, page redirects correctly

**Step 4: Create test documentation**

Add a note to `docs/usage.md` or create `docs/testing.md`:
```markdown
## Admin Dashboard Testing

Manual testing checklist for /admin page:

- [ ] Tab switching works
- [ ] Settings save successfully
- [ ] Projects list displays correctly
- [ ] Checks filter works
- [ ] Project cards expand/collapse
- [ ] Monitor checkboxes toggle
- [ ] Delete buttons show confirmation
```

**Step 5: Commit documentation**

```bash
git add docs/
git commit -m "docs: add admin dashboard testing checklist"
```

---

## Summary

This plan fixes the HTML escaping issue in the Checks tab by using Hono's `raw()` function. The key insight is that nested `html``` templates within `.map()` functions need to be wrapped with `raw()` to prevent double-escaping.

**Root Cause:** Hono's `html` function escapes HTML content by default for security. When `.map()` returns HTML strings that are embedded in another template, they get escaped again, resulting in plain text display.

**Solution:** Import and use `raw()` from `hono/html` to wrap the `.map().join('')` result, telling Hono not to escape the already-formatted HTML.
