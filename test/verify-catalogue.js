// Slices the data + pure-logic sections out of the page and exercises them in Node.
// Run: node test/verify-catalogue.js
const fs = require('fs');
const path = require('path');
const P = path.join(__dirname, '..', 'LSPstay Content Manager.html');
const html = fs.readFileSync(P, 'utf8');
// the page carries two <script> blocks: inlined JSZip first, then the app
const appStart = html.lastIndexOf('\n<script>\n');
const src = html.slice(appStart + 10, html.lastIndexOf('\n</script>'));
if (!src.includes('const FEATURES=[')) throw new Error('sliced the wrong script block');

function slice(from, to, label) {
  const a = src.indexOf(from), b = src.indexOf(to);
  if (a < 0 || b < 0 || b <= a) throw new Error('could not slice ' + label);
  return src.slice(a, b);
}
const dataBlock = slice('const FEATURES=[', '/* ================= state ====', 'FEATURES/SAMPLE');
const logicBlock = slice('/* ================= value + progress', '/* ================= painted backgrounds', 'progress');

let S = { v: {}, on: {} };
const stub = `
let S=__S;
const isOn=id=>byId[id].always||!!S.on[id];
const enabled=()=>FEATURES.filter(f=>isOn(f.id));
`;
const exportBack = `;return ({FEATURES,byId,GROUPS,DEFAULT_ON,SAMPLE,progress,requiredLabels,vis,val,filled,totals,contentSecs,getP,setP})`;
const api = new Function('__S', '"use strict";' + dataBlock + stub + logicBlock + exportBack)(S);

