const { chromium } = require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files']});
 const out='/home/user/rueckwaerts-raetsel/bad-fliesenplan/visualisierung/varianten'; require('fs').mkdirSync(out,{recursive:true});
 for(const [v,views] of [['0','fensterwand'],['1','fensterwand'],['2','fensterwand']]){
  const p=await b.newPage({viewport:{width:1600,height:1066}}); p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto('file:///tmp/r3d/scene.html?v='+v); await p.waitForFunction('window.ready===true',{timeout:120000});
  for(const n of views.split(',')){ await p.evaluate(x=>window.renderView(x),n); await p.screenshot({path:`${out}/variante${v}-${n}.png`}); console.log('ok',v,n);} await p.close(); }
 await b.close();})();
