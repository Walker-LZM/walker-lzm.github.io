import { Publication, PublicationType, ResearchArea } from '@/types/publication';
import { getConfig } from './config';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const bibtexParse = require('bibtex-parse-js');

// Map BibTeX entry types to our publication types
const typeMapping: Record<string, PublicationType> = {
  article: 'journal',
  inproceedings: 'conference',
  conference: 'conference',
  incollection: 'book-chapter',
  book: 'book',
  phdthesis: 'thesis',
  mastersthesis: 'thesis',
  techreport: 'technical-report',
  unpublished: 'preprint',
  misc: 'preprint',
};

// Convert month names to numbers
const monthMapping: Record<string, number> = {
  jan: 1, january: 1,
  feb: 2, february: 2,
  mar: 3, march: 3,
  apr: 4, april: 4,
  may: 5,
  jun: 6, june: 6,
  jul: 7, july: 7,
  aug: 8, august: 8,
  sep: 9, september: 9, sept: 9,
  oct: 10, october: 10,
  nov: 11, november: 11,
  dec: 12, december: 12,
};

export function parseBibTeX(bibtexContent: string): Publication[] {
  const config = getConfig();
  const authorName = config.author.name;
  const entries = bibtexParse.toJSON(bibtexContent);

  return entries.map((entry: { entryType: string; citationKey: string; entryTags: Record<string, string> }, index: number) => {
    const tags = entry.entryTags;

    // Parse badges (custom field: badge/badges; case-insensitive)
    const rawBadges = getTagCaseInsensitive(tags, 'badges') || getTagCaseInsensitive(tags, 'badge') || '';
    const badges = parseBadges(rawBadges);

    // Parse authors
    const authors = parseAuthors(tags.author || '', authorName);

    // Parse year and month
    const year = parseInt(tags.year) || new Date().getFullYear();
    const monthStr = tags.month?.toLowerCase() || '';
    const month = monthMapping[monthStr] || (parseInt(monthStr) || undefined);

    // Determine type
    const type = typeMapping[entry.entryType.toLowerCase()] || 'journal';

    // Parse tags/keywords
    const keywords = tags.keywords?.split(',').map((k: string) => k.trim()) || [];

    // Parse selected field (convert string to boolean)
    const selected = tags.selected === 'true' || tags.selected === 'yes';

    // Parse preview field (remove braces if present)
    const preview = tags.preview?.replace(/[{}]/g, '');

    // Parse PDF URL (custom fields: pdf/paper/file; case-insensitive)
    const rawPdf =
      getTagCaseInsensitive(tags, 'pdf') ||
      getTagCaseInsensitive(tags, 'paper') ||
      getTagCaseInsensitive(tags, 'file') ||
      '';
    const pdfUrl = normalizePdfUrl(rawPdf);

    // Create publication object
    const publication: Publication = {
      id: entry.citationKey || tags.id || `pub-${Date.now()}-${index}`,
      title: cleanBibTeXString(tags.title || 'Untitled'),
      authors,
      year,
      month: monthMapping[tags.month?.toLowerCase()] ? String(month) : tags.month,
      type,
      status: 'published',
      tags: keywords,
      keywords,
      researchArea: detectResearchArea(tags.title, keywords),

      // Optional fields
      journal: cleanBibTeXString(tags.journal),
      conference: cleanBibTeXString(tags.booktitle),
      volume: tags.volume,
      issue: tags.number,
      pages: tags.pages,
      doi: tags.doi,
      url: tags.url,
      code: tags.code,
      pdfUrl: pdfUrl || undefined,
      abstract: cleanBibTeXString(tags.abstract),
      description: cleanBibTeXString(tags.description || tags.note),
      selected,
      preview,

      // Custom badges shown on the Publications page (rendered next to action buttons)
      badges: badges.length ? badges : undefined,

      // Store original BibTeX (excluding custom fields)
      bibtex: reconstructBibTeX(entry, ['selected', 'preview', 'description', 'keywords', 'code', 'badge', 'badges', 'pdf', 'paper', 'file']),
    };

    // Clean up undefined fields
    Object.keys(publication).forEach(key => {
      if (publication[key as keyof Publication] === undefined) {
        delete publication[key as keyof Publication];
      }
    });

    return publication;
  }).sort((a: Publication, b: Publication) => {
    // Sort by year (descending), then by month if available
    if (b.year !== a.year) return b.year - a.year;

    // For month comparison, treat missing months as January (1) to ensure they appear last within the year
    const monthA = typeof a.month === 'string' ?
      (monthMapping[a.month.toLowerCase()] || parseInt(a.month) || 1) :
      (a.month || 1);
    const monthB = typeof b.month === 'string' ?
      (monthMapping[b.month.toLowerCase()] || parseInt(b.month) || 1) :
      (b.month || 1);

    // Sort by month descending (December to January)
    return monthB - monthA;
  });
}

