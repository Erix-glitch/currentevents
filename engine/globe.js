/* The halftone globe. One canvas sits behind every slide, and the deck moves, zooms and recolours it between slides:
   a big globe on the cover, a small mark beside "Current Events", a zooming map on the "where" slide.
   Land is drawn as dots placed on an even spiral over the sphere; a finer set takes over when zoomed in. */
(function () {
  'use strict';
  const RAD = Math.PI / 180, TAU = Math.PI * 2;
  const W = window.WORLD;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- land mask (2048 x 1024 world grid, stored as runs) ---------- */
  const MW = W.MASK.w, MH = W.MASK.h, mask = new Uint8Array(MW * MH);
  W.MASK.rows.forEach((runs, y) => {
    let x = 0, land = 0;
    for (const n of runs) { if (land) mask.fill(1, y * MW + x, y * MW + x + n); x += n; land ^= 1; }
  });
  const isLand = (lon, lat) => mask[Math.min(MH - 1, ((90 - lat) / 180 * MH) | 0) * MW + Math.min(MW - 1, ((lon + 180) / 360 * MW) | 0)] === 1;

  function dotSet(N) {
    const golden = Math.PI * (3 - Math.sqrt(5)), keep = [];
    for (let i = 0; i < N; i++) {
      const lat = Math.asin(1 - (2 * i + 1) / N) / RAD;
      const lon = (((golden * i) / RAD) % 360 + 540) % 360 - 180;
      if (isLand(lon, lat)) keep.push(lon * RAD, lat * RAD);
    }
    const n = keep.length / 2;
    const s = { n, spacing: Math.sqrt(4 * Math.PI / N), sinL: new Float32Array(n), cosL: new Float32Array(n), sinP: new Float32Array(n), cosP: new Float32Array(n) };
    for (let i = 0; i < n; i++) {
      s.sinL[i] = Math.sin(keep[2 * i]); s.cosL[i] = Math.cos(keep[2 * i]);
      s.sinP[i] = Math.sin(keep[2 * i + 1]); s.cosP[i] = Math.cos(keep[2 * i + 1]);
    }
    return s;
  }
  const COARSE = dotSet(46000);      // about 1 degree apart
  let FINE = null;                   // about a third of a degree apart, built the first time it's needed
  const fine = () => FINE || (FINE = dotSet(414000));

  /* ---------- shapes ---------- */
  const LAND = topojson.feature(W.LAND, W.LAND.objects.land);
  const CGEOMS = W.COUNTRIES.objects.countries.geometries;
  const COUNTRIES = topojson.feature(W.COUNTRIES, W.COUNTRIES.objects.countries).features;
  const BORDERS = topojson.mesh(W.COUNTRIES, W.COUNTRIES.objects.countries, (a, b) => a !== b);
  const PGEOMS = W.PROVINCES.objects.provinces.geometries;
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  // d3 wants outer rings clockwise; flip any shape that came out inside-out
  function rewind(f) {
    if (f && d3.geoArea(f) > 2 * Math.PI) {
      const g = f.geometry;
      const flip = poly => poly.map(ring => ring.slice().reverse());
      f = { ...f, geometry: { ...g, coordinates: g.type === 'Polygon' ? flip(g.coordinates) : g.coordinates.map(flip) } };
    }
    return f;
  }

  // country, province/state and continent for a place; typed names win over the map lookup when they match
  function shapes(lon, lat, regionName, countryName) {
    const pt = [lon, lat];
    let country = COUNTRIES.find(f => d3.geoContains(f, pt)) || null;
    if (countryName) { const named = COUNTRIES.find(f => norm(f.properties.name) === norm(countryName)); if (named && !country) country = named; }
    const inCountry = country ? PGEOMS.filter(g => g.properties.admin === country.properties.name) : [];
    const feat = g => rewind(topojson.feature(W.PROVINCES, g));
    let province = null;
    const byName = regionName && inCountry.find(g => norm(g.properties.name) === norm(regionName));
    if (byName) province = feat(byName);
    else {
      for (const g of inCountry) { const f = feat(g); if (d3.geoContains(f, pt)) { province = f; break; } }
    }
    let continent = null;
    if (country && country.properties.continent) {
      const geom = topojson.merge(W.COUNTRIES, CGEOMS.filter(g => g.properties.continent === country.properties.continent));
      continent = rewind({ type: 'Feature', properties: { name: country.properties.continent }, geometry: geom });
    }
    return { country: rewind(country), province, continent };
  }

  // how far (degrees) a shape reaches from a point; only parts near the point count, so far-off islands don't matter
  function reach(f, lon, lat) {
    if (!f) return 0;
    const g = f.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates, pt = [lon, lat];
    let far = 0;
    for (const poly of polys) {
      let near = Infinity, pfar = 0;
      for (const ring of poly) for (const v of ring) { const d = d3.geoDistance(pt, v); if (d < near) near = d; if (d > pfar) pfar = d; }
      const holds = d3.geoContains({ type: 'Polygon', coordinates: poly }, pt);
      if (holds || near < 20 * RAD) far = Math.max(far, pfar);
    }
    return far / RAD;
  }

  /* ---------- colours: light style (mix 0) to dark style (mix 1); the highlight colours come from the theme (this.colors) ---------- */
  const PAPER = { dot: [20, 20, 20, 1], land: [20, 20, 20, 1], edge: [20, 20, 20, 0.32], grid: [20, 20, 20, 0.07] };
  const BLUE = { dot: [255, 255, 255, 0.36], land: [255, 255, 255, 0.95], edge: [255, 255, 255, 0.22], grid: [255, 255, 255, 0] };
  const mixc = (a, b, t) => `rgba(${a.slice(0, 3).map((v, i) => Math.round(lerp(v, b[i], t))).join(',')},${lerp(a[3], b[3], t).toFixed(3)})`;

  class Globe {
    constructor(canvas) {
      this.cv = canvas;
      this.ctx = canvas.getContext('2d');
      this.proj = d3.geoOrthographic().clipAngle(90).precision(0.6);
      this.path = d3.geoPath(this.proj, this.ctx);
      this.grat = d3.geoGraticule10();
      this.k = 1;
      // everything below can be tweened
      Object.assign(this, { cx: 960, cy: 540, r: 0, mix: 0, lon: 0, lat: 0, spin: 0, alpha: 1,
        clipR: 4000, lensA: 0, markP: 0, pulse: 0, provP: 0, countryP: 0, contP: 0 });
      this.mark = null; this.province = null; this.country = null; this.continent = null;
      this.colors = { sea: '#1F3ACC', province: '#FFD23F', country: '#FFE47A', continent: '#F7EBB4', mark: '#FFE24A', ink: '#141414' };
    }
    static shapes(...a) { return shapes(...a); }
    static reach(...a) { return reach(...a); }

    resize(scale) {
      const k = Math.min(2.5, scale * (window.devicePixelRatio || 1));
      const pw = Math.round(1920 * k), ph = Math.round(1080 * k);
      if (this.cv.width !== pw || this.cv.height !== ph) { this.cv.width = pw; this.cv.height = ph; }
      this.k = k;
      this.draw();
    }

    // the highlighter pass over one shape: clipped to a band that grows left to right with p
    fillShape(f, p, color) {
      if (!f || p <= 0) return;
      const g = this.ctx, [[x0, y0], [x1, y1]] = this.path.bounds(f);
      if (!isFinite(x0)) return;
      g.save();
      g.beginPath(); g.rect(x0 - 2, y0 - 2, (x1 - x0 + 4) * Math.min(1, p), y1 - y0 + 4); g.clip();
      g.globalAlpha = this.alpha * Math.min(1, p * 3);
      g.beginPath(); this.path(f); g.fillStyle = color; g.fill();
      g.restore();
    }

    dots(set, a, color, lon, lat) {
      if (a <= 0.01) return;
      const g = this.ctx, r = this.r, cx = this.cx, cy = this.cy;
      const sl0 = Math.sin(lon * RAD), cl0 = Math.cos(lon * RAD), sp0 = Math.sin(lat * RAD), cp0 = Math.cos(lat * RAD);
      const base = r * set.spacing * 0.34;
      // only test dots that can be on screen: when zoomed in, skip whatever lies outside the lens
      const lim = this.clipR < r ? Math.cos(Math.min(Math.PI / 2, Math.asin(Math.min(1, this.clipR / r)) + 0.02)) : 0.015;
      const bands = [new Path2D(), new Path2D(), new Path2D()];
      for (let i = 0; i < set.n; i++) {
        const cosdl = set.cosL[i] * cl0 + set.sinL[i] * sl0;
        const c = sp0 * set.sinP[i] + cp0 * set.cosP[i] * cosdl;
        if (c <= lim) continue;
        const sindl = set.sinL[i] * cl0 - set.cosL[i] * sl0;
        const x = cx + r * set.cosP[i] * sindl;
        const y = cy - r * (cp0 * set.sinP[i] - sp0 * set.cosP[i] * cosdl);
        const rr = base * (0.2 + 0.8 * Math.sqrt(c));
        const b = bands[c < 0.18 ? 0 : c < 0.42 ? 1 : 2];
        b.moveTo(x + rr, y);
        b.arc(x, y, rr, 0, TAU);
      }
      g.fillStyle = color;
      [0.4, 0.72, 1].forEach((t, i) => { g.globalAlpha = this.alpha * a * t; g.fill(bands[i]); });
    }

    draw() {
      const g = this.ctx, k = this.k;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, this.cv.width, this.cv.height);
      const r = this.r;
      if (r < 0.5 || this.alpha <= 0.002) return;
      g.setTransform(k, 0, 0, k, 0, 0);
      const lon = this.lon + this.spin, lat = this.lat, m = this.mix, cx = this.cx, cy = this.cy;
      this.proj.rotate([-lon, -lat]).scale(r).translate([cx, cy]);
      const lens = this.clipR < r;
      const tiny = clamp((80 - r) / 45, 0, 1);          // 1 = small enough to draw land as a solid shape

      g.save();
      if (lens) { g.beginPath(); g.arc(cx, cy, this.clipR, 0, TAU); g.clip(); }
      if (m > 0) { g.globalAlpha = this.alpha * m; g.beginPath(); this.path({ type: 'Sphere' }); g.fillStyle = this.colors.sea; g.fill(); }
      const gridA = (1 - tiny) * clamp((900 - r) / 300, 0, 1);
      if (gridA > 0 && m < 1) { g.globalAlpha = this.alpha * gridA; g.beginPath(); this.path(this.grat); g.lineWidth = 1; g.strokeStyle = mixc(PAPER.grid, BLUE.grid, m); g.stroke(); }

      this.fillShape(this.continent, this.contP, this.colors.continent);
      this.fillShape(this.country, this.countryP, this.colors.country);
      this.fillShape(this.province, this.provP, this.colors.province);

      if (tiny > 0) { g.globalAlpha = this.alpha * tiny; g.beginPath(); this.path(LAND); g.fillStyle = mixc(PAPER.land, BLUE.land, m); g.fill(); }
      if (tiny < 1) {
        const dc = mixc(PAPER.dot, BLUE.dot, m);
        const t = clamp((r - 700) / 320, 0, 1);       // coarse dots hand over to fine ones as the map zooms in
        this.dots(COARSE, (1 - tiny) * (1 - t), dc, lon, lat);
        if (t > 0) this.dots(fine(), (1 - tiny) * t, dc, lon, lat);
      }
      const borderA = clamp((r - 520) / 380, 0, 1) * (1 - m);
      if (borderA > 0) { g.globalAlpha = this.alpha * borderA * 0.45; g.beginPath(); this.path(BORDERS); g.lineWidth = 1.3; g.strokeStyle = this.colors.ink; g.stroke(); }
      if (this.province && this.provP > 0) { g.globalAlpha = this.alpha * Math.min(1, this.provP * 2) * 0.75; g.beginPath(); this.path(this.province); g.lineWidth = 2; g.strokeStyle = this.colors.ink; g.stroke(); }
      g.restore();

      const edge = mixc(PAPER.edge, BLUE.edge, m);
      if (!lens) { g.globalAlpha = this.alpha * (0.6 + 0.4 * tiny); g.beginPath(); this.path({ type: 'Sphere' }); g.lineWidth = 1.5 + tiny * 0.5; g.strokeStyle = tiny > 0.5 ? mixc(PAPER.land, BLUE.land, m) : edge; g.stroke(); }
      if (this.lensA > 0) { g.globalAlpha = this.alpha * this.lensA; g.beginPath(); g.arc(cx, cy, this.clipR, 0, TAU); g.lineWidth = 2; g.strokeStyle = edge; g.stroke(); }

      // the story's location on the big blue globes: a dot with a slow ring
      if (this.mark && this.markP > 0) {
        const l = (this.mark[0] - lon) * RAD, p = this.mark[1] * RAD, p0 = lat * RAD;
        const c = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
        if (c > 0.08) {
          const x = cx + r * Math.cos(p) * Math.sin(l), y = cy - r * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l));
          const a = this.alpha * this.markP * Math.min(1, (c - 0.08) * 6);
          g.globalAlpha = a * (1 - this.pulse);
          g.beginPath(); g.arc(x, y, 9 + 34 * this.pulse, 0, TAU); g.lineWidth = 3; g.strokeStyle = this.colors.mark; g.stroke();
          g.globalAlpha = a;
          g.beginPath(); g.arc(x, y, 9, 0, TAU); g.fillStyle = this.colors.mark; g.fill();
        }
      }
      g.globalAlpha = 1;
    }
  }

  window.Globe = Globe;
})();
