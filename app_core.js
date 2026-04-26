/* ═══════════════════════════════════════════════════════════════════
   app_core.js — zenOt Operasional V2
   Main DB, Cloud Sync, Core Render Functions, Navigation
   This file must be loaded FIRST before other modules.
════════════════════════════════════════════════════════════════════ */

// ================================================================
// SUPABASE CONFIG — ganti 2 nilai ini setelah buat project
// ================================================================
const SUPABASE_URL = 'https://wsvsvmfclrlkllryamma.supabase.co';   // contoh: https://abcxyz.supabase.co
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzdnN2bWZjbHJsa2xscnlhbW1hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMDc5OTQsImV4cCI6MjA5Mjc4Mzk5NH0.6btOTqkTri8te6eURWmUcQDFIfCdVA210Gw_Wx5UomA';       // dari Settings > API

// ================================================================
// DATA LAYER — Supabase Implementation
// ================================================================
const DataLayer = {

  // Helper: base headers
  _headers() {
    return {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'return=minimal'
    };
  },

  // Helper: fetch dari satu tabel
  async _getTable(table) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=id.asc`, {
      headers: { ...this._headers(), 'Prefer': 'return=representation' }
    });
    if (!res.ok) throw new Error(`Gagal fetch ${table}: ${res.status}`);
    return res.json();
  },

  // Helper: upsert (insert or update by unique key)
  async _upsert(table, rows, onConflict) {
    if (!rows || rows.length === 0) return;
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: { ...this._headers(), 'Prefer': 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(rows)
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gagal upsert ${table}: ${err}`);
    }
  },

  // Helper: hapus semua lalu insert ulang (untuk data yang tidak punya unique key jelas)
  async _replaceAll(table, rows) {
    // Delete all rows (id >= 1 covers all bigserial)
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=gte.1`, {
      method: 'DELETE',
      headers: this._headers()
    });
    if (!rows || rows.length === 0) return;
    // Insert fresh
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: { ...this._headers(), 'Prefer': 'return=minimal' },
      body: JSON.stringify(rows)
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gagal insert ${table}: ${errText}`);
    }
  },

  // ── SAVE: kirim semua DB ke Supabase ──
  async save(data) {
    try {
      // Produk — upsert by var (unique)
      const produkRows = (data.produk || []).map(p => ({
        induk: p.induk, var: p.var, hpp: p.hpp || 0,
        suplaier: p.suplaier || '', npm: p.npm || 10,
        jual: p.jual || 0, pasang: p.pasang || 0,
        reseller: p.reseller || 0, gm: p.gm || 0
      }));
      await this._upsert('produk', produkRows, 'var');

      // Stok — upsert by var (unique)
      const stokRows = (data.stok || []).map(s => ({
        var: s.var, awal: s.awal || 0, masuk: s.masuk || 0,
        keluar: s.keluar || 0, hpp: s.hpp || 0, safety: s.safety || 4,
        updated_at: new Date().toISOString()
      }));
      await this._upsert('stok', stokRows, 'var');

      // Channel — upsert by nama (unique)
      const channelRows = (data.channel || []).map(c => ({
        nama: c.nama, platform: c.platform, status: c.status || 'Aktif'
      }));
      await this._upsert('channel', channelRows, 'nama');

      // Jurnal & Restock — replace all (tidak ada unique constraint natural)
      const jurnalRows = (data.jurnal || []).map(j => ({
        tgl: j.tgl, ch: j.ch, var: j.var,
        qty: j.qty || 1, harga: j.harga || 0, hpp: j.hpp || 0
      }));
      await this._replaceAll('jurnal', jurnalRows);

      const restockRows = (data.restock || []).map(r => ({
        tgl: r.tgl, var: r.var, supplier: r.supplier || '',
        qty: r.qty || 0, catatan: r.catatan || ''
      }));
      await this._replaceAll('restock', restockRows);

      return true;
    } catch(e) {
      console.error('[DataLayer.save]', e.message);
      return false;
    }
  },

  // ── FETCH: ambil semua dari Supabase → format DB ──
  async fetch() {
    try {
      const [produk, stok, jurnal, restock, channel] = await Promise.all([
        this._getTable('produk'),
        this._getTable('stok'),
        this._getTable('jurnal'),
        this._getTable('restock'),
        this._getTable('channel'),
      ]);

      // Map balik ke format DB yang dipakai app
      return {
        ok: true,
        data: {
          produk: produk.map(p => ({
            induk: p.induk, var: p.var, hpp: Number(p.hpp),
            suplaier: p.suplaier, npm: Number(p.npm),
            jual: Number(p.jual), pasang: Number(p.pasang),
            reseller: Number(p.reseller), gm: Number(p.gm)
          })),
          stok: stok.map(s => ({
            var: s.var, awal: s.awal, masuk: s.masuk,
            keluar: s.keluar, hpp: Number(s.hpp), safety: s.safety
          })),
          jurnal: jurnal
            .sort((a, b) => new Date(b.tgl) - new Date(a.tgl)) // urutkan terbaru dulu
            .map(j => ({
              tgl: j.tgl, ch: j.ch, var: j.var,
              qty: j.qty, harga: Number(j.harga), hpp: Number(j.hpp)
            })),
          restock: restock
            .sort((a, b) => new Date(b.tgl) - new Date(a.tgl))
            .map(r => ({
              tgl: r.tgl, var: r.var, supplier: r.supplier,
              qty: r.qty, catatan: r.catatan
            })),
          channel: channel.map(c => ({
            nama: c.nama, platform: c.platform, status: c.status
          }))
        }
      };
    } catch(e) {
      console.error('[DataLayer.fetch]', e.message);
      return null;
    }
  },

  // Cache lokal (tetap dipakai sebagai fallback offline)
  saveLocal(data) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(data)); } catch(e) {}
  },
  loadLocal() {
    try { const raw = localStorage.getItem(DB_KEY); return raw ? JSON.parse(raw) : null; } catch(e) { return null; }
  },
  clearLocal() {
    try { localStorage.removeItem(DB_KEY); } catch(e) {}
  }
};


let _cloudConnected = false;
let _saveQueue = null;
let _backupModeActive = false;
let _currentPage = 'dashboard';

function setCloudStatus(ok) {
  _cloudConnected = ok;
  // Badge baru — fixed pojok kiri bawah
  const badge = document.getElementById('backup-badge-fixed');
  const indicator = document.getElementById('cloud-indicator-fixed');
  if (badge) {
    badge.innerHTML = ok ? '☁️ Cloud Aktif' : '⚠️ Offline';
    if (indicator) indicator.classList.toggle('offline', !ok);
  }
  // Legacy badge (fallback)
  const legacyBadge = document.getElementById('backup-badge');
  if (legacyBadge) {
    legacyBadge.style.display = 'flex';
    if (ok) { legacyBadge.style.background='#EFF7F3';legacyBadge.style.borderColor='#A8D5BE';legacyBadge.style.color='#2D6A4F';legacyBadge.innerHTML='☁️ Cloud Aktif'; }
    else { legacyBadge.style.background='#FFF3CD';legacyBadge.style.borderColor='#FFEAA7';legacyBadge.style.color='#856404';legacyBadge.innerHTML='⚠️ Mode Offline'; }
  }
}
function setBackupMode(on) { _backupModeActive = on; }

function saveDB() {
  DataLayer.saveLocal(DB);
  const ind = document.getElementById('save-indicator');
  if (ind) {
    ind.textContent = _cloudConnected ? '☁️ Menyimpan...' : '💾 Cache lokal';
    ind.style.display = 'block';
    clearTimeout(window._saveTimer);
    window._saveTimer = setTimeout(() => { ind.style.display='none'; }, 2500);
  }
  clearTimeout(_saveQueue);
  _saveQueue = setTimeout(() => { pushToCloud(); }, 800);
}

async function pushToCloud() {
  if (!SUPABASE_URL) return;
  const ok = await DataLayer.save(DB);
  setCloudStatus(ok);
  const ind = document.getElementById('save-indicator');
  if (ind && ok) {
    ind.textContent='☁️ Tersimpan di Cloud';ind.style.color='var(--sage)';
    ind.style.display='block';clearTimeout(window._saveTimer);
    window._saveTimer=setTimeout(()=>{ind.style.display='none';},2000);
  }
}

function loadFromCloud() {
  return DataLayer.fetch();
}

async function loadDB() {
  if (SUPABASE_URL) {
    try {
      showLoadingOverlay('☁️ Memuat data dari cloud...');
      const result = await DataLayer.fetch();
      if (result && result.ok && result.data) {
        const saved = result.data;
        if (saved.produk)  DB.produk  = saved.produk;
        if (saved.stok)    DB.stok    = saved.stok;
        if (saved.jurnal)  DB.jurnal  = saved.jurnal;
        if (saved.restock) DB.restock = saved.restock;
        if (saved.channel) DB.channel = saved.channel;
        _normalizeJurnalChannel();
        DataLayer.saveLocal(DB);
        setCloudStatus(true);
        hideLoadingOverlay(); return;
      }
    } catch(e) { console.warn('Cloud load gagal:', e.message); }
    setCloudStatus(false); hideLoadingOverlay();
  }
  const saved = DataLayer.loadLocal();
  if (saved) {
    if (saved.produk)  DB.produk  = saved.produk;
    if (saved.stok)    DB.stok    = saved.stok;
    if (saved.jurnal)  DB.jurnal  = saved.jurnal;
    if (saved.restock) DB.restock = saved.restock;
    if (saved.channel) DB.channel = saved.channel;
    _normalizeJurnalChannel();
    setCloudStatus(false);
  }
}

function _normalizeJurnalChannel() {
  DB.jurnal.forEach(r => { if (r.ch) r.ch = _normalizeCh(r.ch); });
}

async function cleanChannelData() {
  _normalizeJurnalChannel();
  saveDB();
  toast('✅ Data channel dibersihkan!');
}

