/* 底部小条：从共听页离开以后，在别的页面接着放 */
(function(){
  if(window.__MINIBAR__) return;
  window.__MINIBAR__ = 1;

  var API = 'http://127.0.0.1:9090';
  var K_CUR = 'hearth_pod_cur', K_Q = 'hearth_pod_queue', K_PLAY = 'hearth_pod_play';

  function rd(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }
  function wr(k,v){ try{ localStorage.setItem(k,v); }catch(e){} }
  function rj(k){ try{ return JSON.parse(localStorage.getItem(k)||'null'); }catch(e){ return null; } }
  function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'"').replace(/</g,'&lt;'); }

  var cur = rj(K_CUR);
  if(!cur || cur.id == null) return;

  var queue = (rj(K_Q) || {}).songs || [];
  var idx = -1;
  for(var i=0;i<queue.length;i++){
    if(String(queue[i].songId||queue[i].id) === String(cur.id)){ idx = i; break; }
  }

  var au = null, bar = null, cvEl, nmEl, arEl, ppEl, lnEl;
  var pendingT = cur.t || 0;
  var wantPlay = rd(K_PLAY) === '1';
  var saveAt = 0, armed = false;

  var I_PLAY = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 6.3v11.4l9.2-5.7z"/></svg>';
  var I_PAUSE = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="7.8" y="6" width="3.2" height="12" rx="1.2"/><rect x="13" y="6" width="3.2" height="12" rx="1.2"/></svg>';

  function css(){
    var s = document.createElement('style');
    s.textContent = [
      '.mnb{position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom) + 66px);z-index:22;',
      'display:flex;align-items:center;gap:10px;padding:7px 12px 10px;border-radius:16px;overflow:hidden;',
      'background:rgba(255,255,255,.94);box-shadow:0 8px 22px rgba(120,135,148,.18),0 0 0 1px rgba(203,212,219,.85);',
      'backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);',
      'transform:translateY(10px);opacity:0;transition:opacity .24s ease,transform .24s ease}',
      '.mnb.on{opacity:1;transform:none}',
      '.mnb[hidden]{display:none}',
      '.mnb .cv{width:36px;height:36px;border-radius:10px;flex:none;overflow:hidden;background:#eef3f7}',
      '.mnb .cv img{width:100%;height:100%;object-fit:cover;display:block}',
      '.mnb .tx{flex:1;min-width:0}',
      '.mnb .nm{font-size:12.5px;color:#3f4a53;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.mnb .ar{font-size:10.5px;color:#aab3bb;letter-spacing:.06em;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.mnb .pp{flex:none;width:32px;height:32px;border-radius:50%;border:0;padding:0;background:#f4f7fa;color:#5f676d;',
      'display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 1px rgba(203,212,219,.9)}',
      '.mnb .pp svg{width:16px;height:16px;display:block}',
      '.mnb .ln{position:absolute;left:0;right:0;bottom:0;height:2px;background:rgba(203,212,219,.45)}',
      '.mnb .ln i{display:block;height:100%;width:0;background:#8fa5b5;transition:width .25s linear}'
    ].join('');
    document.head.appendChild(s);
  }

  function mount(){
    css();
    bar = document.createElement('div');
    bar.className = 'mnb';
    bar.hidden = true;
    bar.innerHTML =
      '<div class="cv"></div>' +
      '<div class="tx"><div class="nm"></div><div class="ar"></div></div>' +
      '<button class="pp" aria-label="播放">' + I_PLAY + '</button>' +
      '<div class="ln"><i></i></div>';
    document.body.appendChild(bar);
    cvEl = bar.querySelector('.cv');
    nmEl = bar.querySelector('.nm');
    arEl = bar.querySelector('.ar');
    ppEl = bar.querySelector('.pp');
    lnEl = bar.querySelector('.ln i');
    ppEl.addEventListener('click', function(e){
      e.stopPropagation(); e.preventDefault();
      if(!au || !au.src){
        pendingT = cur.t || 0;
        start(true);
        return;
      }
      if(au.paused) tryPlay(); else au.pause();
    });
    bar.addEventListener('click', goListen);
    requestAnimationFrame(function(){ bar.hidden = false; bar.classList.add('on'); });
  }

  /* 小卡片封面：设了自定义就随机抽一张 没设就用歌自带的 */
  function pickCover(c){
    var orig = (c && c.cover) || '';
    var xs = [];
    try{ xs = JSON.parse(localStorage.getItem('hearth_listen_covers') || '[]') || []; }catch(e){ xs = []; }
    if(!Array.isArray(xs)) xs = [];
    xs = xs.filter(function(x){ return typeof x === 'string' && x; });
    if(!xs.length) return orig;
    var key = String((c && (c.id || c.songId || c.name)) || '');
    var cache = window.__miniCovPick;
    if(cache && cache.key === key && cache.src) return cache.src;
    var sel = xs[Math.floor(Math.random() * xs.length)];
    window.__miniCovPick = { key: key, src: sel };
    return sel;
  }
  function render(){
    nmEl.textContent = cur.name || '在 放 什 么';
    arEl.textContent = cur.artist || '';
    cvEl.innerHTML = cur.cover ? '<img src="' + esc(cur.cover) + '" alt="">' : '';
    if(!cur.cover) cvEl.innerHTML = '';
  }
  window.__miniRefresh = function(){ try{ if(cur) render(); }catch(e){} };

  function setIco(on){ ppEl.innerHTML = on ? I_PAUSE : I_PLAY; }

  function paintLine(){
    if(!au || !au.duration) return;
    lnEl.style.width = Math.max(0, Math.min(1, (au.currentTime || 0) / au.duration)) * 100 + '%';
  }

  function ensureAudio(){
    if(au) return au;
    au = new Audio();
    au.preload = 'auto';
    au.addEventListener('loadedmetadata', function(){
      if(pendingT > 1){ try{ au.currentTime = pendingT; }catch(e){} }
      pendingT = 0;
      paintLine();
    });
    au.addEventListener('timeupdate', function(){
      paintLine();
      var n = Date.now();
      if(n - saveAt > 4000){ saveAt = n; save(); }
    });
    au.addEventListener('play', function(){ setIco(true); wr(K_PLAY,'1'); });
    au.addEventListener('pause', function(){ setIco(false); save(true); });
    au.addEventListener('ended', next);
    return au;
  }

  function start(auto){
    ensureAudio();
    if(au.dataset.id === String(cur.id) && au.src){
      if(auto) tryPlay();
      return;
    }
    var id = cur.id, t = pendingT;
    fetch(API + '/music/url?id=' + encodeURIComponent(id))
      .then(function(r){ return r.json(); })
      .then(function(d){
        var u = (d && d.ok && d.url) ? d.url : null;
        if(!u) u = '/music/file/' + id + '.mp3';
        if(u.indexOf('http') !== 0) u = API + u;
        pendingT = t;
        au.dataset.id = String(id);
        au.src = u;
        if(auto) tryPlay();
      })
      .catch(function(){ setIco(false); arm(); });
  }

  function tryPlay(){
    var p = au.play();
    if(p && p.catch) p.catch(function(){
      /* 内核不让直接出声就先静音走起来，碰一下屏幕再放开 */
      try{ au.muted = true; }catch(e){}
      var p2 = au.play();
      if(p2 && p2.then) p2.then(armUnmute).catch(function(){ setIco(false); });
      else setIco(false);
    });
  }

  function armUnmute(){
    var off = function(){
      document.removeEventListener('touchstart', off, true);
      document.removeEventListener('mousedown', off, true);
      document.removeEventListener('click', off, true);
      try{ au.muted = false; }catch(e){}
    };
    document.addEventListener('touchstart', off, true);
    document.addEventListener('mousedown', off, true);
    document.addEventListener('click', off, true);
  }

  function arm(){
    if(armed) return;
    armed = true;
    var go = function(){
      armed = false;
      try{ var p = au.play(); if(p && p.catch) p.catch(function(){}); }catch(e){}
    };
    document.addEventListener('touchstart', go, { once:true, capture:true });
    document.addEventListener('click', go, { once:true, capture:true });
  }

  function go(i){
    if(!queue.length) return;
    idx = ((i % queue.length) + queue.length) % queue.length;
    cur = queue[idx];
    pendingT = 0;
    render();
    if(au){ try{ au.pause(); }catch(e){} au.removeAttribute('src'); au.dataset.id = ''; }
    start(true);
    save(true);
  }

  function next(){
    if(queue.length > 1){ go(idx + 1); return; }
    try{ au.currentTime = 0; tryPlay(); }catch(e){}
  }

  function save(force){
    if(!cur) return;
    var t = au ? (au.currentTime || 0) : (cur.t || 0);
    if(t < 1) t = cur.t || 0;
    wr(K_CUR, JSON.stringify({
      id: cur.id, name: cur.name || '', artist: cur.artist || '', cover: cur.cover || '',
      t: Math.floor(t), at: Date.now()
    }));
    var p = au ? (au.paused ? '0' : '1') : (wantPlay ? '1' : '0');
    wr(K_PLAY, p);
  }

  function goListen(){
    save(true);
    var t = (au && au.currentTime > 1) ? Math.floor(au.currentTime) : Math.floor(cur.t || 0);
    location.href = 'listen.html?play=' + encodeURIComponent(cur.id) + '&t=' + t +
      '&nm=' + encodeURIComponent(cur.name || '') +
      '&ar=' + encodeURIComponent(cur.artist || '') +
      '&cv=' + encodeURIComponent(cur.cover || '');
  }

  mount();
  render();
  if(wantPlay){ start(true); }

  window.addEventListener('pagehide', function(){ save(true); });
  document.addEventListener('visibilitychange', function(){ if(document.hidden) save(true); });
})();
