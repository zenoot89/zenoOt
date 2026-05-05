// ================================================================
// PLANNING MODULE — zenOt Operasional — build 2026.05.03b
// Target & KPI Global + Operasional per Toko
// Storage: Supabase (tabel planning) + localStorage fallback
// ================================================================

(function() {

const PLAN = {
  keyBulan: () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  },
  bulanLabel: () => {
    const months = ['Januari','Februari','Maret','April','Mei','Juni',
                    'Juli','Agustus','September','Oktober','November','Desember'];
    const d = new Date();
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  },
  fmtRp: n => 'Rp ' + Number(n||0).toLocaleString('id-ID'),

  _h: () => ({
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer': 'return=representation'
  }),

  async _sbLoad(toko, bulan) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/planning?toko=eq.${encodeURIComponent(toko)}&bulan=eq.${bulan}&select=data`,
        { headers: PLAN._h() }
      );
      if (!res.ok) return null;
      const rows = await res.json();
      return rows[0]?.data || null;
    } catch(e) { return null; }
  },

  async _sbSave(toko, bulan, data) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/planning?on_conflict=toko,bulan`,
        {
          method: 'POST',
          headers: { ...PLAN._h(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify([{ toko, bulan, data, updated_at: new Date().toISOString() }])
        }
      );
      return res.ok;
    } catch(e) { return false; }
  },

  _lsKey: (toko, bulan) => `zenot_plan_${toko}_${bulan}`,
  _lsLoad(toko, bulan) {
    try { return JSON.parse(localStorage.getItem(PLAN._lsKey(toko, bulan))||'null'); } catch(e) { return null; }
  },
  _lsSave(toko, bulan, data) {
    try { localStorage.setItem(PLAN._lsKey(toko, bulan), JSON.stringify(data)); } catch(e) {}
  },

  async load(toko='global', bulan=null) {
    const b = bulan || PLAN.keyBulan();
    // 1. Supabase
    const sb = await PLAN._sbLoad(toko, b);
    if (sb) { PLAN._lsSave(toko, b, sb); return sb; }
    // 2. localStorage key baru
    const nd = PLAN._lsLoad(toko, b);
    if (nd) return nd;
    // 3. Fallback key lama (format lama: zenot_planning_2026_05)
    if (toko === 'global') {
      try {
        const old = JSON.parse(localStorage.getItem(`zenot_planning_${b.replace('-','_')}`)||'null');
        if (old) { PLAN._lsSave(toko, b, old); return old; }
      } catch(e) {}
    }
    // 4. Fallback key ops toko lama (format: zenot_ops_toko_SHP.ZENOOT)
    if (toko !== 'global') {
      try {
        const old = JSON.parse(localStorage.getItem(`zenot_ops_toko_${toko}`)||'null');
        if (old) { PLAN._lsSave(toko, b, old); return old; }
      } catch(e) {}
    }
    return {};
  },

  async save(toko='global', bulan=null, data) {
    const b = bulan || PLAN.keyBulan();
    PLAN._lsSave(toko, b, data);
    await PLAN._sbSave(toko, b, data);
  },

  loadSync(toko='global', bulan=null) {
    const b = bulan || PLAN.keyBulan();
    const nd = PLAN._lsLoad(toko, b);
    if (nd) return nd;
    // Fallback key lama global
    if (toko === 'global') {
      try {
        const old = JSON.parse(localStorage.getItem(`zenot_planning_${b.replace('-','_')}`)||'null');
        if (old) return old;
      } catch(e) {}
    }
    // Fallback key lama ops toko
    if (toko !== 'global') {
      try {
        const old = JSON.parse(localStorage.getItem(`zenot_ops_toko_${toko}`)||'null');
        if (old) return old;
      } catch(e) {}
    }
    return {};
  }
};

// ════════════════════════════════════════════════════════════════
// PAGE: TARGET & KPI
// ════════════════════════════════════════════════════════════════
async function renderPlanningKPI() {
  const el = document.getElementById('page-planning-kpi');
  if (!el) return;
  el.innerHTML = `<div style="padding:60px;text-align:center;color:var(--dusty);font-size:13px;">⏳ Memuat data...</div>`;
  const data = await PLAN.load('global');
  _renderKPIHTML(el, data);
}

