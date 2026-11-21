window.L=(function(){
 function ev(o){o._h={};o.on=(t,f)=>{(o._h[t]=o._h[t]||[]).push(f);return o};o.fire=(t,e)=>{(o._h[t]||[]).forEach(f=>f(e))};return o}
 const L={};
 L.map=function(el){el.style.background='repeating-linear-gradient(45deg,#dfe8e4,#dfe8e4 20px,#e9efe9 20px,#e9efe9 40px)';el.style.position='absolute';
  const m=ev({_el:el,_c:[0,0],setView(c){m._c=c;return m},fitBounds(){return m},invalidateSize(){},getBounds(){return {pad(){return {contains(){return true}}}}},remove(){el.innerHTML=''},getContainer(){return el}});
  el.addEventListener('click',e=>{if(e.target===el)m.fire('click',{latlng:{lat:31.05,lng:46.26}})});return m};
 L.tileLayer=()=>({addTo(){return this}});
 L.layerGroup=()=>{const g={_m:null,_l:[],addTo(m){g._m=m;return g},clearLayers(){g._l.forEach(x=>x._d&&x._d.remove());g._l=[]}};return g};
 L.latLngBounds=()=>({pad(){return this}});
 L.divIcon=o=>o;
 L.marker=(ll,o)=>{const mk={_ll:ll,bindPopup(h){mk._p=h;return mk},addTo(t){const m=t._el?t:t._m;if(t._l)t._l.push(mk);mk._m=m;const d=document.createElement('div');d.innerHTML=(o.icon&&o.icon.html)||'';d.style.cssText='position:absolute;left:'+(20+((ll[1]-46)*400)%90)+'%;top:'+(10+((31.8-ll[0])*90)%80)+'%';d.onclick=()=>mk.openPopup();m._el.append(d);mk._d=d;return mk},
  getLatLng(){return {lat:mk._ll[0],lng:mk._ll[1]}},setLatLng(l){mk._ll=l;return mk},remove(){mk._d&&mk._d.remove()},on(){return mk},
  openPopup(){const m=mk._m;m._el.querySelectorAll('.lp').forEach(x=>x.remove());const p=document.createElement('div');p.className='lp';p.style.cssText='position:absolute;top:20px;left:20px;background:#fff;padding:12px;border-radius:12px;width:260px;box-shadow:0 8px 20px rgba(0,0,0,.3)';p.innerHTML=mk._p||'';m._el.append(p);m.fire('popupopen',{popup:{getElement:()=>p}});return mk}};return mk};
 return L})();
