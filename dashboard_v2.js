/* ═══════════════════════════════════════════════════════════════════
   dashboard_v2.js — zenOt Operasional
   REDESIGN: Owner's Command Center — Insight tajam untuk pengambil keputusan
   by BURHANMOLOGY × Claude
════════════════════════════════════════════════════════════════════ */

// ── Helpers ──
const fmtShort = v => {
  v = Math.round(v||0);
  return 'Rp '+v.toLocaleString('id-ID');
};
const fmtNum = n => Number(n||0).toLocaleString('id-ID');
// ── Date helpers — pakai local timezone (WIB UTC+7), bukan UTC ──
// _localDateStr didefinisikan di app_core.js (load lebih dulu)
const getTodayStr    = () => _localDateStr(new Date());
const getKemarinStr  = () => { const d=new Date(); d.setDate(d.getDate()-1); return _localDateStr(d); };
const getBulanStr    = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); };
const getBulanLaluStr= () => { const d=new Date(); d.setMonth(d.getMonth()-1); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'); };
const getDaysInMonth = () => { const d=new Date(); return new Date(d.getFullYear(),d.getMonth()+1,0).getDate(); };
const getDayOfMonth  = () => new Date().getDate();

function deltaBadge(now, prev) {
  if (!prev||prev===0) return '<span class="ow-delta ow-flat">—</span>';
  const pct = Math.round((now-prev)/prev*100);
  if (pct>0)  return `<span class="ow-delta ow-up">▲ ${Math.abs(pct)}%</span>`;
  if (pct<0)  return `<span class="ow-delta ow-dn">▼ ${Math.abs(pct)}%</span>`;
  return '<span class="ow-delta ow-flat">0%</span>';
}

function progressBar(pct, color) {
  const w = Math.min(100,Math.max(0,pct));
  const c = pct<40?'#C0392B':pct<70?'#D97706':(color||'var(--gold)');
  return `<div class="ow-pbar-wrap"><div class="ow-pbar-fill" style="width:${w}%;background:${c}"></div></div>`;
}

// ── Inject CSS ──
function _owInjectCSS() {
  if (document.getElementById('ow-dash-style')) return;
  const st = document.createElement('style');
  st.id = 'ow-dash-style';
  st.textContent = `
/* ═══ DASHBOARD V2 — IMPROVED LAYOUT & TYPOGRAPHY ═══ */
.ow-wrap{display:flex;flex-direction:column;gap:18px;padding-bottom:36px;}

/* KPI Strip — 4 kolom sama tinggi */
.ow-kpi-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;}
@media(max-width:1100px){.ow-kpi-strip{grid-template-columns:repeat(2,1fr);}}
@media(max-width:600px){.ow-kpi-strip{grid-template-columns:1fr;}}
.ow-kpi{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px 22px 18px;position:relative;overflow:hidden;}
.ow-kpi-accent{position:absolute;top:0;left:0;width:5px;height:100%;border-radius:16px 0 0 16px;}
.ow-kpi-label{font-size:11px;text-transform:uppercase;letter-spacing:1.3px;color:var(--dusty);font-weight:700;margin-bottom:8px;}
.ow-kpi-val{font-size:26px;font-weight:700;color:var(--charcoal);line-height:1.1;}
.ow-kpi-sub{font-size:12px;color:var(--dusty);margin-top:9px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;}

/* Delta badge */
.ow-delta{font-size:12px;font-weight:700;padding:3px 8px;border-radius:20px;}
.ow-up{background:#EFF7F3;color:#2D6A4F;}
.ow-dn{background:#FFF0EE;color:#9B2335;}
.ow-flat{background:var(--cream);color:var(--dusty);}

/* Section headers */
.ow-sec-hd{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
.ow-sec-title{font-size:15px;text-transform:uppercase;letter-spacing:1px;font-weight:700;color:var(--charcoal);}
.ow-sec-note{font-size:12px;color:var(--dusty);opacity:.7;}

/* 2-col & 3-col grids — align-items:stretch agar sama tinggi */
.ow-row2{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:stretch;}
.ow-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;align-items:stretch;}
@media(max-width:900px){.ow-row2,.ow-row3{grid-template-columns:1fr;}}

/* Cards — height:100% agar sama tinggi dalam grid */
.ow-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;height:100%;box-sizing:border-box;}
.ow-card-title{font-size:14px;font-weight:700;color:var(--charcoal);margin-bottom:16px;}
.ow-card-badge{font-size:11px;font-weight:700;padding:4px 10px;border-radius:20px;}
.ow-badge-red{background:#FFF0EE;color:#9B2335;}
.ow-badge-amber{background:#FFFBF0;color:#92400E;}
.ow-badge-green{background:#EFF7F3;color:#2D6A4F;}
.ow-badge-gray{background:var(--cream);color:var(--dusty);}
.ow-badge-blue{background:#EFF5FD;color:#1A5EB8;}

/* Progress bar */
.ow-pbar-wrap{width:100%;height:6px;background:var(--border);border-radius:99px;overflow:hidden;margin:8px 0 3px;}
.ow-pbar-fill{height:100%;border-radius:99px;transition:width .5s;}

/* Stok rows */
.ow-stok-row{display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);font-size:14px;}
.ow-stok-row:last-child{border-bottom:none;}
.ow-stok-sku{font-weight:600;color:var(--charcoal);font-family:'DM Mono',monospace;font-size:13.5px;flex:1;line-height:1.3;}
.ow-stok-right{display:flex;align-items:center;gap:10px;flex-shrink:0;}
.ow-stok-num{font-weight:700;font-family:'DM Mono',monospace;font-size:14px;min-width:64px;text-align:center;padding:3px 8px;border-radius:8px;}
.stok-red{color:#C0392B;background:#FFF0EE;} .stok-amber{color:#D97706;background:#FFFBF0;} .stok-green{color:#2D6A4F;}
.ow-stok-meta{font-size:12.5px;color:var(--dusty);white-space:nowrap;}
.ow-empty{padding:24px;text-align:center;font-size:14px;color:var(--dusty);background:var(--cream);border-radius:12px;}
@media(max-width:600px){
  .ow-stok-sku{font-size:12.5px;}
  .ow-stok-num{font-size:13px;min-width:54px;}
  .ow-stok-meta{font-size:11.5px;}
  .ow-sec-title{font-size:13.5px;}
}

/* Channel rows */
.ow-ch-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);}
.ow-ch-row:last-child{border-bottom:none;}
.ow-ch-name{font-size:13px;font-weight:700;color:var(--charcoal);min-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ow-ch-bar{flex:1;height:8px;background:var(--cream);border-radius:99px;overflow:hidden;}
.ow-ch-fill{height:100%;background:var(--brown);border-radius:99px;}
.ow-ch-val{font-size:13px;font-weight:700;color:var(--charcoal);min-width:72px;text-align:right;}

/* SKU rows */
.ow-sku-row{display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);}
.ow-sku-row:last-child{border-bottom:none;}
.ow-sku-rank{font-size:12px;font-weight:700;color:var(--dusty);width:20px;text-align:center;}
.ow-sku-name{flex:1;font-size:13px;font-weight:600;font-family:'DM Mono',monospace;color:var(--charcoal);}
.ow-sku-bar{width:70px;height:5px;background:var(--border);border-radius:99px;overflow:hidden;}
.ow-sku-bfill{height:100%;background:var(--gold);border-radius:99px;}
.ow-sku-qty{font-size:14px;font-weight:700;color:var(--brown);min-width:42px;text-align:right;}

/* Supplier rows */
.ow-sup-row{display:grid;grid-template-columns:110px 1fr 75px 45px 45px;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid var(--border);font-size:13px;}
@media(max-width:600px){.ow-sup-row{grid-template-columns:1fr auto;}.ow-sup-row>*:nth-child(3),.ow-sup-row>*:nth-child(5){display:none;}}
.ow-sup-row:last-child{border-bottom:none;}
.ow-sup-name{font-weight:700;color:var(--charcoal);}
.ow-sup-bar{height:6px;background:var(--cream);border-radius:99px;overflow:hidden;}
.ow-sup-fill{height:100%;background:var(--sage);border-radius:99px;}

/* Alerts */
.ow-alerts{display:flex;flex-direction:column;gap:10px;}
.ow-alert{display:flex;align-items:flex-start;gap:10px;padding:12px 16px;border-radius:12px;font-size:13px;}
.ow-alert-icon{font-size:16px;flex-shrink:0;margin-top:1px;}
.ow-alert-title{font-weight:700;color:var(--charcoal);margin-bottom:3px;font-size:13px;}
.ow-alert-sub{color:var(--dusty);font-size:12px;}
.ow-alert.red{background:#FFF0EE;border:1px solid rgba(192,57,43,.2);}
.ow-alert.amber{background:#FFFBF0;border:1px solid rgba(214,158,46,.25);}
.ow-alert.green{background:#EFF7F3;border:1px solid rgba(45,106,79,.2);}
.ow-alert.blue{background:#EFF5FD;border:1px solid rgba(26,94,184,.15);}
.ow-alert.gray{background:var(--cream);border:1px solid var(--border);}

/* Mini grid */
.ow-mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;}
.ow-mini{background:var(--cream);border-radius:12px;padding:14px;text-align:center;}
.ow-mini-label{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:var(--dusty);font-weight:700;margin-bottom:5px;}
.ow-mini-val{font-size:20px;font-weight:700;color:var(--charcoal);}

/* Trend bars */
.ow-trend-bars{display:flex;align-items:flex-end;gap:6px;height:90px;margin-bottom:8px;}
.ow-tbar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;}
.ow-tbar{width:100%;border-radius:5px 5px 0 0;min-height:3px;background:var(--gold);opacity:.6;}
.ow-tbar.today{opacity:1;background:var(--brown);}
.ow-tbar.zero{opacity:.15;background:var(--dusty);}
.ow-tbar-label{font-size:10px;color:var(--dusty);font-weight:600;}

/* ── Period Selector (Shopee-style) ── */
.ow-period-bar{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:0;}
.ow-period-btn{display:flex;align-items:center;gap:6px;background:var(--card);border:1.5px solid var(--border);border-radius:10px;padding:7px 14px;font-size:12px;font-weight:700;color:var(--charcoal);cursor:pointer;transition:all .18s;white-space:nowrap;position:relative;}
.ow-period-btn:hover{border-color:var(--brown);color:var(--brown);}
.ow-period-btn.active{background:var(--brown);border-color:var(--brown);color:#fff;}
.ow-period-btn .ow-pdrop-icon{font-size:10px;opacity:.7;}
.ow-period-dropdown{position:absolute;top:calc(100% + 6px);left:0;min-width:220px;background:var(--card);border:1.5px solid var(--border);border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,.13);z-index:999;overflow:hidden;display:none;}
.ow-period-dropdown.open{display:block;}
.ow-pdrop-section{padding:8px 0;}
.ow-pdrop-item{display:flex;align-items:center;justify-content:space-between;padding:9px 18px;font-size:13px;font-weight:600;color:var(--charcoal);cursor:pointer;transition:background .12s;}
.ow-pdrop-item:hover{background:var(--cream);}
.ow-pdrop-item.selected{color:var(--brown);}
.ow-pdrop-item .ow-pdrop-arrow{font-size:10px;color:var(--dusty);}
.ow-pdrop-divider{height:1px;background:var(--border);margin:4px 0;}
.ow-pdrop-sub{display:none;background:var(--cream);}
.ow-pdrop-sub.open{display:block;}
.ow-pdrop-sub-item{padding:8px 28px;font-size:12.5px;color:var(--charcoal);cursor:pointer;font-weight:600;}
.ow-pdrop-sub-item:hover{color:var(--brown);}
.ow-pdrop-sub-item.selected{color:var(--brown);}
.ow-datepicker-wrap{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.ow-datepicker-wrap input[type=date]{border:1.5px solid var(--border);border-radius:8px;padding:6px 10px;font-size:12px;font-family:inherit;color:var(--charcoal);background:var(--card);outline:none;}
.ow-datepicker-wrap input[type=date]:focus{border-color:var(--brown);}
.ow-datepicker-wrap .ow-date-sep{font-size:12px;color:var(--dusty);}
.ow-datepicker-wrap .ow-date-apply{background:var(--brown);color:#fff;border:none;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;}
.ow-metric-tabs{display:flex;gap:6px;}
.ow-metric-tab{padding:5px 14px;border-radius:8px;font-size:12px;font-weight:700;border:1.5px solid var(--border);cursor:pointer;background:var(--card);color:var(--dusty);transition:all .15s;}
.ow-metric-tab.active{background:var(--charcoal);color:#fff;border-color:var(--charcoal);}
.ow-chart-legend{display:flex;align-items:center;gap:16px;font-size:11.5px;color:var(--dusty);margin-top:8px;}
.ow-legend-dot{width:10px;height:10px;border-radius:50%;display:inline-block;margin-right:4px;}
.ow-chart-stats{display:flex;gap:18px;flex-wrap:wrap;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);}
.ow-chart-stat{display:flex;flex-direction:column;gap:2px;}
.ow-chart-stat-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.8px;color:var(--dusty);font-weight:700;}
.ow-chart-stat-val{font-size:15px;font-weight:800;color:var(--charcoal);}
.ow-chart-stat-compare{font-size:11px;color:var(--dusty);}

/* Restock items */
.ow-restock-item{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);}
.ow-restock-item:last-child{border-bottom:none;}
.ow-restock-sku{flex:1;font-size:12.5px;font-family:'DM Mono',monospace;font-weight:600;color:var(--charcoal);}
.ow-restock-heat{font-size:12px;color:var(--dusty);}
.ow-restock-stok{font-size:14px;font-weight:700;min-width:50px;text-align:right;}
.stok-habis{color:#C0392B;} .stok-kritis{color:#D97706;}

/* ═══ RESPONSIVE DASHBOARD — Mobile (Android & iPhone) ═══ */
@media(max-width:900px){
  /* KPI cards */
  .ow-kpi{padding:16px 16px 14px;}
  .ow-kpi-val{font-size:22px;}
  .ow-kpi-label{font-size:10px;}
  .ow-kpi-sub{font-size:11px;}

  /* Cards */
  .ow-card{padding:16px 14px;}
  .ow-card-title{font-size:13px;}

  /* Mini grid */
  .ow-mini-val{font-size:17px;}
  .ow-mini{padding:12px 10px;}

  /* Chart stats */
  .ow-chart-stat-val{font-size:13px;}
  .ow-chart-stat-label{font-size:10px;}
  .ow-chart-stats{gap:12px;}

  /* Section title */
  .ow-sec-title{font-size:13px;}

  /* SKU rows */
  .ow-sku-name{font-size:12px;}
  .ow-sku-qty{font-size:13px;}

  /* Channel rows */
  .ow-ch-name{font-size:12px;min-width:90px;}
  .ow-ch-val{font-size:12px;min-width:60px;}

  /* Supplier rows — stack jadi list di mobile */
  .ow-sup-row{
    grid-template-columns:1fr auto;
    gap:4px;
    flex-wrap:wrap;
  }

  /* Alert */
  .ow-alert{padding:10px 12px;font-size:12px;}
  .ow-alert-title{font-size:12px;}
  .ow-alert-sub{font-size:11px;}

  /* Period bar wrap */
  .ow-period-bar{gap:6px;}
  .ow-period-btn{padding:6px 10px;font-size:11px;}

  /* Row gaps */
  .ow-wrap{gap:14px;}
}

@media(max-width:480px){
  .ow-kpi-val{font-size:20px;}
  .ow-kpi{padding:14px 12px 12px;}
  .ow-mini-val{font-size:16px;}
  .ow-mini-label{font-size:10px;}
  .ow-card{padding:14px 12px;}
  .ow-chart-stat-val{font-size:12px;}
  .ow-chart-legend{font-size:11px;}

  /* Dead stock row fix — nilai HPP + qty tidak tumpuk */
  .ow-stok-right{gap:6px;}
  .ow-stok-meta{font-size:11px;}
}
  `;
  document.head.appendChild(st);
}

// ── Main render ──
async function renderDashboard() {
  _owInjectCSS();

  const todayStr     = getTodayStr();
  const kemarinStr   = getKemarinStr();
  const bulanStr     = getBulanStr();
  const bulanLaluStr = getBulanLaluStr();

  const jurnal = (typeof getFilteredJurnal==='function') ? getFilteredJurnal() : DB.jurnal;

  const jHari      = jurnal.filter(j => j.tgl===todayStr);
  const jKemarin   = jurnal.filter(j => j.tgl===kemarinStr);
  const jBulan     = jurnal.filter(j => (j.tgl||'').startsWith(bulanStr));
  const jBulanLalu = jurnal.filter(j => (j.tgl||'').startsWith(bulanLaluStr));

  // Helper: lookup HPP dari DB.produk berdasarkan var
  const getHppProduk = varName => {
    if (!varName) return 0;
    const p = (DB.produk||[]).find(x => (x.var||'').toUpperCase() === (varName||'').toUpperCase());
    return (p && p.hpp) ? p.hpp : 0;
  };

  // Omset = harga jual × qty (bukan HPP)
  const omsetHari     = jHari.reduce((s,j)=>s+(j.harga||0)*(j.qty||0),0);
  const omsetKemarin  = jKemarin.reduce((s,j)=>s+(j.harga||0)*(j.qty||0),0);
  const omsetBulan    = jBulan.reduce((s,j)=>s+(j.harga||0)*(j.qty||0),0);
  const omsetBulanLalu= jBulanLalu.reduce((s,j)=>s+(j.harga||0)*(j.qty||0),0);
  // Laba = (harga jual - HPP) × qty
  const labaBulan     = jBulan.reduce((s,j)=>s+((j.harga||0)-(getHppProduk(j.var)||0))*(j.qty||0),0);
  const labaBulanLalu = jBulanLalu.reduce((s,j)=>s+((j.harga||0)-(getHppProduk(j.var)||0))*(j.qty||0),0);
  const qtyBulan      = jBulan.reduce((s,j)=>s+(j.qty||0),0);
  const trxBulan      = jBulan.length;
  const marginPct     = omsetBulan>0 ? Math.round(labaBulan/omsetBulan*100) : 0;
  const marginLaluPct = omsetBulanLalu>0 ? Math.round(labaBulanLalu/omsetBulanLalu*100) : 0;
  const avgPerTrx     = trxBulan>0 ? Math.round(omsetBulan/trxBulan) : 0;
  const proyeksi      = getDayOfMonth()>0 ? Math.round(omsetBulan/getDayOfMonth()*getDaysInMonth()) : 0;

  const nilaiStok  = DB.stok.reduce((s,r)=>s+Math.max(0,getAkhir(r))*(r.hpp||0),0);
  const totalStok  = DB.stok.reduce((s,r)=>s+Math.max(0,getAkhir(r)),0);
  const stokHabis  = DB.stok.filter(r=>getAkhir(r)<=0);
  const stokKritis = DB.stok.filter(r=>getAkhir(r)>0&&getAkhir(r)<=(r.safety||4));

  const soldMap={}, soldBulanMap={}, soldBulanLaluMap={};
  jurnal.forEach(j=>{soldMap[j.var]=(soldMap[j.var]||0)+(j.qty||0);});
  jBulan.forEach(j=>{soldBulanMap[j.var]=(soldBulanMap[j.var]||0)+(j.qty||0);});
  jBulanLalu.forEach(j=>{soldBulanLaluMap[j.var]=(soldBulanLaluMap[j.var]||0)+(j.qty||0);});

  const topSKU = Object.entries(soldBulanMap).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const deadStock = DB.stok.filter(r=>getAkhir(r)>0&&!soldMap[r.var]);
  const deadStokNilai = deadStock.reduce((s,r)=>s+getAkhir(r)*(r.hpp||0),0);

  const wajibRestock = DB.stok
    .filter(r=>getAkhir(r)<=(r.safety||4)&&soldMap[r.var])
    .map(r=>({var:r.var,akhir:getAkhir(r),safety:r.safety||4,terjual:soldMap[r.var]||0,bulanIni:soldBulanMap[r.var]||0}))
    .sort((a,b)=>b.terjual-a.terjual).slice(0,8);

  const chMap={}, chMapLalu={};
  jBulan.forEach(j=>{
    if(!j.ch) return;
    if(!chMap[j.ch]) chMap[j.ch]={omset:0,qty:0,trx:0};
    chMap[j.ch].omset+=(j.harga||0)*(j.qty||0);
    chMap[j.ch].qty+=(j.qty||0); chMap[j.ch].trx+=1;
  });
  jBulanLalu.forEach(j=>{
    if(!j.ch) return;
    if(!chMapLalu[j.ch]) chMapLalu[j.ch]={omset:0};
    chMapLalu[j.ch].omset+=(j.harga||0)*(j.qty||0);
  });
  const channels = Object.entries(chMap).sort((a,b)=>b[1].omset-a[1].omset);
  const totalChOmset = channels.reduce((s,[,v])=>s+v.omset,0);

  const yr = new Date().getFullYear();
  const mo = String(new Date().getMonth()+1).padStart(2,'0');
  const bulanKey = `${yr}-${mo}`;

  // ── Baca targetOmset: prioritas Supabase → localStorage fallback ──
  let targetOmset = 0;
  try {
    // 1. Sumber utama: Biaya Operasional Global dari Supabase
    if (typeof PLAN !== 'undefined' && PLAN._sbLoad) {
      const sbBiaya = await PLAN._sbLoad('__biaya_global__', bulanKey).catch(()=>null);
      if (sbBiaya && sbBiaya.biayaOpsGlobal > 0 && sbBiaya.rasioOpsGlobal > 0) {
        targetOmset = Math.round(sbBiaya.biayaOpsGlobal / (sbBiaya.rasioOpsGlobal / 100));
        // Sync ke localStorage agar akses berikutnya lebih cepat
        try { localStorage.setItem('zenot_biaya_ops_global', JSON.stringify(sbBiaya)); } catch(e) {}
      }
    }
    // 2. Fallback localStorage: Biaya Operasional Global
    if (targetOmset === 0) {
      const bgRaw = localStorage.getItem('zenot_biaya_ops_global');
      if (bgRaw) {
        const bg = JSON.parse(bgRaw);
        if (bg.biayaOpsGlobal > 0 && bg.rasioOpsGlobal > 0) {
          targetOmset = Math.round(bg.biayaOpsGlobal / (bg.rasioOpsGlobal / 100));
        }
      }
    }
    // 3. Fallback: plan 'global' dari Supabase
    if (targetOmset === 0 && typeof PLAN !== 'undefined' && PLAN._sbLoad) {
      const sbPlan = await PLAN._sbLoad('global', bulanKey).catch(()=>null);
      if (sbPlan && sbPlan.targetOmset > 0) targetOmset = sbPlan.targetOmset;
    }
    // 4. Fallback: plan 'global' localStorage
    if (targetOmset === 0 && typeof PLAN !== 'undefined' && PLAN.loadSync) {
      const plan = PLAN.loadSync('global', bulanKey) || {};
      targetOmset = plan.targetOmset || 0;
    }
    // 5. Fallback: key lama (zenot_planning_YYYY_MM)
    if (targetOmset === 0) {
      const oldPlan = JSON.parse(localStorage.getItem(`zenot_planning_${yr}_${mo}`) || '{}');
      targetOmset = oldPlan.targetOmset || 0;
    }
  } catch(e) {}
  const pctOmset    = targetOmset>0 ? Math.min(100,Math.round(omsetBulan/targetOmset*100)) : 0;
  const daysLeft    = getDaysInMonth()-getDayOfMonth();
  const sisaTarget  = Math.max(0,targetOmset-omsetBulan);
  const perHariHarus= daysLeft>0&&sisaTarget>0 ? Math.round(sisaTarget/daysLeft) : 0;

  // ══════════════════════════════════════════════
  // FITUR BARU 1: PACE INDICATOR
  // ══════════════════════════════════════════════
  // Rata-rata omset per hari yang sudah berjalan
  const hariJalan      = getDayOfMonth();
  const avgPerHari     = hariJalan > 0 ? omsetBulan / hariJalan : 0;
  // Proyeksi akhir bulan berdasarkan pace saat ini
  const paceProyeksi   = Math.round(avgPerHari * getDaysInMonth());
  // Hari target selesai (kalau pace dipertahankan)
  let paceTargetDate   = null;
  let paceStatus       = 'aman'; // 'aman' | 'lambat' | 'gagal'
  let pacePesan        = '';
  if (targetOmset > 0) {
    if (omsetBulan >= targetOmset) {
      paceStatus = 'done';
      pacePesan  = '🎉 Target bulan ini sudah tercapai!';
    } else if (avgPerHari > 0) {
      const hariDibutuhkan = Math.ceil((targetOmset - omsetBulan) / avgPerHari);
      const tglSelesai = new Date();
      tglSelesai.setDate(tglSelesai.getDate() + hariDibutuhkan);
      const tglAkhirBulan = new Date(tglSelesai.getFullYear(), tglSelesai.getMonth()+1, 0);
      if (tglSelesai <= tglAkhirBulan) {
        paceStatus = 'aman';
        paceTargetDate = tglSelesai.getDate();
        pacePesan = `✅ Dengan pace ini, target selesai sekitar tgl <b>${tglSelesai.getDate()}</b> bulan ini.`;
      } else {
        paceStatus = 'lambat';
        const selisih = paceProyeksi < targetOmset ? fmtShort(targetOmset - paceProyeksi) : '';
        pacePesan = `⚠️ Pace saat ini tidak cukup. Proyeksi akhir bulan kurang <b>${selisih}</b> dari target.`;
      }
    } else {
      paceStatus = 'gagal';
      pacePesan = '🚨 Belum ada transaksi bulan ini. Target terancam gagal.';
    }
  } else {
    pacePesan = '📌 Target belum diset. Silakan set target di menu Planning.';
    paceStatus = 'nodata';
  }
  const paceWarnColor = paceStatus==='done'?'#2D6A4F':paceStatus==='aman'?'#2D6A4F':paceStatus==='lambat'?'#D97706':'#C0392B';
  const paceBg        = paceStatus==='done'||paceStatus==='aman'?'#EFF7F3':paceStatus==='lambat'?'#FFFBF0':'#FFF0EE';
  const paceBorderColor = paceStatus==='done'||paceStatus==='aman'?'#2D6A4F':paceStatus==='lambat'?'#D97706':'#C0392B';

  // ══════════════════════════════════════════════
  // FITUR BARU 2: ESTIMASI LABA BERSIH & GROSS MARGIN
  // ══════════════════════════════════════════════
  // labaBulan sudah dihitung di atas: sum(harga - hpp) * qty
  // Gross margin % dari omset (omset = harga jual)
  const omsetHargaJual   = jBulan.reduce((s,j)=>s+(j.harga||0)*(j.qty||0), 0);
  const grossMarginAmt   = jBulan.reduce((s,j)=>s+((j.harga||0)-(getHppProduk(j.var)||0))*(j.qty||0), 0);
  const grossMarginPct   = omsetHargaJual > 0 ? Math.round(grossMarginAmt / omsetHargaJual * 100) : 0;
  // Ambil biaya ops dari localStorage
  let biayaOpsPerBulan = 0;
  try {
    const bgRaw2 = localStorage.getItem('zenot_biaya_ops_global');
    if (bgRaw2) { const bg2 = JSON.parse(bgRaw2); biayaOpsPerBulan = bg2.biayaOpsGlobal || 0; }
  } catch(e) {}
  const labaEstimasi      = grossMarginAmt - biayaOpsPerBulan;
  const labaEstimasiPct   = omsetHargaJual > 0 ? Math.round(labaEstimasi / omsetHargaJual * 100) : 0;
  const labaColor         = labaEstimasi >= 0 ? '#2D6A4F' : '#C0392B';
  const labaBg            = labaEstimasi >= 0 ? '#EFF7F3' : '#FFF0EE';

  // ══════════════════════════════════════════════
  // FITUR BARU 3: SKU DECLINING
  // ══════════════════════════════════════════════
  // SKU yang terjual bulan ini TAPI turun vs bulan lalu (min 2 terjual bulan lalu agar meaningful)
  const skuDeclining = Object.entries(soldBulanMap)
    .filter(([sku, qty]) => {
      const prev = soldBulanLaluMap[sku] || 0;
      return prev >= 2 && qty < prev; // terjual bulan ini tapi lebih sedikit dari bulan lalu
    })
    .map(([sku, qty]) => {
      const prev  = soldBulanLaluMap[sku] || 0;
      const drop  = Math.round((prev - qty) / prev * 100);
      return { sku, qty, prev, drop };
    })
    .sort((a, b) => b.drop - a.drop) // urutkan dari penurunan terbesar
    .slice(0, 8);

  const supMap={};
  DB.stok.forEach(r=>{
    const p=(DB.produk||[]).find(x=>(x.var||'').toUpperCase()===(r.var||'').toUpperCase());
    const sup=(p&&p.suplaier)||'Lainnya';
    if(!supMap[sup]) supMap[sup]={stok:0,sku:0,nilai:0,habis:0};
    const akhir=getAkhir(r);
    if(akhir<=0) supMap[sup].habis++;
    supMap[sup].stok+=Math.max(0,akhir);
    supMap[sup].sku+=1;
    supMap[sup].nilai+=Math.max(0,akhir)*(r.hpp||0);
  });
  const suppliers = Object.entries(supMap).sort((a,b)=>b[1].nilai-a[1].nilai);
  const supMax = suppliers.length>0 ? suppliers[0][1].nilai : 1;

  const trend7=[];
  for(let i=6;i>=0;i--){
    const d=new Date(); d.setDate(d.getDate()-i);
    const ds=_localDateStr(d);
    const label=d.toLocaleDateString('id-ID',{weekday:'short'});
    const val=jurnal.filter(j=>j.tgl===ds).reduce((s,j)=>s+(j.harga||0)*(j.qty||0),0);
    trend7.push({label,val,ds});
  }
  const trend7Max=Math.max(...trend7.map(t=>t.val),1);

  const noHPP=(DB.produk||[]).filter(p=>!p.hpp||p.hpp<=0);

  // ═════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════
  const page = document.getElementById('page-dashboard');
  page.innerHTML = '<div class="ow-wrap" id="ow-main"></div>';
  const W = document.getElementById('ow-main');
  const add = html => W.insertAdjacentHTML('beforeend', html);

  // Hide old stat-cards
  const sc=document.getElementById('stat-cards');
  if(sc) sc.style.display='none';

  // ─── 1. INSIGHT ALERTS — DIHAPUS (clean dashboard) ───

  // ─── 2. KPI STRIP — 4 kartu ───
  const kpis = [
    {label:'Omset Hari Ini', val:fmtShort(omsetHari), accent:'var(--gold)',
      sub:[deltaBadge(omsetHari,omsetKemarin),'<span>vs kemarin</span>'].join(' ')},
    {label:'Omset Bulan Ini', val:fmtShort(omsetBulan), accent:'var(--brown)',
      sub:[deltaBadge(omsetBulan,omsetBulanLalu),`<span>vs bln lalu · proyeksi ${fmtShort(proyeksi)}</span>`].join(' ')},
    {label:'Nilai Stok (HPP)', val:fmtShort(nilaiStok), accent:'#3D7EAA',
      sub:`<span>${fmtNum(totalStok)} pcs · ${DB.stok.length} SKU</span>`},
    {label:'Stok Bermasalah', val:`${stokHabis.length+stokKritis.length} SKU`, accent:stokHabis.length>0?'#C0392B':'#E6A817',
      sub:`<span class="stok-red">${stokHabis.length} habis</span> · <span class="stok-amber">${stokKritis.length} kritis</span>`}
  ];
  add(`<div>
    <div class="ow-col3-hd"><span class="ow-sec-title">📊 Performa Utama</span></div>
    <div class="ow-kpi-strip">${kpis.map(k=>`
      <div class="ow-kpi">
        <div class="ow-kpi-accent" style="background:${k.accent}"></div>
        <div class="ow-kpi-label">${k.label}</div>
        <div class="ow-kpi-val">${k.val}</div>
        <div class="ow-kpi-sub">${k.sub}</div>
      </div>`).join('')}</div>
  </div>`);

  // ─── 2b. PACE + LABA + DECLINING (3 kolom, row baru) ───
  add(`
  <div class="ow-row3col">

    <!-- PACE INDICATOR -->
    <div class="ow-col3">
      <div class="ow-col3-hd">
        <span class="ow-sec-title">⚡ Pace Target</span>
        <span class="ow-card-badge" style="background:${paceBg};color:${paceWarnColor};">${paceStatus==='done'?'TERCAPAI':paceStatus==='aman'?'ON TRACK':paceStatus==='lambat'?'LAMBAT':'BAHAYA'}</span>
      </div>
      <div class="ow-col3-card">
        <div style="font-size:12px;padding:9px 12px;background:${paceBg};border-radius:8px;border-left:3px solid ${paceBorderColor};margin-bottom:14px;color:${paceWarnColor};font-weight:600;">
          ${pacePesan}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="ow-mini">
            <div class="ow-mini-label">Avg/Hari (aktual)</div>
            <div class="ow-mini-val" style="font-size:15px;">${fmtShort(avgPerHari)}</div>
          </div>
          <div class="ow-mini">
            <div class="ow-mini-label">Perlu/Hari</div>
            <div class="ow-mini-val" style="font-size:15px;color:${perHariHarus>avgPerHari?'#C0392B':'#2D6A4F'}">${perHariHarus>0?fmtShort(perHariHarus):'—'}</div>
          </div>
          <div class="ow-mini">
            <div class="ow-mini-label">Proyeksi Akhir Bln</div>
            <div class="ow-mini-val" style="font-size:14px;color:${paceProyeksi>=targetOmset?'#2D6A4F':'#D97706'}">${fmtShort(paceProyeksi)}</div>
          </div>
          <div class="ow-mini">
            <div class="ow-mini-label">Sisa Target</div>
            <div class="ow-mini-val" style="font-size:14px;color:${sisaTarget>0?'#C0392B':'#2D6A4F'}">${sisaTarget>0?fmtShort(sisaTarget):'✅ Done'}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ESTIMASI LABA BERSIH -->
    <div class="ow-col3">
      <div class="ow-col3-hd">
        <span class="ow-sec-title">💰 Estimasi Laba Bersih</span>
        <span class="ow-card-badge" style="background:${labaBg};color:${labaColor};">GM ${grossMarginPct}%</span>
      </div>
      <div class="ow-col3-card">
        <div style="font-size:12px;padding:9px 12px;background:${labaBg};border-radius:8px;border-left:3px solid ${labaColor};margin-bottom:14px;color:${labaColor};font-weight:600;">
          ${labaEstimasi>=0?'✅ Bisnis bulan ini dalam kondisi <b>profit</b>.':'🚨 Estimasi bulan ini <b>rugi</b>. Cek biaya & margin produk.'}
          ${biayaOpsPerBulan===0?'<br><span style="font-weight:400;color:var(--dusty);">📌 Set biaya ops di menu Biaya Operasional untuk hasil akurat.</span>':''}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div class="ow-mini">
            <div class="ow-mini-label">Omset (Harga Jual)</div>
            <div class="ow-mini-val" style="font-size:13px;">${fmtShort(omsetHargaJual)}</div>
          </div>
          <div class="ow-mini">
            <div class="ow-mini-label">Gross Margin</div>
            <div class="ow-mini-val" style="font-size:13px;color:#2D6A4F;">${fmtShort(grossMarginAmt)}</div>
          </div>
          <div class="ow-mini">
            <div class="ow-mini-label">Biaya Ops</div>
            <div class="ow-mini-val" style="font-size:13px;color:#C0392B;">${biayaOpsPerBulan>0?fmtShort(biayaOpsPerBulan):'Belum diset'}</div>
          </div>
          <div class="ow-mini" style="background:${labaBg};">
            <div class="ow-mini-label">Est. Laba Bersih</div>
            <div class="ow-mini-val" style="font-size:13px;color:${labaColor};font-weight:800;">${fmtShort(labaEstimasi)}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- SKU DECLINING -->
    <div class="ow-col3">
      <div class="ow-col3-hd">
        <span class="ow-sec-title">📉 SKU Menurun</span>
        <span class="ow-card-badge ow-badge-amber">${skuDeclining.length} SKU</span>
      </div>
      <div class="ow-col3-card">
        <div style="font-size:12px;padding:9px 12px;background:#FFFBF0;border-radius:8px;border-left:3px solid #D97706;margin-bottom:10px;color:#92400E;font-weight:600;">
          ⚠️ Penjualan turun vs bulan lalu. Cek harga, stok, atau promosi.
        </div>
        <div class="ow-col3-scroll">
          ${skuDeclining.length===0
            ? `<div class="ow-empty">✅ Tidak ada SKU yang menurun signifikan</div>`
            : skuDeclining.map(s=>`
              <div class="ow-stok-row">
                <span class="ow-stok-sku">${s.sku}</span>
                <div class="ow-stok-right" style="gap:8px;">
                  <span class="ow-stok-meta">${s.prev} → ${s.qty} pcs</span>
                  <span style="font-size:13px;font-weight:700;color:#C0392B;min-width:42px;text-align:right;">▼${s.drop}%</span>
                </div>
              </div>`).join('')
          }
        </div>
      </div>
    </div>

  </div>`);

  // ─── 3. TREN PERIODE — Shopee-style dual line chart ───
  // Fungsi ini membangun seluruh widget: dropdown + canvas + stats
  // dipanggil sekali saat render, lalu re-render saat user ganti periode
  (function buildTrendWidget(){
    const CVAS_ID = 'owTrendC_' + Math.random().toString(36).slice(2,8);
    const WRAP_ID = 'owTrendW_' + Math.random().toString(36).slice(2,8);

    // ── State ──
    let _mode   = 'realtime';   // realtime | yesterday | 7d | 30d | custom_day | custom_week | custom_month | custom_year
    let _metric = 'omset';      // omset | qty
    let _dropOpen = false;
    let _subOpen  = '';         // '' | 'hari' | 'minggu' | 'bulan' | 'tahun'
    let _customRange = null;    // {from:'YYYY-MM-DD', to:'YYYY-MM-DD'}
    let _customWeek  = null;    // {year, week}
    let _customMonth = null;    // {year, month}
    let _customYear  = null;    // year number

    // ── Helpers ──
    const pad2  = n => String(n).padStart(2,'0');
    const today = new Date();
    const todayS = _localDateStr(today);

    function dateOffset(d, offsetDays){
      const nd = new Date(d);
      nd.setDate(nd.getDate() + offsetDays);
      return nd;
    }
    function dateStr(d){ return _localDateStr(d); }

    function getRangeForMode(mode, custom){
      const t = new Date();
      if(mode==='realtime'){
        return {from: todayS, to: todayS};
      } else if(mode==='yesterday'){
        const y = dateStr(dateOffset(t,-1));
        return {from:y, to:y};
      } else if(mode==='7d'){
        return {from: dateStr(dateOffset(t,-6)), to: todayS};
      } else if(mode==='30d'){
        return {from: dateStr(dateOffset(t,-29)), to: todayS};
      } else if(mode==='custom_day' && custom){
        return {from:custom.from, to:custom.to};
      } else if(mode==='custom_week' && custom){
        // Get Mon–Sun of selected week
        const jan1 = new Date(custom.year,0,1);
        const mon = new Date(jan1);
        mon.setDate(jan1.getDate() + (custom.week-1)*7 - (jan1.getDay()||7) + 1);
        const sun = dateOffset(mon,6);
        return {from:dateStr(mon), to:dateStr(sun)};
      } else if(mode==='custom_month' && custom){
        const fm = `${custom.year}-${pad2(custom.month)}-01`;
        const last = new Date(custom.year, custom.month, 0);
        return {from:fm, to:dateStr(last)};
      } else if(mode==='custom_year' && custom){
        return {from:`${custom.year}-01-01`, to:`${custom.year}-12-31`};
      }
      return {from:todayS, to:todayS};
    }

    function getCompareRange(mode, mainRange){
      // Compare = same duration shifted back by duration length
      const from = new Date(mainRange.from + 'T00:00:00');
      const to   = new Date(mainRange.to   + 'T00:00:00');
      const dur  = Math.round((to-from)/(86400000)) + 1; // days
      const cTo   = dateOffset(from, -1);
      const cFrom = dateOffset(cTo, -(dur-1));
      return {from:dateStr(cFrom), to:dateStr(cTo)};
    }

    function getJurnalInRange(range){
      return (DB.jurnal||[]).filter(j=>j.tgl && j.tgl>=range.from && j.tgl<=range.to);
    }

    function getHpp(varName){
      if(!varName) return 0;
      const p=(DB.produk||[]).find(x=>(x.var||'').toUpperCase()===(varName||'').toUpperCase());
      return (p&&p.hpp)?p.hpp:0;
    }

    function buildSeries(range, mode){
      // Returns array of {label, ds, val}
      const from = new Date(range.from + 'T00:00:00');
      const to   = new Date(range.to   + 'T00:00:00');
      const dur  = Math.round((to-from)/86400000)+1;

      if(mode==='custom_month' && _customMonth){
        // Group by day of month
        const pts=[];
        for(let i=0;i<dur;i++){
          const d=dateOffset(from,i);
          const ds=dateStr(d);
          const label=String(d.getDate());
          const j=getJurnalInRange({from:ds,to:ds});
          const val=_metric==='omset'?j.reduce((s,x)=>s+(x.harga||0)*(x.qty||0),0):j.reduce((s,x)=>s+(x.qty||0),0);
          pts.push({label,ds,val});
        }
        return pts;
      } else if(mode==='custom_year' && _customYear){
        // Group by month
        const pts=[];
        for(let m=1;m<=12;m++){
          const mStr=`${_customYear}-${pad2(m)}`;
          const j=(DB.jurnal||[]).filter(x=>x.tgl&&x.tgl.startsWith(mStr));
          const val=_metric==='omset'?j.reduce((s,x)=>s+(x.harga||0)*(x.qty||0),0):j.reduce((s,x)=>s+(x.qty||0),0);
          const monthNames=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
          pts.push({label:monthNames[m-1],ds:mStr,val});
        }
        return pts;
      } else if(mode==='custom_week' && _customWeek){
        const dayNames=['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
        const pts=[];
        for(let i=0;i<dur;i++){
          const d=dateOffset(from,i);
          const ds=dateStr(d);
          const j=getJurnalInRange({from:ds,to:ds});
          const val=_metric==='omset'?j.reduce((s,x)=>s+(x.harga||0)*(x.qty||0),0):j.reduce((s,x)=>s+(x.qty||0),0);
          pts.push({label:dayNames[d.getDay()],ds,val});
        }
        return pts;
      } else if(mode==='realtime' || (mode==='yesterday' && range.from===range.to && range.from!==todayS)){
        // Hourly breakdown — works for today (realtime) AND single-day compare (kemarin per jam)
        const targetDs = range.from;
        const isComp   = targetDs !== todayS;
        const pts=[];
        const j=getJurnalInRange({from:targetDs,to:targetDs});
        const nowH = isComp ? 23 : new Date().getHours();
        for(let h=0;h<=nowH;h++){
          const jh=j.filter(x=>{
            const t=(x.tgl_waktu||x.waktu||'');
            const hh=parseInt((t.split(' ')[1]||'').split(':')[0])||0;
            return hh===h;
          });
          const val=_metric==='omset'?jh.reduce((s,x)=>s+(x.harga||0)*(x.qty||0),0):jh.reduce((s,x)=>s+(x.qty||0),0);
          pts.push({label:`${pad2(h)}:00`,ds:targetDs,val,isToday:!isComp});
        }
        return pts;
      } else {
        // Day-by-day
        const pts=[];
        for(let i=0;i<dur;i++){
          const d=dateOffset(from,i);
          const ds=dateStr(d);
          const isToday=ds===todayS;
          const label=d.toLocaleDateString('id-ID',{weekday:'short'})+(isToday?'*':'');
          const j=getJurnalInRange({from:ds,to:ds});
          const val=_metric==='omset'?j.reduce((s,x)=>s+(x.harga||0)*(x.qty||0),0):j.reduce((s,x)=>s+(x.qty||0),0);
          pts.push({label,ds,val,isToday});
        }
        return pts;
      }
    }

    function fmtV(v){
      if(_metric==='qty') return fmtNum(v)+' pcs';
      return v>=1000000?(v/1000000).toFixed(1)+'Jt':v>=1000?(v/1000).toFixed(1)+'K':fmtNum(v);
    }
    function fmtVFull(v){
      return _metric==='qty'?fmtNum(v)+' pcs':fmtShort(v);
    }

    // ── Draw dual line chart ──
    function drawChart(data1, data2){
      const cvs=document.getElementById(CVAS_ID);
      if(!cvs)return;
      const par=cvs.parentElement;
      const W=par?par.clientWidth||500:500;
      const isMobile = W < 500;
      const H = isMobile ? 160 : 190;
      cvs.width=W; cvs.height=H;
      const ctx=cvs.getContext('2d');
      ctx.clearRect(0,0,W,H);

      const n=data1.length;
      if(n===0)return;

      // Merge max from both
      const allVals=[...data1.map(d=>d.val),...data2.map(d=>d.val)];
      const maxV=Math.max(...allVals,1);
      const pad={t:18,r:20,b:32,l:isMobile?44:54};
      const cw=W-pad.l-pad.r;
      const ch=H-pad.t-pad.b;
      const xOf=i=>pad.l+(n===1?cw/2:(i/(n-1))*cw);
      const yOf=v=>pad.t+ch-(v/maxV)*ch;

      // Grid
      ctx.strokeStyle='rgba(180,168,155,0.35)'; ctx.lineWidth=1;
      [0.25,0.5,0.75,1].forEach(f=>{
        const y=pad.t+ch*(1-f);
        ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+cw,y);ctx.stroke();
        ctx.fillStyle='#a09880';ctx.font=`${isMobile?9:10}px sans-serif`;ctx.textAlign='right';
        const lv=Math.round(maxV*f);
        const ls=_metric==='qty'?(lv>=1000?(lv/1000).toFixed(0)+'K':lv):(lv>=1000000?(lv/1000000).toFixed(1)+'Jt':lv>=1000?(lv/1000).toFixed(0)+'K':lv);
        ctx.fillText(ls,pad.l-6,y+3.5);
      });

      // ── Compare line (abu dashed) ──
      if(data2.some(d=>d.val>0)){
        ctx.beginPath();
        ctx.strokeStyle='#C0B8AF';ctx.lineWidth=1.8;
        ctx.setLineDash([5,4]);ctx.lineJoin='round';
        data2.forEach((d,i)=>{ i===0?ctx.moveTo(xOf(i),yOf(d.val)):ctx.lineTo(xOf(i),yOf(d.val)); });
        ctx.stroke();ctx.setLineDash([]);
        // dots compare
        data2.forEach((d,i)=>{
          if(!d.val)return;
          ctx.beginPath();ctx.arc(xOf(i),yOf(d.val),2.5,0,Math.PI*2);
          ctx.fillStyle='#B0A898';ctx.fill();
          ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();
        });
      }

      // ── Main fill gradient ──
      const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+ch);
      grad.addColorStop(0,'rgba(184,143,73,0.18)');
      grad.addColorStop(1,'rgba(184,143,73,0.01)');
      ctx.beginPath();
      data1.forEach((d,i)=>{ i===0?ctx.moveTo(xOf(i),yOf(d.val)):ctx.lineTo(xOf(i),yOf(d.val)); });
      ctx.lineTo(xOf(n-1),pad.t+ch);ctx.lineTo(xOf(0),pad.t+ch);ctx.closePath();
      ctx.fillStyle=grad;ctx.fill();

      // ── Main gradient fill lebih vivid ──
      const grad2=ctx.createLinearGradient(0,pad.t,0,pad.t+ch);
      grad2.addColorStop(0,'rgba(192,57,43,0.22)');
      grad2.addColorStop(0.5,'rgba(192,57,43,0.08)');
      grad2.addColorStop(1,'rgba(192,57,43,0.01)');
      ctx.beginPath();
      data1.forEach((d,i)=>{ i===0?ctx.moveTo(xOf(i),yOf(d.val)):ctx.lineTo(xOf(i),yOf(d.val)); });
      ctx.lineTo(xOf(n-1),pad.t+ch);ctx.lineTo(xOf(0),pad.t+ch);ctx.closePath();
      ctx.fillStyle=grad2;ctx.fill();

      // ── Main line (merah) lebih tebal ──
      ctx.beginPath();
      ctx.strokeStyle='#C0392B';ctx.lineWidth=isMobile?2.5:2.8;ctx.lineJoin='round';ctx.lineCap='round';
      data1.forEach((d,i)=>{ i===0?ctx.moveTo(xOf(i),yOf(d.val)):ctx.lineTo(xOf(i),yOf(d.val)); });
      ctx.stroke();

      // Main dots — lebih besar dan jelas
      data1.forEach((d,i)=>{
        if(!d.val&&!d.isToday)return;
        const r=d.isToday?7:4;
        ctx.beginPath();
        ctx.arc(xOf(i),yOf(d.val),r,0,Math.PI*2);
        ctx.fillStyle=d.isToday?'#7B1B0A':'#C0392B';
        ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.stroke();
      });

      // ── X Labels — thin out if >14 points ──
      ctx.fillStyle='#8a8070';ctx.font=`${isMobile?9:10}px sans-serif`;ctx.textAlign='center';
      const step=n>14?Math.ceil(n/7):1;
      data1.forEach((d,i)=>{
        if(i%step!==0&&i!==n-1)return;
        ctx.fillText(d.label,xOf(i),H-5);
      });

      // ── Hover tooltip (canvas mousemove) ──
      cvs._data1=data1; cvs._data2=data2;
      cvs._meta={pad,cw,ch,xOf,yOf,n,maxV,W,H};
    }

    // ── Tooltip via canvas mousemove ──
    function attachTooltip(cvs){
      if(cvs._tooltipAttached)return;
      cvs._tooltipAttached=true;
      cvs.style.cursor='crosshair';
      cvs.addEventListener('mousemove',function(e){
        if(!cvs._meta)return;
        const rect=cvs.getBoundingClientRect();
        const mx=(e.clientX-rect.left)*(cvs.width/rect.width);
        const {pad,cw,n,xOf,yOf,W,H,maxV}=cvs._meta;
        const d1=cvs._data1||[], d2=cvs._data2||[];
        if(!d1.length)return;
        // Find nearest index
        let best=-1, bestDist=Infinity;
        d1.forEach((_,i)=>{const dx=Math.abs(xOf(i)-mx);if(dx<bestDist){bestDist=dx;best=i;}});
        if(best<0)return;
        // Redraw + tooltip overlay
        const ctx=cvs.getContext('2d');
        // Re-draw
        drawChart(d1,d2);
        // Vertical line
        const tx=xOf(best);
        ctx.beginPath();ctx.strokeStyle='rgba(0,0,0,.08)';ctx.lineWidth=1;
        ctx.moveTo(tx,pad.t);ctx.lineTo(tx,pad.t+H-pad.b-pad.t);ctx.stroke();
        // Tooltip box
        const v1=d1[best]?.val||0, v2=d2[best]?.val||0;
        const lbl1=d1[best]?.label||'', lbl2=d2[best]?.label||'';
        const lines=[lbl1, (_metric==='omset'?'Omset: ':'Qty: ')+fmtVFull(v1)];
        if(d2.some(d=>d.val>0)) lines.push((_metric==='omset'?'Compare: ':'Compare: ')+fmtVFull(v2));
        const fSize=10;
        ctx.font=`${fSize}px sans-serif`;
        const bw=Math.max(...lines.map(l=>ctx.measureText(l).width))+20;
        const bh=lines.length*15+12;
        let bx=tx+8, by=pad.t+2;
        if(bx+bw>W-4)bx=tx-bw-8;
        ctx.fillStyle='rgba(40,30,20,.88)';
        ctx.beginPath();
        if(ctx.roundRect)ctx.roundRect(bx,by,bw,bh,6);else ctx.rect(bx,by,bw,bh);
        ctx.fill();
        lines.forEach((l,li)=>{
          ctx.fillStyle=li===1?'#ff8870':li===2?'#bfb8b0':'#fff';
          ctx.font=li===0?`bold ${fSize}px sans-serif`:`${fSize}px sans-serif`;
          ctx.textAlign='left';
          ctx.fillText(l,bx+10,by+15+li*15);
        });
      });
      cvs.addEventListener('mouseleave',function(){
        const d1=cvs._data1||[], d2=cvs._data2||[];
        drawChart(d1,d2);
      });
    }

    // ── Update stats bar ──
    function updateStats(data1, data2){
      const wrap=document.getElementById(WRAP_ID);
      if(!wrap)return;
      const statsEl=wrap.querySelector('.ow-chart-stats');
      if(!statsEl)return;
      const total1=data1.reduce((s,d)=>s+d.val,0);
      const total2=data2.reduce((s,d)=>s+d.val,0);
      const max1=Math.max(...data1.map(d=>d.val),0);
      const nonZero=data1.filter(d=>d.val>0);
      const avg1=nonZero.length?Math.round(total1/nonZero.length):0;
      const diff=total2>0?Math.round((total1-total2)/total2*100):null;
      const diffColor=diff===null?'var(--dusty)':diff>=0?'#2D6A4F':'#C0392B';
      const diffStr=diff===null?'—':(diff>=0?'▲':'▼')+Math.abs(diff)+'%';
      const lbl2=_mode==='realtime'?'Kemarin':_mode==='yesterday'?'2 Hari Lalu':_mode==='7d'?'7 Hari Lalu':_mode==='30d'?'30 Hari Lalu':'Periode Lalu';
      statsEl.innerHTML=`
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;">
          <div style="background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:3px;">
            <div style="font-size:9.5px;font-weight:700;color:var(--dusty);letter-spacing:.7px;text-transform:uppercase;">Total</div>
            <div style="font-size:16px;font-weight:800;color:var(--charcoal);font-family:'DM Serif Display',serif;">${fmtVFull(total1)}</div>
            <div style="font-size:10.5px;font-weight:700;color:${diffColor};">${diffStr} vs periode lalu</div>
          </div>
          <div style="background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:3px;">
            <div style="font-size:9.5px;font-weight:700;color:var(--dusty);letter-spacing:.7px;text-transform:uppercase;">Tertinggi</div>
            <div style="font-size:16px;font-weight:800;color:var(--charcoal);font-family:'DM Serif Display',serif;">${fmtVFull(max1)}</div>
            <div style="font-size:10.5px;color:var(--dusty);">periode ini</div>
          </div>
          <div style="background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:3px;">
            <div style="font-size:9.5px;font-weight:700;color:var(--dusty);letter-spacing:.7px;text-transform:uppercase;">Rata-rata</div>
            <div style="font-size:16px;font-weight:800;color:var(--charcoal);font-family:'DM Serif Display',serif;">${fmtVFull(avg1)}</div>
            <div style="font-size:10.5px;color:var(--dusty);">per titik aktif</div>
          </div>
          <div style="background:var(--card);border:1.5px solid var(--border);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:3px;">
            <div style="font-size:9.5px;font-weight:700;color:var(--dusty);letter-spacing:.7px;text-transform:uppercase;">${lbl2}</div>
            <div style="font-size:16px;font-weight:800;color:var(--dusty);font-family:'DM Serif Display',serif;">${total2>0?fmtVFull(total2):'—'}</div>
            <div style="font-size:10.5px;color:var(--dusty);">pembanding</div>
          </div>
        </div>
      `;
    }

    // ── Main render of chart + legend ──
    function renderChartSection(){
      const mainRange = getRangeForMode(_mode, _mode==='custom_day'?_customRange:_mode==='custom_week'?_customWeek:_mode==='custom_month'?_customMonth:_mode==='custom_year'?{year:_customYear}:null);
      const compRange = getCompareRange(_mode, mainRange);
      const data1 = buildSeries(mainRange, _mode);
      // For realtime: compare range is yesterday single-day → use realtime branch (hourly)
      const data2 = buildSeries(compRange, _mode==='realtime'?'realtime':_mode);

      // Update label bar
      const wrap=document.getElementById(WRAP_ID);
      if(!wrap)return;

      const legendEl=wrap.querySelector('.ow-chart-legend');
      if(legendEl){
        const lbl1=_mode==='realtime'?'Hari Ini':_mode==='yesterday'?'Kemarin':_mode==='7d'?'7 Hari Ini':_mode==='30d'?'30 Hari Ini':'Periode Ini';
        const lbl2=_mode==='realtime'?'Kemarin':_mode==='yesterday'?'2 Hari Lalu':_mode==='7d'?'7 Hari Lalu':_mode==='30d'?'30 Hari Lalu':'Periode Lalu';
        legendEl.innerHTML=`<span><span class="ow-legend-dot" style="background:#C0392B;"></span>${lbl1}</span><span><span class="ow-legend-dot" style="background:#C0B8AF;border:1px dashed #999;"></span>${lbl2}</span>`;
      }

      requestAnimationFrame(()=>{
        const cvs=document.getElementById(CVAS_ID);
        if(cvs){
          drawChart(data1,data2);
          attachTooltip(cvs);
        }
        updateStats(data1,data2);
      });
    }

    // ── Label for active mode ──
    function getModeLabel(){
      if(_mode==='realtime') return 'Real-time · Hari Ini';
      if(_mode==='yesterday') return 'Kemarin';
      if(_mode==='7d') return '7 Hari Terakhir';
      if(_mode==='30d') return '30 Hari Terakhir';
      if(_mode==='custom_day'&&_customRange) return `${_customRange.from} – ${_customRange.to}`;
      if(_mode==='custom_week'&&_customWeek) return `Minggu ${_customWeek.week} / ${_customWeek.week_year||_customWeek.year}`;
      if(_mode==='custom_month'&&_customMonth) return `${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][_customMonth.month-1]} ${_customMonth.year}`;
      if(_mode==='custom_year'&&_customYear) return `Tahun ${_customYear}`;
      return 'Pilih Periode';
    }

    // ── Build dropdown HTML ──
    function buildDropdownHTML(){
      const thisY=new Date().getFullYear();
      const thisM=new Date().getMonth()+1;
      // Build month options for custom_month
      let monthOpts='';
      for(let y=thisY;y>=thisY-2;y--){
        const mMax=y===thisY?thisM:12;
        for(let m=mMax;m>=1;m--){
          const mn=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][m-1];
          monthOpts+=`<div class="ow-pdrop-sub-item${_mode==='custom_month'&&_customMonth&&_customMonth.year===y&&_customMonth.month===m?' selected':''}" onclick="_owSetPeriod('custom_month',{year:${y},month:${m}})">${mn} ${y}</div>`;
        }
      }
      // Week options (last 12 weeks)
      let weekOpts='';
      for(let i=0;i<12;i++){
        const d=dateOffset(today,-i*7);
        const jan1=new Date(d.getFullYear(),0,1);
        const wk=Math.ceil(((d-jan1)/86400000+jan1.getDay()+1)/7);
        weekOpts+=`<div class="ow-pdrop-sub-item${_mode==='custom_week'&&_customWeek&&_customWeek.week===wk&&_customWeek.year===d.getFullYear()?' selected':''}" onclick="_owSetPeriod('custom_week',{year:${d.getFullYear()},week:${wk}})">Minggu ke-${wk} / ${d.getFullYear()}</div>`;
      }
      // Year options
      let yearOpts='';
      for(let y=thisY;y>=thisY-4;y--){
        yearOpts+=`<div class="ow-pdrop-sub-item${_mode==='custom_year'&&_customYear===y?' selected':''}" onclick="_owSetPeriod('custom_year',${y})">Tahun ${y}</div>`;
      }
      return `
        <div class="ow-pdrop-section">
          <div class="ow-pdrop-item${_mode==='realtime'?' selected':''}" onclick="_owSetPeriod('realtime')">Real-time / Hari Ini</div>
          <div class="ow-pdrop-item${_mode==='yesterday'?' selected':''}" onclick="_owSetPeriod('yesterday')">Kemarin</div>
          <div class="ow-pdrop-item${_mode==='7d'?' selected':''}" onclick="_owSetPeriod('7d')">7 hari sebelumnya</div>
          <div class="ow-pdrop-item${_mode==='30d'?' selected':''}" onclick="_owSetPeriod('30d')">30 hari sebelumnya</div>
        </div>
        <div class="ow-pdrop-divider"></div>
        <div class="ow-pdrop-section">
          <div class="ow-pdrop-item" onclick="_owToggleSub('hari')">Per Hari <span class="ow-pdrop-arrow" id="ow_arr_hari">›</span></div>
          <div class="ow-pdrop-sub${_subOpen==='hari'?' open':''}" id="ow_sub_hari">
            <div style="padding:8px 18px 4px;font-size:11px;color:var(--dusty);font-weight:700;">PILIH RENTANG TANGGAL</div>
            <div class="ow-datepicker-wrap" style="padding:6px 18px 12px;" onclick="event.stopPropagation()">
              <input type="date" id="ow_dp_from" value="${todayS}" max="${todayS}">
              <span class="ow-date-sep">–</span>
              <input type="date" id="ow_dp_to" value="${todayS}" max="${todayS}">
              <button class="ow-date-apply" onclick="_owApplyCustomDay()">Terapkan</button>
            </div>
          </div>
          <div class="ow-pdrop-item" onclick="_owToggleSub('minggu')">Per Minggu <span class="ow-pdrop-arrow" id="ow_arr_minggu">›</span></div>
          <div class="ow-pdrop-sub${_subOpen==='minggu'?' open':''}" id="ow_sub_minggu">${weekOpts}</div>
          <div class="ow-pdrop-item" onclick="_owToggleSub('bulan')">Per Bulan <span class="ow-pdrop-arrow" id="ow_arr_bulan">›</span></div>
          <div class="ow-pdrop-sub${_subOpen==='bulan'?' open':''}" id="ow_sub_bulan" style="max-height:180px;overflow-y:auto;">${monthOpts}</div>
          <div class="ow-pdrop-item" onclick="_owToggleSub('tahun')">Berdasarkan Tahun <span class="ow-pdrop-arrow" id="ow_arr_tahun">›</span></div>
          <div class="ow-pdrop-sub${_subOpen==='tahun'?' open':''}" id="ow_sub_tahun">${yearOpts}</div>
        </div>
      `;
    }

    // ── Inject global handler functions (closures over state) ──
    window._owSetPeriod = function(mode, custom){
      _mode=mode;
      if(mode==='custom_day'){/* handled via _owApplyCustomDay */}
      else if(mode==='custom_week') _customWeek=custom;
      else if(mode==='custom_month') _customMonth=custom;
      else if(mode==='custom_year') _customYear=custom;
      _dropOpen=false; _subOpen='';
      // Update dropdown
      const dd=document.getElementById('owPeriodDrop');
      if(dd){dd.classList.remove('open');dd.innerHTML=buildDropdownHTML();}
      // Update button label
      const btnLbl=document.getElementById('owPeriodBtnLbl');
      if(btnLbl)btnLbl.textContent=getModeLabel();
      renderChartSection();
    };
    window._owToggleSub = function(key){
      _subOpen=_subOpen===key?'':key;
      const dd=document.getElementById('owPeriodDrop');
      if(dd)dd.innerHTML=buildDropdownHTML();
    };
    window._owApplyCustomDay = function(){
      const f=document.getElementById('ow_dp_from')?.value;
      const t=document.getElementById('ow_dp_to')?.value;
      if(!f||!t)return;
      _customRange={from:f,to:t};
      _owSetPeriod('custom_day');
    };
    window._owTogglePeriodDrop = function(){
      _dropOpen=!_dropOpen;
      const dd=document.getElementById('owPeriodDrop');
      const btn=document.getElementById('owPeriodBtn');
      if(dd){
        if(_dropOpen){dd.innerHTML=buildDropdownHTML();dd.classList.add('open');}
        else dd.classList.remove('open');
      }
      if(btn)btn.classList.toggle('active',_dropOpen);
    };

    // Close on outside click
    document.addEventListener('click', function(e){
      const btn=document.getElementById('owPeriodBtn');
      const dd=document.getElementById('owPeriodDrop');
      if(btn&&dd&&!btn.contains(e.target)&&!dd.contains(e.target)){
        _dropOpen=false; dd.classList.remove('open');
        if(btn)btn.classList.remove('active');
      }
    },{capture:true});

    // ── Target card ──
    // ── Target Harian ──
    const targetHarian = targetOmset > 0 ? Math.round(targetOmset / getDaysInMonth()) : 0;
    const pctHari      = targetHarian > 0 ? Math.min(100, Math.round(omsetHari / targetHarian * 100)) : 0;
    const sisaHari     = Math.max(0, targetHarian - omsetHari);
    const hariColor    = pctHari >= 100 ? '#2D6A4F' : pctHari >= 60 ? '#D97706' : '#C0392B';

    let targetCard = '';
    if(targetOmset>0){
      targetCard = `
        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
          <span style="font-weight:700">📅 Target Bulanan</span>
          <span style="color:var(--dusty);font-size:12px;">${fmtShort(omsetBulan)} / ${fmtShort(targetOmset)}</span>
        </div>
        ${progressBar(pctOmset)}
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--dusty);margin-bottom:16px;">
          <span style="font-weight:700;color:${pctOmset>=70?'#2D6A4F':'#D97706'}">${pctOmset}% tercapai</span>
          <span>${daysLeft} hari tersisa</span>
        </div>
        <div class="ow-mini-grid" style="margin-bottom:18px;">
          <div class="ow-mini"><div class="ow-mini-label">Sisa Target</div><div class="ow-mini-val" style="font-size:15px;color:${sisaTarget>0?'#C0392B':'#2D6A4F'}">${fmtShort(sisaTarget)}</div></div>
          <div class="ow-mini"><div class="ow-mini-label">Per Hari Perlu</div><div class="ow-mini-val" style="font-size:15px;color:#D97706">${perHariHarus>0?fmtShort(perHariHarus):'🎉 Done!'}</div></div>
        </div>

        <div style="height:1px;background:var(--border);margin-bottom:16px;"></div>

        <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
          <span style="font-weight:700">☀️ Target Harian</span>
          <span style="color:var(--dusty);font-size:12px;">${fmtShort(omsetHari)} / ${fmtShort(targetHarian)}</span>
        </div>
        ${progressBar(pctHari, hariColor)}
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--dusty);margin-bottom:16px;">
          <span style="font-weight:700;color:${hariColor}">${pctHari}% tercapai</span>
          <span>${sisaHari>0?fmtShort(sisaHari)+' lagi':'✅ Done!'}</span>
        </div>
        <div class="ow-mini-grid">
          <div class="ow-mini">
            <div class="ow-mini-label">Omset Hari Ini</div>
            <div class="ow-mini-val" style="font-size:15px;color:${hariColor}">${fmtShort(omsetHari)}</div>
            <div style="font-size:10px;color:var(--dusty);margin-top:4px;">${deltaBadge(omsetHari,omsetKemarin)} vs kemarin</div>
          </div>
          <div class="ow-mini">
            <div class="ow-mini-label">Sisa Target Hari</div>
            <div class="ow-mini-val" style="font-size:15px;color:${sisaHari>0?'#C0392B':'#2D6A4F'}">${sisaHari>0?fmtShort(sisaHari):'✅ Done!'}</div>
            <div style="font-size:10px;color:var(--dusty);margin-top:4px;">target ${fmtShort(targetHarian)}/hari</div>
          </div>
        </div>`;
    } else {
      targetCard = `<div class="ow-empty">Target belum diset.<br><a href="#" onclick="try{go('planning-kpi',null)}catch(e){}" style="color:var(--brown);font-weight:700">→ Set Target Bulan Ini</a></div>`;
    }

    // ── Render HTML ──
    add(`<div class="ow-row2" style="align-items:stretch;">
      <!-- Tren Chart -->
      <div id="${WRAP_ID}" style="display:flex;flex-direction:column;">
        <div class="ow-col3-hd">
          <span class="ow-sec-title">📈 Tren Penjualan</span>
          <div style="display:flex;align-items:center;gap:6px;">
            <div class="ow-metric-tab" id="owTabQty" onclick="_owSetMetric('qty')">Qty</div>
            <div class="ow-metric-tab active" id="owTabOmset" onclick="_owSetMetric('omset')">Omset</div>
            <div style="position:relative;">
              <button class="ow-period-btn" id="owPeriodBtn" onclick="_owTogglePeriodDrop()">
                <span id="owPeriodBtnLbl">Real-time · Hari Ini</span>
                <span class="ow-pdrop-icon">▾</span>
              </button>
              <div class="ow-period-dropdown" id="owPeriodDrop"></div>
            </div>
          </div>
        </div>
        <div class="ow-col3-card" style="flex:1;padding-bottom:10px;">
          <canvas id="${CVAS_ID}" style="width:100%;height:130px;display:block;"></canvas>
          <div class="ow-chart-legend"></div>
          <div class="ow-chart-stats"></div>
        </div>
      </div>
      <!-- Target Bulanan -->
      <div style="display:flex;flex-direction:column;">
        <div class="ow-col3-hd"><span class="ow-sec-title">🎯 Target Bulanan</span></div>
        <div class="ow-col3-card">${targetCard}</div>
      </div>
    </div>`);

    // Inject metric toggle
    window._owSetMetric = function(m){
      _metric=m;
      document.getElementById('owTabOmset')?.classList.toggle('active',m==='omset');
      document.getElementById('owTabQty')?.classList.toggle('active',m==='qty');
      renderChartSection();
    };

    // Initial render
    renderChartSection();

  })(); // end IIFE buildTrendWidget

  // ─── 4. DEAD STOCK | STOK HABIS | PRIORITAS RESTOCK (3 kolom) ───

  // --- Dead Stock HTML ---
  const deadStockHtml = deadStock.length===0
    ? `<div class="ow-empty">✅ Tidak ada dead stock</div>`
    : deadStock.map(r=>`
        <div class="ow-stok-row">
          <span class="ow-stok-sku" ${r.var}>${r.var}</span>
          <div class="ow-stok-right">
            <span class="ow-stok-meta">${fmtShort(getAkhir(r)*(r.hpp||0))}</span>
            <span class="ow-stok-num stok-amber">${getAkhir(r)} pcs</span>
          </div>
        </div>`).join('')
