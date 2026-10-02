/* Motion for the portfolio: entrance, scroll reveals, and cover tilt.
   Everything here is opt-out under prefers-reduced-motion. */

(function () {
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---- mark things that should animate in ---- */
  var targets = document.querySelectorAll(
    '.shelf > .book, section > .eyebrow, section > h2, .narrow, ' +
    '.case-summary, figure, .cards > .card, .steps > .step, .severity > .sev-row, ' +
    '.metrics > .metric, .stack-row, .pull, .note, .next, .repos > .repo, .trace'
  );

  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-in'); });
    return;
  }

  targets.forEach(function (el) { el.classList.add('will-reveal'); });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      /* stagger siblings so a row of covers deals itself out */
      var sibs = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.transitionDelay = Math.min(sibs, 6) * 70 + 'ms';
      el.classList.add('is-in');
      io.unobserve(el);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  targets.forEach(function (el) { io.observe(el); });

  /* ---- pointer tilt on the book covers ---- */
  document.querySelectorAll('.book').forEach(function (book) {
    var frame = null;

    book.addEventListener('pointermove', function (e) {
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = null;
        var r = book.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        book.style.setProperty('--rx', (-py * 5).toFixed(2) + 'deg');
        book.style.setProperty('--ry', (px * 6).toFixed(2) + 'deg');
        book.style.setProperty('--mx', (px * 14).toFixed(1) + 'px');
        book.style.setProperty('--my', (py * 10).toFixed(1) + 'px');
      });
    });

    book.addEventListener('pointerleave', function () {
      book.style.setProperty('--rx', '0deg');
      book.style.setProperty('--ry', '0deg');
      book.style.setProperty('--mx', '0px');
      book.style.setProperty('--my', '0px');
    });
  });
})();

/* Hero: the questions panel and the avatar that looks toward the pointer. */

(function () {
  var wonder = document.querySelector('.wonder');
  if (!wonder) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var items = Array.prototype.slice.call(wonder.querySelectorAll('.wonder-item'));
  var dotsBox = wonder.querySelector('.wonder-dots');
  var count = wonder.querySelector('.wonder-count');
  var avatar = wonder.querySelector('.wonder-avatar');
  var current = 0;
  var timer = null;

  var dots = items.map(function (item, i) {
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'wonder-dot';
    dot.setAttribute('aria-label', 'Question ' + (i + 1) + ': ' + item.querySelector('.wonder-q').textContent);
    dot.addEventListener('click', function () { stop(); show(i); });
    dotsBox.appendChild(dot);
    return dot;
  });

  function show(i) {
    current = (i + items.length) % items.length;
    items.forEach(function (item, n) {
      item.classList.toggle('is-on', n === current);
      dots[n].setAttribute('aria-current', n === current ? 'true' : 'false');
    });
    wonder.style.setProperty('--tint', items[current].style.getPropertyValue('--tint'));
    count.textContent = (current + 1) + ' of ' + items.length;

    if (!reduced) {
      avatar.classList.remove('is-hop');
      void avatar.getBoundingClientRect();
      avatar.classList.add('is-hop');
    }
  }

  /* turns the page on its own until someone takes over */
  function stop() { clearInterval(timer); timer = null; }

  wonder.querySelector('.wonder-next').addEventListener('click', function () {
    stop();
    show(current + 1);
  });

  wonder.classList.add('is-live');
  show(0);

  if (!reduced) {
    timer = setInterval(function () {
      if (wonder.matches(':hover') || wonder.contains(document.activeElement)) return;
      show(current + 1);
    }, 7000);

    /* ---- eyes follow the pointer ---- */
    var frame = null;
    window.addEventListener('pointermove', function (e) {
      if (frame) return;
      frame = requestAnimationFrame(function () {
        frame = null;
        var r = avatar.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        var reach = Math.min(dist / 240, 1);
        avatar.style.setProperty('--lx', (dx / dist * reach).toFixed(3));
        avatar.style.setProperty('--ly', (dy / dist * reach).toFixed(3));
      });
    });
  }
})();

/* Bloom case study: pick a loan length, see the yield and what it means. */

