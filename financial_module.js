/* ═══════════════════════════════════════════════════════════════════
   financial_module.js — zenOt Operasional V2
   Rasio Keuangan, Rekap Tahunan, PDF Export, Override Panel
   Reads from: window.DB (app_core.js)
════════════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════════════════
// RK DATA STATE
// ═══════════════════════════════════════════════════════
let rkData = {
  income:null, order1:null, order2:null, ads:null,
  totalPendapatan:0, totalPenghasilan:0, hppTotal:0, oprTotal:0,
  adminTotal:0, amsTotal:0, iklanTotal:0, totalOrder:0, totalOrderLalu:0,
  varianCount:{}, jamCount:{}, kotaCount:{}, orderHarian:{}, orderHarianLalu:{},
  adminDetail:{},
};

// ═══════════════════════════════════════════════════════
// NAVIGASI RK
// ═══════════════════════════════════════════════════════
const rkTitles = {
  'rk-overview': 'Overview <span>Rasio Keuangan</span>',
  'rk-upload':   'Upload <span>&amp; Data</span>',
  'rk-rekap':    'Rekap <span>Tahunan</span>',
};

function goRK(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById('page-' + id);
  if (page) page.classList.add('active');
  if (el) el.classList.add('active');
  document.getElementById('ph').innerHTML = rkTitles[id] || id;
  if (id === 'rk-overview') {
    syncRKHppFromZenot();
    setTimeout(() => renderChartRK(rkData.orderHarian, rkData.orderHarianLalu), 100);
  }
}

function goRKByName(id) {
  goRK(id, null);
  document.querySelectorAll('.nav-item').forEach(n => {
    const oc = n.getAttribute('onclick') || '';
    if (oc.includes("'" + id + "'")) n.classList.add('active');
  });
}

// ═══════════════════════════════════════════════════════
// SYNC HPP FROM ZENOT DB
// ═══════════════════════════════════════════════════════
let hppMaster = [];

function syncRKHppFromZenot() {
  hppMaster = (typeof DB !== 'undefined') ? DB.produk.map(p => ({ refSku: p.var, hpp: p.hpp || 0, induk: p.induk || '' })) : [];
  const detail = document.getElementById('rk_st_hpp_detail');
  if (detail && hppMaster.length) detail.textContent = `${hppMaster.length} SKU tersedia dari Kelola Produk`;
}

function lookupHppByRef(val) {
  if (!val) return 0;
  const normalize = s => s.toString().trim().toUpperCase().replace(/\s+/g,'');
  const key = normalize(val);
  const found = hppMaster.find(h => normalize(h.refSku) === key);
  return found ? (found.hpp || 0) : 0;
}

// ═══════════════════════════════════════════════════════
// FORMAT HELPERS
// ═══════════════════════════════════════════════════════
function formatRKRibuan(el) {
  let v = el.value.replace(/\D/g,'');
  el.value = v ? parseInt(v).toLocaleString('id-ID') : '';
}

function parseRKNum(id) {
  const el = document.getElementById(id);
  return el ? parseInt(el.value.replace(/\D/g,'')) || 0 : 0;
}

// ═══════════════════════════════════════════════════════
// FILE UPLOAD / SHEETJS
// ═══════════════════════════════════════════════════════
function loadSheetJSRK(cb) {
  if (window.XLSX) { cb(); return; }
  const s = document.createElement('script');
  s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  s.onload = cb; document.head.appendChild(s);
}

function showFileName(inputEl, boxId) {
  const box = document.getElementById(boxId);
  if (inputEl.files[0] && box) {
    const sub = box.querySelector('.rk-upload-sub');
    if (sub) sub.textContent = inputEl.files[0].name;
  }
}

function setBoxUploaded(box, msg) {
  if (!box) return;
  box.classList.add('uploaded');
  const s = box.querySelector('.rk-upload-status');
  if (s) s.textContent = msg;
}

function toggleAdsManual() {
  const w = document.getElementById('adsManualWrap');
  if (w) w.style.display = w.style.display === 'none' ? 'block' : 'none';
}

function prosesAdsManual() {
  const v = document.getElementById('adsManualVal'); if (!v) return;
  const num = parseInt(v.value.replace(/\D/g,'')) || 0;
  rkData.iklanTotal = num; rkData.ads = num;
  const s = document.getElementById('statusAds'); if (s) s.textContent = num > 0 ? `Rp ${num.toLocaleString('id-ID')} (sudah PPN)` : 'Belum diisi';
  if (num > 0) setBoxUploaded(document.getElementById('boxAds'), `Rp ${num.toLocaleString('id-ID')}`);
}

function handleRasioUpload(type, input) {
  const file = input.files[0]; if (!file) return;
  if (type === 'ads') {
    const r = new FileReader();
    r.onload = e => {
      const lines = e.target.result.split('\n');
      let isiSaldoOtomatis = 0, isiSaldoDariPgh = 0, saldoIklan = 0;
      let dataStart = false;
      lines.forEach(l => {
        const cols = l.split(',');
        if (!dataStart) { if ((cols[0]||'').toString().trim().toLowerCase() === 'urutan') { dataStart = true; } return; }
        const deskripsi = (cols[2]||'').toString().trim();
        const jumlah = parseInt((cols[3]||'').toString().replace(/[^\\d\\-]/g,'')) || 0;
        if (deskripsi.includes('Isi Saldo Otomatis (dari Penghasilan)')) isiSaldoDariPgh += Math.abs(jumlah);
        else if (deskripsi.includes('Isi Saldo Otomatis')) isiSaldoOtomatis += Math.abs(jumlah);
        else if (deskripsi.includes('Saldo Iklan')) saldoIklan += Math.abs(jumlah);
      });
      const totalCashflow = isiSaldoOtomatis + isiSaldoDariPgh + saldoIklan;
      const totalPPN = Math.round(totalCashflow * 1.11);
      rkData.iklanTotal = totalPPN; rkData.ads = totalPPN;
      setBoxUploaded(document.getElementById('boxAds'), `✅ Rp ${totalPPN.toLocaleString('id-ID')}`);
      const s = document.getElementById('statusAds'); if (s) s.textContent = `Rp ${totalPPN.toLocaleString('id-ID')} (incl. PPN 11%)`;
      toast(`✅ Ads: Rp ${totalPPN.toLocaleString('id-ID')}`);
      updateRasioDashboard();
    };
    r.readAsText(file, 'UTF-8'); return;
  }
  loadSheetJSRK(() => {
    const r = new FileReader();
    r.onload = e => {
      const wb = XLSX.read(e.target.result, {type:'binary', cellDates:true});
      if (type === 'income') parseIncomeRK(wb);
      else if (type === 'order1') parseOrderRK(wb, 1);
      else if (type === 'order2') parseOrderRK(wb, 2);
      else if (type === 'performa') {
        setBoxUploaded(document.getElementById('boxPerforma'), '✅ Uploaded');
        const s = document.getElementById('statusPerforma'); if (s) s.textContent = 'Uploaded';
      }
    };
    r.readAsBinaryString(file);
  });
}

// ═══════════════════════════════════════════════════════
// PARSE INCOME XLSX
// ═══════════════════════════════════════════════════════
function parseIncomeRK(wb) {
  try {
    const summarySheet = wb.Sheets['Summary'] || wb.Sheets[wb.SheetNames[0]];
    const summaryRows = XLSX.utils.sheet_to_json(summarySheet, {header:1, defval:''});
    let totalPendapatan=0, totalDilepas=0, biayaIsiSaldo=0;
    let biayaKomisiAMS=0, biayaAdm=0, biayaLayanan=0, biayaProses=0;
    let premi=0, biayaHematKirim=0, biayaTransaksi=0, biayaKampanye=0;
    summaryRows.forEach(r => {
      const label = (r[0]||'').toString().trim().toLowerCase();
      const raw   = (r[1]||'').toString().replace(/[^\d\-]/g,'');
      const val   = parseInt(raw) || 0;
      if (label.includes('1. total pendapatan'))         totalPendapatan = val;
      else if (label.includes('3. total yang dilepas'))  totalDilepas    = val;
      else if (label.includes('biaya isi saldo otomatis')) biayaIsiSaldo = val;
      else if (label.includes('biaya komisi ams'))       biayaKomisiAMS  = val;
      else if (label.includes('biaya administrasi'))     biayaAdm        = val;
      else if (label.includes('biaya layanan'))          biayaLayanan    = val;
      else if (label.includes('biaya proses pesanan'))   biayaProses     = val;
      else if (label === 'premi')                         premi           = val;
      else if (label.includes('biaya program hemat'))    biayaHematKirim = val;
      else if (label.includes('biaya transaksi'))        biayaTransaksi  = val;
      else if (label.includes('biaya kampanye'))         biayaKampanye   = val;
    });
    if (!totalPendapatan) {
      const incomeSheet = wb.Sheets['Income'] || wb.Sheets[wb.SheetNames[0]];
      const incRows = XLSX.utils.sheet_to_json(incomeSheet, {header:1, defval:''});
      const header = (incRows[5]||[]).map(x => x.toString().trim());
      const ci = k => header.findIndex(h => h.toLowerCase().includes(k.toLowerCase()));
      const iHarga=ci('Harga Asli'), iDiskon=ci('Total Diskon'), iVoucher=ci('Voucher disponsor');
      const iIsiSaldo=ci('Biaya Isi Saldo'), iTotPgh=ci('Total Penghasilan');
      const iAMS=ci('Komisi AMS'), iAdm=ci('Administrasi'), iLyn=ci('Layanan'), iProses=ci('Proses Pesanan');
      const sumCol = idx => incRows.slice(6).reduce((s,r)=>{
        const v = typeof r[idx]==='number' ? r[idx] : (parseFloat((r[idx]||'').toString().replace(/[^\d\-\.]/g,''))||0);
        return s + v;
      }, 0);
      const harga=iHarga>=0?sumCol(iHarga):0, diskon=iDiskon>=0?sumCol(iDiskon):0, voucher=iVoucher>=0?sumCol(iVoucher):0;
      totalPendapatan = Math.abs(Math.round(harga+diskon+voucher));
      biayaIsiSaldo   = iIsiSaldo>=0?Math.round(sumCol(iIsiSaldo)):0;
      totalDilepas    = iTotPgh>=0?Math.round(sumCol(iTotPgh)):0;
      biayaKomisiAMS  = iAMS>=0?Math.round(sumCol(iAMS)):0;
      biayaAdm        = iAdm>=0?Math.round(sumCol(iAdm)):0;
      biayaLayanan    = iLyn>=0?Math.round(sumCol(iLyn)):0;
      biayaProses     = iProses>=0?Math.round(sumCol(iProses)):0;
    }
    const totalPenghasilan = Math.abs(totalDilepas) + Math.abs(biayaIsiSaldo);
    const adminTotal = Math.abs(biayaKomisiAMS)+Math.abs(biayaAdm)+Math.abs(biayaLayanan)+Math.abs(biayaProses)+Math.abs(premi)+Math.abs(biayaHematKirim)+Math.abs(biayaTransaksi)+Math.abs(biayaKampanye);
    rkData.totalPendapatan  = totalPendapatan  || rkData.totalPendapatan;
    rkData.totalPenghasilan = totalPenghasilan || rkData.totalPenghasilan;
    rkData.totalDilepas     = Math.abs(totalDilepas);
    rkData.biayaIsiSaldo    = Math.abs(biayaIsiSaldo);
    rkData.adminTotal       = adminTotal;
    rkData.adminDetail      = {biayaKomisiAMS,biayaAdm,biayaLayanan,biayaProses,premi,biayaHematKirim,biayaTransaksi,biayaKampanye};
    rkData.income           = true;
    setBoxUploaded(document.getElementById('boxIncome'), `✅ Income dilepas`);
    const s = document.getElementById('statusIncome'); if (s) s.textContent = `✅ Pendapatan: Rp ${totalPendapatan.toLocaleString('id-ID')}`;
    const d = document.getElementById('rk_st_income_detail'); if (d) d.textContent = `Rp ${totalPendapatan.toLocaleString('id-ID')}`;
    const st = document.getElementById('rk_st_income'); if (st) st.textContent = 'ok';
    const fPend = document.getElementById('rk_totalPendapatan'); const fCair = document.getElementById('rk_totalPenghasilan');
    if (fPend) fPend.value = totalPendapatan.toLocaleString('id-ID');
    if (fCair) fCair.value = totalPenghasilan.toLocaleString('id-ID');
    toast(`✅ Income! Pendapatan: Rp ${totalPendapatan.toLocaleString('id-ID')}`);
    updateRasioDashboard();
  } catch(e) { console.error(e); toast('Gagal baca Income xlsx','err'); }
}

// ═══════════════════════════════════════════════════════
// PARSE ORDER XLSX
// ═══════════════════════════════════════════════════════
function parseOrderRK(wb, num) {
  try {
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
    const h = (rows[0]||[]).map(x => x.toString().trim());
    const ci = keyword => h.findIndex(x => x.toLowerCase().includes(keyword.toLowerCase()));
    const iRef   = h.findIndex(x => x.includes('Nomor Referensi SKU'));
    const iQty   = h.findIndex(x => x.includes('Jumlah') && !x.includes('Produk di Pesan') && !x.includes('Berat'));
    const iKota  = h.findIndex(x => x.includes('Kota/Kabupaten'));
    const iWaktu = h.findIndex(x => x.includes('Waktu Pesanan Dibuat'));
    const iRefFb  = iRef >=0?iRef :ci('referensi');
    const iQtyFb  = iQty >=0?iQty :ci('jumlah');
    const iKotaFb = iKota>=0?iKota:ci('kota');
    const iWaktuFb= iWaktu>=0?iWaktu:ci('waktu');
    let totalOrder=0,totalQty=0,hppTot=0;
    const varianC={},jamC={},kotaC={},harian={};
    rows.slice(1).forEach(r => {
      if (!r||r.length===0) return;
      const sku = (r[iRefFb]||'').toString().trim().toUpperCase();
      const qty = parseInt(r[iQtyFb])||1;
      totalOrder++; totalQty+=qty;
      if (sku) varianC[sku]=(varianC[sku]||0)+qty;
      const hpp = lookupHppByRef(sku); hppTot+=hpp*qty;
      if (iKotaFb>=0&&r[iKotaFb]) { const k=r[iKotaFb].toString().trim(); if(k)kotaC[k]=(kotaC[k]||0)+1; }
      if (iWaktuFb>=0&&r[iWaktuFb]) {
        const waktuStr=r[iWaktuFb].toString().trim();
        const spaceIdx=waktuStr.indexOf(' ');
        if (spaceIdx>0) {
          const jamNum=parseInt(waktuStr.substring(spaceIdx+1,spaceIdx+3));
          if (!isNaN(jamNum)) { const jamKey=jamNum.toString().padStart(2,'0'); jamC[jamKey]=(jamC[jamKey]||0)+qty; }
        }
        const tglPart=spaceIdx>0?waktuStr.substring(0,spaceIdx):waktuStr;
        const dayStr=tglPart.substring(8,10);
        if (dayStr) harian[dayStr]=(harian[dayStr]||0)+qty;
      }
    });
    if (num===1) {
      rkData.totalOrder=totalOrder; rkData.totalQty=totalQty; rkData.order1=true;
      if (hppTot>0) rkData.hppTotal=hppTot;
      rkData.varianCount=varianC; rkData.jamCount=jamC; rkData.kotaCount=kotaC; rkData.orderHarian=harian;
      const d1=document.getElementById('rk_st_order1_detail'); if(d1)d1.textContent=`${totalOrder} pesanan · ${totalQty} item`;
      const st1=document.getElementById('rk_st_order1'); if(st1)st1.textContent='ok';
      const dh=document.getElementById('rk_st_hpp_detail'); if(dh)dh.textContent=hppTot>0?`Rp ${hppTot.toLocaleString('id-ID')} (${Object.keys(varianC).length} SKU)`:'⚠️ SKU tidak cocok';
      setBoxUploaded(document.getElementById('boxOrder1'),`✅ ${totalOrder} pesanan`);
      const s=document.getElementById('statusOrder1'); if(s)s.textContent=`✅ ${totalOrder} pesanan · HPP: Rp ${hppTot.toLocaleString('id-ID')}`;
      toast(`✅ Order bulan ini: ${totalOrder} pesanan`);
    } else {
      rkData.totalOrderLalu=totalOrder; rkData.order2=true; rkData.orderHarianLalu=harian;
      const d2=document.getElementById('rk_st_order2_detail'); if(d2)d2.textContent=`${totalOrder} pesanan · ${totalQty} item`;
      const st2=document.getElementById('rk_st_order2'); if(st2)st2.textContent='ok';
      setBoxUploaded(document.getElementById('boxOrder2'),`✅ ${totalOrder} pesanan`);
      const s=document.getElementById('statusOrder2'); if(s)s.textContent=`✅ ${totalOrder} pesanan`;
      toast(`✅ Order bulan lalu: ${totalOrder} pesanan`);
    }
    updateRasioDashboard();
  } catch(e) { toast('Gagal baca Order xlsx','err'); console.error(e); }
}

// ═══════════════════════════════════════════════════════
// PROSES & DASHBOARD
// ═══════════════════════════════════════════════════════
function prosesSemuaData() {
  if (!rkData.income&&!rkData.order1) { toast('Upload minimal Income atau Pesanan dulu!','err'); return; }
  const badge=document.getElementById('prosesStatusBadge');
  if (badge) { badge.style.display='block';badge.style.background='#f0fdf4';badge.style.color='#16a34a';badge.textContent='✅ Data berhasil diproses!'; }
  const detail=document.getElementById('prosesStatusDetail'); if(detail)detail.textContent='Lihat hasilnya di tab Overview';
  const chk=document.getElementById('prosesChecklist'); if(chk)chk.style.display='grid';
  ['income','order1','order2','ads'].forEach(k=>{
    const el=document.getElementById('chk_'+k); if(!el)return;
    el.style.background=rkData[k]?'#dcfce7':'#f5f5f5'; el.style.color=rkData[k]?'#16a34a':'#aaa';
    el.textContent=(rkData[k]?'✅':'⬜')+' '+el.textContent.slice(2);
  });
  updateRasioDashboard();
  renderVarianTerlarisRK(rkData.varianCount,rkData.totalOrder);
  renderJamRamaiRK(rkData.jamCount);
  renderKotaTerbanyakRK(rkData.kotaCount);
  renderChartRK(rkData.orderHarian,rkData.orderHarianLalu);
  const shortcut=document.getElementById('rk_uploadShortcutStatus');
  if(shortcut)shortcut.textContent=`Data ${document.getElementById('rk_periode')?.value||'—'} siap`;
  const btnPDF=document.getElementById('btnExportPDF');
  if(btnPDF){btnPDF.style.opacity='1';btnPDF.style.pointerEvents='auto';}
  toast('✅ Data Rasio Keuangan berhasil diproses!');
}

function updateRasioDashboard() {
  const p=document.getElementById('rk_periode')?.value||'—';
  const th=document.getElementById('rk_thPeriode'); if(th)th.textContent=p;
  const pend  = rkData.totalPendapatan || parseRKNum('rk_totalPendapatan');
  const cair  = rkData.totalPenghasilan || parseRKNum('rk_totalPenghasilan');
  const hpp   = rkData.hppTotal || parseRKNum('rk_hppTotal');
  const opr   = rkData.oprTotal || parseRKNum('rk_oprTotal');
  const iklan = rkData.iklanTotal || 0;
  const ord   = rkData.totalOrder || 0;
  const totalQty = rkData.totalQty || ord;
  if (!pend&&!cair) {
    const tb=document.getElementById('rk_tbody');
    if(tb)tb.innerHTML='<tr><td colspan="3" style="text-align:center;padding:30px;color:#bbb;">Upload data di tab Upload & Data</td></tr>';
    return;
  }
  const adminTotal = rkData.adminTotal || 0;
  const laba = cair - hpp - opr - iklan;
  const gpm  = pend>0?(pend-hpp)/pend*100:0;
  const npm_v= pend>0?laba/pend*100:0;
  const roas = iklan>0?pend/iklan:0;
  const acos = pend>0?iklan/pend*100:0;
  const pesanan = rkData.totalOrder||0;
  const aovAktual = pesanan>0?pend/pesanan:0;
  const basketAktual = pesanan>0?(rkData.totalQty||pesanan)/pesanan:0;
  const rp  = v => `Rp ${Math.round(v).toLocaleString('id-ID')}`;
  const pct = (v,b) => b>0?`${(v/b*100).toFixed(2)}%`:'—';
  const ad  = rkData.adminDetail || {};
  const adminRows = [
    ['Biaya Komisi AMS',                ad.biayaKomisiAMS  ||0],
    ['Biaya Administrasi',              ad.biayaAdm        ||0],
    ['Biaya Layanan',                   ad.biayaLayanan    ||0],
    ['Biaya Proses Pesanan',            ad.biayaProses     ||0],
    ['Premi',                           ad.premi           ||0],
    ['Biaya Program Hemat Biaya Kirim', ad.biayaHematKirim ||0],
    ['Biaya Transaksi',                 ad.biayaTransaksi  ||0],
    ['Biaya Kampanye',                  ad.biayaKampanye   ||0],
    ['Biaya Isi Saldo (dari Pgh)',      rkData.biayaIsiSaldo||0],
  ];
  const rows = [
    ['TOTAL ORDER',           pesanan>0?`${pesanan.toLocaleString()} pesanan`:'—','—'],
    ['TOTAL PENDAPATAN',      rp(pend),                                            '100%'],
    ['TOTAL PENGHASILAN',     rp(cair),                                            pct(cair,pend)],
    ['HPP',                   hpp>0?rp(hpp):'⚠ Belum ada (isi manual)',            hpp>0?pct(hpp,pend):'—'],
    ['OPERASIONAL',           rp(opr),                                             pct(opr,pend)],
    ['IKLAN',                 rp(iklan),                                           pct(iklan,pend)],
    ['RASIO ADMIN DAN LAYANAN',adminTotal>0?rp(adminTotal):'—',                   adminTotal>0?pct(adminTotal,pend):'—'],
    ...adminRows.map(x => ['  ↳ '+x[0], rp(Math.abs(x[1])), pct(Math.abs(x[1]),pend)]),
    ['AOV AKTUAL',            aovAktual>0?rp(aovAktual):'—',                       '—'],
    ['BASKET SIZE AKTUAL',    basketAktual>0?basketAktual.toFixed(1):'—',           '—'],
    ['ROAS AKTUAL',           roas>0?`${roas.toFixed(2)}×`:'—',                   '—'],
    ['ACOS AKTUAL',           acos>0?`${acos.toFixed(2)}%`:'—',                   '—'],
    ['Gros Profit Margin',    `${gpm.toFixed(2)}%`,                                '—'],
    ['Net Profit Margin',     `${npm_v.toFixed(2)}%`,                              '—'],
    ['LABA/RUGI',             rp(laba),                                            pct(Math.abs(laba),pend)],
  ];
  const tbody=document.getElementById('rk_tbody');
  if(tbody)tbody.innerHTML=rows.map((r,i)=>{
    const isSub=r[0].startsWith('  ↳');
    const isLaba=r[0]==='LABA/RUGI';
    const isWarn=r[0]==='HPP'&&hpp===0;
    const valColor=isLaba?(laba>=0?'#16a34a':'#dc2626'):isWarn?'#d97706':'#222';
    const rowBg=isSub?'#faf7f3':i%2===0?'#fafafa':'#fff';
    const pad=isSub?'4px 14px 4px 28px':'9px 14px';
    const fs=isSub?'0.80em':'0.88em';
    const fw=isSub?'500':'700';
    return `<tr style="background:${rowBg};border-bottom:1px solid #f0f0f0;">
      <td style="padding:${pad};font-size:${fs};font-weight:${fw};color:${isSub?'#666':'#222'}">${r[0]}</td>
      <td style="padding:${pad};text-align:right;font-family:monospace;font-size:${fs};font-weight:700;color:${valColor}">${r[1]}</td>
      <td style="padding:${pad};text-align:center;font-size:0.78em;color:#999">${r[2]}</td>
    </tr>`;
  }).join('');
  renderBepRK(cair,hpp,opr,iklan,ord);
  renderProyeksiRK(cair,hpp,opr,iklan,ord);
  renderTargetRK(cair,hpp,opr,iklan);
  renderGpmRoasRK(gpm,roas,npm_v,acos);
  const bdg=document.getElementById('statusKeuanganBadge');
  if(bdg){
    bdg.style.display='flex';
    if(laba>=0){bdg.style.background='#dcfce7';bdg.style.color='#16a34a';bdg.textContent='✅ PROFIT';}
    else{bdg.style.background='#fee2e2';bdg.style.color='#dc2626';bdg.textContent='⚠️ RUGI';}
  }
  updateKonversi();
}

function renderGpmRoasRK(gpm,roas,npm_v,acos){
  const el=document.getElementById('gpmRoasContent'); if(!el)return;
  const item=(label,val,color)=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;"><span style="font-size:.78em;color:#555;font-weight:600;">${label}</span><span style="font-size:.9em;font-weight:800;color:${color};">${val}</span></div>`;
  el.innerHTML=item('GPM Aktual',`${gpm.toFixed(2)}%`,gpm>=40?'#16a34a':gpm>=25?'#d97706':'#dc2626')+
    item('NPM Aktual',`${npm_v.toFixed(2)}%`,npm_v>=10?'#16a34a':npm_v>=5?'#d97706':'#dc2626')+
    item('ROAS Aktual',roas>0?`${roas.toFixed(2)}×`:'—',roas>=6.5?'#16a34a':roas>=4?'#d97706':'#dc2626')+
    item('ACOS Aktual',acos>0?`${acos.toFixed(2)}%`:'—',acos>0&&acos<=15?'#16a34a':acos<=25?'#d97706':'#dc2626')+
    item('GPM Target','≥ 40%','#3730a3')+item('ROAS Target','≥ 6.5×','#3730a3');
}

function renderBepRK(cair,hpp,opr,iklan,ord){
  const el=document.getElementById('bepVolumeContent'); if(!el||!ord)return;
  const hppPcs=hpp/ord,hargaNet=cair/ord,kontrib=hargaNet-hppPcs;
  const bep=kontrib>0?Math.ceil((opr+iklan)/kontrib):0;
  el.innerHTML=`<div style="text-align:center;padding:10px 0;"><div style="font-size:2em;font-weight:800;color:#dc2626;">${bep.toLocaleString()}</div><div style="font-size:.72em;color:#888;margin-top:2px;">pcs / bulan untuk BEP</div></div><div style="font-size:.75em;color:#666;line-height:1.9;"><div>HPP/pcs: <b>Rp ${Math.round(hppPcs).toLocaleString()}</b></div><div>Harga Net/pcs: <b>Rp ${Math.round(hargaNet).toLocaleString()}</b></div><div>Kontribusi/pcs: <b>Rp ${Math.round(kontrib).toLocaleString()}</b></div></div>`;
}

function renderProyeksiRK(cair,hpp,opr,iklan,ord){
  const el=document.getElementById('proyeksiLabaContent'); if(!el||!ord)return;
  const hppPcs=hpp/ord,hargaNet=cair/ord;
  el.innerHTML=[ord,Math.round(ord*1.2),Math.round(ord*1.5),Math.round(ord*2)].map(t=>{
    const laba=(hargaNet*t)-(hppPcs*t)-opr-iklan;
    return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f5f5f5;"><span style="font-size:.75em;color:#555;">${t.toLocaleString()} pcs</span><span style="font-size:.82em;font-weight:800;color:${laba>=0?'#16a34a':'#dc2626'};">Rp ${Math.round(laba).toLocaleString()}</span></div>`;
  }).join('');
}

function renderTargetRK(cair,hpp,opr,iklan){
  const el=document.getElementById('targetOrderContent'); if(!el||!rkData.totalOrder)return;
  const hargaNet=cair/rkData.totalOrder,hppPcs=hpp/rkData.totalOrder;
  el.innerHTML=[2000000,4000000,6000000,8000000].map(t=>{
    const needed=Math.ceil((t+opr+iklan)/(hargaNet-hppPcs));
    return `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid #f5f5f5;"><span style="font-size:.73em;color:#555;">Laba Rp ${(t/1000000).toFixed(0)} Jt</span><span style="font-size:.82em;font-weight:800;color:#7c3aed;">${needed.toLocaleString()} pcs</span></div>`;
  }).join('');
}

function updateKonversi(){
  const el=document.getElementById('rk_kunjungan'),res=document.getElementById('konversiResult');
  if(!el||!res)return;
  const kunjungan=parseInt(el.value.replace(/\D/g,''))||0,ord=rkData.totalOrder||0;
  if(!kunjungan||!ord){res.textContent='Isi jumlah kunjungan di atas';return;}
  const cr=(ord/kunjungan*100).toFixed(2);
  res.innerHTML=`<span style="font-size:1.1em;font-weight:800;color:${cr>=3?'#16a34a':cr>=1?'#d97706':'#dc2626'}">${cr}%</span><br><span style="font-size:.75em;color:#888;">${ord.toLocaleString()} order dari ${kunjungan.toLocaleString()} kunjungan</span>`;
}

// ═══════════════════════════════════════════════════════
// CHARTS
// ═══════════════════════════════════════════════════════
function renderVarianTerlarisRK(varianCount,totalOrder){
  const el=document.getElementById('varianList'); if(!el)return;
  const sorted=Object.entries(varianCount).sort((a,b)=>b[1]-a[1]).slice(0,5); if(!sorted.length)return;
  const max=sorted[0][1];
  el.innerHTML=sorted.map(([sku,qty])=>`<div style="padding:5px 12px;"><div style="display:flex;justify-content:space-between;font-size:.75em;margin-bottom:2px;"><span style="font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:140px;">${sku}</span><span style="font-weight:800;color:#ee4d2d;">${qty}</span></div><div style="height:4px;background:#f0f0f0;border-radius:2px;"><div style="height:100%;width:${(qty/max*100).toFixed(0)}%;background:#ee4d2d;border-radius:2px;"></div></div></div>`).join('');
}

function renderJamRamaiRK(jamCount){
  const el=document.getElementById('jamRamaiList'); if(!el)return;
  if(!jamCount||Object.keys(jamCount).length===0){el.innerHTML='<div style="text-align:center;padding:16px;color:#bbb;font-size:0.78em;">Upload pesanan untuk melihat jam ramai</div>';return;}
  const ranges=[{label:'00:00–05:59',jamul:[0,1,2,3,4,5]},{label:'06:00–10:59',jamul:[6,7,8,9,10]},{label:'11:00–14:59',jamul:[11,12,13,14]},{label:'15:00–18:59',jamul:[15,16,17,18]},{label:'19:00–22:59',jamul:[19,20,21,22]},{label:'23:00–23:59',jamul:[23]}];
  const rangeData=ranges.map(r=>{const total=r.jamul.reduce((s,j)=>s+(jamCount[String(j).padStart(2,'0')]||0),0);return{label:r.label,total};}).filter(r=>r.total>0).sort((a,b)=>b.total-a.total).slice(0,5);
  if(!rangeData.length)return;
  const max=rangeData[0].total;
  el.innerHTML=rangeData.map((r,i)=>{
    const pct=Math.round(r.total/max*100);
    const color=i===0?'#0d9488':i===1?'#14b8a6':'#5eead4';
    return `<div style="padding:6px 10px;margin-bottom:4px;"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px;"><span style="font-size:0.76em;font-weight:700;color:#222;">${r.label}${i===0?' 🔥':''}</span><span style="font-size:0.76em;font-weight:800;color:${color};">${r.total} order</span></div><div style="height:6px;background:#f0f0f0;border-radius:4px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${color};border-radius:4px;"></div></div></div>`;
  }).join('');
}

function renderKotaTerbanyakRK(kotaCount){
  const el=document.getElementById('kotaList'); if(!el)return;
  const sorted=Object.entries(kotaCount).sort((a,b)=>b[1]-a[1]).slice(0,8); if(!sorted.length)return;
  const max=sorted[0][1];
  el.innerHTML=sorted.map(([kota,cnt])=>`<div style="padding:3px 12px;"><div style="display:flex;justify-content:space-between;font-size:.73em;margin-bottom:2px;"><span style="font-weight:600;">${kota}</span><span style="font-weight:700;color:#7c3aed;">${cnt}</span></div><div style="height:4px;background:#f0f0f0;border-radius:2px;"><div style="height:100%;width:${(cnt/max*100).toFixed(0)}%;background:#7c3aed;border-radius:2px;"></div></div></div>`).join('');
}

function renderChartRK(harian,harianLalu){
  const canvas=document.getElementById('chartOrderHarian');
  const empty=document.getElementById('chartEmptyState');
  if(!canvas)return;
  const days=Array.from({length:31},(_,i)=>String(i+1).padStart(2,'0'));
  const d1=days.map(d=>(harian||{})[d]||0);
  const d2=days.map(d=>(harianLalu||{})[d]||0);
  if(d1.every(v=>v===0)){if(empty)empty.style.display='flex';return;}
  if(empty)empty.style.display='none';
  const drawChart=()=>{
    const parent=canvas.parentElement;
    const W=parent?parent.offsetWidth||600:600;
    const H=180;
    canvas.width=W;canvas.height=H;
    canvas.style.width=W+'px';canvas.style.height=H+'px';
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);
    const pad={t:14,r:12,b:28,l:34};
    const cw=W-pad.l-pad.r,ch=H-pad.t-pad.b;
    const max=Math.max(...d1,...d2,1);
    const bw=cw/31;
    const xOf=i=>pad.l+(i+0.5)*bw;
    const yOf=v=>pad.t+ch-(v/max)*ch;
    canvas._chartMeta={pad,cw,ch,max,bw,xOf,yOf,d1,d2,W,H};
    ctx.strokeStyle='#f0f0f0';ctx.lineWidth=1;
    [0.25,0.5,0.75,1].forEach(f=>{
      const y=pad.t+ch*(1-f);
      ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+cw,y);ctx.stroke();
      ctx.fillStyle='#bbb';ctx.font='9px sans-serif';ctx.textAlign='right';
      ctx.fillText(Math.round(max*f),pad.l-4,y+3);
    });
    if(d2.some(v=>v>0)){ctx.beginPath();ctx.strokeStyle='#cbd5e1';ctx.lineWidth=1.5;ctx.setLineDash([4,4]);d2.forEach((v,i)=>{i===0?ctx.moveTo(xOf(i),yOf(v)):ctx.lineTo(xOf(i),yOf(v));});ctx.stroke();ctx.setLineDash([]);}
    ctx.beginPath();d1.forEach((v,i)=>{i===0?ctx.moveTo(xOf(i),yOf(v)):ctx.lineTo(xOf(i),yOf(v));});ctx.lineTo(xOf(30),pad.t+ch);ctx.lineTo(xOf(0),pad.t+ch);ctx.closePath();
    const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+ch);grad.addColorStop(0,'rgba(238,77,45,0.18)');grad.addColorStop(1,'rgba(238,77,45,0)');ctx.fillStyle=grad;ctx.fill();
    ctx.beginPath();ctx.strokeStyle='#ee4d2d';ctx.lineWidth=2.5;ctx.lineJoin='round';d1.forEach((v,i)=>{i===0?ctx.moveTo(xOf(i),yOf(v)):ctx.lineTo(xOf(i),yOf(v));});ctx.stroke();
    d1.forEach((v,i)=>{if(v===0)return;ctx.beginPath();ctx.arc(xOf(i),yOf(v),3,0,Math.PI*2);ctx.fillStyle='#ee4d2d';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.stroke();});
    ctx.fillStyle='#aaa';ctx.font='9px sans-serif';ctx.textAlign='center';[1,5,10,15,20,25,31].forEach(d=>{ctx.fillText(d,xOf(d-1),H-6);});
  };
  requestAnimationFrame(drawChart);
}

// ═══════════════════════════════════════════════════════
// RESET & EXPORT
// ═══════════════════════════════════════════════════════
function resetRasio(){
  if(!confirm('Reset semua data Rasio Keuangan?'))return;
  rkData={income:null,order1:null,order2:null,ads:null,totalPendapatan:0,totalPenghasilan:0,hppTotal:0,oprTotal:0,adminTotal:0,amsTotal:0,iklanTotal:0,totalOrder:0,totalOrderLalu:0,varianCount:{},jamCount:{},kotaCount:{},orderHarian:{},orderHarianLalu:{},adminDetail:{}};
  ['boxIncome','boxOrder1','boxOrder2','boxAds','boxPerforma'].forEach(id=>{const b=document.getElementById(id);if(b)b.classList.remove('uploaded');});
  const tb=document.getElementById('rk_tbody');
  if(tb)tb.innerHTML='<tr><td colspan="3" style="text-align:center;padding:30px;color:#bbb;">Upload data di tab Upload & Data</td></tr>';
  toast('✅ Data Rasio Keuangan direset!');
}

function exportRasioPDF(){toast('Export PDF dalam pengembangan','err');}

function toggleOverridePanel(){
  const panel=document.getElementById('overridePanel'),chevron=document.getElementById('overrideChevron');
  if(!panel)return;
  const open=panel.style.display==='block';
  panel.style.display=open?'none':'block';
  if(chevron)chevron.style.transform=open?'':'rotate(180deg)';
}

// ═══════════════════════════════════════════════════════
// REKAP TAHUNAN
// ═══════════════════════════════════════════════════════
const REKAP_KEY='zenot_rk_rekap';
let rkRekapData=[];

function loadRekap(){
  try{rkRekapData=JSON.parse(localStorage.getItem(REKAP_KEY))||[];}catch(e){rkRekapData=[];}
  renderRekapTable();
}
function saveRekap(){localStorage.setItem(REKAP_KEY,JSON.stringify(rkRekapData));}

function tambahBulanRekap(){
  const nama=prompt('Nama bulan (cth: MARET 2026):');if(!nama)return;
  rkRekapData.push({nama,pendapatan:0,cair:0,hpp:0,opr:0,iklan:0,laba:0,order:0,roas:0,npm:0});
  saveRekap();renderRekapTable();
}
function hapusBulanRekap(idx){if(!confirm(`Hapus bulan "${rkRekapData[idx]?.nama}"?`))return;rkRekapData.splice(idx,1);saveRekap();renderRekapTable();}
function resetRekap(){if(!confirm('Reset semua rekap tahunan?'))return;rkRekapData=[];saveRekap();renderRekapTable();}

function updateRekapCell(idx,key,val){
  const num=parseInt(val.replace(/\D/g,''))||0;if(!rkRekapData[idx])return;
  rkRekapData[idx][key]=num;
  const r=rkRekapData[idx];
  r.laba=(r.cair||0)-(r.hpp||0)-(r.opr||0)-(r.iklan||0);
  r.roas=r.iklan>0?+(r.pendapatan/r.iklan).toFixed(2):0;
  r.npm=r.pendapatan>0?+(r.laba/r.pendapatan*100).toFixed(1):0;
  saveRekap();
  const labaEl=document.getElementById(`rekap_laba_${idx}`);if(labaEl){labaEl.value=r.laba.toLocaleString('id-ID');labaEl.style.color=r.laba>=0?'#16a34a':'#dc2626';}
  const roasEl=document.getElementById(`rekap_roas_${idx}`);if(roasEl)roasEl.value=r.roas.toLocaleString('id-ID');
  const npmEl=document.getElementById(`rekap_npm_${idx}`);if(npmEl)npmEl.value=r.npm.toLocaleString('id-ID');
}

function renderRekapTable(){
  const empty=document.getElementById('rekapEmpty'),thead=document.getElementById('rekapThead'),tbody=document.getElementById('rekapTbody');
  if(!thead||!tbody)return;
  if(!rkRekapData.length){if(empty)empty.style.display='block';thead.innerHTML='';tbody.innerHTML='';return;}
  if(empty)empty.style.display='none';
  const cols=[
    {key:'pendapatan',label:'Pendapatan'},{key:'cair',label:'Dana Cair'},{key:'hpp',label:'HPP Total'},
    {key:'opr',label:'Operasional'},{key:'iklan',label:'Biaya Iklan'},
    {key:'laba',label:'Laba Bersih',ro:true,colored:true},{key:'order',label:'Total Order'},
    {key:'roas',label:'ROAS',ro:true},{key:'npm',label:'NPM %',ro:true},
  ];
  thead.innerHTML=`<tr><th class="rekap-th-metrik">Metrik</th>${rkRekapData.map((b,i)=>`<th class="rekap-th-bulan">${b.nama}<br><button onclick="hapusBulanRekap(${i})" style="background:none;border:none;color:rgba(255,255,255,.4);cursor:pointer;font-size:.8em;">✕</button></th>`).join('')}</tr>`;
  tbody.innerHTML=cols.map((c,ci)=>`<tr class="${ci%2===0?'':'rekap-row-even'}"><td class="rekap-td-label">${c.label}</td>${rkRekapData.map((b,i)=>{const v=b[c.key]||0;const color=c.colored?(v>=0?'#16a34a':'#dc2626'):'';return`<td class="rekap-td-input"><input id="rekap_${c.key}_${i}" type="text" value="${v.toLocaleString('id-ID')}" ${c.ro?'readonly style="background:#f8f8f8;cursor:default;"':''} style="${color?`color:${color};`:''}" oninput="updateRekapCell(${i},'${c.key}',this.value)"></td>`;}).join('')}</tr>`).join('');
}

// ═══ INIT ═══
window.addEventListener('load', () => {
  loadRekap();
  syncRKHppFromZenot();
});
