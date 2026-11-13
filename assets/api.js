/* Mini web <-> sunucu köprüsü. Kimlik: Telegram initData (sunucu imzayı doğrular). */
(function(){
  var cfg=window.GAMEON_CONFIG||{};
  var API=(cfg.API_URL||"").replace(/\/+$/,"");
  function initData(){
    try{var t=window.Telegram||(window.parent&&window.parent.Telegram);return(t&&t.WebApp&&t.WebApp.initData)||""}catch(e){return""}
  }
  function call(path,opt){
    if(!API)return Promise.reject(new Error("no-api"));
    var h={"Content-Type":"application/json","X-Init-Data":initData()};
    var ctl=("AbortController"in window)?new AbortController():null;
    var to=setTimeout(function(){ctl&&ctl.abort()},8000);
    return fetch(API+path,Object.assign({headers:h,signal:ctl&&ctl.signal},opt||{})).then(function(r){
      clearTimeout(to);return r.json().catch(function(){return{}}).then(function(j){j._status=r.status;return j})});
  }
  window.GameOnAPI={
    enabled:!!API,
    req:function(m,p,b){return call(p,{method:m,body:b===undefined?undefined:JSON.stringify(b)})},
    auth:function(){return call("/api/auth",{method:"POST",body:"{}"})},
    announcements:function(){return call("/api/announcements")}
  };
})();
