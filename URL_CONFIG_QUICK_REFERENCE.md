# URL Configuration System - Quick Reference

## 🔗 API Endpoints Cheat Sheet

```bash
# Active configuration
GET  /api/url-config/active

# Profiles
GET  /api/url-config/profiles
GET  /api/url-config/profiles/:id
POST /api/url-config/profiles
DEL  /api/url-config/profiles/:id

# Profile operations
PUT  /api/url-config/profiles/:id/switch

# URL resolution
POST /api/url-config/resolve-api  (body: { endpoint })
POST /api/url-config/resolve-app  (body: { endpoint })

# Testing
GET  /api/url-config/test-connectivity
```

## 🎣 React Hooks Cheat Sheet

```typescript
// Get active config + switch
const { config, switchProfile } = useUrlConfig();

// List all profiles
const { profiles } = useUrlProfiles();

// Create profile
const create = useCreateUrlProfile();
create.mutateAsync({ id, name, appBaseUrl, apiBaseUrl });

// Delete profile
const del = useDeleteUrlProfile();
del.mutateAsync(profileId);

// Test connectivity
const test = useTestUrlConnectivity();
test.mutateAsync();

// Standalone helpers
await resolveApiUrl('/users');
await resolveAppUrl('/dashboard');
```

## 📦 Utilities Cheat Sheet

```typescript
import { resolveUrl, parseUrl, URLManager } from '@/server/config/urlManager';

// Join URLs
resolveUrl('http://api.com/v1', '/users');
// → 'http://api.com/v1/users'

// Advanced resolution
resolveUrlAdvanced({
  baseUrl: 'http://api.com',
  endpoint: '/users',
  queryParams: { page: 1 },
  includeTrailingSlash: true
});

// Parse URL
const parsed = parseUrl('http://api.com:8080/v1/users');
// → { protocol, host, port, basePath, pathname, query }

// URL Manager
const manager = new URLManager('http://app.com', 'http://api.com');
manager.getActiveProfile();
manager.switchProfile('staging');
manager.getAllProfiles();
```

## 🛠️ TypeScript Types

```typescript
interface EnvironmentProfile {
  id: string;
  name: string;
  appBaseUrl: string;
  apiBaseUrl: string;
  isDefault?: boolean;
  description?: string;
}

interface URLConfigState {
  activeProfileId: string;
  appBaseUrl: string;
  apiBaseUrl: string;
  allProfiles: EnvironmentProfile[];
}
```

## 📋 Integration Steps (30 seconds)

1. **Copy files**
```bash
cp server/config/*.ts your-project/server/config/
cp server/routes/urlConfig.ts your-project/server/routes/
cp web/src/lib/useUrlConfig.ts your-project/web/src/lib/
cp web/src/components/URLConfigPanel.tsx your-project/web/src/components/
```

2. **Init backend** (in `server/index.ts`)
```typescript
import { createUrlConfigRouter } from "./routes/urlConfig.js";
app.use("/api/url-config", createUrlConfigRouter(db, config));
```

3. **Add UI** (in `web/src/pages/Settings.tsx`)
```tsx
import { URLConfigPanel } from "@/components/URLConfigPanel";
// Add to JSX:
<URLConfigPanel />
```

4. **Done!** Test: `curl http://localhost:4701/api/url-config/active`

## 🧪 Testing Commands

```bash
# Get active config
curl http://localhost:4701/api/url-config/active

# Create profile
curl -X POST http://localhost:4701/api/url-config/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "id":"qa",
    "name":"QA",
    "appBaseUrl":"http://qa.com",
    "apiBaseUrl":"http://api.qa.com"
  }'

# Switch profile
curl -X PUT http://localhost:4701/api/url-config/profiles/qa/switch

# Test connectivity
curl http://localhost:4701/api/url-config/test-connectivity

# Resolve URL
curl -X POST http://localhost:4701/api/url-config/resolve-api \
  -H "Content-Type: application/json" \
  -d '{"endpoint":"/users"}'
```

## 🎯 Common Patterns

### Pattern 1: Auto-Switch Profile on Login
```typescript
function useAutoProfileSwitch(env: string) {
  useEffect(() => {
    switchProfile(env);
  }, [env]);
}
```

### Pattern 2: Verify Before Running Tests
```typescript
async function runTests() {
  const { api } = await testConnectivity();
  if (!api.reachable) throw new Error('API unreachable');
  // proceed
}
```

