# 🔒 Security Fixes Documentation

## Summary of Changes

This document outlines all security improvements made to the MiniApp Trading Bot.

### Fixed Vulnerabilities

#### 1. ✅ CRON Secret Protection (Critical)
**Status:** Fixed  
**File:** `app/api/engine/run/route.ts`

**Before:**
```typescript
if (!cronSecret) return true;  // ❌ Endpoint accessible without secret!
```

**After:**
```typescript
if (!cronSecret) {
  console.error("CRON_SECRET not configured");
  return false;  // ✅ Requires CRON_SECRET to be set
}
```

**What to do:**
- Set `CRON_SECRET` in `.env` (min 32 characters)
- Use in Authorization header: `Authorization: Bearer YOUR_CRON_SECRET`

Example:
```bash
curl -H "Authorization: Bearer your-cron-secret" https://api.example.com/api/engine/run
```

---

#### 2. ✅ CRON Token in URL Parameters (High)
**Status:** Fixed  
**File:** `app/api/cron/bot/route.ts`

**Before:**
```typescript
const token = String(url.searchParams.get("token") || "").trim();  // ❌ Token in URL logs!
```

**After:**
```typescript
const authHeader = req.headers.get("authorization") || "";  // ✅ Token in header (not logged)
const token = authHeader.slice("Bearer ".length).trim();
```

**What to do:**
- Use Authorization header instead of URL parameters
- Tokens in URLs appear in server logs and browser history

---

#### 3. ✅ Telegram Verification Unified (High)
**Status:** Fixed  
**File:** `app/api/gate/route.ts`

**Before:**
```typescript
// ❌ Local incorrect implementation with HMAC("WebAppData", botToken)
const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
```

**After:**
```typescript
// ✅ Using correct lib/telegram.ts with SHA256(botToken)
import { verifyTelegramInitData } from "@/lib/telegram";
const verified = verifyTelegramInitData(initData, botToken);
```

**What to do:**
- All Telegram verification now uses `lib/telegram.ts`
- Consistent security implementation across all endpoints

---

#### 4. ✅ Session Expiration Check (Medium)
**Status:** Fixed  
**File:** `lib/auth.ts`

**Before:**
```typescript
// ❌ Missing expiration check in some code paths
if (!session) return null;
return session.user;
```

**After:**
```typescript
// ✅ Always check expiration
if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
  return null;  // Session expired
}
return session.user;
```

**What to do:**
- Expired sessions are now properly rejected
- Set `SESSION_TTL_DAYS` in `.env` (default: 30 days)

---

#### 5. ✅ Dev Auth Endpoint Protected (Critical)
**Status:** Fixed  
**File:** `app/api/auth/dev/route.ts`

**Before:**
```typescript
export async function POST() {
  // ❌ No authentication required - COMPLETELY OPEN!
  const user = await prisma.user.upsert({...});
}
```

**After:**
```typescript
export async function POST(req: Request) {
  // ✅ Requires DEV_AUTH_SECRET in Authorization header
  const authHeader = req.headers.get("authorization") || "";
  if (token !== devSecret) {
    return NextResponse.json({ok: false, error: "UNAUTHORIZED"}, {status: 401});
  }
}
```

**What to do:**
- Set `DEV_AUTH_SECRET` in `.env` (min 32 characters)
- Use: `Authorization: Bearer YOUR_DEV_AUTH_SECRET`
- For development only! Keep secret safe.

Example:
```bash
curl -X POST -H "Authorization: Bearer dev-secret-xxx" https://api.example.com/api/auth/dev
```

---

#### 6. ✅ Engine Tick Endpoint Protected (Critical)
**Status:** Fixed  
**File:** `app/api/engine/tick/route.ts`

**Before:**
```typescript
export async function GET() {
  // ❌ Anyone can trigger expensive engine operations!
  const data = await runEngineTick();
}
```

**After:**
```typescript
export async function GET(req: Request) {
  // ✅ Requires valid session (user authentication)
  await requireUser(req);
  const data = await runEngineTick();
}
```

**What to do:**
- Must be called with valid session cookie or Authorization header
- Use your regular session token from login

---

#### 7. ✅ Diagnostics Endpoint Protected (High)
**Status:** Fixed  
**File:** `app/api/diag/route.ts`

**Before:**
```typescript
// ❌ Anyone could see database host, port, username
export async function GET() {
  return NextResponse.json({
    databaseHost: host,
    databasePort: port,
    databaseUser: user,
  });
}
```

