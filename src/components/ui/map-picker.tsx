'use client';

import { useEffect, useRef, useState } from 'react';
// Bundled, not from a CDN: one less third party between a hungry customer
// and a working map, and it still code-splits with this component.
import 'leaflet/dist/leaflet.css';
import { Icon } from '@/components/ui/icon';

/**
 * Drop a pin on the exact spot.
 *
 * Arugam Bay has almost no usable street addresses — guesthouses share a
 * name, lanes are unnamed, and "near the bridge" describes half the town.
 * A coordinate is what actually gets a driver to the door, so the pin is
 * the real answer and the typed address is context.
 *
 * OpenStreetMap through Leaflet rather than Google: no API key to obtain,
 * no billing account, and the tiles are good enough here. Loaded only when
 * the customer opens the map, because a map library is a lot of JavaScript
 * to send to someone who only wants a pickup.
 */

const ARUGAM_BAY = { lat: 6.8404, lng: 81.8353 };
const DEFAULT_ZOOM = 15;

export interface PickedPoint {
  lat: number;
  lng: number;
}

export function MapPicker({
  value,
  onChange,
  onClose,
}: {
  value: PickedPoint | null;
  onChange: (p: PickedPoint) => void;
  onClose: () => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [point, setPoint] = useState<PickedPoint>(value ?? ARUGAM_BAY);
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let map: import('leaflet').Map | null = null;
    let cancelled = false;
    let cleanup: (() => void) | null = null;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !holder.current) return;

      map = L.map(holder.current, { zoomControl: true, attributionControl: true })
        .setView([point.lat, point.lng], DEFAULT_ZOOM);

      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(map);

      /**
       * A drawn pin instead of Leaflet's default image.
       *
       * The stock marker loads two PNGs by relative path and 404s under
       * every bundler, which shows up as an invisible marker — the one
       * thing this whole screen depends on. An inline SVG also matches the
       * site's amber and needs no asset pipeline.
       */
      const icon = L.divIcon({
        className: '',
        html:
          '<svg width="34" height="44" viewBox="0 0 34 44" fill="none" ' +
          'xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M17 43s14-14.6 14-25A14 14 0 1 0 3 18c0 10.4 14 25 14 25Z" ' +
          'fill="#FDB940" stroke="#211F20" stroke-width="2.2" stroke-linejoin="round"/>' +
          '<circle cx="17" cy="17.5" r="5" fill="#211F20"/></svg>',
        iconSize: [34, 44],
        iconAnchor: [17, 43],   // tip of the pin, not its middle
      });

      const pin = L.marker([point.lat, point.lng], { draggable: true, icon }).addTo(map);

      pin.on('dragend', () => {
        const p = pin.getLatLng();
        setPoint({ lat: p.lat, lng: p.lng });
      });

      // Tapping is easier than dragging on a phone, so allow both.
      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        pin.setLatLng(e.latlng);
        setPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
      });

      // "My location" recentres the existing map rather than rebuilding it.
      const goto = (e: Event) => {
        const p = (e as CustomEvent<PickedPoint>).detail;
        pin.setLatLng([p.lat, p.lng]);
        map?.setView([p.lat, p.lng], 17);
      };
      window.addEventListener('mappicker:goto', goto);
      cleanup = () => window.removeEventListener('mappicker:goto', goto);

      setReady(true);
      // The container is sized by CSS after mount; without this the tiles
      // render into a zero-height box and the map looks broken.
      setTimeout(() => map?.invalidateSize(), 60);
    })();

    return () => {
      cancelled = true;
      cleanup?.();
      map?.remove();
    };
    // Intentionally once: re-running would rebuild the map under the user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function locate() {
    if (!navigator.geolocation) {
      setNote('הדפדפן לא תומך באיתור מיקום.');
      return;
    }
    setLocating(true);
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setPoint(p);
        // Nudge the map without rebuilding it.
        window.dispatchEvent(new CustomEvent('mappicker:goto', { detail: p }));
      },
      () => {
        setLocating(false);
        setNote('לא הצלחנו לאתר אתכם. גררו את הסיכה ידנית.');
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/50 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="סימון מיקום על המפה"
        className="flex max-h-[92dvh] w-full max-w-[600px] flex-col rounded-t-card bg-bg sm:rounded-card"
      >
        <header className="flex items-start gap-3 border-b border-line p-4">
          <div className="min-w-0 flex-1">
            <h2 className="font-bold">איפה אתם בדיוק?</h2>
            <p className="mt-0.5 text-[.82rem] text-fg-muted">
              גררו את הסיכה, או לחצו על המקום הנכון.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגור"
            className="grid size-9 shrink-0 place-items-center rounded-full border border-line-strong hover:bg-surface"
          >
            <Icon name="x" size={17} />
          </button>
        </header>

        <div className="relative">
          <div ref={holder} className="h-[340px] w-full bg-surface-sunk" />
          {!ready && (
            <div className="absolute inset-0 grid place-items-center text-sm text-fg-muted">
              טוען מפה…
            </div>
          )}
        </div>

        <footer className="flex flex-col gap-3 border-t border-line p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-ghost btn-sm" onClick={locate} disabled={locating}>
              <Icon name="map" size={15} />
              {locating ? 'מאתר…' : 'המיקום שלי'}
            </button>
            <span className="money text-[.76rem] text-fg-subtle">
              {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
            </span>
          </div>

          {note && <p className="text-[.8rem] text-danger">{note}</p>}

          <button
            type="button"
            className="btn btn-accent w-full justify-center"
            onClick={() => { onChange(point); onClose(); }}
          >
            זה המקום
          </button>
        </footer>
      </div>
    </div>
  );
}