### Pattern 3: Environment Selector
```typescript
function EnvSelector() {
  const { profiles } = useUrlProfiles();
  const { switchProfile } = useUrlConfig();
  
  return (
    <select onChange={(e) => switchProfile(e.target.value)}>
      {profiles.map(p => <option key={p.id}>{p.name}</option>)}
    </select>
  );
}
```

### Pattern 4: HTTP Client with URL Config
```typescript
async function fetchFromApp(endpoint: string) {
  const url = await resolveAppUrl(endpoint);
  return fetch(url);
}
```

## 🚨 Common Mistakes

| ❌ Wrong | ✅ Right |
|---------|---------|
| `resolveUrl('http://api.com/', '/users')` | `resolveUrl('http://api.com', '/users')` |
| `resolveUrl('http://api.com', 'users')` | `resolveUrl('http://api.com', '/users')` |
| Delete active profile | Delete a different profile first |
| No validation on URLs | Use `new URL(string)` to validate |
| Hardcoded URLs in components | Use hooks: `useUrlConfig()` |

## 📊 Default Profiles

| Profile | App URL | API URL |
|---------|---------|---------|
| local | http://localhost:5000 | http://localhost:8084/fidar/sdk/api |
| staging | http://localhost:5001 | http://localhost:8085/fidar/sdk/api |
| production | https://app.prod.com | https://api.prod.com/fidar/sdk/api |

## 🔍 Debugging

```typescript
// In browser console:
// Get current config
fetch('/api/url-config/active').then(r => r.json()).then(console.log);

// List profiles
fetch('/api/url-config/profiles').then(r => r.json()).then(console.log);

// Test connectivity
fetch('/api/url-config/test-connectivity').then(r => r.json()).then(console.log);

// Resolve URL
fetch('/api/url-config/resolve-api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ endpoint: '/users' })
}).then(r => r.json()).then(console.log);
```

## 📚 File Structure

```
server/config/
  ├── urlManager.ts              # Core URL utilities
  ├── urlConfigService.ts        # Service layer
  └── urlProfileSchema.ts        # Database schema

server/routes/
  └── urlConfig.ts              # Express routes

web/src/lib/
  ├── useUrlConfig.ts           # React hooks
  ├── apiWithUrlConfig.ts       # Example HTTP client
  └── types.ts                  # TypeScript types

web/src/components/
  └── URLConfigPanel.tsx        # UI component

Documentation/
  ├── URL_CONFIG_README.md           # Overview
  ├── URL_CONFIG_IMPLEMENTATION.md   # Detailed guide
  ├── INTEGRATION_CHECKLIST.md       # Step-by-step
  └── URL_CONFIG_QUICK_REFERENCE.md  # This file
```

## ⚡ Performance Tips

- Profiles are cached in React Query (5s stale time)
- URL resolution is O(1) operation
- Cache resolved URLs instead of resolving repeatedly
- Test connectivity sparingly (it's a network call)

## 🔐 Security Checklist

- [ ] No hardcoded credentials in profile URLs
- [ ] Use HTTPS for production profiles
- [ ] Validate all URLs before storing
- [ ] Consider protecting /api/url-config routes
- [ ] Log profile switches for audit trail

## 📖 Full Documentation

- **URL_CONFIG_README.md** — Overview and features
- **URL_CONFIG_IMPLEMENTATION.md** — Complete technical guide
- **INTEGRATION_CHECKLIST.md** — Step-by-step integration

## 🎓 Learn More

- **TypeScript URL API**: `new URL(urlString)`
- **React Query**: Caching, mutations, invalidation
- **Express**: Routing, middleware patterns
- **SQLite**: Schema design, indexing

## 💬 Example: Complete Workflow

```typescript
// 1. Get current config
const { config } = useUrlConfig();
console.log(config.activeProfileId); // 'local'

// 2. List available profiles
const { profiles } = useUrlProfiles();
profiles.forEach(p => console.log(p.name));

// 3. Create new profile
const create = useCreateUrlProfile();
await create.mutateAsync({
  id: 'custom',
  name: 'My Custom Env',
  appBaseUrl: 'http://custom.com',
  apiBaseUrl: 'http://api.custom.com'
});

// 4. Switch to new profile
const { switchProfile } = useUrlConfig();
switchProfile('custom');

// 5. Test connectivity
const test = useTestUrlConnectivity();
const result = await test.mutateAsync();
if (result.api.reachable) {
  console.log('✓ API is online!');
}

// 6. Resolve and fetch
const userUrl = await resolveApiUrl('/users');
const response = await fetch(userUrl);
```

---

**Last Updated:** 2024
**Status:** Complete
**Version:** 1.0
