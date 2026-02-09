import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  FlatList,
} from "react-native";
import { Stack, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { EmptyState } from "@/components/EmptyState";
import type { Client } from "@/types";

export default function ClientsScreen() {
  const { artisan } = useArtisan();
  const [clients, setClients] = useState<Client[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchClients = useCallback(async () => {
    if (!artisan) return;

    const { data } = await supabase
      .from("clients")
      .select("*")
      .eq("artisan_id", artisan.id)
      .order("name", { ascending: true });

    setClients(data || []);
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

  const getScoreLabel = (score: number) => {
    if (score >= 70) return "Affidabile";
    if (score >= 40) return "Nella norma";
    return "Attenzione";
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Clienti" }} />
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="text-muted">Caricamento...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Clienti" }} />
      <View className="flex-1 bg-gray-50">
        {clients.length === 0 ? (
          <EmptyState
            icon="account-group"
            title="Nessun cliente"
            description="I clienti appariranno qui quando li aggiungi ai lavori"
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
              <View className="bg-white mx-4 mb-2 rounded-xl p-4">
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
                        color={
                          item.reliability_score >= 70
                            ? "#22c55e"
                            : item.reliability_score >= 40
                            ? "#f59e0b"
                            : "#ef4444"
                        }
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
                {item.notes && (
                  <Text className="text-xs text-muted mt-2 bg-gray-50 rounded p-2">
                    {item.notes}
                  </Text>
                )}
              </View>
            )}
          />
        )}
      </View>
    </>
  );
}
