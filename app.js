/* =============================================================
   Magazzino Mirisa Ceramiche - logica dell'applicazione
   JavaScript vanilla, nessuna dipendenza. Tutti i dati restano
   nel browser (localStorage). La chiave Gemini viene inserita
   dall'utente nelle Impostazioni e non è mai scritta nel codice.
   ============================================================= */
'use strict';

/* ---------- Costanti ---------- */
const STORAGE_KEY = 'mirisa-magazzino-v1';          // prodotti, movimenti, personale
const SETTINGS_KEY = 'mirisa-magazzino-settings';   // chiave API e preferenze del dispositivo
const DEFAULT_MODEL = 'gemini-2.5-flash';
const MAX_FOTO_PX = 800;      // lato massimo delle foto articolo salvate in base64
const MAX_DOC_PX = 1800;      // lato massimo delle foto documento inviate all'IA

/* ---------- Utilità ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const fmtMq = n => new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(round2(n));
const fmtData = iso => new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
const isoGiorno = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** Escape HTML: tutto ciò che arriva dall'utente o dall'IA passa da qui prima di finire nel DOM. */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Converte i numeri scritti all'italiana ("1.234,56") o all'inglese ("1234.56"). */
function parseNumero(v) {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim().replace(/\s|m2|m²|mq/gi, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Notifica a comparsa. tipo: 'ok' | 'err' | '' */
function toast(msg, tipo = '') {
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260); }, tipo === 'err' ? 5000 : 3000);
}

/* ---------- Texture di esempio (SVG) per gli articoli precaricati ---------- */
function texture(tipo, c1, c2, c3) {
  let body = '';
  if (tipo === 'legno') {
    for (let i = 0; i < 6; i++) {
      const y = i * 50;
      body += `<rect y="${y}" width="400" height="48" fill="${i % 2 ? c1 : c2}"/>`;
      for (let k = 0; k < 4; k++) body += `<path d="M0 ${y + 10 + k * 9} Q100 ${y + 4 + k * 10} 200 ${y + 12 + k * 8} T400 ${y + 8 + k * 9}" stroke="${c3}" stroke-opacity=".35" fill="none"/>`;
      body += `<rect x="${(i * 137) % 400}" y="${y}" width="2" height="48" fill="${c3}" opacity=".5"/>`;
    }
  } else if (tipo === 'marmo') {
    body = `<rect width="400" height="300" fill="${c1}"/>`;
    body += `<path d="M-20 60 C80 90 120 30 220 110 S340 160 420 120" stroke="${c2}" stroke-width="3" fill="none" opacity=".7"/>`;
    body += `<path d="M-20 200 C60 170 160 260 250 200 S360 230 420 260" stroke="${c3}" stroke-width="1.5" fill="none" opacity=".8"/>`;
    body += `<path d="M120 -10 C140 80 90 150 160 310" stroke="${c2}" stroke-width="1" fill="none" opacity=".5"/>`;
  } else { // cemento / pietra
    body = `<rect width="400" height="300" fill="${c1}"/>`;
    for (let i = 0; i < 70; i++) body += `<circle cx="${(i * 53) % 400}" cy="${(i * 97) % 300}" r="${(i % 5) + 1}" fill="${i % 2 ? c2 : c3}" opacity=".35"/>`;
    body += `<path d="M0 150 H400 M200 0 V300" stroke="${c3}" stroke-width="2" opacity=".5"/>`;
  }
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice">${body}</svg>`);
}

/* ---------- Stato iniziale ---------- */
function statoIniziale() {
  const p = (codice, nome, categoria, tipologia, formato, mq, scorta, mqScatola, fornitore, foto) =>
    ({ id: uid(), codice, nome, categoria, tipologia, formato, mq, sogliaMin: scorta, mqScatola, fornitore, foto, creato: new Date().toISOString() });
  return {
    prodotti: [
      p('GRL-6012', 'Rovere Naturale', 'Pavimento', 'Effetto legno', '20x120', 142.56, 40, 1.44, 'Marazzi', texture('legno', '#c89c6d', '#b98a5b', '#7a5532')),
      p('GRL-2015', 'Noce Canaletto', 'Pavimento', 'Effetto legno', '20x150', 64.80, 30, 1.20, 'Ragno', texture('legno', '#7b5236', '#6a4630', '#3e2717')),
      p('GRL-1590', 'Larice Sbiancato', 'Pavimento', 'Effetto legno', '15x90', 18.90, 25, 1.08, 'Marazzi', texture('legno', '#e6d6c0', '#dccaae', '#a88f6d')),
      p('MRM-6060', 'Calacatta Oro Lucido', 'Pavimento e Rivestimento', 'Effetto marmo', '60x60', 96.12, 30, 1.44, 'Atlas Concorde', texture('marmo', '#f6f3ee', '#c9a96a', '#9c9a96')),
      p('MRM-3090', 'Statuario Venato', 'Rivestimento', 'Effetto marmo', '30x90', 54.00, 20, 1.35, 'Atlas Concorde', texture('marmo', '#fbfbfa', '#8f9399', '#b8bcc2')),
      p('MRM-1212', 'Nero Marquinia', 'Pavimento', 'Effetto marmo', '120x120', 0, 15, 2.88, 'Florim', texture('marmo', '#232323', '#e7e3dc', '#6f6f6f')),
      p('GRS-6060', 'Cemento Grigio Antracite', 'Pavimento', 'Gres porcellanato', '60x60', 210.24, 50, 1.44, 'Florim', texture('cemento', '#6e6d6b', '#4a4948', '#9a9894')),
      p('GRS-3060', 'Pietra di Trani', 'Pavimento e Rivestimento', 'Gres porcellanato', '30x60', 88.20, 30, 1.26, 'Ragno', texture('cemento', '#dcd2c2', '#bfb19b', '#f2ece2')),
      p('RIV-2525', 'Bianco Opaco Rettificato', 'Rivestimento', 'Gres porcellanato', '25x75', 36.56, 40, 1.13, 'Marazzi', texture('cemento', '#f3f1ed', '#dedad3', '#ffffff'))
    ],
    movimenti: [],
    staff: {
      Showroom: ['Nino', 'Operatore Showroom 1', 'Operatore Showroom 2'],
      Magazzino: ['Responsabile Magazzino', 'Magazziniere 1', 'Magazziniere 2']
    }
  };
}

