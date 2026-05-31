import { useState, useEffect, useCallback, useMemo } from "react";

const MARKETS = [
  { id:"egx",    name:"EGX",    label:"Egyptian Exchange",  currency:"EGP",  flag:"🇪🇬", color:"#c9952a" },
  { id:"adx",    name:"ADX",    label:"Abu Dhabi Exchange", currency:"AED",  flag:"🇦🇪", color:"#00b5d8" },
  { id:"us",     name:"US",     label:"US Markets",         currency:"USD",  flag:"🇺🇸", color:"#5b8ef8" },
  { id:"crypto", name:"Crypto", label:"Binance Crypto",     currency:"USDT", flag:"₿",  color:"#f7931a" },
];
const BUCKETS = ["Swing (3d-2mo)","Long-Term (up to 1yr)","Flexible"];
const BCOLORS = ["#5b8ef8","#c9952a","#9b7cf4"];
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2,7);
const fmt = (n, d=2) => { if(n===null||n===undefined||isNaN(n)) return "0.00"; return Number(n).toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}); };
const fmtD = d => { if(!d) return ""; return new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}); };
const DEFAULT_FX = { USD:1, USDT:1, EGP:0.0196, AED:0.2723 };
const SKEY = "portfolio-tracker-v7";

async function loadData() { try { const r = await window.storage.get(SKEY); return r ? JSON.parse(r.value) : null; } catch { return null; } }
async function saveData(d) { try { await window.storage.set(SKEY, JSON.stringify(d)); } catch(e) { console.error(e); } }

