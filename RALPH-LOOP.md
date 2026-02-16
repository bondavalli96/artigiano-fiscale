# RALPH-LOOP — Compliance Fiscale Intelligente

## Obiettivo
Implementare compliance fiscale invisibile, automatica e contestuale.
L'artigiano non deve capire la fiscalita — l'app lo protegge in silenzio.

**Non** diventiamo un gestionale fiscale. Restiamo il layer operativo + AI.
Il layer fiscale lo deleghiamo a provider (Fatture in Cloud / Aruba / Fattura24).

---

## FASE 0 — DATABASE + TIPI + EDGE FUNCTION BASE
**Obiettivo:** Creare le fondamenta per tutte le feature fiscali.

### Azioni:

1. **Migration: tabella `fiscal_profiles`**
   ```sql
   CREATE TABLE fiscal_profiles (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE UNIQUE,
     regime TEXT NOT NULL DEFAULT 'ordinario', -- 'ordinario' | 'forfettario' | 'minimo'
     coefficient NUMERIC(4,2), -- coefficiente redditivita forfettario
     annual_revenue_limit NUMERIC(10,2) DEFAULT 85000.00,
     sdi_provider TEXT, -- 'fatture_in_cloud' | 'aruba' | 'fattura24' | null
     sdi_provider_api_key_encrypted TEXT, -- encrypted, stored in vault
     sdi_code TEXT DEFAULT '0000000',
     pec_address TEXT,
     digital_stamp_enabled BOOLEAN DEFAULT TRUE,
     reverse_charge_enabled BOOLEAN DEFAULT TRUE,
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now()
   );
   ```

2. **Migration: tabella `fiscal_year_tracking`**
   ```sql
   CREATE TABLE fiscal_year_tracking (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     artisan_id UUID REFERENCES artisans(id) ON DELETE CASCADE,
     year INTEGER NOT NULL,
     total_revenue NUMERIC(12,2) DEFAULT 0,
     total_expenses NUMERIC(12,2) DEFAULT 0,
     invoice_count INTEGER DEFAULT 0,
     last_updated TIMESTAMPTZ DEFAULT now(),
     UNIQUE(artisan_id, year)
   );
   ```

3. **Migration: aggiornare tabella `clients`** — aggiungere campo per tipo (privato/azienda) e settore
   ```sql
   ALTER TABLE clients ADD COLUMN client_type TEXT DEFAULT 'privato'; -- 'privato' | 'azienda'
   ALTER TABLE clients ADD COLUMN business_sector TEXT; -- 'edilizia' | 'commercio' | etc
   ALTER TABLE clients ADD COLUMN vat_number TEXT;
   ALTER TABLE clients ADD COLUMN sdi_code TEXT;
   ALTER TABLE clients ADD COLUMN pec_address TEXT;
   ```

4. **Migration: aggiornare tabella `invoices_active`** — campi fiscali
   ```sql
   ALTER TABLE invoices_active ADD COLUMN reverse_charge BOOLEAN DEFAULT FALSE;
   ALTER TABLE invoices_active ADD COLUMN reverse_charge_article TEXT; -- 'art17_c6_a' etc
   ALTER TABLE invoices_active ADD COLUMN digital_stamp BOOLEAN DEFAULT FALSE;
   ALTER TABLE invoices_active ADD COLUMN digital_stamp_amount NUMERIC(4,2) DEFAULT 2.00;
   ALTER TABLE invoices_active ADD COLUMN fiscal_notes TEXT[]; -- diciture obbligatorie
   ALTER TABLE invoices_active ADD COLUMN sdi_status TEXT DEFAULT 'not_sent'; -- 'not_sent' | 'sent' | 'delivered' | 'rejected' | 'accepted'
   ALTER TABLE invoices_active ADD COLUMN sdi_id TEXT; -- ID dal provider SdI
   ALTER TABLE invoices_active ADD COLUMN xml_url TEXT; -- URL XML fattura elettronica
   ```

5. **RLS** su tutte le nuove tabelle/colonne

6. **TypeScript types** — aggiornare `types/index.ts` con i nuovi campi

