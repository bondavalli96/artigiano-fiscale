# ArtigianoAI — Analisi Competitiva e Posizionamento

> Documento riservato — Ultimo aggiornamento: Febbraio 2026

---

## Premessa: cosa NON siamo

ArtigianoAI **non e' un gestionale contabile**. Non e' un sostituto di Fatture in Cloud, TeamSystem o Via Libera. Non facciamo prima nota, non gestiamo F24, non siamo un intermediario SdI.

ArtigianoAI e' **lo strumento operativo che sta tra il cantiere e il gestionale**. Copre la fase che oggi nessun software tocca: dal sopralluogo alla fattura pronta da inviare. Si **integra** con i sistemi esistenti, non li sostituisce.

Il commercialista continua a usare i suoi strumenti. L'artigiano smette di mandare foto su WhatsApp e preventivi su carta.

---

## Il problema reale

Un idraulico italiano oggi fa cosi':

```
Sopralluogo → foto su WhatsApp personale → preventivo su foglio Excel
→ stampa PDF → manda su WhatsApp → il cliente accetta a voce
→ aspetta 30 giorni → chiama il commercialista → "fammi la fattura"
→ il commercialista rincorre i dati mancanti
```

**Tempo perso**: 3-5 ore a settimana in burocrazia operativa.
**Dati persi**: nessuno storico prezzi, nessun tracciamento accettazione, nessuna visibilita' sugli incassi.
**Rischio fiscale**: fatture emesse in ritardo, marche da bollo dimenticate, soglia forfettario non monitorata.

I gestionali contabili risolvono l'ultimo miglio (la fattura elettronica). ArtigianoAI risolve tutto quello che viene **prima**.

---

## Mappa del mercato italiano

### I player e cosa fanno

| | Fatture in Cloud | TeamSystem | Via Libera Suite | Danea | **ArtigianoAI** |
|---|---|---|---|---|---|
| **Target** | Tutte le P.IVA | Studi, PMI | Commercialisti | Micro-imprese | Artigiani in cantiere |
| **Approccio** | Web gestionale | ERP completo | Suite studio | Desktop + cloud | Mobile-first AI |
| **Prezzo** | 4-49 EUR/mese | Custom (alto) | Custom (alto) | 6-29 EUR/mese | 9-19 EUR/mese |
| **Utenti** | ~580K | ~2M (gruppo) | ~100K studi | ~200K | — (pre-lancio) |
| **Fattura elettronica SdI** | Si (nativo) | Si (nativo) | Si (nativo) | Si (nativo) | Si (via provider API) |
| **Preventivi** | Template base | Template base | No | Template base | **AI da voce/foto** |
| **Gestione lavori/cantiere** | No | No | No | No | **Si, con foto e stato** |
| **Input vocale AI** | No | No | No | No | **Si** |
| **Inbox intelligente** | No | No | No | No | **Si (multicanale)** |
| **Portale cliente** | No | No | No | No | **Si (link accettazione)** |
| **App mobile nativa** | Si (limitata) | Si (limitata) | No | No | **Si (core)** |
| **Compliance proattiva** | Alert base | Alert base | Si (studio) | No | **Si (AI, in-app)** |

### Il punto chiave

Fatture in Cloud e TeamSystem sono **eccellenti nella fatturazione**. Ma nessuno di loro e' pensato per un elettricista che sta su un'impalcatura con il telefono in mano, deve fare un preventivo rapido e mandarlo al cliente prima che chiami un concorrente.

---

## Dove ci posizioniamo

```
                    FASE OPERATIVA                    FASE CONTABILE
                    (ArtigianoAI)                    (Gestionali esistenti)

Sopralluogo ──→ Lavoro ──→ Preventivo ──→ Fattura ──→ SdI ──→ Contabilita'
   foto            AI          AI           auto       API      commercialista
   voce         estrae      genera        da prev.   provider    Via Libera
   testo        dati        bozza        compliance  integrato   TeamSystem
                                          fiscale               Fatt. in Cloud

◄─────── NESSUNO COPRE QUESTA FASE ────────►◄──── MERCATO SATURO ─────►
```

**Non competiamo sui gestionali contabili. Alimentiamo i gestionali contabili con dati puliti.**

L'artigiano usa ArtigianoAI in cantiere. Il commercialista riceve i dati gia' strutturati, le fatture gia' con le note fiscali corrette, la marca da bollo gia' applicata dove serve.

