/**
 * Rich-text helpers for notes and task notes. Content is stored as HTML, so
 * everything that goes into the editor — saved notes, pasted web pages — is
 * reduced to a small allow-list of tags and attributes first. No scripts,
 * styles, event handlers or javascript: links survive.
 */

const ALLOWED_TAGS = new Set([
  'P', 'DIV', 'BR', 'H1', 'H2', 'H3', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE',
  'UL', 'OL', 'LI', 'BLOCKQUOTE', 'A', 'CODE', 'PRE', 'HR', 'SPAN', 'MARK',
]);

/** Tags whose content is dropped entirely rather than unwrapped. */
const DROP_TAGS = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'HEAD', 'META', 'LINK', 'svg', 'SVG']);

function safeHref(href: string): string | null {
  const value = href.trim();
  return /^(https?:|mailto:|tel:)/i.test(value) ? value : null;
}

function clean(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent ?? '');
  if (node.nodeType !== Node.ELEMENT_NODE) return null;
  const el = node as Element;
  const tag = el.tagName.toUpperCase();
  if (DROP_TAGS.has(tag)) return null;

  const children = Array.from(el.childNodes)
    .map((child) => clean(child, doc))
    .filter((child): child is Node => child !== null);

  if (!ALLOWED_TAGS.has(tag)) {
    // Unknown wrapper (font, table, section…): keep its text, lose the tag.
    const fragment = doc.createDocumentFragment();
    children.forEach((child) => fragment.appendChild(child));
    return fragment;
  }

  // The editor's highlight command writes <span style="background-color: …">
  // in its own colour; styles are stripped, so keep the meaning as <mark>.
  // (Background colours pasted from web pages are dropped like other styles.)
  const highlight =
    tag === 'SPAN' && /background-color:\s*(#f3d36b|rgb\(243,\s*211,\s*107\))/i.test(el.getAttribute('style') ?? '');
  const out = doc.createElement(highlight ? 'mark' : tag === 'STRIKE' ? 's' : tag.toLowerCase());
  if (tag === 'A') {
    const href = safeHref(el.getAttribute('href') ?? '');
    if (href) {
      out.setAttribute('href', href);
      out.setAttribute('target', '_blank');
      out.setAttribute('rel', 'noopener noreferrer');
    }
  }
  if (tag === 'UL' && el.classList.contains('checklist')) out.setAttribute('class', 'checklist');
  if (tag === 'LI' && el.getAttribute('data-checked') === 'true') out.setAttribute('data-checked', 'true');
  children.forEach((child) => out.appendChild(child));
  return out;
}

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html');
  const out = document.implementation.createHTMLDocument('');
  const container = out.createElement('div');
  Array.from(doc.body.childNodes).forEach((child) => {
    const cleaned = clean(child, out);
    if (cleaned) container.appendChild(cleaned);
  });
  // Lists pasted or typed inside a paragraph leave empty <p></p> behind.
  return container.innerHTML.replace(/<p><\/p>/g, '');
}

const looksLikeHtml = (text: string) => /<\/?[a-z][\s\S]*>/i.test(text);

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Older task notes were plain text; turn them into paragraphs for the editor. */
export function toEditorHtml(value: string): string {
  if (!value) return '';
  if (looksLikeHtml(value)) return sanitizeHtml(value);
  return value
    .split(/\n/)
    .map((line) => `<p>${line ? escapeHtml(line) : '<br>'}</p>`)
    .join('');
}

/** Plain text for previews, tooltips and search. */
export function htmlToText(value: string): string {
  if (!value) return '';
  if (!looksLikeHtml(value)) return value;
  const doc = new DOMParser().parseFromString(
    value.replace(/<\/(p|div|h[1-3]|li|blockquote|pre)>/gi, '$&\n').replace(/<br\s*\/?>/gi, '\n'),
    'text/html',
  );
  return (doc.body.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim();
}

/** True when the editor holds nothing but empty paragraphs. */
export function isEmptyHtml(value: string): boolean {
  return htmlToText(value).trim() === '';
}