**After:**
```typescript
// ✅ Protected by default, optional open access
const enableOpenDiag = process.env.ENABLE_OPEN_DIAG_ENDPOINT === "true";
if (!enableOpenDiag) {
  await requireUser(req);  // Default: requires authentication
}
```

**What to do:**
- Default: requires authentication
- For monitoring: set `ENABLE_OPEN_DIAG_ENDPOINT=true` in `.env`

---

#### 8. ✅ Database Health Endpoint Protected (High)
**Status:** Fixed  
**File:** `app/api/health/db/route.ts`

**Before:**
```typescript
// ❌ Anyone could confirm database is running
export async function GET() {
  const now = await prisma.$queryRaw`SELECT NOW()`;
}
```

**After:**
```typescript
// ✅ Protected by default
const enableOpenHealth = process.env.ENABLE_OPEN_HEALTH_ENDPOINT === "true";
if (!enableOpenHealth) {
  await requireUser(req);
}
```

**What to do:**
- Default: requires authentication
- For health checks: set `ENABLE_OPEN_HEALTH_ENDPOINT=true`

---

#### 9. ✅ Test Endpoint Protected (Medium)
**Status:** Fixed  
**File:** `app/api/test-telegram/route.ts`

**Before:**
```typescript
// ❌ Publicly accessible test endpoint leaked user data
export async function GET() {
  const user = await prisma.user.findFirst({where: {username: "KMlynarchik"}});
}
```

**After:**
```typescript
// ✅ Protected by default
const enableTestEndpoints = process.env.ENABLE_TEST_ENDPOINTS === "true";
if (!enableTestEndpoints) {
  await requireUser(req);
}
```

**What to do:**
- Default: requires authentication
- For testing: set `ENABLE_TEST_ENDPOINTS=true`

---

## 🔐 Security Environment Variables

Add these to your `.env` file:

### Required
```env
# Must be set - random string, min 32 chars
CRON_SECRET="generate-random-32-char-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Dev endpoint secret - min 32 chars (keep very secure!)
DEV_AUTH_SECRET="another-random-32-char-secret-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Encryption key - exactly 64 hex chars (32 bytes)
SECRET_BOX_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
```

### Optional (for monitoring)
```env
# If you have external monitoring, enable these:
# ENABLE_OPEN_DIAG_ENDPOINT=true
# ENABLE_OPEN_HEALTH_ENDPOINT=true
# ENABLE_TEST_ENDPOINTS=true
```

## 🚀 Usage Examples

### Dev Authentication
```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_DEV_AUTH_SECRET" \
  https://api.example.com/api/auth/dev
```

### CRON Engine Run
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://api.example.com/api/engine/run
```

### CRON Bot Sync
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://api.example.com/api/cron/bot
```

## ⚠️ Important Notes

1. **Secrets in .env**: Never commit `.env` to git. Use `.env.local` and `.gitignore`
2. **CRON_SECRET**: If not set, CRON endpoints will return 503 error
3. **DEV_AUTH_SECRET**: Only for development. Rotate regularly in production
4. **Monitoring**: Before enabling open endpoints, ensure you have other security (IP whitelist, etc.)
5. **Logs**: Be careful not to log sensitive tokens. Current implementation avoids this.

## ✅ Verification Checklist

After deployment:

- [ ] All `.env` variables are set
- [ ] No test endpoints enabled in production
- [ ] CRON jobs updated to use Authorization header
- [ ] Monitoring endpoints have proper access control
- [ ] Logs checked for any token leakage
- [ ] Session tokens working correctly
- [ ] Bot functionality unchanged

## 📊 Security Status

| Component | Status | Notes |
|-----------|--------|-------|
| CRON Secret | ✅ Protected | Requires CRON_SECRET env var |
| Dev Auth | ✅ Protected | Requires DEV_AUTH_SECRET |
| Engine Tick | ✅ Protected | Requires user authentication |
| Diag Endpoint | ✅ Protected | Default requires auth |
| Health Check | ✅ Protected | Default requires auth |
| Test Endpoint | ✅ Protected | Default requires auth |
| Telegram Verify | ✅ Unified | Using lib/telegram.ts |
| Session Check | ✅ Fixed | Expiration verified |

---

**Last Updated:** 2026-05-07  
**Fixes Applied:** 9 critical/high vulnerabilities
