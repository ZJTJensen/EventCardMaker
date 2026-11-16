/* Event Card Maker — renders Flesh and Blood style Event / Event Equipment cards on a canvas. */
'use strict';

const W = 1092, H = 1524;           // export size (2x the event frame)

// ---------- Frame geometry (pixels on the W x H canvas) ----------
const LAYOUTS = {
  event: {
    radius: 58,
    art:   { x: 0,   y: 160,  w: W,   h: 830 },
    name:  { cx: W / 2, cy: 113, maxW: 700, size: 52 },
    text:  { x: 90,  y: 1048, w: W - 180, h: 284, size: 37 },
    type:  { cx: W / 2, cy: 1391, maxW: 500, size: 36 },
    footer:{ y: 1484, l: 70, r: W - 70, size: 20 },
    gems: null,
  },
  equipment: {
    radius: 54,
    art:   { x: 90,  y: 182,  w: 912, h: 748 },
    name:  { cx: W / 2, cy: 127, maxW: 820, size: 54 },
    text:  { x: 118, y: 962,  w: W - 236, h: 350, size: 37 },
    type:  { cx: W / 2, cy: 1399, maxW: 520, size: 34 },
    footer:{ y: 1495, l: 80, r: W - 80, size: 19 },
    gems:  { left: { cx: 124, cy: 1400, r: 34 }, right: { cx: 966, cy: 1400, r: 34 } },
  },
};

const FONTS = [
  ['"Palatino Linotype", "Book Antiqua", Palatino, serif', 'Palatino (system)'],
  ['"EB Garamond", serif', 'EB Garamond'],
  ['"Libre Baskerville", serif', 'Libre Baskerville'],
  ['"Cormorant Garamond", serif', 'Cormorant Garamond'],
  ['Cinzel, serif', 'Cinzel'],
  ['"Alegreya SC", serif', 'Alegreya SC'],
  ['Georgia, serif', 'Georgia (system)'],
];

const DEFAULT_KEYWORDS = 'Go again, Dominate, Blade Break, Battleworn, Temper, Spellvoid, Arcane Barrier, Ward, ' +
  'Crush, Combo, Boost, Phantasm, Overpower, Piercing, Intimidate, Freeze, Opt, Unity, Wager, Clash, Surge, ' +
  'Stealth, Legendary, Specialization, Once per Turn, Guardwell, Quell, Rupture, Heave, Retrieve, Mirage, ' +
  'Spectra, Transcend, Reload, Amp, Instant, Attack Reaction, Defense Reaction, Contract';

const STYLE_DEFAULTS = {
  textFont: FONTS[0][0], nameBold: true, // one font for the whole card
  nameSize: 100, textSize: 100, typeSize: 100, align: 'left', valign: 'middle',
  nameColor: '#1d1b26', textColor: '#1d1b26', typeColor: '#1d1b26', footerColor: '#e9e7f3',
  nameDy: 0, textTopDy: 0, textBotDy: 0, textPadDx: 0, typeDy: 0, footerDy: 0,
};

const SAMPLES = {
  event: {
    name: 'Silence is Golden', type: 'Event',
    text: 'For the next turn, you are contracted to make your opponent laugh.',
  },
  equipment: {
    name: 'License to Kill', type: 'Generic Equipment - Off-Hand',
    text: 'Equip this if able. Otherwise, flip the top card of the event deck.\n\n**Action** - Destroy this: Weapon attacks have **contract**: You are contracted to hit your opponent with a dagger.',
  },
};
// Starter rules text when an event is switched to Event - Ally.
const ALLY_TEXT = 'This enters the arena under your control.\n\n' +
  'At the start of your action phase, this attacks each opposing hero with more {l} than you. ' +
  '(Each hero is attacked simultaneously. Heroes defend in clockwise order starting on your left. Damage is calculated per hero.)\n\n' +
  'When this hits a hero, destroy a card in their arsenal.';
const ALLY_NAME = 'Trained Saurian';
const ALLY_STATS = { power: '4', life: '3' };
// Which frame image to use: 'event', 'equipment', or 'ally' (event with Ally ticked).
// 'offhand' = equipment with the Off-hand frame ticked (no defense box).
const frameKey = () => (state.kind === 'event' && state.ally ? 'ally'
  : state.kind === 'equipment' && state.offhand ? 'offhand' : state.kind);