/* ---------- Persistenza ---------- */
let state = caricaStato();
let settings = caricaSettings();

function caricaStato() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (Array.isArray(s.prodotti) && Array.isArray(s.movimenti)) {
        s.staff = s.staff || statoIniziale().staff;
        return s;
      }
    }
  } catch (e) { console.warn('Dati salvati non leggibili, riparto dai dati di esempio', e); }
  const s = statoIniziale();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (_) { /* storage non disponibile */ }
  return s;
}

function caricaSettings() {
  try { return { apiKey: '', model: DEFAULT_MODEL, ultimoOperatore: {}, vista: 'grid', ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
  catch (_) { return { apiKey: '', model: DEFAULT_MODEL, ultimoOperatore: {}, vista: 'grid' }; }
}

/** Salva lo stato. Restituisce false se il browser rifiuta (es. spazio esaurito per troppe foto). */
function salva() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    toast('Spazio di memoria esaurito: riduci o rimuovi alcune foto e riprova.', 'err');
    console.error(e);
    return false;
  }
}
function salvaSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (_) { /* ignorato */ }
}

const prodottoById = id => state.prodotti.find(p => p.id === id);

/** Registra un movimento e aggiorna la giacenza. delta è positivo per i carichi, negativo per gli scarichi. */
function registraMovimento({ tipo, prodotto, delta, reparto = '', operatore = '', cliente = '', fornitore = '', documento = '', note = '', fonte = 'manuale' }) {
  prodotto.mq = round2(prodotto.mq + delta);
  const mov = {
    id: uid(), tipo, prodottoId: prodotto.id, articolo: prodotto.nome, codice: prodotto.codice || '', formato: prodotto.formato || '',
    mq: round2(Math.abs(delta)), segno: delta >= 0 ? 1 : -1, reparto, operatore, cliente, fornitore, documento, note, fonte,
    data: new Date().toISOString(), giacenzaDopo: prodotto.mq
  };
  state.movimenti.push(mov);
  return mov;
}

/* =============================================================
   HEADER: orologio, stato, logo
   ============================================================= */
function initHeader() {
  const img = $('#logo-img');
  img.addEventListener('error', () => { img.hidden = true; $('#logo-fallback').hidden = false; });

  const tick = () => {
    const now = new Date();
    $('#clock').textContent = now.toLocaleTimeString('it-IT');
    $('#today').textContent = now.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
    $('#sc-timestamp').textContent = fmtData(now);
  };
  tick();
  setInterval(tick, 1000);

  const aggiornaStato = () => {
    const online = navigator.onLine;
    $('#status-pill').classList.toggle('offline', !online);
    $('#status-text').textContent = online ? 'Attivo' : 'Offline';
    $('#status-pill').title = online ? 'Online: dati salvati su questo dispositivo' : 'Offline: i dati restano salvati, l\'IA non è disponibile';
  };
  window.addEventListener('online', aggiornaStato);
  window.addEventListener('offline', aggiornaStato);
  aggiornaStato();
}

/* =============================================================
   SCHEDE
   ============================================================= */
function apriScheda(nome) {
  $$('.tab-btn').forEach(b => {
    const on = b.dataset.tab === nome;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on);
  });
  $$('.tab-panel').forEach(p => { p.hidden = p.id !== `tab-${nome}`; });
  if (nome === 'storico') renderStorico();
  if (nome === 'scarico') renderScarico();
  if (nome === 'carico') renderAiMode();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* =============================================================
   CATALOGO
   ============================================================= */
let filtroCategoria = 'Tutti';

function statoScorta(p) {
  if (p.mq <= 0) return { cls: 'stock-out', label: 'Esaurito' };
  if (p.mq < (p.sogliaMin || 0)) return { cls: 'stock-low', label: 'Sotto scorta' };
  return { cls: 'stock-ok', label: 'Disponibile' };
}

function renderFiltri() {
  const tipologie = [...new Set(state.prodotti.map(p => p.tipologia).filter(Boolean))].sort();
  const voci = ['Tutti', 'Pavimento', 'Rivestimento', ...tipologie, 'Sotto scorta'];
  if (!voci.includes(filtroCategoria)) filtroCategoria = 'Tutti';
  $('#filter-chips').innerHTML = voci.map(v => `<button class="chip ${v === filtroCategoria ? 'active' : ''}" data-filtro="${esc(v)}">${esc(v)}</button>`).join('');
  $('#tipologie-list').innerHTML = tipologie.map(t => `<option value="${esc(t)}">`).join('');
}

