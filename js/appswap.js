/* 图标格：长按拎起一个半透明的图标跟着手指 其余图标依次后推 松手确认后落定并存下来 */
(function(){
  var box = document.querySelector('.block.apx .fApps');
  if(!box) return;
  var KEY = 'cove_app_order_v3';
  var LEGACY = ['cove_app_order_v2', 'cove_app_order'];
  function list(){
    return [].slice.call(box.children).filter(function(n){
      return n && n.classList && n.classList.contains('app');
    });
  }
  var sc = 0;
  list().forEach(function(a){
    if(!a.getAttribute('data-k')){
      a.setAttribute('data-k', a.getAttribute('data-name') || ('__slot' + (++sc)));
    }
  });
  function keyOf(a){ return a.getAttribute('data-ic') || a.getAttribute('data-k'); }
  function ids(){ return list().map(keyOf); }
  /* 元素身上挂 order  DOM挪一份 视觉再钉一份 外面谁排了DOM也翻不回去 */
  function syncOrder(){
    list().forEach(function(a, i){ a.style.order = i; });
  }
  function applyOrder(sv){
    if(!sv || !sv.length) return;
    var map = {};
    list().forEach(function(a){
      var k1 = a.getAttribute('data-ic');
      var k2 = a.getAttribute('data-k');
      var k3 = a.getAttribute('data-name');
      if(k1) map[k1] = a;
      if(k2) map[k2] = a;
      if(k3) map[k3] = a;
    });
    var used = {};
    sv.forEach(function(k, idx){
      var a = map[k];
      if(a && !used[k]){ a.style.order = idx; box.appendChild(a); used[k] = 1; }
    });
    list().forEach(function(a){ box.appendChild(a); });
    syncOrder();
  }
  function readSaved(){
    var v = null;
    try{ v = JSON.parse(localStorage.getItem(KEY) || 'null'); }catch(e){ v = null; }
    if(v && v.length) return v;
    for(var i = 0; i < LEGACY.length; i++){
      try{
        var t = JSON.parse(localStorage.getItem(LEGACY[i]) || 'null');
        if(t && t.length) return t;
      }catch(e){}
    }
    return null;
  }
  var saved = readSaved();
  var lastSave = 0;
  applyOrder(saved);
  /* 桥那层的数据是分片读进来的 头一下不一定就位 隔几档再从本机重新取一遍 */
  function paint(){
    if(dragEl) return;
    if(Date.now() - lastSave < 6000) return;
    var v = readSaved();
    if(!v) return;
    saved = v;
    applyOrder(v);
  }
  [0, 150, 400, 900, 1800, 3200, 5000].forEach(function(t){ setTimeout(paint, t); });
  window.addEventListener('load', function(){ setTimeout(paint, 700); });
  window.addEventListener('pageshow', paint);
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) paint(); });
var dragEl = null, ghost = null, timer = 0, sx = 0, sy = 0, saveOrder = null, sup = false, moved = false;

  document.addEventListener('contextmenu', function(ev){
    if(ev.target && ev.target.closest && ev.target.closest('.block.apx .fApps')) ev.preventDefault();
  }, true);

  /* 做一层浮起来的影子 挂在body下 不会被任何格子裁掉也不会被父层的transform困住 */
  function buildGhost(el, x, y){
    var r = el.getBoundingClientRect();
    var ic = el.querySelector('.ic');
    var ir = ic ? ic.getBoundingClientRect() : null;
    var g = document.createElement('div');
    g.style.cssText = 'position:fixed;z-index:2147483000;pointer-events:none;' +
      'display:flex;flex-direction:column;align-items:center;justify-content:center;' +
      'opacity:.85;transform:scale(1.16);will-change:left,top;' +
      'filter:drop-shadow(0 16px 22px rgba(0,0,0,.26));';
    g.style.width = r.width + 'px';
    g.style.height = r.height + 'px';
    if(ir && ir.width > 0){
      var b = document.createElement('div');
      b.style.cssText = 'display:grid;place-items:center;overflow:hidden;border-radius:24%;' +
        'background:#F7F7F8;box-shadow:0 0 0 1px rgba(107,107,107,.12);';
      b.style.width = ir.width + 'px';
      b.style.height = ir.height + 'px';
      var img = ic.querySelector('img');
      if(img && img.getAttribute('src')){
        var im = document.createElement('img');
        im.src = img.getAttribute('src');
        im.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain;opacity:.88;';
        b.appendChild(im);
      }else{
        b.innerHTML = ic.innerHTML;
      }
      g.appendChild(b);
    }
    var nm = el.querySelector('.nm');
    if(nm && nm.textContent && nm.textContent.trim()){
      var n = document.createElement('div');
      n.textContent = nm.textContent.trim();
      var cs = getComputedStyle(nm);
      n.style.cssText = 'color:#6B6B6B;letter-spacing:.04em;white-space:nowrap;' +
        'margin-top:4px;font-size:' + cs.fontSize + ';';
      g.appendChild(n);
    }
    g.style.left = (x - r.width / 2) + 'px';
    g.style.top = (y - r.height / 2 - Math.max(9, r.height * 0.22)) + 'px';
    document.body.appendChild(g);
    return g;
  }

  function longPress(el){
    if(dragEl) return;
    saveOrder = ids();
    moved = false;
    dragEl = el;
    ghost = buildGhost(el, sx, sy);
    el.style.opacity = '.28';
    try{ if(navigator.vibrate) navigator.vibrate(12); }catch(e){}
  }

  function moveTo(x, y){
    if(!dragEl) return;
    moved = true;
    if(ghost){
      var r = dragEl.getBoundingClientRect();
      ghost.style.left = (x - r.width / 2) + 'px';
      ghost.style.top = (y - r.height / 2 - Math.max(9, r.height * 0.22)) + 'px';
    }
    var target = null, ls = list();
    for(var i = 0; i < ls.length; i++){
      var a = ls[i];
      if(a === dragEl) continue;
      var ra = a.getBoundingClientRect();
      if(ra.width <= 0) continue;
      if(x >= ra.left && x <= ra.right && y >= ra.top && y <= ra.bottom){ target = a; break; }
    }
    if(!target) return;
    var r2 = target.getBoundingClientRect();
    var midX = r2.left + r2.width / 2;
    var midY = r2.top + r2.height / 2;
    var before = (Math.abs(y - midY) > r2.height * 0.55) ? (y < midY) : (x < midX);
    if(before) box.insertBefore(dragEl, target);
    else box.insertBefore(dragEl, target.nextSibling);
    syncOrder();
  }

  function dropGhost(){
    if(ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    ghost = null;
  }

  function restore(order){
    if(!order) return;
    var map = {};
    list().forEach(function(a){ map[a.getAttribute('data-k')] = a; });
    order.forEach(function(k){ if(map[k]){ box.appendChild(map[k]); delete map[k]; } });
    Object.keys(map).forEach(function(k){ box.appendChild(map[k]); });
    syncOrder();
  }

  function endDrag(ok){
    if(!dragEl) return;
    var el = dragEl, keep = saveOrder;
    dragEl = null;
    dropGhost();
    el.style.opacity = '';
    if(ok){
      saved = ids();
      lastSave = Date.now();
      var raw = JSON.stringify(saved), relayed = false;
      /* 落盘交给外面那一层 它常驻 不会被这页刷新截断 也不抢同一份文件 */
      try{
        if(window.parent && window.parent !== window){
          window.parent.postMessage({ __coveLS:'set', k:KEY, v:raw }, '*');
          relayed = true;
        }
      }catch(e){}
      if(!relayed){
        try{ localStorage.setItem(KEY, raw); }catch(e){}
      }
      syncOrder();
      if(!relayed){
        setTimeout(function(){ try{ if(window.__LS_FLUSH) window.__LS_FLUSH(); }catch(e){} }, 320);
      }
    }else{
      restore(keep);
    }
    saveOrder = null;
    sup = true;
    setTimeout(function(){ sup = false; }, 450);
  }

  function ask(cb){
    var mask = document.createElement('div');
    mask.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.20);z-index:2147483001;display:flex;align-items:center;justify-content:center;';
    var card = document.createElement('div');
    card.style.cssText = 'min-width:200px;background:#FFFFFF;border-radius:16px;padding:18px 18px 12px;box-shadow:0 10px 34px rgba(0,0,0,.20);font-family:inherit;';
    var msg = document.createElement('div');
    msg.style.cssText = 'font-size:13px;color:#3A3A3A;text-align:center;letter-spacing:.06em;line-height:1.7;';
    msg.textContent = '把这个图标放到这里？';
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;margin-top:16px;';
    var bc = document.createElement('button');
    bc.textContent = '取消';
    bc.style.cssText = 'flex:1;border:0;border-radius:10px;padding:9px 0;font-size:13px;letter-spacing:.1em;background:#F0F0F1;color:#666;font-family:inherit;';
    var bk = document.createElement('button');
    bk.textContent = '确定';
    bk.style.cssText = 'flex:1;border:0;border-radius:10px;padding:9px 0;font-size:13px;letter-spacing:.1em;background:#3A3A3A;color:#FFF;font-family:inherit;';
    row.appendChild(bc); row.appendChild(bk);
    card.appendChild(msg); card.appendChild(row);
    mask.appendChild(card);
    document.body.appendChild(mask);
    function done(v){
      try{ document.body.removeChild(mask); }catch(e){}
      cb(v);
    }
    bc.addEventListener('click', function(e){ e.stopPropagation(); done(false); });
    bk.addEventListener('click', function(e){ e.stopPropagation(); done(true); });
    mask.addEventListener('click', function(e){ if(e.target === mask){ e.stopPropagation(); done(false); } });
    mask.addEventListener('touchstart', function(e){ e.stopPropagation(); }, {passive:true});
  }

  function bind(el){
    el.style.touchAction = 'none';
    el.style.webkitUserDrag = 'none';
    el.style.webkitTouchCallout = 'none';
    el.style.userSelect = 'none';
    el.setAttribute('draggable', 'false');
    el.addEventListener('pointerdown', function(ev){
      if(ev.button && ev.button !== 0) return;
      ev.preventDefault();
      sx = ev.clientX; sy = ev.clientY;
      clearTimeout(timer);
      timer = setTimeout(function(){ timer = 0; longPress(el); }, 300);
      try{ el.setPointerCapture(ev.pointerId); }catch(e){}
    });
    el.addEventListener('pointermove', function(ev){
      if(dragEl === el){ ev.preventDefault(); moveTo(ev.clientX, ev.clientY); return; }
      if(timer && (Math.abs(ev.clientX - sx) > 12 || Math.abs(ev.clientY - sy) > 12)){
        clearTimeout(timer); timer = 0;
      }
    }, {passive:false});
    el.addEventListener('pointerup', function(ev){
      clearTimeout(timer); timer = 0;
      if(dragEl === el){
        ev.preventDefault();
        /* 松手直接落定 不再弹窗问 */
        endDrag(true);
        return;
      }
      if(sup) return;
      var href = el.getAttribute('href');
      if(href) window.location.href = href;
    });
    el.addEventListener('pointercancel', function(){
      clearTimeout(timer); timer = 0;
      if(dragEl === el) endDrag(moved ? true : false);
    });
    el.addEventListener('click', function(ev){
      ev.preventDefault(); ev.stopPropagation();
    }, true);
    el.addEventListener('contextmenu', function(ev){ ev.preventDefault(); });
    el.addEventListener('touchstart', function(ev){ ev.preventDefault(); }, {passive:false});
  }
  list().forEach(bind);
})();
