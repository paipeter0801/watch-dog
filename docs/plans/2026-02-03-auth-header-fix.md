# Auth Header Consistency Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Unify authentication header format across Workers API, client SDK, and documentation to use `Authorization: Bearer {token}`

**Architecture:** Modify the API endpoints in `src/index.tsx` to extract token from `Authorization` header instead of `X-Project-Token` header. The Python SDK and documentation already use the correct format.

**Tech Stack:** TypeScript, Hono framework, Cloudflare Workers

---

## Task 1: Modify PUT /api/config endpoint

**Files:**
- Modify: `src/index.tsx:644-646`

**Step 1: Write the failing test**

First, let's verify the current behavior with a test using the correct header format.

Run: `npm run dev` (in separate terminal)

Then run:
```bash
curl -X PUT http://localhost:8787/api/config \
  -H "Authorization: Bearer test-token-123" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"test","display_name":"Test","checks":[]}'
```

Expected: FAIL with `401` or `Missing X-Project-Token header` (current buggy behavior)

**Step 2: Modify the header extraction in PUT /api/config**

Change line 644 in `src/index.tsx` from:
```typescript
const token = c.req.header('X-Project-Token');
```

To:
```typescript
// Support both Authorization: Bearer and legacy X-Project-Token
const authHeader = c.req.header('Authorization');
let token: string | undefined;

if (authHeader?.startsWith('Bearer ')) {
  token = authHeader.slice(7);
} else {
  // Fallback to legacy header for backward compatibility
  token = c.req.header('X-Project-Token');
}
```

**Step 3: Update the error message**

Change line 646 in `src/index.tsx` from:
```typescript
return c.json({ error: 'Missing X-Project-Token header' }, 401);
```

To:
```typescript
return c.json({ error: 'Missing Authorization header (use: Authorization: Bearer {token})' }, 401);
```

**Step 4: Test the fix**

Run:
```bash
curl -X PUT http://localhost:8787/api/config \
  -H "Authorization: Bearer test-token-123" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"test","display_name":"Test","checks":[{"name":"health","display_name":"Health","type":"heartbeat","interval":60}]}'
```

Expected: SUCCESS with `{"success":true,...}`

**Step 5: Commit**

```bash
git add src/index.tsx
git commit -m "fix: support Authorization: Bearer header in /api/config endpoint"
```

---

## Task 2: Modify POST /api/pulse endpoint

**Files:**
- Modify: `src/index.tsx:767-770`

**Step 1: Write the failing test**

Run:
```bash
curl -X POST http://localhost:8787/api/pulse \
  -H "Authorization: Bearer test-token-123" \
  -H "Content-Type: application/json" \
  -d '{"check_name":"health","status":"ok"}'
```

Expected: FAIL with `401` or `Missing X-Project-Token header` (current buggy behavior)

**Step 2: Modify the header extraction in POST /api/pulse**

Change line 767 in `src/index.tsx` from:
```typescript
const token = c.req.header('X-Project-Token');
```

To:
```typescript
// Support both Authorization: Bearer and legacy X-Project-Token
const authHeader = c.req.header('Authorization');
let token: string | undefined;

if (authHeader?.startsWith('Bearer ')) {
  token = authHeader.slice(7);
} else {
  // Fallback to legacy header for backward compatibility
  token = c.req.header('X-Project-Token');
}
```

**Step 3: Update the error message**

Change line 769 in `src/index.tsx` from:
```typescript
return c.json({ error: 'Missing X-Project-Token header' }, 401);
```

To:
```typescript
return c.json({ error: 'Missing Authorization header (use: Authorization: Bearer {token})' }, 401);
```

**Step 4: Test the fix**

First, register a check (if not already done):
```bash
curl -X PUT http://localhost:8787/api/config \
  -H "Authorization: Bearer test-token-123" \
  -H "Content-Type: application/json" \
  -d '{"project_id":"test","display_name":"Test","checks":[{"name":"health","display_name":"Health","type":"heartbeat","interval":60}]}'
```

Then test pulse:
```bash
curl -X POST http://localhost:8787/api/pulse \
  -H "Authorization: Bearer test-token-123" \
  -H "Content-Type: application/json" \
  -d '{"check_name":"health","status":"ok","latency":50}'
```

Expected: SUCCESS with `{"success":true,"check_id":"test:health",...}`

**Step 5: Commit**

```bash
git add src/index.tsx
git commit -m "fix: support Authorization: Bearer header in /api/pulse endpoint"
```

---

## Task 3: Verify Python client SDK works

**Files:**
- Test: `src/client_example.py`

**Step 1: Test Python SDK locally**

Run Python to verify the SDK works with the updated API:
```python
from src.client_example import WatchDog

wd = WatchDog(
    base_url="http://localhost:8787",
    project_token="test-token-123"
)

# Register checks
wd.register([{
    "name": "sdk_test",
    "display_name": "SDK Test",
    "type": "heartbeat",
    "interval": 60
}])

# Send pulse
import time
time.sleep(1)  # Wait for registration
wd.pulse("sdk_test", status="ok", latency=100)

print("SDK test completed - check dashboard at http://localhost:8787/admin")
```

Expected: No errors, check appears in admin dashboard

**Step 2: Verify no changes needed to SDK**

The `src/client_example.py` already uses `Authorization: Bearer {token}` format (line 92), so no changes are needed.

**Step 3: Commit (if any changes)**

No changes expected - document verification:
```bash
# No git commit needed - SDK was already correct
```

---

## Task 4: Deploy and verify

**Files:**
- Deploy: All changed files

**Step 1: Deploy to Cloudflare Workers**

```bash
npx wrangler deploy
```

Expected: Deployment success message

**Step 2: Test against production API**

```bash
# Replace with your actual production URL and token
curl -X POST https://watch-dog.paipeter-gui.workers.dev/api/pulse \
  -H "Authorization: Bearer YOUR_ACTUAL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"check_name":"production_test","status":"ok"}'
```

Expected: SUCCESS response

**Step 3: Verify documentation is accurate**

The documentation in `docs/usage.md` already shows the correct `Authorization: Bearer` format. No changes needed.

**Step 4: Final commit**

```bash
# Create a tag for this fix
git tag -a v1.0.1 -m "fix: unify auth header to use Authorization: Bearer format"
git push origin main --tags
```

---

## Summary of Changes

| File | Changes |
|------|---------|
| `src/index.tsx` | Modify `/api/config` and `/api/pulse` to support `Authorization: Bearer` header |
| `src/client_example.py` | No change (already correct) |
| `docs/usage.md` | No change (already correct) |

## Verification Checklist

- [ ] Local test with `Authorization: Bearer` succeeds
- [ ] Python SDK works with updated API
- [ ] Legacy `X-Project-Token` header still works (backward compatibility)
- [ ] Deployed to production
- [ ] Production API responds to `Authorization: Bearer`
- [ ] Documentation matches implementation