;

  // --- Stok Habis HTML ---
  const stokHabisHtml = stokHabis.length===0
    ? `<div class="ow-empty">✅ Tidak ada stok habis</div>`
    : stokHabis.map(r=>{
        const p=(DB.produk||[]).find(x=>(x.var||'').toUpperCase()===(r.var||'').toUpperCase());
        return `<div class="ow-stok-row">
          <span class="ow-stok-sku" ${r.var}>${r.var}</span>
          <div class="ow-stok-right">
            <span class="ow-stok-meta">terjual: ${soldMap[r.var]||0}</span>
            <span class="ow-stok-num stok-red">HABIS</span>
          </div>
        </div>`;
      }).join('');

  // --- Prioritas Restock BARU: Best Seller Induk rank 1-5, tampil semua variantnya (maks 10 SKU) ---
  // Step 1: hitung total penjualan per induk bulan ini
  const indukSalesMap = {};
  jBulan.forEach(j => {
    const p = (DB.produk||[]).find(x=>(x.var||'').toUpperCase()===(j.var||'').toUpperCase());
    const induk = (p && p.induk) ? p.induk.toUpperCase() : (j.var||'').toUpperCase();
    indukSalesMap[induk] = (indukSalesMap[induk]||0) + (j.qty||0);
  });
  // Step 2: rank induk by sales, ambil top 5
  const topInduk = Object.entries(indukSalesMap)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,5)
    .map(([induk])=>induk);

  // Step 3: kumpulkan variant dari top induk yang stoknya HABIS atau KRITIS saja
  const restockBestSeller = [];
  for (const indukKey of topInduk) {
    // Cari semua stok yang induknya cocok
    const variants = DB.stok.filter(r => {
      const p = (DB.produk||[]).find(x=>(x.var||'').toUpperCase()===(r.var||'').toUpperCase());
      const ind = (p && p.induk) ? p.induk.toUpperCase() : (r.var||'').toUpperCase();
      return ind === indukKey;
    });
    for (const r of variants) {
      const akhir = getAkhir(r);
      const safety = r.safety || 4;
      // Hanya masuk jika stok habis (0) atau kritis (<= safety stock)
      if (akhir <= safety) {
        restockBestSeller.push({ ...r, _induk: indukKey, _indukSales: indukSalesMap[indukKey]||0, _akhir: akhir });
      }
    }
  }
  // Urutkan: HABIS dulu, lalu stok paling sedikit, lalu induk terlaris
  restockBestSeller.sort((a, b) => {
    if (a._akhir <= 0 && b._akhir > 0) return -1;
    if (b._akhir <= 0 && a._akhir > 0) return 1;
    if (a._akhir !== b._akhir) return a._akhir - b._akhir;
    return b._indukSales - a._indukSales;
  });
  // Batasi max 10 SKU setelah sorting
  restockBestSeller.splice(10);

  const restockHtml = restockBestSeller.length===0
    ? `<div class="ow-empty">Semua stok produk terlaris masih aman 👍</div>`
    : restockBestSeller.map((r,i)=>{
        const akhir = getAkhir(r);
        const cls   = akhir<=0?'stok-red':akhir<=(r.safety||4)?'stok-amber':'';
        const label = akhir<=0?'HABIS':akhir+' pcs';
        // Tampilkan nama induk hanya di baris pertama tiap grup
        const prevInduk = i>0 ? restockBestSeller[i-1]._induk : null;
        const showInduk = r._induk !== prevInduk;
        return (showInduk ? `<div style="font-size:12.5px;font-weight:700;color:var(--brown);text-transform:uppercase;letter-spacing:.7px;padding:${i===0?'0':'8px'} 0 4px;">🏆 ${r._induk} · ${r._indukSales} terjual</div>` : '')
          + `<div class="ow-stok-row">
              <span class="ow-stok-sku" ${r.var}>${r.var}</span>
              <div class="ow-stok-right">
                <span class="ow-stok-meta">${soldBulanMap[r.var]||0} bln ini</span>
                <span class="ow-stok-num ${cls}">${label}</span>
              </div>
            </div>`;
      }).join('');

  add(`
  <style>
    .ow-row3col{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;}
    @media(max-width:900px){.ow-row3col{grid-template-columns:1fr;}}

    /* Setiap kolom = flex column, card mengisi sisa tinggi */
    .ow-col3{display:flex;flex-direction:column;}

    /* Header kolom: tinggi FIXED 44px agar semua sejajar */
    .ow-col3-hd{
      height:44px;
      display:flex;align-items:center;justify-content:space-between;
      padding:0 2px;margin-bottom:8px;flex-shrink:0;
    }

    /* Card mengisi sisa tinggi kolom */
    .ow-col3-card{
      flex:1;
      background:var(--card);border:1px solid var(--border);
      border-radius:16px;padding:16px 18px;
      overflow:hidden;
    }

    /* Scroll jika isi terlalu panjang */
    .ow-col3-scroll{
      max-height:460px;
      overflow-y:auto;
      overflow-x:hidden;
      -webkit-overflow-scrolling:touch;
      scroll-behavior:smooth;
    }
    .ow-col3-scroll::-webkit-scrollbar{width:3px;}
    .ow-col3-scroll::-webkit-scrollbar-track{background:transparent;}
    .ow-col3-scroll::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}
    /* Responsive: laptop, Android, iPhone */
    @media(max-width:900px){
      /* MOBILE: kolom jadi flex column, bisa ubah urutan */
      .ow-row3col{display:flex;flex-direction:column;}
      /* MOBILE: scroll aktif dengan tinggi tetap */
      .ow-col3-scroll{max-height:260px;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;}
      .ow-col3-card{padding:14px 14px;}
      .ow-col3-hd{height:auto;margin-bottom:6px;padding:2px 0;}
      /* MOBILE: urutan — Prioritas Restock dulu, lalu Stok Habis, lalu Dead Stock */
      .ow-col3-restock{order:1;}
      .ow-col3-habis{order:2;}
      .ow-col3-dead{order:3;}
    }
    @media(max-width:480px){
      .ow-col3-card{padding:12px 12px;border-radius:12px;}
      .ow-col3-scroll{max-height:220px;}
    }
  </style>
  <div class="ow-row3col">

    <!-- Dead Stock — order:3 di mobile, kolom pertama di laptop -->
    <div class="ow-col3 ow-col3-dead">
      <div class="ow-col3-hd">
        <span class="ow-sec-title">🧟 Dead Stock</span>
        <span class="ow-card-badge ow-badge-amber">${deadStock.length} SKU · ${fmtShort(deadStokNilai)}</span>
      </div>
      <div class="ow-col3-card">
        <div style="font-size:12px;color:var(--dusty);margin-bottom:10px;padding:9px 12px;background:var(--cream);border-radius:8px;">
          ⚠️ Belum pernah terjual. Pertimbangkan diskon / bundling.
        </div>
        <div class="ow-col3-scroll">${deadStockHtml}</div>
      </div>
    </div>

    <!-- Stok Habis — order:2 di mobile, kolom kedua di laptop -->
    <div class="ow-col3 ow-col3-habis">
      <div class="ow-col3-hd">
        <span class="ow-sec-title">📦 Stok Habis</span>
        <span class="ow-card-badge ${stokHabis.length>0?'ow-badge-red':'ow-badge-green'}">${stokHabis.length} SKU</span>
      </div>
      <div class="ow-col3-card">
        <div style="font-size:12px;color:var(--dusty);margin-bottom:10px;padding:9px 12px;background:#FFF0EE;border-radius:8px;border-left:3px solid #C0392B;">
          🚨 Stok kosong! Segera lakukan restock agar tidak kehilangan penjualan.
        </div>
        <div class="ow-col3-scroll">${stokHabisHtml}</div>
      </div>
    </div>

    <!-- Prioritas Restock — order:1 di mobile (paling atas), kolom ketiga di laptop -->
    <div class="ow-col3 ow-col3-restock">
      <div class="ow-col3-hd">
        <span class="ow-sec-title">🔁 Prioritas Restock</span>
        <span class="ow-card-badge ow-badge-amber">Best Seller Top 5</span>
      </div>
      <div class="ow-col3-card">
        <div style="font-size:12px;color:var(--dusty);margin-bottom:10px;padding:9px 12px;background:#FFFBF0;border-radius:8px;border-left:3px solid var(--gold);">
          🏆 Produk terlaris bulan ini. Prioritaskan restock untuk menjaga omset.
        </div>
        <div class="ow-col3-scroll">${restockHtml}</div>
      </div>
    </div>

  </div>`);

  // ─── 5. CHANNEL + TOP SKU ───
  const chHtml = channels.length===0
    ? `<div class="ow-empty">Belum ada penjualan bulan ini</div>`
    : channels.map(([ch,v])=>{
        const prev=(chMapLalu[ch]||{}).omset||0;
        const bw = totalChOmset>0 ? Math.round(v.omset/totalChOmset*100) : 0;
        return `<div class="ow-ch-row">
          <span class="ow-ch-name">${ch}</span>
          <div class="ow-ch-bar"><div class="ow-ch-fill" style="width:${bw}%"></div></div>
          <span class="ow-ch-val">${fmtShort(v.omset)}</span>
          ${deltaBadge(v.omset,prev)}
          <span style="font-size:12px;color:var(--dusty);min-width:32px;text-align:right">${bw}%</span>
        </div>`;
      }).join('');

  const topQty = topSKU.length>0 ? topSKU[0][1] : 1;
  const skuHtml = topSKU.length===0
    ? `<div class="ow-empty">Belum ada penjualan bulan ini</div>`
    : topSKU.map(([sku,qty],i)=>`
      <div class="ow-sku-row">
        <span class="ow-sku-rank">${i+1}</span>
        <span class="ow-sku-name">${sku}</span>
        <div class="ow-sku-bar"><div class="ow-sku-bfill" style="width:${Math.round(qty/topQty*100)}%"></div></div>
        <span class="ow-sku-qty">${qty} pcs</span>
        ${deltaBadge(qty,soldBulanLaluMap[sku]||0)}
      </div>`).join('');

  // ─── 5 & 7 GABUNGAN: Stok per Supplier | Channel Penjualan | Top SKU ───
  // Bar chart vertikal untuk supplier
  const supBarMaxH = 120; // tinggi maksimum bar dalam px
  const supBarHtml = suppliers.length === 0
    ? `<div class="ow-empty">Belum ada data stok</div>`
    : `<div style="display:flex;align-items:flex-end;gap:10px;height:${supBarMaxH+70}px;padding:0 4px;">
        ${suppliers.map(([sup,v])=>{
          const barH = Math.max(8, Math.round(v.nilai/supMax*supBarMaxH));
          const habisColor = v.habis>0 ? '#C0392B' : '#2D6A4F';
          return `<div style="display:flex;flex-direction:column;align-items:center;flex:1;min-width:0;gap:4px;">
            <div style="font-size:11px;font-weight:700;color:var(--charcoal);text-align:center;">${fmtShort(v.nilai)}</div>
            <div style="width:100%;background:var(--sage);border-radius:6px 6px 0 0;height:${barH}px;position:relative;cursor:default;"
                 title="${sup}: Nilai ${fmtShort(v.nilai)} | SKU ${v.sku} | Habis ${v.habis}">
            </div>
            <div style="font-size:10px;font-weight:700;color:var(--charcoal);text-align:center;word-break:break-word;line-height:1.2;">${sup}</div>
            <div style="display:flex;gap:4px;justify-content:center;flex-wrap:wrap;">
              <span style="font-size:10px;color:var(--dusty);">${v.sku} SKU</span>
              <span style="font-size:10px;font-weight:700;color:${habisColor};">${v.habis} habis</span>
            </div>
          </div>`;
        }).join('')}
      </div>`;

  add(`<div class="ow-row3col" style="align-items:stretch;">

    <!-- Stok per Supplier (Bar Chart) -->
    <div class="ow-col3" style="display:flex;flex-direction:column;">
      <div class="ow-col3-hd">
        <span class="ow-sec-title">🏭 Stok per Supplier</span>
        <span class="ow-sec-note">Nilai stok berdasarkan HPP</span>
      </div>
      <div class="ow-col3-card" style="flex:1;">
        ${supBarHtml}
      </div>
    </div>

    <!-- Channel Penjualan -->
    <div class="ow-col3" style="display:flex;flex-direction:column;">
      <div class="ow-col3-hd">
        <span class="ow-sec-title">🛍️ Channel Penjualan</span>
        <span class="ow-sec-note">Bulan ini vs lalu</span>
      </div>
      <div class="ow-col3-card" style="flex:1;">${chHtml}</div>
    </div>

    <!-- Top SKU Bulan Ini -->
    <div class="ow-col3" style="display:flex;flex-direction:column;">
      <div class="ow-col3-hd">
        <span class="ow-sec-title">🏆 Top SKU Bulan Ini</span>
        <span class="ow-sec-note">vs bulan lalu</span>
      </div>
      <div class="ow-col3-card" style="flex:1;">${skuHtml}</div>
    </div>

  </div>`);

  // ─── 8. RINGKASAN KEUANGAN DETAIL ───
  add(`<div>
    <div class="ow-col3-hd"><span class="ow-sec-title">💰 Ringkasan Keuangan</span></div>
    <div class="ow-col3-card">
      <div class="ow-row3">
        <div>
          <div class="ow-mini-grid">
            <div class="ow-mini"><div class="ow-mini-label">Hari Ini</div><div class="ow-mini-val" style="font-size:15px">${fmtShort(omsetHari)}</div></div>
            <div class="ow-mini"><div class="ow-mini-label">Kemarin</div><div class="ow-mini-val" style="font-size:15px">${fmtShort(omsetKemarin)}</div></div>
          </div>
        </div>
        <div>
          <div class="ow-mini-grid">
            <div class="ow-mini"><div class="ow-mini-label">Transaksi</div><div class="ow-mini-val">${trxBulan}</div></div>
            <div class="ow-mini"><div class="ow-mini-label">Qty Terjual</div><div class="ow-mini-val">${qtyBulan} pcs</div></div>
          </div>
        </div>
        <div>
          <div class="ow-mini-grid">
            <div class="ow-mini"><div class="ow-mini-label">Avg/Trx</div><div class="ow-mini-val" style="font-size:15px">${fmtShort(avgPerTrx)}</div></div>
            <div class="ow-mini"><div class="ow-mini-label">Proyeksi Akhir Bln</div><div class="ow-mini-val" style="font-size:15px;color:var(--sage)">${fmtShort(proyeksi)}</div></div>
          </div>
        </div>
      </div>
    </div>
  </div>`);
}

// Override section renderers (tidak dipakai oleh dashboard baru)
function _renderSectionKondisiStok(){}
function _renderSectionKeuangan(){}
function _renderSectionTarget(){}
function _renderSectionPenjualan(){}
function _renderSectionAlert(){}