function _applyCloudData(d) {
  if (d.produk)  DB.produk  = d.produk;
  if (d.stok)    DB.stok    = d.stok;
  if (d.jurnal)  DB.jurnal  = d.jurnal;
  if (d.restock) DB.restock = d.restock;
  if (d.channel) DB.channel = d.channel;
  try { localStorage.setItem(DB_KEY, JSON.stringify(DB)); } catch(e) {}
  setCloudStatus(true);
  const p = _currentPage;
  if      (p==='dashboard' && typeof renderDashboard==='function') renderDashboard();
  else if (p==='produk'    && typeof renderProduk   ==='function') renderProduk();
  else if (p==='stok'      && typeof renderStok     ==='function') renderStok();
  else if (p==='jurnal'    && typeof renderJurnal   ==='function') renderJurnal();
  else if (p==='restock'   && typeof renderRestock  ==='function') { renderRestock(); if(typeof renderLowStock==='function') renderLowStock(); }
  else if (p==='channel'   && typeof renderChannel  ==='function') renderChannel();
}

async function syncHargaRealtime() {
  if (!SUPABASE_URL) return false;
  try { const result = await loadFromCloud(); if (result && result.ok && result.data) { _applyCloudData(result.data); return true; } } catch(e) {}
  return false;
}

let _autoRefreshTimer = null;
function startAutoRefreshHarga(intervalMenit = 2) {
  if (_autoRefreshTimer) clearInterval(_autoRefreshTimer);
  _autoRefreshTimer = setInterval(() => { if (!navigator.onLine) return; syncHargaRealtime(); }, intervalMenit * 60 * 1000);
}

async function syncHargaManual() {
  const btns = document.querySelectorAll('#btn-sync-harga, #btn-sync-jurnal');
  btns.forEach(b => { b.textContent='⏳';b.disabled=true; });
  const ok = await syncHargaRealtime();
  btns.forEach(b => { b.disabled=false;b.textContent=ok?'✅':'⚠️';setTimeout(()=>{b.textContent='🔄 Sync';},2000); });
  if (!ok) toast('⚠️ Gagal sync. Cek koneksi.', 'err');
}

async function resetDB() {
  if (!confirm('⚠️ RESET semua data? Data di cloud dan lokal akan HILANG!')) return;
  DB.produk=[];DB.stok=[];DB.jurnal=[];DB.restock=[];
  DataLayer.clearLocal();
  await pushToCloud(); location.reload();
}

function showLoadingOverlay(msg) {
  let el = document.getElementById('cloud-loading');
  if (!el) {
    el = document.createElement('div'); el.id='cloud-loading';
    el.style.cssText='position:fixed;inset:0;background:rgba(28,28,30,0.7);z-index:999;display:flex;align-items:center;justify-content:center;';
    el.innerHTML=`<div style="background:white;border-radius:16px;padding:28px 36px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)"><div style="font-size:32px;margin-bottom:10px">☁️</div><div id="cloud-loading-msg" style="font-family:'Outfit',sans-serif;font-size:14px;color:#1C1C1E;font-weight:500">${msg}</div><div style="margin-top:12px;height:3px;width:180px;background:#E0D5C5;border-radius:3px;overflow:hidden"><div style="height:100%;width:0%;background:#5C3D2E;border-radius:3px;animation:loadbar 1.5s ease infinite"></div></div></div>`;
    document.body.appendChild(el);
    if (!document.getElementById('cloud-loading-style')) { const s=document.createElement('style');s.id='cloud-loading-style';s.textContent='@keyframes loadbar{0%{width:0%}60%{width:85%}100%{width:100%}}';document.head.appendChild(s); }
  } else { document.getElementById('cloud-loading-msg').textContent=msg; el.style.display='flex'; }
}
function hideLoadingOverlay() { const el=document.getElementById('cloud-loading'); if(el)el.style.display='none'; }

// ================================================================
// DATA STORE
// ================================================================
const DEFAULT_PRODUK = [
  {induk:'Turtleneck',var:'Turtleneck_HITAM-S',hpp:38833,npm:25,jual:138700,pasang:277400,reseller:55500,gm:72},
  {induk:'Turtleneck',var:'Turtleneck_HITAM-M',hpp:38833,npm:10,jual:90300,pasang:180600,reseller:45700,gm:57},
  {induk:'Turtleneck',var:'Turtleneck_HITAM-L',hpp:38833,npm:10,jual:90300,pasang:180600,reseller:45700,gm:57},
  {induk:'Turtleneck',var:'Turtleneck_HITAM-XL',hpp:38833,npm:10,jual:90300,pasang:180600,reseller:45700,gm:57},
  {induk:'MAYRA',var:'MAYRA_HITAM',hpp:55850,npm:10,jual:129900,pasang:259800,reseller:65700,gm:57},
  {induk:'MAYRA',var:'MAYRA_MAUVE',hpp:55850,npm:10,jual:129900,pasang:259800,reseller:65700,gm:57},
  {induk:'MAYRA',var:'MAYRA_ MARUN',hpp:55850,npm:10,jual:129900,pasang:259800,reseller:65700,gm:57},
  {induk:'MAYRA',var:'MAYRA_KHAKI',hpp:55850,npm:10,jual:129900,pasang:259800,reseller:65700,gm:57},
  {induk:'MAYRA',var:'MAYRA_ COFFEE',hpp:55850,npm:10,jual:129900,pasang:259800,reseller:65700,gm:57},
  {induk:'MAYRA',var:'MAYRA_DENIM',hpp:55850,npm:10,jual:129900,pasang:259800,reseller:65700,gm:57},
  {induk:'CALYRA',var:'CALYRA_HITAM',hpp:54167,npm:10,jual:126000,pasang:252000,reseller:63700,gm:57},
  {induk:'CALYRA',var:'CALYRA_KREAM',hpp:54167,npm:10,jual:126000,pasang:252000,reseller:63700,gm:57},
  {induk:'CALYRA',var:'CALYRA_DENIM',hpp:54167,npm:10,jual:126000,pasang:252000,reseller:63700,gm:57},
  {induk:'STARLA',var:'STARLA_HITAM',hpp:45833,npm:10,jual:106600,pasang:213200,reseller:53900,gm:57},
  {induk:'STARLA',var:'STARLA_OFFWHITE',hpp:45833,npm:10,jual:106600,pasang:213200,reseller:53900,gm:57},
  {induk:'STARLA',var:'STARLA_EMERALD',hpp:45833,npm:10,jual:106600,pasang:213200,reseller:53900,gm:57},
  {induk:'STARLA',var:'STARLA_KHAKI',hpp:45833,npm:10,jual:106600,pasang:213200,reseller:53900,gm:57},
  {induk:'STARLA',var:'STARLA_BRONZE',hpp:45833,npm:10,jual:106600,pasang:213200,reseller:53900,gm:57},
  {induk:'STARLA',var:'STARLA_DUSTY',hpp:45833,npm:10,jual:106600,pasang:213200,reseller:53900,gm:57},
  {induk:'STARLA',var:'STARLA_MARUN',hpp:45833,npm:10,jual:106600,pasang:213200,reseller:53900,gm:57},
  {induk:'STARLA',var:'STARLA_COFFEE',hpp:45833,npm:10,jual:106600,pasang:213200,reseller:53900,gm:57},
  {induk:'LUNEA',var:'LUNEA_MARUN',hpp:50000,npm:10,jual:116300,pasang:232600,reseller:58800,gm:57},
  {induk:'LAVINA',var:'LAVINA_KREAM',hpp:70000,npm:10,jual:162800,pasang:325600,reseller:82400,gm:57},
  {induk:'LAVINA',var:'LAVINA_MARUN',hpp:70000,npm:10,jual:162800,pasang:325600,reseller:82400,gm:57},
  {induk:'LAVINA',var:'LAVINA_NILA',hpp:70000,npm:10,jual:162800,pasang:325600,reseller:82400,gm:57},
  {induk:'LAVINA',var:'LAVINA_COFFEE',hpp:70000,npm:10,jual:162800,pasang:325600,reseller:82400,gm:57},
  {induk:'WAKUTA',var:'WAKUTA_HITAM',hpp:35000,npm:10,jual:81400,pasang:162800,reseller:41200,gm:57},
  {induk:'WAKUTA',var:'WAKUTA_BW',hpp:35000,npm:10,jual:81400,pasang:162800,reseller:41200,gm:57},
  {induk:'WAKUTA',var:'WAKUTA_Cream',hpp:35000,npm:10,jual:81400,pasang:162800,reseller:41200,gm:57},
  {induk:'WAKUTA',var:'WAKUTA_Denim',hpp:35000,npm:10,jual:81400,pasang:162800,reseller:41200,gm:57},
  {induk:'WAKUTA',var:'WAKUTA_Nilla',hpp:35000,npm:10,jual:81400,pasang:162800,reseller:41200,gm:57},
  {induk:'NAJWA',var:'NAJWA_HITAM',hpp:50000,npm:10,jual:116300,pasang:232600,reseller:58800,gm:57},
  {induk:'NAJWA',var:'NAJWA_BW',hpp:50000,npm:10,jual:116300,pasang:232600,reseller:58800,gm:57},
  {induk:'NAJWA',var:'NAJWA_KREAM',hpp:50000,npm:10,jual:116300,pasang:232600,reseller:58800,gm:57},
  {induk:'CLAUDIYA',var:'CLAUDIYA_MARUN',hpp:65000,npm:10,jual:151200,pasang:302400,reseller:76500,gm:57},
  {induk:'CLAUDIYA',var:'CLAUDIYA_PUTIH',hpp:65000,npm:10,jual:151200,pasang:302400,reseller:76500,gm:57},
  {induk:'MAYRA',var:'MAYRA_DENIM',hpp:55850,npm:10,jual:129900,pasang:259800,reseller:65700,gm:57},
  {induk:'PITA_BLUS',var:'PITA_BLUS-DENIM',hpp:55000,npm:10,jual:127900,pasang:255800,reseller:64700,gm:57},
  {induk:'PITA_BLUS',var:'PITA_BLUS-HITAM',hpp:55000,npm:10,jual:127900,pasang:255800,reseller:64700,gm:57},
  {induk:'PITA_BLUS',var:'PITA_BLUS-MARUN',hpp:55000,npm:10,jual:127900,pasang:255800,reseller:64700,gm:57},
  {induk:'TAGAR CARDY',var:'TC_COFEEE',hpp:43000,npm:10,jual:100000,pasang:200000,reseller:50600,gm:57},
  {induk:'TAGAR CARDY',var:'TC_BRONZE',hpp:43000,npm:10,jual:100000,pasang:200000,reseller:50600,gm:57},
  {induk:'LAVERA',var:'LVR_HITAM',hpp:75000,npm:10,jual:174400,pasang:348800,reseller:88200,gm:57},
  {induk:'LAVERA',var:'LVR_BRONZE',hpp:75000,npm:10,jual:174400,pasang:348800,reseller:88200,gm:57},
  {induk:'SABRINA',var:'SB_HITAM-M',hpp:25000,npm:10,jual:58100,pasang:116200,reseller:29400,gm:57},
  {induk:'SABRINA',var:'SB_HITAM-L',hpp:25000,npm:10,jual:58100,pasang:116200,reseller:29400,gm:57},
  {induk:'V NECK',var:'VN_HITAM',hpp:25000,npm:5,jual:52100,pasang:104200,reseller:27800,gm:52},
  {induk:'EIRA',var:'ER_MOCCA',hpp:45000,npm:10,jual:104700,pasang:209400,reseller:52900,gm:57},
  {induk:'HARU',var:'HR_DENIM',hpp:45000,npm:10,jual:104700,pasang:209400,reseller:52900,gm:57},
  {induk:'TN2TH',var:'T2TH_HITAM',hpp:12500,npm:10,jual:29100,pasang:58200,reseller:14700,gm:57},
  {induk:'YUNA POLO',var:'YUNA_NEVI',hpp:50000,npm:10,jual:116300,pasang:232600,reseller:58800,gm:57},
  {induk:'YUNA POLO',var:'YUNA_SOFT-YELLOW',hpp:50000,npm:10,jual:116300,pasang:232600,reseller:58800,gm:57},
  {induk:'YUNA POLO',var:'YUNA_HITAM',hpp:50000,npm:10,jual:116300,pasang:232600,reseller:58800,gm:57},
  {induk:'YUNA POLO',var:'YUNA_MARUN',hpp:50000,npm:10,jual:116300,pasang:232600,reseller:58800,gm:57},
];

