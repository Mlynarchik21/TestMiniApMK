# 🧪 Testing Checklist - Verify Bot Still Works

## Before Testing
- [ ] Update `.env` with all required secrets (CRON_SECRET, DEV_AUTH_SECRET, SECRET_BOX_KEY)
- [ ] Run `npm run build` to check for TypeScript errors
- [ ] Start dev server: `npm run dev`

---

## ✅ Authentication Flow

### Telegram Login
- [ ] User can login via Telegram Mini App
- [ ] Session token is created and stored in cookie
- [ ] User can access authenticated endpoints
- [ ] Token is properly hashed in database

### Dev Login (if needed)
```bash
# Test dev endpoint with secret
curl -X POST \
  -H "Authorization: Bearer YOUR_DEV_AUTH_SECRET" \
  http://localhost:3000/api/auth/dev
```
- [ ] Returns `{ok: true}` when correct secret provided
- [ ] Returns 401 when secret is missing
- [ ] Returns 401 when secret is wrong
- [ ] Session token is created

---

## 🔐 Protected Endpoints

### Engine Tick
```bash
# Should fail without auth
curl http://localhost:3000/api/engine/tick
# Should return 401 UNAUTHORIZED

# Should succeed with session cookie or Bearer token
curl -H "Cookie: session=YOUR_TOKEN" http://localhost:3000/api/engine/tick
# Should return engine data
```
- [ ] Returns 401 without authentication
- [ ] Works with valid session cookie
- [ ] Works with valid Bearer token
- [ ] Actually executes engine tick (no errors)

### Diagnostics (Default Protected)
```bash
# Should fail without auth
curl http://localhost:3000/api/diag
# Should return 401 UNAUTHORIZED

# Enable open access for testing
# ENABLE_OPEN_DIAG_ENDPOINT=true
curl http://localhost:3000/api/diag
# Should return diagnostics info
```
- [ ] Returns 401 without auth (default)
- [ ] Shows database info when auth provided
- [ ] Can be opened with `ENABLE_OPEN_DIAG_ENDPOINT=true`

### Health Check (Default Protected)
```bash
# Should fail without auth
curl http://localhost:3000/api/health/db
# Should return 401 UNAUTHORIZED
```
- [ ] Returns 401 without auth (default)
- [ ] Returns `{ok: true, db: true}` with valid auth

### Test Telegram (Default Protected)
```bash
# Should fail without auth
curl http://localhost:3000/api/test-telegram
# Should return 401 UNAUTHORIZED
```
- [ ] Returns 401 without auth (default)
- [ ] Sends test message when auth provided

---

## 🤖 Bot Functionality (CRITICAL - Must Not Break)

### Bot Configuration
- [ ] Can create bot config via `/api/bot` (POST)
- [ ] Can get bot status via `/api/bot` (GET)
- [ ] Can start bot via `/api/bot/start`
- [ ] Can stop bot via `/api/bot/stop`

### API Keys Management
- [ ] Can add new exchange keys via `/api/keys` (POST)
- [ ] API keys are encrypted properly
- [ ] Can list keys via `/api/keys` (GET)
- [ ] Can delete keys via `/api/keys/[id]` (DELETE)
- [ ] Keys work with exchanges (balance checks pass)

### Trading
- [ ] Can open manual trades
- [ ] Can close manual trades
- [ ] Trade history is recorded
- [ ] Bot can auto-trade (if enabled)
- [ ] Positions are tracked correctly

### CRON Jobs
```bash
# Test engine run with CRON_SECRET
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/engine/run

# Test bot sync with CRON_SECRET
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  http://localhost:3000/api/cron/bot
```
- [ ] Returns 401 without secret
- [ ] Returns 500 if CRON_SECRET not configured
- [ ] Returns 200 with correct secret
- [ ] Actually executes engine operations

---

## 🔒 Security Verification

### CRON Security
- [ ] CRON_SECRET is required (no default fallback)
- [ ] CRON endpoints reject request without Bearer token
- [ ] CRON endpoints reject wrong token

### Dev Auth Security
- [ ] `/api/auth/dev` requires DEV_AUTH_SECRET
- [ ] `/api/auth/dev` rejects missing Bearer token
- [ ] `/api/auth/dev` rejects wrong secret
- [ ] Dev login logs appear in console (check logs)

### Session Security
- [ ] Expired sessions are rejected
- [ ] Session tokens are hashed in database
- [ ] Session tokens are httpOnly cookies
- [ ] New session created each login

### Telegram Verification
- [ ] Using unified `lib/telegram.ts` verification
- [ ] Correct HMAC-SHA256 calculation
- [ ] Auth date freshness checked (24 hours)

---

## 📊 Database Checks

```bash
# Check in psql or database tool
SELECT * FROM "Session" LIMIT 5;
# Verify: 'token' field contains hashes, not plain tokens

SELECT * FROM "User" LIMIT 5;
# Verify: User data looks normal

SELECT * FROM "UserKey" LIMIT 5;
# Verify: 'apiKey' field - check if encrypted or plain
#         'secretEnc' field - should be encrypted (format: iv:tag:cipher)
```
- [ ] Sessions have hashed tokens
- [ ] Users created/updated correctly
- [ ] API keys are stored (not corrupted)

---

## 🐛 Error Handling

- [ ] Errors return appropriate HTTP status codes
- [ ] Error messages don't leak sensitive info (in production)
- [ ] Endpoints handle missing env variables gracefully
- [ ] Database errors don't crash application

---

## 📝 Logging

Check console/logs for:
- [ ] No hardcoded secrets in logs
- [ ] No API keys in logs
- [ ] Successful auth logs
- [ ] Failed auth attempts logged
- [ ] `[DEV_AUTH]` prefix for dev auth attempts
- [ ] CRON execution logs

---

## 🚀 Performance

- [ ] Bot still trades at expected frequency
- [ ] No memory leaks (check Node process memory)
- [ ] Database queries execute quickly
- [ ] No timeout issues

---

## ✅ Final Checklist

- [ ] All tests passed
- [ ] Bot functionality unchanged
- [ ] No new errors in console
- [ ] Security features working
- [ ] Ready for production

---

## 🆘 If Something Breaks

### Issue: 401 UNAUTHORIZED on trading endpoints
- [ ] Check if user is logged in (has valid session)
- [ ] Check if session token is in cookie or Authorization header
- [ ] Check if session hasn't expired (`SESSION_TTL_DAYS`)

### Issue: CRON endpoints failing
- [ ] Check CRON_SECRET is set in `.env`
- [ ] Check Authorization header format: `Bearer YOUR_SECRET`
- [ ] Check secret is passed correctly in cron job configuration

### Issue: Dev login failing
- [ ] Check DEV_AUTH_SECRET is set in `.env`
- [ ] Check format: `Authorization: Bearer YOUR_SECRET`
- [ ] Check if dev endpoint is actually needed (not production)

### Issue: Bot not executing
- [ ] Check `/api/engine/tick` is not returning 401
- [ ] Check CRON jobs are calling with proper auth
- [ ] Check engine logic hasn't changed (should be same)

---

## 📞 Need Help?

See `SECURITY_FIXES.md` for detailed explanations of each change.
