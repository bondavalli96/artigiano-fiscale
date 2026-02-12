# RALPH-LOOP TEST — Testing Automatico ArtigianoAI

## Istruzioni per Ralph

Esegui ogni FASE in ordine. Ad ogni fase, verifica che tutto funzioni PRIMA di procedere.
Usa i tool MCP disponibili: Playwright per interazione web, Supabase MCP per DB, Chrome DevTools per debug.

**Strategia di test:** L'app Expo puo girare in modalita WEB. Avviamo `npx expo export --platform web` per verificare il build, e `npx expo start --web` per testare con Playwright nel browser.

---

## FASE T0 — VERIFICA BUILD
**Obiettivo:** L'app compila senza errori.

### Azioni:
1. Pulisci cache: `rm -rf /Users/davidebondavalli/PMIapp_native/artigiano-app/.expo && rm -rf /tmp/metro-*`
2. Verifica che tutti gli import siano corretti: `npx tsc --noEmit` (se tsconfig esiste)
3. Esegui `NODE_OPTIONS="--max-old-space-size=8192" npx expo export --platform web` per verificare che il bundle si compili
4. Se ci sono errori, fixali UNO PER UNO leggendo lo stack trace
5. Non procedere finche il build non passa

### Verifica:
- Export web completato senza errori
- Nessun missing import o undefined component

---

## FASE T1 — TEST EDGE FUNCTIONS (via curl)
**Obiettivo:** Tutte le 10 Edge Functions rispondono correttamente.

### Azioni:
Per ogni Edge Function, testa con una chiamata reale usando Supabase MCP `execute_sql` per creare dati di test, poi chiama le funzioni.

1. **Test suggest-price-list:**
   ```
   curl -X POST https://zvmvrhdcjprlbqfzslhg.supabase.co/functions/v1/suggest-price-list \
     -H "Authorization: Bearer <anon_key>" \
     -H "Content-Type: application/json" \
     -d '{"trade":"idraulico"}'
   ```
   Verifica: risposta JSON con array `items` di 15 voci

2. **Test extract-job:**
   ```
   -d '{"text":"Devo riparare un rubinetto che perde in bagno, urgente","artisanTrade":"idraulico"}'
   ```
   Verifica: risposta JSON con `extracted` contenente tipo_lavoro, materiali, urgenza

3. **Test suggest-quote:**
   ```
   -d '{"jobDescription":"Sostituzione rubinetto bagno","priceList":[{"description":"Installazione rubinetto","unit":"pezzo","default_price":80}],"artisanTrade":"idraulico"}'
   ```
   Verifica: risposta JSON con array `items` con description, quantity, unit_price, total

4. **Test generate-pdf:**
   ```
   -d '{"type":"quote","number":"P-2026-001","artisan":{"business_name":"Mario Rossi Idraulica","vat_number":"12345678901"},"items":[{"description":"Riparazione rubinetto","quantity":1,"unit":"pezzo","unit_price":80,"total":80}],"subtotal":80,"vat_rate":22,"vat_amount":17.6,"total":97.6,"date":"10/02/2026"}'
   ```
   Verifica: risposta con `pdfUrl` valido

5. **Test check-anomalies:** (con artisanId fittizio, aspettati risposta vuota)
6. **Test monthly-summary:** (con artisanId fittizio, aspettati valori a 0)
7. **Test extract-invoice:** (con testo di fattura di esempio)
8. **Test analyze-patterns:** (con artisanId fittizio)

Per ogni errore: leggi il messaggio, fixa il codice nella Edge Function, ri-deploya via Supabase MCP, ri-testa.

### Verifica:
- Tutte le 10 funzioni rispondono 200 o errore gestito (non 500 non-handled)
- Le funzioni AI (suggest-price-list, extract-job, suggest-quote) ritornano JSON valido

---

## FASE T2 — AVVIA APP WEB + TEST PLAYWRIGHT
**Obiettivo:** L'app si apre nel browser e le pagine principali sono navigabili.

### Azioni:
1. Avvia server web: `NODE_OPTIONS="--max-old-space-size=8192" npx expo start --web --port 19006` (in background)
2. Aspetta che il server sia pronto
3. Usa Playwright MCP per:
   - `browser_navigate` a `http://localhost:19006`
   - `browser_snapshot` per verificare che la pagina si carica
   - Verifica che la pagina di login/register sia visibile
   - Se ci sono errori nella console (`browser_console_messages`), leggili e fixali