function _renderKPIHTML(el, data) {
  el.innerHTML = `
  <style>
    .plan-section{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;margin-bottom:20px;}
    .plan-section-title{font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--dusty);margin-bottom:18px;}
    .plan-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;}
    .plan-field{display:flex;flex-direction:column;gap:6px;}
    .plan-label{font-size:11px;font-weight:700;color:var(--dusty);letter-spacing:.5px;text-transform:uppercase;}
    .plan-input{padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-weight:700;font-family:'DM Mono',monospace;color:var(--charcoal);background:var(--card);outline:none;transition:border-color .2s,box-shadow .2s;width:100%;box-sizing:border-box;}
    .plan-input:focus{border-color:var(--brown);box-shadow:0 0 0 3px rgba(92,61,46,.1);}
    .plan-input-prefix{position:relative;}
    .plan-input-prefix span{position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:12px;color:var(--dusty);font-weight:600;pointer-events:none;}
    .plan-input-prefix input{padding-left:30px;}
    .plan-save-btn{margin-top:20px;padding:11px 28px;background:var(--brown);color:var(--cream);border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.3px;transition:background .2s;}
    .plan-save-btn:hover{background:#3d2419;}
    .plan-divider{height:1px;background:var(--border);margin:20px 0;}
    .plan-preview{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-top:20px;}
    .plan-preview-card{background:var(--cream);border-radius:10px;padding:14px 16px;border:1px solid var(--border);}
    .plan-preview-label{font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--dusty);margin-bottom:6px;}
    .plan-preview-val{font-size:18px;font-weight:800;font-family:'DM Mono',monospace;color:var(--charcoal);}
    .plan-preview-sub{font-size:10px;color:var(--dusty);margin-top:3px;}
    .plan-month-badge{display:inline-flex;align-items:center;padding:3px 10px;background:var(--brown);color:var(--cream);border-radius:20px;font-size:10px;font-weight:700;margin-left:8px;}
  </style>

  <div style="margin-bottom:24px;">
    <div style="font-size:22px;font-weight:800;font-family:'DM Serif Display',serif;color:var(--charcoal);">
      Target & KPI <span class="plan-month-badge">${PLAN.bulanLabel()}</span>
    </div>
    <div style="font-size:12px;color:var(--dusty);margin-top:6px;">Data global acuan Dashboard, Daily Checklist & Intelligence. ☁️ Sync ke Supabase.</div>
  </div>

  <div class="plan-section">
    <div class="plan-section-title">📦 Produksi & Penjualan</div>
    <div class="plan-grid">
      <div class="plan-field"><div class="plan-label">Target Produksi (pcs)</div>
        <input class="plan-input" type="number" id="plan-produksi" placeholder="0" value="${data.targetProduksi||''}"></div>
      <div class="plan-field"><div class="plan-label">Target Unit Terjual (pcs)</div>
        <input class="plan-input" type="number" id="plan-unit" placeholder="0" value="${data.targetUnit||''}"></div>
      <div class="plan-field"><div class="plan-label">Target Omset (Rp)</div>
        <div class="plan-input-prefix"><span>Rp</span>
          <input class="plan-input" type="number" id="plan-omset" placeholder="0" value="${data.targetOmset||''}"></div></div>
      <div class="plan-field"><div class="plan-label">Target Transaksi (order)</div>
        <input class="plan-input" type="number" id="plan-transaksi" placeholder="0" value="${data.targetTransaksi||''}"></div>
    </div>
  </div>

  <div class="plan-section">
    <div class="plan-section-title">💰 Margin & Profitabilitas</div>
    <div class="plan-grid">
      <div class="plan-field"><div class="plan-label">Target GPM (%)</div>
        <input class="plan-input" type="number" id="plan-gpm" placeholder="0" value="${data.targetGPM||''}" step="0.1"></div>
      <div class="plan-field"><div class="plan-label">Target NPM (%)</div>
        <input class="plan-input" type="number" id="plan-npm" placeholder="0" value="${data.targetNPM||''}" step="0.1"></div>
      <div class="plan-field"><div class="plan-label">Target ROAS (x)</div>
        <input class="plan-input" type="number" id="plan-roas" placeholder="0" value="${data.targetROAS||''}" step="0.1"></div>
      <div class="plan-field"><div class="plan-label">Budget Iklan (Rp)</div>
        <div class="plan-input-prefix"><span>Rp</span>
          <input class="plan-input" type="number" id="plan-iklan" placeholder="0" value="${data.budgetIklan||''}"></div></div>
    </div>
  </div>

  <div class="plan-section">
    <div class="plan-section-title">🏭 Biaya Operasional Bulanan</div>
    <div class="plan-grid">
      <div class="plan-field"><div class="plan-label">Gaji & Tenaga Kerja (Rp)</div>
        <div class="plan-input-prefix"><span>Rp</span>
          <input class="plan-input" type="number" id="plan-gaji" placeholder="0" value="${data.biayaGaji||''}"></div></div>
      <div class="plan-field"><div class="plan-label">Sewa & Utilitas (Rp)</div>
        <div class="plan-input-prefix"><span>Rp</span>
          <input class="plan-input" type="number" id="plan-sewa" placeholder="0" value="${data.biayaSewa||''}"></div></div>
      <div class="plan-field"><div class="plan-label">Bahan Baku / Produksi (Rp)</div>
        <div class="plan-input-prefix"><span>Rp</span>
          <input class="plan-input" type="number" id="plan-bahan" placeholder="0" value="${data.biayaBahan||''}"></div></div>
      <div class="plan-field"><div class="plan-label">Lain-lain (Rp)</div>
        <div class="plan-input-prefix"><span>Rp</span>
          <input class="plan-input" type="number" id="plan-lain" placeholder="0" value="${data.biayaLain||''}"></div></div>
    </div>
  </div>

  <button class="plan-save-btn" id="plan-save-btn" onclick="savePlanningKPI()">💾 Simpan Target Bulan Ini</button>

  <div class="plan-divider"></div>
  <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:var(--dusty);margin-bottom:12px;">📋 Target Tersimpan</div>
  <div class="plan-preview">
    <div class="plan-preview-card">
      <div class="plan-preview-label">Produksi</div>
      <div class="plan-preview-val">${data.targetProduksi||'—'}</div>
      <div class="plan-preview-sub">pcs target</div>
    </div>
    <div class="plan-preview-card">
      <div class="plan-preview-label">Omset</div>
      <div class="plan-preview-val" style="font-size:13px;">${data.targetOmset?PLAN.fmtRp(data.targetOmset):'—'}</div>
      <div class="plan-preview-sub">target bulanan</div>
    </div>
    <div class="plan-preview-card">
      <div class="plan-preview-label">NPM Target</div>
      <div class="plan-preview-val">${data.targetNPM||'—'}${data.targetNPM?'%':''}</div>
      <div class="plan-preview-sub">net profit margin</div>
    </div>
    <div class="plan-preview-card">
      <div class="plan-preview-label">ROAS Target</div>
      <div class="plan-preview-val">${data.targetROAS||'—'}${data.targetROAS?'x':''}</div>
      <div class="plan-preview-sub">return on ad spend</div>
    </div>
    <div class="plan-preview-card">
      <div class="plan-preview-label">Total Ops</div>
      <div class="plan-preview-val" style="font-size:13px;">${
        (data.biayaGaji||0)+(data.biayaSewa||0)+(data.biayaBahan||0)+(data.biayaLain||0)>0
        ? PLAN.fmtRp((data.biayaGaji||0)+(data.biayaSewa||0)+(data.biayaBahan||0)+(data.biayaLain||0))
        : '—'
      }</div>
      <div class="plan-preview-sub">biaya operasional</div>
    </div>
  </div>
  `;
}