function prodottiFiltrati() {
  const q = norm($('#search').value);
  return state.prodotti.filter(p => {
    if (filtroCategoria === 'Pavimento' && !p.categoria.includes('Pavimento')) return false;
    if (filtroCategoria === 'Rivestimento' && !p.categoria.includes('Rivestimento')) return false;
    if (filtroCategoria === 'Sotto scorta' && p.mq >= (p.sogliaMin || 0)) return false;
    if (!['Tutti', 'Pavimento', 'Rivestimento', 'Sotto scorta'].includes(filtroCategoria) && p.tipologia !== filtroCategoria) return false;
    if (q && !norm([p.nome, p.codice, p.formato, p.tipologia, p.fornitore, p.categoria].join(' ')).includes(q)) return false;
    return true;
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
}

function renderCatalogo(flashId) {
  renderFiltri();
  const lista = prodottiFiltrati();
  const box = $('#catalog');
  box.className = settings.vista === 'list' ? 'catalog-list' : 'catalog-grid';
  $('#view-grid').classList.toggle('active', settings.vista !== 'list');
  $('#view-list').classList.toggle('active', settings.vista === 'list');

  box.innerHTML = lista.map(p => {
    const s = statoScorta(p);
    const foto = p.foto ? `style="background-image:url('${esc(p.foto)}')"` : '';
    return `
      <article class="card prod-card" data-id="${p.id}">
        <div class="prod-photo" ${foto}>
          ${p.foto ? '' : '<div class="w-full h-full grid place-items-center text-4xl opacity-40">🧱</div>'}
          <span class="prod-badge">${esc(p.tipologia || p.categoria)}</span>
          <span class="stock-badge ${s.cls}">${s.label}</span>
        </div>
        <div class="prod-body p-4 flex flex-col gap-2 flex-1">
          <div class="min-w-0 flex-1">
            <h3 class="font-bold leading-tight truncate" title="${esc(p.nome)}">${esc(p.nome)}</h3>
            <p class="text-xs text-grafite truncate">${esc([p.codice, p.formato && p.formato + ' cm', p.categoria].filter(Boolean).join(' · '))}</p>
          </div>
          <div class="flex items-end justify-between gap-2">
            <div>
              <span class="prod-mq ${flashId === p.id ? 'flash' : ''} ${p.mq <= 0 ? 'text-mirisa' : ''}">${fmtMq(p.mq)}</span>
              <span class="text-sm font-semibold text-grafite">m²</span>
              ${p.mqScatola ? `<div class="text-xs text-grafite">≈ ${Math.floor(p.mq / p.mqScatola)} scatole da ${fmtMq(p.mqScatola)} m²</div>` : ''}
            </div>
          </div>
          <div class="prod-actions flex gap-2 mt-1">
            <button class="btn btn-primary btn-sm flex-1" data-azione="scarica" ${p.mq <= 0 ? 'disabled' : ''}>Scarica</button>
            <button class="btn btn-ghost btn-sm" data-azione="modifica" aria-label="Modifica ${esc(p.nome)}">✏️</button>
          </div>
        </div>
      </article>`;
  }).join('');
  $('#catalog-empty').hidden = lista.length > 0;
  renderKpi();
}

function renderKpi() {
  const oggi = isoGiorno(new Date());
  $('#kpi-articoli').textContent = state.prodotti.length;
  $('#kpi-mq').textContent = fmtMq(state.prodotti.reduce((t, p) => t + Math.max(0, p.mq), 0));
  $('#kpi-scorta').textContent = state.prodotti.filter(p => p.mq < (p.sogliaMin || 0)).length;
  $('#kpi-oggi').textContent = state.movimenti.filter(m => isoGiorno(m.data) === oggi).length;
}

function initCatalogo() {
  $('#search').addEventListener('input', () => renderCatalogo());
  $('#filter-chips').addEventListener('click', e => {
    const b = e.target.closest('[data-filtro]');
    if (!b) return;
    filtroCategoria = b.dataset.filtro;
    renderCatalogo();
  });
  $('#view-grid').addEventListener('click', () => { settings.vista = 'grid'; salvaSettings(); renderCatalogo(); });
  $('#view-list').addEventListener('click', () => { settings.vista = 'list'; salvaSettings(); renderCatalogo(); });
  $('#btn-add-product').addEventListener('click', () => apriModaleProdotto());

  $('#catalog').addEventListener('click', e => {
    const card = e.target.closest('.prod-card');
    if (!card) return;
    const azione = e.target.closest('[data-azione]')?.dataset.azione;
    if (azione === 'scarica') {
      apriScheda('scarico');
      selezionaPerScarico(card.dataset.id);
    } else {
      apriModaleProdotto(card.dataset.id);
    }
  });
}

/* =============================================================
   MODALE ARTICOLO (aggiunta / modifica, con foto in base64)
   ============================================================= */
let fotoInModifica = '';
let prodottoInModifica = null;

/** Ridimensiona un'immagine e la restituisce come data URL JPEG (base64). */
function immagineInBase64(file, maxPx, qualita = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('File non leggibile'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Immagine non valida'));
      img.onload = () => {
        const scala = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scala);
        canvas.height = Math.round(img.height * scala);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', qualita));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function mostraFotoModale(src) {
  fotoInModifica = src || '';
  const img = $('#mp-foto-preview');
  img.hidden = !src;
  if (src) img.src = src; else img.removeAttribute('src');
  $('#mp-foto-hint').hidden = !!src;
  $('#mp-foto-remove').hidden = !src;
}

function apriModaleProdotto(id, prefill = {}) {
  const p = id ? prodottoById(id) : null;
  prodottoInModifica = p;
  const v = p || { nome: '', codice: '', formato: '', categoria: 'Pavimento', tipologia: '', mq: 0, sogliaMin: 20, mqScatola: '', fornitore: '', foto: '', ...prefill };
  $('#mp-title').textContent = p ? 'Modifica articolo' : 'Nuovo articolo';
  $('#mp-nome').value = v.nome;
  $('#mp-codice').value = v.codice || '';
  $('#mp-formato').value = v.formato || '';
  $('#mp-categoria').value = v.categoria || 'Pavimento';
  $('#mp-tipologia').value = v.tipologia || '';
  $('#mp-mq').value = v.mq ?? 0;
  $('#mp-scorta').value = v.sogliaMin ?? 0;
  $('#mp-mqscatola').value = v.mqScatola || '';
  $('#mp-fornitore').value = v.fornitore || '';
  $('#mp-delete').hidden = !p;
  $('#mp-mq-hint').hidden = !p;
  $('#mp-nome').classList.remove('invalid');
  mostraFotoModale(v.foto);
  $('#modal-prodotto').showModal();
}

function initModaleProdotto() {
  $('#mp-foto').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try { mostraFotoModale(await immagineInBase64(file, MAX_FOTO_PX)); }
    catch (err) { toast(err.message, 'err'); }
  });
  $('#mp-foto-remove').addEventListener('click', () => mostraFotoModale(''));

  $('#mp-delete').addEventListener('click', () => {
    const p = prodottoInModifica;
    if (!p || !confirm(`Eliminare "${p.nome}" dal catalogo?\nLo storico dei movimenti resta consultabile.`)) return;
    state.prodotti = state.prodotti.filter(x => x.id !== p.id);
    salva();
    $('#modal-prodotto').close();
    aggiornaTutto();
    toast('Articolo eliminato');
  });

  $('#form-prodotto').addEventListener('submit', e => {
    e.preventDefault();
    const nome = $('#mp-nome').value.trim();
    if (!nome) { $('#mp-nome').classList.add('invalid'); $('#mp-nome').focus(); return; }

    const dati = {
      nome,
      codice: $('#mp-codice').value.trim(),
      formato: $('#mp-formato').value.trim(),
      categoria: $('#mp-categoria').value,
      tipologia: $('#mp-tipologia').value.trim(),
      sogliaMin: round2(parseNumero($('#mp-scorta').value)),
      mqScatola: round2(parseNumero($('#mp-mqscatola').value)) || '',
      fornitore: $('#mp-fornitore').value.trim(),
      foto: fotoInModifica
    };
    const nuovaGiacenza = Math.max(0, round2(parseNumero($('#mp-mq').value)));
    const backup = JSON.stringify(state);
    let p = prodottoInModifica;

    if (p) {
      Object.assign(p, dati);
      const delta = round2(nuovaGiacenza - p.mq);
      if (delta !== 0) registraMovimento({ tipo: 'rettifica', prodotto: p, delta, note: 'Rettifica manuale da scheda articolo', operatore: 'Scheda articolo' });
    } else {
      p = { id: uid(), ...dati, mq: 0, creato: new Date().toISOString() };
      state.prodotti.push(p);
      if (nuovaGiacenza > 0) registraMovimento({ tipo: 'carico', prodotto: p, delta: nuovaGiacenza, note: 'Giacenza iniziale', operatore: 'Scheda articolo' });
    }

    if (!salva()) { state = JSON.parse(backup); return; }
    $('#modal-prodotto').close();
    aggiornaTutto(p.id);
    toast(prodottoInModifica ? 'Articolo aggiornato' : 'Articolo aggiunto al catalogo', 'ok');
    if (onProdottoCreato) { onProdottoCreato(p); onProdottoCreato = null; }
  });
}

/* =============================================================
   SCARICO MERCE
   ============================================================= */
let repartoScarico = 'Showroom';

function opzioniOperatori(select, reparto) {
  const nomi = reparto ? state.staff[reparto] || [] : [...new Set([...state.staff.Magazzino, ...state.staff.Showroom])];
  const ultimo = settings.ultimoOperatore[reparto || 'carico'];
  select.innerHTML = '<option value="">Seleziona operatore…</option>' +
    nomi.map(n => `<option ${n === ultimo ? 'selected' : ''}>${esc(n)}</option>`).join('');
}

function renderScarico() {
  const sel = $('#sc-prodotto');
  const scelto = sel.value;
  const q = norm($('#sc-search').value);
  const lista = state.prodotti
    .filter(p => !q || norm([p.nome, p.codice, p.formato, p.tipologia].join(' ')).includes(q))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'it'));
  sel.innerHTML = '<option value="">Seleziona articolo…</option>' + lista.map(p =>
    `<option value="${p.id}" ${p.mq <= 0 ? 'disabled' : ''}>${esc(p.nome)}${p.formato ? ' · ' + esc(p.formato) : ''} — ${fmtMq(p.mq)} m²${p.mq <= 0 ? ' (esaurito)' : ''}</option>`).join('');
  if (lista.some(p => p.id === scelto)) sel.value = scelto;
  else if (lista.length === 1 && lista[0].mq > 0) sel.value = lista[0].id;

  $$('[data-reparto]').forEach(b => b.classList.toggle('active', b.dataset.reparto === repartoScarico));
  const opPrima = $('#sc-operatore').value;
  opzioniOperatori($('#sc-operatore'), repartoScarico);
  if (opPrima && [...$('#sc-operatore').options].some(o => o.value === opPrima)) $('#sc-operatore').value = opPrima;

  const clienti = [...new Set(state.movimenti.filter(m => m.cliente).map(m => m.cliente))].slice(-200);
  $('#clienti-list').innerHTML = clienti.map(c => `<option value="${esc(c)}">`).join('');

  renderAnteprimaScarico();
  renderUltimiScarichi();
}

