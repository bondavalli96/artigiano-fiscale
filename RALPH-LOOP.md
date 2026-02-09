# RALPH-LOOP.md — Piano di Esecuzione (React Native / Expo)

## Istruzioni per Ralph (Claude Code in VS Code)

Esegui ogni FASE in ordine. Non passare alla successiva finché quella corrente non è completa e funzionante. Dopo ogni fase, fai un commit git.

**Regola fondamentale:** ad ogni fase, verifica che l'app si avvii senza errori (`npx expo start`). Se qualcosa si rompe, fixalo prima di procedere.

**Importante:** Le API keys (Anthropic, OpenAI, Resend) stanno SOLO nelle Supabase Edge Functions, MAI nel client mobile.

---

## FASE 0 — SETUP PROGETTO
**Obiettivo:** Progetto Expo funzionante con tutte le dipendenze.

### Azioni:
1. Inizializza progetto Expo con Router:
   ```bash
   npx create-expo-app@latest artigiano-app --template tabs
   cd artigiano-app
   ```
2. Installa dipendenze core:
   ```bash
   npx expo install expo-router expo-linking expo-constants expo-status-bar
   npx expo install @supabase/supabase-js @react-native-async-storage/async-storage expo-secure-store
   npx expo install nativewind tailwindcss react-native-reanimated
   npx expo install expo-av expo-image-picker expo-sharing expo-file-system expo-haptics
   npx expo install expo-notifications expo-device
   npx expo install react-native-paper react-native-safe-area-context
   npm install react-native-pdf-lib
   npm install @shopify/flash-list
   npm install date-fns zod
   ```
3. Configura NativeWind:
   - Crea `tailwind.config.js` con content pointing a `app/**` e `components/**`
   - Configura babel plugin per NativeWind
   - Crea `global.css` con `@tailwind` directives
4. Configura Supabase client `lib/supabase.ts`:
   - Usa `expo-secure-store` per session persistence (NON AsyncStorage per i token)
   - Configura auth con auto refresh
5. Crea `types/index.ts` con tutti i tipi TypeScript basati sullo schema DB in CLAUDE.md
6. Crea `lib/utils/format.ts`:
   - `formatCurrency(amount)` → "€ 1.234,56"
   - `formatDate(date)` → "9 febbraio 2026"
7. Crea `lib/utils/validators.ts`:
   - `validateVAT(piva)` — validazione P.IVA italiana
   - `validateFiscalCode(cf)` — validazione codice fiscale
8. Crea `constants/trades.ts` con lista mestieri:
   ```typescript
   export const TRADES = [
     { id: 'idraulico', label: 'Idraulico', icon: 'wrench' },
     { id: 'elettricista', label: 'Elettricista', icon: 'zap' },
     { id: 'muratore', label: 'Muratore', icon: 'hard-hat' },
     { id: 'imbianchino', label: 'Imbianchino', icon: 'paintbrush' },
     { id: 'fabbro', label: 'Fabbro', icon: 'key' },
     { id: 'falegname', label: 'Falegname', icon: 'axe' },
     { id: 'climatizzista', label: 'Climatizzista', icon: 'thermometer' },
     { id: 'altro', label: 'Altro', icon: 'briefcase' },
   ];
   ```
9. Configura `app.json` / `app.config.js`:
   - Nome app: "ArtigianoAI"
   - Bundle ID: `com.artigianoai.app`
   - Permessi: microfono, fotocamera, notifiche, libreria foto
10. Setup EAS:
    ```bash
    eas init
    ```
    Crea `eas.json` con profili development, preview, production

### Verifica:
- `npx expo start` funziona
- App si apre su Expo Go (telefono o simulatore)
- NativeWind styles applicati correttamente
- Connessione Supabase funziona (test con un semplice query)

### Commit: `feat: initial Expo project setup with deps and config`

---

## FASE 1 — AUTH + ONBOARDING
**Obiettivo:** L'artigiano può registrarsi, fare login, e completare l'onboarding.

