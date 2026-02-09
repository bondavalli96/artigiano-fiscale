import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useArtisan } from "@/hooks/useArtisan";
import { supabase } from "@/lib/supabase";
import { getGreeting, formatCurrency, formatDateShort } from "@/lib/utils/format";
import { DashboardSummary } from "@/components/DashboardSummary";
import { EmptyState } from "@/components/EmptyState";
import type { InvoiceActive } from "@/types";

export default function DashboardScreen() {
  const { artisan, loading: artisanLoading } = useArtisan();
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    unpaidCount: 0,
    unpaidTotal: 0,
    pendingQuotes: 0,
    lastJobTitle: "",
    overdueCount: 0,
    monthIncome: 0,
    monthExpenses: 0,
  });
  const [overdueInvoices, setOverdueInvoices] = useState<InvoiceActive[]>([]);

  const fetchStats = useCallback(async () => {
    if (!artisan) return;

    try {
      // Unpaid invoices
      const { data: unpaid } = await supabase
        .from("invoices_active")
        .select("total")
        .eq("artisan_id", artisan.id)
        .in("status", ["sent", "overdue"]);

      // Pending quotes
      const { count: pendingQuotes } = await supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("artisan_id", artisan.id)
        .eq("status", "sent");

      // Last job
      const { data: lastJob } = await supabase
        .from("jobs")
        .select("title")
        .eq("artisan_id", artisan.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      // Overdue invoices
      const { data: overdueData, count: overdueCount } = await supabase
        .from("invoices_active")
        .select("*, client:clients(*)", { count: "exact" })
        .eq("artisan_id", artisan.id)
        .eq("status", "overdue")
        .order("payment_due", { ascending: true })
        .limit(5);

      setOverdueInvoices(overdueData || []);

      // Month income (paid invoices this month)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: paidThisMonth } = await supabase
        .from("invoices_active")
        .select("total")
        .eq("artisan_id", artisan.id)
        .eq("status", "paid")
        .gte("paid_at", startOfMonth.toISOString());

      // Month expenses
      const { data: expensesThisMonth } = await supabase
        .from("invoices_passive")
        .select("total")
        .eq("artisan_id", artisan.id)
        .gte("created_at", startOfMonth.toISOString());

      setStats({
        unpaidCount: unpaid?.length || 0,
        unpaidTotal: unpaid?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0,
        pendingQuotes: pendingQuotes || 0,
        lastJobTitle: lastJob?.title || "",
        overdueCount: overdueCount || 0,
        monthIncome:
          paidThisMonth?.reduce((sum, inv) => sum + (inv.total || 0), 0) || 0,
        monthExpenses:
          expensesThisMonth?.reduce(
            (sum, inv) => sum + (inv.total || 0),
            0
          ) || 0,
      });
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
  }, [artisan]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, [fetchStats]);

  if (artisanLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-muted">Caricamento...</Text>
      </View>
    );
  }

  if (!artisan) {
    return (
      <EmptyState
        icon="account-alert"
        title="Profilo non trovato"
        description="Completa l'onboarding per iniziare"
        actionLabel="Vai all'onboarding"
        onAction={() => router.replace("/onboarding")}
      />
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Greeting */}
        <View className="px-5 pt-4 pb-2">
          <Text className="text-2xl font-bold text-gray-900">
            {getGreeting()}, {artisan.business_name.split(" ")[0]}!
          </Text>
        </View>

        {/* Stats cards */}
        <View className="px-5 flex-row gap-3 mb-4">
          <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-3xl mb-1">💰</Text>
            <Text className="text-xs text-muted">Da incassare</Text>
            <Text className="text-lg font-bold">
              {formatCurrency(stats.unpaidTotal)}
            </Text>
            <Text className="text-xs text-muted">
              {stats.unpaidCount} fattur{stats.unpaidCount === 1 ? "a" : "e"}
            </Text>
          </View>

          <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-3xl mb-1">📋</Text>
            <Text className="text-xs text-muted">Preventivi in attesa</Text>
            <Text className="text-lg font-bold">{stats.pendingQuotes}</Text>
          </View>
        </View>

        {stats.lastJobTitle ? (
          <View className="px-5 mb-4">
            <View className="bg-white rounded-xl p-4 shadow-sm">
              <Text className="text-3xl mb-1">🔨</Text>
              <Text className="text-xs text-muted">Ultimo lavoro</Text>
              <Text className="text-base font-medium" numberOfLines={1}>
                {stats.lastJobTitle}
              </Text>
            </View>
          </View>
        ) : null}

        {/* Overdue invoices section */}
        {stats.overdueCount > 0 && (
          <View className="px-5 mb-4">
            <View className="bg-red-50 border border-red-200 rounded-xl p-4">
              <View className="flex-row items-center mb-3">
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={20}
                  color="#dc2626"
                />
                <Text className="text-danger font-semibold ml-2">
                  Da incassare ({stats.overdueCount})
                </Text>
              </View>
              {overdueInvoices.map((inv) => {
                const daysOverdue = inv.payment_due
                  ? Math.floor(
                      (Date.now() - new Date(inv.payment_due).getTime()) /
                        (1000 * 60 * 60 * 24)
                    )
                  : 0;
                return (
                  <View
                    key={inv.id}
                    className="flex-row items-center justify-between py-2 border-b border-red-100"
                  >
                    <View className="flex-1 mr-2">
                      <Text className="text-sm font-medium text-red-900">
                        {inv.invoice_number}
                      </Text>
                      {inv.client && (
                        <Text className="text-xs text-red-700">
                          {inv.client.name}
                        </Text>
                      )}
                      <Text className="text-xs text-red-500">
                        {daysOverdue > 0
                          ? `${daysOverdue} giorni di ritardo`
                          : "Scaduta"}
                      </Text>
                    </View>
                    <Text className="text-sm font-bold text-red-900 mr-3">
                      {formatCurrency(inv.total)}
                    </Text>
                    <TouchableOpacity
                      onPress={async () => {
                        try {
                          await supabase.functions.invoke("send-reminder", {
                            body: {
                              artisanId: artisan?.id,
                              invoiceId: inv.id,
                            },
                          });
                          await Haptics.notificationAsync(
                            Haptics.NotificationFeedbackType.Success
                          );
                          Alert.alert(
                            "Sollecito inviato",
                            `Sollecito per ${inv.invoice_number} registrato`
                          );
                        } catch {
                          Alert.alert("Errore", "Invio sollecito fallito");
                        }
                      }}
                      className="bg-red-600 rounded-lg px-3 py-1.5"
                    >
                      <Text className="text-xs text-white font-medium">
                        Sollecita
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Monthly summary */}
        <View className="px-5 mb-4">
          <DashboardSummary
            income={stats.monthIncome}
            expenses={stats.monthExpenses}
          />
        </View>
      </ScrollView>

      {/* FAB */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/jobs/new")}
        className="absolute bottom-24 right-5 bg-primary w-14 h-14 rounded-full items-center justify-center shadow-lg"
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="plus" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}
