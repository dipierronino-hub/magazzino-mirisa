# Magazzino Mirisa Ceramiche

Web app interna per gestire in tempo reale i m² di pavimenti e rivestimenti tra Showroom e Magazzino.

## File
- `index.html` – struttura, header con logo, schede e modali
- `style.css` – stili personalizzati e ottimizzazioni touch
- `app.js` – logica completa (catalogo, scarico, carico con IA, storico, impostazioni)
- `Logo-Mirisa-Ceramiche-Vettoriale-2.svg` – logo aziendale

## Pubblicazione su GitHub Pages
1. Crea un repository (es. `magazzino-mirisa`) e carica tutti i file nella radice.
2. Su GitHub: **Settings → Pages → Build and deployment → Deploy from a branch**, scegli `main` e la cartella `/ (root)`.
3. Dopo un paio di minuti l'app è su `https://<utente>.github.io/magazzino-mirisa/`.

## Carico Smart con Gemini
Apri ⚙️ **Impostazioni** e incolla una chiave API Gemini (si crea su https://aistudio.google.com/apikey).
La chiave resta solo nel browser di quel dispositivo e non è mai nel codice. Senza chiave l'estrazione è simulata.

## Dati
Tutto è salvato nel `localStorage` del browser: ogni dispositivo ha i suoi dati.
Usa **Storico → Backup completo** per scaricare una copia e **Impostazioni → Ripristina backup** per caricarla su un altro dispositivo.