4. Naviga alle varie route:
   - `/` (index - dovrebbe redirectare a login)
   - `/(auth)/login`
   - `/(auth)/register`
5. Per ogni pagina: snapshot + console check

### Verifica:
- App web si carica senza errori JS nella console
- Pagine auth visibili e renderizzate
- Nessun crash o white screen

---

## FASE T3 — TEST INTERAZIONE AUTH (Playwright)
**Obiettivo:** Il flusso di registrazione e login funziona end-to-end.

### Azioni:
1. Naviga a pagina register
2. Compila form con dati test:
   - Email: `test-ralph@artigianoai.com`
   - Password: `TestRalph2026!`
3. Clicca "Registrati"
4. Verifica redirect o messaggio di conferma
5. Naviga a login
6. Compila con stesse credenziali
7. Clicca "Accedi"
8. Verifica redirect a onboarding o dashboard
9. Controlla console per errori Supabase
10. Se auth fallisce, controlla network requests con `browser_network_requests`

### Verifica:
- Registrazione crea utente su Supabase (verifica con execute_sql)
- Login funziona e redirect corretto
- Session token salvato

---

## FASE T4 — TEST ONBOARDING (Playwright)
**Obiettivo:** Wizard onboarding navigabile e salva dati.

### Azioni:
1. Dopo login, dovrebbe apparire onboarding
2. Step 1: clicca su un mestiere (es. "Idraulico")
3. Step 2: compila form dati fiscali con dati test
4. Step 3: seleziona preferenza input
5. Step 4: verifica che il listino AI si carica (chiama suggest-price-list)
6. Clicca "Fatto"
7. Verifica redirect a dashboard
8. Verifica su DB (execute_sql): record in `artisans` e `price_list`

### Verifica:
- Tutti gli step navigabili
- Dati salvati correttamente su Supabase
- Redirect a dashboard funziona

---

## FASE T5 — TEST DASHBOARD + NAVIGAZIONE (Playwright)
**Obiettivo:** Dashboard carica e tab navigation funziona.

### Azioni:
1. Verifica dashboard si carica con saluto
2. Clicca su ogni tab: Lavori, Preventivi, Fatture, Impostazioni
3. Per ogni tab: snapshot + console check
4. Verifica empty states dove non ci sono dati
5. Test FAB "Nuovo Lavoro" se presente

### Verifica:
- Tutte le tab navigabili
- Nessun errore console
- Empty states visualizzati correttamente

---

## FASE T6 — TEST QUOTE-ACCEPT PAGE (Playwright)
**Obiettivo:** La pagina pubblica di accettazione preventivo funziona.

### Azioni:
1. Crea un preventivo di test nel DB via execute_sql
2. Naviga a `/quote-accept/{id_preventivo}`
3. Verifica che mostra i dati del preventivo
4. Clicca "Accetto il Preventivo"
5. Verifica che lo stato si aggiorna nel DB
6. Controlla console per errori

### Verifica:
- Pagina pubblica accessibile senza login
- Dati preventivo visualizzati
- Accettazione aggiorna il DB

---

## FASE T7 — CLEANUP + REPORT
**Obiettivo:** Pulisci dati di test e genera report.

### Azioni:
1. Cancella utente test da Supabase auth
2. Cancella dati test dalle tabelle
3. Stoppa server web
4. Genera report riassuntivo:
   - Quante fasi passate/fallite
   - Errori trovati e fixati
   - Errori ancora aperti
   - Stato generale dell'app

### Output:
Report completo stampato a schermo per l'utente.

---

## REGOLE PER RALPH

### Quando trovi un errore:
1. Leggi lo stack trace / console output COMPLETO
2. Identifica file e riga
3. Se e un errore di libreria, usa Context7 per documentazione aggiornata
4. Fixa il codice
5. Ri-testa
6. Se il fix rompe altro, fixa anche quello
7. Non procedere MAI con errori aperti

### Tool da usare:
- **Playwright MCP:** browser_navigate, browser_snapshot, browser_click, browser_fill_form, browser_console_messages, browser_network_requests
- **Supabase MCP:** execute_sql (per dati test e verifiche), deploy_edge_function (per fix)
- **Chrome DevTools MCP:** per debug avanzato se Playwright non basta
- **Context7:** per documentazione librerie quando serve fixare

### Priorita:
1. Build compila > Pagine si caricano > Interazioni funzionano > Dati salvati
2. Fix errori critici prima, warning dopo
3. Se un test non e possibile (es. richiede device nativo), segnalalo nel report