const { FEATURES, byId, SAMPLE, progress, requiredLabels, DEFAULT_ON, contentSecs } = api;
const STOPS = JSON.parse(src.match(/const STOPS=(\[[^\]]+\])/)[1].replace(/'/g, '"'));
const ICONS = new Set([...src.matchAll(/^\s{2}(\w+):ic\(/gm)].map(m => m[1]));

let fails = 0;
const ok = (cond, msg) => { if (!cond) { console.log('  FAIL: ' + msg); fails++; } };

// --- structural integrity of the catalogue ---
function walkFields(fields, path) {
  const keys = new Set();
  for (const f of fields) {
    ok(!keys.has(f.k), `duplicate key ${path}.${f.k}`);
    keys.add(f.k);
    if (f.show) {
      const sib = fields.find(x => x.k === f.show.k);
      ok(!!sib, `${path}.${f.k} show.k='${f.show.k}' has no sibling field`);
      if (sib && sib.opts) for (const v of f.show.in)
        ok(sib.opts.includes(v), `${path}.${f.k} show.in '${v}' is not an option of ${sib.k} [${sib.opts}]`);
    }
    if (f.t === 'repeat') {
      ok(!!f.item && !!f.add, `${path}.${f.k} repeat needs item + add`);
      ok(Array.isArray(f.fields) && f.fields.length, `${path}.${f.k} repeat has no fields`);
      walkFields(f.fields, path + '.' + f.k);
    }
    if (['select', 'seg', 'chips'].includes(f.t)) ok(Array.isArray(f.opts) && f.opts.length, `${path}.${f.k} needs opts`);
    if (f.list) ok(true, '');
  }
}
console.log('1. catalogue structure');
for (const F of FEATURES) {
  walkFields(F.fields, F.id);
  ok(!!F.sees && Array.isArray(F.can), `${F.id} missing sees/can`);
  if (F.group === 'menu' || F.group === 'extra') {
    ok(!!F.tint, `${F.id} menu feature needs tint`);
    ok(ICONS.has(F.icon), `${F.id} icon '${F.icon}' is not in the I set`);
  }
  if (F.need) ok(F.need.every(x => typeof x === 'string'), `${F.id} need must be strings`);
}

console.log('2. STOPS covers every feature exactly once');
ok(STOPS.length === FEATURES.length, `STOPS has ${STOPS.length}, FEATURES has ${FEATURES.length}`);
for (const F of FEATURES) ok(STOPS.includes(F.id), `${F.id} missing from STOPS`);
for (const id of STOPS) ok(!!byId[id], `STOPS id '${id}' is not a feature`);
for (const id of DEFAULT_ON) ok(byId[id] && !byId[id].always, `DEFAULT_ON '${id}' is not an optional feature`);

console.log('3. removals landed');
const gone = [['branding', 'fonts'], ['video', 'sound'], ['video', 'order'], ['apps', 'casting']];
for (const [fid, k] of gone) ok(!byId[fid].fields.some(f => f.k === k), `${fid}.${k} should be gone`);
ok(!byId.movies, 'Movies removed from the catalogue');
ok(!STOPS.includes('movies'), 'Movies removed from the walkthrough');
ok(byId.offers.fields.length === 0, 'Exclusive for You has no content section');
ok(!contentSecs().some(f => f.id === 'offers'), 'Exclusive for You is not a content section');
// the granular dining/ird/info fields are gone
for (const k of ['type', 'hours', 'where', 'book', 'ext', 'mfmt', 'menu', 'murl', 'mtext'])
  ok(!byId.dining.fields[0].fields.some(f => f.k === k), `dining venue.${k} should be gone`);
for (const k of ['hours', 'ext', 'charge', 'mfmt', 'menu', 'murl', 'mtext'])
  ok(!byId.ird.fields.some(f => f.k === k), `ird.${k} should be gone`);
for (const k of ['checkin', 'checkout', 'late', 'ssid', 'wifipw', 'recep', 'emergency', 'map'])
  ok(!byId.info.fields.some(f => f.k === k), `info.${k} should be gone`);
ok(!byId.local.fields[0].fields.some(f => f.k === 'cat'), 'attraction category should be gone');

console.log('4. branding asks for a required background image');
ok(byId.branding.fields.some(f => f.k === 'bg' && f.req === 1 && f.t === 'file'), 'bg required');
ok(!byId.branding.fields.find(f => f.k === 'imagery').req, 'photos and visual assets now optional');
ok(/firstMedia\(b\.bg/.test(src), 'the replica reads the dedicated branding.bg upload');

console.log('5. all five list sections share one identical node shape');
const NODE = ['name', 'cfmt', 'web', 'pdf', 'img', 'desc'];
const lists = { dining: 'venues', ird: 'menus', info: 'pages', local: 'places', group: 'props' };
let shape = null;
for (const [fid, key] of Object.entries(lists)) {
  const F = byId[fid];
  ok(F.fields.length === 1, `${fid} should hold nothing but its list, has ${F.fields.length} fields`);
  const rep = F.fields[0];
  ok(rep.k === key && rep.t === 'repeat' && rep.req === 1 && rep.min === 1, `${fid}.${key} must be a required repeat`);
  ok(!!rep.item && /^Add a/.test(rep.add), `${fid}.${key} needs an "Add a ..." label, got "${rep.add}"`);
  const sub = rep.fields;
  // the six shared fields, in the same order, with the same gating
  ok(NODE.every((k, i) => sub[i] && sub[i].k === k), `${fid}.${key} node fields are ${sub.map(f => f.k)}`);
  const fmt = sub[1];
  ok(JSON.stringify(fmt.opts) === JSON.stringify(['Website', 'PDF', 'Image', 'Plain text']),
     `${fid}.${key} content types are ${JSON.stringify(fmt.opts)}`);
  ok(fmt.req === 1 && fmt.t === 'seg', `${fid}.${key} content type must be a required seg`);
  for (const opt of fmt.opts)
    ok(sub.some(f => f.show && f.show.k === 'cfmt' && f.show.in.length === 1 && f.show.in[0] === opt && f.req === 1),
       `${fid}.${key} has no single required field gated on '${opt}'`);
  ok(sub[0].req === 1 && sub[0].t === 'text', `${fid}.${key} needs a required name`);
  const sig = JSON.stringify(sub.slice(0, 6).map(f => [f.k, f.t, f.req || 0, f.show || null]));
  if (shape === null) shape = sig; else ok(sig === shape, `${fid}.${key} node shape differs from the others`);
  ok(Array.isArray(F.need) && F.need.length === 3, `${fid} needs a 3-bullet need list`);
}
// every node in every list section ends with a required photo
for (const fid of Object.keys(lists)) {
  const sub = byId[fid].fields[0].fields;
  const photo = sub[sub.length - 1];
  ok(photo.k === 'photo' && photo.req === 1 && photo.t === 'file', `${fid} node must end with a required photo`);
  ok(sub.length === 7, `${fid} node should have exactly 7 fields, has ${sub.length}: ${sub.map(f => f.k)}`);
}
ok(!byId.local.fields[0].fields.some(f => f.k === 'addr'), 'Local Attractions address removed');

console.log('6. "We\'ll ask you for" stays short on every list section');
for (const fid of Object.keys(lists)) {
  const n = requiredLabels(byId[fid]);
  ok(n === byId[fid].need, `${fid} requiredLabels should return the override`);
  ok(!n.some(x => /:\s*\w+,\s*\w+,/.test(x)), `${fid} need still enumerates sub-fields`);
  console.log('   ' + fid + ':\n     • ' + n.join('\n     • '));
}
ok(requiredLabels(byId.weather).length === 0, 'weather has nothing required');
ok(requiredLabels(byId.offers).length === 1, 'offers explains it is self-managed');

console.log('7. progress + content-type gating behave on the new shape');
S.on = Object.fromEntries(DEFAULT_ON.map(i => [i, true]));
S.v = {};
let p = progress('dining');
ok(p.req > 0 && p.done === 0, 'empty dining should have unmet requirements');
ok(p.missing.some(m => /add at least one venue/i.test(m.label)), 'dining asks for at least one venue');

S.v.dining = { venues: [{ _id: 'a', name: 'The Saltbush', cfmt: 'Website' }] };
let L = progress('dining').missing.map(m => m.label);
ok(L.some(l => /Website/.test(l)), 'Website type requires the website field: ' + L.join(' | '));
ok(!L.some(l => /PDF|Image|Text/.test(l.replace(/Photo.*/, ''))), 'other type branches stay hidden: ' + L.join(' | '));
ok(L.some(l => /Photo of the venue/.test(l)), 'the venue photo is required');
S.v.dining.venues[0].web = 'https://x.test';
S.v.dining.venues[0].photo = { id: 'f1', name: 'a.jpg', size: 10, type: 'image/jpeg' };
p = progress('dining');
ok(p.done === p.req, `dining should be complete, missing: ${p.missing.map(m => m.label).join(', ')}`);

S.v.info = { pages: [{ _id: 'b', name: 'Pool', cfmt: 'Plain text' }] };
L = progress('info').missing.map(m => m.label);
ok(L.some(l => /Text/.test(l)), 'Plain text requires the text field: ' + L.join(' | '));
ok(!L.some(l => /Website|PDF|Image/.test(l)), 'other info branches stay hidden: ' + L.join(' | '));
ok(/Facility 1 \(Pool\)/.test(L.join(' | ')), 'missing labels name the node: ' + L.join(' | '));

S.v.ird = { menus: [{ _id: 'c', name: 'All-day menu', cfmt: 'PDF' }] };
L = progress('ird').missing.map(m => m.label);
ok(L.some(l => /PDF/.test(l)), 'PDF type requires the pdf field: ' + L.join(' | '));
ok(/Menu 1 \(All-day menu\)/.test(L.join(' | ')), 'ird missing labels name the menu');

console.log('8. sample answers match the live field shapes');
for (const [fid, vals] of Object.entries(SAMPLE)) {
  const F = byId[fid];
  ok(!!F, `SAMPLE has unknown feature '${fid}'`);
  if (!F) continue;
  for (const [k, v] of Object.entries(vals)) {
    const f = F.fields.find(x => x.k === k);
    ok(!!f, `SAMPLE ${fid}.${k} is not a field`);
    if (f && f.t === 'repeat' && Array.isArray(v)) {
      for (const item of v) for (const ik of Object.keys(item)) {
        if (ik === '_id') continue;
        ok(f.fields.some(x => x.k === ik), `SAMPLE ${fid}.${k}[].${ik} is not a field`);
      }
    }
    if (f && f.opts && typeof v === 'string') ok(f.opts.includes(v), `SAMPLE ${fid}.${k}='${v}' is not an option`);
  }
}

console.log('9. runs standalone from a double-click');
ok(!/<script src=/.test(html), 'no external scripts to fetch');
ok(/JSZip v3\.10\.1/.test(html), 'JSZip is inlined');
ok(/let canSave=true,canKeepFiles=true/.test(src), 'storage availability is tracked');
ok(/Progress can/.test(src), 'the save indicator is honest when storage is blocked');
ok(/railnote/.test(src), 'attachments warning exists for when IndexedDB is unavailable');

console.log('10. page wiring');
ok(/const DEMO=/.test(src), 'DEMO flag defined');
ok(/\$\{DEMO\?'<div class="sample"/.test(src), 'sample button gated on DEMO');
ok(/async function saveFile\(/.test(src) && /a\.download=filename/.test(src), 'anchor download fallback present');
ok(!/DL\.save\(\{filename:/.test(src), 'downloadZip goes through saveFile');
ok(/firstMedia\(b\.logo/.test(src), 'logo reads the logo array');
ok(/compendium-setup-v3/.test(src), 'storage key bumped to v3');
ok(/<title>Compendium Sample Content Setup<\/title>/.test(html), 'sample title set');
ok(/class="tvmark" aria-hidden="true">SAMPLE<\/div>/.test(src), 'a single SAMPLE watermark');
ok(!/<span>SAMPLE<\/span>/.test(src), 'watermark is one element, not tiled');
ok(!/mdpre|details class="md"/.test(src), 'summary preview removed');
ok(!/Leave off|'Include'/.test(src), 'Include/Leave off wording replaced by Enable/Disable');

console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL CHECKS PASSED');
process.exit(fails ? 1 : 0);
