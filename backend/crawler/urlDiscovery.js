import * as cheerio from 'cheerio';
import { isSameDomain, normalizeUrl } from './crawler.utils.js';

/**
 * Extracts internal links from HTML anchor tags and script src references.
 */
export const discoverUrls = (htmlContent, pageUrl, targetDomainUrl) => {
  const discoveredLinks = new Set();
  const scriptSources = new Set();

  if (!htmlContent) return { links: [], scripts: [] };

  try {
    const $ = cheerio.load(htmlContent);

    // Extract <a href="..."> links
    $('a[href]').each((_, elem) => {
      const href = $(elem).attr('href');
      if (href && !href.startsWith('javascript:') && !href.startsWith('mailto:') && !href.startsWith('tel:')) {
        const normalized = normalizeUrl(href, pageUrl);
        if (normalized && isSameDomain(normalized, targetDomainUrl)) {
          discoveredLinks.add(normalized);
        }
      }
    });

    // Extract <script src="..."> tags
    $('script[src]').each((_, elem) => {
      const src = $(elem).attr('src');
      if (src) {
        const normalized = normalizeUrl(src, pageUrl);
        if (normalized && isSameDomain(normalized, targetDomainUrl)) {
          scriptSources.add(normalized);
        }
      }
    });

  } catch (err) {
    console.error('[UrlDiscovery] Error parsing HTML:', err.message);
  }

  return {
    links: Array.from(discoveredLinks),
    scripts: Array.from(scriptSources)
  };
};
