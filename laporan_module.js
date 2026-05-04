// ================================================================
// LAPORAN MODULE — zenOt Operasional — build 2026.05.04
// Laporan Keuangan Bulanan per Toko
// Formula: persis RKS-ZENOOT (validated Burhanmology)
// Storage: Supabase (tabel laporan_keuangan)
// ================================================================

(function() {

// ─── SUPABASE HELPERS ───────────────────────────────────────────
function _sbHeaders() {
  return {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Prefer': 'return=representation'
  };
}

async function _sbUpsertLaporan(row) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/laporan_keuangan?on_conflict=toko,bulan`,
    {
      method: 'POST',
      headers: { ..._sbHeaders(), 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify([row])
    }
  );
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function _sbGetLaporan(toko, bulan) {
  const url = `${SUPABASE_URL}/rest/v1/laporan_keuangan?toko=eq.${encodeURIComponent(toko)}&bulan=eq.${bulan}&select=*`;
  const res = await fetch(url, { headers: _sbHeaders() });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return rows[0] || null;
}

async function _sbGetAllLaporan(toko) {
  const url = `${SUPABASE_URL}/rest/v1/laporan_keuangan?toko=eq.${encodeURIComponent(toko)}&select=*&order=bulan.desc`;
  const res = await fetch(url, { headers: _sbHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function _sbGetAllToko() {
  const url = `${SUPABASE_URL}/rest/v1/laporan_keuangan?select=toko,bulan&order=toko.asc,bulan.desc`;
  const res = await fetch(url, { headers: _sbHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── XLSX PARSER (pakai SheetJS dari CDN) ───────────────────────
function _readXlsx(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        resolve(wb);
      } catch(err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Gagal baca file'));
    reader.readAsArrayBuffer(file);
  });
}

function _readCsv(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Gagal baca CSV'));
    reader.readAsText(file, 'utf-8');
  });
}

// ─── PARSE INCOME FILE ──────────────────────────────────────────
function parseIncomeFile(wb) {
  // Parse Summary sheet
  const summarySheet = wb.Sheets['Summary'];
  if (!summarySheet) throw new Error('Sheet "Summary" tidak ditemukan di file Income');

  const rows = XLSX.utils.sheet_to_json(summarySheet, { header: 1, defval: '' });
  const data = {};

  // Mapping label → key
  const topMap = {
    '1. Total Pendapatan': 'total_pendapatan',
    '3. Total yang Dilepas': 'dana_dilepas',
  };
  const subMap = {
    'Biaya Komisi AMS': 'komisi_ams',
    'Biaya Administrasi': 'biaya_admin',
    'Biaya Layanan': 'biaya_layanan',
    'Biaya Proses Pesanan': 'biaya_proses',
    'Premi': 'premi',
    'Biaya Program Hemat Biaya Kirim': 'biaya_hemat_kirim',
    'Biaya Transaksi': 'biaya_transaksi',
    'Biaya Kampanye': 'biaya_kampanye',
    'Biaya Isi Saldo Otomatis (dari Penghasilan)': 'biaya_saldo_otomatis',
  };

  rows.forEach(row => {
    const l0 = String(row[0]||'').trim();
    const l1 = String(row[1]||'').trim();
    const v3 = row[3]; // top-level value
    const v2 = row[2]; // sub-level value

    for (const [k, field] of Object.entries(topMap)) {
      if (l0 === k && v3 !== '' && v3 !== undefined) {
        data[field] = Number(v3) || 0;
      }
    }
    for (const [k, field] of Object.entries(subMap)) {
      if (l1 === k && v2 !== '' && v2 !== undefined) {
        data[field] = Number(v2) || 0;
      }
    }
  });

  // Total Penghasilan = Dana Dilepas + abs(Biaya Isi Saldo Otomatis)
  data.total_penghasilan = (data.dana_dilepas || 0) + Math.abs(data.biaya_saldo_otomatis || 0);

  // Parse Income sheet — ambil No. Pesanan
  const incSheet = wb.Sheets['Income'];
  if (!incSheet) throw new Error('Sheet "Income" tidak ditemukan');
  const incRows = XLSX.utils.sheet_to_json(incSheet, { header: 1, defval: '' });

  // Cari header row
  let headerIdx = -1;
  for (let i = 0; i < incRows.length; i++) {
    if (incRows[i].includes('No. Pesanan')) { headerIdx = i; break; }
  }
  if (headerIdx < 0) throw new Error('Header "No. Pesanan" tidak ditemukan di sheet Income');

  const headers = incRows[headerIdx];
  const noPesananCol = headers.indexOf('No. Pesanan');
  data.income_orders = [];
  for (let i = headerIdx + 1; i < incRows.length; i++) {
    const val = String(incRows[i][noPesananCol]||'').trim();
    if (val && val !== 'No. Pesanan') data.income_orders.push(val);
  }

  return data;
}

// ─── PARSE ORDER FILE ───────────────────────────────────────────
function parseOrderFile(wb) {
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

  return rows.map(r => ({
    noPesanan: String(r['No. Pesanan']||'').trim(),
    sku: String(r['Nomor Referensi SKU']||r['SKU Variasi']||'').trim(),
    skuInduk: String(r['SKU Induk']||'').trim(),
    qty: Number(r['Jumlah']||0),
    totalBayar: Number(r['Total Pembayaran']||0) * 1000,
  })).filter(r => r.noPesanan);
}

// ─── PARSE ADS CSV ──────────────────────────────────────────────
function parseAdsFile(csvText, bulan) {
  // Format CSV Shopee Adwords Bill:
  // Baris 0-4 : metadata (Riwayat Transaksi, Username, Tanggal, dll)
  // Baris 6   : header → Urutan,Waktu,Deskripsi,Jumlah,Catatan
  // Baris 7+  : data   → 1,31/03/2026,Iklan Produk Otomatis,-2808,-
  //
  // Yang dihitung: semua baris dengan Jumlah NEGATIF dan Deskripsi = iklan
  // Keywords iklan: 'Iklan', 'Ads', 'Ad ', 'Deduction for Product'
  // SKIP       : 'Isi Saldo', 'Bonus Saldo', kredit/positif apapun

  let total = 0;
  const lines = csvText.split('\n');

  // Siapkan filter bulan dari parameter (format "YYYY-MM", misal "2026-03")
  let filterYear = '', filterMonth = '';
  if (bulan && /^\d{4}-\d{2}$/.test(bulan)) {
    [filterYear, filterMonth] = bulan.split('-');
  }

  // Cari index kolom dari header row
  let colWaktu = 1, colDesc = 2, colJumlah = 3; // default posisi
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const parts = lines[i].split(',').map(p => p.trim().replace(/^"|"$/g,''));
    const lower = parts.map(p => p.toLowerCase());
    if (lower.includes('waktu') || lower.includes('tanggal') || lower.includes('date')) {
      colWaktu  = lower.findIndex(p => p === 'waktu' || p === 'tanggal' || p === 'date' || p === 'time');
      colDesc   = lower.findIndex(p => p === 'deskripsi' || p === 'description' || p === 'keterangan');
      colJumlah = lower.findIndex(p => p === 'jumlah' || p === 'amount' || p === 'debit' || p === 'tagihan' || p.includes('jumlah'));
      if (colWaktu < 0) colWaktu = 1;
      if (colDesc  < 0) colDesc  = 2;
      if (colJumlah < 0) colJumlah = 3;
      break;
    }
  }

  for (const line of lines) {
    const raw = line.trim();
    if (!raw) continue;
    const parts = raw.split(',').map(p => p.trim().replace(/^"|"$/g,''));
    // Baris data harus punya kolom cukup dan kolom pertama berupa angka (urutan)
    if (parts.length < 4 || !/^\d+$/.test(parts[0])) continue;

    const waktu  = parts[colWaktu]  || '';
    const desc   = parts[colDesc]   || '';
    const jumlah = parts[colJumlah] || '';

    // Filter bulan — format tanggal CSV: DD/MM/YYYY
    if (filterYear && filterMonth) {
      // DD/MM/YYYY → split by /
      const tParts = waktu.split('/');
      if (tParts.length === 3) {
        const tMonth = tParts[1].padStart(2,'0');
        const tYear  = tParts[2];
        if (tYear !== filterYear || tMonth !== filterMonth) continue;
      }
    }

    // Cek deskripsi: harus keyword iklan
    const descLow = desc.toLowerCase();
    const isIklan = descLow.includes('iklan') ||
                    descLow.includes('ads')   ||
                    descLow.includes('deduction for product') ||
                    descLow.includes('product ad') ||
                    descLow.includes('sponsored');

    if (!isIklan) continue;

    // Ambil nilai — harus negatif (pengeluaran)
    const val = parseInt(jumlah.replace(/[^0-9-]/g, ''), 10);
    if (!isNaN(val) && val < 0) {
      total += Math.abs(val);
    }
  }

  console.log('[parseAdsFile] bulan:', bulan, '| total iklan:', total);
  return total;
}

// ─── GET HPP dari DB.produk ──────────────────────────────────────
function getHppBySku(skuVar, skuInduk) {
  const produk = (typeof DB !== 'undefined' ? DB.produk : []) || [];

  // 1. Exact match by var
  let p = produk.find(x => x.var && x.var.toLowerCase() === skuVar.toLowerCase());
  if (p) return Number(p.hpp) || 0;

  // 2. Fuzzy match — normalize (hapus size suffix: -M, -L, -XL, -S)
  const normalize = s => s.toLowerCase()
    .replace(/[-_](xs|s|m|l|xl|xxl|2xl)\s*$/i, '')
    .replace(/[-_\s]+/g, '_').trim();

  const normVar = normalize(skuVar);
  p = produk.find(x => x.var && normalize(x.var) === normVar);
  if (p) return Number(p.hpp) || 0;

  // 3. Match by induk
  if (skuInduk) {
    const byInduk = produk.filter(x => x.induk && x.induk.toLowerCase() === skuInduk.toLowerCase());
    if (byInduk.length > 0) {
      const avg = byInduk.reduce((s, x) => s + (Number(x.hpp)||0), 0) / byInduk.length;
      return Math.round(avg);
    }
  }

  // 4. Fallback — average semua produk dengan induk yang mirip
  const indukFromVar = skuVar.split('_')[0];
  const byIndukFuzzy = produk.filter(x => x.induk && x.induk.toLowerCase().startsWith(indukFromVar.toLowerCase()));
  if (byIndukFuzzy.length > 0) {
    return Number(byIndukFuzzy[0].hpp) || 0;
  }

  return 0;
}

// ─── KALKULASI UTAMA ────────────────────────────────────────────
// Formula validated RKS-ZENOOT — TIDAK BOLEH DIUBAH
function kalkulasi(incData, allOrders, iklan, operasional) {
  const tp = incData.total_pendapatan || 0;
  const tph = incData.total_penghasilan || 0;

  // HPP — dari income orders × HPP per SKU (dari Kelola Produk)
  const incomeOrderSet = new Set(incData.income_orders || []);
  let hppTotal = 0;
  let qtyTotal = 0;

  allOrders.forEach(order => {
    if (!incomeOrderSet.has(order.noPesanan)) return;
    const hpp = getHppBySku(order.sku, order.skuInduk);
    hppTotal += hpp * order.qty;
    qtyTotal += order.qty;
  });

  // AOV & Basket — dari semua order di file (bukan hanya income orders)
  const byOrder = {};
  allOrders.forEach(o => {
    if (!byOrder[o.noPesanan]) byOrder[o.noPesanan] = { total: 0, qty: 0 };
    byOrder[o.noPesanan].total += o.totalBayar;
    byOrder[o.noPesanan].qty += o.qty;
  });
  const orderList = Object.values(byOrder);
  const nOrders = orderList.length;
  const aov = nOrders > 0 ? orderList.reduce((s, o) => s + o.total, 0) / nOrders : 0;
  const basket = nOrders > 0 ? orderList.reduce((s, o) => s + o.qty, 0) / nOrders : 0;

  // Total admin (semua biaya Shopee — sudah negatif dari file)
  // NOTE: biaya_saldo_otomatis TIDAK dimasukkan di sini karena sudah di-add back
  // ke Total Penghasilan (total_penghasilan = dana_dilepas + abs(biaya_saldo_otomatis)).
  // Memasukkannya di sini akan double-count → mismatch dengan logika RKS-ZENOOT.
  const totalAdmin = (incData.komisi_ams||0) + (incData.biaya_admin||0) +
    (incData.biaya_layanan||0) + (incData.biaya_proses||0) +
    (incData.premi||0) + (incData.biaya_hemat_kirim||0) +
    (incData.biaya_transaksi||0) + (incData.biaya_kampanye||0);
  // biaya_saldo_otomatis ditampilkan terpisah di tabel (baris sendiri),
  // tapi TIDAK masuk ke total_admin / rasio_admin.

  // LABA = Total Penghasilan - HPP - Iklan - Operasional
  const laba = tph - hppTotal - iklan - operasional;

  // SEMUA RASIO → base = Total Pendapatan
  const rasioAdmin  = tp ? totalAdmin / tp : 0;
  const rasioMargin = tp ? (tp - hppTotal) / tp : 0;
  const rasioLaba   = tp ? laba / tp : 0;
  const roas        = iklan ? tp / iklan : 0;

  return {
    total_pendapatan:     Math.round(tp),
    total_penghasilan:    Math.round(tph),
    dana_dilepas:         Math.round(incData.dana_dilepas || 0),
    komisi_ams:           Math.round(incData.komisi_ams||0),
    biaya_admin:          Math.round(incData.biaya_admin||0),
    biaya_layanan:        Math.round(incData.biaya_layanan||0),
    biaya_proses:         Math.round(incData.biaya_proses||0),
    premi:                Math.round(incData.premi||0),
    biaya_hemat_kirim:    Math.round(incData.biaya_hemat_kirim||0),
    biaya_transaksi:      Math.round(incData.biaya_transaksi||0),
    biaya_kampanye:       Math.round(incData.biaya_kampanye||0),
    biaya_saldo_otomatis: Math.round(incData.biaya_saldo_otomatis||0),
    total_admin:          Math.round(totalAdmin),
    hpp_total:            Math.round(hppTotal),
    hpp_per_item:         qtyTotal > 0 ? Math.round(hppTotal / qtyTotal) : 0,
    qty_terjual:          qtyTotal,
    operasional:          Math.round(operasional),
    iklan:                Math.round(iklan),
    laba:                 Math.round(laba),
    rasio_margin:         parseFloat(rasioMargin.toFixed(4)),
    rasio_laba:           parseFloat(rasioLaba.toFixed(4)),
    rasio_admin:          parseFloat(rasioAdmin.toFixed(4)),
    aov:                  parseFloat(aov.toFixed(2)),
    basket_size:          parseFloat(basket.toFixed(3)),
    roas:                 parseFloat(roas.toFixed(3)),
    n_orders:             nOrders,
  };
}

// ─── STATE ──────────────────────────────────────────────────────
let _laporanState = {
  toko: '',
  bulan: '',
  files: { income: null, order1: null, order2: null, ads: null },
  iklanFromCsv: 0,
  parsed: null,
  history: [],
  loading: false,
};

// ─── RENDER PAGE ────────────────────────────────────────────────
function renderLaporan() {
  const el = document.getElementById('page-laporan');
  if (!el) return;

  const channels = (typeof DB !== 'undefined' ? DB.channel||[] : [])
    .filter(c => c.nama !== '__assign__' && c.status === 'Aktif');

  // Default toko = pertama
  if (!_laporanState.toko && channels.length > 0) {
    _laporanState.toko = channels[0].nama;
  }

  // Default bulan = bulan ini
  if (!_laporanState.bulan) {
    const d = new Date();
    _laporanState.bulan = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  el.innerHTML = `
  <style>
    .lap-wrap { display:grid;grid-template-columns:1fr 320px;gap:20px;align-items:start; }
    .lap-card { background:var(--card);border:1px solid var(--border);border-radius:14px;padding:20px 22px;margin-bottom:16px; }
    .lap-title { font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:var(--dusty);margin-bottom:14px; }
    .lap-upload-box { border:2px dashed var(--border);border-radius:10px;padding:14px 16px;cursor:pointer;transition:border-color .15s,background .15s;position:relative;margin-bottom:10px; }
    .lap-upload-box:hover { border-color:var(--brown);background:rgba(92,61,46,.04); }
    .lap-upload-box.done { border-color:var(--sage);background:rgba(90,122,106,.06); border-style:solid; }
    .lap-upload-box.error { border-color:var(--rust);background:rgba(180,60,30,.04); }
    .lap-upload-label { font-size:12px;font-weight:600;color:var(--charcoal);margin-bottom:2px; }
    .lap-upload-sub { font-size:10px;color:var(--dusty); }
    .lap-upload-input { position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%; }
    .lap-upload-icon { font-size:16px;margin-right:8px; }
    .lap-manual { display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px; }
    .lap-field label { font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:var(--dusty);display:block;margin-bottom:4px; }
    .lap-field input { width:100%;padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-weight:700;font-family:'DM Mono',monospace;color:var(--charcoal);background:var(--card);outline:none;box-sizing:border-box;transition:border-color .2s; }
    .lap-field input:focus { border-color:var(--brown); }
    .lap-proses-btn { width:100%;padding:12px;background:var(--brown);color:var(--cream);border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;transition:background .2s;letter-spacing:.3px; }
    .lap-proses-btn:hover { background:#3d2419; }
    .lap-proses-btn:disabled { background:var(--dusty);cursor:not-allowed; }

    /* Tabel hasil */
    .lap-hasil-table { width:100%;border-collapse:collapse; }
    .lap-hasil-table tr td { padding:9px 14px;font-size:12px;border-bottom:1px solid var(--border); }
    .lap-hasil-table tr:last-child td { border-bottom:none; }
    .lap-hasil-table .row-header td { background:var(--charcoal)!important;color:#fff!important;font-weight:700;font-size:11px;letter-spacing:.5px; }
    .lap-hasil-table .row-bold td { font-weight:700;font-size:13px; }
    .lap-hasil-table .row-sub td:first-child { padding-left:28px;color:var(--dusty); }
    .lap-hasil-table .row-green { background:rgba(90,122,106,.07); }
    .lap-hasil-table .row-red { background:rgba(200,50,50,.06); }
    .lap-hasil-table .row-gold { background:rgba(212,160,23,.07); }
    .lap-hasil-table .row-cream { background:var(--cream); }
    .lap-nilai { text-align:right;font-family:'DM Mono',monospace;font-weight:700; }
    .lap-rasio { text-align:right;font-size:10.5px;color:var(--dusty);font-style:italic; }
    .lap-negatif { color:#C83232; }
    .lap-laba-row td { font-size:14px!important;font-weight:800!important; }
    .lap-laba-row.merah { background:rgba(200,50,50,.1)!important; }
    .lap-laba-row.merah td { color:#C83232; }
    .lap-laba-row.hijau { background:rgba(90,122,106,.1)!important; }
    .lap-laba-row.hijau td { color:var(--sage); }

    /* History */
    .lap-history-item { display:flex;align-items:center;justify-content:space-between;padding:10px 12px;border-radius:8px;cursor:pointer;border:1px solid var(--border);margin-bottom:6px;transition:background .12s; }
    .lap-history-item:hover { background:var(--cream); }
    .lap-history-item.active { border-color:var(--brown);background:rgba(92,61,46,.07); }

    @media(max-width:900px){ .lap-wrap{grid-template-columns:1fr;} }
  </style>

  <div class="lap-wrap">

    <!-- PANEL KIRI: Hasil Laporan -->
    <div id="lap-hasil-wrap">
      ${_laporanState.parsed ? _renderHasil(_laporanState.parsed) : `
        <div class="lap-card" style="text-align:center;padding:60px 20px;">
          <div style="font-size:40px;margin-bottom:16px;">📊</div>
          <div style="font-size:14px;font-weight:700;color:var(--charcoal);margin-bottom:8px;">Belum ada laporan</div>
          <div style="font-size:12px;color:var(--dusty);">Upload file & klik Proses untuk generate laporan keuangan</div>
        </div>
      `}
    </div>

    <!-- PANEL KANAN: Upload + Config -->
    <div>
      <!-- Pilih Toko & Bulan -->
      <div class="lap-card">
        <div class="lap-title">📊 Pilih Toko & Periode</div>
        <div class="lap-manual">
          <div class="lap-field">
            <label>Toko</label>
            <select class="sel" id="lap-toko" onchange="_laporanSetToko(this.value)">
              ${channels.map(c => `<option value="${c.nama}" ${c.nama===_laporanState.toko?'selected':''}>${c.nama}</option>`).join('')}
            </select>
          </div>
          <div class="lap-field">
            <label>Bulan</label>
            <input type="month" class="lap-field input" id="lap-bulan" value="${_laporanState.bulan}"
              style="padding:9px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;width:100%;box-sizing:border-box;background:var(--card);color:var(--charcoal);outline:none;"
              onchange="_laporanSetBulan(this.value)">
          </div>
        </div>
      </div>

      <!-- Upload 4 File -->
      <div class="lap-card">
        <div class="lap-title">📁 Upload File Shopee</div>

        <div class="lap-upload-box ${_laporanState.files.income?'done':''}" id="box-income">
          <span class="lap-upload-icon">💰</span>
          <span class="lap-upload-label">Income Sudah Dilepas (.xlsx)</span><br>
          <span class="lap-upload-sub">${_laporanState.files.income ? '✅ '+_laporanState.files.income.name : 'Keuangan → Penghasilan → Export'}</span>
          <input type="file" class="lap-upload-input" accept=".xlsx" onchange="_laporanUpload('income',this)">
        </div>
        <div id="lap-autodetect-info" style="font-size:11px;color:var(--sage);font-weight:600;padding:4px 2px;min-height:18px;">
          ${_laporanState.toko && _laporanState.files.income ? `🔍 Terdeteksi: ${_laporanState.toko} | ${_laporanState.bulan}` : ''}
        </div>

        <div class="lap-upload-box ${_laporanState.files.order1?'done':''}" id="box-order1">
          <span class="lap-upload-icon">📦</span>
          <span class="lap-upload-label">Order Selesai Bulan Ini (.xlsx)</span><br>
          <span class="lap-upload-sub">${_laporanState.files.order1 ? '✅ '+_laporanState.files.order1.name : 'Data → Pesanan Selesai → Export'}</span>
          <input type="file" class="lap-upload-input" accept=".xlsx" onchange="_laporanUpload('order1',this)">
        </div>

        <div class="lap-upload-box ${_laporanState.files.order2?'done':''}" id="box-order2">
          <span class="lap-upload-icon">📦</span>
          <span class="lap-upload-label">Order Selesai Bulan Lalu (.xlsx)</span><br>
          <span class="lap-upload-sub">${_laporanState.files.order2 ? '✅ '+_laporanState.files.order2.name : 'Untuk match HPP yang baru dilepas bulan ini'}</span>
          <input type="file" class="lap-upload-input" accept=".xlsx" onchange="_laporanUpload('order2',this)">
        </div>

        <div class="lap-upload-box ${_laporanState.files.ads?'done':''}" id="box-ads">
          <span class="lap-upload-icon">📣</span>
          <span class="lap-upload-label">Adwords Bill (.csv) — opsional</span><br>
          <span class="lap-upload-sub">${_laporanState.files.ads ? '✅ '+_laporanState.files.ads.name : 'Shopee Ads → Tagihan → Export CSV'}</span>
          <input type="file" class="lap-upload-input" accept=".csv" onchange="_laporanUpload('ads',this)">
        </div>
      </div>

      <!-- Input Manual -->
      <div class="lap-card">
        <div class="lap-title">✏️ Input Manual</div>
        <div class="lap-manual">
          <div class="lap-field">
            <label>Iklan Bulan Ini (Rp)</label>
            <input type="number" id="lap-iklan" placeholder="0"
              value="${_getLaporanOps('iklan')}" oninput="_laporanSaveOps()">
          </div>
          <div class="lap-field">
            <label>Operasional (Rp)</label>
            <input type="number" id="lap-ops" placeholder="0"
              value="${_getLaporanOps('operasional')}" oninput="_laporanSaveOps()">
          </div>
        </div>
        <div style="font-size:10px;color:var(--dusty);margin-top:-6px;">
          💡 Iklan & Operasional auto-load dari Perencanaan → Ops per Toko jika sudah diisi
        </div>
      </div>

      <!-- Tombol Proses -->
      <button class="lap-proses-btn" id="lap-proses-btn" onclick="_laporanProses()">
        ⚡ Proses & Simpan Laporan
      </button>

      <!-- History -->
      <div class="lap-card" style="margin-top:16px;" id="lap-history-wrap">
        <div class="lap-title">📅 Riwayat Laporan — ${_laporanState.toko}</div>
        <div id="lap-history-list">
          <div style="color:var(--dusty);font-size:12px;text-align:center;padding:10px;">Memuat...</div>
        </div>
      </div>
    </div>


  </div>
  `;

  // Load history
  _laporanLoadHistory(_laporanState.toko);
}

// ─── RENDER HASIL TABEL ─────────────────────────────────────────
function _renderHasil(h, bulanLabel) {
  const fmtRp = v => {
    const n = Math.round(Number(v)||0);
    if (n < 0) return `<span class="lap-negatif">(${Math.abs(n).toLocaleString('id-ID')})</span>`;
    return n.toLocaleString('id-ID');
  };
  const fmtPct = v => `${(Number(v||0)*100).toFixed(2)}%`;
  const fmtDec = v => Number(v||0).toLocaleString('id-ID',{minimumFractionDigits:2,maximumFractionDigits:2});

  const bulan = bulanLabel || _laporanState.bulan;
  const labaClass = h.laba < 0 ? 'merah' : 'hijau';

  return `
  <div class="lap-card">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
      <div>
        <div style="font-size:16px;font-weight:800;font-family:'DM Serif Display',serif;color:var(--charcoal);">
          Laporan Keuangan
        </div>
        <div style="font-size:11px;color:var(--dusty);margin-top:2px;">${_laporanState.toko} · ${bulan}</div>
      </div>
      <div style="display:flex;gap:8px;">
        <button onclick="_laporanExport()" style="padding:7px 14px;border-radius:8px;border:1.5px solid var(--border);background:var(--card);color:var(--charcoal);font-size:11px;font-weight:600;cursor:pointer;">⬇️ Export</button>
      </div>
    </div>

    <table class="lap-hasil-table">
      <tr class="row-header">
        <td>HASIL</td><td class="lap-nilai">NILAI</td><td class="lap-rasio">RASIO</td>
      </tr>
      <tr class="row-bold row-green">
        <td>TOTAL PENDAPATAN</td>
        <td class="lap-nilai">${fmtRp(h.total_pendapatan)}</td>
        <td></td>
      </tr>
      <tr class="row-bold row-cream">
        <td>TOTAL PENGHASILAN</td>
        <td class="lap-nilai">${fmtRp(h.total_penghasilan)}</td>
        <td></td>
      </tr>
      <tr>
        <td style="padding-left:28px;color:var(--dusty);font-size:11px;">HPP</td>
        <td class="lap-nilai">${fmtRp(h.hpp_total)}</td>
        <td></td>
      </tr>
      <tr>
        <td style="padding-left:28px;color:var(--dusty);font-size:11px;">OPERASIONAL</td>
        <td class="lap-nilai">${fmtRp(h.operasional)}</td>
        <td class="lap-rasio">${fmtPct(h.operasional/h.total_pendapatan)}</td>
      </tr>
      <tr>
        <td style="padding-left:28px;color:var(--dusty);font-size:11px;">IKLAN</td>
        <td class="lap-nilai">${fmtRp(h.iklan)}</td>
        <td class="lap-rasio">${fmtPct(h.iklan/h.total_pendapatan)}</td>
      </tr>
      <tr class="row-bold row-cream">
        <td>RASIO ADMIN DAN LAYANAN</td>
        <td class="lap-nilai lap-negatif">${fmtRp(h.total_admin)}</td>
        <td class="lap-rasio">${fmtPct(h.rasio_admin)}</td>
      </tr>
      ${[
        ['Biaya Komisi AMS','komisi_ams'],
        ['Biaya Administrasi','biaya_admin'],
        ['Biaya Layanan','biaya_layanan'],
        ['Biaya Proses Pesanan','biaya_proses'],
        ['Premi','premi'],
        ['Biaya Program Hemat Biaya Kirim','biaya_hemat_kirim'],
        ['Biaya Transaksi','biaya_transaksi'],
        ['Biaya Kampanye','biaya_kampanye'],
        ['Biaya Isi Saldo Otomatis (dari Penghasilan)','biaya_saldo_otomatis'],
      ].map(([label, key]) => `
        <tr class="row-sub">
          <td>${label}</td>
          <td class="lap-nilai">${fmtRp(h[key])}</td>
          <td class="lap-rasio">${h.total_pendapatan ? fmtPct(h[key]/h.total_pendapatan) : '0%'}</td>
        </tr>
      `).join('')}
      <tr class="row-bold row-gold">
        <td>AOV AKTUAL</td>
        <td class="lap-nilai">${fmtRp(h.aov)}</td>
        <td></td>
      </tr>
      <tr class="row-bold row-gold">
        <td>BASKET SIZE AKTUAL</td>
        <td class="lap-nilai">${fmtDec(h.basket_size)}</td>
        <td></td>
      </tr>
      <tr class="row-bold row-gold">
        <td>ROAS AKTUAL</td>
        <td class="lap-nilai">${fmtDec(h.roas)}</td>
        <td></td>
      </tr>
      <tr class="row-bold row-green">
        <td>RASIO MARGIN</td>
        <td class="lap-nilai">${fmtPct(h.rasio_margin)}</td>
        <td></td>
      </tr>
      <tr class="row-bold ${h.rasio_laba < 0 ? 'row-red' : 'row-green'}">
        <td>RASIO LABA</td>
        <td class="lap-nilai">${fmtPct(h.rasio_laba)}</td>
        <td></td>
      </tr>
      <tr class="lap-laba-row ${labaClass}">
        <td>LABA/RUGI</td>
        <td class="lap-nilai">${fmtRp(h.laba)}</td>
        <td></td>
      </tr>
    </table>

    <div style="margin-top:14px;padding:10px 14px;background:var(--cream);border-radius:8px;display:flex;gap:20px;flex-wrap:wrap;">
      <span style="font-size:10px;color:var(--dusty);">📦 ${h.qty_terjual} pcs terjual</span>
      <span style="font-size:10px;color:var(--dusty);">🛒 ${h.n_orders} pesanan</span>
      <span style="font-size:10px;color:var(--dusty);">💰 HPP avg Rp ${(h.hpp_per_item||0).toLocaleString('id-ID')}/pc</span>
    </div>
  </div>
  `;
}

// ─── UPLOAD HANDLERS ────────────────────────────────────────────
function _laporanUpload(type, input) {
  const file = input.files[0];
  if (!file) return;
  _laporanState.files[type] = file;
  const box = document.getElementById(`box-${type}`);
  if (box) {
    box.classList.add('done');
    box.querySelector('.lap-upload-sub').textContent = '✅ ' + file.name;
  }

  // Auto-parse ads CSV → langsung isi field iklan
  if (type === 'ads') {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const totalIklan = parseAdsFile(e.target.result, _laporanState.bulan);
        if (totalIklan > 0) {
          // Simpan ke state agar tidak hilang saat toko di-switch
          _laporanState.iklanFromCsv = totalIklan;
          const iklanEl = document.getElementById('lap-iklan');
          if (iklanEl) {
            iklanEl.value = totalIklan;
            _laporanSaveOps(); // simpan ke localStorage toko aktif
          }
          if (typeof toast === 'function') toast(`\u2705 Iklan terbaca: Rp ${totalIklan.toLocaleString('id-ID')}`);
        }
      } catch(err) { console.warn('[parseAds]', err); }
    };
    reader.readAsText(file);
    return;
  }

  // Auto-detect toko & bulan dari Income file
  if (type === 'income') {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const summarySheet = wb.Sheets['Summary'];
        if (!summarySheet) return;
        const rows = XLSX.utils.sheet_to_json(summarySheet, { header: 1, defval: '' });

        // Cari username (Penjual) & periode dari Summary
        let username = '', dariTgl = '', keTgl = '';
        for (const row of rows) {
          const r0 = String(row[0]||'').trim();
          const r1 = String(row[1]||'').trim();
          // Username biasanya di baris dengan label "Username (Penjual)"
          if (r0 === 'Username (Penjual)' || r0.toLowerCase().includes('username')) {
            username = String(row[1]||row[2]||'').trim();
          }
          // Periode: "Dari" dan "ke"
          if (r0 === 'Dari' || r1 === 'Dari') {
            const idx = r0==='Dari' ? 1 : 2;
            dariTgl = String(row[idx]||'').trim();
          }
        }

        // Coba dari Income sheet langsung
        const incSheet = wb.Sheets['Income'];
        if (incSheet) {
          const incRows = XLSX.utils.sheet_to_json(incSheet, { header: 1, defval: '' });
          // Cari header row untuk username & periode
          for (let i = 0; i < Math.min(10, incRows.length); i++) {
            const row = incRows[i];
            if (row.includes('Username (Penjual)')) {
              const uCol = row.indexOf('Username (Penjual)');
              if (incRows[i+1] && incRows[i+1][uCol]) {
                username = String(incRows[i+1][uCol]).trim();
              }
            }
            if (row.includes('Dari')) {
              const dCol = row.indexOf('Dari');
              if (incRows[i+1] && incRows[i+1][dCol]) {
                dariTgl = String(incRows[i+1][dCol]).trim();
              }
            }
          }
        }

        // Kalau Summary punya langsung
        if (!username || !dariTgl) {
          for (const row of rows) {
            for (let c = 0; c < row.length; c++) {
              const v = String(row[c]||'').trim();
              if (!username && v.toLowerCase().match(/^[a-z0-9_]+shopee|zenoot|alley|elenz/i)) {
                username = v;
              }
              if (!dariTgl && v.match(/^\d{4}-\d{2}-\d{2}$/)) {
                dariTgl = v;
              }
            }
          }
        }

        // Auto-set bulan dari tanggal "Dari"
        if (dariTgl) {
          const m = dariTgl.match(/(\d{4})-(\d{2})/);
          if (m) {
            const bulanVal = `${m[1]}-${m[2]}`;
            _laporanState.bulan = bulanVal;
            const bulanEl = document.getElementById('lap-bulan');
            if (bulanEl) bulanEl.value = bulanVal;
          }
        }

        // Auto-match toko dari username
        if (username) {
          const channels = (typeof DB !== 'undefined' ? DB.channel||[] : [])
            .filter(c => c.nama !== '__assign__' && c.status === 'Aktif');
          const uLow = username.toLowerCase().replace(/[^a-z0-9]/g,'');

          // Deteksi platform dari nama file / username
          const isShopee = uLow.includes('shp') || files.income?.name?.toLowerCase().includes('income.sudah.dilepas');
          const isLazada = uLow.includes('laz') || files.income?.name?.toLowerCase().includes('lazada');
          const isTiktok = uLow.includes('tt') || uLow.includes('tiktok');

          let bestMatch = null, bestScore = 0;
          for (const ch of channels) {
            const cLow = ch.nama.toLowerCase().replace(/[^a-z0-9]/g,'');
            let score = 0;

            // Bonus brand match (zenoot, alley, elenz, dst)
            const brands = ['zenoot','alley','elenz','dimi','garasi','toko'];
            for (const brand of brands) {
              if (cLow.includes(brand) && uLow.includes(brand)) score += 10;
            }

            // Bonus/penalti platform — harus cocok platformnya
            const chIsShp = ch.nama.toLowerCase().includes('shp') || ch.nama.toLowerCase().includes('shopee');
            const chIsLaz = ch.nama.toLowerCase().includes('laz') || ch.nama.toLowerCase().includes('lazada');
            const chIsTt  = ch.nama.toLowerCase().includes('tt')  || ch.nama.toLowerCase().includes('tiktok');

            if (isShopee && chIsShp) score += 8;
            if (isShopee && chIsLaz) score -= 10; // penalti platform salah
            if (isShopee && chIsTt)  score -= 10;
            if (isLazada && chIsLaz) score += 8;
            if (isLazada && chIsShp) score -= 10;
            if (isTiktok && chIsTt)  score += 8;
            if (isTiktok && chIsShp) score -= 10;

            if (score > bestMatch ? bestScore : -999) { // always update if better
              if (score > bestScore) { bestScore = score; bestMatch = ch.nama; }
            }
          }
          if (bestMatch && bestScore > 0) {
            _laporanState.toko = bestMatch;
            const tokoEl = document.getElementById('lap-toko');
            if (tokoEl) tokoEl.value = bestMatch;
            _autoFillFromPlanning();
          }
        }

        // Update label info
        const infoEl = document.getElementById('lap-autodetect-info');
        if (infoEl) {
          infoEl.textContent = username
            ? `🔍 Terdeteksi: ${username} → ${_laporanState.toko} | ${_laporanState.bulan}`
            : '';
        }

      } catch(e) { console.warn('[autodetect]', e); }
    };
    reader.readAsArrayBuffer(file);
  }
}

function _laporanSetToko(val) {
  _laporanState.toko = val;
  _laporanState.parsed = null;
  _autoFillFromPlanning();
  renderLaporan();
}

function _laporanSetBulan(val) {
  _laporanState.bulan = val;
  _laporanState.parsed = null;
  _autoFillFromPlanning();
}

// Auto-fill iklan & ops dari Perencanaan → Ops per Toko
function _autoFillFromPlanning() {
  const toko = _laporanState.toko;
  const key = `zenot_ops_toko_${toko}`;
  try {
    const d = JSON.parse(localStorage.getItem(key)||'{}');
    const iklanEl = document.getElementById('lap-iklan');
    const opsEl   = document.getElementById('lap-ops');
    // Prioritas: localStorage toko ini → iklan dari CSV yang baru di-upload → 0
    if (iklanEl) {
      const savedIklan = d.budgetIklan || 0;
      const csvIklan   = _laporanState.iklanFromCsv || 0;
      iklanEl.value = savedIklan || csvIklan || 0;
    }
    if (opsEl) {
      // Ops global dari planning
      const bulan = _laporanState.bulan;
      const pKey = `zenot_planning_${bulan.replace('-','_')}`;
      try {
        const pd = JSON.parse(localStorage.getItem(pKey.replace('_','_').replace('-','_'))||'{}');
        if (pd.biayaGaji || pd.biayaSewa || pd.biayaBahan) {
          opsEl.value = (pd.biayaGaji||0)+(pd.biayaSewa||0)+(pd.biayaBahan||0)+(pd.biayaLain||0);
        }
      } catch(e) {}
    }
  } catch(e) {}
}

function _getLaporanOps(type) {
  const toko = _laporanState.toko;
  const key = `zenot_ops_toko_${toko}`;
  try {
    const d = JSON.parse(localStorage.getItem(key)||'{}');
    if (type === 'iklan') return d.budgetIklan || 0;
  } catch(e) {}

  // Ops dari planning global
  if (type === 'operasional') {
    const bulan = _laporanState.bulan;
    const y = bulan.split('-')[0]; const m = bulan.split('-')[1];
    const pKey = `zenot_planning_${y}_${m}`;
    try {
      const pd = JSON.parse(localStorage.getItem(pKey)||'{}');
      return (pd.biayaGaji||0)+(pd.biayaSewa||0)+(pd.biayaBahan||0)+(pd.biayaLain||0);
    } catch(e) {}
  }
  return 0;
}

function _laporanSaveOps() {
  // auto-save iklan ke ops toko
  const toko = _laporanState.toko;
  const key = `zenot_ops_toko_${toko}`;
  try {
    const d = JSON.parse(localStorage.getItem(key)||'{}');
    const iklanEl = document.getElementById('lap-iklan');
    if (iklanEl) d.budgetIklan = Number(iklanEl.value)||0;
    localStorage.setItem(key, JSON.stringify(d));
  } catch(e) {}
}

// ─── PROSES UTAMA ───────────────────────────────────────────────
async function _laporanProses() {
  const { toko, bulan, files } = _laporanState;

  if (!toko) { toast('⚠️ Pilih toko dulu!'); return; }
  if (!bulan) { toast('⚠️ Pilih bulan dulu!'); return; }
  if (!files.income) { toast('⚠️ Upload file Income dulu!'); return; }
  if (!files.order1 && !files.order2) { toast('⚠️ Upload minimal 1 file Order!'); return; }

  const btn = document.getElementById('lap-proses-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses...'; }

  try {
    // 1. Parse Income
    const incWb = await _readXlsx(files.income);
    const incData = parseIncomeFile(incWb);

    // 2. Parse Orders
    let allOrders = [];
    if (files.order1) {
      const wb1 = await _readXlsx(files.order1);
      allOrders = allOrders.concat(parseOrderFile(wb1));
    }
    if (files.order2) {
      const wb2 = await _readXlsx(files.order2);
      allOrders = allOrders.concat(parseOrderFile(wb2));
    }

    // 3. Input manual
    const iklan = Number(document.getElementById('lap-iklan')?.value)||0;
    const ops   = Number(document.getElementById('lap-ops')?.value)||0;

    // 4. Kalkulasi
    const hasil = kalkulasi(incData, allOrders, iklan, ops);

    // 5. Simpan ke Supabase
    const row = {
      toko, bulan,
      ...hasil,
      updated_at: new Date().toISOString()
    };
    await _sbUpsertLaporan(row);

    // 6. Update state & render
    _laporanState.parsed = hasil;
    const hasilWrap = document.getElementById('lap-hasil-wrap');
    if (hasilWrap) hasilWrap.innerHTML = _renderHasil(hasil);

    // 7. Reload history
    await _laporanLoadHistory(toko);

    if (typeof toast === 'function') toast(`✅ Laporan ${toko} ${bulan} tersimpan!`);

  } catch(err) {
    console.error('[_laporanProses]', err);
    if (typeof toast === 'function') toast('❌ Error: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Proses & Simpan Laporan'; }
  }
}

// ─── LOAD HISTORY ───────────────────────────────────────────────
async function _laporanLoadHistory(toko) {
  const listEl = document.getElementById('lap-history-list');
  if (!listEl) return;
  try {
    const rows = await _sbGetAllLaporan(toko);
    if (!rows || rows.length === 0) {
      listEl.innerHTML = '<div style="color:var(--dusty);font-size:12px;text-align:center;padding:10px;">Belum ada laporan tersimpan</div>';
      return;
    }
    listEl.innerHTML = rows.map(r => `
      <div class="lap-history-item ${r.bulan===_laporanState.bulan?'active':''}"
           onclick="_laporanLoadFromHistory('${r.toko}','${r.bulan}')">
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--charcoal);">${r.bulan}</div>
          <div style="font-size:10px;color:var(--dusty);">
            Laba: <span style="color:${r.laba<0?'#C83232':'var(--sage)'}">Rp ${Math.abs(r.laba||0).toLocaleString('id-ID')}</span>
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:11px;font-weight:700;color:var(--charcoal);">
            Rp ${(r.total_pendapatan||0).toLocaleString('id-ID')}
          </div>
          <div style="font-size:10px;color:var(--dusty);">pendapatan</div>
        </div>
      </div>
    `).join('');
  } catch(e) {
    listEl.innerHTML = '<div style="color:var(--rust);font-size:11px;padding:8px;">Gagal load history</div>';
  }
}

async function _laporanLoadFromHistory(toko, bulan) {
  try {
    const row = await _sbGetLaporan(toko, bulan);
    if (!row) return;
    _laporanState.toko = toko;
    _laporanState.bulan = bulan;
    _laporanState.parsed = row;
    const hasilWrap = document.getElementById('lap-hasil-wrap');
    if (hasilWrap) hasilWrap.innerHTML = _renderHasil(row, bulan);
    // Update active history item
    document.querySelectorAll('.lap-history-item').forEach(el => {
      el.classList.toggle('active', el.onclick?.toString().includes(bulan));
    });
  } catch(e) {
    if (typeof toast === 'function') toast('❌ Gagal load: ' + e.message);
  }
}

// ─── EXPORT ─────────────────────────────────────────────────────
function _laporanExport() {
  const h = _laporanState.parsed;
  if (!h) return;
  // Simple CSV export
  const rows = [
    ['HASIL','NILAI','RASIO'],
    ['TOTAL PENDAPATAN', h.total_pendapatan, ''],
    ['TOTAL PENGHASILAN', h.total_penghasilan, ''],
    ['HPP', h.hpp_total, ''],
    ['OPERASIONAL', h.operasional, ((h.operasional||0)/(h.total_pendapatan||1)*100).toFixed(2)+'%'],
    ['IKLAN', h.iklan, ((h.iklan||0)/(h.total_pendapatan||1)*100).toFixed(2)+'%'],
    ['RASIO ADMIN DAN LAYANAN', h.total_admin, ((h.rasio_admin||0)*100).toFixed(2)+'%'],
    ['Biaya Komisi AMS', h.komisi_ams, ((h.komisi_ams||0)/(h.total_pendapatan||1)*100).toFixed(2)+'%'],
    ['Biaya Administrasi', h.biaya_admin, ((h.biaya_admin||0)/(h.total_pendapatan||1)*100).toFixed(2)+'%'],
    ['Biaya Layanan', h.biaya_layanan, ((h.biaya_layanan||0)/(h.total_pendapatan||1)*100).toFixed(2)+'%'],
    ['Biaya Proses Pesanan', h.biaya_proses, ((h.biaya_proses||0)/(h.total_pendapatan||1)*100).toFixed(2)+'%'],
    ['Premi', h.premi, '0%'],
    ['Biaya Program Hemat Biaya Kirim', h.biaya_hemat_kirim, '0%'],
    ['Biaya Transaksi', h.biaya_transaksi, '0%'],
    ['Biaya Kampanye', h.biaya_kampanye, ((h.biaya_kampanye||0)/(h.total_pendapatan||1)*100).toFixed(2)+'%'],
    ['Biaya Isi Saldo Otomatis (dari Penghasilan)', h.biaya_saldo_otomatis, ((h.biaya_saldo_otomatis||0)/(h.total_pendapatan||1)*100).toFixed(2)+'%'],
    ['AOV AKTUAL', h.aov, ''],
    ['BASKET SIZE AKTUAL', h.basket_size, ''],
    ['ROAS AKTUAL', h.roas, ''],
    ['RASIO MARGIN', ((h.rasio_margin||0)*100).toFixed(2)+'%', ''],
    ['RASIO LABA', ((h.rasio_laba||0)*100).toFixed(2)+'%', ''],
    ['LABA/RUGI', h.laba, ''],
  ];
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Laporan_${_laporanState.toko}_${_laporanState.bulan}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── EXPOSE ─────────────────────────────────────────────────────
window.renderLaporan           = renderLaporan;
window._laporanUpload          = _laporanUpload;
window._laporanSetToko         = _laporanSetToko;
window._laporanSetBulan        = _laporanSetBulan;
window._laporanSaveOps         = _laporanSaveOps;
window._laporanProses          = _laporanProses;
window._laporanLoadFromHistory = _laporanLoadFromHistory;
window._laporanExport          = _laporanExport;

// Auto-render jika page sudah aktif
const _lapEl = document.getElementById('page-laporan');
if (_lapEl && _lapEl.classList.contains('active')) renderLaporan();

})();