7. **Edge Function `apply-tax-rules`** — il cuore della compliance:
   ```
   Input:
   - regime_fiscale: 'ordinario' | 'forfettario' | 'minimo'
   - client_type: 'privato' | 'azienda'
   - business_sector: string
   - intervention_type: string
   - amount: number
   - artisan_trade: string

   Output:
   - vat_rate: number (22, 10, 4, 0)
   - vat_amount: number
   - reverse_charge: boolean
   - reverse_charge_article: string | null
   - digital_stamp: boolean
   - digital_stamp_amount: number
   - mandatory_notes: string[] (diciture obbligatorie)
   - warnings: string[] (alert per l'artigiano)
   ```

### Verifica:
- Migration applicate senza errori
- RLS attive
- Edge Function `apply-tax-rules` risponde correttamente a casi test:
  - Forfettario con fattura > 77.47: deve tornare marca da bollo
  - Ordinario + edilizia + azienda: deve tornare reverse charge
  - Forfettario: IVA = 0, dicitura corretta

---

## FASE 1 — REGIME FISCALE (Onboarding + Settings)
**Obiettivo:** L'artigiano sceglie il regime una volta, tutto il resto si adatta.

### Azioni:

1. **Aggiornare Onboarding** (`app/onboarding/index.tsx`):
   - Aggiungere step "Regime Fiscale" DOPO i dati aziendali
   - 3 opzioni con spiegazione semplice:
     - **Ordinario** — "Applichi IVA normalmente"
     - **Forfettario** — "Non applichi IVA, regime agevolato"
     - **Non so** — "Lo chiederemo poi al tuo commercialista"
   - Se sceglie forfettario: chiedere coefficiente redditivita o dedurlo dal mestiere
   - Salvare in `fiscal_profiles`

2. **Settings: sezione Regime Fiscale** (`app/(tabs)/settings/index.tsx`):
   - Card "Regime Fiscale" cliccabile
   - Mostra regime corrente
   - Permette cambio (con warning)
   - Se forfettario: mostra soglia e fatturato corrente

3. **Dashboard Forfettario** (se regime = forfettario):
   - Widget in dashboard principale
   - Barra progresso verso 85.000 EUR
   - "Hai fatturato X EUR su 85.000 EUR"
   - Colori: verde < 60%, giallo 60-80%, rosso > 80%
   - Alert push quando supera 70.000 EUR

### Verifica:
- Onboarding salva regime correttamente
- Settings mostra e permette cambio
- Dashboard forfettario si aggiorna con dati reali
- Build compila senza errori

---

## FASE 2 — MARCA DA BOLLO AUTOMATICA
**Obiettivo:** Se fattura senza IVA > 77.47 EUR, marca da bollo inserita automaticamente.

### Azioni:

1. **Logica in `apply-tax-rules`** (gia creata in FASE 0):
   - Se `regime = forfettario` E `amount > 77.47`:
     - `digital_stamp = true`
     - `digital_stamp_amount = 2.00`
   - Se `regime = ordinario` con esenzione IVA E `amount > 77.47`:
     - Stessa logica

2. **UI nella creazione fattura** (`app/(tabs)/invoices/` o componente fattura):
   - Quando l'artigiano crea fattura, chiamare `apply-tax-rules`
   - Se `digital_stamp = true`:
     - Mostrare riga automatica "Marca da bollo - 2,00 EUR"
     - Tooltip: "Obbligatoria per fatture senza IVA sopra 77,47 EUR"
     - L'artigiano NON deve fare nulla, e gia inserita
   - Se rimuove manualmente: warning "Attenzione: la marca da bollo e obbligatoria per legge"

3. **Nel PDF** (aggiornare `generate-pdf` Edge Function):
   - Aggiungere riga marca da bollo se presente
   - Aggiungere dicitura: "Imposta di bollo assolta in modo virtuale ai sensi del DM 17.06.2014"

### Verifica:
- Fattura forfettaria > 77.47 EUR: marca da bollo presente automaticamente
- Fattura forfettaria < 77.47 EUR: niente marca da bollo
- Fattura ordinaria con IVA: niente marca da bollo
- PDF mostra marca da bollo e dicitura corretta

---

## FASE 3 — REVERSE CHARGE AUTOMATICO (Edilizia)
**Obiettivo:** Quando le condizioni si verificano, proporre reverse charge automaticamente.

### Azioni:

1. **Motore di regole in `apply-tax-rules`**:
   ```
   SE:
     - client_type = 'azienda'
     - artisan_trade IN ('muratore', 'edile', 'piastrellista', 'imbianchino', 'cartongessista', 'idraulico', 'elettricista')
     - business_sector = 'edilizia' O intervention_type IN ('ristrutturazione', 'manutenzione', 'costruzione', 'demolizione', 'installazione')
   ALLORA:
     - reverse_charge = true
     - vat_rate = 0
     - reverse_charge_article = 'Art. 17, comma 6, lett. a) DPR 633/72'
     - mandatory_notes = ['Operazione in regime di inversione contabile...']
   ```

