/**
 * Crawlability / SEO analysis for generated HTML documents.
 *
 * This is intentionally dependency-free and DOM-free (regex based) so it can run
 * unchanged on the server (public site route, tests) and in the browser (the
 * Crawlability panel in the artifact UI).
 *
 * The whole premise of this platform is that a build is a *complete, crawlable
 * HTML document* rather than a client-rendered SPA shell. These checks measure
 * how well a given document delivers on that promise.
 */

export type SeoCheckStatus = 'pass' | 'warn' | 'fail';

export interface SeoCheck {
  id: string;
  label: string;
  status: SeoCheckStatus;
  detail: string;
  /** Relative weight of this check towards the overall score. */
  weight: number;
}

export interface HeadingNode {
  level: number;
  text: string;
}

export interface SeoReport {
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  title: string | null;
  description: string | null;
  lang: string | null;
  canonical: string | null;
  headings: HeadingNode[];
  imagesTotal: number;
  imagesMissingAlt: number;
  wordCount: number;
  hasViewport: boolean;
  openGraphCount: number;
  hasTwitterCard: boolean;
  structuredData: string[];
  internalLinks: number;
  checks: SeoCheck[];
}

const stripTags = (html: string): string =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const firstMatch = (html: string, re: RegExp): string | null => {
  const m = html.match(re);
  return m ? m[1].trim() : null;
};

