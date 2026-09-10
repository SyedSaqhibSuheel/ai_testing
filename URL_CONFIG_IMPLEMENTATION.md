# Dynamic Multi-Environment URL Configuration Guide

This guide explains how to use the refactored URL configuration system for flexible, multi-environment API management.

## Overview

The new URL configuration system provides:

- **Multiple Environment Profiles** — Switch between dev, staging, production, and custom endpoints
- **Runtime URL Resolution** — Change active environment without restarting
- **Clean URL Joining** — Automatically handles trailing slashes and path concatenation
- **Connectivity Testing** — Verify API/app availability before using
- **Database Persistence** — Store and retrieve profiles across sessions

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React)                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  URLConfigPanel Component                                │  │
│  │  - useUrlConfig() hook                                   │  │
│  │  - useUrlProfiles() hook                                 │  │
│  │  - useCreateUrlProfile() hook                            │  │
│  │  - useDeleteUrlProfile() hook                            │  │
│  │  - useTestUrlConnectivity() hook                         │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────┬─────────────────────────────────────┘
                             │
                    /api/url-config/*
                             │
┌────────────────────────────┴─────────────────────────────────────┐
│                    Backend (Express)                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  URLConfigRouter (routes/urlConfig.ts)                   │  │
│  │  - GET /active                                           │  │
│  │  - GET /profiles                                         │  │
│  │  - POST /profiles                                        │  │
│  │  - PUT /profiles/:id/switch                              │  │
│  │  - DELETE /profiles/:id                                  │  │
│  │  - POST /resolve-api                                     │  │
│  │  - POST /resolve-app                                     │  │
│  │  - GET /test-connectivity                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────┴─────────────────────────────────┐ │
│  │  URLConfigService (config/urlConfigService.ts)             │ │
│  │  - getActiveConfig()                                       │ │
│  │  - switchToProfile(profileId)                              │ │
│  │  - resolveApiUrl(endpoint)                                 │ │
│  │  - resolveAppUrl(endpoint)                                 │ │
│  │  - testApiConnectivity()                                   │ │
│  │  - testAppConnectivity()                                   │ │
│  └──────────────────────────┬─────────────────────────────────┘ │
│                             │                                    │
│  ┌──────────────────────────┴─────────────────────────────────┐ │
│  │  URLManager (config/urlManager.ts)                          │ │
│  │  - getActiveProfile()                                      │ │
│  │  - switchProfile(profileId)                                │ │
│  │  - resolveUrl(baseUrl, endpoint)                           │ │
│  │  - resolveUrlAdvanced(options)                             │ │
│  │  - parseUrl(urlString)                                     │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. URLManager (`server/config/urlManager.ts`)

Low-level URL management with no database dependency.

```typescript
import { URLManager, resolveUrl, parseUrl } from '@/server/config/urlManager';

// Initialize
const manager = new URLManager('http://localhost:5000', 'http://localhost:8084/api');

// Get active profile
const profile = manager.getActiveProfile();
console.log(profile.apiBaseUrl); // http://localhost:8084/api

// Switch environments
manager.switchProfile('staging');

// Resolve URLs
const url = resolveUrl('http://api.example.com/v1', '/users');
// Result: http://api.example.com/v1/users

// Advanced resolution
const advancedUrl = resolveUrlAdvanced({
  baseUrl: 'https://api.example.com',
  endpoint: '/users',
  queryParams: { page: 1, limit: 10 },
  includeTrailingSlash: true
});
// Result: https://api.example.com/users?page=1&limit=10/
```

### 2. URLConfigService (`server/config/urlConfigService.ts`)

High-level service with database persistence and connectivity testing.

```typescript
import { URLConfigService } from '@/server/config/urlConfigService';

// Initialize (typically in server/index.ts)
const urlConfigService = new URLConfigService(db, {
  defaultAppBaseUrl: config.appBaseUrl,
  defaultApiBaseUrl: config.apiBaseUrl,
});

// Get active configuration
const activeConfig = urlConfigService.getActiveConfig();
// {
//   activeProfileId: 'local',
//   appBaseUrl: 'http://localhost:5000',
//   apiBaseUrl: 'http://localhost:8084/api',
//   allProfiles: [...]
// }

// Switch to staging
urlConfigService.switchToProfile('staging');

// Resolve endpoints
const usersApi = urlConfigService.resolveApiUrl('/users');
// http://localhost:8084/api/users (or staging URL if switched)

// Test connectivity
const apiTest = await urlConfigService.testApiConnectivity();
// { reachable: true, statusCode: 200 }
```

### 3. URL Resolution API Routes (`server/routes/urlConfig.ts`)

HTTP endpoints for URL configuration management.

```bash
# Get active configuration
curl http://localhost:4701/api/url-config/active

# List all profiles
curl http://localhost:4701/api/url-config/profiles

# Get specific profile
curl http://localhost:4701/api/url-config/profiles/staging

# Create/update profile
curl -X POST http://localhost:4701/api/url-config/profiles \
  -H "Content-Type: application/json" \
  -d '{
    "id": "qa",
    "name": "QA Environment",
    "appBaseUrl": "http://qa.example.com",
    "apiBaseUrl": "http://qa-api.example.com/v1",
    "description": "QA testing environment"
  }'

# Switch to profile
curl -X PUT http://localhost:4701/api/url-config/profiles/staging/switch

# Resolve API endpoint
curl -X POST http://localhost:4701/api/url-config/resolve-api \
  -H "Content-Type: application/json" \
  -d '{ "endpoint": "/users/123" }'
# Response: { "endpoint": "/users/123", "resolvedUrl": "http://localhost:8084/api/users/123" }

# Test connectivity
curl http://localhost:4701/api/url-config/test-connectivity
```

### 4. React Hooks (`web/src/lib/useUrlConfig.ts`)

Frontend hooks for URL configuration management.

```typescript
import {
  useUrlConfig,
  useUrlProfiles,
  useCreateUrlProfile,
  useDeleteUrlProfile,
  useTestUrlConnectivity,
  resolveApiUrl,
  resolveAppUrl,
} from '@/lib/useUrlConfig';

// In a React component:
function MyComponent() {
  // Get active configuration
  const { config, isLoading, switchProfile, isSwitching } = useUrlConfig();

  // Get all profiles
  const { profiles } = useUrlProfiles();

  // Create new profile
  const createProfile = useCreateUrlProfile();
  
  // Test connectivity
  const testConnectivity = useTestUrlConnectivity();

  return (
    <div>
      <p>Active: {config?.activeProfileId}</p>
      <select onChange={(e) => switchProfile(e.target.value)}>
        {profiles?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button onClick={() => testConnectivity.mutate()}>
        Test Connection
      </button>
    </div>
  );
}
```

## Integration Examples

### Example 1: Switch URLs Without Restart

**Before:**
```typescript
// Hard-coded in config
const apiUrl = 'http://localhost:8084/fidar/sdk/api';
const response = await fetch(`${apiUrl}/users`);
```

**After:**
```typescript
// Dynamic based on active profile
const apiUrl = urlConfigService.resolveApiUrl('/users');
const response = await fetch(apiUrl);
// Changes based on which profile is active (dev, staging, prod)
```

### Example 2: Environment-Aware HTTP Client

Create a wrapper around your HTTP client that uses URL resolution:

```typescript
// lib/apiClient.ts
import { URLConfigService } from '@/server/config/urlConfigService';

export class APIClient {
  constructor(private urlConfig: URLConfigService) {}

  async get<T>(endpoint: string): Promise<T> {
    const url = this.urlConfig.resolveApiUrl(endpoint);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    const url = this.urlConfig.resolveApiUrl(endpoint);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    return response.json();
  }
}

// Usage
const client = new APIClient(urlConfigService);
const users = await client.get<User[]>('/users'); // Uses active profile URL
```

### Example 3: Frontend URL Resolution

```typescript
// web/src/lib/api.ts - Enhanced with URL resolution
import { resolveApiUrl } from './useUrlConfig';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  // Option 1: Always use the server's URL resolution
  const resolvedPath = await resolveApiUrl(path);
  
  // Option 2: Fallback to proxy (if using /api prefix)
  const res = await fetch(resolvedPath, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  
  if (res.status === 204) return undefined as T;
  return res.json();
}
```

### Example 4: Pre-flight Connectivity Check

```typescript
// Before running tests, verify connectivity
async function runTests() {
  const connectivity = await urlConfigService.testApiConnectivity();
  
  if (!connectivity.reachable) {
    throw new Error(`
      Cannot reach API at ${urlConfigService.getActiveApiBaseUrl()}
      Error: ${connectivity.error}
      
      Check your configuration or switch to a different environment profile.
    `);
  }
  
  // Proceed with tests
}
```

## Predefined Profiles

The system comes with three default profiles:

### Local Development
```json
{
  "id": "local",
  "name": "Local Development",
  "appBaseUrl": "http://localhost:5000",
  "apiBaseUrl": "http://localhost:8084/fidar/sdk/api",
  "isDefault": true
}
```

### Staging
```json
{
  "id": "staging",
  "name": "Staging",
  "appBaseUrl": "http://localhost:5001",
  "apiBaseUrl": "http://localhost:8085/fidar/sdk/api"
}
```

### Production
```json
{
  "id": "production",
  "name": "Production",
  "appBaseUrl": "https://app.prod.com",
  "apiBaseUrl": "https://api.prod.com/fidar/sdk/api"
}
```

You can modify these or add custom profiles through the settings UI.

## Environment Variables

Configure default URLs via `.env`:

```bash
# Default URLs (used if no profiles are set)
APP_BASE_URL=http://localhost:5000
API_BASE_URL=http://localhost:8084/fidar/sdk/api

# Optional: Set initial active profile
URL_CONFIG_ACTIVE_PROFILE=staging
```

## Database Schema

The system uses SQLite tables (optional, for persistence):

```sql
CREATE TABLE url_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  app_base_url TEXT NOT NULL,
  api_base_url TEXT NOT NULL,
  description TEXT,
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_url_profiles_active ON url_profiles(is_active);
```

## Best Practices

1. **Use Profile IDs Consistently**
   ```typescript
   // ✓ Good: Use descriptive IDs
   'local', 'staging', 'production', 'qa'
   
   // ✗ Avoid: Generic or unclear IDs
   'env1', 'test', 'tmp'
   ```

2. **Validate URLs at Creation**
   ```typescript
   // The service validates URLs automatically
   urlConfigService.setProfile({
     id: 'custom',
     name: 'Custom',
     appBaseUrl: 'invalid url', // Throws error
     apiBaseUrl: 'http://api.com'
   });
   ```

3. **Test Connectivity Before Switching**
   ```typescript
   const test = await urlConfigService.testApiConnectivity();
   if (test.reachable) {
     urlConfigService.switchToProfile(newProfileId);
   }
   ```

4. **Cache Resolved URLs**
   ```typescript
   // Instead of resolving repeatedly:
   const apiUrl = urlConfigService.resolveApiUrl('/users');
   const users = await fetch(`${apiUrl}`);
   const user = await fetch(`${apiUrl}/123`);
   
   // Cache the base:
   const baseUrl = urlConfigService.getActiveApiBaseUrl();
   const users = await fetch(`${baseUrl}/users`);
   const user = await fetch(`${baseUrl}/users/123`);
   ```

5. **Handle URL Changes Gracefully**
   ```typescript
   try {
     urlConfigService.switchToProfile('staging');
   } catch (error) {
     console.error('Failed to switch profile:', error);
     // Fall back to default profile
     urlConfigService.switchToProfile('local');
   }
   ```

## Migration from Hardcoded URLs

To migrate existing code:

**Before:**
```typescript
const API_URL = 'http://localhost:8084/fidar/sdk/api';

export async function getUsers() {
  return fetch(`${API_URL}/users`);
}
```

**After:**
```typescript
export async function getUsers(urlConfigService: URLConfigService) {
  const apiUrl = urlConfigService.resolveApiUrl('/users');
  return fetch(apiUrl);
}

// Or use the React hook
export function Users() {
  const { config } = useUrlConfig();
  const apiUrl = `${config.apiBaseUrl}/users`;
  // ...
}
```

## Troubleshooting

### Profile Not Switching
- Ensure the profile ID exists: `GET /api/url-config/profiles`
- Check that it's not the active profile (you can't switch to the same one)

### URLs Not Resolving Correctly
- Verify the base URL is valid: `POST /api/url-config/test-connectivity`
- Check for trailing slashes: they're handled automatically
- Ensure the endpoint starts with `/`

### Connectivity Test Failing
- Is the app running at the configured URL?
- Check firewall/network settings
- Verify the URL format is correct (http/https, port, path)

## Performance Considerations

- URL resolution is O(1) — no database lookup needed
- Connectivity tests are async and should be cached in UI
- Use React Query for automatic caching of profile lists
- Consider pre-fetching profiles on app load

## Security Notes

- Never expose API credentials in profile URLs
- Use environment variables for sensitive URLs
- Validate all profile URLs before storing
- Consider rate-limiting the connectivity test endpoint