---

## Le 5 cose che solo ArtigianoAI fa

### 1. Preventivo AI da voce o descrizione

L'artigiano parla al telefono: *"Devo cambiare il miscelatore del bagno, aggiungere due raccordi, servono circa 3 ore"*. Claude estrae le voci, incrocia con il suo listino prezzi personalizzato, e genera un preventivo completo con prezzi, IVA, tempi.

**Nessun concorrente italiano ha questa funzione.** Fatture in Cloud ha template manuali. TeamSystem non ha AI. HERO Software (tedesco) ha preventivi ma nessun input vocale.

**Cosa c'e' nel codice**: Edge Function `extract-job` + `suggest-quote` + `transcribe` (Whisper STT). Listino prezzi AI generato per mestiere via `suggest-price-list`.

---

### 2. Inbox AI multicanale

L'artigiano riceve una fattura del fornitore via email, una foto del cantiere dal cliente su WhatsApp, un preventivo da un collega. Oggi gestisce tutto manualmente.

Con ArtigianoAI: ogni input (foto, email, testo, documento) viene classificato automaticamente dall'AI → instradato nella sezione corretta (lavoro, fattura passiva, cliente, ricevuta) → il record viene creato con i dati gia' estratti.

**Nessun tool per artigiani ha un sistema simile.** I sistemi di classificazione email enterprise (EmailTree, Affinda) costano 500+ EUR/mese e sono B2B. Noi lo facciamo per 19 EUR/mese.

**Cosa c'e' nel codice**: Edge Functions `classify-inbox-item` + `route-inbox-item` + `receive-email`. Claude Vision per foto/documenti. Tabella `inbox_items` con confidence score.

---

### 3. Compliance fiscale italiana proattiva

Non aspettiamo che il commercialista trovi i problemi. L'app avvisa l'artigiano **in tempo reale**:

- **Soglia forfettario**: barra di progresso verso 85.000 EUR con alert a 70%, 80%, superamento
- **Reverse Charge automatico**: se il cliente e' un'azienda edile, l'app rileva il settore, propone il reverse charge (Art. 17 DPR 633/72), e genera la nota fiscale corretta
- **Marca da bollo**: applicata automaticamente sulle fatture forfettarie sopra 77,47 EUR (DM 17.06.2014)
- **Fatture non inviate allo SdI**: alert se una fattura ha piu' di 12 giorni e non e' stata trasmessa
- **Stima tasse annue**: per i forfettari, calcolo automatico di imposta sostitutiva (15%) + contributi INPS (24,48%) con accantonamento mensile suggerito

**Fatture in Cloud ha alert basici. Ma nessuno ha il reverse charge automatico basato sul settore del cliente, o la stima tasse con accantonamento mensile.**

**Cosa c'e' nel codice**: Edge Functions `apply-tax-rules` + `check-fiscal-alerts` + `generate-fattura-xml` (FatturaPA 1.2.2). Widget `ComplianceWidget` + `ForfettarioWidget`. Sezione Stats con breakdown SdI, bolli, DSO, stima tasse.

---

### 4. Portale cliente e accettazione digitale

L'artigiano manda un link al cliente (via WhatsApp, il canale naturale). Il cliente apre il link, vede il preventivo professionale con logo, voci dettagliate, condizioni. Clicca "Accetto". L'artigiano riceve la notifica push.

Niente carta, niente "si' va bene" a voce, niente ambiguita'. Accettazione tracciata con timestamp.

**Nessun gestionale italiano offre un portale cliente per artigiani.** HERO Software (tedesco) ha qualcosa di simile ma non supporta il mercato italiano.

**Cosa c'e' nel codice**: Route pubblica `quote-accept/[id]` accessibile senza login. Deep link con schema `artigianoai://`. Condivisione via `QuickShareButtons` (WhatsApp, Email, SMS).

---

### 5. Statistiche AI con insight operativo

Non solo grafici di fatturato. L'AI analizza i dati e scrive insight comprensibili:

*"Questo mese hai fatturato 4.200 EUR ma il 40% viene da un solo cliente. Se Rossi smette di chiamarti, perdi quasi meta' del fatturato. Cerca di diversificare."*

Piu' le nuove statistiche fiscali:
- **DSO** (Days Sales Outstanding): tempo medio di incasso
- **% pagati puntuali**: quanti clienti pagano prima della scadenza
- **Breakdown SdI**: quante fatture accettate / consegnate / scartate / non inviate
- **Stima tasse forfettario**: con coefficiente, imposta sostitutiva, INPS, accantonamento

