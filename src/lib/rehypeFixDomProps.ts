import rehypeRaw from 'rehype-raw';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';

export function parseCssStringToObject(cssString: string): Record<string, string> {
  const styleObj: Record<string, string> = {};
  if (!cssString || typeof cssString !== 'string') return styleObj;

  // Split declarations by semicolon, taking care of quotes
  const declarations = cssString.split(/;(?=(?:[^'"]*['"][^'"]*['"])*[^'"]*$)/);
  for (const decl of declarations) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx === -1) continue;
    const property = decl.slice(0, colonIdx).trim();
    const value = decl.slice(colonIdx + 1).trim();
    if (!property || !value) continue;

    // Strip potentially dangerous CSS values (expression(), javascript:, vbscript:, url())
    const normalizedVal = value.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
    if (
      normalizedVal.includes('expression(') ||
      normalizedVal.includes('javascript:') ||
      normalizedVal.includes('vbscript:') ||
      normalizedVal.includes('url(')
    ) {
      continue;
    }

    // Convert CSS property-name to camelCase (e.g. background-color -> backgroundColor)
    const camelProp = property.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    styleObj[camelProp] = value;
  }
  return styleObj;
}

const attrMap: Record<string, string> = {
  'viewbox': 'viewBox',
  'fill-opacity': 'fillOpacity',
  'fill-rule': 'fillRule',
  'stroke-width': 'strokeWidth',
  'stroke-linecap': 'strokeLinecap',
  'stroke-linejoin': 'strokeLinejoin',
  'stroke-opacity': 'strokeOpacity',
  'stroke-dasharray': 'strokeDasharray',
  'stroke-dashoffset': 'strokeDashoffset',
  'clip-rule': 'clipRule',
  'clip-path': 'clipPath',
  'font-size': 'fontSize',
  'font-family': 'fontFamily',
  'font-weight': 'fontWeight',
  'text-anchor': 'textAnchor',
  'dominant-baseline': 'dominantBaseline',
  'alignment-baseline': 'alignmentBaseline',
  'xmlns:xlink': 'xmlnsXlink',
  'xml:space': 'xmlSpace',
  'xlink:href': 'xlinkHref',
  'crossorigin': 'crossOrigin',
  'autocomplete': 'autoComplete',
  'autofocus': 'autoFocus',
  'readonly': 'readOnly',
  'tabindex': 'tabIndex',
  'maxlength': 'maxLength',
  'minlength': 'minLength',
};

const SAFE_URL_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:', 'data:image/', 'data:video/', 'data:audio/'];
const URL_PROPS = new Set([
  'href', 'src', 'action', 'formaction', 'data', 'poster', 'background',
  'xlinkhref', 'xlink:href', 'srcset', 'cite', 'longdesc', 'usemap', 'manifest'
]);

function isSafeUrl(rawUrl: unknown): boolean {
  if (typeof rawUrl !== 'string') return true;
  // Strip ASCII control characters and whitespace before protocol check to defeat obfuscation
  const normalized = rawUrl.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
  if (!normalized) return true;
  if (/^[./#?]/.test(normalized)) return true;
  return SAFE_URL_PROTOCOLS.some((protocol) => normalized.startsWith(protocol));
}

const ALLOWED_COLON_PREFIXES = ['xml:', 'xmlns:', 'xlink:'];
const DANGEROUS_TAGS = new Set(['script', 'iframe', 'object', 'embed', 'form', 'base', 'meta']);

export const markdownSanitizeSchema = {
  ...defaultSchema,
  tagNames: Array.from(new Set([...(defaultSchema.tagNames || []), 'audio', 'source'])),
  attributes: {
    ...(defaultSchema.attributes || {}),
    '*': [
      ...((defaultSchema.attributes && defaultSchema.attributes['*']) || []),
      'className',
      'style',
      'dir',
      'lang',
    ],
    audio: ['src', 'controls', 'preload', 'loop', 'muted', 'className', 'style'],
    source: ['src', 'type'],
  },
  protocols: {
    ...(defaultSchema.protocols || {}),
    src: ['http', 'https', 'data'],
    href: ['http', 'https', 'mailto', 'tel'],
  },
};

export function rehypeFixDomProps() {
  return (tree: any) => {
    function visit(node: any) {
      if (!node) return;

      if (node.type === 'element') {
        if (typeof node.tagName === 'string' && DANGEROUS_TAGS.has(node.tagName.toLowerCase())) {
          node.type = 'text';
          node.value = '';
          delete node.children;
          delete node.properties;
          return;
        }

        if (node.properties) {
          const props = node.properties;
          const newProps: Record<string, any> = {};

          // 1. Convert style string to style object if needed
          if (typeof props.style === 'string') {
            props.style = parseCssStringToObject(props.style);
          }

          // 2. Map known SVG / HTML property names & sanitize key names and URLs
          for (const [key, value] of Object.entries(props)) {
            const lowerKey = key.toLowerCase();

            // Allow known SVG namespaced prefixes even though they contain ':'
            if (key.includes(':')) {
              const isAllowedPrefix = ALLOWED_COLON_PREFIXES.some((prefix) => lowerKey.startsWith(prefix));
              if (!isAllowedPrefix) {
                continue;
              }
            }

            // Skip malformed keys generated by misparsed HTML/style tokens
            if (/[#;\s"']/.test(key) || /^\d+[a-z%]*;?$/i.test(key) || /^\d+$/.test(key)) {
              continue;
            }

            // Defense-in-depth: strip inline event handlers (onclick, onerror, onload, etc.)
            if (/^on[a-z]/i.test(lowerKey)) {
              continue;
            }

            // Sanitize URL attributes against javascript:/data:text/html XSS
            if (URL_PROPS.has(lowerKey) && typeof value === 'string' && !isSafeUrl(value)) {
              continue;
            }

            if (attrMap[lowerKey]) {
              newProps[attrMap[lowerKey]] = value;
            } else if (key === 'class') {
              newProps['className'] = value;
            } else if (key === 'for') {
              newProps['htmlFor'] = value;
            } else {
              newProps[key] = value;
            }
          }
          node.properties = newProps;
        }
      }

      if (node.children && Array.isArray(node.children)) {
        node.children.forEach(visit);
      }
    }

    visit(tree);
  };
}

export const markdownRehypePlugins: any[] = [
  rehypeRaw,
  [rehypeSanitize, markdownSanitizeSchema],
  rehypeFixDomProps,
];
