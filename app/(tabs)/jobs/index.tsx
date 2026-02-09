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
import { formatDateShort } from "@/lib/utils/format";
import type { Job, JobStatus } from "@/types";

const FILTERS: { label: string; value: JobStatus | "all" }[] = [
  { label: "Tutti", value: "all" },
  { label: "Bozza", value: "draft" },
  { label: "Preventivato", value: "quoted" },
  { label: "Accettato", value: "accepted" },
  { label: "Fatturato", value: "invoiced" },
];

export default function JobsListScreen() {
  const { artisan } = useArtisan();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filter, setFilter] = useState<JobStatus | "all">("all");
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(async () => {
    if (!artisan) return;

    let query = supabase
      .from("jobs")
      .select("*, client:clients(*)")
      .eq("artisan_id", artisan.id)
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data } = await query;
    setJobs(data || []);
    setLoading(false);
  }, [artisan, filter]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchJobs();
    setRefreshing(false);
  }, [fetchJobs]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Lavori" }} />
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="text-muted">Caricamento...</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Lavori" }} />
      <View className="flex-1 bg-gray-50">
        {/* Filter chips */}
        <View className="flex-row px-4 py-3 gap-2">
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f.value}
              onPress={() => setFilter(f.value)}
              className={`px-3 py-1.5 rounded-full ${
                filter === f.value ? "bg-primary" : "bg-white border border-gray-200"
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

        {jobs.length === 0 ? (
          <EmptyState
            icon="hammer"
            title="Nessun lavoro"
            description="Aggiungi il tuo primo lavoro per iniziare"
            actionLabel="+ Nuovo Lavoro"
            onAction={() => router.push("/(tabs)/jobs/new")}
          />
        ) : (
          <FlatList
            data={jobs}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() =>
                  router.push(`/(tabs)/jobs/${item.id}` as any)
                }
                className="bg-white mx-4 mb-2 rounded-xl p-4"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-base font-semibold flex-1" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <StatusBadge status={item.status} />
                </View>
                {item.client && (
                  <Text className="text-sm text-muted">{item.client.name}</Text>
                )}
                <Text className="text-xs text-gray-400 mt-1">
                  {formatDateShort(item.created_at)}
                </Text>
              </TouchableOpacity>
            )}
          />
        )}
      </View>
    </>
  );
}