(function () {
  var demo = document.querySelector('.demo');
  if (!demo) return;

  var bars = Array.prototype.slice.call(demo.querySelectorAll('.demo-bar'));
  var range = demo.querySelector('.demo-range');
  var yieldEl = demo.querySelector('.demo-yield b');
  var termEl = demo.querySelector('.demo-yield span');
  var sayEl = demo.querySelector('.demo-say');
  var lessonEl = demo.querySelector('.demo-lesson');

  function lesson(years) {
    if (years < 1) return 'Short loans pay a little less, but your money is back quickly. Good for cash you will need soon.';
    if (years < 10) return 'A middle road: a better rate than the shortest bills, without tying your money up for decades.';
    return 'Long loans usually pay the most, because you wait the longest. Sell early and the price may be lower than you paid.';
  }

  function pick(i) {
    var bar = bars[i];
    var years = parseFloat(bar.getAttribute('data-years'));
    var rate = parseFloat(bar.getAttribute('data-yield'));
    var label = bar.getAttribute('data-label');
    var back = years < 1 ? 1000 * (1 + rate / 100 * years) : 1000 * Math.pow(1 + rate / 100, years);

    bars.forEach(function (b, n) { b.setAttribute('aria-pressed', n === i ? 'true' : 'false'); });
    range.value = i;
    yieldEl.textContent = rate.toFixed(2) + '%';
    termEl.textContent = 'a year, for ' + label;
    sayEl.innerHTML = 'Lend the US government $1,000 for ' + label + ' and you get back about <b>$' +
      Math.round(back).toLocaleString('en-US') + '</b>.';
    lessonEl.textContent = lesson(years);
  }

  bars.forEach(function (bar, i) { bar.addEventListener('click', function () { pick(i); }); });
  range.addEventListener('input', function () { pick(parseInt(range.value, 10)); });
})();

/* Recordings loop on their own unless the visitor prefers reduced motion. */

(function () {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('video[autoplay]').forEach(function (video) {
    video.removeAttribute('autoplay');
    video.pause();
  });
})();

/* Perceptra case study: the particle sphere from the product's landing page.
   It turns on its own and leans toward the pointer. */

(function () {
  var canvas = document.querySelector('.orb-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var LINK_DIST = 0.18, CAM_Z = 2.7, FOCAL = 2.25;
  var w = 0, h = 0, yaw = 0, pitch = 0.22, t = 0, raf = 0, visible = true;
  var aimX = 0, aimY = 0, leanX = 0, leanY = 0;
  var pts = [], links = [];

  function shell(n, radius, size) {
    var golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = 1 - (i / (n - 1)) * 2;
      var r = Math.sqrt(Math.max(0, 1 - y * y)) * radius;
      pts.push({
        x: Math.cos(golden * i) * r, y: y * radius, z: Math.sin(golden * i) * r,
        phase: Math.random() * 6.283, speed: 0.55 + Math.random() * 1.35,
        size: size * (0.5 + Math.random() * 0.95), bright: 0.5 + Math.random() * 0.5
      });
    }
  }

  shell(360, 1, 0.7);
  shell(65, 0.58, 0.42);
  for (var i = 0; i < pts.length; i += 3) {
    var near = [];
    for (var j = i + 1; j < pts.length; j++) {
      var dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, dz = pts[i].z - pts[j].z;
      var d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < LINK_DIST && d > 0.02) near.push({ i: i, j: j, d: d });
    }
    near.sort(function (a, b) { return a.d - b.d; });
    links = links.concat(near.slice(0, 3));
  }

  /* cyan on one side shading to blue on the other, as on the landing page */
  function tint(x) {
    var side = Math.max(0, Math.min(1, (x + 1) * 0.5));
    var e = side * side * (3 - 2 * side);
    return [Math.round(34 + 40 * e), Math.round(211 - 60 * e), Math.round(238 + 10 * e)];
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    w = rect.width; h = rect.height;
    canvas.width = Math.max(1, Math.floor(w * dpr));
    canvas.height = Math.max(1, Math.floor(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    var wide = w > 900;
    var cx = w * (wide ? 0.7 : 0.5), cy = h * 0.46, R = Math.min(h * 0.5, w * (wide ? 0.27 : 0.46));
    var cosX = Math.cos(pitch + leanY * 0.5), sinX = Math.sin(pitch + leanY * 0.5);
    var cosY = Math.cos(yaw + leanX * 0.9), sinY = Math.sin(yaw + leanX * 0.9);

    var glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.3);
    glow.addColorStop(0, 'rgba(34,211,238,.20)');
    glow.addColorStop(0.45, 'rgba(59,130,246,.09)');
    glow.addColorStop(1, 'rgba(59,130,246,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, R * 1.3, 0, 6.283); ctx.fill();

    var proj = pts.map(function (p) {
      var y = p.y * cosX - p.z * sinX, pz = p.y * sinX + p.z * cosX;
      var x = p.x * cosY + pz * sinY, z = -p.x * sinY + pz * cosY;
      var persp = FOCAL / Math.max(0.45, CAM_Z - z);
      return { sx: cx + x * R * persp, sy: cy + y * R * persp, z: z, persp: persp, p: p, c: tint(x) };
    });

    links.forEach(function (L) {
      var a = proj[L.i], b = proj[L.j], depth = (a.z + b.z) / 2;
      if (depth < -0.5) return;
      var dn = (depth + 1) / 2;
      ctx.strokeStyle = 'rgba(' + a.c.join(',') + ',' + Math.min(0.32, (0.06 + dn * 0.2) * (1 - L.d / LINK_DIST)) + ')';
      ctx.lineWidth = 0.5 + dn * 0.4;
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke();
    });

    proj.sort(function (a, b) { return a.z - b.z; }).forEach(function (q) {
      var dn = (q.z + 1) / 2;
      var tw = 0.75 + 0.2 * Math.sin(t * q.p.speed * 1.4 + q.p.phase);
      var lift = 0.08 + dn * 0.18;
      var c = q.c.map(function (v) { return Math.round(v + (255 - v) * lift); });
      ctx.fillStyle = 'rgba(' + c.join(',') + ',' + Math.min(1, (0.3 + dn * 0.7) * q.p.bright * tw) + ')';
      ctx.beginPath();
      ctx.arc(q.sx, q.sy, Math.max(0.4, q.p.size * q.persp * (0.35 + dn * 0.75) * 2.4), 0, 6.283);
      ctx.fill();
    });
  }

  function frame() {
    t += 0.016; yaw += 0.007;
    pitch = 0.22 + Math.sin(yaw * 0.35) * 0.06;
    leanX += (aimX - leanX) * 0.06;
    leanY += (aimY - leanY) * 0.06;
    draw();
    raf = visible && !document.hidden ? requestAnimationFrame(frame) : 0;
  }

  function start() { if (!raf && !reduced) raf = requestAnimationFrame(frame); }

  resize();
  window.addEventListener('resize', function () { resize(); if (reduced) draw(); });

  if (reduced) { draw(); return; }

  window.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect();
    aimX = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
    aimY = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
  });
  document.addEventListener('visibilitychange', start);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries.some(function (en) { return en.isIntersecting; });
      start();
    }).observe(canvas);
  }
  start();
})();