async function savePlanningKPI() {
  const btn = document.getElementById('plan-save-btn');
  if (btn) { btn.disabled=true; btn.textContent='⏳ Menyimpan...'; }
  const data = PLAN.loadSync('global') || {};
  data.targetProduksi  = parseFloat(document.getElementById('plan-produksi')?.value)||0;
  data.targetUnit      = parseFloat(document.getElementById('plan-unit')?.value)||0;
  data.targetOmset     = parseFloat(document.getElementById('plan-omset')?.value)||0;
  data.targetTransaksi = parseFloat(document.getElementById('plan-transaksi')?.value)||0;
  data.targetGPM       = parseFloat(document.getElementById('plan-gpm')?.value)||0;
  data.targetNPM       = parseFloat(document.getElementById('plan-npm')?.value)||0;
  data.targetROAS      = parseFloat(document.getElementById('plan-roas')?.value)||0;
  data.budgetIklan     = parseFloat(document.getElementById('plan-iklan')?.value)||0;
  data.biayaGaji       = parseFloat(document.getElementById('plan-gaji')?.value)||0;
  data.biayaSewa       = parseFloat(document.getElementById('plan-sewa')?.value)||0;
  data.biayaBahan      = parseFloat(document.getElementById('plan-bahan')?.value)||0;
  data.biayaLain       = parseFloat(document.getElementById('plan-lain')?.value)||0;
  await PLAN.save('global', null, data);
  if (typeof renderDashboard==='function') renderDashboard();
  if (typeof toast==='function') toast('✅ Target '+PLAN.bulanLabel()+' tersimpan ke cloud!');
  if (btn) { btn.disabled=false; btn.textContent='💾 Simpan Target Bulan Ini'; }
  const el = document.getElementById('page-planning-kpi');
  if (el) _renderKPIHTML(el, data);
}

