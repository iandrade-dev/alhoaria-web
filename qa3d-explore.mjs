import {launch,M,D,URL,OUT,attach,measure} from "./qa3d-lib.mjs";
const b=await launch(); const ctx=await b.newContext(M); const page=await ctx.newPage(); const bag={}; attach(page,bag);
await page.goto(URL+"/bancada",{waitUntil:"networkidle"}); await page.waitForTimeout(3000);
console.log(await page.evaluate(()=>{const c=document.createElement('canvas');return !!c.getContext('webgl2')}));
console.log(JSON.stringify(await measure(page),null,1));
await page.screenshot({path:OUT+"/x-explore.png"});
console.log(await page.evaluate(()=>document.body.innerText.slice(0,500)));
console.log(JSON.stringify({e:bag.pageerrors,c:bag.consoleErr,w:bag.consoleWarn.slice(0,5)}));
await b.close();
