import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  FlatList,
} from "react-native";
import { Stack, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import type { InvoiceActive, InvoiceActiveStatus } from "@/types";

type Tab = "active" | "passive";

const ACTIVE_FILTERS: { label: string; value: InvoiceActiveStatus | "all" }[] = [
  { label: "Tutte", value: "all" },
  { label: "Inviate", value: "sent" },
  { label: "Pagate", value: "paid" },
  { label: "Scadute", value: "overdue" },
];

export default function InvoicesScreen() {
  const { artisan } = useArtisan();
  const [tab, setTab] = useState<Tab>("active");
  const [invoices, setInvoices] = useState<InvoiceActive[]>([]);
  const [filter, setFilter] = useState<InvoiceActiveStatus | "all">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchInvoices = useCallback(async () => {
    if (!artisan) return;

    if (tab === "active") {
      let query = supabase
        .from("invoices_active")
        .select("*, client:clients(*)")
        .eq("artisan_id", artisan.id)
        .order("created_at", { ascending: false });

      if (filter !== "all") {
        query = query.eq("status", filter);
      }

      const { data } = await query;
      setInvoices(data || []);
    }
    setLoading(false);
  }, [artisan, tab, filter]);

  useEffect(() => {
    setLoading(true);
    fetchInvoices();
  }, [fetchInvoices]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchInvoices();
    setRefreshing(false);
  }, [fetchInvoices]);

  return (
    <>
      <Stack.Screen options={{ title: "Fatture" }} />
      <View className="flex-1 bg-gray-50">
        {/* Segmented control */}
        <View className="flex-row bg-white px-4 py-3 gap-2">
          <TouchableOpacity
            onPress={() => setTab("active")}
            className={`flex-1 py-2.5 rounded-xl items-center ${
              tab === "active" ? "bg-primary" : "bg-gray-100"
            }`}
          >
            <Text
              className={`font-semibold ${
                tab === "active" ? "text-white" : "text-gray-600"
              }`}
            >
              Emesse
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setTab("passive");
              router.push("/(tabs)/invoices/passive/new" as any);
            }}
            className={`flex-1 py-2.5 rounded-xl items-center ${
              tab === "passive" ? "bg-primary" : "bg-gray-100"
            }`}
          >
            <Text
              className={`font-semibold ${
                tab === "passive" ? "text-white" : "text-gray-600"
              }`}
            >
              Ricevute
            </Text>
          </TouchableOpacity>
        </View>

        {tab === "active" && (
          <>
            {/* Active filters */}
            <View className="flex-row px-4 py-2 gap-2">
              {ACTIVE_FILTERS.map((f) => (
                <TouchableOpacity
                  key={f.value}
                  onPress={() => setFilter(f.value)}
                  className={`px-3 py-1.5 rounded-full ${
                    filter === f.value
                      ? "bg-primary"
                      : "bg-white border border-gray-200"
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      filter === f.value ? "text-white" : "text-gray-600"
                    }`}
                  >
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {loading ? (
              <View className="flex-1 items-center justify-center">
                <Text className="text-muted">Caricamento...</Text>
              </View>
            ) : invoices.length === 0 ? (
              <EmptyState
                icon="currency-eur"
                title="Nessuna fattura"
                description="Le fatture appariranno qui quando convertirai un preventivo"
              />
            ) : (
              <FlatList
                data={invoices}
                keyExtractor={(item) => item.id}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                  />
                }
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() =>
                      router.push(
                        `/(tabs)/invoices/active/${item.id}` as any
                      )
                    }
                    className="bg-white mx-4 mb-2 rounded-xl p-4"
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-xs text-muted">
                        {item.invoice_number}
                      </Text>
                      <StatusBadge status={item.status} />
                    </View>
                    {item.client && (
                      <Text
                        className="text-base font-semibold mb-1"
                        numberOfLines={1}
                      >
                        {item.client.name}
                      </Text>
                    )}
                    <View className="flex-row items-center justify-between mt-1">
                      <Text className="text-lg font-bold text-primary">
                        {formatCurrency(item.total)}
                      </Text>
                      <View className="items-end">
                        <Text className="text-xs text-gray-400">
                          {formatDateShort(item.created_at)}
                        </Text>
                        {item.payment_due && (
                          <Text className="text-xs text-muted">
                            Scad. {formatDateShort(item.payment_due)}
                          </Text>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </>
        )}
      </View>
    </>
  );
}
