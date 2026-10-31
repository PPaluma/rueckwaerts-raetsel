const { chromium } = require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files']});
 const p=await b.newPage({viewport:{width:1600,height:1066}});
 p.on('console',m=>console.log('console:',m.text())); p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file:///tmp/r3d/scene.html'); await p.waitForFunction('window.ready===true',{timeout:120000});
 const out='/home/user/rueckwaerts-raetsel/bad-fliesenplan/visualisierung';
 require('fs').mkdirSync(out,{recursive:true});
 for(const v of (process.argv[2]||'eingang,dusche,wanne,waschbecken,oben').split(',')){
   await p.evaluate(n=>window.renderView(n),v);
   await p.screenshot({path:`${out}/${v}.png`});
   console.log('ok',v);
 }
 await b.close();})();
