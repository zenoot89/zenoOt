// ================================================================
// DAILY CHECKLIST MODULE — zenOt Operasional
// ================================================================
(function() {

// ── Helpers ──
const DC = {
  todayKey: () => {
    const d = new Date();
    return `dc_${d.getFullYear()}_${String(d.getMonth()+1).padStart(2,'0')}_${String(d.getDate()).padStart(2,'0')}`;
  },
  fmtRp: n => 'Rp ' + Number(n||0).toLocaleString('id-ID'),
  fmtNum: n => Number(n||0).toLocaleString('id-ID'),
  greeting: () => {
    const h = new Date().getHours();
    if (h < 5)  return { text:'🌙 Selamat Malam', sub:'Masih begadang, bos?' };
    if (h < 10) return { text:'🌅 Selamat Pagi', sub:'Yuk mulai hari yang produktif!' };
    if (h < 15) return { text:'☀️ Selamat Siang', sub:'Semangat terus!' };
    if (h < 18) return { text:'🌤️ Selamat Sore', sub:'Cek progress hari ini yuk.' };
    return { text:'🌙 Selamat Malam', sub:'Review hari ini sebelum istirahat.' };
  },
  dayName: () => {
    const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    const d = new Date();
    return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  },
};

// ── Default checklist items ──
const DC_CHECKLIST_DEFAULTS = {
  operasional: [
    { id:'op1', label:'Cek pesanan masuk & konfirmasi', icon:'📥' },
    { id:'op2', label:'Proses packing pesanan hari ini', icon:'📦' },
    { id:'op3', label:'Input stok masuk / produksi baru', icon:'🏭' },
    { id:'op4', label:'Cek & update stok di Shopee', icon:'🔄' },
    { id:'op5', label:'Kirim pesanan / serahkan ke kurir', icon:'🚚' },
    { id:'op6', label:'Balas pertanyaan pembeli', icon:'💬' },
  ],
  marketing: [
    { id:'mk1', label:'Upload foto produk / konten hari ini', icon:'📸' },
    { id:'mk2', label:'Cek performa iklan (ROAS, spend)', icon:'📣' },
    { id:'mk3', label:'Update harga / voucher promo', icon:'🏷️' },
    { id:'mk4', label:'Cek competitor & benchmark harga', icon:'🔍' },
    { id:'mk5', label:'Balas ulasan pembeli', icon:'⭐' },
    { id:'mk6', label:'Post di sosmed / WA broadcast', icon:'📱' },
  ],
};

// ── Load & Save data harian ──
function dcLoad() {
  try {
    const raw = localStorage.getItem(DC.todayKey());
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return {
    targetOmset: 0,
    targetUnit: 0,
    catatanHarian: '',
    checks: {},          // { id: true/false }
    keuangan: [],        // [{ id, waktu, label, nominal, tipe:'masuk'|'keluar' }]
  };
}

function dcSave(data) {
  try {
    localStorage.setItem(DC.todayKey(), JSON.stringify(data));
  } catch(e) {}
}

function dcGetData() { return dcLoad(); }

// ── Auto-pull dari DB ──
function dcPullFromDB() {
  const result = {
    omsetHariIni: 0,
    unitTerjual: 0,
    stokKritis: [],
    stokHabis: [],
    totalSKU: 0,
    jurnalCount: 0,
  };
  if (typeof DB === 'undefined') return result;

  // Jurnal hari ini
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const jToday = DB.jurnal.filter(j => j.tgl && j.tgl.startsWith(todayStr));
  result.omsetHariIni = jToday.reduce((s,j) => s + (j.harga * j.qty), 0);
  result.unitTerjual  = jToday.reduce((s,j) => s + j.qty, 0);
  result.jurnalCount  = jToday.length;

  // Stok kritis & habis
  if (DB.stok && DB.stok.length > 0) {
    result.totalSKU = DB.stok.length;
    DB.stok.forEach(s => {
      const akhir = typeof getAkhir === 'function' ? getAkhir(s) : (s.masuk - s.keluar);
      if (akhir <= 0) result.stokHabis.push(s.var || s.induk || '-');
      else if (akhir <= (s.safety || 4)) result.stokKritis.push({ sku: s.var || s.induk || '-', qty: akhir });
    });
  }
  return result;
}

// ── Render Progress Bar ──
function dcProgressBar(val, max, color='var(--brown)') {
  const pct = max > 0 ? Math.min(100, Math.round((val/max)*100)) : 0;
  return `
    <div style="background:#e8e0d5;border-radius:20px;height:10px;margin-top:6px;overflow:hidden;">
      <div style="height:10px;border-radius:20px;background:${color};width:${pct}%;transition:width .5s;"></div>
    </div>
    <div style="font-size:11px;color:var(--dusty);margin-top:4px;text-align:right;">${pct}%</div>
  `;
}

// ── Render Checklist Item ──
function dcCheckItem(item, checked, section) {
  const cls = checked ? 'dc-check-done' : 'dc-check-todo';
  return `
    <div class="dc-check-item ${cls}" onclick="dcToggleCheck('${item.id}','${section}')">
      <div class="dc-check-box">${checked ? '✅' : '⬜'}</div>
      <div class="dc-check-label">${item.icon} ${item.label}</div>
    </div>
  `;
}

// ── Render Keuangan Rows ──
function dcRenderKeuRows(keuangan) {
  if (!keuangan || keuangan.length === 0) {
    return `<div style="text-align:center;color:var(--dusty);font-size:12px;padding:12px 0;">Belum ada catatan hari ini</div>`;
  }
  return keuangan.map(k => `
    <div class="dc-keu-row dc-keu-${k.tipe}">
      <div>
        <div style="font-size:13px;font-weight:600;">${k.label}</div>
        <div style="font-size:11px;color:var(--dusty);">${k.waktu}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="font-size:14px;font-weight:700;color:${k.tipe==='masuk'?'var(--sage)':'var(--rust)'};">
          ${k.tipe==='masuk'?'+':'-'}${DC.fmtRp(k.nominal)}
        </div>
        <button onclick="dcHapusKeu('${k.id}')" style="background:none;border:none;cursor:pointer;color:var(--dusty);font-size:14px;padding:2px 4px;">✕</button>
      </div>
    </div>
  `).join('');
}

// ── Main Render ──
function renderDailyChecklist() {
  const el = document.getElementById('page-daily');
  if (!el) return;

  const data   = dcLoad();
  const db     = dcPullFromDB();
  const greet  = DC.greeting();
  const checks = data.checks || {};

  // Hitung checklist progress
  const allOps = DC_CHECKLIST_DEFAULTS.operasional;
  const allMkt = DC_CHECKLIST_DEFAULTS.marketing;
  const doneOps = allOps.filter(i => checks[i.id]).length;
  const doneMkt = allMkt.filter(i => checks[i.id]).length;
  const totalDone = doneOps + doneMkt;
  const totalAll  = allOps.length + allMkt.length;
  const overallPct = totalAll > 0 ? Math.round((totalDone/totalAll)*100) : 0;

  // Keuangan summary
  const keu = data.keuangan || [];
  const totalMasuk  = keu.filter(k=>k.tipe==='masuk').reduce((s,k)=>s+k.nominal,0);
  const totalKeluar = keu.filter(k=>k.tipe==='keluar').reduce((s,k)=>s+k.nominal,0);
  const netKeu = totalMasuk - totalKeluar;

  // Target progress
  const omsetTarget = data.targetOmset || 0;
  const unitTarget  = data.targetUnit  || 0;

  el.innerHTML = `
  <!-- ══ STYLES ══ -->
  <style>
    /* Briefing Header */
    .dc-briefing {
      background: linear-gradient(135deg, var(--brown), #3d2419);
      border-radius: 16px; padding: 22px 24px; margin-bottom: 20px;
      color: white; display: flex; justify-content: space-between; align-items: center;
    }
    .dc-briefing-left h2 { font-family:'DM Serif Display',serif; font-size: 24px; margin-bottom: 4px; }
    .dc-briefing-left p  { font-size: 13px; opacity: .75; margin-bottom: 10px; }
    .dc-briefing-right   { text-align: right; }
    .dc-briefing-pct     { font-size: 40px; font-weight: 900; font-family:'DM Mono',monospace; }
    .dc-briefing-pct-sub { font-size: 11px; opacity: .7; }
    .dc-badge {
      display: inline-flex; align-items: center; gap: 5px;
      background: rgba(255,255,255,.15); border-radius: 20px;
      padding: 4px 10px; font-size: 11px;
    }
    /* Section Title */
    .dc-section-title {
      font-size: 11px; font-weight: 700; color: var(--dusty);
      text-transform: uppercase; letter-spacing: 1.2px;
      margin: 18px 0 10px; display: flex; align-items: center; gap: 6px;
    }
    /* Stat Grid */
    .dc-stat-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 16px; }
    @media(max-width:900px) { .dc-stat-grid { grid-template-columns: repeat(2,1fr); } }
    @media(max-width:480px) { .dc-stat-grid { grid-template-columns: 1fr 1fr; } }
    .dc-stat-card {
      background: var(--card); border: 1px solid var(--border); border-radius: 12px;
      padding: 14px; position: relative; overflow: hidden;
    }
    .dc-stat-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; }
    .dc-stat-c1::before { background: var(--brown); }
    .dc-stat-c2::before { background: var(--sage); }
    .dc-stat-c3::before { background: var(--gold); }
    .dc-stat-c4::before { background: var(--rust); }
    .dc-stat-label { font-size: 10px; color: var(--dusty); text-transform: uppercase; letter-spacing: .8px; margin-bottom: 6px; }
    .dc-stat-val   { font-size: 20px; font-weight: 800; font-family:'DM Mono',monospace; }
    .dc-stat-sub   { font-size: 11px; color: var(--dusty); margin-top: 4px; }
    /* Target Input Row */
    .dc-target-row {
      display: flex; gap: 10px; margin-bottom: 14px; align-items: flex-end;
    }
    .dc-target-box {
      flex: 1; background: var(--card); border: 1px solid var(--border);
      border-radius: 12px; padding: 12px 14px;
    }
    .dc-target-box label { font-size: 11px; color: var(--dusty); display: block; margin-bottom: 6px; font-weight: 600; }
    .dc-input {
      width: 100%; border: 1px solid var(--border); border-radius: 8px;
      padding: 7px 10px; font-size: 13px; font-family: 'Outfit', sans-serif;
      background: var(--bg); color: var(--charcoal); box-sizing: border-box;
    }
    .dc-input:focus { outline: none; border-color: var(--brown); }
    /* 2-col layout */
    .dc-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    @media(max-width:768px) { .dc-2col { grid-template-columns: 1fr; } }
    /* Checklist */
    .dc-checklist-wrap { display: flex; flex-direction: column; gap: 8px; }
    .dc-check-item {
      display: flex; align-items: center; gap: 10px; padding: 10px 12px;
      border-radius: 10px; cursor: pointer; transition: all .15s;
      border: 1px solid var(--border); background: var(--card);
    }
    .dc-check-item:hover { border-color: var(--brown); background: #fdf8f3; }
    .dc-check-done { opacity: .55; }
    .dc-check-done .dc-check-label { text-decoration: line-through; color: var(--dusty); }
    .dc-check-box   { font-size: 16px; flex-shrink: 0; }
    .dc-check-label { font-size: 13px; }
    /* Progress checklist bar */
    .dc-check-progress {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 10px; font-size: 12px; color: var(--dusty);
    }
    /* Keuangan */
    .dc-keu-wrap  { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .dc-keu-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 10px 12px; border-radius: 10px; border: 1px solid;
    }
    .dc-keu-masuk  { background: #EFF7F320; border-color: #5A7A6A30; }
    .dc-keu-keluar { background: #FFF0EE20; border-color: #C0392B30; }
    .dc-keu-input-row {
      display: grid; grid-template-columns: 1fr 100px 90px 36px; gap: 8px; align-items: end; margin-top: 10px;
    }
    @media(max-width:600px) {
      .dc-keu-input-row { grid-template-columns: 1fr 1fr; }
    }
    .dc-btn {
      padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer;
      font-size: 12px; font-weight: 600; font-family: 'Outfit', sans-serif;
      transition: all .15s;
    }
    .dc-btn-primary { background: var(--brown); color: white; }
    .dc-btn-primary:hover { background: #4a3025; }
    .dc-btn-icon {
      width: 36px; height: 36px; border-radius: 8px; border: 1px solid var(--border);
      background: var(--card); cursor: pointer; font-size: 16px; display: flex;
      align-items: center; justify-content: center;
    }
    /* Stok alert */
    .dc-stok-habis-chip {
      display: inline-block; background: #FEE2E2; color: #991B1B;
      border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 700;
      margin: 2px; font-family: 'DM Mono', monospace;
    }
    .dc-stok-kritis-chip {
      display: inline-block; background: #FEF3C7; color: #92400E;
      border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 700;
      margin: 2px; font-family: 'DM Mono', monospace;
    }
    .dc-chip-wrap {
      display: flex; flex-wrap: wrap; gap: 4px;
      overflow: hidden; max-width: 100%;
    }
    /* Keuangan summary bar */
    .dc-keu-summary {
      display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 14px;
    }
    @media(max-width:480px) { .dc-keu-summary { grid-template-columns: 1fr; } }
    .dc-keu-sum-box {
      border-radius: 10px; padding: 10px 12px; text-align: center;
    }
    .dc-keu-sum-label { font-size: 10px; color: var(--dusty); text-transform: uppercase; letter-spacing: .8px; margin-bottom: 4px; }
    .dc-keu-sum-val   { font-size: 16px; font-weight: 800; font-family: 'DM Mono', monospace; }
    /* Catatan */
    .dc-catatan { width: 100%; border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; font-size: 13px; font-family: 'Outfit', sans-serif; background: var(--bg); color: var(--charcoal); resize: vertical; min-height: 80px; box-sizing: border-box; }
    .dc-catatan:focus { outline: none; border-color: var(--brown); }
    /* Select tipe */
    .dc-select { padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; font-size: 12px; font-family: 'Outfit', sans-serif; background: var(--bg); color: var(--charcoal); }
    .dc-select:focus { outline: none; }
  </style>

  <!-- ══ BRIEFING HEADER ══ -->
  <div class="dc-briefing">
    <div class="dc-briefing-left">
      <h2>${greet.text}</h2>
      <p>${DC.dayName()}</p>
      <div class="dc-badge">✅ ${totalDone}/${totalAll} task selesai</div>
    </div>
    <div class="dc-briefing-right">
      <div class="dc-briefing-pct">${overallPct}%</div>
      <div class="dc-briefing-pct-sub">Daily Progress</div>
    </div>
  </div>

  <!-- ══ SECTION: TARGET & PROGRESS ══ -->
  <div class="dc-section-title">🎯 Target & Progress Hari Ini</div>

  <!-- Target Input -->
  <div class="dc-target-row">
    <div class="dc-target-box">
      <label>🎯 Target Omset (Rp)</label>
      <input class="dc-input" type="number" id="dc-target-omset" placeholder="0"
        value="${data.targetOmset||''}"
        onchange="dcSaveTarget()" oninput="dcSaveTarget()">
    </div>
    <div class="dc-target-box">
      <label>📦 Target Unit Terjual</label>
      <input class="dc-input" type="number" id="dc-target-unit" placeholder="0"
        value="${data.targetUnit||''}"
        onchange="dcSaveTarget()" oninput="dcSaveTarget()">
    </div>
  </div>

  <!-- Stats Grid -->
  <div class="dc-stat-grid">
    <div class="dc-stat-card dc-stat-c1">
      <div class="dc-stat-label">Omset Hari Ini</div>
      <div class="dc-stat-val" style="font-size:16px;">${DC.fmtRp(db.omsetHariIni)}</div>
      <div class="dc-stat-sub">dari ${DC.fmtRp(omsetTarget)} target</div>
      ${dcProgressBar(db.omsetHariIni, omsetTarget, 'var(--brown)')}
    </div>
    <div class="dc-stat-card dc-stat-c2">
      <div class="dc-stat-label">Unit Terjual</div>
      <div class="dc-stat-val">${DC.fmtNum(db.unitTerjual)}</div>
      <div class="dc-stat-sub">dari ${DC.fmtNum(unitTarget)} target</div>
      ${dcProgressBar(db.unitTerjual, unitTarget, 'var(--sage)')}
    </div>
    <div class="dc-stat-card dc-stat-c3">
      <div class="dc-stat-label">Transaksi</div>
      <div class="dc-stat-val">${DC.fmtNum(db.jurnalCount)}</div>
      <div class="dc-stat-sub">pesanan hari ini</div>
    </div>
    <div class="dc-stat-card dc-stat-c4">
      <div class="dc-stat-label">Kas Bersih Hari Ini</div>
      <div class="dc-stat-val" style="font-size:15px;color:${netKeu>=0?'var(--sage)':'var(--rust)'};">${netKeu>=0?'+':''}${DC.fmtRp(netKeu)}</div>
      <div class="dc-stat-sub">${keu.length} catatan</div>
    </div>
  </div>

  <!-- ══ 2-COL: OPERASIONAL + MARKETING ══ -->
  <div class="dc-2col">

    <!-- OPERASIONAL -->
    <div class="intel-card">
      <div class="intel-card-title">📦 Operasional Harian</div>
      <div class="dc-check-progress">
        <span>${doneOps}/${allOps.length} selesai</span>
        <span style="font-weight:700;color:${doneOps===allOps.length?'var(--sage)':'var(--dusty)'};">${allOps.length>0?Math.round((doneOps/allOps.length)*100):0}%</span>
      </div>
      <div style="background:#e8e0d5;border-radius:20px;height:6px;margin-bottom:14px;overflow:hidden;">
        <div style="height:6px;border-radius:20px;background:var(--sage);width:${allOps.length>0?Math.round((doneOps/allOps.length)*100):0}%;transition:width .4s;"></div>
      </div>
      <div class="dc-checklist-wrap">
        ${allOps.map(i => dcCheckItem(i, !!checks[i.id], 'op')).join('')}
      </div>
    </div>

    <!-- MARKETING -->
    <div class="intel-card">
      <div class="intel-card-title">📣 Marketing Harian</div>
      <div class="dc-check-progress">
        <span>${doneMkt}/${allMkt.length} selesai</span>
        <span style="font-weight:700;color:${doneMkt===allMkt.length?'var(--sage)':'var(--dusty)'};">${allMkt.length>0?Math.round((doneMkt/allMkt.length)*100):0}%</span>
      </div>
      <div style="background:#e8e0d5;border-radius:20px;height:6px;margin-bottom:14px;overflow:hidden;">
        <div style="height:6px;border-radius:20px;background:var(--gold);width:${allMkt.length>0?Math.round((doneMkt/allMkt.length)*100):0}%;transition:width .4s;"></div>
      </div>
      <div class="dc-checklist-wrap">
        ${allMkt.map(i => dcCheckItem(i, !!checks[i.id], 'mk')).join('')}
      </div>
    </div>
  </div>

  <!-- ══ STOK ALERT ══ -->
  ${(db.stokHabis.length > 0 || db.stokKritis.length > 0) ? `
  <div class="dc-section-title">🚨 Alert Stok</div>
  <div class="intel-card" style="margin-bottom:16px;">
    ${db.stokHabis.length > 0 ? `
      <div style="margin-bottom:10px;">
        <div style="font-size:12px;font-weight:700;color:var(--rust);margin-bottom:6px;">❌ Stok Habis (${db.stokHabis.length} SKU)</div>
        <div class="dc-chip-wrap">${db.stokHabis.map(s=>`<span class="dc-stok-habis-chip">${s}</span>`).join('')}</div>
      </div>
    `:''}
    ${db.stokKritis.length > 0 ? `
      <div>
        <div style="font-size:12px;font-weight:700;color:#92400E;margin-bottom:6px;">⚠️ Stok Kritis (${db.stokKritis.length} SKU)</div>
        <div class="dc-chip-wrap">${db.stokKritis.map(s=>`<span class="dc-stok-kritis-chip">${s.sku} (${s.qty})</span>`).join('')}</div>
      </div>
    `:''}
  </div>
  ` : ''}

  <!-- ══ KEUANGAN HARIAN ══ -->
  <div class="dc-section-title">💰 Catatan Keuangan Harian</div>
  <div class="intel-card">
    <!-- Summary -->
    <div class="dc-keu-summary">
      <div class="dc-keu-sum-box" style="background:#EFF7F3;border:1px solid #5A7A6A30;">
        <div class="dc-keu-sum-label">Total Masuk</div>
        <div class="dc-keu-sum-val" style="color:var(--sage);">+${DC.fmtRp(totalMasuk)}</div>
      </div>
      <div class="dc-keu-sum-box" style="background:#FFF0EE;border:1px solid #C0392B30;">
        <div class="dc-keu-sum-label">Total Keluar</div>
        <div class="dc-keu-sum-val" style="color:var(--rust);">-${DC.fmtRp(totalKeluar)}</div>
      </div>
      <div class="dc-keu-sum-box" style="background:${netKeu>=0?'#EFF7F3':'#FFF0EE'};border:1px solid ${netKeu>=0?'#5A7A6A30':'#C0392B30'};">
        <div class="dc-keu-sum-label">Net Cash</div>
        <div class="dc-keu-sum-val" style="color:${netKeu>=0?'var(--sage)':'var(--rust)'};">${netKeu>=0?'+':''}${DC.fmtRp(netKeu)}</div>
      </div>
    </div>

    <!-- List -->
    <div class="dc-keu-wrap" id="dc-keu-list">
      ${dcRenderKeuRows(keu)}
    </div>

    <!-- Input tambah -->
    <div class="dc-keu-input-row">
      <div>
        <label style="font-size:11px;color:var(--dusty);display:block;margin-bottom:4px;">Keterangan</label>
        <input class="dc-input" id="dc-keu-label" placeholder="e.g. Beli bahan baku, Hasil COD...">
      </div>
      <div>
        <label style="font-size:11px;color:var(--dusty);display:block;margin-bottom:4px;">Nominal (Rp)</label>
        <input class="dc-input" id="dc-keu-nominal" type="number" placeholder="0">
      </div>
      <div>
        <label style="font-size:11px;color:var(--dusty);display:block;margin-bottom:4px;">Tipe</label>
        <select class="dc-select" id="dc-keu-tipe">
          <option value="masuk">💚 Masuk</option>
          <option value="keluar">🔴 Keluar</option>
        </select>
      </div>
      <div style="padding-top:18px;">
        <button class="dc-btn dc-btn-primary" onclick="dcTambahKeu()" title="Tambah">+</button>
      </div>
    </div>
  </div>

  <!-- ══ CATATAN HARIAN ══ -->
  <div class="dc-section-title">📝 Catatan Harian</div>
  <div class="intel-card">
    <textarea class="dc-catatan" id="dc-catatan-input" placeholder="Tulis catatan, kendala, atau rencana besok..."
      onchange="dcSaveCatatan()" oninput="dcSaveCatatan()">${data.catatanHarian||''}</textarea>
    <div style="font-size:11px;color:var(--dusty);margin-top:6px;text-align:right;">Auto-save aktif ✓</div>
  </div>
  `;
}

// ── Toggle Checklist ──
function dcToggleCheck(id) {
  const data = dcLoad();
  data.checks = data.checks || {};
  data.checks[id] = !data.checks[id];
  dcSave(data);
  renderDailyChecklist();
}

// ── Save Target ──
function dcSaveTarget() {
  const data = dcLoad();
  const omsetEl = document.getElementById('dc-target-omset');
  const unitEl  = document.getElementById('dc-target-unit');
  if (omsetEl) data.targetOmset = parseFloat(omsetEl.value) || 0;
  if (unitEl)  data.targetUnit  = parseFloat(unitEl.value)  || 0;
  dcSave(data);
  // Refresh stats only (tidak full re-render supaya tidak hilang focus)
  _dcRefreshStats(data);
}

function _dcRefreshStats(data) {
  // Partial refresh — hanya stat cards
  const db = dcPullFromDB();
  const keu = data.keuangan || [];
  const totalMasuk  = keu.filter(k=>k.tipe==='masuk').reduce((s,k)=>s+k.nominal,0);
  const totalKeluar = keu.filter(k=>k.tipe==='keluar').reduce((s,k)=>s+k.nominal,0);
  const netKeu = totalMasuk - totalKeluar;
  // update omset card
  const omsetCard = document.querySelector('.dc-stat-c1 .dc-stat-sub');
  if (omsetCard) omsetCard.textContent = `dari ${DC.fmtRp(data.targetOmset||0)} target`;
  const unitCard = document.querySelector('.dc-stat-c2 .dc-stat-sub');
  if (unitCard) unitCard.textContent = `dari ${DC.fmtNum(data.targetUnit||0)} target`;
}

// ── Save Catatan ──
function dcSaveCatatan() {
  const data = dcLoad();
  const el = document.getElementById('dc-catatan-input');
  if (el) data.catatanHarian = el.value;
  dcSave(data);
}

// ── Tambah Keuangan ──
function dcTambahKeu() {
  const labelEl   = document.getElementById('dc-keu-label');
  const nominalEl = document.getElementById('dc-keu-nominal');
  const tipeEl    = document.getElementById('dc-keu-tipe');
  if (!labelEl || !nominalEl || !tipeEl) return;

  const label   = labelEl.value.trim();
  const nominal = parseFloat(nominalEl.value) || 0;
  const tipe    = tipeEl.value;

  if (!label) { if(typeof toast==='function') toast('Isi keterangan dulu!','err'); return; }
  if (nominal <= 0) { if(typeof toast==='function') toast('Nominal harus > 0!','err'); return; }

  const data = dcLoad();
  data.keuangan = data.keuangan || [];
  const now = new Date();
  data.keuangan.push({
    id: 'keu_' + Date.now(),
    waktu: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`,
    label, nominal, tipe,
  });
  dcSave(data);

  labelEl.value = '';
  nominalEl.value = '';

  // Refresh keuangan section only
  _dcRefreshKeu(data);
  if(typeof toast==='function') toast(`✅ Catatan ${tipe} ditambahkan`);
}

// ── Hapus Keuangan ──
function dcHapusKeu(id) {
  const data = dcLoad();
  data.keuangan = (data.keuangan || []).filter(k => k.id !== id);
  dcSave(data);
  _dcRefreshKeu(data);
}

function _dcRefreshKeu(data) {
  const keu = data.keuangan || [];
  const listEl = document.getElementById('dc-keu-list');
  if (listEl) listEl.innerHTML = dcRenderKeuRows(keu);

  // Update summary
  const totalMasuk  = keu.filter(k=>k.tipe==='masuk').reduce((s,k)=>s+k.nominal,0);
  const totalKeluar = keu.filter(k=>k.tipe==='keluar').reduce((s,k)=>s+k.nominal,0);
  const netKeu = totalMasuk - totalKeluar;

  const boxes = document.querySelectorAll('.dc-keu-sum-val');
  if (boxes[0]) boxes[0].textContent = '+' + DC.fmtRp(totalMasuk);
  if (boxes[1]) boxes[1].textContent = '-' + DC.fmtRp(totalKeluar);
  if (boxes[2]) {
    boxes[2].textContent = (netKeu>=0?'+':'') + DC.fmtRp(netKeu);
    boxes[2].style.color = netKeu >= 0 ? 'var(--sage)' : 'var(--rust)';
  }

  // Update stat card ke-4
  const statKas = document.querySelector('.dc-stat-c4 .dc-stat-val');
  if (statKas) {
    statKas.textContent = (netKeu>=0?'+':'') + DC.fmtRp(netKeu);
    statKas.style.color = netKeu >= 0 ? 'var(--sage)' : 'var(--rust)';
  }
  const statKasSub = document.querySelector('.dc-stat-c4 .dc-stat-sub');
  if (statKasSub) statKasSub.textContent = `${keu.length} catatan`;
}

// ── Expose globals ──
window.renderDailyChecklist = renderDailyChecklist;
window.dcToggleCheck        = dcToggleCheck;
window.dcSaveTarget         = dcSaveTarget;
window.dcSaveCatatan        = dcSaveCatatan;
window.dcTambahKeu          = dcTambahKeu;
window.dcHapusKeu           = dcHapusKeu;

// Auto-render jika page-daily sudah aktif saat script ini load
const _dcEl = document.getElementById('page-daily');
if (_dcEl && _dcEl.classList.contains('active')) renderDailyChecklist();

})(); // end IIFE