### Azioni:
1. Crea root layout `app/_layout.tsx`:
   - Wrappa con `<PaperProvider>` e `<SafeAreaProvider>`
   - Font loading con `expo-font`
   - Auth state listener: redirect a login o dashboard
2. Crea hook `hooks/useAuth.ts`:
   - `session`, `user`, `loading`
   - `signIn(email, password)`
   - `signUp(email, password)`
   - `signOut()`
   - Listener su `onAuthStateChange`
3. Crea pagine auth `app/(auth)/`:
   - `_layout.tsx` — layout senza tab bar
   - `login.tsx`:
     - Input email + password
     - Bottone "Accedi" grande
     - Link "Non hai un account? Registrati"
     - KeyboardAvoidingView
   - `register.tsx`:
     - Input email + password + conferma password
     - Bottone "Registrati"
     - Link "Hai già un account? Accedi"
4. Crea Supabase Edge Function `supabase/functions/suggest-price-list/index.ts`:
   - Riceve `{ trade: string }` nel body
   - Chiama Claude: "Genera 15 voci di listino standard per un {trade} italiano. Solo descrizioni e unità di misura. Nessun prezzo. JSON array: [{description, unit, category}]"
   - Ritorna array voci
   - Deploy: `supabase functions deploy suggest-price-list`
5. Crea pagina onboarding `app/onboarding/index.tsx`:
   - Wizard a step con progress bar in alto
   - **Step 1:** Selezione mestiere — grid 2x4 con icone grandi, tappabili
   - **Step 2:** Dati fiscali — form con ragione sociale, P.IVA, CF, indirizzo, telefono, email, SDI
   - **Step 3:** Preferenza input — due card grandi: 🎤 Voce / ⌨️ Testo
   - **Step 4:** Listino AI — chiama Edge Function, mostra voci generate. Per ogni voce: checkbox + descrizione + unità. Bottone "Aggiungi voce" per voci custom
   - Ogni step ha "Avanti" / "Indietro"
   - Step finale: "Fatto! Vai alla dashboard"
   - Salva su Supabase (tabella artisans + price_list)
6. Redirect post-onboarding → tabs/dashboard

### Verifica:
- Registrazione funziona su device reale
- Login funziona
- Onboarding naviga tra step fluidamente
- Edge Function genera voci sensate per ogni mestiere
- Dati salvati su Supabase
- Dopo onboarding, arrivo in dashboard

### Commit: `feat: auth flow and onboarding with AI price list`

---

## FASE 2 — TAB NAVIGATOR + DASHBOARD
**Obiettivo:** Navigazione a tab e dashboard con overview.

### Azioni:
1. Crea tab layout `app/(tabs)/_layout.tsx`:
   - 5 tab: Home (🏠), Lavori (🔨), Preventivi (📋), Fatture (💰), Altro (⚙️)
   - Icone da `@expo/vector-icons` (MaterialCommunityIcons)
   - Active tint color: primary blue
   - Haptic feedback al cambio tab
2. Crea hook `hooks/useArtisan.ts`:
   - Fetcha profilo artigiano corrente
   - Cache locale con AsyncStorage
   - Ritorna `{ artisan, loading, refetch }`
3. Crea `app/(tabs)/index.tsx` (Dashboard):
   - Pull-to-refresh
   - Saluto: "Ciao {nome}!" con ora del giorno (Buongiorno/Buon pomeriggio/Buonasera)
   - 3 card statistiche:
     - 💰 Da incassare: count fatture non pagate + totale
     - 📋 Preventivi in attesa: count
     - 🔨 Ultimo lavoro
   - Sezione "Attenzione" (se ci sono fatture scadute)
   - FAB (Floating Action Button) in basso a destra: "+ Nuovo Lavoro"
4. Crea componente `components/DashboardSummary.tsx`:
   - Entrate mese / Uscite mese / Margine
   - Barra visuale semplice (no grafici complessi per ora)
   - Colore verde/rosso per margine