function renderAnteprimaScarico() {
  const p = prodottoById($('#sc-prodotto').value);
  const box = $('#sc-preview');
  const quick = $('#sc-quick');
  if (!p) { box.innerHTML = ''; quick.innerHTML = ''; return; }
  const s = statoScorta(p);
  box.innerHTML = `
    <div class="flex items-center gap-3 p-3 rounded-xl bg-sabbia-50 border border-sabbia-200">
      <div class="mini-thumb" style="${p.foto ? `background-image:url('${esc(p.foto)}')` : ''}"></div>
      <div class="flex-1 min-w-0">
        <div class="font-bold truncate">${esc(p.nome)}</div>
        <div class="text-xs text-grafite truncate">${esc([p.codice, p.formato, p.tipologia].filter(Boolean).join(' · '))}</div>
      </div>
      <div class="text-right">
        <div class="text-xl font-extrabold tabular-nums">${fmtMq(p.mq)} m²</div>
        <span class="stock-badge ${s.cls}" style="position:static">${s.label}</span>
      </div>
    </div>`;
  // Scorciatoie: scatole intere e "tutto"
  const btn = (label, val) => `<button type="button" class="chip" data-mq="${val}">${label}</button>`;
  let html = '';
  if (p.mqScatola) [1, 5, 10].forEach(n => { if (n * p.mqScatola <= p.mq) html += btn(`${n} scat. (${fmtMq(n * p.mqScatola)})`, round2(n * p.mqScatola)); });
  html += btn('Tutto', p.mq);
  quick.innerHTML = html;
}

function renderUltimiScarichi() {
  const ultimi = state.movimenti.filter(m => m.tipo === 'scarico').slice(-8).reverse();
  $('#sc-ultimi').innerHTML = ultimi.length ? ultimi.map(m => `
    <li class="p-3 rounded-xl bg-sabbia-50 border border-sabbia-200">
      <div class="flex justify-between gap-2"><b class="truncate">${esc(m.articolo)}</b><b class="text-mirisa tabular-nums whitespace-nowrap">−${fmtMq(m.mq)} m²</b></div>
      <div class="text-xs text-grafite">${esc(m.cliente)} · ${esc(m.operatore)} (${esc(m.reparto)})</div>
      <div class="text-xs text-grafite">${fmtData(m.data)}</div>
    </li>`).join('') : '<li class="empty">Ancora nessuno scarico.</li>';
}

function selezionaPerScarico(id) {
  $('#sc-search').value = '';
  renderScarico();
  $('#sc-prodotto').value = id;
  renderAnteprimaScarico();
  $('#sc-mq').focus();
}

