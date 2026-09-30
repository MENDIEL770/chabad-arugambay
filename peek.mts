import { HebrewCalendar, Location, HDate, Event, flags } from '@hebcal/core';
import { computeZmanim } from './src/lib/zmanim/compute';
import { ARUGAM_BAY, BAAL_HATANYA_ARUGAM_BAY as P } from './src/lib/zmanim/profile';

const today = '2026-09-30';
const loc = new Location(ARUGAM_BAY.latitude, ARUGAM_BAY.longitude, false, ARUGAM_BAY.timezone, 'Arugam Bay', 'LK');
const evs = HebrewCalendar.calendar({
  start: new Date('2026-09-28'), end: new Date('2026-10-20'),
  location: loc, il: false, sedrot: true, candlelighting: false, locale: 'he',
});
console.log('--- hebcal events ---');
for (const e of evs) {
  const d = e.getDate().greg().toISOString().slice(0,10);
  console.log(d, '|', e.render('he'), '|', e.render('en'), '|', e.getFlags());
}
console.log('\n--- zmanim ---');
for (const d of ['2026-10-02','2026-10-03','2026-10-04','2026-10-09','2026-10-10']) {
  const z = computeZmanim(ARUGAM_BAY, P, d);
  const f = (x: any) => x.toFormat('HH:mm');
  console.log(d, 'candle', f(z.candleLighting), 'sunset', f(z.sunset), 'tzeis', f(z.tzeis), 'havdalah', f(z.havdalah), 'sunrise', f(z.sunrise), 'chatzos', f(z.chatzos), 'minchaK', f(z.minchaKetana), 'plag', f(z.plagHamincha));
}
const hd = new HDate(new Date(today));
console.log('\ntoday hebrew:', hd.renderGematriya(), '|', hd.render('he'));
