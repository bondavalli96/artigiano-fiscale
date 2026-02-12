import { format, parseISO } from "date-fns";
import { it, enUS, es, pt } from "date-fns/locale";
import type { Locale } from "@/lib/i18n";

const LOCALE_MAP = { it, en: enUS, es, pt };

/**
 * Format a currency amount in EUR
 */
export function formatCurrency(amount: number, locale: Locale = "it"): string {
  const localeMap: Record<Locale, string> = {
    it: "it-IT",
    en: "en-IE",
    es: "es-ES",
    pt: "pt-PT",
  };
  return new Intl.NumberFormat(localeMap[locale], {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

/**
 * Format a date in long format
 */
export function formatDate(date: string | Date, locale: Locale = "it"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  const fmtMap: Record<Locale, string> = {
    it: "d MMMM yyyy",
    en: "MMMM d, yyyy",
    es: "d 'de' MMMM 'de' yyyy",
    pt: "d 'de' MMMM 'de' yyyy",
  };
  return format(d, fmtMap[locale], { locale: LOCALE_MAP[locale] });
}

/**
 * Format a date in short format
 */
export function formatDateShort(date: string | Date, locale: Locale = "it"): string {
  const d = typeof date === "string" ? parseISO(date) : date;
  const fmtMap: Record<Locale, string> = {
    it: "dd/MM/yyyy",
    en: "MM/dd/yyyy",
    es: "dd/MM/yyyy",
    pt: "dd/MM/yyyy",
  };
  return format(d, fmtMap[locale], { locale: LOCALE_MAP[locale] });
}

/**
 * Greeting based on time of day
 */
export function getGreeting(locale: Locale = "it"): string {
  const hour = new Date().getHours();
  const greetings: Record<Locale, [string, string, string]> = {
    it: ["Buongiorno", "Buon pomeriggio", "Buonasera"],
    en: ["Good morning", "Good afternoon", "Good evening"],
    es: ["Buenos días", "Buenas tardes", "Buenas noches"],
    pt: ["Bom dia", "Boa tarde", "Boa noite"],
  };
  const [morning, afternoon, evening] = greetings[locale];
  if (hour < 12) return morning;
  if (hour < 18) return afternoon;
  return evening;
}
