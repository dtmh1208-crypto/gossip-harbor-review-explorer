// Exercise the actual app's pure search/filter/render helpers without external packages.
// This verifies logic and content safety; it is not a substitute for a visual browser check.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const payload=JSON.parse(await readFile(new URL('reviews.json',import.meta.url),'utf8'));
const source=await readFile(new URL('app.js',import.meta.url),'utf8');
const html=await readFile(new URL('index.html',import.meta.url),'utf8');
const embedded=JSON.parse(html.match(/<script type="application\/json" id="review-data">([\s\S]*?)<\/script>/)[1]);
assert.deepEqual(embedded,payload);
const context={document:{getElementById:id=>{assert.equal(id,'review-data');return {textContent:JSON.stringify(payload)};}},
  localStorage:{getItem:()=>null},setTimeout,clearTimeout,console};
vm.createContext(context);
const prefix=source.slice(0,source.indexOf("  $('export-btn').addEventListener"));
vm.runInContext(prefix+'globalThis.appTest={reviews,state,matches,terms,highlighted,csvCell,card,evidence};})();',context);
const api=context.appTest;
const count=()=>api.reviews.filter(r=>api.matches(r,api.terms())).length;
const reset=()=>{
  Object.assign(api.state,{q:'',searchMode:'all',stars:new Set(),categories:new Set(),categoryMode:'any',from:'',to:'',version:'',minWords:0,saved:'all'});
};
assert.equal(count(),6250);
assert.equal(new Set(api.reviews.map(r=>r.id)).size,6250);
assert.equal(api.reviews.reduce((s,r)=>s+r.stars,0)/6250,3.22448);
api.state.stars=new Set([1]);assert.equal(count(),1983);
api.state.categories=new Set(['ad-mismatch']);
assert.equal(count(),api.reviews.filter(r=>r.stars===1&&r.categories.includes('ad-mismatch')).length);
reset();api.state.categories=new Set(['energy','spending']);api.state.categoryMode='all';
assert.equal(count(),api.reviews.filter(r=>r.categories.includes('energy')&&r.categories.includes('spending')).length);
api.state.categoryMode='any';
assert.equal(count(),api.reviews.filter(r=>r.categories.includes('energy')||r.categories.includes('spending')).length);
reset();api.state.q='14767307086';assert.equal(count(),1);
assert.ok(api.card(api.reviews.find(r=>r.id==='14767307086')).includes('Read & cite'));
reset();api.state.q='"energy refill"';
assert.ok(count()>0);assert.equal(api.terms().length,1);
assert.ok(api.highlighted('I need an energy refill.').includes('<mark>energy refill</mark>'));
api.state.q='money energy';api.state.searchMode='all';const all=count();
api.state.searchMode='any';assert.ok(count()>all&&all>0);
api.state.searchMode='phrase';api.state.q='""';assert.equal(api.terms().length,0);
reset();api.state.from='2026-11-07';api.state.to='2026-11-09';
assert.equal(count(),api.reviews.filter(r=>r.date>='2026-11-07'&&r.date<='2026-11-09').length);
reset();api.state.version='4.11.0';assert.equal(count(),289);
reset();api.state.minWords=100;assert.equal(count(),api.reviews.filter(r=>r.words>=100).length);
reset();api.evidence['14767307086']={note:'Evidence note'};api.state.saved='saved';assert.equal(count(),1);
api.state.saved='unsaved';assert.equal(count(),6249);
reset();api.state.categories=new Set(['untagged']);assert.equal(count(),api.reviews.filter(r=>!r.categories.length).length);
reset();api.state.q='not-a-real-review-qxzy-184909';assert.equal(count(),0);
reset();assert.equal(api.highlighted('<img src=x onerror="alert(1)">'),'&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
api.state.q='[test]';assert.ok(api.highlighted('A [test] literal').includes('<mark>[test]</mark>'));
assert.equal(api.csvCell('=SUM(A1:A2)'),`"'=SUM(A1:A2)"`);
assert.equal(api.csvCell('one,"two"'),`"one,""two"""`);
assert.ok(!html.includes('/* DATA */')&&!html.includes('/* APP */')&&!html.includes('/* STYLES */'));
console.log('PASS: embedded library equals JSON; 6,250 unique reviews; ratings; stars; topic AND/OR; ID/all/any/phrase searches; dates; version; word length; saved/unsaved; uncategorized; empty results; HTML escaping; literal regex highlighting; CSV escaping.');
