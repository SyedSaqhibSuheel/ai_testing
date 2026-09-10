/**
 * URL Validation and Diagnostics Utilities
 * Provides validation, parsing, and diagnostic tools for URLs
 */

export interface URLValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  protocol: string | null;
  host: string | null;
  port: number | null;
  pathname: string | null;
}

export interface URLDiagnostics {
  isReachable: boolean;
  statusCode?: number;
  responseTime?: number;
  certificateValid?: boolean;
  error?: string;
  errorType?: 'TIMEOUT' | 'CERT_ERROR' | 'CONNECTION_REFUSED' | 'INVALID_URL' | 'DNS_ERROR' | 'UNKNOWN';
}

/**
 * Validate URL format and structure
 */
export function validateURL(urlString: string): URLValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let protocol: string | null = null;
  let host: string | null = null;
  let port: number | null = null;
  let pathname: string | null = null;

  // Check if empty
  if (!urlString || urlString.trim() === '') {
    errors.push('URL cannot be empty');
    return { isValid: false, errors, warnings, protocol, host, port, pathname };
  }

  // Check for required protocol
  if (!urlString.match(/^https?:\/\//i)) {
    errors.push('URL must start with http:// or https://');
  }

  try {
    const url = new URL(urlString);
    protocol = url.protocol.replace(':', '');
    host = url.hostname;
    port = url.port ? parseInt(url.port) : (protocol === 'https' ? 443 : 80);
    pathname = url.pathname || '/';

    // Validation checks
    if (!host) {
      errors.push('Invalid hostname');
    }

    if (host && !isValidHostname(host)) {
      errors.push(`Invalid hostname format: ${host}`);
    }

    // Warnings
    if (protocol === 'http' && host !== 'localhost' && !host.startsWith('127.')) {
      warnings.push('Using HTTP instead of HTTPS for external URLs is not recommended');
    }

    if (port && (port < 1 || port > 65535)) {
      errors.push(`Port must be between 1 and 65535, got ${port}`);
    }

    // Check for localhost/127.0.0.1
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') {
      if (port && port > 1024) {
        // Common development ports
        if (![3000, 3001, 5000, 5173, 5174, 5175, 8000, 8080, 8081, 8084, 8085, 4700, 4701].includes(port)) {
          warnings.push(`Uncommon port ${port} for localhost - make sure service is running`);
        }
      }
    }
  } catch (error) {
    errors.push(`Invalid URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    protocol,
    host,
    port,
    pathname,
  };
}

/**
 * Check if hostname is valid
 */
function isValidHostname(hostname: string): boolean {
  // Valid patterns: localhost, IP addresses, domain names
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^(\[)?([a-f0-9:]+)(\])?$/i;
  const domain = /^([a-z0-9]([a-z0-9-]*[a-z0-9])?\.)*[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;
  const localhost = /^localhost$/i;

  return (
    localhost.test(hostname) ||
    ipv4.test(hostname) ||
    ipv6.test(hostname) ||
    domain.test(hostname)
  );
}

/**
 * Test connectivity to a URL with detailed diagnostics
 */
export async function testURLConnectivity(urlString: string, timeout: number = 5000): Promise<URLDiagnostics> {
  // Validate URL format first
  const validation = validateURL(urlString);
  if (!validation.isValid) {
    return {
      isReachable: false,
      errorType: 'INVALID_URL',
      error: validation.errors.join('; '),
    };
  }

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(urlString, {
      method: 'GET',
      headers: {
        'User-Agent': 'AI-Testing-Platform/1.0',
      },
      signal: controller.signal,
      // Don't follow redirects for initial connectivity check
      redirect: 'manual',
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    // Any 2xx, 3xx, 4xx is considered "reachable" - the server responded
    // 5xx means server is reachable but has an error
    const isReachable = response.status < 500 || response.status === 503; // 503 Service Unavailable still counts as reachable

    return {
      isReachable,
      statusCode: response.status,
      responseTime,
      certificateValid: true, // If we got here, cert is valid
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Determine error type
    let errorType: URLDiagnostics['errorType'] = 'UNKNOWN';

    if (errorMessage.includes('AbortError') || errorMessage.includes('signal')) {
      errorType = 'TIMEOUT';
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ERR_CONNECTION_REFUSED')) {
      errorType = 'CONNECTION_REFUSED';
    } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('ERR_NAME_NOT_RESOLVED')) {
      errorType = 'DNS_ERROR';
    } else if (errorMessage.includes('certificate') || errorMessage.includes('SSL')) {
      errorType = 'CERT_ERROR';
    }

    return {
      isReachable: false,
      errorType,
      error: errorMessage,
      responseTime,
    };
  }
}

/**
 * Get human-friendly error message based on error type
 */
export function getErrorMessage(diagnostics: URLDiagnostics): string {
  if (diagnostics.isReachable) {
    return `✓ Server is reachable (${diagnostics.statusCode}, ${diagnostics.responseTime}ms)`;
  }

  switch (diagnostics.errorType) {
    case 'TIMEOUT':
      return `⏱️ Request timed out. Server took longer than 5 seconds to respond. Check if the server is running and not overloaded.`;

    case 'CONNECTION_REFUSED':
      return `🔴 Connection refused. No server is listening on this address/port. Is the service running?`;

    case 'DNS_ERROR':
      return `🔍 DNS resolution failed. Cannot find the hostname. Check the domain name or use an IP address.`;

    case 'CERT_ERROR':
      return `🔒 SSL/TLS certificate error. The server's certificate is invalid or expired. Use http:// for local development.`;

    case 'INVALID_URL':
      return `❌ Invalid URL format. Make sure the URL starts with http:// or https://.`;

    default:
      return `❌ Connection failed: ${diagnostics.error || 'Unknown error'}`;
  }
}

