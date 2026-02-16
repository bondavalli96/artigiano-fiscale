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
import { useI18n } from "@/lib/i18n";
import { DashboardSummary } from "@/components/DashboardSummary";
import { AISuggestionBanner } from "@/components/AISuggestionBanner";
import { ForfettarioWidget } from "@/components/ForfettarioWidget";
import { EmptyState } from "@/components/EmptyState";
import type { InvoiceActive } from "@/types";

export default function DashboardScreen() {
  const { artisan, loading: artisanLoading } = useArtisan();
  const { t, locale } = useI18n();
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
        <Text className="text-muted">{t("loading")}</Text>
      </View>
    );
  }

  if (!artisan) {
    return (
      <EmptyState
        icon="account-alert"
        title={t("profileNotFound")}
        description={t("completeOnboarding")}
        actionLabel={t("goToOnboarding")}
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
            {getGreeting(locale)}, {artisan.business_name.split(" ")[0]}!
          </Text>
        </View>

        {/* AI Suggestion */}
        <View className="px-5 mb-2">
          <AISuggestionBanner maxSuggestions={1} />
        </View>

        {/* Forfettario widget (IT only) */}
        {artisan.country_code === "IT" && (
          <View className="px-5 mb-3">
            <ForfettarioWidget artisanId={artisan.id} />
          </View>
        )}

        {/* Stats cards */}
        <View className="px-5 flex-row gap-3 mb-4">
          <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-3xl mb-1">💰</Text>
            <Text className="text-xs text-muted">{t("toCollect")}</Text>
            <Text className="text-lg font-bold">
              {formatCurrency(stats.unpaidTotal, locale)}
            </Text>
            <Text className="text-xs text-muted">
              {t("invoiceCount", {
                count: String(stats.unpaidCount),
                suffix: stats.unpaidCount === 1 ? t("invoiceSuffixOne") : t("invoiceSuffixMany")
              })}
            </Text>
          </View>

          <View className="flex-1 bg-white rounded-xl p-4 shadow-sm">
            <Text className="text-3xl mb-1">📋</Text>
            <Text className="text-xs text-muted">{t("pendingQuotes")}</Text>
            <Text className="text-lg font-bold">{stats.pendingQuotes}</Text>
          </View>
        </View>

        {stats.lastJobTitle ? (
          <View className="px-5 mb-4">
            <View className="bg-white rounded-xl p-4 shadow-sm">
              <Text className="text-3xl mb-1">🔨</Text>
              <Text className="text-xs text-muted">{t("lastJob")}</Text>
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
                  {t("toCollectCount", { count: String(stats.overdueCount) })}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push("/(tabs)/invoices/reminders" as any)}
                className="mb-2"
              >
                <Text className="text-sm text-primary font-semibold">
                  {t("manageAllReminders")}
                </Text>
              </TouchableOpacity>
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
                          ? t("daysLate", { days: String(daysOverdue) })
                          : t("expired")}
                      </Text>
                    </View>
                    <Text className="text-sm font-bold text-red-900 mr-3">
                      {formatCurrency(inv.total, locale)}
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
                            t("reminderSent"),
                            t("reminderForInvoice", { number: inv.invoice_number })
                          );
                        } catch {
                          Alert.alert(t("error"), t("sendReminderFailed"));
                        }
                      }}
                      className="bg-red-600 rounded-lg px-3 py-1.5"
                    >
                      <Text className="text-xs text-white font-medium">
                        {t("sendReminder")}
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

        {/* View stats link */}
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/stats")}
          className="mx-5 mb-4 bg-blue-50 rounded-xl p-4 flex-row items-center"
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="chart-bar" size={24} color="#2563eb" />
          <Text className="flex-1 ml-3 text-primary font-semibold">
            {t("viewStats")}
          </Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color="#2563eb"
          />
        </TouchableOpacity>

        <View className="mx-5 bg-white rounded-xl p-4 mb-4">
          <Text className="text-xs font-semibold text-gray-500 uppercase mb-3">
            {t("moreTools")}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/quotes" as any)}
              className="w-[48%] bg-gray-50 rounded-lg px-3 py-3 flex-row items-center"
            >
              <MaterialCommunityIcons
                name="file-document-outline"
                size={18}
                color="#2563eb"
              />
              <Text className="text-sm text-gray-700 ml-2">{t("tabQuotes")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/inbox" as any)}
              className="w-[48%] bg-gray-50 rounded-lg px-3 py-3 flex-row items-center"
            >
              <MaterialCommunityIcons
                name="inbox-arrow-down"
                size={18}
                color="#2563eb"
              />
              <Text className="text-sm text-gray-700 ml-2">{t("tabInbox")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/stats" as any)}
              className="w-[48%] bg-gray-50 rounded-lg px-3 py-3 flex-row items-center"
            >
              <MaterialCommunityIcons name="chart-bar" size={18} color="#2563eb" />
              <Text className="text-sm text-gray-700 ml-2">{t("tabStats")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/other-services" as any)}
              className="w-[48%] bg-gray-50 rounded-lg px-3 py-3 flex-row items-center"
            >
              <MaterialCommunityIcons
                name="view-grid-plus-outline"
                size={18}
                color="#2563eb"
              />
              <Text className="text-sm text-gray-700 ml-2">{t("tabOtherServices")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/settings" as any)}
              className="w-[48%] bg-gray-50 rounded-lg px-3 py-3 flex-row items-center"
            >
              <MaterialCommunityIcons name="cog" size={18} color="#2563eb" />
              <Text className="text-sm text-gray-700 ml-2">{t("tabSettings")}</Text>
            </TouchableOpacity>
          </View>
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
