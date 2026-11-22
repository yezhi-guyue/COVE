/* 屋子里的桥 · 页面存下的东西，落到 data/ls.json 里 */
(function(){
  var FILE='file:///data/user/0/com.ai.assistance.operit/files/workspace/COVE/data/ls.json';
  var CH=180000;
  /* 线上那套（https 非本机，比如 github.io）够不着手机 也不该往 /api 上碰 */
  var IS_STATIC=false;
  try{ var _h=String(location.hostname||'');
       IS_STATIC = (String(location.protocol||'')==='https:' && _h!=='127.0.0.1' && _h!=='localhost'); }catch(e){}

  var _raCache=null, _raAt=0;
  function readAll(fresh){
    if(IS_STATIC) return null;
    /* 这份文件三兆多 别每次都整个拉一遍 三秒内复用上一次的 */
    if(!fresh && _raCache && (Date.now()-_raAt)<3000) return _raCache;
    /* 屋子是跑在本地 http 服务上的 同源这条最稳 先走它 file:// 留作后备 */
    var SD='file:///storage/emulated/0/Download/COVE/ls.json';
    var proto0=''; try{ proto0=String(location.protocol||''); }catch(e){}
    var isHttp0=(proto0==='http:'||proto0==='https:');
    /* http 下先走同源接口；file 下先走 Download/COVE 那份真存档 */
    var tries=isHttp0 ? ['/api/ls', SD, 'data/ls.json', FILE.replace('file://','')]
                      : [SD, 'data/ls.json', FILE, FILE.replace('file://','')];
    for(var i=0;i<tries.length;i++){
      try{
        var x=new XMLHttpRequest();
        x.open('GET', tries[i], false);
        x.send(null);
        var t=x.responseText||'';
        if(!t.replace(/\s/g,'')) continue;
        var o=JSON.parse(t);
        if(o && typeof o==='object'){ _raCache=o; _raAt=Date.now(); return o; }
      }catch(e){}
    }
    return null;
  }

  var orig=null;
  try{ orig=window.localStorage; }catch(e){}

  var mem={}, touch={}, got=false;
  var fromFile=null;

  fromFile=readAll();
  if(IS_STATIC && orig){
    try{ var _snap=orig.getItem('__cove_disk');
      if(_snap){ var _so=JSON.parse(_snap); if(_so&&typeof _so==='object'){ fromFile=_so; } }
    }catch(e){} 
  }
  if(fromFile){
    got=true;
    for(var k in fromFile){ if(fromFile.hasOwnProperty(k)) mem[k]=fromFile[k]; }
  }else if(orig){
    try{
      for(var i2=0;i2<orig.length;i2++){
        var kk=orig.key(i2);
        if(kk==='__cove_disk') continue;
        mem[kk]=orig.getItem(kk);
      }
    }catch(e2){}
    /* 盘上还没有这份文件，就先把浏览器里现有的这批当作真数据，等着落盘 */
    if(Object.keys(mem).length) got=true;
  }

  /* 旧的心情台账 hearth_mood_days 并入 hearth_v1.mood 只做一次 */
  (function(){
    try{
      if(mem['hearth_mood_migrated_v1']) return;
      var raw=mem['hearth_mood_days']; if(!raw) return;
      var days=JSON.parse(raw); if(!days||typeof days!=='object') return;
      var s={}; try{ s=JSON.parse(mem['hearth_v1']||'{}')||{}; }catch(e){ s={}; }
      var md=s.mood||{};
      var M={mood_happy:'happy',mood_smug:'excited',mood_calm:'calm',mood_love:'heart',mood_annoy:'annoyed',mood_daze:'tired',mood_sad:'sad',mood_angry:'angry'};
      var ch=0;
      for(var day in days){ if(!days.hasOwnProperty(day)) continue;
        var rec=days[day]||{}; if(!md[day]) md[day]={};
        for(var who in rec){ if(!rec.hasOwnProperty(who)) continue;
          var v=M[rec[who]]||rec[who]||''; if(!v) continue;
          var tgt=(who==='me')?'her':'me';
          if(!md[day][tgt]){ md[day][tgt]=v; ch++; }
        }
      }
      if(ch){ s.mood=md; mem['hearth_v1']=JSON.stringify(s); touch['hearth_v1']=1; }
      mem['hearth_mood_migrated_v1']='1'; touch['hearth_mood_migrated_v1']=1;
      flush();
    }catch(e){}
  })();
  var dirty=false, timer=null, chain=null, busyUntil=0;

  function bridgeOk(){
    try{
      var b=window.CoveBridge;
      return !!(b && typeof b.saveLsChunk==='function');
    }catch(e){ return false; }
  }
  /* 二是桥 一片一片递给插件 */
  function sendByBridge(json, n, sid){
    var i=0;
    function push(){
      if(i>=n) return;
      var part=json.substr(i*CH, CH);
      var last=(i===n-1)?'1':'0';
      try{ window.CoveBridge.saveLsChunk(String(i), String(n), part, sid); }catch(e){}
      i++;
      setTimeout(push, 40);
    }
    push();
  }
  /* 外面没有桥就什么也不做 不弹任何提示 */
  function sendByScheme(json, n, sid){}
  function send(json){
    if(IS_STATIC){ busyUntil=0;
      try{ if(orig) orig.setItem('__cove_disk', json); }catch(e){}
      return; }
    var n=Math.max(1, Math.ceil(json.length/CH));
    var sid=String(Date.now());
    busyUntil = Date.now() + 9000;
    /* 一是自家服务 整份递过去 不切片 */
    var proto='';
    try{ proto=String(location.protocol||''); }catch(e){}
    if(proto==='http:' || proto==='https:'){
      try{
        fetch('/api/ls', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:json,
          keepalive:true
        }).then(function(r){ return r.json(); }).then(function(j){
          if(!j || !j.ok) throw new Error((j&&j.error)||'no');
          busyUntil=0;
        }).catch(function(){
          busyUntil=0;
          if(bridgeOk()) sendByBridge(json, n, sid);
          else sendByScheme(json, n, sid);
        });
        return;
      }catch(e0){}
    }
    var waited=0;
    function go(){
      if(bridgeOk()){ sendByBridge(json, n, sid); return; }
      if(waited<3000){ waited+=150; setTimeout(go, 150); return; }
      sendByScheme(json, n, sid);
    }
    go();
  }
  function flush(){
    dirty=false;
    /* 里面这层先把改过的键交给最外面那层 让那边立刻落盘 */
    if(IS_SUB){
      for(var tk in touch){
        if(!touch.hasOwnProperty(tk)) continue;
        if(Object.prototype.hasOwnProperty.call(mem,tk)) relaySet(tk, mem[tk]);
      }
    }
    var disk=readAll();
    if(disk){
      got=true;
      for(var a in disk){
        if(disk.hasOwnProperty(a) && !touch[a]) mem[a]=disk[a];
      }
      for(var b in mem){
        if(mem.hasOwnProperty(b) && !touch[b] && !disk.hasOwnProperty(b)) delete mem[b];
      }
    }
    var json;
    try{ json=JSON.stringify(mem); }catch(e3){ return; }
    touch={};
    if(!got) return;
    send(json);
  }

  function schedule(){
    dirty=true;
    clearTimeout(timer);
    timer=setTimeout(flush, 700);
    clearTimeout(chain);
    chain=setTimeout(flush, 2500);
  }

  var IS_SUB=false;
  try{ IS_SUB = !!(window.top && window.top!==window); }catch(e0){ IS_SUB=true; }
  function relaySet(k,v){
    try{ window.top.postMessage({__coveLS:'set', k:String(k), v:String(v==null?'':v)}, '*'); }catch(e){}
  }
  function relayFlush(){
    try{ window.top.postMessage({__coveLS:'flush'}, '*'); }catch(e){}
  }

  /* 改一个键就递一个键 几十字节 页面关得再快也来得及走 不再等攒够再整份送 */
  function isHttp(){
    if(IS_STATIC) return false;
    try{ var p=String(location.protocol||''); return p==='http:' || p==='https:'; }
    catch(e){ return false; }
  }
  function pushOne(k, v){
    if(!isHttp()) return;
    var o={}; o[k]=String(v);
    try{
      fetch('/api/set', {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify(o), keepalive:true}).catch(function(){});
    }catch(e){}
  }
  function pushDel(k){
    if(!isHttp()) return;
    try{
      fetch('/api/set', {method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({__del:[String(k)]}), keepalive:true}).catch(function(){});
    }catch(e){}
  }

  var LS={
    getItem:function(k){ return Object.prototype.hasOwnProperty.call(mem, String(k))? mem[String(k)] : null; },
    setItem:function(k,v){ k=String(k); mem[k]=String(v); touch[k]=1;
      pushOne(k, mem[k]);
      /* 屋子里的每一层都挂了一份桥 但只让最外面那一层写盘 里面这层立刻把改动交上去 */
      if(IS_SUB){ relaySet(k, mem[k]); return; }
      schedule(); },
    removeItem:function(k){ k=String(k); pushDel(k); delete mem[k]; touch[k]=1;
      if(IS_SUB){ relaySet(k,''); return; }
      schedule(); },
    clear:function(){ for(var t in mem){ touch[t]=1; } mem={};
      if(IS_SUB){ relayFlush(); return; }
      schedule(); },
    key:function(i){ var ks=Object.keys(mem); return i<ks.length? ks[i] : null; },
    get length(){ return Object.keys(mem).length; }
  };
  try{ Object.defineProperty(window, 'localStorage', { configurable:true, get:function(){ return LS; } }); }
  catch(e4){ try{ window.localStorage=LS; }catch(e5){} }

  /* 万一这层没接管成功 页面读到的还是旧副本 那把盘上的数据补进原生存储里 */
  try{
    if(window.localStorage!==LS && fromFile && orig){
      for(var hk in fromFile){
        if(!fromFile.hasOwnProperty(hk)) continue;
        var hv=fromFile[hk]; if(typeof hv!=='string' || hv.length>200000) continue;
        try{ if(orig.getItem(hk)!==hv) orig.setItem(hk, hv); }catch(e6){}
      }
    }
  }catch(e7){}

  window.__LS_FLUSH=function(){ try{ flush(); }catch(e){} };
  window.__LS_PENDING=function(){ return dirty; };
  window.__LS_BUSY=function(){ return Date.now() < busyUntil; };
  window.__LS_WHEN_IDLE=function(cb){
    var t=setInterval(function(){
      if(Date.now() >= busyUntil){ clearInterval(t); try{ cb(); }catch(e){} }
    }, 40);
  };
  window.__LS_RELOAD=function(){
    try{
      if(dirty){ try{ flush(); }catch(e){} }
      var d=readAll();
      if(!d) return false;
      got=true;
      for(var k in mem){ if(mem.hasOwnProperty(k) && !d.hasOwnProperty(k)) delete mem[k]; }
      for(var k2 in d){ if(d.hasOwnProperty(k2)) mem[k2]=d[k2]; }
      return true;
    }catch(e){ return false; }
  };

  window.addEventListener('pagehide', function(){ if(dirty) flush(); });
  window.addEventListener('beforeunload', function(){ if(dirty) flush(); });
  setTimeout(function(){ if(!fromFile && orig && orig.length) flush(); }, 1500);

  /* 自述一次：这一层跑在什么地方 存得下去没有 直接报给服务记下来 */
  setTimeout(function(){
    if(IS_STATIC) return;
    function tell(o){
      try{
        fetch('/api/diag', {method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify(o)})
          .then(function(r){ return r.json(); })
          .then(function(j){ if(!j||!j.ok) throw new Error('diag-no'); })
          .catch(function(e){
            try{
              var x=new XMLHttpRequest(); x.open('POST','/api/diag',false);
              x.setRequestHeader('Content-Type','text/plain');
              x.send(JSON.stringify({writeFail:String(e).slice(0,120)}));
            }catch(e2){}
          });
      }catch(e){}
    }
    var base={proto:location.protocol, href:String(location.href).slice(0,110),
              sub:IS_SUB, loadOk:!!fromFile, got:got,
              keys:Object.keys(mem).length, bridge:bridgeOk(),
              ua:String(navigator.userAgent||'').slice(0,90)};
    tell(base);
    setTimeout(function(){
      try{
        var probe=JSON.stringify({__probe:1, at:Date.now()});
        fetch('/api/diag', {method:'POST', headers:{'Content-Type':'application/json'},
          body:probe}).then(function(r){ return r.json(); }).then(function(j){
          tell({probe:'post', ok:!!(j&&j.ok), keys:(j&&j.keys)||0});
        }).catch(function(e){
          tell({probe:'post', ok:false, err:String(e).slice(0,140)});
        });
      }catch(e){}
    }, 1200);
  }, 2500);
})();
/* 心情台账合并：hearth_v1.mood 里缺的 就去旧台账 hearth_mood_days 里找 只读补齐 不改盘 */
(function(){
  var M={mood_happy:'happy',mood_smug:'excited',mood_calm:'calm',mood_love:'heart',
         mood_annoy:'annoyed',mood_daze:'tired',mood_sad:'sad',mood_angry:'angry'};
  window.__MoodMerge=function(mood){
    mood=mood||{};
    var lg=null;
    try{ lg=JSON.parse(localStorage.getItem('hearth_mood_days')||'null'); }catch(e){}
    if(!lg||typeof lg!=='object') return mood;
    for(var d in lg){
      if(!lg.hasOwnProperty(d)) continue;
      var r=lg[d]||{}, t=mood[d]||{};
      var u=M[r.me]||r.me||'', a=M[r.ai]||r.ai||'';
      var ch=0;
      if(!t.her&&u){ t.her=u; ch=1; }
      if(!t.me&&a){ t.me=a; ch=1; }
      if(ch&&(t.her||t.me)) mood[d]=t;
    }
    return mood;
  };
})();
