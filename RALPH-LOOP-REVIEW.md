# RALPH-LOOP — Review Completo + Traduzione ES/PT

## Istruzioni per Ralph

Esegui ogni FASE in ordine. Non passare alla successiva finché quella corrente non è completa e verificata. Dopo ogni fase, fai un commit git.

**Demo user:** "Rossi Impianti Idraulici" (test@artigianoai.it) — ha 8 clienti, 15 lavori, 9 preventivi, 7 fatture attive, 11 fatture passive, 16 voci listino, 114 AI patterns.

---

## FASE R0 — VERIFICA BUILD
**Obiettivo:** L'app compila senza errori.

### Azioni:
1. Pulisci cache: `rm -rf .expo && rm -rf /tmp/metro-*`
2. Verifica TypeScript: `npx tsc --noEmit`
3. Verifica build web: `NODE_OPTIONS="--max-old-space-size=8192" npx expo export --platform web`
4. Se ci sono errori, fixali uno per uno

### Verifica:
- Build web completato senza errori
- Nessun errore TypeScript

---

## FASE R1 — TEST EDGE FUNCTIONS
**Obiettivo:** Tutte le 17 Edge Functions rispondono correttamente.

### Azioni:
Testa ognuna delle seguenti Edge Functions con chiamate reali:

1. **suggest-price-list** — `{"trade":"idraulico"}`
2. **extract-job** — `{"text":"Devo riparare un rubinetto che perde","artisanTrade":"idraulico"}`
3. **suggest-quote** — con job description + price list mock
4. **generate-pdf** — con dati preventivo di test
5. **check-anomalies** — con artisan ID Rossi
6. **monthly-summary** — con artisan ID Rossi + locale "it"
7. **extract-invoice** — con testo fattura di esempio
8. **analyze-patterns** — con artisan ID Rossi
9. **transcribe** — verifica endpoint risponde (no audio reale necessario, testa error handling)
10. **suggest-default-templates** — `{"trade":"idraulico"}`
11. **extract-template** — verifica endpoint risponde
12. **classify-inbox-item** — con testo di test
13. **route-inbox-item** — verifica endpoint
14. **send-reminder** — verifica endpoint (no email reale)
15. **stats-summary** — con artisan ID Rossi
16. **receive-email** — verifica endpoint
17. **receive-whatsapp** — verifica endpoint

Per ogni errore: leggi messaggio, fixa codice, ri-deploya, ri-testa.

### Verifica:
- Tutte le funzioni rispondono 200 o errore gestito (no 500 unhandled)
- Le funzioni AI ritornano JSON valido

---

## FASE R2 — TEST APP WEB + PLAYWRIGHT (Auth Flow)
**Obiettivo:** L'app si carica nel browser, login funziona con user Rossi.

### Azioni:
1. Avvia server web: `npx expo start --web --port 19006` (background)
2. Naviga a http://localhost:19006
3. Verifica pagina login si carica
4. Fai login con user Rossi (test@artigianoai.it)
5. Verifica redirect a dashboard
6. Controlla console per errori
7. Se errori, fixali

### Verifica:
- Login funziona
- Dashboard si carica con dati Rossi
- Nessun errore console critico

---

## FASE R3 — REVIEW DASHBOARD + NAVIGAZIONE
**Obiettivo:** Dashboard mostra dati corretti, navigazione tab funziona.

### Azioni:
1. Con user Rossi loggato, verifica:
   - Saluto personalizzato (Buongiorno/Buon pomeriggio + nome)
   - Card statistiche: fatture da incassare, preventivi in attesa, ultimo lavoro
   - DashboardSummary: entrate/uscite/margine mese
   - Sezione "Attenzione" se fatture scadute
2. Naviga a ogni tab: Lavori, Preventivi, Fatture, Inbox, Agenda, Statistiche, Impostazioni
3. Per ogni tab: snapshot + verifica rendering + console check
4. Testa FAB "Nuovo Lavoro"

### Verifica:
- Tutte le tab navigabili senza errori
- Dati visualizzati correttamente
- Empty states dove appropriato

---

## FASE R4 — REVIEW LAVORI (Jobs)
**Obiettivo:** Lista lavori, creazione, dettaglio funzionano.

