#!/usr/bin/env python3
"""
Repair Hebrew text that was stored as mojibake.

Cause: SQL containing Hebrew was moved through the macOS clipboard into the
Supabase SQL editor. The UTF-8 bytes were re-read as MacRoman, so every
Hebrew letter (whose UTF-8 encoding begins 0xD7) became the lozenge '◊'
followed by a MacRoman character.

The damage is lossless and reversible: encode the stored string back to
MacRoman bytes, then decode those bytes as UTF-8.

Idempotent — a string that is already correct will not round-trip and is
skipped. Safe to run twice.

Usage:  python3 scripts/repair-encoding.py [--apply]
        Without --apply it only reports what it would change.
"""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

# table -> columns holding {he, en} JSON
TARGETS = {
    "tenants": ["name"],
    "menu_categories": ["name"],
    "menu_items": ["name", "description"],
    "item_modifier_groups": ["name"],
    "item_modifier_options": ["name"],
    "opening_exceptions": ["reason"],
}

MOJIBAKE_MARK = "◊"  # U+25CA, what UTF-8 0xD7 becomes when read as MacRoman


def load_env():
    env = {}
    path = Path(".env.local")
    if not path.exists():
        sys.exit("✗ .env.local not found")
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, _, v = line.partition("=")
            env[k.strip()] = v.strip()
    return env


def repair(text):
    """Return the repaired string, or None if this text needs no change."""
    if not isinstance(text, str) or MOJIBAKE_MARK not in text:
        return None
    try:
        fixed = text.encode("mac_roman").decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        # Not the damage we know how to undo. Leave it alone rather than
        # guessing — a wrong "fix" is worse than visible mojibake.
        return None
    return fixed if fixed != text else None


def api(env, method, path, body=None):
    url = f"{env['NEXT_PUBLIC_SUPABASE_URL']}/rest/v1/{path}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("apikey", env["SUPABASE_SERVICE_ROLE_KEY"])
    req.add_header("Authorization", f"Bearer {env['SUPABASE_SERVICE_ROLE_KEY']}")
    req.add_header("Content-Type", "application/json; charset=utf-8")
    req.add_header("Prefer", "return=minimal")
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        sys.exit(f"✗ {method} {path}: {e.code} {e.read().decode('utf-8')[:300]}")


def main():
    apply_changes = "--apply" in sys.argv
    env = load_env()
    total = 0

    for table, columns in TARGETS.items():
        rows = api(env, "GET", f"{table}?select=id,{','.join(columns)}") or []
        for row in rows:
            patch = {}
            for col in columns:
                value = row.get(col)
                if not isinstance(value, dict):
                    continue
                new_value = dict(value)
                changed = False
                for lang, text in value.items():
                    fixed = repair(text)
                    if fixed is not None:
                        new_value[lang] = fixed
                        changed = True
                        print(f"  {table}.{col}.{lang}: {text[:34]!r} → {fixed[:34]!r}")
                if changed:
                    patch[col] = new_value
            if patch:
                total += 1
                if apply_changes:
                    api(env, "PATCH", f"{table}?id=eq.{row['id']}", patch)

    if total == 0:
        print("\n✓ No mojibake found. Nothing to repair.")
    elif apply_changes:
        print(f"\n✓ Repaired {total} row(s).")
    else:
        print(f"\n{total} row(s) would change. Re-run with --apply to write.")


if __name__ == "__main__":
    main()
