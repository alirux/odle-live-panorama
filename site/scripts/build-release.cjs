/* Rebuilds site/release/ with only the files the published site loads.
 * Usage: node site/scripts/build-release.cjs
 *
 * Published paths are looked up in site/, then in core/ (the shared scene),
 * then at the repository root (the licence files), so the site and the
 * screen saver use the same scene files without copies in the repository.
 *
 * Starting from the pages, every literal "assets/..." path in HTML, CSS and JS
 * is copied, and the copied CSS and JS are scanned in turn. Sprites whose names
 * photo-visitors.js builds at run time are read from its list of names.
 * Documentation, tests, scripts and unreferenced images stay out. */
const fs = require('node:fs'), path = require('node:path');
const site = path.resolve(__dirname,'..');
const SOURCES = [site,path.resolve(site,'../core'),path.resolve(site,'..')];
const out = path.join(site,'release');
const sourcePath = file => SOURCES.map(dir => path.join(dir,file)).find(fs.existsSync);

const PAGES = ['index.html','help.html','licence.html','privacy.html'];
const ROOT_FILES = ['favicon.ico','favicon.png','apple-touch-icon.png','LICENSE','LICENSE-CONTENT.txt','NOTICE'];
const SCANNED = new Set(['.html','.css','.js']);
// Not after "host/": paths inside absolute URLs belong to other sites.
const ASSET_PATH = /(?<![A-Za-z0-9.-]\/)assets\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]+/g;

function visitorSprites() {
  const source = fs.readFileSync(sourcePath('assets/photo-visitors.js'),'utf8');
  const list = source.match(/for \(const name of \[([^\]]+)\]\)/);
  if (!list) throw new Error('photo-visitors.js: list of sprite names not found');
  return [...list[1].matchAll(/'([^']+)'/g)].map(m => `assets/photo/${m[1]}.webp`);
}

const files = new Set([...PAGES,...ROOT_FILES]);
const queue = [...PAGES,...visitorSprites()];
for (const file of queue) files.add(file);
while (queue.length) {
  const file = queue.shift();
  if (!SCANNED.has(path.extname(file))) continue;
  const text = fs.readFileSync(sourcePath(file),'utf8');
  for (const [ref] of text.matchAll(ASSET_PATH)) {
    if (files.has(ref) && !PAGES.includes(ref)) continue;
    files.add(ref);
    queue.push(ref);
  }
}

const missing = [...files].filter(file => !sourcePath(file));
if (missing.length) {
  console.error(`Referenced but missing:\n  ${missing.join('\n  ')}`);
  process.exit(1);
}

fs.rmSync(out,{recursive:true,force:true});
for (const file of [...files].sort()) {
  fs.mkdirSync(path.dirname(path.join(out,file)),{recursive:true});
  fs.copyFileSync(sourcePath(file),path.join(out,file));
}
console.log(`release/: ${files.size} files`);
