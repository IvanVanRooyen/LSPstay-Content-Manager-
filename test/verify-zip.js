// Proves the JSZip copy inlined into the page still builds a valid zip, so the
// "double-click the file, finish, download the pack" flow works with no network.
// Run: node test/verify-zip.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const P = path.join(__dirname, '..', 'LSPstay Content Manager.html');
const html = fs.readFileSync(P, 'utf8');

let fails = 0;
const ok = (c, m) => { if (!c) { console.log('  FAIL: ' + m); fails++; } };

console.log('1. the page fetches nothing it cannot do without');
ok(!/<script\s+src=/i.test(html), 'no external <script src> remains');
const externalLinks = [...html.matchAll(/<link[^>]+href="(https?:[^"]+)"/g)].map(m => m[1]);
console.log('   remaining external references: ' + (externalLinks.join(', ') || 'none'));
ok(externalLinks.every(u => /fonts\.(googleapis|gstatic)\.com/.test(u)),
   'the only external references are Google Fonts: ' + externalLinks.join(', '));

console.log('2. the inlined JSZip loads and builds a real zip');
// first <script> block is the inlined library, second is the app
const first = html.indexOf('\n<script>\n');
const lib = html.slice(first + 10, html.indexOf('\n</script>', first));
ok(/JSZip v3\.10\.1/.test(lib), 'the first script block is JSZip');

const sandbox = { setTimeout, clearTimeout, console, Promise, Uint8Array, ArrayBuffer, Date, Math, JSON };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(lib, sandbox, { filename: 'inlined-jszip.js' });
const JSZip = sandbox.JSZip;
ok(typeof JSZip === 'function', 'JSZip is exposed as a global, the way the page expects');

if (typeof JSZip === 'function') {
  const zip = new JSZip();
  zip.file('summary.md', '# Testwater Resort: guest TV content\n\n- **Property name:** Testwater Resort\n');
  zip.file('content.json', JSON.stringify({ property: 'Testwater Resort', features: ['dining'] }, null, 2));
  // a "binary upload", with bytes that would corrupt if anything re-encoded them
  const bin = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
  zip.file('files/dining/venue-photo.jpg', bin);

  // uint8array is what a browser build produces; the page itself asks for a blob
  zip.generateAsync({ type: 'uint8array' }).then((u8) => {
    const buf = Buffer.from(u8);
    const out = path.join(require('os').tmpdir(), 'compendium-pack-test.zip');
    fs.writeFileSync(out, buf);
    console.log('   built ' + buf.length + ' bytes -> ' + out);

    // read it back with JSZip itself, then hand the path to the caller for an external check
    return JSZip.loadAsync(u8).then(async (re) => {
      const names = Object.keys(re.files).filter(k => !re.files[k].dir).sort();
      ok(names.join(',') === 'content.json,files/dining/venue-photo.jpg,summary.md',
         'zip contains the expected entries: ' + names.join(', '));
      const md = await re.file('summary.md').async('string');
      ok(md.includes('Testwater Resort'), 'summary.md round-trips');
      const back = await re.file('files/dining/venue-photo.jpg').async('uint8array');
      ok(Buffer.compare(Buffer.from(back), Buffer.from(bin)) === 0, 'binary upload round-trips byte for byte');
      console.log(fails ? `\n${fails} CHECK(S) FAILED` : '\nALL ZIP CHECKS PASSED');
      process.exit(fails ? 1 : 0);
    });
  }).catch((e) => { console.log('  FAIL: ' + e.message); process.exit(1); });
} else {
  console.log(`\n${fails} CHECK(S) FAILED`);
  process.exit(1);
}
