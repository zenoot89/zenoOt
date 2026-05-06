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
// GLOBAL FETCH HELPER — FIX ANDROID CHROME
// Semua request ke Supabase wajib pakai ini supaya CORS preflight
// berjalan benar di Android Chrome / Samsung Internet / WebView
// ================================================================
function _sbFetch(url, options = {}) {
  const sbHeaders = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    ...(options.headers || {})
  };
  return fetch(url, {
    mode: 'cors',
    credentials: 'omit',
    ...options,
    headers: sbHeaders
  });
}

// ================================================================
// DATE HELPER — Local timezone (WIB), bukan UTC
// ================================================================
const _localDateStr = (d) => {
  d = d || new Date();
  const yr  = d.getFullYear();
  const mo  = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${yr}-${mo}-${day}`;
};

// ================================================================
// DATA LAYER — Supabase Implementation
// ================================================================
const DataLayer = {

  // Helper: base headers
  // FIX ANDROID: tambah mode:'cors' explicit di setiap fetch call (lihat _fetch helper)
  _headers(prefer = 'return=minimal') {
    return {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': prefer
    };
  },

  // Helper: wrapper fetch dengan mode:cors explicit (fix Android Chrome)
  async _fetch(url, options = {}) {
    const res = await fetch(url, {
      mode: 'cors',           // FIX ANDROID: explicit CORS mode
      credentials: 'omit',   // FIX ANDROID: jangan kirim cookies — cegah preflight tambahan
      ...options,
      headers: { ...options.headers }
    });
    return res;
  },

  // Helper: fetch dari satu tabel
  async _getTable(table) {
    const res = await this._fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*&order=id.desc`, {
      headers: this._headers('return=representation')
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => res.status);
      throw new Error(`Gagal fetch ${table}: ${res.status} — ${errText}`);
    }
    return res.json();
  },

  // Helper: upsert (insert or update by unique key)
  async _upsert(table, rows, onConflict) {
    if (!rows || rows.length === 0) return;
    const res = await this._fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: this._headers('resolution=merge-duplicates,return=minimal'),
      body: JSON.stringify(rows)
    });
    if (!res.ok) {
      const err = await res.text().catch(() => res.status);
      throw new Error(`Gagal upsert ${table}: ${err}`);
    }
  },

  // Helper: delete satu row by key (uuid atau var)
  async _deleteByKey(table, key, value) {
    const res = await this._fetch(`${SUPABASE_URL}/rest/v1/${table}?${key}=eq.${encodeURIComponent(value)}`, {
      method: 'DELETE',
      headers: this._headers()
    });
    if (!res.ok) {
      const err = await res.text().catch(() => res.status);
      throw new Error(`Gagal delete ${table}: ${err}`);
    }
  },

  // Helper: generate UUID unik untuk setiap transaksi
  _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  // Helper: hapus semua lalu insert ulang (untuk data yang tidak punya unique key jelas)
  async _replaceAll(table, rows) {
    await this._fetch(`${SUPABASE_URL}/rest/v1/${table}?id=gte.1`, {
      method: 'DELETE',
      headers: this._headers()
    });
    if (!rows || rows.length === 0) return;
    const res = await this._fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: this._headers('return=minimal'),
      body: JSON.stringify(rows)
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => res.status);
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
        reseller: p.reseller || 0, gm: p.gm || 0,
        status_produk: p.status_produk || 'aktif',
        toko: p.toko || 'semua'
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
      await this._upsert('toko', channelRows.map(r=>({kode:r.nama||r.kode,brand:r.brand||'zenOt',platform:(r.platform||'shopee').toLowerCase(),grup:(r.platform||'SHOPEE').toUpperCase(),username:r.username||'',warna:r.warna||'#5C3D2E',urutan:r.urutan||99,status:r.status||'aktif'})), 'kode');

      // Jurnal — upsert by uuid (aman multi device)
      // FIX: jurnal lama tanpa uuid di-generate uuid-nya, bukan dibuang
      const jurnalRows = (data.jurnal || []).map(j => ({
        uuid: j.uuid || this._uuid(), tgl: j.tgl, ch: j.ch, var: j.var,
        qty: j.qty || 1, harga: j.harga || 0, hpp: j.hpp || 0
      })).filter(j => j.tgl && j.var); // minimal harus ada tgl dan var
      if (jurnalRows.length > 0) await this._upsert('jurnal', jurnalRows, 'uuid');

      // Restock — upsert by uuid (aman multi device)
      // FIX: restock lama tanpa uuid di-generate uuid-nya, bukan dibuang
      const restockRows = (data.restock || []).map(r => ({
        uuid: r.uuid || this._uuid(), tgl: r.tgl, var: r.var, supplier: r.supplier || '',
        qty: r.qty || 0, catatan: r.catatan || ''
      })).filter(r => r.tgl && r.var);
      if (restockRows.length > 0) await this._upsert('restock', restockRows, 'uuid');

      return true;
    } catch(e) {
      console.error('[DataLayer.save] ❌', e.message);
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
        this._getTable('toko'),
      ]);

      // Map balik ke format DB yang dipakai app
      return {
        ok: true,
        data: {
          produk: produk.map(p => ({
            induk: p.induk, var: p.var, hpp: Number(p.hpp),
            suplaier: p.suplaier, npm: Number(p.npm),
            jual: Number(p.jual), pasang: Number(p.pasang),
            reseller: Number(p.reseller), gm: Number(p.gm),
            status_produk: p.status_produk||'aktif',
            toko: p.toko||'semua'
          })),
          stok: stok.map(s => ({
            var: s.var, awal: s.awal, masuk: s.masuk,
            keluar: s.keluar, hpp: Number(s.hpp), safety: s.safety
          })),
          jurnal: jurnal
            .map(j => ({
              sid: j.id, uuid: j.uuid,
              tgl: j.tgl, ch: j.ch, var: j.var,
              qty: j.qty, harga: Number(j.harga), hpp: Number(j.hpp)
            })),
          restock: restock
            .map(r => ({
              sid: r.id, uuid: r.uuid,
              tgl: r.tgl, var: r.var, supplier: r.supplier,
              qty: r.qty, catatan: r.catatan
            })),
          channel: channel
            .filter(t => t.status === 'aktif')  // filter toko aktif
            .map(c => ({
              nama:     c.kode,                          // FIX: tabel 'toko' pakai kolom 'kode', bukan 'nama'
              kode:     c.kode,
              brand:    c.brand    || 'zenOt',
              platform: c.platform || 'shopee',
              grup:     c.grup     || (c.platform||'shopee').toUpperCase(),
              username: c.username || '',
              warna:    c.warna    || '#5C3D2E',
              urutan:   c.urutan   || 99,
              status:   c.status   || 'aktif'
            }))
        }
      };
    } catch(e) {
      console.error('[DataLayer.fetch] ❌', e.message);
      return null;
    }
  },

  // localStorage fallback — aktif sebagai backup
  // FIX: pakai versioned key supaya cache lama (dari device lain) tidak mencemari data baru
  _localKey: 'zenot_db_v2',
  saveLocal(data) {
    try { localStorage.setItem(this._localKey, JSON.stringify(data)); } catch(e) {}
    // Bersihkan key lama jika masih ada
    try { localStorage.removeItem('zenot_db_backup'); } catch(e) {}
  },
  loadLocal() {
    try {
      // Coba key baru dulu
      let raw = localStorage.getItem(this._localKey);
      // Fallback ke key lama (migrasi 1x)
      if (!raw) raw = localStorage.getItem('zenot_db_backup');
      return raw ? JSON.parse(raw) : null;
    } catch(e) { return null; }
  },
  clearLocal() {
    try { localStorage.removeItem(this._localKey); } catch(e) {}
    try { localStorage.removeItem('zenot_db_backup'); } catch(e) {}
  }
};


let _cloudConnected = false;
let _saveQueue = null;
let _backupModeActive = false;
let _currentPage = 'dashboard';

// ================================================================
// MULTI-TOKO — State & Manager
// ================================================================
window._tokoList  = [];          // [{kode, nama, brand, platform, grup, username, warna, urutan}]
window._tokoAktif = null;        // kode toko aktif (text: 'SHP.ZENOOT') atau null = semua

// ── Default warna per toko ──
const TOKO_COLORS = ['#5C3D2E','#5A7A6A','#3D7EAA','#C9A84C','#7C3AED'];

// ── Load daftar toko dari Supabase (tabel: toko) ──
async function loadTokoList() {
  try {
    // Ambil SEMUA toko dulu, filter di client (handle variasi status: aktif/AKTIF/null)
    const res = await _sbFetch(
      `${SUPABASE_URL}/rest/v1/toko?select=*&order=urutan.asc`
    );
    if (!res.ok) return;
    const rows = await res.json();
    // Filter aktif di client: status aktif / AKTIF / null / undefined semua diterima, kecuali 'nonaktif'/'arsip'
    const aktifRows = rows.filter(r => {
      const s = (r.status||'aktif').toLowerCase();
      return s !== 'nonaktif' && s !== 'arsip' && s !== 'inactive';
    });
    window._tokoList = aktifRows.map((r, i) => ({
      kode:     r.kode,
      nama:     r.kode,                              // tampilkan kode sebagai nama (SHP.ZENOOT)
      brand:    r.brand    || 'zenOt',
      platform: r.platform || 'shopee',
      grup:     r.grup     || 'SHOPEE',
      username: r.username || '',
      warna:    r.warna    || TOKO_COLORS[i % TOKO_COLORS.length],
      urutan:   r.urutan   || i + 1,
    }));
    // Restore toko aktif dari localStorage
    const saved = localStorage.getItem('zenot_toko_aktif');
    if (saved && window._tokoList.find(t => t.kode === saved)) {
      window._tokoAktif = saved;
    } else if (window._tokoList.length > 0) {
      window._tokoAktif = window._tokoList[0].kode;
      localStorage.setItem('zenot_toko_aktif', window._tokoAktif);
    }
    renderTokoDropdown();
  } catch(e) {
    console.warn('[loadTokoList]', e.message);
  }
}

// ── Simpan toko baru ke Supabase ──
async function saveToko(kode, brand, platform, grup, username, warna) {
  const urutan = window._tokoList.length + 1;
  const res = await _sbFetch(`${SUPABASE_URL}/rest/v1/toko`, {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify([{ kode, brand, platform, grup, username, warna, urutan, status: 'aktif' }])
  });
  if (!res.ok) throw new Error(await res.text());
  const rows = await res.json();
  return rows[0];
}

// ── Hapus toko dari Supabase ──
async function deleteToko(kode) {
  await _sbFetch(`${SUPABASE_URL}/rest/v1/toko?kode=eq.${encodeURIComponent(kode)}`, {
    method: 'DELETE'
  });
}

// ── Switch toko aktif ──
function switchToko(kode) {
  window._tokoAktif = kode || null;
  localStorage.setItem('zenot_toko_aktif', kode || '');
  renderTokoDropdown();

  // Re-render halaman aktif dengan filter baru
  const p = _currentPage;
  if      (p === 'dashboard' && typeof renderDashboard   === 'function') renderDashboard();
  else if (p === 'produk'    && typeof renderProduk      === 'function') renderProduk();
  else if (p === 'stok'      && typeof renderStok        === 'function') renderStok();
  else if (p === 'jurnal'    && typeof renderJurnal      === 'function') renderJurnal();
  else if (p === 'restock'   && typeof renderRestock     === 'function') renderRestock();
  else if (p === 'channel'   && typeof renderChannel  === 'function') renderChannel();
  if (typeof renderIntelDashboard === 'function' && p === 'intel-dashboard') renderIntelDashboard();

  const tokoNama = kode ? (window._tokoList.find(t => t.kode === kode)?.kode || 'Semua Toko') : 'Semua Toko';
  if (typeof toast === 'function') toast(`🏪 Beralih ke: ${tokoNama}`);
}

// ── Helper: get kode toko aktif ──
function getTokoAktifNama() {
  if (!window._tokoAktif) return 'Semua Toko';
  return window._tokoList.find(t => t.kode === window._tokoAktif)?.kode || 'Semua Toko';
}

// ── Helper: filter DB.jurnal sesuai toko aktif ──
// jurnal.ch = kode toko: 'SHP.ZENOOT', 'WA.DIRECT', dst
function getJurnalFiltered() {
  if (!window._tokoAktif) return DB.jurnal;
  return DB.jurnal.filter(j => {
    // Match langsung via ch (kode toko)
    if (j.ch && j.ch === window._tokoAktif) return true;
    // Legacy: field j.toko (lama pakai id angka atau kode)
    if (j.toko && j.toko === window._tokoAktif) return true;
    return false;
  });
}

function getProdukFiltered() {
  if (!window._tokoAktif) return DB.produk;
  return DB.produk.filter(p => {
    if (!p.toko || p.toko === 'semua') return true; // produk tanpa tag toko = tampil semua
    // Support multi-toko: toko bisa 'SHP.ZENOOT,SHP.ELENZ'
    return p.toko.split(',').map(x => x.trim()).includes(window._tokoAktif);
  });
}

// ── Render dropdown toko di topbar ──
function renderTokoDropdown() {
  const el = document.getElementById('toko-dropdown-wrap');
  if (!el) return;

  const toko = window._tokoAktif
    ? window._tokoList.find(t => t.kode === window._tokoAktif)
    : null;
  const warna = toko?.warna || '#5C3D2E';
  const nama  = toko?.nama  || 'Semua Toko';

  el.innerHTML = `
    <div style="position:relative;display:inline-block;">
      <button id="toko-dd-btn" onclick="toggleTokoMenu()"
        style="display:flex;align-items:center;gap:7px;background:white;border:1.5px solid var(--border);
               border-radius:20px;padding:6px 14px 6px 10px;cursor:pointer;font-family:'Outfit',sans-serif;
               font-size:12px;font-weight:600;color:var(--charcoal);white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.06);">
        <span style="width:9px;height:9px;border-radius:50%;background:${warna};flex-shrink:0;"></span>
        <span id="toko-dd-label">${nama}</span>
        <span style="font-size:9px;color:var(--dusty);margin-left:2px;">▼</span>
      </button>
      <div id="toko-dd-menu" style="display:none;position:absolute;top:calc(100% + 6px);right:0;
           background:white;border:1px solid var(--border);border-radius:12px;
           box-shadow:0 8px 24px rgba(0,0,0,.12);min-width:180px;z-index:200;overflow:hidden;">

        <!-- Semua Toko -->
        <div onclick="switchToko(null);toggleTokoMenu()"
          style="display:flex;align-items:center;gap:9px;padding:10px 14px;cursor:pointer;
                 font-size:12px;font-weight:600;color:var(--charcoal);
                 background:${!window._tokoAktif?'var(--cream)':'white'};
                 border-bottom:1px solid var(--border);">
          <span style="width:9px;height:9px;border-radius:50%;background:#8C7B6B;flex-shrink:0;"></span>
          Semua Toko
        </div>

        <!-- List toko per grup -->
        ${[...new Set(window._tokoList.map(t=>t.grup))].map(grup=>{
          const items=window._tokoList.filter(t=>t.grup===grup);
          return '<div style="padding:4px 14px 2px;font-size:9px;font-weight:700;color:var(--dusty);text-transform:uppercase;letter-spacing:.8px;border-top:1px solid var(--border);">'+grup+'</div>'
            +items.map(t=>'<div onclick="switchToko(\''+t.kode+'\');toggleTokoMenu()" style="display:flex;align-items:center;gap:9px;padding:8px 14px 8px 20px;cursor:pointer;font-size:12px;font-weight:600;color:var(--charcoal);background:'+(window._tokoAktif===t.kode?'var(--cream)':'white')+';"><span style="width:9px;height:9px;border-radius:50%;background:'+t.warna+';flex-shrink:0;"></span>'+t.kode+'<span style="margin-left:auto;font-size:10px;color:var(--dusty);">'+(t.username||t.brand)+'</span></div>').join('');
        }).join('')}

        <!-- Channel page exclusive untuk manage toko -->
        <div onclick="go('channel');toggleTokoMenu()"
          style="display:flex;align-items:center;gap:9px;padding:10px 14px;cursor:pointer;
                 font-size:11px;color:var(--dusty);border-top:1px solid var(--border);">
          <span style="font-size:12px;">⚙️</span> Kelola Channel
        </div>
      </div>
    </div>
  `;
}

function toggleTokoMenu() {
  const menu = document.getElementById('toko-dd-menu');
  if (!menu) return;
  const isOpen = menu.style.display === 'block';
  menu.style.display = isOpen ? 'none' : 'block';
  // Tutup saat klik di luar
  if (!isOpen) {
    setTimeout(() => {
      document.addEventListener('click', function _close(e) {
        if (!document.getElementById('toko-dd-btn')?.contains(e.target) &&
            !document.getElementById('toko-dd-menu')?.contains(e.target)) {
          if (menu) menu.style.display = 'none';
          document.removeEventListener('click', _close);
        }
      });
    }, 10);
  }
}

