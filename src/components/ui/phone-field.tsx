'use client';

import { useState } from 'react';
import { COUNTRIES, DEFAULT_COUNTRY, digitsOnly, toE164 } from '@/lib/phone';

/**
 * Country picker plus exactly ten local digits.
 *
 * The visible input is capped at 10 characters as asked; the country code
 * lives beside it rather than inside it, because an Israeli 05x and a Sri
 * Lankan 07x are both ten digits from zero and nothing else tells them
 * apart. A hidden field carries the combined E.164 value, so every form
 * posts one canonical string.
 */
export function PhoneField({
  name = 'phone',
  required = true,
  label = 'טלפון (וואטסאפ)',
  hint = 'לשם נשלח את העדכונים.',
}: {
  name?: string;
  required?: boolean;
  label?: string;
  hint?: string;
}) {
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  const [local, setLocal] = useState('');
  const [touched, setTouched] = useState(false);

  const result = toE164(country.code, local);
  const showError = touched && local.length > 0 && !result.ok;

  return (
    <div>
      <span className="label">{label}</span>

      <div className="flex gap-2">
        <select
          aria-label="קידומת מדינה"
          className="field !w-auto shrink-0"
          value={country.iso}
          onChange={(e) =>
            setCountry(COUNTRIES.find((c) => c.iso === e.target.value) ?? DEFAULT_COUNTRY)
          }
        >
          {COUNTRIES.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.label}
            </option>
          ))}
        </select>

        <input
          className="field ltr flex-1"
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          value={local}
          onChange={(e) => setLocal(digitsOnly(e.target.value).slice(0, 10))}
          onBlur={() => setTouched(true)}
          placeholder={country.example}
          aria-label={label}
          aria-invalid={showError || undefined}
          required={required}
        />
      </div>

      {/* One canonical value for the server; the two visible controls are
          only how a person types it. */}
      <input type="hidden" name={name} value={result.e164 ?? ''} />

      <span className={`mt-1 block text-[.75rem] ${showError ? 'text-danger' : 'text-fg-subtle'}`}>
        {showError ? result.error : `${hint} לדוגמה ${country.example}`}
      </span>
    </div>
  );
}