**Nessun gestionale per artigiani ha AI insight.** I tool di business intelligence (Qlik, PowerBI) sono enterprise e costano 10x.

**Cosa c'e' nel codice**: Edge Function `stats-summary` con Claude Sonnet per insight. 3 periodi (mese/trimestre/anno). Confronto YoY. Top clienti, zone, categorie spese.

---

## Integrazione con l'ecosistema esistente

### Come funziona il flusso integrato

```
ArtigianoAI (campo)                      Gestionale (studio)
─────────────────                        ──────────────────
1. Artigiano crea lavoro
2. AI genera preventivo
3. Cliente accetta via link
4. Preventivo → Fattura (1 tap)
5. Compliance applicata auto
   (RC, bollo, note fiscali)
6. FatturaPA XML generata ──────────→   7. Inviata via SdI (provider API)
                                         8. Commercialista vede in Via Libera
                                         9. Contabilita' aggiornata
                           ←────────────
                          Export CSV per commercialista
```

### Provider SdI supportati

ArtigianoAI non e' un intermediario SdI. Si collega ai provider gia' usati:

| Provider | Tipo | Integrazione |
|---|---|---|
| **Fatture in Cloud** | API REST | Invio XML, ricezione esito |
| **Aruba** | PEC + API | Invio tramite PEC certificata |
| **Fattura24** | API REST | Invio e monitoraggio |

L'artigiano configura le credenziali del suo provider nelle impostazioni. ArtigianoAI genera l'XML FatturaPA 1.2.2, lo invia tramite il provider, e mostra lo stato (inviata → consegnata → accettata/scartata).

### Export per il commercialista

Dalla pagina Impostazioni → Export:
- **CSV fatture attive**: tutte le fatture emesse con importi, IVA, stato SdI
- **CSV fatture passive**: tutti i costi con categoria, fornitore, importo
- **ZIP fatture PDF**: archivio completo per conservazione
- Filtri per periodo e formato pronto per import in Via Libera / TeamSystem

---

## Segmento target

### Chi e' il nostro utente

| Caratteristica | Dettaglio |
|---|---|
| **Mestiere** | Idraulico, elettricista, muratore, imbianchino, fabbro, falegname, climatizzista |
| **Dimensione** | Ditta individuale o max 2-3 collaboratori |
| **Regime fiscale** | 70% forfettario, 30% ordinario |
| **Fatturato** | 25.000 - 85.000 EUR/anno |
| **Eta'** | 30-55 anni |
| **Device** | Smartphone (Android 65%, iOS 35%), NO desktop in cantiere |
| **Tool attuali** | WhatsApp + Excel + commercialista. Forse Fatture in Cloud |
| **Pain principale** | Perdono lavori perche' mandano il preventivo troppo tardi |

### Dimensione del mercato

| | Numero | Fonte |
|---|---|---|
| Imprese artigiane in Italia | 1.260.000 | Confartigianato 2024 |
| Di cui edilizia + impianti | ~520.000 | ISTAT |
| P.IVA regime forfettario | ~2.100.000 | MEF 2024 |
| Artigiani che usano un gestionale | ~12% | Stima settore |
| **Artigiani senza tool digitale per preventivi** | **~88%** | **Il nostro mercato** |

### Il mercato indirizzabile

- **TAM** (Total): 1.26M artigiani italiani = ~15M EUR/anno a 12 EUR/mese
- **SAM** (Serviceable): 520K edilizia + impianti = ~6.2M EUR/anno
- **SOM** (Obtainable, anno 1): 0.5-1% = 2.600-5.200 utenti = **31K-62K EUR MRR**

Con espansione a Spagna (1.5M autonomos) e Portogallo (400K), il TAM triplica.

---

## Pricing vs competitor

| Tool | Piano base | Piano pro | Target |
|---|---|---|---|
| Fatture in Cloud | 4 EUR/mese | 49 EUR/mese | Tutte le P.IVA |
| Danea Easyfatt | 6 EUR/mese | 29 EUR/mese | Micro-imprese |
| TeamSystem | ~50 EUR/mese | Custom | PMI, studi |
| HERO Software | 29 EUR/mese | 69 EUR/mese | Artigiani (DACH) |
| **ArtigianoAI** | **9 EUR/mese** | **19 EUR/mese** | **Artigiani IT** |