function parseAuthors(authorsStr: string, highlightName?: string): Array<{ name: string; isHighlighted?: boolean; isCorresponding?: boolean; isCoAuthor?: boolean }> {
  if (!authorsStr) return [];

  // Split by "and" and clean up
  return authorsStr
    .split(/\sand\s/)
    .map(author => {
      // Clean up the author name
      let name = author.trim();

      // Check for corresponding author marker
      const isCorresponding = name.includes('*');

      // Check for co-author marker (#)
      const isCoAuthor = name.includes('#');

      // Remove special markers from name
      name = name.replace(/[*#]/g, '');

      // Handle "Last, First" format
      if (name.includes(',')) {
        const parts = name.split(',').map(p => p.trim());
        name = `${parts[1]} ${parts[0]}`;
      }

      // Check if this is the site owner (to highlight)
      let isHighlighted = false;
      if (highlightName) {
        const lowerName = name.toLowerCase();
        const lowerHighlight = highlightName.toLowerCase();
        isHighlighted = lowerName.includes(lowerHighlight);

        // Also check for reversed order (Last First) if not found
        if (!isHighlighted && lowerHighlight.includes(' ')) {
          const parts = lowerHighlight.split(' ');
          // Handle simple First Last case
          if (parts.length === 2) {
            const reversed = `${parts[1]} ${parts[0]}`;
            isHighlighted = lowerName.includes(reversed);
          }
        }
      }

      return {
        name: cleanBibTeXString(name),
        isHighlighted,
        isCorresponding,
        isCoAuthor,
      };
    })
    .filter(author => author.name);
}

function cleanBibTeXString(str?: string): string {
  if (!str) return '';

  // Remove outer quotes if present
  let cleaned = str.replace(/^["']|["']$/g, '');

  // Handle nested braces more carefully
  // First remove double braces {{content}} -> content
  cleaned = cleaned.replace(/\{\{([^}]*)\}\}/g, '$1');

  // Remove single braces {content} -> content, but be careful with nesting
  while (cleaned.includes('{') && cleaned.includes('}')) {
    const beforeLength = cleaned.length;
    cleaned = cleaned.replace(/\{([^{}]*)\}/g, '$1');
    // If no change was made, break to avoid infinite loop
    if (cleaned.length === beforeLength) break;
  }

  // Remove any remaining single braces
  cleaned = cleaned.replace(/[{}]/g, '');

  // Handle LaTeX commands (basic)
  cleaned = cleaned.replace(/\\textbf{([^}]*)}/g, '$1');
  cleaned = cleaned.replace(/\\emph{([^}]*)}/g, '$1');
  cleaned = cleaned.replace(/\\cite{[^}]*}/g, '');
  cleaned = cleaned.replace(/~/g, ' ');

  // Remove remaining backslashes
  cleaned = cleaned.replace(/\\/g, '');

  // Remove extra spaces and newlines
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

/** Case-insensitive getter for BibTeX tags (bibtex-parse-js preserves original key casing). */
function getTagCaseInsensitive(tags: Record<string, string>, key: string): string | undefined {
  const target = key.toLowerCase();
  for (const [k, v] of Object.entries(tags)) {
    if (k.toLowerCase() === target) return v;
  }
  return undefined;
}

/**
 * Normalize a PDF link from BibTeX fields like `pdf`, `paper`, or `file`.
 *
 * Supports:
 *  - Site-relative URLs: /assets/papers/xxx.pdf
 *  - Relative paths: assets/papers/xxx.pdf (auto-prepends '/')
 *  - External URLs: https://...
 *  - Zotero-style file field: path/to/xxx.pdf:application/pdf (keeps path part)
 *  - Multiple entries separated by ';' (picks the first PDF-like entry)
 */
function normalizePdfUrl(raw: string): string | undefined {
  if (!raw) return undefined;

  let v = raw
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/[{}]/g, '')
    .trim();
  if (!v) return undefined;

  // If multiple entries exist (common in Zotero export), pick a PDF-like one.
  const parts = v.split(';').map(p => p.trim()).filter(Boolean);
  const chosen = parts.find(p => /\.pdf(\b|:)/i.test(p)) || parts[0] || '';
  v = chosen.trim();

  // Strip Zotero-style suffix like ":application/pdf" (keep the path before ':')
  if (v.includes(':')) {
    const before = v.split(':')[0].trim();
    // If it looks like a path/URL to a PDF, keep it.
    if (/\.pdf$/i.test(before) || before.includes('/')) v = before;
  }

  // External URLs: keep as-is
  if (/^https?:\/\//i.test(v)) return v;

  // Normalize to web path
  v = v.replace(/\\/g, '/');

  // file:///... -> /...
  v = v.replace(/^file:\/*/i, '/');

  // Ensure site-relative leading slash
  if (!v.startsWith('/')) v = `/${v}`;

  return v;
}

/**
 * Parse a badge/badges field into a normalized badge list.
 *
 * Accepts comma/semicolon/pipe separated values, ignores case when detecting known rankings,
 * but returns canonical display strings (e.g., "ccf-a" -> "CCF-A", "jcr-q1" -> "JCR Q1").
 */
function parseBadges(raw: string): string[] {
  if (!raw) return [];

  const tokens = raw
    .replace(/[{}]/g, '')
    .split(/[;,|]/g)
    .map(t => t.trim())
    .filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    const normalized = normalizeBadgeToken(token);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }

  return out;
}

function normalizeBadgeToken(token: string): string | undefined {
  const raw = token.trim();
  if (!raw) return undefined;

  // Normalize whitespace/hyphens for matching
  const compact = raw
    .replace(/[_–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  const upper = compact.toUpperCase();

  // -------- Rankings (case-insensitive detection, canonical output) --------
  let m: RegExpMatchArray | null;

  // CCF-A/B/C
  m = upper.match(/^CCF[\s-]*([ABC])$/);
  if (m) return `CCF-${m[1]}`;

  // CAA-A+/A/B/C
  m = upper.match(/^CAA[\s-]*(A\+|A|B|C)$/);
  if (m) return `CAA-${m[1]}`;

  // CAAI-A/B/C
  m = upper.match(/^CAAI[\s-]*([ABC])$/);
  if (m) return `CAAI-${m[1]}`;

  // CORE A*/A/B/C
  m = upper.match(/^CORE[\s-]*(A\*|A|B|C)$/);
  if (m) return `CORE ${m[1]}`;

  // TH-A/B
  m = upper.match(/^TH[\s-]*([AB])$/);
  if (m) return `TH-${m[1]}`;

  // CAS Z1/Z2/Z3/Z4
  m = upper.match(/^CAS[\s-]*Z([1-4])$/);
  if (m) return `CAS Z${m[1]}`;

  // JCR Q1/Q2/Q3/Q4  (also accepts JCR-Q1)
  m = upper.match(/^JCR[\s-]*Q([1-4])$/);
  if (m) return `JCR Q${m[1]}`;

  // CiteScore Q1/Q2/Q3/Q4 (also accepts CITESCORE-Q1)
  m = upper.match(/^CITESCORE[\s-]*Q([1-4])$/);
  if (m) return `CiteScore Q${m[1]}`;

  // -------- Awards / special labels --------
  // Canonicalize common ones; otherwise keep original as-is (trimmed)
  if (/(^|\b)ORAL(\b|$)/i.test(compact)) return 'Oral';
  if (/(^|\b)POSTER(\b|$)/i.test(compact)) return 'Poster';
  if (/(^|\b)SPOTLIGHT(\b|$)/i.test(compact)) return 'Spotlight';
  if (/BEST\s*STUDENT\s*PAPER/i.test(compact)) return 'Best Student Paper';
  if (/BEST\s*PAPER/i.test(compact)) return 'Best Paper';
  if (/OUTSTANDING\s*PAPER/i.test(compact)) return 'Outstanding Paper';
  if (/HONORABLE\s*MENTION/i.test(compact)) return 'Honorable Mention';
  if (/TEST[\s-]*OF[\s-]*TIME\s*AWARD/i.test(compact)) return 'Test-of-Time Award';
  if (/HIGHLY\s*CITED/i.test(compact)) return 'Highly Cited';
  if (/(^|\b)HOT(\b|$)/i.test(compact)) return 'Hot';

  // Keep user-provided label (trimmed) for anything else
  return compact;
}

function detectResearchArea(title: string, keywords: string[]): ResearchArea {
  const text = (title + ' ' + keywords.join(' ')).toLowerCase();

  if (text.includes('healthcare') || text.includes('medical') || text.includes('health')) {
    return 'ai-healthcare';
  }
  if (text.includes('signal') || text.includes('processing')) {
    return 'signal-processing';
  }
  if (text.includes('reliability') || text.includes('fault') || text.includes('diagnosis')) {
    return 'reliability-engineering';
  }
  if (text.includes('quantum')) {
    return 'quantum-computing';
  }
  if (text.includes('neural') || text.includes('spiking')) {
    return 'neural-networks';
  }
  if (text.includes('transformer') || text.includes('attention')) {
    return 'transformer-architectures';
  }

  return 'machine-learning';
}

function reconstructBibTeX(entry: { entryType: string; citationKey: string; entryTags: Record<string, string> }, excludeFields: string[] = []): string {
  const { entryType, citationKey, entryTags } = entry;

  let bibtex = `@${entryType}{${citationKey},\n`;

  Object.entries(entryTags).forEach(([key, value]) => {
    // Skip excluded fields
    if (!excludeFields.includes(key.toLowerCase())) {
      let cleanValue = value;

      // Clean author field by removing # and * symbols
      if (key.toLowerCase() === 'author') {
        cleanValue = value.replace(/[#*]/g, '');
      }

      bibtex += `  ${key} = {${cleanValue}},\n`;
    }
  });

  // Remove trailing comma and newline
  bibtex = bibtex.slice(0, -2) + '\n';
  bibtex += '}';

  return bibtex;
} 
