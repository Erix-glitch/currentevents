/* The discussion cards drawn with three.js: each card bends as it turns over, catches the light, and casts a soft
   shadow that spreads as it lifts; a ring of halftone dots runs out from each card as it lands.
   deck.js moves the cards (and animates the words on them); this only draws what the page's HTML cards are doing.
   Browsers don't let WebGL read photos on a page opened straight from disk, so deck.js only uses this when the
   slides come from a web server. Opened from disk, the same cards are drawn with CSS 3D instead. */
(function () {
  'use strict';
  const RAD = Math.PI / 180;
  // the theme's colours, from style.css
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const rgb = n => css(n).split(/[\s,]+/).map(Number);
  const hex = n => { const h = css(n).replace('#', ''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255); };

  const SDF = `
    float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }`;

  // the card bows while it turns over (uBend), like a flicked playing card
  const CARD_VERT = `
    uniform vec2 uSize;
    uniform float uBend;
    varying vec2 vUv;
    varying vec3 vWorld;
    void main() {
      vUv = uv;
      vec3 p = position;
      float xn = p.x / (uSize.x * 0.5), yn = p.y / (uSize.y * 0.5);
      p.z -= uBend * ((1.0 - xn * xn) * 95.0 + (1.0 - yn * yn) * 22.0);
      vec4 w = modelMatrix * vec4(p, 1.0);
      vWorld = w.xyz;
      gl_Position = projectionMatrix * viewMatrix * w;
    }`;

  const CARD_FRAG = SDF + `
    uniform vec2 uSize;
    uniform vec3 uPaper, uDimCol;
    uniform vec4 uImgRect, uTextRect;
    uniform float uHasImg, uImgAspect, uImgScale, uDim, uGlint, uMono;
    uniform sampler2D tPhoto, tText, tBack;
    varying vec2 vUv;
    varying vec3 vWorld;
    void main() {
      bool front = gl_FrontFacing;
      // position on the card in px from its top-left corner, as seen from whichever side is showing
      vec2 px = vec2((front ? vUv.x : 1.0 - vUv.x) * uSize.x, (1.0 - vUv.y) * uSize.y);
      float d = sdRound(px - uSize * 0.5, uSize * 0.5, 30.0);
      float alpha = clamp(0.5 - d / max(fwidth(d), 1e-4), 0.0, 1.0);
      if (alpha <= 0.0) discard;
      vec3 col;
      if (front) {
        col = uPaper;
        if (uHasImg > 0.5) {
          float di = sdRound(px - uImgRect.xy - uImgRect.zw * 0.5, uImgRect.zw * 0.5, 14.0);
          float ia = clamp(0.5 - di / max(fwidth(di), 1e-4), 0.0, 1.0);
          if (ia > 0.0) {
            vec2 t = (px - uImgRect.xy) / uImgRect.zw;          // object-fit: cover, then the settling zoom
            float ra = uImgRect.z / uImgRect.w;
            if (uImgAspect > ra) t.x = 0.5 + (t.x - 0.5) * ra / uImgAspect; else t.y = 0.5 + (t.y - 0.5) * uImgAspect / ra;
            t = 0.5 + (t - 0.5) / uImgScale;
            vec3 ph = texture2D(tPhoto, vec2(t.x, 1.0 - t.y)).rgb;
            ph = mix(ph, vec3(dot(ph, vec3(0.2126, 0.7152, 0.0722))), uMono);    // black and white in the night theme
            col = mix(col, ph, ia);
          }
        }
        vec2 tt = (px - uTextRect.xy) / uTextRect.zw;
        if (all(greaterThanEqual(tt, vec2(0.0))) && all(lessThanEqual(tt, vec2(1.0)))) {
          vec4 tx = texture2D(tText, vec2(tt.x, 1.0 - tt.y));    // premultiplied
          col = col * (1.0 - tx.a) + tx.rgb;
        }
        col = mix(col, uDimCol, 0.5 * uDim);
      } else {
        col = texture2D(tBack, vec2(px.x / uSize.x, 1.0 - px.y / uSize.y)).rgb;
      }
      // light from the upper left: a face darkens as it turns away, and glints while it's moving.
      // lying flat it's exactly its own colours, so the text matches the rest of the slides
      vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
      vec3 V = normalize(cameraPosition - vWorld);
      if (dot(n, V) < 0.0) n = -n;
      vec3 L = normalize(vec3(-0.35, 0.45, 1.0));
      col *= mix(0.42, 1.0, clamp(dot(n, L) / L.z, 0.0, 1.0));
      col += pow(max(dot(n, normalize(L + V)), 0.0), 36.0) * 0.6 * uGlint;
      gl_FragColor = vec4(col * alpha, alpha);
    }`;

  const PLAIN_VERT = `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

  // a soft rounded shadow on the table under each card
  const SHADOW_FRAG = SDF + `
    uniform vec2 uSize, uFull;
    uniform vec3 uCol;
    uniform float uBlur, uOp;
    varying vec2 vUv;
    void main() {
      float d = sdRound(vUv * uFull - uFull * 0.5, uSize * 0.5, 30.0);
      float a = uOp * (1.0 - smoothstep(-uBlur, uBlur, d));
      gl_FragColor = vec4(uCol * a, a);
    }`;

  // halftone dots, like the globe's, swelling in a ring that runs out from the card that just landed
  const RING_FRAG = `
    uniform float uK, uH, uR;
    uniform vec2 uC;
    uniform vec4 uHole;    // keep clear of the title
    void main() {
      vec2 sp = vec2(gl_FragCoord.x, uH - gl_FragCoord.y) / uK;     // slide px
      float g = 24.0;
      vec2 cell = (floor(sp / g) + 0.5) * g;
      float d = distance(cell, uC);
      float band = exp(-pow((d - uR) / 64.0, 2.0)) + 0.45 * exp(-pow((d - uR + 150.0) / 54.0, 2.0));
      float env = smoothstep(0.0, 260.0, uR) * (1.0 - smoothstep(750.0, 1250.0, uR));
      vec2 h = max(uHole.xy - sp, sp - uHole.zw);
      env *= smoothstep(0.0, 60.0, max(h.x, h.y));
      float rad = 9.0 * min(band, 1.0) * env;
      float a = clamp(rad - distance(sp, cell) + 0.5, 0.0, 1.0) * 0.85;
      if (a <= 0.0) discard;
      gl_FragColor = vec4(vec3(a), a);
    }`;

  const num = (v, dflt) => { const x = parseFloat(v); return isFinite(x) ? x : dflt; };
  const whenLoaded = im => new Promise(done => {
    if (im.complete) return done(im.naturalWidth > 0);
    im.addEventListener('load', () => done(true), { once: true });
    im.addEventListener('error', () => done(false), { once: true });
  });

  // where every piece of text sits on an HTML card, so the same layout can be painted into the card's texture
  function measure(card, ctx) {
    const body = card.querySelector('.q-body'), lab = body.querySelector('.q-lab'), qt = body.querySelector('.q-t');
    const cs = getComputedStyle(qt), ls = getComputedStyle(lab);
    const font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, lfont = `${ls.fontWeight} ${ls.fontSize} ${ls.fontFamily}`;
    // CSS puts the baseline half the leftover line height below the top, plus the font's ascent
    const base = (f, top, h) => { ctx.font = f; const m = ctx.measureText('Hg'); return top + (h - m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2 + m.fontBoundingBoxAscent; };
    return {
      bx: body.offsetLeft, by: body.offsetTop, bw: body.offsetWidth, bh: body.offsetHeight,
      font, lfont, spacing: cs.letterSpacing, lspacing: ls.letterSpacing,
      lab: { el: lab, text: lab.textContent, x: lab.offsetLeft, w: lab.offsetWidth, top: lab.offsetTop, base: base(lfont, lab.offsetTop, lab.offsetHeight) },
      words: [...qt.querySelectorAll('.w')].map(el => {
        const t = el.querySelector('.hl-t');
        // (a highlighted word's text sits inside its padding; measured from the word, since a moving word becomes its children's offsetParent)
        return { el, hl: !!t, text: el.textContent, x: el.offsetLeft + (t ? parseFloat(getComputedStyle(el).paddingLeft) : 0), left: el.offsetLeft, top: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, base: base(font, el.offsetTop, el.offsetHeight) };
      }),
    };
  }
  const wordState = w => [w.el.style.opacity, gsap.getProperty(w.el, 'yPercent'), w.el.style.getPropertyValue('--p'), w.el.style.getPropertyValue('--ha')].join('|');

  // the words as they are right now: risen in or not, highlighted or not
  function paintText(ctx, L, k, pad) {
    const c = ctx.canvas;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.setTransform(k, 0, 0, k, pad * k, pad * k);
    ctx.textBaseline = 'alphabetic';
    const shown = 1 - num((/inset\(\s*\S+\s+([-\d.]+)%/.exec(L.lab.el.style.clipPath) || [])[1], 0) / 100;   // the label's wipe
    if (shown > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(L.lab.x - pad, L.lab.top - pad, pad + L.lab.w * shown, 200);
      ctx.clip();
      ctx.font = L.lfont; ctx.letterSpacing = L.lspacing; ctx.fillStyle = css('--accent-l');
      ctx.fillText(L.lab.text, L.lab.x, L.lab.base);
      ctx.restore();
    }
    ctx.font = L.font; ctx.letterSpacing = L.spacing;
    for (const w of L.words) {
      const op = num(w.el.style.opacity, 1);
      if (op <= 0.002) continue;
      const dy = num(gsap.getProperty(w.el, 'yPercent'), 0) / 100 * w.h;
      ctx.globalAlpha = op;
      if (w.hl) {
        const p = num(w.el.style.getPropertyValue('--p'), 0), ha = num(w.el.style.getPropertyValue('--ha'), 1);
        if (p > 0 && ha > 0) {
          ctx.fillStyle = `rgba(${rgb('--hl-rgb').join(', ')}, ${ha})`;
          ctx.fillRect(w.left, w.top + dy + w.h * 0.26 * 0.72, w.w * p / 100, w.h * 0.74);
        }
      }
      ctx.fillStyle = css('--ink');
      ctx.fillText(w.text, w.x, w.base + dy);
    }
    ctx.globalAlpha = 1;
  }

  // the back of a card: playing-card corners, a big number and a halftone that fades out from the middle
  function paintBack(ctx, i, CW, CH, k) {
    ctx.setTransform(k, 0, 0, k, 0, 0);
    const accent = rgb('--accent-rgb').join(', ');
    ctx.fillStyle = css('--paper');
    ctx.fillRect(0, 0, CW, CH);
    const ix = 22, iw = CW - 44, ih = CH - 44, cx = CW / 2, cy = CH / 2, reach = Math.min(iw, ih) / 2;
    for (let y = ix + 9.5; y < ix + ih; y += 19) {
      for (let x = ix + 9.5; x < ix + iw; x += 19) {
        const t = Math.min(1, Math.max(0, (Math.hypot(x - cx, (y - cy) * iw / ih) / reach - 0.3) / 0.7));
        ctx.fillStyle = `rgba(${accent}, ${(0.2 * (1 - 0.75 * t)).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.strokeStyle = `rgba(${accent}, 0.32)`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(ix + 1, ix + 1, iw - 2, ih - 2, 16); ctx.stroke();
    ctx.fillStyle = css('--accent-l'); ctx.textBaseline = 'top';
    ctx.font = '800 66px "Libre Franklin"'; ctx.textAlign = 'left';
    ctx.fillText(String(i + 1), 52, 46);
    ctx.save(); ctx.translate(CW - 52, CH - 46); ctx.rotate(Math.PI); ctx.fillText(String(i + 1), 0, 0); ctx.restore();
    ctx.textAlign = 'center';
    ctx.font = '600 30px "Libre Franklin"'; ctx.fillText('Question', cx, 214);
    ctx.font = '800 380px "Libre Franklin"'; ctx.fillText(String(i + 1), cx, 262);
  }

  async function create(o) {
    const T = window.THREE;
    const { page, cards, CW, CH, persp, hero } = o;   // o.hole: [left, top, right, bottom] of the title, kept free of dots
    const cv = document.createElement('canvas');
    cv.className = 'q-gl';
    let renderer;
    try {
      renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, premultipliedAlpha: true });
    } catch (e) { return null; }
    renderer.setClearColor(0x000000, 0);
    const aniso = renderer.capabilities.getMaxAnisotropy();
    // textures are made for the sharpest the slides will be shown (full screen on this display), up to 2x
    const K = Math.min(2, Math.max(1, (devicePixelRatio || 1) * Math.max(screen.width / 1920, screen.height / 1080)));
    const tex = (src, premul) => {
      const t = src instanceof HTMLCanvasElement ? new T.CanvasTexture(src) : new T.Texture(src);
      Object.assign(t, { colorSpace: T.NoColorSpace, anisotropy: aniso, premultiplyAlpha: !!premul, minFilter: T.LinearMipmapLinearFilter, magFilter: T.LinearFilter, needsUpdate: true });
      return t;
    };

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(2 * Math.atan(540 / persp) / RAD, 1920 / 1080, 10, 10000);
    camera.position.set(0, 0, persp);   // the same perspective as the CSS cards: 1 unit = 1 slide px on the table

    const SP = 150;
    const cardGeo = new T.PlaneGeometry(CW, CH, 48, 12), shadowGeo = new T.PlaneGeometry(CW + 2 * SP, CH + 2 * SP);
    const ring = new T.Mesh(new T.PlaneGeometry(2400, 1500), new T.ShaderMaterial({
      vertexShader: PLAIN_VERT, fragmentShader: RING_FRAG, transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
      uniforms: { uK: { value: 1 }, uH: { value: 1080 }, uR: { value: 0 }, uC: { value: new T.Vector2(hero.x, hero.y) }, uHole: { value: new T.Vector4(...o.hole) } },
    }));
    ring.position.z = -30; ring.renderOrder = -2;
    scene.add(ring);

    const items = [];
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      const img = card.querySelector('.q-img img');
      if (img && !(await whenLoaded(img))) card.classList.add('noimg');   // deck.js refits a card whose photo is missing
      const has = img && !card.classList.contains('noimg');
      const fr = card.querySelector('.q-img');
      const textCv = document.createElement('canvas'), backCv = document.createElement('canvas');
      const L = measure(card, textCv.getContext('2d'));
      const pad = 24;
      textCv.width = Math.ceil((L.bw + pad * 2) * K); textCv.height = Math.ceil((L.bh + pad * 2) * K);
      backCv.width = Math.ceil(CW * K); backCv.height = Math.ceil(CH * K);
      paintBack(backCv.getContext('2d'), i, CW, CH, K);
      const u = {
        uSize: { value: new T.Vector2(CW, CH) }, uPaper: { value: new T.Vector3(...hex('--paper')) }, uDimCol: { value: new T.Vector3(...rgb('--dim-rgb').map(v => v / 255)) },
        uImgRect: { value: has ? new T.Vector4(fr.offsetLeft, fr.offsetTop, fr.offsetWidth, fr.offsetHeight) : new T.Vector4(0, 0, 1, 1) },
        uTextRect: { value: new T.Vector4(L.bx - pad, L.by - pad, L.bw + pad * 2, L.bh + pad * 2) },
        uHasImg: { value: has ? 1 : 0 }, uImgAspect: { value: has ? img.naturalWidth / img.naturalHeight : 1 }, uImgScale: { value: 1 },
        uDim: { value: 0 }, uBend: { value: 0 }, uGlint: { value: 0 }, uMono: { value: parseFloat(css('--mono')) || 0 },
        tPhoto: { value: has ? tex(img) : null }, tText: { value: tex(textCv, true) }, tBack: { value: tex(backCv) },
      };
      const mesh = new T.Mesh(cardGeo, new T.ShaderMaterial({ vertexShader: CARD_VERT, fragmentShader: CARD_FRAG, uniforms: u, side: T.DoubleSide, transparent: true, premultipliedAlpha: true }));
      mesh.rotation.order = 'ZYX';
      const shadow = new T.Mesh(shadowGeo, new T.ShaderMaterial({
        vertexShader: PLAIN_VERT, fragmentShader: SHADOW_FRAG, transparent: true, premultipliedAlpha: true, depthTest: false, depthWrite: false,
        uniforms: { uSize: { value: new T.Vector2(CW, CH) }, uFull: { value: new T.Vector2(CW + 2 * SP, CH + 2 * SP) }, uCol: { value: new T.Vector3(...rgb('--shadow-rgb').map(v => v / 255)) }, uBlur: { value: 24 }, uOp: { value: 0.6 } },
      }));
      shadow.renderOrder = -1;
      scene.add(shadow, mesh);
      items.push({ card, mesh, shadow, u, L, textCtx: textCv.getContext('2d'), pad, sig: '', img: has ? img : null, dim: card.querySelector('.q-dim') });
    }

    page.insertBefore(cv, page.querySelector('.q-table'));

    function resize(scale) {
      const k = Math.min(2, scale * (devicePixelRatio || 1));
      renderer.setPixelRatio(k);
      renderer.setSize(1920, 1080, false);
      ring.material.uniforms.uK.value = k;
      ring.material.uniforms.uH.value = renderer.domElement.height;
    }

    // S: where each card is (the same numbers the CSS cards use); ringR: how far the ring of dots has run
    function render(S, ringR) {
      items.forEach((it, i) => {
        const s = S[i], u = it.u;
        it.mesh.position.set(s.x - 960, 540 - s.y, s.z);
        it.mesh.rotation.set(-s.rx * RAD, s.ry * RAD, -s.rz * RAD);
        it.mesh.scale.setScalar(s.s);
        let a = ((s.ry % 360) + 360) % 360;
        if (a > 180) a = 360 - a;
        const turn = Math.sin(a * RAD);
        u.uBend.value = turn;
        u.uGlint.value = Math.min(1, turn * 1.6 + Math.abs(s.rx) / 20);
        u.uDim.value = num(it.dim.style.opacity, 0);
        if (it.img) u.uImgScale.value = num(gsap.getProperty(it.img, 'scale'), 1);
        const sig = it.L.words.map(wordState).join() + it.L.lab.el.style.clipPath;
        if (sig !== it.sig) { it.sig = sig; paintText(it.textCtx, it.L, K, it.pad); u.tText.value.needsUpdate = true; }
        it.mesh.renderOrder = 10 + s.z / 1000;
        const lift = Math.min(1.4, Math.max(0, s.z / 260)), edge = Math.max(0.04, Math.abs(Math.cos(a * RAD)));
        it.shadow.position.set(s.x - 960 + 12 + 46 * lift, 540 - (s.y + 22 + 84 * lift), -6);
        it.shadow.rotation.z = -s.rz * RAD;
        it.shadow.scale.set(s.s * edge * (1 + 0.05 * lift), s.s * (1 + 0.05 * lift), 1);
        it.shadow.material.uniforms.uOp.value = 0.62 - 0.3 * Math.min(1, lift);
        it.shadow.material.uniforms.uBlur.value = 24 + 30 * lift;
      });
      ring.material.uniforms.uR.value = ringR;
      renderer.render(scene, camera);
    }

    return { resize, render };
  }

  window.CardTable = { create };
})();
