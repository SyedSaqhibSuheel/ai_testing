# URL Configuration System - Integration Checklist

Complete this checklist to integrate the dynamic URL configuration system into your AI Testing Platform.

## ✅ Step 1: Backend Setup

### 1.1 Initialize URLConfigService in Express Server

**File:** `server/index.ts`

```typescript
import { createUrlConfigRouter } from "./routes/urlConfig.js";
import { URLConfigService } from "./config/urlConfigService.js";

// In your Express app initialization:
const app = express();
const db = // ... your database instance
const config = loadConfig();

// Initialize URL Config Service
const urlConfigService = new URLConfigService(db, {
  defaultAppBaseUrl: config.appBaseUrl,
  defaultApiBaseUrl: config.apiBaseUrl,
});

// Make it available to other routes if needed
app.locals.urlConfigService = urlConfigService;

// Register URL config routes
app.use("/api/url-config", createUrlConfigRouter(db, config));
```

### 1.2 Update Server Routes to Use URL Config (Optional)

If you want routes to automatically use the active URL configuration:

**File:** `server/routes/scenarios.ts` or other routes that need dynamic URLs

```typescript
// Instead of hardcoding URLs:
const apiUrl = config.apiBaseUrl;

// Use the URL config service:
const apiUrl = req.app.locals.urlConfigService.getActiveApiBaseUrl();
```

### 1.3 Add Types to Frontend

**File:** `web/src/lib/types.ts`

Add the EnvironmentProfile type:

```typescript
export interface EnvironmentProfile {
  id: string;
  name: string;
  appBaseUrl: string;
  apiBaseUrl: string;
  isDefault?: boolean;
  description?: string;
}
```

## ✅ Step 2: Frontend Setup

### 2.1 Add URL Config Panel to Settings Page

**File:** `web/src/pages/Settings.tsx`

```typescript
import { URLConfigPanel } from "@/components/URLConfigPanel";

export function Settings() {
  return (
    <div>
      {/* Existing settings content */}
      
      {/* Add URL configuration panel */}
      <section>
        <h2>Environment Configuration</h2>
        <URLConfigPanel />
      </section>
    </div>
  );
}
```

### 2.2 Create Missing Components (if needed)

If you don't have `Card` or `Button` components, create them:

**File:** `web/src/components/Card.tsx`

```typescript
export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-surface rounded border border-border p-4 ${className}`}>
      {children}
    </div>
  );
}
```

**File:** `web/src/components/Button.tsx`

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export function Button({ 
  variant = "primary", 
  size = "md", 
  className = "", 
  ...props 
}: ButtonProps) {
  const variantClass = variant === "primary" 
    ? "bg-primary text-white hover:bg-primary-dark" 
    : "bg-secondary text-foreground hover:bg-secondary-dark";
  const sizeClass = size === "sm" ? "px-2 py-1 text-sm" : "px-4 py-2";
  
  return (
    <button className={`rounded ${variantClass} ${sizeClass} ${className}`} {...props} />
  );
}
```

## ✅ Step 3: HTTP Client Updates (Optional but Recommended)

### 3.1 Option A: Keep Current Proxy Setup

If you're happy with `/api` proxy:

No changes needed! The server handles URL resolution internally.

### 3.2 Option B: Add URL Resolution to Specific Calls

For calls to the app under test:

**File:** `web/src/lib/api.ts`

```typescript
// Add this helper
export async function fetchAppEndpoint<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  // Resolve through URL config service
  const res = await fetch("/api/url-config/resolve-app", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  
  if (!res.ok) throw new Error("Failed to resolve URL");
  
  const { resolvedUrl } = await res.json();
  
  // Make the actual call
  const response = await fetch(resolvedUrl, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  
  if (!response.ok) {
    throw new Error(`App call failed: ${response.status}`);
  }
  
  return response.json();
}
```

### 3.3 Option C: Replace API Client Entirely

Use the provided `apiWithUrlConfig.ts` as a complete replacement:

**File:** `web/src/lib/api.ts`

Replace with `web/src/lib/apiWithUrlConfig.ts` or import from it.

## ✅ Step 4: Environment Configuration

### 4.1 Update .env

```bash
# Default URLs (used if no profiles configured)
APP_BASE_URL=http://localhost:5000
API_BASE_URL=http://localhost:8084/fidar/sdk/api
```

### 4.2 Create Environment-Specific Profiles

You can pre-populate profiles by initializing the URLConfigService with your environments:

**File:** `server/config/urlConfigService.ts` (already includes defaults)

The system includes:
- **Local**: Your local development setup
- **Staging**: Pre-configured staging environment
- **Production**: Pre-configured production environment

Modify these in the `initializeDefaultProfiles()` method if needed.

## ✅ Step 5: Testing

### 5.1 Test URL Config API

```bash
# Get active configuration
curl http://localhost:4701/api/url-config/active

# List profiles
curl http://localhost:4701/api/url-config/profiles

# Test connectivity
curl http://localhost:4701/api/url-config/test-connectivity

# Create new profile
curl -X POST http://localhost:4701/api/url-config/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "id": "qa",
    "name": "QA Env",
    "appBaseUrl": "http://qa.example.com",
    "apiBaseUrl": "http://qa-api.example.com/v1"
  }'

# Switch profile
curl -X PUT http://localhost:4701/api/url-config/profiles/staging/switch
```

