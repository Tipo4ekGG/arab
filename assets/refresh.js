(function () {
  'use strict';
  if (document.getElementById('ptr')) return;

  var style = document.createElement('style');
  style.textContent = [
    'html,body{overscroll-behavior-y:contain}',
    '#ptr{position:fixed;inset:0 0 auto;z-index:100;display:flex;justify-content:center;',
    'padding-top:env(safe-area-inset-top,0px);pointer-events:none;opacity:0;transform:translateY(-80px)}',
    '#ptr span{margin:10px;padding:9px 16px;border-radius:999px;background:#0e5a4c;',
    'color:#fbf1d6;font:500 14px system-ui,sans-serif;box-shadow:0 2px 12px #0003}',
    '#ptr.refreshing span::before{content:"";display:inline-block;width:11px;height:11px;',
    'margin-right:8px;border:2px solid #fbf1d6;border-top-color:transparent;border-radius:50%;',
    'animation:refresh-spin .7s linear infinite}',
    '@keyframes refresh-spin{to{transform:rotate(360deg)}}',
    '@media(prefers-reduced-motion:reduce){#ptr.refreshing span::before{animation:none}}'
  ].join('');
  document.head.appendChild(style);
  var indicator = document.createElement('div');
  indicator.id = 'ptr';
  indicator.setAttribute('aria-hidden', 'true');
  var label = document.createElement('span');
  label.textContent = '↓ Потяните, чтобы обновить';
  indicator.appendChild(label);
  document.body.appendChild(indicator);

  var start = null;
  var direction = '';
  var pull = 0;
  var busy = false;
  var threshold = 70;

  function atTop() {
    return (window.pageYOffset || document.documentElement.scrollTop || 0) <= 0;
  }
  function paint(distance, animate) {
    indicator.style.transition = animate ? 'transform .2s,opacity .2s' : 'none';
    indicator.style.transform = 'translateY(' + (distance - 80) + 'px)';
    indicator.style.opacity = distance > 8 ? '1' : '0';
  }
  function reset() {
    start = null;
    direction = '';
    pull = 0;
    if (!busy) paint(0, true);
  }
  addEventListener('touchstart', function (event) {
    reset();
    if (busy || event.touches.length !== 1 || !atTop()) return;
    if (event.target.closest('input,textarea,select,button,a,[contenteditable="true"]')) return;
    start = {x:event.touches[0].clientX, y:event.touches[0].clientY};
    label.textContent = '↓ Потяните, чтобы обновить';
  }, {passive:true});

  addEventListener('touchmove', function (event) {
    if (!start || busy) return;
    if (event.touches.length !== 1 || !atTop()) { reset(); return; }
    var dx = event.touches[0].clientX - start.x;
    var dy = event.touches[0].clientY - start.y;
    if (!direction) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return;
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) { reset(); return; }
      direction = 'vertical';
    }
    pull = Math.min(Math.max(dy, 0) * .5, 110);
    if (event.cancelable && pull > 0) event.preventDefault();
    label.textContent = pull >= threshold ? '↑ Отпустите для обновления' : '↓ Потяните, чтобы обновить';
    paint(pull, false);
  }, {passive:false});

  addEventListener('touchend', function () {
    if (!start || busy) return;
    if (pull < threshold) { reset(); return; }
    busy = true;
    indicator.className = 'refreshing';
    label.textContent = 'Обновляю…';
    paint(threshold, true);
    reset();
    setTimeout(function () { location.reload(); }, 250);
  }, {passive:true});
  addEventListener('touchcancel', reset, {passive:true});
})();