const isUntouchedSample = st => (st.name === ALLY_NAME && st.text === ALLY_TEXT) ||
  Object.values(SAMPLES).some(s => s.name === st.name && s.text === st.text);

function freshState(kind = 'event') {
  return {
    kind, name: '', type: '', text: '', autoBold: true, autoItalic: true,
    defense: '0', offhand: false, ally: false, power: '', life: '',
    art: null, artZoom: 1, artX: 0, artY: 0,
    setCode: '', rarity: '', artist: '', copyright: '',
    keywords: DEFAULT_KEYWORDS, customFrames: {},
    ...STYLE_DEFAULTS,
    ...SAMPLES[kind],
    footerColor: kind === 'event' ? '#e9e7f3' : '#d6d6d6',
  };
}

// ---------- State ----------
// Nothing is persisted: every reload starts fresh. Export PNG is the only output.
// Remove anything older versions of this page left in browser storage.
try { Object.keys(localStorage).filter(k => k.startsWith('fabcm.')).forEach(k => localStorage.removeItem(k)); } catch {}
let state = freshState();

// ---------- Canvas ----------
const cv = document.getElementById('card');
cv.width = W; cv.height = H;
const ctx = cv.getContext('2d');

const imgCache = new Map();
function getImg(src) {
  if (!src) return null;
  let e = imgCache.get(src);
  if (!e) {
    e = { img: new Image(), ok: false };
    e.img.onload = () => { e.ok = true; requestRender(); };
    e.img.src = src;
    imgCache.set(src, e);
  }
  return e.ok ? e.img : null;
}

let pending = false;
function requestRender() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; render(); });
}

function render() {
  const L = LAYOUTS[state.kind];
  ctx.clearRect(0, 0, W, H);

  // Art (under the frame)
  ctx.save();
  ctx.beginPath(); ctx.roundRect(0, 0, W, H, L.radius); ctx.clip();
  const r = L.art;
  ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
  ctx.fillStyle = '#1b1c24'; ctx.fillRect(r.x, r.y, r.w, r.h);
  const art = getImg(state.art);
  if (art) {
    const sc = Math.max(r.w / art.width, r.h / art.height) * state.artZoom;
    const dw = art.width * sc, dh = art.height * sc;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(art, r.x + (r.w - dw) / 2 + state.artX, r.y + (r.h - dh) / 2 + state.artY, dw, dh);
  }
  ctx.restore();

  // Frame
  const frame = getImg(state.customFrames?.[frameKey()] || window.FRAMES[frameKey()]);
  if (frame) { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(frame, 0, 0, W, H); }

  // Gems (equipment)
  if (L.gems && frameKey() !== 'offhand') drawGems(L.gems);

  // Name
  drawFitLine(state.name, L.name.cx, L.name.cy + state.nameDy, L.name.maxW,
    L.name.size * state.nameSize / 100, state.textFont, state.nameBold ? '700' : '400', state.nameColor);

  // Event - Ally: the ally frame already shows the icons and "Event - Ally", so only the
  // power / life numbers are drawn. Otherwise draw the type line (fixed "Event" for events).
  if (frameKey() === 'ally') drawAllyStats(L.type.cy + state.typeDy);
  else drawFitLine(state.kind === 'event' ? 'Event' : state.type, L.type.cx, L.type.cy + state.typeDy, L.type.maxW,
    L.type.size * state.typeSize / 100, state.textFont, '700', state.typeColor);

  // Rules text
  // the ally frame has a lighter inner panel (x 132–992, y 1040–1320) — keep text inside it
  const T = frameKey() === 'ally' ? { x: 146, y: 1046, w: W - 292, h: 268 } : L.text;
  const box = {
    x: T.x + state.textPadDx, w: T.w - 2 * state.textPadDx,
    y: T.y + state.textTopDy, h: T.h - state.textTopDy + state.textBotDy,
  };
  drawRich(state.text, box, L.text.size * state.textSize / 100);

  // Footer
  drawFooter(L.footer);
}

// ---------- Single line that shrinks to fit ----------
function drawFitLine(text, cx, cy, maxW, size, family, weight, color) {
  if (!text) return;
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > maxW && s > 10) { s -= 1; ctx.font = `${weight} ${s}px ${family}`; }
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + s * 0.04);
}