/**
 * Detailed diagnostics for troubleshooting
 */
export function getDiagnosticDetails(urlString: string, diagnostics: URLDiagnostics): string[] {
  const details: string[] = [];
  const validation = validateURL(urlString);

  // URL Structure
  details.push(`URL: ${urlString}`);
  if (validation.protocol) details.push(`Protocol: ${validation.protocol}`);
  if (validation.host) details.push(`Host: ${validation.host}`);
  if (validation.port) details.push(`Port: ${validation.port}`);
  if (validation.pathname) details.push(`Path: ${validation.pathname}`);

  // Validation Warnings
  if (validation.warnings.length > 0) {
    details.push(`Warnings: ${validation.warnings.join(', ')}`);
  }

  // Connectivity Result
  details.push('');
  details.push(`Status: ${diagnostics.isReachable ? 'REACHABLE' : 'UNREACHABLE'}`);
  if (diagnostics.statusCode) details.push(`HTTP Status: ${diagnostics.statusCode}`);
  if (diagnostics.responseTime) details.push(`Response Time: ${diagnostics.responseTime}ms`);
  if (diagnostics.error) details.push(`Error: ${diagnostics.error}`);

  // Troubleshooting tips
  details.push('');
  details.push('Troubleshooting tips:');

  if (!validation.isValid) {
    details.push('• Check URL format - must be http:// or https://');
  }

  if (diagnostics.errorType === 'CONNECTION_REFUSED') {
    const port = validation.port || (validation.protocol === 'https' ? 443 : 80);
    details.push(`• Check if a service is running on ${validation.host}:${port}`);
    details.push('• If on local machine, ensure the application is started');
  }

  if (diagnostics.errorType === 'DNS_ERROR') {
    details.push('• Check hostname spelling');
    details.push('• Try using IP address instead of hostname');
  }

  if (diagnostics.errorType === 'TIMEOUT') {
    details.push('• Server is responding very slowly');
    details.push('• Check network connectivity');
    details.push('• Server might be under heavy load');
  }

  if (diagnostics.errorType === 'CERT_ERROR') {
    details.push('• Use http:// for local development (not https)');
    details.push('• For production HTTPS, ensure certificate is valid');
  }

  return details;
}
