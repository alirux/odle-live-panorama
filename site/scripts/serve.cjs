/* Serves the site locally, with the shared scene files from core/.
 * Usage: node site/scripts/serve.cjs [port]   (default 8765)
 *
 * A path is looked up in site/, then in core/, then at the repository root
 * (the licence files), in the same order as build-release.cjs. */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const site = path.resolve(__dirname,'..');
const SOURCES = [site,path.resolve(site,'../core'),path.resolve(site,'..')];
const TYPES = {
  '.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
  '.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon',
  '.txt':'text/plain; charset=utf-8','.md':'text/plain; charset=utf-8'
};
const port = Number(process.argv[2] || 8765);

http.createServer((request,response) => {
  let file = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
  if (file.endsWith('/')) file += 'index.html';
  const found = SOURCES.map(dir => [dir,path.join(dir,file)])
    .find(([dir,candidate]) => candidate.startsWith(dir + path.sep) && fs.statSync(candidate,{throwIfNoEntry:false})?.isFile())?.[1];
  if (!found) {
    response.writeHead(404,{'Content-Type':'text/plain'}).end('Not found');
    return;
  }
  response.writeHead(200,{'Content-Type':TYPES[path.extname(found)] || 'application/octet-stream'});
  fs.createReadStream(found).pipe(response);
}).listen(port,'127.0.0.1',() => console.log(`http://127.0.0.1:${port}/`));