let DB = {
  produk: JSON.parse(JSON.stringify(DEFAULT_PRODUK)),
  stok: [
    {var:'Turtleneck_HITAM-XL',awal:12,masuk:0,keluar:0,hpp:38833,safety:4},
    {var:'MAYRA_HITAM',awal:13,masuk:0,keluar:0,hpp:55850,safety:6},
    {var:'MAYRA_MAUVE',awal:3,masuk:0,keluar:0,hpp:55850,safety:6},
    {var:'MAYRA_ MARUN',awal:10,masuk:0,keluar:0,hpp:55850,safety:6},
    {var:'MAYRA_KHAKI',awal:6,masuk:0,keluar:0,hpp:55850,safety:6},
    {var:'MAYRA_ COFFEE',awal:8,masuk:0,keluar:0,hpp:55850,safety:6},
    {var:'MAYRA_DENIM',awal:14,masuk:0,keluar:0,hpp:55850,safety:6},
    {var:'CALYRA_HITAM',awal:5,masuk:0,keluar:0,hpp:54167,safety:4},
    {var:'CALYRA_KREAM',awal:11,masuk:0,keluar:0,hpp:54167,safety:4},
    {var:'CALYRA_DENIM',awal:7,masuk:0,keluar:0,hpp:54167,safety:4},
    {var:'STARLA_HITAM',awal:9,masuk:0,keluar:0,hpp:45833,safety:5},
    {var:'STARLA_OFFWHITE',awal:5,masuk:0,keluar:0,hpp:45833,safety:5},
    {var:'STARLA_EMERALD',awal:10,masuk:0,keluar:0,hpp:45833,safety:5},
    {var:'STARLA_KHAKI',awal:14,masuk:0,keluar:0,hpp:45833,safety:5},
    {var:'STARLA_BRONZE',awal:11,masuk:0,keluar:0,hpp:45833,safety:5},
    {var:'STARLA_DUSTY',awal:10,masuk:0,keluar:0,hpp:45833,safety:5},
    {var:'STARLA_MARUN',awal:19,masuk:0,keluar:0,hpp:45833,safety:5},
    {var:'STARLA_COFFEE',awal:12,masuk:0,keluar:0,hpp:45833,safety:5},
    {var:'LUNEA_MARUN',awal:1,masuk:0,keluar:0,hpp:50000,safety:4},
    {var:'WAKUTA_HITAM',awal:3,masuk:0,keluar:0,hpp:35000,safety:3},
    {var:'WAKUTA_BW',awal:6,masuk:0,keluar:0,hpp:35000,safety:3},
    {var:'WAKUTA_Cream',awal:2,masuk:0,keluar:0,hpp:35000,safety:3},
    {var:'WAKUTA_Denim',awal:3,masuk:0,keluar:0,hpp:35000,safety:3},
    {var:'WAKUTA_Nilla',awal:3,masuk:0,keluar:0,hpp:35000,safety:3},
    {var:'NAJWA_HITAM',awal:1,masuk:0,keluar:0,hpp:50000,safety:3},
    {var:'NAJWA_BW',awal:2,masuk:0,keluar:0,hpp:50000,safety:3},
    {var:'NAJWA_KREAM',awal:1,masuk:0,keluar:0,hpp:50000,safety:3},
  ],
  jurnal: [
    {tgl:'2026-04-22',ch:'SHP. ALLEY',var:'MAYRA_HITAM',qty:1,harga:55850,hpp:55850},
  ],
  restock: [],
  channel: [
    {nama:'SHP.ZENOOT', platform:'Shopee', status:'Aktif'},
    {nama:'SHP.ALLEY',  platform:'Shopee', status:'Aktif'},
    {nama:'LAZ.ZENOOT', platform:'Lazada', status:'Aktif'},
    {nama:'TT.ALLEY',   platform:'TikTok Shop', status:'Aktif'},
    {nama:'OFFLEN',     platform:'Offline', status:'Aktif'},
  ],
};

// ================================================================
// HELPERS
// ================================================================
const fmt = n => 'Rp '+Number(n||0).toLocaleString('id-ID');
const pct = n => Number(n||0).toFixed(0)+'%';
const getAkhir = s => (s.awal||0)+(s.masuk||0)-(s.keluar||0);
const getIndukOf = varName => { const p=DB.produk.find(x=>x.var===varName); return p?p.induk:'—'; };
const getHppOf   = varName => { const p=DB.produk.find(x=>x.var===varName); return p?p.hpp:0; };

function stokStatus(q, safety=4) {
  if (!q||q<=0) return '<span class="badge br">Habis</span>';
  if (q<=Math.ceil(safety*0.5)) return '<span class="badge br">Kritis</span>';
  if (q<=safety) return '<span class="badge bo">Rendah</span>';
  return '<span class="badge bg">Aman</span>';
}
function chTag(ch) {
  const c=ch.toLowerCase();
  const cls=c.includes('laz')?'ch-l':c.includes('tt')||c.includes('tiktok')?'ch-t':c.includes('off')?'ch-o':'ch-s';
  return `<span class="chtag ${cls}">${ch}</span>`;
}

// ================================================================
// NAVIGATION
// ================================================================
const ptitles = {
  dashboard:'Dashboard <span>zenOt</span>', stok:'Stok <span>Produk</span>',
  restock:'Re-Stock <span>Produk</span>',   jurnal:'Jurnal <span>Penjualan</span>',
  produk:'Kelola <span>Produk</span>',       channel:'Channel <span>Penjualan</span>',
  keuangan:'Laporan <span>Keuangan</span>',  blueprint:'Blueprint <span>Strategi</span>',
  daily:'Daily <span>Checklist</span>',      harga:'Price <span>List</span>',
  'analisis-upload':'Analisis <span>&amp; Proyeksi</span>',
  'analisis-blueprint':'AI <span>Blueprint</span>',
  'analisis-profit':'Profit <span>Guard</span>',
};

function go(id, el) {
  _currentPage = id;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const page = document.getElementById('page-'+id);
  if (page) page.classList.add('active');
  if (el) el.classList.add('active');
  document.getElementById('ph').innerHTML = ptitles[id]||id;
  if (id==='stok')    renderStok();
  if (id==='harga')   renderHarga();
  if (id==='jurnal')  { populateJInduk(); renderJurnal(); }
  if (id==='produk')  renderProduk();
  if (id==='restock') { populateRsInduk(); renderRestock(); renderLowStock(); }
  if (id==='channel') renderChannel();
}

// ═══ ACCORDION SIDEBAR — Shopee Style ═══
function toggleAcc(header) {
  const body = header.nextElementSibling;
  const isOpen = header.classList.contains('open');
  header.classList.toggle('open', !isOpen);
  if (body) body.classList.toggle('open', !isOpen);
}
function toggleAccordion(el) { toggleAcc(el); }

// ================================================================
// MODAL & TOAST
// ================================================================
function openModal(id) {
  document.getElementById(id).classList.add('open');
  if (id==='modal-restock-quick') populateRqInduk();
}
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));
});

function toast(msg, type='ok') {
  const t=document.getElementById('toast');
  t.textContent=(type==='ok'?'✅ ':'❌ ')+msg;
  t.style.background=type==='ok'?'#2D6A4F':'#721C24';
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2800);
}

