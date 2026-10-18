/* A quiet star field behind the case studies: twinkling stars in three depths
   that drift as you scroll, tinted toward the page's accent colour. */
(function () {
  var c = document.createElement('canvas');
  c.className = 'space-sky'; c.setAttribute('aria-hidden', 'true');
  document.body.prepend(c);
  var g = c.getContext('2d'), stars = [], w = 0, h = 0, dpr = Math.min(devicePixelRatio || 1, 2);
  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#ffffff';

  function size() {
    w = innerWidth; h = innerHeight; c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = [];
    var n = Math.round(w * h / 5200);
    for (var i = 0; i < n; i++) {
      var depth = Math.random();
      stars.push({ x: Math.random() * w, y: Math.random() * h * 3, r: .3 + depth * depth * 1.5, d: .15 + depth * .6,
                   p: Math.random() * 6.28, s: .5 + Math.random() * 1.5, tint: Math.random() < .25 });
    }
  }
  size(); addEventListener('resize', size);

  function draw(t) {
    g.clearRect(0, 0, w, h);
    var sy = scrollY;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i], y = ((s.y - sy * s.d) % (h * 3) + h * 3) % (h * 3);
      if (y > h + 4) continue;
      var a = .35 + .65 * (reduced ? .7 : (.5 + .5 * Math.sin(t * .001 * s.s + s.p)));
      g.globalAlpha = a * (.4 + s.d);
      g.fillStyle = s.tint ? accent : '#ffffff';
      g.beginPath(); g.arc(s.x, y, s.r, 0, 6.283); g.fill();
      if (s.r > 1.3) { g.globalAlpha = a * .15; g.beginPath(); g.arc(s.x, y, s.r * 4, 0, 6.283); g.fill(); }
    }
    g.globalAlpha = 1;
    if (!reduced) requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
