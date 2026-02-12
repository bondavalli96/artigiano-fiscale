import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  ActivityIndicator,
} from "react-native";
import { Stack, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/EmptyState";
import { getClientAvgPaymentDays } from "@/lib/utils/reliability";
import type { Client } from "@/types";

interface ClientWithStats extends Client {
  avgPaymentDays: number | null;
}

export default function ClientsScreen() {
  const { artisan } = useArtisan();
  const { t } = useI18n();
  const [clients, setClients] = useState<ClientWithStats[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    if (!artisan) return;

    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("artisan_id", artisan.id)
      .order("name", { ascending: true });

    if (data) {
      // Fetch avg payment days for each client in parallel
      const withStats = await Promise.all(
        data.map(async (client) => {
          const avgPaymentDays = await getClientAvgPaymentDays(client.id);
          return { ...client, avgPaymentDays };
        })
      );
      setClients(withStats);
    } else {
      setClients([]);
    }
    setLoading(false);
  }, [artisan]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchClients();
    setRefreshing(false);
  }, [fetchClients]);

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-success";
    if (score >= 40) return "text-warning";
    return "text-danger";
  };

  const getScoreIconColor = (score: number) => {
    if (score >= 70) return "#22c55e";
    if (score >= 40) return "#f59e0b";
    return "#ef4444";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 70) return t("reliable");
    if (score >= 40) return t("averageReliability");
    return t("attentionReliability");
  };

  const getPaymentLabel = (avgDays: number | null) => {
    if (avgDays === null) return t("noPaidInvoices");
    if (avgDays <= 0) {
      const absDays = Math.abs(avgDays);
      return absDays === 0
        ? t("paysOnTime")
        : t("paysEarly", { days: String(absDays) });
    }
    return t("avgDaysLate", { days: String(avgDays) });
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t("clientsTitle") }} />
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t("clientsTitle") }} />
      <View className="flex-1 bg-gray-50">
        {clients.length === 0 ? (
          <EmptyState
            icon="account-group"
            title={t("noClientsYet")}
            description={t("clientsAppearHere")}
          />
        ) : (
          <FlatList
            data={clients}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingTop: 8 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() =>
                  router.push(`/(tabs)/settings/client/${item.id}` as any)
                }
                className="bg-white mx-4 mb-2 rounded-xl p-4"
                activeOpacity={0.8}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-1">
                    <Text className="text-base font-semibold">
                      {item.name}
                    </Text>
                    {item.phone && (
                      <Text className="text-sm text-muted">{item.phone}</Text>
                    )}
                    {item.email && (
                      <Text className="text-sm text-muted">{item.email}</Text>
                    )}
                    {item.address && (
                      <Text className="text-xs text-gray-400 mt-1">
                        {item.address}
                      </Text>
                    )}
                  </View>
                  <View className="items-end">
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons
                        name="star"
                        size={16}
                        color={getScoreIconColor(item.reliability_score)}
                      />
                      <Text
                        className={`text-sm font-semibold ml-1 ${getScoreColor(
                          item.reliability_score
                        )}`}
                      >
                        {item.reliability_score}
                      </Text>
                    </View>
                    <Text className="text-xs text-muted">
                      {getScoreLabel(item.reliability_score)}
                    </Text>
                  </View>
                </View>

                {/* Payment stats */}
                <View className="flex-row items-center mt-2 pt-2 border-t border-gray-100">
                  <MaterialCommunityIcons
                    name={
                      item.avgPaymentDays === null
                        ? "clock-outline"
                        : item.avgPaymentDays <= 0
                        ? "check-circle"
                        : item.avgPaymentDays <= 10
                        ? "alert-circle"
                        : "close-circle"
                    }
                    size={14}
                    color={
                      item.avgPaymentDays === null
                        ? "#9ca3af"
                        : item.avgPaymentDays <= 0
                        ? "#22c55e"
                        : item.avgPaymentDays <= 10
                        ? "#f59e0b"
                        : "#ef4444"
                    }
                  />
                  <Text className="text-xs text-muted ml-1">
                    {getPaymentLabel(item.avgPaymentDays)}
                  </Text>
                </View>

                {item.notes && (
                  <Text className="text-xs text-muted mt-2 bg-gray-50 rounded p-2">
                    {item.notes}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </>
  );
}