// ================================================================
// DASHBOARD
// ================================================================
function renderDashboard() {
  const totalStok=DB.stok.reduce((s,r)=>s+getAkhir(r),0);
  const nilaiStok=DB.stok.reduce((s,r)=>s+(getAkhir(r)*r.hpp),0);
  const totalRev =DB.jurnal.reduce((s,r)=>s+(r.harga*r.qty),0);
  const totalLaba=DB.jurnal.reduce((s,r)=>s+((r.harga-r.hpp)*r.qty),0);
  const lowCount =DB.stok.filter(r=>getAkhir(r)<=(r.safety||4)&&getAkhir(r)>0).length;
  const habisCount=DB.stok.filter(r=>getAkhir(r)<=0).length;
  document.getElementById('stat-cards').innerHTML=`
    <div class="stat c1"><div class="stat-label">Total Stok Aktif</div><div class="stat-val">${totalStok.toLocaleString('id-ID')} <span style="font-size:14px">pcs</span></div><div class="stat-sub">${DB.stok.length} SKU terdaftar</div></div>
    <div class="stat c2"><div class="stat-label">Nilai Stok</div><div class="stat-val" style="font-size:18px">${fmt(nilaiStok)}</div><div class="stat-sub">berdasarkan HPP</div></div>
    <div class="stat c3"><div class="stat-label">Modal Keluar</div><div class="stat-val" style="font-size:18px">${fmt(totalRev)}</div><div class="stat-sub">${DB.jurnal.length} transaksi</div></div>
    <div class="stat c4"><div class="stat-label">Stok Kritis</div><div class="stat-val">${lowCount+habisCount} <span style="font-size:14px">SKU</span></div><div class="stat-sub">${habisCount} habis · ${lowCount} rendah</div></div>`;
  renderChartBars(); renderNotif(); renderProgress(); renderLastSales();
}

