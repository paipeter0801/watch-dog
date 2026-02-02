# Fix Admin UI Issues

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix HTML escaping issues in Admin UI where table rows are rendered as plain text instead of HTML elements.

**Architecture:** The problem is `.join('')` on Hono html` template arrays converts them to plain strings, which get HTML-escaped. Remove `.join('')` calls and let Hono handle arrays directly.

**Tech Stack:** Hono JSX, TypeScript, Cloudflare Workers

---

## Task 1: Fix Projects Table HTML Escaping

**Files:**
- Modify: `src/index.tsx:884-901`

**Problem:** The Projects table uses `.join('')` which converts html` templates to plain strings.

**Step 1: Remove .join('') from projects table**

Find line 901:
```typescript
`).join('')}
```

Replace with:
```typescript
        `)}
```

The map function returns an array of html` templates. Hono's html` function can handle arrays directly, so no join is needed.

**Step 2: Verify the change**

After the change, lines 884-901 should look like:
```typescript
${projectsWithChecks.map(p => html`
  <tr>
    <td>${p.display_name}</td>
    <td><code>${p.id}</code></td>
    <td>${p.checks.length}</td>
    <td>${p.maintenance_until > 0 ? new Date(p.maintenance_until * 1000).toLocaleString() : 'Not in maintenance'}</td>
    <td>
      <button
        hx-delete="/admin/projects/${p.id}"
        hx-confirm="Are you sure? This will delete the project and all its checks."
        hx-headers='{"X-Requested-With": "XMLHttpRequest"}'
        hx-on::after-request="if(this.getResponseHeader('X-Deleted') === 'true') window.location.href='/admin'"
        class="outline secondary"
        style="font-size: 0.75rem;"
      >Delete</button>
    </td>
  </tr>
`)}
```

**Step 3: Commit**

```bash
git add src/index.tsx
git commit -m "fix: remove .join() from projects table to fix HTML escaping"
```

---

## Task 2: Fix Checks Table HTML Escaping

**Files:**
- Modify: `src/index.tsx:921-948`

**Problem:** The Checks table also uses `.join('')` which converts html` templates to plain strings.

**Step 1: Remove .join('') from checks table**

Find line 948:
```typescript
`).join('')}
```

Replace with:
```typescript
        `)}
```

**Step 2: Verify the change**

After the change, lines 921-948 should look like:
```typescript
${checks.map(check => html`
  <tr>
    <td>${check.display_name || check.name}</td>
    <td><code>${check.id}</code></td>
    <td>${check.type}</td>
    <td>${check.type === 'heartbeat' ? `${check.interval}s` : 'N/A'}</td>
    <td>
      <span class="status-badge ${check.status}">${check.status}</span>
    </td>
    <td>
      <button
        hx-get="/admin/checks/${check.id}/edit"
        hx-target="#modal-container"
        hx-swap="innerHTML"
        class="outline secondary"
        style="font-size: 0.75rem;"
      >Edit</button>
      <button
        hx-delete="/admin/checks/${check.id}"
        hx-confirm="Are you sure?"
        hx-headers='{"X-Requested-With": "XMLHttpRequest"}'
        hx-on::after-request="if(this.getResponseHeader('X-Deleted') === 'true') window.location.href='/admin'"
        class="outline secondary"
        style="font-size: 0.75rem;"
      >Delete</button>
    </td>
  </tr>
`)}
```

**Step 3: Commit**

```bash
git add src/index.tsx
git commit -m "fix: remove .join() from checks table to fix HTML escaping"
```

---

## Task 3: Test Admin UI

**Step 1: Deploy**

```bash
npx wrangler deploy
```

**Step 2: Verify all three tabs work**

1. Visit `/admin`
2. Click **Settings** tab - form should display correctly
3. Click **Projects** tab - table should show rows (not raw HTML)
4. Click **Checks** tab - table should show rows (not raw HTML)

**Step 3: Test interactions**

1. Click "New Project" button - modal should appear
2. Click "Edit" on a check - modal should appear
3. Verify tables render properly with all buttons visible

**Step 4: Commit**

```bash
git commit --allow-empty -m "test: verified admin UI HTML rendering fixed"
```

---

## Summary

This plan fixes the HTML escaping issue in the Admin UI by removing `.join('')` calls on html` template arrays. Hono's html` function natively handles arrays of HtmlEscapedString, so joining them into strings causes them to be re-escaped.

**Total tasks:** 3
**Estimated commits:** 3

**Key insight:** In Hono JSX, never use `.join('')` on arrays of html` templates. Let Hono handle the array directly.
