# Guida API — ArtigianoAI

## Perche usiamo due API diverse

L'app usa **OpenAI** e **Anthropic** per motivi diversi. Ognuno fa quello in cui e il migliore.

---

## OpenAI — Solo Speech-to-Text

| | |
|---|---|
| **Servizio** | Whisper (modello whisper-1) |
| **Cosa fa** | Converte le registrazioni vocali dell'artigiano in testo |
| **Edge Function** | `transcribe` |
| **Lingua** | Italiano (supporta dialetti e accenti regionali) |
| **Costo** | ~$0.006/minuto di audio |

**Perche OpenAI per la voce?**
- Whisper e il miglior modello Speech-to-Text sul mercato per l'italiano
- Anthropic (Claude) non ha un servizio STT — non puo convertire audio in testo
- Nessuna alternativa competitiva a Whisper per qualita/prezzo

---

## Anthropic (Claude) — Tutta l'intelligenza AI

| | |
|---|---|
| **Servizio** | Claude Sonnet 4.5 (claude-sonnet-4-5-20250929) |
| **Cosa fa** | Ragionamento, estrazione dati, generazione testi, analisi documenti |
| **Edge Functions** | 7 su 10 (tutte quelle "intelligenti") |
| **Costo** | ~$1.50-3.00/utente/mese (stimato ~50 chiamate) |

**Perche Claude per il ragionamento?**
- Piu affidabile nel generare JSON valido senza inventare dati
- Segue meglio la regola "copilota" (propone, non decide)
- Ottimo con l'italiano
- Context window grande per analisi fatture e documenti
- Claude Vision per OCR fatture da foto

### Cosa fa Claude in ogni funzione

| Edge Function | Compito |
|---------------|---------|
| `suggest-price-list` | Genera 15 voci di listino standard per mestiere |
| `extract-job` | Estrae dati strutturati da descrizione lavoro (tipo, materiali, urgenza) |
| `suggest-quote` | Genera bozza preventivo basata su listino artigiano + descrizione lavoro |
| `extract-invoice` | OCR + estrazione dati da fatture passive (anche foto con Vision) |
| `monthly-summary` | Riassunto finanziario mensile in linguaggio semplice |
| `send-reminder` | Genera testi sollecito pagamento con tono adattivo (gentile → fermo) |
| `analyze-patterns` | Analizza storico e suggerisce miglioramenti (prezzi, clienti, efficienza) |

### Funzioni che NON usano AI

| Edge Function | Come funziona |
|---------------|---------------|
| `generate-pdf` | Puro template HTML — nessuna AI, solo formattazione dati |
| `check-anomalies` | Logica SQL — confronta importi con media, controlla storico clienti |

---

## Riepilogo flusso

```
Artigiano parla nel microfono
        |
        v
   [OpenAI Whisper] --> testo trascritto
        |
        v
   [Claude] --> estrae dati strutturati (tipo lavoro, materiali, urgenza)
        |
        v
   [Claude] --> genera bozza preventivo
        |
        v
   [Template HTML] --> genera PDF preventivo
        |
        v
   Artigiano invia al cliente via WhatsApp/email
```

---

## Costi stimati per utente/mese

| API | Uso stimato | Costo |
|-----|------------|-------|
| OpenAI Whisper | ~30 registrazioni da 1 min | ~$0.18 |
| Anthropic Claude | ~50 chiamate | ~$1.50-3.00 |
| Resend (email) | ~10 solleciti | ~$0.00 (free tier) |
| **Totale** | | **~$2-3/utente/mese** |

---

## Si potrebbe usare solo una API?

**Solo OpenAI (Whisper + GPT-4)?**
Tecnicamente si. Ma GPT-4 e meno affidabile di Claude nel generare JSON valido e nel seguire istruzioni precise. Tradeoff: qualita inferiore sulla parte core dell'app.

**Solo Anthropic?**
No. Claude non fa Speech-to-Text. Serve OpenAI (o un altro servizio STT) per la voce.

**Conclusione:** la combinazione attuale e ottimale. Ognuno fa quello in cui e il migliore.

---

## Chiavi API necessarie (Supabase Secrets)

```
ANTHROPIC_API_KEY=sk-ant-...   # Per Claude (7 Edge Functions)
OPENAI_API_KEY=sk-...          # Per Whisper (1 Edge Function: transcribe)
RESEND_API_KEY=re_...          # Per email solleciti (1 Edge Function: send-reminder)
```

Queste chiavi stanno SOLO nelle Supabase Edge Functions (server-side). Mai nel client mobile.
