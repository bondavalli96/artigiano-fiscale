import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import { useI18n } from "@/lib/i18n";
import type { Client, Job, Quote, InvoiceActive } from "@/types";

export default function ClientDetailScreen() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [client, setClient] = useState<Client | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<InvoiceActive[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;

    const [{ data: clientData }, { data: jobsData }, { data: quotesData }, { data: invoicesData }] =
      await Promise.all([
        supabase.from("clients").select("*").eq("id", id).single(),
        supabase
          .from("jobs")
          .select("*")
          .eq("client_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("quotes")
          .select("*")
          .eq("client_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("invoices_active")
          .select("*")
          .eq("client_id", id)
          .order("created_at", { ascending: false }),
      ]);

    setClient(clientData || null);
    setJobs(jobsData || []);
    setQuotes(quotesData || []);
    setInvoices(invoicesData || []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t("client") }} />
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </>
    );
  }

  if (!client) {
    return (
      <>
        <Stack.Screen options={{ title: t("client") }} />
        <View className="flex-1 items-center justify-center bg-white px-6">
          <Text className="text-muted text-center">{t("clientNotFound")}</Text>
        </View>
      </>
    );
  }

  const paidInvoices = invoices.filter((invoice) => invoice.status === "paid");
  const overdueInvoices = invoices.filter((invoice) => invoice.status === "overdue");
  const totalPaid = paidInvoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);
  const totalOutstanding = invoices
    .filter((invoice) => invoice.status !== "paid")
    .reduce((sum, invoice) => sum + (invoice.total || 0), 0);

  return (
    <>
      <Stack.Screen options={{ title: client.name }} />
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      >
        <View className="bg-white rounded-xl p-4 mb-3">
          <View className="flex-row items-center mb-1">
            <Text className="text-xl font-bold flex-1">{client.name}</Text>
            {client.client_type === "azienda" && (
              <View className="bg-blue-100 rounded-full px-2.5 py-0.5">
                <Text className="text-xs text-primary font-medium">
                  {t("clientAzienda")}
                </Text>
              </View>
            )}
          </View>
          {client.phone && <Text className="text-sm text-muted">{client.phone}</Text>}
          {client.email && <Text className="text-sm text-muted">{client.email}</Text>}
          {client.address && <Text className="text-sm text-muted mt-1">{client.address}</Text>}
          {client.business_sector && (
            <Text className="text-xs text-muted mt-1">
              {t("businessSector")}: {client.business_sector}
            </Text>
          )}
          {client.vat_number && (
            <Text className="text-xs text-muted mt-0.5">
              {t("vatNumber")}: {client.vat_number}
            </Text>
          )}
        </View>

        <View className="bg-white rounded-xl p-4 mb-3">
          <Text className="text-base font-semibold mb-3">{t("paymentsHistory")}</Text>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm text-muted">{t("paid")}</Text>
            <Text className="text-sm font-semibold text-green-700">{formatCurrency(totalPaid)}</Text>
          </View>
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm text-muted">{t("toCollect")}</Text>
            <Text className="text-sm font-semibold text-red-700">
              {formatCurrency(totalOutstanding)}
            </Text>
          </View>
          <Text className="text-xs text-muted">
            {overdueInvoices.length} {t("overdue").toLowerCase()} · {paidInvoices.length} {t("paid").toLowerCase()}
          </Text>
        </View>

        <View className="bg-white rounded-xl p-4 mb-3">
          <Text className="text-base font-semibold mb-3">{t("jobsHistory")}</Text>
          {jobs.length === 0 ? (
            <Text className="text-sm text-muted">{t("noJobs")}</Text>
          ) : (
            jobs.slice(0, 8).map((job) => (
              <TouchableOpacity
                key={job.id}
                onPress={() => router.push(`/(tabs)/jobs/${job.id}` as any)}
                className="py-2 border-b border-gray-100"
              >
                <Text className="text-sm font-medium">{job.title}</Text>
                <Text className="text-xs text-muted">{formatDateShort(job.created_at)}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View className="bg-white rounded-xl p-4 mb-3">
          <Text className="text-base font-semibold mb-3">{t("quotesHistory")}</Text>
          {quotes.length === 0 ? (
            <Text className="text-sm text-muted">{t("noQuotes")}</Text>
          ) : (
            quotes.slice(0, 8).map((quote) => (
              <View key={quote.id} className="py-2 border-b border-gray-100">
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-medium">{quote.quote_number}</Text>
                  <Text className="text-sm text-primary font-semibold">{formatCurrency(quote.total)}</Text>
                </View>
                <Text className="text-xs text-muted">
                  {quote.status} · {formatDateShort(quote.created_at)}
                </Text>
              </View>
            ))
          )}
        </View>

        <View className="bg-white rounded-xl p-4">
          <Text className="text-base font-semibold mb-3">{t("invoicesHistory")}</Text>
          {invoices.length === 0 ? (
            <Text className="text-sm text-muted">{t("noInvoices")}</Text>
          ) : (
            invoices.slice(0, 10).map((invoice) => (
              <TouchableOpacity
                key={invoice.id}
                onPress={() => router.push(`/(tabs)/invoices/active/${invoice.id}` as any)}
                className="py-2 border-b border-gray-100"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="text-sm font-medium">{invoice.invoice_number}</Text>
                  <Text className="text-sm font-semibold">{formatCurrency(invoice.total)}</Text>
                </View>
                <View className="flex-row items-center mt-0.5">
                  <MaterialCommunityIcons
                    name={invoice.status === "paid" ? "check-circle" : "clock-outline"}
                    size={14}
                    color={invoice.status === "paid" ? "#16a34a" : "#6b7280"}
                  />
                  <Text className="text-xs text-muted ml-1">
                    {invoice.status} · {formatDateShort(invoice.created_at)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </>
  );
}
