// ================================================================
// PLANNING MODULE — zenOt Operasional
// Target & KPI Global + Operasional per Toko
// Data disimpan ke localStorage per bulan
// ================================================================

(function() {

const PLAN = {
  key: () => {
    const d = new Date();
    return `zenot_planning_${d.getFullYear()}_${String(d.getMonth()+1).padStart(2,'0')}`;
  },
  load: () => {
    try { return JSON.parse(localStorage.getItem(PLAN.key())||'{}'); } catch(e) { return {}; }
  },
  save: (data) => {
    try { localStorage.setItem(PLAN.key(), JSON.stringify(data)); } catch(e) {}
  },
  fmtRp: n => 'Rp ' + Number(n||0).toLocaleString('id-ID'),
  bulan: () => {
    const months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    const d = new Date();
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  }
};

// ════════════════════════════════════════
// PAGE: TARGET & KPI
// ════════════════════════════════════════
function renderPlanningKPI() {
  const el = document.getElementById('page-planning-kpi');
  if (!el) return;
  const data = PLAN.load();

  el.innerHTML = `
  <style>
    .plan-section { background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;margin-bottom:20px; }
    .plan-section-title { font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--dusty);margin-bottom:18px;display:flex;align-items:center;gap:8px; }
    .plan-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px; }
    .plan-field { display:flex;flex-direction:column;gap:6px; }
    .plan-label { font-size:11px;font-weight:700;color:var(--dusty);letter-spacing:.5px;text-transform:uppercase; }
    .plan-input { padding:10px 14px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-weight:700;font-family:'DM Mono',monospace;color:var(--charcoal);background:var(--card);outline:none;transition:border-color .2s,box-shadow .2s;width:100%;box-sizing:border-box; }
    .plan-input:focus { border-color:var(--brown);box-shadow:0 0 0 3px rgba(92,61,46,.1); }
    .plan-input-prefix { position:relative; }
    .plan-input-prefix span { position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:12px;color:var(--dusty);font-weight:600;pointer-events:none; }
    .plan-input-prefix input { padding-left:30px; }
    .plan-save-btn { margin-top:20px;padding:11px 28px;background:var(--brown);color:var(--cream);border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:.3px;transition:background .2s; }
    .plan-save-btn:hover { background:#3d2419; }
    .plan-divider { height:1px;background:var(--border);margin:20px 0; }
    .plan-preview { display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-top:20px; }
    .plan-preview-card { background:var(--cream);border-radius:10px;padding:14px 16px;border:1px solid var(--border); }
    .plan-preview-label { font-size:10px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;color:var(--dusty);margin-bottom:6px; }
    .plan-preview-val { font-size:18px;font-weight:800;font-family:'DM Mono',monospace;color:var(--charcoal); }
    .plan-preview-sub { font-size:10px;color:var(--dusty);margin-top:3px; }
    .plan-month-badge { display:inline-flex;align-items:center;padding:3px 10px;background:var(--brown);color:var(--cream);border-radius:20px;font-size:10px;font-weight:700;margin-left:8px; }
  </style>

  <!-- Header -->
  <div style="margin-bottom:24px;">
    <div style="font-size:22px;font-weight:800;font-family:'DM Serif Display',serif;color:var(--charcoal);">
      Target & KPI <span class="plan-month-badge">${PLAN.bulan()}</span>
    </div>
    <div style="font-size:12px;color:var(--dusty);margin-top:6px;">Data global yang menjadi acuan Dashboard, Daily Checklist, dan Intelligence.</div>
  </div>

  <!-- SECTION 1: PRODUKSI & PENJUALAN -->
  <div class="plan-section">
    <div class="plan-section-title">📦 Produksi & Penjualan</div>
    <div class="plan-grid">
      <div class="plan-field">
        <div class="plan-label">Target Produksi (pcs)</div>
        <input class="plan-input" type="number" id="plan-produksi" placeholder="0" value="${data.targetProduksi||''}">
      </div>
      <div class="plan-field">
        <div class="plan-label">Target Unit Terjual (pcs)</div>
        <input class="plan-input" type="number" id="plan-unit" placeholder="0" value="${data.targetUnit||''}">
      </div>
      <div class="plan-field">
        <div class="plan-label">Target Omset (Rp)</div>
        <div class="plan-input-prefix">
          <span>Rp</span>
          <input class="plan-input" type="number" id="plan-omset" placeholder="0" value="${data.targetOmset||''}">
        </div>
      </div>
      <div class="plan-field">
        <div class="plan-label">Target Transaksi (order)</div>
        <input class="plan-input" type="number" id="plan-transaksi" placeholder="0" value="${data.targetTransaksi||''}">
      </div>
    </div>
  </div>

  <!-- SECTION 2: MARGIN & PROFITABILITAS -->
  <div class="plan-section">
    <div class="plan-section-title">💰 Margin & Profitabilitas</div>
    <div class="plan-grid">
      <div class="plan-field">
        <div class="plan-label">Target GPM (%)</div>
        <input class="plan-input" type="number" id="plan-gpm" placeholder="0" value="${data.targetGPM||''}" step="0.1">
      </div>
      <div class="plan-field">
        <div class="plan-label">Target NPM (%)</div>
        <input class="plan-input" type="number" id="plan-npm" placeholder="0" value="${data.targetNPM||''}" step="0.1">
      </div>
      <div class="plan-field">
        <div class="plan-label">Target ROAS (x)</div>
        <input class="plan-input" type="number" id="plan-roas" placeholder="0" value="${data.targetROAS||''}" step="0.1">
      </div>
      <div class="plan-field">
        <div class="plan-label">Budget Iklan (Rp)</div>
        <div class="plan-input-prefix">
          <span>Rp</span>
          <input class="plan-input" type="number" id="plan-iklan" placeholder="0" value="${data.budgetIklan||''}">
        </div>
      </div>
    </div>
  </div>

  <!-- SECTION 3: BIAYA OPERASIONAL GLOBAL -->
  <div class="plan-section">
    <div class="plan-section-title">🏭 Biaya Operasional Bulanan</div>
    <div class="plan-grid">
      <div class="plan-field">
        <div class="plan-label">Gaji & Tenaga Kerja (Rp)</div>
        <div class="plan-input-prefix">
          <span>Rp</span>
          <input class="plan-input" type="number" id="plan-gaji" placeholder="0" value="${data.biayaGaji||''}">
        </div>
      </div>
      <div class="plan-field">
        <div class="plan-label">Sewa & Utilitas (Rp)</div>
        <div class="plan-input-prefix">
          <span>Rp</span>
          <input class="plan-input" type="number" id="plan-sewa" placeholder="0" value="${data.biayaSewa||''}">
        </div>
      </div>
      <div class="plan-field">
        <div class="plan-label">Bahan Baku / Produksi (Rp)</div>
        <div class="plan-input-prefix">
          <span>Rp</span>
          <input class="plan-input" type="number" id="plan-bahan" placeholder="0" value="${data.biayaBahan||''}">
        </div>
      </div>
      <div class="plan-field">
        <div class="plan-label">Lain-lain (Rp)</div>
        <div class="plan-input-prefix">
          <span>Rp</span>
          <input class="plan-input" type="number" id="plan-lain" placeholder="0" value="${data.biayaLain||''}">
        </div>
      </div>
    </div>
  </div>

  <!-- TOMBOL SIMPAN -->
  <button class="plan-save-btn" onclick="savePlanningKPI()">💾 Simpan Target Bulan Ini</button>

  <!-- PREVIEW TERSIMPAN -->
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
      <div class="plan-preview-val" style="font-size:13px;">${data.targetOmset ? PLAN.fmtRp(data.targetOmset) : '—'}</div>
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
        (data.biayaGaji||0)+(data.biayaSewa||0)+(data.biayaBahan||0)+(data.biayaLain||0) > 0
        ? PLAN.fmtRp((data.biayaGaji||0)+(data.biayaSewa||0)+(data.biayaBahan||0)+(data.biayaLain||0))
        : '—'
      }</div>
      <div class="plan-preview-sub">biaya operasional</div>
    </div>
  </div>
  `;
}

function savePlanningKPI() {
  const data = PLAN.load();
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
  PLAN.save(data);
  if (typeof renderDashboard === 'function') renderDashboard();
  if (typeof toast === 'function') toast('✅ Target ' + PLAN.bulan() + ' tersimpan!');
  renderPlanningKPI();
}

// ════════════════════════════════════════
// PAGE: OPS PER TOKO (placeholder)
// ════════════════════════════════════════
function renderPlanningOps() {
  const el = document.getElementById('page-planning-ops');
  if (!el) return;
  const channels = (typeof DB !== 'undefined' ? DB.channel||[] : []).filter(c=>c.nama!=='__assign__');

  el.innerHTML = `
  <style>
    .ops-toko-card { background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px 24px;margin-bottom:14px; }
    .ops-toko-header { display:flex;align-items:center;gap:10px;margin-bottom:16px; }
    .ops-toko-name { font-size:15px;font-weight:800;font-family:'DM Serif Display',serif;color:var(--charcoal); }
    .ops-toko-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px; }
    .plan-field { display:flex;flex-direction:column;gap:5px; }
    .plan-label { font-size:10px;font-weight:700;color:var(--dusty);letter-spacing:.5px;text-transform:uppercase; }
    .plan-input { padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-weight:700;font-family:'DM Mono',monospace;color:var(--charcoal);background:var(--card);outline:none;width:100%;box-sizing:border-box;transition:border-color .2s; }
    .plan-input:focus { border-color:var(--brown); }
    .ops-save-btn { margin-top:12px;padding:8px 20px;background:var(--brown);color:var(--cream);border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer; }
  </style>

  <div style="margin-bottom:24px;">
    <div style="font-size:22px;font-weight:800;font-family:'DM Serif Display',serif;color:var(--charcoal);">Operasional <span style="color:var(--brown)">per Toko</span></div>
    <div style="font-size:12px;color:var(--dusty);margin-top:6px;">Target & biaya spesifik per channel penjualan.</div>
  </div>

  ${channels.length === 0 ? `<div style="color:var(--dusty);font-size:13px;padding:20px;">Belum ada channel. Tambah channel di menu Penjualan → Channel.</div>` : ''}

  ${channels.map(ch => {
    const key = `zenot_ops_toko_${ch.nama}`;
    let d = {};
    try { d = JSON.parse(localStorage.getItem(key)||'{}'); } catch(e) {}
    const pStyle = typeof _platformStyle === 'function' ? _platformStyle(ch.platform) : {bg:'#8C7B6B',color:'#fff'};
    return `
    <div class="ops-toko-card">
      <div class="ops-toko-header">
        <span style="padding:3px 10px;border-radius:20px;background:${pStyle.bg};color:${pStyle.color};font-size:10px;font-weight:700;">${ch.platform}</span>
        <span class="ops-toko-name">${ch.nama}</span>
      </div>
      <div class="ops-toko-grid">
        <div class="plan-field">
          <div class="plan-label">Target Omset (Rp)</div>
          <input class="plan-input" type="number" id="ops-omset-${ch.nama}" placeholder="0" value="${d.targetOmset||''}">
        </div>
        <div class="plan-field">
          <div class="plan-label">Budget Iklan (Rp)</div>
          <input class="plan-input" type="number" id="ops-iklan-${ch.nama}" placeholder="0" value="${d.budgetIklan||''}">
        </div>
        <div class="plan-field">
          <div class="plan-label">Fee Platform (%)</div>
          <input class="plan-input" type="number" id="ops-fee-${ch.nama}" placeholder="0" value="${d.feePlatform||''}" step="0.1">
        </div>
        <div class="plan-field">
          <div class="plan-label">Target ROAS (x)</div>
          <input class="plan-input" type="number" id="ops-roas-${ch.nama}" placeholder="0" value="${d.targetROAS||''}" step="0.1">
        </div>
      </div>
      <button class="ops-save-btn" onclick="saveOpsToko('${ch.nama}')">💾 Simpan</button>
    </div>`;
  }).join('')}
  `;
}

function saveOpsToko(chNama) {
  const key = `zenot_ops_toko_${chNama}`;
  const data = {
    targetOmset : parseFloat(document.getElementById(`ops-omset-${chNama}`)?.value)||0,
    budgetIklan : parseFloat(document.getElementById(`ops-iklan-${chNama}`)?.value)||0,
    feePlatform : parseFloat(document.getElementById(`ops-fee-${chNama}`)?.value)||0,
    targetROAS  : parseFloat(document.getElementById(`ops-roas-${chNama}`)?.value)||0,
  };
  try { localStorage.setItem(key, JSON.stringify(data)); } catch(e) {}
  if (typeof toast === 'function') toast(`✅ Target ${chNama} tersimpan!`);
}

// Expose globals
window.renderPlanningKPI = renderPlanningKPI;
window.renderPlanningOps = renderPlanningOps;
window.savePlanningKPI   = savePlanningKPI;
window.saveOpsToko       = saveOpsToko;
window.PLAN              = PLAN;

})();