**Piano Base (9 EUR/mese)**: Lavori, preventivi manuali, fatture, clienti, PDF, condivisione WhatsApp.

**Piano Pro (19 EUR/mese)**: Tutto il base + AI (preventivi AI, inbox AI, analisi vocale, insight statistiche, compliance proattiva, export commercialista).

Nota: Fatture in Cloud ha aumentato i prezzi da 307 EUR/anno a 717 EUR/anno in 4 anni. Recensioni Trustpilot piene di lamentele. Opportunita' concreta per un'alternativa.

---

## Perche' non stiamo reinventando la ruota

| Ruota gia' inventata | Chi la fa bene | Cosa facciamo noi |
|---|---|---|
| Fatturazione elettronica SdI | Fatture in Cloud, Aruba, Fattura24 | **Ci colleghiamo via API** |
| Contabilita' e prima nota | TeamSystem, Via Libera | **Export CSV pronto per import** |
| F24 e dichiarazioni | Il commercialista | **Forniamo dati puliti e organizzati** |
| Conservazione sostitutiva | Provider SdI certificati | **Link ai documenti conservati** |

| Ruota che mancava | Chi la fa oggi | Cosa facciamo noi |
|---|---|---|
| Preventivo da voce/foto | **Nessuno** | AI genera bozza completa |
| Classificazione documenti AI | **Nessuno (sotto 500 EUR/mese)** | Inbox multicanale con routing |
| Compliance proattiva in-app | **Nessuno per artigiani** | Alert RC, bollo, soglia, SdI |
| Accettazione preventivo digitale | **Nessuno per artigiani** | Link web, notifica push |
| Stima tasse forfettario | **Nessuno in-app** | Calcolo live con accantonamento |

---

## Stack tecnologico (per i tecnici)

| Layer | Tecnologia | Perche' |
|---|---|---|
| App mobile | React Native + Expo SDK 52 | Cross-platform, store-ready |
| UI | NativeWind + React Native Paper | Mobile-first, Material Design |
| Backend | Supabase (PostgreSQL + Auth + Storage) | RLS, realtime, zero DevOps |
| AI | Claude Sonnet 4.5 (via Edge Functions) | Nessuna API key nel client |
| STT | OpenAI Whisper | Accuratezza italiano |
| PDF | Server-side generation | Professionale con logo |
| SdI | Provider API (FiC, Aruba, F24) | Certificati, senza intermediazione |
| Notifiche | Expo Notifications | Push native iOS/Android |
| i18n | 4 lingue (IT, EN, ES, PT) | Espansione Spagna/Portogallo |

22 Edge Functions deployate su Supabase (Deno runtime). 46 schermate. 635 chiavi di traduzione per lingua. 12 tabelle con RLS.

---

## Roadmap sintetica

| Trimestre | Obiettivo | Milestone |
|---|---|---|
| **Q1 2026** | MVP Italia | Beta con 50 artigiani, SdI via provider, compliance completa |
| **Q2 2026** | Go-to-market IT | App Store + Play Store, pricing live, 500+ utenti |
| **Q3 2026** | Espansione ES | Traduzione completa, compliance TicketBAI, beta Spagna |
| **Q4 2026** | Portogallo + Scale | SAF-T compliance, 2.000+ utenti totali |
| **2027** | Brasile (LATAM) | Nota fiscal, mercato 8M+ artigiani MEI |

---

## In sintesi

ArtigianoAI non sostituisce il commercialista e non sostituisce il gestionale contabile.

**Risolve il problema che nessun gestionale risolve**: l'artigiano che sta in cantiere, ha il telefono in mano, e ha bisogno di fare un preventivo adesso, mandarlo al cliente adesso, e sapere se i suoi conti fiscali sono in ordine — senza chiamare nessuno.

Il commercialista riceve dati migliori. Il gestionale riceve fatture gia' pronte. L'artigiano smette di perdere 3-5 ore a settimana in burocrazia.

**Tre numeri**:
- **88%** degli artigiani non usa nessun tool digitale per i preventivi
- **0** concorrenti in Italia combinano AI + cantiere + compliance
- **9 EUR/mese** contro i 49+ EUR/mese dei generalisti

---

*ArtigianoAI — Il copilota dell'artigiano. L'AI propone, l'artigiano decide.*
