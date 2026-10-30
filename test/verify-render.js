// Runs the page's whole script against a stub DOM and inspects the HTML it renders.
const fs = require('fs'), vm = require('vm');
const P = 'C:\\Users\\IvanVanRooyen\\Documents\\LSP\\LSPstay Content Manager\\LSPstay Content Manager.html';
const html = fs.readFileSync(P, 'utf8');
// the page carries two <script> blocks: inlined JSZip first, then the app
const appStart = html.lastIndexOf('\n<script>\n');
const src = html.slice(appStart + 10, html.lastIndexOf('\n</script>'));
if (!src.includes('const FEATURES=[')) throw new Error('sliced the wrong script block');

const STOPS = ['branding','language','room','weather','offers','video','tv','apps','dining','ird','info','local','group','extra'];

function run(seed, search) {
  const out = {};
  const el = (id) => {
    const e = {
      id, innerHTML: '', textContent: '', value: '', disabled: false, open: false, isConnected: true,
      dataset: {}, style: { setProperty() {} }, files: [],
      classList: { add() {}, remove() {}, contains: () => false },
      querySelector: () => el('q'), querySelectorAll: () => [],
      appendChild() {}, remove() {}, click() {}, focus() {}, scrollIntoView() {},
      closest: () => null, matches: () => false, addEventListener() {}, setAttribute() {},
    };
    return new Proxy(e, {
      set(t, k, v) { if ((k === 'innerHTML' || k === 'textContent') && t.id) out[t.id] = v; t[k] = v; return true; },
    });
  };
  const canvasCtx = new Proxy({}, {
    get(t, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (k === 'isPointInPath') return () => false;
      if (k === 'fillStyle' || k === 'strokeStyle' || k === 'lineWidth' || k === 'globalAlpha') return t[k];
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  const store = seed ? { 'compendium-setup-v3': JSON.stringify(seed) } : {};
  const sandbox = {
    console,
    document: {
      querySelector: (s) => el(s.replace('#', '')),
      getElementById: (s) => el(s),
      createElement: (t) => t === 'canvas'
        ? { width: 0, height: 0, getContext: () => canvasCtx, toDataURL: () => 'data:,' }
        : el('new-' + t),
      addEventListener() {},
      documentElement: { style: { setProperty() {} } },
      body: el('body'),
    },
    window: { claude: undefined },
    location: { search: search || '' },
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = v; },
      removeItem: (k) => { delete store[k]; },
    },
    matchMedia: () => ({ matches: false }),
    URL: { createObjectURL: () => 'blob:stub', revokeObjectURL() {} },
    CSS: { escape: (s) => s },
    Path2D: class { moveTo() {} lineTo() {} bezierCurveTo() {} closePath() {} },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0,
    requestAnimationFrame() {},
    navigator: { clipboard: { writeText: async () => {} } },
    getSelection: () => ({ removeAllRanges() {}, addRange() {} }),
    JSZip: function () {},
    Blob: class {},
    indexedDB: undefined,
  };
  sandbox.window = sandbox;
  vm.runInNewContext(src, sandbox, { filename: 'page.js' });
  return out;
}

let fails = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL: ' + m); fails++; } };
const has = (s, sub, m) => ok(s && s.includes(sub), m + ' (looking for: ' + sub + ')');

// --- step 1, fresh visit ---
console.log('1. step 1 renders from a clean slate');
let o = run(null);
has(o.view, 'Choose what appears on your guests', 'step 1 heading');
has(o.view, 'Let\u2019s walk through your guest TV screen', 'walkthrough intro card');
has(o.view, '14 parts to review', 'part count');
has(o.view, 'class="ph">LOGO', 'logo placeholder with no upload');
has(o.view, 'In-room Dining', 'menu tile');
ok(!/undefined/.test(o.view), 'no "undefined" leaked into step 1 markup');

// --- step 1, parked on the In-room Dining card ---
console.log('2. walkthrough card shows the short need list');
const seen = Object.fromEntries(STOPS.map(i => [i, true]));
const on = { tv: 1, apps: 1, dining: 1, ird: 1, info: 1, local: 1, group: 1 };
o = run({ v: {}, on, seen, step: 1, tour: STOPS.indexOf('ird'), sec: 'branding', view: 'edit', focus: 'ird' });
has(o.view, 'How many room service menus you’d like us to list', 'ird need bullet 1');
has(o.view, 'That content, plus a photo to go with it', 'ird need bullet 3');
ok(!/Menu format: menu file/i.test(o.view), 'old enumerated need list is gone');

o = run({ v: {}, on, seen, step: 1, tour: STOPS.indexOf('dining'), sec: 'branding', view: 'edit', focus: 'dining' });
has(o.view, 'How many restaurants and bars you’d like us to list', 'dining need bullet 1');
o = run({ v: {}, on, seen, step: 1, tour: STOPS.indexOf('info'), sec: 'branding', view: 'edit', focus: 'info' });
has(o.view, 'How many resort facilities and features you’d like us to list', 'info need bullet 1');

// --- step 2 content forms ---
console.log('3. step 2 renders each restructured section');
const base = { v: {}, on, seen, step: 2, tour: 15, view: 'edit', focus: null };
o = run({ ...base, sec: 'branding' });
has(o.view, 'Photos and visual assets', 'branding still asks for imagery');
ok(!/Brand fonts/.test(o.view), 'brand fonts removed from the form');

o = run({ ...base, sec: 'video' });
has(o.view, 'What should the panel show?', 'video mode question');
ok(!/Video sound|Order, timing or schedule/.test(o.view), 'video sound + order removed');

o = run({ ...base, sec: 'apps' });
has(o.view, 'Apps to include', 'apps chips');
ok(!/Allow casting|>Casting</.test(o.view), 'casting question removed');

o = run({ ...base, sec: 'ird', v: { ird: { menus: [{ _id: 'a', name: 'All-day menu', cfmt: 'Website' }] } } });
has(o.view, 'Add a menu', 'ird repeat add button');
has(o.view, 'What kind of content should go with it?', 'ird content type question');
has(o.view, 'Supporting photo', 'per-menu photo');
has(o.view, 'Menu 1', 'repeat card header');
ok(!/Service hours|Ordering extension|Tray or delivery charge/.test(o.view), 'ird property-wide fields gone');

o = run({ ...base, sec: 'info', v: { info: { pages: [{ _id: 'b', name: 'Pool', cfmt: 'Plain text' }] } } });
has(o.view, 'Add a facility', 'info repeat add button');
has(o.view, 'Facility 1', 'facility card header');
has(o.view, 'What kind of content should go with it?', 'info content type question');
ok(!/Wi-Fi network name|Check-in time|Reception extension|Late check-out|Property map/.test(o.view),
   'resort info property-wide fields gone');
has(o.view, 'Emergency information', 'but it is offered as a suggested facility page');

o = run({ ...base, sec: 'dining', v: { dining: { venues: [{ _id: 'd', name: 'The Saltbush', cfmt: 'Website' }] } } });
has(o.view, 'Add a venue', 'dining repeat add button');
has(o.view, 'Venue 1', 'venue card header');
has(o.view, 'Photo of the venue', 'dining venue photo');
ok(!/>Type<|Opening hours|How guests book or order|Short description/.test(o.view), 'dining granular fields gone');

o = run({ ...base, sec: 'local', v: { local: { places: [{ _id: 'c', name: 'Walk', cfmt: 'Website' }] } } });
ok(!/>Category</.test(o.view), 'attraction category removed');
ok(!/Address for directions/.test(o.view), 'attraction address removed');
has(o.view, 'Photo of the attraction', 'attraction photo required');

o = run({ ...base, sec: 'group', v: { group: { props: [{ _id: 'g', name: 'Paperbark Rewards', cfmt: 'Website' }] } } });
has(o.view, 'Add a property', 'resorts & benefits repeat add button');
has(o.view, 'Property 1', 'property card header');
has(o.view, 'What kind of content should go with it?', 'resorts & benefits content type question');
ok(!/What would you like to feature|Benefits to highlight|Sign-up link|Promotional material/.test(o.view),
   'old resorts & benefits fields gone');

console.log('4. sample-answers button only appears with ?demo=1');
o = run({ ...base, sec: 'branding' });
ok(!/Try sample answers/.test(o.view), 'hidden for customers');
o = run({ ...base, sec: 'branding' }, '?demo=1');
ok(/Try sample answers/.test(o.view), 'visible with ?demo=1');

console.log('5. step 3 review + summary');
o = run({ ...base, step: 3, sec: 'branding',
  v: { branding: { name: 'Testwater Resort' },
       ird: { menus: [{ _id: 'a', name: 'All-day menu', cfmt: 'Website', web: 'https://x.test/m' }] } } });
has(o.view, 'Review and send', 'step 3 heading');
has(o.view, 'Download content pack', 'download button');
ok(!/Downloads aren\u2019t available/.test(JSON.stringify(o)), 'no "downloads unavailable" message');
ok(!/Preview the summary|mdpre/.test(o.view), 'summary preview removed');
has(o.view, 'All-day menu', 'review table names the menu node');
has(o.propname, 'Testwater Resort', 'header shows the property name');
ok(!/Exclusive for You/.test(o.view), 'offers has no content/review section');

console.log('6. earlier rounds: movies gone, enable/disable wording, watermark, background');
o = run(null);
ok(!/Movies/.test(o.view), 'Movies gone from step 1');
has(o.view, 'class="tvmark"', 'SAMPLE watermark on the replica');
has(o.view, '>SAMPLE<', 'watermark text');
o = run({ v: {}, on, seen, step: 1, tour: STOPS.indexOf('dining'), sec: 'branding', view: 'edit', focus: 'dining' });
has(o.view, '>Enable<', 'Enable button');
has(o.view, '>Disable<', 'Disable button');
ok(!/Leave off|>Include</.test(o.view), 'old Include/Leave off wording gone');
o = run({ ...base, sec: 'branding' });
has(o.view, 'Home screen background image', 'required background upload');
o = run({ ...base, step: 1, tour: STOPS.indexOf('offers'), focus: 'offers' });
has(o.view, 'You add and manage your own offers', 'offers walkthrough explains it is self-managed');

console.log('7. step 1 layout, disclaimer and sample framing');
o = run(null);
// walkthrough on the left, screen in the middle, feature list on the right
const iL = o.view.indexOf('panel panel-l'), iM = o.view.indexOf('s1-main'), iR = o.view.indexOf('panel panel-r');
ok(iL > -1 && iM > -1 && iR > -1, 'all three step 1 columns render');
ok(iL < iM && iM < iR, `column order should be walkthrough, screen, list (got ${iL}, ${iM}, ${iR})`);
ok(o.view.indexOf('focuscard') < iM, 'the walkthrough card sits before the screen');
ok(o.view.indexOf('class="sum"') < iM, 'the stats sit with the walkthrough card');
ok(o.view.indexOf('On your screens') > iM, 'the feature list sits after the screen');
has(o.view, 'only a sample representation of the features and appearance', 'sample disclaimer present');
ok((o.view.match(/tvmark/g) || []).length === 1, 'exactly one watermark element');
ok(!/<span>SAMPLE<\/span>/.test(o.view), 'watermark is not tiled');
has(o.view, 'Compendium Sample Content Setup'.slice(0, 0) + '>SAMPLE<', 'watermark reads SAMPLE');

console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL RENDER CHECKS PASSED');
process.exit(fails ? 1 : 0);
