const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const server = http.createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1) || 'index.html';
  const file = path.resolve(name);
  if (!file.startsWith(process.cwd() + '/') || !fs.existsSync(file)) {
    res.writeHead(404); res.end(); return;
  }
  res.setHeader('Content-Type', {'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8'}[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
});
async function run(page, origin, width) {
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/https:\/\/fonts\./, route=>route.abort());
  await page.goto(origin+'/index.html');
  const section=page.locator('#food'), q=page.locator('#q');
  await page.locator('#topic').waitFor();
  assert.equal(await page.locator('main section').count(),23);
  assert.equal(await section.locator('tbody tr').count(),37);
  const lunch=section.locator('tr').filter({has:page.getByText('обед',{exact:true})});
  assert.equal(await lunch.count(),1);
  await page.locator('#topic').selectOption('food');
  await page.waitForURL('**/#food');
  for(const term of ['الغداء','аль-гада’','еда обед']) {
    await q.fill(term);
    assert.ok(await lunch.isVisible(),term);
  }
  await q.fill('13');assert.ok(await page.locator('.num').filter({hasText:'١٣'}).isVisible());
  await q.fill('١٣');assert.ok(await page.locator('.num').filter({hasText:'١٣'}).isVisible());
  await q.fill('xxxzzzx');assert.ok(await page.locator('#empty').isVisible());
  await q.press('Escape');assert.equal(await q.inputValue(),'');
  await page.locator('#testBtn').click();await page.locator('#hideAr').click();
  const cell=lunch.locator('td.ar');await cell.focus();await cell.press('Enter');
  assert.ok(await cell.evaluate(e=>e.classList.contains('peek')));
  await page.locator('#hideAr').click();await page.locator('#testBtn').click();
  const dimensions=await page.evaluate(()=>{
    const box=document.querySelector('#food .tablebox'), tr=document.querySelector('#food tbody tr'), v=document.querySelector('#verbs tbody tr');
    return {document:document.documentElement.scrollWidth,viewport:innerWidth,
      food:[box.clientWidth,box.scrollWidth],cells:[...tr.cells,...v.cells].filter(c=>c.offsetWidth).map(c=>c.getBoundingClientRect().toJSON())};
  });
  assert.ok(dimensions.document<=width,JSON.stringify(dimensions));
  if(width<641){assert.ok(dimensions.food[1]<=dimensions.food[0]+1);assert.ok(dimensions.cells.every(c=>c.left>=0&&c.right<=width+1));}
  await page.evaluate(()=>{
    localStorage.setItem('arabic-a1-font','naskh');
    localStorage.setItem('arab-trainer-v2',JSON.stringify({track:'ru',mode:'choice',wsecs:{verbs:true,food:false},count:10,smart:false,onlyHard:false}));
    localStorage.setItem('arab-trainer-stats-v1',JSON.stringify({'ru|previous':{b:3,r:5,w:1}}));
  });
  await section.locator('.topic-train').click();await page.locator('#start').waitFor();
  assert.ok((await page.locator('#avail').innerText()).includes('37 '));
  assert.ok(await page.locator('#secs [aria-pressed=true]').count()===1);
  assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('font-naskh')),true);
  // Finish a short session with intentional errors, then repeat only errors.
  await page.locator('#start').click();
  let missed=0;
  for(let i=0;i<10;i++){
    await page.locator('.opt').first().click();
    if(await page.locator('.opt.wrong').count())missed++;
    const score=await page.locator('#score').innerText();
    assert.equal(score,'Верно: '+(i+1-missed));
    await page.locator('#nx').click();
  }
  assert.ok((await page.locator('.big').innerText()).includes('из 10'));
  if(missed){await page.locator('#rep').click();assert.ok((await page.locator('.playbar').innerText()).includes('из '+missed));}
  const stored=await page.evaluate(()=>({prefs:JSON.parse(localStorage.getItem('arab-trainer-v2')),stats:JSON.parse(localStorage.getItem('arab-trainer-stats-v1'))}));
  assert.deepEqual(stored.stats['ru|previous'],{b:3,r:5,w:1});
  assert.equal(stored.prefs.wsecs.food,false);
  await page.goto(origin+'/trainer.html?track=form&topic=f-prep');
  await page.locator('#start').click();assert.equal(await page.locator('.opt').count(),4);
  await page.goto(origin+'/trainer.html?track=conj');await page.locator('#start').waitFor();
  await page.locator('[data-m=type]').click();await page.locator('#start').click();
  await page.locator('#skip').click();assert.equal(await page.locator('.fb .ans').count(),1);
  assert.equal(await page.getByRole('button',{name:'Дальше',exact:true}).count(),1);
  await page.locator('#nx').click();assert.ok((await page.locator('.playbar').innerText()).includes('2 из'));
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.locator('#toset').click();await page.locator('[data-m=flash]').click();await page.locator('#start').click();
  await page.locator('#show').click();await page.locator('#yes').click();
  assert.ok((await page.locator('#score').innerText()).includes('1'));
  assert.deepEqual(errors,[]);
  console.log('PASS',width,'px: search, topics, reveal, word/grammar/conjugation drills, scores, error review, saved data, layout');
}
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true});
  try{
    for(const [width,height] of [[360,780],[768,1024],[1280,800]]){
      const page=await browser.newPage({viewport:{width,height}});
      await run(page,origin,width);await page.close();
    }
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);process.exit(1)});