// ════════════════════════════════════════════════════════════════
// PAGE: OPS PER TOKO
// ════════════════════════════════════════════════════════════════
async function renderPlanningOps() {
  const el = document.getElementById('page-planning-ops');
  if (!el) return;
  const channels = window._tokoList && window._tokoList.length > 0
    ? window._tokoList
    : (typeof DB!=='undefined'?DB.channel||[]:[]).filter(c=>c.nama!=='__assign__');

  const fmtRp  = v => v ? 'Rp '+Number(v).toLocaleString('id-ID') : '—';
  const fmtNum = v => v ? Number(v).toLocaleString('id-ID') : '—';

  // Build table rows
  const rows = channels.map(ch => {
    const chNama  = ch.kode || ch.nama;
    const platform = ch.platform || 'lainnya';
    const d = PLAN.loadSync(chNama) || {};
    const biaya   = d.biayaOps || 0;
    const rasio   = d.rasioOps || 0;
    const target  = (rasio > 0 && biaya > 0) ? Math.round(biaya / (rasio/100)) : 0;
    const harian  = target > 0 ? Math.round(target/30) : 0;
    const pStyle  = typeof _platformStyle==='function' ? _platformStyle(platform) : {bg:'#8C7B6B',color:'#fff'};
    return `
      <tr class="ops-tr" onclick="opsSelectRow('${chNama}')" data-ch="${chNama}">
        <td class="ops-td">
          <div style="display:flex;align-items:center;gap:7px;">
            <span style="padding:2px 8px;border-radius:20px;background:${pStyle.bg};color:${pStyle.color};font-size:9px;font-weight:700;white-space:nowrap;">${platform}</span>
            <span style="font-size:13px;font-weight:600;color:var(--charcoal);">${chNama}</span>
          </div>
        </td>
        <td class="ops-td ops-num" id="opsrow-biaya-${chNama}">${biaya>0?fmtNum(biaya):'—'}</td>
        <td class="ops-td ops-num" id="opsrow-rasio-${chNama}">${rasio>0?rasio+'%':'—'}</td>
        <td class="ops-td ops-num" id="opsrow-target-${chNama}">${target>0?fmtRp(target):'—'}</td>
        <td class="ops-td ops-num" id="opsrow-harian-${chNama}" style="color:var(--dusty);font-size:11px;">${harian>0?fmtRp(harian)+'/hr':'—'}</td>
        <td class="ops-td" style="text-align:center;">
          <button class="ops-edit-btn" onclick="event.stopPropagation();opsSelectRow('${chNama}')">✏️ Edit</button>
        </td>
      </tr>`;
  }).join('');

  el.innerHTML = `
  <style>
    .ops-layout{display:grid;grid-template-columns:1fr 300px;gap:16px;align-items:start;}
    @media(max-width:768px){.ops-layout{grid-template-columns:1fr;}}
    .ops-table-wrap{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;}
    .ops-table{width:100%;border-collapse:collapse;}
    .ops-th{padding:9px 12px;font-size:9px;font-weight:700;color:var(--dusty);letter-spacing:.6px;text-transform:uppercase;background:var(--bg);border-bottom:2px solid var(--border);text-align:left;}
    .ops-th.ops-num{text-align:right;}
    .ops-td{padding:9px 12px;border-bottom:1px solid var(--border);font-size:13px;vertical-align:middle;}
    .ops-td.ops-num{text-align:right;font-family:'DM Mono',monospace;font-size:12px;}
    .ops-tr{cursor:pointer;transition:background .15s;}
    .ops-tr:hover{background:var(--cream);}
    .ops-tr.ops-active{background:color-mix(in srgb, var(--brown) 8%, transparent);border-left:3px solid var(--brown);}
    .ops-tr:last-child td{border-bottom:none;}
    .ops-edit-btn{padding:3px 10px;font-size:11px;font-weight:600;background:var(--cream);border:1px solid var(--border);border-radius:6px;cursor:pointer;color:var(--charcoal);transition:all .15s;}
    .ops-edit-btn:hover{background:var(--brown);color:var(--cream);border-color:var(--brown);}
    .ops-panel{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:16px;position:sticky;top:16px;}
    .ops-panel-title{font-size:13px;font-weight:700;color:var(--charcoal);margin-bottom:14px;display:flex;align-items:center;gap:6px;}
    .ops-panel-ch{font-size:11px;color:var(--brown);font-weight:700;background:color-mix(in srgb,var(--brown) 10%,transparent);padding:3px 10px;border-radius:20px;margin-bottom:12px;}
    .ops-field{margin-bottom:10px;}
    .ops-field-label{font-size:9px;font-weight:600;color:var(--dusty);letter-spacing:.5px;text-transform:uppercase;margin-bottom:4px;}
    .ops-input{padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-weight:400;font-family:'DM Mono',monospace;color:var(--charcoal);background:var(--bg);outline:none;width:100%;box-sizing:border-box;transition:border-color .2s;}
    .ops-input:focus{border-color:var(--brown);background:var(--card);}
    .ops-input:disabled{opacity:.45;cursor:not-allowed;}
    .ops-hint{font-size:10px;color:var(--dusty);margin-top:3px;font-style:italic;}
    .ops-result-mini{background:var(--cream);border:1.5px solid var(--brown);border-radius:8px;padding:8px 10px;margin:10px 0;}
    .ops-result-mini-label{font-size:9px;font-weight:700;color:var(--brown);letter-spacing:.5px;text-transform:uppercase;}
    .ops-result-mini-val{font-size:15px;font-weight:800;font-family:'DM Serif Display',serif;color:var(--charcoal);margin-top:1px;}
    .ops-result-mini-sub{font-size:10px;color:var(--dusty);font-weight:500;}
    .ops-save-btn{width:100%;padding:9px;background:var(--brown);color:var(--cream);border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .2s;margin-top:4px;}
    .ops-save-btn:hover{opacity:.85;}
    .ops-save-btn:disabled{opacity:.45;cursor:not-allowed;}
    .ops-empty{text-align:center;padding:20px;color:var(--dusty);font-size:12px;}
  </style>
  <div style="margin-bottom:16px;">
    <div style="font-size:20px;font-weight:800;font-family:'DM Serif Display',serif;color:var(--charcoal);">Biaya <span style="color:var(--brown)">Operasional</span></div>
    <div style="font-size:11px;color:var(--dusty);margin-top:4px;">Klik row atau tombol Edit → isi panel kanan → Simpan. ☁️ Sync Supabase.</div>
  </div>
  <div class="ops-layout">
    <!-- TABEL -->
    <div class="ops-table-wrap">
      ${channels.length===0
        ? `<div class="ops-empty">Belum ada channel aktif.</div>`
        : `<table class="ops-table">
            <thead>
              <tr>
                <th class="ops-th">Channel</th>
                <th class="ops-th ops-num">Biaya Ops (Rp)</th>
                <th class="ops-th ops-num">Rasio %</th>
                <th class="ops-th ops-num">Target Omzet/bln</th>
                <th class="ops-th ops-num">Target/hari</th>
                <th class="ops-th" style="text-align:center;">Aksi</th>
              </tr>
            </thead>
            <tbody id="ops-tbody">${rows}</tbody>
          </table>`
      }
    </div>
    <!-- PANEL KANAN -->
    <div class="ops-panel" id="ops-panel">
      <div class="ops-panel-title">✏️ Perbarui Data</div>
      <div id="ops-panel-ch" class="ops-panel-ch" style="display:none;"></div>
      <div id="ops-panel-empty" style="text-align:center;padding:20px 0;color:var(--dusty);font-size:12px;">
        👆 Pilih channel dari tabel
      </div>
      <div id="ops-panel-form" style="display:none;">
        <div class="ops-field">
          <div class="ops-field-label">Biaya Operasional (Rp)</div>
          <input class="ops-input" type="text" id="ops-panel-biaya" placeholder="0" oninput="opsPanelRecalc()">
          <div class="ops-hint">Gaji, sewa, utilitas, dll</div>
        </div>
        <div class="ops-field">
          <div class="ops-field-label">Rasio Operasional (%)</div>
          <input class="ops-input" type="number" id="ops-panel-rasio" placeholder="0" step="0.1" min="0.1" max="100" oninput="opsPanelRecalc()">
          <div class="ops-hint">Target % ops dari omzet</div>
        </div>
        <div class="ops-result-mini" id="ops-panel-result">
          <div class="ops-result-mini-label">🎯 Target Omzet</div>
          <div class="ops-result-mini-val" id="ops-panel-result-val">—</div>
          <div class="ops-result-mini-sub" id="ops-panel-result-sub">Isi biaya & rasio dulu</div>
        </div>
        <button class="ops-save-btn" id="ops-panel-save-btn" onclick="opsPanelSave()">💾 Simpan</button>
      </div>
    </div>
  </div>`;

  // attach hidden state
  window._opsPanelCh = null;
}