// ── Modal tambah toko ──
function openModalTambahToko() {
  // Tutup dropdown dulu
  const menu = document.getElementById('toko-dd-menu');
  if (menu) menu.style.display = 'none';

  // Buat modal inline jika belum ada
  let modal = document.getElementById('modal-tambah-toko');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-tambah-toko';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:500;display:flex;align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div style="background:white;border-radius:16px;padding:24px;width:340px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,.2);">
        <div style="font-size:16px;font-weight:700;color:var(--charcoal);margin-bottom:18px;">🏪 Tambah Toko Baru</div>

        <label style="font-size:11px;font-weight:700;color:var(--dusty);text-transform:uppercase;letter-spacing:.5px;">Nama Toko</label>
        <input id="toko-input-nama" class="inp" placeholder="contoh: Zenoot Official" style="width:100%;margin:6px 0 14px;">

        <label style="font-size:11px;font-weight:700;color:var(--dusty);text-transform:uppercase;letter-spacing:.5px;">Platform</label>
        <select id="toko-input-platform" class="sel" style="width:100%;margin:6px 0 14px;">
          <option>Shopee</option>
          <option>Tokopedia</option>
          <option>Lazada</option>
          <option>TikTok Shop</option>
          <option>Offline</option>
        </select>

        <label style="font-size:11px;font-weight:700;color:var(--dusty);text-transform:uppercase;letter-spacing:.5px;">Warna Label</label>
        <div style="display:flex;gap:8px;margin:8px 0 20px;flex-wrap:wrap;">
          ${TOKO_COLORS.concat(['#C0392B','#0D9488','#7C3AED']).map((c,i) =>
            `<div onclick="selectTokoColor('${c}')" id="tc-${i}"
              style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;
                     border:3px solid ${i===0?'#000':'transparent'};transition:border .15s;"
              data-color="${c}"></div>`).join('')}
        </div>
        <input type="hidden" id="toko-input-warna" value="${TOKO_COLORS[0]}">

        <div style="display:flex;gap:10px;">
          <button class="btn btn-p" onclick="submitTambahToko()" style="flex:1;">✅ Simpan Toko</button>
          <button class="btn btn-s" onclick="document.getElementById('modal-tambah-toko').remove()" style="flex:1;">Batal</button>
        </div>
        <div id="toko-save-status" style="margin-top:8px;font-size:11px;color:var(--dusty);text-align:center;"></div>
      </div>
    `;
    document.body.appendChild(modal);
    // Tutup klik di luar
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }
  modal.style.display = 'flex';
}

function selectTokoColor(color) {
  document.getElementById('toko-input-warna').value = color;
  document.querySelectorAll('[id^="tc-"]').forEach(el => {
    el.style.border = el.dataset.color === color ? '3px solid #000' : '3px solid transparent';
  });
}

async function submitTambahToko() {
  const nama     = document.getElementById('toko-input-nama')?.value.trim();
  const platform = document.getElementById('toko-input-platform')?.value;
  const warna    = document.getElementById('toko-input-warna')?.value || TOKO_COLORS[0];
  const statusEl = document.getElementById('toko-save-status');

  if (!nama) { if (statusEl) statusEl.innerHTML = '<span style="color:#C0392B">⚠️ Nama toko wajib diisi</span>'; return; }
  if (window._tokoList.length >= 20) { if (statusEl) statusEl.innerHTML = '<span style="color:#C0392B">Maksimal 20 toko</span>'; return; }
  // Generate kode otomatis dari nama (uppercase, max 15 char)
  const kode = nama.toUpperCase().replace(/[^A-Z0-9.]/g,'').substring(0,15) || nama.substring(0,10).toUpperCase();
  if (window._tokoList.find(t => t.kode === kode)) { if (statusEl) statusEl.innerHTML = '<span style="color:#C0392B">⚠️ Kode sudah ada: '+kode+'</span>'; return; }

  if (statusEl) statusEl.textContent = '⏳ Menyimpan...';
  try {
    const row = await saveToko(kode, 'zenOt', platform, platform.toUpperCase(), '', warna);
    window._tokoList.push({ kode: row.kode, nama: row.kode, brand: row.brand, platform: row.platform, grup: row.grup, username: row.username||'', warna, urutan: row.urutan });
    switchToko(row.kode);
    document.getElementById('modal-tambah-toko')?.remove();
    if (typeof toast === 'function') toast(`✅ Toko "${nama}" berhasil ditambahkan!`);
  } catch(e) {
    if (statusEl) statusEl.innerHTML = `<span style="color:#C0392B">❌ Gagal: ${e.message}</span>`;
  }
}

let _retryCloudTimer = null;

async function _retryCloudLoad() {
  if (_cloudConnected) return;
  try {
    const result = await Promise.race([
      DataLayer.fetch(),
      new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 8000))
    ]);
    if (result && result.ok && result.data) {
      const saved = result.data;
      if (saved.produk)  DB.produk  = saved.produk;
      if (saved.stok)    DB.stok    = saved.stok;
      if (saved.jurnal)  DB.jurnal  = saved.jurnal;
      if (saved.restock) DB.restock = saved.restock;
      DataLayer.saveLocal(DB);
      _normalizeJurnalChannel();
      recalcKeluar();
      setCloudStatus(true);
      // Re-render dashboard dengan data terbaru
      if (typeof renderDashboard === 'function') renderDashboard();
    }
  } catch(e) { /* tetap offline, coba lagi nanti */ }
}

function setCloudStatus(ok) {
  _cloudConnected = ok;
  // Auto-retry jika offline — coba setiap 30 detik
  clearInterval(_retryCloudTimer);
  if (!ok) {
    _retryCloudTimer = setInterval(_retryCloudLoad, 30000);
  }
  // Badge baru — fixed pojok kiri bawah
  const badge = document.getElementById('backup-badge-fixed');
  const indicator = document.getElementById('cloud-indicator-fixed');
  if (badge) {
    badge.innerHTML = ok ? '☁️ Cloud Aktif' : '⚠️ Offline — <span onclick="_retryCloudLoad()" style="cursor:pointer;text-decoration:underline;">Coba Lagi</span>';
    if (indicator) indicator.classList.toggle('offline', !ok);
  }
  // Legacy badge (fallback)
  const legacyBadge = document.getElementById('backup-badge');
  if (legacyBadge) {
    legacyBadge.style.display = 'flex';
    if (ok) { legacyBadge.style.background='#EFF7F3';legacyBadge.style.borderColor='#A8D5BE';legacyBadge.style.color='#2D6A4F';legacyBadge.innerHTML='☁️ Cloud Aktif'; }
    else { legacyBadge.style.background='#FFF3CD';legacyBadge.style.borderColor='#FFEAA7';legacyBadge.style.color='#856404';legacyBadge.innerHTML='⚠️ Offline — <span onclick="_retryCloudLoad()" style="cursor:pointer;text-decoration:underline;">Coba Lagi</span>'; }
  }
}
function setBackupMode(on) { _backupModeActive = on; }

function saveDB() {
  _syncAllDropdowns();
  const ind = document.getElementById('save-indicator');
  if (ind) {
    ind.textContent = '☁️ Menyimpan...';
    ind.style.display = 'block';
    clearTimeout(window._saveTimer);
    window._saveTimer = setTimeout(() => { ind.style.display='none'; }, 2500);
  }
  clearTimeout(_saveQueue);
  // Selalu simpan ke localStorage sebagai fallback offline
  DataLayer.saveLocal(DB);
  _saveQueue = setTimeout(() => { pushToCloud(); }, 800);
}

async function pushToCloud() {
  if (!SUPABASE_URL) return;
  const ok = await DataLayer.save(DB);
  setCloudStatus(ok);
  const ind = document.getElementById('save-indicator');
  if (ind) {
    if (ok) {
      ind.textContent='Tersimpan di Cloud';ind.style.color='var(--sage)';
      ind.style.display='block';clearTimeout(window._saveTimer);
      window._saveTimer=setTimeout(()=>{ind.style.display='none';},2000);
    } else {
      ind.textContent='Gagal sync cloud — cek console';ind.style.color='var(--rust)';
      ind.style.display='block';clearTimeout(window._saveTimer);
      window._saveTimer=setTimeout(()=>{ind.style.display='none';},4000);
    }
  }
}

function loadFromCloud() {
  return DataLayer.fetch();
}

// Recalculate keluar & masuk di stok berdasarkan jurnal dan restock
function recalcStok() {
  // Reset keluar dan masuk ke 0
  DB.stok.forEach(s => { s.keluar = 0; s.masuk = 0; });
  // Hitung keluar dari jurnal
  DB.jurnal.forEach(j => {
    const s = DB.stok.find(x => x.var === j.var);
    if (s) s.keluar = (s.keluar || 0) + (j.qty || 0);
  });
  // Hitung masuk dari restock
  DB.restock.forEach(r => {
    const s = DB.stok.find(x => x.var === r.var);
    if (s) s.masuk = (s.masuk || 0) + (r.qty || 0);
  });
}

// Alias untuk backward compatibility
function recalcKeluar() { recalcStok(); }

async function loadDB() {
  if (SUPABASE_URL) {
    try {
      showLoadingOverlay("☁️ Memuat data dari cloud...");
      console.info('[ZENOOT] Mencoba connect ke Supabase:', SUPABASE_URL.split('.')[0] + '...');

      // Timeout 15 detik — HP 4G butuh lebih lama (dari 8s → 15s)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Timeout")), 15000)
      );
      const result = await Promise.race([DataLayer.fetch(), timeoutPromise]);

      if (result && result.ok && result.data) {
        const saved = result.data;
        if (saved.produk)  DB.produk  = saved.produk;
        if (saved.stok)    DB.stok    = saved.stok;
        if (saved.jurnal)  DB.jurnal  = saved.jurnal;
        if (saved.restock) DB.restock = saved.restock;
        if (saved.channel) DB.channel = saved.channel; // legacy fallback
        console.info(`[ZENOOT] ✅ Cloud load OK — produk:${DB.produk.length} stok:${DB.stok.length} jurnal:${DB.jurnal.length} channel:${DB.channel.length}`);
        if (DB.channel.length === 0) console.warn('[ZENOOT] ⚠️ Channel kosong! Cek tabel "toko" di Supabase — pastikan ada row dengan status=aktif');
        // Simpan ke localStorage sebagai cache
        DataLayer.saveLocal(DB);
        // Load assignChannel dari Supabase dulu, fallback localStorage
        try {
          // Load assignChannel dari produk_toko (tabel proper)
          const chRes = await _sbFetch(
            `${SUPABASE_URL}/rest/v1/produk_toko?select=var,toko_kode,aktif`
          );
          if (chRes.ok) {
            const chRows = await chRes.json();
            if (chRows && chRows.length > 0) {
              // Rebuild assignChannel: { var: { toko_kode: aktif } }
              DB.assignChannel = {};
              chRows.forEach(r => {
                if (!DB.assignChannel[r.var]) DB.assignChannel[r.var] = {};
                DB.assignChannel[r.var][r.toko_kode] = r.aktif;
              });
            } else {
              // Fallback dari localStorage jika produk_toko kosong
              const ac = localStorage.getItem('zenot_assign_channel');
              if (ac) {
                try {
                  DB.assignChannel = JSON.parse(ac);
                  // Migrate ke produk_toko
                  _syncAssignToSupabase().catch(()=>{});
                } catch(e) {}
              }
            }
          }
        } catch(e) {
          const ac = localStorage.getItem('zenot_assign_channel');
          if (ac) try { DB.assignChannel = JSON.parse(ac); } catch(e2) {}
        }
        _normalizeJurnalChannel();
        recalcKeluar();
        setCloudStatus(true);
        hideLoadingOverlay(); return;
      }
    } catch(e) {
      console.error('[ZENOOT] ❌ Cloud load GAGAL:', e.message, '— fallback ke localStorage');
      hideLoadingOverlay();
    }

    // Fallback: coba load dari localStorage
    const local = DataLayer.loadLocal();
    if (local) {
      if (local.produk)  DB.produk  = local.produk;
      if (local.stok)    DB.stok    = local.stok;
      if (local.jurnal)  DB.jurnal  = local.jurnal;
      if (local.restock) DB.restock = local.restock;
      if (local.channel) DB.channel = local.channel; // legacy fallback
      // Load assignChannel dari localStorage
      try {
        const ac = localStorage.getItem('zenot_assign_channel');
        if (ac) DB.assignChannel = JSON.parse(ac);
      } catch(e) {}
      _normalizeJurnalChannel();
      recalcKeluar();
      console.info("Data dimuat dari cache lokal (cloud tidak tersedia)");
    }
    setCloudStatus(false);
    hideLoadingOverlay();
  }
}

function _normalizeJurnalChannel() {
  DB.jurnal.forEach(r => { if (r.ch) r.ch = _normalizeCh(r.ch); });
}

async function cleanChannelData() {
  _normalizeJurnalChannel();
  saveDB();
  // notif dihilangkan — proses berjalan diam-diam
}

function _applyCloudData(d) {
  if (d.produk)  DB.produk  = d.produk;
  if (d.stok)    DB.stok    = d.stok;
  if (d.jurnal)  DB.jurnal  = d.jurnal;
  if (d.restock) DB.restock = d.restock;
  if (d.channel) DB.channel = d.channel; // legacy fallback
  // Reload assignChannel dari produk_toko saat sync
  if (SUPABASE_URL) {
    _sbFetch(`${SUPABASE_URL}/rest/v1/produk_toko?select=var,toko_kode,aktif`)
      .then(r => r.ok ? r.json() : [])
      .then(rows => {
        if (rows && rows.length > 0) {
          DB.assignChannel = {};
          rows.forEach(r => {
            if (!DB.assignChannel[r.var]) DB.assignChannel[r.var] = {};
            DB.assignChannel[r.var][r.toko_kode] = r.aktif;
          });
        }
      }).catch(() => {});
  }
  setCloudStatus(true);
  const p = _currentPage;
  if      (p==='dashboard' && typeof renderDashboard==='function') renderDashboard();
  else if (p==='produk'    && typeof renderProduk   ==='function') renderProduk();
  else if (p==='stok'      && typeof renderStok     ==='function') renderStok();
  else if (p==='toko'      && typeof renderTokoManager==='function') renderTokoManager();
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

// ================================================================
// PAKSA SYNC — kirim semua data lokal (termasuk jurnal lama tanpa
// uuid) ke Supabase. Cukup dijalankan 1x dari laptop yang punya
// data lengkap di localStorage.
// ================================================================
async function paksaSync() {
  if (!SUPABASE_URL) { toast('Supabase belum dikonfigurasi', 'err'); return; }
  if (!confirm('⚠️ Paksa kirim SEMUA data dari perangkat ini ke Supabase?\n\nLakukan ini hanya dari laptop/device yang datanya PALING LENGKAP.\nData di Supabase akan di-overwrite.')) return;

  toast('⏳ Mengirim data ke cloud...', 'info');

  // Assign uuid ke semua jurnal yang belum punya
  let fixed = 0;
  DB.jurnal.forEach(j => {
    if (!j.uuid) { j.uuid = DataLayer._uuid(); fixed++; }
  });
  DB.restock.forEach(r => {
    if (!r.uuid) { r.uuid = DataLayer._uuid(); fixed++; }
  });
  if (fixed > 0) {
    DataLayer.saveLocal(DB);
    console.info(`[ZENOOT] Auto-assigned uuid ke ${fixed} record lama`);
  }

  const ok = await DataLayer.save(DB);
  if (ok) {
    toast(`✅ Paksa sync berhasil! ${DB.jurnal.length} jurnal, ${DB.restock.length} restock dikirim ke cloud.`);
    setCloudStatus(true);
  } else {
    toast('❌ Paksa sync gagal. Cek koneksi dan console.', 'err');
  }
}

async function resetDB() {
  if (!confirm('⚠️ RESET semua data? Data di cloud dan lokal akan HILANG!')) return;
  DB.produk=[];DB.stok=[];DB.jurnal=[];DB.restock=[];
  DataLayer.clearLocal();
  await pushToCloud(); location.reload();
}

function showLoadingOverlay(msg) {
  // Bersihkan safety timer sebelumnya jika ada
  if (window._loadingOverlayTimer) { clearTimeout(window._loadingOverlayTimer); window._loadingOverlayTimer = null; }
  let el = document.getElementById('cloud-loading');
  if (!el) {
    el = document.createElement('div'); el.id='cloud-loading';
    el.style.cssText='position:fixed;inset:0;background:rgba(28,28,30,0.7);z-index:999;display:flex;align-items:center;justify-content:center;';
    el.innerHTML=`<div style="background:white;border-radius:16px;padding:28px 36px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.3)"><div style="font-size:32px;margin-bottom:10px">☁️</div><div id="cloud-loading-msg" style="font-family:'Outfit',sans-serif;font-size:14px;color:#1C1C1E;font-weight:500">${msg}</div><div style="margin-top:12px;height:3px;width:180px;background:#E0D5C5;border-radius:3px;overflow:hidden"><div style="height:100%;width:0%;background:#5C3D2E;border-radius:3px;animation:loadbar 1.5s ease infinite"></div></div></div>`;
    document.body.appendChild(el);
    if (!document.getElementById('cloud-loading-style')) { const s=document.createElement('style');s.id='cloud-loading-style';s.textContent='@keyframes loadbar{0%{width:0%}60%{width:85%}100%{width:100%}}';document.head.appendChild(s); }
  } else { document.getElementById('cloud-loading-msg').textContent=msg; el.style.display='flex'; }
  // Safety timeout 12 detik — overlay PASTI hilang meski ada error tak terduga
  window._loadingOverlayTimer = setTimeout(() => { hideLoadingOverlay(); }, 12000);
}
function hideLoadingOverlay() {
  if (window._loadingOverlayTimer) { clearTimeout(window._loadingOverlayTimer); window._loadingOverlayTimer = null; }
  const el = document.getElementById('cloud-loading');
  if (el) el.style.display = 'none';
}

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
  stok: [],    // FIX: kosongkan — data stok diambil murni dari Supabase
  jurnal: [],  // FIX: kosongkan — tidak ada data dummy
  restock: [],
  channel: [
    // Channel diambil dari Supabase — tidak ada hardcode
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
  dashboard:'Dashboard <span>zenOt</span>',
  stok:'Stok <span>Produk</span>',
  restock:'Restock <span>&amp; Supplier</span>',
  jurnal:'Jurnal <span>Penjualan</span>',
  produk:'Kelola <span>Produk</span>',
  channel:'Channel <span>Penjualan</span>',
  harga:'Price <span>List</span>',
  'planning-ops':'Biaya <span>Operasional</span>',
  'biaya-ops-global':'Biaya <span>Operasional</span>',
  'planning-kpi':'Target <span>Omzet</span>',
  'laporan':'Laporan <span>Keuangan</span>',
  keuangan:'Laporan <span>Keuangan</span>',
  blueprint:'Blueprint <span>Strategi</span>',
  'analisis-upload':'Analisis <span>&amp; Proyeksi</span>',
  'analisis-blueprint':'AI <span>Blueprint</span>',
  'analisis-profit':'Profit <span>Guard</span>',
  daily:'Daily <span>Checklist</span>',
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
  if (id==='laporan')      { if (typeof renderLaporan==='function') renderLaporan(); }
  if (id==='planning-kpi') { if (typeof renderPlanningKPI==='function') renderPlanningKPI(); }
  if (id==='planning-ops') { if (typeof renderPlanningOps==='function') renderPlanningOps(); }
  if (id==='biaya-ops-global') { if (typeof renderBiayaOpsGlobal==='function') renderBiayaOpsGlobal(); }
  if (id==='daily') {
    if (typeof renderDailyChecklist === 'function') {
      renderDailyChecklist();
    } else {
      // daily_checklist.js belum selesai load — retry 300ms
      setTimeout(() => { if (typeof renderDailyChecklist === 'function') renderDailyChecklist(); }, 300);
    }
  }
  // Auto-close sidebar di mobile setelah navigasi
  if (window.innerWidth <= 900) {
    const sb = document.getElementById('sidebar');
    const ov = document.getElementById('sidebar-overlay');
    if (sb) sb.classList.remove('open');
    if (ov) ov.classList.remove('open');
  }
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
function _renderDashboardLegacy() {
  const totalStok  = DB.stok.reduce((s,r)=>s+getAkhir(r),0);
  const nilaiStok  = DB.stok.reduce((s,r)=>s+(getAkhir(r)*r.hpp),0);
  const totalRev   = DB.jurnal.reduce((s,r)=>s+(r.hpp*r.qty),0);
  const totalLaba  = DB.jurnal.reduce((s,r)=>s+((r.harga-r.hpp)*r.qty),0);
  const lowCount   = DB.stok.filter(r=>getAkhir(r)>0&&getAkhir(r)<=(r.safety||4)).length;
  const habisCount = DB.stok.filter(r=>getAkhir(r)<=0).length;

  // stat cards — lebih compact
  document.getElementById('stat-cards').innerHTML=`
    <div class="stat c1">
      <div class="stat-label">Total Stok Aktif</div>
      <div class="stat-val">${totalStok.toLocaleString('id-ID')} <span style="font-size:13px;font-weight:400">pcs</span></div>
      <div class="stat-sub">${DB.stok.length} SKU terdaftar</div>
    </div>
    <div class="stat c2">
      <div class="stat-label">Nilai Stok</div>
      <div class="stat-val" style="font-size:17px">${fmt(nilaiStok)}</div>
      <div class="stat-sub">berdasarkan HPP</div>
    </div>
    <div class="stat c3">
      <div class="stat-label">Omset</div>
      <div class="stat-val" style="font-size:17px">${fmt(totalRev)}</div>
      <div class="stat-sub">${DB.jurnal.length} transaksi</div>
    </div>
    <div class="stat c4">
      <div class="stat-label">Stok Kritis</div>
      <div class="stat-val">${lowCount+habisCount} <span style="font-size:13px;font-weight:400">SKU</span></div>
      <div class="stat-sub">${habisCount} habis · ${lowCount} rendah</div>
    </div>`;

  renderChartBars();
  renderNotif();
  renderProgress();
  renderLastSales();
  renderTopSKU();
  renderStokPerSupplier();
  renderWajibRestock();
  renderTargetPerChannel();
}

function renderChartBars() {
  const el=document.getElementById('chart-bars');
  if(!el) return;
  // Hitung omset aktual per channel dari jurnal bulan ini (HPP x qty)
  const bulanStr = new Date().getFullYear()+'-'+String(new Date().getMonth()+1).padStart(2,'0');
  const chMap={};
  DB.jurnal.filter(j=>(j.tgl||'').startsWith(bulanStr)).forEach(j=>{
    if(!j.ch) return;
    const prod=(DB.produk||[]).find(p=>(p.var||'').toUpperCase()===(j.var||'').toUpperCase());
    const val=(prod?prod.hpp||0:0)*(j.qty||0);
    chMap[j.ch]=(chMap[j.ch]||0)+val;
  });
  const sorted=Object.entries(chMap).sort((a,b)=>b[1]-a[1]);
  if(!sorted.length){
    el.innerHTML='<div style="color:var(--dusty);font-size:12px;padding:8px 0;">Belum ada penjualan bulan ini</div>';
    return;
  }
  const maxVal=sorted[0][1]||1;
  const totalVal=sorted.reduce((s,[,v])=>s+v,0);
  const fmtRp=v=>'Rp '+Number(Math.round(v)).toLocaleString('id-ID');
  el.style.cssText='display:flex;flex-direction:column;gap:8px;padding:4px 0;';
  el.innerHTML=sorted.map(([ch,val])=>{
    const barW=Math.round(val/maxVal*100);
    const share=totalVal>0?Math.round(val/totalVal*100):0;
    const cls=ch.toLowerCase().includes('laz')?'ch-l':ch.toLowerCase().includes('tt')?'ch-t':ch.toLowerCase().includes('shp')||ch.toLowerCase().includes('sho')?'ch-s':'ch-o';
    return `<div style="display:flex;align-items:center;gap:8px;">
      <span class="chtag ${cls}" style="min-width:95px;font-size:11px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${ch}</span>
      <div style="flex:1;height:8px;background:var(--cream);border-radius:99px;overflow:hidden;">
        <div style="height:100%;width:${barW}%;background:var(--brown);border-radius:99px;"></div>
      </div>
      <span style="font-size:12px;font-weight:700;color:var(--charcoal);min-width:100px;text-align:right;">${fmtRp(val)}</span>
      <span style="font-size:11px;color:var(--dusty);min-width:28px;">${share}%</span>
    </div>`;
  }).join('');
}

function renderNotif() {
  const criticals=DB.stok.filter(r=>getAkhir(r)<=0);
  const lows=DB.stok.filter(r=>getAkhir(r)>0&&getAkhir(r)<=(r.safety||4));
  let html='';
  criticals.slice(0,5).forEach(r=>{
    html+=`<div class="db-alert db-alert-red"><span>🚨</span><div><span class="db-alert-name">${r.var}</span> <span class="db-alert-msg">Stok HABIS</span></div></div>`;
  });
  lows.slice(0,5).forEach(r=>{
    html+=`<div class="db-alert db-alert-yellow"><span>⚠️</span><div><span class="db-alert-name">${r.var}</span> <span class="db-alert-msg">Sisa ${getAkhir(r)} pcs</span></div></div>`;
  });
  if (!html) html='<div class="db-alert db-alert-green"><span>✅</span><div>Semua stok aman!</div></div>';
  const el=document.getElementById('notif-area');
  if(el) el.innerHTML=html;
}

function renderProgress() {
  const yr=new Date().getFullYear(), mo=String(new Date().getMonth()+1).padStart(2,'0');
  const _plan=JSON.parse(localStorage.getItem(`zenot_planning_${yr}_${mo}`)||'{}');
  const targetPcs=_plan.targetProduksi||0;
  const targetRev=_plan.targetOmset||0;
  const totalKeluar=DB.stok.reduce((s,r)=>s+(r.keluar||0),0);
  const totalRev=DB.jurnal.reduce((s,r)=>s+(r.hpp*r.qty),0);
  const pctPcs=targetPcs>0?Math.min(100,Math.round(totalKeluar/targetPcs*100)):0;
  const pctRev=targetRev>0?Math.min(100,Math.round(totalRev/targetRev*100)):0;
  const bar=(pct,color)=>`<div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;margin-top:4px;"><div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width .6s;"></div></div>`;
  const el=document.getElementById('progress-area');
  if(el) el.innerHTML=`
    <div class="db-prog-row">
      <div class="db-prog-label"><span>📦 Volume Produksi</span><span class="db-prog-val">${totalKeluar}/${targetPcs||'—'} pcs</span></div>
      ${bar(pctPcs,'var(--brown)')}
      <div class="db-prog-pct">${pctPcs}%</div>
    </div>
    <div class="db-prog-row" style="margin-top:10px;">
      <div class="db-prog-label"><span>💰 Target Revenue</span><span class="db-prog-val">${fmt(totalRev)}</span></div>
      ${bar(pctRev,'var(--sage)')}
      <div class="db-prog-pct">${pctRev}%</div>
    </div>`;
}

function renderLastSales() {
  const el=document.getElementById('last-sales');
  if(!el) return;
  const recent=DB.jurnal.slice(0,6);
  if (!recent.length) { el.innerHTML='<div style="color:var(--dusty);font-size:12px;padding:8px 0;">Belum ada transaksi</div>'; return; }
  el.innerHTML=recent.map(r=>`
    <div class="db-sale-row">
      <div class="db-sale-info">
        <div class="db-sale-name">${r.var}</div>
        <div class="db-sale-meta">${r.tgl} · ${chTag(r.ch)}</div>
      </div>
      <div class="db-sale-qty">${r.qty}x</div>
    </div>`).join('');
}

// ── WIDGET BARU 1: Top 5 SKU Terlaris ──────────────────────────
function renderTopSKU() {
  const el=document.getElementById('db-top-sku');
  if(!el) return;
  // Agregasi qty per SKU dari jurnal
  const map={};
  DB.jurnal.forEach(r=>{ map[r.var]=(map[r.var]||0)+r.qty; });
  const top=Object.entries(map).sort((a,b)=>b[1]-a[1]).slice(0,5);
  if(!top.length){ el.innerHTML='<div style="color:var(--dusty);font-size:12px;padding:8px 0;">Belum ada data jurnal</div>'; return; }
  const maxQ=top[0][1]||1;
  const colors=['#5C3D2E','#5A7A6A','#C9A84C','#C0392B','#3D7EAA'];
  el.innerHTML=top.map(([sku,qty],i)=>`
    <div class="db-rank-row">
      <div class="db-rank-num" style="background:${colors[i]};color:#fff;">${i+1}</div>
      <div class="db-rank-info">
        <div class="db-rank-name">${sku}</div>
        <div class="db-rank-bar-wrap"><div class="db-rank-bar" style="width:${Math.round(qty/maxQ*100)}%;background:${colors[i]};"></div></div>
      </div>
      <div class="db-rank-qty">${qty} <span style="font-size:9px;color:var(--dusty)">pcs</span></div>
    </div>`).join('');
}

// ── WIDGET BARU 2: Stok per Supplier ───────────────────────────
function renderStokPerSupplier() {
  const el=document.getElementById('db-stok-supplier');
  if(!el) return;
  // Gabungkan DB.stok dengan DB.produk untuk dapat supplier
  const supMap={};
  DB.stok.forEach(r=>{
    const p=DB.produk.find(x=>(x.var||'').toUpperCase()===(r.var||'').toUpperCase());
    const sup=(p&&p.suplaier)||'Lainnya';
    if(!supMap[sup]) supMap[sup]={stok:0,sku:0,nilai:0};
    supMap[sup].stok+=getAkhir(r);
    supMap[sup].sku+=1;
    supMap[sup].nilai+=(getAkhir(r)*r.hpp);
  });
  const sorted=Object.entries(supMap).sort((a,b)=>b[1].stok-a[1].stok).slice(0,6);
  if(!sorted.length){ el.innerHTML='<div style="color:var(--dusty);font-size:12px;padding:8px 0;">Belum ada data</div>'; return; }
  el.innerHTML=`
    <table class="db-sup-table">
      <thead><tr><th>Supplier</th><th>SKU</th><th>Stok</th><th>Nilai</th></tr></thead>
      <tbody>
        ${sorted.map(([sup,d])=>`
          <tr>
            <td class="db-sup-name">${sup}</td>
            <td class="db-sup-num">${d.sku}</td>
            <td class="db-sup-num">${d.stok.toLocaleString('id-ID')}</td>
            <td class="db-sup-num">${fmt(d.nilai)}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── WIDGET BARU 3: Produk WAJIB Restock ────────────────────────
// Kriteria: stok rendah/habis DAN ada di jurnal (pernah terjual)
function renderWajibRestock() {
  const el=document.getElementById('db-wajib-restock');
  if(!el) return;
  // Hitung total terjual per SKU dari jurnal
  const soldMap={};
  DB.jurnal.forEach(r=>{ soldMap[r.var]=(soldMap[r.var]||0)+r.qty; });
  // Filter: stok <= safety DAN pernah terjual, urutkan by (terjual desc)
  const list=DB.stok
    .filter(r=> getAkhir(r)<=(r.safety||4) && soldMap[r.var])
    .map(r=>({
      var:r.var,
      akhir:getAkhir(r),
      safety:r.safety||4,
      terjual:soldMap[r.var]||0,
      hpp:r.hpp||0
    }))
    .sort((a,b)=>b.terjual-a.terjual)
    .slice(0,7);
  if(!list.length){
    el.innerHTML='<div style="color:var(--dusty);font-size:12px;padding:8px 0;">✅ Tidak ada produk yang perlu restock</div>';
    return;
  }
  el.innerHTML=list.map(r=>{
    const isHabis=r.akhir<=0;
    const badge=isHabis
      ? `<span class="db-rs-badge db-rs-habis">HABIS</span>`
      : `<span class="db-rs-badge db-rs-rendah">Sisa ${r.akhir}</span>`;
    return `
      <div class="db-rs-row">
        <div class="db-rs-info">
          <div class="db-rs-name">${r.var}</div>
          <div class="db-rs-meta">Terjual <b>${r.terjual} pcs</b> · Safety ${r.safety}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          ${badge}
        </div>
      </div>`;
  }).join('');
}

// ── WIDGET BARU 4: Target Omzet vs Aktual per Channel ──────────
function renderTargetPerChannel() {
  const el=document.getElementById('db-target-channel');
  if(!el) return;
  const channels=(window._tokoList&&window._tokoList.length>0)
    ? window._tokoList
    : (typeof DB!=='undefined'?DB.channel||[]:[]).filter(c=>c.nama!=='__assign__');
  if(!channels.length){ el.innerHTML='<div style="color:var(--dusty);font-size:12px;padding:8px 0;">Belum ada channel</div>'; return; }

  // Hitung omset aktual per channel dari jurnal
  const aktualMap={};
  DB.jurnal.forEach(r=>{ aktualMap[r.ch]=(aktualMap[r.ch]||0)+(r.hpp*r.qty); });

  const rows=channels.map(ch=>{
    const chNama=ch.kode||ch.nama;
    // Load target dari PLAN localStorage
    const yr=new Date().getFullYear(), mo=String(new Date().getMonth()+1).padStart(2,'0');
    let target=0;
    try {
      const key=`zenot_plan_${chNama}_${yr}-${mo}`;
      const d=JSON.parse(localStorage.getItem(key)||'{}');
      target=d.targetOmset||0;
    } catch(e){}
    const aktual=aktualMap[chNama]||0;
    const pct=target>0?Math.min(100,Math.round(aktual/target*100)):0;
    const pStyle=typeof _platformStyle==='function'?_platformStyle(ch.platform||'lainnya'):{bg:'#8C7B6B',color:'#fff'};
    const barColor=pct>=100?'#16a34a':pct>=60?'var(--sage)':pct>=30?'var(--gold)':'var(--rust)';
    return `
      <div class="db-ch-row">
        <div class="db-ch-head">
          <span class="db-ch-badge" style="background:${pStyle.bg};color:${pStyle.color};">${ch.platform||'lainnya'}</span>
          <span class="db-ch-name">${chNama}</span>
          <span class="db-ch-pct" style="color:${barColor};">${pct}%</span>
        </div>
        <div class="db-ch-bar-wrap">
          <div class="db-ch-bar" style="width:${pct}%;background:${barColor};"></div>
        </div>
        <div class="db-ch-nums">
          <span>${fmt(aktual)}</span>
          <span style="color:var(--dusty);">/ ${target>0?fmt(target):'— target'}</span>
        </div>
      </div>`;
  }).join('');
  el.innerHTML=rows;
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
  // Update sort arrow Shopee style
  const arrowEl = document.getElementById('sort-arrow-akhir');
  if (arrowEl) arrowEl.textContent = _stokSortCol==='akhir' ? (_stokSortDir===1 ? '▲' : '▼') : '↕';
  document.getElementById('stok-body').innerHTML=rows.length?rows.map((r,i)=>{
    const akhir=getAkhir(r), induk=getIndukOf(r.var);
    const p=DB.produk.find(x=>x.var===r.var);
    return `<tr>
      <td class="mono">${i+1}</td>
      <td><strong>${induk}</strong></td>
      <td>${r.var}</td>
      <td>${stokStatus(akhir,r.safety||4)}</td>
      <td class="mono" style="text-align:center;font-weight:700">${akhir}</td>
      <td class="mono" style="text-align:center">${r.awal||0}</td>
      <td class="mono" style="text-align:center;color:var(--sage)">${r.masuk||0}</td>
      <td class="mono" style="text-align:center;color:var(--brown)">${r.keluar||0}</td>
      <td class="mono">${fmt(r.hpp)}</td>
      <td class="mono">${fmt(akhir*r.hpp)}</td>
      <td style="font-size:11px;color:var(--dusty)">${p?p.suplaier||'—':'—'}</td>
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
  DB.stok[idx]={...DB.stok[idx],
    awal:+document.getElementById('es-awal').value||0,
    hpp:+document.getElementById('es-hpp').value||0,
    safety:+document.getElementById('es-safety').value||4
  };
  recalcStok();
  closeModal('modal-edit-stok'); saveDB(); renderStok(); renderDashboard(); toast('Stok diperbarui!');
}
function hapusStok(idx) {
  if (!confirm(`Hapus stok "${DB.stok[idx]?.var}"?`)) return;
  DB.stok.splice(idx,1); saveDB(); renderStok(); toast('Stok dihapus');
}

// ================================================================
// RESTOCK
// ================================================================
// ════════════════════════════════════════════════════════
// PIN MANAGER — Custom Menu Utama
// ════════════════════════════════════════════════════════
const PIN_KEY = 'zenot_pinned_menu';
const PIN_MAX = 6;

const ALL_MENUS = [
  { id:'dashboard',     label:'Dashboard',          cat:'Utama',           svgPath:'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  { id:'produk',        label:'Kelola Produk',       cat:'Inventori',       svgPath:'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01' },
  { id:'stok',          label:'Stok Produk',         cat:'Inventori',       svgPath:'M2 3h20v14H2zM8 21h8M12 17v4' },
  { id:'restock',       label:'Restock & Supplier',  cat:'Inventori',       svgPath:'M23 4 23 10 17 10M1 20 1 14 7 14M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15' },
  { id:'harga',         label:'Price List',          cat:'Inventori',       svgPath:'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6' },
  { id:'planning-ops',  label:'Biaya Operasional',   cat:'Database Toko',   svgPath:'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10' },
  { id:'biaya-ops-global', label:'Biaya Operasional', cat:'Keuangan Operasional', svgPath:'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10' },
  { id:'planning-kpi',  label:'Target Omzet',        cat:'Database Toko',   svgPath:'M22 12 18 12 15 21 9 3 6 12 2 12' },
  { id:'laporan',       label:'Laporan Keuangan',    cat:'Keuangan',        svgPath:'M18 20V10M12 20V4M6 20v-6' },
  { id:'jurnal',        label:'Jurnal Penjualan',    cat:'Penjualan',       svgPath:'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8' },
  { id:'channel',       label:'Channel',             cat:'Database Toko',   svgPath:'M2 2h8v8H2zM14 2h8v8h-8zM2 14h8v8H2zM14 14h8v8h-8z' },
  { id:'intel',         label:'Overview Toko',       cat:'Dashboard Toko',  svgPath:'M22 12 18 12 15 21 9 3 6 12 2 12' },
  { id:'daily',         label:'Daily Checklist',     cat:'Tools',           svgPath:'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11' },
];

const DEFAULT_PINS = ['dashboard','jurnal','stok','daily','channel','restock'];

function getPins() {
  try { return JSON.parse(localStorage.getItem(PIN_KEY)) || DEFAULT_PINS; } catch(e) { return DEFAULT_PINS; }
}
function savePins() {
  const checked = [...document.querySelectorAll('.pin-item.selected')].map(el=>el.dataset.id);
  if (checked.length === 0) { toast('⚠️ Pilih minimal 1 fitur!'); return; }
  localStorage.setItem(PIN_KEY, JSON.stringify(checked));
  closeModal('modal-pin-manager');
  renderNavUtama();
  toast('✅ Menu Utama diperbarui!');
}

function renderNavUtama() {
  const pins = getPins();
  const wrap = document.getElementById('nav-utama-pins');
  if (!wrap) return;
  wrap.innerHTML = pins.map(id => {
    const m = ALL_MENUS.find(x=>x.id===id);
    if (!m) return '';
    const onclick = id === 'intel'
      ? `goIntelFromSidebar('intel-dashboard',this)`
      : `go('${id}',this)`;
    return `<div class="nav-item" onclick="${onclick}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${m.svgPath}"/></svg>
      <span>${m.label}</span>
    </div>`;
  }).join('');
}

function openPinManager() {
  const pins = getPins();
  const list = document.getElementById('pin-manager-list');
  if (!list) return;
  list.innerHTML = `
    <div class="pin-max-warn" id="pin-warn">Maksimal ${PIN_MAX} fitur!</div>
    ${ALL_MENUS.map(m => `
    <div class="pin-item ${pins.includes(m.id)?'selected':''}" data-id="${m.id}" onclick="togglePin(this)">
      <div class="pin-item-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--brown)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${m.svgPath}"/></svg>
      </div>
      <div>
        <div class="pin-item-name">${m.label}</div>
        <div class="pin-item-cat">${m.cat}</div>
      </div>
      <div class="pin-item-check">
        ${pins.includes(m.id) ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
      </div>
    </div>`).join('')}
  `;
  openModal('modal-pin-manager');
}

function togglePin(el) {
  const selected = document.querySelectorAll('.pin-item.selected');
  const isSelected = el.classList.contains('selected');
  if (!isSelected && selected.length >= PIN_MAX) {
    const warn = document.getElementById('pin-warn');
    if (warn) { warn.style.display='block'; setTimeout(()=>warn.style.display='none',2000); }
    return;
  }
  el.classList.toggle('selected');
  const check = el.querySelector('.pin-item-check');
  if (el.classList.contains('selected')) {
    check.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  } else {
    check.innerHTML = '';
  }
}


// ════════════════════════════════════════════════════════
function _syncAllDropdowns() {
  // Supplier list dari DB.produk
  const suppliers = [...new Set((DB.produk||[]).map(p=>p.suplaier||'').filter(Boolean))].sort();
  const supplierOpts = suppliers.map(s=>`<option value="${s}">${s}</option>`).join('');

  // Channel list dari DB.channel
  const channels = window._tokoList.map(t=>t.kode);
  const channelOpts = channels.map(c=>`<option value="${c}">${c}</option>`).join('');

  // Populate semua supplier dropdown
  ['rs-supplier','rq-supplier','bulk-sup-val'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = `<option value="">— Pilih Supplier —</option>${supplierOpts}`;
    if (cur) el.value = cur;
  });

  // Populate semua channel dropdown
  ['ej-ch'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const cur = el.value;
    el.innerHTML = channelOpts;
    if (cur) el.value = cur;
  });
}

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
function populateRqVariasi() {
  const induk = document.getElementById("rq-induk").value;
  document.getElementById("rq-variasi").innerHTML = DB.produk.filter(p=>p.induk===induk).map(p=>`<option>${p.var}</option>`).join("");
  autoFillRqSupplier();
}
function autoFillRqSupplier() {
  const varName = document.getElementById("rq-variasi").value;
  const produk = DB.produk.find(p => p.var === varName);
  const supEl = document.getElementById("rq-supplier");
  if (produk && produk.suplaier && supEl) { supEl.value = produk.suplaier; }
}

function inputRestock() {
  const varName=document.getElementById('rs-sku-variasi').value;
  const qty=+document.getElementById('rs-qty').value||0;
  const catatan=document.getElementById('rs-catatan').value;
  const tgl=document.getElementById('rs-tgl').value;
  const supplier=document.getElementById('rs-supplier').value;
  if (!varName||qty<=0) { toast('Lengkapi SKU dan Qty','err'); return; }
  if (!DB.stok.find(x=>x.var===varName)) {
    const p=DB.produk.find(x=>x.var===varName);
    DB.stok.push({var:varName,awal:0,masuk:0,keluar:0,hpp:p?p.hpp:0,safety:4});
  }
  DB.restock.unshift({uuid: DataLayer._uuid(), tgl, var:varName, supplier, qty, catatan});
  recalcStok();
  document.getElementById('rs-qty').value='';
  document.getElementById('rs-catatan').value='';
  saveDB(); renderRestock(); renderLowStock(); renderDashboard();
  toast(`✅ ${qty} pcs ${varName} masuk dari ${supplier}`);
}

function inputRestockQuick() {
  const varName=document.getElementById('rq-variasi').value;
  const qty=+document.getElementById('rq-qty').value||0;
  const supplier=document.getElementById('rq-supplier').value;
  const tgl=_localDateStr(new Date());
  if (!varName||qty<=0) { toast('Lengkapi SKU dan Qty','err'); return; }
  if (!DB.stok.find(x=>x.var===varName)) {
    const p=DB.produk.find(x=>x.var===varName);
    DB.stok.push({var:varName,awal:0,masuk:0,keluar:0,hpp:p?p.hpp:0,safety:4});
  }
  DB.restock.unshift({uuid: DataLayer._uuid(), tgl, var:varName, supplier, qty, catatan:'Quick input'});
  recalcStok();
  document.getElementById('rq-qty').value='';
  closeModal('modal-restock-quick');
  saveDB(); renderRestock(); renderLowStock(); renderDashboard();
  toast(`✅ ${qty} pcs ${varName} masuk!`);
}

function deleteRestock(idx) {
  const r=DB.restock[idx]; if(!confirm(`Hapus restock "${r?.var}"?`))return;
  const uuid=r?.uuid;
  const sid=r?.sid;
  DB.restock.splice(idx,1);
  recalcStok();
  if (SUPABASE_URL) {
    if (uuid) {
      DataLayer._deleteByKey('restock','uuid',uuid).catch(e=>console.warn('Delete restock by uuid gagal:',e));
    } else if (sid) {
      DataLayer._deleteByKey('restock','id',sid).catch(e=>console.warn('Delete restock by id gagal:',e));
    } else { saveDB(); }
  }
  saveDB(); renderRestock(); renderDashboard(); toast('✅ Log restock dihapus');
}

function renderRestock() {
  document.getElementById('restock-body').innerHTML=DB.restock.length?DB.restock.map((r,i)=>`<tr>
    <td class="mono">${r.tgl}</td><td>${r.var}</td>
    <td style="font-size:11px">${r.supplier||'—'}</td>
    <td class="mono" style="text-align:center;color:var(--sage);font-weight:600">+${r.qty}</td>
    <td style="font-size:12px;color:var(--dusty)">${r.catatan||'—'}</td>
    <td style="display:flex;gap:4px;">
      <button class="btn btn-o btn-sm" onclick="editRestock(${i})">✏️</button>
      <button class="btn btn-d btn-sm" onclick="deleteRestock(${i})">🗑</button>
    </td>
  </tr>`).join(''):`<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--dusty)">Belum ada log restock</td></tr>`;
}

function editRestock(i) {
  const r = DB.restock[i];
  if (!r) return;
  // Buat modal edit sederhana
  let modal = document.getElementById('modal-edit-restock');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'modal-edit-restock';
    modal.className = 'overlay';
    modal.innerHTML = `<div class="modal" style="max-width:400px;width:90%">
      <div class="modal-hd">Edit Log Restock <button class="modal-close" onclick="closeModal('modal-edit-restock')">×</button></div>
      <div class="modal-bd">
        <div class="fg"><label class="lbl">SKU Variasi</label><input class="inp" id="er-var" readonly style="background:var(--cream);color:var(--dusty)"></div>
        <div class="fg"><label class="lbl">Tanggal</label><input class="inp" type="date" id="er-tgl"></div>
        <div class="form-row">
          <div class="fg"><label class="lbl">Jumlah Masuk</label><input class="inp" type="number" id="er-qty" min="1"></div>
          <div class="fg"><label class="lbl">Supplier</label><select class="sel" id="er-supplier"></select></div>
        </div>
        <button class="btn btn-p btn-full" onclick="saveEditRestock()">💾 Simpan</button>
      </div>
    </div>`;
    document.body.appendChild(modal);
    document.querySelector('#modal-edit-restock').addEventListener('click', e => { if(e.target===modal) closeModal('modal-edit-restock'); });
  }
  document.getElementById('er-var').value = r.var;
  document.getElementById('er-tgl').value = r.tgl;
  document.getElementById('er-qty').value = r.qty;
  // Populate supplier
  const supOpts = window._tokoList.map(t=>`<option>${t.kode}</option>`).join('');
  document.getElementById('er-supplier').innerHTML = `<option value="">— Pilih Supplier —</option>${supOpts}`;
  if (r.supplier) document.getElementById('er-supplier').value = r.supplier;
  modal._editIdx = i;
  openModal('modal-edit-restock');
}

function saveEditRestock() {
  const modal = document.getElementById('modal-edit-restock');
  const i = modal._editIdx;
  const r = DB.restock[i];
  if (!r) return;
  const qty = parseInt(document.getElementById('er-qty').value)||0;
  if (qty <= 0) { toast('Jumlah harus lebih dari 0','err'); return; }
  r.tgl = document.getElementById('er-tgl').value;
  r.qty = qty;
  r.supplier = document.getElementById('er-supplier').value;
  recalcStok(); saveDB(); renderStok(); renderRestock(); renderDashboard();
  closeModal('modal-edit-restock');
  toast('✅ Log restock diperbarui!');
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
  // Isi channel dropdown dulu
  const allChannels = window._tokoList.map(t=>t.kode).sort();
  const chEl = document.getElementById('j-ch');
  if (chEl) {
    const curCh = chEl.value;
    chEl.innerHTML = allChannels.map(c=>`<option>${c}</option>`).join('');
    if (allChannels.includes(curCh)) chEl.value = curCh;
  }
  // Filter SKU Induk berdasarkan channel yang dipilih
  onJChChange();
}

// Saat channel berubah → filter SKU Induk yang dijual di channel itu
function onJChChange() {
  const chEl = document.getElementById('j-ch');
  const chNama = _normalizeCh(chEl ? chEl.value : '');
  const indukEl = document.getElementById('j-sku-induk');
  if (!indukEl) return;

  // Filter produk berdasarkan DB.assignChannel (dari tabel produk_toko)
  // DB.assignChannel = { var: { toko_kode: aktif } }
  const assignCh = DB.assignChannel || {};

  const indukList = [...new Set(DB.produk
    .filter(p => {
      if ((p.status_produk||'aktif') === 'arsip') return false;
      // Jika tidak ada data assignChannel sama sekali → tampilkan semua produk
      if (Object.keys(assignCh).length === 0) return true;
      // Cek apakah SKU ini di-assign ke channel yang dipilih
      const varAssign = assignCh[p.var];
      if (!varAssign) return true; // SKU belum diassign → tampilkan di semua channel
      return varAssign[chNama] === true || varAssign[chNama] === 1;
    })
    .map(p=>p.induk)
  )].sort();

  indukEl.innerHTML = indukList.length
    ? indukList.map(s=>`<option>${s}</option>`).join('')
    : '<option value="">— Belum ada produk di channel ini —</option>';
  onJIndukChange();
}

function _normalizeCh(s){ return (s||'').trim().replace(/\.\s+/g,'.').toUpperCase(); }

// Cascade: pilih induk → filter variasi saja (channel sudah difilter duluan via onJChChange)
function onJIndukChange() {
  const induk = document.getElementById('j-sku-induk')?.value;
  if (!induk) return;

  // Update variasi dropdown
  const varEl = document.getElementById('j-sku-variasi');
  if (varEl) {
    const produkInduk = DB.produk.filter(p=>p.induk===induk && (p.status_produk||'aktif')!=='arsip');
    varEl.innerHTML = produkInduk.map(p=>`<option>${p.var}</option>`).join('');
  }
}

function _syncChannelDropdowns() {
  // Untuk edit jurnal — tetap tampilkan semua channel
  const channels = window._tokoList.map(t=>t.kode).sort();
  const opts = channels.map(c=>`<option>${c}</option>`).join('');
  ['ej-ch'].forEach(id=>{
    const el=document.getElementById(id); if(!el)return;
    const cur=el.value;
    el.innerHTML=opts;
    if([...el.options].find(o=>o.value===cur)) el.value=cur;
  });
}

function populateJVariasi() {
  const induk=document.getElementById('j-sku-induk')?.value;
  const varEl=document.getElementById('j-sku-variasi');
  if(varEl && induk) varEl.innerHTML=DB.produk
    .filter(p=>p.induk===induk&&(p.status_produk||'aktif')!=='arsip')
    .map(p=>`<option>${p.var}</option>`).join('');
  onJVariasiChange(); // auto-fill harga saat induk berubah
}

// Auto-fill harga jual saat variasi dipilih
function onJVariasiChange() {
  const varName=document.getElementById('j-sku-variasi')?.value;
  const hargaEl=document.getElementById('j-harga');
  if (!hargaEl || !varName) return;
  const p=DB.produk.find(x=>x.var===varName);
  if (p && p.jual>0) hargaEl.value=p.jual;
  else if (p && p.hpp>0) hargaEl.value=p.hpp;
}

function addJurnal() {
  const tgl=document.getElementById('j-tgl').value;
  const ch=document.getElementById('j-ch').value;
  const varName=document.getElementById('j-sku-variasi').value;
  const qty=+document.getElementById('j-qty').value||0;
  if (!tgl||!varName||qty<=0) { toast('Lengkapi Tanggal, SKU, dan Qty','err'); return; }
  const p=DB.produk.find(x=>x.var===varName);
  const hpp=p?p.hpp:0;
  // FIX: ambil harga dari field — fallback ke price list (p.jual), terakhir baru 0
  const hargaInput=+document.getElementById('j-harga')?.value||0;
  const harga=hargaInput>0 ? hargaInput : (p&&p.jual>0 ? p.jual : hpp);
  DB.jurnal.unshift({uuid: DataLayer._uuid(), tgl, ch, var:varName, qty, harga, hpp});
  if (!DB.stok.find(x=>x.var===varName)) DB.stok.push({var:varName,awal:0,masuk:0,keluar:0,hpp,safety:4});
  recalcStok();
  document.getElementById('j-qty').value='';
  const hargaEl=document.getElementById('j-harga'); if(hargaEl) hargaEl.value='';
  closeModal('modal-tambah-jurnal'); saveDB(); renderJurnal(); renderStok(); renderDashboard();
  toast(`✅ ${qty} pcs ${varName} @ ${fmt(harga)} disimpan!`);
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
  // SINGLE SOURCE: hanya dari DB.channel (Supabase)
  const channels=window._tokoList.map(t=>t.kode).sort();
  sel.innerHTML='<option value="">Semua Channel</option>'+channels.map(c=>`<option>${c}</option>`).join('');
  if(cur)sel.value=cur;
}

function renderJurnal() {
  _populateJurnalChannelFilter();
  // Render target global di bawah tabel
  if (typeof renderJurnalTargetGlobal === 'function') renderJurnalTargetGlobal();
  const q=jurnalQ.toLowerCase();
  const rows=DB.jurnal.filter(r=>{
    if(q && !r.var.toLowerCase().includes(q) && !r.ch.toLowerCase().includes(q)) return false;
    if(jurnalChFil && _normalizeCh(r.ch) !== _normalizeCh(jurnalChFil)) return false;
    if(jurnalDateFrom && r.tgl < jurnalDateFrom) return false;
    if(jurnalDateTo && r.tgl > jurnalDateTo) return false;
    return true;
  // Urutkan: terbaru di atas (tgl DESC, lalu sid DESC untuk transaksi sama hari)
  }).sort((a,b)=>{
    if(b.tgl > a.tgl) return 1;
    if(b.tgl < a.tgl) return -1;
    return (b.sid||0)-(a.sid||0);
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
  // Render target global di bawah tabel
  renderJurnalTargetGlobal();
}

// ── Target Global Bulan Ini — di bawah Jurnal Penjualan ────────────────
function renderJurnalTargetGlobal() {
  const el = document.getElementById('jurnal-target-global');
  if (!el) return;

  const yr = new Date().getFullYear();
  const mo = String(new Date().getMonth()+1).padStart(2,'0');
  const bulanKey = yr + '-' + mo;

  // Load dari PLAN (Supabase-aware, fallback localStorage)
  let plan = {};
  try {
    if (typeof PLAN !== 'undefined' && PLAN.loadSync) {
      plan = PLAN.loadSync('global', bulanKey) || {};
    } else {
      plan = JSON.parse(localStorage.getItem('zenot_planning_' + yr + '_' + mo) || '{}');
    }
  } catch(e) {}

  const targetOmset = plan.targetOmset || 0;
  const targetPcs   = plan.targetProduksi || 0;

  // Hitung aktual dari jurnal bulan ini (HPP x qty)
  const bulanStr = yr + '-' + mo;
  const jBulan = DB.jurnal.filter(j => (j.tgl||'').startsWith(bulanStr));
  const aktualOmset = jBulan.reduce((s,j) => {
    const p = (DB.produk||[]).find(x => (x.var||'').toUpperCase() === (j.var||'').toUpperCase());
    return s + (p ? (p.hpp||0) : 0) * (j.qty||0);
  }, 0);
  const aktualPcs = jBulan.reduce((s,j) => s + (j.qty||0), 0);
  const aktualTrx = jBulan.length;

  const daysInMonth = new Date(yr, new Date().getMonth()+1, 0).getDate();
  const dayNow = new Date().getDate();
  const daysLeft = daysInMonth - dayNow;
  const pctOmset = targetOmset > 0 ? Math.min(100, Math.round(aktualOmset/targetOmset*100)) : 0;
  const pctPcs   = targetPcs   > 0 ? Math.min(100, Math.round(aktualPcs/targetPcs*100))     : 0;
  const sisaOmset = Math.max(0, targetOmset - aktualOmset);
  const perHari   = daysLeft > 0 && sisaOmset > 0 ? Math.round(sisaOmset/daysLeft) : 0;

  const fmtRp = v => 'Rp ' + Number(Math.round(v)).toLocaleString('id-ID');
  const pctColor = p => p>=80?'#16a34a':p>=50?'#D97706':'#C0392B';
  const progressBar = (pct, color) =>
    '<div style="height:8px;background:var(--cream);border-radius:99px;overflow:hidden;margin:6px 0 3px;">' +
    '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:99px;transition:width .6s;"></div></div>';

  if (!targetOmset && !targetPcs) {
    el.innerHTML =
      '<div style="text-align:center;padding:18px;background:var(--cream);border-radius:10px;font-size:13px;color:var(--dusty);">' +
      'Target bulan ini belum diset.<br>' +
      '<a href="#" onclick="try{go(\'planning-kpi\',null)}catch(e){}" style="color:var(--brown);font-weight:700;margin-top:4px;display:inline-block;">→ Set Target di Perencanaan</a>' +
      '</div>';
    return;
  }

  el.innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">' +
      // Omset card
      '<div style="background:var(--cream);border-radius:12px;padding:14px 16px;">' +
        '<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--dusty);font-weight:700;margin-bottom:4px;">Omset vs Target</div>' +
        '<div style="font-size:20px;font-weight:800;color:var(--charcoal);">' + fmtRp(aktualOmset) + '</div>' +
        '<div style="font-size:11px;color:var(--dusty);margin-bottom:2px;">dari target ' + (targetOmset>0?fmtRp(targetOmset):'—') + '</div>' +
        (targetOmset>0 ? progressBar(pctOmset, pctColor(pctOmset)) : '') +
        (targetOmset>0 ?
          '<div style="display:flex;justify-content:space-between;font-size:11px;margin-top:2px;">' +
          '<b style="color:' + pctColor(pctOmset) + '">' + pctOmset + '% tercapai</b>' +
          '<span style="color:var(--dusty)">' + daysLeft + ' hari tersisa</span></div>' : '') +
      '</div>' +
      // Volume card
      '<div style="background:var(--cream);border-radius:12px;padding:14px 16px;">' +
        '<div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:var(--dusty);font-weight:700;margin-bottom:4px;">Volume Produksi</div>' +
        '<div style="font-size:20px;font-weight:800;color:var(--charcoal);">' + aktualPcs.toLocaleString('id-ID') + ' <span style="font-size:13px;font-weight:400">pcs</span></div>' +
        '<div style="font-size:11px;color:var(--dusty);margin-bottom:2px;">dari target ' + (targetPcs>0?targetPcs.toLocaleString('id-ID')+' pcs':'—') + '</div>' +
        (targetPcs>0 ? progressBar(pctPcs, pctColor(pctPcs)) : '') +
        (targetPcs>0 ? '<div style="font-size:11px;margin-top:2px;"><b style="color:' + pctColor(pctPcs) + '">' + pctPcs + '% tercapai</b></div>' : '') +
      '</div>' +
    '</div>' +
    // Stats bawah
    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">' +
      '<div style="text-align:center;padding:10px;background:var(--cream);border-radius:10px;">' +
        '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--dusty);font-weight:700;">Transaksi</div>' +
        '<div style="font-size:18px;font-weight:800;color:var(--charcoal);margin-top:2px;">' + aktualTrx + '</div>' +
      '</div>' +
      '<div style="text-align:center;padding:10px;background:var(--cream);border-radius:10px;">' +
        '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--dusty);font-weight:700;">Sisa Target</div>' +
        '<div style="font-size:15px;font-weight:800;color:' + (sisaOmset>0?'#C0392B':'#16a34a') + ';margin-top:2px;">' + (sisaOmset>0?fmtRp(sisaOmset):'🎉 Done!') + '</div>' +
      '</div>' +
      '<div style="text-align:center;padding:10px;background:var(--cream);border-radius:10px;">' +
        '<div style="font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:var(--dusty);font-weight:700;">Perlu/Hari</div>' +
        '<div style="font-size:15px;font-weight:800;color:' + (perHari>0?'#D97706':'#16a34a') + ';margin-top:2px;">' + (perHari>0?fmtRp(perHari):'✅') + '</div>' +
      '</div>' +
    '</div>';
}

function openEditJurnal(idx) {
  const r = DB.jurnal[idx];

  // Populate channel dropdown dari DB.channel
  const chSel = document.getElementById('ej-ch');
  if (chSel) {
    const channels = window._tokoList.map(t=>t.kode);
    chSel.innerHTML = channels.map(c=>`<option value="${c}" ${r.ch===c?'selected':''}>${c}</option>`).join('');
  }

  // Populate induk dropdown
  const indukList = [...new Set((DB.produk||[]).map(p=>p.induk))].sort();
  const currentInduk = (DB.produk||[]).find(p=>p.var===r.var)?.induk || indukList[0];
  const indukSel = document.getElementById('ej-induk');
  if (indukSel) {
    indukSel.innerHTML = indukList.map(i=>`<option value="${i}" ${i===currentInduk?'selected':''}>${i}</option>`).join('');
  }

  // Populate variasi dropdown berdasarkan induk
  const varList = (DB.produk||[]).filter(p=>p.induk===currentInduk);
  const skuSel = document.getElementById('ej-sku');
  if (skuSel) {
    skuSel.innerHTML = varList.map(p=>`<option value="${p.var}" ${p.var===r.var?'selected':''}>${p.var}</option>`).join('');
  }

  // Set field lainnya
  const set = (id, val) => { const el=document.getElementById(id); if(el) el.value=val; };
  set('ej-idx',   idx);
  set('ej-tgl',   r.tgl);
  set('ej-qty',   r.qty);
  set('ej-harga', r.harga);
  set('ej-hpp',   r.hpp);

  openModal('modal-edit-jurnal');
}

function onEjIndukChange() {
  const induk = document.getElementById('ej-induk')?.value;
  const varList = (DB.produk||[]).filter(p=>p.induk===induk);
  const skuSel = document.getElementById('ej-sku');
  if (skuSel) skuSel.innerHTML = varList.map(p=>`<option value="${p.var}">${p.var}</option>`).join('');
  onEjSkuChange();
}

function onEjSkuChange() {
  const varNama = document.getElementById('ej-sku')?.value;
  const prod = (DB.produk||[]).find(p=>p.var===varNama);
  if (prod) {
    const hppEl = document.getElementById('ej-hpp');
    if (hppEl) hppEl.value = prod.hpp || 0;
    // FIX: auto-fill harga jual jika field kosong
    const hargaEl = document.getElementById('ej-harga');
    if (hargaEl && (!hargaEl.value || +hargaEl.value === 0)) {
      hargaEl.value = prod.jual>0 ? prod.jual : (prod.hpp||0);
    }
  }
}
function saveEditJurnal() {
  const idx     = +document.getElementById('ej-idx').value;
  const newQty  = +document.getElementById('ej-qty').value||0;
  const newVar  = document.getElementById('ej-sku').value;
  const newCh   = document.getElementById('ej-ch').value;
  const newTgl  = document.getElementById('ej-tgl').value;
  const newHpp  = +document.getElementById('ej-hpp').value||0;
  // FIX: ambil harga dari field ej-harga, bukan hardcode 0
  const hargaInput = +document.getElementById('ej-harga')?.value||0;
  const prod   = DB.produk.find(p=>p.var===newVar);
  const newHarga = hargaInput>0 ? hargaInput : (prod&&prod.jual>0 ? prod.jual : newHpp);
  const uuid    = DB.jurnal[idx].uuid;
  DB.jurnal[idx] = {...DB.jurnal[idx], tgl:newTgl, ch:newCh, var:newVar, qty:newQty, harga:newHarga, hpp:newHpp};
  recalcStok();
  // Sync edit ke Supabase
  if (uuid && SUPABASE_URL) {
    const j=DB.jurnal[idx];
    DataLayer._upsert('jurnal',[{uuid,tgl:j.tgl,ch:j.ch,var:j.var,qty:j.qty,harga:j.harga,hpp:j.hpp}],'uuid').catch(e=>console.warn('Edit jurnal gagal sync:',e));
  }
  closeModal('modal-edit-jurnal'); saveDB(); renderJurnal(); renderStok(); renderDashboard(); toast('✅ Transaksi diperbarui!');
}

function deleteJurnal(idx) {
  if (!confirm('Hapus transaksi ini?')) return;
  const j=DB.jurnal[idx];
  const uuid=j?.uuid;
  const sid=j?.sid; // supabase id jika ada
  DB.jurnal.splice(idx,1);
  recalcStok();
  // Sync delete ke Supabase — by uuid atau by id
  if (SUPABASE_URL) {
    if (uuid) {
      DataLayer._deleteByKey('jurnal','uuid',uuid).catch(e=>console.warn('Delete jurnal by uuid gagal:',e));
    } else if (sid) {
      DataLayer._deleteByKey('jurnal','id',sid).catch(e=>console.warn('Delete jurnal by id gagal:',e));
    } else {
      // Tidak ada key — saveDB akan replace semua jurnal
      saveDB();
    }
  }
  saveDB(); renderJurnal(); renderStok(); renderDashboard(); toast('✅ Transaksi dihapus');
}

// ================================================================
// KELOLA PRODUK
// ================================================================
let produkQ='';
let produkStatusFilter='semua';
let produkSelectedVars=new Set(); // Set of selected SKU Variasi
let _produkEditMode = false; // Checkbox mode aktif/tidak
let _produkDisplayRows=[]; // current displayed rows (for index lookup)

function filterProdukStatus(v){produkStatusFilter=v;renderProduk();}
function getProdukStatusBadge(s){
  const map={aktif:'<span class="badge-status badge-aktif">✅ Aktif</span>',slow:'<span class="badge-status badge-slow">⚠️ Slow</span>',deadstock:'<span class="badge-status badge-dead">🔴 Deadstock</span>',clearance:'<span class="badge-status badge-clearance">🏷️ Clearance</span>',arsip:'<span class="badge-status badge-arsip">📦 Arsip</span>'};
  return map[s]||map['aktif'];
}

function renderProduk() {
  const q=produkQ.toLowerCase();
  let rows=DB.produk.filter(r=>r.var.toLowerCase().includes(q)||r.induk.toLowerCase().includes(q));
  if(produkStatusFilter!=='semua') rows=rows.filter(r=>(r.status_produk||'aktif')===produkStatusFilter);
  rows=rows.sort((a,b)=>a.induk.localeCompare(b.induk)||a.var.localeCompare(b.var));
  _produkDisplayRows=rows;

  if(!rows.length){
    document.getElementById('produk-body').innerHTML='<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--dusty)">Tidak ada produk</td></tr>';
    _syncProdukBulkBar(); return;
  }

  // Group by induk
  const groups={};
  rows.forEach(r=>{ if(!groups[r.induk]) groups[r.induk]=[]; groups[r.induk].push(r); });

  let html=''; let varNo=0;
  Object.entries(groups).forEach(([induk, vars])=>{
    // Hitung state checkbox induk
    const allChk=vars.every(r=>produkSelectedVars.has(r.var));
    const someChk=vars.some(r=>produkSelectedVars.has(r.var));
    const indeterminate=someChk&&!allChk;
    const supplier=vars[0].suplaier||'—';
    const hppAvg=Math.round(vars.reduce((s,r)=>s+(r.hpp||0),0)/vars.length);

    // Baris induk (group header)
    html+=`<tr class="produk-group-header">
      <td style="text-align:center;display:${_produkEditMode?'table-cell':'none'}" class="chk-col">
        <input type="checkbox" class="produk-chk-induk" data-induk="${induk}"
          ${allChk?'checked':''} onchange="produkToggleInduk(this,'${induk}')"
          style="cursor:pointer;width:15px;height:15px;"
          ${indeterminate?'data-indeterminate="true"':''}>
      </td>
      <td colspan="2" style="padding:10px 12px;">
        <strong style="font-size:14px;color:var(--brown);">${induk}</strong>
        <span style="font-size:11px;color:var(--dusty);margin-left:8px;">${vars.length} varian</span>
      </td>
      <td style="font-size:12px;color:var(--dusty);font-weight:600;">${supplier}</td>
      <td style="font-size:12px;color:var(--dusty);">avg ${fmt(hppAvg)}</td>
      <td colspan="2"></td>
    </tr>`;

    // Baris variasi
    vars.forEach(r=>{
      varNo++;
      const chk=produkSelectedVars.has(r.var);
      const dbIdx=DB.produk.indexOf(r);
      html+=`<tr class="produk-var-row${chk?' produk-row-selected':''}">
        <td style="text-align:center;display:${_produkEditMode?'table-cell':'none'}" class="chk-col">
          <input type="checkbox" class="produk-chk" value="${r.var}" data-induk="${induk}"
            ${chk?'checked':''} onchange="produkOnCheck(this)"
            style="cursor:pointer;width:15px;height:15px;">
        </td>
        <td class="mono" style="color:var(--dusty);padding-left:28px;">${varNo}</td>
        <td style="padding-left:28px;font-size:13px;">${r.var}</td>
        <td class="mono">${fmt(r.hpp)}</td>
        <td></td>
        <td>${getProdukStatusBadge(r.status_produk||'aktif')}</td>

      </tr>`;
    });
  });

  document.getElementById('produk-body').innerHTML=html;

  // Apply indeterminate state (harus setelah render)
  document.querySelectorAll('.produk-chk-induk[data-indeterminate="true"]').forEach(el=>{el.indeterminate=true;});
  _syncProdukBulkBar();
}

// ── Checkbox helpers ──
function produkOnCheck(el){
  if(el.checked) produkSelectedVars.add(el.value);
  else produkSelectedVars.delete(el.value);
  // Update header checkbox induk
  const induk=el.dataset.induk;
  if(induk) _syncIndukCheckbox(induk);
  _syncProdukBulkBar();
  // sync global header checkbox
  _syncGlobalCheckbox();
}

function _syncIndukCheckbox(induk){
  const vars=DB.produk.filter(r=>r.induk===induk);
  const allChk=vars.every(r=>produkSelectedVars.has(r.var));
  const someChk=vars.some(r=>produkSelectedVars.has(r.var));
  const el=document.querySelector(`.produk-chk-induk[data-induk="${induk}"]`);
  if(el){el.checked=allChk;el.indeterminate=someChk&&!allChk;}
}

function _syncGlobalCheckbox(){
  const all=document.querySelectorAll('.produk-chk');
  const checked=[...all].filter(c=>c.checked).length;
  const chkAll=document.getElementById('produk-chk-all');
  if(chkAll){chkAll.checked=checked===all.length&&all.length>0;chkAll.indeterminate=checked>0&&checked<all.length;}
}

function produkToggleInduk(el, induk){
  const vars=DB.produk.filter(r=>r.induk===induk);
  vars.forEach(r=>{ if(el.checked) produkSelectedVars.add(r.var); else produkSelectedVars.delete(r.var); });
  // Re-render hanya baris variasi yg bersangkutan supaya tidak flicker
  vars.forEach(r=>{
    const chkEl=document.querySelector(`.produk-chk[value="${r.var}"]`);
    const row=chkEl?.closest('tr');
    if(chkEl) chkEl.checked=el.checked;
    if(row){ if(el.checked) row.classList.add('produk-row-selected'); else row.classList.remove('produk-row-selected'); }
  });
  _syncGlobalCheckbox();
  _syncProdukBulkBar();
}

function produkToggleAll(v){
  _produkDisplayRows.forEach(r=>{ if(v) produkSelectedVars.add(r.var); else produkSelectedVars.delete(r.var); });
  renderProduk();
}
function produkBulkDeselectAll(){produkSelectedVars.clear();renderProduk();}
function _syncProdukBulkBar(){
  const n=produkSelectedVars.size;
  const bar=document.getElementById('produk-bulk-bar');
  const cnt=document.getElementById('produk-bulk-count');
  if(bar){bar.style.display=n>0?'flex':'none';}
  if(cnt) cnt.textContent=`${n} dipilih`;
}

// ── Dropdown menu toggle ──
function toggleProdukEditMenu(e){
  e.stopPropagation();
  const menu=document.getElementById('produk-edit-menu');
  const isOpen = menu.style.display==='block';
  menu.style.display=isOpen?'none':'block';
  // Aktifkan edit mode saat menu dibuka
  if(!isOpen && !_produkEditMode){
    _produkEditMode=true;
    renderProduk();
  }
}
function closeProdukEditMode(){
  _produkEditMode=false;
  produkSelectedVars.clear();
  renderProduk();
  _syncProdukBulkBar();
}
document.addEventListener('click',()=>{
  const menu=document.getElementById('produk-edit-menu');
  if(menu) menu.style.display='none';
});

// ── Bulk actions ──
function _getSelectedProdukRows(){
  return DB.produk.filter(r=>produkSelectedVars.has(r.var));
}
function _checkBulkSel(label){
  if(produkSelectedVars.size===0){toast(`Tandai produk dulu untuk ${label}`,'err');return false;}
  return true;
}

function produkBulkEditHpp(){
  if(!_checkBulkSel('edit HPP')) return;
  document.getElementById('bulk-hpp-info').textContent=`${produkSelectedVars.size} SKU dipilih — HPP baru berlaku ke semua.`;
  document.getElementById('bulk-hpp-val').value='';
  openModal('modal-bulk-hpp');
}
async function execBulkHpp(){
  const hpp=+document.getElementById('bulk-hpp-val').value||0;
  if(!hpp){toast('Isi HPP dulu','err');return;}
  const rows=_getSelectedProdukRows();
  rows.forEach(r=>{r.hpp=hpp;const s=DB.stok.find(x=>x.var===r.var);if(s)s.hpp=hpp;});
  closeModal('modal-bulk-hpp');
  if(SUPABASE_URL){
    try{
      await DataLayer._upsert('produk',rows.map(r=>({var:r.var,induk:r.induk,hpp:r.hpp,suplaier:r.suplaier,status_produk:r.status_produk||'aktif',toko:r.toko||'semua'})),'var');
      toast(`✅ HPP ${fmt(hpp)} disimpan & sync ke cloud (${rows.length} SKU)`);
    }catch(e){toast('⚠️ Disimpan lokal, sync cloud gagal','warn');}
  }
  produkSelectedVars.clear();
  saveDB();renderProduk();renderHarga();renderStok();
}

function produkBulkEditSupplier(){
  if(!_checkBulkSel('edit Supplier')) return;
  document.getElementById('bulk-sup-info').textContent=`${produkSelectedVars.size} SKU dipilih — Supplier baru berlaku ke semua.`;
  openModal('modal-bulk-supplier');
}
async function execBulkSupplier(){
  const sup=document.getElementById('bulk-sup-val').value;
  const rows=_getSelectedProdukRows();
  rows.forEach(r=>r.suplaier=sup);
  closeModal('modal-bulk-supplier');
  if(SUPABASE_URL){
    try{
      await DataLayer._upsert('produk',rows.map(r=>({var:r.var,induk:r.induk,hpp:r.hpp,suplaier:r.suplaier,status_produk:r.status_produk||'aktif',toko:r.toko||'semua'})),'var');
      toast(`✅ Supplier → ${sup} disimpan & sync ke cloud (${rows.length} SKU)`);
    }catch(e){toast('⚠️ Disimpan lokal, sync cloud gagal','warn');}
  }
  produkSelectedVars.clear();
  saveDB();renderProduk();
}

function produkBulkEditStatus(){
  if(!_checkBulkSel('ubah status')) return;
  document.getElementById('bulk-status-info').textContent=`${produkSelectedVars.size} SKU dipilih — Status baru berlaku ke semua.`;
  openModal('modal-bulk-status');
}
async function execBulkStatus(){
  const st=document.getElementById('bulk-status-val').value;
  const rows=_getSelectedProdukRows();
  rows.forEach(r=>r.status_produk=st);
  closeModal('modal-bulk-status');
  if(SUPABASE_URL){
    try{
      await DataLayer._upsert('produk',rows.map(r=>({var:r.var,induk:r.induk,hpp:r.hpp,suplaier:r.suplaier,status_produk:r.status_produk,toko:r.toko||'semua'})),'var');
      toast(`✅ Status → ${st} disimpan & sync ke cloud (${rows.length} SKU)`);
    }catch(e){toast('⚠️ Disimpan lokal, sync cloud gagal','warn');}
  }
  produkSelectedVars.clear();
  saveDB();renderProduk();
}

async function produkBulkArsip(){
  if(!_checkBulkSel('arsip')) return;
  if(!confirm(`Arsipkan ${produkSelectedVars.size} SKU yang dipilih?`)) return;
  const rows=_getSelectedProdukRows();
  rows.forEach(r=>r.status_produk='arsip');
  if(SUPABASE_URL){
    try{
      await DataLayer._upsert('produk',rows.map(r=>({var:r.var,induk:r.induk,hpp:r.hpp,suplaier:r.suplaier,status_produk:'arsip',toko:r.toko||'semua'})),'var');
      toast(`📦 ${rows.length} SKU diarsipkan & sync ke cloud`);
    }catch(e){toast('⚠️ Diarsipkan lokal, sync cloud gagal','warn');}
  }
  produkSelectedVars.clear();
  saveDB();renderProduk();
}

async function produkBulkHapus(){
  if(!_checkBulkSel('hapus')) return;
  if(!confirm(`Hapus ${produkSelectedVars.size} SKU yang dipilih? Aksi ini tidak bisa dibatalkan!`)) return;
  const toDelete=[...produkSelectedVars];
  DB.produk=DB.produk.filter(r=>!produkSelectedVars.has(r.var));
  if(SUPABASE_URL){
    try{
      // Hapus stok dulu (foreign key constraint), baru produk
      await Promise.all(toDelete.map(v=>DataLayer._deleteByKey('stok','var',v)));
      await Promise.all(toDelete.map(v=>DataLayer._deleteByKey('produk','var',v)));
      toast(`🗑️ ${toDelete.length} SKU dihapus & sync ke cloud`);
    }catch(e){toast('⚠️ Dihapus lokal, sync cloud gagal','warn');}
  }
  produkSelectedVars.clear();
  saveDB();renderProduk();renderStok();renderDashboard();
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
  document.getElementById('ep-status').value=r.status_produk||'aktif';
  openModal('modal-edit-produk');
}
async function saveEditProduk() {
  const idx=+document.getElementById('ep-idx').value;
  const updated={...DB.produk[idx],
    induk:document.getElementById('ep-induk').value.trim().toUpperCase(),
    var:document.getElementById('ep-variasi').value.trim().toUpperCase(),
    hpp:+document.getElementById('ep-hpp').value||0,
    suplaier:document.getElementById('ep-suplaier').value.trim().toUpperCase(),
    status_produk:document.getElementById('ep-status').value||'aktif'
  };
  if (!updated.var)   { toast('Nama variasi tidak boleh kosong!','err'); return; }
  if (!updated.induk) { toast('Nama induk tidak boleh kosong!','err'); return; }
  const btnSave=document.getElementById('ep-btn-save');
  if (btnSave) { btnSave.disabled=true; btnSave.textContent='Menyimpan...'; }
  if (SUPABASE_URL) {
    try {
      await DataLayer._upsert('produk',[{var:updated.var,induk:updated.induk,hpp:updated.hpp,suplaier:updated.suplaier,status_produk:updated.status_produk,toko:updated.toko||'semua'}],'var');
    } catch(e) {
      toast('Gagal simpan ke cloud: '+e.message,'err');
      if (btnSave) { btnSave.disabled=false; btnSave.textContent='Simpan'; }
      return;
    }
  }
  DB.produk[idx]=updated;
  closeModal('modal-edit-produk'); saveDB(); renderProduk(); renderHarga();
  toast('Produk diperbarui!');
}
async function arsipProduk(idx) {
  if (!confirm('Arsipkan produk "'+DB.produk[idx].var+'"? Produk tidak akan tampil di operasional tapi data tetap tersimpan.')) return;
  DB.produk[idx].status_produk = 'arsip';
  if (SUPABASE_URL) {
    try {
      const produkRows = DB.produk.map(p => ({
        induk:p.induk, var:p.var, hpp:p.hpp||0,
        suplaier:p.suplaier||'', npm:p.npm||10,
        jual:p.jual||0, pasang:p.pasang||0,
        reseller:p.reseller||0, gm:p.gm||0,
        status_produk:p.status_produk||'aktif',
        toko:p.toko||'semua'
      }));
      await DataLayer._replaceAll('produk', produkRows);
    } catch(e) { toast('Gagal arsip ke cloud: '+e.message, 'err'); DB.produk[idx].status_produk='aktif'; return; }
  }
  saveDB(); renderProduk(); toast('Produk diarsipkan');
}

async function deleteProduk(idx) {
  if (!confirm('Hapus produk "'+DB.produk[idx].var+'"? Data akan dihapus permanen.')) return;
  const varKey = DB.produk[idx].var;
  if (SUPABASE_URL) {
    try {
      await DataLayer._deleteByKey('produk', 'var', varKey);
      await DataLayer._deleteByKey('stok', 'var', varKey);
    } catch(e) {
      toast('Gagal hapus dari cloud: '+e.message, 'err');
      return;
    }
  }
  const localIdx = DB.produk.findIndex(p => p.var === varKey);
  if (localIdx > -1) DB.produk.splice(localIdx, 1);
  const stokIdx = DB.stok.findIndex(s => s.var === varKey);
  if (stokIdx > -1) DB.stok.splice(stokIdx, 1);
  renderProduk(); renderHarga();
  toast('Produk '+varKey+' dihapus');
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
async function doImportSheets() {
  const getCol=(row,field)=>importColMap[field]!==undefined?(row[importColMap[field]]||''):'';
  let added=0,skipped=0;
  const newRows=[];
  importParsedRows.forEach(row=>{
    const induk=getCol(row,'induk').trim().toUpperCase();const varVal=getCol(row,'var').trim().toUpperCase();
    if (!induk&&!varVal) return;
    if (DB.produk.find(p=>p.var.toUpperCase()===varVal)) { skipped++;return; }
    const hpp=parseFloat(getCol(row,'hpp').replace(/\./g,'').replace(',','.').replace(/[^\d.]/g,''))||0;
    const suplaier=getCol(row,'suplaier').trim().toUpperCase();
    const prod={induk,var:varVal,hpp,suplaier,npm:10,jual:0,pasang:0,reseller:0,gm:0};
    DB.produk.push(prod); newRows.push(prod); added++;
  });
  const stokAdded=syncStokFromProduk();
  saveDB(); renderProduk(); renderStok(); closeImportSheets();
  if(SUPABASE_URL&&newRows.length){
    try{
      await DataLayer._upsert('produk',newRows.map(p=>({var:p.var,induk:p.induk,hpp:p.hpp,suplaier:p.suplaier,status_produk:p.status_produk||'aktif',toko:p.toko||'semua'})),'var');
      toast(`✅ ${added} produk diimport & sync cloud · ${stokAdded} stok baru!`);
    }catch(e){toast(`✅ ${added} produk diimport · ⚠️ sync cloud gagal`);}
  } else {
    toast(`✅ ${added} produk diimport · ${stokAdded} stok baru!`);
  }
}

// ================================================================
// INPUT STOK MASSAL
// ================================================================
function parseMassal() {
  const raw=document.getElementById('massal-paste-area').value.trim();
  if (!raw) { toast('Paste data dulu!','err'); return; }
  const lines=raw.split('\n').map(l=>l.trim()).filter(l=>l);
  let valid=0,notFound=0;
  const html=lines.map((line,i)=>{
    const parts=line.split('\t');
    const sku=(parts[0]||'').trim().toUpperCase();
    const qty=parseInt((parts[1]||'0').replace(/[^\d]/g,''))||0;
    const found=DB.stok.find(s=>s.var.toUpperCase()===sku);
    const produk=DB.produk.find(p=>p.var.toUpperCase()===sku);
    const supplier=produk&&produk.suplaier?produk.suplaier:'—';
    if(found&&qty>0)valid++;else notFound++;
    return `<tr><td style="padding:5px 8px">${i+1}</td><td style="padding:5px 8px">${sku}</td><td style="padding:5px 8px">${qty}</td><td style="padding:5px 8px;color:var(--dusty)">${supplier}</td><td style="padding:5px 8px"><span class="badge ${found&&qty>0?'bg':'br'}">${found&&qty>0?'✅ Siap':!found?'SKU tdk ada':'Qty 0'}</span></td></tr>`;
  }).join('');
  document.getElementById('massal-preview-body').innerHTML=html;
  document.getElementById('massal-summary').innerHTML=`Total: <strong>${lines.length}</strong> · Siap: <strong style="color:var(--sage)">${valid}</strong> · Dilewati: <strong style="color:var(--rust)">${notFound}</strong>`;
  document.getElementById('massal-preview').style.display='block';
  document.getElementById('massal-confirm-btn').style.display=valid>0?'inline-flex':'none';
}
function doInputMassal() {
  const raw=document.getElementById('massal-paste-area').value.trim();
  const lines=raw.split('\n').map(l=>l.trim()).filter(l=>l);
  const tgl = _localDateStr(new Date());
  let updated=0;
  lines.forEach(line=>{
    const parts=line.split('\t');
    const sku=(parts[0]||'').trim().toUpperCase();
    const qty=parseInt((parts[1]||'0').replace(/[^\d]/g,''))||0;
    const stok=DB.stok.find(s=>s.var.toUpperCase()===sku);
    const produk=DB.produk.find(p=>p.var.toUpperCase()===sku);
    const supplier=produk&&produk.suplaier?produk.suplaier:'';
    if(stok&&qty>0){
      DB.restock = DB.restock||[];
      DB.restock.push({
        uuid: DataLayer._uuid(),
        tgl, var: stok.var,
        supplier, qty, catatan: 'Input Massal'
      });
      updated++;
    }
  });
  if (updated>0) {
    recalcStok(); saveDB(); renderStok(); renderRestock(); renderDashboard();
    closeModal('modal-stok-massal');
    document.getElementById('massal-paste-area').value='';
    document.getElementById('massal-preview').style.display='none';
    toast(`✅ ${updated} SKU berhasil diupdate!`);
  } else toast('Tidak ada data valid','err');
}

// ================================================================
// ════════════════════════════════════════════════════════════════
// TOKO MANAGER
// ════════════════════════════════════════════════════════════════
let _tokoChanged = false;

function renderTokoManager() {
  const channels = window._tokoList.map(t=>t.kode);
  const q = (document.getElementById('toko-search')?.value||'').toLowerCase();
  const filterToko = document.getElementById('toko-filter-select')?.value||'semua';

  const sel = document.getElementById('toko-filter-select');
  if (sel) {
    const cur = sel.value;
    sel.innerHTML = '<option value="semua">🏪 Semua Toko</option>' +
      channels.map(c=>`<option value="${c}" ${cur===c?'selected':''}>${c}</option>`).join('');
  }

  const cards = document.getElementById('toko-cards');
  if (cards) {
    cards.innerHTML = channels.map(ch => {
      const produkToko = DB.produk.filter(p => {
        const t = p.toko||'semua';
        return t==='semua' || t.split(',').map(x=>x.trim()).includes(ch);
      });
      const jurnalToko = DB.jurnal.filter(j=>j.ch===ch);
      const omset = jurnalToko.reduce((s,j)=>s+(j.hpp*j.qty),0);
      const qty = jurnalToko.reduce((s,j)=>s+j.qty,0);
      return `<div class="card" style="border-left:3px solid var(--brown)">
        <div style="font-weight:700;font-size:15px;margin-bottom:8px">🏪 ${ch}</div>
        <div style="font-size:12px;color:var(--dusty);margin-bottom:6px">${produkToko.length} produk</div>
        <div style="font-size:13px">Omset: <strong>${fmt(omset)}</strong></div>
        <div style="font-size:13px">Terjual: <strong>${qty} pcs</strong></div>
      </div>`;
    }).join('');
  }

  let produkList = DB.produk.filter(p=>
    (p.status_produk||'aktif')!=='arsip' &&
    (p.var.toLowerCase().includes(q) || p.induk.toLowerCase().includes(q))
  );
  if (filterToko!=='semua') {
    produkList = produkList.filter(p => {
      const t = p.toko||'semua';
      return t==='semua' || t.split(',').map(x=>x.trim()).includes(filterToko);
    });
  }

  const indukGroups = {};
  produkList.forEach(p => {
    if (!indukGroups[p.induk]) indukGroups[p.induk] = [];
    indukGroups[p.induk].push(p);
  });

  const summary = document.getElementById('toko-summary');
  if (summary) summary.textContent = `${produkList.length} produk · ${Object.keys(indukGroups).length} induk`;

  const thead = document.querySelector('#toko-assign-body')?.closest('table')?.querySelector('thead tr');
  if (thead) {
    thead.innerHTML = '<th>#</th><th>SKU Induk</th><th>SKU Variasi</th><th>HPP</th>' +
      channels.map(ch=>`<th style="font-size:11px;text-align:center">${ch}</th>`).join('');
  }

  const tbody = document.getElementById('toko-assign-body');
  if (!tbody) return;

  let rowNum = 0;
  let html = '';
  Object.entries(indukGroups).sort(([a],[b])=>a.localeCompare(b)).forEach(([induk, variants]) => {
    const indukChecks = channels.map(ch => {
      const total = variants.length;
      const checked = variants.filter(p => {
        const t = p.toko||'semua';
        return t==='semua' || t.split(',').map(x=>x.trim()).includes(ch);
      }).length;
      if (checked === 0) return 'none';
      if (checked === total) return 'all';
      return 'partial';
    });

    html += `<tr style="background:rgba(0,0,0,.04);font-weight:700">
      <td colspan="3" style="padding:8px 12px">📦 ${induk} <span style="font-weight:400;font-size:12px;color:var(--dusty)">(${variants.length} varian)</span></td>
      <td></td>
      ${channels.map((ch,i) => {
        const state = indukChecks[i];
        const checked = state==='all' ? 'checked' : '';
        const style = state==='partial' ? 'style="accent-color:orange"' : '';
        return `<td style="text-align:center"><input type="checkbox" ${checked} ${style} data-induk="${induk}" data-ch="${ch}" data-type="induk" onchange="onTokoIndukChange(this)"></td>`;
      }).join('')}
    </tr>`;

    variants.sort((a,b)=>a.var.localeCompare(b.var)).forEach(p => {
      rowNum++;
      const tokoVal = p.toko||'semua';
      const tokoList = tokoVal==='semua' ? channels : tokoVal.split(',').map(x=>x.trim());
      html += `<tr>
        <td class="mono" style="color:var(--dusty)">${rowNum}</td>
        <td></td>
        <td style="padding-left:24px;font-size:13px">${p.var}</td>
        <td class="mono">${fmt(p.hpp)}</td>
        ${channels.map(ch =>
          `<td style="text-align:center"><input type="checkbox" data-var="${p.var}" data-ch="${ch}" data-type="var" onchange="onTokoVarChange(this)" ${tokoList.includes(ch)?'checked':''}></td>`
        ).join('')}
      </tr>`;
    });
  });

  tbody.innerHTML = html || `<tr><td colspan="${4+channels.length}" style="text-align:center;padding:30px;color:var(--dusty)">Tidak ada produk</td></tr>`;
  updateTokoSaveBtn();

  // Sticky bar shadow saat scroll
  const mainEl = document.querySelector('.main');
  const stickyBar = document.getElementById('toko-sticky-bar');
  if (mainEl && stickyBar) {
    mainEl.onscroll = () => stickyBar.classList.toggle('scrolled', mainEl.scrollTop > 20);
  }
}

function onTokoIndukChange(cb) {
  const induk = cb.dataset.induk;
  const ch = cb.dataset.ch;
  const checked = cb.checked;
  document.querySelectorAll(`#toko-assign-body input[data-type="var"][data-ch="${ch}"]`).forEach(el => {
    const p = DB.produk.find(x=>x.var===el.dataset.var);
    if (p && p.induk===induk) el.checked = checked;
  });
  _tokoChanged = true;
  updateTokoSaveBtn();
}

function onTokoVarChange() {
  _tokoChanged = true;
  updateTokoSaveBtn();
}

function updateTokoSaveBtn() {
  const btn = document.getElementById('toko-save-btn');
  if (!btn) return;
  btn.textContent = _tokoChanged ? '💾 Simpan Perubahan ●' : '💾 Simpan Semua';
  btn.style.background = _tokoChanged ? 'var(--brown)' : '';
}

function saveTokoAssign() {
  const channels = window._tokoList.map(t=>t.kode);
  const tokoMap = {};
  document.querySelectorAll('#toko-assign-body input[data-type="var"]').forEach(cb => {
    const v = cb.dataset.var;
    const ch = cb.dataset.ch;
    if (!tokoMap[v]) tokoMap[v] = [];
    if (cb.checked) tokoMap[v].push(ch);
  });

  // Update DB.produk
  Object.entries(tokoMap).forEach(([varKey, tokoArr]) => {
    const p = DB.produk.find(x=>x.var===varKey);
    if (!p) return;
    p.toko = tokoArr.length === channels.length ? 'semua' : tokoArr.join(',');
  });

  // Batch upsert semua produk sekaligus ke Supabase
  if (SUPABASE_URL) {
    const produkRows = DB.produk.map(p => ({
      var: p.var, induk: p.induk, hpp: p.hpp||0,
      suplaier: p.suplaier||'', npm: p.npm||10,
      jual: p.jual||0, pasang: p.pasang||0,
      reseller: p.reseller||0, gm: p.gm||0,
      status_produk: p.status_produk||'aktif',
      toko: p.toko||'semua'
    }));
    DataLayer._upsert('produk', produkRows, 'var')
      .then(() => toast('✅ Assignment toko disimpan!'))
      .catch(e => { console.warn('Sync toko gagal:', e); toast('❌ Gagal sync ke cloud', 'err'); });
  }

  _tokoChanged = false;
  updateTokoSaveBtn();
  renderTokoManager();
}

// CHANNEL PENJUALAN

// ================================================================
// ================================================================
// CHANNEL PAGE — Manage Toko (1 kolom, full CRUD ke Supabase)
// ================================================================

let _chEditKode = null; // kode toko yang sedang diedit

function renderChannel() {
  const wrap = document.getElementById('page-channel');
  if (!wrap) return;

  const PLATFORM_OPTS = ['shopee','lazada','tiktok','whatsapp','offline','direct','reseller'];
  const GRUP_OPTS     = ['SHOPEE','LAZADA','TIKTOK','OFFLINE','RESELLER','LAINNYA'];
  const COLORS        = ['#5C3D2E','#C9785A','#9D4EDD','#3D7EAA','#2A5F8A','#7C3AED','#5A7A6A','#8B7355','#C0392B','#0D9488'];
  const grups         = [...new Set(window._tokoList.map(t => t.grup))];
  const total         = window._tokoList.length;

  wrap.innerHTML = `
    <div style="display:flex;height:calc(100vh - 56px);overflow:hidden;">

      <!-- KOLOM KIRI — List Channel (fixed, scrollable) -->
      <div style="width:320px;flex-shrink:0;display:flex;flex-direction:column;border-right:1.5px solid var(--border);background:var(--cream);overflow:hidden;">

        <!-- Header kiri -->
        <div style="padding:20px 16px 12px;border-bottom:1px solid var(--border);background:var(--cream);">
          <div style="font-size:16px;font-weight:800;color:var(--charcoal);">Channel Penjualan</div>
          <div style="font-size:11px;color:var(--dusty);margin-top:2px;">${total} channel • Supabase</div>
          <button onclick="chShowForm()" class="btn btn-p"
            style="width:100%;margin-top:10px;padding:9px;border-radius:10px;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;">
            <span style="font-size:15px;line-height:1;">＋</span> Tambah Channel
          </button>
        </div>

        <!-- List scroll -->
        <div style="flex:1;overflow-y:auto;padding:12px 12px 20px;" id="ch-list-scroll">
          ${grups.length === 0 ? `
            <div style="text-align:center;padding:40px 16px;color:var(--dusty);">
              <div style="font-size:28px;margin-bottom:8px;">🏪</div>
              <div style="font-size:13px;font-weight:600;">Belum ada channel</div>
            </div>` :
            grups.map(grup => {
              const items = window._tokoList.filter(t => t.grup === grup);
              return `
                <div style="margin-bottom:16px;">
                  <div style="font-size:9px;font-weight:800;color:var(--dusty);text-transform:uppercase;
                              letter-spacing:1px;padding:4px 4px 6px;border-bottom:1px solid var(--border);margin-bottom:6px;">${grup}</div>
                  ${items.map(t => `
                    <div id="ch-row-${t.kode.replace(/[^A-Z0-9]/gi,'_')}"
                      onclick="chEdit('${t.kode}')"
                      style="display:flex;align-items:center;gap:10px;padding:10px 10px;background:white;
                             border:1.5px solid ${_chEditKode===t.kode?'var(--rust)':'var(--border)'};
                             border-radius:10px;margin-bottom:5px;cursor:pointer;
                             box-shadow:0 1px 3px rgba(0,0,0,.04);
                             opacity:${t.status==='nonaktif'?'.4':'1'};
                             transition:border .15s;">
                      <span style="width:9px;height:9px;border-radius:50%;background:${t.warna};flex-shrink:0;"></span>
                      <div style="flex:1;min-width:0;">
                        <div style="font-size:12px;font-weight:700;color:var(--charcoal);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${t.kode}</div>
                        <div style="font-size:10px;color:var(--dusty);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                          ${t.username||t.brand} · ${t.platform}${t.status==='nonaktif'?' · NONAKTIF':''}
                        </div>
                      </div>
                      <div style="display:flex;gap:4px;flex-shrink:0;" onclick="event.stopPropagation()">
                        <button onclick="chToggleStatus('${t.kode}')" title="${t.status==='aktif'?'Nonaktifkan':'Aktifkan'}"
                          style="width:26px;height:26px;border:1px solid var(--border);border-radius:6px;background:white;cursor:pointer;font-size:11px;line-height:1;">${t.status==='aktif'?'🔴':'🟢'}</button>
                        <button onclick="chHapus('${t.kode}')" title="Hapus"
                          style="width:26px;height:26px;border:1px solid #f5c6cb;border-radius:6px;background:#fff5f5;cursor:pointer;font-size:11px;line-height:1;">🗑</button>
                      </div>
                    </div>`).join('')}
                </div>`;
            }).join('')}
        </div>
      </div>

      <!-- KOLOM KANAN — Form Edit/Tambah (sticky, muncul saat dipilih) -->
      <div style="flex:1;display:flex;align-items:flex-start;justify-content:center;padding:32px 24px;overflow-y:auto;background:white;">

        <!-- State kosong -->
        <div id="ch-form-empty" style="text-align:center;padding:60px 20px;color:var(--dusty);width:100%;max-width:420px;">
          <div style="font-size:40px;margin-bottom:12px;">✏️</div>
          <div style="font-size:14px;font-weight:600;color:var(--charcoal);">Pilih channel untuk edit</div>
          <div style="font-size:12px;margin-top:6px;">Klik salah satu channel di kiri,<br>atau tambah channel baru.</div>
        </div>

        <!-- Form panel -->
        <div id="ch-form-wrap" style="display:none;width:100%;max-width:420px;">
          <div style="font-size:16px;font-weight:800;color:var(--charcoal);margin-bottom:20px;padding-bottom:12px;border-bottom:1.5px solid var(--border);" id="ch-form-title">＋ Tambah Channel Baru</div>

          <div style="display:flex;flex-direction:column;gap:14px;">
            <div>
              <label style="font-size:10px;font-weight:700;color:var(--dusty);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">Kode Unik *</label>
              <input id="ch-f-kode" class="inp" placeholder="SHP.ZENOOT" style="width:100%;font-weight:700;text-transform:uppercase;font-size:14px;" oninput="this.value=this.value.toUpperCase()">
              <div style="font-size:10px;color:var(--dusty);margin-top:3px;">Format: PLATFORM.BRAND — tidak bisa diubah setelah disimpan</div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
              <div>
                <label style="font-size:10px;font-weight:700;color:var(--dusty);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">Brand</label>
                <input id="ch-f-brand" class="inp" placeholder="zenOt / elenz / alley" style="width:100%;">
              </div>
              <div>
                <label style="font-size:10px;font-weight:700;color:var(--dusty);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">Username</label>
                <input id="ch-f-username" class="inp" placeholder="zenootsweater" style="width:100%;">
              </div>
              <div>
                <label style="font-size:10px;font-weight:700;color:var(--dusty);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">Platform</label>
                <select id="ch-f-platform" class="sel" style="width:100%;">
                  ${PLATFORM_OPTS.map(p=>`<option value="${p}">${p}</option>`).join('')}
                </select>
              </div>
              <div>
                <label style="font-size:10px;font-weight:700;color:var(--dusty);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:5px;">Grup</label>
                <select id="ch-f-grup" class="sel" style="width:100%;">
                  ${GRUP_OPTS.map(g=>`<option value="${g}">${g}</option>`).join('')}
                </select>
              </div>
            </div>

            <div>
              <label style="font-size:10px;font-weight:700;color:var(--dusty);text-transform:uppercase;letter-spacing:.5px;display:block;margin-bottom:8px;">Warna Label</label>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                ${COLORS.map((c,i)=>`<div onclick="chPickColor('${c}')" data-color="${c}" class="ch-color-dot"
                  style="width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer;
                         border:3px solid ${i===0?'#000':'transparent'};transition:border .15s;flex-shrink:0;"></div>`).join('')}
              </div>
              <input type="hidden" id="ch-f-warna" value="${COLORS[0]}">
            </div>

            <div style="display:flex;gap:8px;padding-top:8px;">
              <button onclick="chHideForm()" class="btn btn-s" style="flex:1;padding:10px;font-size:13px;">Batal</button>
              <button onclick="chSimpan()" class="btn btn-p" style="flex:2;padding:10px;font-size:13px;font-weight:700;" id="ch-btn-simpan">✅ Simpan</button>
            </div>
            <div id="ch-form-status" style="font-size:11px;color:var(--dusty);text-align:center;"></div>
          </div>
        </div>
      </div>

    </div>
  `;
}

function chShowForm(fillData) {
  const wrap  = document.getElementById('ch-form-wrap');
  const empty = document.getElementById('ch-form-empty');
  if (!wrap) return;

  // Tampilkan form, sembunyikan empty state
  wrap.style.display  = 'block';
  if (empty) empty.style.display = 'none';

  if (fillData) {
    document.getElementById('ch-f-kode').value    = fillData.kode;
    document.getElementById('ch-f-kode').disabled = true;
    document.getElementById('ch-f-brand').value   = fillData.brand    || '';
    document.getElementById('ch-f-platform').value= fillData.platform || 'shopee';
    document.getElementById('ch-f-grup').value    = fillData.grup     || 'SHOPEE';
    document.getElementById('ch-f-username').value= fillData.username || '';
    document.getElementById('ch-f-warna').value   = fillData.warna    || '#5C3D2E';
    document.getElementById('ch-form-title').textContent    = `✏️ Edit: ${fillData.kode}`;
    document.getElementById('ch-btn-simpan').textContent    = '✅ Update';
    document.querySelectorAll('.ch-color-dot').forEach(el => {
      el.style.border = el.dataset.color === fillData.warna ? '3px solid #000' : '3px solid transparent';
    });
    _chEditKode = fillData.kode;
  } else {
    document.getElementById('ch-f-kode').value    = '';
    document.getElementById('ch-f-kode').disabled = false;
    document.getElementById('ch-f-brand').value   = '';
    document.getElementById('ch-f-platform').value= 'shopee';
    document.getElementById('ch-f-grup').value    = 'SHOPEE';
    document.getElementById('ch-f-username').value= '';
    document.getElementById('ch-f-warna').value   = '#5C3D2E';
    document.getElementById('ch-form-title').textContent = '＋ Tambah Channel Baru';
    document.getElementById('ch-btn-simpan').textContent = '✅ Simpan';
    document.querySelectorAll('.ch-color-dot').forEach((el,i) => {
      el.style.border = i === 0 ? '3px solid #000' : '3px solid transparent';
    });
    _chEditKode = null;
  }
}

function chHideForm() {
  const wrap  = document.getElementById('ch-form-wrap');
  const empty = document.getElementById('ch-form-empty');
  if (wrap)  wrap.style.display  = 'none';
  if (empty) empty.style.display = 'block';
  _chEditKode = null;
  // Re-render list untuk hilangkan highlight
  _chRefreshList();
}

function chPickColor(color) {
  document.getElementById('ch-f-warna').value = color;
  document.querySelectorAll('.ch-color-dot').forEach(el => {
    el.style.border = el.dataset.color === color ? '3px solid #000' : '3px solid transparent';
  });
}

// Re-render hanya list kiri (tanpa reset kanan)
function _chRefreshList() {
  const scroll = document.getElementById('ch-list-scroll');
  if (!scroll) return;
  const grups = [...new Set(window._tokoList.map(t => t.grup))];
  if (!grups.length) { scroll.innerHTML = '<div style="text-align:center;padding:40px 16px;color:var(--dusty);"><div style="font-size:28px;margin-bottom:8px;">🏪</div><div style="font-size:13px;font-weight:600;">Belum ada channel</div></div>'; return; }
  scroll.innerHTML = grups.map(grup => {
    const items = window._tokoList.filter(t => t.grup === grup);
    return '<div style="margin-bottom:16px;">'
      + '<div style="font-size:9px;font-weight:800;color:var(--dusty);text-transform:uppercase;letter-spacing:1px;padding:4px 4px 6px;border-bottom:1px solid var(--border);margin-bottom:6px;">'+grup+'</div>'
      + items.map(t =>
        '<div id="ch-row-'+t.kode.replace(/[^A-Z0-9]/gi,'_')+'" onclick="chEdit('+JSON.stringify(t.kode)+')" '
        +'style="display:flex;align-items:center;gap:10px;padding:10px;background:white;'
        +'border:1.5px solid '+(_chEditKode===t.kode?'var(--rust)':'var(--border)')+';'
        +'border-radius:10px;margin-bottom:5px;cursor:pointer;box-shadow:0 1px 3px rgba(0,0,0,.04);'
        +'opacity:'+(t.status==='nonaktif'?'.4':'1')+';transition:border .15s;">'
        +'<span style="width:9px;height:9px;border-radius:50%;background:'+t.warna+';flex-shrink:0;"></span>'
        +'<div style="flex:1;min-width:0;">'
        +'<div style="font-size:12px;font-weight:700;color:var(--charcoal);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+t.kode+'</div>'
        +'<div style="font-size:10px;color:var(--dusty);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(t.username||t.brand)+' · '+t.platform+(t.status==='nonaktif'?' · NONAKTIF':'')+'</div>'
        +'</div>'
        +'<div style="display:flex;gap:4px;flex-shrink:0;" onclick="event.stopPropagation()">'
        +'<button onclick="chToggleStatus('+JSON.stringify(t.kode)+')" style="width:26px;height:26px;border:1px solid var(--border);border-radius:6px;background:white;cursor:pointer;font-size:11px;line-height:1;">'+( t.status==='aktif'?'🔴':'🟢')+'</button>'
        +'<button onclick="chHapus('+JSON.stringify(t.kode)+')" style="width:26px;height:26px;border:1px solid #f5c6cb;border-radius:6px;background:#fff5f5;cursor:pointer;font-size:11px;line-height:1;">🗑</button>'
        +'</div></div>'
      ).join('')
      + '</div>';
  }).join('');
}

async function chSimpan() {
  const kode     = document.getElementById('ch-f-kode').value.trim().toUpperCase();
  const brand    = document.getElementById('ch-f-brand').value.trim() || 'zenOt';
  const platform = document.getElementById('ch-f-platform').value;
  const grup     = document.getElementById('ch-f-grup').value;
  const username = document.getElementById('ch-f-username').value.trim();
  const warna    = document.getElementById('ch-f-warna').value || '#5C3D2E';
  const statusEl = document.getElementById('ch-form-status');
  const btnEl    = document.getElementById('ch-btn-simpan');

  if (!kode) { statusEl.innerHTML = '<span style="color:#C0392B">⚠️ Kode wajib diisi</span>'; return; }

  // Validasi format kode
  if (!/^[A-Z0-9._-]+$/.test(kode)) {
    statusEl.innerHTML = '<span style="color:#C0392B">⚠️ Kode hanya boleh huruf kapital, angka, titik, atau strip</span>'; return;
  }

  // Cek duplikat saat tambah baru
  if (!_chEditKode && window._tokoList.find(t => t.kode === kode)) {
    statusEl.innerHTML = `<span style="color:#C0392B">⚠️ Kode "${kode}" sudah ada</span>`; return;
  }

  statusEl.textContent = '⏳ Menyimpan...';
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = '⏳'; }

  const payload = { kode, brand, platform, grup, username, warna, status: 'aktif' };

  try {
    if (_chEditKode) {
      // UPDATE — patch ke Supabase
      await _sbFetch(`${SUPABASE_URL}/rest/v1/toko?kode=eq.${encodeURIComponent(_chEditKode)}`, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ brand, platform, grup, username, warna })
      });
      // Update local
      const t = window._tokoList.find(x => x.kode === _chEditKode);
      if (t) Object.assign(t, { brand, platform, grup, username, warna });
      toast(`✅ ${_chEditKode} diupdate!`);
    } else {
      // INSERT — tambah baru ke Supabase
      const urutan = window._tokoList.length + 1;
      const res = await _sbFetch(`${SUPABASE_URL}/rest/v1/toko`, {
        method: 'POST',
        headers: { 'Prefer': 'return=representation' },
        body: JSON.stringify([{ ...payload, urutan }])
      });
      if (!res.ok) throw new Error(await res.text());
      window._tokoList.push({ kode, nama: kode, brand, platform, grup, username, warna, urutan, status: 'aktif' });
      toast(`✅ Channel ${kode} ditambahkan!`);
    }
    chHideForm();
    _chRefreshList();
    renderTokoDropdown();
  } catch(e) {
    statusEl.innerHTML = `<span style="color:#C0392B">❌ Gagal: ${e.message}</span>`;
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = '✅ Simpan'; }
  }
}

function chEdit(kode) {
  const t = window._tokoList.find(x => x.kode === kode);
  if (!t) return;
  chShowForm(t);
  document.getElementById('ch-form-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function chToggleStatus(kode) {
  const t = window._tokoList.find(x => x.kode === kode);
  if (!t) return;
  const newStatus = t.status === 'aktif' ? 'nonaktif' : 'aktif';
  try {
    await _sbFetch(`${SUPABASE_URL}/rest/v1/toko?kode=eq.${encodeURIComponent(kode)}`, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ status: newStatus })
    });
    t.status = newStatus;
    _chRefreshList();
    renderTokoDropdown();
    toast(`${kode} → ${newStatus}`);
  } catch(e) { toast('Gagal: ' + e.message, 'err'); }
}

async function chHapus(kode) {
  if (!confirm(`Hapus channel "${kode}"? Data jurnal yang memakai kode ini tidak terhapus.`)) return;
  try {
    await _sbFetch(`${SUPABASE_URL}/rest/v1/toko?kode=eq.${encodeURIComponent(kode)}`, {
      method: 'DELETE'
    });
    const idx = window._tokoList.findIndex(t => t.kode === kode);
    if (idx !== -1) window._tokoList.splice(idx, 1);
    _chRefreshList();
    renderTokoDropdown();
    // Tutup form jika yang dihapus sedang diedit
    if (_chEditKode === kode) chHideForm();
    toast(`🗑 ${kode} dihapus`);
  } catch(e) { toast('Gagal: ' + e.message, 'err'); }
}

function tambahChannel() { chShowForm(); } // backward compat
function toggleChannelStatus(idx) {
  const t=window._tokoList[idx]; if(!t)return;
  const newStatus=t.status==='aktif'?'nonaktif':'aktif';
  _sbFetch(`${SUPABASE_URL}/rest/v1/toko?kode=eq.${encodeURIComponent(t.kode)}`,{method:'PATCH',headers:{'Prefer':'return=minimal'},body:JSON.stringify({status:newStatus})}).then(()=>{t.status=newStatus;_chRefreshList();renderTokoDropdown();toast(`Status ${t.kode} → ${newStatus}`);}).catch(e=>toast('Gagal: '+e.message,'err'));
  saveDB(); _chRefreshList();
  _syncChannelDropdowns();
}
function hapusChannel(idx) {
  const t=window._tokoList[idx]; if(!t)return;
  if (!confirm(`Hapus toko "${t.kode}"?`)) return;
  const chNama=t.kode;
  window._tokoList.splice(idx,1);
  // Bersihkan assign data untuk channel ini
  if (DB.assignChannel && chNama) {
    Object.keys(DB.assignChannel).forEach(induk => {
      if (DB.assignChannel[induk]) delete DB.assignChannel[induk][chNama];
    });
    _persistAssign();
  }
  saveDB();
  _chRefreshList();
}

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
// (sudah ditangani di go() — baris ini sengaja dikosongkan)

// Main init
initDate();
// Hapus cache localStorage lama — pure Supabase
const DB_KEY = 'zenot_db_v1'; // key lama, dihapus saat init
try { localStorage.removeItem(DB_KEY); } catch(e) {}
(async () => {
  await loadDB();
  await loadTokoList();
  await cleanChannelData();
  syncStokFromProduk();
  _syncAllDropdowns();
  renderNavUtama();
  renderDashboard();
  renderStok();
  renderHarga();
  renderChecks();
  populateJInduk();
  populateRsInduk();
  if (typeof initSkuPerformaToko === 'function') initSkuPerformaToko();
  if (localStorage.getItem('zenot_sidebar_collapsed')==='1') toggleSidebarCollapse();
  startAutoRefreshHarga(2);
})();

// ================================================================
// CHANNEL TAB & ASSIGN PRODUK KE CHANNEL
// ================================================================
function goChTab(id, el) {
  renderSplitPanel();
}

// ================================================================
// SPLIT PANEL — Channel + Assign Produk (halaman tunggal)
// ================================================================

let _splitActiveChannel = null;

function renderSplitPanel() {
  _renderSplitChannelList();
  const channels = window._tokoList;
  if (channels.length && !_splitActiveChannel) {
    _splitSelectChannel(channels[0].nama);
  } else if (_splitActiveChannel) {
    _splitSelectChannel(_splitActiveChannel);
  } else {
    const body = document.getElementById('ch-split-right-body');
    if (body) body.innerHTML = '<div class="ch-split-empty">Belum ada channel. Tambah channel dulu.</div>';
  }
}

// State accordion platform — default semua open
const _platformAccOpen = {};

function _renderSplitChannelList() {
  const list = document.getElementById('ch-split-channel-list');
  if (!list) return;
  const channels = window._tokoList;
  if (!channels.length) {
    list.innerHTML = '<div style="padding:20px 16px;color:var(--dusty);font-size:12px;">Belum ada channel.</div>';
    return;
  }

  // Group channels per platform, urutan tetap
  const platformOrder = ['Shopee','Lazada','TikTok Shop','Offline','Lainnya'];
  const grouped = {};
  platformOrder.forEach(p => grouped[p] = []);
  channels.forEach(ch => {
    const key = grouped[ch.platform] !== undefined ? ch.platform : 'Lainnya';
    grouped[key].push(ch);
  });

  const produkGroups = _buildProdukGroups();
  const allInduk = Object.keys(produkGroups);

  // Warna blush per platform — header lebih solid, item lebih tipis
  const platformBlush = {
    'Shopee':      'rgba(238,77,45,0.13)',
    'Lazada':      'rgba(15,20,109,0.11)',
    'TikTok Shop': 'rgba(28,28,30,0.10)',
    'Offline':     'rgba(140,140,140,0.10)',
    'Lainnya':     'rgba(140,123,107,0.10)',
  };
  const platformBlushItem = {
    'Shopee':      'rgba(238,77,45,0.04)',
    'Lazada':      'rgba(15,20,109,0.04)',
    'TikTok Shop': 'rgba(28,28,30,0.04)',
    'Offline':     'rgba(140,140,140,0.04)',
    'Lainnya':     'rgba(140,123,107,0.04)',
  };
  const platformDot = {
    'Shopee':      '#EE4D2D',
    'Lazada':      '#0F146D',
    'TikTok Shop': '#1C1C1E',
    'Offline':     '#8C8C8C',
    'Lainnya':     '#8C7B6B',
  };

  let html = '';
  platformOrder.forEach(platform => {
    const chList = grouped[platform];
    if (!chList.length) return;

    if (_platformAccOpen[platform] === undefined) _platformAccOpen[platform] = true;
    const isOpen = _platformAccOpen[platform];
    const dot = platformDot[platform];
    const blush = platformBlush[platform];
    const blushItem = platformBlushItem[platform];

    html += `
    <div class="ch-platform-group" data-platform="${platform}">
      <div class="ch-platform-header ${isOpen?'open':''}"
           style="background:${blush};"
           onclick="_togglePlatformAcc('${platform}')">
        <div class="ch-platform-header-left">
          <span class="ch-platform-dot" style="background:${dot};"></span>
          <span class="ch-platform-name">${platform}</span>
          <span class="ch-platform-count">${chList.length}</span>
        </div>
        <span class="ch-platform-chevron ${isOpen?'open':''}"></span>
      </div>
      <div class="ch-platform-body ${isOpen?'open':''}">
        ${chList.map(ch => {
          const aktif = allInduk.filter(induk => {
            const vars = produkGroups[induk]||[];
            return vars.some(p => {
              const t = p.toko||'semua';
              return t==='semua'||t.split(',').map(x=>x.trim()).includes(ch.nama);
            });
          }).length;
          const isActive = _splitActiveChannel === ch.nama ? ' active' : '';
          const statusDot = ch.status === 'Aktif'
            ? '<span class="ch-item-status-dot aktif"></span>'
            : '<span class="ch-item-status-dot nonaktif"></span>';
          return `<div class="ch-split-ch-item${isActive}" style="background:${blushItem};" onclick="_splitSelectChannel('${ch.nama}')">
            <div class="ch-split-ch-item-inner">
              ${statusDot}
              <div class="ch-split-ch-name">${ch.nama}</div>
            </div>
            <div class="ch-split-ch-counter">${aktif}/${allInduk.length} produk</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  });

  list.innerHTML = html;
}

function _togglePlatformAcc(platform) {
  _platformAccOpen[platform] = !_platformAccOpen[platform];
  _renderSplitChannelList();
  // Pertahankan active channel selection
  if (_splitActiveChannel) {
    document.querySelectorAll('.ch-split-ch-item').forEach(el => {
      el.classList.toggle('active', el.querySelector('.ch-split-ch-name')?.textContent === _splitActiveChannel);
    });
  }
}

function _buildProdukGroups() {
  const groups = {};
  // Gunakan getProdukFiltered() agar sinkron dengan toko aktif,
  // lalu filter produk arsip agar sinkron dengan halaman Kelola Produk
  const produkAktif = getProdukFiltered().filter(p => (p.status_produk || 'aktif') !== 'arsip');
  produkAktif.forEach(p => {
    if (!groups[p.induk]) groups[p.induk] = [];
    groups[p.induk].push(p);
  });
  return groups;
}

function _splitSelectChannel(chNama) {
  _splitActiveChannel = chNama;
  document.querySelectorAll('.ch-split-ch-item').forEach(el => {
    el.classList.toggle('active', el.querySelector('.ch-split-ch-name')?.textContent === chNama);
  });
  const ch = window._tokoList.find(t=>t.kode===chNama);
  if (!ch) return;

  // — Header 4 bagian —
  const titleEl   = document.getElementById('ch-split-right-title');
  const subEl     = document.getElementById('ch-split-right-sub');
  const counterEl = document.getElementById('ch-split-right-counter');
  const badge     = document.getElementById('ch-split-status-badge');

  if (titleEl) titleEl.textContent = chNama;

  // Platform badge — lebih besar
  const pStyle = _platformStyle(ch.platform);
  if (subEl) {
    subEl.innerHTML = `<span style="font-size:11px;padding:3px 11px;border-radius:20px;background:${pStyle.bg};color:${pStyle.color};font-weight:700;display:inline-block;letter-spacing:.3px;">${ch.platform}</span>`;
  }

  // Status badge
  if (badge) {
    badge.textContent = ch.status;
    badge.className = 'ch-split-status-badge' + (ch.status !== 'Aktif' ? ' nonaktif' : '');
  }

  // Counter — angka saja, besar
  const groups = _buildProdukGroups();
  const allInduk = Object.keys(groups);
  const aktif = allInduk.filter(induk => {
    const vars = groups[induk]||[];
    return vars.some(p => { const t=p.toko||'semua'; return t==='semua'||t.split(',').map(x=>x.trim()).includes(chNama); });
  }).length;
  if (counterEl) counterEl.textContent = aktif + '/' + allInduk.length;

  // Tombol di header kiri
  const toggleBtn = document.getElementById('ch-left-toggle-btn');
  const hapusBtn  = document.getElementById('ch-left-hapus-btn');
  const chIdx = window._tokoList.findIndex(t => t.kode === chNama);
  if (toggleBtn) {
    toggleBtn.style.display = chIdx >= 0 ? 'inline-block' : 'none';
    if (ch.status === 'Aktif') {
      toggleBtn.textContent = 'Nonaktifkan';
      toggleBtn.classList.remove('aktifkan');
    } else {
      toggleBtn.textContent = 'Aktifkan';
      toggleBtn.classList.add('aktifkan');
    }
    toggleBtn.dataset.idx = chIdx;
  }
  if (hapusBtn) {
    hapusBtn.style.display = chIdx >= 0 ? 'inline-block' : 'none';
    hapusBtn.dataset.idx = chIdx;
  }

  _renderSplitRightBody(chNama);

  // Reset panel varian
  const varianLabel = document.getElementById('ch-varian-induk-label');
  const varianBody  = document.getElementById('ch-panel-varian-body');
  if (varianLabel) varianLabel.textContent = '—';
  if (varianBody)  varianBody.innerHTML = '<div class="ch-split-empty">← Pilih produk</div>';
}

let _splitActiveInduk = null;

function _renderSplitRightBody(chNama) {
  const body = document.getElementById('ch-panel-produk-body') || document.getElementById('ch-split-right-body');
  if (!body) return;
  const groups = _buildProdukGroups();
  const indukList = Object.keys(groups).sort();
  if (!indukList.length) {
    body.innerHTML = '<div class="ch-split-empty">Belum ada produk. Tambah produk dulu.</div>';
    return;
  }

  const _isVarAktif = (p, chNama) => {
    const t = p.toko || 'semua';
    return t === 'semua' || t.split(',').map(x => x.trim()).includes(chNama);
  };

  const _isProdukAktifDiChannel = (induk, chNama) => {
    const vars = groups[induk] || [];
    return vars.some(p => _isVarAktif(p, chNama));
  };

  const _isProdukSemuaAktif = (induk, chNama) => {
    const vars = groups[induk] || [];
    return vars.length > 0 && vars.every(p => _isVarAktif(p, chNama));
  };

  const semuaAktif = indukList.length > 0 && indukList.every(induk => _isProdukSemuaAktif(induk, chNama));

  let html = `<div class="ch-split-activate-all">
    <span class="ch-split-activate-all-label">Aktifkan semua</span>
    <label class="ch-split-toggle">
      <input type="checkbox" id="ch-split-all-toggle" ${semuaAktif?'checked':''} onchange="_splitToggleAll('${chNama}', this.checked)">
      <div class="ch-split-toggle-track"></div>
    </label>
  </div>`;

  html += indukList.map(induk => {
    const vars = groups[induk];
    const semuaOn  = _isProdukSemuaAktif(induk, chNama);
    const sebagian = !semuaOn && _isProdukAktifDiChannel(induk, chNama);
    const isActiveInduk = _splitActiveInduk === induk ? ' ch-produk-row-active' : '';
    return `<div class="ch-split-produk-row${isActiveInduk}" onclick="_selectInduk('${induk}','${chNama}',this)">
      <div style="flex:1;min-width:0;">
        <div class="ch-split-produk-name">${induk}</div>
        <div class="ch-split-produk-varian">${vars.length} varian</div>
      </div>
      <label class="ch-split-toggle" onclick="event.stopPropagation()">
        <input type="checkbox" data-induk="${induk}" data-ch="${chNama}"
          ${semuaOn?'checked':''}
          ${sebagian?'data-indeterminate="true"':''}
          onchange="_splitToggleProduk('${induk}','${chNama}',this.checked)">
        <div class="ch-split-toggle-track${sebagian?' indeterminate':''}"></div>
      </label>
    </div>`;
  }).join('');

  body.innerHTML = html;

  // Apply indeterminate state ke checkbox
  body.querySelectorAll('input[data-indeterminate="true"]').forEach(cb => { cb.indeterminate = true; });
}

function _selectInduk(induk, chNama, rowEl) {
  _splitActiveInduk = induk;
  // Highlight active row
  document.querySelectorAll('.ch-split-produk-row').forEach(r => r.classList.remove('ch-produk-row-active'));
  if (rowEl) rowEl.classList.add('ch-produk-row-active');
  // Update label varian panel
  const label = document.getElementById('ch-varian-induk-label');
  if (label) label.textContent = induk;
  _renderVarianPanel(induk, chNama);
}

function _renderVarianPanel(induk, chNama) {
  const body = document.getElementById('ch-panel-varian-body');
  if (!body) return;
  const groups = _buildProdukGroups();
  const vars = groups[induk] || [];
  if (!vars.length) {
    body.innerHTML = '<div class="ch-split-empty">Tidak ada varian.</div>';
    return;
  }

  const _getStok = (varNama) => {
    const s = (DB.stok||[]).find(s => s.var === varNama);
    if (!s) return 0;
    return Math.max(0, (s.awal||0) + (s.masuk||0) - (s.keluar||0));
  };

  const _getStatus = (qty) => {
    if (qty === 0) return { label:'HABIS',  cls:'vsr-habis',  bar: 0 };
    if (qty <= 2)  return { label:'Kritis', cls:'vsr-kritis', bar: 20 };
    if (qty <= 5)  return { label:'Rendah', cls:'vsr-rendah', bar: 45 };
    return             { label:'Aman',   cls:'vsr-aman',   bar: 85 };
  };

  // Cari max stok untuk progress bar relatif
  const stokList = vars.map(p => _getStok(p.var));
  const maxStok  = Math.max(...stokList, 1);

  const html = vars.map(p => {
    const qty = _getStok(p.var);
    const { label, cls } = _getStatus(qty);
    const barPct = Math.round((qty / maxStok) * 100);
    const isHabis = qty === 0;
    return `<div class="ch-vsr-row ${cls}${isHabis?' ch-vsr-habis-row':''}">
      <div class="ch-vsr-left">
        <div class="ch-vsr-nama">${p.var}</div>
        <div class="ch-vsr-bar-wrap">
          <div class="ch-vsr-bar-fill ${cls}" style="width:${barPct}%"></div>
        </div>
      </div>
      <div class="ch-vsr-right">
        <span class="ch-vsr-qty ${cls}">${qty}<span class="ch-vsr-pc">pc</span></span>
        <span class="ch-vsr-badge ${cls}">${label}</span>
      </div>
    </div>`;
  }).join('');

  body.innerHTML = html;
}

function _splitToggleVarian(varNama, induk, chNama, val) {
  const groups = _buildProdukGroups();
  const allChannels = window._tokoList.map(t=>t.kode);
  const p = (groups[induk]||[]).find(p => p.var === varNama);
  if (!p) return;
  let tokoArr = (p.toko && p.toko !== 'semua')
    ? p.toko.split(',').map(x=>x.trim())
    : [...allChannels];
  if (val) {
    if (!tokoArr.includes(chNama)) tokoArr.push(chNama);
  } else {
    tokoArr = tokoArr.filter(t => t !== chNama);
  }
  p.toko = tokoArr.length === allChannels.length ? 'semua' : tokoArr.join(',');
  saveDB();
  // Re-render produk panel (update indeterminate state)
  _renderSplitRightBody(chNama);
  // Re-highlight active induk
  document.querySelectorAll('.ch-split-produk-row').forEach(r => {
    r.classList.toggle('ch-produk-row-active', r.querySelector('.ch-split-produk-name')?.textContent === induk);
  });
  // Refresh varian panel
  _renderVarianPanel(induk, chNama);
  // Update counter header
  _updateHeaderCounter(chNama);
  _renderSplitChannelList();
}


function _splitToggleProduk(induk, chNama, val) {
  // Tulis ke DB.produk.toko — single source of truth
  const groups = _buildProdukGroups();
  const allChannels = window._tokoList.map(t=>t.kode);
  (groups[induk]||[]).forEach(p => {
    let tokoArr = (p.toko && p.toko !== 'semua')
      ? p.toko.split(',').map(x=>x.trim())
      : [...allChannels];
    if (val) {
      if (!tokoArr.includes(chNama)) tokoArr.push(chNama);
    } else {
      tokoArr = tokoArr.filter(t => t !== chNama);
    }
    p.toko = tokoArr.length === allChannels.length ? 'semua' : tokoArr.join(',');
  });
  saveDB();
  _renderSplitRightBody(chNama);
  // Re-highlight active induk
  document.querySelectorAll('.ch-split-produk-row').forEach(r => {
    r.classList.toggle('ch-produk-row-active', r.querySelector('.ch-split-produk-name')?.textContent === _splitActiveInduk);
  });
  // Re-render varian kalau induk ini sedang aktif
  if (_splitActiveInduk === induk) _renderVarianPanel(induk, chNama);
  _renderSplitChannelList();
  _updateHeaderCounter(chNama);
}

function _splitToggleAll(chNama, val) {
  const groups = _buildProdukGroups();
  const allChannels = window._tokoList.map(t=>t.kode);
  Object.keys(groups).forEach(induk => {
    (groups[induk]||[]).forEach(p => {
      let tokoArr = (p.toko && p.toko !== 'semua')
        ? p.toko.split(',').map(x=>x.trim())
        : [...allChannels];
      if (val) {
        if (!tokoArr.includes(chNama)) tokoArr.push(chNama);
      } else {
        tokoArr = tokoArr.filter(t => t !== chNama);
      }
      p.toko = tokoArr.length === allChannels.length ? 'semua' : tokoArr.join(',');
    });
  });
  saveDB();
  _renderSplitRightBody(chNama);
  _renderSplitChannelList();
  document.querySelectorAll('.ch-split-ch-item').forEach(el => {
    el.classList.toggle('active', el.querySelector('.ch-split-ch-name')?.textContent === _splitActiveChannel);
  });
  _updateHeaderCounter(chNama);
  toast(val ? '✅ Semua produk diaktifkan!' : 'Semua produk dinonaktifkan');
}

function _persistAssign() {
  // Simpan ke localStorage sebagai cache offline
  try { localStorage.setItem('zenot_assign_channel', JSON.stringify(DB.assignChannel)); } catch(e) {}
  // Sync ke Supabase — simpan ke tabel produk_toko (proper table, bukan hack)
  if (SUPABASE_URL && DB.assignChannel) {
    _syncAssignToSupabase().catch(e => console.warn('[persistAssign]', e.message));
  }
}

async function _syncAssignToSupabase() {
  // Build rows: { var, toko_kode, aktif }
  const rows = [];
  for (const [var_, tokoMap] of Object.entries(DB.assignChannel || {})) {
    for (const [tokoKode, aktif] of Object.entries(tokoMap || {})) {
      rows.push({ var: var_, toko_kode: tokoKode, aktif: aktif === true });
    }
  }
  if (!rows.length) return;
  // Upsert ke produk_toko
  await _sbFetch(`${SUPABASE_URL}/rest/v1/produk_toko`, {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows)
  });
}

function _updateHeaderCounter(chNama) {
  const groups = _buildProdukGroups();
  const allInduk = Object.keys(groups);
  const aktif = allInduk.filter(induk => {
    const vars = groups[induk]||[];
    return vars.some(p => { const t=p.toko||'semua'; return t==='semua'||t.split(',').map(x=>x.trim()).includes(chNama); });
  }).length;
  const counterEl = document.getElementById('ch-split-right-counter');
  if (counterEl) counterEl.textContent = aktif + '/' + allInduk.length;
}

function _platformStyle(platform) {
  const map = {
    'Shopee':      { bg:'#EE4D2D', color:'#fff' },
    'Lazada':      { bg:'#0F146D', color:'#fff' },
    'TikTok Shop': { bg:'#1C1C1E', color:'#fff' },
    'Offline':     { bg:'#8C8C8C', color:'#fff' },
    'Lainnya':     { bg:'#8C7B6B', color:'#fff' },
  };
  return map[platform] || { bg:'#8C7B6B', color:'#fff' };
}

function _confirmHapusChannel() {
  if (!_splitActiveChannel) return;
  const namaEl = document.getElementById('ch-dialog-hapus-nama');
  if (namaEl) namaEl.textContent = '"' + _splitActiveChannel + '"';
  openModal('ch-dialog-hapus');
}
function _cancelHapusChannel() {
  closeModal('ch-dialog-hapus');
}
function _confirmExecHapus() {
  closeModal('ch-dialog-hapus');
  _splitHapusActive();
}

function _splitToggleActiveChannel() {
  const btn = document.getElementById('ch-left-toggle-btn');
  if (!btn) return;
  const idx = parseInt(btn.dataset.idx);
  _splitToggleStatus(idx);
}

function _splitToggleStatus(idx) {
  const tk=window._tokoList[idx]; if(!tk) return;
  tk.status = tk.status === 'aktif' ? 'nonaktif' : 'aktif';
  saveDB();
  _chRefreshList();
  renderSplitPanel();
  toast('Status ' + (window._tokoList[idx]?.kode||'') + ' diubah');
}

function _splitHapusActive() {
  if (!_splitActiveChannel) return;
  const idx = window._tokoList.findIndex(t => t.kode === _splitActiveChannel);
  if (idx < 0) return;
  _splitHapus(idx);
}

function _splitHapus(idx) {
  const ch = window._tokoList[idx];
  if (!ch) return;
  if (DB.assignChannel) {
    Object.keys(DB.assignChannel).forEach(induk => {
      if (DB.assignChannel[induk]) delete DB.assignChannel[induk][ch.nama];
    });
  }
  if (_splitActiveChannel === ch.nama) {
    _splitActiveChannel = null;
    // Reset panel kanan
    const toggleBtn = document.getElementById('ch-left-toggle-btn');
    const hapusBtn  = document.getElementById('ch-left-hapus-btn');
    if (toggleBtn) toggleBtn.style.display = 'none';
    if (hapusBtn)  hapusBtn.style.display  = 'none';
  }
  window._tokoList.splice(idx, 1);
  saveDB();
  _persistAssign();
  _chRefreshList();
  renderSplitPanel();
  toast('Channel ' + ch.nama + ' dihapus.');
}

function onAssignToggle() {}
async function saveAssignChannel() { _persistAssign(); toast('Assign channel tersimpan!'); }

// renderChannel tetap dihandle oleh fungsi di atas (renderChannel di app_core)

// ================================================================
// JURNAL TARGET GLOBAL — widget di bawah jurnal penjualan
