import { URL } from 'url';

/**
 * Validates whether a target URL is acceptable and prevents SSRF attacks.
 * Blocks private IP subnets, loopbacks, internal network names, and non-http(s) schemes.
 */
export const validateTargetUrl = (targetUrl) => {
  if (!targetUrl || typeof targetUrl !== 'string') {
    return { valid: false, reason: 'URL string is required.' };
  }

  let parsed;
  try {
    parsed = new URL(targetUrl.trim());
  } catch (err) {
    return { valid: false, reason: 'Invalid URL format.' };
  }

  // 1. Enforce HTTP/HTTPS only
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, reason: 'Only HTTP and HTTPS protocols are allowed.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. SSRF Protection: Block localhost and loopback addresses
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0' ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { valid: false, reason: 'SSRF Protection: Requests to local/loopback addresses are prohibited.' };
  }

  // 3. SSRF Protection: Block IPv4 Private IP ranges (RFC 1918 & RFC 3927 cloud metadata)
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipMatch = hostname.match(ipv4Regex);
  if (ipMatch) {
    const [, oct1, oct2] = ipMatch.map(Number);
    // 10.0.0.0/8
    if (oct1 === 10) {
      return { valid: false, reason: 'SSRF Protection: Private IP subnets (10.0.0.0/8) are prohibited.' };
    }
    // 172.16.0.0/12
    if (oct1 === 172 && oct2 >= 16 && oct2 <= 31) {
      return { valid: false, reason: 'SSRF Protection: Private IP subnets (172.16.0.0/12) are prohibited.' };
    }
    // 192.168.0.0/16
    if (oct1 === 192 && oct2 === 168) {
      return { valid: false, reason: 'SSRF Protection: Private IP subnets (192.168.0.0/16) are prohibited.' };
    }
    // 169.254.0.0/16 (AWS/Cloud link-local metadata)
    if (oct1 === 169 && oct2 === 254) {
      return { valid: false, reason: 'SSRF Protection: Cloud link-local metadata addresses (169.254.0.0/16) are prohibited.' };
    }
  }

  return { valid: true, normalizedUrl: parsed.origin + parsed.pathname };
};

/**
 * Verifies if candidate URL belongs strictly to the authorized target domain.
 */
export const isSameDomain = (candidateUrl, targetUrl) => {
  try {
    const candidateHost = new URL(candidateUrl).hostname.toLowerCase();
    const targetHost = new URL(targetUrl).hostname.toLowerCase();
    return candidateHost === targetHost || candidateHost.endsWith(`.${targetHost}`);
  } catch (err) {
    return false;
  }
};

/**
 * Normalizes URL by stripping trailing hashes, fragments, and standardizing relative paths.
 */
export const normalizeUrl = (candidateUrl, baseUrl) => {
  try {
    const resolved = new URL(candidateUrl, baseUrl);
    resolved.hash = ''; // Remove fragment hash
    return resolved.href;
  } catch (err) {
    return null;
  }
};
