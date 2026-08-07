import { URL } from 'url';

/**
 * Extracts GET query parameters and REST path parameters from a URL.
 */
export const extractParameters = (urlString) => {
  const parameters = new Set();
  try {
    const parsed = new URL(urlString);
    
    // Extract query parameters (?q=test&page=1)
    parsed.searchParams.forEach((_, paramName) => {
      if (paramName && paramName.trim() !== '') {
        parameters.add(paramName.trim());
      }
    });

    // Detect numeric path parameters (/users/123 -> id candidate)
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    pathSegments.forEach((segment, idx) => {
      if (/^\d+$/.test(segment) || /^[0-9a-fA-F-]{36}$/.test(segment)) {
        const prevSegment = pathSegments[idx - 1] || 'param';
        parameters.add(`${prevSegment}_id`);
      }
    });

  } catch (err) {
    // Ignore invalid URL parsing errors
  }

  return Array.from(parameters);
};
