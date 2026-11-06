const { chromium } = require('playwright');
(async()=>{
 const b=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--allow-file-access-from-files']});
 const out='/home/user/rueckwaerts-raetsel/bad-fliesenplan/visualisierung/varianten';
 const p=await b.newPage({viewport:{width:1600,height:1066}}); p.on('pageerror',e=>console.log('ERR',e.message));
 await p.goto('file:///tmp/r3d/scene.html?v=5'); await p.waitForFunction('window.ready===true',{timeout:120000});
 for(const [v,n] of [['betreten','betreten-schrank-deckenhoch'],['schrank','waschbecken-schrank-deckenhoch']]){ await p.evaluate(x=>window.renderView(x),v); await p.screenshot({path:`${out}/${n}.png`}); console.log('ok',n);}
 await b.close();})();
