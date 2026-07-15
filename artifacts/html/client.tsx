import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Artifact } from '@/components/create-artifact';
import { DocumentSkeleton } from '@/components/document-skeleton';
import { CodeEditor } from '@/components/code-editor';
import {
  CheckCircleFillIcon,
  ClockRewind,
  CopyIcon,
  DownloadIcon,
  EyeIcon,
  GlobeIcon,
  LineChartIcon,
  RedoIcon,
  SparklesIcon,
  UndoIcon,
  WarningIcon,
  CrossSmallIcon,
} from '@/components/icons';
import { cn } from '@/lib/utils';
import { analyzeHtml, type SeoCheckStatus } from '@/lib/html/seo';

interface HtmlArtifactMetadata {
  documentId: string | null;
}

type ViewMode = 'preview' | 'crawler' | 'code';

const statusIcon = (status: SeoCheckStatus) => {
  if (status === 'pass') {
    return (
      <span className="text-green-600 dark:text-green-500">
        <CheckCircleFillIcon size={16} />
      </span>
    );
  }
  if (status === 'warn') {
    return (
      <span className="text-amber-500">
        <WarningIcon size={16} />
      </span>
    );
  }
  return (
    <span className="text-red-500">
      <CrossSmallIcon size={16} />
    </span>
  );
};