// ---------- Rich text ----------
function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function parseRich(src) {
  const chars = [];
  let b = false, it = false, paren = 0;
  for (let k = 0; k < src.length; k++) {
    const c = src[k];
    if (c === '*' && src[k + 1] === '*') { b = !b; k++; continue; }
    if (c === '*') { it = !it; continue; }
    if (c === '{') {
      const m = src.slice(k).match(/^\{(r|p|d|l|i)\}/i);
      if (m) { chars.push({ ch: '￼', icon: m[1].toLowerCase(), b, i: it }); k += m[0].length - 1; continue; }
    }
    if (c === '(' && state.autoItalic) paren++;
    chars.push({ ch: c, b, i: it || paren > 0 });
    if (c === ')' && paren > 0) paren--;
  }
  if (state.autoBold && state.keywords.trim()) {
    const kws = state.keywords.split(',').map(s => s.trim()).filter(Boolean).sort((a, z) => z.length - a.length);
    if (kws.length) {
      const re = new RegExp(`(?<![\\w'])(?:${kws.map(escRe).join('|')})(?: \\d+)?(?![\\w'])`, 'gi');
      const plain = chars.map(c => c.ch).join('');
      for (const m of plain.matchAll(re)) for (let j = m.index; j < m.index + m[0].length; j++) chars[j].b = true;
    }
  }
  return chars;
}

function fontFor(seg, size) {
  return `${seg.i ? 'italic ' : ''}${seg.b ? '700' : '400'} ${size}px ${state.textFont}`;
}

// Turn chars into paragraphs -> words -> segments
function toParagraphs(chars) {
  const paras = [];
  let cur = [];
  const flush = () => { paras.push(cur); cur = []; };
  for (const c of chars) { if (c.ch === '\n') flush(); else cur.push(c); }
  flush();
  return paras.map(p => {
    const plain = p.map(c => c.ch).join('').trim();
    if (plain === '---') return { divider: true };
    if (plain === '') return { blank: true };
    const words = [];
    let w = [];
    for (const c of p) {
      if (c.ch === ' ') { if (w.length) words.push(w); w = []; } else w.push(c);
    }
    if (w.length) words.push(w);
    return {
      words: words.map(wc => {
        const segs = [];
        for (const c of wc) {
          const last = segs[segs.length - 1];
          if (c.icon) segs.push({ icon: c.icon, b: c.b, i: c.i });
          else if (last && !last.icon && last.b === c.b && last.i === c.i) last.t += c.ch;
          else segs.push({ t: c.ch, b: c.b, i: c.i });
        }
        return segs;
      }),
    };
  });
}

function measureWord(segs, size) {
  let w = 0;
  for (const s of segs) {
    if (s.icon) w += size * 0.95;
    else { ctx.font = fontFor(s, size); w += ctx.measureText(s.t).width; }
  }
  return w;
}

function wrap(paras, maxW, size) {
  ctx.font = fontFor({}, size);
  const space = ctx.measureText(' ').width;
  const lineH = size * 1.2, gap = size * 0.42;
  const lines = [];
  let height = 0, firstPara = true;
  for (const p of paras) {
    if (p.blank) continue; // paragraph breaks are handled with gap
    if (!firstPara) height += gap;
    firstPara = false;
    if (p.divider) { lines.push({ divider: true, y: height, h: size * 0.8 }); height += size * 0.8; continue; }
    let line = { words: [], width: 0, y: height }, lw = 0;
    for (const w of p.words) {
      const ww = measureWord(w, size);
      if (line.words.length && lw + space + ww > maxW) {
        line.width = lw; lines.push(line); height += lineH;
        line = { words: [], width: 0, y: height }; lw = 0;
      }
      lw += (line.words.length ? space : 0) + ww;
      line.words.push({ segs: w, w: ww });
    }
    line.width = lw; lines.push(line); height += lineH;
  }
  return { lines, height, size, lineH, space };
}

