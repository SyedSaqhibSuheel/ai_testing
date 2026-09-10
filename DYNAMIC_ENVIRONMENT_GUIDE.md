# Dynamic Environment Configuration Guide

Complete guide for implementing flexible environment testing in your AI Testing Platform.

---

## 📋 Overview

This guide explains how to configure your platform to:
- ✅ Test any API endpoint (localhost, staging, production, external)
- ✅ Validate URLs before making requests
- ✅ Provide user-friendly error messages
- ✅ Execute tests against dynamically configured environments
- ✅ Handle connectivity issues gracefully

---

## 🏗️ Architecture Components

### 1. Backend URL Validation (`server/utils/urlValidator.ts`)

**What it does:**
- Validates URL format and structure
- Tests connectivity to any URL
- Provides detailed error diagnostics
- Generates human-friendly error messages

**Key Functions:**

```typescript
// Validate URL format
const result = validateURL("http://localhost:8084/api");
// Returns: { isValid: true, errors: [], warnings: [...], protocol, host, port, pathname }

// Test connectivity to URL
const diagnostics = await testURLConnectivity("http://localhost:8084/api", 5000);
// Returns: { isReachable: boolean, statusCode, responseTime, error, errorType }

// Get error message
const message = getErrorMessage(diagnostics);
// "✓ Server is reachable (200, 145ms)" or "🔴 Connection refused..."

// Get diagnostics details
const details = getDiagnosticDetails(url, diagnostics);
// Returns array of diagnostic info and troubleshooting tips
```

**Error Types:**
- `TIMEOUT` - Request took too long
- `CONNECTION_REFUSED` - No server on that port
- `DNS_ERROR` - Can't resolve hostname
- `CERT_ERROR` - SSL certificate issue
- `INVALID_URL` - Bad URL format

---

### 2. Backend API Endpoint (`server/routes/urlConfig.ts`)

**New Endpoint: `POST /api/url-config/test-connection`**

**Purpose:** Test connectivity to custom URLs from the frontend

**Request:**
```json
POST /api/url-config/test-connection
{
  "appUrl": "http://localhost:5000",
  "apiUrl": "http://localhost:8084/api"
}
```

**Response:**
```json
{
  "app": {
    "url": "http://localhost:5000",
    "validation": {
      "isValid": true,
      "errors": [],
      "warnings": []
    },
    "connectivity": {
      "isReachable": true,
      "statusCode": 200,
      "responseTime": 145
    },
    "message": "✓ Server is reachable (200, 145ms)",
    "diagnostics": [
      "URL: http://localhost:5000",
      "Protocol: http",
      "Host: localhost",
      "Port: 5000",
      ...
    ]
  },
  "api": { ... },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Usage in Frontend:**
```typescript
import { testURLConnectivity } from '@/lib/urlValidator';

// Test URLs before saving
const result = await testURLConnectivity(appUrl, apiUrl);

if (result.error) {
  showError(result.error);
} else {
  if (result.app?.isReachable) showSuccess("App is reachable!");
  if (result.api?.isReachable) showSuccess("API is reachable!");
}
```

---

### 3. Frontend Validation (`web/src/lib/urlValidator.ts`)

**Purpose:** Client-side URL validation and error handling

**Key Functions:**

```typescript
// Validate URL format
const validation = validateURL("http://localhost:8084");
// { isValid: true, errors: [], warnings: [...] }

// Test connectivity
const result = await testURLConnectivity(appUrl, apiUrl);
// { app?: ConnectivityResult, api?: ConnectivityResult, error?: string }

// Format error messages
const message = formatErrorMessage(error);
// "🔴 Connection refused - is the server running?"

// Check if localhost
const isLocal = isLocalhost("http://localhost:5000");
// true

// Get port from URL
const port = getPortFromURL("http://localhost:8084");
// 8084
```

---

### 4. Enhanced UI Component (`web/src/components/URLConfigPanel.tsx`)

**Features:**
- ✅ Real-time URL validation as user types
- ✅ Test connectivity before saving
- ✅ Visual feedback (✓ Connected / ✗ Failed)
- ✅ Detailed error messages
- ✅ Form error states
- ✅ Loading states

**User Flow:**

```
1. User enters URLs in form
   ↓ (live validation)