export function analyzeHtml(html: string): SeoReport {
  const source = html ?? '';

  const title = firstMatch(source, /<title[^>]*>([\s\S]*?)<\/title>/i);

  const description =
    firstMatch(
      source,
      /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i,
    ) ??
    firstMatch(
      source,
      /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i,
    );

  const lang = firstMatch(source, /<html[^>]*\blang=["']([^"']+)["']/i);

  const canonical = firstMatch(
    source,
    /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i,
  );

  // Heading outline
  const headingRe = /<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const headings: HeadingNode[] = Array.from(
    source.matchAll(headingRe),
    (m) => ({
      level: Number(m[1]),
      text: stripTags(m[2]).slice(0, 120),
    }),
  );
  const h1Count = headings.filter((h) => h.level === 1).length;

  // Images and alt coverage
  const imgTags = source.match(/<img\b[^>]*>/gi) ?? [];
  const imagesTotal = imgTags.length;
  const imagesMissingAlt = imgTags.filter(
    (tag) =>
      !/\balt=["'][^"']*["']/i.test(tag) || /\balt=["']\s*["']/i.test(tag),
  ).length;

  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(source);

  const openGraphCount = (
    source.match(/<meta[^>]+property=["']og:[^"']+["']/gi) ?? []
  ).length;

  const hasTwitterCard = /<meta[^>]+name=["']twitter:card["']/i.test(source);

  // schema.org structured data (JSON-LD)
  const ldRe =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const structuredData: string[] = Array.from(
    source.matchAll(ldRe),
    (m) => firstMatch(m[1], /"@type"\s*:\s*"([^"]+)"/) ?? 'Thing',
  );

  const internalLinks = (source.match(/<a\b[^>]*href=/gi) ?? []).length;

  const text = stripTags(source);
  const wordCount = text ? text.split(/\s+/).length : 0;

  const checks: SeoCheck[] = [
    {
      id: 'title',
      label: 'Title tag',
      weight: 15,
      ...(title
        ? title.length >= 10 && title.length <= 65
          ? { status: 'pass', detail: `"${title}" (${title.length} chars)` }
          : {
              status: 'warn',
              detail: `Present but ${title.length} chars (aim for 10–65).`,
            }
        : {
            status: 'fail',
            detail: 'No <title> found — crawlers show a blank tab.',
          }),
    },
    {
      id: 'description',
      label: 'Meta description',
      weight: 12,
      ...(description
        ? description.length >= 50 && description.length <= 160
          ? { status: 'pass', detail: `${description.length} chars.` }
          : {
              status: 'warn',
              detail: `Present but ${description.length} chars (aim for 50–160).`,
            }
        : {
            status: 'fail',
            detail: 'No meta description — search snippets auto-generated.',
          }),
    },
    {
      id: 'h1',
      label: 'Single H1',
      weight: 10,
      ...(h1Count === 1
        ? { status: 'pass', detail: 'Exactly one H1.' }
        : h1Count === 0
          ? { status: 'fail', detail: 'No H1 heading.' }
          : {
              status: 'warn',
              detail: `${h1Count} H1s (prefer one per page).`,
            }),
    },
    {
      id: 'content',
      label: 'Crawlable body text',
      weight: 15,
      ...(wordCount >= 200
        ? { status: 'pass', detail: `${wordCount} words in the initial HTML.` }
        : wordCount >= 50
          ? {
              status: 'warn',
              detail: `Only ${wordCount} words — thin content.`,
            }
          : {
              status: 'fail',
              detail: `${wordCount} words. Looks like an empty shell — the exact SPA problem this avoids.`,
            }),
    },
    {
      id: 'lang',
      label: 'html lang attribute',
      weight: 6,
      ...(lang
        ? { status: 'pass', detail: `lang="${lang}"` }
        : { status: 'warn', detail: 'No lang attribute on <html>.' }),
    },
    {
      id: 'viewport',
      label: 'Responsive viewport',
      weight: 6,
      ...(hasViewport
        ? { status: 'pass', detail: 'Viewport meta present.' }
        : { status: 'warn', detail: 'No viewport meta — mobile ranking hit.' }),
    },
    {
      id: 'og',
      label: 'Open Graph tags',
      weight: 10,
      ...(openGraphCount >= 3
        ? { status: 'pass', detail: `${openGraphCount} og: tags.` }
        : openGraphCount > 0
          ? { status: 'warn', detail: `Only ${openGraphCount} og: tags.` }
          : {
              status: 'fail',
              detail: 'No Open Graph tags — poor social/link previews.',
            }),
    },
    {
      id: 'twitter',
      label: 'Twitter card',
      weight: 4,
      ...(hasTwitterCard
        ? { status: 'pass', detail: 'twitter:card present.' }
        : { status: 'warn', detail: 'No twitter:card meta.' }),
    },
    {
      id: 'jsonld',
      label: 'Structured data (schema.org)',
      weight: 12,
      ...(structuredData.length > 0
        ? {
            status: 'pass',
            detail: `JSON-LD: ${structuredData.join(', ')}.`,
          }
        : {
            status: 'fail',
            detail: 'No JSON-LD — no rich results eligibility.',
          }),
    },
    {
      id: 'alt',
      label: 'Image alt text',
      weight: 6,
      ...(imagesTotal === 0
        ? { status: 'pass', detail: 'No images to caption.' }
        : imagesMissingAlt === 0
          ? {
              status: 'pass',
              detail: `All ${imagesTotal} images have alt text.`,
            }
          : {
              status: 'warn',
              detail: `${imagesMissingAlt}/${imagesTotal} images missing alt text.`,
            }),
    },
    {
      id: 'canonical',
      label: 'Canonical URL',
      weight: 4,
      ...(canonical
        ? { status: 'pass', detail: canonical }
        : { status: 'warn', detail: 'No canonical link.' }),
    },
  ];

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const earned = checks.reduce((sum, c) => {
    const factor = c.status === 'pass' ? 1 : c.status === 'warn' ? 0.5 : 0;
    return sum + c.weight * factor;
  }, 0);
  const score = Math.round((earned / totalWeight) * 100);

  const grade =
    score >= 90
      ? 'A'
      : score >= 80
        ? 'B'
        : score >= 70
          ? 'C'
          : score >= 55
            ? 'D'
            : 'F';

  return {
    score,
    grade,
    title,
    description,
    lang,
    canonical,
    headings,
    imagesTotal,
    imagesMissingAlt,
    wordCount,
    hasViewport,
    openGraphCount,
    hasTwitterCard,
    structuredData,
    internalLinks,
    checks,
  };
}
