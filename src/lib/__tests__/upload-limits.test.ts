import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

/**
 * An upload must not promise more than the transport can carry.
 *
 * Next caps a server action body at 1MB unless told otherwise, and Vercel
 * caps a serverless request body at 4.5MB no matter what Next is told. The
 * specs promised 2-10MB. Every image upload on the site failed above a
 * megabyte, and because an action body overflow throws rather than
 * returning, the only symptom was a redacted React #441 — no mention of
 * size anywhere.
 *
 * Anything larger than the platform limit has to go straight to Storage
 * from the browser with a signed token.
 */
const VERCEL_BODY_LIMIT = 4.5 * 1024 * 1024;

function bodySizeLimitBytes(): number | null {
  const cfg = readFileSync('next.config.ts', 'utf8');
  const m = cfg.match(/bodySizeLimit:\s*['"](\d+)(mb|kb)['"]/i);
  if (!m) return null;
  return Number(m[1]) * (m[2].toLowerCase() === 'mb' ? 1024 * 1024 : 1024);
}

describe('upload limits', () => {
  // Every file that declares a maxBytes, wherever it lives. Scanning only
  // src/lib/spec missed HERO_IMAGE_SPEC — it sits in src/lib/data because
  // the hero types are shared with a client component — so the hero upload
  // stayed broken above 4.5MB while this test reported everything fine. A
  // guard with a blind spot is worse than none: it manufactures confidence.
  const specFiles = execSync(
    `grep -rl "maxBytes:" src --include=*.ts | grep -v __tests__ || true`,
  ).toString().trim().split('\n').filter(Boolean);

  const specs = specFiles
    .map((f) => {
      const src = readFileSync(f, 'utf8');
      // "8 * 1024 * 1024" — multiply the factors rather than eval them.
      const m = src.match(/maxBytes:\s*([\d*\s]+),/);
      const bytes = m
        ? m[1].split('*').map((n) => Number(n.trim())).reduce((a, b) => a * b, 1)
        : null;
      return { file: f, maxBytes: bytes };
    })
    .filter((s): s is { file: string; maxBytes: number } => s.maxBytes !== null);

  it('finds the specs', () => {
    expect(specs.length).toBeGreaterThan(2);
  });

  it('next.config declares a server action body limit', () => {
    expect(
      bodySizeLimitBytes(),
      'next.config.ts has no serverActions.bodySizeLimit, so the default 1MB applies ' +
      'and every upload over a megabyte fails as a redacted React #441.',
    ).not.toBeNull();
  });

  it('no spec promises more than the framework will accept', () => {
    const limit = bodySizeLimitBytes()!;
    for (const s of specs) {
      expect(
        s.maxBytes,
        `${s.file} allows ${Math.round(s.maxBytes / 1024 / 1024)}MB but ` +
        `serverActions.bodySizeLimit is ${Math.round(limit / 1024 / 1024)}MB.`,
      ).toBeLessThanOrEqual(limit);
    }
  });

  it('anything over the Vercel body cap uploads straight to Storage', () => {
    // One module mints every upload token; if a kind is listed there, its
    // bytes go browser-to-Storage and the request cap does not apply.
    const tickets = readFileSync('src/app/admin/upload-actions.ts', 'utf8');
    expect(tickets).toContain('createSignedUploadUrl');

    const kinds = readFileSync('src/lib/spec/uploads.ts', 'utf8');

    for (const s of specs.filter((x) => x.maxBytes > VERCEL_BODY_LIMIT)) {
      // src/lib/spec/gallery-image.ts -> the 'gallery' kind.
      const name = s.file.split('/').pop()!.replace('-image.ts', '').replace('-spec.ts', '');
      expect(
        kinds.includes(`${name}: {`),
        `${s.file} allows ${Math.round(s.maxBytes / 1024 / 1024)}MB, above Vercel's ` +
        `4.5MB request cap, but is not in UPLOAD_KINDS. It must upload straight ` +
        `to Storage with a signed token, or lower its limit.`,
      ).toBe(true);
    }
  });
});