2. Form shows error if invalid: "Must start with http://"
   ↓ (user fixes)
3. User clicks "Test These URLs"
   ↓ (connects to /api/url-config/test-connection)
4. Backend tests both URLs
   ↓ (responds with connectivity status)
5. Frontend shows:
   ├── App: ✓ Connected (200, 145ms)
   └── API: ✓ Connected (200, 98ms)
   ↓
6. User clicks "Create Profile"
   ↓ (profile created with validated URLs)
```

---

## 🎯 Implementing Dynamic Test Execution

### Step 1: Get Active Profile in Agents

**File:** `server/agents/your-agent.ts`

```typescript
import { URLConfigService } from '../config/urlConfigService.js';

export async function myTestAgent(
  urlConfigService: URLConfigService,
  scenarioId: string
) {
  // Get current active profile
  const config = urlConfigService.getActiveConfig();
  
  const appUrl = config.appBaseUrl;        // e.g., "http://localhost:5000"
  const apiUrl = config.apiBaseUrl;        // e.g., "http://localhost:8084/api"
  
  // Use these URLs when launching browser or making requests
  return {
    appUrl,
    apiUrl,
    // ... test execution
  };
}
```

### Step 2: Pass URLs to Playwright

**File:** `server/mcp/playwrightClient.ts` (or your Playwright integration)

```typescript
import { URLConfigService } from '../config/urlConfigService.js';

export async function launchBrowser(
  urlConfigService: URLConfigService
) {
  const config = urlConfigService.getActiveConfig();
  const baseUrl = config.appBaseUrl; // "http://localhost:5000"
  
  const browser = await chromium.launch({
    headless: true,
  });
  
  const context = await browser.newContext({
    baseURL: baseUrl, // Playwright will prepend this to relative URLs
  });
  
  const page = await context.newPage();
  
  // Now navigate using the active environment
  await page.goto('/login'); // Will go to baseUrl + '/login'
  
  return { browser, context, page, baseUrl };
}
```

### Step 3: Make API Calls to Active Environment

```typescript
import { URLConfigService } from '../config/urlConfigService.js';

export async function callAPI(
  endpoint: string,
  urlConfigService: URLConfigService
) {
  // Get active API URL
  const apiUrl = urlConfigService.resolveApiUrl(endpoint);
  // e.g., endpoint="/users" → "http://localhost:8084/api/users"
  
  try {
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    // Handle with user-friendly messages
    console.error(`Failed to call ${apiUrl}: ${error}`);
    throw error;
  }
}
```

### Step 4: Initialize Agent with URLConfigService

**File:** `server/index.ts` (where you initialize agents)

```typescript
import { URLConfigService } from "./config/urlConfigService.js";

const urlConfigService = new URLConfigService(db, {
  defaultAppBaseUrl: config.appBaseUrl,
  defaultApiBaseUrl: config.apiBaseUrl,
});

// Pass to agents
export async function runIntelligenceAgent(
  scenario: Scenario,
  db: Db
) {
  return intelligenceAgent(db, scenario, urlConfigService);
}
```

---

## 🧪 Testing Different Environments

### Local Development

```
Settings → Environment Configuration
  ↓
Active: Local Development
  ├── App URL: http://localhost:5000
  └── API URL: http://localhost:8084/api
  ↓
Tests run against your local server
```

### Staging Environment

```
Settings → Environment Configuration
  ↓
Switch to: Staging
  ├── App URL: http://staging.company.com
  └── API URL: http://staging-api.company.com/v1
  ↓
Click "Test Connectivity" → ✓ Connected
  ↓
Tests run against staging servers
```

### Production Environment

```
Settings → Environment Configuration
  ↓
Switch to: Production
  ├── App URL: https://app.company.com
  └── API URL: https://api.company.com/v1
  ↓
Click "Test Connectivity" → ✓ Connected (HTTPS)
  ↓
