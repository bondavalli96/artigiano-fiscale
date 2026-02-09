export const SYSTEM_ROLE =
  "Sei un assistente AI per artigiani italiani. Rispondi sempre in italiano. Output sempre in JSON valido. Non inventare dati, usa solo ciò che è fornito.";

export function suggestPriceListPrompt(trade: string): string {
  return `Sei un assistente per artigiani italiani. Genera un listino prezzi standard con 15 voci per un ${trade} italiano.

Per ogni voce includi:
- description: descrizione breve della voce (es. "Installazione rubinetto")
- unit: unità di misura (ore, pezzo, metro, metro quadro, forfait)
- category: categoria (manodopera, materiale, trasferta)

NON inserire prezzi — solo descrizioni, unità e categorie.
Rispondi SOLO con un JSON array valido, senza testo aggiuntivo.

Esempio formato:
[{"description":"Installazione rubinetto","unit":"pezzo","category":"manodopera"}]`;
}

export function extractJobPrompt(text: string, trade: string): string {
  return `Analizza questo testo di un ${trade}. Estrai:
- tipo_lavoro: tipo di lavoro descritto
- parole_chiave: array di parole chiave rilevanti
- prezzi_menzionati: array di numeri (prezzi menzionati, se presenti)
- materiali: array di materiali menzionati
- urgenza: "bassa", "media" o "alta" (stima basata sul testo)
- note: eventuali note aggiuntive

Testo da analizzare:
"${text}"

Rispondi SOLO in JSON valido. Se un campo non è chiaro, usa null.`;
}

export function suggestQuotePrompt(
  jobDescription: string,
  priceList: { description: string; unit: string; default_price: number | null }[]
): string {
  return `Basandoti sulla descrizione del lavoro e sul listino dell'artigiano, genera una bozza di preventivo.

Descrizione lavoro: "${jobDescription}"

Listino artigiano disponibile:
${priceList.map((p) => `- ${p.description} (${p.unit}): ${p.default_price ? `€${p.default_price}` : "prezzo non definito"}`).join("\n")}

Genera un array di voci preventivo. Per ogni voce:
- description: descrizione della voce
- quantity: quantità stimata
- unit: unità di misura
- unit_price: prezzo unitario suggerito (basato sul listino se disponibile)
- total: quantità × prezzo unitario

Rispondi SOLO in JSON array valido.`;
}

export function monthlySummaryPrompt(
  income: number,
  expenses: number,
  prevIncome: number,
  prevExpenses: number
): string {
  const margin = income - expenses;
  const prevMargin = prevIncome - prevExpenses;

  return `Riassumi la situazione finanziaria di questo mese per un artigiano italiano.

Dati:
- Entrate questo mese: €${income.toFixed(2)}
- Uscite questo mese: €${expenses.toFixed(2)}
- Margine: €${margin.toFixed(2)}
- Entrate mese scorso: €${prevIncome.toFixed(2)}
- Uscite mese scorso: €${prevExpenses.toFixed(2)}
- Margine mese scorso: €${prevMargin.toFixed(2)}

Scrivi un riassunto in 3-4 frasi, come parleresti a un amico. Zero gergo tecnico-contabile. Usa il "tu".
Rispondi SOLO con il testo del riassunto, niente JSON.`;
}