function renderChartBars() {
  const top=DB.stok.map(r=>({...r,akhir:getAkhir(r)})).sort((a,b)=>b.akhir-a.akhir).slice(0,8);
  const max=top.reduce((m,r)=>Math.max(m,r.akhir),1);
  const colors=['#5C3D2E','#5A7A6A','#C9A84C','#C0392B','#3D7EAA','#8C7B6B','#7C3AED','#0D9488'];
  document.getElementById('chart-bars').innerHTML=top.map((r,i)=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;"><div style="width:100%;background:${colors[i%colors.length]};border-radius:4px 4px 0 0;height:${Math.max(4,r.akhir/max*90)}px;min-height:4px;transition:height .6s;"></div><div style="font-size:9px;color:var(--dusty);text-align:center;line-height:1.2;">${r.akhir}</div></div>`).join('');
  document.getElementById('chart-leg').innerHTML=top.map((r,i)=>`<div style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--dusty)"><div style="width:8px;height:8px;border-radius:2px;background:${colors[i%colors.length]};flex-shrink:0"></div>${r.var.length>14?r.var.substring(0,12)+'…':r.var}</div>`).join('');
}

function renderNotif() {
  const criticals=DB.stok.filter(r=>getAkhir(r)<=0);
  const lows=DB.stok.filter(r=>getAkhir(r)>0&&getAkhir(r)<=(r.safety||4));
  let html='';
  criticals.slice(0,4).forEach(r=>{html+=`<div class="alert al-d"><span>🚨</span><div><strong>${r.var}</strong> — Stok HABIS!</div></div>`;});
  lows.slice(0,4).forEach(r=>{html+=`<div class="alert al-w"><span>⚠️</span><div><strong>${r.var}</strong> — Sisa ${getAkhir(r)} pcs (safety: ${r.safety||4})</div></div>`;});
  if (!html) html='<div class="alert al-s"><span>✅</span><div>Semua stok aman!</div></div>';
  document.getElementById('notif-area').innerHTML=html;
}

function renderProgress() {
  const targetPcs=264,totalKeluar=DB.stok.reduce((s,r)=>s+(r.keluar||0),0);
  const pctVal=Math.min(100,Math.round(totalKeluar/targetPcs*100));
  const targetRev=33000000,totalRev=DB.jurnal.reduce((s,r)=>s+(r.harga*r.qty),0);
  const revPct=Math.min(100,Math.round(totalRev/targetRev*100));
  document.getElementById('progress-area').innerHTML=`
    <div class="prog-wrap"><div class="prog-lbl"><span>📦 Volume Produksi</span><span>${totalKeluar}/${targetPcs} pcs</span></div><div class="prog-bar"><div class="prog-fill fb" style="width:${pctVal}%"></div></div></div>
    <div class="prog-wrap"><div class="prog-lbl"><span>💰 Target Revenue</span><span>${revPct}%</span></div><div class="prog-bar"><div class="prog-fill fs" style="width:${revPct}%"></div></div></div>`;
}

function renderLastSales() {
  const recent=DB.jurnal.slice(0,5);
  if (!recent.length) { document.getElementById('last-sales').innerHTML='<div style="color:var(--dusty);font-size:13px">Belum ada transaksi</div>'; return; }
  document.getElementById('last-sales').innerHTML=recent.map(r=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;"><div><div style="font-weight:600">${r.var}</div><div style="color:var(--dusty)">${r.tgl} · ${chTag(r.ch)}</div></div><div style="font-family:'DM Mono',monospace;font-weight:600">${r.qty}x</div></div>`).join('');
}

// ================================================================
// STOK
// ================================================================
let stokQ='', _stokSortCol=null, _stokSortDir=1;

function getStokStatus3(akhir,safety){
  if(!akhir||akhir<=0) return 'Habis';
  if(akhir<=Math.ceil(safety*0.5)) return 'Kritis';
  if(akhir<=safety) return 'Rendah';
  return 'Aman';
}

function _updateIndukDropdown(supVal, resetCur) {
  const indukSel=document.getElementById('stok-fil-induk');
  if(!indukSel) return;
  const cur = resetCur ? '' : indukSel.value;
  const norm = s => (s||'').toUpperCase().trim();
  const filtered = supVal
    ? DB.produk.filter(p => norm(p.suplaier) === norm(supVal))
    : DB.produk;
  const indukList=[...new Set(filtered.map(p=>p.induk))].sort();
  // Fallback: kalau tidak ada hasil, tetap tampilkan semua
  const finalList = indukList.length ? indukList : [...new Set(DB.produk.map(p=>p.induk))].sort();
  indukSel.innerHTML='<option value="">Semua Produk</option>'+finalList.map(s=>`<option>${s}</option>`).join('');
  if(cur && finalList.includes(cur)) indukSel.value=cur;
  else indukSel.value='';
}
function populateStokFilters() {
  const suppliers=[...new Set(DB.produk.map(p=>p.suplaier||'').filter(Boolean))].sort();
  const supSel=document.getElementById('stok-fil-supplier');
  if(supSel){
    const cur=supSel.value;
    supSel.innerHTML='<option value="">Semua Supplier</option>'+suppliers.map(s=>`<option>${s}</option>`).join('');
    if(cur) supSel.value=cur;
    // Update induk sesuai supplier aktif (tanpa reset)
    _updateIndukDropdown(cur, false);
  }
}
function onSupplierFilterChange() {
  const supVal=(document.getElementById('stok-fil-supplier')||{}).value||'';
  _updateIndukDropdown(supVal, true); // reset induk saat ganti supplier
  renderStok();
}
function applyStokFilter() { renderStok(); }
function resetStokFilter() { ['stok-fil-supplier','stok-fil-induk','stok-fil-status'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});stokQ='';const sb=document.getElementById('stok-search');if(sb)sb.value='';renderStok(); }
function sortStok(col) { if(_stokSortCol===col){_stokSortDir*=-1;}else{_stokSortCol=col;_stokSortDir=1;}renderStok(); }

function renderStok() {
  populateStokFilters();
  const q=stokQ.toLowerCase();
  const supFil=(document.getElementById('stok-fil-supplier')||{}).value||'';
  const indukFil=(document.getElementById('stok-fil-induk')||{}).value||'';
  const statusFil=(document.getElementById('stok-fil-status')||{}).value||'';
  const normStr = s => (s||'').toUpperCase().trim();
  let rows=DB.stok.filter(r=>{
    if (q && !r.var.toLowerCase().includes(q) && !getIndukOf(r.var).toLowerCase().includes(q)) return false;
    if (supFil) { const p=DB.produk.find(x=>normStr(x.var)===normStr(r.var)); if(!p||normStr(p.suplaier)!==normStr(supFil)) return false; }
    if (indukFil) { const p=DB.produk.find(x=>normStr(x.var)===normStr(r.var)); if(!p||p.induk!==indukFil) return false; }
    if (statusFil) { const s=getStokStatus3(getAkhir(r),r.safety||4); if(s!==statusFil) return false; }
    return true;
  });
  if (_stokSortCol) {
    rows=rows.sort((a,b)=>{
      const va=_stokSortCol==='akhir'?getAkhir(a):(a.keluar||0);
      const vb=_stokSortCol==='akhir'?getAkhir(b):(b.keluar||0);
      return (va-vb)*_stokSortDir;
    });
  }
  document.getElementById('stok-body').innerHTML=rows.length?rows.map((r,i)=>{
    const akhir=getAkhir(r), induk=getIndukOf(r.var);
    const p=DB.produk.find(x=>x.var===r.var);
    return `<tr>
      <td class="mono">${i+1}</td>
      <td><strong>${induk}</strong></td>
      <td>${r.var}</td>
      <td class="mono" style="text-align:center;font-weight:700">${akhir}</td>
      <td class="mono" style="text-align:center">${r.awal||0}</td>
      <td class="mono" style="text-align:center;color:var(--sage)">${r.masuk||0}</td>
      <td class="mono" style="text-align:center;color:var(--brown)">${r.keluar||0}</td>
      <td class="mono">${fmt(r.hpp)}</td>
      <td class="mono">${fmt(akhir*r.hpp)}</td>
      <td style="font-size:11px;color:var(--dusty)">${p?p.suplaier||'—':'—'}</td>
      <td>${stokStatus(akhir,r.safety||4)}</td>
      <td style="white-space:nowrap">
        <button class="btn btn-o btn-sm" onclick="openEditStok(${DB.stok.indexOf(r)})">✏️</button>
        <button class="btn btn-d btn-sm" onclick="hapusStok(${DB.stok.indexOf(r)})">🗑</button>
      </td>
    </tr>`;
  }).join(''):`<tr><td colspan="12" style="text-align:center;padding:30px;color:var(--dusty)">Tidak ada data stok yang sesuai filter</td></tr>`;
}

function filterStok(v){stokQ=v;renderStok();}

function openEditStok(idx) {
  const r=DB.stok[idx]; if(!r)return;
  document.getElementById('es-idx').value=idx;
  document.getElementById('es-sku').value=getIndukOf(r.var);
  document.getElementById('es-var').value=r.var;
  document.getElementById('es-awal').value=r.awal||0;
  document.getElementById('es-masuk').value=r.masuk||0;
  document.getElementById('es-keluar').value=r.keluar||0;
  document.getElementById('es-hpp').value=r.hpp||0;
  document.getElementById('es-safety').value=r.safety||4;
  openModal('modal-edit-stok');
}
function saveEditStok() {
  const idx=+document.getElementById('es-idx').value;
  DB.stok[idx]={...DB.stok[idx], awal:+document.getElementById('es-awal').value||0, masuk:+document.getElementById('es-masuk').value||0, keluar:+document.getElementById('es-keluar').value||0, hpp:+document.getElementById('es-hpp').value||0, safety:+document.getElementById('es-safety').value||4};
  closeModal('modal-edit-stok'); saveDB(); renderStok(); renderDashboard(); toast('Stok diperbarui!');
}
function hapusStok(idx) {
  if (!confirm(`Hapus stok "${DB.stok[idx]?.var}"?`)) return;
  DB.stok.splice(idx,1); saveDB(); renderStok(); toast('Stok dihapus');
}

// ================================================================
// RESTOCK
// ================================================================
function populateRsInduk() {
  const supplier = (document.getElementById('rs-supplier')||{}).value || '';
  // Filter produk berdasarkan supplier yang dipilih
  const filteredProduk = supplier && supplier !== 'LAINNYA'
    ? DB.produk.filter(p => (p.suplaier||'').toUpperCase() === supplier.toUpperCase())
    : DB.produk;
  const indukList = [...new Set(filteredProduk.map(p=>p.induk))];
  // Fallback: kalau tidak ada produk untuk supplier itu, tampilkan semua
  const finalList = indukList.length ? indukList : [...new Set(DB.produk.map(p=>p.induk))];
  document.getElementById('rs-sku-induk').innerHTML = finalList.map(s=>`<option>${s}</option>`).join('');
  populateRsVariasi();
}
function populateRsVariasi() {
  const induk = document.getElementById('rs-sku-induk').value;
  const supplier = (document.getElementById('rs-supplier')||{}).value || '';
  let variants = DB.produk.filter(p => p.induk === induk);
  // Kalau supplier dipilih dan ada produk yang cocok, filter lebih lanjut
  if (supplier && supplier !== 'LAINNYA' && supplier !== 'PRODUKSI SENDIRI') {
    const supVariants = variants.filter(p => (p.suplaier||'').toUpperCase() === supplier.toUpperCase());
    if (supVariants.length) variants = supVariants;
  }
  document.getElementById('rs-sku-variasi').innerHTML = variants.map(p=>`<option>${p.var}</option>`).join('');
}
function populateRqInduk() { const indukList=[...new Set(DB.produk.map(p=>p.induk))];document.getElementById('rq-induk').innerHTML=indukList.map(s=>`<option>${s}</option>`).join('');populateRqVariasi(); }
function populateRqVariasi() { const induk=document.getElementById('rq-induk').value;document.getElementById('rq-variasi').innerHTML=DB.produk.filter(p=>p.induk===induk).map(p=>`<option>${p.var}</option>`).join(''); }

function inputRestock() {
  const varName=document.getElementById('rs-sku-variasi').value;
  const qty=+document.getElementById('rs-qty').value||0;
  const catatan=document.getElementById('rs-catatan').value;
  const tgl=document.getElementById('rs-tgl').value;
  const supplier=document.getElementById('rs-supplier').value;
  if (!varName||qty<=0) { toast('Lengkapi SKU dan Qty','err'); return; }
  let s=DB.stok.find(x=>x.var===varName);
  if (s) { s.masuk=(s.masuk||0)+qty; }
  else { const p=DB.produk.find(x=>x.var===varName); DB.stok.push({var:varName,awal:0,masuk:qty,keluar:0,hpp:p?p.hpp:0,safety:4}); }
  DB.restock.unshift({tgl,var:varName,supplier,qty,catatan});
  document.getElementById('rs-qty').value='';
  document.getElementById('rs-catatan').value='';
  saveDB(); renderRestock(); renderLowStock(); renderDashboard();
  toast(`✅ ${qty} pcs ${varName} masuk dari ${supplier}`);
}

function inputRestockQuick() {
  const varName=document.getElementById('rq-variasi').value;
  const qty=+document.getElementById('rq-qty').value||0;
  const supplier=document.getElementById('rq-supplier').value;
  const tgl=new Date().toISOString().split('T')[0];
  if (!varName||qty<=0) { toast('Lengkapi SKU dan Qty','err'); return; }
  let s=DB.stok.find(x=>x.var===varName);
  if (s) { s.masuk=(s.masuk||0)+qty; }
  else { const p=DB.produk.find(x=>x.var===varName); DB.stok.push({var:varName,awal:0,masuk:qty,keluar:0,hpp:p?p.hpp:0,safety:4}); }
  DB.restock.unshift({tgl,var:varName,supplier,qty,catatan:'Quick input'});
  document.getElementById('rq-qty').value='';
  closeModal('modal-restock-quick');
  saveDB(); renderRestock(); renderLowStock(); renderDashboard();
  toast(`✅ ${qty} pcs ${varName} masuk!`);
}

function deleteRestock(idx) {
  const r=DB.restock[idx]; if(!confirm(`Hapus restock "${r?.var}"?`))return;
  const s=DB.stok.find(x=>x.var===r.var);
  if (s) s.masuk=Math.max(0,(s.masuk||0)-r.qty);
  DB.restock.splice(idx,1);
  saveDB(); renderRestock(); renderDashboard(); toast('Log restock dihapus');
}

function renderRestock() {
  document.getElementById('restock-body').innerHTML=DB.restock.length?DB.restock.map((r,i)=>`<tr>
    <td class="mono">${r.tgl}</td><td>${r.var}</td>
    <td style="font-size:11px">${r.supplier||'—'}</td>
    <td class="mono" style="text-align:center;color:var(--sage);font-weight:600">+${r.qty}</td>
    <td style="font-size:12px;color:var(--dusty)">${r.catatan||'—'}</td>
    <td><button class="btn btn-d btn-sm" onclick="deleteRestock(${i})">🗑</button></td>
  </tr>`).join(''):`<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--dusty)">Belum ada log restock</td></tr>`;
}

function renderLowStock() {
  // Ambil semua SKU yang pernah ada riwayat penjualan di jurnal
  const soldVars = new Set(DB.jurnal.map(j => j.var));

  // Filter: stok rendah/habis DAN pernah terjual
  const lows = DB.stok
    .filter(r => getAkhir(r) <= (r.safety || 4) && soldVars.has(r.var))
    .sort((a, b) => getAkhir(a) - getAkhir(b));

  const container = document.getElementById('low-stock-list');
  if (!container) return;

  if (!lows.length) {
    container.innerHTML = '<div style="color:var(--dusty);font-size:13px;padding:16px;text-align:center">✅ Semua stok produk aktif dalam kondisi aman!</div>';
    return;
  }

  // Hitung restock recommendation per SKU berdasarkan rata-rata penjualan
  const restockRows = lows.map(r => {
    const akhir = getAkhir(r);
    const jurnalSKU = DB.jurnal.filter(j => j.var === r.var);
    const totalTerjual = jurnalSKU.reduce((t, j) => t + j.qty, 0);
    // Estimasi restock = 2x rata-rata atau minimal safety stock x 3
    const avgPerTrx = jurnalSKU.length > 0 ? totalTerjual / jurnalSKU.length : 1;
    const restockSaran = Math.max(r.safety * 3, Math.ceil(avgPerTrx * 4));
    const induk = getIndukOf(r.var);
    const statusColor = akhir <= 0 ? 'var(--rust)' : '#d97706';
    const statusLabel = akhir <= 0 ? 'HABIS' : `${akhir} pcs`;
    return { r, akhir, restockSaran, induk, statusColor, statusLabel, totalTerjual };
  });

  // Header counter
  const habisCount = lows.filter(r => getAkhir(r) <= 0).length;
  const rendahCount = lows.filter(r => getAkhir(r) > 0).length;

  const counter = document.getElementById('low-stock-counter');
  if (counter) counter.textContent = lows.length > 0 ? `${lows.length} SKU perlu restock` : '';

  container.innerHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
      <span style="background:#FEE2E2;color:#991B1B;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">🔴 Habis: ${habisCount}</span>
      <span style="background:#FEF3C7;color:#92400E;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">⚠️ Rendah: ${rendahCount}</span>
      <span style="background:#EFF7F3;color:#2D6A4F;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;">📦 Total: ${lows.length} SKU</span>
      <span style="font-size:10px;color:var(--dusty);align-self:center;">* Hanya SKU dengan riwayat penjualan</span>
    </div>
    <div style="max-height:520px;overflow-y:auto;padding-right:4px;">
      ${restockRows.map(({ r, akhir, restockSaran, induk, statusColor, statusLabel, totalTerjual }) => `
        <div style="display:flex;align-items:flex-start;justify-content:space-between;padding:11px 14px;margin-bottom:7px;background:white;border-radius:10px;border:1px solid var(--border);border-left:4px solid ${statusColor};">
          <div style="flex:1;min-width:0;margin-right:10px;">
            <div style="font-weight:700;font-size:13px;white-space:normal;word-break:break-word;line-height:1.35;">${r.var}</div>
            <div style="font-size:11px;color:var(--dusty);margin-top:3px;">${induk} · Terjual ${totalTerjual} pcs</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-weight:800;color:${statusColor};font-size:13px;">${statusLabel}</div>
            <div style="font-size:11px;color:var(--dusty);margin-top:2px;">Saran: +${restockSaran} pcs</div>
          </div>
        </div>`).join('')}
    </div>`;
}

// ================================================================
// JURNAL
// ================================================================
function populateJInduk() {
  const indukList=[...new Set(DB.produk.map(p=>p.induk))];
  document.getElementById('j-sku-induk').innerHTML=indukList.map(s=>`<option>${s}</option>`).join('');
  populateJVariasi();
  // Sync channel dropdown dari DB.channel
  _syncChannelDropdowns();
}

function _normalizeCh(s){ return (s||'').trim().replace(/\.\s+/g,'.').toUpperCase(); }

function _syncChannelDropdowns() {
  const channels = (DB.channel||[]).filter(c=>c.status==='Aktif').map(c=>_normalizeCh(c.nama));
  const defaultCh = ['SHP.ZENOOT','SHP.ALLEY','SHP.ELENZ','LAZ.ZENOOT','TT.ALLEY','OFFLEN'];
  // Gabungkan: dari DB dulu, tambahkan default yang belum ada
  const allCh = [...new Set([...channels, ...defaultCh])];
  const opts = allCh.map(c=>`<option>${c}</option>`).join('');
  // Update semua dropdown channel
  ['j-ch','ej-ch'].forEach(id=>{
    const el=document.getElementById(id); if(!el)return;
    const cur=el.value;
    el.innerHTML=opts;
    // Pertahankan pilihan sebelumnya jika masih ada
    if([...el.options].find(o=>o.value===cur)) el.value=cur;
  });
}
function populateJVariasi() { const induk=document.getElementById('j-sku-induk').value;document.getElementById('j-sku-variasi').innerHTML=DB.produk.filter(p=>p.induk===induk).map(p=>`<option>${p.var}</option>`).join(''); }

function addJurnal() {
  const tgl=document.getElementById('j-tgl').value;
  const ch=document.getElementById('j-ch').value;
  const varName=document.getElementById('j-sku-variasi').value;
  const qty=+document.getElementById('j-qty').value||0;
  if (!tgl||!varName||qty<=0) { toast('Lengkapi Tanggal, SKU, dan Qty','err'); return; }
  const p=DB.produk.find(x=>x.var===varName); const hpp=p?p.hpp:0;
  DB.jurnal.unshift({tgl,ch,var:varName,qty,harga:0,hpp});
  let s=DB.stok.find(x=>x.var===varName);
  if (s) { s.keluar=(s.keluar||0)+qty; }
  else { DB.stok.push({var:varName,awal:0,masuk:0,keluar:qty,hpp,safety:4}); }
  document.getElementById('j-qty').value='';
  closeModal('modal-tambah-jurnal'); saveDB(); renderJurnal(); renderDashboard();
  toast(`Transaksi ${qty} pcs ${varName} disimpan!`);
}

// ═══ JURNAL FILTER STATE ═══
let jurnalQ='', jurnalDateFrom='', jurnalDateTo='', jurnalChFil='';

function filterJurnal(v){ jurnalQ=v; renderJurnal(); }
function filterJurnalDate(){
  jurnalDateFrom=(document.getElementById('j-fil-from')||{}).value||'';
  jurnalDateTo=(document.getElementById('j-fil-to')||{}).value||'';
  renderJurnal();
}
function filterJurnalChannel(){
  jurnalChFil=(document.getElementById('j-fil-ch')||{}).value||'';
  renderJurnal();
}
function resetJurnalFilter(){
  jurnalQ=''; jurnalDateFrom=''; jurnalDateTo=''; jurnalChFil='';
  ['j-search','j-fil-from','j-fil-to'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const ch=document.getElementById('j-fil-ch');if(ch)ch.value='';
  renderJurnal();
}

function _populateJurnalChannelFilter(){
  const sel=document.getElementById('j-fil-ch'); if(!sel)return;
  const cur=sel.value;
  const fromDB=(DB.channel||[]).map(c=>_normalizeCh(c.nama));
  const fromJurnal=DB.jurnal.map(j=>_normalizeCh(j.ch));
  const channels=[...new Set([...fromDB,...fromJurnal])].filter(Boolean).sort();
  sel.innerHTML='<option value="">Semua Channel</option>'+channels.map(c=>`<option>${c}</option>`).join('');
  if(cur)sel.value=cur;
}

function renderJurnal() {
  _populateJurnalChannelFilter();
  const q=jurnalQ.toLowerCase();
  const rows=DB.jurnal.filter(r=>{
    if(q && !r.var.toLowerCase().includes(q) && !r.ch.toLowerCase().includes(q)) return false;
    if(jurnalChFil && _normalizeCh(r.ch) !== _normalizeCh(jurnalChFil)) return false;
    if(jurnalDateFrom && r.tgl < jurnalDateFrom) return false;
    if(jurnalDateTo && r.tgl > jurnalDateTo) return false;
    return true;
  });
  let modal=0,qty=0;
  rows.forEach(r=>{modal+=r.hpp*r.qty;qty+=r.qty;});
  document.getElementById('j-rev').textContent=fmt(modal);
  document.getElementById('j-tot-qty').textContent=qty;
  document.getElementById('j-trx').textContent=rows.length;
  document.getElementById('j-avg').textContent=fmt(rows.length?Math.round(modal/rows.length):0);
  document.getElementById('jurnal-body').innerHTML=rows.length?rows.map((r,i)=>{
    const modalKeluar=r.hpp*r.qty;
    const idx=DB.jurnal.indexOf(r);
    return `<tr><td class="mono">${i+1}</td><td class="mono">${r.tgl}</td><td>${chTag(r.ch)}</td><td>${r.var}</td><td class="mono" style="text-align:center">${r.qty}</td><td class="mono">${fmt(r.hpp)}</td><td class="mono" style="color:var(--brown);font-weight:600">${fmt(modalKeluar)}</td><td style="white-space:nowrap"><button class="btn btn-o btn-sm" onclick="openEditJurnal(${idx})">✏️</button><button class="btn btn-d btn-sm" onclick="deleteJurnal(${idx})">🗑</button></td></tr>`;
  }).join(''):`<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--dusty)">Tidak ada transaksi sesuai filter</td></tr>`;
}

