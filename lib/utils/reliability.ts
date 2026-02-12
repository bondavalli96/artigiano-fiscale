import { supabase } from "@/lib/supabase";

/**
 * Calculate reliability score from average days late.
 * score = clamp(100 - avgDays * 3, 0, 100)
 *
 * Examples:
 *  - Pays on time or early (avgDays <= 0) → 100
 *  - 5 days late → 85
 *  - 10 days late → 70
 *  - 20 days late → 40
 *  - 33+ days late → 0
 */
export function calculateReliabilityScore(avgDaysLate: number): number {
  return Math.max(0, Math.min(100, Math.round(100 - avgDaysLate * 3)));
}

/**
 * Query all paid invoices for a client, calculate average days from
 * payment_due to paid_at, and update the client's reliability_score.
 */
export async function recalculateClientReliability(
  clientId: string
): Promise<void> {
  const { data: invoices } = await supabase
    .from("invoices_active")
    .select("payment_due, paid_at")
    .eq("client_id", clientId)
    .eq("status", "paid")
    .not("paid_at", "is", null)
    .not("payment_due", "is", null);

  if (!invoices || invoices.length === 0) return;

  let totalDays = 0;
  let count = 0;

  for (const inv of invoices) {
    const due = new Date(inv.payment_due!);
    const paid = new Date(inv.paid_at!);
    const diffMs = paid.getTime() - due.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    totalDays += diffDays;
    count++;
  }

  const avgDaysLate = totalDays / count;
  const score = calculateReliabilityScore(avgDaysLate);

  await supabase
    .from("clients")
    .update({ reliability_score: score })
    .eq("id", clientId);
}

/**
 * For a given client, calculate the average payment days
 * (positive = late, negative = early). Returns null if no paid invoices.
 */
export async function getClientAvgPaymentDays(
  clientId: string
): Promise<number | null> {
  const { data: invoices } = await supabase
    .from("invoices_active")
    .select("payment_due, paid_at")
    .eq("client_id", clientId)
    .eq("status", "paid")
    .not("paid_at", "is", null)
    .not("payment_due", "is", null);

  if (!invoices || invoices.length === 0) return null;

  let totalDays = 0;
  for (const inv of invoices) {
    const due = new Date(inv.payment_due!);
    const paid = new Date(inv.paid_at!);
    totalDays += (paid.getTime() - due.getTime()) / (1000 * 60 * 60 * 24);
  }

  return Math.round(totalDays / invoices.length);
}
