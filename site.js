(function () {
  var root = document.documentElement;
  root.classList.add('js');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var y = document.getElementById('year');
  if (y) y.textContent = new Date().getFullYear();

  /* Nav: a hairline once the page has moved, and the section in view marked in the links. */
  var navEl = document.querySelector('header.nav');
  var links = Array.prototype.slice.call(document.querySelectorAll('.nav nav a[href^="#"]'));
  var targets = links.map(function (a) { return document.querySelector(a.getAttribute('href')); });
  function navState() {
    if (navEl) navEl.classList.toggle('scrolled', window.scrollY > 8);
    var line = window.innerHeight * 0.35, at = -1;
    for (var i = 0; i < targets.length; i++) { if (targets[i] && targets[i].getBoundingClientRect().top <= line) at = i; }
    // Past the last linked section (the closing call to action), nothing is marked.
    var end = document.getElementById('contact');
    if (end && end.getBoundingClientRect().top <= line) at = -1;
    links.forEach(function (a, i) { if (i === at) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
  }
  var navTick = false;
  window.addEventListener('scroll', function () { if (!navTick) { navTick = true; requestAnimationFrame(function () { navTick = false; navState(); }); } }, { passive: true });
  window.addEventListener('resize', navState);
  navState();

  /* Copy buttons */
  document.querySelectorAll('.copy[data-copy]').forEach(function (btn) {
    var email = btn.previousElementSibling;
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      var done = function () { btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = 'Copy'; }, 1600); };
      var fallback = function () {
        var r = document.createRange(); r.selectNodeContents(email);
        var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        btn.textContent = 'Press Ctrl+C';
      };
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, fallback); }
        else { fallback(); }
      } catch (e) { fallback(); }
    });
  });

  /* Scroll reveal */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* Case studies: each screen shows the lit step. While a case is on screen its steps play in turn;
     hovering a step holds it, and tapping one jumps to it. */
  var DUR = 4500;
  function countUp(el) {
    var to = +el.getAttribute('data-to'), t0 = 0;
    function f(t) { if (!t0) t0 = t; var k = Math.min(1, (t - t0) / 900); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString('en-US'); if (k < 1) requestAnimationFrame(f); }
    if (reduce) el.textContent = to.toLocaleString('en-US'); else requestAnimationFrame(f);
  }
  document.querySelectorAll('.case').forEach(function (cs) {
    var lis = Array.prototype.slice.call(cs.querySelectorAll('.flow li'));
    var panes = Array.prototype.slice.call(cs.querySelectorAll('.pane'));
    if (!lis.length || panes.length !== lis.length) return;
    var at = 0, timer = 0, inView = false, held = false;
    cs.style.setProperty('--dur', DUR + 'ms');
    function show(i) {
      var changed = i !== at || !panes[i].classList.contains('on');
      at = i;
      lis.forEach(function (li, k) { li.classList.toggle('on', k === i); li.classList.remove('run'); });
      panes.forEach(function (p, k) { p.classList.toggle('on', k === i); });
      if (changed) panes[i].querySelectorAll('[data-to]').forEach(countUp);
      clearTimeout(timer);
      if (inView && !held && !reduce && !document.hidden) {
        void lis[i].offsetWidth; // restart the progress line
        lis[i].classList.add('run');
        timer = setTimeout(function () { show((at + 1) % lis.length); }, DUR);
      }
    }
    lis.forEach(function (li, k) {
      li.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { held = true; show(k); } });
      li.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') { held = false; show(at); } });
      li.addEventListener('click', function () { show(k); });
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { inView = es[0].isIntersecting; show(at); }, { threshold: 0.35 }).observe(cs);
    }
    document.addEventListener('visibilitychange', function () { show(at); });
    show(0);
  });

  /* Screens that play once when they come into view (the Occam HQ preview). */
  document.querySelectorAll('.pane.play').forEach(function (p) {
    if (!('IntersectionObserver' in window) || reduce) { p.classList.add('on'); return; }
    var o = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { p.classList.add('on'); o.disconnect(); } }, { threshold: 0.3 });
    o.observe(p);
  });

  /* Service drawings stand still when motion is reduced. */
  if (reduce) document.querySelectorAll('svg.viz').forEach(function (sv) { if (sv.pauseAnimations) sv.pauseAnimations(); });

  /* Hero: a ribbon of grid cells that drifts slowly; cells near the pointer light up in the logo blue. */
  var hero = document.getElementById('hero'), c = document.getElementById('grid');
  if (!hero || !c || !c.getContext) return;
  var ctx = c.getContext('2d');
  var CELL = 12, W = 0, H = 0, BH = 0, cols = 0, rows = 0, phase = 0.6, lit = {}, litCount = 0;
  var lineCol = '', accent = '', visible = true, raf = 0, frame = 0;

  function readColors() {
    var s = getComputedStyle(root);
    lineCol = s.getPropertyValue('--grid-line').trim() || 'rgba(18,22,31,.085)';
    accent = s.getPropertyValue('--accent').trim() || '#0a5cff';
  }
  function hash(i, j) { var n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); }
  function inBand(i, j) {
    var u = (i + 0.5) * CELL / W, yy = (j + 0.5) * CELL;
    var cy = BH * 0.36 + Math.sin(u * 6.9 + phase) * BH * 0.17 + Math.sin(u * 2.8 - phase * 0.7) * BH * 0.07;
    var half = BH * 0.15 + Math.sin(u * 5.0 + phase * 1.3) * BH * 0.05;
    var d = Math.abs(yy - cy) / half;
    if (d > 1) return false;
    if (d > 0.8) return hash(i, j) > (d - 0.8) / 0.2;
    return true;
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.beginPath();
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        if (inBand(i, j)) ctx.rect(i * CELL + 0.5, j * CELL + 0.5, CELL - 2, CELL - 2);
      }
    }
    ctx.strokeStyle = lineCol; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = accent;
    for (var k in lit) {
      var v = lit[k], p = k.split(',');
      ctx.globalAlpha = Math.min(1, v);
      ctx.fillRect(p[0] * CELL + 0.5, p[1] * CELL + 0.5, CELL - 2, CELL - 2);
      v -= 0.022;
      if (v <= 0) { delete lit[k]; litCount--; } else { lit[k] = v; }
    }
    ctx.globalAlpha = 1;
  }
  function light(i, j, v) {
    if (i < 0 || j < 0 || i >= cols || j >= rows || !inBand(i, j)) return;
    var k = i + ',' + j;
    if (!(k in lit)) litCount++;
    lit[k] = v;
  }
  function resize() {
    var r = hero.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    // The ribbon runs behind the headline, not the screen under it.
    var inner = hero.querySelector('.hero-inner');
    BH = inner ? Math.min(H, inner.offsetTop + inner.offsetHeight + 40) : H;
    c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(W / CELL); rows = Math.ceil(H / CELL);
    readColors(); draw();
  }
  function loop() {
    raf = 0;
    if (!visible || document.hidden) return;
    frame++;
    if (frame % 2 === 0) {
      phase += 0.0035;
      if (frame % 14 === 0) light(Math.floor(Math.random() * cols), Math.floor(Math.random() * rows * 0.7), 0.55);
      draw();
    }
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf && !reduce) raf = requestAnimationFrame(loop); }

  hero.addEventListener('pointermove', function (e) {
    var r = hero.getBoundingClientRect(), x = e.clientX - r.left, yy = e.clientY - r.top;
    for (var n = 0; n < 3; n++) {
      var a = Math.random() * Math.PI * 2, d = Math.random() * 64;
      light(Math.floor((x + Math.cos(a) * d) / CELL), Math.floor((yy + Math.sin(a) * d) / CELL), 0.35 + Math.random() * 0.65);
    }
    if (reduce) draw();
  }, { passive: true });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); }).observe(hero);
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });
  window.addEventListener('resize', resize);
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', function () { readColors(); draw(); });
  }
  resize(); start();
})();
