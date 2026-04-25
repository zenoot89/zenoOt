/* ═══════════════════════════════════════════════════════════════════
   trend_engine.js — zenOt Operasional V2
   AI Strategy & Blueprint Module
   - Shopee CSV/XLSX file parser (drag & drop)
   - High Demand / Price Issue flagging
   - Action Plan generator
   - Real Profit per SKU calculator (after admin fees, COGS, Ads)
   Reads from: window.DB (app_core.js)
════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
let teData = {
  shopeeRows: [],        // parsed Shopee product performance rows
  salesRows:  [],        // parsed Shopee sales rows
  processedSKUs: [],     // enriched SKU objects after analysis
  shopeeAdminPct: 0.085, // Shopee admin fee % (default 8.5%)
  adsBudget: 0,          // total ads budget for the period
  lastFile: null,
};

const TE_NAV_TITLES = {
  'te-upload':    'AI Strategy <span>Upload</span>',
  'te-blueprint': 'AI Strategy <span>Blueprint</span>',
  'te-profit':    'AI Strategy <span>Profit Guard</span>',
};

// ═══════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════
function goTE(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  if (el) el.classList.add('active');
  document.getElementById('ph').innerHTML = TE_NAV_TITLES[id] || id;
}

// ═══════════════════════════════════════════════════════
// DRAG & DROP ZONE SETUP
// ═══════════════════════════════════════════════════════
function initDropZones() {
  const zones = document.querySelectorAll('.te-drop-zone');
  zones.forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      const files = e.dataTransfer.files;
      if (files[0]) handleTEFile(files[0], zone.dataset.type);
    });
  });
}

// ═══════════════════════════════════════════════════════
// FILE HANDLER
// ═══════════════════════════════════════════════════════
function handleTEFileInput(input, type) {
  const file = input.files[0];
  if (file) handleTEFile(file, type);
}

function handleTEFile(file, type) {
  teData.lastFile = file.name;
  const ext = file.name.split('.').pop().toLowerCase();
  const statusEl = document.getElementById('te-parse-status');
  if (statusEl) { statusEl.classList.add('show'); statusEl.textContent = `⏳ Membaca ${file.name}...`; }

  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = e => {
      const text = e.target.result;
      parseShopeeCsv(text, type);
    };
    reader.readAsText(file, 'UTF-8');
  } else if (ext === 'xlsx' || ext === 'xls') {
    loadSheetJSRK(() => {
      const reader = new FileReader();
      reader.onload = e => {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        parseShopeeXlsx(wb, type);
      };
      reader.readAsBinaryString(file);
    });
  } else {
    toast('Format file tidak didukung. Gunakan CSV atau XLSX dari Shopee.', 'err');
    if (statusEl) statusEl.classList.remove('show');
  }
}

// ═══════════════════════════════════════════════════════
// CSV PARSER
// ═══════════════════════════════════════════════════════
function parseShopeeCsv(text, type) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) { toast('File CSV kosong atau tidak valid','err'); return; }

  // Try to find header row (first row with many semicolons or commas)
  const sep = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.replace(/['"]/g,'').trim());
  const rows = lines.slice(1).map(l => {
    const cols = l.split(sep).map(c => c.replace(/['"]/g,'').trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
    return obj;
  });

  processShopeeRows(rows, type, headers);
}

// ═══════════════════════════════════════════════════════
// XLSX PARSER
// ═══════════════════════════════════════════════════════
function parseShopeeXlsx(wb, type) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  processShopeeRows(rows, type, headers);
}

// ═══════════════════════════════════════════════════════
// ROW PROCESSOR — maps Shopee columns to normalized fields
// ═══════════════════════════════════════════════════════
function processShopeeRows(rows, type, headers) {
  const statusEl = document.getElementById('te-parse-status');

  // ── Column name aliases (Shopee uses different names per report) ──
  const COL_ALIASES = {
    sku:       ['Nama Produk','Product Name','Nama SKU','SKU','Produk','Item Name'],
    sku_ref:   ['Nomor Referensi SKU','Model SKU','SKU Referensi','Variasi'],
    views:     ['Tayangan Produk','Views','Product Views','Kunjungan Produk'],
    clicks:    ['Klik Produk','Clicks','Product Clicks'],
    sales_qty: ['Produk Terjual','Qty Terjual','Units Sold','Jumlah Terjual','Terjual'],
    sales_rev: ['Pendapatan Produk','Revenue','Total Penjualan','Penjualan'],
    prev_qty:  ['Produk Terjual (Bulan Lalu)','Previous Sales','Penjualan Sebelumnya'],
    stock:     ['Stok','Stock','Stok Tersedia'],
  };

  const findCol = (aliases) => {
    const h = headers.map(x => x.toString().trim());
    for (const alias of aliases) {
      const found = h.find(x => x.toLowerCase().includes(alias.toLowerCase()));
      if (found) return found;
    }
    return null;
  };

  const colSku      = findCol(COL_ALIASES.sku);
  const colSkuRef   = findCol(COL_ALIASES.sku_ref);
  const colViews    = findCol(COL_ALIASES.views);
  const colSalesQty = findCol(COL_ALIASES.sales_qty);
  const colSalesRev = findCol(COL_ALIASES.sales_rev);
  const colPrevQty  = findCol(COL_ALIASES.prev_qty);

  const parseNum = v => {
    if (typeof v === 'number') return v;
    return parseFloat(String(v).replace(/[^\d\-\.]/g,'')) || 0;
  };

  const processed = rows.filter(r => {
    const name = r[colSku] || r[colSkuRef] || '';
    return name.toString().trim().length > 0;
  }).map(r => {
    const name    = (r[colSku] || r[colSkuRef] || '').toString().trim();
    const skuRef  = (r[colSkuRef] || '').toString().trim().toUpperCase();
    const views   = parseNum(r[colViews]);
    const salesQty= parseNum(r[colSalesQty]);
    const salesRev= parseNum(r[colSalesRev]);
    const prevQty = parseNum(r[colPrevQty]);

    return { name, skuRef, views, salesQty, salesRev, prevQty };
  });

  if (type === 'sales') {
    teData.salesRows = processed;
  } else {
    teData.shopeeRows = processed;
  }

  // Merge if both loaded
  if (teData.shopeeRows.length > 0 || teData.salesRows.length > 0) {
    runTrendAnalysis();
  }

  const count = processed.length;
  if (statusEl) {
    statusEl.textContent = `✅ ${count} SKU/produk berhasil dibaca dari ${teData.lastFile}`;
  }

  // Mark drop zone as uploaded
  const zone = document.querySelector(`.te-drop-zone[data-type="${type}"]`);
  if (zone) {
    zone.classList.add('uploaded');
    zone.querySelector('.drop-zone-title').textContent = `✅ ${count} baris dimuat`;
    zone.querySelector('.drop-zone-sub').textContent = teData.lastFile;
  }

  toast(`✅ ${count} SKU dari file Shopee berhasil dibaca!`);
}

// ═══════════════════════════════════════════════════════
// TREND ANALYSIS ENGINE
// ═══════════════════════════════════════════════════════
function runTrendAnalysis() {
  const source = teData.shopeeRows.length > 0 ? teData.shopeeRows : teData.salesRows;
  const adminPct = teData.shopeeAdminPct || 0.085;
  const adsBudget = teData.adsBudget || 0;
  const totalSales = source.reduce((s, r) => s + r.salesQty, 0) || 1;

  teData.processedSKUs = source.map(row => {
    const skuRef = row.skuRef;
    const dbProduk = (typeof DB !== 'undefined') ? DB.produk.find(p =>
      p.var.toUpperCase() === skuRef ||
      p.var.toUpperCase().includes(skuRef) ||
      skuRef.includes(p.var.toUpperCase())
    ) : null;
    const dbStok = (typeof DB !== 'undefined') ? DB.stok.find(s =>
      s.var.toUpperCase() === skuRef ||
      (dbProduk && s.var.toUpperCase() === dbProduk.var.toUpperCase())
    ) : null;

    const hpp      = dbProduk ? dbProduk.hpp : 0;
    const hargaJual= dbProduk ? dbProduk.jual : (row.salesQty > 0 ? row.salesRev / row.salesQty : 0);
    const stokAkhir= dbStok ? ((dbStok.awal||0)+(dbStok.masuk||0)-(dbStok.keluar||0)) : null;
    const safety   = dbStok ? (dbStok.safety || 4) : 4;

    // Sales growth: (current - prev) / prev * 100
    const growth = row.prevQty > 0 ? ((row.salesQty - row.prevQty) / row.prevQty * 100) : 0;

    // Real profit per SKU after Shopee admin + COGS
    // Ads cost allocated proportionally by sales contribution
    const salesShare   = totalSales > 0 ? row.salesQty / totalSales : 0;
    const adsAlloc     = adsBudget * salesShare;
    const adminFee     = hargaJual * adminPct;
    const realProfit   = hargaJual - hpp - adminFee - (row.salesQty > 0 ? adsAlloc / row.salesQty : 0);
    const realProfitPct= hargaJual > 0 ? (realProfit / hargaJual * 100) : 0;

    // FLAGS
    let flag = 'ok';
    if (growth > 15) flag = 'high';
    else if (row.views > 100 && row.salesQty < (row.views * 0.01)) flag = 'price';
    if (realProfitPct < 10 && hargaJual > 0) flag = flag === 'ok' ? 'low-margin' : flag;

    return {
      ...row, hpp, hargaJual, stokAkhir, safety, growth,
      adminFee, adsAlloc, realProfit, realProfitPct,
      flag, dbProduk: !!dbProduk, dbStok: !!dbStok,
    };
  });

  renderBlueprintCards();
  renderActionPlan();
  renderProfitTable();
  renderSummaryBar();
}

// ═══════════════════════════════════════════════════════
// RENDER BLUEPRINT CARDS
// ═══════════════════════════════════════════════════════
function renderBlueprintCards() {
  const container = document.getElementById('te-sku-grid');
  if (!container) return;
  if (!teData.processedSKUs.length) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--dusty);">Upload file Shopee untuk melihat analisis SKU</div>';
    return;
  }

  // Sort: high demand first, then price issues, then low margin, rest
  const order = {high:0, price:1, 'low-margin':2, ok:3};
  const sorted = [...teData.processedSKUs].sort((a,b) => order[a.flag]-order[b.flag]);

  container.innerHTML = sorted.map(sku => {
    const flagLabel = {
      high: '🔥 High Demand',
      price: '⚠️ Price/Listing Issue',
      'low-margin': '🔴 Low Margin',
      ok: '✅ Normal',
    }[sku.flag];

    const stokText = sku.stokAkhir !== null
      ? (sku.stokAkhir <= 0 ? '<span style="color:var(--rust);font-weight:700">HABIS</span>'
        : sku.stokAkhir <= sku.safety
          ? `<span style="color:#d97706;font-weight:700">${sku.stokAkhir} (Rendah)</span>`
          : `<span style="color:var(--sage);font-weight:700">${sku.stokAkhir}</span>`)
      : '<span style="color:var(--dusty)">—</span>';

    const growthText = sku.prevQty > 0
      ? `${sku.growth > 0 ? '+' : ''}${sku.growth.toFixed(1)}%`
      : '—';

    const rpFmt = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');

    return `<div class="sku-card ${sku.flag === 'low-margin' ? 'margin-low' : 'demand-' + sku.flag}">
      <div class="sku-card-sku">${sku.skuRef || '—'}</div>
      <div class="sku-card-name">${sku.name.length > 40 ? sku.name.substring(0,40)+'…' : sku.name}</div>
      <span class="sku-flag flag-${sku.flag}">${flagLabel}</span>
      <div class="sku-metrics">
        <div class="sku-metric"><div class="sku-metric-lbl">Terjual</div><div class="sku-metric-val">${sku.salesQty} pcs</div></div>
        <div class="sku-metric"><div class="sku-metric-lbl">Growth</div><div class="sku-metric-val ${sku.growth>15?'green':sku.growth<0?'red':''}">${growthText}</div></div>
        <div class="sku-metric"><div class="sku-metric-lbl">Views</div><div class="sku-metric-val">${sku.views > 0 ? sku.views.toLocaleString() : '—'}</div></div>
        <div class="sku-metric"><div class="sku-metric-lbl">Stok Internal</div><div class="sku-metric-val">${stokText}</div></div>
        <div class="sku-metric"><div class="sku-metric-lbl">Real Profit/pcs</div><div class="sku-metric-val ${sku.realProfitPct < 10 ? 'red' : 'green'}">${sku.hpp > 0 ? rpFmt(sku.realProfit) : '—'}</div></div>
        <div class="sku-metric"><div class="sku-metric-lbl">Margin Bersih</div><div class="sku-metric-val ${sku.realProfitPct < 10 ? 'red' : 'green'}">${sku.hpp > 0 ? sku.realProfitPct.toFixed(1)+'%' : '—'}</div></div>
      </div>
      ${sku.flag !== 'ok' ? `<div class="sku-action">${generateSkuAction(sku)}</div>` : ''}
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════
// ACTION GENERATOR (per SKU)
// ═══════════════════════════════════════════════════════
function generateSkuAction(sku) {
  const restockUnits = Math.max(20, sku.salesQty * 2);
  if (sku.flag === 'high') {
    if (sku.stokAkhir !== null && sku.stokAkhir <= sku.safety) {
      return `🚨 Stok ${sku.stokAkhir} pcs — segera restock ${restockUnits} pcs. Demand naik ${sku.growth.toFixed(0)}%!`;
    }
    return `🚀 Demand naik ${sku.growth.toFixed(0)}% — optimalkan iklan, siapkan stok ${restockUnits} pcs untuk antisipasi.`;
  }
  if (sku.flag === 'price') {
    return `👁️ Views tinggi tapi konversi rendah — cek kompetitor, optimalkan judul & foto, coba voucher atau flash sale.`;
  }
  if (sku.flag === 'low-margin') {
    return `💸 Margin hanya ${sku.realProfitPct.toFixed(1)}% — kurangi budget ads, negosiasi HPP supplier, atau naikkan harga jual.`;
  }
  return '';
}

// ═══════════════════════════════════════════════════════
// ACTION PLAN (step-by-step)
// ═══════════════════════════════════════════════════════
function renderActionPlan() {
  const container = document.getElementById('te-action-plan');
  if (!container) return;
  const steps = [];
  let stepNum = 1;

  const highDemand = teData.processedSKUs.filter(s => s.flag === 'high');
  const priceIssue = teData.processedSKUs.filter(s => s.flag === 'price');
  const lowMargin  = teData.processedSKUs.filter(s => s.flag === 'low-margin');
  const lowStock   = teData.processedSKUs.filter(s => s.stokAkhir !== null && s.stokAkhir <= s.safety && s.flag === 'high');

  if (lowStock.length > 0) {
    const names = lowStock.slice(0,3).map(s=>s.name.substring(0,20)+'…').join(', ');
    const restockTotal = lowStock.reduce((t,s) => t + Math.max(20, s.salesQty*2), 0);
    steps.push({
      num: stepNum++, urgent: true,
      title: `🚨 URGENT: Restock ${lowStock.length} SKU High Demand`,
      desc: `${names} — stok hampir habis padahal demand sedang naik. Segera produksi/order ±${restockTotal} pcs total.`,
      tag: 'tag-restock', tagLabel: '🔄 Restock'
    });
  }

  if (highDemand.length > 0) {
    steps.push({
      num: stepNum++, urgent: false,
      title: `🔥 Tingkatkan Budget Iklan untuk ${highDemand.length} SKU Trending`,
      desc: `${highDemand.map(s=>s.name.substring(0,20)+'…').slice(0,3).join(', ')} sedang demand tinggi. Naikkan bid iklan GMV Max untuk SKU ini, ROAS cenderung lebih mudah.`,
      tag: 'tag-ads', tagLabel: '📣 Ads'
    });
  }

  if (priceIssue.length > 0) {
    steps.push({
      num: stepNum++, urgent: false,
      title: `🔧 Audit Listing ${priceIssue.length} SKU dengan View Tinggi, Sales Rendah`,
      desc: `${priceIssue.map(s=>s.name.substring(0,20)+'…').slice(0,2).join(', ')} — kemungkinan harga terlalu tinggi vs kompetitor, atau foto/deskripsi kurang menarik. Cek dan optimalkan.`,
      tag: 'tag-listing', tagLabel: '📝 Listing'
    });
  }

  if (lowMargin.length > 0) {
    steps.push({
      num: stepNum++, urgent: false,
      title: `💰 Perbaiki Margin ${lowMargin.length} SKU Low Profit`,
      desc: `${lowMargin.map(s=>s.name.substring(0,20)+'…').slice(0,2).join(', ')} — margin bersih di bawah 10%. Kurangi ads spend, nego HPP ke supplier, atau naikkan harga jual minimal 5–10%.`,
      tag: 'tag-profit', tagLabel: '💸 Margin'
    });
  }

  if (steps.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--dusty)">Upload file Shopee untuk generate Action Plan otomatis.</div>';
    return;
  }

  container.innerHTML = `<div class="action-plan">
    <div class="action-plan-header">📋 Action Plan Otomatis — ${new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</div>
    ${steps.map(s => `<div class="action-step">
      <div class="action-step-num ${s.urgent?'urgent':'info'}">${s.num}</div>
      <div class="action-step-body">
        <div class="action-step-title">${s.title}</div>
        <div class="action-step-desc">${s.desc}</div>
        <span class="action-step-tag ${s.tag}">${s.tagLabel}</span>
      </div>
    </div>`).join('')}
  </div>`;
}

// ═══════════════════════════════════════════════════════
// PROFIT TABLE
// ═══════════════════════════════════════════════════════
function renderProfitTable() {
  const container = document.getElementById('te-profit-table');
  if (!container) return;
  if (!teData.processedSKUs.length) { container.innerHTML=''; return; }

  const rpFmt = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');
  const hasHpp = teData.processedSKUs.some(s => s.hpp > 0);

  if (!hasHpp) {
    container.innerHTML = `<div class="alert al-w"><span>💡</span><div>SKU belum matched ke database produk. Pastikan kolom "Nomor Referensi SKU" di file Shopee sesuai dengan SKU Variasi di Kelola Produk.</div></div>`;
    return;
  }

  const sorted = [...teData.processedSKUs].filter(s=>s.hpp>0).sort((a,b)=>a.realProfitPct-b.realProfitPct);

  container.innerHTML = `<div class="profit-table-wrap">
    <table>
      <thead><tr>
        <th>#</th><th>SKU</th><th>HPP</th><th>Harga Jual</th>
        <th>Admin Fee</th><th>Real Profit/pcs</th><th>Margin %</th><th>Status</th>
      </tr></thead>
      <tbody>${sorted.map((s,i) => `<tr class="${s.realProfitPct < 10 ? 'margin-warning' : 'margin-ok'}">
        <td class="mono">${i+1}</td>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.name}</td>
        <td class="mono">${rpFmt(s.hpp)}</td>
        <td class="mono">${rpFmt(s.hargaJual)}</td>
        <td class="mono">${rpFmt(s.adminFee)}</td>
        <td class="mono" style="color:${s.realProfit>=0?'var(--sage)':'var(--rust)'};font-weight:700">${rpFmt(s.realProfit)}</td>
        <td><span class="badge ${s.realProfitPct<10?'br':s.realProfitPct<20?'bo':'bg'}">${s.realProfitPct.toFixed(1)}%</span></td>
        <td>${s.realProfitPct < 10 ? '<span class="badge br">⚠ Rendah</span>' : '<span class="badge bg">✅ OK</span>'}</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}

// ═══════════════════════════════════════════════════════
// SUMMARY BAR
// ═══════════════════════════════════════════════════════
function renderSummaryBar() {
  const container = document.getElementById('te-summary-bar');
  if (!container || !teData.processedSKUs.length) return;
  const skus = teData.processedSKUs;
  const highCount    = skus.filter(s=>s.flag==='high').length;
  const priceCount   = skus.filter(s=>s.flag==='price').length;
  const lowMgCount   = skus.filter(s=>s.flag==='low-margin').length;
  const totalTerjual = skus.reduce((t,s)=>t+s.salesQty,0);

  container.innerHTML = `
    <div class="summary-tile"><div class="summary-tile-val" style="color:var(--sage)">${highCount}</div><div class="summary-tile-lbl">🔥 High Demand</div></div>
    <div class="summary-tile"><div class="summary-tile-val" style="color:var(--gold)">${priceCount}</div><div class="summary-tile-lbl">⚠️ Price/Listing Issue</div></div>
    <div class="summary-tile"><div class="summary-tile-val" style="color:var(--rust)">${lowMgCount}</div><div class="summary-tile-lbl">🔴 Low Margin</div></div>
    <div class="summary-tile"><div class="summary-tile-val">${totalTerjual.toLocaleString()}</div><div class="summary-tile-lbl">📦 Total Terjual</div></div>`;
}

// ═══════════════════════════════════════════════════════
// SETTINGS (Admin Fee, Ads Budget)
// ═══════════════════════════════════════════════════════
function updateTESettings() {
  const adminPctEl = document.getElementById('te-admin-pct');
  const adsBudgetEl = document.getElementById('te-ads-budget');
  if (adminPctEl) teData.shopeeAdminPct = (parseFloat(adminPctEl.value) || 8.5) / 100;
  if (adsBudgetEl) teData.adsBudget = parseInt(adsBudgetEl.value.replace(/\D/g,'')) || 0;
  if (teData.processedSKUs.length > 0) runTrendAnalysis();
  toast('✅ Setting diperbarui, analisis diulang!');
}

// ═══════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════
window.addEventListener('load', () => {
  initDropZones();
});
