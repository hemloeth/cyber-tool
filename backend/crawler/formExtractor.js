import * as cheerio from 'cheerio';
import { normalizeUrl } from './crawler.utils.js';

/**
 * Extracts form action, method, visible & hidden input fields using Cheerio and Playwright DOM inspection.
 */
export const extractForms = (htmlContent, pageUrl) => {
  const forms = [];
  if (!htmlContent) return forms;

  try {
    const $ = cheerio.load(htmlContent);

    $('form').each((_, formElem) => {
      const $form = $(formElem);
      const rawAction = $form.attr('action') || '';
      let method = ($form.attr('method') || '').toUpperCase();
      const hasFileUpload = $form.find('input[type="file"]').length > 0;

      // Default to POST if method omitted or if form contains file uploads
      if (!method || hasFileUpload) {
        method = 'POST';
      }
      const actionUrl = normalizeUrl(rawAction, pageUrl) || pageUrl;

      const inputs = [];

      // Parse all <input> tags (including type="hidden" and CSS hidden styles)
      $form.find('input').each((_, inputElem) => {
        const $input = $(inputElem);
        const name = $input.attr('name') || $input.attr('id');
        const type = ($input.attr('type') || 'text').toLowerCase();
        const style = $input.attr('style') || '';
        const value = $input.attr('value') || '';

        // Detect if field is hidden via type, inline style, or hidden attribute
        const isHidden = 
          type === 'hidden' || 
          style.includes('display:none') || 
          style.includes('visibility:hidden') || 
          style.includes('opacity:0') || 
          $input.is('[hidden]');

        if (name && name.trim() !== '') {
          inputs.push({
            name: name.trim(),
            type: isHidden ? `hidden (${type})` : type,
            value: isHidden ? value : undefined,
            isHidden
          });
        }
      });

      // Parse <textarea> tags
      $form.find('textarea').each((_, textElem) => {
        const $textarea = $(textElem);
        const name = $textarea.attr('name') || $textarea.attr('id');
        const style = $textarea.attr('style') || '';
        const isHidden = style.includes('display:none') || style.includes('visibility:hidden') || $textarea.is('[hidden]');

        if (name && name.trim() !== '') {
          inputs.push({
            name: name.trim(),
            type: isHidden ? 'hidden (textarea)' : 'textarea',
            isHidden
          });
        }
      });

      // Parse <select> tags
      $form.find('select').each((_, selectElem) => {
        const $select = $(selectElem);
        const name = $select.attr('name') || $select.attr('id');
        const style = $select.attr('style') || '';
        const isHidden = style.includes('display:none') || style.includes('visibility:hidden') || $select.is('[hidden]');

        if (name && name.trim() !== '') {
          inputs.push({
            name: name.trim(),
            type: isHidden ? 'hidden (select)' : 'select',
            isHidden
          });
        }
      });

      if (inputs.length > 0) {
        forms.push({
          endpoint: actionUrl,
          method,
          inputs
        });
      }
    });

  } catch (err) {
    console.error('[FormExtractor] Error parsing forms:', err.message);
  }

  return forms;
};

/**
 * Extracts all input elements (visible and hidden) directly from page HTML,
 * including inputs outside <form> tags.
 */
export const extractInputsFromPage = (htmlContent) => {
  const inputs = [];
  if (!htmlContent) return inputs;

  try {
    const $ = cheerio.load(htmlContent);

    // Extract all <input>, <textarea>, <select> tags
    $('input, textarea, select').each((_, elem) => {
      const $el = $(elem);
      const name = $el.attr('name') || $el.attr('id') || $el.attr('placeholder') || '';
      const tag = elem.tagName.toLowerCase();
      const type = tag === 'input' ? ($el.attr('type') || 'text').toLowerCase() : tag;
      const style = $el.attr('style') || '';
      const value = $el.attr('value') || '';

      const isHidden =
        type === 'hidden' ||
        style.includes('display:none') ||
        style.includes('visibility:hidden') ||
        style.includes('opacity:0') ||
        $el.is('[hidden]');

      inputs.push({
        name: name.trim() || `unnamed_${tag}`,
        tag,
        type: isHidden ? `hidden (${type})` : type,
        value,
        isHidden
      });
    });
  } catch (err) {
    console.error('[FormExtractor] Error parsing standalone inputs:', err.message);
  }

  return inputs;
};