function initScarico() {
  $('#sc-search').addEventListener('input', renderScarico);
  $('#sc-prodotto').addEventListener('change', renderAnteprimaScarico);
  $$('[data-reparto]').forEach(b => b.addEventListener('click', () => { repartoScarico = b.dataset.reparto; renderScarico(); }));
  $('#sc-quick').addEventListener('click', e => {
    const b = e.target.closest('[data-mq]');
    if (b) $('#sc-mq').value = b.dataset.mq;
  });

  $('#form-scarico').addEventListener('submit', e => {
    e.preventDefault();
    $$('#form-scarico .invalid').forEach(x => x.classList.remove('invalid'));
    const p = prodottoById($('#sc-prodotto').value);
    const mq = round2(parseNumero($('#sc-mq').value));
    const operatore = $('#sc-operatore').value;
    const cliente = $('#sc-cliente').value.trim();

    const errore = (sel, msg) => { $(sel).classList.add('invalid'); $(sel).focus(); toast(msg, 'err'); };
    if (!p) return errore('#sc-prodotto', 'Seleziona un articolo.');
    if (mq <= 0) return errore('#sc-mq', 'Inserisci i m² da scaricare.');
    if (mq > p.mq) return errore('#sc-mq', `Giacenza insufficiente: disponibili ${fmtMq(p.mq)} m².`);
    if (!operatore) return errore('#sc-operatore', 'Seleziona l\'operatore.');
    if (!cliente) return errore('#sc-cliente', 'Inserisci il nome del cliente.');

    const backup = JSON.stringify(state);
    registraMovimento({ tipo: 'scarico', prodotto: p, delta: -mq, reparto: repartoScarico, operatore, cliente, note: $('#sc-note').value.trim() });
    if (!salva()) { state = JSON.parse(backup); return; }

    settings.ultimoOperatore[repartoScarico] = operatore;
    salvaSettings();
    toast(`Scaricati ${fmtMq(mq)} m² di ${p.nome}. Restano ${fmtMq(p.mq)} m².`, 'ok');
    $('#sc-mq').value = '';
    $('#sc-cliente').value = '';
    $('#sc-note').value = '';
    aggiornaTutto(p.id);
  });
}

/* =============================================================
   CARICO SMART (IA Gemini o simulazione)
   ============================================================= */
let documento = null;   // { nome, mime, base64, anteprima }
let righe = [];         // righe in attesa di conferma
let onProdottoCreato = null; // callback quando si crea un articolo da una riga

function renderAiMode() {
  const box = $('#ai-mode');
  if (settings.apiKey) {
    box.className = 'ai-mode live';
    box.innerHTML = `✅ IA Gemini attiva <span class="font-normal">(${esc(settings.model || DEFAULT_MODEL)})</span>`;
  } else {
    box.className = 'ai-mode sim';
    box.innerHTML = '⚠️ Modalità simulata: inserisci la chiave Gemini in <button type="button" class="underline" id="ai-open-settings">Impostazioni</button> per leggere davvero i documenti.';
    $('#ai-open-settings').addEventListener('click', apriImpostazioni);
  }
  if (!$('#ca-operatore').options.length) opzioniOperatori($('#ca-operatore'), '');
}

async function caricaDocumento(file) {
  if (!file) return;
  const isPdf = file.type === 'application/pdf';
  if (!isPdf && !file.type.startsWith('image/')) return toast('Formato non supportato: usa una foto o un PDF.', 'err');
  if (file.size > 15 * 1024 * 1024) return toast('File troppo grande (max 15 MB).', 'err');
  try {
    let dataUrl;
    if (isPdf) {
      dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    } else {
      dataUrl = await immagineInBase64(file, MAX_DOC_PX, 0.88);
    }
    documento = { nome: file.name, mime: isPdf ? 'application/pdf' : 'image/jpeg', base64: dataUrl.split(',')[1], anteprima: isPdf ? '' : dataUrl };
    const prev = $('#doc-preview');
    prev.hidden = false;
    prev.innerHTML = isPdf
      ? `<div class="p-4 flex items-center gap-3"><span class="text-3xl">📕</span><div class="min-w-0"><b class="block truncate">${esc(file.name)}</b><span class="text-xs text-grafite">PDF · ${(file.size / 1024).toFixed(0)} KB</span></div></div>`
      : `<img src="${dataUrl}" alt="Anteprima documento">`;
    $('#btn-analizza').disabled = false;
  } catch (err) {
    toast('Impossibile leggere il file: ' + err.message, 'err');
  }
}

/** Prompt per Gemini: chiede un JSON con le righe del documento, già convertite in m². */
function promptEstrazione() {
  const catalogo = state.prodotti.map(p => `- ${p.codice || '(senza codice)'} | ${p.nome} | ${p.formato || ''}`).join('\n');
  return `Sei un assistente per il magazzino di un rivenditore di ceramiche (Mirisa Ceramiche).
Analizza il documento allegato (fattura, DDT o bolla di consegna) ed estrai SOLO le righe di piastrelle, pavimenti e rivestimenti.
Per ogni riga indica la quantità in metri quadrati (m²). Se la quantità è in scatole/colli e il documento riporta i m² per scatola, converti in m². Ignora trasporto, pallet, collanti, sconti e righe non ceramiche.
Rispondi SOLO con JSON valido in questo formato:
{"fornitore": string, "numeroDocumento": string, "dataDocumento": "YYYY-MM-DD" | "", "righe": [{"codice": string, "descrizione": string, "formato": string, "mq": number, "note": string}]}
Usa il punto come separatore decimale. Se un dato manca usa una stringa vuota.
Articoli già presenti nel catalogo (usa lo stesso codice se la riga corrisponde):
${catalogo}`;
}

async function estraiConGemini() {
  const model = (settings.model || DEFAULT_MODEL).trim();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': settings.apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ text: promptEstrazione() }, { inline_data: { mime_type: documento.mime, data: documento.base64 } }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.1 }
    })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json.error?.message || `HTTP ${res.status}`;
    throw new Error(res.status === 400 || res.status === 403 ? `Chiave API o modello non validi (${msg})` : msg);
  }
  const testo = (json.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
  if (!testo) throw new Error('Nessuna risposta dal modello. Riprova con una foto più nitida.');
  const pulito = testo.replace(/^```(?:json)?\s*|\s*```$/g, '');
  return JSON.parse(pulito);
}

