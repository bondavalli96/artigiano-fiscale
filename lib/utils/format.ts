import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";

/**
 * Formatta un importo in Euro con formato italiano
 * @example formatCurrency(1234.56) → "€ 1.234,56"
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/**
 * Formatta una data in formato italiano lungo
 * @example formatDate("2026-02-09") → "9 febbraio 2026"
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "d MMMM yyyy", { locale: it });
}

/**
 * Formatta una data in formato corto
 * @example formatDateShort("2026-02-09") → "09/02/2026"
 */
export function formatDateShort(date: string | Date): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  return format(d, "dd/MM/yyyy", { locale: it });
}

/**
 * Saluto basato sull'ora del giorno
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
}