const SEED = {
  transactions: [
    {id:"us-buy-panw",market:"us",type:"buy",ticker:"PANW",qty:0.50,price:257.70,date:"2026-05-01",bucket:"Swing (3d-2mo)",notes:"Palo Alto Networks",currency:"USD"},
    {id:"us-buy-orcl",market:"us",type:"buy",ticker:"ORCL",qty:1.00,price:182.63,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"Oracle",currency:"USD"},
    {id:"us-buy-msft",market:"us",type:"buy",ticker:"MSFT",qty:0.407,price:409.15,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"Microsoft",currency:"USD"},
    {id:"us-buy-meta",market:"us",type:"buy",ticker:"META",qty:0.650,price:607.52,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"Meta Platforms",currency:"USD"},
    {id:"us-buy-vst",market:"us",type:"buy",ticker:"VST",qty:1.00,price:140.00,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"Vistra — stop $128",currency:"USD"},
    {id:"us-buy-isrg",market:"us",type:"buy",ticker:"ISRG",qty:0.357,price:434.98,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"Intuitive Surgical — stop $395",currency:"USD"},
    {id:"us-buy-nasa",market:"us",type:"buy",ticker:"NASA",qty:11.00,price:36.91,date:"2026-05-01",bucket:"Swing (3d-2mo)",notes:"Procure Space ETF",currency:"USD"},
    {id:"us-buy-jets",market:"us",type:"buy",ticker:"JETS",qty:3.00,price:26.48,date:"2026-05-20",bucket:"Swing (3d-2mo)",notes:"US Global Jets ETF",currency:"USD"},
    {id:"us-buy-sfm",market:"us",type:"buy",ticker:"SFM",qty:2.50,price:89.00,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"Sprouts — stop $81.88",currency:"USD"},
    {id:"us-buy-intu",market:"us",type:"buy",ticker:"INTU",qty:1.25,price:342.72,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"Intuit",currency:"USD"},
    {id:"us-buy-nvda",market:"us",type:"buy",ticker:"NVDA",qty:1.00,price:212.50,date:"2026-05-01",bucket:"Swing (3d-2mo)",notes:"NVIDIA — stop pending",currency:"USD"},
    {id:"us-buy-sofi",market:"us",type:"buy",ticker:"SOFI",qty:10.00,price:16.00,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"SoFi — stop $14.72",currency:"USD"},
    {id:"us-buy-bili",market:"us",type:"buy",ticker:"BILI",qty:10.00,price:17.10,date:"2026-05-27",bucket:"Swing (3d-2mo)",notes:"Bilibili ADR",currency:"USD"},
    {id:"us-buy-now",market:"us",type:"buy",ticker:"NOW",qty:3.00,price:119.00,date:"2026-05-28",bucket:"Swing (3d-2mo)",notes:"ServiceNow",currency:"USD"},
    {id:"us-buy-qfin",market:"us",type:"buy",ticker:"QFIN",qty:15.00,price:15.30,date:"2026-05-28",bucket:"Swing (3d-2mo)",notes:"360 Finance ADR",currency:"USD"},
    {id:"egx-buy-comi",market:"egx",type:"buy",ticker:"COMI",qty:76,price:121.7,date:"2026-04-01",bucket:"Long-Term (up to 1yr)",notes:"Commercial International Bank",currency:"EGP"},
    {id:"egx-buy-cff",market:"egx",type:"buy",ticker:"CFF",qty:453,price:18,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"CI Capital Holding",currency:"EGP"},
    {id:"egx-buy-csag",market:"egx",type:"buy",ticker:"CSAG",qty:239,price:27.85,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"Channel & Suez Agricultural",currency:"EGP"},
    {id:"egx-buy-abr",market:"egx",type:"buy",ticker:"ABR",qty:130,price:189.87,date:"2026-04-01",bucket:"Long-Term (up to 1yr)",notes:"Bareeq Fund",currency:"EGP"},
    {id:"egx-buy-bsb",market:"egx",type:"buy",ticker:"BSB",qty:5138,price:1.86,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"Beltone Securities",currency:"EGP"},
    {id:"egx-buy-amoc",market:"egx",type:"buy",ticker:"AMOC",qty:750,price:8.9,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"Alexandria Mineral Oils",currency:"EGP"},
    {id:"egx-buy-tmgh",market:"egx",type:"buy",ticker:"TMGH",qty:135,price:86.54,date:"2026-04-16",bucket:"Swing (3d-2mo)",notes:"Talaat Moustafa Group",currency:"EGP"},
    {id:"egx-buy-cti",market:"egx",type:"buy",ticker:"CTI",qty:201,price:16.89,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"CI Capital IB",currency:"EGP"},
    {id:"egx-buy-bco",market:"egx",type:"buy",ticker:"BCO",qty:3499,price:1.43,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"Beltone Financial",currency:"EGP"},
    {id:"egx-buy-mcqe",market:"egx",type:"buy",ticker:"MCQE",qty:1,price:2371.44,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"MCQE closed",currency:"EGP"},
    {id:"egx-sell-mcqe",market:"egx",type:"sell",ticker:"MCQE",qty:1,price:3358.78,date:"2026-04-14",bucket:"Swing (3d-2mo)",notes:"+987 EGP profit",currency:"EGP"},
    {id:"egx-buy-oras",market:"egx",type:"buy",ticker:"ORAS",qty:1,price:4020.34,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"Orascom closed",currency:"EGP"},
    {id:"egx-sell-oras",market:"egx",type:"sell",ticker:"ORAS",qty:1,price:5689.87,date:"2026-04-09",bucket:"Swing (3d-2mo)",notes:"+1670 EGP profit",currency:"EGP"},
    {id:"adx-buy-adsb",market:"adx",type:"buy",ticker:"ADSB",qty:120,price:7.213,date:"2026-04-08",bucket:"Swing (3d-2mo)",notes:"Abu Dhabi Ship Building",currency:"AED"},
    {id:"adx-buy-aldar",market:"adx",type:"buy",ticker:"ALDAR",qty:140,price:8.514,date:"2026-04-17",bucket:"Swing (3d-2mo)",notes:"Aldar Properties",currency:"AED"},
    {id:"adx-buy-turki",market:"adx",type:"buy",ticker:"TURKI",qty:1,price:800.84,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"Turki closed",currency:"AED"},
    {id:"adx-sell-turki",market:"adx",type:"sell",ticker:"TURKI",qty:1,price:830.47,date:"2026-04-10",bucket:"Swing (3d-2mo)",notes:"+30 AED",currency:"AED"},
    {id:"adx-buy-dana",market:"adx",type:"buy",ticker:"DANA",qty:1,price:1113.71,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"Dana Gas closed",currency:"AED"},
    {id:"adx-sell-dana",market:"adx",type:"sell",ticker:"DANA",qty:1,price:1155.05,date:"2026-04-08",bucket:"Swing (3d-2mo)",notes:"+41 AED",currency:"AED"},
    {id:"adx-buy-pre",market:"adx",type:"buy",ticker:"PRESIGHT",qty:1,price:585.98,date:"2026-04-01",bucket:"Swing (3d-2mo)",notes:"Presight AI closed",currency:"AED"},
    {id:"adx-sell-pre",market:"adx",type:"sell",ticker:"PRESIGHT",qty:1,price:608.74,date:"2026-04-08",bucket:"Swing (3d-2mo)",notes:"+23 AED",currency:"AED"},
  ],
  topups: [
    {id:"topup-us-1",market:"us",type:"deposit",amount:4000,date:"2026-04-01",notes:"External capital — Thndr",currency:"USD"},
    {id:"topup-us-2",market:"us",type:"deposit",amount:170,date:"2026-05-31",notes:"Realized P&L to wallet",currency:"USD"},
    {id:"topup-egx",market:"egx",type:"deposit",amount:100000,date:"2026-04-01",notes:"Initial — EGX",currency:"EGP"},
    {id:"topup-egx-div",market:"egx",type:"deposit",amount:433.20,date:"2026-04-15",notes:"COMI Dividends",currency:"EGP"},
    {id:"topup-adx",market:"adx",type:"deposit",amount:3672,date:"2026-04-01",notes:"Initial — ADX",currency:"AED"},
  ],
  fxRates: DEFAULT_FX,
  currentPrices: {
    "us:PANW":"281.75","us:ORCL":"226.17","us:MSFT":"449.99","us:META":"633.00",
    "us:VST":"160.23","us:ISRG":"429.22","us:NASA":"40.29","us:JETS":"28.95",
    "us:SFM":"82.65","us:INTU":"331.64","us:NVDA":"212.49","us:SOFI":"18.27",
    "us:BILI":"17.35","us:NOW":"128.81","us:QFIN":"16.08",
    "egx:COMI":"140.00","egx:CFF":"19.67","egx:CSAG":"30.26","egx:ABR":"199.92",
    "egx:BSB":"1.906","egx:AMOC":"8.25","egx:TMGH":"86.50","egx:CTI":"16.84","egx:BCO":"1.42",
    "adx:ADSB":"7.29","adx:ALDAR":"8.50",
  },
};
const INIT = { transactions:[], topups:[], fxRates:DEFAULT_FX, currentPrices:{} };