### 5.2 Test Frontend UI

1. Start the dev server: `npm run dev`
2. Go to **Settings** page
3. You should see:
   - Current active environment
   - List of available profiles
   - Ability to switch profiles
   - Ability to add new profiles
   - Connectivity test button

### 5.3 Test URL Resolution

```bash
# In browser console:
fetch('/api/url-config/resolve-api', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ endpoint: '/users' })
})
.then(r => r.json())
.then(data => console.log(data))
```

## ✅ Step 6: Integration with Existing Features

### 6.1 Scenario Testing

When users run scenarios, they should use the active URL configuration:

**File:** `server/agents/` (if needed)

```typescript
// Use URL config in scenario execution
const apiUrl = urlConfigService.getActiveApiBaseUrl();
// Pass to scenario executor
```

### 6.2 Git Operations

Ensure git operations use the active URL configuration when cloning/fetching:

**File:** `server/git/managedRepo.ts` (if needed)

```typescript
const appUrl = urlConfigService.getActiveAppBaseUrl();
// Use in git operations if needed
```

### 6.3 Agent Runs

Agents should be aware of active URLs:

**File:** `server/agents/` (if needed)

```typescript
// In agent initialization
const config = {
  appBaseUrl: urlConfigService.getActiveAppBaseUrl(),
  apiBaseUrl: urlConfigService.getActiveApiBaseUrl(),
  // ... other config
};
```

## ✅ Step 7: Documentation

### 7.1 Update Project README

Add a section about URL configuration:

```markdown
## Environment Configuration

The platform supports multiple environment profiles for API testing:

- **Local Development** (default): `http://localhost:5000` app, `http://localhost:8084/fidar/sdk/api` api
- **Staging**: Staging environment URLs
- **Production**: Production environment URLs
- **Custom**: Add your own environment profiles

Switch environments in Settings → Environment Configuration
```

### 7.2 Create Environment Setup Guide

Document how to add custom environments for your team.

## ✅ Step 8: Deployment Considerations

### 8.1 Production Setup

```bash
# In production .env
APP_BASE_URL=https://app.prod.com
API_BASE_URL=https://api.prod.com/fidar/sdk/api
```

### 8.2 Multi-Tenant Support

If needed, extend URLConfigService to support per-user profiles:

```typescript
// Store profiles per user in database
const userProfiles = db.query('SELECT * FROM url_profiles WHERE user_id = ?', userId);
```

### 8.3 Audit Logging

Optional: Add logging for profile switches:

```typescript
// In urlConfig route
router.put("/profiles/:profileId/switch", (req, res) => {
  const actor = req.query.actor || 'unknown';
  console.log(`[URL_CONFIG] ${actor} switched to ${req.params.profileId}`);
  // ... rest of handler
});
```

## ✅ Step 9: Verification Checklist

- [ ] Backend URLConfigService initialized in server/index.ts
- [ ] urlConfig routes registered: `app.use('/api/url-config', ...)`
- [ ] Frontend hooks (useUrlConfig, etc.) imported correctly
- [ ] URLConfigPanel added to Settings page
- [ ] Environment types added to web/src/lib/types.ts
- [ ] HTTP client updated (if using new approach)
- [ ] .env configured with default URLs
- [ ] Test API endpoints working: `curl http://localhost:4701/api/url-config/active`
- [ ] Frontend Settings page shows URL configuration
- [ ] Can switch profiles in UI
- [ ] Can create new profiles
- [ ] Connectivity test works
- [ ] Documentation updated

## ✅ Step 10: Post-Integration Validation

### 10.1 Full Workflow Test

1. Start the app: `npm run dev`
2. Go to Settings → Environment Configuration
3. Create a new profile for your test environment
4. Switch to that profile
5. Run a requirement analysis
6. Verify it uses the correct URLs from the active profile
7. Switch back to local
8. Verify it uses local URLs again

### 10.2 Performance Check

- [ ] URL resolution doesn't add noticeable latency
- [ ] Profile switches are instantaneous
- [ ] Connectivity tests don't block the UI
- [ ] Settings page loads quickly

### 10.3 Error Handling

- [ ] Invalid URLs are rejected with clear messages
- [ ] Switching to non-existent profile shows error
- [ ] Connectivity failures are handled gracefully
- [ ] Network errors don't crash the app

## ✅ Troubleshooting

### Issue: Routes not found (404 on /api/url-config/*)

**Solution:** Ensure routes are registered in server/index.ts:
```typescript
app.use("/api/url-config", createUrlConfigRouter(db, config));
```

### Issue: URL Config Panel not showing

**Solution:** Add to Settings page and check browser console for errors

### Issue: Can't switch profiles

**Solution:** 
- Verify profile exists: `curl http://localhost:4701/api/url-config/profiles`
- Check browser DevTools network tab
- Ensure it's not the currently active profile

### Issue: Connectivity test always fails

**Solution:**
- Is the app running at the configured URL?
- Check firewall/network settings
- Try accessing the URL directly in a browser

## 🎉 Success!

Once all steps are complete, your platform will support:

✅ Multiple environment profiles
✅ Runtime environment switching
✅ Clean URL resolution
✅ Connectivity testing
✅ Easy environment management
✅ Scalable multi-tenant deployment

For detailed usage examples, see `URL_CONFIG_IMPLEMENTATION.md`.
