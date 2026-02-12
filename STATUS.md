# ArtigianoAI - Status Report

**Ultimo aggiornamento:** 2026-02-12

## Stato generale
- Backend Supabase operativo (project: `zvmvrhdcjprlbqfzslhg`)
- Edge Functions deployate e attive
- Navigazione mobile aggiornata a **bottom bar scrollabile orizzontale** (scelta UX attuale)
- Fix lingua AI completato end-to-end (frontend + edge function)
- Registrazione push token Expo attiva lato app (sync su `artisans.expo_push_token`)
- Nuova integrazione webhook WhatsApp inbound (`receive-whatsapp`) verso Inbox AI

## Deploy backend confermati (2026-02-12)
- `monthly-summary` deployata e attiva
- `analyze-patterns` deployata e attiva
- Entrambe ora supportano input `locale` (`it`/`en`) e risposte nella lingua selezionata
- `transcribe` aggiornata con fallback provider voce (`Groq -> Deepgram -> OpenAI`)
- `classify-inbox-item` aggiornata con stesso fallback per audio inbox
- `receive-whatsapp` deployata e attiva (Twilio webhook -> inbox -> classify)
- `generate-pdf` redeploy confermato (versione attiva: `v5`)
- Migrations remote verificate allineate con locale fino a `20260212123000_add_country_code_to_artisans.sql`

## Allineamento requisiti (lista 17 punti)

| # | Requisito | Stato | Note |
|---|-----------|-------|------|
| 1 | Creazione Azienda + Profilo modificabile | ✅ Completato | Onboarding raccoglie nome, indirizzo, numero azienda, P.IVA/CF, email, telefono, sito, logo, firma (upload). Dati salvati su DB, modificabili in `Impostazioni > Profilo`, usati nella generazione PDF preventivi/fatture. |
| 2 | Sezione Impostazioni (dati/pagamenti/IVA/abbonamento) | 🟡 Parziale | Profilo + pagamenti (bonifico/carta/link Stripe/altri) + piano/upgrade presenti. IVA default presente; **IVA per singolo prodotto/servizio non ancora completa** (attuale gestione principalmente a livello documento). |
| 3 | Personalizzazione fatture (5 template + import custom) | ✅ Completato | Selezione 5 template, anteprima base, upload PDF/immagine custom, persistenza su profilo artigiano. |
| 4 | Configurazione campi fattura (show/hide) | ✅ Completato | Toggle quantità, unità, codice articolo, sconto, colonna IVA, scadenza, pagamento, note, firma; salvataggio default. |
| 5 | Creazione preventivi/fatture tramite voce | 🟡 Parziale | Registrazione + trascrizione + AI presenti nel flusso lavori; **manca ancora un flusso unico diretto voice→preventivo/fattura con conferma finale dedicata**. |
| 6 | Collegamento Lavoro → Preventivo → Fattura | ✅ Completato | Da lavoro: crea preventivo. Da preventivo: crea fattura con conversione dati automatica. |
| 7 | Azioni su preventivi/fatture (Invia/Download/Modifica/Duplica/Elimina) | 🟡 Parziale | Duplica/elimina/invio WhatsApp-email presenti. PDF condivisibile. **Modifica completa fattura attiva non ancora implementata** (preventivo sì). |
| 8 | Lista prodotti/servizi | ✅ Completato | Raccolta in onboarding + sezione dedicata (`Impostazioni > Listino`), non in menu principale. |
| 9 | Condivisione appuntamento agenda | ✅ Completato | Condivisione via WhatsApp/Email con data, ora, luogo, descrizione. |
| 10 | Creazione evento direttamente in agenda | ✅ Completato | Pulsante `Nuovo Evento` e campi richiesti (titolo, cliente, data, ora, luogo, descrizione, note). |
| 11 | Fix iOS registrazione vocale (`RecordingDisabledException`) | ✅ Completato | `setAudioModeAsync`, permessi microfono, fallback su permesso negato, gestione errore senza crash. |
| 12 | Compliance fiscale IT/ES/PT modulare | 🟡 Parziale (struttura) | Struttura country-driven implementata (`IT/ES/PT`). **Integrazione normativa reale completa (SDI/SII/TicketBAI/SAF-T validati) non ancora conclusa**. |
| 13 | Riduzione bottom navigation | 🟡 Modificato per scelta UX | Invece di 3-4 tab + hamburger, adottata **tab bar scrollabile** per rendere sempre visibili le pagine (decisione UX corrente). |
| 14 | Export CSV + ZIP PDF | ✅ Completato | Export CSV sistemato, selezione multipla fatture e download ZIP con documenti. |
| 15 | Scheda cliente con storico completo | ✅ Completato | Dati cliente + storico lavori, preventivi, fatture, pagamenti. |
| 16 | Invio fatture/solleciti + tracking stati | 🟡 Parziale | Invio WhatsApp/email presente per documenti e solleciti. Tracking `inviata/pagata/scaduta` presente; **stato "visualizzata" non completo**. |
| 17 | Drag & drop documenti con AI + conferma manuale | 🟡 Parziale | Upload documenti/scontrini + analisi AI + anteprima/edit + conferma manuale prima del routing/salvataggio finale. **Drag&drop puro non previsto su mobile native**. |