Tests run against production servers
```

---

## 🔐 Security Considerations

### 1. URL Validation
- Always validate URL format before testing
- Only allow http:// and https://
- Prevent injection attacks

### 2. Error Messages
- Never expose internal paths or sensitive details
- Provide helpful but safe error messages
- Log detailed errors server-side only

### 3. Credentials
- Never store credentials in profile URLs
- Use environment variables for sensitive data
- Add optional auth headers in test execution

### 4. HTTPS for External URLs
- Warn users if using HTTP for external domains
- Require HTTPS for production
- Validate SSL certificates

---

## 📊 Error Handling Examples

### Example 1: Invalid URL Format

**User Input:** `localhost:5000` (missing http://)

**Validation:**
```typescript
const validation = validateURL("localhost:5000");
// { isValid: false, errors: ["URL must start with http:// or https://"] }
```

**UI Shows:**
```
App Base URL
❌ URL must start with http:// or https://
```

### Example 2: Server Not Running

**User Input:** `http://localhost:5000`
**Server Status:** Not running

**Diagnostics:**
```
{
  isReachable: false,
  errorType: 'CONNECTION_REFUSED',
  error: 'ECONNREFUSED: Connection refused at 127.0.0.1:5000',
  message: '🔴 Connection refused - is the server running on this port?',
  diagnostics: [
    'URL: http://localhost:5000',
    'Protocol: http',
    'Host: localhost',
    'Port: 5000',
    'Status: UNREACHABLE',
    'Error: ECONNREFUSED',
    '',
    'Troubleshooting tips:',
    '• Check if a service is running on localhost:5000',
    '• If on local machine, ensure the application is started'
  ]
}
```

**UI Shows:**
```
App: ✗ Failed

🔴 Connection refused - is the server running on this port?

Troubleshooting:
• Check if a service is running on localhost:5000
• If on local machine, ensure the application is started
```

### Example 3: SSL Certificate Error

**User Input:** `https://self-signed-cert.local`

**Diagnostics:**
```
{
  isReachable: false,
  errorType: 'CERT_ERROR',
  error: 'self signed certificate',
  message: '🔒 SSL/TLS certificate error. The server\'s certificate is invalid...',
  diagnostics: [
    'URL: https://self-signed-cert.local',
    'Protocol: https',
    'Host: self-signed-cert.local',
    '',
    'Troubleshooting tips:',
    '• Use http:// for local development (not https)',
    '• For production HTTPS, ensure certificate is valid'
  ]
}
```

**UI Shows:**
```
API: ✗ Failed

🔒 SSL/TLS certificate error. Use http:// for local development.

Troubleshooting:
• Use http:// for local development (not https)
• For production HTTPS, ensure certificate is valid
```

---

## 🚀 Complete Workflow Example

### Creating a Staging Profile

```
1. Go to Settings → Environment Configuration
2. Click "+ Add Environment Profile"
3. Fill in:
   Profile ID: staging
   Display Name: Staging Environment
   App Base URL: http://staging.myapp.com
   API Base URL: http://staging-api.myapp.com/v1
4. Click "Test These URLs"
5. See: App: ✓ Connected (200, 234ms)
         API: ✓ Connected (200, 198ms)
6. Click "Create Profile"
7. Profile created and added to list
8. Click "Switch" to use it for tests
```

### Running Tests Against Staging

```
1. Profile active: Staging Environment
2. Create a requirement
3. Click "Analyze"
4. Intelligence agent retrieves URLs:
   - appUrl = "http://staging.myapp.com"
   - apiUrl = "http://staging-api.myapp.com/v1"
5. Agent generates test scenarios using staging URLs
6. Tests run against staging environment
7. Results show staging-specific behavior
```

### Switching Back to Local

```
1. Go to Settings → Environment Configuration
2. Click "Switch" on "Local Development"
3. Active profile changes to: Local
4. Next test run uses local URLs
5. No restart needed!
```

---

## 📝 Implementation Checklist

- [ ] **Backend Utilities**
  - [ ] `server/utils/urlValidator.ts` created
  - [ ] URL validation working
  - [ ] Connectivity testing working
  - [ ] Error types defined