function opsSelectRow(chNama) {
  // highlight active row
  document.querySelectorAll('.ops-tr').forEach(r => r.classList.remove('ops-active'));
  const row = document.querySelector(`.ops-tr[data-ch="${chNama}"]`);
  if (row) row.classList.add('ops-active');

  // load data into panel
  const d = PLAN.loadSync(chNama) || {};
  const biaya = d.biayaOps || 0;
  const rasio = d.rasioOps || 0;

  document.getElementById('ops-panel-ch').textContent = chNama;
  document.getElementById('ops-panel-ch').style.display = 'block';
  document.getElementById('ops-panel-empty').style.display = 'none';
  document.getElementById('ops-panel-form').style.display = 'block';

  const biayaEl = document.getElementById('ops-panel-biaya');
  const rasioEl = document.getElementById('ops-panel-rasio');
  if (biayaEl) biayaEl.value = biaya > 0 ? Number(biaya).toLocaleString('id-ID') : '';
  if (rasioEl) rasioEl.value = rasio || '';

  window._opsPanelCh = chNama;
  opsPanelRecalc();
}

function opsPanelFormatBiaya() {
  const el = document.getElementById('ops-panel-biaya');
  if (!el) return;
  const raw = el.value.replace(/[^\d]/g,'');
  const num = parseInt(raw)||0;
  const pos = el.selectionStart;
  const prevLen = el.value.length;
  el.value = num>0 ? num.toLocaleString('id-ID') : '';
  const diff = el.value.length - prevLen;
  try { el.setSelectionRange(pos+diff, pos+diff); } catch(e){}
}