/** Simulazione: genera righe plausibili a partire dal catalogo, per provare il flusso senza chiave. */
async function estraiSimulato() {
  await new Promise(r => setTimeout(r, 1400));
  const pool = [...state.prodotti].sort(() => Math.random() - 0.5).slice(0, Math.min(3, state.prodotti.length));
  const righeSim = pool.map(p => {
    const scatole = 10 + Math.floor(Math.random() * 40);
    return { codice: p.codice, descrizione: `${p.tipologia || 'Gres'} ${p.nome} ${p.formato || ''}`.trim(), formato: p.formato, mq: round2(scatole * (p.mqScatola || 1.44)), note: `${scatole} scatole` };
  });
  righeSim.push({ codice: 'NEW-4590', descrizione: 'Gres effetto pietra Beola Grigia 45x90', formato: '45x90', mq: 48.6, note: '30 scatole (simulato)' });
  return { fornitore: pool[0]?.fornitore || 'Fornitore Demo', numeroDocumento: `DDT ${Math.floor(1000 + Math.random() * 8999)}/SIM`, dataDocumento: isoGiorno(new Date()), righe: righeSim };
}

/** Abbina una riga estratta a un articolo: prima per codice, poi per parole in comune nel nome e formato. */
function abbinaProdotto(riga) {
  const cod = norm(riga.codice).replace(/ /g, '');
  if (cod) {
    const exact = state.prodotti.find(p => norm(p.codice).replace(/ /g, '') === cod);
    if (exact) return exact.id;
  }
  const parole = new Set(norm(`${riga.descrizione} ${riga.formato}`).split(' ').filter(w => w.length > 2));
  let best = null, bestScore = 0;
  for (const p of state.prodotti) {
    const pw = norm(`${p.nome} ${p.formato}`).split(' ').filter(w => w.length > 2);
    if (!pw.length) continue;
    const comuni = pw.filter(w => parole.has(w)).length;
    const score = comuni / pw.length;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return bestScore >= 0.6 ? best.id : '';
}

function renderRighe() {
  const opzioni = id => '<option value="">➕ Nuovo articolo…</option>' + state.prodotti
    .slice().sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
    .map(p => `<option value="${p.id}" ${p.id === id ? 'selected' : ''}>${esc(p.nome)}${p.formato ? ' · ' + esc(p.formato) : ''} (${fmtMq(p.mq)} m²)</option>`).join('');

  $('#righe').innerHTML = righe.map((r, i) => `
    <div class="riga ${r.prodottoId ? '' : 'nuovo'}" data-i="${i}">
      ${r.descrizione ? `<div class="riga-src">📄 Dal documento: <b>${esc(r.descrizione)}</b>${r.codice ? ' · cod. ' + esc(r.codice) : ''}${r.note ? ' · ' + esc(r.note) : ''}</div>` : ''}
      <div class="grid grid-cols-12 gap-2 items-center">
        <select class="input col-span-12 sm:col-span-7" data-campo="prodottoId">${opzioni(r.prodottoId)}</select>
        <div class="relative col-span-8 sm:col-span-3">
          <input type="number" inputmode="decimal" step="0.01" min="0" class="input pr-10 font-semibold" data-campo="mq" value="${r.mq || ''}" placeholder="m²">
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-grafite text-sm">m²</span>
        </div>
        <button type="button" class="btn btn-ghost btn-sm col-span-4 sm:col-span-2" data-rimuovi aria-label="Rimuovi riga">🗑</button>
      </div>
      ${r.prodottoId ? '' : '<button type="button" class="text-sm text-mirisa font-semibold mt-2 underline" data-crea>Crea l\'articolo nel catalogo con questi dati</button>'}
    </div>`).join('');
  $('#righe-empty').hidden = righe.length > 0;
  const tot = righe.reduce((t, r) => t + (parseNumero(r.mq) || 0), 0);
  $('#righe-totale').textContent = `${fmtMq(tot)} m²`;
  $('#btn-conferma-carico').disabled = !righe.length;
}

function initCarico() {
  const onFile = e => { caricaDocumento(e.target.files[0]); e.target.value = ''; };
  $('#doc-file').addEventListener('change', onFile);
  $('#doc-camera').addEventListener('change', onFile);

  // Trascina e rilascia
  const dz = $('#dropzone');
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, e => { e.preventDefault(); dz.classList.remove('drag'); }));
  dz.addEventListener('drop', e => caricaDocumento(e.dataTransfer.files[0]));

  $('#btn-analizza').addEventListener('click', async () => {
    if (!documento) return;
    const btn = $('#btn-analizza');
    btn.disabled = true;
    $('#ai-loading').hidden = false;
    try {
      const simulato = !settings.apiKey;
      if (!simulato && !navigator.onLine) throw new Error('Sei offline: l\'IA non è raggiungibile.');
      const out = simulato ? await estraiSimulato() : await estraiConGemini();
      const estratte = (out.righe || []).filter(r => parseNumero(r.mq) > 0 || r.descrizione);
      righe = estratte.map(r => ({ ...r, mq: round2(parseNumero(r.mq)), prodottoId: abbinaProdotto(r), fonte: simulato ? 'simulazione' : 'ia' }));
      if (out.fornitore) $('#ca-fornitore').value = out.fornitore;
      if (out.numeroDocumento) $('#ca-doc').value = out.numeroDocumento + (out.dataDocumento ? ` del ${out.dataDocumento.split('-').reverse().join('/')}` : '');
      renderRighe();
      toast(estratte.length ? `${estratte.length} righe estratte${simulato ? ' (simulazione)' : ''}: controlla e conferma.` : 'Nessuna riga di ceramica trovata nel documento.', estratte.length ? 'ok' : 'err');
    } catch (err) {
      console.error(err);
      toast('Analisi non riuscita: ' + err.message, 'err');
    } finally {
      btn.disabled = false;
      $('#ai-loading').hidden = true;
    }
  });

  const nuovaRiga = () => { righe.push({ prodottoId: '', mq: 0, descrizione: '', fonte: 'manuale' }); renderRighe(); };
  $('#btn-manuale').addEventListener('click', nuovaRiga);
  $('#btn-add-riga').addEventListener('click', nuovaRiga);
  $('#btn-annulla-carico').addEventListener('click', () => {
    if (righe.length && !confirm('Svuotare tutte le righe da caricare?')) return;
    righe = [];
    documento = null;
    $('#doc-preview').hidden = true;
    $('#btn-analizza').disabled = true;
    $('#ca-fornitore').value = '';
    $('#ca-doc').value = '';
    renderRighe();
  });

  // Modifiche alle singole righe
  $('#righe').addEventListener('input', e => {
    const el = e.target.closest('[data-campo]');
    if (!el) return;
    const i = +el.closest('.riga').dataset.i;
    righe[i][el.dataset.campo] = el.value;
    if (el.dataset.campo === 'prodottoId') renderRighe();
    else $('#righe-totale').textContent = `${fmtMq(righe.reduce((t, r) => t + parseNumero(r.mq), 0))} m²`;
  });
  $('#righe').addEventListener('click', e => {
    const rigaEl = e.target.closest('.riga');
    if (!rigaEl) return;
    const i = +rigaEl.dataset.i;
    if (e.target.closest('[data-rimuovi]')) { righe.splice(i, 1); renderRighe(); }
    if (e.target.closest('[data-crea]')) {
      const r = righe[i];
      onProdottoCreato = p => { righe[i].prodottoId = p.id; renderRighe(); };
      apriModaleProdotto(null, { nome: r.descrizione || '', codice: r.codice || '', formato: r.formato || '', fornitore: $('#ca-fornitore').value, mq: 0 });
    }
  });
  $('#modal-prodotto').addEventListener('close', () => { setTimeout(() => { onProdottoCreato = null; }, 0); });

  $('#btn-conferma-carico').addEventListener('click', () => {
    const operatore = $('#ca-operatore').value;
    if (!operatore) { $('#ca-operatore').classList.add('invalid'); $('#ca-operatore').focus(); return toast('Seleziona l\'operatore che riceve la merce.', 'err'); }
    $('#ca-operatore').classList.remove('invalid');
    const senzaArticolo = righe.findIndex(r => !r.prodottoId);
    if (senzaArticolo >= 0) return toast(`Riga ${senzaArticolo + 1}: scegli l'articolo o crealo nel catalogo.`, 'err');
    const zero = righe.findIndex(r => parseNumero(r.mq) <= 0);
    if (zero >= 0) return toast(`Riga ${zero + 1}: inserisci i m² da caricare.`, 'err');

    const backup = JSON.stringify(state);
    const fornitore = $('#ca-fornitore').value.trim();
    const doc = $('#ca-doc').value.trim();
    let tot = 0, ultimo = null;
    righe.forEach(r => {
      const p = prodottoById(r.prodottoId);
      const mq = round2(parseNumero(r.mq));
      tot += mq;
      ultimo = p.id;
      registraMovimento({ tipo: 'carico', prodotto: p, delta: mq, reparto: 'Magazzino', operatore, fornitore, documento: doc, note: r.descrizione && r.descrizione !== p.nome ? `Riga documento: ${r.descrizione}` : '', fonte: r.fonte });
    });
    if (!salva()) { state = JSON.parse(backup); return; }

    settings.ultimoOperatore.carico = operatore;
    salvaSettings();
    toast(`Carico registrato: ${righe.length} articoli, ${fmtMq(tot)} m² totali.`, 'ok');
    righe = [];
    documento = null;
    $('#doc-preview').hidden = true;
    $('#btn-analizza').disabled = true;
    $('#ca-fornitore').value = '';
    $('#ca-doc').value = '';
    renderRighe();
    aggiornaTutto(ultimo);
  });
}