function CrawlerView({
  content,
  documentId,
}: {
  content: string;
  documentId: string | null;
}) {
  const report = useMemo(() => analyzeHtml(content), [content]);

  const scoreColor =
    report.score >= 80
      ? 'text-green-600 dark:text-green-500'
      : report.score >= 55
        ? 'text-amber-500'
        : 'text-red-500';

  const publishedPath = documentId ? `/site/${documentId}` : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6 md:p-10">
      {/* Score header */}
      <div className="flex items-center justify-between rounded-xl border p-5">
        <div>
          <div className="text-sm text-muted-foreground">
            Crawlability score
          </div>
          <div className="text-xs text-muted-foreground">
            What a search crawler sees with JavaScript disabled.
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={cn('text-4xl font-semibold', scoreColor)}>
            {report.score}
          </span>
          <span className="text-lg text-muted-foreground">
            / 100 · {report.grade}
          </span>
        </div>
      </div>

      {/* SERP preview */}
      <section>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Search result preview
        </h3>
        <div className="rounded-lg border p-4">
          <div className="truncate text-xs text-muted-foreground">
            {publishedPath ? `yoursite.com${publishedPath}` : 'yoursite.com/…'}
          </div>
          <div className="truncate text-lg text-blue-700 dark:text-blue-400">
            {report.title ?? 'Untitled page'}
          </div>
          <div className="line-clamp-2 text-sm text-muted-foreground">
            {report.description ??
              'No meta description — search engines will auto-generate a snippet from page text.'}
          </div>
        </div>
      </section>

      {/* Stat row */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Words in HTML', value: report.wordCount },
          { label: 'Headings', value: report.headings.length },
          { label: 'OG tags', value: report.openGraphCount },
          { label: 'JSON-LD', value: report.structuredData.length },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border p-3">
            <div className="text-2xl font-semibold">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </section>

      {/* Checks */}
      <section>
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          Checks
        </h3>
        <ul className="flex flex-col divide-y rounded-lg border">
          {report.checks.map((check) => (
            <li key={check.id} className="flex items-start gap-3 p-3">
              <span className="mt-0.5 shrink-0">
                {statusIcon(check.status)}
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium">{check.label}</div>
                <div className="text-xs text-muted-foreground">
                  {check.detail}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Heading outline */}
      {report.headings.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">
            Document outline
          </h3>
          <ul className="rounded-lg border p-3 text-sm">
            {report.headings.map((h, i) => (
              <li
                key={`${h.level}-${i}`}
                className="py-0.5 text-muted-foreground"
                style={{ paddingLeft: `${(h.level - 1) * 16}px` }}
              >
                <span className="mr-2 text-xs uppercase text-muted-foreground/70">
                  h{h.level}
                </span>
                {h.text || <em>(empty)</em>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
        active
          ? 'bg-background text-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

export const htmlArtifact = new Artifact<'html', HtmlArtifactMetadata>({
  kind: 'html',
  description:
    'Generates complete, crawlable HTML pages (not SPAs) that publish to a real URL.',
  initialize: async ({ documentId, setMetadata }) => {
    setMetadata({ documentId });
  },
  onStreamPart: ({ streamPart, setArtifact }) => {
    if (streamPart.type === 'html-delta') {
      setArtifact((draftArtifact) => ({
        ...draftArtifact,
        content: streamPart.content as string,
        isVisible: true,
        status: 'streaming',
      }));
    }
  },
  content: ({ content, status, isLoading, metadata }) => {
    const [view, setView] = useState<ViewMode>('preview');

    if (isLoading) {
      return <DocumentSkeleton artifactKind="html" />;
    }

    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-1 border-b bg-muted/40 p-2">
          <div className="flex items-center gap-1 rounded-lg bg-muted p-1">
            <TabButton
              active={view === 'preview'}
              onClick={() => setView('preview')}
              icon={<EyeIcon size={16} />}
              label="Preview"
            />
            <TabButton
              active={view === 'crawler'}
              onClick={() => setView('crawler')}
              icon={<LineChartIcon size={16} />}
              label="Crawler view"
            />
            <TabButton
              active={view === 'code'}
              onClick={() => setView('code')}
              icon={<GlobeIcon size={16} />}
              label="HTML"
            />
          </div>
          {status === 'streaming' && (
            <span className="ml-2 text-xs text-muted-foreground">
              generating…
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-auto">
          {view === 'preview' && (
            <iframe
              title="Site preview"
              className="h-full min-h-[60vh] w-full border-0 bg-white"
              sandbox="allow-scripts allow-popups allow-forms allow-modals"
              srcDoc={content}
            />
          )}

          {view === 'crawler' && (
            <CrawlerView
              content={content}
              documentId={metadata?.documentId ?? null}
            />
          )}

          {view === 'code' && (
            <div className="p-2 text-sm">
              <CodeEditor
                content={content}
                onSaveContent={() => {}}
                status={status}
                isCurrentVersion
                currentVersionIndex={0}
                suggestions={[]}
              />
            </div>
          )}
        </div>
      </div>
    );
  },
  actions: [
    {
      icon: <ClockRewind size={18} />,
      description: 'View changes',
      onClick: ({ handleVersionChange }) => handleVersionChange('toggle'),
      isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0,
    },
    {
      icon: <UndoIcon size={18} />,
      description: 'View previous version',
      onClick: ({ handleVersionChange }) => handleVersionChange('prev'),
      isDisabled: ({ currentVersionIndex }) => currentVersionIndex === 0,
    },
    {
      icon: <RedoIcon size={18} />,
      description: 'View next version',
      onClick: ({ handleVersionChange }) => handleVersionChange('next'),
      isDisabled: ({ isCurrentVersion }) => isCurrentVersion,
    },
    {
      icon: <GlobeIcon size={18} />,
      description: 'Open published page (real crawlable URL)',
      onClick: ({ metadata }) => {
        if (metadata?.documentId) {
          window.open(`/site/${metadata.documentId}`, '_blank');
        } else {
          toast.error('Publish is available once the page is saved.');
        }
      },
    },
    {
      icon: <DownloadIcon size={18} />,
      description: 'Download .html',
      onClick: ({ content }) => {
        const blob = new Blob([content], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'index.html';
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Downloaded index.html');
      },
    },
    {
      icon: <CopyIcon size={18} />,
      description: 'Copy HTML',
      onClick: ({ content }) => {
        navigator.clipboard.writeText(content);
        toast.success('Copied HTML to clipboard!');
      },
    },
  ],
  toolbar: [
    {
      icon: <LineChartIcon />,
      description: 'Boost SEO & crawlability',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content:
            'Improve the SEO and crawlability of this page: refine the title and meta description, add Open Graph and Twitter card tags, add or enrich the schema.org JSON-LD structured data, and make sure all meaningful content is in the HTML markup (not JavaScript).',
        });
      },
    },
    {
      icon: <SparklesIcon />,
      description: 'Add progressive-enhancement interactivity',
      onClick: ({ appendMessage }) => {
        appendMessage({
          role: 'user',
          content:
            'Add tasteful interactivity (e.g. a mobile menu toggle, smooth scrolling, or an accordion) using a single inline script. Keep all content visible in the HTML without JavaScript — the interactivity should only enhance it.',
        });
      },
    },
  ],
});