function opsPanelRecalc() {
  opsPanelFormatBiaya();
  const biaya = parseInt((document.getElementById('ops-panel-biaya')?.value||'').replace(/[^\d]/g,''))||0;
  const rasio = parseFloat(document.getElementById('ops-panel-rasio')?.value)||0;
  const valEl = document.getElementById('ops-panel-result-val');
  const subEl = document.getElementById('ops-panel-result-sub');
  if (!valEl || !subEl) return;
  if (biaya > 0 && rasio > 0) {
    const target  = Math.round(biaya / (rasio/100));
    const harian  = Math.round(target/30);
    const fmt = v => 'Rp '+Number(v).toLocaleString('id-ID');
    valEl.textContent = fmt(target)+' / bln';
    subEl.textContent = fmt(harian)+' / hari';
  } else {
    valEl.textContent = '—';
    subEl.textContent = 'Isi biaya & rasio dulu';
  }
}

async function opsPanelSave() {
  const chNama = window._opsPanelCh;
  if (!chNama) return;
  const btn = document.getElementById('ops-panel-save-btn');
  if (btn) { btn.disabled=true; btn.textContent='Menyimpan...'; }

  const biaya = parseInt((document.getElementById('ops-panel-biaya')?.value||'').replace(/[^\d]/g,''))||0;
  const rasio = parseFloat(document.getElementById('ops-panel-rasio')?.value)||0;
  const targetBulan = (rasio>0 && biaya>0) ? Math.round(biaya/(rasio/100)) : 0;
  const harian = targetBulan > 0 ? Math.round(targetBulan/30) : 0;

  const data = {
    biayaOps    : biaya,
    rasioOps    : rasio,
    targetOmset : targetBulan,
    budgetIklan : parseFloat((PLAN.loadSync(chNama)||{}).budgetIklan)||0,
    feePlatform : parseFloat((PLAN.loadSync(chNama)||{}).feePlatform)||0,
    targetROAS  : parseFloat((PLAN.loadSync(chNama)||{}).targetROAS)||0,
  };
  await PLAN.save(chNama, null, data);

  // update row cells live
  const fmt  = v => v>0 ? Number(v).toLocaleString('id-ID') : '—';
  const fmtRp = v => v>0 ? 'Rp '+Number(v).toLocaleString('id-ID') : '—';
  const bEl = document.getElementById(`opsrow-biaya-${chNama}`);
  const rEl = document.getElementById(`opsrow-rasio-${chNama}`);
  const tEl = document.getElementById(`opsrow-target-${chNama}`);
  const hEl = document.getElementById(`opsrow-harian-${chNama}`);
  if (bEl) bEl.textContent = fmt(biaya);
  if (rEl) rEl.textContent = rasio>0 ? rasio+'%' : '—';
  if (tEl) tEl.textContent = fmtRp(targetBulan);
  if (hEl) hEl.textContent = harian>0 ? fmtRp(harian)+'/hr' : '—';

  if (btn) { btn.disabled=false; btn.textContent='✅ Tersimpan!'; setTimeout(()=>{ if(btn)btn.textContent='💾 Simpan'; },2000); }
  if (typeof toast==='function') toast(`✅ ${chNama} — tersimpan!`);
}

// legacy compat — keep old function names working
function saveOpsToko(chNama) { return opsPanelSave(); }
function recalcOpsTarget(chNama) { opsPanelRecalc(); }
function formatOpsInput(el, chNama) { opsPanelRecalc(); }

// ════════════════════════════════════════════════════════════════
// PAGE: BIAYA OPERASIONAL GLOBAL (Keuangan Operasional)
// Data level usaha keseluruhan — terpisah dari per toko
// ════════════════════════════════════════════════════════════════
const BIAYA_GLOBAL_KEY = 'zenot_biaya_ops_global';

function _bgLoad() {
  try { return JSON.parse(localStorage.getItem(BIAYA_GLOBAL_KEY) || 'null') || {}; }
  catch(e) { return {}; }
}

function _bgSave(data) {
  try { localStorage.setItem(BIAYA_GLOBAL_KEY, JSON.stringify(data)); } catch(e) {}
  // Sync ke Supabase (tabel planning, toko='__biaya_global__')
  const bulan = PLAN.keyBulan();
  PLAN._sbSave('__biaya_global__', bulan, data).catch(()=>{});
}

function _bgRecalc() {
  // Strip semua non-digit (titik ribuan format ID) lalu parseInt
  const biaya  = parseInt((document.getElementById('bg-biaya')?.value||'').replace(/[^\d]/g,''), 10) || 0;
  const rasio  = parseFloat(document.getElementById('bg-rasio')?.value || 0) || 0;
  const target = (rasio > 0 && biaya > 0) ? Math.round(biaya / (rasio / 100)) : 0;
  const el = document.getElementById('bg-target-val');
  if (el) el.textContent = target > 0 ? 'Rp ' + target.toLocaleString('id-ID') : '—';
}

function _bgFmtInput(el) {
  const raw = el.value.replace(/[^\d]/g,'');
  el.value = raw ? Number(raw).toLocaleString('id-ID') : '';
  _bgRecalc();
}