// ── Analytics ─────────────────────────────────────────────
function analyse(data) {
  const fx=data.fxRates||DEFAULT_FX, txns=data.transactions||[], tops=data.topups||[], px=data.currentPrices||{};
  const hm={};
  txns.forEach(t=>{
    const k=`${t.market}:${t.ticker}`;
    if(!hm[k]) hm[k]={market:t.market,ticker:t.ticker,qty:0,costBasis:0,realized:0,currency:t.currency,bucket:t.bucket};
    if(t.type==="buy"){hm[k].costBasis+=t.qty*t.price;hm[k].qty+=t.qty;}
    else{const a=hm[k].qty>0?hm[k].costBasis/hm[k].qty:0;hm[k].realized+=(t.price-a)*t.qty;hm[k].costBasis-=a*t.qty;hm[k].qty-=t.qty;}
  });
  const holdings=Object.values(hm).filter(h=>h.qty>0.0001);
  holdings.forEach(h=>{
    const cp=parseFloat(px[`${h.market}:${h.ticker}`]);
    h.currentPrice=isNaN(cp)?null:cp;
    h.currentValue=h.currentPrice!==null?h.qty*h.currentPrice:null;
    h.uPL=h.currentValue!==null?h.currentValue-h.costBasis:null;
    h.uPLpct=h.costBasis>0&&h.uPL!==null?(h.uPL/h.costBasis)*100:null;
    h.avgCost=h.qty>0?h.costBasis/h.qty:0;
  });
  const ms={};
  MARKETS.forEach(m=>{
    const mT=tops.filter(t=>t.market===m.id);
    const deps=mT.filter(t=>t.type==="deposit").reduce((s,t)=>s+t.amount,0);
    const withs=mT.filter(t=>t.type==="withdrawal").reduce((s,t)=>s+t.amount,0);
    const mH=holdings.filter(h=>h.market===m.id);
    const inv=mH.reduce((s,h)=>s+h.costBasis,0);
    const val=mH.reduce((s,h)=>s+(h.currentValue??h.costBasis),0);
    const real=Object.values(hm).filter(h=>h.market===m.id).reduce((s,h)=>s+h.realized,0);
    const unreal=mH.reduce((s,h)=>s+(h.uPL??0),0);
    const bought=txns.filter(t=>t.market===m.id&&t.type==="buy").reduce((s,t)=>s+t.qty*t.price,0);
    const sold=txns.filter(t=>t.market===m.id&&t.type==="sell").reduce((s,t)=>s+t.qty*t.price,0);
    const rate=fx[m.currency]||1;
    ms[m.id]={deps,withs,wallet:deps-withs,inv,val,real,unreal,cash:deps-withs-bought+sold,holdings:mH.length,
      invUSD:inv*rate,valUSD:val*rate,realUSD:real*rate,unrealUSD:unreal*rate,cashUSD:(deps-withs-bought+sold)*rate,walletUSD:(deps-withs)*rate,currency:m.currency};
  });
  const tInv=Object.values(ms).reduce((s,m)=>s+m.invUSD,0);
  const tVal=Object.values(ms).reduce((s,m)=>s+m.valUSD,0);
  const tReal=Object.values(ms).reduce((s,m)=>s+m.realUSD,0);
  const tUnreal=Object.values(ms).reduce((s,m)=>s+m.unrealUSD,0);
  const tCash=Object.values(ms).reduce((s,m)=>s+m.cashUSD,0);
  const bkt={};
  BUCKETS.forEach(b=>{bkt[b]=0;});
  holdings.forEach(h=>{const r=fx[h.currency]||1;const v=(h.currentValue??h.costBasis)*r;if(bkt[h.bucket]!==undefined)bkt[h.bucket]+=v;});
  return{holdings,ms,tInv,tVal,tReal,tUnreal,tCash,bkt};
}

