/* ═══════════════════════════════════════════════════════════════════
   trend_engine.js — zenOt Operasional V2  [UPGRADED]
   AI Strategy & Blueprint Module — Full Insight Edition

   BARU di versi ini:
   ✅ Multi-sheet reader (baca semua sheet Shopee sekaligus)
   ✅ Full conversion funnel (Views→Klik→Keranjang→Beli→Abandon)
   ✅ Bounce rate per SKU + auto-flag >50%
   ✅ Abandon cart analysis
   ✅ Cancellation rate (Pesanan Dibuat vs Siap Dikirim)
   ✅ Revenue dependency risk (MAYRA problem detector)
   ✅ Dead product alert (views ada, 0 konversi)
   ✅ Shopee signal reader (sheet Iklankan, Harga Kompetitif)
   ✅ Repeat order rate per SKU
   ✅ SKU health score
   ✅ Morning briefing otomatis
   ✅ Breakdown analisis per SKU (full detail)

   Reads from: window.DB (app_core.js)
════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
let teData = {
  shopeeRows:    [],
  salesRows:     [],
  processedSKUs: [],
  shopeeSheets:  {},
  shopeeSignals: {
    iklankan:         [],
    hargaKompetitif:  [],
    hargaBelumKomp:   [],
    produkBaru:       [],
  },
  shopeeAdminPct: 0.085, // auto-pull dari DB jika ada, fallback ke 8.5%
  adsBudget:      0,     // auto-pull dari rkData jika ada
  lastFile:       null,
  periodeLabel:   '',
  parseError:     null,  // error handling CSV/XLSX
};

// Auto-pull settings dari DB dan rkData
function _autoLoadTESettings() {
  // Admin fee dari DB jika ada field adminFee
  if (typeof DB !== 'undefined' && DB.settings && DB.settings.adminFeePct) {
    teData.shopeeAdminPct = DB.settings.adminFeePct / 100;
  }
  // Ads budget dari rkData jika sudah diupload
  if (typeof rkData !== 'undefined' && rkData.iklanTotal > 0) {
    teData.adsBudget = rkData.iklanTotal;
    const el = document.getElementById('te-ads-info');
    if (el) el.innerHTML = `📣 Budget iklan otomatis dari Rasio Keuangan: <strong>Rp ${Math.round(rkData.iklanTotal).toLocaleString('id-ID')}</strong>`;
  }
}

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
// RE-USE DATA DARI RK MODULE
// ═══════════════════════════════════════════════════════
function reuseRKDataForTE() {
  if (typeof rkData !== 'undefined' && rkData.order1 && Object.keys(rkData.varianCount||{}).length > 0) {
    teData.salesRows = Object.entries(rkData.varianCount).map(([skuRef, salesQty]) => ({
      name: skuRef, skuRef: skuRef.toUpperCase(),
      views: 0, salesQty, salesRev: 0, prevQty: 0,
      clicks: 0, keranjang: 0, bounceRate: 0,
      pesananDibuat: salesQty, pesananSiapKirim: salesQty,
      repeatOrderRate: 0, klikPencarian: 0,
    }));
    const zone2 = document.getElementById('te-reuse-status');
    if (zone2) {
      zone2.innerHTML = `✅ Re-use data dari Upload & Data: <strong>${Object.keys(rkData.varianCount).length} SKU</strong> · ${rkData.totalOrder} pesanan`;
      zone2.style.color = 'var(--sage)';
    }
    toast(`✅ Data pesanan (${rkData.totalOrder} order) diambil dari tab Upload & Data!`);
    return true;
  }
  return false;
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
  // Auto-load settings dari DB & rkData
  _autoLoadTESettings();
  setTimeout(() => {
    if (reuseRKDataForTE()) runTrendAnalysis();
  }, 500);
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
  teData.parseError = null;
  // Coba ambil periode dari nama file
  const periodMatch = file.name.match(/(\d{8})_(\d{8})/);
  if (periodMatch) {
    const fmt = s => `${s.slice(6,8)}/${s.slice(4,6)}/${s.slice(0,4)}`;
    teData.periodeLabel = `${fmt(periodMatch[1])} – ${fmt(periodMatch[2])}`;
  }

  const ext = file.name.split('.').pop().toLowerCase();
  const statusEl = document.getElementById('te-parse-status');
  if (statusEl) { statusEl.classList.add('show'); statusEl.textContent = `⏳ Membaca ${file.name}...`; }

  // Validasi format file
  if (!['csv','xlsx','xls'].includes(ext)) {
    teData.parseError = `❌ Format file tidak didukung: .${ext}. Gunakan file CSV atau XLSX dari Shopee Seller Center.`;
    if (statusEl) { statusEl.textContent = teData.parseError; statusEl.style.background='var(--rust)'; }
    toast('Format file tidak didukung! Gunakan CSV atau XLSX dari Shopee.', 'err');
    return;
  }

  // Auto-load settings dari DB sebelum proses
  _autoLoadTESettings();

  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = e => {
      try { parseShopeeCsv(e.target.result, type); }
      catch(err) { _handleParseError(err, statusEl); }
    };
    reader.readAsText(file, 'UTF-8');
  } else {
    loadSheetJSRK(() => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb = XLSX.read(e.target.result, { type: 'binary' });
          // Validasi apakah ini file Shopee
          if (wb.SheetNames.length === 0) { _handleParseError(new Error('File kosong'), statusEl); return; }
          parseShopeeXlsxMultiSheet(wb);
        } catch(err) { _handleParseError(err, statusEl); }
      };
      reader.readAsBinaryString(file);
    });
  }
}

function _handleParseError(err, statusEl) {
  const msg = `❌ Gagal membaca file. Pastikan file adalah Laporan Performa Produk dari Shopee Seller Center (bukan file yang sudah diedit di Excel).`;
  teData.parseError = msg;
  if (statusEl) { statusEl.textContent = msg; statusEl.style.background='var(--rust)'; statusEl.classList.add('show'); }
  toast('File tidak valid! Cek format file Shopee.', 'err');
  console.error('TE Parse Error:', err);
}

// ═══════════════════════════════════════════════════════
// XLSX MULTI-SHEET PARSER — baca semua sheet Shopee
// ═══════════════════════════════════════════════════════
function parseShopeeXlsxMultiSheet(wb) {
  const statusEl = document.getElementById('te-parse-status');
  teData.shopeeSheets = {};

  // Simpan semua sheet
  wb.SheetNames.forEach(name => {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    teData.shopeeSheets[name] = rows;
  });

  // Deteksi sheet utama (Performa Produk)
  const mainSheetName = wb.SheetNames.find(n =>
    n.toLowerCase().includes('performa') ||
    n.toLowerCase().includes('terbaik') ||
    n.toLowerCase().includes('produk')
  ) || wb.SheetNames[0];

  const mainRows = teData.shopeeSheets[mainSheetName] || [];
  const headers  = mainRows.length > 0 ? Object.keys(mainRows[0]) : [];

  // Baca sinyal dari sheet-sheet rekomendasi Shopee
  _readShopeeSignalSheets(wb.SheetNames);

  // Proses main data
  processShopeeRows(mainRows, 'performa', headers);

  if (statusEl) {
    statusEl.textContent = `✅ ${mainRows.length} baris dibaca · ${wb.SheetNames.length} sheet terdeteksi dari ${teData.lastFile}`;
  }

  const zone = document.querySelector('.te-drop-zone[data-type="performa"]');
  if (zone) {
    zone.classList.add('uploaded');
    const t = zone.querySelector('.drop-zone-title');
    const s = zone.querySelector('.drop-zone-sub');
    if (t) t.textContent = `✅ ${mainRows.length} baris dimuat`;
    if (s) s.textContent = `${wb.SheetNames.length} sheet · ${teData.lastFile}`;
  }
  toast(`✅ ${mainRows.length} baris dari ${wb.SheetNames.length} sheet berhasil dibaca!`);
}

// Baca sheet sinyal rekomendasi Shopee
function _readShopeeSignalSheets(sheetNames) {
  teData.shopeeSignals = { iklankan:[], hargaKompetitif:[], hargaBelumKomp:[], produkBaru:[] };
  sheetNames.forEach(name => {
    const rows = teData.shopeeSheets[name] || [];
    const nl   = name.toLowerCase();
    if (nl.includes('iklankan') || nl.includes('tingkatkan dengan iklan')) {
      teData.shopeeSignals.iklankan = rows.map(r => _extractProdukName(r)).filter(Boolean);
    } else if (nl.includes('sudah kompetitif')) {
      teData.shopeeSignals.hargaKompetitif = rows.map(r => _extractProdukName(r)).filter(Boolean);
    } else if (nl.includes('belum kompetitif')) {
      teData.shopeeSignals.hargaBelumKomp = rows.map(r => _extractProdukName(r)).filter(Boolean);
    } else if (nl.includes('baru ditambahkan')) {
      teData.shopeeSignals.produkBaru = rows.map(r => _extractProdukName(r)).filter(Boolean);
    }
  });
}

function _extractProdukName(row) {
  return row['Produk'] || row['Product Name'] || row['Nama Produk'] || '';
}

// ═══════════════════════════════════════════════════════
// CSV PARSER
// ═══════════════════════════════════════════════════════
function parseShopeeCsv(text, type) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length < 2) { toast('File CSV kosong atau tidak valid','err'); return; }
  const sep     = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(sep).map(h => h.replace(/['"]/g,'').trim());
  const rows    = lines.slice(1).map(l => {
    const cols = l.split(sep).map(c => c.replace(/['"]/g,'').trim());
    const obj  = {};
    headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
    return obj;
  });
  processShopeeRows(rows, type, headers);
}

// ═══════════════════════════════════════════════════════
// ROW PROCESSOR — semua kolom dibaca termasuk funnel
// ═══════════════════════════════════════════════════════
function processShopeeRows(rows, type, headers) {
  const statusEl = document.getElementById('te-parse-status');

  const COL_ALIASES = {
    sku:           ['Nama Produk','Product Name','Nama SKU','SKU','Produk','Item Name'],
    sku_ref:       ['Nomor Referensi SKU','Kode Variasi','Model SKU','SKU Referensi','Variasi'],
    nama_variasi:  ['Nama Variasi','Variation Name','Variasi','Nama Varian'],
    sku_induk:     ['SKU Induk','Parent SKU'],
    views:         ['Jumlah Produk Dilihat','Tayangan Produk','Views','Product Views','Kunjungan Produk'],
    clicks:        ['Produk Diklik','Klik Produk','Clicks','Product Clicks'],
    sales_qty:     ['Produk (Pesanan Dibuat)','Produk Terjual','Qty Terjual','Units Sold','Jumlah Terjual','Terjual'],
    sales_rev:     ['Total Penjualan (Pesanan Dibuat) (IDR)','Pendapatan Produk','Revenue','Total Penjualan','Penjualan'],
    prev_qty:      ['Produk Terjual (Bulan Lalu)','Previous Sales','Penjualan Sebelumnya'],
    keranjang:     ['Pengunjung Produk (Menambahkan Produk ke Keranjang)','Ditambahkan ke Keranjang','Dimasukkan ke Keranjang (Produk)','Keranjang'],
    bounce:        ['Tingkat Pengunjung Melihat Tanpa Membeli','Bounce Rate','Tingkat Pengunjung Tanpa Beli'],
    pesanan_dibuat:['Pesanan Dibuat'],
    pesanan_kirim: ['Pesanan Siap Dikirim'],
    repeat_order:  ['Tingkat Pesanan Berulang (Pesanan Dibuat)','Repeat Order Rate','% Pembelian Ulang'],
    klik_pencarian:['Klik Pencarian','Search Clicks'],
    suka:          ['Suka','Likes'],
    visitors:      ['Pengunjung Produk (Kunjungan)','Pengunjung Produk'],
  };

  const findCol = (aliases) => {
    const h = headers.map(x => x.toString().trim());
    for (const alias of aliases) {
      const found = h.find(x => x.toLowerCase().includes(alias.toLowerCase()));
      if (found) return found;
    }
    return null;
  };

  const parseNum = v => {
    if (typeof v === 'number') return v;
    const s = String(v).replace(/\./g,'').replace(',','.').replace(/[^\d\-\.]/g,'');
    return parseFloat(s) || 0;
  };
  const parsePct = v => {
    if (typeof v === 'number') return v;
    return parseFloat(String(v).replace(',','.').replace('%','')) || 0;
  };

  const colSku       = findCol(COL_ALIASES.sku);
  const colSkuRef    = findCol(COL_ALIASES.sku_ref);
  const colNamaVariasi = findCol(COL_ALIASES.nama_variasi);
  const colSkuInduk  = findCol(COL_ALIASES.sku_induk);
  const colViews     = findCol(COL_ALIASES.views);
  const colClicks    = findCol(COL_ALIASES.clicks);
  const colSalesQty  = findCol(COL_ALIASES.sales_qty);
  const colSalesRev  = findCol(COL_ALIASES.sales_rev);
  const colPrevQty   = findCol(COL_ALIASES.prev_qty);
  const colKeranjang = findCol(COL_ALIASES.keranjang);
  const colBounce    = findCol(COL_ALIASES.bounce);
  const colDibuat    = findCol(COL_ALIASES.pesanan_dibuat);
  const colKirim     = findCol(COL_ALIASES.pesanan_kirim);
  const colRepeat    = findCol(COL_ALIASES.repeat_order);
  const colKlikCari  = findCol(COL_ALIASES.klik_pencarian);
  const colSuka      = findCol(COL_ALIASES.suka);
  const colVisitors  = findCol(COL_ALIASES.visitors);

  // Filter hanya baris induk SKU (yang punya views/data performa)
  const processed = rows.filter(r => {
    const name    = (r[colSku] || r[colSkuRef] || '').toString().trim();
    const hasData = parseNum(r[colViews]) > 0 || parseNum(r[colSalesQty]) > 0 || parseNum(r[colSalesRev]) > 0;
    return name.length > 0 && hasData;
  }).map(r => {
    const name         = (r[colSku] || r[colSkuRef] || '').toString().trim();
    const skuRef       = (r[colSkuRef] || '').toString().trim().toUpperCase();
    const namaVariasi  = (r[colNamaVariasi] || '').toString().trim();
    const skuInduk     = (r[colSkuInduk] || '').toString().trim().toUpperCase();
    const views        = parseNum(r[colViews]);
    const clicks       = parseNum(r[colClicks]);
    const salesQty     = parseNum(r[colSalesQty]);
    const salesRev     = parseNum(r[colSalesRev]);
    const prevQty      = parseNum(r[colPrevQty]);
    const keranjang    = parseNum(r[colKeranjang]);
    const bounceRate   = parsePct(r[colBounce]);
    const pesananDibuat= parseNum(r[colDibuat]) || salesQty;
    const pesananKirim = parseNum(r[colKirim])  || salesQty;
    const repeatRate   = parsePct(r[colRepeat]);
    const klikPencarian= parseNum(r[colKlikCari]);
    const suka         = parseNum(r[colSuka]);
    const visitors     = parseNum(r[colVisitors]) || views;

    return {
      name, skuRef, namaVariasi, skuInduk, views, clicks, salesQty, salesRev, prevQty,
      keranjang, bounceRate, pesananDibuat, pesananKirim,
      repeatRate, klikPencarian, suka, visitors,
    };
  });

  if (type === 'sales') {
    teData.salesRows = processed;
  } else {
    teData.shopeeRows = processed;
  }

  if (teData.shopeeRows.length > 0 || teData.salesRows.length > 0) {
    runTrendAnalysis();
  }

  const count = processed.length;
  if (statusEl) statusEl.textContent = `✅ ${count} SKU berhasil dibaca dari ${teData.lastFile}`;

  const zone = document.querySelector(`.te-drop-zone[data-type="${type}"]`);
  if (zone) {
    zone.classList.add('uploaded');
    const t = zone.querySelector('.drop-zone-title');
    const s = zone.querySelector('.drop-zone-sub');
    if (t) t.textContent = `✅ ${count} baris dimuat`;
    if (s) s.textContent = teData.lastFile;
  }
}

// ═══════════════════════════════════════════════════════
// TREND ANALYSIS ENGINE — UPGRADED
// ═══════════════════════════════════════════════════════
function runTrendAnalysis() {
  const source     = teData.shopeeRows.length > 0 ? teData.shopeeRows : teData.salesRows;
  const adminPct   = teData.shopeeAdminPct || 0.085;
  const adsBudget  = teData.adsBudget || 0;
  const totalSales = source.reduce((s, r) => s + r.salesQty, 0) || 1;
  const totalRev   = source.reduce((s, r) => s + r.salesRev, 0) || 1;

  teData.processedSKUs = source.map(row => {
    const skuRef = row.skuRef;

    // Match ke DB internal
    const dbProduk = (typeof DB !== 'undefined') ? DB.produk.find(p =>
      p.var.toUpperCase() === skuRef ||
      p.var.toUpperCase().includes(skuRef) ||
      skuRef.includes(p.var.toUpperCase()) ||
      (row.skuInduk && p.induk.toUpperCase() === row.skuInduk)
    ) : null;

    const dbStok = (typeof DB !== 'undefined') ? DB.stok.find(s =>
      s.var.toUpperCase() === skuRef ||
      (dbProduk && s.var.toUpperCase() === dbProduk.var.toUpperCase())
    ) : null;

    const hpp       = dbProduk ? dbProduk.hpp : 0;
    const hargaJual = dbProduk ? dbProduk.jual : (row.salesQty > 0 ? row.salesRev / row.salesQty : 0);
    const stokAkhir = dbStok ? ((dbStok.awal||0)+(dbStok.masuk||0)-(dbStok.keluar||0)) : null;
    const safety    = dbStok ? (dbStok.safety || 4) : 4;

    // Growth
    const growth = row.prevQty > 0 ? ((row.salesQty - row.prevQty) / row.prevQty * 100) : 0;

    // Profit
    const salesShare    = totalSales > 0 ? row.salesQty / totalSales : 0;
    const adsAlloc      = adsBudget * salesShare;
    const adminFee      = hargaJual * adminPct;
    const realProfit    = hargaJual - hpp - adminFee - (row.salesQty > 0 ? adsAlloc / row.salesQty : 0);
    const realProfitPct = hargaJual > 0 ? (realProfit / hargaJual * 100) : 0;

    // Revenue share (dependency risk)
    const revShare = totalRev > 0 ? (row.salesRev / totalRev * 100) : 0;

    // Funnel metrics
    const ctr           = row.views > 0 ? (row.clicks / row.views * 100) : 0;
    const convRate      = row.clicks > 0 ? (row.salesQty / row.clicks * 100) : 0;
    const keranjangRate = row.visitors > 0 ? (row.keranjang / row.visitors * 100) : 0;
    const abandonCart   = Math.max(0, row.keranjang - row.salesQty);
    const cancelRate    = row.pesananDibuat > 0 ?
      ((row.pesananDibuat - row.pesananKirim) / row.pesananDibuat * 100) : 0;

    // Shopee signals untuk SKU ini
    const isSignalIklan = teData.shopeeSignals.iklankan.some(n =>
      n.toLowerCase().includes(row.name.substring(0,20).toLowerCase()) ||
      row.name.toLowerCase().includes(n.substring(0,15).toLowerCase())
    );
    const isHargaKomp = teData.shopeeSignals.hargaKompetitif.some(n =>
      n.toLowerCase().includes(row.name.substring(0,20).toLowerCase()) ||
      row.name.toLowerCase().includes(n.substring(0,15).toLowerCase())
    );
    const isHargaBelumKomp = teData.shopeeSignals.hargaBelumKomp.some(n =>
      n.toLowerCase().includes(row.name.substring(0,20).toLowerCase())
    );

    // Dead product: views lumayan tapi 0 beli
    const isDead = row.views > 500 && row.salesQty === 0;

    // Bounce rate flag
    const highBounce = row.bounceRate > 50;

    // FLAGS — urutan prioritas
    let flag = 'ok';
    if (isDead)                                          flag = 'dead';
    else if (growth > 15)                                flag = 'high';
    else if (row.views > 100 && row.salesQty < (row.views * 0.01)) flag = 'price';
    if (realProfitPct < 10 && hargaJual > 0 && flag === 'ok') flag = 'low-margin';

    // Health score (0-100)
    let healthScore = 100;
    if (isDead)              healthScore -= 40;
    if (highBounce)          healthScore -= 20;
    if (cancelRate > 15)     healthScore -= 15;
    if (realProfitPct < 10)  healthScore -= 15;
    if (abandonCart > row.salesQty * 2) healthScore -= 10;
    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      ...row,
      hpp, hargaJual, stokAkhir, safety, growth,
      adminFee, adsAlloc, realProfit, realProfitPct,
      revShare, ctr, convRate, keranjangRate,
      abandonCart, cancelRate, isDead, highBounce,
      isSignalIklan, isHargaKomp, isHargaBelumKomp,
      healthScore,
      flag,
      dbProduk: !!dbProduk, dbStok: !!dbStok,
    };
  });

  renderMorningBriefing();
  renderSummaryBar();
  renderBlueprintCards();
  renderActionPlan();
  renderProfitTable();

  // Tampilkan summary bar
  const sb = document.getElementById('te-summary-bar');
  if (sb) sb.style.display = 'grid';
}

// ═══════════════════════════════════════════════════════
// MORNING BRIEFING — insight tajam otomatis
// ═══════════════════════════════════════════════════════
function renderMorningBriefing() {
  const container = document.getElementById('te-morning-briefing');
  if (!container) return;

  const skus       = teData.processedSKUs;
  const totalRev   = skus.reduce((t,s) => t + s.salesRev, 0);
  const totalOrder = skus.reduce((t,s) => t + s.pesananDibuat, 0);
  const totalViews = skus.reduce((t,s) => t + s.views, 0);

  // Dependency risk
  const topSku = [...skus].sort((a,b) => b.salesRev - a.salesRev)[0];
  const depRisk = topSku ? topSku.revShare : 0;
  const depColor = depRisk > 70 ? 'var(--rust)' : depRisk > 50 ? '#d97706' : 'var(--sage)';

  // Dead products
  const deadSkus = skus.filter(s => s.isDead);

  // High bounce
  const highBounceSkus = skus.filter(s => s.highBounce && s.views > 200);

  // Abandon cart total
  const totalAbandon = skus.reduce((t,s) => t + s.abandonCart, 0);
  const topAbandon   = [...skus].sort((a,b) => b.abandonCart - a.abandonCart)[0];

  // Shopee signals
  const signalIklan  = skus.filter(s => s.isSignalIklan);
  const signalKomp   = skus.filter(s => s.isHargaKomp);

  // Stok kritis
  const stokKritis   = skus.filter(s => s.stokAkhir !== null && s.stokAkhir <= s.safety && s.salesQty > 0);

  const rpFmt  = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');
  const periode = teData.periodeLabel || 'Periode ini';

  const items = [];

  // 1. Overview
  items.push(`
    <div class="briefing-item briefing-overview">
      <div class="briefing-row">
        <div class="briefing-kpi"><div class="briefing-kpi-val">${rpFmt(totalRev)}</div><div class="briefing-kpi-lbl">Total Revenue</div></div>
        <div class="briefing-kpi"><div class="briefing-kpi-val">${totalOrder.toLocaleString()}</div><div class="briefing-kpi-lbl">Total Pesanan</div></div>
        <div class="briefing-kpi"><div class="briefing-kpi-val">${totalViews.toLocaleString()}</div><div class="briefing-kpi-lbl">Total Views</div></div>
        <div class="briefing-kpi"><div class="briefing-kpi-val">${skus.length}</div><div class="briefing-kpi-lbl">Produk Aktif</div></div>
      </div>
    </div>`);

  // 2. Dependency Risk
  if (topSku) {
    const icon = depRisk > 70 ? '🚨' : depRisk > 50 ? '⚠️' : '✅';
    const label = depRisk > 70 ? 'RISIKO TINGGI' : depRisk > 50 ? 'Perlu Diversifikasi' : 'Aman';
    items.push(`
      <div class="briefing-item ${depRisk > 70 ? 'briefing-danger' : depRisk > 50 ? 'briefing-warn' : 'briefing-ok'}">
        <div class="briefing-icon">${icon}</div>
        <div class="briefing-body">
          <div class="briefing-title">Revenue Dependency — ${label}</div>
          <div class="briefing-desc"><strong>${topSku.skuRef || topSku.name.substring(0,30)}</strong> menyumbang <strong style="color:${depColor}">${depRisk.toFixed(1)}%</strong> dari total revenue.
          ${depRisk > 70 ? ' Toko sangat rentan — segera diversifikasi produk lain!' : depRisk > 50 ? ' Mulai push produk lain agar tidak terlalu bergantung.' : ' Distribusi revenue cukup sehat.'}</div>
        </div>
      </div>`);
  }

  // 3. Dead Products
  if (deadSkus.length > 0) {
    const names = deadSkus.slice(0,3).map(s => `<strong>${s.skuRef || s.name.substring(0,20)}</strong>`).join(', ');
    items.push(`
      <div class="briefing-item briefing-danger">
        <div class="briefing-icon">💀</div>
        <div class="briefing-body">
          <div class="briefing-title">Dead Products — ${deadSkus.length} SKU views ada, 0 terjual</div>
          <div class="briefing-desc">${names} — orang lihat tapi tidak beli. Kemungkinan masalah: foto utama, deskripsi, atau harga vs kompetitor. Audit listing segera!</div>
        </div>
      </div>`);
  }

  // 4. Abandon Cart
  if (totalAbandon > 0 && topAbandon) {
    items.push(`
      <div class="briefing-item briefing-warn">
        <div class="briefing-icon">🛒</div>
        <div class="briefing-body">
          <div class="briefing-title">Abandon Cart — ${totalAbandon.toLocaleString()} orang tidak jadi beli</div>
          <div class="briefing-desc">Terbesar: <strong>${topAbandon.skuRef || topAbandon.name.substring(0,25)}</strong> — ${topAbandon.abandonCart} orang masuk keranjang tapi batalkan. Coba kirim voucher atau flash sale 1-2 hari untuk konversi mereka!</div>
        </div>
      </div>`);
  }

  // 5. Bounce Rate Tinggi
  if (highBounceSkus.length > 0) {
    const names = highBounceSkus.slice(0,3).map(s =>
      `<strong>${s.skuRef || s.name.substring(0,15)}</strong> (${s.bounceRate.toFixed(0)}%)`
    ).join(', ');
    items.push(`
      <div class="briefing-item briefing-warn">
        <div class="briefing-icon">↩️</div>
        <div class="briefing-body">
          <div class="briefing-title">Bounce Rate Tinggi — ${highBounceSkus.length} SKU >50%</div>
          <div class="briefing-desc">${names} — pengunjung masuk lalu langsung pergi. Prioritas audit: foto utama harus eye-catching dalam 2 detik pertama!</div>
        </div>
      </div>`);
  }

  // 6. Shopee Signal — Rekomendasi Iklan
  if (signalIklan.length > 0) {
    const names = signalIklan.slice(0,3).map(s => `<strong>${s.skuRef || s.name.substring(0,20)}</strong>`).join(', ');
    items.push(`
      <div class="briefing-item briefing-signal">
        <div class="briefing-icon">📣</div>
        <div class="briefing-body">
          <div class="briefing-title">Shopee Signal — Rekomendasikan Iklan</div>
          <div class="briefing-desc">Shopee sendiri merekomendasikan iklankan: ${names}. Mulai dengan budget kecil Rp 20-30rb/hari, ukur CTR 7 hari.</div>
        </div>
      </div>`);
  }

  // 7. Shopee Signal — Harga Kompetitif
  if (signalKomp.length > 0) {
    const names = signalKomp.slice(0,3).map(s => `<strong>${s.skuRef || s.name.substring(0,20)}</strong>`).join(', ');
    items.push(`
      <div class="briefing-item briefing-ok">
        <div class="briefing-icon">✅</div>
        <div class="briefing-body">
          <div class="briefing-title">Harga Sudah Kompetitif</div>
          <div class="briefing-desc">${names} — harga sudah diakui Shopee kompetitif. Jangan turunkan harga lagi! Fokus ke konversi dan foto listing.</div>
        </div>
      </div>`);
  }

  // 8. Stok Kritis
  if (stokKritis.length > 0) {
    const names = stokKritis.slice(0,3).map(s =>
      `<strong>${s.skuRef}</strong> (${s.stokAkhir} pcs)`
    ).join(', ');
    items.push(`
      <div class="briefing-item briefing-danger">
        <div class="briefing-icon">📦</div>
        <div class="briefing-body">
          <div class="briefing-title">Stok Kritis — ${stokKritis.length} SKU hampir habis</div>
          <div class="briefing-desc">${names} — stok di bawah safety stock padahal masih terjual. Segera restock sebelum kehabisan dan kehilangan momentum penjualan!</div>
        </div>
      </div>`);
  }

  const tgl = new Date().toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  container.innerHTML = `
    <div class="briefing-wrap">
      <div class="briefing-header">
        <div>
          <div class="briefing-header-title">☀️ Insight Report — ${periode}</div>
          <div class="briefing-header-sub">${tgl} · ${skus.length} SKU dianalisis</div>
        </div>
      </div>
      ${items.join('')}
    </div>`;
}

// ═══════════════════════════════════════════════════════
// SUMMARY BAR — UPGRADED
// ═══════════════════════════════════════════════════════
function renderSummaryBar() {
  const container = document.getElementById('te-summary-bar');
  if (!container || !teData.processedSKUs.length) return;

  const skus         = teData.processedSKUs;
  const highCount    = skus.filter(s => s.flag === 'high').length;
  const deadCount    = skus.filter(s => s.isDead).length;
  const bounceCount  = skus.filter(s => s.highBounce && s.views > 200).length;
  const abandonTotal = skus.reduce((t,s) => t + s.abandonCart, 0);
  const totalTerjual = skus.reduce((t,s) => t + s.salesQty, 0);
  const lowMgCount   = skus.filter(s => s.flag === 'low-margin').length;

  container.innerHTML = `
    <div class="summary-tile"><div class="summary-tile-val" style="color:var(--sage)">${highCount}</div><div class="summary-tile-lbl">🔥 High Demand</div></div>
    <div class="summary-tile"><div class="summary-tile-val" style="color:var(--rust)">${deadCount}</div><div class="summary-tile-lbl">💀 Dead Product</div></div>
    <div class="summary-tile"><div class="summary-tile-val" style="color:#d97706">${bounceCount}</div><div class="summary-tile-lbl">↩️ Bounce Tinggi</div></div>
    <div class="summary-tile"><div class="summary-tile-val" style="color:#d97706">${abandonTotal.toLocaleString()}</div><div class="summary-tile-lbl">🛒 Abandon Cart</div></div>
    <div class="summary-tile"><div class="summary-tile-val">${totalTerjual.toLocaleString()}</div><div class="summary-tile-lbl">📦 Total Terjual</div></div>
    <div class="summary-tile"><div class="summary-tile-val" style="color:var(--rust)">${lowMgCount}</div><div class="summary-tile-lbl">🔴 Low Margin</div></div>`;
}

// ═══════════════════════════════════════════════════════
// BLUEPRINT CARDS — UPGRADED (full funnel per SKU)
// ═══════════════════════════════════════════════════════
function renderBlueprintCards() {
  const c1 = document.getElementById('te-sku-grid');
  const c2 = document.getElementById('te-sku-grid-2');
  [c1, c2].forEach(container => {
    if (!container) return;
    if (!teData.processedSKUs.length) {
      container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--dusty);grid-column:1/-1;">Upload file Shopee untuk melihat analisis SKU</div>';
      return;
    }

    const order = { dead:0, high:1, price:2, 'low-margin':3, ok:4 };
    const sorted = [...teData.processedSKUs].sort((a,b) => order[a.flag]-order[b.flag]);
    const rpFmt  = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');

    container.innerHTML = sorted.map(sku => {
      const flagLabel = {
        dead:       '💀 Dead Product',
        high:       '🔥 High Demand',
        price:      '⚠️ Price/Listing Issue',
        'low-margin':'🔴 Low Margin',
        ok:         '✅ Normal',
      }[sku.flag] || '✅ Normal';

      const flagClass = sku.flag === 'dead' ? 'demand-dead' :
                        sku.flag === 'low-margin' ? 'margin-low' :
                        'demand-' + sku.flag;

      const stokText = sku.stokAkhir !== null
        ? (sku.stokAkhir <= 0
            ? '<span style="color:var(--rust);font-weight:700">HABIS</span>'
            : sku.stokAkhir <= sku.safety
              ? `<span style="color:#d97706;font-weight:700">${sku.stokAkhir} ⚠️</span>`
              : `<span style="color:var(--sage);font-weight:700">${sku.stokAkhir}</span>`)
        : '<span style="color:var(--dusty)">—</span>';

      const healthColor = sku.healthScore >= 70 ? 'var(--sage)' :
                          sku.healthScore >= 40 ? '#d97706' : 'var(--rust)';

      // Sinyal Shopee badge
      const signals = [];
      if (sku.isSignalIklan)      signals.push('<span class="sku-signal signal-ads">📣 Iklankan</span>');
      if (sku.isHargaKomp)        signals.push('<span class="sku-signal signal-ok">✅ Harga OK</span>');
      if (sku.isHargaBelumKomp)   signals.push('<span class="sku-signal signal-warn">💰 Cek Harga</span>');

      return `<div class="sku-card ${flagClass}">
        <div class="sku-card-sku">${sku.namaVariasi || sku.skuInduk || sku.skuRef || '—'}</div>
        <div class="sku-card-name" title="${sku.name}">${sku.name.length > 45 ? sku.name.substring(0,45)+'…' : sku.name}</div>
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
          <span class="sku-flag flag-${sku.flag}">${flagLabel}</span>
          ${signals.join('')}
        </div>

        <!-- FUNNEL -->
        <div class="sku-funnel">
          <div class="funnel-step"><span class="funnel-lbl">👁 Views</span><span class="funnel-val">${sku.views > 0 ? sku.views.toLocaleString() : '—'}</span></div>
          <div class="funnel-arrow">▶</div>
          <div class="funnel-step"><span class="funnel-lbl">🖱 Klik</span><span class="funnel-val">${sku.clicks > 0 ? sku.clicks.toLocaleString() : '—'}</span></div>
          <div class="funnel-arrow">▶</div>
          <div class="funnel-step"><span class="funnel-lbl">🛒 Keranjang</span><span class="funnel-val">${sku.keranjang > 0 ? sku.keranjang.toLocaleString() : '—'}</span></div>
          <div class="funnel-arrow">▶</div>
          <div class="funnel-step"><span class="funnel-lbl">✅ Beli</span><span class="funnel-val" style="color:var(--sage);font-weight:800">${sku.salesQty}</span></div>
        </div>

        <!-- METRICS -->
        <div class="sku-metrics" style="margin-top:8px;">
          <div class="sku-metric">
            <div class="sku-metric-lbl">CTR</div>
            <div class="sku-metric-val ${sku.ctr < 2 ? 'red' : 'green'}">${sku.ctr > 0 ? sku.ctr.toFixed(2)+'%' : '—'}</div>
          </div>
          <div class="sku-metric">
            <div class="sku-metric-lbl">Bounce Rate</div>
            <div class="sku-metric-val ${sku.highBounce ? 'red' : ''}">${sku.bounceRate > 0 ? sku.bounceRate.toFixed(1)+'%' : '—'}</div>
          </div>
          <div class="sku-metric">
            <div class="sku-metric-lbl">Abandon Cart</div>
            <div class="sku-metric-val ${sku.abandonCart > sku.salesQty ? 'red' : ''}">${sku.abandonCart > 0 ? sku.abandonCart.toLocaleString() : '—'}</div>
          </div>
          <div class="sku-metric">
            <div class="sku-metric-lbl">Cancel Rate</div>
            <div class="sku-metric-val ${sku.cancelRate > 15 ? 'red' : ''}">${sku.cancelRate > 0 ? sku.cancelRate.toFixed(1)+'%' : '—'}</div>
          </div>
          <div class="sku-metric">
            <div class="sku-metric-lbl">Repeat Order</div>
            <div class="sku-metric-val ${sku.repeatRate > 5 ? 'green' : ''}">${sku.repeatRate > 0 ? sku.repeatRate.toFixed(1)+'%' : '—'}</div>
          </div>
          <div class="sku-metric">
            <div class="sku-metric-lbl">Stok Internal</div>
            <div class="sku-metric-val">${stokText}</div>
          </div>
          <div class="sku-metric">
            <div class="sku-metric-lbl">Real Profit/pcs</div>
            <div class="sku-metric-val ${sku.realProfitPct < 10 ? 'red' : 'green'}">${sku.hpp > 0 ? rpFmt(sku.realProfit) : '—'}</div>
          </div>
          <div class="sku-metric">
            <div class="sku-metric-lbl">Rev Share</div>
            <div class="sku-metric-val ${sku.revShare > 70 ? 'red' : sku.revShare > 50 ? '' : 'green'}">${sku.salesRev > 0 ? sku.revShare.toFixed(1)+'%' : '—'}</div>
          </div>
        </div>

        <!-- HEALTH SCORE -->
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
          <span style="font-size:10px;color:var(--dusty);font-weight:600;text-transform:uppercase;letter-spacing:.8px;">Health Score</span>
          <div style="flex:1;height:5px;background:var(--cream);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${sku.healthScore}%;background:${healthColor};border-radius:3px;transition:width .4s;"></div>
          </div>
          <span style="font-size:11px;font-weight:700;color:${healthColor}">${sku.healthScore}</span>
        </div>

        ${sku.flag !== 'ok' ? `<div class="sku-action" style="margin-top:8px;">${generateSkuAction(sku)}</div>` : ''}
      </div>`;
    }).join('');
  });
}

// ═══════════════════════════════════════════════════════
// ACTION GENERATOR — UPGRADED
// ═══════════════════════════════════════════════════════
function generateSkuAction(sku) {
  const restockUnits = Math.max(20, sku.salesQty * 2);
  if (sku.flag === 'dead') {
    if (sku.highBounce)
      return `💀 Produk mati — bounce rate ${sku.bounceRate.toFixed(0)}% sangat tinggi. Ganti foto utama segera, tambahkan video produk, cek apakah judul mengandung keyword yang relevan.`;
    return `💀 Produk mati — ${sku.views.toLocaleString()} views tapi 0 terjual. Audit listing: foto, judul, harga vs kompetitor. Pertimbangkan hapus & reupload dengan listing fresh.`;
  }
  if (sku.flag === 'high') {
    if (sku.stokAkhir !== null && sku.stokAkhir <= sku.safety)
      return `🚨 Stok ${sku.stokAkhir} pcs kritis! Segera restock ${restockUnits} pcs. Demand naik ${sku.growth.toFixed(0)}% — jangan sampai kehabisan stok saat momentum naik!`;
    if (sku.abandonCart > sku.salesQty)
      return `🔥 Demand naik ${sku.growth.toFixed(0)}% tapi ${sku.abandonCart} abandon cart. Buat flash sale atau voucher untuk konversi mereka sekarang!`;
    return `🚀 Demand naik ${sku.growth.toFixed(0)}% — naikkan bid iklan, siapkan stok ${restockUnits} pcs.`;
  }
  if (sku.flag === 'price') {
    if (sku.highBounce)
      return `⚠️ Views tinggi, bounce ${sku.bounceRate.toFixed(0)}%, 0 konversi — masalah utama di foto/listing. Ganti foto utama, optimalkan deskripsi, pertimbangkan voucher.`;
    return `👁️ Views tinggi tapi konversi rendah — cek kompetitor, optimalkan judul & foto, coba voucher atau flash sale.`;
  }
  if (sku.flag === 'low-margin') {
    return `💸 Margin ${sku.realProfitPct.toFixed(1)}% terlalu tipis. Kurangi budget ads untuk SKU ini, negosiasi HPP ke supplier, atau naikkan harga jual 5–10%.`;
  }
  return '';
}

// ═══════════════════════════════════════════════════════
// ACTION PLAN — UPGRADED
// ═══════════════════════════════════════════════════════
function renderActionPlan() {
  const container = document.getElementById('te-action-plan');
  if (!container) return;

  const steps       = [];
  let stepNum       = 1;
  const skus        = teData.processedSKUs;
  const highDemand  = skus.filter(s => s.flag === 'high');
  const priceIssue  = skus.filter(s => s.flag === 'price');
  const lowMargin   = skus.filter(s => s.flag === 'low-margin');
  const deadProds   = skus.filter(s => s.isDead);
  const lowStock    = skus.filter(s => s.stokAkhir !== null && s.stokAkhir <= s.safety && s.salesQty > 0);
  const highAbandon = [...skus].sort((a,b) => b.abandonCart - a.abandonCart).filter(s => s.abandonCart > 0).slice(0,3);
  const signalIklan = skus.filter(s => s.isSignalIklan);

  if (lowStock.length > 0) {
    const restockTotal = lowStock.reduce((t,s) => t + Math.max(20, s.salesQty*2), 0);
    steps.push({
      num: stepNum++, urgent: true,
      title: `🚨 URGENT: Restock ${lowStock.length} SKU sebelum kehabisan`,
      desc: `${lowStock.slice(0,3).map(s=>`<strong>${s.skuRef||s.name.substring(0,15)}</strong> (${s.stokAkhir} pcs)`).join(', ')} — stok kritis padahal masih terjual. Target restock ±${restockTotal} pcs total segera.`,
      tag: 'tag-restock', tagLabel: '🔄 Restock'
    });
  }

  if (highAbandon.length > 0 && highAbandon[0].abandonCart > 0) {
    const totalAb = highAbandon.reduce((t,s) => t+s.abandonCart, 0);
    steps.push({
      num: stepNum++, urgent: true,
      title: `🛒 Konversi ${totalAb.toLocaleString()} Abandon Cart menjadi Penjualan`,
      desc: `${highAbandon.map(s=>`<strong>${s.skuRef||s.name.substring(0,15)}</strong> (${s.abandonCart} org)`).join(', ')} sudah masuk keranjang tapi belum beli. Buat voucher diskon 5% atau flash sale 24 jam untuk trigger mereka beli sekarang!`,
      tag: 'tag-ads', tagLabel: '🛒 Abandon Cart'
    });
  }

  if (deadProds.length > 0) {
    steps.push({
      num: stepNum++, urgent: false,
      title: `💀 Audit Listing ${deadProds.length} Dead Product`,
      desc: `${deadProds.slice(0,3).map(s=>`<strong>${s.skuRef||s.name.substring(0,15)}</strong>`).join(', ')} — views ada tapi 0 terjual. Checklist: (1) Foto utama menarik? (2) Judul ada keyword? (3) Harga kompetitif? (4) Ada review?`,
      tag: 'tag-listing', tagLabel: '💀 Dead Product'
    });
  }

  if (signalIklan.length > 0) {
    steps.push({
      num: stepNum++, urgent: false,
      title: `📣 Pasang Iklan untuk ${signalIklan.length} SKU — Rekomendasi Shopee`,
      desc: `${signalIklan.slice(0,3).map(s=>`<strong>${s.skuRef||s.name.substring(0,15)}</strong>`).join(', ')} direkomendasikan Shopee untuk diiklankan. Start budget kecil Rp 20-30rb/hari, ukur CTR 7 hari pertama.`,
      tag: 'tag-ads', tagLabel: '📣 Ads'
    });
  }

  if (highDemand.length > 0) {
    steps.push({
      num: stepNum++, urgent: false,
      title: `🔥 Tingkatkan Budget Iklan ${highDemand.length} SKU Trending`,
      desc: `${highDemand.slice(0,3).map(s=>`<strong>${s.skuRef||s.name.substring(0,15)}</strong> (+${s.growth.toFixed(0)}%)`).join(', ')} demand naik. Ini waktu terbaik push iklan — ROAS lebih mudah saat produk sedang trend.`,
      tag: 'tag-ads', tagLabel: '📣 Ads'
    });
  }

  if (priceIssue.length > 0) {
    steps.push({
      num: stepNum++, urgent: false,
      title: `🔧 Optimasi Listing ${priceIssue.length} SKU — Views Tinggi Konversi Rendah`,
      desc: `${priceIssue.slice(0,2).map(s=>`<strong>${s.skuRef||s.name.substring(0,15)}</strong>`).join(', ')} — traffic ada tapi tidak convert. Fokus: ganti foto utama, optimalkan judul dengan keyword, tambah video produk.`,
      tag: 'tag-listing', tagLabel: '📝 Listing'
    });
  }

  if (lowMargin.length > 0) {
    steps.push({
      num: stepNum++, urgent: false,
      title: `💰 Perbaiki Margin ${lowMargin.length} SKU Low Profit`,
      desc: `${lowMargin.slice(0,2).map(s=>`<strong>${s.skuRef||s.name.substring(0,15)}</strong> (${s.realProfitPct.toFixed(1)}%)`).join(', ')} — margin di bawah 10%. Kurangi ads spend, negosiasi HPP supplier, atau naikkan harga jual minimal 5–10%.`,
      tag: 'tag-profit', tagLabel: '💸 Margin'
    });
  }

  if (steps.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--dusty)">Upload file Shopee di tab sebelumnya untuk generate Action Plan otomatis.</div>';
    return;
  }

  const tgl = new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'});
  container.innerHTML = `<div class="action-plan">
    <div class="action-plan-header">📋 Action Plan Otomatis — ${tgl}</div>
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
  if (!teData.processedSKUs.length) { container.innerHTML = ''; return; }

  const rpFmt  = n => 'Rp ' + Math.round(n).toLocaleString('id-ID');
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
        <th>Admin Fee</th><th>Real Profit/pcs</th><th>Margin %</th>
        <th>Rev Share</th><th>Status</th>
      </tr></thead>
      <tbody>${sorted.map((s,i) => `<tr class="${s.realProfitPct < 10 ? 'margin-warning' : 'margin-ok'}">
        <td class="mono">${i+1}</td>
        <td style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.skuRef || s.name.substring(0,20)}</td>
        <td class="mono">${rpFmt(s.hpp)}</td>
        <td class="mono">${rpFmt(s.hargaJual)}</td>
        <td class="mono">${rpFmt(s.adminFee)}</td>
        <td class="mono" style="color:${s.realProfit>=0?'var(--sage)':'var(--rust)'};font-weight:700">${rpFmt(s.realProfit)}</td>
        <td><span class="badge ${s.realProfitPct<10?'br':s.realProfitPct<20?'bo':'bg'}">${s.realProfitPct.toFixed(1)}%</span></td>
        <td><span class="badge ${s.revShare>70?'br':s.revShare>50?'bo':'bg'}">${s.salesRev>0?s.revShare.toFixed(1)+'%':'—'}</span></td>
        <td>${s.realProfitPct < 10 ? '<span class="badge br">⚠ Rendah</span>' : '<span class="badge bg">✅ OK</span>'}</td>
      </tr>`).join('')}</tbody>
    </table>
  </div>`;
}

// ═══════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════
function updateTESettings() {
  const adminPctEl  = document.getElementById('te-admin-pct');
  const adsBudgetEl = document.getElementById('te-ads-budget');
  if (adminPctEl)  teData.shopeeAdminPct = (parseFloat(adminPctEl.value) || 8.5) / 100;
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