function openEditJurnal(idx) {
  const r=DB.jurnal[idx];
  ['ej-idx','ej-tgl','ej-ch','ej-sku','ej-qty','ej-harga','ej-hpp'].forEach(id=>{
    const el=document.getElementById(id); if(!el)return;
    if(id==='ej-idx')el.value=idx; else if(id==='ej-tgl')el.value=r.tgl; else if(id==='ej-ch')el.value=r.ch; else if(id==='ej-sku')el.value=r.var; else if(id==='ej-qty')el.value=r.qty; else if(id==='ej-harga')el.value=r.harga; else if(id==='ej-hpp')el.value=r.hpp;
  });
  openModal('modal-edit-jurnal');
}
function saveEditJurnal() {
  const idx=+document.getElementById('ej-idx').value;
  const old=DB.jurnal[idx];
  const s=DB.stok.find(x=>x.var===old.var); if(s)s.keluar=Math.max(0,(s.keluar||0)-old.qty);
  const newQty=+document.getElementById('ej-qty').value||0;
  const newVar=document.getElementById('ej-sku').value;
  DB.jurnal[idx]={tgl:document.getElementById('ej-tgl').value,ch:document.getElementById('ej-ch').value,var:newVar,qty:newQty,harga:0,hpp:+document.getElementById('ej-hpp').value||0};
  const s2=DB.stok.find(x=>x.var===newVar); if(s2)s2.keluar=(s2.keluar||0)+newQty;
  closeModal('modal-edit-jurnal'); saveDB(); renderJurnal(); renderDashboard(); toast('Transaksi diperbarui!');
}
function deleteJurnal(idx) {
  if (!confirm('Hapus transaksi ini?')) return;
  const r=DB.jurnal[idx]; const s=DB.stok.find(x=>x.var===r.var); if(s)s.keluar=Math.max(0,(s.keluar||0)-r.qty);
  DB.jurnal.splice(idx,1); saveDB(); renderJurnal(); renderDashboard(); toast('Transaksi dihapus');
}

// ================================================================
// KELOLA PRODUK
// ================================================================
let produkQ='';
function filterProduk(v){produkQ=v;renderProduk();}
function renderProduk() {
  const q=produkQ.toLowerCase();
  const rows=DB.produk.filter(r=>r.var.toLowerCase().includes(q)||r.induk.toLowerCase().includes(q)).sort((a,b)=>a.induk.localeCompare(b.induk)||a.var.localeCompare(b.var));
  document.getElementById('produk-body').innerHTML=rows.length?rows.map((r,i)=>`<tr>
    <td class="mono">${i+1}</td><td><strong>${r.induk}</strong></td><td>${r.var}</td>
    <td class="mono">${fmt(r.hpp)}</td><td style="font-size:12px;color:var(--dusty)">${r.suplaier||'-'}</td>
    <td style="white-space:nowrap">
      <button class="btn btn-o btn-sm" onclick="openEditProduk(${DB.produk.indexOf(r)})">✏️ Edit</button>
      <button class="btn btn-d btn-sm" onclick="deleteProduk(${DB.produk.indexOf(r)})">🗑</button>
    </td>
  </tr>`).join(''):`<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--dusty)">Tidak ada produk</td></tr>`;
}
function tambahProduk() {
  const induk=document.getElementById('np-induk').value.trim().toUpperCase();
  const varName=document.getElementById('np-variasi').value.trim().toUpperCase();
  const hpp=+document.getElementById('np-hpp').value||0;
  const suplaier=document.getElementById('np-suplaier').value.trim().toUpperCase();
  if (!induk||!varName) { toast('SKU Induk dan Variasi wajib diisi','err'); return; }
  if (DB.produk.find(p=>p.var.toUpperCase()===varName)) { toast('SKU Variasi sudah ada!','err'); return; }
  DB.produk.push({induk,var:varName,hpp,suplaier,npm:10,jual:0,pasang:0,reseller:0,gm:0});
  if (!DB.stok.find(s=>s.var.toUpperCase()===varName)) DB.stok.push({var:varName,awal:0,masuk:0,keluar:0,hpp,safety:4});
  ['np-induk','np-variasi','np-hpp','np-suplaier'].forEach(id=>document.getElementById(id).value='');
  closeModal('modal-tambah-produk'); saveDB(); renderProduk(); renderStok(); renderDashboard();
  toast(`Produk ${varName} berhasil ditambahkan!`);
}
function openEditProduk(idx) {
  const r=DB.produk[idx];
  document.getElementById('ep-idx').value=idx;
  document.getElementById('ep-induk').value=r.induk;
  document.getElementById('ep-variasi').value=r.var;
  document.getElementById('ep-hpp').value=r.hpp;
  document.getElementById('ep-suplaier').value=r.suplaier||'';
  openModal('modal-edit-produk');
}
function saveEditProduk() {
  const idx=+document.getElementById('ep-idx').value;
  DB.produk[idx]={...DB.produk[idx],induk:document.getElementById('ep-induk').value.trim().toUpperCase(),var:document.getElementById('ep-variasi').value.trim().toUpperCase(),hpp:+document.getElementById('ep-hpp').value||0,suplaier:document.getElementById('ep-suplaier').value.trim().toUpperCase()};
  closeModal('modal-edit-produk'); saveDB(); renderProduk(); renderHarga(); toast('Produk diperbarui!');
}
function deleteProduk(idx) {
  if (!confirm(`Hapus produk "${DB.produk[idx].var}"?`)) return;
  DB.produk.splice(idx,1); saveDB(); renderProduk(); toast('Produk dihapus');
}
function resetProdukSaja() {
  DB.produk=[]; saveDB(); setBackupMode(false); closeModal('modal-reset-produk');
  renderProduk(); renderHarga(); renderDashboard(); toast('✅ Semua produk dihapus.');
}