- [ ] **Backend Routes**
  - [ ] `POST /api/url-config/test-connection` implemented
  - [ ] Returns full diagnostics
  - [ ] Error handling in place

- [ ] **Frontend Utilities**
  - [ ] `web/src/lib/urlValidator.ts` created
  - [ ] URL validation on frontend
  - [ ] Error formatting

- [ ] **Frontend UI**
  - [ ] URLConfigPanel updated with validation
  - [ ] Real-time error display
  - [ ] "Test These URLs" button works
  - [ ] Connectivity status shown

- [ ] **Test Execution**
  - [ ] Agents receive URLConfigService
  - [ ] Playwright uses active URLs
  - [ ] API calls use active base URL
  - [ ] Tests run against configured environment

- [ ] **Error Handling**
  - [ ] Invalid URLs caught before testing
  - [ ] Connection errors handled gracefully
  - [ ] User-friendly error messages shown
  - [ ] Diagnostics available for debugging

---

## 🎓 Common Use Cases

### UC1: Local Development

**Scenario:** Developer testing locally before committing

```
1. Start local app on http://localhost:5000
2. Start local API on http://localhost:8084/api
3. Profile: Local Development (default)
4. Click "Test Connectivity" → ✓ Both connected
5. Run tests → All tests use local URLs
```

### UC2: CI/CD Pipeline

**Scenario:** Automated tests run on each push

```
1. CI creates temporary environment
   App: http://ci-runner-1234:5000
   API: http://ci-runner-1234:8084/api
2. CI creates profile: "CI-Build-12345"
3. CI runs tests against this profile
4. After tests, CI deletes profile
```

### UC3: Team Testing Different Domains

**Scenario:** QA team tests against different staging servers

```
Team A Profile:
  App: http://staging-a.company.com
  API: http://api-a.company.com/v1

Team B Profile:
  App: http://staging-b.company.com
  API: http://api-b.company.com/v1

Each team switches to their profile and runs tests independently
```

### UC4: Production Validation

**Scenario:** Post-deployment smoke tests

```
1. Deploy to production
2. Create profile:
   App: https://app.company.com
   API: https://api.company.com/v1
3. Test Connectivity → ✓ All endpoints responding
4. Run smoke tests against production
5. Alert if any checks fail
```

---

## 🛠️ Troubleshooting

### Q: Tests still use localhost even after switching profiles

**A:** Make sure agents receive URLConfigService and call `getActiveConfig()` to get current URLs.

### Q: Connectivity test times out

**A:** Increase timeout or check if server is actually running. Use diagnostics to troubleshoot.

### Q: URL validation too strict

**A:** Check `isValidHostname()` in urlValidator.ts - modify if you need to support custom domains.

### Q: CORS errors when testing external URLs

**A:** This is expected - tests via Playwright should work. If using fetch, add CORS headers or use server-side proxy.

---

## 📚 API Reference

### URLValidator Utilities

```typescript
// Validation
validateURL(url: string): URLValidationResult

// Connectivity
testURLConnectivity(url: string, timeout?: number): Promise<URLDiagnostics>

// Messages
getErrorMessage(diagnostics: URLDiagnostics): string
getDiagnosticDetails(url: string, diagnostics: URLDiagnostics): string[]

// Helpers
validateURL(url: string): URLValidationResult
formatErrorMessage(error: Error | string): string
isLocalhost(url: string): boolean
getPortFromURL(url: string): number | null
```

### URLConfigService

```typescript
// Get active configuration
getActiveConfig(): ActiveURLConfig

// Resolve URLs
resolveApiUrl(endpoint: string): string
resolveAppUrl(endpoint: string): string

// Test connectivity
testApiConnectivity(): Promise<ConnectivityDiagnostics>
testAppConnectivity(): Promise<ConnectivityDiagnostics>

// Manage profiles
switchToProfile(profileId: string): ActiveURLConfig
```

---

## ✨ Summary

You now have a **complete, production-ready system** for:
- ✅ Dynamic environment configuration
- ✅ URL validation and connectivity testing
- ✅ User-friendly error messages
- ✅ Flexible test execution
- ✅ Multiple environment support

**All without restarting the server!** 🚀