### Azioni:
1. Vai a tab Lavori
2. Verifica lista mostra i 15 lavori di Rossi
3. Verifica filtri chip (Tutti, Bozza, Preventivato, ecc.)
4. Apri un lavoro → verifica dettaglio (titolo, descrizione, stato, foto, trascrizione)
5. Testa creazione nuovo lavoro (modalità web: solo testo, no voce/foto)
6. Verifica flusso: testo → "Analizza con AI" → dati estratti → "Salva"

### Verifica:
- Lista carica correttamente
- Filtri funzionano
- Dettaglio mostra tutti i dati
- Creazione salva su DB

---

## FASE R5 — REVIEW PREVENTIVI (Quotes)
**Obiettivo:** Lista preventivi, editor, generazione PDF, accettazione.

### Azioni:
1. Vai a tab Preventivi
2. Verifica lista mostra i 9 preventivi di Rossi
3. Apri un preventivo → verifica editor:
   - Righe editabili (descrizione, quantità, unità, prezzo)
   - Calcoli corretti (subtotale, IVA, totale)
   - Bottoni azioni (Salva, Genera PDF, Invia)
4. Testa generazione PDF (bottone "Genera PDF")
5. Testa pagina accettazione pubblica: naviga a /quote-accept/{id}
6. Verifica pagina mostra dati preventivo e bottone "Accetto"
7. Verifica template preventivi in Impostazioni

### Verifica:
- Editor funziona con calcoli corretti
- PDF generato correttamente
- Pagina accettazione accessibile senza login
- Template caricabili nell'editor

---

## FASE R6 — REVIEW FATTURE (Invoices)
**Obiettivo:** Fatture attive/passive, conversione, solleciti.

### Azioni:
1. Vai a tab Fatture
2. Verifica tab "Emesse" mostra 7 fatture attive di Rossi
3. Verifica tab "Ricevute" mostra 11 fatture passive
4. Apri fattura attiva → verifica:
   - Dettaglio con timeline stati
   - Bottoni: Segna Pagata, Invia Sollecito, Condividi PDF
   - QuickShareButtons (WhatsApp/Email)
5. Vai a pagina Solleciti (reminders.tsx)
6. Verifica lista clienti con pagamenti in sospeso
7. Testa upload fattura passiva (modalità web)
8. Verifica estrazione AI dati fattura

### Verifica:
- Entrambe le tab caricate correttamente
- Azioni fattura funzionano
- Solleciti bulk selezionabili
- Upload fattura passiva funziona

---

## FASE R7 — REVIEW IMPOSTAZIONI (Settings)
**Obiettivo:** Tutte le pagine impostazioni funzionano.

### Azioni:
1. Vai a tab Impostazioni
2. Verifica ogni sotto-pagina:
   - **Profilo:** dati artigiano editabili e salvabili
   - **Listino:** lista voci, aggiungi/modifica/elimina
   - **Clienti:** lista con score affidabilità
   - **Dettaglio cliente:** storico lavori, fatture, pagamenti
   - **Template:** lista, creazione, import da file, AI default
   - **Brand/Logo:** upload logo
   - **Personalizzazione fattura:** template + visibilità campi
   - **Export:** CSV + ZIP fatture
   - **Pagamenti/billing:** metodi pagamento
3. Per ogni pagina: verifica caricamento dati, form editing, salvataggio
4. Verifica cambio lingua (IT ↔ EN) funziona in Impostazioni

### Verifica:
- Tutte le sotto-pagine caricate
- Form salvano correttamente
- Cambio lingua aggiorna tutta l'UI

---

## FASE R8 — REVIEW INBOX + AGENDA + STATS
**Obiettivo:** Funzionalità secondarie funzionano.

### Azioni:
1. **Inbox:** verifica lista, filtri, dettaglio item, classificazione AI
2. **Agenda:** verifica calendario, creazione evento, visualizzazione
3. **Stats:** verifica statistiche caricate (entrate/uscite/profitto)
4. **Other Services:** verifica pagina marketplace/storytelling

### Verifica:
- Tutte le sezioni caricano senza errori
- Dati coerenti con quelli nel DB

---

## FASE R9 — FIX BUGS TROVATI
**Obiettivo:** Fixare tutti i bug trovati nelle fasi precedenti.

### Azioni:
1. Raccogli tutti gli errori/warning trovati
2. Prioritizza: crash > errori funzionali > warning > cosmetici
3. Fixa uno per uno
4. Ri-testa le aree fixate
5. Fai build web per verificare nessuna regressione

### Verifica:
- Tutti i bug critici fixati
- Build web passa senza errori
- App funziona end-to-end

### Commit: `fix: bug fixes from comprehensive review`