// ================================================================
// SYNC STOK
// ================================================================
function syncStokFromProduk() {
  let added=0;
  DB.produk.forEach(p=>{
    if (!DB.stok.find(s=>s.var.toUpperCase()===p.var.toUpperCase())) {
      DB.stok.push({var:p.var,awal:0,masuk:0,keluar:0,hpp:p.hpp||0,safety:4}); added++;
    }
  });
  return added;
}
function syncStokDanRender() {
  const added=syncStokFromProduk();
  if (added>0) { saveDB();renderStok();renderDashboard();toast(`✅ ${added} entry stok baru dibuat!`); }
  else toast('Semua produk sudah punya entry stok ✅');
}

// ================================================================
// HARGA / PRICE LIST — Filter Sinkron
// ================================================================
let hargaQ='', hargaFilInduk='', hargaFilSupplier='';

function populateHargaFilters() {
  const indukList=[...new Set(DB.produk.map(r=>r.induk))].sort();
  const supplierList=[...new Set(DB.produk.map(r=>r.suplaier||'').filter(Boolean))].sort();
  const indukSel=document.getElementById('harga-fil-induk');
  const supSel=document.getElementById('harga-fil-supplier');
  if(indukSel){const cur=indukSel.value;indukSel.innerHTML='<option value="">Semua Produk</option>'+indukList.map(s=>`<option>${s}</option>`).join('');if(cur)indukSel.value=cur;}
  if(supSel){const cur=supSel.value;supSel.innerHTML='<option value="">Semua Supplier</option>'+supplierList.map(s=>`<option>${s}</option>`).join('');if(cur)supSel.value=cur;}
}

function filterHarga(v){ hargaQ=v; renderHarga(); }
function filterHargaFromDropdown() {
  hargaFilInduk=(document.getElementById('harga-fil-induk')||{}).value||'';
  hargaFilSupplier=(document.getElementById('harga-fil-supplier')||{}).value||'';
  renderHarga();
}
function resetHargaFilter() {
  hargaQ=''; hargaFilInduk=''; hargaFilSupplier='';
  const sb=document.getElementById('harga-search'); if(sb)sb.value='';
  const fi=document.getElementById('harga-fil-induk'); if(fi)fi.value='';
  const fs=document.getElementById('harga-fil-supplier'); if(fs)fs.value='';
  renderHarga();
}

function renderHarga() {
  populateHargaFilters();
  const q=hargaQ.toLowerCase();
  const rows=DB.produk.filter(r=>{
    if(hargaFilInduk && r.induk!==hargaFilInduk) return false;
    if(hargaFilSupplier && (r.suplaier||'')!==hargaFilSupplier) return false;
    if(q && !r.var.toLowerCase().includes(q) && !r.induk.toLowerCase().includes(q)) return false;
    return true;
  }).sort((a,b)=>a.induk.localeCompare(b.induk)||a.var.localeCompare(b.var));
  const body=document.getElementById('harga-body');
  if(body)body.innerHTML=rows.length?rows.map((r,i)=>`<tr>
    <td class="mono">${i+1}</td><td><strong>${r.induk}</strong></td><td>${r.var}</td>
    <td class="mono">${fmt(r.hpp)}</td>
    <td><span class="badge bb">${r.npm}%</span></td>
    <td class="mono" style="color:var(--sage);font-weight:600">${fmt(r.jual)}</td>
    <td class="mono">${fmt(r.reseller)}</td>
    <td><span class="badge ${r.gm>=60?'bg':'bo'}">${r.gm}%</span></td>
  </tr>`).join(''):`<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--dusty)">Tidak ada produk sesuai filter</td></tr>`;
}

// ================================================================
// IMPORT DARI SHEETS
// ================================================================
let importParsedRows=[], importColMap={};
function closeImportSheets() {
  closeModal('modal-import-sheets');
  document.getElementById('import-paste-area').value='';
  document.getElementById('import-step-1').style.display='';
  document.getElementById('import-step-2').style.display='none';
  importParsedRows=[]; importColMap={};
}
function parseImportSheets() {
  const raw=document.getElementById('import-paste-area').value.trim();
  if (!raw) { toast('Paste dulu data dari Sheets!','err'); return; }
  const lines=raw.split('\n').map(l=>l.split('\t').map(c=>c.trim()));
  if (lines.length<2) { toast('Data terlalu sedikit','err'); return; }
  const headers=lines[0].map(h=>h.toUpperCase().replace(/\s+/g,' '));
  const aliases={induk:['SKU','NAMA PRODUK','PRODUK','INDUK','NAMA'],var:['VARIANT','VARIASI','SKU VARIASI','VARIAN'],hpp:['HPP','MODAL','COST','HARGA POKOK'],suplaier:['SUPLAIER','SUPPLIER','VENDOR']};
  importColMap={};
  for (const [field,names] of Object.entries(aliases)) { const idx=headers.findIndex(h=>names.includes(h)); if(idx!==-1)importColMap[field]=idx; }
  if (importColMap.induk===undefined&&importColMap.var===undefined) { toast('Tidak menemukan kolom SKU atau VARIANT','err'); return; }
  importParsedRows=lines.slice(1);
  document.getElementById('import-step-1').style.display='none';
  document.getElementById('import-step-2').style.display='';
  document.getElementById('import-mapping-area').innerHTML=`<p style="font-size:12px;color:var(--dusty);margin:0 0 8px"><strong>Kolom terdeteksi:</strong> ${Object.entries({induk:'SKU Induk',var:'Variasi',hpp:'HPP',suplaier:'Suplaier'}).map(([f,l])=>`${l}: <strong>${importColMap[f]!==undefined?headers[importColMap[f]]:'—'}</strong>`).join(' · ')}</p>`;
  const getCol=(row,field)=>importColMap[field]!==undefined?(row[importColMap[field]]||''):'';
  let baru=0,dup=0;
  const html=importParsedRows.slice(0,8).map((row,i)=>{const induk=getCol(row,'induk').toUpperCase();const varVal=getCol(row,'var').toUpperCase();const hpp=getCol(row,'hpp').replace(/[.,]/g,'').replace(/[^\d]/g,'');const isDup=!!DB.produk.find(p=>p.var.toUpperCase()===varVal);isDup?dup++:baru++;return `<tr><td style="padding:5px 8px">${i+1}</td><td style="padding:5px 8px">${induk||'—'}</td><td style="padding:5px 8px">${varVal||'—'}</td><td style="padding:5px 8px">${hpp?parseInt(hpp).toLocaleString('id'):'-'}</td><td style="padding:5px 8px"><span class="badge ${isDup?'br':'bg'}">${isDup?'Ada':'Baru'}</span></td></tr>`;}).join('');
  document.getElementById('import-preview-head').innerHTML='<th>No</th><th>Induk</th><th>Variasi</th><th>HPP</th><th>Status</th>';
  document.getElementById('import-preview-body').innerHTML=html;
  document.getElementById('import-summary').innerHTML=`Total: <strong>${importParsedRows.length}</strong> baris · Baru: <strong style="color:var(--sage)">${baru}</strong> · Duplikat: <strong style="color:var(--rust)">${dup}</strong>`;
}
function backImportStep1() { document.getElementById('import-step-1').style.display='';document.getElementById('import-step-2').style.display='none'; }
function doImportSheets() {
  const getCol=(row,field)=>importColMap[field]!==undefined?(row[importColMap[field]]||''):'';
  let added=0,skipped=0;
  importParsedRows.forEach(row=>{
    const induk=getCol(row,'induk').trim().toUpperCase();const varVal=getCol(row,'var').trim().toUpperCase();
    if (!induk&&!varVal) return;
    if (DB.produk.find(p=>p.var.toUpperCase()===varVal)) { skipped++;return; }
    const hpp=parseFloat(getCol(row,'hpp').replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,''))||0;
    const suplaier=getCol(row,'suplaier').trim().toUpperCase();
    DB.produk.push({induk,var:varVal,hpp,suplaier,npm:10,jual:0,pasang:0,reseller:0,gm:0}); added++;
  });
  const stokAdded=syncStokFromProduk();
  saveDB(); renderProduk(); renderStok(); closeImportSheets();
  toast(`✅ ${added} produk diimport, ${stokAdded} entry stok baru!`);
}