function drawRich(text, box, baseSize) {
  if (!text || !text.trim()) return;
  const paras = toParagraphs(parseRich(text));
  let size = baseSize, lay;
  for (;;) {
    lay = wrap(paras, box.w, size);
    let widest = 0;
    for (const l of lay.lines) if (l.words) for (const w of l.words) widest = Math.max(widest, w.w);
    if ((lay.height <= box.h && widest <= box.w) || size < baseSize * 0.3) break;
    size *= 0.97;
  }
  const top = state.valign === 'top' ? box.y + size * 0.15 : box.y + (box.h - lay.height) / 2;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillStyle = state.textColor;
  for (const l of lay.lines) {
    if (l.divider) {
      const y = top + l.y + l.h / 2;
      const g = ctx.createLinearGradient(box.x, 0, box.x + box.w, 0);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.5, state.textColor); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(box.x + box.w * 0.1, y - 1.5, box.w * 0.8, 3);
      ctx.fillStyle = state.textColor;
      continue;
    }
    let x = state.align === 'center' ? box.x + (box.w - l.width) / 2 : box.x;
    const cy = top + l.y + lay.lineH / 2;
    l.words.forEach((w, wi) => {
      if (wi) x += lay.space;
      for (const s of w.segs) {
        if (s.icon) { drawIcon(s.icon, x + size * 0.475, cy, size * 0.82); x += size * 0.95; }
        else {
          ctx.font = fontFor(s, size); ctx.fillStyle = state.textColor;
          ctx.fillText(s.t, x, cy); x += ctx.measureText(s.t).width;
        }
      }
    });
  }
}

// ---------- Icons ----------
function drawIcon(kind, cx, cy, d) {
  const sym = getImg(window.ICONS?.[kind]);
  if (sym) { ctx.imageSmoothingQuality = 'high'; ctx.drawImage(sym, cx - d / 2, cy - d / 2, d, d); return; }
  const r = d / 2;
  ctx.save();
  if (kind === 'r') {
    const g = ctx.createRadialGradient(cx - r * .35, cy - r * .35, r * .1, cx, cy, r);
    g.addColorStop(0, '#ff9a8a'); g.addColorStop(.45, '#d8261c'); g.addColorStop(1, '#6e0b08');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = d * .06; ctx.strokeStyle = '#3a0705'; ctx.stroke();
  } else if (kind === 'p') {
    const g = ctx.createRadialGradient(cx - r * .3, cy - r * .3, r * .1, cx, cy, r);
    g.addColorStop(0, '#fff3b8'); g.addColorStop(.5, '#e5a91f'); g.addColorStop(1, '#7a4c06');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = d * .06; ctx.strokeStyle = '#4a2e04'; ctx.stroke();
    // sword
    ctx.translate(cx, cy); ctx.rotate(-Math.PI / 4);
    ctx.fillStyle = '#2a1a02';
    ctx.beginPath(); ctx.moveTo(0, -r * .72); ctx.lineTo(r * .12, -r * .45); ctx.lineTo(r * .12, r * .22);
    ctx.lineTo(-r * .12, r * .22); ctx.lineTo(-r * .12, -r * .45); ctx.closePath(); ctx.fill();
    ctx.fillRect(-r * .38, r * .22, r * .76, r * .12);
    ctx.fillRect(-r * .08, r * .34, r * .16, r * .32);
  } else if (kind === 'd') {
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * .55, -r * .72, r * .88, -r * .78);
    ctx.quadraticCurveTo(r * .95, r * .25, 0, r);
    ctx.quadraticCurveTo(-r * .95, r * .25, -r * .88, -r * .78);
    ctx.quadraticCurveTo(-r * .55, -r * .72, 0, -r); ctx.closePath();
    const g = ctx.createLinearGradient(0, -r, 0, r);
    g.addColorStop(0, '#d9dde3'); g.addColorStop(1, '#6b717c');
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = d * .07; ctx.strokeStyle = '#2b2f36'; ctx.stroke();
  }
  ctx.restore();
}