---

## FASE R10 — AGGIUNTA TRADUZIONE SPAGNOLO (ES)
**Obiettivo:** Tradurre tutta l'UI in spagnolo.

### Azioni:
1. Aggiorna `Locale` type: `"it" | "en" | "es" | "pt"`
2. Aggiorna `I18nProvider` per accettare nuovi locali
3. Aggiungi oggetto `es` in `translations.ts` con tutte le ~600 chiavi tradotte in spagnolo
4. Aggiorna terminologia specifica:
   - "P.IVA" → "NIF/CIF" (spagnolo)
   - "Codice Fiscale" → "DNI/NIE"
   - "SDI" → "SII"
   - "Ragione sociale" → "Razón social"
   - Formattazione valuta: "1.234,56 €" (spagnolo usa lo stesso formato)
5. Aggiorna `lib/utils/format.ts` per date in spagnolo (es: "12 de febrero de 2026")
6. Aggiorna `constants/trades.ts` con label spagnole
7. Aggiorna Edge Functions localizzate (monthly-summary, analyze-patterns) per accettare locale "es"
8. Aggiorna pagina impostazioni per mostrare opzione lingua spagnola
9. Aggiorna `lib/compliance/index.ts` se necessario per label spagnole

### Verifica:
- Cambio lingua a ES mostra tutta l'UI in spagnolo
- Nessuna chiave mancante (fallback a IT)
- Date formattate correttamente in spagnolo
- Edge Functions rispondono in spagnolo

---

## FASE R11 — AGGIUNTA TRADUZIONE PORTOGHESE (PT)
**Obiettivo:** Tradurre tutta l'UI in portoghese.

### Azioni:
1. Aggiungi oggetto `pt` in `translations.ts` con tutte le ~600 chiavi tradotte in portoghese
2. Aggiorna terminologia specifica:
   - "P.IVA" → "NIF" (portoghese)
   - "Codice Fiscale" → "NIF"
   - "SDI" → "SAF-T"
   - "Ragione sociale" → "Denominação social"
   - Formattazione valuta: "1.234,56 €" (portoghese usa lo stesso formato)
3. Aggiorna `lib/utils/format.ts` per date in portoghese (es: "12 de fevereiro de 2026")
4. Aggiorna `constants/trades.ts` con label portoghesi
5. Aggiorna Edge Functions localizzate per accettare locale "pt"
6. Aggiorna pagina impostazioni per mostrare opzione lingua portoghese
7. Aggiorna `lib/compliance/index.ts` se necessario per label portoghesi

### Verifica:
- Cambio lingua a PT mostra tutta l'UI in portoghese
- Nessuna chiave mancante
- Date formattate correttamente
- Edge Functions rispondono in portoghese

---

## FASE R12 — TEST FINALE MULTILINGUA
**Obiettivo:** Verificare che tutte e 4 le lingue funzionano end-to-end.

### Azioni:
1. Per ogni lingua (IT, EN, ES, PT):
   - Cambia lingua in Impostazioni
   - Naviga a Dashboard → verifica saluto e statistiche
   - Naviga a Lavori → verifica lista e badge
   - Naviga a Preventivi → verifica editor
   - Naviga a Fatture → verifica tab
   - Naviga a Impostazioni → verifica tutte le label
2. Verifica che la lingua persiste dopo riavvio (AsyncStorage)
3. Build web finale: `npx expo export --platform web`
4. Verifica nessuna regressione TypeScript: `npx tsc --noEmit`

### Verifica:
- Tutte e 4 le lingue complete e funzionanti
- Nessun placeholder o chiave mancante
- Build passa senza errori
- App funzionale in ogni lingua

### Commit: `feat: add Spanish and Portuguese translations`

---

## REGOLE PER RALPH

### Quando trovi un errore:
1. Leggi lo stack trace completo
2. Identifica file e riga
3. Se errore di libreria, usa Context7
4. Fixa e ri-testa
5. Non procedere MAI con errori aperti

### Tool da usare:
- **Playwright:** per test app web (navigate, snapshot, click, fill, console)
- **Supabase MCP:** per verifiche DB e test Edge Functions
- **Chrome DevTools:** per debug avanzato
- **Context7:** per documentazione librerie

### Priorità:
1. Build compila > Pagine si caricano > Interazioni funzionano > Dati salvati
2. Fix errori critici prima, warning dopo
3. Se un test richiede device nativo (voce, fotocamera), segnalalo nel report
