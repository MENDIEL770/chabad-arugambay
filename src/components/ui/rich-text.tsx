import { Fragment } from 'react';
import { parseRichText, type Block, type Inline } from '@/lib/rich-text';

function renderInline(nodes: Inline[]): React.ReactNode {
  return nodes.map((n, i) => {
    switch (n.t) {
      case 'text':
        return <Fragment key={i}>{n.v}</Fragment>;
      case 'b':
        return <strong key={i} className="font-semibold">{renderInline(n.v)}</strong>;
      case 'i':
        return <em key={i}>{renderInline(n.v)}</em>;
      case 'a': {
        const external = /^https?:\/\//i.test(n.href);
        return (
          <a
            key={i}
            href={n.href}
            // Links an editor typed point off this site. Opening them in a
            // new tab keeps a half-filled registration form alive behind.
            {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className="text-accent-strong underline underline-offset-2 hover:no-underline"
          >
            {renderInline(n.v)}
          </a>
        );
      }
    }
  });
}

function renderBlock(b: Block, i: number): React.ReactNode {
  if (b.t === 'ul') {
    return (
      <ul key={i} className="my-2 flex list-disc flex-col gap-1 ps-5">
        {b.items.map((it, j) => <li key={j}>{renderInline(it)}</li>)}
      </ul>
    );
  }
  return <p key={i}>{renderInline(b.v)}</p>;
}

/**
 * Renders the stored rich-text source.
 *
 * Takes a string, never HTML, and emits React elements — so there is no
 * route by which stored text can become markup.
 */
export function RichText({
  source, className = '',
}: {
  source: string | null | undefined;
  className?: string;
}) {
  const blocks = parseRichText(source ?? '');
  if (blocks.length === 0) return null;
  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {blocks.map(renderBlock)}
    </div>
  );
}
