/* Current Events deck: builds the slides from content.js and runs them.
   Each slide has builds. → plays the slide's next build, and once they're all done it morphs into the next slide:
   anything the two slides share (title words, the header, the globe, the article page) flies to its new place. ← steps back. */
(function () {
  'use strict';

  const W = 1920, H = 1080, M = 128;
  const stage = document.getElementById('stage');
  const C = window.CONTENT;
  const escHTML = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function fail(msg) {
    const box = document.createElement('div');
    box.className = 'error';
    // browsers hide the details of errors in files opened straight from disk ("Script error."), so only show real ones
    const errs = (window.__errors || []).filter(e => !/Script error\.?$/.test(e)).map(escHTML).join('\n');
    box.innerHTML = `<div><h1>The slides couldn’t load</h1>${msg}${errs ? `<pre>${errs}</pre>` : ''}</div>`;
    document.body.appendChild(box);
  }
  if (!C) return fail(`<p>There’s a typo in <b>content.js</b>. Undo your last change, or check it for one of these, then save and refresh:</p>
    <ul><li>An apostrophe inside single quotes, like <code>'who's'</code>. Use double quotes for that text: <code>"who's"</code></li>
    <li>A missing comma at the end of a line</li><li>A quote or bracket that was opened but never closed</li></ul>`);
  if (!window.gsap || !window.d3 || !window.topojson || !window.WORLD || !window.Globe) return fail('<p>A file in the <b>engine</b> folder is missing. Keep the whole presentation folder together.</p>');

  // a busy or simple web server sometimes drops a request: try a photo twice more before treating it as missing
  addEventListener('error', e => {
    const im = e.target;
    if (!(im instanceof HTMLImageElement) || !im.getAttribute('src')) return;
    const n = +(im.dataset.retry || 0);
    if (n >= 2) return;
    e.stopImmediatePropagation();
    im.dataset.retry = n + 1;
    setTimeout(() => im.setAttribute('src', im.getAttribute('src')), 400 * (n + 1));
  }, true);

  const params = new URLSearchParams(location.search);
  const CAPTURE = params.has('capture');
  const BUILDS = C.clickBuilds !== false;
  if (CAPTURE) gsap.ticker.remove(gsap.updateRoot);   // time is advanced by the capture script instead
  gsap.ticker.lagSmoothing(0);

  /* ================================================================ text helpers */

  const $ = (sel, root) => root.querySelector(sel);
  const $$ = (sel, root) => [...root.querySelectorAll(sel)];
  const str = v => (v == null ? '' : String(v)).trim();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // straight quotes → curly quotes
  const smart = s => s.replace(/(^|[\s(\[{“—–-])"/g, '$1“').replace(/"/g, '”').replace(/(^|[\s(\[{“—–-])'/g, '$1‘').replace(/'/g, '’');
  const text = v => escHTML(smart(str(v).replace(/\*/g, '')));
  // every word in its own span so words can move on their own; *starred* words get the highlighter
  function words(v) {
    const out = [];
    for (const part of smart(str(v)).split(/(\*[^*]+\*)/)) {
      if (!part) continue;
      const hl = /^\*[^*]+\*$/.test(part);
      for (const tok of (hl ? part.slice(1, -1) : part).split(/(\s+)/)) {
        if (!tok) continue;
        if (/^\s+$/.test(tok)) out.push(tok.includes('\n') ? '<br>'.repeat(tok.split('\n').length - 1) : ' ');
        else out.push(hl ? `<span class="w hl"><span class="hl-t">${escHTML(tok)}</span></span>` : `<span class="w">${escHTML(tok)}</span>`);
      }
    }
    return out.join('').replace(/ {2,}/g, ' ').trim();
  }
  const wordKey = el => el.textContent.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');

  // the look: content.js theme picks a set of colours from style.css ('night' also brings the falling snow and the mountain ridge)
  const THEME = ['night', 'cobalt', 'desert', 'city'].includes(str(C.theme)) ? str(C.theme) : 'cobalt';
  document.documentElement.dataset.theme = THEME;
  if (C.photoTint === false) document.documentElement.dataset.tint = 'off';
  // content.js fonts: titles / text / small labels and cards / citation. Fonts a computer doesn't have fall back to
  // Nunito (rounded), Caladea (like Cambria) and the deck's own fonts, which all come with it
  const FONTS = C.fonts && typeof C.fonts === 'object' ? C.fonts : null;
  if (FONTS) {
    const q = v => (str(v) ? `"${str(v).replace(/"/g, '')}", ` : '');
    const rs = document.documentElement.style;
    document.documentElement.dataset.fonts = '';
    rs.setProperty('--f-title', `${q(FONTS.titles)}Nunito, "Libre Franklin", sans-serif`);
    rs.setProperty('--f-text', `${q(FONTS.text)}Avenir, "Libre Franklin", sans-serif`);
    rs.setProperty('--f-label', `${q(FONTS.labels)}"Helvetica Neue", Helvetica, sans-serif`);
    rs.setProperty('--f-cite', `${q(FONTS.citation)}Caladea, Newsreader, Georgia, serif`);   // Caladea: a free font the same size as Cambria
  }
  const NIGHT = THEME === 'night';
  const rootCSS = getComputedStyle(document.documentElement);
  const V = n => rootCSS.getPropertyValue(n).trim();
  const BG = { light: V('--paper'), dark: V('--dark') };
  // the layout: 'flat' slides, or 'space': every slide is a set of cards floating somewhere in one 3D world, and the
  // camera flies from one to the next (the desert and city themes use space unless content.js says otherwise)
  const SPACE = (str(C.layout) || (THEME === 'desert' || THEME === 'city' ? 'space' : 'flat')) === 'space';
  const PERSP = 1600;                                                    // the stage's perspective in space layout, in slide px
  const persp = v => (SPACE ? {} : { transformPerspective: v });         // inside the 3D world, elements share its perspective
  // a colour with its alpha set to 0, so a line can fade in from nothing in its own colour
  const clear = c => c.replace(/^rgba?\(([^,]+),([^,]+),([^,)]+).*$/, 'rgba($1,$2,$3,0)');
  const fadeLine = (tl, el, side, at) => { const c = getComputedStyle(el)[side]; tl.fromTo(el, { [side]: clear(c) }, { [side]: c, duration: 0.5 }, at); };

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MLA_MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];
  const monthOf = w => { const i = MONTHS.findIndex(m => m.slice(0, 3).toLowerCase() === w.slice(0, 3).toLowerCase()); return i < 0 ? null : i; };
  // understands 2026-09-30, September 30 2026, Sept. 30, 2026 and 30 September 2026; anything else is shown as typed
  function parseDate(v) {
    const s = str(v);
    let m;
    if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s))) return { y: +m[1], m: +m[2] - 1, d: +m[3] };
    if ((m = /^([A-Za-z]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/.exec(s)) && monthOf(m[1]) != null) return { y: +m[3], m: monthOf(m[1]), d: +m[2] };
    if ((m = /^(\d{1,2})\s+([A-Za-z]{3,})\.?,?\s+(\d{4})$/.exec(s)) && monthOf(m[2]) != null) return { y: +m[3], m: monthOf(m[2]), d: +m[1] };
    return null;
  }
  const longDate = p => `${MONTHS[p.m]} ${p.d}, ${p.y}`;
  const dayDate = p => new Date(p.y, p.m, p.d).toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const now = new Date();
  const todayP = { y: now.getFullYear(), m: now.getMonth(), d: now.getDate() };

  const A = C.article || {};
  const authors = (Array.isArray(A.authors) ? A.authors : str(A.authors).split(/\s*(?:,|&|\band\b)\s*/)).map(str).filter(Boolean);
  const listNames = l => l.length < 2 ? (l[0] || '') : `${l.slice(0, -1).join(', ')} and ${l[l.length - 1]}`;
  const pubP = parseDate(A.published);
  const published = pubP ? longDate(pubP) : text(A.published);
  const dateP = parseDate(C.date);
  const presentDate = str(C.date) ? text(C.date) : dayDate(todayP);
  const url = str(A.url);
  const host = u => u.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0];

  // MLA 9 citation built from the article details
  function citation() {
    // organisations ('The Canadian Press') aren't inverted, and one that is also the publisher is left out
    const org = n => /\b(news|press|staff|reuters|associated|agence|service|media|network)\b/i.test(n);
    const inv = n => { const p = n.split(/\s+/); return p.length < 2 || org(n) ? n : `${p[p.length - 1]}, ${p.slice(0, -1).join(' ')}`; };
    const pub = str(A.newspaper).toLowerCase();
    const names = authors.filter(n => n.toLowerCase() !== pub);
    let who = '';
    if (names.length === 1) who = inv(names[0]);
    else if (names.length === 2) who = `${inv(names[0])}, and ${names[1]}`;
    else if (names.length > 2) who = `${inv(names[0])}, et al`;
    let s = who ? escHTML(smart(who.replace(/\.$/, ''))) + '. ' : '';
    const t = smart(str(A.title).replace(/\*/g, ''));
    if (t) s += `“${escHTML(t)}${/[.?!]$/.test(t) ? '' : '.'}” `;
    if (str(A.newspaper)) s += `<i>${text(A.newspaper)}</i>`;
    const d = pubP ? `${pubP.d} ${MLA_MONTHS[pubP.m]} ${pubP.y}` : text(A.published);
    if (d) s += `, ${d}`;
    const u = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
    if (u) s += `, ${escHTML(u)}`;
    return s.replace(/^, /, '') + '.';
  }

  function qrSVG(data) {
    const q = qrcode(0, 'M');
    q.addData(data);
    q.make();
    const n = q.getModuleCount(), pad = 3;
    let d = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (!q.isDark(r, c)) continue;
        let run = 1;
        while (c + run < n && q.isDark(r, c + run)) run++;
        d += `M${c} ${r}h${run}v1h-${run}z`;
        c += run - 1;
      }
    }
    const s = n + pad * 2;
    return `<svg viewBox="${-pad} ${-pad} ${s} ${s}" shape-rendering="crispEdges" aria-hidden="true"><rect x="${-pad}" y="${-pad}" width="${s}" height="${s}" fill="#fff"/><path d="${d}" fill="#141414"/></svg>`;
  }

  const youTubeId = u => { const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/.exec(u); return m && m[1]; };

  /* ================================================================ fitting text to its box */

  // binary search on a number (font size or scale) until ok() holds; keeps the largest value that fits
  function fitBy(apply, ok, lo, hi, iters = 9) {
    apply(hi);
    if (ok()) return hi;
    let best = lo;
    for (let i = 0; i < iters; i++) {
      const mid = (lo + hi) / 2;
      apply(mid);
      if (ok()) { best = mid; lo = mid; } else hi = mid;
    }
    apply(best);
    return best;
  }
  const fits = el => el.scrollHeight <= el.clientHeight + 4 && el.scrollWidth <= el.clientWidth + 1;   // a few px of glyph overhang is fine
  const fitFont = (el, lo, hi, box = el) => el && fitBy(v => { el.style.fontSize = Math.floor(v) + 'px'; }, () => fits(box), lo, hi);
  const fitK = (el, lo = 0.6) => el && fitBy(v => el.style.setProperty('--k', v.toFixed(3)), () => fits(el), lo, 1);

  /* ================================================================ animation helpers */

  let scale = 1;
  const HIDE = 'inset(-14% 100% -14% 0%)', SHOW = 'inset(-14% 0% -14% 0%)';
  const none = els => !els || (els.length !== undefined && !els.length);
  // wipe left to right (labels, names, dates)
  const wipe = (tl, els, at, o = {}) => none(els) || tl.fromTo(els, { clipPath: HIDE }, { clipPath: SHOW, duration: 0.6, ease: 'power2.out', stagger: 0.1, clearProps: 'clipPath', ...o }, at);
  // fade with a short rise (paragraphs)
  const fade = (tl, els, at, o = {}) => none(els) || tl.fromTo(els, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', stagger: 0.1, ...o }, at);
  // words rising into place one after another
  const rise = (tl, els, at, o = {}) => none(els) || tl.fromTo(els, { yPercent: 55, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.03, ...o }, at);
  // the highlighter: sweeps across each starred word in reading order at an even speed
  function sweep(tl, els, at) {
    for (const el of els) {
      const d = Math.max(0.1, el.offsetWidth / 1500);
      tl.fromTo(el, { '--p': '0%' }, { '--p': '100%', duration: d, ease: 'none' }, at);
      at += d;
    }
    return at;
  }
  const hls = (root, sel = '') => $$(`${sel} .w.hl`, root);
  // a slow bob and sway, so a picture looks like it's floating
  const bob = (el, k = 0) => gsap.to(el, { y: -11, rotation: 0.7, duration: 3.1 + (k % 3) * 0.7, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: -k * 0.9 });

  /* ================================================================ layers: background, globe, slides, morph overlay */

  const bg = document.createElement('div'); bg.id = 'bg';
  const cv = document.createElement('canvas'); cv.id = 'globe';
  const fx = document.createElement('div'); fx.id = 'fx';
  // the photo frame: one picture behind the slides (a full backdrop on some, an inset on others) that moves between them
  const frame = document.createElement('div'); frame.id = 'photo';
  frame.innerHTML = '<div class="ph-tint"></div><div class="ph-shade"></div>';
  stage.append(bg, frame, cv, fx);
  // space layout: the slides live in #world, and the camera (CAM) flies through it
  const world = document.createElement('div');
  world.id = 'world';
  if (SPACE) { stage.classList.add('space'); stage.insertBefore(world, fx); }
  const G = new Globe(cv);
  // the night theme's 3D scene (engine/atmos.js): falling snow, and a mountain ridge on the first and last slides
  let AT = null;
  if (NIGHT && !SPACE && window.THREE && window.Atmos) {
    try {
      const ac = document.createElement('canvas');
      ac.id = 'atmos';
      stage.insertBefore(ac, cv);
      const hexRGB = h => [0, 2, 4].map(i => parseInt(h.replace('#', '').slice(i, i + 2), 16));
      AT = new Atmos(ac, { bone: hexRGB(V('--dark-fg')), warm: V('--hl-rgb').split(/\s+/).map(Number) });
    } catch (e) { console.warn('3D scene unavailable', e); AT = null; }
  }
  // where its camera looks: up into the snow on dark slides, down the valley to the town on the first slide, from higher up on the last
  const SKY = { snow: 1, ridge: 0, left: 0.8, x: 0, y: 380, z: 0, lx: 0, ly: 2900, lz: -6000 };
  const NO_SNOW = { ...SKY, snow: 0 };
  const VALLEY = { snow: 1, ridge: 1, left: 0.9, x: 0, y: 540, z: 0, lx: 420, ly: 300, lz: -6000 };
  const OVERLOOK = { snow: 1, ridge: 1, left: 1, x: -500, y: 760, z: -600, lx: 300, ly: -200, lz: -6500 };
  // the theme's 3D world (engine/desert.js, engine/city.js), behind the floating slides and seen through the same camera
  const FOV = 2 * Math.atan(540 / PERSP) * 180 / Math.PI;
  const WORLD3D = { desert: window.Desert, city: window.City }[THEME];
  let ENV = null, VER = null;
  if (SPACE && WORLD3D && window.THREE) {
    try {
      const ec = document.createElement('canvas');
      ec.id = 'env';
      stage.insertBefore(ec, world);
      const colors = Object.fromEntries(WORLD3D.keys.map(n => [n.replace(/-(\w)/g, (_, c) => c.toUpperCase()), V('--' + n)]));
      ENV = new WORLD3D(ec, { fov: FOV, colors });
    } catch (e) { console.warn('3D world unavailable', e); ENV = null; }
  }
  // Verity (engine/verity3d.js) floats in front of everything, moving to a new spot on each slide
  if (C.verity && window.THREE && window.VERITY && window.Verity3D) {
    try {
      const vc = document.createElement('canvas');
      vc.id = 'verity';
      stage.insertBefore(vc, fx);
      VER = new Verity3D(vc, { fov: FOV, data: window.VERITY });
    } catch (e) { console.warn('Verity unavailable', e); VER = null; }
  }
  G.colors = { sea: V('--globe-sea'), province: V('--globe-province'), country: V('--globe-country'), continent: V('--globe-continent'), mark: V('--globe-mark'), ink: V('--ink') };
  const FULL = { x: 0, y: 0, w: W, h: H };
  const badImg = new Set();
  // a photo state for the frame, or null when there's no picture to show
  const ph = (src, o = {}) => (str(src) && !badImg.has(str(src)) ? { src: str(src), rect: FULL, duo: 0, zoom: 1, x: 0, y: 0, ...o } : null);

  const WH = C.where || {};
  const place = isFinite(parseFloat(WH.lat)) && isFinite(parseFloat(WH.lon)) ? [parseFloat(WH.lon), parseFloat(WH.lat)] : null;
  G.mark = place;
  const RAD = Math.PI / 180;
  const BASE = { mix: 0, clipR: 4000, lensA: 0, markP: 0, provP: 0, countryP: 0, contP: 0, alpha: 1 };
  // the small globe next to "Current Events"
  const LOGO = theme => ({ ...BASE, cx: 145, cy: 70, r: 15, lat: 14, lon: null, clipR: 60, mix: theme === 'dark' ? 1 : 0, spinning: 'slow' });
  // the big turning globe on the cover and the last slide
  const BIG = (cx, cy, r) => ({ ...BASE, cx, cy, r, mix: 1, clipR: r + 80, markP: 1, lat: place ? clamp(place[1] * 0.6, -35, 35) : 18, lon: place ? place[0] + 38 : 0, spinning: 'big' });

  /* ================================================================ slides */

  const NO_VIEW = { vx: 0, vy: 0, vz: 0 };     // space layout: where the camera sits for a build, relative to its slide
  let whereGlobe = null;                        // space layout: the globe is drawn only on its own slide, and stays as it was left

  const pages = [];
  function addPage(o) {
    const el = document.createElement('section');
    el.className = `page ${o.theme} ${o.cls}`;
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `<header class="head${o.cover ? ' cover-head' : ''}"><b data-k="brand">Current Events</b>${o.section && C.sections !== false ? `<span class="sec" data-k="section">${o.section}</span>` : ''}${o.cover ? '' : '<span class="num" data-k="num"></span>'}</header>${o.html}`;
    if (SPACE) world.appendChild(el); else stage.insertBefore(el, fx);
    const p = Object.assign({ steps: [], ends: [], step: 0, tl: gsap.timeline({ paused: true }), globe: () => LOGO(o.theme), world: () => (o.theme === 'dark' ? SKY : NO_SNOW),
      photo: () => null, view: () => NO_VIEW, verity: () => null, fit() {}, enter() {}, leave() {}, onStep() {} }, o, { el });
    pages.push(p);
    return p;
  }

  /* ---------- Verity's speech bubbles (content.js veritySays): box at x, y (w × h, turned rot degrees), its point at tip */
  const SAYS = C.veritySays || {};
  function bubble(say, b) {
    if (!str(say) || !C.verity) return '';
    const { w, h } = b, tx = b.tip[0], ty = b.tip[1];
    const c = clamp(ty, h * 0.25, h * 0.75), hw = h * 0.1;          // where the wedge leaves the right-hand side
    const d = `M2 2H${w - 2}V${c - hw}L${tx} ${ty}L${w - 2} ${c + hw}V${h - 2}H2Z`;
    return `<div class="say" data-rot="${b.rot}" data-tip="${tx} ${ty}" style="left:${b.x}px; top:${b.y}px; width:${w}px; height:${h}px">
      <svg width="${w}" height="${h}" aria-hidden="true"><path d="${d}"/></svg><p><span>${words(say)}</span></p></div>`;
  }
  const popSay = (tl, el, at) => {
    if (!el) return;
    gsap.set(el, { rotation: +el.dataset.rot, transformOrigin: el.dataset.tip.split(' ').map(v => v + 'px').join(' ') });
    tl.fromTo(el, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.8)' }, at);
  };

  /* ---------- intro (optional): a word before the story, with a few pictures floating beside it ---------- */
  const IN = C.intro || {};
  if (str(IN.title) || str(IN.text)) {
    const pics = (Array.isArray(IN.images) ? IN.images : []).map(str).filter(Boolean).slice(0, 3);
    // where the pictures float: page px, and how they're turned
    const spots = [{ x: 1180, y: 150, w: 540, h: 400, z: 160, ry: -12, rz: -4 }, { x: 1452, y: 452, w: 340, h: 452, z: 300, ry: 10, rz: 5 }, { x: 1112, y: 630, w: 400, h: 300, z: 90, ry: -6, rz: -2 }];
    const p = addPage({ cls: 'p-intro', theme: 'light', cover: SPACE, label: smart(str(IN.title).replace(/\*/g, '')), html: `
      <div class="intro-card pnl">
        ${str(IN.kicker) ? `<p class="intro-kicker">${text(IN.kicker)}</p>` : ''}
        <h2 class="intro-title">${words(IN.title)}</h2>
        <p class="intro-text">${words(IN.text)}</p>
      </div>
      ${pics.map((src, i) => `<figure class="intro-pic" style="left:${spots[i].x}px; top:${spots[i].y}px; width:${spots[i].w}px; height:${spots[i].h}px"><div class="pic-float"><img alt="" src="${escHTML(src)}"></div></figure>`).join('')}` });
    const figs = $$('.intro-pic', p.el);
    figs.forEach((f, i) => {
      $('img', f).addEventListener('error', () => { f.style.display = 'none'; });
      if (SPACE) gsap.set(f, { z: spots[i].z, rotationY: spots[i].ry, rotation: spots[i].rz });
      else gsap.set(f, { rotation: spots[i].rz });
      bob($('.pic-float', f), i);
    });
    p.fit = () => fitK($('.intro-card', p.el), 0.55);
    p.verity = () => ({ x: 1010, y: 900, r: 92 });
    p.steps = [(tl, at) => {
      fade(tl, $('.intro-kicker', p.el), at + 0.3);
      rise(tl, $$('.intro-title .w', p.el), at + 0.4, { stagger: 0.05 });
      fade(tl, $('.intro-text', p.el), at + 1.0, { y: 24 });
      sweep(tl, hls(p.el, '.intro-card'), at + 1.6);
      // the pictures drift in from far away, one after another
      figs.forEach((f, i) => tl.fromTo(f, { opacity: 0, ...(SPACE ? { z: spots[i].z - 900, rotationY: spots[i].ry + 40 } : { y: 60 }) },
        { opacity: 1, ...(SPACE ? { z: spots[i].z, rotationY: spots[i].ry } : { y: 0 }), duration: 1.3, ease: 'power3.out' }, at + 0.9 + i * 0.22));
    }];
  }

  /* ---------- cover ---------- */
  {
    const title = str(C.coverTitle) || str(A.title) || 'Current events';
    const p = addPage({ cls: 'p-cover', theme: 'dark', cover: true, label: smart(title.replace(/\*/g, '')), html: `
      <div class="cover-main pnl">
        <h1 class="cover-title" data-title><span class="tt">${words(title)}</span></h1>
        <p class="cover-from">${str(A.newspaper) ? `From <b data-k="paper">${text(A.newspaper)}</b>${published ? ', ' : ''}` : ''}${published ? `<span data-k="pub">${published}</span>` : ''}</p>
        <div class="cover-fields">
          <div class="field"><span class="lab">Name</span><span class="val">${text(C.name)}</span><i class="line"></i></div>
          <div class="field"><span class="lab">Date</span><span class="val">${presentDate}</span><i class="line"></i></div>
          ${str(C.class) ? `<div class="field"><span class="lab">Class</span><span class="val">${text(C.class)}</span><i class="line"></i></div>` : ''}
        </div>
      </div>
      ${bubble(SAYS.cover, { x: 975, y: 76, w: 342, h: 247, rot: 6.57, tip: [579, 96] })}` });
    p.globe = () => (AT || (C.photoTint === false && p.photo(0)) ? { ...LOGO('dark'), alpha: 0 } : BIG(1590, 690, 520));
    p.world = () => VALLEY;
    p.verity = () => ({ x: 1660, y: 220, r: 87 });
    p.photo = () => ph(C.coverImage, { duo: 1 });
    p.fit = () => { const h = $('.cover-title', p.el); fitBy(v => { h.style.fontSize = Math.floor(v) + 'px'; }, () => h.firstElementChild.offsetHeight <= h.clientHeight, 84, 160); };
    p.steps = [(tl, at) => {
      rise(tl, $$('.cover-title .w', p.el), at + 0.15, { stagger: 0.045 });
      const end = sweep(tl, hls(p.el, '.cover-title'), at + 0.9);
      fade(tl, $('.cover-from', p.el), at + 0.75);
      tl.fromTo($$('.field .line', p.el), { scaleX: 0 }, { scaleX: 1, duration: 0.8, ease: 'power3.inOut', stagger: 0.15 }, Math.max(at + 1.1, end - 0.3));
      fade(tl, $$('.field .lab, .field .val', p.el), Math.max(at + 1.25, end - 0.15), { stagger: 0.07 });
      popSay(tl, $('.say', p.el), at + 1.6);
    }];
  }

  /* ---------- the article ---------- */
  {
    const shot = str(A.screenshot);
    const mockLines = [100, 96, 100, 88, 100, 93, 62, 0, 100, 97, 100, 91, 100, 76, 0, 100, 95, 100, 84, 100, 99, 58, 0, 100, 92, 100, 87, 100, 64];
    const mock = note => `<div class="mock">
        <div class="mock-mast">${text(A.newspaper) || 'Newspaper'}</div>
        <div class="mock-head">${text(A.title)}</div>
        <div class="mock-by"><span>${authors.length ? 'By ' + escHTML(smart(listNames(authors))) : ''}</span><span>${published}</span></div>
        <div class="mock-img"><span>${note}</span></div>
        <div class="mock-lines">${mockLines.map(w => w ? `<i style="width:${w}%"></i>` : '<i style="height:6px;background:none"></i>').join('')}</div>
      </div>`;
    const p = addPage({ cls: 'p-article', theme: 'light', section: 'Information about the article', label: 'The article', html: `
      <div class="art-info pnl">
        ${A.titleLabel === '' ? '' : `<div class="lab art-lab">${text(A.titleLabel || 'Title of article')}</div>`}
        <h2 class="art-title" data-title>${words(A.title)}</h2>
        <dl class="art-meta">
          <dt>${authors.length > 1 ? 'Authors' : 'Author'}</dt><dd class="art-by">${str(A.byline) ? text(A.byline) : escHTML(smart(listNames(authors)))}</dd>
          <dt>Date published</dt><dd data-k="pub">${published}</dd>
          <dt>Newspaper</dt><dd data-k="paper">${text(A.newspaper)}</dd>
        </dl>
        ${url && C.qr !== false ? `<div class="art-qr">${qrSVG(url)}<p>Scan to read the full article<span>${escHTML(host(url))}</span></p></div>` : ''}
      </div>
      <figure class="art-sheet" data-k="box"><div class="art-scroll${shot ? '' : ' mocked'}">${shot ? `<img alt="The article" src="${escHTML(shot)}">` : mock('Save a screenshot of your article in the <code>assets</code> folder and add it to <code>content.js</code>.')}</div></figure>` });
    const img = $('.art-scroll img', p.el), sheet = $('.art-sheet', p.el), info = $('.art-info', p.el);
    const home = { left: 1048, top: 140, width: 744, height: 844 };
    if (img) img.addEventListener('error', () => { const s = $('.art-scroll', p.el); s.classList.add('mocked'); s.innerHTML = mock(`Save a screenshot of your article as <code>${escHTML(shot)}</code> and it will appear here.`); });
    // a short, wide screenshot gets a frame its own height instead of white space below it
    const hug = (box, w) => { if (!img || !img.naturalWidth) return box; const h = Math.round(img.naturalHeight * w / img.naturalWidth); return h < box.height ? { ...box, top: box.top + (box.height - h) / 2, height: h } : box; };
    let scroller = null;
    const stopScroll = () => { if (scroller) { scroller.kill(); scroller = null; } gsap.set($('.art-scroll', p.el), { y: 0 }); };
    // tall screenshots scroll slowly so the whole article gets shown
    const startScroll = () => {
      stopScroll();
      const inner = $('.art-scroll', p.el), over = inner.offsetHeight - sheet.clientHeight;
      if (over > 40) scroller = gsap.timeline({ repeat: -1, yoyo: true, delay: 2.5, repeatDelay: 3 }).to(inner, { y: -over, duration: over / 70, ease: 'sine.inOut' });
    };
    p.fit = () => { fitFont($('.art-title', p.el), 36, 62, info); Object.assign(sheet.style, Object.fromEntries(Object.entries(hug(home, home.width)).map(([k, v]) => [k, v + 'px']))); };
    if (SPACE) gsap.set(sheet, { z: 40 });
    // space layout: the second click flies the camera up to the article instead of enlarging it
    const sheetView = () => { const b = hug(home, home.width), h = Math.min(1000, b.height * 1.25); return { vx: b.left + b.width / 2 - W / 2, vy: b.top + b.height / 2 - H / 2, vz: 40 - PERSP * (1 - b.height / h) }; };
    p.view = s => (SPACE && s === 1 ? sheetView() : NO_VIEW);
    p.verity = () => null;
    p.steps = [(tl, at) => {
      fade(tl, $('.art-lab', p.el), at + 0.2);
      fadeLine(tl, $('.art-meta', p.el), 'borderTopColor', at + 0.3);
      wipe(tl, $$('.art-meta dt, .art-by', p.el), at + 0.35, { stagger: 0.08 });
      fade(tl, $('.art-qr', p.el), at + 0.8);
      // the article swings in towards you, hinged on its right edge
      tl.fromTo(sheet, { rotationY: -64, x: 140, ...persp(1800), transformOrigin: '100% 50%' }, { rotationY: 0, x: 0, duration: 1.4, ease: 'power3.out' }, at + 0.1)
        .fromTo(sheet, { opacity: 0 }, { opacity: 1, duration: 0.45, ease: 'power1.out' }, at + 0.1);
      sweep(tl, hls(p.el, '.art-title'), at + 0.9);
    }, BUILDS && SPACE && ((tl, at) => {
      tl.to(info, { opacity: 0.3, duration: 0.6, ease: 'power1.inOut' }, at).set({}, {}, at + 1.5);
    }), BUILDS && !SPACE && ((tl, at) => {
      // second click: bring the article forward so the class can read it
      const big = hug({ left: 330, top: 104, width: 1260, height: 872 }, 1260);
      tl.to(info, { opacity: 0, x: -70, duration: 0.5, ease: 'power2.in' }, at)
        .to(sheet, { ...big, duration: 1, ease: 'power3.inOut' }, at + 0.1);
    })].filter(Boolean);
    p.stepLabel = s => s ? 'The article, close up' : '';
    p.enter = () => img && !img.complete ? img.addEventListener('load', startScroll, { once: true }) : startScroll();
    p.onStep = startScroll;
    p.leave = stopScroll;
  }

  /* ---------- news clip (optional) ---------- */
  if (str(A.clip)) {
    const src = str(A.clip), yt = youTubeId(src);
    const served = /^https?:/.test(location.protocol);
    let inner;
    if (yt && served) inner = `<iframe src="https://www.youtube-nocookie.com/embed/${yt}?rel=0&playsinline=1&enablejsapi=1" title="News clip" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
    else if (yt) inner = `<img class="thumb" alt="" src="https://i.ytimg.com/vi/${yt}/hqdefault.jpg"><div class="play"></div>`;
    else inner = `<video src="${escHTML(src)}" preload="metadata" playsinline></video><div class="play"></div><div class="bar"></div>`;
    const p = addPage({ cls: 'p-clip', theme: 'light', section: 'Information about the article', label: 'News clip', html: `
      <h2 class="title" data-title>${words('News clip')}</h2>
      <div class="vid" data-k="box">${inner}</div>
      <div class="clip-side">
        <p class="clip-cap">${words(A.clipCaption)}</p>
        <p class="clip-hint">${yt && !served ? 'Press <kbd>Space</kbd> to open the clip on YouTube' : 'Press <kbd>Space</kbd> to play or pause'}</p>
      </div>` });
    const box = $('.vid', p.el), video = $('video', p.el), frame = $('iframe', p.el);
    const empty = () => {
      box.innerHTML = `<div class="empty"><b>Add your news clip</b><span>Save the video as <code>${escHTML(src)}</code>, or set <code>clip: ''</code> in content.js to remove this slide.</span></div>`;
      $('.clip-hint', p.el).style.visibility = 'hidden';
      p.toggle = null;
    };
    if (video) {
      video.addEventListener('error', empty);
      video.addEventListener('play', () => box.classList.add('playing'));
      video.addEventListener('pause', () => box.classList.remove('playing'));
      video.addEventListener('timeupdate', () => { $('.bar', box).style.width = (video.currentTime / (video.duration || 1) * 100) + '%'; });
      p.toggle = () => { if (video.paused) video.play(); else video.pause(); return true; };
    } else if (frame) {
      let playing = false;
      p.toggle = () => { playing = !playing; frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: playing ? 'playVideo' : 'pauseVideo', args: [] }), '*'); return true; };
    } else {
      p.toggle = () => { window.open(src, '_blank', 'noopener'); return true; };
    }
    box.addEventListener('click', () => p.toggle && p.toggle());
    p.fit = () => fitFont($('.clip-cap', p.el), 22, 32, $('.clip-side', p.el));
    p.steps = [(tl, at) => {
      fade(tl, $$('.clip-side > *', p.el), at + 0.45, { stagger: 0.15 });
      sweep(tl, hls(p.el, '.clip-cap'), at + 1.1);
    }];
    p.leave = () => { if (video && !video.paused) video.pause(); if (frame && p.toggle) frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'pauseVideo', args: [] }), '*'); };
  }

  /* ---------- who ---------- */
  {
    const who = C.who || {};
    const groups = (who.groups || []).filter(g => g && (str(g.name) || str(g.how)));
    const p = addPage({ cls: 'p-who', theme: 'light', section: 'Major points of the article', label: 'Who does this article affect?', html: `
      <div class="who-left pnl">
        <h2 class="title" data-title>${words('Who does this article affect?')}</h2>
        ${str(who.summary) ? `<p class="who-sum">${words(who.summary)}</p>` : ''}
      </div>
      <div class="who-list">${groups.map((g, i) => `<div class="who-row pnl" data-step="${i + 1}"><h3 class="who-name">${words(g.name)}</h3>${str(g.how) ? `<p class="who-how">${words(g.how)}</p>` : ''}</div>`).join('')}</div>
      <div class="who-cap">${groups.map((g, i) => str(g.image) ? `<span data-g="${i}">${text(g.name)}</span>` : '').join('')}</div>` });
    const pics = [str(who.image) || str((groups[0] || {}).image), ...groups.map(g => str(g.image))];
    for (let i = 1; i < pics.length; i++) if (!pics[i]) pics[i] = pics[i - 1];
    const RECT = { x: M, y: 548, w: 716, h: 436 };
    p.photo = s => ph(pics[s], { rect: RECT, reveal: 'turn' });
    p.verity = () => null;
    p.fit = () => { fitK($('.who-list', p.el), 0.55); const left = $('.who-left', p.el); left.style.height = (RECT.y - 40 - 140) + 'px'; fitFont($('.who-sum', p.el), 24, 38, left); };
    // first the question (and summary), then one group per click
    p.steps = [(tl, at) => {
      fade(tl, $('.who-sum', p.el), at + 0.5);
      sweep(tl, hls(p.el, '.who-sum'), at + 1.1);
    }, ...$$('.who-row', p.el).map((row, i) => (tl, at) => {
      // the caption names whose photo is showing; it only appears when the group has a photo of its own
      const cap = $(`.who-cap span[data-g="${i}"]`, p.el), before = $$('.who-cap span', p.el).filter(c => +c.dataset.g < i);
      if (before.length) tl.to(before, { opacity: 0, y: 10, duration: 0.3 }, at);
      if (cap) wipe(tl, cap, at + 0.75, { clearProps: '' });
      fadeLine(tl, row, 'borderTopColor', at);
      wipe(tl, $('.who-name', row), at);
      fade(tl, $('.who-how', row), at + 0.15);
      sweep(tl, hls(row), at + 0.6);
    })];
    p.stepLabel = s => s ? smart(str(groups[s - 1].name).replace(/\*/g, '')) : '';
  }

  /* ---------- what ---------- */
  {
    const I = C.issue || {};
    const quote = str(I.quote).replace(/^["“”']+|["“”']+$/g, '');
    const title = str(I.title) || 'What is the most important issue in the article?';
    const p = addPage({ cls: `p-what${quote ? '' : ' noquote'}`, theme: 'dark', section: 'Major points of the article', label: smart(title.replace(/\s+/g, ' ')), html: `
      <h2 class="title pnl" data-title>${words(title)}</h2>
      <div class="what-col pnl">
        <p class="what-main">${words(I.statement)}</p>
        ${str(I.detail) ? `<p class="what-detail">${words(I.detail)}</p>` : ''}
      </div>
      ${quote ? `<figure class="what-quote pnl" data-step="${str(I.detail) ? 2 : 1}" data-z="60"><blockquote>${words('“' + quote + '”')}</blockquote>${str(I.quoteBy) ? `<cite>${text(I.quoteBy)}</cite>` : ''}</figure>` : ''}` });
    p.fit = () => {
      fitK($('.what-col', p.el), 0.5);
      const q = $('.what-quote', p.el);
      if (q) { fitFont($('blockquote', q), 24, 40, q); q.style.height = 'auto'; }
    };
    const cams = [{ zoom: 1, x: 0 }, { zoom: 1.12, x: -3, y: -2 }, { zoom: 1.24, x: 3, y: 2 }];
    p.photo = s => ph(I.image, { duo: 1, ...cams[Math.min(s, 2)] });
    p.verity = () => null;
    p.steps = [(tl, at) => {
      rise(tl, $$('.what-main .w', p.el), at + 0.4, { stagger: 0.025 });
      sweep(tl, hls(p.el, '.what-main'), at + 1.1);
    }];
    if ($('.what-detail', p.el)) p.steps.push((tl, at) => { fade(tl, $('.what-detail', p.el), at); sweep(tl, hls(p.el, '.what-detail'), at + 0.6); });
    if (quote) p.steps.push((tl, at) => {
      const q = $('.what-quote', p.el);
      fadeLine(tl, q, 'borderLeftColor', at);
      rise(tl, $$('blockquote .w', q), at + 0.1, { stagger: 0.02, duration: 0.6 });
      fade(tl, $('cite', q), at + 0.6);
      sweep(tl, hls(q), at + 0.9);
    });
  }

  /* ---------- where: the globe zooms out a level per click, city to continent ---------- */
  {
    const levels = [['city', 'City', WH.city], ['province', str(WH.regionLabel) || 'Province or state', WH.region], ['country', 'Country', WH.country], ['continent', 'Continent', WH.continent]].filter(r => str(r[2]));
    const fmt = (v, pos, neg) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`;
    const title = str(WH.title) || 'Where does this issue take place?';
    const p = addPage({ cls: 'p-where', theme: 'light', section: 'Major points of the article', label: smart(title.replace(/\s+/g, ' ')), html: `
      <div class="where-left pnl">
        <h2 class="title" data-title>${words(title)}</h2>
        <ol class="places">${levels.map(([, k, v]) => `<li><span class="lab">${escHTML(smart(k))}</span><span class="val">${text(v)}</span></li>`).join('')}</ol>
      </div>
      <div class="lens-bed pnl" data-z="-30"></div>
      ${place ? `<div class="pin"><svg width="900" height="900" aria-hidden="true">
          <line class="pin-line" style="stroke: var(--accent-l)" stroke-width="3"/>
          <circle class="pin-ring" r="34" fill="none" style="stroke: var(--accent-l)" stroke-width="4"/>
          <circle class="pin-dot" r="8" style="fill: var(--accent-l)"/></svg>
        <div class="pin-tag"><b>${text(WH.city) || text(WH.region) || text(WH.country)}</b><span>${[WH.region, WH.country].filter((v, i) => str(v) && !(i === 0 && !str(WH.city))).map(text).join(', ')}</span><small>${fmt(place[1], 'N', 'S')}, ${fmt(place[0], 'E', 'W')}</small></div></div>` : ''}` });
    if (SPACE) { p.el.prepend(cv); gsap.set(cv, { z: 2 }); whereGlobe = () => p.globe(Math.max(0, levels.length - 1)); }
    p.verity = () => null;
    // how far to zoom for each level so its shape fills the round window
    const LENS = 420, sh = place ? Globe.shapes(place[0], place[1], WH.region, WH.country) : {};
    Object.assign(G, { province: sh.province, country: sh.country, continent: sh.continent });
    const fitR = f => f ? clamp(LENS * 0.86 / Math.sin(clamp(Globe.reach(f, place[0], place[1]), 1.5, 80) * RAD), 420, 2600) : null;
    const rProv = fitR(sh.province) || 1500, rCountry = Math.min(rProv, fitR(sh.country) || 640), rCont = Math.min(rCountry, fitR(sh.continent) || 420);
    const view = {
      city: { r: clamp(rProv * 1.7, 1100, 2600) },
      province: { r: rProv, provP: 1 },
      country: { r: rCountry, provP: 1, countryP: 1 },
      continent: { r: rCont, provP: 1, countryP: 1, contP: 1 },
    };
    const target = place ? { lon: place[0], lat: place[1] } : { lon: 0, lat: 20 };
    p.globe = s => {
      const lv = levels[Math.min(s, levels.length - 1)];
      const v = place ? (lv ? view[lv[0]] : view.continent) : { r: 400 };
      return { ...BASE, cx: 1350, cy: 590, clipR: LENS, lensA: 1, ...target, ...v, spinning: false };
    };
    const rows = $$('.places li', p.el);
    p.steps = (levels.length ? levels : [null]).map((lv, i) => (tl, at) => {
      if (i > 0) tl.to($('.val', rows[i - 1]), { color: V('--graphite'), duration: 0.5 }, at);
      if (rows[i]) wipe(tl, rows[i], at + (i ? 0.25 : 0.55));
      if (i === 0 && place) {
        const pin = $('.pin', p.el), tag = $('.pin-tag', pin), ring = $('.pin-ring', pin), dot = $('.pin-dot', pin), line = $('.pin-line', pin);
        const x = 450, y = 440;   // the globe centre, inside the 900 x 900 pin layer
        gsap.set([ring, dot], { attr: { cx: x, cy: y } });
        const tw = tag.offsetWidth, th = tag.offsetHeight, gap = 58;
        const right = x + 34 + gap + tw <= 892;
        const lx = right ? x + 34 + gap : x - 34 - gap - tw;
        gsap.set(tag, { left: lx, top: y - th / 2 });
        gsap.set(line, { attr: { x1: right ? x + 34 : x - 34, x2: right ? lx : lx + tw, y1: y, y2: y } });
        const len = 2 * Math.PI * 34;
        ring.style.strokeDasharray = `${len} ${len}`;
        tl.fromTo(dot, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.45, ease: 'back.out(2)' }, at + 1.0)
          .fromTo(ring, { strokeDashoffset: len, rotation: -90, transformOrigin: '50% 50%' }, { strokeDashoffset: 0, duration: 0.6, ease: 'power2.inOut' }, at + 1.1)
          .fromTo(line, { attr: { x2: right ? x + 34 : lx + tw } }, { attr: { x2: right ? lx : lx + tw }, duration: 0.35, ease: 'power2.out' }, at + 1.5);
        wipe(tl, tag, at + 1.7, { clearProps: '' });
      }
      tl.set({}, {}, at + 1.3);    // each level lasts at least as long as the globe's zoom
    });
    p.stepLabel = s => levels[s] ? `${levels[s][1]}: ${smart(str(levels[s][2]))}` : '';
  }

  /* ---------- when: the timeline grows one event per click ---------- */
  {
    const T = C.when || {};
    const nodes = [];
    if (T.began && (str(T.began.date) || str(T.began.text))) nodes.push({ kind: 'began', tag: 'Began', date: T.began.date, text: T.began.text, image: T.began.image });
    (T.events || []).filter(e => e && (str(e.date) || str(e.text))).slice(0, 3).forEach(e => nodes.push({ kind: 'event', tag: '', date: e.date, text: e.text, image: e.image }));
    if (T.today !== false) nodes.push({ kind: 'now', tag: 'Today', date: str(T.todayDate) || longDate(dateP || todayP), text: str(T.todayText), image: T.todayImage });
    if (T.resolved && (str(T.resolved.date) || str(T.resolved.text))) nodes.push({ kind: 'end', tag: 'Might be resolved', date: T.resolved.date, text: T.resolved.text, image: T.resolved.image });
    const n = nodes.length, step = 1704 / Math.max(n, 2), L = step - 40, Y = 636;
    const xs = nodes.map((_, i) => M + 11 + i * step);
    const title = str(T.title) || 'When did this issue begin? When might it be resolved?';
    const p = addPage({ cls: 'p-when', theme: 'light', section: 'Major points of the article', label: smart(title.replace(/\s+/g, ' ')), html: `
      <h2 class="title pnl" data-title>${words(title)}</h2>
      <div class="tl-bed pnl" data-z="-30"></div>
      ${nodes.map((d, i) => `
        ${i ? `<div class="tl-seg${d.kind === 'end' ? ' future' : ''}" style="left:${xs[i - 1]}px; top:${Y - 2}px; width:${xs[i] - xs[i - 1]}px"></div>` : ''}
        ${d.kind === 'now' ? `<i class="tl-pulse" style="left:${xs[i] - 22}px; top:${Y - 22}px"></i>` : ''}
        ${str(d.image) ? `<figure class="tl-card ${d.kind}" style="left:${xs[i] - 11}px; width:${L}px"><img alt="" src="${escHTML(str(d.image))}"></figure>` : ''}
        <i class="tl-node ${d.kind}" style="left:${xs[i]}px; top:${Y}px"></i>
        <div class="tl-top tl-lab ${d.kind}" style="left:${xs[i] - 11}px; width:${L}px; bottom:${H - Y + 34}px">${d.tag ? `<span class="lab">${d.tag}</span>` : ''}<span class="tl-date">${text(d.date)}</span></div>
        <p class="tl-text" style="left:${xs[i] - 11}px; width:${L}px; top:${Y + 36}px; height:${H - 96 - Y - 36}px">${words(d.text)}</p>`).join('')}` });
    p.fit = () => {
      $$('.tl-date', p.el).forEach(d => fitBy(v => { d.style.fontSize = Math.floor(v) + 'px'; }, () => d.scrollWidth <= d.clientWidth + 1, 22, 38));
      $$('.tl-text', p.el).forEach(d => fitFont(d, 20, 28));
    };
    const segs = $$('.tl-seg', p.el), dots = $$('.tl-node', p.el), tops = $$('.tl-top', p.el), texts = $$('.tl-text', p.el);
    const cards = nodes.map((d, i) => $$('.tl-node', p.el)[i].previousElementSibling).map(e => e && e.classList.contains('tl-card') ? e : null);
    cards.forEach(c => c && $('img', c).addEventListener('error', () => { c.style.display = 'none'; }));
    p.steps = nodes.map((d, i) => (tl, at) => {
      let t = at + (i ? 0 : 0.45);
      if (i) {
        const fut = d.kind === 'end';
        if (fut) tl.fromTo(segs[i - 1], { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.6, ease: 'power1.inOut' }, t);
        else tl.fromTo(segs[i - 1], { scaleX: 0 }, { scaleX: 1, duration: 0.6, ease: 'power2.inOut' }, t);
        t += 0.45;
      }
      tl.fromTo(dots[i], { scale: 0 }, { scale: 1, duration: 0.45, ease: 'back.out(2.4)' }, t);
      if (cards[i]) {
        // the card stands up out of its event like a pop-up page, the picture settling inside it
        tl.fromTo(cards[i], { rotationX: 86, ...persp(900), transformOrigin: '50% 100%' }, { rotationX: 0, duration: 1.05, ease: 'back.out(1.5)' }, t + 0.1)
          .fromTo(cards[i], { opacity: 0 }, { opacity: 1, duration: 0.3 }, t + 0.1)
          .fromTo($('img', cards[i]), { scale: 1.35 }, { scale: 1, duration: 1.4, ease: 'power3.out' }, t + 0.1);
      }
      if (d.kind === 'now') tl.fromTo($('.tl-pulse', p.el), { opacity: 0 }, { opacity: 1, duration: 0.3 }, t + 0.2);
      wipe(tl, tops[i], t + 0.05);
      fade(tl, texts[i], t + 0.2);
      sweep(tl, hls(texts[i]), t + 0.7);
    });
    p.stepLabel = s => nodes[s] ? `${nodes[s].tag || 'Then'}: ${smart(str(nodes[s].date))}` : '';
    // she glows in the empty photo spot above "Today", from the click that brings Today in
    const nowAt = nodes.findIndex(d => d.kind === 'now' && !str(d.image));
    p.verity = s => (nowAt >= 0 && s >= nowAt ? { x: xs[nowAt] - 11 + L / 2, y: 404, r: 75, glow: 1 } : null);
  }

  /* ---------- discussion questions: one card per question. The cards are dealt face down into a fan;
     each click lifts the next one out, turns it over on its way to the middle of the table, and its photo spreads into the backdrop ---------- */
  const qItems = (C.questions || []).map(q => (q && typeof q === 'object' ? { text: str(q.text), image: str(q.image) } : { text: str(q), image: '' })).filter(q => q.text);
  const questions = qItems.map(q => q.text);
  if (questions.length) {
    const n = questions.length;
    const p = addPage({ cls: 'p-disc', theme: 'dark', label: 'Discussion questions', html: `
      <div class="q-table">
        ${qItems.map(() => '<i class="q-shadow"></i>').join('')}
        ${qItems.map((q, i) => `
        <div class="q-card${q.image ? '' : ' noimg'}">
          <div class="q-face q-front">
            ${q.image ? `<figure class="q-img"><img alt="" src="${escHTML(q.image)}"></figure>` : ''}
            <div class="q-body"><span class="q-lab">Question ${i + 1}${n > 1 ? ` of ${n}` : ''}</span><p class="q-t">${words(q.text)}</p></div>
            <i class="q-dim"></i><i class="q-light"></i><i class="q-gloss"></i>
          </div>
          <div class="q-face q-back" aria-hidden="true">
            <span class="q-idx">${i + 1}</span><span class="q-idx r">${i + 1}</span>
            <span class="q-bl">Question</span><span class="q-big">${i + 1}</span>
            <i class="q-light"></i><i class="q-gloss"></i>
          </div>
        </div>`).join('')}
      </div>
      <h2 class="title pnl" data-title>${words('Discussion questions')}</h2>` });

    // where a card can be. x, y: its centre on the slide; z: how far it's lifted off the table; ry 180 = face down
    const CW = 740, CH = 860;
    const HERO = { x: 1380, y: 590, rz: 0, rx: 0, s: 1 };
    const gap = n > 1 ? Math.min(190, 380 / (n - 1)) : 0, tilt = n > 1 ? Math.min(8, 16 / (n - 1)) : 0;
    const hand = i => { const k = i - (n - 1) / 2; return { x: 514 + k * gap, y: 724 + Math.abs(k) * 14, z: i * 2, rz: k * tilt, rx: 0, s: 0.46 }; };
    const dealt = i => ({ x: 860 + i * 50, y: 1560, z: i * 2, rz: 38 + i * 9, rx: 0, ry: 180, s: 0.46 });
    const across = Math.min(560, 1700 / n), rowS = Math.min(0.66, (across - 40) / CW);
    const row = i => ({ x: 960 + (i - (n - 1) / 2) * across, y: 654, rz: 0, rx: 0, ry: 0, s: rowS });

    const cards = $$('.q-card', p.el), shadows = $$('.q-shadow', p.el);
    const lights = cards.map(c => $$('.q-light', c)), glosses = cards.map(c => $$('.q-gloss', c));
    const S = cards.map((_, i) => dealt(i));
    const fitCard = c => fitFont($('.q-t', c), 30, c.classList.contains('noimg') ? 84 : 60);
    p.fit = () => cards.forEach(fitCard);
    cards.forEach(c => { const im = $('.q-img img', c); if (im) im.addEventListener('error', () => { c.classList.add('noimg'); fitCard(c); }); });

    // the cards live in plain objects that the timeline tweens; render() draws them, their shadows on the table and the light on each face.
    // served from a web server they're drawn with three.js (engine/cards3d.js); opened from disk, with CSS 3D
    const RING = { r: 0 };   // the ring of halftone dots that runs out from a card as it lands (three.js only)
    let table = null;
    function render() {
      if (table) return table.render(S, RING.r);
      S.forEach((s, i) => {
        cards[i].style.transform = `translate3d(${(s.x - CW / 2).toFixed(2)}px, ${(s.y - CH / 2).toFixed(2)}px, ${s.z.toFixed(2)}px) rotateZ(${s.rz.toFixed(3)}deg) rotateY(${s.ry.toFixed(3)}deg) rotateX(${s.rx.toFixed(3)}deg) scale(${s.s.toFixed(4)})`;
        let a = ((s.ry % 360) + 360) % 360;
        if (a > 180) a = 360 - a;                                    // 0 face up … 180 face down
        const lift = clamp(s.z / 260, 0, 1.4), edge = Math.max(0.04, Math.abs(Math.cos(a * RAD)));
        shadows[i].style.transform = `translate3d(${(s.x - CW / 2 + 12 + 46 * lift).toFixed(2)}px, ${(s.y - CH / 2 + 22 + 84 * lift).toFixed(2)}px, -2px) rotateZ(${s.rz.toFixed(3)}deg) scale(${(s.s * edge * (1 + 0.05 * lift)).toFixed(4)}, ${(s.s * (1 + 0.05 * lift)).toFixed(4)})`;
        shadows[i].style.opacity = (0.62 - 0.3 * Math.min(1, lift)).toFixed(3);
        // each face darkens as it turns away, and a glint runs across it mid-turn
        [Math.min(a, 90) / 90, Math.min(180 - a, 90) / 90].forEach((k, f) => {
          if (!lights[i][f]) return;
          lights[i][f].style.opacity = (k * 0.5).toFixed(3);
          glosses[i][f].style.opacity = (Math.sin(k * Math.PI) * 0.85).toFixed(3);
          glosses[i][f].style.transform = `translateX(${((f ? k : 1 - k) * 260).toFixed(1)}%)`;
        });
      });
    }
    p.tl.eventCallback('onUpdate', render);
    p.built = render;
    p.verity = () => null;
    p.load = () => (window.CardTable && window.THREE && location.protocol !== 'file:' && !SPACE
      ? CardTable.create({ page: p.el, cards, CW, CH, persp: 2400, hero: HERO, hole: (r => [r.offsetLeft - 20, 0, r.offsetLeft + r.offsetWidth + 20, r.offsetTop + r.offsetHeight + 20])($('.title', p.el)) }).then(t => {
        if (!t) return;
        table = t;
        table.resize(scale);
        p.el.classList.add('gl');
        render();
      }).catch(e => { console.warn('3D cards unavailable, using CSS cards', e); })
      : null);
    p.resize = k => { if (table) { table.resize(k); render(); } };

    // the text on a card writes itself in once the card is face up
    function writeIn(tl, c, t) {
      const im = $('.q-img img', c);
      if (im) tl.fromTo(im, { scale: 1.35 }, { scale: 1, duration: 1.5, ease: 'power3.out' }, t - 0.5);
      wipe(tl, $('.q-lab', c), t);
      const ws = $$('.q-t .w', c);
      rise(tl, ws, t + 0.05, { stagger: 0.025 });
      sweep(tl, hls(c), t + 0.55 + ws.length * 0.025);
    }
    // card i lifts out of the fan, turns over on the way and lands face up in the middle; returns when it lands
    function present(tl, i, t) {
      const s = S[i], h = hand(i);
      tl.to(s, { y: h.y - 150, duration: 0.35, ease: 'power2.out' }, t).to(s, { y: HERO.y, duration: 0.95, ease: 'power2.inOut' }, t + 0.35)
        .to(s, { s: 0.56, duration: 0.35, ease: 'power2.out' }, t).to(s, { s: HERO.s, duration: 0.95, ease: 'power3.inOut' }, t + 0.35)
        .to(s, { z: 260, duration: 0.5, ease: 'power2.out' }, t).to(s, { z: 0, duration: 0.5, ease: 'power2.in' }, t + 0.85)
        .to(s, { rz: 0, duration: 0.4, ease: 'power2.out' }, t).to(s, { rz: -5, duration: 0.45, ease: 'sine.inOut' }, t + 0.45).to(s, { rz: 0, duration: 0.55, ease: 'back.out(2.2)' }, t + 0.9)
        .to(s, { x: HERO.x, duration: 1.05, ease: 'power3.inOut' }, t + 0.2)
        .to(s, { ry: 0, duration: 0.9, ease: 'power2.inOut' }, t + 0.3)
        .to(s, { rx: -14, duration: 0.45, ease: 'sine.out' }, t + 0.3).to(s, { rx: 0, duration: 0.55, ease: 'sine.inOut' }, t + 0.75);
      writeIn(tl, cards[i], t + 1.05);
      return t + 1.35;
    }
    // the card that was just discussed goes back to its place in the fan, face up and dimmed
    function retire(tl, i, t) {
      const s = S[i], h = hand(i);
      tl.to(s, { x: h.x, y: h.y, rz: h.rz, s: h.s, duration: 0.95, ease: 'power3.inOut' }, t)
        .to(s, { z: 120, duration: 0.45, ease: 'power2.out' }, t).to(s, { z: h.z, duration: 0.5, ease: 'power2.in' }, t + 0.45)
        .to($('.q-dim', cards[i]), { opacity: 1, duration: 0.6, ease: 'power1.inOut' }, t + 0.35);
    }

    const landAt = [];
    p.steps = BUILDS ? questions.map((q, i) => (tl, at) => {
      let t;
      if (i === 0) {
        // deal: the cards spin in from below and fan out face down
        S.forEach((s, j) => tl.fromTo(s, dealt(j), { ...hand(j), ry: 180, duration: 0.8, ease: 'power3.out' }, at + 0.15 + j * 0.12));
        t = at + 0.15 + (n - 1) * 0.12 + 0.6;
      } else {
        retire(tl, i - 1, at);
        t = at + 0.15;
      }
      landAt[i] = present(tl, i, t) - at;
      // the dots ride just ahead of the backdrop's iris, which opens with the same timing
      tl.fromTo(RING, { r: 0 }, { r: 1520, duration: i ? 1.1 : 1.265, ease: 'power3.inOut' }, at + Math.max(0, landAt[i] - 0.3));
    }) : [(tl, at) => S.forEach((s, j) => {
      // builds off: all the cards are dealt face up in a row
      const t = at + 0.2 + j * 0.15, { x, y, rz, ry, s: k } = row(j);
      tl.fromTo(s, { x: s.x, y: s.y, rz: s.rz, ry: s.ry, s: s.s }, { x, y, rz, ry, s: k, duration: 1.1, ease: 'power3.inOut' }, t)
        .to(s, { z: 240, duration: 0.55, ease: 'power2.out' }, t).to(s, { z: 0, duration: 0.55, ease: 'power2.in' }, t + 0.55);
      writeIn(tl, cards[j], t + 0.95);
    })];

    // the backdrop is the card's own photo, tinted blue, opening out from behind the card just as it lands
    // (a card without a photo, or whose photo is missing, keeps the one before)
    const qPic = s => { for (let k = s; k >= 0; k--) if (qItems[k].image && !badImg.has(qItems[k].image)) return qItems[k].image; return ''; };
    p.photo = s => ph(qPic(s), BUILDS ? { duo: 1, reveal: 'iris', from: { x: HERO.x, y: HERO.y }, delay: Math.max(0, (landAt[s] || 0) - 0.3) }
      : { duo: 1, reveal: 'iris', from: { x: 960, y: 654 } });
    p.stepLabel = s => `Question ${s + 1}: ${smart(questions[s].replace(/\*/g, ''))}`;
  }

  /* ---------- why ---------- */
  if (str(C.why)) {
    const p = addPage({ cls: 'p-why', theme: 'light', label: 'Why did you choose this article?', html: `
      <div class="why-col pnl">
        <h2 class="title" data-title>${words('Why did you choose this article?')}</h2>
        <p class="why-text">${words(C.why)}</p>
        <p class="why-sign">${str(C.whySign) ? `<span class="raw">${text(C.whySign)}</span>` : str(C.name) ? `<span data-k="name">${text(C.name)}</span>` : ''}</p>
      </div>` });
    p.fit = () => fitK($('.why-col', p.el), 0.55);
    p.photo = () => ph(C.whyImage, { rect: { x: 1300, y: 140, w: 492, h: 844 } });
    // two of her wait just off the right edge, ready to roll in on the last slide
    p.verity = () => [{ x: 2556, y: 924, r: 75, glow: 1, off: true }, { x: 2555, y: 562, r: 153, glow: 1, off: true }];
    p.steps = [(tl, at) => {
      fade(tl, $('.why-text', p.el), at + 0.45, { y: 30, duration: 0.8 });
      sweep(tl, hls(p.el, '.why-text'), at + 1.15);
    }];
  }

  /* ---------- thank you + source ---------- */
  {
    const p = addPage({ cls: 'p-end', theme: 'dark', label: 'Thanks for listening', html: `
      <div class="end-bed pnl" data-z="-30"></div>
      <h2 class="end-title" data-title>${words('Thanks for listening')}</h2>
      ${str(C.name) ? `<p class="end-name"><span data-k="name">${text(C.name)}</span></p>` : ''}
      <div class="end-src"><div class="lab">Source</div><p>${citation()}</p></div>
      ${url && C.qr !== false ? `<div class="end-qr">${qrSVG(url)}<p>Scan to read<br>the article</p></div>` : ''}
      ${str(C.photoCredit) ? `<p class="end-credit">${text(C.photoCredit)}</p>` : ''}
      ${bubble(SAYS.end, { x: 975, y: 76, w: 342, h: 247, rot: 7.44, tip: [557, 312] })}` });
    p.globe = () => (AT || (C.photoTint === false && p.photo(0)) ? LOGO('dark') : BIG(1610, 420, 500));
    p.world = () => OVERLOOK;
    p.verity = () => [{ x: 1323, y: 544, r: 153, glow: 1 }, { x: 1700, y: 544, r: 153, glow: 1 }];
    p.photo = () => ph(C.endImage, { duo: 1, zoom: 1.06 });
    p.fit = () => { const s = $('.end-src', p.el); s.style.height = '232px'; fitFont($('p', s), 22, 34, s); };
    p.steps = [(tl, at) => { fade(tl, $$('.end-src, .end-qr, .end-credit', p.el), at + 0.55, { stagger: 0.2 }); popSay(tl, $('.say', p.el), at + 1.5); }];
  }

  /* ================================================================ the globe between states */

  let gTween = null, gSpin = null;
  const gPulse = gsap.fromTo(G, { pulse: 0 }, { pulse: 1, duration: 2.6, ease: 'power1.out', repeat: -1 });
  const drawGlobe = () => G.draw();
  function globeTo(s, d = 1.1, ease = 'power3.inOut') {
    if (gTween) gTween.kill();
    if (gSpin) { gSpin.kill(); gSpin = null; }
    G.lon += G.spin; G.spin = 0;
    const to = { ...s };
    delete to.spinning;
    if (to.lon == null) delete to.lon;
    else to.lon = G.lon + ((((to.lon - G.lon) % 360) + 540) % 360 - 180);   // the short way round
    const after = () => {
      gTween = null;
      if (s.spinning) gSpin = gsap.to(G, { spin: '-=360', duration: s.spinning === 'slow' ? 48 : 160, ease: 'none', repeat: -1, onUpdate: drawGlobe });
    };
    if (!d) { Object.assign(G, to); G.draw(); after(); return; }
    // when it changes size a lot, it shrinks before it travels (or travels before it grows), so it never sweeps across the text
    const size = { r: to.r, clipR: to.clipR };
    delete to.r; delete to.clipR;
    const shrink = size.r < G.r * 0.4, grow = size.r > G.r * 2.5;
    gTween = gsap.timeline({ onUpdate: drawGlobe, onComplete: after })
      .to(G, { ...to, duration: d, ease }, 0)
      .to(G, { ...size, duration: d, ease: shrink ? 'power3.out' : grow ? 'power3.in' : ease }, 0);
    running.push(gTween);
  }

  /* ================================================================ the 3D scene between states */

  let wTween = null;
  // dir: +1 / -1 when changing slides, so the camera flies on through the snow (forward or back)
  function worldTo(w, d = 1.3, dir = 0, ease = 'power2.inOut') {
    if (!AT) return;
    if (wTween) wTween.kill();
    wTween = gsap.timeline().to(AT.state, { ...w, duration: d, ease }, 0);
    if (dir) wTween.to(AT.state, { travel: `+=${1700 * dir}`, wind: `+=${260 * dir}`, duration: d * 1.15, ease: 'power2.inOut' }, 0);
    running.push(wTween);
  }
  if (AT) gsap.ticker.add(() => AT.render(gsap.globalTimeline.time()));

  /* ================================================================ the photo frame between states */

  const PH = { on: false, src: null, rect: null, layers: [] };
  const camOf = s => ({ scale: s.zoom || 1, xPercent: s.x || 0, yPercent: s.y || 0 });
  const sameRect = (a, b) => a && b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h;
  // radius that covers the whole rectangle from point p
  const cover = (r, p) => Math.ceil(Math.max(Math.hypot(p.x, p.y), Math.hypot(r.w - p.x, p.y), Math.hypot(p.x, r.h - p.y), Math.hypot(r.w - p.x, r.h - p.y))) + 4;
  function addLayer(src) {
    const el = document.createElement('div');
    el.className = 'ph-layer';
    el.innerHTML = `<div class="ph-cam"><img alt="" src="${escHTML(src)}"></div>`;
    frame.insertBefore(el, $('.ph-tint', frame));
    const img = $('img', el);
    // a slow drift and zoom, so a still photo never looks frozen
    const drift = gsap.fromTo(img, { scale: 1.03, xPercent: -1 }, { scale: 1.13, xPercent: 1, duration: 22, ease: 'sine.inOut', repeat: -1, yoyo: true });
    return { el, cam: el.firstChild, drift };
  }
  const dropLayer = l => { if (l.drift) l.drift.kill(); l.el.remove(); };
  // each way a new picture can replace the old one inside the same frame
  function reveal(tl, L, kind, rect, d, at) {
    if (kind === 'iris') {
      const c = at || { x: rect.w / 2, y: rect.h / 2 };
      tl.fromTo(L.el, { clipPath: `circle(0px at ${c.x}px ${c.y}px)` }, { clipPath: `circle(${cover(rect, c)}px at ${c.x}px ${c.y}px)`, duration: d, ease: 'power3.inOut' }, 0);
    } else if (kind === 'blinds') {
      L.el.classList.add('blinds');
      tl.fromTo(L.el, { '--b': '0%' }, { '--b': '100%', duration: d, ease: 'power2.inOut' }, 0);
    } else if (kind === 'wipe') {
      tl.fromTo(L.el, { clipPath: 'inset(0% 0% 0% 100%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: d, ease: 'power3.inOut' }, 0);
    } else if (kind === 'diag') {
      tl.fromTo(L.el, { clipPath: 'polygon(0% 0%, 0% 0%, -45% 100%, -45% 100%)' }, { clipPath: 'polygon(0% 0%, 145% 0%, 100% 100%, -45% 100%)', duration: d, ease: 'power3.inOut' }, 0);
    } else {
      tl.fromTo(L.el, { opacity: 0 }, { opacity: 1, duration: d * 0.75, ease: 'power1.inOut' }, d * 0.15);
    }
  }
  // move the frame to a new state. pts.from: where it opens from when it appears; pts.to: where it closes into.
  // spec.from overrides pts.from (and centres an iris); spec.delay holds the change back, unless pts.now (stepping back)
  function photoTo(spec, d = 1.1, pts = {}) {
    if (SPACE) return;
    const tl = gsap.timeline();
    if (spec && spec.delay && !pts.now) tl.delay(spec.delay + (pts.lead || 0));
    if (!spec) {
      if (!PH.on) return;
      const r = PH.rect, pt = pts.to ? { x: pts.to.x - r.x, y: pts.to.y - r.y } : { x: r.w / 2, y: r.h / 2 };
      const old = PH.layers;
      Object.assign(PH, { on: false, src: null, layers: [] });
      tl.fromTo(frame, { clipPath: `circle(${cover(r, pt)}px at ${pt.x}px ${pt.y}px)` }, { clipPath: `circle(0px at ${pt.x}px ${pt.y}px)`, duration: d * 0.8, ease: 'power3.in' })
        .to(old.map(l => l.cam), { scale: '+=0.25', duration: d * 0.8, ease: 'power3.in' }, 0)
        .call(() => { old.forEach(dropLayer); gsap.set(frame, { autoAlpha: 0, clearProps: 'clipPath' }); });
      running.push(tl);
      return;
    }
    const rect = spec.rect, duo = spec.duo ? 1 : 0;
    if (!PH.on) {
      Object.assign(PH, { on: true, src: spec.src, rect });
      gsap.set(frame, { autoAlpha: 1, left: rect.x, top: rect.y, width: rect.w, height: rect.h, '--duo': duo });
      const L = addLayer(spec.src);
      PH.layers = [L];
      const from = spec.from || pts.from;
      const pt = from ? { x: from.x - rect.x, y: from.y - rect.y } : { x: rect.w / 2, y: rect.h / 2 };
      tl.fromTo(frame, { clipPath: `circle(0px at ${pt.x}px ${pt.y}px)` }, { clipPath: `circle(${cover(rect, pt)}px at ${pt.x}px ${pt.y}px)`, duration: d * 1.15, ease: 'power3.inOut', clearProps: 'clipPath' }, 0)
        .fromTo(L.cam, { ...camOf(spec), scale: (spec.zoom || 1) * 1.3 }, { ...camOf(spec), duration: d * 1.6, ease: 'power3.out' }, 0);
      running.push(tl);
      return;
    }
    const moved = !sameRect(rect, PH.rect);
    PH.rect = rect;
    tl.to(frame, { left: rect.x, top: rect.y, width: rect.w, height: rect.h, '--duo': duo, duration: d, ease: 'power3.inOut' }, 0);
    if (spec.src !== PH.src) {
      PH.src = spec.src;
      const old = PH.layers, L = addLayer(spec.src);
      PH.layers = [...old, L];
      if (spec.reveal === 'turn' && !moved) {
        // the panel turns edge-on, and the new picture is on its other side
        gsap.set(L.el, { opacity: 0 });
        tl.to(frame, { rotationY: 90, transformPerspective: 1600, duration: d * 0.42, ease: 'power2.in' }, 0)
          .set(L.el, { opacity: 1 }, d * 0.42)
          .set(old.map(l => l.el), { opacity: 0 }, d * 0.42)
          .fromTo(frame, { rotationY: -90 }, { rotationY: 0, duration: d * 0.7, ease: 'back.out(1.4)', immediateRender: false }, d * 0.42);
      } else reveal(tl, L, moved ? 'fade' : spec.reveal || 'diag', rect, d, spec.from && { x: spec.from.x - rect.x, y: spec.from.y - rect.y });
      tl.fromTo(L.cam, { ...camOf(spec), scale: (spec.zoom || 1) * 1.2 }, { ...camOf(spec), duration: d * 1.3, ease: 'power3.out' }, 0)
        .to(old.map(l => l.cam), { scale: '+=0.1', duration: d, ease: 'power2.in' }, 0)
        .call(() => {
          old.forEach(dropLayer);
          PH.layers = PH.layers.filter(l => !old.includes(l));
          L.el.classList.remove('blinds');
          gsap.set(L.el, { clearProps: 'clipPath,opacity,--b' });
        });
    } else {
      // same picture: the camera moves to the new framing
      tl.to(PH.layers[PH.layers.length - 1].cam, { ...camOf(spec), duration: d * 1.3, ease: 'power3.inOut' }, 0);
    }
    running.push(tl);
  }
  const photoKey = s => JSON.stringify(s);

  /* ================================================================ space layout: stations, camera, floating cards */

  // each slide's place in the world: a gentle path across the solar park, every slide turned a little
  const stationOf = i => ({ x: i * 2700, y: Math.round(Math.sin(i * 1.9) * 150), z: -((i * 7) % 3) * 420, ry: i % 2 ? -7 : 7, rx: 5, rz: 0 });
  const pageTf = t => `translate3d(${t.x}px, ${t.y}px, ${t.z}px) rotateY(${t.ry}deg) rotateX(${t.rx}deg) rotateZ(${t.rz}deg)`;
  // the camera: on a station (x … rz), moved within the slide (vx, vy, vz), pulled back mid-flight (back, lift) and banking (roll)
  const CAM = { x: 0, y: 0, z: 0, ry: 0, rx: 0, rz: 0, vx: 0, vy: 0, vz: 0, back: 0, lift: 0, roll: 0 };
  const camFor = (p, s) => ({ ...p.station, ...p.view(s) });
  function applyCam() {
    world.style.transform = `rotateZ(${-CAM.roll}deg) translate3d(${-CAM.vx}px, ${-(CAM.vy - CAM.lift)}px, ${-(CAM.vz + CAM.back)}px) ` +
      `rotateZ(${-CAM.rz}deg) rotateX(${-CAM.rx}deg) rotateY(${-CAM.ry}deg) translate3d(${-CAM.x}px, ${-CAM.y}px, ${-CAM.z}px)`;
  }
  // the same camera for three.js (y up), so the desert and Verity line up with the cards
  const M3 = window.THREE ? { m: new THREE.Matrix4(), t: new THREE.Matrix4(), F: new THREE.Matrix4().makeScale(1, -1, 1), v: new THREE.Vector3() } : null;
  function camMatrix() {
    const { m, t, F } = M3;
    m.makeTranslation(CAM.x, CAM.y, CAM.z)
      .multiply(t.makeRotationY(CAM.ry * RAD)).multiply(t.makeRotationX(CAM.rx * RAD)).multiply(t.makeRotationZ(CAM.rz * RAD))
      .multiply(t.makeTranslation(CAM.vx, CAM.vy - CAM.lift, CAM.vz + CAM.back)).multiply(t.makeRotationZ(CAM.roll * RAD))
      .multiply(t.makeTranslation(0, 0, PERSP));
    return m.premultiply(F).multiply(F);
  }
  // a point on a slide (page px, depth z) in world coordinates
  function onStation(st, a) {
    const { t, v } = M3, m = new THREE.Matrix4().makeTranslation(st.x, st.y, st.z)
      .multiply(t.makeRotationY(st.ry * RAD)).multiply(t.makeRotationX(st.rx * RAD)).multiply(t.makeRotationZ(st.rz * RAD));
    return v.set(a.x - W / 2, a.y - H / 2, a.z || 0).applyMatrix4(m).clone();
  }
  const draw3D = () => { if (!ENV && !VER) return; const m = camMatrix(), t = gsap.globalTimeline.time(); if (ENV) ENV.render(t, m); if (VER) VER.render(t, m); };
  if (SPACE || VER) gsap.ticker.add(draw3D);

  // Verity flies to her spot on the slide (with a hop and a spin when the slide changes)
  let vTween = null;
  // p.verity(s): null (she's not on this build), one spot, or a spot for each Verity. A spot is page px plus her radius;
  // glow: 1 lights her up; off: she waits off the slide, so she simply appears there
  const spotsOf = (p, s) => [].concat(p.verity(s) || []);
  const placeOf = (p, a) => onStation(p.station, SPACE ? a : { ...a, z: Math.min(a.z || 0, 60) });   // flat slides: just in front of the page
  function verityTo(p, s, d = 1.6, dir = 0) {
    if (!VER) return;
    const spots = spotsOf(p, s);
    if (vTween) vTween.kill();
    vTween = gsap.timeline();
    VER.states.forEach((st, i) => {
      const a = spots[i];
      if (!a) {
        if (st.show > 0) vTween.to(st, { show: 0, glow: 0, duration: 0.45, ease: 'back.in(2)' }, 0);
        return;
      }
      const w = placeOf(p, a), to = { x: w.x, y: w.y, z: w.z, r: a.r || 100 };
      if (st.show < 0.05) {
        // she wasn't on the last slide: she pops in at her spot (or just waits off the edge)
        vTween.set(st, { ...to, lift: 0 }, 0).to(st, { show: 1, glow: a.glow || 0, duration: a.off ? 0.01 : 0.9, ease: 'back.out(2.2)' }, a.off ? 0 : d * 0.45);
        return;
      }
      vTween.to(st, { ...to, show: 1, glow: a.glow || 0, duration: d, ease: 'power2.inOut' }, 0);
      if (dir) vTween.to(st, { lift: -320, duration: d * 0.45, ease: 'power2.out' }, 0).to(st, { lift: 0, duration: d * 0.55, ease: 'bounce.out' }, d * 0.45)
        .to(st, { spin: `+=${360 * dir}`, duration: d, ease: 'power2.inOut' }, 0);
    });
    running.push(vTween);
  }

  // which slides are drawn: the current one and its neighbours (the others are too far away to see)
  const near = pi => pages.forEach((q, j) => q.el.classList.toggle('near', Math.abs(j - pi) <= 1));

  // every card of a slide (.pnl) flies in when its build comes up, and the titles rise
  function spaceIn(p, s, at) {
    const els = [...(s === 0 ? [$('.head', p.el)] : []), ...$$('.pnl', p.el).filter(e => (BUILDS ? +(e.dataset.step || 0) : 0) === s)];
    els.forEach((e, k) => {
      const z = +(e.dataset.z || 0);
      p.tl.fromTo(e, { z: z - 560, rotationX: 9, opacity: 0 }, { z, rotationX: 0, opacity: 1, duration: 1.1, ease: 'power3.out' }, at + k * 0.07);
    });
    if (s === 0 && !p.cover) rise(p.tl, $$('[data-title] .w', p.el), at + 0.2, { stagger: 0.03 });
  }

  // the photos a slide shows become cards floating in the world: small ones float in front of the slide,
  // full-screen backdrops become a big card behind it. A new photo flies in; the earlier ones settle back into a pile
  function spaceCards(p, n) {
    const list = [];
    for (let s = 0; s < n; s++) { const sp = p.photo(s); if (sp && !list.some(c => c.src === sp.src)) list.push({ src: sp.src, back: sp.rect === FULL, rect: sp.rect }); }
    list.forEach((c, k) => {
      const el = document.createElement('figure');
      el.className = `pic ${c.back ? 'pic-back' : 'pic-in'}`;
      el.innerHTML = `<div class="pic-float"><img alt="" src="${escHTML(c.src)}"></div>`;
      Object.assign(el.style, { left: c.rect.x + 'px', top: c.rect.y + 'px', width: c.rect.w + 'px', height: c.rect.h + 'px' });
      $('img', el).addEventListener('error', () => { el.style.display = 'none'; });
      p.el.appendChild(el);
      c.el = el;
      c.img = $('img', el);
      c.rest = c.back ? { z: -1150, x: 260, y: -40, rotationY: -12, rotation: 0 } : { z: 110, x: 0, y: 0, rotationY: k % 2 ? 6 : -6, rotation: k % 2 ? 2.5 : -2.5 };
      gsap.set(el, { ...c.rest, opacity: 0 });
      bob($('.pic-float', el), k);
    });
    p.cards = list;
  }
  function spaceCardsStep(p, s, at) {
    const list = p.cards, sp = p.photo(s);
    if (!list || !list.length || !sp) return;
    const idx = src => list.findIndex(c => c.src === src);
    const cur = idx(sp.src), was = s ? (p.photo(s - 1) ? idx(p.photo(s - 1).src) : -1) : -1;
    const t = at + (sp.delay || 0.2);
    if (cur !== was) {
      const c = list[cur];
      p.tl.fromTo(c.el, { ...c.rest, z: c.rest.z - 950, rotationY: c.rest.rotationY + 38, opacity: 0 }, { ...c.rest, opacity: 1, duration: 1.25, ease: 'power3.out', immediateRender: false }, t);
      // the pile: the photos shown before this one, newest first
      const pile = [];
      for (let q = s - 1; q >= 0; q--) { const o = p.photo(q); const j = o ? idx(o.src) : -1; if (j >= 0 && j !== cur && !pile.includes(j)) pile.push(j); }
      pile.forEach((j, k) => {
        const o = list[j], n = k + 1;
        p.tl.to(o.el, { z: o.rest.z - 150 * n, x: o.rest.x - 54 * n, y: o.rest.y - 34 * n, rotation: o.rest.rotation - 4 * n, opacity: n <= 2 ? 1 - 0.28 * n : 0, duration: 0.9, ease: 'power2.inOut' }, t);
      });
    }
    // the same photo, framed differently: it pans inside its card
    p.tl.to(list[cur].img, { scale: sp.zoom || 1, xPercent: sp.x || 0, yPercent: sp.y || 0, duration: 1.3, ease: 'power3.inOut' }, t);
  }

  /* ================================================================ moving between builds and slides */

  const flat = [];
  const live = document.getElementById('live');
  const blackout = document.getElementById('blackout');
  const help = document.getElementById('help');
  let cur = -1, running = [];

  // finish whatever is still moving, so a fast clicker never leaves things half-way
  function finish() {
    for (let guard = 0; guard < 6 && running.length; guard++) {
      const list = running;
      running = [];
      list.forEach(t => t.progress(1));
    }
  }

  const sRect = () => stage.getBoundingClientRect();
  function rectOf(el, s) { const r = el.getBoundingClientRect(); return { x: (r.left - s.left) / scale, y: (r.top - s.top) / scale, w: r.width / scale, h: r.height / scale }; }
  const shown = el => el && el.offsetParent !== null && el.getClientRects().length > 0;

  // a lookalike of a piece of text, placed in the overlay so it can fly between slides
  function textClone(el, r) {
    const cs = getComputedStyle(el);
    const c = document.createElement('div');
    const banded = el.classList.contains('hl') && parseFloat(el.style.getPropertyValue('--p')) > 50;
    c.textContent = el.textContent;
    Object.assign(c.style, {
      position: 'absolute', left: r.x + 'px', top: r.y + 'px', width: r.w + 2 + 'px', height: r.h + 'px', margin: '0',
      font: cs.font, letterSpacing: cs.letterSpacing, fontVariationSettings: cs.fontVariationSettings, fontFeatureSettings: cs.fontFeatureSettings,
      fontVariantNumeric: cs.fontVariantNumeric, color: banded ? V('--ink') : cs.color, padding: cs.padding,
      whiteSpace: el.classList.contains('w') ? 'nowrap' : 'normal', transformOrigin: '0 0',
      backgroundImage: banded ? cs.backgroundImage : 'none', backgroundSize: cs.backgroundSize, backgroundPosition: cs.backgroundPosition, backgroundRepeat: 'no-repeat',
    });
    fx.appendChild(c);
    return c;
  }
  const looksSame = (a, b) => {
    const x = getComputedStyle(a), y = getComputedStyle(b);
    return a.textContent === b.textContent && x.fontFamily === y.fontFamily && x.fontWeight === y.fontWeight && x.fontStyle === y.fontStyle &&
      a.classList.contains('hl') === b.classList.contains('hl');
  };

  function pairsFor(a, b) {
    const pairs = [], spare = { a: [], b: [] };
    const keyed = root => new Map($$('[data-k]', root).filter(shown).map(e => [e.dataset.k, e]));
    const ka = keyed(a), kb = keyed(b);
    for (const [k, eb] of kb) {
      const ea = ka.get(k);
      if (!ea) continue;
      const mode = k === 'box' ? 'box' : (k === 'section' || k === 'num') && ea.textContent !== eb.textContent ? 'swap' : 'text';
      pairs.push({ a: ea, b: eb, mode });
    }
    // title words: the same word on both slides travels to its new spot
    const wa = $$('[data-title] .w', a), wb = $$('[data-title] .w', b), used = new Set();
    for (const eb of wb) {
      const key = wordKey(eb);
      const ea = key && wa.find(x => !used.has(x) && wordKey(x) === key);
      if (ea) { used.add(ea); pairs.push({ a: ea, b: eb, mode: 'text', word: true }); } else spare.b.push(eb);
    }
    spare.a = wa.filter(x => !used.has(x));
    return { pairs, spare };
  }

  function morph(from, to, s, dir) {
    from.leave();
    from.tl.pause();
    const a = from.el, b = to.el;
    to.step = s;
    b.classList.add('on');
    b.removeAttribute('aria-hidden');
    const playIn = dir > 0 && s === 0;
    to.tl.pause();
    to.tl.time(playIn ? 0 : to.ends[s]);
    gsap.set(b, { opacity: 0 });
    let pairs = [], spare = { a: [], b: [] };
    const hidden = [];
    const gFrom = { x: G.cx, y: G.cy }, gNext = to.globe(s);
    const D = 1.0, E = 'power3.inOut';
    const S = sRect();
    ({ pairs, spare } = pairsFor(a, b));
    const T = gsap.timeline({ onComplete: done });
    pairs.forEach((pr, i) => {
      const ra = rectOf(pr.a, S), rb = rectOf(pr.b, S);
      const delay = pr.word ? Math.min(0.18, i * 0.012) : 0;
      if (pr.mode === 'swap') {
        T.to(pr.a, { y: -18 * dir, duration: 0.4, ease: 'power2.in' }, 0)
          .fromTo(pr.b, { y: 18 * dir }, { y: 0, duration: 0.6, ease: 'power3.out' }, 0.3);
        return;
      }
      pr.a.style.visibility = 'hidden';
      pr.b.style.visibility = 'hidden';
      hidden.push(pr.a, pr.b);
      if (pr.mode === 'box') {
        const ca = pr.a.cloneNode(true);
        ca.removeAttribute('data-k');
        Object.assign(ca.style, { position: 'absolute', visibility: 'visible', left: ra.x + 'px', top: ra.y + 'px', width: ra.w + 'px', height: ra.h + 'px', transform: 'none', opacity: 1, margin: 0 });
        const csA = getComputedStyle(pr.a), csB = getComputedStyle(pr.b);
        const shell = document.createElement('div');
        Object.assign(shell.style, { position: 'absolute', left: ra.x + 'px', top: ra.y + 'px', width: ra.w + 'px', height: ra.h + 'px', background: csA.backgroundColor, boxShadow: csA.boxShadow });
        fx.append(shell, ca);
        const geo = { left: rb.x, top: rb.y, width: rb.w, height: rb.h, duration: D, ease: E };
        T.to([shell, ca], geo, 0)
          .to(shell, { backgroundColor: csB.backgroundColor, boxShadow: csB.boxShadow === 'none' ? '0 0 0 rgba(0,0,0,0)' : csB.boxShadow, duration: D * 0.7, ease: 'power1.inOut' }, D * 0.2)
          .to(ca, { opacity: 0, duration: D * 0.45, ease: 'power1.in' }, D * 0.15)
          .set(pr.b, { visibility: 'visible' }, D * 0.7)
          .to(shell, { opacity: 0, duration: D * 0.3 }, D * 0.7);
        return;
      }
      const fa = parseFloat(getComputedStyle(pr.a).fontSize) || 1, fb = parseFloat(getComputedStyle(pr.b).fontSize) || 1;
      const cb = textClone(pr.b, rb);
      T.fromTo(cb, { x: ra.x - rb.x, y: ra.y - rb.y, scale: fa / fb }, { x: 0, y: 0, scale: 1, duration: D, ease: E }, delay);
      if (looksSame(pr.a, pr.b)) {
        T.fromTo(cb, { color: getComputedStyle(pr.a).color }, { color: getComputedStyle(pr.b).color, duration: D, ease: E }, delay);
      } else {
        const ca = textClone(pr.a, ra);
        T.to(ca, { x: rb.x - ra.x, y: rb.y - ra.y, scale: fb / fa, duration: D, ease: E }, delay)
          .to(ca, { opacity: 0, duration: D * 0.45, ease: 'power1.in' }, delay + D * 0.15)
          .fromTo(cb, { opacity: 0 }, { opacity: 1, duration: D * 0.5, ease: 'power1.out' }, delay + D * 0.3);
      }
    });
    // words only on the old slide drop away; words only on the new one rise in
    if (spare.a.length) T.to(spare.a, { yPercent: -45, opacity: 0, duration: 0.4, ease: 'power2.in', stagger: 0.012 }, 0);
    if (spare.b.length) T.fromTo(spare.b, { yPercent: 60, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.7, ease: 'power3.out', stagger: 0.03 }, 0.32);
    T.fromTo(a, { opacity: 1, x: 0 }, { opacity: 0, x: -36 * dir, duration: 0.42, ease: 'power1.in' }, 0)
      .fromTo(b, { opacity: 0, x: 36 * dir }, { opacity: 1, x: 0, duration: 0.6, ease: 'power2.out' }, 0.26)
      .to([bg, document.body], { backgroundColor: bgOf(to), duration: D, ease: 'power2.inOut' }, 0);
    if (playIn) T.call(() => { running.push(to.tl.tweenFromTo(0, to.ends[0])); }, null, 0.3);
    running.push(T);
    // pictures open out of the globe and close back into it
    photoTo(to.photo(s), 1.1, { from: gFrom, to: { x: gNext.cx, y: gNext.cy }, lead: 0.3, now: !playIn });
    globeTo(gNext, 1.15);
    verityTo(to, s, 1.3, dir);
    worldTo(to.world(s), 1.4, dir);

    function done() {
      fx.innerHTML = '';
      hidden.forEach(e => { e.style.visibility = ''; });
      a.classList.remove('on');
      a.setAttribute('aria-hidden', 'true');
      gsap.set([a, b], { clearProps: 'opacity,transform' });
      const moved = [...spare.a, ...spare.b, ...pairs.filter(p => p.mode === 'swap').flatMap(p => [p.a, p.b])];
      if (moved.length) gsap.set(moved, { clearProps: 'transform,opacity' });
      to.enter();
      to.onStep(s);
    }
    function bgOf(p) { return BG[p.theme]; }
  }

  // space layout: the camera flies from one slide to the next, pulling back on the way so you see the cards in space
  function fly(from, to, s, dir) {
    from.leave();
    from.tl.pause();
    const b = to.el;
    to.step = s;
    b.classList.add('on');
    b.removeAttribute('aria-hidden');
    const ti = pages.indexOf(to);
    pages.forEach((q, j) => q.el.classList.toggle('near', Math.abs(j - ti) <= 1 || q === from));
    const playIn = dir > 0 && s === 0;
    to.tl.pause();
    to.tl.time(playIn ? 0 : to.ends[s]);
    const target = camFor(to, s);
    const dist = Math.hypot(target.x - CAM.x, target.y - CAM.y, target.z - CAM.z);
    const D = clamp(1.55 + dist / 9000, 1.8, 3.2), back = clamp(700 + dist * 0.42, 1000, 6000);
    const T = gsap.timeline({ onUpdate: applyCam, onComplete: done });
    T.to(CAM, { ...target, duration: D, ease: 'power2.inOut' }, 0)
      .to(CAM, { back, lift: back * 0.18, duration: D * 0.48, ease: 'sine.inOut' }, 0)
      .to(CAM, { back: 0, lift: 0, duration: D * 0.52, ease: 'sine.inOut' }, D * 0.48)
      .to(CAM, { roll: 2.2 * dir, duration: D * 0.5, ease: 'sine.inOut' }, 0)
      .to(CAM, { roll: 0, duration: D * 0.5, ease: 'sine.inOut' }, D * 0.5);
    if (playIn) T.call(() => { running.push(to.tl.tweenFromTo(0, to.ends[0])); }, null, D * 0.5);
    running.push(T);
    globeTo(to.globe(s), D);
    verityTo(to, s, D, dir);
    function done() {
      if (from !== to) { from.el.classList.remove('on'); from.el.setAttribute('aria-hidden', 'true'); }
      near(ti);
      to.enter();
      to.onStep(s);
    }
  }

  function stepTo(p, s, prev) {
    const t0 = p.tl.time(), t1 = p.ends[s];
    p.step = s;
    const back = s < prev;
    running.push(p.tl.tweenFromTo(t0, t1, back ? { duration: Math.max(0.3, (t0 - t1) * 0.5), ease: 'power1.inOut', onComplete: () => p.onStep(s) } : { onComplete: () => p.onStep(s) }));
    const gs = p.globe(s), gp = p.globe(prev);
    if (JSON.stringify(gs) !== JSON.stringify(gp)) globeTo(gs, back ? 0.9 : 1.35);
    const ps = p.photo(s);
    if (photoKey(ps) !== photoKey(p.photo(prev))) photoTo(ps, back ? 0.8 : 1.1, { from: { x: G.cx, y: G.cy }, now: back });
    const ws = p.world(s);
    if (JSON.stringify(ws) !== JSON.stringify(p.world(prev))) worldTo(ws, 1.2);
    if (SPACE) {
      const v = p.view(s);
      if (JSON.stringify(v) !== JSON.stringify(p.view(prev))) running.push(gsap.to(CAM, { ...camFor(p, s), duration: back ? 1.1 : 1.6, ease: 'power3.inOut', onUpdate: applyCam }));
    }
    if (JSON.stringify(p.verity(s)) !== JSON.stringify(p.verity(prev))) verityTo(p, s, 1.4);
  }

  function intro(to) {
    const p = to.p, s = to.s;
    p.step = s;
    p.el.classList.add('on');
    p.el.removeAttribute('aria-hidden');
    const color = BG[p.theme];
    bg.style.backgroundColor = document.body.style.backgroundColor = color;
    const g = p.globe(s);
    Object.assign(G, g, p.cover ? { r: 0, lon: g.lon + 70 } : { alpha: 0 });
    // the first slide opens looking up into the dark, then the camera tilts down onto the valley as the snow begins
    if (AT) { Object.assign(AT.state, p.world(s), s === 0 ? { snow: 0, ridge: 0, ly: 2600 } : {}); if (s === 0) worldTo(p.world(s), 3.4, 0, 'power2.inOut'); }
    delete G.spinning;
    photoTo(p.photo(s), s === 0 ? 1.5 : 0.01, { from: { x: g.cx, y: g.cy }, lead: 0.1, now: s !== 0 });
    if (s === 0) {
      p.tl.time(0);
      running.push(gsap.delayedCall(0.1, () => running.push(p.tl.tweenFromTo(0, p.ends[0]))));
      globeTo(g, p.cover ? 1.8 : 0.8, p.cover ? 'power3.out' : 'power1.out');
    } else {
      p.tl.time(p.ends[s]);
      globeTo(g, 0);
    }
    if (SPACE) {
      // the opening: the camera glides in from high above the park while the first slide assembles
      near(pages.indexOf(p));
      Object.assign(CAM, camFor(p, s), s === 0 ? { back: 2600, lift: 900, roll: -3 } : {});
      applyCam();
      if (s === 0) running.push(gsap.to(CAM, { back: 0, lift: 0, roll: 0, duration: 3.2, ease: 'power2.inOut', onUpdate: applyCam }));
    }
    if (VER) {
      const spots = spotsOf(p, s);
      VER.states.forEach((st, i) => {
        const a = spots[i];
        Object.assign(st, { show: 0, glow: 0, lift: 0 });
        if (!a) return;
        const w = placeOf(p, a);
        Object.assign(st, { x: w.x, y: w.y, z: w.z, r: a.r || 100 });
        running.push(gsap.to(st, { show: 1, glow: a.glow || 0, duration: 1.1, ease: 'back.out(2.2)', delay: s === 0 ? (SPACE ? 1.6 : 0.9) : 0 }));
      });
    }
    p.enter();
    p.onStep(s);
  }

  function chrome() {
    const { p, s, pi } = flat[cur];
    const num = $('.num', p.el);
    if (num) num.textContent = `${pi + 1} / ${pages.length}`;
    const extra = p.stepLabel ? p.stepLabel(s) : '';
    live.textContent = `Slide ${pi + 1} of ${pages.length}. ${p.label}${extra ? (/[.?!]$/.test(p.label) ? ' ' : '. ') + extra : ''}`;
    if (!CAPTURE) history.replaceState(null, '', '#' + (pi + 1));
  }

  function show(i, dir) {
    i = clamp(i | 0, 0, flat.length - 1);
    if (i === cur) return;
    finish();
    const from = cur >= 0 ? flat[cur] : null, to = flat[i];
    dir = dir || (i > cur ? 1 : -1);
    cur = i;
    chrome();
    if (!from) return intro(to);
    if (from.p === to.p) return stepTo(to.p, to.s, from.s);
    if (SPACE) return fly(from.p, to.p, to.s, dir);
    morph(from.p, to.p, to.s, dir);
  }

  const next = () => show(cur + 1, 1);
  const prev = () => show(cur - 1, -1);
  const page = () => flat[cur].p;
  const firstOf = pi => flat.findIndex(f => f.pi === pi);

  function toggleHelp(on) { help.hidden = on === undefined ? !help.hidden : !on; }
  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement);
  }

  addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!blackout.hidden) { blackout.hidden = true; e.preventDefault(); return; }   // any key brings the slides back
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': case 'PageDown': case 'Enter': next(); break;
      case ' ': if (!(page().toggle && page().toggle())) next(); break;
      case 'ArrowLeft': case 'ArrowUp': case 'PageUp': case 'Backspace': prev(); break;
      case 'Home': show(0, -1); break;
      case 'End': show(flat.length - 1, 1); break;
      case 'f': case 'F': fullscreen(); break;
      case 'b': case 'B': case '.': blackout.hidden = false; break;
      case 'p': case 'P': case 'k': case 'K': if (page().toggle) page().toggle(); break;
      case '?': case 'h': case 'H': toggleHelp(); break;
      case 'Escape': toggleHelp(false); break;
      default: return;
    }
    e.preventDefault();
  });
  help.addEventListener('click', () => toggleHelp(false));
  blackout.addEventListener('click', () => { blackout.hidden = true; });
  let touchX = null;
  addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  addEventListener('touchend', e => {
    if (touchX == null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    touchX = null;
    if (Math.abs(dx) > 60) (dx < 0 ? next : prev)();
  });
  addEventListener('hashchange', () => { const n = parseInt(location.hash.slice(1), 10); if (n && firstOf(n - 1) >= 0 && flat[cur].pi !== n - 1) show(firstOf(n - 1)); });

  /* ================================================================ layout + start */

  // decode every photo first so nothing pops in half-loaded; a missing file is left out instead of showing a broken frame
  function preload() {
    const srcs = new Set();
    pages.forEach(p => p.ends.forEach((_, s) => { const sp = p.photo(s); if (sp) srcs.add(sp.src); }));
    const load = (src, tries) => new Promise(done => {
      const im = new Image();
      im.onload = () => (im.decode ? im.decode() : Promise.resolve()).catch(() => null).then(done);
      im.onerror = () => (tries > 0 ? setTimeout(() => load(src, tries - 1).then(done), 400) : (badImg.add(src), done()));
      im.src = src;
    });
    return Promise.all([...pages.map(p => p.load && p.load()), ...[...srcs].map(src => load(src, 2))]);
  }

  function fitStage() {
    const vw = innerWidth, vh = innerHeight;
    scale = Math.min(vw / W, vh / H);
    stage.style.transform = `translate(${(vw - W * scale) / 2}px, ${(vh - H * scale) / 2}px) scale(${scale})`;
    G.resize(scale);
    if (AT) AT.resize(scale);
    if (ENV) ENV.resize(scale);
    if (VER) VER.resize(scale);
    pages.forEach(p => p.resize && p.resize(scale));
  }
  addEventListener('resize', fitStage);

  const faces = ['400', '500', '600', '700', '800'].map(w => `${w} 40px "Libre Franklin"`)
    .concat(['400 40px Newsreader', '600 40px Newsreader', '700 40px Newsreader', 'italic 400 40px Newsreader'])
    .concat(FONTS ? ['title', 'text', 'label', 'cite'].flatMap(k => ['400', '700'].map(w => `${w} 40px ${getComputedStyle(document.documentElement).getPropertyValue('--f-' + k)}`)) : []);
  Promise.all(faces.map(f => document.fonts.load(f))).catch(() => null).then(() => {
    fitStage();
    // the cards' backgrounds reach past their text, so they're hidden while the text is fitted
    stage.classList.add('fitting');
    pages.forEach(p => p.fit());
    stage.classList.remove('fitting');
    pages.forEach((p, pi) => {
      // all builds go on one timeline; ends[] marks where each click stops
      const steps = BUILDS ? p.steps : [tl => p.steps.forEach((fn, k) => fn(tl, k * 0.3))];   // builds off: the pieces cascade in together
      if (!BUILDS) { const g = p.globe, f = p.photo, v = p.verity, last = p.steps.length - 1; p.globe = () => g(last); p.photo = () => f(last); p.verity = () => v(last); p.view = () => NO_VIEW; p.stepLabel = null; }
      if (!SPACE) p.station = { x: 0, y: 0, z: 0, ry: 0, rx: 0, rz: 0 };
      if (SPACE) {
        p.station = stationOf(pi);
        p.el.style.transform = pageTf(p.station);
        // the globe stays put on its own slide (it's only drawn there)
        if (!p.el.classList.contains('p-where')) p.globe = () => (whereGlobe ? whereGlobe() : { ...LOGO('light'), alpha: 0 });
        // builds and photos need the steps' timing, so the cards are built first and their moves added step by step
      }
      if (SPACE) spaceCards(p, steps.length);
      steps.forEach((fn, s) => {
        const at = p.tl.duration();
        if (SPACE) spaceIn(p, s, at);
        fn(p.tl, at);
        if (SPACE) spaceCardsStep(p, s, at);
        p.ends.push(p.tl.duration());
      });
      if (!p.ends.length) p.ends.push(0);
      if (p.built) p.built();
      p.ends.forEach((_, s) => flat.push({ p, s, pi }));
    });
    return preload();
  }).then(() => {
    const start = parseInt(location.hash.slice(1), 10);
    show(start > 0 && firstOf(start - 1) >= 0 ? firstOf(start - 1) : 0, 1);
    let capT = gsap.globalTimeline.time();
    window.__deck = {
      count: flat.length,
      pages: pages.length,
      get index() { return cur; },
      go: (i, dir) => show(i, dir),
      advance(ms) { capT += ms / 1000; gsap.updateRoot(capT); if (SPACE || VER) draw3D(); },
    };
    document.documentElement.classList.add('ready');
  });
})();