async function saveBiayaOpsGlobal() {
  const biayaRaw = (document.getElementById('bg-biaya')?.value||'').replace(/[^\d]/g,'');
  const rasio    = parseFloat(document.getElementById('bg-rasio')?.value || 0) || 0;
  const biaya    = parseInt(biayaRaw) || 0;

  if (biaya <= 0 || rasio <= 0) {
    if (typeof toast === 'function') toast('⚠️ Isi Biaya dan Rasio terlebih dahulu');
    return;
  }

  const data = { biayaOpsGlobal: biaya, rasioOpsGlobal: rasio, updatedAt: new Date().toISOString() };
  _bgSave(data);

  // Update tampilan tabel
  const target = Math.round(biaya / (rasio / 100));
  const fmt    = n => 'Rp ' + Number(n).toLocaleString('id-ID');
  const elB = document.getElementById('bg-row-biaya');
  const elR = document.getElementById('bg-row-rasio');
  const elT = document.getElementById('bg-row-target');
  if (elB) elB.textContent = 'Rp ' + biaya.toLocaleString('id-ID');
  if (elR) elR.textContent = rasio + '%';
  if (elT) elT.textContent = fmt(target);

  const btn = document.getElementById('bg-save-btn');
  if (btn) { btn.textContent = '✅ Tersimpan'; btn.disabled = true; setTimeout(()=>{ btn.textContent='💾 Simpan'; btn.disabled=false; }, 2000); }
  if (typeof toast === 'function') toast('✅ Biaya Operasional berhasil disimpan');
}

