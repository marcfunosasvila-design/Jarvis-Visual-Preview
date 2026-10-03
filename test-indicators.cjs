const assert=require('node:assert/strict');
const {analyze,fetchBars,BAR}=require('./indicators.js');
const oracle=require('./tests/indicator-oracle.json');
const result=analyze(oracle.rows,oracle.now);
for(const [key,value] of Object.entries(oracle.series))assert.ok(Math.abs(result.series[key].at(-1)-value)<1e-8,`Python parity: ${key}`);
assert.equal(analyze(oracle.rows,oracle.now+BAR).status,'STALE');
assert.equal(analyze(oracle.rows.slice(0,100),oracle.now).status,'WARMUP');
assert.equal(analyze(oracle.rows.filter((_,i)=>i!==240),oracle.now).status,'DATA_GAP');
assert.throws(()=>analyze([...oracle.rows,oracle.rows.at(-1)],oracle.now));
assert.equal(analyze([...oracle.rows,[oracle.now,100,101,99,100,50]],oracle.now).bars.length,300);
(async()=>{
 const mock=async url=>{assert.ok(url.includes('category=SPOT'));assert.ok(url.includes('interval=4H'));return {ok:true,json:async()=>({code:'00000',data:oracle.rows})};};
 assert.deepEqual(await fetchBars('BTCUSDT',mock,oracle.now),oracle.rows);
 await assert.rejects(fetchBars('BAD',mock));
 await assert.rejects(fetchBars('BTCUSDT',async()=>({ok:false,status:500})));
 await assert.rejects(fetchBars('BTCUSDT',async()=>({ok:true,json:async()=>({code:'error'})})));
 console.log('10 checks passed: Python parity, causality, freshness, validation and API failures.');
})();
