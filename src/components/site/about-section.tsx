import Image from 'next/image';
import type { AboutContent } from '@/lib/data/gallery';
import { Reveal } from './reveal';

/**
 * The two portraits are optional on purpose.
 *
 * Until a real photo of the shluchim is uploaded the section still reads
 * properly as text — far better than a grey placeholder frame announcing
 * that something is missing.
 */
export function AboutSection({ about }: { about: AboutContent }) {
  const hasPortraits = Boolean(about.shluchimUrl || about.rebbeUrl);

  return (
    <section id="about" className="border-y border-line bg-surface py-18">
      <div
        className={`wrap grid items-start gap-11 ${
          hasPortraits ? 'grid-cols-[1.1fr_.9fr] max-[860px]:grid-cols-1' : 'grid-cols-1'
        }`}
      >
        <Reveal>
          <span className="eyebrow">אודות</span>
          <h2 className="mt-2 mb-4 text-balance text-[clamp(1.6rem,3vw,2.1rem)] font-bold tracking-[-.015em]">
            {about.heading.he}
          </h2>
          {/* Blank lines in the admin become paragraphs, which is how someone
              writing prose expects a textarea to behave. */}
          <div className="flex max-w-[58ch] flex-col gap-3 text-[1.02rem] leading-relaxed text-fg-muted">
            {about.body.he
              .split(/\n{2,}/)
              .map((p) => p.trim())
              .filter(Boolean)
              .map((p, i) => (
                <p key={i}>{p}</p>
              ))}
          </div>
        </Reveal>

        {hasPortraits && (
          <Reveal delay={120}>
            <div className="grid grid-cols-2 gap-4 max-[520px]:grid-cols-1">
              {[
                { url: about.shluchimUrl, caption: about.shluchimCaption?.he ?? 'השלוחים' },
                { url: about.rebbeUrl, caption: about.rebbeCaption?.he ?? 'הרבי מליובאוויטש' },
              ]
                .filter((p) => p.url)
                .map((p) => (
                  <figure key={p.caption} className="flex flex-col gap-2">
                    <div className="relative aspect-[4/5] overflow-hidden rounded-card border border-line bg-bg">
                      <Image src={p.url!} alt={p.caption} fill sizes="(max-width:860px) 50vw, 280px" className="object-cover" />
                    </div>
                    <figcaption className="text-center text-[.82rem] text-fg-subtle">
                      {p.caption}
                    </figcaption>
                  </figure>
                ))}
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