async function renderBiayaOpsGlobal() {
  const el = document.getElementById('page-biaya-ops-global');
  if (!el) return;

  // Load data tersimpan
  let data = _bgLoad();
  // Coba sync dari Supabase jika online
  try {
    const sbData = await PLAN._sbLoad('__biaya_global__', PLAN.keyBulan());
    if (sbData && Object.keys(sbData).length > 0) {
      data = sbData;
      _bgSave(data); // update localStorage
    }
  } catch(e) {}

  const biaya  = data.biayaOpsGlobal  || 0;
  const rasio  = data.rasioOpsGlobal  || 0;
  const target = (rasio > 0 && biaya > 0) ? Math.round(biaya / (rasio / 100)) : 0;
  const fmt    = n => n > 0 ? 'Rp ' + Number(n).toLocaleString('id-ID') : '—';
  const fmtR   = n => n > 0 ? n + '%' : '—';
  const biayaFmt = biaya > 0 ? biaya.toLocaleString('id-ID') : '';

  el.innerHTML = `
  <style>
    .bg-wrap{max-width:760px;}
    .bg-title{font-size:20px;font-weight:800;font-family:'DM Serif Display',serif;color:var(--charcoal);margin-bottom:4px;}
    .bg-title span{color:var(--brown);}
    .bg-sub{font-size:11px;color:var(--dusty);margin-bottom:20px;}
    .bg-usaha{display:inline-block;font-size:16px;font-weight:800;color:var(--brown);background:color-mix(in srgb,var(--brown) 10%,transparent);padding:7px 18px;border-radius:20px;margin-bottom:18px;letter-spacing:.5px;border:1.5px solid color-mix(in srgb,var(--brown) 25%,transparent);}
    .bg-card{background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:20px;}
    .bg-table{width:100%;border-collapse:collapse;}
    .bg-th{padding:10px 16px;font-size:9px;font-weight:700;color:var(--dusty);letter-spacing:.7px;text-transform:uppercase;background:var(--bg);border-bottom:2px solid var(--border);text-align:center;}
    .bg-th:first-child{text-align:left;}
    .bg-td{padding:14px 16px;border-bottom:1px solid var(--border);font-size:13px;font-family:'DM Mono',monospace;font-weight:500;color:var(--charcoal);text-align:center;vertical-align:middle;}
    .bg-td:first-child{text-align:left;font-family:inherit;font-weight:600;}
    .bg-td:last-child{border-bottom:none;}
    .bg-label-row{font-size:11px;font-weight:700;color:var(--dusty);text-transform:uppercase;letter-spacing:.5px;}
    .bg-form-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;margin-bottom:20px;}
    .bg-form-title{font-size:13px;font-weight:700;color:var(--charcoal);margin-bottom:14px;display:flex;align-items:center;gap:6px;}
    .bg-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;}
    @media(max-width:560px){.bg-form-grid{grid-template-columns:1fr;}}
    .bg-field-label{font-size:9px;font-weight:700;color:var(--dusty);letter-spacing:.5px;text-transform:uppercase;margin-bottom:5px;}
    .bg-input-wrap{display:flex;align-items:center;border:1.5px solid var(--border);border-radius:8px;background:var(--bg);overflow:hidden;transition:border-color .2s;}
    .bg-input-wrap:focus-within{border-color:var(--brown);background:var(--card);}
    .bg-input-prefix{padding:0 10px;font-size:12px;color:var(--dusty);font-weight:600;white-space:nowrap;border-right:1px solid var(--border);}
    .bg-input-suffix{padding:0 10px;font-size:12px;color:var(--dusty);font-weight:600;border-left:1px solid var(--border);}
    .bg-input{flex:1;padding:8px 10px;border:none;background:transparent;font-size:13px;font-family:'DM Mono',monospace;color:var(--charcoal);outline:none;min-width:0;}
    .bg-result{background:var(--cream);border:1.5px solid var(--brown);border-radius:8px;padding:10px 14px;margin-bottom:14px;display:flex;justify-content:space-between;align-items:center;}
    .bg-result-label{font-size:9px;font-weight:700;color:var(--brown);letter-spacing:.5px;text-transform:uppercase;}
    .bg-result-val{font-size:17px;font-weight:800;font-family:'DM Serif Display',serif;color:var(--charcoal);}
    .bg-save-btn{width:100%;padding:10px;background:var(--brown);color:var(--cream);border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;transition:opacity .2s;}
    .bg-save-btn:hover{opacity:.85;}
    .bg-save-btn:disabled{opacity:.45;cursor:not-allowed;}
    .bg-hint{font-size:10px;color:var(--dusty);margin-top:3px;font-style:italic;}
    .bg-empty{color:var(--dusty);font-style:italic;}
  </style>

  <div class="bg-wrap">
    <div class="bg-sub">Data biaya operasional keseluruhan usaha — bukan per toko.</div>
    <div class="bg-usaha">🏢 RAJUTAN DIMI</div>

    <!-- TABEL RINGKASAN -->
    <div class="bg-card">
      <table class="bg-table">
        <thead>
          <tr>
            <th class="bg-th">Keterangan</th>
            <th class="bg-th">Biaya Operasional</th>
            <th class="bg-th">Rasio Operasional</th>
            <th class="bg-th">Target Omset</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="bg-td bg-label-row">Keseluruhan Usaha</td>
            <td class="bg-td" id="bg-row-biaya">${biaya > 0 ? fmt(biaya) : '<span class="bg-empty">—</span>'}</td>
            <td class="bg-td" id="bg-row-rasio">${rasio > 0 ? fmtR(rasio) : '<span class="bg-empty">—</span>'}</td>
            <td class="bg-td" id="bg-row-target">${target > 0 ? fmt(target) : '<span class="bg-empty">—</span>'}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- FORM INPUT -->
    <div class="bg-form-card">
      <div class="bg-form-title">✏️ Perbarui Data</div>
      <div class="bg-form-grid">
        <div>
          <div class="bg-field-label">Biaya Operasional (Rp)</div>
          <div class="bg-input-wrap">
            <span class="bg-input-prefix">Rp</span>
            <input class="bg-input" type="text" id="bg-biaya" placeholder="0"
              value="${biayaFmt}"
              oninput="_bgFmtInput(this)">
          </div>
          <div class="bg-hint">Gaji, sewa, utilitas, transport, dll</div>
        </div>
        <div>
          <div class="bg-field-label">Rasio Operasional (%)</div>
          <div class="bg-input-wrap">
            <input class="bg-input" type="number" id="bg-rasio" placeholder="0"
              value="${rasio || ''}" step="0.1" min="0.1" max="100"
              oninput="_bgRecalc()">
            <span class="bg-input-suffix">%</span>
          </div>
          <div class="bg-hint">Target % ops dari total omset usaha</div>
        </div>
      </div>
      <div class="bg-result">
        <div>
          <div class="bg-result-label">🎯 Target Omset Keseluruhan</div>
          <div class="bg-hint" style="margin-top:2px;">Biaya ÷ Rasio</div>
        </div>
        <div class="bg-result-val" id="bg-target-val">${target > 0 ? fmt(target) : '—'}</div>
      </div>
      <button class="bg-save-btn" id="bg-save-btn" onclick="saveBiayaOpsGlobal()">💾 Simpan</button>
    </div>
  </div>`;
}

// ─── EXPOSE ─────────────────────────────────────────────────────
window.renderPlanningKPI      = renderPlanningKPI;
window.renderPlanningOps      = renderPlanningOps;
window.renderBiayaOpsGlobal   = renderBiayaOpsGlobal;
window.savePlanningKPI        = savePlanningKPI;
window.saveBiayaOpsGlobal     = saveBiayaOpsGlobal;
window.saveOpsToko            = saveOpsToko;
window.recalcOpsTarget        = recalcOpsTarget;
window.formatOpsInput         = formatOpsInput;
window.PLAN                   = PLAN;
window.opsSelectRow           = opsSelectRow;
window.opsPanelRecalc         = opsPanelRecalc;
window.opsPanelSave           = opsPanelSave;
window._bgRecalc              = _bgRecalc;
window._bgFmtInput            = _bgFmtInput;

})();
