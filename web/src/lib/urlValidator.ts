/**
 * Frontend URL Validation and Error Handling
 * Provides URL validation and user-friendly error messages
 */

export interface URLValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConnectivityResult {
  isReachable: boolean;
  statusCode?: number;
  responseTime?: number;
  message: string;
  diagnostics: string[];
}

/**
 * Validate URL format on the frontend
 */
export function validateURL(urlString: string): URLValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if empty
  if (!urlString || urlString.trim() === '') {
    errors.push('URL cannot be empty');
    return { isValid: false, errors, warnings };
  }

  // Check for required protocol
  if (!urlString.match(/^https?:\/\//i)) {
    errors.push('URL must start with http:// or https://');
  }

  try {
    // eslint-disable-next-line no-new
    new URL(urlString);

    // Warnings
    const url = new URL(urlString);
    if (url.protocol === 'http:' && !url.hostname.match(/localhost|127\.0\.0\.1|::1/)) {
      warnings.push('Using HTTP for external URLs is not recommended - use HTTPS');
    }
  } catch (error) {
    errors.push(`Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Test URL connectivity via backend
 */
export async function testURLConnectivity(
  appUrl?: string,
  apiUrl?: string
): Promise<{
  app?: ConnectivityResult;
  api?: ConnectivityResult;
  error?: string;
}> {
  try {
    // Validate URLs first
    const appValidation = appUrl ? validateURL(appUrl) : { isValid: true, errors: [], warnings: [] };
    const apiValidation = apiUrl ? validateURL(apiUrl) : { isValid: true, errors: [], warnings: [] };

    if (!appValidation.isValid || !apiValidation.isValid) {
      const errors = [...appValidation.errors, ...apiValidation.errors];
      return { error: errors.join('; ') };
    }

    // Send to backend
    const response = await fetch('/api/url-config/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appUrl, apiUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const data = await response.json();

    return {
      app: data.app ? parseConnectivityResult(data.app) : undefined,
      api: data.api ? parseConnectivityResult(data.api) : undefined,
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}

/**
 * Parse connectivity result from backend
 */
function parseConnectivityResult(result: any): ConnectivityResult {
  return {
    isReachable: result.connectivity?.isReachable ?? false,
    statusCode: result.connectivity?.statusCode,
    responseTime: result.connectivity?.responseTime,
    message: result.message || 'Unknown status',
    diagnostics: result.diagnostics || [],
  };
}

/**
 * Get formatted error message for display
 */
export function formatErrorMessage(error: string | Error): string {
  const message = typeof error === 'string' ? error : error.message;

  // Map common errors to user-friendly messages
  if (message.includes('ECONNREFUSED')) {
    return '🔴 Connection refused - is the server running on this port?';
  }
  if (message.includes('ENOTFOUND')) {
    return '🔍 Cannot find the hostname - check the domain name';
  }
  if (message.includes('ETIMEDOUT') || message.includes('timeout')) {
    return '⏱️ Request timed out - server is not responding';
  }
  if (message.includes('CERT') || message.includes('certificate')) {
    return '🔒 SSL certificate error - use http:// for local development';
  }
  if (message.includes('Invalid URL')) {
    return '❌ Invalid URL format - must start with http:// or https://';
  }

  return message;
}

/**
 * Check if URL looks like localhost
 */
export function isLocalhost(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'localhost' ||
      parsed.hostname === '127.0.0.1' ||
      parsed.hostname === '::1'
    );
  } catch {
    return false;
  }
}

/**
 * Extract port from URL
 */
export function getPortFromURL(url: string): number | null {
  try {
    const parsed = new URL(url);
    return parsed.port ? parseInt(parsed.port) : null;
  } catch {
    return null;
  }
}
