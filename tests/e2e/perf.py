from playwright.sync_api import sync_playwright
U='http://127.0.0.1:8765/index.html'
with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
  ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True); ctx.route('**/fonts.googleapis.com/**',lambda r:r.fulfill(body='',content_type='text/css'))
  pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
  pg.goto(U); pg.wait_for_selector('#grid .card')
  pg.evaluate("""()=>{const s=JSON.parse(localStorage.getItem('basma_demo_v5'));const b=s.doctors[0];for(let i=0;i<800;i++)s.doctors.push({...b,id:'p'+i,slug:null,name:'طبيب رقم '+i,area:['الناصرية','الشطرة','الرفاعي'][i%3],lat:31+Math.random()*.7,lng:46+Math.random()*.5});localStorage.setItem('basma_demo_v5',JSON.stringify(s))}""")
  # CPU throttle 4x to simulate a mid-range phone
  cdp=ctx.new_cdp_session(pg); cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
  t=pg.evaluate("performance.now()"); pg.reload(); pg.wait_for_selector('#grid .card'); 
  nav=pg.evaluate("JSON.stringify({dcl:Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd),cards:document.querySelectorAll('#grid .card').length,total:document.querySelector('#cnt').textContent})")
  print('load', nav)
  t0=pg.evaluate("performance.now()"); pg.fill('#q','رقم 7'); pg.wait_for_timeout(400); print('search →', pg.inner_text('#cnt'))
  ms=pg.evaluate("""()=>new Promise(r=>{const g=document.querySelector('#grid');const q=document.querySelector('#q');q.value='طبيب';q.dispatchEvent(new Event('input'));setTimeout(()=>{const t=performance.now();const mo=new MutationObserver(()=>{mo.disconnect();r(Math.round(performance.now()-t))});mo.observe(g,{childList:true});},150)})""")
  print('search filter+render ms after debounce (4x CPU):', ms)
  pg.goto(U+'#/map'); pg.wait_for_timeout(1500); print('map list items:', pg.locator('#mlist .mitem').count())
  print('errors', errs)
