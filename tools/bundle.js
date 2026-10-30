// Packs the whole game into ONE html file you can send to friends or host anywhere.
// Images and sounds referenced as 'assets/...' in the code are embedded as data URIs.
//   usage: node tools/bundle.js [out.html]          (default: dist/first-fantasy.html)
//          node tools/bundle.js out.html --fragment (no <html>/<head>/<body> wrapper)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const out = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : path.join(root, 'dist/first-fantasy.html');
const fragment = process.argv.includes('--fragment');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4' };
let embedded = 0;
const embedAssets = src => src.replace(/(['"])(assets\/[^'"]+)\1/g, (m, q, p) => {
  const f = path.join(root, p);
  if (!fs.existsSync(f)) return m;
  embedded++;
  return q + `data:${MIME[path.extname(f).toLowerCase()] || 'application/octet-stream'};base64,` + fs.readFileSync(f).toString('base64') + q;
});
const css = fs.readFileSync(path.join(root, 'css/style.css'), 'utf8');
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1]);
const js = scripts.map(s => `// ---- ${s}\n` + embedAssets(fs.readFileSync(path.join(root, s), 'utf8'))).join('\n');
const bodyStart = html.indexOf('<div id="wrap">'), bodyEnd = html.indexOf('<script');
const body = html.slice(bodyStart, bodyEnd);
const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || 'First Fantasy';
const font = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">';
const extraCss = fragment ? ':root { color-scheme: dark; }\nhtml, body { background: #000; }\nbody { padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); box-sizing: border-box; }\n' : '';
const head = `<title>${title}</title>\n${fragment ? '<meta name="claude:viewport-fit-sides" content="cover">\n' : ''}${font}\n<style>\n${css}\n${extraCss}</style>`;
const page = fragment
  ? `${head}\n${body}<script>\n${js}\n</script>\n`
  : `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">\n${head}\n</head>\n<body>\n${body}<script>\n${js}\n</script>\n</body>\n</html>\n`;
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, page);
console.log(`Wrote ${out} (${(page.length / 1024).toFixed(0)} KB, ${scripts.length} scripts, ${embedded} embedded assets)`);