5. Crea componente `components/EmptyState.tsx`:
   - Illustrazione/icona + testo + CTA
   - Riutilizzabile su ogni schermata vuota

### Verifica:
- Tab navigation funziona con haptic
- Dashboard carica dati corretti
- Pull-to-refresh funziona
- FAB visibile e tappabile
- Empty state se primo accesso

### Commit: `feat: tab navigation and dashboard`

---

## FASE 3 — NUOVO LAVORO
**Obiettivo:** Inserimento lavoro con voce, testo, foto — tutto nativo.

### Azioni:
1. Crea `app/(tabs)/jobs/new.tsx`:
   - ScrollView con KeyboardAvoidingView
   - Campo cliente: `<ClientAutocomplete>` (cerca tra esistenti, o "Aggiungi nuovo")
   - Textarea descrizione (multiline, 4 righe minimo)
   - Bottone microfono GRANDE (centrale, 80x80) → registrazione vocale
   - Bottone foto → apre fotocamera o galleria
   - Preview foto sotto (thumbnails swipeable)
   - Dopo input vocale/testo: bottone "Analizza con AI"
   - Dopo analisi: mostra dati estratti editabili
   - Bottone "Salva Lavoro"
2. **[USA CONTEXT7 per expo-av prima di scrivere]** Crea componente           `components/VoiceRecorder.tsx`:
   - Usa `expo-av` Audio.Recording
   - UI: cerchio rosso pulsante (Animated) durante registrazione
   - Timer mm:ss visibile
   - Bottone Stop → upload audio su Supabase Storage
   - Haptic feedback start/stop
   - Supporta sia press-and-hold che toggle
3. **[USA CONTEXT7 per expo-image-picker prima di scrivere]** Crea componente `components/PhotoPicker.tsx`:
   - Usa `expo-image-picker`
   - Opzioni: fotocamera o libreria
   - Compressione automatica (quality 0.7, max 1024px)
   - Preview in riga orizzontale scrollabile
   - "X" per rimuovere foto
   - Upload multiple su Supabase Storage
4. Crea componente `components/ClientAutocomplete.tsx`:
   - TextInput con dropdown risultati
   - Cerca in tempo reale nella tabella clients
   - Opzione "Crea nuovo cliente" in fondo
   - Mini form inline per nuovo cliente (nome + telefono)
5. Crea Supabase Edge Function `supabase/functions/transcribe/index.ts`:
   - Riceve URL audio da Storage
   - Scarica file
   - Chiama OpenAI Whisper API (modello whisper-1, lingua "it")
   - Ritorna `{ transcription: string }`
6. Crea Supabase Edge Function `supabase/functions/extract-job/index.ts`:
   - Riceve `{ text: string, artisanTrade: string }`
   - Chiama Claude con prompt di estrazione:
     ```
     Analizza questo testo di un {trade}. Estrai:
     - tipo_lavoro, parole_chiave, prezzi_menzionati, materiali, urgenza, note
     Rispondi SOLO in JSON. Se un campo non è chiaro, usa null.
     ```
   - Ritorna dati strutturati
7. Crea `app/(tabs)/jobs/index.tsx` — lista lavori:
   - FlashList per performance
   - Filtro chip in alto: Tutti, Bozza, Preventivato, Accettato, Fatturato
   - Card per lavoro: titolo, cliente, data, badge stato
   - Swipe left → archivia
   - Pull-to-refresh
8. Crea `app/(tabs)/jobs/[id].tsx` — dettaglio:
   - Tutti i dati
   - Carousel foto
   - Player audio (se vocale)
   - Trascrizione
   - Dati AI estratti
   - Bottone "Crea Preventivo →"

### Verifica:
- Registrazione vocale funziona su device reale (iOS + Android)
- Foto da fotocamera e galleria funzionano
- Trascrizione vocale accurata in italiano
- AI estrae dati coerenti
- Lista lavori performante con FlashList
- Swipe actions funzionano

