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
import { useI18n } from "@/lib/i18n";
import type { Quote, QuoteStatus } from "@/types";

export default function QuotesListScreen() {
  const { t } = useI18n();
  const { artisan } = useArtisan();

  const FILTERS: { label: string; value: QuoteStatus | "all" }[] = [
    { label: t("all"), value: "all" },
    { label: t("statusDraft"), value: "draft" },
    { label: t("statusSent"), value: "sent" },
    { label: t("statusAccepted"), value: "accepted" },
    { label: t("statusRejected"), value: "rejected" },
  ];
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [filter, setFilter] = useState<QuoteStatus | "all">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchQuotes = useCallback(async () => {
    if (!artisan) return;

    let query = supabase
      .from("quotes")
      .select("*, client:clients(*), job:jobs(*)")
      .eq("artisan_id", artisan.id)
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data } = await query;
    setQuotes(data || []);
    setLoading(false);
  }, [artisan, filter]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchQuotes();
    setRefreshing(false);
  }, [fetchQuotes]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t("quotesTitle") }} />
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="text-muted">{t("loading")}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t("quotesTitle") }} />
      <View className="flex-1 bg-gray-50">
        {/* Filter chips */}
        <View className="flex-row px-4 py-3 gap-2">
          {FILTERS.map((f) => (
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
                className={`text-sm font-medium ${
                  filter === f.value ? "text-white" : "text-gray-600"
                }`}
              >
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {quotes.length === 0 ? (
          <EmptyState
            icon="file-document-outline"
            title={t("noQuotes")}
            description={t("createJobThenQuote")}
          />
        ) : (
          <FlatList
            data={quotes}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() =>
                  router.push(
                    `/(tabs)/quotes/${item.job_id}` as any
                  )
                }
                className="bg-white mx-4 mb-2 rounded-xl p-4"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-xs text-muted">
                    {item.quote_number}
                  </Text>
                  <StatusBadge status={item.status} />
                </View>
                <Text
                  className="text-base font-semibold mb-1"
                  numberOfLines={1}
                >
                  {item.job?.title || t("job")}
                </Text>
                {item.client && (
                  <Text className="text-sm text-muted">{item.client.name}</Text>
                )}
                <View className="flex-row items-center justify-between mt-2">
                  <Text className="text-lg font-bold text-primary">
                    {formatCurrency(item.total)}
                  </Text>
                  <Text className="text-xs text-gray-400">
                    {formatDateShort(item.created_at)}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </>
  );
}
