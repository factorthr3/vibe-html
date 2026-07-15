import { getDocumentById } from '@/lib/db/queries';

/**
 * Public, crawlable published page.
 *
 * This is the core differentiator of the platform: a build is served here as a
 * complete `text/html` document with NO authentication and NO client-side
 * framework shell. A crawler (or a `curl`) receives the full, rendered markup in
 * the very first response — the opposite of the empty-`<div id="root">` payload
 * that single-page-app vibe-coding tools ship.
 *
 * The route lives outside the auth middleware matcher (see middleware.ts) so it
 * is reachable by bots and unauthenticated visitors.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let document: Awaited<ReturnType<typeof getDocumentById>> | undefined;

  try {
    document = await getDocumentById({ id });
  } catch {
    document = undefined;
  }

  if (!document || document.kind !== 'html' || !document.content) {
    return new Response(notFoundHtml(), {
      status: 404,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-robots-tag': 'noindex',
      },
    });
  }

  return new Response(document.content, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      // Explicitly invite crawlers to index the published page.
      'x-robots-tag': 'index, follow',
      // Published pages are cacheable; content changes create a new version.
      'cache-control':
        'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
    },
  });
}

function notFoundHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Page not found</title>
  <style>
    body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; color: #111; }
    main { text-align: center; }
    h1 { font-size: 3rem; margin: 0; }
    p { color: #666; }
  </style>
</head>
<body>
  <main>
    <h1>404</h1>
    <p>This page has not been published, or is not an HTML build.</p>
  </main>
</body>
</html>`;
}