### Commit: `feat: job creation with native voice, camera, and AI extraction`

---

## FASE 4 — PREVENTIVO (Cuore dell'App)
**Obiettivo:** AI genera bozza, artigiano modifica, PDF, invio.

### Azioni:
1. Crea Supabase Edge Function `supabase/functions/suggest-quote/index.ts`:
   - Input: dati lavoro + listino artigiano + storico prezzi
   - Chiama Claude: genera bozza preventivo usando SOLO listino artigiano
   - Ritorna JSON con righe preventivo
2. Crea componente `components/QuoteEditor.tsx`:
   - Lista editabile di righe:
     - Descrizione (TextInput)
     - Quantità (TextInput numerico)
     - Unità (Picker/Select: ore, pezzi, metri, forfait)
     - Prezzo unitario (TextInput numerico, formatted €)
     - Totale riga (calcolato, non editabile)
   - Swipe left su riga → elimina
   - Bottone "+ Aggiungi riga" in fondo
   - Footer fisso con:
     - Subtotale
     - IVA 22% (tappabile per modificare aliquota)
     - **Totale** (bold, grande)
   - Banner top: "🤖 Bozza AI — modifica come vuoi"
3. Crea `app/(tabs)/quotes/[id].tsx`:
   - Carica dati lavoro associato
   - Se prima volta: chiama AI per bozza, poi mostra QuoteEditor
   - Se già salvato: carica da DB
   - Campo note (TextInput multiline)
   - Date picker "Valido fino al"
   - Bottoni bottom:
     - "Salva Bozza"
     - "Genera PDF e Invia"
4. Crea Supabase Edge Function `supabase/functions/generate-pdf/index.ts`:
   - Riceve dati preventivo/fattura
   - Genera PDF (usa jsPDF o html-to-pdf in Deno)
   - Template: intestazione artigiano, dati cliente, tabella, totali, note, validità
   - Upload su Supabase Storage
   - Ritorna URL PDF
5. Implementa condivisione:
   - Scarica PDF da URL con `expo-file-system`
   - Apri share sheet con `expo-sharing`
   - L'artigiano sceglie: WhatsApp, email, altro
   - Includi anche link accettazione nel messaggio
6. Crea `app/quote-accept/[id].tsx` (Deep Link pubblico):
   - Configurato come deep link universale
   - Mostra riepilogo preventivo (read-only, design pulito)
   - Bottone "Accetto il Preventivo"
   - Tap → aggiorna status, mostra conferma
   - Invia push notification all'artigiano: "Il cliente ha accettato il preventivo!"
7. Crea `app/(tabs)/quotes/index.tsx` — lista preventivi:
   - FlashList con filtro per stato
   - Card: cliente, importo, stato, data
   - Badge: bozza (grigio), inviato (blu), accettato (verde), scaduto (rosso)

### Verifica:
- AI genera bozza sensata
- Editor: aggiungere, rimuovere, modificare righe
- Calcoli corretti real-time
- PDF generato correttamente
- Share sheet apre WhatsApp/email con PDF allegato
- Deep link accettazione funziona
- Push notification ricevuta dopo accettazione

### Commit: `feat: quote system with AI, PDF, sharing, and acceptance deep link`

---

## FASE 5 — FATTURE ATTIVE
**Obiettivo:** Preventivo → Fattura in 1 tap, tracking pagamenti.

### Azioni:
1. Crea `app/(tabs)/invoices/index.tsx`:
   - Segmented control top: "Emesse" / "Ricevute"
   - Tab Emesse: FlashList fatture attive
   - Filtro: tutte, inviate, pagate, scadute
   - Badge con colori
2. Crea `app/(tabs)/invoices/active/[id].tsx`:
   - Dettaglio fattura
   - Timeline visuale stati (pallini collegati)
   - Bottoni:
     - "Segna Pagata" → date picker → aggiorna stato
     - "Invia Sollecito" → genera testo AI → share sheet
     - "Condividi PDF" → share sheet
