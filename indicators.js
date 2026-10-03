(function(root){
'use strict';
const BAR=14400000;
function ema(xs,alpha){let value=null;return xs.map(x=>{if(!Number.isFinite(x))return NaN;value=value===null?x:alpha*x+(1-alpha)*value;return value;});}
function mean(xs,n){return xs.map((_,i)=>i<n-1?NaN:xs.slice(i-n+1,i+1).reduce((a,b)=>a+b,0)/n);}
function analyze(rows,now=Date.now()){
 const bars=rows.map(r=>r.slice(0,6).map(Number)).filter(r=>r[0]+BAR<=now).sort((a,b)=>a[0]-b[0]);
 const seen=new Set();
 for(const r of bars){const [t,o,h,l,c,v]=r;if(r.length!==6||!r.every(Number.isFinite)||t%BAR||Math.min(o,h,l,c)<=0||v<0||h<Math.max(o,l,c)||l>Math.min(o,h,c)||seen.has(t))throw Error('Velas inválidas o duplicadas');seen.add(t);}
 if(bars.length<220)return {status:'WARMUP',bars};
 if(bars.some((r,i)=>i>0&&r[0]-bars[i-1][0]!==BAR))return {status:'DATA_GAP',bars};
 const close=bars.map(r=>r[4]),typical=bars.map(r=>(r[2]+r[3]+r[4])/3);
 const e200=ema(close,2/201),e12=ema(close,2/13),e26=ema(close,2/27);
 const macd=e12.map((x,i)=>x-e26[i]),signal=ema(macd,2/10),hist=macd.map((x,i)=>x-signal[i]);
 const esa=ema(typical,2/11),dev=ema(typical.map((x,i)=>Math.abs(x-esa[i])),2/11);
 const wt1=ema(typical.map((x,i)=>dev[i]?(x-esa[i])/(.015*dev[i]):NaN),2/22),wt2=mean(wt1,4);
 const flow=mean(bars.map(r=>r[2]===r[3]?0:100*(r[4]-r[1])/(r[2]-r[3])),60);
 const volume=bars.map(r=>r[5]),prior=mean([NaN,...volume.slice(0,-1)],20),ratio=volume.map((v,i)=>prior[i]>0?v/prior[i]:NaN);
 const delta=close.slice(1).map((x,i)=>x-close[i]);
 const gain=[NaN,...ema(delta.map(x=>Math.max(0,x)),1/14)],loss=[NaN,...ema(delta.map(x=>Math.max(0,-x)),1/14)];
 const rsi=gain.map((g,i)=>loss[i]===0?(g===0?50:100):100-100/(1+g/loss[i]));
 const i=bars.length-1,p=i-1;
 const checks=[['Precio sobre EMA200 y EMA200 ascendente',close[i]>e200[i]&&e200[i]>e200[p]],['Cruce WaveTrend alcista desde zona negativa',wt1[p]<=wt2[p]&&wt1[i]>wt2[i]&&wt1[p]<0],['Flujo medio de vela positivo (proxy)',flow[i]>0],['MACD positivo y creciendo',hist[i]>0&&hist[i]>hist[p]],['Volumen ≥ 1,2 × media previa',ratio[i]>=1.2]];
 const asOf=bars[i][0]+BAR,status=now>=asOf+BAR?'STALE':checks.every(x=>x[1])?'LONG_CONFLUENCE':'WAIT';
 return {status,bars,checks,asOf,series:{close,e200,wt1,wt2,hist,rsi,flow,ratio}};
}
async function fetchBars(symbol,fetcher=fetch,now=Date.now()){
 if(!['BTCUSDT','SOLUSDT'].includes(symbol))throw Error('Activo no admitido');
 const url='https://api.bitget.com/api/v3/market/candles?category=SPOT&symbol='+symbol+'&interval=4H&limit=340&endTime='+now;
 const response=await fetcher(url,{signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error('Bitget HTTP '+response.status);
 const json=await response.json();
 if(json.code!=='00000'||!Array.isArray(json.data))throw Error('Bitget: respuesta no válida');
 return json.data;
}
const api={BAR,analyze,fetchBars};
if(typeof module!=='undefined')module.exports=api;else root.JarvisIndicators=api;
})(globalThis);
