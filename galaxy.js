/* The galaxy of projects: a scroll-driven flight through particle clusters,
   one per project. Stars assemble on load, flee the cursor, blur out of focus,
   streak at warp speed, and a click dives into a project. */

(function () {
  var stops = Array.prototype.slice.call(document.querySelectorAll('.stop'));
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var small = innerWidth < 760;

  /* ---------- travel map, card reveals, videos that only play when seen ---------- */
  var map = document.querySelector('.map');
  var dots = stops.map(function (s) {
    var a = document.createElement('a');
    a.href = '#' + s.id; a.style.setProperty('--c', getComputedStyle(s).getPropertyValue('--c'));
    a.innerHTML = s.dataset.name + '<i></i>';
    map.appendChild(a); return a;
  });
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var v = e.target.querySelector('video');
      if (e.isIntersecting) { e.target.classList.add('in'); if (v && !reduced) v.play().catch(function () {}); }
      else if (v) v.pause();
    });
  }, { threshold: .35 });
  stops.forEach(function (s) { io.observe(s); });

  /* text decodes like a terminal: random glyphs settle into the real letters */
  var GLYPHS = '!<>-_\\/[]{}=+*^?#01ABCDEFXYZ';
  function scramble(el, delay) {
    if (reduced || el.dataset.done) return; el.dataset.done = 1;
    var final = el.textContent, frame = 0, total = 18 + final.length * 1.6;
    el.textContent = final.replace(/\S/g, ' ');
    setTimeout(function tick() {
      frame++;
      el.textContent = final.split('').map(function (ch, i) {
        if (ch === ' ') return ' ';
        var settle = (i / final.length) * total * .7 + 6;
        return frame >= settle ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }).join('');
      if (frame < total) requestAnimationFrame(tick); else el.textContent = final;
    }, delay || 0);
  }
  var sio = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.querySelectorAll('h2').forEach(function (el, i) { scramble(el, 150 + i * 120); });
      e.target.querySelectorAll('h1 .w').forEach(function (el, i) { scramble(el, 900 + i * 160); });
    });
  }, { threshold: .35 });
  stops.forEach(function (s) { sio.observe(s); });
  if (!window.THREE) { stops.forEach(function (s) { s.classList.add('in'); }); return; }

  /* ---------- renderer ---------- */
  var canvas = document.getElementById('sky');
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, powerPreference: 'high-performance' });
  var PR = Math.min(devicePixelRatio, small ? 1.5 : 2);
  renderer.setPixelRatio(PR);
  renderer.toneMapping = THREE.NoToneMapping; /* keep the colours saturated */
  var scene = new THREE.Scene();
  scene.background = new THREE.Color('#02030a');
  var camera = new THREE.PerspectiveCamera(52, 1, .1, 2000);

  var composer = null, bloom = null;
  if (THREE.EffectComposer && !small) {
    composer = new THREE.EffectComposer(renderer);
    composer.addPass(new THREE.RenderPass(scene, camera));
    bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .75, .45, .38);
    composer.addPass(bloom);
  }

  var R = Math.random;
  function gauss() { return (R() + R() + R() + R() - 2) / 2; }

  /* ---------- stars: glow, twinkle, depth blur, assemble on load, flee the cursor ---------- */
  var shared = {
    uTime: { value: 0 }, uPR: { value: PR }, uFocus: { value: 55 }, uIntro: { value: 0 },
    uMouse: { value: new THREE.Vector3(1e5, 1e5, 1e5) }, uPush: { value: 0 }
  };
  function starField(pos, cols, scales, opts) {
    opts = opts || {};
    var n = pos.length / 3, phase = new Float32Array(n), start = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      phase[i] = R();
      if (opts.assemble === false) { start[i*3] = pos[i*3]; start[i*3+1] = pos[i*3+1]; start[i*3+2] = pos[i*3+2]; }
      else { var u = R() * 2 - 1, th = R() * 6.283, s = Math.sqrt(1 - u * u), rr = 60 + R() * 140;
        start[i*3] = s * Math.cos(th) * rr; start[i*3+1] = u * rr; start[i*3+2] = s * Math.sin(th) * rr; }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    g.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
    var m = new THREE.ShaderMaterial({
      uniforms: {
        uTime: shared.uTime, uPR: shared.uPR, uFocus: shared.uFocus, uIntro: shared.uIntro, uMouse: shared.uMouse, uPush: shared.uPush,
        uSize: { value: opts.size || 1 }, uDof: { value: opts.dof == null ? 1 : opts.dof }, uGain: { value: opts.gain || 1 }, uBoost: { value: 0 }
      },
      vertexShader: [
        'attribute float aScale; attribute float aPhase; attribute vec3 color; attribute vec3 aStart;',
        'uniform float uTime, uSize, uPR, uFocus, uDof, uGain, uIntro, uPush, uBoost;',
        'uniform vec3 uMouse;',
        'varying vec3 vColor; varying float vAlpha; varying float vBlur;',
        'void main(){',
        '  float k = clamp(uIntro * 1.7 - aPhase * 0.7, 0.0, 1.0);',
        '  k = 1.0 - pow(1.0 - k, 3.0);',
        '  vec3 p = mix(aStart, position, k);',
        '  p += vec3(sin(uTime * 0.6 + aPhase * 40.0), cos(uTime * 0.5 + aPhase * 31.0), sin(uTime * 0.4 + aPhase * 17.0)) * 0.06;',
        '  vec4 world = modelMatrix * vec4(p, 1.0);',
        '  vec3 away = world.xyz - uMouse; float l = length(away);',
        '  world.xyz += normalize(away + 0.0001) * uPush * 3.4 * smoothstep(5.5, 0.0, l);',
        '  vec4 mv = viewMatrix * world;',
        '  float dist = max(-mv.z, 0.1);',
        '  float tw = 0.72 + 0.28 * sin(uTime * (1.2 + aPhase * 2.4) + aPhase * 6.2831);',
        '  float blur = clamp(abs(dist - uFocus) / (uFocus * 1.4), 0.0, 1.0) * uDof;',
        '  float size = uSize * aScale * uPR * (300.0 / dist) * (1.0 + blur * 1.3) * (1.0 + uBoost * 0.35);',
        '  gl_PointSize = clamp(size, 1.0, 140.0 * uPR);',
        '  vColor = color * tw * uGain * (1.0 + uBoost * 0.6);',
        '  vAlpha = (1.0 - blur * 0.85) / (1.0 + blur * 4.0) * smoothstep(1.5, 8.0, dist) * mix(0.25, 1.0, k);',
        '  vBlur = blur;',
        '  gl_Position = projectionMatrix * mv;',
        '}'].join('\n'),
      fragmentShader: [
        'varying vec3 vColor; varying float vAlpha; varying float vBlur;',
        'void main(){',
        '  float d = length(gl_PointCoord - 0.5) * 2.0;',
        '  if (d > 1.0) discard;',
        '  float core = pow(1.0 - d, mix(7.0, 1.7, vBlur));',
        '  float halo = pow(1.0 - d, 2.2) * 0.3 * (1.0 - vBlur);',
        '  float a = (core + halo) * vAlpha;',
        '  vec3 hot = mix(vColor, vec3(1.0), pow(core, 3.0) * 0.55);',
        '  gl_FragColor = vec4(hot * a, a);',
        '}'].join('\n'),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    return new THREE.Points(g, m);
  }
  /* saturated colours: vary hue a touch, darken some, never wash toward white */
  function tinted(n, base, hueSpread, opts) {
    opts = opts || {};
    var cols = new Float32Array(n * 3), b = new THREE.Color(base), c = new THREE.Color(), alt = opts.alt ? new THREE.Color(opts.alt) : null;
    for (var i = 0; i < n; i++) {
      c.copy(b); if (alt && R() < .3) c.lerp(alt, R());
      c.offsetHSL((R() - .5) * hueSpread, .15, -R() * .18);
      cols.set([c.r, c.g, c.b], i * 3);
    }
    return cols;
  }
  function scaleSet(n, lo, hi, bright) {
    var s = new Float32Array(n);
    for (var i = 0; i < n; i++) s[i] = lo + Math.pow(R(), 3) * (hi - lo) * (R() < (bright || .02) ? 3 : 1);
    return s;
  }

  function canvasTex(draw, size) { var c = document.createElement('canvas'); c.width = c.height = size || 256; draw(c.getContext('2d'), c.width); return new THREE.CanvasTexture(c); }
  var glowTex = canvasTex(function (g, s) {
    var gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.12, 'rgba(255,255,255,.7)'); gr.addColorStop(.4, 'rgba(255,255,255,.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
  });
  var flareTex = canvasTex(function (g, s) {
    var h = s / 2, gr = g.createRadialGradient(h, h, 0, h, h, h * .5);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.2, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    [0, Math.PI / 2, Math.PI / 4, -Math.PI / 4].forEach(function (a, k) {
      var len = k < 2 ? h : h * .45, w = k < 2 ? 2.2 : 1.2;
      g.save(); g.translate(h, h); g.rotate(a);
      var lg = g.createLinearGradient(-len, 0, len, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.5, 'rgba(255,255,255,.9)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg; g.fillRect(-len, -w / 2, len * 2, w); g.restore();
    });
  });
  var nebulaTex = canvasTex(function (g, s) {
    for (var i = 0; i < 110; i++) {
      var x = s / 2 + gauss() * s * .3, y = s / 2 + gauss() * s * .3, r = s * (.05 + R() * .2);
      var gr = g.createRadialGradient(x, y, 0, x, y, r);
      var a = .05 + R() * .08; gr.addColorStop(0, 'rgba(255,255,255,' + a + ')'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }
  }, 512);
  function sprite(tex, color, scale, opacity) {
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: color, transparent: true, opacity: opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.set(scale, scale, 1); return sp;
  }

  /* ---------- shapes: each project gets a form that says what it does ---------- */
  var SHAPES = {
    eye: function (n) { var p = new Float32Array(n * 3); for (var i = 0; i < n; i++) {
      var k = i % 6;
      if (k === 0) { var a = R() * 6.283, r = 3.1 + gauss() * .3; p.set([Math.cos(a) * r, Math.sin(a) * r, 4.4 + gauss() * .15], i * 3); }
      else if (k === 1) { var a2 = R() * 6.283, r2 = Math.sqrt(R()) * 1.5; p.set([Math.cos(a2) * r2, Math.sin(a2) * r2, 4.9], i * 3); }
      else { var u = R() * 2 - 1, t = R() * 6.283, s = Math.sqrt(1 - u * u), rr = 5 + gauss() * .22; p.set([s * Math.cos(t) * rr, u * rr, s * Math.sin(t) * rr], i * 3); } } return p; },
    plume: function (n) { var p = new Float32Array(n * 3); for (var i = 0; i < n; i++) {
      var x = Math.pow(R(), .85) * 17, w = .35 + x * .34, sw = Math.sin(x * .5) * x * .06;
      p.set([x - 8.5, gauss() * w * .7 + x * .1 + sw, gauss() * w], i * 3); } return p; },
    beams: function (n) { var p = new Float32Array(n * 3); for (var i = 0; i < n; i++) {
      var side = i % 2 ? 1 : -1, d = Math.pow(R(), .7) * 16, w = .2 + d * .24;
      p.set([side * 1.9 + gauss() * w + side * d * .07, gauss() * w * .45, 7 - d], i * 3); } return p; },
    flower: function (n) { var p = new Float32Array(n * 3); for (var i = 0; i < n; i++) {
      var a = R() * 6.283, k = Math.abs(Math.cos(a * 3)), r = (Math.pow(R(), .6) * .9 + .1) * 6 * k, cup = r * r * .05;
      p.set([Math.cos(a) * r, Math.sin(a) * r, gauss() * .35 + cup], i * 3); } return p; },
    check: function (n) { var p = new Float32Array(n * 3); for (var i = 0; i < n; i++) {
      var t = R(), x, y; if (t < .33) { var s = t / .33; x = -5.5 + s * 3.2; y = 1 - s * 3.2; } else { var s2 = (t - .33) / .67; x = -2.3 + s2 * 8; y = -2.2 + s2 * 7.6; }
      p.set([x + gauss() * .38, y + gauss() * .38, gauss() * .55], i * 3); } return p; },
    star: function (n) { var p = new Float32Array(n * 3); for (var i = 0; i < n; i++) {
      var a = R() * 6.283, seg = (a / 6.283 * 10) % 2, f = seg < 1 ? seg : 2 - seg, edge = 2.4 + 3.6 * (1 - f), r = Math.pow(R(), .45) * edge;
      p.set([Math.cos(a - Math.PI / 2) * r, -Math.sin(a - Math.PI / 2) * r, gauss() * .7 * (1 - r / 6)], i * 3); } return p; },
    ring: function (n) { var p = new Float32Array(n * 3); for (var i = 0; i < n; i++) {
      var a = R() * 6.283, r = 6.2 + gauss() * .45, tube = gauss() * .45; p.set([Math.cos(a) * (r + tube), Math.sin(a) * (r + tube), gauss() * .45], i * 3); } return p; }
  };

  var C = small ? 4000 : 12000;
  /* each project: its colour plus a second hue mixed in, so nothing looks flat */
  var plan = [
    { at: [0, 0, 0] },
    { shape: 'eye',    color: '#18e3f2', alt: '#3d6bff', at: [40, 6, -100] },
    { shape: 'plume',  color: '#5dff4a', alt: '#e6ff3a', at: [-32, -8, -200] },
    { shape: 'beams',  color: '#ff9a1f', alt: '#ff3d5e', at: [36, 10, -300] },
    { shape: 'flower', color: '#9a7bff', alt: '#ff6be6', at: [-36, 0, -400] },
    { shape: 'check',  color: '#ff3d86', alt: '#ff9a3d', at: [32, -10, -500] },
    { shape: 'star',   color: '#c447ff', alt: '#ff63c8', at: [-30, 8, -600] },
    { shape: 'ring',   color: '#b6ff2e', alt: '#2effc4', at: [0, 0, -700] }
  ];

  /* the home galaxy: gold core, hot pink and violet arms, blue rim */
  var home = new THREE.Group(); scene.add(home);
  (function () {
    var n = small ? 22000 : 70000, pos = new Float32Array(n * 3), cols = new Float32Array(n * 3), sc = new Float32Array(n);
    var core = new THREE.Color('#ffc65c'), mid = new THREE.Color('#ff3fa0'), mid2 = new THREE.Color('#8a4dff'), outer = new THREE.Color('#2f7bff'), c = new THREE.Color();
    for (var i = 0; i < n; i++) {
      var bulge = i < n * .13, r, a, y;
      if (bulge) { r = Math.abs(gauss()) * 5; a = R() * 6.283; y = gauss() * 2.4 * (1 - r / 7); }
      else { var arm = i % 3; r = 3 + Math.pow(R(), .8) * 30; a = r * .26 + arm * 2.094 + gauss() * (.25 + r * .006); y = gauss() * (1.3 - r * .025); }
      var x = Math.cos(a) * r + gauss() * (bulge ? 0 : 1.2), z = Math.sin(a) * r + gauss() * (bulge ? 0 : 1.2);
      pos.set([x, y, z], i * 3);
      var f = Math.min(1, r / 30);
      if (f < .3) c.copy(core).lerp(mid, f / .3); else if (f < .6) c.copy(mid).lerp(mid2, (f - .3) / .3); else c.copy(mid2).lerp(outer, (f - .6) / .4);
      if (R() < .03) c.set('#bfe1ff');
      c.offsetHSL((R() - .5) * .04, .1, -R() * .15);
      cols.set([c.r, c.g, c.b], i * 3);
      sc[i] = (bulge ? .35 : .28) + Math.pow(R(), 4) * 1.6;
    }
    home.add(starField(pos, cols, sc, { size: .78, gain: .95 }));
    home.add(sprite(glowTex, '#ffb85c', 13, .55));
    home.add(sprite(glowTex, '#ff3fa0', 58, .12));
  })();
  home.rotation.x = .55;

  /* project clusters, each with a heart and an orbiting ring of sparks */
  var bodies = [], orbits = [], bodyMats = [];
  plan.forEach(function (p, k) {
    if (!p.shape) return;
    var g = new THREE.Group(); g.position.fromArray(p.at); scene.add(g);
    var pts = starField(SHAPES[p.shape](C), tinted(C, p.color, .05, { alt: p.alt }), scaleSet(C, .22, .9, .03), { size: .9, gain: 1.05 });
    g.add(pts);
    g.add(sprite(glowTex, p.color, 7, .45));
    g.add(sprite(glowTex, p.alt, 30, .08));
    var on = small ? 500 : 1400, op = new Float32Array(on * 3);
    for (var i = 0; i < on; i++) { var a = R() * 6.283, r = 9 + gauss() * 1.2; op.set([Math.cos(a) * r, gauss() * .3, Math.sin(a) * r], i * 3); }
    var orbit = starField(op, tinted(on, p.alt, .06), scaleSet(on, .15, .5), { size: .9, gain: .9 });
    orbit.rotation.x = 1.1 + k * .2; orbit.rotation.z = k * .7;
    g.add(orbit); orbits.push(orbit);
    bodies.push(g); bodyMats.push([pts.material, orbit.material]);
  });

  /* deep field, dust, flaring stars, coloured nebulae */
  (function () {
    var n = small ? 6000 : 16000, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) pos.set([(R() - .5) * 900, (R() - .5) * 600, 150 - R() * 1100], i * 3);
    scene.add(starField(pos, tinted(n, '#bcd0ff', .5, { alt: '#ffd6f0' }), scaleSet(n, .25, 1.3, .03), { size: 1.3, dof: 0, gain: .8, assemble: false }));
    var d = small ? 1500 : 4500, dp = new Float32Array(d * 3);
    for (var j = 0; j < d; j++) {
      var tz = 60 - R() * 800, ang = R() * 6.283, rad = 4 + R() * 40;
      dp.set([Math.cos(ang) * rad + Math.sin(tz * .01) * 30, Math.sin(ang) * rad * .7, tz], j * 3);
    }
    scene.add(starField(dp, tinted(d, '#dfe6ff', .2), scaleSet(d, .12, .35), { size: .8, gain: .55, assemble: false }));
    for (var h = 0; h < (small ? 25 : 60); h++) {
      var f = sprite(flareTex, ['#ffffff', '#9fc4ff', '#ffd08a', '#ff9fd6'][h % 4], 4 + R() * 8, .65);
      f.position.set((R() - .5) * 260, (R() - .5) * 160, 40 - R() * 800); scene.add(f);
    }
    var neb = ['#5b1fd6', '#0a8fb0', '#c4126a', '#1f9a3a', '#d65a0a', '#2a3dd6'];
    for (var q = 0; q < 16; q++) {
      var ns = sprite(nebulaTex, neb[q % neb.length], 220 + R() * 260, .17);
      ns.position.set((R() - .5) * 360, (R() - .5) * 200, 20 - q * 48 - R() * 30);
      ns.material.rotation = R() * 6.283; scene.add(ns);
    }
  })();

  /* warp streaks: invisible at rest, stretching into lines when you fly */
  var warpMat;
  (function () {
    var n = small ? 500 : 1400, pos = new Float32Array(n * 6), end = new Float32Array(n * 2), cols = new Float32Array(n * 6);
    var palette = ['#9fd8ff', '#ffffff', '#ff9fe0', '#c8b4ff'].map(function (c) { return new THREE.Color(c); });
    for (var i = 0; i < n; i++) {
      var tz = 80 - R() * 860, ang = R() * 6.283, rad = 6 + R() * 50, x = Math.cos(ang) * rad + Math.sin(tz * .01) * 30, y = Math.sin(ang) * rad * .7;
      pos.set([x, y, tz, x, y, tz], i * 6); end.set([0, 1], i * 2);
      var c = palette[i % 4]; cols.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    warpMat = new THREE.ShaderMaterial({
      uniforms: { uDir: { value: new THREE.Vector3(0, 0, 1) }, uStretch: { value: 0 }, uOpacity: { value: 0 } },
      vertexShader: 'attribute float aEnd; attribute vec3 color; uniform vec3 uDir; uniform float uStretch; varying float vT; varying vec3 vC;' +
        'void main(){ vT = aEnd; vC = color; vec3 p = position + uDir * uStretch * aEnd; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
      fragmentShader: 'uniform float uOpacity; varying float vT; varying vec3 vC; void main(){ float a = uOpacity * (1.0 - vT); gl_FragColor = vec4(vC * a, a); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    });
    scene.add(new THREE.LineSegments(g, warpMat));
  })();

  /* shooting stars */
  var shooters = [];
  for (var s = 0; s < 3; s++) {
    var sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array([1, 1, 1, 0, 0, 0]), 3));
    var line = new THREE.Line(sg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    line.visible = false; scene.add(line);
    shooters.push({ line: line, life: 0, wait: 2 + R() * 6, from: new THREE.Vector3(), dir: new THREE.Vector3() });
  }

  /* ---------- flight path: the cluster lands on the right, beside the porthole ---------- */
  var views = plan.map(function (p, k) {
    var at = new THREE.Vector3().fromArray(p.at);
    if (k === 0) return { pos: new THREE.Vector3(-12, 26, 50), look: new THREE.Vector3(-20, 3, 0) };
    if (k === plan.length - 1) return { pos: at.clone().add(new THREE.Vector3(-8, 0, 24)), look: at.clone().add(new THREE.Vector3(-8, 0, 0)) };
    var off = small ? new THREE.Vector3(0, 7, 27) : new THREE.Vector3(-12, 3, 25);
    var look = small ? at.clone().add(new THREE.Vector3(0, 4.5, 0)) : at.clone().add(new THREE.Vector3(-12, 1, 0));
    return { pos: at.clone().add(off), look: look };
  });
  var posCurve = new THREE.CatmullRomCurve3(views.map(function (v) { return v.pos; }), false, 'centripetal');
  var lookCurve = new THREE.CatmullRomCurve3(views.map(function (v) { return v.look; }), false, 'centripetal');

  function progress() {
    var mid = scrollY + innerHeight / 2, k = 0;
    for (var i = 0; i < stops.length; i++) if (stops[i].offsetTop + stops[i].offsetHeight / 2 <= mid) k = i;
    var a = stops[k], b = stops[Math.min(k + 1, stops.length - 1)];
    var ca = a.offsetTop + a.offsetHeight / 2, cb = b.offsetTop + b.offsetHeight / 2;
    var f = cb > ca ? Math.min(1, Math.max(0, (mid - ca) / (cb - ca))) : 0;
    f = f * f * (3 - 2 * f);
    return { t: (k + f) / (stops.length - 1), near: f < .5 ? k : Math.min(k + 1, stops.length - 1) };
  }

  /* ---------- sound: a space hum, a whoosh while flying, a chime on arrival, a rush on the dive ---------- */
  var audio = null, soundBtn = document.querySelector('.sound');
  function soundOn() { return audio && soundBtn.getAttribute('aria-pressed') === 'true'; }
  function startAudio() {
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
    var ctx = new AC(), master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    var verb = ctx.createConvolver(), len = ctx.sampleRate * 3.5, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) { var dd = ir.getChannelData(ch); for (var i = 0; i < len; i++) dd[i] = (R() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    verb.buffer = ir; var wet = ctx.createGain(); wet.gain.value = .55; verb.connect(wet); wet.connect(master);
    var hum = ctx.createGain(); hum.gain.value = .07; hum.connect(master); hum.connect(verb);
    [55, 82.4, 110.2].forEach(function (f, k) {
      var o = ctx.createOscillator(); o.type = k ? 'sine' : 'triangle'; o.frequency.value = f;
      var lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = .05 + k * .03; lg.gain.value = 1.4; lfo.connect(lg); lg.connect(o.detune);
      o.connect(hum); o.start(); lfo.start();
    });
    var nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
    for (var j = 0; j < nd.length; j++) nd[j] = R() * 2 - 1;
    var noise = ctx.createBufferSource(); noise.buffer = nb; noise.loop = true;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = .9; bp.frequency.value = 300;
    var wg = ctx.createGain(); wg.gain.value = 0;
    noise.connect(bp); bp.connect(wg); wg.connect(master); wg.connect(verb); noise.start();
    function chime(baseHz, loud) {
      var now = ctx.currentTime;
      [1, 1.5, 2, 3].forEach(function (m, k) {
        var o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = baseHz * m;
        g.gain.setValueAtTime(0, now + k * .07);
        g.gain.linearRampToValueAtTime((loud || .09) / (k + 1), now + k * .07 + .02);
        g.gain.exponentialRampToValueAtTime(.0001, now + k * .07 + 2.6);
        o.connect(g); g.connect(master); g.connect(verb); o.start(now + k * .07); o.stop(now + k * .07 + 2.8);
      });
    }
    function swell() {
      var now = ctx.currentTime;
      wg.gain.cancelScheduledValues(now); wg.gain.setValueAtTime(wg.gain.value, now); wg.gain.linearRampToValueAtTime(.8, now + .9);
      bp.frequency.cancelScheduledValues(now); bp.frequency.setValueAtTime(200, now); bp.frequency.exponentialRampToValueAtTime(5000, now + 1);
    }
    return { ctx: ctx, master: master, whoosh: wg, band: bp, chime: chime, swell: swell };
  }
  var NOTES = [261.6, 329.6, 392, 440, 493.9, 587.3, 659.3, 784];
  /* sound is on by default. Browsers only let a page make noise once the visitor
     has interacted, so it starts right away where allowed and otherwise on the
     first click, tap or key press. The button turns it off. */
  function setSound(on) {
    soundBtn.setAttribute('aria-pressed', on); soundBtn.textContent = on ? 'Sound on' : 'Sound off';
    if (!audio) return;
    audio.master.gain.cancelScheduledValues(audio.ctx.currentTime);
    audio.master.gain.setValueAtTime(audio.master.gain.value, audio.ctx.currentTime);
    audio.master.gain.linearRampToValueAtTime(on ? .9 : 0, audio.ctx.currentTime + .8);
  }
  function wake() {
    if (soundBtn.getAttribute('aria-pressed') !== 'true') return;
    if (!audio) { audio = startAudio(); if (!audio) return; }
    var go = function () { if (audio.ctx.state === 'running' && !audio.greeted) { audio.greeted = true; setSound(true); audio.chime(NOTES[0]); } };
    if (audio.ctx.state === 'suspended') audio.ctx.resume().then(go).catch(function () {}); else go();
  }
  wake(); /* plays immediately if the browser already allows it */
  ['pointerdown', 'keydown', 'touchend'].forEach(function (ev) {
    addEventListener(ev, function (e) { if (e.target.closest && e.target.closest('.sound')) return; wake(); }, { passive: true });
  });
  soundBtn.addEventListener('click', function () {
    var on = soundBtn.getAttribute('aria-pressed') !== 'true';
    setSound(on);
    if (on) wake();
  });

  /* ---------- pointer: parallax, particles flee, hover a cluster to dive ---------- */
  var mouse = { x: 0, y: 0, px: -1, py: -1 }, eased = { x: 0, y: 0 };
  var diveTag = document.querySelector('.dive'), flash = document.querySelector('.flash');
  addEventListener('pointermove', function (e) { mouse.x = e.clientX / innerWidth - .5; mouse.y = e.clientY / innerHeight - .5; mouse.px = e.clientX; mouse.py = e.clientY; });
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3(), tmp = new THREE.Vector3();
  var hoverIdx = -1, diving = null;

  function overUI(x, y) {
    var el = document.elementFromPoint(x, y);
    return !!(el && el.closest && el.closest('.card a, .card button, .port, .bar, .map'));
  }
  document.addEventListener('click', function (e) {
    if (hoverIdx < 1 || diving || overUI(e.clientX, e.clientY)) return;
    var href = stops[hoverIdx] && stops[hoverIdx].dataset.href; if (!href) return;
    diving = { start: performance.now(), href: href, center: bodies[hoverIdx - 1].position.clone() };
    if (soundOn()) { audio.swell(); audio.chime(NOTES[hoverIdx % NOTES.length] * 2, .12); }
  });

  function size() {
    var w = innerWidth, h = innerHeight; renderer.setSize(w, h, false);
    if (composer) composer.setSize(w, h);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  size(); addEventListener('resize', size);

  /* ---------- loop ---------- */
  var clockStart = performance.now(), t = 0, current = -1, lastNear = -1, roll = 0, focus = 55, push = 0;
  var target = new THREE.Vector3(), look = new THREE.Vector3(), fwd = new THREE.Vector3();
  function frame(now) {
    t += .016;
    var sp = progress(), prev = current;
    current = current < 0 ? sp.t : current + (sp.t - current) * (reduced ? 1 : .055);
    var speed = Math.abs(current - prev) * 60;
    posCurve.getPoint(current, target); lookCurve.getPoint(current, look);
    eased.x += (mouse.x - eased.x) * .05; eased.y += (mouse.y - eased.y) * .05;
    camera.position.set(target.x + eased.x * 7, target.y - eased.y * 5, target.z);

    /* the dive: rush into the cluster, flash, open the case study */
    if (diving) {
      var dt = Math.min(1, (performance.now() - diving.start) / 1100), e = dt * dt * dt;
      camera.position.lerp(diving.center, e * .92);
      look.lerp(diving.center, Math.min(1, dt * 2));
      if (dt > .75) flash.classList.add('on');
      if (dt >= 1 && !diving.left) { diving.left = true; location.href = diving.href; }
    }
    camera.lookAt(look);
    roll += (((current - (prev < 0 ? current : prev)) * 220) - roll) * .05;
    camera.rotateZ(Math.max(-.25, Math.min(.25, roll)));

    /* stars assemble on load */
    shared.uIntro.value = reduced ? 1 : Math.min(1, (now - clockStart) / 3200);

    /* focus + glow */
    var fTarget = sp.near === 0 ? 55 : 25;
    focus += (fTarget * (1 + speed * 6) - focus) * .08;
    shared.uTime.value = t; shared.uFocus.value = focus;
    if (bloom) bloom.strength = .75 + Math.min(.5, speed * 6) + (diving ? 1.2 : 0);

    /* warp streaks along the direction of travel */
    camera.getWorldDirection(fwd);
    warpMat.uniforms.uDir.value.copy(fwd).multiplyScalar(-1);
    warpMat.uniforms.uStretch.value = Math.min(40, speed * 900) + (diving ? 30 : 0);
    warpMat.uniforms.uOpacity.value = Math.min(.9, speed * 18) + (diving ? .9 : 0);

    /* pointer: the point under the cursor on the nearest cluster's plane */
    hoverIdx = -1;
    if (mouse.px >= 0) {
      ndc.set(mouse.px / innerWidth * 2 - 1, -(mouse.py / innerHeight) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (sp.near > 0 && sp.near <= bodies.length) {
        var b = bodies[sp.near - 1];
        plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(tmp).negate(), b.position);
        if (ray.ray.intersectPlane(plane, hit)) {
          shared.uMouse.value.copy(hit);
          if (hit.distanceTo(b.position) < 8.5 && !overUI(mouse.px, mouse.py)) hoverIdx = sp.near;
        }
      } else if (sp.near === 0) {
        plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0).applyQuaternion(home.quaternion), home.position);
        if (ray.ray.intersectPlane(plane, hit)) shared.uMouse.value.copy(hit);
      }
    }
    push += ((mouse.px >= 0 && !reduced ? 1 : 0) - push) * .08;
    shared.uPush.value = push;

    document.body.classList.toggle('hovering-cluster', hoverIdx > 0);
    diveTag.classList.toggle('on', hoverIdx > 0 && !diving);
    if (hoverIdx > 0) {
      diveTag.style.left = mouse.px + 'px'; diveTag.style.top = mouse.py + 'px';
      diveTag.style.setProperty('--c', getComputedStyle(stops[hoverIdx]).getPropertyValue('--c'));
    }
    bodyMats.forEach(function (ms, k) {
      var want = (k + 1 === hoverIdx) ? 1 : 0;
      ms.forEach(function (m) { m.uniforms.uBoost.value += (want - m.uniforms.uBoost.value) * .1; });
    });

    /* motion */
    home.rotation.y = t * .025;
    bodies.forEach(function (bd, k) { bd.rotation.y = Math.sin(t * .3 + k) * .3; bd.rotation.x = Math.sin(t * .22 + k * 2) * .1; });
    orbits.forEach(function (o, k) { o.rotation.y = t * (.12 + k * .02); });

    /* shooting stars, now and then, somewhere ahead */
    shooters.forEach(function (sh) {
      if (sh.life <= 0) {
        sh.wait -= .016; sh.line.visible = false;
        if (sh.wait <= 0 && !reduced) {
          sh.life = 1; sh.wait = 4 + R() * 8;
          sh.from.copy(camera.position).add(fwd.clone().multiplyScalar(60 + R() * 80)).add(new THREE.Vector3((R() - .5) * 80, 10 + R() * 30, 0));
          sh.dir.set(-(.6 + R() * .6), -(.3 + R() * .4), (R() - .5) * .3).normalize();
        }
        return;
      }
      sh.life -= .022;
      var head = sh.from.clone().add(sh.dir.clone().multiplyScalar((1 - sh.life) * 70));
      var tail = head.clone().sub(sh.dir.clone().multiplyScalar(9));
      var a = sh.line.geometry.attributes.position; a.setXYZ(0, head.x, head.y, head.z); a.setXYZ(1, tail.x, tail.y, tail.z); a.needsUpdate = true;
      sh.line.material.opacity = Math.sin(sh.life * Math.PI); sh.line.visible = true;
    });

    if (audio && !diving) {
      var at = audio.ctx.currentTime;
      audio.whoosh.gain.setTargetAtTime(Math.min(.55, speed * 9), at, .12);
      audio.band.frequency.setTargetAtTime(220 + Math.min(2400, speed * 26000), at, .15);
    }
    if (sp.near !== lastNear) {
      if (lastNear !== -1 && soundOn()) audio.chime(NOTES[sp.near % NOTES.length]);
      lastNear = sp.near;
      dots.forEach(function (d, k) { d.classList.toggle('on', k === sp.near); });
    }
    if (composer) composer.render(); else renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  /* coming back from a case study: clear the flash */
  addEventListener('pageshow', function () { flash.classList.remove('on'); diving = null; });
})();