/* GeoSync case study: California's counties, shaded by pesticide use. Hover or click a county. */

(function () {
  var hero = document.querySelector('.geo-hero');
  if (!hero) return;

  var svg = hero.querySelector('.geo-map');
  var group = svg.querySelector('.geo-counties');
  var counties = Array.prototype.slice.call(svg.querySelectorAll('.geo-county'));
  if (!counties.length) return;
  var ring = svg.querySelector('.geo-ring');
  var pin = svg.querySelector('.geo-pin');
  var statusText = hero.querySelector('.geo-status-text');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* the six heaviest counties, for the tour that runs until someone takes over */
  var tour = counties.slice().sort(function (a, b) {
    return a.getAttribute('data-rank') - b.getAttribute('data-rank');
  }).slice(0, 6);
  var current = null, pinned = null, hovering = false, step = 0;

  function pounds(n) {
    return n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(Math.round(n));
  }

  function show(county) {
    if (!county || county === current) return;
    if (current) current.classList.remove('is-on');
    current = county;
    county.classList.add('is-on');
    group.appendChild(county); /* draw it last so its outline sits on top */
    var x = county.getAttribute('data-cx'), y = county.getAttribute('data-cy');
    ring.setAttribute('cx', x); ring.setAttribute('cy', y);
    pin.setAttribute('cx', x); pin.setAttribute('cy', y);
    statusText.textContent = county.getAttribute('data-county') + ' County · ' +
      pounds(+county.getAttribute('data-lbs')) + ' lbs applied in 2023 · #' +
      county.getAttribute('data-rank') + ' of ' + counties.length;
  }

  /* the map sits behind the headline, so find the county under the pointer by hand */
  function countyAt(x, y) {
    var stack = document.elementsFromPoint(x, y);
    for (var i = 0; i < stack.length; i++) {
      if (stack[i].classList && stack[i].classList.contains('geo-county')) return stack[i];
    }
    return null;
  }

  function fit() {
    svg.setAttribute('viewBox', window.innerWidth <= 900 ? '800 0 570 640' : '0 0 1440 640');
  }

  hero.addEventListener('pointermove', function (e) {
    var county = countyAt(e.clientX, e.clientY);
    hovering = !!county;
    hero.style.cursor = county ? 'pointer' : '';
    if (county && !pinned) show(county);
  });
  hero.addEventListener('pointerleave', function () { hovering = false; });
  hero.addEventListener('click', function (e) {
    var county = countyAt(e.clientX, e.clientY);
    if (!county) return;
    pinned = pinned === county ? null : county;
    hero.classList.toggle('is-pinned', !!pinned);
    show(county);
  });

  fit();
  window.addEventListener('resize', fit);
  show(tour[0]);
  if (!reduced) {
    setInterval(function () {
      if (hovering || pinned) return;
      step = (step + 1) % tour.length;
      show(tour[step]);
    }, 2600);
  }
})();
