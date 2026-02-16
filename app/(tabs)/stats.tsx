import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { useI18n } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils/format";

type Period = "month" | "quarter" | "year";

interface StatsData {
  current: {
    income: number;
    expenses: number;
    margin: number;
    invoiceCount: number;
    quoteCount: number;
    acceptanceRate: number;
    avgInvoice: number;
  };
  previous: { income: number; expenses: number; margin: number };
  sameMonthLastYear: { income: number; expenses: number; margin: number };
  changes: {
    vsPrev: { income: number | null; expenses: number | null; margin: number | null };
    vsLastYear: { income: number | null; expenses: number | null; margin: number | null };
  };
  byCategory: { category: string; total: number }[];
  byArea: { area: string; total: number; count: number }[];
  topClients: { name: string; total: number; count: number }[];
  aiInsight: string;
  fiscal?: {
    sdiBreakdown: {
      delivered: number;
      accepted: number;
      sent: number;
      not_sent: number;
      rejected: number;
      total: number;
    };
    bollo: { count: number; total: number };
    reverseCharge: { count: number; total: number };
    collection: {
      avgDaysToPayment: number | null;
      paidOnTimeRate: number | null;
      outstandingAmount: number;
      overdueAmount: number;
      overdueCount: number;
      paidCount: number;
    };
    taxEstimate: {
      regime: string;
      grossRevenue: number;
      coefficient: number;
      taxableIncome: number;
      taxRate: number;
      estimatedTax: number;
      inpsRate: number;
      estimatedInps: number;
      totalTaxBurden: number;
      monthlySetAside: number;
      revenueLimit: number;
      revenuePercent: number;
    } | null;
  };
}

