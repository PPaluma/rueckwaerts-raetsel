const { chromium } = require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files']});
 const out='/home/user/rueckwaerts-raetsel/bad-fliesenplan/visualisierung/varianten';
 for(const [v,name] of [['1','betreten-geplant'],['4','betreten-alle-waende-235']]){
  const p=await b.newPage({viewport:{width:1600,height:1066}}); p.on('pageerror',e=>console.log('ERR',e.message));
  await p.goto('file:///tmp/r3d/scene.html?v='+v); await p.waitForFunction('window.ready===true',{timeout:120000});
  await p.evaluate(()=>window.renderView('betreten')); await p.screenshot({path:`${out}/${name}.png`}); console.log('ok',name); await p.close(); }
 await b.close();})();