2. **UI nella creazione fattura**:
   - Quando il motore rileva reverse charge:
     - Banner giallo: "Reverse Charge applicabile"
     - Spiegazione semplice: "Il tuo cliente (azienda edile) paga l'IVA al posto tuo. Tu fatturi senza IVA."
     - Bottone "Applica" (preselezionato) / "Non applicare"
     - Se l'utente conferma: IVA rimossa, dicitura inserita automaticamente

3. **Aggiornare form cliente** per chiedere tipo (privato/azienda) e settore

4. **Nel PDF**:
   - Se reverse charge: niente riga IVA
   - Dicitura obbligatoria in calce
   - Riferimento normativo

### Verifica:
- Fattura a privato: nessun reverse charge proposto
- Fattura ad azienda edile per ristrutturazione: reverse charge proposto
- Fattura ad azienda non edile: nessun reverse charge
- PDF con dicitura corretta
- L'artigiano puo rifiutare il suggerimento

---

## FASE 4 — INTEGRAZIONE SdI (via Provider)
**Obiettivo:** L'artigiano invia fatture elettroniche senza uscire dall'app.

### Azioni:

1. **Settings: sezione SdI Provider** (`app/(tabs)/settings/`):
   - "Collega il tuo provider di fatturazione elettronica"
   - Opzioni: Fatture in Cloud, Aruba, Fattura24
   - Input API key del provider (con link a guida)
   - Test connessione
   - Salvataggio sicuro (Supabase Vault o encrypted)

2. **Edge Function `send-to-sdi`**:
   - Input: invoice_id, provider, api_key
   - Genera XML FatturaPA (formato standard italiano)
   - Invia al provider selezionato via API
   - Salva `sdi_status`, `sdi_id`, `xml_url`
   - Gestisce callback stato (consegnata/scartata)

3. **Edge Function `generate-fattura-xml`**:
   - Genera XML conforme FatturaPA 1.2.2
   - Include tutti i campi obbligatori:
     - Dati trasmissione
     - Cedente/Prestatore
     - Cessionario/Committente
     - Corpo fattura con righe
     - IVA, bollo, reverse charge se applicabile

4. **UI post-fattura**:
   - Dopo creazione fattura: "Vuoi inviarla allo SdI?"
   - Se provider collegato: un tap per inviare
   - Stato visibile: "In attesa" / "Consegnata" / "Scartata"
   - Se scartata: motivo + suggerimento per fix
   - Se provider non collegato: "Collega un provider nelle Impostazioni"

5. **Notifica push** quando lo stato cambia

### Verifica:
- Settings permette collegamento provider
- XML generato e valido (testare con validatore FatturaPA)
- Invio a provider funziona (test con sandbox se disponibile)
- Stati aggiornati correttamente
- Notifica push su cambio stato

---

## FASE 5 — DASHBOARD COMPLIANCE + ALERT
**Obiettivo:** L'artigiano vede a colpo d'occhio se e tutto in regola.

### Azioni:

1. **Widget Dashboard "Stato Fiscale"**:
   - Card nella dashboard principale
   - Icona semaforo: verde/giallo/rosso
   - Messaggi tipo:
     - Verde: "Tutto in regola"
     - Giallo: "Hai 2 fatture non inviate allo SdI"
     - Rosso: "Attenzione: stai per superare la soglia forfettario"

2. **Alert proattivi** (Edge Function `check-fiscal-alerts`):
   - Soglia forfettario (70k, 80k, 84k)
   - Fatture scadute non incassate
   - Fatture non inviate a SdI da > 12 giorni
   - Marca da bollo mancante su fatture vecchie
   - Scheduled via Supabase cron

3. **Notifiche push** per alert critici

4. **Sezione "Riepilogo Fiscale" in Settings**:
   - Fatturato anno corrente
   - Numero fatture emesse
   - Numero fatture a SdI / stato
   - Totale IVA / reverse charge applicato
   - Export dati per commercialista (CSV)

### Verifica:
- Dashboard mostra stato corretto
- Alert si attivano alle soglie giuste
- Notifiche push arrivano
- Export CSV funziona

---