/* =============================================================
   STORICO MOVIMENTI
   ============================================================= */
function movimentiFiltrati() {
  const q = norm($('#st-search').value);
  const tipo = $('#st-tipo').value;
  const reparto = $('#st-reparto').value;
  const dal = $('#st-dal').value;
  const al = $('#st-al').value;
  return state.movimenti.filter(m => {
    const g = isoGiorno(m.data);
    if (tipo && m.tipo !== tipo) return false;
    if (reparto && m.reparto !== reparto) return false;
    if (dal && g < dal) return false;
    if (al && g > al) return false;
    if (q && !norm([m.articolo, m.codice, m.cliente, m.operatore, m.fornitore, m.documento, m.note].join(' ')).includes(q)) return false;
    return true;
  }).sort((a, b) => b.data.localeCompare(a.data));
}

function renderStorico() {
  const lista = movimentiFiltrati();
  const segno = m => (m.tipo === 'scarico' || m.segno < 0) ? '−' : '+';
  $('#log-body').innerHTML = lista.map(m => `
    <tr>
      <td class="whitespace-nowrap tabular-nums">${fmtData(m.data)}</td>
      <td><span class="tipo tipo-${m.tipo}">${esc(m.tipo)}</span>${m.fonte === 'ia' ? ' <span title="Estratto con IA">✨</span>' : m.fonte === 'simulazione' ? ' <span title="Estrazione simulata">🧪</span>' : ''}</td>
      <td><b>${esc(m.articolo)}</b><div class="text-xs text-grafite">${esc([m.codice, m.formato].filter(Boolean).join(' · '))}</div></td>
      <td class="text-right font-bold tabular-nums whitespace-nowrap ${segno(m) === '−' ? 'text-mirisa' : 'text-green-700'}">${segno(m)}${fmtMq(m.mq)}</td>
      <td>${esc(m.reparto || '—')}</td>
      <td>${esc(m.operatore || '—')}</td>
      <td>${esc(m.cliente || m.fornitore || '—')}</td>
      <td class="text-xs">${esc([m.documento, m.note].filter(Boolean).join(' · ') || '—')}</td>
      <td class="text-right tabular-nums whitespace-nowrap">${fmtMq(m.giacenzaDopo)} m²</td>
    </tr>`).join('');
  $('#log-empty').hidden = lista.length > 0;
  const car = lista.filter(m => m.tipo === 'carico').reduce((t, m) => t + m.mq, 0);
  const sca = lista.filter(m => m.tipo === 'scarico').reduce((t, m) => t + m.mq, 0);
  $('#st-summary').innerHTML = `${lista.length} movimenti · caricati <b class="text-green-700">${fmtMq(car)} m²</b> · scaricati <b class="text-mirisa">${fmtMq(sca)} m²</b>`;
}