function ChangeIndicator({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const isUp = pct > 0;
  const isStable = pct === 0;
  return (
    <View className={`flex-row items-center ml-2 px-1.5 py-0.5 rounded-full ${
      isStable ? "bg-gray-100" : isUp ? "bg-green-100" : "bg-red-100"
    }`}>
      {!isStable && (
        <MaterialCommunityIcons
          name={isUp ? "arrow-up" : "arrow-down"}
          size={12}
          color={isUp ? "#22c55e" : "#ef4444"}
        />
      )}
      <Text className={`text-xs font-semibold ${
        isStable ? "text-gray-500" : isUp ? "text-green-700" : "text-red-700"
      }`}>
        {isStable ? "0%" : `${pct > 0 ? "+" : ""}${pct}%`}
      </Text>
    </View>
  );
}

function HorizontalBar({
  value,
  maxValue,
  color,
}: {
  value: number;
  maxValue: number;
  color: string;
}) {
  const width = maxValue > 0 ? Math.min(100, Math.round((value / maxValue) * 100)) : 0;
  return (
    <View className="h-3 bg-gray-100 rounded-full flex-1 overflow-hidden">
      <View
        className="h-3 rounded-full"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </View>
  );
}

export default function StatsScreen() {
  const { artisan } = useArtisan();
  const { t, locale } = useI18n();
  const [period, setPeriod] = useState<Period>("month");
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const PERIODS: { label: string; value: Period }[] = [
    { label: t("monthPeriod"), value: "month" },
    { label: t("quarterPeriod"), value: "quarter" },
    { label: t("yearPeriod"), value: "year" },
  ];

  const fetchStats = useCallback(async () => {
    if (!artisan) return;

    try {
      setError(false);
      const response = await supabase.functions.invoke(
        "stats-summary",
        { body: { artisanId: artisan.id, period, locale } }
      );

      if (response.error) {
        // Log full error details
        console.error("Stats fn error details:", JSON.stringify({
          name: response.error.name,
          message: response.error.message,
          context: (response.error as any).context,
        }));
        // Try to read error body
        if (response.data) {
          console.error("Stats fn error body:", JSON.stringify(response.data));
        }
        throw response.error;
      }
      setData(response.data);
    } catch (err: any) {
      console.error("Stats fetch error:", err?.message || err);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [artisan, period, locale]);

  useEffect(() => {
    setLoading(true);
    fetchStats();
  }, [fetchStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, [fetchStats]);

  const selectPeriod = (p: Period) => {
    setPeriod(p);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t("statsTitle") }} />
        <View className="flex-1 items-center justify-center bg-gray-50">
          <ActivityIndicator size="large" color="#2563eb" />
          <Text className="text-muted mt-4">{t("loadingStats")}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t("statsTitle") }} />
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Period selector */}
        <View className="flex-row mx-4 mt-4 mb-4 bg-gray-200 rounded-xl p-1">
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.value}
              onPress={() => selectPeriod(p.value)}
              className={`flex-1 py-2.5 rounded-lg items-center ${
                period === p.value ? "bg-white" : ""
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  period === p.value ? "text-primary" : "text-gray-500"
                }`}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {error ? (
          <View className="flex-1 items-center justify-center py-20">
            <MaterialCommunityIcons
              name="alert-circle-outline"
              size={48}
              color="#ef4444"
            />
            <Text className="text-muted mt-4 mx-8 text-center">
              {t("statsError")}
            </Text>
          </View>
        ) : !data ? (
          <View className="flex-1 items-center justify-center py-20">
            <MaterialCommunityIcons
              name="chart-bar"
              size={48}
              color="#d1d5db"
            />
            <Text className="text-muted mt-4">{t("noDataYet")}</Text>
          </View>
        ) : (
          <>
            {/* Main revenue card */}
            <View className="bg-white mx-4 rounded-2xl p-5 mb-3">
              <Text className="text-sm text-muted mb-1">{t("revenue")}</Text>
              <View className="flex-row items-center">
                <Text className="text-3xl font-bold text-primary">
                  {formatCurrency(data.current.income, locale)}
                </Text>
                <ChangeIndicator pct={data.changes.vsPrev.income} />
              </View>
              <Text className="text-xs text-muted mt-1">
                {t("vsPrevMonth")}
              </Text>
            </View>

            {/* 3 mini cards */}
            <View className="flex-row mx-4 gap-2 mb-3">
              <View className="flex-1 bg-white rounded-xl p-4">
                <Text className="text-xs text-muted">{t("costs")}</Text>
                <Text className="text-lg font-bold text-red-600">
                  {formatCurrency(data.current.expenses, locale)}
                </Text>
                <ChangeIndicator pct={data.changes.vsPrev.expenses} />
              </View>
              <View className="flex-1 bg-white rounded-xl p-4">
                <Text className="text-xs text-muted">{t("profit")}</Text>
                <Text
                  className={`text-lg font-bold ${
                    data.current.margin >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(data.current.margin, locale)}
                </Text>
                <ChangeIndicator pct={data.changes.vsPrev.margin} />
              </View>
              <View className="flex-1 bg-white rounded-xl p-4">
                <Text className="text-xs text-muted">
                  {t("invoicesIssued")}
                </Text>
                <Text className="text-lg font-bold">
                  {data.current.invoiceCount}
                </Text>
                <Text className="text-xs text-muted">
                  {t("avgInvoiceValue")}: {formatCurrency(data.current.avgInvoice, locale)}
                </Text>
              </View>
            </View>

            {/* Quote acceptance */}
            <View className="bg-white mx-4 rounded-xl p-4 mb-3 flex-row items-center">
              <MaterialCommunityIcons
                name="file-check"
                size={24}
                color="#2563eb"
              />
              <View className="ml-3 flex-1">
                <Text className="text-sm text-muted">
                  {t("quoteAcceptance")}
                </Text>
                <Text className="text-lg font-bold">
                  {data.current.acceptanceRate}%
                </Text>
              </View>
              <Text className="text-sm text-muted">
                {data.current.quoteCount} {t("quotesTitle").toLowerCase()}
              </Text>
            </View>

            {/* AI Insight */}
            {data.aiInsight ? (
              <View className="bg-blue-50 mx-4 rounded-xl p-4 mb-3">
                <View className="flex-row items-center mb-2">
                  <Text className="text-lg mr-2">🤖</Text>
                  <Text className="text-sm font-semibold text-primary">
                    {t("aiInsightLabel")}
                  </Text>
                </View>
                <Text className="text-sm text-blue-900 leading-5">
                  {data.aiInsight}
                </Text>
              </View>
            ) : null}

            {/* vs Previous Period */}
            <View className="bg-white mx-4 rounded-xl p-4 mb-3">
              <Text className="text-sm font-semibold mb-3">
                📊 {t("vsPrevMonth")}
              </Text>
              {[
                {
                  label: t("revenue"),
                  current: data.current.income,
                  prev: data.previous.income,
                  color: "#2563eb",
                },
                {
                  label: t("costs"),
                  current: data.current.expenses,
                  prev: data.previous.expenses,
                  color: "#ef4444",
                },
                {
                  label: t("profit"),
                  current: data.current.margin,
                  prev: data.previous.margin,
                  color: "#22c55e",
                },
              ].map((row) => {
                const maxVal = Math.max(
                  Math.abs(row.current),
                  Math.abs(row.prev),
                  1
                );
                return (
                  <View key={row.label} className="mb-3">
                    <View className="flex-row justify-between mb-1">
                      <Text className="text-xs text-muted">{row.label}</Text>
                      <Text className="text-xs font-semibold">
                        {formatCurrency(row.current, locale)}
                      </Text>
                    </View>
                    <HorizontalBar
                      value={Math.abs(row.current)}
                      maxValue={maxVal}
                      color={row.color}
                    />
                    <View className="flex-row justify-between mt-0.5">
                      <Text className="text-xs text-gray-400">
                        {locale === "it" ? "prec." : "prev."}
                      </Text>
                      <Text className="text-xs text-gray-400">
                        {formatCurrency(row.prev, locale)}
                      </Text>
                    </View>
                    <HorizontalBar
                      value={Math.abs(row.prev)}
                      maxValue={maxVal}
                      color={`${row.color}40`}
                    />
                  </View>
                );
              })}
            </View>

            {/* vs Last Year */}
            <View className="bg-white mx-4 rounded-xl p-4 mb-3">
              <Text className="text-sm font-semibold mb-3">
                📅 {t("vsLastYear")}
              </Text>
              {[
                {
                  label: t("revenue"),
                  current: data.current.income,
                  prev: data.sameMonthLastYear.income,
                  pct: data.changes.vsLastYear.income,
                },
                {
                  label: t("costs"),
                  current: data.current.expenses,
                  prev: data.sameMonthLastYear.expenses,
                  pct: data.changes.vsLastYear.expenses,
                },
              ].map((row) => (
                <View
                  key={row.label}
                  className="flex-row items-center justify-between py-2 border-b border-gray-50"
                >
                  <Text className="text-sm text-muted">{row.label}</Text>
                  <View className="flex-row items-center">
                    <Text className="text-sm font-semibold">
                      {formatCurrency(row.current, locale)}
                    </Text>
                    <ChangeIndicator pct={row.pct} />
                  </View>
                </View>
              ))}
              <Text className="text-xs text-gray-400 mt-2">
                {locale === "it" ? "Anno scorso" : "Last year"}:{" "}
                {formatCurrency(data.sameMonthLastYear.income, locale)}{" "}
                {t("revenue").toLowerCase()}
              </Text>
            </View>

            {/* Top Clients */}
            {data.topClients.length > 0 && (
              <View className="bg-white mx-4 rounded-xl p-4 mb-3">
                <Text className="text-sm font-semibold mb-3">
                  👤 {t("topClients")}
                </Text>
                {data.topClients.map((client, i) => {
                  const maxClientTotal = data.topClients[0]?.total || 1;
                  return (
                    <View key={i} className="mb-2.5">
                      <View className="flex-row justify-between mb-1">
                        <Text className="text-sm" numberOfLines={1}>
                          {client.name}
                        </Text>
                        <Text className="text-sm font-semibold">
                          {formatCurrency(client.total, locale)}
                        </Text>
                      </View>
                      <HorizontalBar
                        value={client.total}
                        maxValue={maxClientTotal}
                        color="#2563eb"
                      />
                      <Text className="text-xs text-gray-400 mt-0.5">
                        {t("invoicesCountStats", {
                          count: String(client.count),
                        })}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* By Area */}
            {data.byArea.length > 0 && (
              <View className="bg-white mx-4 rounded-xl p-4 mb-3">
                <Text className="text-sm font-semibold mb-3">
                  📍 {t("byArea")}
                </Text>
                {data.byArea.map((area, i) => {
                  const maxAreaTotal = data.byArea[0]?.total || 1;
                  return (
                    <View key={i} className="mb-2.5">
                      <View className="flex-row justify-between mb-1">
                        <Text className="text-sm">{area.area}</Text>
                        <Text className="text-sm font-semibold">
                          {formatCurrency(area.total, locale)}
                        </Text>
                      </View>
                      <HorizontalBar
                        value={area.total}
                        maxValue={maxAreaTotal}
                        color="#8b5cf6"
                      />
                      <Text className="text-xs text-gray-400 mt-0.5">
                        {t("invoicesCountStats", {
                          count: String(area.count),
                        })}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Expense Breakdown */}
            {data.byCategory.length > 0 && (
              <View className="bg-white mx-4 rounded-xl p-4 mb-3">
                <Text className="text-sm font-semibold mb-3">
                  💰 {t("expenseBreakdown")}
                </Text>
                {data.byCategory.map((cat, i) => {
                  const CATEGORY_COLORS: Record<string, string> = {
                    materiali: "#f59e0b",
                    servizi: "#3b82f6",
                    attrezzature: "#8b5cf6",
                    trasporto: "#10b981",
                    altro: "#6b7280",
                    materials: "#f59e0b",
                    services: "#3b82f6",
                    equipment: "#8b5cf6",
                    transport: "#10b981",
                    other: "#6b7280",
                  };
                  const maxCatTotal = data.byCategory[0]?.total || 1;
                  return (
                    <View key={i} className="mb-2.5">
                      <View className="flex-row justify-between mb-1">
                        <Text className="text-sm capitalize">{cat.category}</Text>
                        <Text className="text-sm font-semibold">
                          {formatCurrency(cat.total, locale)}
                        </Text>
                      </View>
                      <HorizontalBar
                        value={cat.total}
                        maxValue={maxCatTotal}
                        color={CATEGORY_COLORS[cat.category] || "#6b7280"}
                      />
                    </View>
                  );
                })}
              </View>
            )}

            {/* Collection Performance */}
            {data.fiscal?.collection && (
              <View className="bg-white mx-4 rounded-xl p-4 mb-3">
                <Text className="text-sm font-semibold mb-3">
                  <MaterialCommunityIcons name="timer-sand" size={14} color="#6b7280" />{" "}
                  {t("collectionPerformance")}
                </Text>

                <View className="flex-row gap-2 mb-3">
                  <View className="flex-1 bg-blue-50 rounded-lg p-3 items-center">
                    <Text className="text-xs text-muted mb-1">{t("avgDaysToPayment")}</Text>
                    <Text className="text-xl font-bold text-primary">
                      {data.fiscal.collection.avgDaysToPayment !== null
                        ? t("daysUnit", { days: String(data.fiscal.collection.avgDaysToPayment) })
                        : "—"}
                    </Text>
                  </View>
                  <View className="flex-1 bg-green-50 rounded-lg p-3 items-center">
                    <Text className="text-xs text-muted mb-1">{t("paidOnTime")}</Text>
                    <Text className="text-xl font-bold text-green-600">
                      {data.fiscal.collection.paidOnTimeRate !== null
                        ? `${data.fiscal.collection.paidOnTimeRate}%`
                        : "—"}
                    </Text>
                  </View>
                </View>

                {data.fiscal.collection.outstandingAmount > 0 && (
                  <View className="flex-row justify-between py-2 border-t border-gray-100">
                    <Text className="text-sm text-muted">{t("outstanding")}</Text>
                    <Text className="text-sm font-bold text-amber-600">
                      {formatCurrency(data.fiscal.collection.outstandingAmount, locale)}
                    </Text>
                  </View>
                )}

                {data.fiscal.collection.overdueAmount > 0 && (
                  <View className="flex-row justify-between py-2 border-t border-gray-100">
                    <Text className="text-sm text-muted">
                      {t("overdueTotal")} ({t("overdueInvoices", { count: String(data.fiscal.collection.overdueCount) })})
                    </Text>
                    <Text className="text-sm font-bold text-red-600">
                      {formatCurrency(data.fiscal.collection.overdueAmount, locale)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Fiscal Health — SdI & Bollo */}
            {data.fiscal && data.fiscal.sdiBreakdown.total > 0 && (
              <View className="bg-white mx-4 rounded-xl p-4 mb-3">
                <Text className="text-sm font-semibold mb-3">
                  <MaterialCommunityIcons name="shield-check" size={14} color="#6b7280" />{" "}
                  {t("fiscalHealth")}
                </Text>

                {/* SdI breakdown */}
                <Text className="text-xs text-muted mb-2">{t("sdiSubmissions")}</Text>
                <View className="flex-row gap-1 mb-3">
                  {[
                    { key: "accepted", count: data.fiscal.sdiBreakdown.accepted, color: "#22c55e", label: t("sdiAccepted") },
                    { key: "delivered", count: data.fiscal.sdiBreakdown.delivered, color: "#3b82f6", label: t("sdiDelivered") },
                    { key: "sent", count: data.fiscal.sdiBreakdown.sent, color: "#f59e0b", label: t("sdiPending") },
                    { key: "not_sent", count: data.fiscal.sdiBreakdown.not_sent, color: "#9ca3af", label: t("sdiNotSent") },
                    { key: "rejected", count: data.fiscal.sdiBreakdown.rejected, color: "#ef4444", label: t("sdiRejected") },
                  ].filter((s) => s.count > 0).map((s) => (
                    <View key={s.key} className="flex-1 items-center rounded-lg py-2" style={{ backgroundColor: `${s.color}15` }}>
                      <Text className="text-lg font-bold" style={{ color: s.color }}>
                        {s.count}
                      </Text>
                      <Text className="text-xs" style={{ color: s.color }} numberOfLines={1}>
                        {s.label}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Stacked bar showing SdI proportions */}
                <View className="h-2.5 bg-gray-100 rounded-full flex-row overflow-hidden mb-3">
                  {[
                    { count: data.fiscal.sdiBreakdown.accepted, color: "#22c55e" },
                    { count: data.fiscal.sdiBreakdown.delivered, color: "#3b82f6" },
                    { count: data.fiscal.sdiBreakdown.sent, color: "#f59e0b" },
                    { count: data.fiscal.sdiBreakdown.not_sent, color: "#9ca3af" },
                    { count: data.fiscal.sdiBreakdown.rejected, color: "#ef4444" },
                  ].filter((s) => s.count > 0).map((s, i) => (
                    <View
                      key={i}
                      className="h-2.5"
                      style={{
                        width: `${(s.count / data.fiscal!.sdiBreakdown.total) * 100}%`,
                        backgroundColor: s.color,
                      }}
                    />
                  ))}
                </View>

                {/* Bollo & RC summary */}
                {data.fiscal.bollo.count > 0 && (
                  <View className="flex-row justify-between py-2 border-t border-gray-100">
                    <Text className="text-sm text-muted">
                      {t("bolloApplied", { count: String(data.fiscal.bollo.count) })}
                    </Text>
                    <Text className="text-sm font-semibold">
                      {formatCurrency(data.fiscal.bollo.total, locale)}
                    </Text>
                  </View>
                )}
                {data.fiscal.reverseCharge.count > 0 && (
                  <View className="flex-row justify-between py-2 border-t border-gray-100">
                    <Text className="text-sm text-muted">
                      {t("reverseChargeInvoices", { count: String(data.fiscal.reverseCharge.count) })}
                    </Text>
                    <Text className="text-sm font-semibold">
                      {formatCurrency(data.fiscal.reverseCharge.total, locale)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Tax Estimate (forfettario) */}
            {data.fiscal?.taxEstimate && (
              <View className="bg-emerald-50 mx-4 rounded-xl p-4 mb-3 border border-emerald-200">
                <View className="flex-row items-center mb-3">
                  <MaterialCommunityIcons name="calculator-variant" size={20} color="#059669" />
                  <Text className="text-sm font-semibold text-emerald-800 ml-2">
                    {t("taxEstimate")}
                  </Text>
                </View>

                <Text className="text-xs text-emerald-700 mb-3">
                  {t("taxEstimateDesc")}
                </Text>

                {/* Revenue threshold bar */}
                <View className="mb-3">
                  <View className="flex-row justify-between mb-1">
                    <Text className="text-xs text-emerald-700">{t("grossRevenue")}</Text>
                    <Text className="text-xs font-semibold text-emerald-800">
                      {formatCurrency(data.fiscal.taxEstimate.grossRevenue, locale)}
                    </Text>
                  </View>
                  <View className="h-3 bg-emerald-100 rounded-full overflow-hidden">
                    <View
                      className={`h-3 rounded-full ${
                        data.fiscal.taxEstimate.revenuePercent >= 80
                          ? "bg-red-500"
                          : data.fiscal.taxEstimate.revenuePercent >= 60
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${data.fiscal.taxEstimate.revenuePercent}%` }}
                    />
                  </View>
                  <Text className="text-xs text-emerald-600 mt-0.5">
                    {t("thresholdProgress", { pct: String(data.fiscal.taxEstimate.revenuePercent) })}
                    {" / "}
                    {formatCurrency(data.fiscal.taxEstimate.revenueLimit, locale)}
                  </Text>
                </View>

                {/* Tax breakdown */}
                <View className="bg-white rounded-lg p-3">
                  <View className="flex-row justify-between py-1.5">
                    <Text className="text-xs text-muted">
                      {t("coefficientLabel", { pct: String(data.fiscal.taxEstimate.coefficient) })}
                    </Text>
                    <Text className="text-xs text-muted">
                      {t("taxableIncome")}: {formatCurrency(data.fiscal.taxEstimate.taxableIncome, locale)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between py-1.5 border-t border-gray-50">
                    <Text className="text-xs text-muted">
                      {t("substituteTax", { pct: String(data.fiscal.taxEstimate.taxRate) })}
                    </Text>
                    <Text className="text-xs font-semibold">
                      {formatCurrency(data.fiscal.taxEstimate.estimatedTax, locale)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between py-1.5 border-t border-gray-50">
                    <Text className="text-xs text-muted">
                      {t("inpsContributions", { pct: String(data.fiscal.taxEstimate.inpsRate) })}
                    </Text>
                    <Text className="text-xs font-semibold">
                      {formatCurrency(data.fiscal.taxEstimate.estimatedInps, locale)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between py-2 border-t border-gray-200 mt-1">
                    <Text className="text-sm font-bold text-emerald-800">
                      {t("totalTaxBurden")}
                    </Text>
                    <Text className="text-sm font-bold text-emerald-800">
                      {formatCurrency(data.fiscal.taxEstimate.totalTaxBurden, locale)}
                    </Text>
                  </View>
                </View>

                {/* Monthly set aside */}
                <View className="bg-emerald-100 rounded-lg p-3 mt-2 flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <MaterialCommunityIcons name="piggy-bank-outline" size={18} color="#059669" />
                    <Text className="text-sm text-emerald-800 ml-2 font-medium">
                      {t("monthlySetAside")}
                    </Text>
                  </View>
                  <Text className="text-lg font-bold text-emerald-800">
                    {formatCurrency(data.fiscal.taxEstimate.monthlySetAside, locale)}
                  </Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </>
  );
}