// ── CSS ───────────────────────────────────────────────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Outfit:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:#1a2035;border-radius:2px;}
.pt{min-height:100vh;background:#07090e;color:#ccd4f0;font-family:'Outfit',sans-serif;font-size:14px;line-height:1.5;}
.pt-hdr{background:rgba(10,13,22,0.96);border-bottom:1px solid #131928;padding:20px 26px 0;position:sticky;top:0;z-index:100;backdrop-filter:blur(16px);}
.pt-hdr-top{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:14px;margin-bottom:20px;}
.pt-brand{display:flex;align-items:center;gap:11px;}
.pt-brand-icon{width:38px;height:38px;background:linear-gradient(135deg,#b8841f,#e0a830);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;box-shadow:0 4px 16px rgba(201,149,42,0.3);}
.pt-brand-name{font-family:'Cormorant Garamond',serif;font-size:21px;font-weight:700;color:#e0e8ff;letter-spacing:-0.3px;}
.pt-brand-tag{font-size:10px;color:#2e3858;font-weight:600;letter-spacing:1.8px;text-transform:uppercase;margin-top:1px;}
.pt-hero{text-align:right;}
.pt-hero-lbl{font-size:9px;font-weight:700;color:#2e3858;letter-spacing:2.5px;text-transform:uppercase;margin-bottom:4px;}
.pt-hero-val{font-family:'Cormorant Garamond',serif;font-size:46px;font-weight:700;color:#e8eeff;letter-spacing:-1.5px;line-height:1;}
.pt-hero-val sup{font-size:20px;color:#2e3858;vertical-align:top;margin-top:8px;display:inline-block;margin-right:2px;}
.pt-pnl{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;margin-top:6px;}
.g-tag{background:rgba(0,205,155,0.1);color:#00cd9b;border:1px solid rgba(0,205,155,0.2);}
.r-tag{background:rgba(240,70,70,0.1);color:#f04646;border:1px solid rgba(240,70,70,0.2);}
.pt-btns{display:flex;gap:7px;flex-wrap:wrap;align-items:flex-start;}
.btn{display:inline-flex;align-items:center;gap:5px;padding:8px 14px;border-radius:7px;font-family:'Outfit',sans-serif;font-size:12px;font-weight:600;cursor:pointer;transition:all 0.15s;border:1px solid transparent;white-space:nowrap;}
.b-ghost{background:transparent;color:#3d4870;border-color:#131928;}.b-ghost:hover{background:#0d1020;color:#7880a8;border-color:#1a2438;}
.b-out{background:transparent;color:#c9952a;border-color:rgba(201,149,42,0.3);}.b-out:hover{background:rgba(201,149,42,0.08);border-color:#c9952a;}
.b-pri{background:linear-gradient(135deg,#b8841f,#d4981f);color:#06070a;border-color:transparent;}.b-pri:hover{background:linear-gradient(135deg,#c9952a,#e4a820);}
.b-suc{background:rgba(0,205,155,0.1);color:#00cd9b;border-color:rgba(0,205,155,0.25);}.b-suc:hover{background:rgba(0,205,155,0.2);}
.b-dan{background:rgba(240,70,70,0.1);color:#f04646;border-color:rgba(240,70,70,0.25);}.b-dan:hover{background:rgba(240,70,70,0.2);}
.pt-nav{display:flex;align-items:center;overflow-x:auto;scrollbar-width:none;}.pt-nav::-webkit-scrollbar{display:none;}
.pt-tab{padding:11px 17px;background:none;border:none;border-bottom:2px solid transparent;color:#2e3858;font-family:'Outfit',sans-serif;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.15s;white-space:nowrap;letter-spacing:1px;text-transform:uppercase;}
.pt-tab:hover{color:#5a6490;}.pt-tab.on{color:#ccd4f0;border-bottom-color:#c9952a;}
.pt-sel{margin-left:auto;padding:5px 9px;background:#0a0d16;border:1px solid #131928;border-radius:6px;color:#5a6490;font-size:11px;font-family:'Outfit',sans-serif;cursor:pointer;margin-bottom:7px;flex-shrink:0;}
.pt-body{padding:22px 26px;max-width:1200px;}
.sec{font-size:9px;font-weight:700;color:#1c2340;letter-spacing:2.5px;text-transform:uppercase;margin:28px 0 14px;display:flex;align-items:center;gap:10px;}
.sec::after{content:'';flex:1;height:1px;background:#0d1020;}.sec:first-child{margin-top:0;}
.srow{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:11px;margin-bottom:4px;}
.sc{background:#0a0d16;border:1px solid #131928;border-radius:11px;padding:15px 17px;position:relative;overflow:hidden;transition:border-color 0.2s,transform 0.2s;}
.sc:hover{border-color:#1a2438;transform:translateY(-1px);}
.sc-acc{position:absolute;top:0;left:0;width:3px;height:100%;border-radius:11px 0 0 11px;}
.sc-lbl{font-size:9px;font-weight:700;color:#1c2340;letter-spacing:2px;text-transform:uppercase;margin-bottom:9px;}
.sc-val{font-family:'IBM Plex Mono',monospace;font-size:20px;font-weight:600;color:#ccd4f0;line-height:1.1;}
.sc-sub{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#2e3858;margin-top:5px;}
.mgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:11px;}
.mc{background:#0a0d16;border:1px solid #131928;border-radius:11px;padding:17px;transition:border-color 0.2s,transform 0.2s;position:relative;overflow:hidden;}
.mc:hover{transform:translateY(-2px);}
.mc-glow{position:absolute;top:-50px;right:-50px;width:120px;height:120px;border-radius:50%;opacity:0.06;filter:blur(24px);}
.mc-top{display:flex;align-items:center;gap:10px;margin-bottom:13px;}
.mc-flag{font-size:23px;line-height:1;}
.mc-name{font-family:'Cormorant Garamond',serif;font-size:19px;font-weight:700;color:#ccd4f0;}
.mc-ccy{margin-left:auto;font-size:9px;font-weight:700;color:#1c2340;letter-spacing:1.5px;padding:2px 7px;background:#0d1020;border-radius:4px;border:1px solid #131928;}
.mc-row{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #0d1020;}.mc-row:last-child{border-bottom:none;}
.mc-k{font-size:11px;color:#2e3858;font-weight:500;}.mc-v{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:500;color:#ccd4f0;}
.mc-ft{font-size:10px;color:#1c2340;margin-top:10px;padding-top:10px;border-top:1px solid #0d1020;}
.bgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:11px;}
.bc{background:#0a0d16;border:1px solid #131928;border-radius:11px;padding:15px 17px;}
.bc-lbl{font-size:11px;font-weight:600;margin-bottom:8px;}
.bc-val{font-family:'IBM Plex Mono',monospace;font-size:19px;font-weight:600;color:#ccd4f0;margin-bottom:10px;}
.bar-bg{height:3px;background:#131928;border-radius:2px;overflow:hidden;margin-bottom:6px;}
.bar-fill{height:100%;border-radius:2px;transition:width 1.2s cubic-bezier(0.16,1,0.3,1);}
.bc-pct{font-family:'IBM Plex Mono',monospace;font-size:10px;color:#1c2340;}
.cpbox{background:#0a0d16;border:1px solid #131928;border-radius:11px;padding:17px;}
.cp-ttl{font-family:'Cormorant Garamond',serif;font-size:16px;font-weight:600;color:#5a6490;margin-bottom:5px;}
.cp-desc{font-size:12px;color:#1c2340;margin-bottom:12px;line-height:1.7;}
.tw{overflow-x:auto;}
table{width:100%;border-collapse:collapse;}
th{text-align:left;padding:10px 13px;font-size:9px;font-weight:700;color:#1c2340;letter-spacing:2px;text-transform:uppercase;border-bottom:1px solid #131928;white-space:nowrap;}
td{padding:10px 13px;border-bottom:1px solid #0d1020;vertical-align:middle;}
tr:hover td{background:rgba(255,255,255,0.012);}
.tkr{font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;color:#ccd4f0;letter-spacing:0.5px;}
.num{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:500;color:#ccd4f0;}
.dim{font-family:'IBM Plex Mono',monospace;font-size:12px;color:#1c2340;}
.g{color:#00cd9b!important;}.r{color:#f04646!important;}
.bdg{display:inline-flex;align-items:center;padding:2px 8px;border-radius:5px;font-size:10px;font-weight:700;letter-spacing:0.5px;}
.bdg-buy{background:rgba(0,205,155,0.1);color:#00cd9b;}.bdg-sell{background:rgba(240,70,70,0.1);color:#f04646;}
.bdg-dep{background:rgba(91,142,248,0.1);color:#5b8ef8;}.bdg-with{background:rgba(240,70,70,0.1);color:#f04646;}
.empty{text-align:center;padding:64px 20px;color:#1c2340;}
.empty-ico{font-size:36px;margin-bottom:14px;}.empty-txt{font-size:14px;}
.delbtn{background:none;border:none;color:#1a2035;cursor:pointer;font-size:13px;padding:3px 7px;border-radius:4px;transition:all 0.15s;}
.delbtn:hover{color:#f04646;background:rgba(240,70,70,0.1);}
.wgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:11px;}
.wc{background:#0a0d16;border:1px solid #131928;border-radius:11px;padding:17px;}
.wr{display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #0d1020;}.wr:last-child{border-bottom:none;}
.wk{font-size:11px;color:#2e3858;}.wv{font-family:'IBM Plex Mono',monospace;font-size:12px;font-weight:500;color:#ccd4f0;}
.ovl{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:20px;animation:fO 0.15s ease;}
@keyframes fO{from{opacity:0}to{opacity:1}}@keyframes sU{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
.modal{background:#0a0d16;border:1px solid #1a2438;border-radius:14px;width:100%;max-width:510px;max-height:86vh;overflow:auto;animation:sU 0.22s cubic-bezier(0.16,1,0.3,1);box-shadow:0 40px 100px rgba(0,0,0,0.75),0 0 0 1px rgba(201,149,42,0.07);}
.mhdr{display:flex;justify-content:space-between;align-items:center;padding:19px 22px;border-bottom:1px solid #131928;}
.mttl{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:700;color:#ccd4f0;}
.mclose{background:none;border:none;color:#1c2340;font-size:20px;cursor:pointer;padding:0 4px;line-height:1;transition:color 0.15s;}.mclose:hover{color:#ccd4f0;}
.mbody{padding:20px 22px;}
.fld{margin-bottom:15px;}
.flbl{display:block;font-size:9px;font-weight:700;color:#2e3858;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;}
.inp,.sel{width:100%;padding:9px 12px;background:#07090e;border:1px solid #131928;border-radius:7px;color:#ccd4f0;font-size:14px;font-family:'Outfit',sans-serif;outline:none;transition:border-color 0.15s,box-shadow 0.15s;}
.inp:focus,.sel:focus{border-color:rgba(201,149,42,0.45);box-shadow:0 0 0 3px rgba(201,149,42,0.07);}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:13px;}
.mfoot{display:flex;gap:9px;justify-content:flex-end;margin-top:19px;padding-top:15px;border-top:1px solid #131928;}
`;

// ── Modal Shell ──────────────────────────────────────────
function Modal({open,onClose,title,children}){
  if(!open) return null;
  return(<div className="ovl" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()}><div className="mhdr"><h3 className="mttl">{title}</h3><button className="mclose" onClick={onClose}>✕</button></div><div className="mbody">{children}</div></div></div>);
}
const F = ({label,children}) => <div className="fld"><label className="flbl">{label}</label>{children}</div>;

function TxModal({open,onClose,onSave}){
  const [f,setF]=useState({market:"us",type:"buy",ticker:"",qty:"",price:"",date:new Date().toISOString().split("T")[0],bucket:"Swing (3d-2mo)",notes:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const m=MARKETS.find(x=>x.id===f.market);
  const save=()=>{if(!f.ticker||!f.qty||!f.price)return;onSave({id:genId(),market:f.market,type:f.type,ticker:f.ticker.toUpperCase(),qty:parseFloat(f.qty),price:parseFloat(f.price),date:f.date,bucket:f.bucket,notes:f.notes,currency:m.currency});setF({market:"us",type:"buy",ticker:"",qty:"",price:"",date:new Date().toISOString().split("T")[0],bucket:"Swing (3d-2mo)",notes:""});onClose();};
  return(<Modal open={open} onClose={onClose} title="Add Transaction">
    <div className="g2"><F label="Market"><select className="sel" value={f.market} onChange={e=>s("market",e.target.value)}>{MARKETS.map(m=><option key={m.id} value={m.id}>{m.flag} {m.label}</option>)}</select></F><F label="Type"><select className="sel" value={f.type} onChange={e=>s("type",e.target.value)}><option value="buy">Buy</option><option value="sell">Sell</option></select></F></div>
    <div className="g2"><F label="Ticker"><input className="inp" placeholder="AAPL, BTC..." value={f.ticker} onChange={e=>s("ticker",e.target.value)}/></F><F label="Date"><input className="inp" type="date" value={f.date} onChange={e=>s("date",e.target.value)}/></F></div>
    <div className="g2"><F label="Quantity"><input className="inp" type="number" step="any" placeholder="0" value={f.qty} onChange={e=>s("qty",e.target.value)}/></F><F label={`Price (${m?.currency})`}><input className="inp" type="number" step="any" placeholder="0.00" value={f.price} onChange={e=>s("price",e.target.value)}/></F></div>
    <F label="Bucket"><select className="sel" value={f.bucket} onChange={e=>s("bucket",e.target.value)}>{BUCKETS.map(b=><option key={b} value={b}>{b}</option>)}</select></F>
    <F label="Notes"><input className="inp" placeholder="Thesis, stop, target..." value={f.notes} onChange={e=>s("notes",e.target.value)}/></F>
    <div className="mfoot"><button className="btn b-ghost" onClick={onClose}>Cancel</button><button className="btn b-pri" onClick={save}>Save Trade</button></div>
  </Modal>);
}

function TopupModal({open,onClose,onSave}){
  const [f,setF]=useState({market:"us",type:"deposit",amount:"",date:new Date().toISOString().split("T")[0],notes:""});
  const s=(k,v)=>setF(p=>({...p,[k]:v}));
  const m=MARKETS.find(x=>x.id===f.market);
  const save=()=>{if(!f.amount)return;onSave({id:genId(),market:f.market,type:f.type,amount:parseFloat(f.amount),date:f.date,notes:f.notes,currency:m.currency});setF({market:"us",type:"deposit",amount:"",date:new Date().toISOString().split("T")[0],notes:""});onClose();};
  return(<Modal open={open} onClose={onClose} title="Wallet Deposit / Withdrawal">
    <div className="g2"><F label="Market"><select className="sel" value={f.market} onChange={e=>s("market",e.target.value)}>{MARKETS.map(m=><option key={m.id} value={m.id}>{m.flag} {m.label}</option>)}</select></F><F label="Type"><select className="sel" value={f.type} onChange={e=>s("type",e.target.value)}><option value="deposit">Deposit</option><option value="withdrawal">Withdrawal</option></select></F></div>
    <div className="g2"><F label={`Amount (${m?.currency})`}><input className="inp" type="number" step="any" placeholder="0.00" value={f.amount} onChange={e=>s("amount",e.target.value)}/></F><F label="Date"><input className="inp" type="date" value={f.date} onChange={e=>s("date",e.target.value)}/></F></div>
    <F label="Notes"><input className="inp" placeholder="Source, purpose..." value={f.notes} onChange={e=>s("notes",e.target.value)}/></F>
    <div className="mfoot"><button className="btn b-ghost" onClick={onClose}>Cancel</button><button className="btn b-pri" onClick={save}>Save</button></div>
  </Modal>);
}

function PriceModal({open,onClose,holdings,currentPrices,onSave}){
  const [prices,setPrices]=useState({});
  useEffect(()=>{if(open)setPrices({...currentPrices});},[open]);
  return(<Modal open={open} onClose={onClose} title="Update Current Prices">
    <p style={{fontSize:12,color:"#2e3858",marginBottom:16,lineHeight:1.7}}>Enter latest market prices to recalculate unrealized P&L.</p>
    {holdings.map(h=>{const m=MARKETS.find(x=>x.id===h.market),k=`${h.market}:${h.ticker}`;return(<div key={k} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}><span style={{fontSize:16}}>{m?.flag}</span><span className="tkr" style={{width:80}}>{h.ticker}</span><input className="inp" type="number" step="any" placeholder={m?.currency} value={prices[k]||""} onChange={e=>setPrices(p=>({...p,[k]:e.target.value}))} style={{width:130}}/><span style={{fontSize:11,color:"#2e3858"}}>{m?.currency}</span></div>);})}
    {holdings.length===0&&<p style={{color:"#1c2340",fontSize:13}}>No open positions yet.</p>}
    <div className="mfoot"><button className="btn b-ghost" onClick={onClose}>Cancel</button><button className="btn b-pri" onClick={()=>{onSave(prices);onClose();}}>Save</button></div>
  </Modal>);
}

function FxModal({open,onClose,fxRates,onSave}){
  const [rates,setRates]=useState({});
  useEffect(()=>{if(open)setRates({...fxRates});},[open]);
  return(<Modal open={open} onClose={onClose} title="FX Rates to USD">
    <p style={{fontSize:12,color:"#2e3858",marginBottom:16,lineHeight:1.7}}>Used to convert local currency positions into USD for portfolio-wide totals.</p>
    {Object.entries(rates).filter(([k])=>k!=="USD").map(([cur,val])=>(<div key={cur} style={{display:"flex",alignItems:"center",gap:12,marginBottom:11}}><span style={{width:50,fontFamily:"'IBM Plex Mono',monospace",fontSize:13,fontWeight:600,color:"#ccd4f0"}}>1 {cur}</span><span style={{color:"#1c2340"}}>=</span><input className="inp" type="number" step="any" value={val} onChange={e=>setRates(p=>({...p,[cur]:e.target.value}))} style={{width:130}}/><span style={{fontSize:12,color:"#2e3858"}}>USD</span></div>))}
    <div className="mfoot"><button className="btn b-ghost" onClick={onClose}>Cancel</button><button className="btn b-pri" onClick={()=>{const p={};Object.entries(rates).forEach(([k,v])=>{p[k]=parseFloat(v)||0;});onSave(p);onClose();}}>Save</button></div>
  </Modal>);
}

function ConfirmModal({open,onClose,onConfirm,msg}){
  return(<Modal open={open} onClose={onClose} title="Confirm Delete"><p style={{color:"#5a6490",fontSize:14,marginBottom:4}}>{msg}</p><div className="mfoot"><button className="btn b-ghost" onClick={onClose}>Cancel</button><button className="btn b-dan" onClick={onConfirm}>Delete</button></div></Modal>);
}

// ── App ───────────────────────────────────────────────────
export default function App(){
  const [data,setData]=useState(INIT);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("dashboard");
  const [mf,setMf]=useState("all");
  const [modal,setModal]=useState(null);
  const [del,setDel]=useState(null);

  useEffect(()=>{loadData().then(d=>{if(d&&d.transactions&&d.transactions.length>0)setData(d);else{setData(SEED);saveData(SEED);}setLoading(false);});},[]);

  const persist=useCallback(nd=>{setData(nd);saveData(nd);},[]);
  const addTx=tx=>persist({...data,transactions:[...data.transactions,tx]});
  const addT=t=>persist({...data,topups:[...data.topups,t]});
  const delTx=id=>persist({...data,transactions:data.transactions.filter(t=>t.id!==id)});
  const delT=id=>persist({...data,topups:data.topups.filter(t=>t.id!==id)});
  const savePx=p=>persist({...data,currentPrices:p});
  const saveFx=r=>persist({...data,fxRates:{...data.fxRates,...r}});

  const A=useMemo(()=>analyse(data),[data]);

  if(loading) return(<div style={{minHeight:"100vh",background:"#07090e",display:"flex",alignItems:"center",justifyContent:"center",color:"#1c2340",fontFamily:"'Outfit',sans-serif",fontSize:13,letterSpacing:"2px",textTransform:"uppercase"}}>Loading...</div>);

  const tPL=A.tUnreal+A.tReal;
  const pv=A.tVal+A.tCash;
  const pos=tPL>=0;
  const plPct=A.tInv>0?(tPL/A.tInv)*100:0;
  const fTx=mf==="all"?data.transactions:data.transactions.filter(t=>t.market===mf);
  const fTop=mf==="all"?data.topups:data.topups.filter(t=>t.market===mf);
  const TABS=[{id:"dashboard",l:"Dashboard"},{id:"holdings",l:"Holdings"},{id:"transactions",l:"Transactions"},{id:"wallets",l:"Wallets"}];

  return(<div className="pt">
    <style>{CSS}</style>
    <header className="pt-hdr">
      <div className="pt-hdr-top">
        <div className="pt-brand">
          <div className="pt-brand-icon">📊</div>
          <div><div className="pt-brand-name">Portfolio</div><div className="pt-brand-tag">EGX · ADX · US · Crypto</div></div>
        </div>
        <div className="pt-hero">
          <div className="pt-hero-lbl">Total Portfolio Value</div>
          <div className="pt-hero-val"><sup>$</sup>{fmt(pv)}</div>
          <div><span className={`pt-pnl ${pos?"g-tag":"r-tag"}`}>{pos?"▲":"▼"} {pos?"+":""}${fmt(Math.abs(tPL))} ({pos?"+":""}{fmt(plPct,1)}%)</span></div>
        </div>
        <div className="pt-btns">
          <button className="btn b-ghost" onClick={()=>setModal("fx")}>💱 FX</button>
          <button className="btn b-ghost" onClick={()=>setModal("price")}>📈 Prices</button>
          <button className="btn b-out"   onClick={()=>setModal("topup")}>+ Deposit</button>
          <button className="btn b-pri"   onClick={()=>setModal("tx")}>+ Trade</button>
        </div>
      </div>
      <nav className="pt-nav">
        {TABS.map(t=><button key={t.id} className={`pt-tab ${tab===t.id?"on":""}`} onClick={()=>setTab(t.id)}>{t.l}</button>)}
        <select className="pt-sel" value={mf} onChange={e=>setMf(e.target.value)}>
          <option value="all">All Markets</option>
          {MARKETS.map(m=><option key={m.id} value={m.id}>{m.flag} {m.name}</option>)}
        </select>
      </nav>
    </header>

    <main className="pt-body">

      {tab==="dashboard"&&<>
        <div className="srow">
          {[{l:"Total Invested",v:`$${fmt(A.tInv)}`,ac:"#5b8ef8",sub:null},{l:"Market Value",v:`$${fmt(A.tVal)}`,ac:"#c9952a",sub:null},{l:"Unrealized P&L",v:`${A.tUnreal>=0?"+":""}$${fmt(A.tUnreal)}`,ac:A.tUnreal>=0?"#00cd9b":"#f04646",sub:A.tInv>0?`${fmt((A.tUnreal/A.tInv)*100,1)}%`:null},{l:"Cash Available",v:`$${fmt(A.tCash)}`,ac:"#9b7cf4",sub:null}].map(c=>(
            <div className="sc" key={c.l}><div className="sc-acc" style={{background:c.ac}}/><div className="sc-lbl">{c.l}</div><div className="sc-val" style={{color:(c.ac==="#00cd9b"||c.ac==="#f04646")?c.ac:undefined}}>{c.v}</div>{c.sub&&<div className="sc-sub">{c.sub}</div>}</div>
          ))}
        </div>
        <div className="sec">Market Breakdown</div>
        <div className="mgrid" style={{marginBottom:28}}>
          {MARKETS.map(m=>{const s=A.ms[m.id],pl=s.real+s.unreal;return(
            <div className="mc" key={m.id} style={{borderColor:`${m.color}22`}}>
              <div className="mc-glow" style={{background:m.color}}/>
              <div className="mc-top"><span className="mc-flag">{m.flag}</span><span className="mc-name">{m.label}</span><span className="mc-ccy">{m.currency}</span></div>
              {[["Invested",fmt(s.inv)],["Value",fmt(s.val)],["P&L",`${pl>=0?"+":""}${fmt(pl)}`],["Cash",fmt(s.cash)]].map(([k,v])=>(
                <div className="mc-row" key={k}><span className="mc-k">{k}</span><span className="mc-v" style={k==="P&L"?{color:pl>=0?"#00cd9b":"#f04646"}:undefined}>{v}</span></div>
              ))}
              <div className="mc-ft">{s.holdings} position{s.holdings!==1?"s":""} · ~${fmt(s.valUSD)} USD</div>
            </div>
          );})}
        </div>
        <div className="sec">Strategy Allocation</div>
        <div className="bgrid" style={{marginBottom:28}}>
          {BUCKETS.map((b,i)=>{const v=A.bkt[b]||0,pct=pv>0?(v/pv)*100:0;return(
            <div className="bc" key={b}><div className="bc-lbl" style={{color:BCOLORS[i]}}>{b}</div><div className="bc-val">${fmt(v)}</div><div className="bar-bg"><div className="bar-fill" style={{width:`${Math.min(pct,100)}%`,background:BCOLORS[i]}}/></div><div className="bc-pct">{fmt(pct,1)}% of portfolio</div></div>
          );})}
        </div>
        <div className="cpbox">
          <div className="cp-ttl">📋 Copy for Claude Analysis</div>
          <div className="cp-desc">Paste this into your Investment Analysis Hub project to get AI-powered briefs, trade guidance, and risk analysis.</div>
          <button className="btn b-out" onClick={()=>{
            let s=`# Portfolio Snapshot — ${new Date().toLocaleDateString("en-GB")}\n\n`;
            s+=`**Value:** $${fmt(pv)} | **P&L:** ${tPL>=0?"+":""}$${fmt(tPL)} (${fmt(plPct,1)}%) | **Cash:** $${fmt(A.tCash)}\n\n`;
            s+=`## Positions\n\n`;
            MARKETS.forEach(m=>{const hs=A.holdings.filter(h=>h.market===m.id);if(!hs.length)return;s+=`### ${m.flag} ${m.label}\n`;hs.forEach(h=>{s+=`- **${h.ticker}**: ${fmt(h.qty,h.qty<1?6:4)}u @ ${fmt(h.avgCost)} avg`;if(h.currentPrice!==null)s+=` | Now: ${fmt(h.currentPrice)} | P&L: ${h.uPL>=0?"+":""}${fmt(h.uPL)} (${fmt(h.uPLpct,1)}%)`;s+=` [${h.bucket}]\n`;});s+="\n";});
            s+=`## FX\n`;Object.entries(data.fxRates).filter(([k])=>k!=="USD").forEach(([k,v])=>{s+=`- 1 ${k} = ${v} USD\n`;});
            navigator.clipboard.writeText(s);alert("Copied!");
          }}>Copy Portfolio Summary</button>
        </div>
      </>}

      {tab==="holdings"&&(()=>{
        const hs=A.holdings.filter(h=>mf==="all"||h.market===mf).sort((a,b)=>(b.currentValue??b.costBasis)-(a.currentValue??a.costBasis));
        return hs.length===0?<div className="empty"><div className="empty-ico">📭</div><div className="empty-txt">No open positions. Add a trade to get started.</div></div>:
        <div className="tw"><table><thead><tr>{["Mkt","Ticker","Units","Avg Cost","Current","Value","P&L","P&L %","Bucket"].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{hs.map(h=>{const m=MARKETS.find(x=>x.id===h.market);return(<tr key={`${h.market}:${h.ticker}`}><td><span style={{fontSize:16}}>{m?.flag}</span></td><td><span className="tkr">{h.ticker}</span></td><td><span className="num">{fmt(h.qty,h.qty<1?6:4)}</span></td><td><span className="num">{fmt(h.avgCost)}</span></td><td><span className={`num ${h.currentPrice===null?"dim":""}`}>{h.currentPrice!==null?fmt(h.currentPrice):"—"}</span></td><td><span className="num">{fmt(h.currentValue??h.costBasis)}</span></td><td><span className={`num ${h.uPL!==null?(h.uPL>=0?"g":"r"):"dim"}`}>{h.uPL!==null?`${h.uPL>=0?"+":""}${fmt(h.uPL)}`:"—"}</span></td><td><span className={`num ${h.uPLpct!==null?(h.uPLpct>=0?"g":"r"):"dim"}`}>{h.uPLpct!==null?`${h.uPLpct>=0?"+":""}${fmt(h.uPLpct,1)}%`:"—"}</span></td><td style={{fontSize:11,color:"#2e3858"}}>{h.bucket}</td></tr>);})}</tbody></table></div>;
      })()}

      {tab==="transactions"&&(fTx.length===0?<div className="empty"><div className="empty-ico">📭</div><div className="empty-txt">No transactions yet. Click + Trade.</div></div>:
        <div className="tw"><table><thead><tr>{["Date","Mkt","Type","Ticker","Qty","Price","Total","Bucket","Notes",""].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{[...fTx].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(tx=>{const m=MARKETS.find(x=>x.id===tx.market);return(<tr key={tx.id}><td style={{fontSize:12,color:"#2e3858",whiteSpace:"nowrap"}}>{fmtD(tx.date)}</td><td><span style={{fontSize:16}}>{m?.flag}</span></td><td><span className={`bdg bdg-${tx.type}`}>{tx.type.toUpperCase()}</span></td><td><span className="tkr">{tx.ticker}</span></td><td><span className="num">{fmt(tx.qty,tx.qty<1?6:4)}</span></td><td><span className="num">{fmt(tx.price)}</span></td><td><span className="num" style={{fontWeight:600}}>{fmt(tx.qty*tx.price)} {tx.currency}</span></td><td style={{fontSize:11,color:"#2e3858",whiteSpace:"nowrap"}}>{tx.bucket}</td><td style={{fontSize:11,color:"#1c2340",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tx.notes}</td><td><button className="delbtn" onClick={()=>setDel({type:"tx",id:tx.id})}>🗑</button></td></tr>);})}</tbody></table></div>
      )}

      {tab==="wallets"&&<>
        <div className="wgrid" style={{marginBottom:28}}>
          {MARKETS.filter(m=>mf==="all"||m.id===mf).map(m=>{const s=A.ms[m.id];return(
            <div className="wc" key={m.id} style={{borderColor:`${m.color}1a`}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}><span style={{fontSize:22}}>{m.flag}</span><span style={{fontFamily:"'Cormorant Garamond',serif",fontSize:19,fontWeight:700,color:"#ccd4f0"}}>{m.label}</span></div>
              {[["Deposits",fmt(s.deps)],["Withdrawals",fmt(s.withs)],["Net Funded",fmt(s.wallet)],["In Positions",fmt(s.inv)],["Cash Available",fmt(s.cash)]].map(([k,v])=>(
                <div className="wr" key={k}><span className="wk">{k}</span><span className="wv">{v} {m.currency}</span></div>
              ))}
            </div>
          );})}
        </div>
        <div className="sec">Deposit &amp; Withdrawal History</div>
        {fTop.length===0?<div className="empty"><div className="empty-ico">📭</div><div className="empty-txt">No wallet transactions yet.</div></div>:
          <div className="tw"><table><thead><tr>{["Date","Market","Type","Amount","Notes",""].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{[...fTop].sort((a,b)=>new Date(b.date)-new Date(a.date)).map(t=>{const m=MARKETS.find(x=>x.id===t.market);return(<tr key={t.id}><td style={{fontSize:12,color:"#2e3858"}}>{fmtD(t.date)}</td><td><span style={{fontSize:16}}>{m?.flag}</span> <span style={{fontSize:12,color:"#2e3858"}}>{m?.name}</span></td><td><span className={`bdg bdg-${t.type==="deposit"?"dep":"with"}`}>{t.type.toUpperCase()}</span></td><td><span className="num" style={{fontWeight:600}}>{fmt(t.amount)} {t.currency}</span></td><td style={{fontSize:12,color:"#1c2340"}}>{t.notes}</td><td><button className="delbtn" onClick={()=>setDel({type:"topup",id:t.id})}>🗑</button></td></tr>);})}</tbody></table></div>
        }
      </>}
    </main>

    <TxModal    open={modal==="tx"}    onClose={()=>setModal(null)} onSave={addTx}/>
    <TopupModal open={modal==="topup"} onClose={()=>setModal(null)} onSave={addT}/>
    <PriceModal open={modal==="price"} onClose={()=>setModal(null)} holdings={A.holdings} currentPrices={data.currentPrices} onSave={savePx}/>
    <FxModal    open={modal==="fx"}    onClose={()=>setModal(null)} fxRates={data.fxRates} onSave={saveFx}/>
    <ConfirmModal open={!!del} onClose={()=>setDel(null)} msg="Delete this entry permanently?" onConfirm={()=>{if(del.type==="tx")delTx(del.id);else delT(del.id);setDel(null);}}/>
  </div>);
}