// ---------- Event - Ally stats ----------
function drawAllyStats(cy) {
  const vx = 186;
  ctx.save();
  ctx.font = `400 46px ${state.textFont}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = state.typeColor;
  if (state.power !== '') ctx.fillText(state.power, vx, cy + 2);
  if (state.life !== '') ctx.fillText(state.life, W - vx, cy + 2);
  ctx.restore();
}

// ---------- Equipment defense ----------
function drawGems(g) {
  // number sits just left of the frame's printed shield (like printed event equipment)
  if (state.defense === '') return;
  ctx.save();
  ctx.font = `400 50px ${state.textFont}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = state.typeColor;
  ctx.fillText(state.defense, 884, 1424 + state.typeDy); // centre of the frame's number box, left of the shield
  ctx.restore();
}
function statNumber(v, cx, cy) {
  if (v === '' || v == null) return;
  ctx.save();
  ctx.font = `700 ${v.length > 1 ? 40 : 50}px ${state.textFont}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineJoin = 'round';
  ctx.strokeText(v, cx, cy + 3);
  ctx.fillStyle = '#16151b'; ctx.fillText(v, cx, cy + 3);
  ctx.restore();
}

// ---------- Footer ----------
const RARITY = { C: '#9a9a9a', R: '#3a8ad6', S: '#9b54d6', M: '#d23a2e', L: '#e2b33a', F: '#e86a1c', P: '#3cbf86', T: '#cfcfcf' };
function drawFooter(f) {
  const y = f.y + state.footerDy;
  ctx.save();
  ctx.font = `600 ${f.size}px Inter, Arial, sans-serif`;
  ctx.textBaseline = 'middle'; ctx.fillStyle = state.footerColor;
  let x = f.l;
  ctx.textAlign = 'left';
  if (state.setCode) { ctx.fillText(state.setCode, x, y); x += ctx.measureText(state.setCode).width + 10; }
  if (state.rarity) {
    const rr = f.size * 0.55;
    ctx.fillStyle = RARITY[state.rarity]; ctx.beginPath(); ctx.arc(x + rr, y, rr, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.stroke();
    ctx.fillStyle = '#111'; ctx.font = `700 ${f.size * 0.7}px Inter, Arial, sans-serif`; ctx.textAlign = 'center';
    ctx.fillText(state.rarity, x + rr, y + 1);
  }
  ctx.font = `600 ${f.size}px Inter, Arial, sans-serif`; ctx.fillStyle = state.footerColor;
  if (state.artist) { ctx.textAlign = 'center'; ctx.fillText(state.artist, W / 2, y); }
  if (state.copyright) { ctx.textAlign = 'right'; ctx.fillText(state.copyright, f.r, y); }
  ctx.restore();
}

// ---------- UI binding ----------
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const statusEl = $('#status');
function flash(msg) { statusEl.textContent = msg; clearTimeout(flash.t); flash.t = setTimeout(() => (statusEl.textContent = ''), 3500); }

$$('.fontSel').forEach(sel => FONTS.forEach(([v, label]) => sel.add(new Option(label, v))));

function syncUI() {
  document.body.className = 'kind-' + state.kind + (state.ally ? ' ally' : '') + (state.offhand ? ' offhand' : '');
  $$('#kindSeg button').forEach(b => b.classList.toggle('on', b.dataset.kind === state.kind));
  $$('[data-key]').forEach(el => {
    const v = state[el.dataset.key];
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? '';
  });
  $$('[data-out]').forEach(o => o.textContent = fmtOut(o.dataset.out));
}
function fmtOut(k) {
  const v = state[k];
  return k === 'artZoom' ? `${Math.round(v * 100)}%` : /Size$/.test(k) ? `${v}%` : `${v > 0 ? '+' : ''}${v}`;
}

function changed() { requestRender(); }

$$('[data-key]').forEach(el => {
  el.addEventListener('input', () => {
    const k = el.dataset.key;
    state[k] = el.type === 'checkbox' ? el.checked : el.type === 'range' ? parseFloat(el.value) : el.value;
    const o = document.querySelector(`[data-out="${k}"]`); if (o) o.textContent = fmtOut(k);
    if (/Font$/.test(k)) loadFont(state[k]);
    if (k === 'offhand') document.body.classList.toggle('offhand', state.offhand);
    if (k === 'ally') {
      document.body.classList.toggle('ally', state.ally);
      // swap between the event example text and the ally starter text if not yet edited
      const from = state.ally ? SAMPLES.event.text : ALLY_TEXT, to = state.ally ? ALLY_TEXT : SAMPLES.event.text;
      if (!state.text.trim() || state.text === from) state.text = to;
      // same for the card name
      const nFrom = state.ally ? SAMPLES.event.name : ALLY_NAME, nTo = state.ally ? ALLY_NAME : SAMPLES.event.name;
      if (!state.name.trim() || state.name === nFrom) state.name = nTo;
      // starter attack / health so the mock always shows both numbers
      if (state.ally) {
        if (state.power === '') state.power = ALLY_STATS.power;
        if (state.life === '') state.life = ALLY_STATS.life;
      }
      syncUI();
    }
    changed();
  });
});

$$('#kindSeg button').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.kind;
  if (k === state.kind) return;
  // still on an example card → show the other kind's example
  if (isUntouchedSample(state)) { state = freshState(k); syncUI(); changed(); return; }
  // swap the default type line / footer colour if the user hasn't customised them
  if (!state.type || state.type === SAMPLES[state.kind].type) state.type = SAMPLES[k].type;
  if (state.footerColor === freshState(state.kind).footerColor) state.footerColor = freshState(k).footerColor;
  state.kind = k;
  syncUI(); changed();
}));

function loadFont(family) {
  if (document.fonts?.load) {
    Promise.all(['400', '700', 'italic 400', 'italic 700'].map(w => document.fonts.load(`${w} 40px ${family}`)))
      .then(requestRender, requestRender);
  }
}

// Images
function readFile(file, asText) {
  return new Promise((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result); fr.onerror = rej;
    asText ? fr.readAsText(file) : fr.readAsDataURL(file);
  });
}
async function shrinkImage(dataUrl, maxDim, keepPng) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const sc = Math.min(1, maxDim / Math.max(img.width, img.height));
  if (sc === 1 && dataUrl.length < 3e6) return dataUrl;
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return keepPng ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.92);
}

$('#artFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  state.art = await shrinkImage(await readFile(f), 2400, /png|webp|gif/.test(f.type) && f.size < 4e6);
  state.artZoom = 1; state.artX = 0; state.artY = 0;
  e.target.value = ''; syncUI(); changed();
});
$('#artClear').addEventListener('click', () => { state.art = null; changed(); });
$('#artReset').addEventListener('click', () => { state.artZoom = 1; state.artX = 0; state.artY = 0; syncUI(); changed(); });

$('#frameFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  state.customFrames = { ...state.customFrames, [frameKey()]: await readFile(f) };
  e.target.value = ''; changed(); flash(`Custom frame set for ${frameKey()} cards.`);
});
$('#frameReset').addEventListener('click', () => {
  const cf = { ...state.customFrames }; delete cf[frameKey()]; state.customFrames = cf; changed();
});
$('#layoutReset').addEventListener('click', () => {
  Object.assign(state, STYLE_DEFAULTS, { footerColor: freshState(state.kind).footerColor });
  syncUI(); changed();
});

// Drag / zoom art on the preview
let drag = null;
cv.addEventListener('pointerdown', e => {
  if (!state.art) return;
  drag = { x: e.clientX, y: e.clientY, ax: state.artX, ay: state.artY };
  cv.setPointerCapture(e.pointerId); cv.classList.add('dragging');
});
cv.addEventListener('pointermove', e => {
  if (!drag) return;
  const k = W / cv.clientWidth;
  state.artX = drag.ax + (e.clientX - drag.x) * k;
  state.artY = drag.ay + (e.clientY - drag.y) * k;
  requestRender();
});
const endDrag = () => { if (drag) { drag = null; cv.classList.remove('dragging'); changed(); } };
cv.addEventListener('pointerup', endDrag);
cv.addEventListener('pointercancel', endDrag);
cv.addEventListener('wheel', e => {
  if (!state.art) return;
  e.preventDefault();
  state.artZoom = Math.min(4, Math.max(0.2, state.artZoom * (e.deltaY < 0 ? 1.05 : 1 / 1.05)));
  syncUI(); changed();
}, { passive: false });

// Export / files
const safeName = () => (state.name || 'card').replace(/[\\/:*?"<>|]+/g, '').trim() || 'card';
function download(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; a.click(); }

$('#btnExport').addEventListener('click', () => {
  render();
  cv.toBlob(b => { const u = URL.createObjectURL(b); download(u, safeName() + '.png'); setTimeout(() => URL.revokeObjectURL(u), 5000); }, 'image/png');
});
$('#btnNew').addEventListener('click', () => {
  if (!confirm('Start a new card? The current card will be cleared.')) return;
  state = freshState(state.kind); syncUI(); changed();
});

// ---------- Boot ----------
const qKind = new URLSearchParams(location.search).get('kind');
if (qKind in LAYOUTS && qKind !== state.kind) state = freshState(qKind);

// Preload every frame and icon so switching kind / ticking Ally never renders without them.
[...Object.values(window.FRAMES), ...Object.values(window.ICONS || {})].forEach(getImg);

syncUI();
render();
loadFont(state.textFont);
document.fonts?.ready.then(requestRender);