3. Implementa conversione preventivo → fattura:
   - In quote/[id] se status = 'accepted': bottone "Crea Fattura"
   - Copia dati, genera numero progressivo FT-YYYY-NNN
   - Scadenza default +30 giorni
   - Genera PDF fattura
   - Salva su invoices_active
4. Crea Supabase Edge Function `supabase/functions/check-anomalies/index.ts`:
   - Controlla: importo vs media, cliente lento
   - Ritorna warnings non bloccanti
5. Push notification per fatture in scadenza (3 giorni prima)

### Verifica:
- Conversione quote → invoice funziona
- Numerazione progressiva corretta
- PDF fattura generato
- Timeline stati visualmente corretta
- Push notification scadenze

### Commit: `feat: active invoices with conversion and payment tracking`

---

## FASE 6 — SOLLECITI AUTOMATICI
**Obiettivo:** Reminder automatici con tono adattivo.

### Azioni:
1. Crea Supabase Edge Function `supabase/functions/send-reminder/index.ts`:
   - Query fatture scadute
   - Per ognuna: genera testo con Claude (tono basato su numero sollecito)
   - Invia via email (Resend)
   - Invia push notification all'artigiano con riepilogo
   - Aggiorna counter solleciti
2. Configura Supabase cron (pg_cron o scheduled Edge Function):
   - Ogni giorno alle 9:00 CET
   - Chiama send-reminder
3. Nella dashboard, sezione "⚠️ Da incassare":
   - Lista fatture scadute con giorni ritardo
   - Badge rosso con count
   - Bottone "Sollecita" su ogni fattura

### Verifica:
- Solleciti generati con tono appropriato
- Email inviate
- Push notification ricevute
- Dashboard mostra fatture scadute

### Commit: `feat: automatic payment reminders`

---

## FASE 7 — FATTURE PASSIVE
**Obiettivo:** Upload e classificazione automatica costi.

### Azioni:
1. Crea `app/(tabs)/invoices/passive/new.tsx`:
   - 3 metodi upload:
     - 📷 Foto con fotocamera (expo-image-picker, camera mode)
     - 📁 File PDF/XML da file system (expo-document-picker)
     - 📎 Da libreria foto
   - Dopo upload: spinner "Sto analizzando..."
   - Mostra dati estratti in form editabile
   - Warning anomalie (duplicato, importo strano, scadenza vicina)
   - Bottone "Conferma e Salva"
2. Crea Supabase Edge Function `supabase/functions/extract-invoice/index.ts`:
   - Se PDF: estrai testo
   - Se XML (FatturaPA): parse campi standard
   - Se immagine: invia a Claude Vision per OCR
   - Chiama Claude per strutturare: fornitore, numero, data, importi, categoria, scadenza
   - Controlla anomalie: duplicati, importi anomali
   - Ritorna dati + flags
3. Lista fatture passive nell'index con filtri
4. Promemoria scadenze fatture passive (push notification)

### Verifica:
- Upload foto → estrazione corretta
- Upload PDF → estrazione corretta
- Upload XML FatturaPA → parse corretto
- Anomalie segnalate
- Dati modificabili prima del salvataggio

### Commit: `feat: passive invoices with AI extraction`

---

## FASE 8 — CONTROLLO SEMPLICE (Dashboard AI)
**Obiettivo:** Riassunto finanziario in linguaggio semplice.

### Azioni:
1. Crea Supabase Edge Function `supabase/functions/monthly-summary/index.ts`:
   - Aggrega entrate/uscite/margine mese corrente e precedente
   - Chiama Claude: riassumi in 3-4 frasi come parleresti a un amico
   - Ritorna testo
2. Aggiorna `components/DashboardSummary.tsx`:
   - Numeri grandi: Entrate | Uscite | Margine
   - Barre colorate proporzionali
   - Card AI con riassunto testuale
   - Testo tipo: "Buon mese! Hai incassato 4.200€ e speso 1.800€. Margine 2.400€, il 15% in più di gennaio."