// ================================================================
// INPUT STOK MASSAL
// ================================================================
function parseMassal() {
  const raw=document.getElementById('massal-paste-area').value.trim();
  if (!raw) { toast('Paste data dulu!','err'); return; }
  const lines=raw.split('\n').map(l=>l.trim()).filter(l=>l);
  let valid=0,notFound=0;
  const html=lines.map((line,i)=>{const parts=line.split('\t');const sku=(parts[0]||'').trim().toUpperCase();const qty=parseInt((parts[1]||'0').replace(/[^\d]/g,''))||0;const found=DB.stok.find(s=>s.var.toUpperCase()===sku);if(found&&qty>0)valid++;else notFound++;return `<tr><td style="padding:5px 8px">${i+1}</td><td style="padding:5px 8px">${sku}</td><td style="padding:5px 8px">${qty}</td><td style="padding:5px 8px"><span class="badge ${found&&qty>0?'bg':'br'}">${found&&qty>0?'✅ Siap':!found?'SKU tdk ada':'Qty 0'}</span></td></tr>`;}).join('');
  document.getElementById('massal-preview-body').innerHTML=html;
  document.getElementById('massal-summary').innerHTML=`Total: <strong>${lines.length}</strong> · Siap: <strong style="color:var(--sage)">${valid}</strong> · Dilewati: <strong style="color:var(--rust)">${notFound}</strong>`;
  document.getElementById('massal-preview').style.display='block';
  document.getElementById('massal-confirm-btn').style.display=valid>0?'inline-flex':'none';
}
function doInputMassal() {
  const raw=document.getElementById('massal-paste-area').value.trim();
  const lines=raw.split('\n').map(l=>l.trim()).filter(l=>l);
  let updated=0;
  lines.forEach(line=>{const parts=line.split('\t');const sku=(parts[0]||'').trim().toUpperCase();const qty=parseInt((parts[1]||'0').replace(/[^\d]/g,''))||0;const stok=DB.stok.find(s=>s.var.toUpperCase()===sku);if(stok&&qty>0){stok.masuk=(stok.masuk||0)+qty;updated++;}});
  if (updated>0) { saveDB();renderStok();renderDashboard();closeModal('modal-stok-massal');document.getElementById('massal-paste-area').value='';document.getElementById('massal-preview').style.display='none';toast(`✅ ${updated} SKU berhasil diupdate!`); }
  else toast('Tidak ada data valid','err');
}

// ================================================================
// CHANNEL PENJUALAN
// ================================================================
function renderChannel() {
  const body=document.getElementById('channel-body'); if(!body)return;
  const channels=DB.channel||[];
  if (!channels.length) { body.innerHTML='<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--dusty)">Belum ada channel.</td></tr>'; return; }
  const platformColor={Shopee:'#ee4d2d',Lazada:'#f57c00','TikTok Shop':'#010101',Offline:'#5a7a6a',Lainnya:'#8c7b6b'};
  body.innerHTML=channels.map((c,i)=>`<tr>
    <td class="mono">${i+1}</td><td><strong>${c.nama}</strong></td>
    <td><span style="background:${platformColor[c.platform]||'#888'};color:white;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${c.platform}</span></td>
    <td><span class="badge ${c.status==='Aktif'?'bg':'bd'}">${c.status}</span></td>
    <td style="white-space:nowrap"><button class="btn btn-o btn-sm" onclick="toggleChannelStatus(${i})">🔄</button><button class="btn btn-d btn-sm" onclick="hapusChannel(${i})">🗑</button></td>
  </tr>`).join('');
}
function tambahChannel() {
  const nama=document.getElementById('ch-nama').value.trim().toUpperCase();
  const platform=document.getElementById('ch-platform').value;
  const status=document.getElementById('ch-status').value;
  if (!nama) { toast('Nama channel wajib diisi!','err'); return; }
  if (!DB.channel) DB.channel=[];
  if (DB.channel.find(c=>c.nama===nama)) { toast('Channel sudah ada!','err'); return; }
  DB.channel.push({nama,platform,status});
  document.getElementById('ch-nama').value='';
  saveDB(); closeModal('modal-tambah-channel'); renderChannel();
  _syncChannelDropdowns(); // langsung sync ke dropdown jurnal
  toast(`✅ Channel ${nama} ditambahkan!`);
}
function toggleChannelStatus(idx) {
  if(!DB.channel[idx])return;
  DB.channel[idx].status=DB.channel[idx].status==='Aktif'?'Nonaktif':'Aktif';
  saveDB(); renderChannel();
  _syncChannelDropdowns();
}
function hapusChannel(idx) { if(!confirm(`Hapus channel "${DB.channel[idx]?.nama}"?`))return;DB.channel.splice(idx,1);saveDB();renderChannel(); }

// ================================================================
// CHECKLIST
// ================================================================
const CHECKS={
  pagi:['Cek status produksi harian','Pastikan target 11 pcs selesai dirajut','Cek stok semua variasi','Update stok di semua channel Shopee'],
  malam:['Cek jadwal Flash Sale Toko sudah aktif','Input transaksi penjualan hari ini','Cek ROAS iklan harian','Analisa jam peak order terbanyak'],
  chat:['Balas semua chat dalam 1 jam','Arahkan pembeli ke "Klaim Voucher Toko"','Tawarkan Voucher Cashback XTRA','Follow up pembeli yang sudah checkout'],
  eval:['Hitung total penjualan hari ini','Bandingkan dengan target 6 pcs/hari','Jika >12 pcs, amankan stok esok hari','Catat produk best-seller hari ini'],
};
function renderChecks(){
  Object.entries(CHECKS).forEach(([k,items])=>{
    const el=document.getElementById('chk-'+k); if(!el)return;
    el.innerHTML=items.map((item,i)=>`<div class="chk-item" id="ci-${k}-${i}" onclick="toggleChk('${k}',${i})"><div class="chk-box" id="cb-${k}-${i}"></div><span>${item}</span></div>`).join('');
  });
}
function toggleChk(k,i){const el=document.getElementById(`ci-${k}-${i}`);const done=el.classList.toggle('done');document.getElementById(`cb-${k}-${i}`).textContent=done?'✓':'';}

// ================================================================
// RESTORE / EXPORT
// ================================================================
function exportDB() {
  const blob=new Blob([JSON.stringify(DB,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`zenot_backup_${new Date().toISOString().slice(0,10)}.json`;a.click();
  toast('Backup JSON berhasil diunduh!');
}

let _restoreData=null;
function handleRestoreDrop(e){e.preventDefault();document.getElementById('restore-dropzone').style.borderColor='var(--border)';const file=e.dataTransfer.files[0];if(file)readRestoreFile(file);}
function previewRestore(input){const file=input.files[0];if(file)readRestoreFile(file);}
function readRestoreFile(file) {
  if (!file.name.endsWith('.json')) { toast('File harus .json!','err'); return; }
  const reader=new FileReader();
  reader.onload=ev=>{
    try {
      const parsed=JSON.parse(ev.target.result);
      if (!parsed.produk||!parsed.stok||!parsed.jurnal) { toast('File tidak valid — bukan backup zenOt!','err'); return; }
      _restoreData=parsed;
      document.getElementById('restore-file-nama').innerHTML=`✅ <strong>${file.name}</strong> — valid`;
      document.getElementById('restore-preview').innerHTML=`<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;"><div style="background:white;border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:var(--dusty)">PRODUK</div><div style="font-size:22px;font-weight:700">${parsed.produk.length}</div></div><div style="background:white;border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:var(--dusty)">STOK</div><div style="font-size:22px;font-weight:700">${parsed.stok.length}</div></div><div style="background:white;border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center"><div style="font-size:10px;color:var(--dusty)">JURNAL</div><div style="font-size:22px;font-weight:700">${parsed.jurnal.length}</div></div></div>`;
      document.getElementById('restore-step1').style.display='none';
      document.getElementById('restore-step2').style.display='block';
    } catch { toast('Gagal membaca file — file mungkin rusak!','err'); }
  };
  reader.readAsText(file);
}
function confirmRestore() {
  if (!_restoreData) return;
  DB.produk=_restoreData.produk; DB.stok=_restoreData.stok; DB.jurnal=_restoreData.jurnal; DB.restock=_restoreData.restock||[];
  saveDB(); closeModal('modal-restore'); resetRestoreModal();
  renderDashboard(); renderStok(); renderHarga(); populateJInduk(); populateRsInduk();
  toast('✅ Data berhasil direstore!'); setBackupMode(true);
}
function resetRestoreModal(){_restoreData=null;document.getElementById('restore-file-input').value='';document.getElementById('restore-step1').style.display='block';document.getElementById('restore-step2').style.display='none';}

// ================================================================
// SIDEBAR
// ================================================================
let _sidebarCollapsed=false;
function toggleSidebarCollapse() {
  const sidebar=document.querySelector('.sidebar');
  const main=document.querySelector('.main');
  const icon=document.getElementById('sidebar-toggle-icon');
  _sidebarCollapsed=!_sidebarCollapsed;
  sidebar.classList.toggle('collapsed',_sidebarCollapsed);
  main.classList.toggle('expanded',_sidebarCollapsed);
  if (icon) icon.textContent=_sidebarCollapsed?'▶':'◀';
  localStorage.setItem('zenot_sidebar_collapsed',_sidebarCollapsed?'1':'0');
}

// ================================================================
// INIT
// ================================================================
function initDate(){
  const d=new Date();
  const days=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  const months=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
  const el=document.getElementById('topbar-date');
  if(el)el.textContent=`${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  const jTgl=document.getElementById('j-tgl'); if(jTgl)jTgl.value=d.toISOString().split('T')[0];
  const rsTgl=document.getElementById('rs-tgl'); if(rsTgl)rsTgl.value=d.toISOString().split('T')[0];
}

// ═══ MOBILE SIDEBAR TOGGLE ═══
function toggleSidebarMobile() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;
  const isOpen = sidebar.classList.contains('open');
  sidebar.classList.toggle('open', !isOpen);
  if (overlay) overlay.classList.toggle('open', !isOpen);
}

// Auto-close sidebar saat nav item diklik di mobile
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    if (window.innerWidth <= 900) toggleSidebarMobile();
  });
});

// Main init
initDate();
(async () => {
  await loadDB();
  await cleanChannelData();
  syncStokFromProduk();
  renderDashboard();
  renderStok();
  renderHarga();
  renderChecks();
  populateJInduk();
  populateRsInduk();
  if (localStorage.getItem('zenot_sidebar_collapsed')==='1') toggleSidebarCollapse();
  startAutoRefreshHarga(2);
})();
