/**
 * DOM Tree Beautifier & Indenter for DevTools Elements View
 * Takes raw HTML DOM tree and formats it into clean multi-line indented code,
 * matching DevTools Elements tab line-for-line.
 */

export const formatSourceCode = (rawCode) => {
  if (!rawCode || typeof rawCode !== 'string') return '';
  let code = rawCode.trim();

  // If code is HTML, format every HTML tag onto its own line with proper indentation
  if (code.includes('<') && code.includes('>')) {
    // Break adjacent tags onto separate lines: "><" -> ">\n<"
    let brokenHtml = code
      .replace(/>\s*</g, '>\n<')
      .replace(/<html/gi, '\n<html')
      .replace(/<\/html>/gi, '\n</html>\n');

    const lines = brokenHtml.split('\n').map(l => l.trim()).filter(Boolean);
    let indentLevel = 0;
    const indented = [];

    const selfClosingTags = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 
      'link', 'meta', 'param', 'source', 'track', 'wbr', '!doctype'
    ]);

    for (const line of lines) {
      const isClosing = /^<\/([a-z0-9-]+)/i.test(line);
      const isOpening = /^<([a-z0-9-]+)/i.test(line);
      const matchTag = line.match(/^<\/?([a-z0-9-]+)/i);
      const tagName = matchTag ? matchTag[1].toLowerCase() : null;
      const isSelfClosing = line.endsWith('/>') || (tagName && selfClosingTags.has(tagName));
      const isCompleteBlock = isOpening && !isClosing && line.includes(`</${tagName}>`);

      if (isClosing) {
        indentLevel = Math.max(0, indentLevel - 1);
      }

      const indent = '  '.repeat(indentLevel);
      indented.push(indent + line);

      if (isOpening && !isClosing && !isSelfClosing && !isCompleteBlock) {
        indentLevel++;
      }
    }

    return indented.join('\n');
  }

  // Fallback JS / CSS formatting
  let formattedJs = code
    .replace(/;\s*/g, ';\n')
    .replace(/\{\s*/g, ' {\n')
    .replace(/\}\s*/g, '\n}\n');

  const jsLines = formattedJs.split('\n').map(l => l.trim()).filter(Boolean);
  let jsIndent = 0;
  const indentedJs = [];

  for (const line of jsLines) {
    if (line.startsWith('}')) {
      jsIndent = Math.max(0, jsIndent - 1);
    }
    indentedJs.push('  '.repeat(jsIndent) + line);
    if (line.endsWith('{')) {
      jsIndent++;
    }
  }

  return indentedJs.join('\n');
};