3. Aggiungi sezione clienti `app/(tabs)/settings/` o in tab Altro:
   - Lista clienti con score affidabilità
   - Dettaglio cliente: storico lavori, fatture, media tempi pagamento

### Verifica:
- Riassunto generato e mostrato
- Linguaggio semplice
- Numeri corretti

### Commit: `feat: AI financial dashboard`

---

## FASE 9 — APPRENDIMENTO CONTINUO
**Obiettivo:** Pattern detection e suggerimenti opt-in.

### Azioni:
1. Crea Supabase Edge Function `supabase/functions/analyze-patterns/index.ts`:
   - Analizza storico: prezzi ricorrenti, clienti affidabili/problematici, margini per tipo lavoro
   - Genera suggerimenti in linguaggio naturale
   - Salva in ai_patterns
2. Crea componente `components/AISuggestionBanner.tsx`:
   - Card con icona 🤖, testo, bottoni Applica/Ignora
   - Animazione entrata (slide from top)
   - Haptic feedback su interazione
3. Mostra suggerimenti:
   - Dashboard: max 1
   - Quote editor: suggerimenti prezzi inline
   - Clienti: badge affidabilità

### Verifica:
- Suggerimenti generati con dati di test
- Opt-in funziona
- Non invasivo

### Commit: `feat: AI pattern learning`

---

## FASE 10 — POLISH & DEPLOY
**Obiettivo:** App pronta per App Store e Play Store.

### Azioni:
1. **Loading states:** Skeleton su ogni schermata
2. **Error handling:** Toast/Snackbar user-friendly (react-native-paper)
3. **Empty states:** Ogni lista ha EmptyState con CTA
4. **Animazioni:** Transizioni pagina fluide (react-native-reanimated)
5. **Splash screen:** Logo ArtigianoAI con expo-splash-screen
6. **App icon:** Icona professionale generata
7. **Offline handling:** Banner "Sei offline" + cache dati locali
8. **Accessibilità:** Labels su tutti i bottoni, min touch target 48pt
9. **Test su device reali:** iPhone SE (piccolo), iPhone 15, Pixel 7, Samsung Galaxy
10. **Build:**
    ```bash
    eas build --platform all --profile production
    ```
11. **Submit:**
    ```bash
    eas submit --platform ios
    eas submit --platform android
    ```
12. **Privacy Policy:** Crea pagina web con privacy policy (necessaria per gli store)

### Verifica:
- App funziona end-to-end su iOS e Android
- Nessun crash
- Performance fluida (60fps scrolling)
- Notifiche funzionano
- PDF condivisione funziona
- Build riuscita per entrambe le piattaforme

### Commit: `feat: production polish and store submission`

---

## NOTE PER RALPH

### Quando sei bloccato:
- Rileggi CLAUDE.md per architettura e schema DB
- Se un'Edge Function non funziona, testa con `supabase functions serve` in locale
- Se un componente nativo dà problemi, controlla documentazione Expo SDK

### Priorità:
1. **Funziona su device reale** > Bello
2. **iOS + Android** > Perfezione su uno solo
3. **Semplice** > Completo
4. **Offline-tolerant** > Online-only

### Pattern da seguire:
- Ogni Edge Function: validazione input → logica → risposta JSON
- Ogni schermata: hook per dati → loading skeleton → render → empty state
- Ogni form: controlled state → validazione Zod → submit via Supabase → feedback haptic + toast
- Ogni lista: FlashList → pull-to-refresh → filtri chip → swipe actions

### Test frequenti:
Dopo ogni feature, testa su:
1. Expo Go (sviluppo rapido)
2. Development build se serve (per features che richiedono native modules non in Expo Go)

### Git:
Dopo ogni FASE:
```bash
git add .
git commit -m "feat: [descrizione fase]"
```