## Navigazione corrente
Bottom tab **scrollabile** con accesso diretto a:
- Home
- Lavori
- Fatture
- Agenda
- Preventivi
- Inbox
- Stats
- Other Services
- Impostazioni

## Pacchetto prezzi (aggiornato 2026-02-12)
- **Starter — EUR 19/mese**: Preventivi, Fatture, Agenda.
- **Pro — EUR 29/mese**: Starter + Solleciti + Inbox AI.
- **Business — EUR 49/mese**: Pro + Template personalizzati + **Other Services: Marketplace Artigiani Italiani con AI Storytelling**.
- Nuovo servizio marketplace (landing/mini-sito + storytelling AI + copy SEO) allineato ai piani `EUR 19-49/mese`.

## Fix recenti rilevanti
- Reattività lingua IT/EN per messaggi AI dashboard ripristinata
  - `DashboardSummary` ora rifetch su cambio lingua
  - `AISuggestionBanner` ora rifetch su cambio lingua
  - Edge function AI aggiornate con prompt localizzati
- Deploy edge function completato su Supabase (`monthly-summary`, `analyze-patterns`)
- Fix session stale post-migrazione AsyncStorage:
  - validazione sessione con `getUser()`
  - cleanup locale in caso token corrotto
  - cache profilo artigiano ora user-scoped (`artisan_profile:<user_id>`)
- Voice pipeline aggiornata con fallback provider:
  - Groq (prioritario), Deepgram, OpenAI Whisper (fallback)
- Push notifications inbox:
  - registrazione token lato app
  - deep-link automatico su apertura notifica verso dettaglio inbox
- Pacchetto abbonamenti aggiornato in `Impostazioni > Pagamenti e Abbonamento`:
  - prezzi visibili per piano
  - feature list aggiornata
  - inclusione del nuovo servizio marketplace AI storytelling nel piano Business
- Smoke test E2E `inbox -> classify -> route -> quote -> pdf -> whatsapp link` eseguito con successo via script:
  - `npm run test:e2e:inbox` (con env caricati)

## Nuovi task (FASE 1 / FASE 2)
| Task | Stato | Note |
|------|-------|------|
| MX records Resend (`artigianoai.it`) | ⏳ Operativo manuale | Richiede modifica DNS esterna; guida pronta in `docs/PHASE1-OPERATIONS.md` |
| Sostituzione Whisper con provider alternativi | ✅ Completato (fallback) | Implementato `Groq -> Deepgram -> OpenAI` in edge functions voce |
| Fix session stale AsyncStorage migration | ✅ Completato | Hardening auth bootstrap + cleanup cache legacy |
| Test end-to-end pipeline | ✅ Completato | Script `scripts/e2e-inbox-to-pdf.mjs` + run reale riuscito |
| Portale cliente web completo | 🟡 In corso | Base quote accept esistente; portale pubblico completo ancora da finalizzare |
| WhatsApp inbox integration | 🟡 In corso avanzato | Webhook `receive-whatsapp` già deployato; resta configurazione Twilio e mapping numeri |
| Push notifications nuovi item inbox | ✅ Completato | Sync token + deep-link notifiche |
| Onboarding video/tutorial beta | ✅ Completato (base) | CTA tutorial introdotta in onboarding (`EXPO_PUBLIC_ONBOARDING_VIDEO_URL`) |

## Gap aperti principali
1. IVA realmente configurabile per singola riga prodotto/servizio (end-to-end UI + DB + PDF).
2. Flusso diretto "voce → preventivo/fattura" con conferma finale unificata.
3. Modifica fattura attiva completa (non solo stati/azioni).
4. Stato documento "visualizzata" con tracking affidabile lato canale di invio.
5. Compliance fiscale reale produzione (tracciati validati + integrazione enti).
6. Configurazione DNS MX inbound Resend sul dominio produzione.
7. Setup Twilio WhatsApp (webhook + credenziali + eventuale mapping multi-artigiano).

## Verifiche operative eseguite oggi
- CLI Supabase: risolto errore `Access token not provided` esportando `SUPABASE_ACCESS_TOKEN` da `TOKEN_SUPABASE`.
- `supabase migration list --linked`: stato locale/remoto allineato.
- Deploy funzioni rieseguito: `generate-pdf`, `transcribe`, `classify-inbox-item`, `receive-whatsapp`.
- Smoke test E2E rieseguito con successo (`npm run test:e2e:inbox`), output con `ok: true`.
