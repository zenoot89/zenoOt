/* ═══════════════════════════════════════════════════════════════════
   intelligence_module.js — zenOt Operasional V2
   INTELLIGENCE LAYER — Level 2–5 Features
   
   ✅ SKU Breakdown Analisis (Full Funnel per SKU)
   ✅ Revenue Concentration Risk
   ✅ Dead Stock Alert + Inventory Intelligence
   ✅ Flash Sale ROI Calculator
   ✅ Unit Economics per SKU (CAC, LTV, Payback)
   ✅ Prediksi Stok Habis Otomatis
   ✅ Morning Briefing Otomatis
   ✅ Cash Flow Projection
   ✅ Repeat Buyer Rate
   ✅ Seasonality Detection
   ✅ MoM Growth per SKU
   ✅ Channel Efficiency
   
   Reads from: window.DB (app_core.js)
   Optional: window.rkData (financial_module.js)
   Optional: window.teData (trend_engine.js)
════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════
// NAVIGATION INTELLIGENCE
// ═══════════════════════════════════════════════════════
const INTEL_TITLES = {
  'intel-dashboard':  'Intelligence <span>Dashboard</span>',
  'intel-sku':        'SKU <span>Breakdown Analisis</span>',
  'intel-revenue':    'Revenue <span>Intelligence</span>',
  'intel-inventory':  'Inventory <span>Intelligence</span>',
  'intel-unit-econ':  'Unit <span>Economics</span>',
  'intel-flashsale':  'Flash Sale <span>ROI Calculator</span>',
  'intel-cashflow':   'Cash Flow <span>Projection</span>',
};

function goIntel(id, el) {
  // ── 1. Aktifkan main page intel (hanya page-intel-dashboard yg real) ──
  const mainPage = document.getElementById('page-intel-dashboard');
  if (mainPage && !mainPage.classList.contains('active')) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    mainPage.classList.add('active');
  }

  // ── 2. Update active state sidebar nav-item ──
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  // cari nav-item yang memiliki onclick mengandung id ini
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.getAttribute('onclick') && n.getAttribute('onclick').includes("'" + id + "'")) {
      n.classList.add('active');
    }
  });

  // ── 3. Switch intel tab buttons ──
  document.querySelectorAll('.intel-tab').forEach(t => t.classList.remove('active'));
  const tabBtn = document.getElementById('itab-' + id);
  if (tabBtn) tabBtn.classList.add('active');
  // jika dipanggil dari quick-action button (el bukan nav-item/intel-tab), tidak perlu set active
  if (el && el.classList.contains('intel-tab')) el.classList.add('active');

  // ── 4. Switch intel subpages ──
  document.querySelectorAll('.intel-subpage').forEach(p => p.classList.remove('active'));
  const subPage = document.getElementById('ipage-' + id);
  if (subPage) subPage.classList.add('active');

  // ── 5. Update page title topbar ──
  const ph = document.getElementById('ph');
  if (ph) ph.innerHTML = INTEL_TITLES[id] || id;

  // ── 6. Render konten sesuai tab ──
  const _intelRenders = {
    'intel-dashboard': renderIntelDashboard,
    'intel-sku':       typeof renderSKUAnalisis    === 'function' ? renderSKUAnalisis    : null,
    'intel-revenue':   typeof renderRevenueIntel   === 'function' ? renderRevenueIntel   : null,
    'intel-inventory': typeof renderInventoryIntel === 'function' ? renderInventoryIntel : null,
    'intel-unit-econ': typeof renderUnitEcon       === 'function' ? renderUnitEcon       : null,
    'intel-flashsale': typeof renderFlashSaleROI   === 'function' ? renderFlashSaleROI   : null,
    'intel-cashflow':  typeof renderCashflow       === 'function' ? renderCashflow       : null,
  };
  const renderFn = _intelRenders[id];
  if (renderFn) {
    try { renderFn(); }
    catch(e) {
      console.error('[goIntel render error] ' + id + ':', e);
      const sub = document.getElementById('ipage-' + id);
      if (sub) sub.innerHTML = '<div style="padding:40px;text-align:center;">' +
        '<div style="font-size:28px;margin-bottom:10px;">⚠️</div>' +
        '<div style="font-weight:700;color:var(--charcoal);margin-bottom:6px;">' + id + ' error</div>' +
        '<div style="font-size:12px;color:var(--dusty);margin-bottom:14px;font-family:monospace;">' + e.message + '</div>' +
        '<button class="btn btn-p btn-sm" onclick="goIntel(\'' + id + '\',null)">↺ Coba Lagi</button></div>';
    }
  }
}

// Helper: dipanggil dari sidebar — juga close sidebar di mobile
function goIntelFromSidebar(id, el) {
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (el) el.classList.add('active');
  goIntel(id, null);
  const overlay = document.querySelector('.sidebar-overlay');
  const sidebar = document.getElementById('sidebar');
  if (overlay && overlay.classList.contains('open')) {
    overlay.classList.remove('open');
    if (sidebar) sidebar.classList.remove('open');
  }
}

// ═══════════════════════════════════════════════════════
// HELPERS INTELLIGENCE
// ═══════════════════════════════════════════════════════
const fmtI = n => 'Rp ' + Number(n||0).toLocaleString('id-ID');
const fmtK = n => { // format ribuan ke "K" / "Jt"
  if (n >= 1000000) return (n/1000000).toFixed(1) + ' Jt';
  if (n >= 1000) return (n/1000).toFixed(0) + 'K';
  return String(Math.round(n));
};

function _getSKUSales(varName) {
  return DB.jurnal.filter(j => j.var === varName);
}

function _getSKUTotalQty(varName) {
  return _getSKUSales(varName).reduce((s, j) => s + (j.qty || 0), 0);
}

function _getSKURevenue(varName) {
  return _getSKUSales(varName).reduce((s, j) => s + (j.harga * j.qty || 0), 0);
}

function _getSKUModalKeluar(varName) {
  return _getSKUSales(varName).reduce((s, j) => s + (j.hpp * j.qty || 0), 0);
}

function _getAvgDailySales(varName) {
  const sales = _getSKUSales(varName);
  if (!sales.length) return 0;
  const dates = [...new Set(sales.map(j => j.tgl))].sort();
  if (dates.length < 2) return sales.reduce((s, j) => s + j.qty, 0);
  const d1 = new Date(dates[0]), d2 = new Date(dates[dates.length - 1]);
  const daysDiff = Math.max(1, (d2 - d1) / 86400000 + 1);
  return sales.reduce((s, j) => s + j.qty, 0) / daysDiff;
}

function _getDaysSinceLastSale(varName) {
  const sales = _getSKUSales(varName);
  if (!sales.length) return 999;
  const lastTgl = sales.map(j => j.tgl).sort().reverse()[0];
  const diff = (new Date() - new Date(lastTgl)) / 86400000;
  return Math.round(diff);
}

function _getTotalRevenue() {
  return DB.jurnal.reduce((s, j) => s + ((j.harga || 0) * (j.qty || 0)), 0);
}

function _getTotalModal() {
  return DB.jurnal.reduce((s, j) => s + ((j.hpp || 0) * (j.qty || 0)), 0);
}

// ═══════════════════════════════════════════════════════
// 1. INTELLIGENCE DASHBOARD
// ═══════════════════════════════════════════════════════
function renderIntelDashboard() {
  const container = document.getElementById('intel-dash-content');
  if (!container) return;
  try { _renderIntelDashboardInner(container); }
  catch(e) {
    console.error('[renderIntelDashboard]', e);
    container.innerHTML = '<div style="padding:30px;text-align:center;">' +
      '<div style="font-size:32px;margin-bottom:12px;">⚠️</div>' +
      '<div style="font-size:14px;font-weight:700;color:var(--charcoal);margin-bottom:8px;">Intelligence Dashboard Error</div>' +
      '<div style="font-size:12px;color:var(--dusty);margin-bottom:16px;">' + e.message + '</div>' +
      '<button class="btn btn-p" onclick="renderIntelDashboard()">↺ Coba Lagi</button>' +
      '</div>';
  }
}
function _renderIntelDashboardInner(container) {

  // ── Gunakan data terfilter per toko aktif ──
  const jurnalData = typeof getJurnalFiltered === 'function' ? getJurnalFiltered() : DB.jurnal;
  const tokoNama   = typeof getTokoAktifNama  === 'function' ? getTokoAktifNama()  : 'Semua Toko';

  // Kalkulasi semua alerts
  const totalModal = jurnalData.reduce((s, j) => s + ((j.hpp || 0) * (j.qty || 0)), 0);
  const totalRev   = jurnalData.reduce((s, j) => s + ((j.harga || 0) * (j.qty || 0)), 0);

  // Revenue concentration risk
  const revenueByInduk = {};
  jurnalData.forEach(j => {
    const p = DB.produk.find(x => x.var === j.var);
    const induk = p ? p.induk : j.var;
    revenueByInduk[induk] = (revenueByInduk[induk] || 0) + ((j.hpp || 0) * (j.qty || 0));
  });
  const revEntries = Object.entries(revenueByInduk).sort((a, b) => b[1] - a[1]);
  const topProduct = revEntries[0];
  const topPct = totalModal > 0 && topProduct ? (topProduct[1] / totalModal * 100) : 0;

  // Dead stock count
  const deadStock = DB.stok.filter(s => {
    const akhir = (s.awal || 0) + (s.masuk || 0) - (s.keluar || 0);
    const daysSince = _getDaysSinceLastSale(s.var);
    return akhir > 0 && daysSince > 30;
  });

  // Prediksi stok habis dalam 7 hari
  const criticalRestock = DB.stok.filter(s => {
    const akhir = (s.awal || 0) + (s.masuk || 0) - (s.keluar || 0);
    const avgDaily = _getAvgDailySales(s.var);
    if (avgDaily <= 0 || akhir <= 0) return false;
    const daysLeft = akhir / avgDaily;
    return daysLeft <= 7;
  });

  // Morning briefing
  const today = new Date().toISOString().split('T')[0];
  const todaySales = jurnalData.filter(j => j.tgl === today);
  const todayQty   = todaySales.reduce((s, j) => s + j.qty, 0);
  const todayModal = todaySales.reduce((s, j) => s + j.hpp * j.qty, 0);

  // Render alert cards
  const alerts = [];

  if (topPct >= 40) {
    alerts.push({ type: 'danger', icon: '🚨', title: 'Revenue Concentration Risk', msg: `<strong>${topProduct[0]}</strong> menyumbang <strong>${topPct.toFixed(0)}%</strong> dari total modal keluar. Risiko tinggi kalau produk ini slow!`, action: `goIntel('intel-revenue', null)`, actionLabel: 'Lihat Detail' });
  }

  if (criticalRestock.length > 0) {
    alerts.push({ type: 'warning', icon: '⚡', title: 'Prediksi Stok Habis ≤7 Hari', msg: `<strong>${criticalRestock.length} SKU</strong> akan habis dalam 7 hari berdasarkan rata-rata penjualan: ${criticalRestock.slice(0,3).map(s => s.var).join(', ')}${criticalRestock.length > 3 ? '...' : ''}`, action: `goIntel('intel-inventory', null)`, actionLabel: 'Restock Sekarang' });
  }

  if (deadStock.length > 0) {
    alerts.push({ type: 'info', icon: '📦', title: 'Dead Stock Alert', msg: `<strong>${deadStock.length} SKU</strong> punya stok tapi tidak bergerak >30 hari. Pertimbangkan flash sale atau clearance.`, action: `goIntel('intel-inventory', null)`, actionLabel: 'Lihat SKU' });
  }

  if (topPct < 40 && criticalRestock.length === 0 && deadStock.length === 0) {
    alerts.push({ type: 'success', icon: '✅', title: 'Semua Indikator Aman', msg: 'Tidak ada alert kritis saat ini. Bisnis berjalan normal!', action: null });
  }

  const alertsHTML = alerts.map(a => `
    <div class="intel-alert-card intel-alert-${a.type}">
      <div class="intel-alert-icon">${a.icon}</div>
      <div class="intel-alert-body">
        <div class="intel-alert-title">${a.title}</div>
        <div class="intel-alert-msg">${a.msg}</div>
        ${a.action ? `<button class="intel-btn-sm" onclick="${a.action}">→ ${a.actionLabel}</button>` : ''}
      </div>
    </div>
  `).join('');

  // Stats summary
  const statCards = [
    { label: 'Total Modal Keluar', val: fmtI(totalModal), sub: `${jurnalData.length} transaksi`, color: '#5C3D2E' },
    { label: 'SKU Aktif Terjual', val: `${new Set(jurnalData.map(j=>j.var)).size}`, sub: `dari ${DB.produk.length} SKU terdaftar`, color: '#5A7A6A' },
    { label: 'Dead Stock', val: `${deadStock.length} SKU`, sub: '>30 hari tidak bergerak', color: deadStock.length > 0 ? '#C0392B' : '#5A7A6A' },
    { label: 'Kritis Restock', val: `${criticalRestock.length} SKU`, sub: 'habis dalam 7 hari', color: criticalRestock.length > 0 ? '#C9A84C' : '#5A7A6A' },
  ];

  const statsHTML = statCards.map(c => `
    <div class="intel-stat-card">
      <div class="intel-stat-label">${c.label}</div>
      <div class="intel-stat-val" style="color:${c.color}">${c.val}</div>
      <div class="intel-stat-sub">${c.sub}</div>
    </div>
  `).join('');

  // Morning briefing
  const hour = new Date().getHours();
  const greeting = hour < 12 ? '🌅 Good Morning' : hour < 17 ? '☀️ Good Afternoon' : '🌙 Good Evening';
  const now = new Date();
  const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

  container.innerHTML = `
    <!-- Morning Briefing -->
    <div class="intel-briefing-card">
      <div class="intel-briefing-header">
        <div>
          <div class="intel-briefing-greeting">${greeting}</div>
          <div class="intel-briefing-date">${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}</div>
          <div style="margin-top:4px;display:inline-flex;align-items:center;gap:6px;background:var(--cream);padding:3px 10px;border-radius:20px;font-size:11px;color:var(--dusty);font-weight:600;">
            🏪 ${tokoNama}
          </div>
        </div>
        <div class="intel-briefing-today">
          <div class="intel-briefing-today-label">Transaksi Hari Ini</div>
          <div class="intel-briefing-today-val">${todayQty} pcs <span style="font-size:12px;opacity:.7">(${todaySales.length} trx)</span></div>
          <div class="intel-briefing-today-sub">${fmtI(todayModal)} modal keluar</div>
        </div>
      </div>
    </div>

    <!-- Alert Cards -->
    <div class="intel-section-title">🔔 Alert & Notifikasi</div>
    <div class="intel-alerts-wrap">${alertsHTML}</div>

    <!-- Stat Cards -->
    <div class="intel-section-title">📊 Overview Intelligence</div>
    <div class="intel-stats-grid">${statsHTML}</div>

    <!-- Quick Actions -->
    <div class="intel-section-title">⚡ Quick Actions</div>
    <div class="intel-quick-actions">
      <button class="intel-qa-btn" onclick="goIntel('intel-sku',null)">
        <span class="intel-qa-icon">🔬</span>
        <span class="intel-qa-label">SKU Breakdown</span>
        <span class="intel-qa-sub">Analisis funnel per SKU</span>
      </button>
      <button class="intel-qa-btn" onclick="goIntel('intel-revenue',null)">
        <span class="intel-qa-icon">💰</span>
        <span class="intel-qa-label">Revenue Intel</span>
        <span class="intel-qa-sub">Konsentrasi & tren</span>
      </button>
      <button class="intel-qa-btn" onclick="goIntel('intel-inventory',null)">
        <span class="intel-qa-icon">📦</span>
        <span class="intel-qa-label">Inventory Intel</span>
        <span class="intel-qa-sub">Prediksi & dead stock</span>
      </button>
      <button class="intel-qa-btn" onclick="goIntel('intel-unit-econ',null)">
        <span class="intel-qa-icon">📈</span>
        <span class="intel-qa-label">Unit Economics</span>
        <span class="intel-qa-sub">CAC, LTV, Payback</span>
      </button>
      <button class="intel-qa-btn" onclick="goIntel('intel-flashsale',null)">
        <span class="intel-qa-icon">⚡</span>
        <span class="intel-qa-label">Flash Sale ROI</span>
        <span class="intel-qa-sub">Hitung worth it nggak</span>
      </button>
      <button class="intel-qa-btn" onclick="goIntel('intel-cashflow',null)">
        <span class="intel-qa-icon">🔮</span>
        <span class="intel-qa-label">Cash Flow</span>
        <span class="intel-qa-sub">Proyeksi 30/60/90 hari</span>
      </button>
    </div>
  `;

}

// ═══════════════════════════════════════════════════════
// 2. SKU BREAKDOWN ANALISIS
// ═══════════════════════════════════════════════════════
let _skuSelectedVar = null;

function renderSKUAnalisis() {
  const container = document.getElementById('intel-sku-content');
  if (!container) return;

  // Kumpulkan semua SKU yang punya data
  const skuVars = [...new Set([
    ...DB.jurnal.map(j => j.var),
    ...DB.stok.map(s => s.var),
  ])].sort();

  if (!skuVars.length) {
    container.innerHTML = '<div class="intel-empty">Belum ada data SKU. Masukkan transaksi dulu di Jurnal Penjualan.</div>';
    return;
  }

  if (!_skuSelectedVar || !skuVars.includes(_skuSelectedVar)) {
    _skuSelectedVar = skuVars[0];
  }

  const optionsHTML = skuVars.map(v => `<option ${v === _skuSelectedVar ? 'selected' : ''}>${v}</option>`).join('');

  container.innerHTML = `
    <div class="intel-sku-selector">
      <label class="lbl">Pilih SKU untuk Dianalisis</label>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <select class="sel" id="sku-select-main" onchange="_skuSelectedVar=this.value;renderSKUDetail()" style="flex:1;min-width:200px">
          ${optionsHTML}
        </select>
        <button class="btn btn-p" onclick="renderSKUDetail()">🔍 Analisis</button>
      </div>
    </div>
    <div id="sku-detail-area" style="margin-top:20px;"></div>
  `;

  renderSKUDetail();
}

function renderSKUDetail() {
  const varName = _skuSelectedVar || document.getElementById('sku-select-main')?.value;
  if (!varName) return;
  _skuSelectedVar = varName;

  const area = document.getElementById('sku-detail-area');
  if (!area) return;

  const p = DB.produk.find(x => x.var === varName);
  const s = DB.stok.find(x => x.var === varName);
  const sales = _getSKUSales(varName);
  const totalQty = sales.reduce((t, j) => t + j.qty, 0);
  const totalModal = sales.reduce((t, j) => t + j.hpp * j.qty, 0);
  const hpp = p ? p.hpp : (s ? s.hpp : 0);
  const jual = p ? p.jual : 0;
  const akhir = s ? (s.awal + s.masuk - s.keluar) : 0;
  const avgDaily = _getAvgDailySales(varName);
  const daysLeft = avgDaily > 0 ? Math.round(akhir / avgDaily) : null;
  const daysSinceLast = _getDaysSinceLastSale(varName);

  // Get SKU data dari teData jika ada (Shopee data)
  const teRows = (typeof teData !== 'undefined' && teData.processedSKUs) ? teData.processedSKUs : [];
  const teSku = teRows.find(r => r.skuRef === varName || r.name === varName);

  // Funnel data — dari teData jika ada, fallback ke estimasi
  const views       = teSku ? (teSku.views || 0)      : 0;
  const clicks      = teSku ? (teSku.clicks || 0)     : 0;
  const keranjang   = teSku ? (teSku.keranjang || 0)  : 0;
  const beli        = teSku ? (teSku.salesQty || totalQty) : totalQty;
  const abandonCart = keranjang > beli ? keranjang - beli : 0;
  const bounceRate  = teSku ? (teSku.bounceRate || 0) : 0;
  const repeatRate  = teSku ? (teSku.repeatOrderRate || 0) : 0;
  const cancelRate  = teSku ? ((1 - (teSku.pesananSiapKirim||beli)/(teSku.pesananDibuat||beli))*100) : 0;

  // CTR & conversion
  const ctr    = views > 0 ? (clicks / views * 100).toFixed(2) : '—';
  const convKlik = clicks > 0 ? (beli / clicks * 100).toFixed(2) : '—';
  const convView = views > 0 ? (beli / views * 100).toFixed(3) : '—';

  // Health Score (0-100)
  let healthScore = 60; // baseline
  if (totalQty > 0) healthScore += 10;
  if (avgDaily > 0.5) healthScore += 10;
  if (daysSinceLast < 7) healthScore += 10;
  if (bounceRate > 50) healthScore -= 15;
  if (cancelRate > 10) healthScore -= 10;
  if (abandonCart > beli * 2) healthScore -= 10;
  if (akhir <= 0) healthScore -= 15;
  healthScore = Math.max(0, Math.min(100, healthScore));

  const healthColor = healthScore >= 70 ? '#2D6A4F' : healthScore >= 40 ? '#C9A84C' : '#C0392B';
  const healthLabel = healthScore >= 70 ? 'Sehat ✅' : healthScore >= 40 ? 'Perlu Perhatian ⚠️' : 'Kritis 🚨';

  // Diagnosis & Action
  const diagnosis = [];
  const actions = [];

  if (totalQty > 0 && avgDaily > 0) diagnosis.push({ ok: true, msg: 'Ada riwayat penjualan' });
  else { diagnosis.push({ ok: false, msg: 'Belum ada penjualan' }); actions.push('→ Cek listing & foto produk'); }

  if (views > 0 && parseFloat(ctr) >= 3) diagnosis.push({ ok: true, msg: `CTR bagus (${ctr}%)` });
  else if (views > 0) { diagnosis.push({ ok: false, msg: `CTR rendah (${ctr}%)` }); actions.push('→ Update thumbnail/foto lebih menarik'); }

  if (abandonCart > beli * 1.5 && beli > 0) {
    diagnosis.push({ ok: false, msg: `Abandon cart tinggi (${abandonCart} orang)` });
    actions.push('→ Kirim voucher ke abandon cart via Shopee CRM');
    actions.push('→ Flash sale 1-2 hari untuk convert');
  }

  if (bounceRate > 50) {
    diagnosis.push({ ok: false, msg: `Bounce rate tinggi (${bounceRate.toFixed(0)}%)` });
    actions.push('→ Perbaiki deskripsi & foto produk');
  }

  if (cancelRate > 10) {
    diagnosis.push({ ok: false, msg: `Cancel rate tinggi (${cancelRate.toFixed(1)}%)` });
    actions.push('→ Cek masalah stok / pengiriman');
  }

  if (akhir <= 0) {
    diagnosis.push({ ok: false, msg: 'Stok HABIS' });
    actions.push('→ Restock segera!');
  } else if (daysLeft !== null && daysLeft <= 7) {
    diagnosis.push({ ok: false, msg: `Stok akan habis ~${daysLeft} hari lagi` });
    actions.push(`→ Restock minimal ${Math.ceil(avgDaily * 30)} pcs`);
  } else if (akhir > 0) {
    diagnosis.push({ ok: true, msg: `Stok aman (${akhir} pcs, ~${daysLeft ? daysLeft+'hr' : '?'} lagi)` });
  }

  if (daysSinceLast > 30 && akhir > 0) {
    diagnosis.push({ ok: false, msg: `Tidak terjual ${daysSinceLast} hari (dead stock)` });
    actions.push('→ Flash sale / bundling / clearance');
  }

  if (repeatRate > 10) diagnosis.push({ ok: true, msg: `Repeat order bagus (${repeatRate.toFixed(1)}%)` });

  if (actions.length === 0) actions.push('→ Pertahankan performa! Monitor mingguan.');

  // Funnel bar visual
  const funnelSteps = [
    { label: 'Views', val: views, color: '#5C3D2E' },
    { label: 'Klik', val: clicks, color: '#5A7A6A' },
    { label: 'Keranjang', val: keranjang, color: '#C9A84C' },
    { label: 'Beli', val: beli, color: '#2D6A4F' },
    { label: 'Abandon ⚠️', val: abandonCart, color: '#C0392B' },
  ];
  const maxFunnel = Math.max(...funnelSteps.map(f => f.val), 1);
  const funnelHTML = funnelSteps.map(f => `
    <div class="sku-funnel-step">
      <div class="sku-funnel-label">${f.label}</div>
      <div class="sku-funnel-bar-wrap">
        <div class="sku-funnel-bar" style="width:${Math.max(4, f.val/maxFunnel*100)}%;background:${f.color}"></div>
      </div>
      <div class="sku-funnel-val">${f.val > 0 ? f.val.toLocaleString('id-ID') : views > 0 ? '—' : 'Input Shopee'}</div>
    </div>
  `).join('');

  // Channel breakdown
  const byChannel = {};
  sales.forEach(j => { byChannel[j.ch] = (byChannel[j.ch] || 0) + j.qty; });
  const channelRows = Object.entries(byChannel).sort((a,b) => b[1]-a[1]).map(([ch, qty]) =>
    `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-size:12px">
      <span>${ch}</span><span style="font-weight:700">${qty} pcs</span>
    </div>`).join('') || '<div style="color:var(--dusty);font-size:12px">Belum ada data</div>';

  area.innerHTML = `
    <!-- Header SKU -->
    <div class="sku-header-card">
      <div>
        <div class="sku-header-name">${varName}</div>
        <div class="sku-header-induk">${p ? p.induk : '—'} · HPP ${fmtI(hpp)}</div>
      </div>
      <div class="sku-health-badge" style="background:${healthColor}">
        <div class="sku-health-score">${healthScore}</div>
        <div class="sku-health-label">${healthLabel}</div>
      </div>
    </div>

    <div class="intel-2col">
      <!-- Funnel -->
      <div class="intel-card">
        <div class="intel-card-title">🎯 Conversion Funnel</div>
        ${views > 0 ? `
          <div style="margin-bottom:8px;font-size:11px;color:var(--dusty)">CTR: <strong>${ctr}%</strong> · View→Beli: <strong>${convView}%</strong> · Klik→Beli: <strong>${convKlik}%</strong></div>
        ` : `<div class="intel-tip">💡 Upload data Shopee di tab AI Strategy untuk melihat funnel lengkap. Data di bawah dari jurnal internal.</div>`}
        <div class="sku-funnel">${funnelHTML}</div>
      </div>

      <!-- Health Metrics -->
      <div class="intel-card">
        <div class="intel-card-title">❤️ Health Metrics</div>
        <div class="sku-metrics-grid">
          ${[
            ['Terjual Total', `${totalQty} pcs`],
            ['Modal Keluar', fmtI(totalModal)],
            ['Avg/Hari', avgDaily > 0 ? avgDaily.toFixed(1)+' pcs' : '—'],
            ['Stok Sisa', `${akhir} pcs`],
            ['Estimasi Habis', daysLeft !== null ? `~${daysLeft} hari` : '—'],
            ['Sejak Terakhir Jual', daysSinceLast < 999 ? `${daysSinceLast} hari lalu` : 'Belum pernah'],
            ['Bounce Rate', bounceRate > 0 ? bounceRate.toFixed(1)+'%' : '—'],
            ['Cancel Rate', cancelRate > 0 ? cancelRate.toFixed(1)+'%' : '—'],
            ['Repeat Order', repeatRate > 0 ? repeatRate.toFixed(1)+'%' : '—'],
            ['Abandon Cart', abandonCart > 0 ? abandonCart+' org' : '—'],
          ].map(([k,v]) => `<div class="sku-metric-item"><div class="sku-metric-label">${k}</div><div class="sku-metric-val">${v}</div></div>`).join('')}
        </div>
      </div>
    </div>

    <div class="intel-2col">
      <!-- Diagnosis -->
      <div class="intel-card">
        <div class="intel-card-title">🔍 Diagnosis Otomatis</div>
        ${diagnosis.map(d => `
          <div class="sku-diag-item">
            <span>${d.ok ? '✅' : '⚠️'}</span>
            <span style="font-size:13px;${d.ok ? '' : 'color:#C0392B'}">${d.msg}</span>
          </div>
        `).join('')}
      </div>

      <!-- Action Recommendation -->
      <div class="intel-card">
        <div class="intel-card-title">🚀 Action Recommendation</div>
        ${actions.map(a => `
          <div class="sku-action-item">
            <span style="font-size:13px;font-weight:500;color:#5C3D2E">${a}</span>
          </div>
        `).join('')}
        <div style="margin-top:12px;border-top:1px solid var(--border);padding-top:10px">
          <button class="btn btn-p btn-sm" onclick="openFlashSaleFromSKU('${varName}')">⚡ Hitung Flash Sale ROI</button>
        </div>
      </div>
    </div>

    <!-- Channel Breakdown -->
    <div class="intel-card">
      <div class="intel-card-title">🛒 Penjualan per Channel</div>
      ${channelRows}
    </div>
  `;
}

function openFlashSaleFromSKU(varName) {
  _skuSelectedVar = varName;
  goIntel('intel-flashsale', null);
  setTimeout(() => {
    const sel = document.getElementById('fs-sku-select');
    if (sel) { sel.value = varName; calcFlashSaleROI(); }
  }, 300);
}

// ═══════════════════════════════════════════════════════
// 3. REVENUE INTELLIGENCE
// ═══════════════════════════════════════════════════════
function renderRevenueIntel() {
  const container = document.getElementById('intel-revenue-content');
  if (!container) return;

  if (!DB.jurnal.length) {
    container.innerHTML = '<div class="intel-empty">Belum ada data jurnal penjualan.</div>';
    return;
  }

  // Revenue by SKU Induk
  const revByInduk = {};
  DB.jurnal.forEach(j => {
    const p = DB.produk.find(x => x.var === j.var);
    const induk = p ? p.induk : j.var;
    if (!revByInduk[induk]) revByInduk[induk] = { qty: 0, modal: 0, induk };
    revByInduk[induk].qty += j.qty;
    revByInduk[induk].modal += j.hpp * j.qty;
  });

  const totalModal = _getTotalModal();
  const revSorted = Object.values(revByInduk).sort((a, b) => b.modal - a.modal);

  // Revenue by Channel
  const revByCh = {};
  DB.jurnal.forEach(j => {
    const ch = j.ch || 'Unknown';
    if (!revByCh[ch]) revByCh[ch] = { qty: 0, modal: 0 };
    revByCh[ch].qty += j.qty;
    revByCh[ch].modal += j.hpp * j.qty;
  });
  const chSorted = Object.entries(revByCh).sort((a,b) => b[1].modal - a[1].modal);

  // Revenue by Date (tren harian)
  const revByDate = {};
  DB.jurnal.forEach(j => {
    if (!revByDate[j.tgl]) revByDate[j.tgl] = 0;
    revByDate[j.tgl] += j.hpp * j.qty;
  });
  const dateSorted = Object.entries(revByDate).sort((a,b) => a[0].localeCompare(b[0]));

  // Concentration Risk
  const top1 = revSorted[0];
  const top1Pct = totalModal > 0 && top1 ? (top1.modal / totalModal * 100) : 0;
  const top3Modal = revSorted.slice(0,3).reduce((s,r) => s + r.modal, 0);
  const top3Pct = totalModal > 0 ? (top3Modal / totalModal * 100) : 0;

  // Bar chart produk
  const maxModal = revSorted[0]?.modal || 1;
  const prodBarHTML = revSorted.slice(0, 8).map((r, i) => {
    const pct = r.modal / totalModal * 100;
    const barW = r.modal / maxModal * 100;
    const colors = ['#5C3D2E','#5A7A6A','#C9A84C','#C0392B','#3D7EAA','#8C7B6B','#7C3AED','#0D9488'];
    return `
      <div class="rev-bar-row">
        <div class="rev-bar-label">${r.induk}</div>
        <div class="rev-bar-track">
          <div class="rev-bar-fill" style="width:${barW}%;background:${colors[i%colors.length]}"></div>
        </div>
        <div class="rev-bar-info">
          <span class="rev-bar-pct">${pct.toFixed(1)}%</span>
          <span class="rev-bar-val">${fmtI(r.modal)}</span>
        </div>
      </div>`;
  }).join('');

  // Channel bar chart
  const maxCh = chSorted[0]?.[1]?.modal || 1;
  const chBarHTML = chSorted.map(([ch, d]) => {
    const pct = d.modal / totalModal * 100;
    const barW = d.modal / maxCh * 100;
    const cls = ch.toLowerCase().includes('laz') ? 'ch-l' : ch.toLowerCase().includes('tt') ? 'ch-t' : ch.toLowerCase().includes('off') ? 'ch-o' : 'ch-s';
    return `
      <div class="rev-bar-row">
        <div class="rev-bar-label"><span class="chtag ${cls}">${ch}</span></div>
        <div class="rev-bar-track">
          <div class="rev-bar-fill" style="width:${barW}%;background:#5C3D2E"></div>
        </div>
        <div class="rev-bar-info">
          <span class="rev-bar-pct">${pct.toFixed(1)}%</span>
          <span class="rev-bar-val">${d.qty} pcs</span>
        </div>
      </div>`;
  }).join('');

  // Risk level
  const riskLevel = top1Pct >= 60 ? { label: '🚨 SANGAT TINGGI', color: '#C0392B', bg: '#FEE2E2' }
                  : top1Pct >= 40 ? { label: '⚠️ TINGGI', color: '#d97706', bg: '#FEF3C7' }
                  : { label: '✅ AMAN', color: '#2D6A4F', bg: '#EFF7F3' };

  container.innerHTML = `
    <!-- Concentration Risk -->
    <div class="intel-card" style="border-left:4px solid ${riskLevel.color};background:${riskLevel.bg}20">
      <div class="intel-card-title">🎯 Revenue Concentration Risk</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
        <div style="text-align:center">
          <div style="font-size:32px;font-weight:800;color:${riskLevel.color}">${top1Pct.toFixed(0)}%</div>
          <div style="font-size:11px;color:var(--dusty)">${top1?.induk} mendominasi</div>
        </div>
        <div style="flex:1">
          <div class="intel-risk-badge" style="background:${riskLevel.bg};color:${riskLevel.color};border:1px solid ${riskLevel.color}">${riskLevel.label}</div>
          <div style="font-size:12px;margin-top:8px;color:#444">
            Top 1 produk: <strong>${top1Pct.toFixed(1)}%</strong> dari total modal keluar<br>
            Top 3 produk: <strong>${top3Pct.toFixed(1)}%</strong> dari total modal keluar
          </div>
          ${top1Pct >= 40 ? `<div style="margin-top:8px;font-size:12px;color:${riskLevel.color}">💡 Rekomendasi: Diversifikasikan ke produk lain. Ketergantungan >40% berisiko!</div>` : ''}
        </div>
      </div>
    </div>

    <div class="intel-2col">
      <!-- By Product -->
      <div class="intel-card">
        <div class="intel-card-title">📦 Modal Keluar per Produk</div>
        <div class="rev-total-label">Total: ${fmtI(totalModal)} · ${DB.jurnal.length} transaksi</div>
        <div class="rev-bars">${prodBarHTML}</div>
      </div>

      <!-- By Channel -->
      <div class="intel-card">
        <div class="intel-card-title">🛒 Distribusi per Channel</div>
        <div class="rev-bars">${chBarHTML || '<div class="intel-empty-sm">Belum ada data channel</div>'}</div>
      </div>
    </div>

    <!-- Tren Harian -->
    <div class="intel-card">
      <div class="intel-card-title">📈 Tren Modal Keluar Harian</div>
      ${dateSorted.length > 1 ? `
        <div class="rev-trend-chart" id="rev-trend-canvas-wrap">
          <canvas id="rev-trend-canvas" height="120"></canvas>
        </div>
      ` : '<div class="intel-empty-sm">Minimal 2 hari data untuk melihat tren</div>'}
    </div>

    <!-- SKU Detail Table -->
    <div class="intel-card">
      <div class="intel-card-title">📋 Detail per Induk Produk</div>
      <table class="intel-table">
        <thead><tr><th>Induk</th><th>Qty</th><th>Modal Keluar</th><th>Share %</th><th>Avg/Trx</th></tr></thead>
        <tbody>
          ${revSorted.map(r => `
            <tr>
              <td><strong>${r.induk}</strong></td>
              <td class="mono">${r.qty} pcs</td>
              <td class="mono">${fmtI(r.modal)}</td>
              <td><div class="mini-bar"><div style="width:${(r.modal/totalModal*100).toFixed(0)}%;background:var(--brown);height:100%;border-radius:2px"></div></div>${(r.modal/totalModal*100).toFixed(1)}%</td>
              <td class="mono">${fmtI(r.qty > 0 ? r.modal/r.qty : 0)}/pcs</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Draw tren chart
  if (dateSorted.length > 1) {
    requestAnimationFrame(() => drawRevTrendChart(dateSorted));
  }
}

function drawRevTrendChart(dateSorted) {
  const canvas = document.getElementById('rev-trend-canvas');
  if (!canvas) return;
  const wrap = document.getElementById('rev-trend-canvas-wrap');
  const W = wrap ? wrap.offsetWidth || 600 : 600;
  const H = 120;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const vals = dateSorted.map(d => d[1]);
  const labels = dateSorted.map(d => d[0].slice(8)); // day
  const max = Math.max(...vals, 1);
  const pad = { t: 10, r: 10, b: 24, l: 50 };
  const cw = W - pad.l - pad.r, ch = H - pad.t - pad.b;
  const n = vals.length;
  const xOf = i => pad.l + (i / (n-1)) * cw;
  const yOf = v => pad.t + ch - (v / max) * ch;
  // Grid
  ctx.strokeStyle = '#f0f0f0'; ctx.lineWidth = 1;
  [0.5, 1].forEach(f => {
    const y = pad.t + ch * (1-f);
    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l+cw, y); ctx.stroke();
    ctx.fillStyle = '#bbb'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(fmtK(max*f), pad.l - 4, y + 3);
  });
  // Fill
  ctx.beginPath();
  vals.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
  ctx.lineTo(xOf(n-1), pad.t+ch); ctx.lineTo(xOf(0), pad.t+ch); ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t+ch);
  grad.addColorStop(0, 'rgba(92,61,46,0.2)'); grad.addColorStop(1, 'rgba(92,61,46,0)');
  ctx.fillStyle = grad; ctx.fill();
  // Line
  ctx.beginPath(); ctx.strokeStyle = '#5C3D2E'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
  vals.forEach((v, i) => i === 0 ? ctx.moveTo(xOf(i), yOf(v)) : ctx.lineTo(xOf(i), yOf(v)));
  ctx.stroke();
  // Labels
  ctx.fillStyle = '#aaa'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
  const step = Math.ceil(n / 8);
  labels.forEach((l, i) => { if (i % step === 0) ctx.fillText(l, xOf(i), H - 6); });
}

// ═══════════════════════════════════════════════════════
// 4. INVENTORY INTELLIGENCE
// ═══════════════════════════════════════════════════════
function renderInventoryIntel() {
  const container = document.getElementById('intel-inventory-content');
  if (!container) return;

  const now = new Date();

  // Analisis per SKU stok
  const skuData = DB.stok.map(s => {
    const akhir = (s.awal || 0) + (s.masuk || 0) - (s.keluar || 0);
    const avgDaily = _getAvgDailySales(s.var);
    const daysLeft = avgDaily > 0 ? akhir / avgDaily : null;
    const daysSince = _getDaysSinceLastSale(s.var);
    const totalTerjual = _getSKUTotalQty(s.var);
    const p = DB.produk.find(x => x.var === s.var);
    const nilaiStok = akhir * s.hpp;

    // Reorder date estimation
    let reorderDate = null;
    if (daysLeft !== null && daysLeft <= 14) {
      const d = new Date(now);
      d.setDate(d.getDate() + Math.max(0, Math.floor(daysLeft)));
      reorderDate = d.toISOString().split('T')[0];
    }

    return { ...s, akhir, avgDaily, daysLeft, daysSince, totalTerjual, nilaiStok, reorderDate, p };
  });

  // Segmentasi
  const habis        = skuData.filter(s => s.akhir <= 0);
  const criticalSoon = skuData.filter(s => s.akhir > 0 && s.daysLeft !== null && s.daysLeft <= 7);
  const warnSoon     = skuData.filter(s => s.akhir > 0 && s.daysLeft !== null && s.daysLeft > 7 && s.daysLeft <= 14);
  const deadStock    = skuData.filter(s => s.akhir > 0 && s.daysSince > 30);
  const slowMoving   = skuData.filter(s => s.akhir > 0 && s.daysSince > 14 && s.daysSince <= 30);
  const healthy      = skuData.filter(s => s.akhir > 0 && (s.daysLeft === null || s.daysLeft > 14) && s.daysSince <= 14);

  // Total nilai stok
  const totalNilaiStok = skuData.reduce((s, r) => s + r.nilaiStok, 0);
  const deadStokNilai = deadStock.reduce((s, r) => s + r.nilaiStok, 0);

  const renderStokRows = (arr, emptyMsg) => {
    if (!arr.length) return `<div class="intel-empty-sm">${emptyMsg}</div>`;
    return arr.map(s => {
      const daysLabel = s.daysLeft !== null ? `~${Math.round(s.daysLeft)} hari` : (s.avgDaily <= 0 ? 'Tidak bergerak' : '—');
      const borderColor = s.akhir <= 0 ? '#C0392B' : s.daysLeft !== null && s.daysLeft <= 7 ? '#d97706' : '#C9A84C';
      return `
        <div class="inv-sku-row" style="border-left-color:${borderColor}">
          <div class="inv-sku-info">
            <div class="inv-sku-name">${s.var}</div>
            <div class="inv-sku-sub">${s.p?.induk||'—'} · Avg ${s.avgDaily.toFixed(1)} pcs/hari · Terjual ${s.totalTerjual} pcs</div>
          </div>
          <div class="inv-sku-stats">
            <div class="inv-sku-stat"><span class="inv-sku-stat-label">Sisa</span><span class="inv-sku-stat-val">${s.akhir}</span></div>
            <div class="inv-sku-stat"><span class="inv-sku-stat-label">Habis</span><span class="inv-sku-stat-val">${daysLabel}</span></div>
            ${s.reorderDate ? `<div class="inv-sku-stat"><span class="inv-sku-stat-label">Reorder</span><span class="inv-sku-stat-val" style="color:#C0392B">${s.reorderDate}</span></div>` : ''}
          </div>
          <div style="margin-top:6px">
            <button class="btn btn-p btn-sm" onclick="openModal('modal-restock-quick')">+ Restock</button>
          </div>
        </div>`;
    }).join('');
  };

  container.innerHTML = `
    <!-- Overview Cards -->
    <div class="intel-stats-grid">
      <div class="intel-stat-card">
        <div class="intel-stat-label">Total Nilai Stok</div>
        <div class="intel-stat-val" style="color:#5C3D2E">${fmtI(totalNilaiStok)}</div>
        <div class="intel-stat-sub">${skuData.length} SKU total</div>
      </div>
      <div class="intel-stat-card">
        <div class="intel-stat-label">Stok Habis</div>
        <div class="intel-stat-val" style="color:#C0392B">${habis.length} SKU</div>
        <div class="intel-stat-sub">Perlu restock sekarang</div>
      </div>
      <div class="intel-stat-card">
        <div class="intel-stat-label">Kritis ≤7 Hari</div>
        <div class="intel-stat-val" style="color:#d97706">${criticalSoon.length} SKU</div>
        <div class="intel-stat-sub">Hampir habis</div>
      </div>
      <div class="intel-stat-card">
        <div class="intel-stat-label">Dead Stock</div>
        <div class="intel-stat-val" style="color:#C0392B">${deadStock.length} SKU</div>
        <div class="intel-stat-sub">${fmtI(deadStokNilai)} tertanam</div>
      </div>
    </div>

    <!-- Kritis Habis -->
    ${habis.length ? `
    <div class="intel-card">
      <div class="intel-card-title" style="color:#C0392B">🚨 Stok HABIS — Restock Segera</div>
      ${renderStokRows(habis, '')}
    </div>` : ''}

    <!-- Kritis ≤7 Hari -->
    ${criticalSoon.length ? `
    <div class="intel-card">
      <div class="intel-card-title" style="color:#d97706">⚡ Prediksi Habis ≤7 Hari</div>
      ${renderStokRows(criticalSoon, '')}
    </div>` : ''}

    <!-- Warning 7-14 Hari -->
    ${warnSoon.length ? `
    <div class="intel-card">
      <div class="intel-card-title" style="color:#C9A84C">⚠️ Perlu Perhatian (7–14 Hari)</div>
      ${renderStokRows(warnSoon, '')}
    </div>` : ''}

    <!-- Dead Stock -->
    <div class="intel-card">
      <div class="intel-card-title">💀 Dead Stock Alert (>30 hari tidak bergerak)</div>
      ${deadStock.length ? `
        <div class="intel-tip">💡 SKU ini punya stok tapi tidak terjual >30 hari. Total modal tertanam: <strong>${fmtI(deadStokNilai)}</strong>. Pertimbangkan: flash sale, bundling, atau clearance.</div>
        ${renderStokRows(deadStock, '')}
      ` : '<div class="intel-empty-sm">✅ Tidak ada dead stock saat ini!</div>'}
    </div>

    <!-- Inventory Turnover -->
    <div class="intel-card">
      <div class="intel-card-title">📊 Inventory Turnover per SKU</div>
      <table class="intel-table">
        <thead><tr><th>SKU</th><th>Sisa Stok</th><th>Terjual</th><th>Avg/Hari</th><th>Est. Habis</th><th>Status</th></tr></thead>
        <tbody>
          ${skuData.filter(s => s.totalTerjual > 0 || s.akhir > 0).sort((a,b) => {
            if (a.akhir <= 0 && b.akhir > 0) return -1;
            if (b.akhir <= 0 && a.akhir > 0) return 1;
            return (a.daysLeft||999) - (b.daysLeft||999);
          }).slice(0, 20).map(s => {
            const status = s.akhir <= 0 ? '<span class="badge br">Habis</span>'
                         : s.daysLeft !== null && s.daysLeft <= 7 ? '<span class="badge bo">Kritis</span>'
                         : s.daysSince > 30 ? '<span class="badge bd">Dead</span>'
                         : '<span class="badge bg">Aman</span>';
            return `<tr>
              <td><strong>${s.var}</strong></td>
              <td class="mono">${s.akhir}</td>
              <td class="mono">${s.totalTerjual}</td>
              <td class="mono">${s.avgDaily > 0 ? s.avgDaily.toFixed(1) : '—'}</td>
              <td class="mono">${s.daysLeft !== null ? '~'+Math.round(s.daysLeft)+' hr' : '—'}</td>
              <td>${status}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
// 5. UNIT ECONOMICS
// ═══════════════════════════════════════════════════════
function renderUnitEcon() {
  const container = document.getElementById('intel-unit-econ-content');
  if (!container) return;

  if (!DB.jurnal.length) {
    container.innerHTML = '<div class="intel-empty">Belum ada data jurnal. Masukkan transaksi dulu.</div>';
    return;
  }

  // Per-SKU unit economics
  const soldVars = [...new Set(DB.jurnal.map(j => j.var))];

  const unitData = soldVars.map(varName => {
    const p = DB.produk.find(x => x.var === varName);
    const sales = _getSKUSales(varName);
    const totalQty = sales.reduce((s, j) => s + j.qty, 0);
    const totalModal = sales.reduce((s, j) => s + j.hpp * j.qty, 0);
    const hpp = p ? p.hpp : (totalModal / Math.max(totalQty, 1));
    const jual = p ? p.jual : 0;

    // Harga jual aktual dari jurnal (ambil yang ada harga > 0, kalau semua 0 pakai data produk)
    const withHarga = sales.filter(j => j.harga > 0);
    const avgJual = withHarga.length > 0
      ? withHarga.reduce((s,j) => s + j.harga, 0) / withHarga.length
      : jual;

    // Estimasi ads cost per unit (ambil dari rkData jika ada, proporsi)
    const adsBudget = (typeof rkData !== 'undefined' && rkData.iklanTotal > 0) ? rkData.iklanTotal : 0;
    const totalJurnalQty = DB.jurnal.reduce((s,j) => s+j.qty, 0);
    const adsPerUnit = totalJurnalQty > 0 && adsBudget > 0 ? (adsBudget / totalJurnalQty) : 0;

    // Estimasi Shopee fee (default 8.5% dari harga jual)
    const shopeeFeePct = 0.085;
    const shopeeFeePerUnit = avgJual * shopeeFeePct;

    // Margin per unit
    const revenuePerUnit = avgJual;
    const cogsPerUnit = hpp;
    const grossMarginPerUnit = revenuePerUnit - cogsPerUnit;
    const netMarginPerUnit = grossMarginPerUnit - shopeeFeePerUnit - adsPerUnit;
    const gpm = revenuePerUnit > 0 ? (grossMarginPerUnit / revenuePerUnit * 100) : 0;
    const npm = revenuePerUnit > 0 ? (netMarginPerUnit / revenuePerUnit * 100) : 0;

    // Payback period (dalam pcs yang harus terjual untuk BEP biaya tetap)
    // Simple: berapa pcs untuk balik modal HPP batch terakhir
    const s = DB.stok.find(x => x.var === varName);
    const totalStokInvestasi = s ? ((s.awal + s.masuk) * hpp) : (totalModal);
    const paybackPcs = netMarginPerUnit > 0 ? Math.ceil(totalStokInvestasi / netMarginPerUnit) : null;
    const paybackDays = paybackPcs && _getAvgDailySales(varName) > 0 ? Math.ceil(paybackPcs / _getAvgDailySales(varName)) : null;

    // LTV estimation (repeat order * nilai per order)
    const repeatRate = 0.05; // default 5% repeat (diambil dari teData jika ada)
    const teRow = (typeof teData !== 'undefined' && teData.processedSKUs) ? teData.processedSKUs.find(r => r.skuRef === varName || r.name === varName) : null;
    const actualRepeatRate = teRow ? (teRow.repeatOrderRate || repeatRate * 100) / 100 : repeatRate;
    const avgOrdersPerBuyer = 1 + actualRepeatRate * 3; // simplifikasi
    const ltv = avgJual * avgOrdersPerBuyer * (1 - shopeeFeePct - hpp/avgJual);

    return {
      varName, p, totalQty, totalModal, hpp, avgJual, gpm, npm,
      grossMarginPerUnit, netMarginPerUnit, shopeeFeePerUnit, adsPerUnit,
      paybackPcs, paybackDays, ltv, ltv_cac_ratio: adsPerUnit > 0 ? ltv / adsPerUnit : null,
    };
  }).filter(d => d.totalQty > 0).sort((a, b) => b.npm - a.npm);

  container.innerHTML = `
    <div class="intel-tip">
      💡 <strong>Unit Economics</strong> dihitung dari: HPP aktual jurnal + estimasi Shopee fee 8.5% + distribusi iklan proporsional
      ${(typeof rkData !== 'undefined' && rkData.iklanTotal > 0) ? `· <span style="color:var(--sage)">✅ Budget iklan terdeteksi: ${fmtI(rkData.iklanTotal)}</span>` : '· <span style="color:var(--dusty)">⚠️ Upload data iklan di Rasio Keuangan untuk hasil akurat</span>'}
    </div>

    <div class="intel-card">
      <div class="intel-card-title">📊 Unit Economics per SKU</div>
      <div style="overflow-x:auto">
        <table class="intel-table">
          <thead>
            <tr>
              <th>SKU</th>
              <th>HPP/pcs</th>
              <th>Jual/pcs</th>
              <th>Gross Margin</th>
              <th>Net Margin</th>
              <th>GPM%</th>
              <th>NPM%</th>
              <th>Payback</th>
            </tr>
          </thead>
          <tbody>
            ${unitData.map(d => `
              <tr>
                <td>
                  <strong>${d.varName}</strong>
                  <div style="font-size:10px;color:var(--dusty)">${d.p?.induk||'—'} · ${d.totalQty} pcs terjual</div>
                </td>
                <td class="mono">${fmtI(d.hpp)}</td>
                <td class="mono">${d.avgJual > 0 ? fmtI(d.avgJual) : '—'}</td>
                <td class="mono" style="color:${d.grossMarginPerUnit >= 0 ? '#2D6A4F' : '#C0392B'}">${fmtI(d.grossMarginPerUnit)}</td>
                <td class="mono" style="color:${d.netMarginPerUnit >= 0 ? '#2D6A4F' : '#C0392B'}">${fmtI(d.netMarginPerUnit)}</td>
                <td><span class="badge ${d.gpm >= 40 ? 'bg' : d.gpm >= 25 ? 'bo' : 'br'}">${d.gpm.toFixed(1)}%</span></td>
                <td><span class="badge ${d.npm >= 15 ? 'bg' : d.npm >= 5 ? 'bo' : 'br'}">${d.npm.toFixed(1)}%</span></td>
                <td class="mono" style="font-size:11px">
                  ${d.paybackDays !== null ? `~${d.paybackDays} hari` : d.paybackPcs !== null ? `~${d.paybackPcs} pcs` : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Break Even Per SKU -->
    <div class="intel-2col">
      ${unitData.slice(0, 4).map(d => `
        <div class="intel-card">
          <div class="intel-card-title">📐 BEP — ${d.varName}</div>
          <div class="unit-econ-grid">
            <div class="unit-econ-item">
              <div class="unit-econ-label">Harga Jual Aktual</div>
              <div class="unit-econ-val">${d.avgJual > 0 ? fmtI(d.avgJual) : '—'}</div>
            </div>
            <div class="unit-econ-item">
              <div class="unit-econ-label">HPP</div>
              <div class="unit-econ-val">${fmtI(d.hpp)}</div>
            </div>
            <div class="unit-econ-item">
              <div class="unit-econ-label">Shopee Fee ~8.5%</div>
              <div class="unit-econ-val" style="color:#C0392B">-${fmtI(d.shopeeFeePerUnit)}</div>
            </div>
            <div class="unit-econ-item">
              <div class="unit-econ-label">Iklan/pcs (est.)</div>
              <div class="unit-econ-val" style="color:#C0392B">-${fmtI(d.adsPerUnit)}</div>
            </div>
            <div class="unit-econ-item">
              <div class="unit-econ-label">Net Margin/pcs</div>
              <div class="unit-econ-val" style="color:${d.netMarginPerUnit>=0?'#2D6A4F':'#C0392B'};font-size:18px;font-weight:800">${fmtI(d.netMarginPerUnit)}</div>
            </div>
            <div class="unit-econ-item">
              <div class="unit-econ-label">Payback Period</div>
              <div class="unit-econ-val">${d.paybackDays ? '~'+d.paybackDays+' hari' : '—'}</div>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
// 6. FLASH SALE ROI CALCULATOR
// ═══════════════════════════════════════════════════════
function renderFlashSaleROI() {
  const container = document.getElementById('intel-flashsale-content');
  if (!container) return;

  const skuOptions = [...new Set(DB.jurnal.map(j => j.var))].sort();

  container.innerHTML = `
    <div class="intel-card">
      <div class="intel-card-title">⚡ Flash Sale ROI Calculator</div>
      <div class="intel-tip">Hitung apakah flash sale worth it dengan mempertimbangkan margin, volume yang diharapkan, dan biaya iklan flash sale.</div>

      <div class="form-row">
        <div class="fg">
          <label class="lbl">SKU Produk</label>
          <select class="sel" id="fs-sku-select" onchange="autoFillFlashSale()">
            <option value="">-- Pilih SKU --</option>
            ${skuOptions.map(v => `<option value="${v}" ${v === _skuSelectedVar ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
        </div>
        <div class="fg">
          <label class="lbl">Harga Normal (HPP+margin)</label>
          <input class="inp" id="fs-harga-normal" type="number" placeholder="129900" oninput="calcFlashSaleROI()">
        </div>
      </div>

      <div class="form-row">
        <div class="fg">
          <label class="lbl">Harga Flash Sale</label>
          <input class="inp" id="fs-harga-sale" type="number" placeholder="99900" oninput="calcFlashSaleROI()">
        </div>
        <div class="fg">
          <label class="lbl">HPP per pcs</label>
          <input class="inp" id="fs-hpp" type="number" placeholder="55850" oninput="calcFlashSaleROI()">
        </div>
      </div>

      <div class="form-row">
        <div class="fg">
          <label class="lbl">Target Volume Terjual</label>
          <input class="inp" id="fs-target-qty" type="number" placeholder="30" oninput="calcFlashSaleROI()">
        </div>
        <div class="fg">
          <label class="lbl">Biaya Iklan Flash Sale (opsional)</label>
          <input class="inp" id="fs-biaya-iklan" type="number" placeholder="0" oninput="calcFlashSaleROI()">
        </div>
      </div>

      <div class="form-row">
        <div class="fg">
          <label class="lbl">Estimasi % Increase Volume (vs normal)</label>
          <input class="inp" id="fs-volume-boost" type="number" placeholder="150" oninput="calcFlashSaleROI()">
          <div style="font-size:11px;color:var(--dusty);margin-top:3px">Contoh: 150 = volume naik 150% saat flash sale</div>
        </div>
        <div class="fg">
          <label class="lbl">Durasi Flash Sale (hari)</label>
          <input class="inp" id="fs-durasi" type="number" placeholder="1" oninput="calcFlashSaleROI()">
        </div>
      </div>

      <button class="btn btn-p" onclick="calcFlashSaleROI()">⚡ Hitung ROI</button>
    </div>

    <div id="fs-result-area" style="margin-top:16px"></div>
  `;

  // Auto-fill jika ada SKU terpilih
  setTimeout(() => autoFillFlashSale(), 100);
}

function autoFillFlashSale() {
  const sel = document.getElementById('fs-sku-select');
  if (!sel || !sel.value) return;
  const varName = sel.value;
  const p = DB.produk.find(x => x.var === varName);
  if (p) {
    const hppEl = document.getElementById('fs-hpp');
    const hargaEl = document.getElementById('fs-harga-normal');
    if (hppEl) hppEl.value = p.hpp;
    if (hargaEl && p.jual > 0) hargaEl.value = p.jual;
    calcFlashSaleROI();
  }
}

function calcFlashSaleROI() {
  const area = document.getElementById('fs-result-area');
  const varName = document.getElementById('fs-sku-select')?.value;
  const hargaNormal = parseFloat(document.getElementById('fs-harga-normal')?.value) || 0;
  const hargaSale = parseFloat(document.getElementById('fs-harga-sale')?.value) || 0;
  const hpp = parseFloat(document.getElementById('fs-hpp')?.value) || 0;
  const targetQty = parseFloat(document.getElementById('fs-target-qty')?.value) || 0;
  const biayaIklan = parseFloat(document.getElementById('fs-biaya-iklan')?.value) || 0;
  const volumeBoost = parseFloat(document.getElementById('fs-volume-boost')?.value) || 100;
  const durasi = parseFloat(document.getElementById('fs-durasi')?.value) || 1;

  if (!area) return;
  if (!hargaSale || !hpp || !targetQty) {
    area.innerHTML = '<div class="intel-tip">Isi semua field di atas untuk melihat hasil kalkulasi.</div>';
    return;
  }

  // Kalkulasi
  const diskon = hargaNormal > 0 ? ((hargaNormal - hargaSale) / hargaNormal * 100) : 0;
  const shopeeFeePct = 0.085;
  const shopeeFeeNormal = hargaNormal * shopeeFeePct;
  const shoppeFeSale = hargaSale * shopeeFeePct;

  const marginNormal = hargaNormal - hpp - shopeeFeeNormal;
  const marginSale = hargaSale - hpp - shoppeFeSale;

  // Volume estimasi tanpa flash sale (dari data aktual)
  const avgDaily = varName ? _getAvgDailySales(varName) : 0;
  const normalVolumeInDurasi = avgDaily * durasi;
  const saleVolumeEst = Math.max(targetQty, normalVolumeInDurasi * (1 + volumeBoost / 100));

  // Revenue comparison
  const revNormal = hargaNormal * normalVolumeInDurasi - hpp * normalVolumeInDurasi - shopeeFeeNormal * normalVolumeInDurasi;
  const revSale = hargaSale * saleVolumeEst - hpp * saleVolumeEst - shoppeFeSale * saleVolumeEst - biayaIklan;

  const roiFlashSale = biayaIklan > 0 ? ((revSale) / biayaIklan) : null;
  const isWorthIt = marginSale > 0 && revSale > revNormal;
  const breakEvenQty = biayaIklan > 0 && marginSale > 0 ? Math.ceil(biayaIklan / marginSale) : null;

  const verdict = marginSale <= 0
    ? { label: '🚫 RUGI — Harga flash sale di bawah modal!', color: '#C0392B', bg: '#FEE2E2' }
    : isWorthIt
    ? { label: '✅ WORTH IT — Flash sale menguntungkan!', color: '#2D6A4F', bg: '#EFF7F3' }
    : { label: '⚠️ MARGINAL — Volume boost kurang signifikan', color: '#d97706', bg: '#FEF3C7' };

  area.innerHTML = `
    <div class="intel-card" style="border-left:4px solid ${verdict.color};background:${verdict.bg}20">
      <div class="intel-card-title">📊 Hasil Kalkulasi Flash Sale</div>
      <div class="intel-risk-badge" style="background:${verdict.bg};color:${verdict.color};border:1px solid ${verdict.color};margin-bottom:16px">${verdict.label}</div>

      <div class="fs-result-grid">
        <div class="fs-compare-col">
          <div class="fs-col-header">Normal (${durasi} hari)</div>
          <div class="fs-metric"><span>Harga Jual</span><strong>${fmtI(hargaNormal)}</strong></div>
          <div class="fs-metric"><span>Volume Est.</span><strong>${normalVolumeInDurasi.toFixed(1)} pcs</strong></div>
          <div class="fs-metric"><span>Shopee Fee</span><strong style="color:#C0392B">-${fmtI(shopeeFeeNormal)}/pcs</strong></div>
          <div class="fs-metric"><span>Margin/pcs</span><strong style="color:${marginNormal>=0?'#2D6A4F':'#C0392B'}">${fmtI(marginNormal)}</strong></div>
          <div class="fs-metric"><span>Total Laba Est.</span><strong style="color:${revNormal>=0?'#2D6A4F':'#C0392B'};font-size:15px">${fmtI(revNormal)}</strong></div>
        </div>
        <div class="fs-vs">VS</div>
        <div class="fs-compare-col" style="background:#f8fdf9;border-radius:10px;padding:12px">
          <div class="fs-col-header" style="color:#2D6A4F">Flash Sale ⚡</div>
          <div class="fs-metric"><span>Harga Sale</span><strong style="color:#C0392B">${fmtI(hargaSale)} (-${diskon.toFixed(0)}%)</strong></div>
          <div class="fs-metric"><span>Volume Target</span><strong>${saleVolumeEst.toFixed(0)} pcs</strong></div>
          <div class="fs-metric"><span>Shopee Fee</span><strong style="color:#C0392B">-${fmtI(shoppeFeSale)}/pcs</strong></div>
          <div class="fs-metric"><span>Margin/pcs</span><strong style="color:${marginSale>=0?'#2D6A4F':'#C0392B'}">${fmtI(marginSale)}</strong></div>
          <div class="fs-metric"><span>Biaya Iklan</span><strong style="color:#C0392B">-${fmtI(biayaIklan)}</strong></div>
          <div class="fs-metric"><span>Total Laba Est.</span><strong style="color:${revSale>=0?'#2D6A4F':'#C0392B'};font-size:15px">${fmtI(revSale)}</strong></div>
        </div>
      </div>

      <div class="fs-extra-metrics">
        ${roiFlashSale !== null ? `<div class="fs-extra-item"><span>ROAS Flash Sale</span><strong style="color:${roiFlashSale>=3?'#2D6A4F':'#C0392B'}">${roiFlashSale.toFixed(2)}×</strong></div>` : ''}
        ${breakEvenQty ? `<div class="fs-extra-item"><span>BEP Volume</span><strong>${breakEvenQty} pcs untuk balik iklan</strong></div>` : ''}
        <div class="fs-extra-item"><span>Increment Laba</span><strong style="color:${(revSale-revNormal)>=0?'#2D6A4F':'#C0392B'}">${fmtI(revSale-revNormal)} vs normal</strong></div>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
// 7. CASH FLOW PROJECTION
// ═══════════════════════════════════════════════════════
function renderCashflow() {
  const container = document.getElementById('intel-cashflow-content');
  if (!container) return;

  // Estimasi dari data historis
  const avgDailyModal = DB.jurnal.length > 0 ? (() => {
    const dates = [...new Set(DB.jurnal.map(j => j.tgl))].sort();
    if (dates.length < 2) return DB.jurnal.reduce((s,j) => s+j.hpp*j.qty, 0);
    const d1 = new Date(dates[0]), d2 = new Date(dates[dates.length-1]);
    const days = Math.max(1, (d2-d1)/86400000 + 1);
    return DB.jurnal.reduce((s,j) => s+j.hpp*j.qty, 0) / days;
  })() : 0;

  // Estimasi pengeluaran dari rkData jika ada
  const monthlyOpr = (typeof rkData !== 'undefined') ? (rkData.oprTotal || 0) : 0;
  const monthlyIklan = (typeof rkData !== 'undefined') ? (rkData.iklanTotal || 0) : 0;
  const dailyOpr = (monthlyOpr + monthlyIklan) / 30;

  container.innerHTML = `
    <div class="intel-card">
      <div class="intel-card-title">🔮 Cash Flow Projection</div>
      <div class="intel-tip">Proyeksi berdasarkan rata-rata penjualan harian dari jurnal + data keuangan (jika tersedia)</div>

      <div class="form-row">
        <div class="fg">
          <label class="lbl">Modal Keluar/Hari (rata-rata aktual)</label>
          <input class="inp" id="cf-daily-in" type="number" value="${Math.round(avgDailyModal)}" oninput="calcCashflow()">
        </div>
        <div class="fg">
          <label class="lbl">Harga Jual/Hari (estimasi)</label>
          <input class="inp" id="cf-daily-rev" type="number" placeholder="0" oninput="calcCashflow()">
        </div>
      </div>
      <div class="form-row">
        <div class="fg">
          <label class="lbl">Biaya Operasional/Bulan</label>
          <input class="inp" id="cf-opr" type="number" value="${Math.round(monthlyOpr)}" oninput="calcCashflow()">
        </div>
        <div class="fg">
          <label class="lbl">Biaya Iklan/Bulan</label>
          <input class="inp" id="cf-iklan" type="number" value="${Math.round(monthlyIklan)}" oninput="calcCashflow()">
        </div>
      </div>
      <div class="form-row">
        <div class="fg">
          <label class="lbl">Biaya Restock/Bulan (est.)</label>
          <input class="inp" id="cf-restock" type="number" placeholder="0" oninput="calcCashflow()">
        </div>
        <div class="fg">
          <label class="lbl">Kas Awal (saldo saat ini)</label>
          <input class="inp" id="cf-kas-awal" type="number" placeholder="0" oninput="calcCashflow()">
        </div>
      </div>
      <button class="btn btn-p" onclick="calcCashflow()">🔮 Proyeksikan</button>
    </div>
    <div id="cf-result-area" style="margin-top:16px"></div>
  `;

  // Auto-calc if there's data
  if (avgDailyModal > 0) setTimeout(() => calcCashflow(), 200);
}

function calcCashflow() {
  const area = document.getElementById('cf-result-area');
  if (!area) return;

  const dailyModal = parseFloat(document.getElementById('cf-daily-in')?.value) || 0;
  const dailyRev   = parseFloat(document.getElementById('cf-daily-rev')?.value) || 0;
  const monthlyOpr = parseFloat(document.getElementById('cf-opr')?.value) || 0;
  const monthlyIklan = parseFloat(document.getElementById('cf-iklan')?.value) || 0;
  const monthlyRestock = parseFloat(document.getElementById('cf-restock')?.value) || 0;
  const kasAwal    = parseFloat(document.getElementById('cf-kas-awal')?.value) || 0;

  const dailyOpr = (monthlyOpr + monthlyIklan + monthlyRestock) / 30;
  const dailyNet = dailyRev - dailyModal - dailyOpr;

  // Proyeksi 30, 60, 90 hari
  const periods = [
    { label: '30 Hari', days: 30 },
    { label: '60 Hari', days: 60 },
    { label: '90 Hari', days: 90 },
  ];

  const projections = periods.map(p => {
    const totalMasuk = dailyRev * p.days;
    const totalKeluar = (dailyModal + dailyOpr) * p.days;
    const netFlow = dailyNet * p.days;
    const endKas = kasAwal + netFlow;
    return { ...p, totalMasuk, totalKeluar, netFlow, endKas };
  });

  area.innerHTML = `
    <div class="intel-stats-grid">
      ${projections.map(p => `
        <div class="intel-stat-card" style="${p.endKas < 0 ? 'border-left:3px solid #C0392B' : ''}">
          <div class="intel-stat-label">Proyeksi ${p.label}</div>
          <div class="intel-stat-val" style="color:${p.netFlow >= 0 ? '#2D6A4F' : '#C0392B'}">${fmtI(p.endKas)}</div>
          <div class="intel-stat-sub">
            Masuk: ${fmtI(p.totalMasuk)}<br>
            Keluar: ${fmtI(p.totalKeluar)}<br>
            Net: <strong style="color:${p.netFlow>=0?'#2D6A4F':'#C0392B'}">${fmtI(p.netFlow)}</strong>
          </div>
        </div>
      `).join('')}
    </div>

    <div class="intel-card">
      <div class="intel-card-title">📊 Detail Cash Flow Harian</div>
      <table class="intel-table">
        <thead><tr><th>Komponen</th><th>/Hari</th><th>/Bulan</th></tr></thead>
        <tbody>
          <tr><td>💵 Estimasi Pendapatan</td><td class="mono" style="color:#2D6A4F">${fmtI(dailyRev)}</td><td class="mono" style="color:#2D6A4F">${fmtI(dailyRev*30)}</td></tr>
          <tr><td>📦 Modal Keluar (HPP)</td><td class="mono" style="color:#C0392B">-${fmtI(dailyModal)}</td><td class="mono" style="color:#C0392B">-${fmtI(dailyModal*30)}</td></tr>
          <tr><td>⚙️ Operasional + Iklan</td><td class="mono" style="color:#C0392B">-${fmtI(dailyOpr)}</td><td class="mono" style="color:#C0392B">-${fmtI(monthlyOpr+monthlyIklan+monthlyRestock)}</td></tr>
          <tr style="background:#f8f8f8;font-weight:700"><td>📈 Net Cash Flow</td><td class="mono" style="color:${dailyNet>=0?'#2D6A4F':'#C0392B'}">${fmtI(dailyNet)}</td><td class="mono" style="color:${dailyNet>=0?'#2D6A4F':'#C0392B'}">${fmtI(dailyNet*30)}</td></tr>
        </tbody>
      </table>
      ${dailyNet < 0 ? `<div class="intel-tip" style="background:#FEE2E2;border-color:#C0392B;color:#C0392B;margin-top:10px">⚠️ Cash flow negatif! Tingkatkan penjualan atau kurangi biaya operasional.</div>` : ''}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
window.addEventListener('load', () => {
  // Render intel dashboard jika halaman intel aktif
  const activePage = document.querySelector('.page.active');
  if (activePage && activePage.id === 'page-intel-dashboard') {
    document.querySelectorAll('.intel-subpage').forEach(p => p.classList.remove('active'));
    const dashSub = document.getElementById('ipage-intel-dashboard');
    if (dashSub) dashSub.classList.add('active');
    document.querySelectorAll('.intel-tab').forEach(t => t.classList.remove('active'));
    const dashTab = document.getElementById('itab-intel-dashboard');
    if (dashTab) dashTab.classList.add('active');
    renderIntelDashboard();
  }
});
