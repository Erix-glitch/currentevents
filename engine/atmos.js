/* The night theme's 3D scene, drawn with three.js behind the slides: snow falling through the dark, and on the first
   and last slides a mountain ridge drawn in halftone dots (lit by the moon from the left), with the lights of a small
   town in the valley. It uses no image files, so it works with the deck opened straight from disk too.
   deck.js tweens `state` between slides (the camera, how much snow and ridge show) and calls render() every frame. */
(function () {
  'use strict';
  const RAD = Math.PI / 180;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // seeded random numbers and 2D Perlin noise, so the mountains are the same every time
  function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  function perlin(seed) {
    const rnd = rng(seed), p = [...Array(256).keys()];
    for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    const perm = new Uint8Array(512).map((_, i) => p[i & 255]);
    const G = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];
    const fade = t => t * t * t * (t * (t * 6 - 15) + 10);
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, X = xi & 255, Y = yi & 255;
      const g = (h, dx, dy) => { const v = G[h & 7]; return v[0] * dx + v[1] * dy; };
      const u = fade(xf), v = fade(yf);
      const n00 = g(perm[perm[X] + Y], xf, yf), n10 = g(perm[perm[X + 1] + Y], xf - 1, yf);
      const n01 = g(perm[perm[X] + Y + 1], xf, yf - 1), n11 = g(perm[perm[X + 1] + Y + 1], xf - 1, yf - 1);
      return (n00 + u * (n10 - n00)) + v * ((n01 + u * (n11 - n01)) - (n00 + u * (n10 - n00)));   // about -0.7 … 0.7
    };
  }

  // the land: ridged mountains that get taller with distance, and a valley that winds towards the town
  const noise = perlin(11);
  const valleyX = z => 900 + 320 * Math.sin(z / 2300);
  function ridged(x, z) {
    let h = 0, amp = 1, f = 1, w = 1;
    for (let o = 0; o < 5; o++) {
      let v = 1 - Math.abs(noise(x * f + o * 17.3, z * f - o * 9.1) * 1.4);
      v = v * v * w;
      w = clamp(v * 1.5, 0, 1);
      h += v * amp; amp *= 0.5; f *= 2.07;
    }
    return h;   // about 0 … 1.6
  }
  function height(x, z) {
    const d = -z;
    let h = ridged(x / 2600, z / 2600) * 760 * (0.2 + 1.0 * smooth(600, 7500, d));
    h *= 0.12 + 0.88 * smooth(150, 1300, Math.abs(x - valleyX(z)));
    return h - 120;
  }
  const TOWN = { x: valleyX(-3600), z: -3600 };
  TOWN.y = height(TOWN.x, TOWN.z);

  const DOT_VERT = `
    attribute float aSize;
    attribute float aShade;
    uniform float uK, uAlpha, uLeft;
    varying float vA;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      float d = -mv.z;
      vec2 ndc = gl_Position.xy / gl_Position.w;
      vA = uAlpha * 0.8 * aShade * (1.0 - smoothstep(7000.0, 10500.0, d)) * mix(1.0, smoothstep(-0.55, 0.5, ndc.x), uLeft);
      gl_PointSize = aSize * uK;
    }`;
  const DOT_FRAG = `
    uniform vec3 uCol;
    varying float vA;
    void main() {
      float r = length(gl_PointCoord - 0.5) * 2.0;
      float a = vA * clamp((1.0 - r) * 3.0, 0.0, 1.0);
      if (a <= 0.003) discard;
      gl_FragColor = vec4(uCol * a, a);
    }`;

  // snow: each flake loops through a box that travels with the camera
  const SNOW_VERT = `
    attribute vec3 aSeed;
    attribute vec3 aMove;    // fall speed, sway phase, size
    uniform float uTime, uTravel, uWind, uK, uAlpha;
    uniform vec3 uCam;
    varying float vA;
    const vec3 BOX = vec3(3800.0, 2200.0, 3600.0);
    void main() {
      vec3 p = aSeed * BOX;
      p.x += sin(uTime * 0.5 + aMove.y) * 40.0 + uWind + uTime * 18.0;
      p.y -= uTime * aMove.x;
      p.z += uTravel;
      p = mod(p, BOX) - vec3(BOX.x * 0.5, BOX.y * 0.42, BOX.z + 120.0);
      vec4 mv = viewMatrix * vec4(uCam + p, 1.0);
      gl_Position = projectionMatrix * mv;
      float d = -mv.z;
      vA = uAlpha * smoothstep(160.0, 420.0, d) * (1.0 - smoothstep(2400.0, 3700.0, d)) * (0.35 + 0.65 * aMove.z);
      gl_PointSize = (3.0 + 10.0 * aMove.z) * uK * 900.0 / max(d, 1.0);
    }`;
  const SNOW_FRAG = `
    uniform vec3 uCol;
    varying float vA;
    void main() {
      float r = length(gl_PointCoord - 0.5) * 2.0;
      float a = vA * pow(clamp(1.0 - r, 0.0, 1.0), 1.4);
      if (a <= 0.003) discard;
      gl_FragColor = vec4(uCol * a, a);
    }`;

  // the town's lights: small warm points, and one soft glow that flickers like candlelight
  const GLOW_VERT = `
    attribute float aSize;
    attribute float aPhase;
    uniform float uK, uAlpha, uTime;
    varying float vA;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      float flicker = 0.82 + 0.1 * sin(uTime * 3.1 + aPhase) + 0.08 * sin(uTime * 7.3 + aPhase * 2.0);
      vA = uAlpha * flicker;
      gl_PointSize = aSize * uK * 2600.0 / max(-mv.z, 1.0);
    }`;
  const GLOW_FRAG = `
    uniform vec3 uCol;
    varying float vA;
    void main() {
      float r = length(gl_PointCoord - 0.5) * 2.0;
      float core = clamp((0.14 - r) * 14.0, 0.0, 1.0);
      float halo = pow(clamp(1.0 - r, 0.0, 1.0), 3.0) * 0.8;
      float a = vA * max(core, halo);
      if (a <= 0.003) discard;
      gl_FragColor = vec4(mix(uCol, vec3(1.0, 0.93, 0.8), core * 0.6) * a, a);
    }`;

  const HAZE_VERT = `
    varying float vY;
    void main() { vY = (modelMatrix * vec4(position, 1.0)).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const HAZE_FRAG = `
    uniform vec3 uCol;
    uniform float uAlpha;
    varying float vY;
    void main() { float a = uAlpha * 0.07 * exp(-pow((vY - 900.0) / 1100.0, 2.0)); gl_FragColor = vec4(uCol * a, a); }`;

  class Atmos {
    constructor(canvas, colors) {
      const T = window.THREE;
      this.T = T;
      this.renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true });
      this.renderer.setClearColor(0x000000, 0);
      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(36, 1920 / 1080, 20, 30000);
      // everything deck.js tweens
      this.state = { snow: 0, ridge: 0, left: 0.8, x: 0, y: 380, z: 0, lx: 0, ly: 120, lz: -6000, travel: 0, wind: 0 };
      const col = c => new T.Vector3(...c.map(v => v / 255));
      const bone = col(colors.bone), warm = col(colors.warm);
      const mat = (vertexShader, fragmentShader, uniforms, extra) => new T.ShaderMaterial({ vertexShader, fragmentShader, uniforms, transparent: true, depthTest: false, depthWrite: false, premultipliedAlpha: true, ...extra });

      this.dots = new T.Points(this.land(), mat(DOT_VERT, DOT_FRAG, { uK: { value: 1 }, uAlpha: { value: 0 }, uLeft: { value: 0.8 }, uCol: { value: bone } }));
      this.haze = new T.Mesh(new T.PlaneGeometry(40000, 8000), mat(HAZE_VERT, HAZE_FRAG, { uAlpha: { value: 0 }, uCol: { value: bone } }));
      this.haze.position.set(0, 1500, -11000);
      this.town = new T.Points(this.lights(), mat(GLOW_VERT, GLOW_FRAG, { uK: { value: 1 }, uAlpha: { value: 0 }, uTime: { value: 0 }, uCol: { value: warm } }, { blending: T.AdditiveBlending }));
      this.snow = new T.Points(this.flakes(1700), mat(SNOW_VERT, SNOW_FRAG, {
        uTime: { value: 0 }, uTravel: { value: 0 }, uWind: { value: 0 }, uK: { value: 1 }, uAlpha: { value: 0 }, uCam: { value: new T.Vector3() }, uCol: { value: bone } }));
      this.snow.frustumCulled = this.dots.frustumCulled = this.town.frustumCulled = false;
      [this.haze, this.dots, this.town, this.snow].forEach((o, i) => { o.renderOrder = i; this.scene.add(o); });
      this.blank = false;
    }

    // the mountains as rows of dots, spaced so they sit about evenly on screen, far rows first
    land() {
      const T = this.T, pos = [], size = [], shade = [];
      const L = new T.Vector3(-0.62, 0.5, -0.32).normalize();
      for (let d = 10500; d > 520; d /= 1.0088) {
        const step = d * 0.0088, half = d * 0.95, z = -d, odd = Math.round(Math.log(d) / Math.log(1.0088)) & 1;
        for (let x = -half + (odd ? step / 2 : 0); x < half; x += step) {
          const h = height(x, z), e = step;
          const nx = -(height(x + e, z) - height(x - e, z)) / (2 * e), nz = (height(x, z - e) - height(x, z + e)) / (2 * e);
          const n = new T.Vector3(nx, 1, nz).normalize();
          const lit = Math.max(0, n.dot(L)), facing = clamp(n.z * 2.2 + 0.25, 0, 1);   // slopes facing the camera read best
          const b = clamp(0.18 + 1.05 * lit + clamp((h - 300) / 1400, 0, 0.35), 0, 1.2);
          pos.push(x, h, z);
          size.push(0.9 + 2.9 * b * (0.45 + 0.55 * facing));
          shade.push(clamp(0.28 + 0.8 * b, 0, 1));
        }
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('aSize', new T.Float32BufferAttribute(size, 1));
      g.setAttribute('aShade', new T.Float32BufferAttribute(shade, 1));
      return g;
    }

    lights() {
      const T = this.T, r = rng(5), pos = [], size = [], phase = [];
      for (let i = 0; i < 70; i++) {
        const a = r() * Math.PI * 2, d = Math.pow(r(), 0.6) * 520;
        const x = TOWN.x + Math.cos(a) * d * 1.5, z = TOWN.z + Math.sin(a) * d;
        pos.push(x, height(x, z) + 10, z); size.push(4 + r() * 5); phase.push(r() * 40);
      }
      pos.push(TOWN.x, TOWN.y + 90, TOWN.z); size.push(240); phase.push(3);   // the glow over the town
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('aSize', new T.Float32BufferAttribute(size, 1));
      g.setAttribute('aPhase', new T.Float32BufferAttribute(phase, 1));
      return g;
    }

    flakes(n) {
      const T = this.T, r = rng(3), seed = [], move = [];
      for (let i = 0; i < n; i++) {
        seed.push(r(), r(), r());
        const s = Math.pow(r(), 2.2);                     // most flakes are small; a few drift close and big
        move.push(55 + 70 * r() + 60 * s, r() * 40, s);
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(new Array(n * 3).fill(0), 3));
      g.setAttribute('aSeed', new T.Float32BufferAttribute(seed, 3));
      g.setAttribute('aMove', new T.Float32BufferAttribute(move, 3));
      return g;
    }

    resize(scale) {
      const k = Math.min(2, scale * (window.devicePixelRatio || 1));
      this.renderer.setPixelRatio(k);
      this.renderer.setSize(1920, 1080, false);
      this.k = k;
    }

    render(time) {
      const s = this.state;
      if (s.snow < 0.004 && s.ridge < 0.004) {
        if (!this.blank) { this.renderer.clear(); this.blank = true; }
        return;
      }
      this.blank = false;
      const k = this.k || 1;
      this.camera.position.set(s.x, s.y, s.z);
      this.camera.lookAt(s.lx, s.ly, s.lz);
      this.dots.visible = this.town.visible = this.haze.visible = s.ridge > 0.004;
      const D = this.dots.material.uniforms, W = this.town.material.uniforms, N = this.snow.material.uniforms;
      D.uK.value = k; D.uAlpha.value = s.ridge; D.uLeft.value = s.left;
      this.haze.material.uniforms.uAlpha.value = s.ridge;
      W.uK.value = k; W.uAlpha.value = s.ridge; W.uTime.value = time;
      N.uK.value = k; N.uAlpha.value = s.snow; N.uTime.value = time; N.uTravel.value = s.travel; N.uWind.value = s.wind;
      N.uCam.value.copy(this.camera.position);
      this.renderer.render(this.scene, this.camera);
    }
  }
  Atmos.TOWN = TOWN;
  window.Atmos = Atmos;
})();
