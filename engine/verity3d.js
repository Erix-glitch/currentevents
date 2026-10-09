/* Verity, the smiley from MultiColor-AMS-Version.3mf, floating in front of the slides (three.js). The yellow ball is
   a sphere; the eyes and smile are the model's own meshes (engine/verity.js). deck.js moves her between spots on each
   slide and passes the camera the slides are seen through; she bobs, sways and keeps turning to look at you.
   A slide can show two of her (states[1]), and either can glow. */
(function () {
  'use strict';
  const bytes = b64 => { const s = atob(b64), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a.buffer; };

  class Verity3D {
    constructor(canvas, o) {
      const T = window.THREE;
      this.T = T;
      this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true });
      this.renderer.setClearColor(0x000000, 0);
      this.scene = new T.Scene();
      this.camera = new T.PerspectiveCamera(o.fov, 1920 / 1080, 5, 400000);
      this.camera.matrixAutoUpdate = false;
      // the desert's light: a warm low sun ahead and to the right, blue sky above, warm sand below
      this.scene.add(new T.HemisphereLight('#E8F2FF', '#F0CF9E', 1.5));
      const key = new T.DirectionalLight('#FFF4DE', 2.3);
      key.position.set(0.55, 0.65, 0.55);
      this.scene.add(key);
      const rim = new T.DirectionalLight('#FFE2A6', 1.1);
      rim.position.set(-0.7, 0.2, -0.7);
      this.scene.add(rim);

      const d = o.data, ball = new T.Group();
      ball.add(new T.Mesh(new T.SphereGeometry(0.988, 96, 64), new T.MeshPhongMaterial({ color: new T.Color(d.ball.color), specular: new T.Color('#5a5640'), shininess: 55 })));
      for (const part of d.parts) {
        const q = new Int16Array(bytes(part.pos)), pos = new Float32Array(q.length);
        for (let i = 0; i < q.length; i++) pos[i] = q[i] * part.scale;
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.BufferAttribute(pos, 3));
        g.setIndex(new T.BufferAttribute(new Uint16Array(bytes(part.idx)), 1));
        g.computeVertexNormals();
        ball.add(new T.Mesh(g, new T.MeshPhongMaterial({ color: new T.Color(part.color), specular: new T.Color('#2a2a2a'), shininess: 80 })));
      }
      ball.rotation.order = 'YXZ';
      // a soft yellow glow around her (like PowerPoint's glow effect), faded in with state.glow
      const gc = document.createElement('canvas');
      gc.width = gc.height = 256;
      const g = gc.getContext('2d'), grd = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      grd.addColorStop(0, 'rgba(255, 226, 74, 0.55)'); grd.addColorStop(0.5, 'rgba(255, 226, 74, 0.5)');
      grd.addColorStop(0.72, 'rgba(255, 226, 74, 0.2)'); grd.addColorStop(1, 'rgba(255, 226, 74, 0)');
      g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
      const glowTex = new T.CanvasTexture(gc);
      glowTex.colorSpace = T.SRGBColorSpace;
      // more than one Verity can be on a slide: each has its own ball (sharing the meshes), glow and state
      this.balls = [0, 1].map(i => {
        const b = i ? ball.clone() : ball;
        const halo = new T.Sprite(new T.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, opacity: 0 }));
        halo.renderOrder = -1;
        this.scene.add(halo, b);
        return { b, halo, phase: i * 2.1 };
      });
      this.ball = ball;
      this.eye = new T.Vector3();
      // where each one is, in the slides' 3D space (px; y down like the page), and how big; deck.js tweens these
      this.states = this.balls.map(() => ({ x: 0, y: 0, z: 0, r: 110, show: 0, spin: 0, lift: 0, glow: 0 }));
      this.state = this.states[0];
      this.blank = false;
    }

    resize(scale) {
      const k = Math.min(2, scale * (window.devicePixelRatio || 1));
      this.renderer.setPixelRatio(k);
      this.renderer.setSize(1920, 1080, false);
    }

    render(time, m) {
      if (this.states.every(s => s.show < 0.003)) {
        if (!this.blank) { this.renderer.clear(); this.blank = true; }
        return;
      }
      this.blank = false;
      const cam = this.camera;
      cam.matrix.copy(m);
      cam.matrixWorldNeedsUpdate = true;
      cam.updateMatrixWorld();
      this.balls.forEach(({ b, halo, phase }, i) => {
        const s = this.states[i], t = time + phase;
        b.visible = halo.visible = s.show >= 0.003;
        if (!b.visible) return;
        // floating: a slow bob and drift
        const bob = Math.sin(t * 1.35) * 14 + Math.sin(t * 0.53) * 6;
        b.position.set(s.x + Math.sin(t * 0.41) * 8, -(s.y + s.lift) + bob, s.z);
        b.scale.setScalar(s.r * s.show);
        halo.position.copy(b.position);
        halo.scale.setScalar(s.r * s.show * 3.3);
        halo.material.opacity = s.glow * Math.min(1, s.show);
        // she turns to look at the camera, glancing around a little
        this.eye.setFromMatrixPosition(cam.matrixWorld).sub(b.position);
        const yaw = Math.atan2(this.eye.x, this.eye.z), pitch = Math.atan2(this.eye.y, Math.hypot(this.eye.x, this.eye.z));
        b.rotation.set(-pitch * 0.85 + Math.sin(t * 0.9) * 0.07, yaw + Math.sin(t * 0.6) * 0.28 + s.spin * Math.PI / 180, Math.sin(t * 0.75) * 0.08);
      });
      this.renderer.render(this.scene, cam);
    }
  }
  window.Verity3D = Verity3D;
})();