function scaricaFile(nome, contenuto, mime) {
  const blob = new Blob([contenuto], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** CSV con separatore ";" e virgola decimale, così Excel in italiano lo apre già in colonne. */
function esportaCsv() {
  const lista = movimentiFiltrati();
  if (!lista.length) return toast('Nessun movimento da esportare.', 'err');
  const cella = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const num = n => round2(n).toFixed(2).replace('.', ',');
  const intest = ['Data', 'Ora', 'Tipo', 'Codice', 'Articolo', 'Formato', 'm²', 'Reparto', 'Operatore', 'Cliente', 'Fornitore', 'Documento', 'Note', 'Giacenza dopo (m²)', 'Origine'];
  const righeCsv = lista.map(m => {
    const d = new Date(m.data);
    const mq = (m.tipo === 'scarico' || m.segno < 0) ? -m.mq : m.mq;
    return [d.toLocaleDateString('it-IT'), d.toLocaleTimeString('it-IT'), m.tipo, m.codice, m.articolo, m.formato, num(mq), m.reparto, m.operatore, m.cliente, m.fornitore, m.documento, m.note, num(m.giacenzaDopo), m.fonte].map(cella).join(';');
  });
  scaricaFile(`movimenti-mirisa-${isoGiorno(new Date())}.csv`, '﻿' + [intest.map(cella).join(';'), ...righeCsv].join('\r\n'), 'text/csv;charset=utf-8');
  toast('CSV esportato', 'ok');
}

function esportaBackup() {
  const dati = { app: 'magazzino-mirisa', versione: 1, esportato: new Date().toISOString(), ...state };
  scaricaFile(`backup-magazzino-mirisa-${isoGiorno(new Date())}.json`, JSON.stringify(dati, null, 2), 'application/json');
  toast('Backup scaricato (la chiave API non è inclusa)', 'ok');
}

function initStorico() {
  ['#st-search', '#st-tipo', '#st-reparto', '#st-dal', '#st-al'].forEach(s => $(s).addEventListener('input', renderStorico));
  $('#btn-export-csv').addEventListener('click', esportaCsv);
  $('#btn-export-json').addEventListener('click', esportaBackup);
}

/* =============================================================
   IMPOSTAZIONI
   ============================================================= */
function apriImpostazioni() {
  $('#set-apikey').value = settings.apiKey || '';
  $('#set-model').value = settings.model || DEFAULT_MODEL;
  $('#set-staff-showroom').value = state.staff.Showroom.join('\n');
  $('#set-staff-magazzino').value = state.staff.Magazzino.join('\n');
  const kb = Math.round((localStorage.getItem(STORAGE_KEY) || '').length / 1024);
  $('#set-storage').textContent = `Spazio usato dai dati: circa ${kb} KB (i browser ne consentono di solito 5.000 KB). Foto grandi occupano più spazio.`;
  $('#modal-settings').showModal();
}

function initImpostazioni() {
  $('#btn-settings').addEventListener('click', apriImpostazioni);
  $('#set-apikey-toggle').addEventListener('click', () => {
    const i = $('#set-apikey');
    i.type = i.type === 'password' ? 'text' : 'password';
  });

  $('#form-settings').addEventListener('submit', e => {
    e.preventDefault();
    const righeTesto = id => [...new Set($(id).value.split('\n').map(s => s.trim()).filter(Boolean))];
    settings.apiKey = $('#set-apikey').value.trim();
    settings.model = $('#set-model').value.trim() || DEFAULT_MODEL;
    salvaSettings();
    state.staff.Showroom = righeTesto('#set-staff-showroom');
    state.staff.Magazzino = righeTesto('#set-staff-magazzino');
    salva();
    $('#ca-operatore').innerHTML = '';
    $('#modal-settings').close();
    aggiornaTutto();
    renderAiMode();
    toast('Impostazioni salvate', 'ok');
  });

  $('#set-import').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const dati = JSON.parse(await file.text());
      if (!Array.isArray(dati.prodotti) || !Array.isArray(dati.movimenti)) throw new Error('il file non è un backup del magazzino');
      if (!confirm(`Ripristinare il backup del ${dati.esportato ? fmtData(dati.esportato) : '?'}?\nI dati attuali verranno sostituiti.`)) return;
      state = { prodotti: dati.prodotti, movimenti: dati.movimenti, staff: dati.staff || state.staff };
      if (salva()) { $('#modal-settings').close(); aggiornaTutto(); toast('Backup ripristinato', 'ok'); }
    } catch (err) {
      toast('Backup non valido: ' + err.message, 'err');
    }
  });

  $('#set-reset').addEventListener('click', () => {
    if (!confirm('Azzerare tutti gli articoli e lo storico e tornare ai dati di esempio?\nConsiglio: scarica prima un backup.')) return;
    if (prompt('Per confermare scrivi AZZERA') !== 'AZZERA') return;
    state = statoIniziale();
    salva();
    $('#modal-settings').close();
    aggiornaTutto();
    toast('Dati azzerati');
  });
}

/* =============================================================
   AVVIO
   ============================================================= */
function aggiornaTutto(flashId) {
  renderCatalogo(flashId);
  renderScarico();
  if (!$('#tab-storico').hidden) renderStorico();
}

function init() {
  initHeader();
  initCatalogo();
  initModaleProdotto();
  initScarico();
  initCarico();
  initStorico();
  initImpostazioni();

  $$('.tab-btn').forEach(b => b.addEventListener('click', () => apriScheda(b.dataset.tab)));
  // Chiusura delle modali con i pulsanti "data-close" o toccando lo sfondo
  $$('dialog').forEach(d => {
    d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
  });

  // Se l'app è aperta in più schede dello stesso dispositivo, restano sincronizzate
  window.addEventListener('storage', e => {
    if (e.key === STORAGE_KEY && e.newValue) { state = JSON.parse(e.newValue); aggiornaTutto(); }
    if (e.key === SETTINGS_KEY) { settings = caricaSettings(); renderAiMode(); }
  });

  aggiornaTutto();
  renderAiMode();
  renderRighe();
}

document.addEventListener('DOMContentLoaded', init);