## FASE 6 — DICITURE OBBLIGATORIE AUTOMATICHE
**Obiettivo:** Ogni fattura ha le diciture corrette in base al regime e tipo operazione.

### Azioni:

1. **Centralizzare diciture in `apply-tax-rules`**:
   - Forfettario:
     - "Operazione effettuata ai sensi dell'art. 1 commi 54-89 L. 190/2014 — regime forfettario"
     - "Non soggetta a ritenuta d'acconto ai sensi dell'art. 1 comma 67 L. 190/2014"
   - Reverse charge:
     - "Operazione soggetta a inversione contabile ai sensi dell'art. 17 comma 6 lett. a) DPR 633/72"
   - Marca da bollo:
     - "Imposta di bollo assolta in modo virtuale ai sensi del DM 17.06.2014"
   - Cassa previdenza (se applicabile):
     - "Contributo integrativo 4% ai sensi della L. 335/95"

2. **Mostrare nel preview fattura** con tooltip esplicativo

3. **Includere nel PDF** automaticamente in calce

### Verifica:
- Forfettario: diciture corrette presenti
- Ordinario con reverse charge: dicitura reverse charge presente
- Marca da bollo: dicitura bollo presente
- PDF include tutte le diciture

---

## FASE 7 — CONSERVAZIONE DIGITALE (Riferimento)
**Obiettivo:** Mostrare all'artigiano che le fatture sono conservate a norma.

### Azioni:

1. **Badge "Conservata a norma"** su ogni fattura inviata a SdI
   - Se il provider gestisce conservazione (Fatture in Cloud, Aruba lo fanno):
     - Mostrare badge verde "Conservata a norma"
     - Info: "Le tue fatture sono conservate per 10 anni come richiesto dalla legge"

2. **Non implementare conservazione diretta** — appoggiarsi al provider

3. **Nella fattura dettaglio**:
   - Sezione "Stato legale":
     - Inviata a SdI: si/no
     - Conservata: si/no (dal provider)
     - Data conservazione

### Verifica:
- Badge visibile su fatture inviate
- Info corrette dal provider

---

## FASE 8 — TESTING COMPLETO + POLISH
**Obiettivo:** Tutto funziona end-to-end senza errori.

### Azioni:

1. **Test scenari completi**:
   - Scenario 1: Artigiano forfettario, fattura 100 EUR a privato
     - Atteso: no IVA, marca da bollo, diciture forfettario
   - Scenario 2: Muratore ordinario, fattura a impresa edile per ristrutturazione
     - Atteso: reverse charge, no IVA esposta, dicitura art. 17
   - Scenario 3: Idraulico ordinario, fattura a privato
     - Atteso: IVA 22%, nessun reverse charge
   - Scenario 4: Forfettario vicino a 85k
     - Atteso: alert nella dashboard
   - Scenario 5: Fattura con SdI collegato
     - Atteso: invio automatico, stato aggiornato

2. **Verifica build**: `npx expo start` senza errori

3. **Verifica TypeScript**: `npx tsc --noEmit`

4. **Performance**: nessun re-render inutile nei componenti fiscali

5. **Git commit finale**

### Verifica:
- Tutti i 5 scenari passano
- Build pulito
- TypeScript pulito
- Performance ok

---

## REGOLE PER RALPH

### Priorita compliance:
1. `apply-tax-rules` deve essere CORRETTO — errori fiscali = sanzioni per l'artigiano
2. Mai inventare regole fiscali. Se non sei sicuro, cerca la normativa con WebSearch
3. Usa Context7 per ogni libreria prima di scrivere codice
4. Ogni Edge Function deve avere error handling robusto

### UX fiscale:
1. Zero gergo tecnico nelle UI — traduci tutto in linguaggio artigiano
2. L'AI propone, l'artigiano conferma — MAI azioni automatiche irreversibili
3. Tooltip su ogni campo fiscale con spiegazione semplice
4. Colori semaforo: verde = ok, giallo = attenzione, rosso = azione richiesta

### Quando trovi un errore:
1. Leggi lo stack trace completo
2. Identifica file e riga
3. Se e un errore di libreria, usa Context7
4. Fixa e ri-testa
5. Non procedere MAI con errori aperti

### Tool da usare:
- **Supabase MCP:** apply_migration, execute_sql, deploy_edge_function
- **Context7:** per documentazione librerie
- **Chrome DevTools MCP:** per debug UI
- **WebSearch:** per normativa fiscale italiana quando serve
