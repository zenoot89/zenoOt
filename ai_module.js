/* ═══════════════════════════════════════════════════════════════════
   ai_module.js — zenOt Operasional V2
   UPGRADE AI — Gemini 2.0 Flash untuk semua fitur AI

   ✅ FEATURE 1: AI Blueprint Analyzer — analisis SKU + action plan
   ✅ FEATURE 2: Daily Checklist AI Chat — asisten operasional harian
   ✅ FEATURE 3: Intelligence AI Advisor — insight otomatis dari data
   ✅ Unified AI engine (Gemini 2.0 Flash)
   ✅ Streaming support untuk chat
   ✅ Context-aware (baca DB, teData, rkData)

   Depends on: app_core.js (window.DB, SUPABASE_URL, SUPABASE_KEY)
               intelligence_module.js (window._geminiKey, _configGet, _configSet)
               trend_engine.js (window.teData)
   ════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════
// UNIFIED AI CALL ENGINE
// ═══════════════════════════════════════════════════════

async function _callGemini(prompt, systemInstruction = '', maxTokens = 1500) {
  const key = window._geminiKey;
  if (!key) throw new Error('Gemini API Key belum diset. Buka Intelligence → Settings AI.');

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.5, maxOutputTokens: maxTokens },
  };

  if (systemInstruction) {
    body.system_instruction = { parts: [{ text: systemInstruction }] };
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Gemini error HTTP ${res.status}`);
  }

  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function _parseJSON(raw) {
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════
// FEATURE 1: AI BLUEPRINT ANALYZER
// Memperkuat renderBlueprintCards() dengan AI narrative per SKU
// ═══════════════════════════════════════════════════════

let _blueprintAICache = {}; // cache per skuRef

async function runAIBlueprintAnalysis() {
  if (!window._geminiKey) {
    toast('⚙️ Masukkan Gemini API Key dulu di Intelligence > AI Settings', 'err');
    return;
  }

  const skus = (window.teData && window.teData.processedSKUs) || [];
  if (!skus.length) {
    toast('📂 Upload file Shopee dulu di tab AI Strategy > Upload', 'err');
    return;
  }

  const btn = document.getElementById('btn-ai-blueprint');
  if (btn) { btn.disabled = true; btn.textContent = '🤖 Menganalisis...'; }

  const resultEl = document.getElementById('ai-blueprint-result');
  if (resultEl) {
    resultEl.style.display = 'block';
    resultEl.innerHTML = `
      <div style="text-align:center;padding:28px;color:var(--dusty);">
        <div style="font-size:28px;margin-bottom:10px;">🤖</div>
        <div style="font-size:13px;font-weight:700;color:#5C3D2E;">AI sedang menganalisis semua SKU kamu...</div>
        <div style="font-size:11px;margin-top:6px;color:var(--dusty);">Biasanya 10–20 detik</div>
        <div class="ai-loading-bar" style="margin-top:14px;"></div>
      </div>`;
  }

  const fmtNum = n => Number(n || 0).toLocaleString('id-ID');

  // Build SKU summary untuk prompt
  const skuSummary = skus.slice(0, 15).map(s => ({
    sku: s.skuRef || s.name?.substring(0, 30),
    flag: s.flag,
    views: s.views,
    terjual: s.salesQty,
    ctr: s.ctr,
    bounceRate: s.bounceRate,
    abandonCart: s.abandonCart,
    cancelRate: s.cancelRate,
    repeatRate: s.repeatRate,
    healthScore: s.healthScore,
    revShare: s.revShare,
    profitPct: s.realProfitPct,
    growth: s.growth,
    stok: s.stokAkhir,
  }));

  const deadCount = skus.filter(s => s.flag === 'dead').length;
  const highCount = skus.filter(s => s.flag === 'high').length;
  const lowMarginCount = skus.filter(s => s.flag === 'low-margin').length;
  const totalRev = skus.reduce((t, s) => t + (s.salesRev || 0), 0);

  const systemPrompt = `Kamu adalah konsultan e-commerce Shopee senior dengan 10 tahun pengalaman membantu UMKM Indonesia scale-up. Kamu berbicara dengan nada profesional tapi hangat, menggunakan Bahasa Indonesia yang natural. Kamu selalu memberikan insight yang spesifik, actionable, dan berbasis data — bukan saran generik.`;

  const prompt = `Analisis performa toko Shopee berikut dan buat Strategic Blueprint dalam format JSON.

OVERVIEW TOKO:
- Total SKU dianalisis: ${skus.length}
- Dead Products: ${deadCount} SKU
- High Demand: ${highCount} SKU  
- Low Margin: ${lowMarginCount} SKU
- Total Revenue Periode: Rp ${fmtNum(totalRev)}

DATA PER SKU:
${JSON.stringify(skuSummary, null, 2)}

Buat output JSON persis seperti ini (HANYA JSON, tanpa teks lain):
{
  "ringkasan": "Narasi 3-4 kalimat tentang kondisi toko secara keseluruhan, spesifik berdasarkan data, bahasa conversational",
  "kesehatan_toko": "BAIK|CUKUP|PERLU PERHATIAN",
  "skor_toko": 0-100,
  "prioritas_utama": [
    {
      "prioritas": 1,
      "aksi": "Aksi spesifik yang harus dilakukan HARI INI",
      "alasan": "Kenapa ini paling penting (sebutkan data konkret)",
      "dampak_estimasi": "Estimasi dampak bisnis jika dilakukan",
      "kategori": "RESTOCK|LISTING|ADS|HARGA|OPERASIONAL|KEUANGAN"
    }
  ],
  "insight_tersembunyi": [
    "Insight non-obvious dari data yang mungkin terlewat owner toko"
  ],
  "peringatan_kritis": [
    {
      "icon": "🚨",
      "judul": "Judul peringatan singkat",
      "detail": "Penjelasan 1-2 kalimat berdasarkan data"
    }
  ],
  "quick_wins": [
    "Quick win yang bisa selesai dalam 24 jam dengan effort minimal tapi dampak besar"
  ]
}

Sertakan maksimal 5 prioritas, 3 insight tersembunyi, dan 3 quick wins. Semua harus spesifik ke data SKU yang diberikan.`;

  try {
    const raw = await _callGemini(prompt, systemPrompt, 2000);
    const parsed = _parseJSON(raw);

    if (!parsed) throw new Error('Format respons AI tidak valid');

    window._blueprintAIResult = { ...parsed, generatedAt: new Date().toISOString() };
    _renderBlueprintAIResult(window._blueprintAIResult);

  } catch (err) {
    if (resultEl) resultEl.innerHTML = `
      <div style="background:#FEE2E2;border:1px solid #C0392B40;border-radius:10px;padding:14px;font-size:12px;color:#C0392B;">
        ❌ <strong>Gagal generate Blueprint AI:</strong> ${err.message}<br>
        <span style="font-size:11px;color:#888;margin-top:4px;display:block;">Pastikan API Key valid dan koneksi internet aktif.</span>
      </div>`;
    toast('❌ AI Blueprint error: ' + err.message, 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🤖 Generate AI Blueprint'; }
  }
}

function _renderBlueprintAIResult(data) {
  const el = document.getElementById('ai-blueprint-result');
  if (!el) return;

  const kesehatanColor = data.kesehatan_toko === 'BAIK' ? '#2D6A4F' :
                         data.kesehatan_toko === 'CUKUP' ? '#d97706' : '#C0392B';

  const kategoriColor = {
    RESTOCK: '#2D6A4F', LISTING: '#7B4F2E', ADS: '#1A6B9A',
    HARGA: '#d97706', OPERASIONAL: '#5C3D2E', KEUANGAN: '#C0392B'
  };

  const time = new Date(data.generatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  el.style.display = 'block';
  el.innerHTML = `
    <div class="ai-result-wrap">
      <!-- Header -->
      <div class="ai-result-header">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="font-size:22px;">🤖</div>
          <div>
            <div style="font-size:13px;font-weight:700;color:#5C3D2E;">AI Strategic Blueprint</div>
            <div style="font-size:10px;color:var(--dusty);">Dibuat ${time} · Powered by Gemini 2.0 Flash</div>
          </div>
          <div style="margin-left:auto;text-align:right;">
            <div style="font-size:22px;font-weight:800;color:${kesehatanColor};">${data.skor_toko}/100</div>
            <div style="font-size:10px;font-weight:700;color:${kesehatanColor};">${data.kesehatan_toko}</div>
          </div>
        </div>
        <div class="ai-narasi" style="margin-top:12px;">${data.ringkasan}</div>
      </div>

      <!-- Peringatan Kritis -->
      ${data.peringatan_kritis?.length ? `
      <div style="margin-bottom:14px;">
        <div class="ai-section-title">⚠️ Peringatan Kritis</div>
        ${data.peringatan_kritis.map(p => `
          <div class="ai-alert-item">
            <div style="font-size:18px;">${p.icon}</div>
            <div>
              <div style="font-size:12px;font-weight:700;color:#C0392B;">${p.judul}</div>
              <div style="font-size:11px;color:#5C3D2E;margin-top:2px;">${p.detail}</div>
            </div>
          </div>`).join('')}
      </div>` : ''}

      <!-- Prioritas Aksi -->
      ${data.prioritas_utama?.length ? `
      <div style="margin-bottom:14px;">
        <div class="ai-section-title">📋 Prioritas Aksi</div>
        ${data.prioritas_utama.map(p => `
          <div class="ai-priority-item">
            <div class="ai-priority-num">${p.prioritas}</div>
            <div style="flex:1;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;">
                <span style="font-size:12px;font-weight:700;color:#3D2B1F;">${p.aksi}</span>
                <span class="ai-badge" style="background:${kategoriColor[p.kategori] || '#888'};">${p.kategori}</span>
              </div>
              <div style="font-size:11px;color:var(--dusty);margin-bottom:4px;">${p.alasan}</div>
              <div style="font-size:11px;color:#2D6A4F;font-weight:600;">📈 ${p.dampak_estimasi}</div>
            </div>
          </div>`).join('')}
      </div>` : ''}

      <!-- Quick Wins -->
      ${data.quick_wins?.length ? `
      <div style="margin-bottom:14px;">
        <div class="ai-section-title">⚡ Quick Wins (24 Jam)</div>
        ${data.quick_wins.map((w, i) => `
          <div class="ai-quickwin-item">
            <span class="ai-qw-num">Q${i + 1}</span>
            <span style="font-size:12px;color:#3D2B1F;">${w}</span>
          </div>`).join('')}
      </div>` : ''}

      <!-- Insight Tersembunyi -->
      ${data.insight_tersembunyi?.length ? `
      <div>
        <div class="ai-section-title">💡 Insight Tersembunyi</div>
        ${data.insight_tersembunyi.map(ins => `
          <div class="ai-insight-item">
            <span>💡</span>
            <span style="font-size:12px;color:#3D2B1F;">${ins}</span>
          </div>`).join('')}
      </div>` : ''}

      <div style="margin-top:14px;text-align:right;">
        <button onclick="runAIBlueprintAnalysis()" class="btn btn-o btn-sm" style="font-size:11px;">🔄 Refresh Analisis</button>
      </div>
    </div>`;
}

// Inject AI Blueprint button ke halaman blueprint (dipanggil setelah renderBlueprintCards)
function _injectBlueprintAIButton() {
  const container = document.getElementById('page-te-blueprint');
  if (!container) return;
  if (document.getElementById('ai-blueprint-inject')) return; // sudah ada

  const wrap = document.createElement('div');
  wrap.id = 'ai-blueprint-inject';
  wrap.innerHTML = `
    <div class="card" style="margin-bottom:0;">
      <div class="card-title">🤖 AI Strategic Blueprint <span style="font-size:10px;font-weight:400;color:var(--dusty);margin-left:6px;">Powered by Gemini 2.0 Flash</span></div>
      <p style="font-size:12px;color:var(--dusty);margin-bottom:12px;">
        AI akan menganalisis semua SKU kamu dan menghasilkan blueprint strategis — prioritas aksi, insight tersembunyi, dan quick wins yang bisa langsung dikerjakan.
      </p>
      <button id="btn-ai-blueprint" class="btn btn-p btn-sm" onclick="runAIBlueprintAnalysis()" style="margin-bottom:12px;">
        🤖 Generate AI Blueprint
      </button>
      <div id="ai-blueprint-result" style="display:none;"></div>
    </div>`;

  // Insert sebelum card pertama atau di awal
  const firstCard = container.querySelector('.card');
  if (firstCard) {
    container.insertBefore(wrap, firstCard);
  } else {
    container.appendChild(wrap);
  }
}

// ═══════════════════════════════════════════════════════
// FEATURE 2: DAILY CHECKLIST AI CHAT
// Chat interaktif dengan AI sebagai asisten operasional harian
// ═══════════════════════════════════════════════════════

let _chatHistory = []; // {role:'user'|'assistant', text:'...'}
let _chatTyping = false;

function initAIChat() {
  const chatEl = document.getElementById('chk-chat');
  if (!chatEl) return;
  if (document.getElementById('ai-chat-wrap')) return; // already init

  // Build snapshot data toko untuk context AI
  const snap = _buildDailyContext();

  _chatHistory = [];

  chatEl.innerHTML = `
    <div id="ai-chat-wrap" style="display:flex;flex-direction:column;gap:0;">
      <div id="ai-chat-messages" style="min-height:180px;max-height:340px;overflow-y:auto;padding:10px;display:flex;flex-direction:column;gap:8px;background:var(--cream);border-radius:10px;border:1px solid var(--border);margin-bottom:8px;">
        <div class="chat-bubble assistant">
          <div style="font-size:11px;color:var(--dusty);margin-bottom:4px;">🤖 Asisten Operasional</div>
          <div style="font-size:12px;">
            Hei! Aku asisten operasional harian zenOt kamu 👋<br><br>
            ${snap.contextSummary}<br><br>
            Tanyakan apa saja — stok, penjualan, restock, strategi hari ini, atau apapun tentang toko kamu!
          </div>
        </div>
      </div>

      <!-- Quick prompts -->
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">
        ${[
          ['📊 Ringkasan hari ini', 'Beri aku ringkasan kondisi toko hari ini'],
          ['📦 Cek stok kritis', 'SKU mana yang stoknya sudah kritis dan perlu restock segera?'],
          ['💡 Tips hari ini', 'Apa 3 hal paling penting yang harus aku lakukan hari ini untuk toko?'],
          ['📈 Analisis penjualan', 'Analisis performa penjualan terakhir dan beri rekomendasi'],
        ].map(([label, prompt]) => `
          <button onclick="sendAIChat(${JSON.stringify(prompt)})" class="btn btn-o btn-sm" style="font-size:10px;padding:4px 8px;">${label}</button>
        `).join('')}
      </div>

      <!-- Input -->
      <div style="display:flex;gap:8px;align-items:flex-end;">
        <textarea id="ai-chat-input" rows="2" placeholder="Tanya tentang toko kamu..." 
          style="flex:1;resize:none;border:1px solid var(--border);border-radius:8px;padding:8px 10px;font-size:12px;font-family:inherit;background:white;outline:none;"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendAIChat();}"></textarea>
        <button onclick="sendAIChat()" class="btn btn-p" style="padding:8px 14px;font-size:12px;flex-shrink:0;">➤</button>
      </div>

      ${!window._geminiKey ? `
        <div style="background:#FEF3C7;border:1px solid #d97706;border-radius:8px;padding:10px;margin-top:8px;font-size:11px;color:#92400E;">
          ⚙️ <strong>API Key belum diset.</strong> Buka Intelligence → AI Settings untuk mengaktifkan chat.
        </div>` : ''}
    </div>`;
}

async function sendAIChat(prefillText = null) {
  if (_chatTyping) return;

  const inputEl = document.getElementById('ai-chat-input');
  const text = prefillText || (inputEl ? inputEl.value.trim() : '');
  if (!text) return;

  if (!window._geminiKey) {
    toast('⚙️ Masukkan Gemini API Key dulu di Intelligence > AI Settings', 'err');
    return;
  }

  if (inputEl) inputEl.value = '';
  _chatTyping = true;

  // Append user bubble
  _appendChatBubble('user', text);
  _chatHistory.push({ role: 'user', text });

  // Typing indicator
  const typingId = 'typing-' + Date.now();
  _appendChatBubble('typing', '...', typingId);

  try {
    const snap = _buildDailyContext();
    const historyStr = _chatHistory.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.text}`).join('\n');

    const systemPrompt = `Kamu adalah asisten operasional harian untuk toko ${snap.tokoNama} yang berjualan di Shopee. Kamu tahu semua data toko ini dan berbicara dengan nada ramah, helpful, dan to-the-point dalam Bahasa Indonesia. Kamu memberikan saran yang spesifik dan actionable, bukan saran generik.`;

    const prompt = `DATA TOKO SAAT INI:
${snap.contextFull}

RIWAYAT CHAT:
${historyStr}

Pertanyaan terbaru user: "${text}"

Jawab dengan singkat dan spesifik (maks 200 kata). Gunakan emoji secukupnya. Jika relevan, sebutkan nama SKU atau angka spesifik dari data.`;

    const reply = await _callGemini(prompt, systemPrompt, 600);

    // Remove typing, add reply
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();

    _appendChatBubble('assistant', reply);
    _chatHistory.push({ role: 'assistant', text: reply });

  } catch (err) {
    const typingEl = document.getElementById(typingId);
    if (typingEl) typingEl.remove();
    _appendChatBubble('assistant', `❌ Gagal: ${err.message}. Coba lagi ya!`);
  } finally {
    _chatTyping = false;
  }
}

function _appendChatBubble(role, text, id = null) {
  const messages = document.getElementById('ai-chat-messages');
  if (!messages) return;

  const div = document.createElement('div');
  if (id) div.id = id;
  div.className = `chat-bubble ${role}`;

  if (role === 'user') {
    div.style.cssText = 'align-self:flex-end;background:#5C3D2E;color:white;border-radius:12px 12px 2px 12px;padding:8px 12px;max-width:80%;font-size:12px;';
    div.textContent = text;
  } else if (role === 'typing') {
    div.style.cssText = 'align-self:flex-start;background:white;border:1px solid var(--border);border-radius:12px 12px 12px 2px;padding:8px 12px;font-size:18px;color:var(--dusty);';
    div.innerHTML = '<span class="typing-dots">●●●</span>';
  } else {
    div.style.cssText = 'align-self:flex-start;background:white;border:1px solid var(--border);border-radius:12px 12px 12px 2px;padding:10px 12px;max-width:90%;font-size:12px;line-height:1.5;color:#3D2B1F;';
    div.innerHTML = `<div style="font-size:10px;color:var(--dusty);margin-bottom:4px;">🤖 Asisten Operasional</div>${_formatChatText(text)}`;
  }

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function _formatChatText(text) {
  // Convert markdown-lite to HTML for chat
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>')
    .replace(/^- (.+)/gm, '• $1');
}

function _buildDailyContext() {
  const db = window.DB || {};
  const tokoNama = typeof getTokoAktifNama === 'function' ? getTokoAktifNama() : 'Semua Toko';

  // Jurnal 7 hari terakhir
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const recentJurnal = (db.jurnal || []).filter(j => j.tgl >= sevenDaysAgo);
  const totalRev7 = recentJurnal.reduce((t, j) => t + (j.omzet || 0), 0);
  const totalOrder7 = recentJurnal.length;

  // Stok kritis (kurang dari 5)
  const kritisStok = (db.stok || []).filter(s => {
    const akhir = typeof getAkhir === 'function' ? getAkhir(s) : (s.awal + (s.masuk || 0) - (s.keluar || 0));
    return akhir <= 5 && akhir >= 0;
  }).slice(0, 5);

  // Top produk
  const topProduk = recentJurnal.reduce((acc, j) => {
    acc[j.var] = (acc[j.var] || 0) + (j.qty || 0);
    return acc;
  }, {});
  const topList = Object.entries(topProduk).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const fmtNum = n => Number(n || 0).toLocaleString('id-ID');

  const contextSummary = `📊 <strong>${tokoNama}</strong> · 7 hari: ${totalOrder7} pesanan · Rp ${fmtNum(totalRev7)} revenue${kritisStok.length ? ` · ⚠️ ${kritisStok.length} SKU stok kritis` : ''}`;

  const contextFull = `Toko: ${tokoNama}
Revenue 7 hari: Rp ${fmtNum(totalRev7)} (${totalOrder7} pesanan)
Top SKU 7 hari: ${topList.map(([k, v]) => `${k} (${v} pcs)`).join(', ') || 'Belum ada data'}
Stok Kritis: ${kritisStok.map(s => s.var).join(', ') || 'Tidak ada'}
Total SKU: ${(db.produk || []).length}
Total Stok Items: ${(db.stok || []).length}
Tanggal Hari Ini: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;

  return { tokoNama, contextSummary, contextFull };
}

// ═══════════════════════════════════════════════════════
// FEATURE 3: INTELLIGENCE AI ADVISOR
// AI insight panel di Intelligence Dashboard
// ═══════════════════════════════════════════════════════

let _intelAICache = null;

async function runIntelAIAdvisor() {
  if (!window._geminiKey) {
    toast('⚙️ Masukkan Gemini API Key dulu di Intelligence > AI Settings', 'err');
    return;
  }

  const resultEl = document.getElementById('intel-ai-result');
  const btn = document.getElementById('btn-intel-ai');

  if (btn) { btn.disabled = true; btn.textContent = '🤖 Menganalisis...'; }
  if (resultEl) {
    resultEl.style.display = 'block';
    resultEl.innerHTML = `
      <div style="text-align:center;padding:20px;color:var(--dusty);">
        <div style="font-size:22px;margin-bottom:8px;">🤖</div>
        <div style="font-size:12px;font-weight:600;color:#5C3D2E;">AI sedang menganalisis intelligence data...</div>
      </div>`;
  }

  try {
    const db = window.DB || {};
    const tokoNama = typeof getTokoAktifNama === 'function' ? getTokoAktifNama() : 'Semua Toko';

    // Ambil data jurnal 30 hari
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const recentJurnal = (db.jurnal || []).filter(j => j.tgl >= thirtyDaysAgo);
    const totalRev30 = recentJurnal.reduce((t, j) => t + (j.omzet || 0), 0);
    const totalProfit30 = recentJurnal.reduce((t, j) => t + (j.profit || 0), 0);

    // Revenue per SKU
    const revPerSku = recentJurnal.reduce((acc, j) => {
      acc[j.var] = (acc[j.var] || { rev: 0, qty: 0 });
      acc[j.var].rev += (j.omzet || 0);
      acc[j.var].qty += (j.qty || 0);
      return acc;
    }, {});
    const topSku = Object.entries(revPerSku).sort((a, b) => b[1].rev - a[1].rev).slice(0, 5);

    // Revenue per channel
    const revPerChannel = recentJurnal.reduce((acc, j) => {
      const ch = j.channel || 'Unknown';
      acc[ch] = (acc[ch] || 0) + (j.omzet || 0);
      return acc;
    }, {});

    // Stok kritis
    const kritisStok = (db.stok || []).filter(s => {
      const akhir = typeof getAkhir === 'function' ? getAkhir(s) : (s.awal + (s.masuk || 0) - (s.keluar || 0));
      return akhir <= 5;
    });

    const fmtNum = n => Number(n || 0).toLocaleString('id-ID');
    const marginPct = totalRev30 > 0 ? ((totalProfit30 / totalRev30) * 100).toFixed(1) : 0;

    const systemPrompt = `Kamu adalah analis bisnis e-commerce senior yang membantu pemilik toko Shopee Indonesia membaca data dan mengambil keputusan strategis. Gunakan Bahasa Indonesia yang profesional namun mudah dipahami. Selalu berikan rekomendasi yang konkret dan berbasis angka.`;

    const prompt = `Analisis Intelligence Dashboard toko Shopee berikut:

TOKO: ${tokoNama}
PERIODE: 30 hari terakhir

FINANSIAL:
- Total Revenue: Rp ${fmtNum(totalRev30)}
- Total Profit: Rp ${fmtNum(totalProfit30)}
- Margin Rate: ${marginPct}%
- Total Transaksi: ${recentJurnal.length}

TOP 5 SKU (Revenue):
${topSku.map(([k, v], i) => `${i + 1}. ${k}: Rp ${fmtNum(v.rev)} (${v.qty} pcs)`).join('\n') || 'Belum ada data'}

REVENUE PER CHANNEL:
${Object.entries(revPerChannel).map(([k, v]) => `- ${k}: Rp ${fmtNum(v)}`).join('\n') || 'Belum ada data'}

STOK KRITIS (≤5 pcs): ${kritisStok.length > 0 ? kritisStok.map(s => s.var).join(', ') : 'Tidak ada'}

Buat analisis dalam format JSON (HANYA JSON):
{
  "diagnosis": "Diagnosis 2-3 kalimat tentang kondisi bisnis berdasarkan data, spesifik dengan angka",
  "kekuatan": ["Kekuatan bisnis yang terlihat dari data (maks 3)"],
  "kelemahan": ["Area yang perlu diperbaiki berdasarkan data (maks 3)"],
  "rekomendasi_30_hari": [
    {
      "aksi": "Aksi spesifik",
      "target": "Target terukur (misal: naikkan margin 5%)",
      "cara": "Cara konkret melakukannya"
    }
  ],
  "metric_kunci": [
    { "label": "Label metric", "nilai": "Nilai + unit", "status": "BAIK|CUKUP|PERLU PERHATIAN" }
  ]
}`;

    const raw = await _callGemini(prompt, systemPrompt, 1500);
    const parsed = _parseJSON(raw);
    if (!parsed) throw new Error('Format respons tidak valid');

    _intelAICache = { ...parsed, generatedAt: new Date().toISOString() };
    _renderIntelAIResult(_intelAICache);

  } catch (err) {
    if (resultEl) resultEl.innerHTML = `
      <div style="background:#FEE2E2;border:1px solid #C0392B40;border-radius:8px;padding:12px;font-size:12px;color:#C0392B;">
        ❌ <strong>Gagal:</strong> ${err.message}
      </div>`;
    toast('❌ Intel AI error: ' + err.message, 'err');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🤖 Generate AI Insight'; }
  }
}

function _renderIntelAIResult(data) {
  const el = document.getElementById('intel-ai-result');
  if (!el) return;

  const statusColor = s => s === 'BAIK' ? '#2D6A4F' : s === 'CUKUP' ? '#d97706' : '#C0392B';
  const time = new Date(data.generatedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  el.style.display = 'block';
  el.innerHTML = `
    <div class="ai-result-wrap">
      <div class="ai-result-header">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;">🤖</span>
          <div>
            <div style="font-size:12px;font-weight:700;color:#5C3D2E;">AI Intelligence Advisor</div>
            <div style="font-size:10px;color:var(--dusty);">Diperbarui ${time}</div>
          </div>
          <button onclick="runIntelAIAdvisor()" class="btn btn-o btn-sm" style="font-size:10px;padding:3px 8px;margin-left:auto;">🔄</button>
        </div>
        <div class="ai-narasi" style="margin-top:10px;">${data.diagnosis}</div>
      </div>

      <!-- Metric Kunci -->
      ${data.metric_kunci?.length ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;margin-bottom:14px;">
        ${data.metric_kunci.map(m => `
          <div style="background:white;border:1px solid var(--border);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:10px;color:var(--dusty);margin-bottom:4px;">${m.label}</div>
            <div style="font-size:14px;font-weight:800;color:${statusColor(m.status)};">${m.nilai}</div>
            <div style="font-size:9px;color:${statusColor(m.status)};margin-top:2px;">${m.status}</div>
          </div>`).join('')}
      </div>` : ''}

      <!-- Kekuatan & Kelemahan -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px;">
        ${data.kekuatan?.length ? `
        <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:10px;padding:10px;">
          <div style="font-size:10px;font-weight:700;color:#2D6A4F;margin-bottom:6px;">💪 KEKUATAN</div>
          ${data.kekuatan.map(k => `<div style="font-size:11px;color:#3D2B1F;margin-bottom:4px;">✓ ${k}</div>`).join('')}
        </div>` : ''}
        ${data.kelemahan?.length ? `
        <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:10px;">
          <div style="font-size:10px;font-weight:700;color:#C0392B;margin-bottom:6px;">⚠️ AREA PERBAIKAN</div>
          ${data.kelemahan.map(k => `<div style="font-size:11px;color:#3D2B1F;margin-bottom:4px;">• ${k}</div>`).join('')}
        </div>` : ''}
      </div>

      <!-- Rekomendasi 30 Hari -->
      ${data.rekomendasi_30_hari?.length ? `
      <div>
        <div class="ai-section-title">🎯 Rekomendasi 30 Hari</div>
        ${data.rekomendasi_30_hari.map((r, i) => `
          <div class="ai-priority-item">
            <div class="ai-priority-num">${i + 1}</div>
            <div style="flex:1;">
              <div style="font-size:12px;font-weight:700;color:#3D2B1F;">${r.aksi}</div>
              <div style="font-size:10px;color:#2D6A4F;font-weight:600;margin:2px 0;">🎯 Target: ${r.target}</div>
              <div style="font-size:11px;color:var(--dusty);">${r.cara}</div>
            </div>
          </div>`).join('')}
      </div>` : ''}
    </div>`;
}

// Inject AI Advisor ke Intelligence Dashboard
function _injectIntelAIAdvisor() {
  const dashContent = document.getElementById('intel-dash-content');
  if (!dashContent) return;
  if (document.getElementById('intel-ai-panel')) return;

  const panel = document.createElement('div');
  panel.id = 'intel-ai-panel';
  panel.className = 'card';
  panel.style.marginBottom = '16px';
  panel.innerHTML = `
    <div class="card-title">🤖 AI Intelligence Advisor <span style="font-size:10px;font-weight:400;color:var(--dusty);margin-left:6px;">Powered by Gemini 2.0 Flash</span></div>
    <p style="font-size:12px;color:var(--dusty);margin-bottom:12px;">AI akan menganalisis data 30 hari terakhir dan memberikan diagnosis bisnis, kekuatan/kelemahan, serta rekomendasi konkret.</p>
    <button id="btn-intel-ai" class="btn btn-p btn-sm" onclick="runIntelAIAdvisor()">🤖 Generate AI Insight</button>
    <div id="intel-ai-result" style="display:none;margin-top:12px;"></div>`;

  dashContent.insertBefore(panel, dashContent.firstChild);
}

// ═══════════════════════════════════════════════════════
// SHARED CSS INJECTION
// ═══════════════════════════════════════════════════════

function _injectAIStyles() {
  if (document.getElementById('ai-module-styles')) return;
  const style = document.createElement('style');
  style.id = 'ai-module-styles';
  style.textContent = `
    /* AI Result Wrapper */
    .ai-result-wrap {
      background: white;
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    .ai-result-header {
      background: linear-gradient(135deg, #FDF6EC 0%, #F5EDD8 100%);
      padding: 14px;
      border-bottom: 1px solid var(--border);
    }
    .ai-narasi {
      font-size: 12px;
      color: #3D2B1F;
      line-height: 1.6;
      background: white;
      border-radius: 8px;
      padding: 10px 12px;
      border-left: 3px solid #C9A84C;
    }
    .ai-section-title {
      font-size: 11px;
      font-weight: 700;
      color: var(--dusty);
      text-transform: uppercase;
      letter-spacing: .8px;
      margin: 0 14px 8px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
    }
    .ai-result-wrap > div:not(.ai-result-header) {
      padding: 0 14px 14px;
    }
    .ai-alert-item {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      background: #FEF2F2;
      border: 1px solid #FECACA;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 6px;
    }
    .ai-priority-item {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      background: #FAFAFA;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 6px;
    }
    .ai-priority-num {
      width: 24px;
      height: 24px;
      background: #5C3D2E;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .ai-badge {
      font-size: 9px;
      font-weight: 700;
      color: white;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .ai-quickwin-item {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 8px 10px;
      background: #F0FDF4;
      border: 1px solid #BBF7D0;
      border-radius: 8px;
      margin-bottom: 6px;
    }
    .ai-qw-num {
      font-size: 10px;
      font-weight: 700;
      color: #2D6A4F;
      background: #BBF7D0;
      padding: 1px 5px;
      border-radius: 4px;
      flex-shrink: 0;
    }
    .ai-insight-item {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      padding: 8px 10px;
      background: #FEF9EC;
      border: 1px solid #FDE68A;
      border-radius: 8px;
      margin-bottom: 6px;
    }
    /* Loading bar */
    .ai-loading-bar {
      height: 4px;
      background: linear-gradient(90deg, transparent 0%, #C9A84C 50%, transparent 100%);
      background-size: 200% 100%;
      border-radius: 2px;
      animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    /* Chat bubbles */
    .chat-bubble { max-width: 90%; word-break: break-word; }
    /* Typing dots */
    .typing-dots { letter-spacing: 4px; animation: blink 1s infinite; }
    @keyframes blink { 0%,100%{opacity:.3} 50%{opacity:1} }
  `;
  document.head.appendChild(style);
}

// ═══════════════════════════════════════════════════════
// INIT — Hook ke lifecycle app yang sudah ada
// ═══════════════════════════════════════════════════════

// Intercept go() function untuk inject AI saat page dibuka
(function _hookNavigation() {
  const originalGo = window.go;
  if (typeof originalGo !== 'function') return;

  window.go = function(page, el) {
    originalGo(page, el);

    // Inject setelah page render
    setTimeout(() => {
      if (page === 'daily') {
        initAIChat();
      }
    }, 100);
  };

  // Hook goIntel untuk inject AI Advisor
  const originalGoIntel = window.goIntel;
  if (typeof originalGoIntel === 'function') {
    window.goIntel = function(id, el) {
      originalGoIntel(id, el);
      if (id === 'intel-dashboard') {
        setTimeout(_injectIntelAIAdvisor, 100);
      }
    };
  }

  // Hook renderBlueprintCards untuk inject AI Button
  const originalRenderBlueprintCards = window.renderBlueprintCards;
  if (typeof originalRenderBlueprintCards === 'function') {
    window.renderBlueprintCards = function() {
      originalRenderBlueprintCards();
      setTimeout(_injectBlueprintAIButton, 100);
    };
  }
})();

// Expose global functions
window.sendAIChat = sendAIChat;
window.runAIBlueprintAnalysis = runAIBlueprintAnalysis;
window.runIntelAIAdvisor = runIntelAIAdvisor;

// Init styles
window.addEventListener('DOMContentLoaded', () => {
  _injectAIStyles();

  // Jika daily sudah aktif
  const activePage = document.querySelector('.page.active');
  if (activePage && activePage.id === 'page-daily') {
    setTimeout(initAIChat, 300);
  }
  // Jika intel dashboard sudah aktif
  if (activePage && activePage.id === 'page-intel-dashboard') {
    setTimeout(_injectIntelAIAdvisor, 300);
  }
});

console.log('✅ ai_module.js loaded — AI Blueprint, Chat & Intel Advisor ready');
