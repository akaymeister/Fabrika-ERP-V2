/**
 * Standart app-master-page sayfalarını app-ui-v3 kabuğuna taşır.
 * login.html, purchase-order-print.html, zaten app-ui-v3 olanlar atlanır.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(__dirname, '../frontend/public');
const SKIP = new Set(['login.html', 'purchase-order-print.html']);

function findMatchingCloseDiv(html, openDivLt) {
  const afterOpen = html.indexOf('>', openDivLt) + 1;
  let depth = 1;
  let i = afterOpen;
  while (depth > 0 && i < html.length) {
    const nextOpen = html.indexOf('<div', i);
    const nextClose = html.indexOf('</div>', i);
    if (nextClose === -1) return -1;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++;
      i = nextOpen + 4;
    } else {
      depth--;
      i = nextClose + 6;
    }
  }
  return i;
}

function patchBodyClass(attrs) {
  let a = attrs;
  if (!/class=/.test(a)) {
    return ` class="app-shell app-master-page app-ui-v3"${a}`;
  }
  return a.replace(/class="([^"]*)"/, (_, c) => {
    let nc = c;
    if (!nc.includes('app-ui-v3')) nc = `${nc} app-ui-v3`.trim();
    if (!nc.includes('app-shell')) nc = `app-shell ${nc}`;
    if (!nc.includes('app-master-page')) nc = `app-master-page ${nc}`;
    return `class="${nc.replace(/\s+/g, ' ').trim()}"`;
  });
}

function migrateContent(html, fname) {
  if (html.includes('app-ui-v3')) return { html, ok: false, reason: 'already' };
  if (SKIP.has(fname)) return { html, ok: false, reason: 'skip-list' };

  const topbarIdx = html.indexOf('<div class="topbar dashboard-topbar"');
  if (topbarIdx === -1) return { html, ok: false, reason: 'no-topbar' };

  const brandStart = html.indexOf('<div class="app-master-brand"', topbarIdx);
  if (brandStart === -1) return { html, ok: false, reason: 'no-brand' };

  const topbarLeftIdx = html.indexOf('<div class="topbar-left">', topbarIdx);
  const topbarRightIdx = html.indexOf('<div class="topbar-right">', topbarIdx);
  if (topbarLeftIdx === -1 || topbarRightIdx === -1) return { html, ok: false, reason: 'no-topbar-cols' };

  const brandEnd = findMatchingCloseDiv(html, brandStart);
  const topbarLeftEnd = findMatchingCloseDiv(html, topbarLeftIdx);
  const topbarRightEnd = findMatchingCloseDiv(html, topbarRightIdx);
  if (brandEnd < 0 || topbarLeftEnd < 0 || topbarRightEnd < 0) return { html, ok: false, reason: 'parse-div' };

  let brandBlock = html.slice(brandStart, brandEnd);
  brandBlock = brandBlock.replace(
    /class="app-master-brand"/,
    'class="app-sidebar-brand app-master-brand"'
  );

  const topbarLeftBlock = html.slice(topbarLeftIdx, topbarLeftEnd);
  const topbarRightBlock = html.slice(topbarRightIdx, topbarRightEnd);

  const topbarEnd = findMatchingCloseDiv(html, topbarIdx);
  if (topbarEnd < 0) return { html, ok: false, reason: 'topbar-close' };

  const gnsStart = html.indexOf('<div id="globalNavSlot"', topbarEnd);
  if (gnsStart === -1) return { html, ok: false, reason: 'no-globalNavSlot' };
  const gnsEnd = findMatchingCloseDiv(html, gnsStart);
  const globalNavBlock =
    gnsEnd > gnsStart ? html.slice(gnsStart, gnsEnd) : html.slice(gnsStart, html.indexOf('>', gnsStart) + 1);

  const ambIdx = html.indexOf('<div class="app-master-body">', gnsStart);
  if (ambIdx === -1) return { html, ok: false, reason: 'no-app-master-body' };

  const asideStart = html.indexOf('<aside class="app-master-sidebar">', ambIdx);
  if (asideStart === -1) return { html, ok: false, reason: 'no-aside' };
  const asideEnd = html.indexOf('</aside>', asideStart) + '</aside>'.length;
  const asideBlock = html.slice(asideStart, asideEnd);

  const mainOpen = html.indexOf('<main class="app-master-main">', asideEnd);
  if (mainOpen === -1) return { html, ok: false, reason: 'no-main' };
  const mainInnerStart = mainOpen + '<main class="app-master-main">'.length;
  const mainClose = html.lastIndexOf('</main>');
  if (mainClose < mainInnerStart) return { html, ok: false, reason: 'main-bound' };
  const mainInner = html.slice(mainInnerStart, mainClose);

  const afterMain = html.slice(mainClose + '</main>'.length);
  /* Eski kabuk: </main> → </div> (app-master-body) → </div> (container) */
  const restMatch = afterMain.match(/^\s*(<\/div>\s*){2}/);
  if (!restMatch) return { html, ok: false, reason: 'bad-tail-after-main' };
  const scriptsFooter = afterMain.slice(restMatch[0].length);

  const bodyMatch = html.match(/<body([^>]*)>/);
  if (!bodyMatch) return { html, ok: false, reason: 'no-body' };
  const bodyTagNew = `<body${patchBodyClass(bodyMatch[1])}>`;

  const cm = html.match(/<div class="container([^"]*)">/);
  if (!cm) return { html, ok: false, reason: 'no-container' };
  const extra = cm[1].trim();
  const containerOpen = extra ? `<div class="container ${extra} app-layout-v3">` : `<div class="container app-layout-v3">`;

  const headAndBeforeBody = html.slice(0, html.indexOf('<body'));

  const newDoc = `${headAndBeforeBody}${bodyTagNew}
  ${containerOpen}
    <div class="app-sidebar">
      ${brandBlock}
      ${globalNavBlock}
      ${asideBlock}
    </div>
    <div class="app-main-wrap">
      <header class="topbar dashboard-topbar">
        ${topbarLeftBlock}
        ${topbarRightBlock}
      </header>
      <div class="app-content">
        <main class="app-master-main">
${mainInner}
        </main>
      </div>
    </div>
  </div>
${scriptsFooter}`;

  return { html: newDoc, ok: true, reason: 'migrated' };
}

const results = { migrated: 0, skip: [] };
for (const fname of fs.readdirSync(pub).filter((f) => f.endsWith('.html'))) {
  const fp = path.join(pub, fname);
  const html = fs.readFileSync(fp, 'utf8');
  const r = migrateContent(html, fname);
  if (r.ok) {
    fs.writeFileSync(fp, r.html, 'utf8');
    results.migrated++;
    console.log('migrated', fname);
  } else {
    results.skip.push({ fname, reason: r.reason });
    if (!['already', 'skip-list'].includes(r.reason)) {
      console.warn('skip', fname, r.reason);
    }
  }
}
console.log(JSON.stringify(results, null, 2));
