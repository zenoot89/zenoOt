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
const getTodayStr    = () => new Date().toISOString().slice(0,10);
const getKemarinStr  = () => { const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); };
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
.ow-wrap{display:flex;flex-direction:column;gap:16px;padding-bottom:32px;}
.ow-kpi-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(175px,1fr));gap:12px;}
.ow-kpi{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px 18px 14px;position:relative;overflow:hidden;}
.ow-kpi-accent{position:absolute;top:0;left:0;width:4px;height:100%;border-radius:14px 0 0 14px;}
.ow-kpi-label{font-size:10px;text-transform:uppercase;letter-spacing:1.3px;color:var(--dusty);font-weight:700;margin-bottom:6px;}
.ow-kpi-val{font-size:21px;font-weight:700;color:var(--charcoal);line-height:1.1;}
.ow-kpi-sub{font-size:11px;color:var(--dusty);margin-top:7px;display:flex;align-items:center;gap:5px;flex-wrap:wrap;}
.ow-delta{font-size:11px;font-weight:700;padding:2px 7px;border-radius:20px;}
.ow-up{background:#EFF7F3;color:#2D6A4F;}
.ow-dn{background:#FFF0EE;color:#9B2335;}
.ow-flat{background:var(--cream);color:var(--dusty);}
.ow-sec-hd{display:flex;align-items:baseline;justify-content:space-between;margin-bottom:8px;}
.ow-sec-title{font-size:13px;text-transform:uppercase;letter-spacing:1px;font-weight:700;color:var(--charcoal);}
.ow-sec-note{font-size:11px;color:var(--dusty);opacity:.65;}
.ow-row2{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
.ow-row3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;}
@media(max-width:900px){.ow-row2,.ow-row3{grid-template-columns:1fr;}}
.ow-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:18px;}
.ow-card-title{font-size:13px;font-weight:700;color:var(--charcoal);margin-bottom:14px;}
.ow-card-badge{font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;}
.ow-badge-red{background:#FFF0EE;color:#9B2335;}
.ow-badge-amber{background:#FFFBF0;color:#92400E;}
.ow-badge-green{background:#EFF7F3;color:#2D6A4F;}
.ow-badge-gray{background:var(--cream);color:var(--dusty);}
.ow-badge-blue{background:#EFF5FD;color:#1A5EB8;}
.ow-pbar-wrap{width:100%;height:5px;background:var(--border);border-radius:99px;overflow:hidden;margin:6px 0 2px;}
.ow-pbar-fill{height:100%;border-radius:99px;transition:width .5s;}
.ow-stok-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;}
.ow-stok-row:last-child{border-bottom:none;}
.ow-stok-sku{font-weight:600;color:var(--charcoal);font-family:'DM Mono',monospace;font-size:12px;flex:1;}
.ow-stok-right{display:flex;align-items:center;gap:10px;}
.ow-stok-num{font-weight:700;font-family:'DM Mono',monospace;font-size:14px;}
.stok-red{color:#C0392B;} .stok-amber{color:#D97706;} .stok-green{color:#2D6A4F;}
.ow-stok-meta{font-size:11px;color:var(--dusty);}
.ow-empty{padding:20px;text-align:center;font-size:13px;color:var(--dusty);background:var(--cream);border-radius:10px;}
.ow-ch-row{display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);}
.ow-ch-row:last-child{border-bottom:none;}
.ow-ch-name{font-size:12px;font-weight:700;color:var(--charcoal);min-width:105px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.ow-ch-bar{flex:1;height:7px;background:var(--cream);border-radius:99px;overflow:hidden;}
.ow-ch-fill{height:100%;background:var(--brown);border-radius:99px;}
.ow-ch-val{font-size:12px;font-weight:700;color:var(--charcoal);min-width:65px;text-align:right;}
.ow-sku-row{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);}
.ow-sku-row:last-child{border-bottom:none;}
.ow-sku-rank{font-size:11px;font-weight:700;color:var(--dusty);width:18px;text-align:center;}
.ow-sku-name{flex:1;font-size:12px;font-weight:600;font-family:'DM Mono',monospace;color:var(--charcoal);}
.ow-sku-bar{width:70px;height:4px;background:var(--border);border-radius:99px;overflow:hidden;}
.ow-sku-bfill{height:100%;background:var(--gold);border-radius:99px;}
.ow-sku-qty{font-size:13px;font-weight:700;color:var(--brown);min-width:38px;text-align:right;}
.ow-sup-row{display:grid;grid-template-columns:100px 1fr 70px 45px 45px;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);font-size:12px;}
.ow-sup-row:last-child{border-bottom:none;}
.ow-sup-name{font-weight:700;color:var(--charcoal);}
.ow-sup-bar{height:5px;background:var(--cream);border-radius:99px;overflow:hidden;}
.ow-sup-fill{height:100%;background:var(--sage);border-radius:99px;}
.ow-alerts{display:flex;flex-direction:column;gap:8px;}
.ow-alert{display:flex;align-items:flex-start;gap:10px;padding:11px 14px;border-radius:10px;font-size:13px;}
.ow-alert-icon{font-size:15px;flex-shrink:0;margin-top:1px;}
.ow-alert-title{font-weight:700;color:var(--charcoal);margin-bottom:2px;}
.ow-alert-sub{color:var(--dusty);font-size:12px;}
.ow-alert.red{background:#FFF0EE;border:1px solid rgba(192,57,43,.2);}
.ow-alert.amber{background:#FFFBF0;border:1px solid rgba(214,158,46,.25);}
.ow-alert.green{background:#EFF7F3;border:1px solid rgba(45,106,79,.2);}
.ow-alert.blue{background:#EFF5FD;border:1px solid rgba(26,94,184,.15);}
.ow-alert.gray{background:var(--cream);border:1px solid var(--border);}
.ow-mini-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
.ow-mini{background:var(--cream);border-radius:10px;padding:12px;text-align:center;}
.ow-mini-label{font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--dusty);font-weight:700;margin-bottom:4px;}
.ow-mini-val{font-size:18px;font-weight:700;color:var(--charcoal);}
.ow-trend-bars{display:flex;align-items:flex-end;gap:5px;height:80px;margin-bottom:6px;}
.ow-tbar-wrap{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;}
.ow-tbar{width:100%;border-radius:4px 4px 0 0;min-height:3px;background:var(--gold);opacity:.6;}
.ow-tbar.today{opacity:1;background:var(--brown);}
.ow-tbar.zero{opacity:.15;background:var(--dusty);}
.ow-tbar-label{font-size:10px;color:var(--dusty);font-weight:600;}
.ow-restock-item{display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border);}
.ow-restock-item:last-child{border-bottom:none;}
.ow-restock-sku{flex:1;font-size:12px;font-family:'DM Mono',monospace;font-weight:600;color:var(--charcoal);}
.ow-restock-heat{font-size:11px;color:var(--dusty);}
.ow-restock-stok{font-size:13px;font-weight:700;min-width:50px;text-align:right;}
.stok-habis{color:#C0392B;} .stok-kritis{color:#D97706;}
  `;
  document.head.appendChild(st);
}

// ── Main render ──
function renderDashboard() {
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

  const omsetHari     = jHari.reduce((s,j)=>s+getHppProduk(j.var)*(j.qty||0),0);
  const omsetKemarin  = jKemarin.reduce((s,j)=>s+getHppProduk(j.var)*(j.qty||0),0);
  const omsetBulan    = jBulan.reduce((s,j)=>s+getHppProduk(j.var)*(j.qty||0),0);
  const omsetBulanLalu= jBulanLalu.reduce((s,j)=>s+getHppProduk(j.var)*(j.qty||0),0);
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
    chMap[j.ch].omset+=getHppProduk(j.var)*(j.qty||0);
    chMap[j.ch].qty+=(j.qty||0); chMap[j.ch].trx+=1;
  });
  jBulanLalu.forEach(j=>{
    if(!j.ch) return;
    if(!chMapLalu[j.ch]) chMapLalu[j.ch]={omset:0};
    chMapLalu[j.ch].omset+=getHppProduk(j.var)*(j.qty||0);
  });
  const channels = Object.entries(chMap).sort((a,b)=>b[1].omset-a[1].omset);
  const totalChOmset = channels.reduce((s,[,v])=>s+v.omset,0);

  const yr = new Date().getFullYear();
  const mo = String(new Date().getMonth()+1).padStart(2,'0');
  const bulanKey = `${yr}-${mo}`;

  // ── Baca targetOmset: prioritas dari Biaya Ops Global, fallback ke plan ──
  let targetOmset = 0;
  try {
    // 1. Sumber utama: Biaya Operasional Global (diset user di menu Biaya Operasional)
    const bgRaw = localStorage.getItem('zenot_biaya_ops_global');
    if (bgRaw) {
      const bg = JSON.parse(bgRaw);
      if (bg.biayaOpsGlobal > 0 && bg.rasioOpsGlobal > 0) {
        targetOmset = Math.round(bg.biayaOpsGlobal / (bg.rasioOpsGlobal / 100));
      }
    }
    // 2. Fallback: plan 'global' key baru (zenot_plan_global_YYYY-MM)
    if (targetOmset === 0 && typeof PLAN !== 'undefined' && PLAN.loadSync) {
      const plan = PLAN.loadSync('global', bulanKey) || {};
      targetOmset = plan.targetOmset || 0;
    }
    // 3. Fallback: key lama (zenot_planning_YYYY_MM)
    if (targetOmset === 0) {
      const oldPlan = JSON.parse(localStorage.getItem(`zenot_planning_${yr}_${mo}`) || '{}');
      targetOmset = oldPlan.targetOmset || 0;
    }
  } catch(e) {}
  const pctOmset    = targetOmset>0 ? Math.min(100,Math.round(omsetBulan/targetOmset*100)) : 0;
  const daysLeft    = getDaysInMonth()-getDayOfMonth();
  const sisaTarget  = Math.max(0,targetOmset-omsetBulan);
  const perHariHarus= daysLeft>0&&sisaTarget>0 ? Math.round(sisaTarget/daysLeft) : 0;

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
    const ds=d.toISOString().slice(0,10);
    const label=d.toLocaleDateString('id-ID',{weekday:'short'});
    const val=jurnal.filter(j=>j.tgl===ds).reduce((s,j)=>s+getHppProduk(j.var)*(j.qty||0),0);
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
    <div class="ow-sec-hd"><span class="ow-sec-title">📊 Performa Utama</span></div>
    <div class="ow-kpi-strip">${kpis.map(k=>`
      <div class="ow-kpi">
        <div class="ow-kpi-accent" style="background:${k.accent}"></div>
        <div class="ow-kpi-label">${k.label}</div>
        <div class="ow-kpi-val">${k.val}</div>
        <div class="ow-kpi-sub">${k.sub}</div>
      </div>`).join('')}</div>
  </div>`);

  // ─── 3. TREN 7 HARI + TARGET ───
  const trendBars = trend7.map(t=>{
    const h = t.val===0 ? 3 : Math.round((t.val/trend7Max)*72)+8;
    const cls = t.ds===todayStr?'today':t.val===0?'zero':'';
    return `<div class="ow-tbar-wrap">
      <div class="ow-tbar ${cls}" style="height:${h}px;${t.ds===todayStr?'box-shadow:0 0 0 2px var(--gold);':''}"></div>
      <div class="ow-tbar-label">${t.label}${t.ds===todayStr?'*':''}</div>
    </div>`;
  }).join('');

  let targetCard = '';
  if(targetOmset>0){
    targetCard = `
      <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px;">
        <span style="font-weight:700">Omset vs Target</span>
        <span>${fmtShort(omsetBulan)} / ${fmtShort(targetOmset)}</span>
      </div>
      ${progressBar(pctOmset)}
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--dusty);margin-bottom:14px;">
        <span style="font-weight:700;color:${pctOmset>=70?'#2D6A4F':'#D97706'}">${pctOmset}% tercapai</span>
        <span>${daysLeft} hari tersisa</span>
      </div>
      <div class="ow-mini-grid">
        <div class="ow-mini"><div class="ow-mini-label">Sisa Target</div><div class="ow-mini-val" style="font-size:15px;color:${sisaTarget>0?'#C0392B':'#2D6A4F'}">${fmtShort(sisaTarget)}</div></div>
        <div class="ow-mini"><div class="ow-mini-label">Per Hari Perlu</div><div class="ow-mini-val" style="font-size:15px;color:#D97706">${perHariHarus>0?fmtShort(perHariHarus):'🎉 Done!'}</div></div>
      </div>`;
  } else {
    targetCard = `<div class="ow-empty">Target belum diset.<br><a href="#" onclick="try{go('planning-kpi',null)}catch(e){}" style="color:var(--brown);font-weight:700">→ Set Target Bulan Ini</a></div>`;
  }

  add(`<div class="ow-row2">
    <div>
      <div class="ow-sec-hd"><span class="ow-sec-title">📈 Tren 7 Hari Terakhir</span><span class="ow-sec-note">* hari ini</span></div>
      <div class="ow-card">
        <div class="ow-trend-bars">${trendBars}</div>
        <div style="font-size:11px;color:var(--dusty);margin-top:4px;">
          Tertinggi: <b>${fmtShort(Math.max(...trend7.map(t=>t.val)))}</b> · 
          Total 7 hari: <b>${fmtShort(trend7.reduce((s,t)=>s+t.val,0))}</b>
        </div>
      </div>
    </div>
    <div>
      <div class="ow-sec-hd"><span class="ow-sec-title">🎯 Target Bulanan</span></div>
      <div class="ow-card">${targetCard}</div>
    </div>
  </div>`);

  // ─── 4. STOK HABIS + WAJIB RESTOCK ───
  const stokHabisHtml = stokHabis.length===0
    ? `<div class="ow-empty">✅ Tidak ada stok habis</div>`
    : stokHabis.slice(0,5).map(r=>{
        const p=(DB.produk||[]).find(x=>(x.var||'').toUpperCase()===(r.var||'').toUpperCase());
        return `<div class="ow-stok-row">
          <span class="ow-stok-sku">${r.var}</span>
          <div class="ow-stok-right">
            <span class="ow-stok-meta">${(p&&p.suplaier)||'—'}</span>
            <span class="ow-stok-meta">terjual: ${soldMap[r.var]||0} pcs</span>
            <span class="ow-stok-num stok-red">HABIS</span>
          </div>
        </div>`;
      }).join('')+(stokHabis.length>5?`<div style="font-size:11px;color:var(--dusty);padding-top:6px">+${stokHabis.length-5} lainnya</div>`:'');

  const restockHtml = wajibRestock.length===0
    ? `<div class="ow-empty">✅ Tidak ada urgensi restock</div>`
    : wajibRestock.slice(0,5).map(r=>`
      <div class="ow-restock-item">
        <span style="font-size:13px">${r.akhir<=0?'🔴':'🟡'}</span>
        <span class="ow-restock-sku">${r.var}</span>
        <span class="ow-restock-heat">${r.bulanIni||0} bln ini</span>
        <span class="ow-restock-stok ${r.akhir<=0?'stok-habis':'stok-kritis'}">${r.akhir<=0?'HABIS':r.akhir+' pcs'}</span>
      </div>`).join('');

  add(`<div class="ow-row2" style="align-items:stretch;">
    <div style="display:flex;flex-direction:column;">
      <div class="ow-sec-hd">
        <span class="ow-sec-title">📦 Stok Habis</span>
        <span class="ow-card-badge ${stokHabis.length>0?'ow-badge-red':'ow-badge-green'}">${stokHabis.length} SKU</span>
      </div>
      <div class="ow-card" style="padding:14px 16px;flex:1;">${stokHabisHtml}</div>
    </div>
    <div style="display:flex;flex-direction:column;">
      <div class="ow-sec-hd">
        <span class="ow-sec-title">🔁 Prioritas Restock</span>
        <span class="ow-card-badge ow-badge-amber">${wajibRestock.length} SKU</span>
      </div>
      <div class="ow-card" style="padding:14px 16px;flex:1;">${restockHtml}</div>
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
          <span style="font-size:10px;color:var(--dusty);min-width:28px;text-align:right">${bw}%</span>
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

  add(`<div class="ow-row2" style="align-items:stretch;">
    <div style="display:flex;flex-direction:column;">
      <div class="ow-sec-hd"><span class="ow-sec-title" style="font-size:14px;letter-spacing:.5px;">🛍️ Channel Penjualan</span><span class="ow-sec-note">Bulan ini vs lalu</span></div>
      <div class="ow-card" style="padding:14px 16px;flex:1;">${chHtml}</div>
    </div>
    <div style="display:flex;flex-direction:column;">
      <div class="ow-sec-hd"><span class="ow-sec-title" style="font-size:14px;letter-spacing:.5px;">🏆 Top SKU Bulan Ini</span><span class="ow-sec-note">vs bulan lalu</span></div>
      <div class="ow-card" style="padding:14px 16px;flex:1;">${skuHtml}</div>
    </div>
  </div>`);

  // ─── 6. DEAD STOCK (jika ada) ───
  if(deadStock.length>0){
    add(`<div>
      <div class="ow-sec-hd">
        <span class="ow-sec-title">🧟 Dead Stock — Belum Pernah Terjual</span>
        <span class="ow-card-badge ow-badge-amber">${deadStock.length} SKU · ${fmtShort(deadStokNilai)} mengendap</span>
      </div>
      <div class="ow-card" style="padding:14px 16px">
        <div style="font-size:12px;color:var(--dusty);margin-bottom:10px;padding:10px 12px;background:var(--cream);border-radius:8px;">
          ⚠️ Produk-produk ini ada stok tapi <b>belum pernah terjual sama sekali</b>. Pertimbangkan: diskon clearance, bundling, atau retur ke supplier untuk jaga cashflow.
        </div>
        ${deadStock.slice(0,8).map(r=>`
          <div class="ow-stok-row">
            <span class="ow-stok-sku">${r.var}</span>
            <div class="ow-stok-right">
              <span class="ow-stok-meta">${fmtShort(getAkhir(r)*(r.hpp||0))} modal</span>
              <span class="ow-stok-num stok-amber">${getAkhir(r)} pcs</span>
            </div>
          </div>`).join('')}
        ${deadStock.length>8?`<div style="font-size:11px;color:var(--dusty);padding-top:8px">+${deadStock.length-8} SKU lainnya</div>`:''}
      </div>
    </div>`);
  }

  // ─── 7. SUPPLIER MAP ───
  add(`<div>
    <div class="ow-sec-hd"><span class="ow-sec-title">🏭 Stok per Supplier</span><span class="ow-sec-note">Nilai stok berdasarkan HPP</span></div>
    <div class="ow-card" style="padding:14px 16px">
      <div style="display:grid;grid-template-columns:100px 1fr 75px 45px 45px;gap:8px;padding:0 0 8px;border-bottom:1px solid var(--border);font-size:10px;font-weight:700;color:var(--dusty);text-transform:uppercase;letter-spacing:.8px;">
        <span>Supplier</span><span>Nilai Stok</span><span style="text-align:right">Nilai</span><span style="text-align:right">SKU</span><span style="text-align:right">Habis</span>
      </div>
      ${suppliers.map(([sup,v])=>`
        <div class="ow-sup-row">
          <span class="ow-sup-name">${sup}</span>
          <div class="ow-sup-bar"><div class="ow-sup-fill" style="width:${Math.round(v.nilai/supMax*100)}%"></div></div>
          <span style="text-align:right;font-weight:700;font-size:12px">${fmtShort(v.nilai)}</span>
          <span style="text-align:right;font-size:12px;color:var(--dusty)">${v.sku}</span>
          <span style="text-align:right;font-size:12px;font-weight:700;color:${v.habis>0?'#C0392B':'#2D6A4F'}">${v.habis}</span>
        </div>`).join('')}
    </div>
  </div>`);

  // ─── 8. RINGKASAN KEUANGAN DETAIL ───
  add(`<div>
    <div class="ow-sec-hd"><span class="ow-sec-title">💰 Ringkasan Keuangan</span></div>
    <div class="ow-card">
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
