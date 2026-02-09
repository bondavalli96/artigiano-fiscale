import { useState, useEffect } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { formatCurrency } from "@/lib/utils/format";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";

interface DashboardSummaryProps {
  income: number;
  expenses: number;
}

export function DashboardSummary({ income, expenses }: DashboardSummaryProps) {
  const { artisan } = useArtisan();
  const margin = income - expenses;
  const maxVal = Math.max(income, expenses, 1);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!artisan || (income === 0 && expenses === 0)) return;

      setLoadingSummary(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "monthly-summary",
          { body: { artisanId: artisan.id } }
        );
        if (!error && data?.summary) {
          setAiSummary(data.summary);
        }
      } catch {
        // Silently fail — AI summary is optional
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [artisan, income, expenses]);

  return (
    <View className="bg-white rounded-xl p-4 shadow-sm">
      <Text className="text-base font-semibold mb-3">Questo mese</Text>

      {/* Income bar */}
      <View className="mb-3">
        <View className="flex-row justify-between mb-1">
          <Text className="text-sm text-muted">Entrate</Text>
          <Text className="text-sm font-semibold text-success">
            {formatCurrency(income)}
          </Text>
        </View>
        <View className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <View
            className="h-full bg-green-500 rounded-full"
            style={{ width: `${(income / maxVal) * 100}%` }}
          />
        </View>
      </View>

      {/* Expenses bar */}
      <View className="mb-3">
        <View className="flex-row justify-between mb-1">
          <Text className="text-sm text-muted">Uscite</Text>
          <Text className="text-sm font-semibold text-danger">
            {formatCurrency(expenses)}
          </Text>
        </View>
        <View className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
          <View
            className="h-full bg-red-500 rounded-full"
            style={{ width: `${(expenses / maxVal) * 100}%` }}
          />
        </View>
      </View>

      {/* Margin */}
      <View className="border-t border-gray-100 pt-3 flex-row justify-between">
        <Text className="text-base font-bold">Margine</Text>
        <Text
          className={`text-base font-bold ${
            margin >= 0 ? "text-success" : "text-danger"
          }`}
        >
          {formatCurrency(margin)}
        </Text>
      </View>

      {/* AI Summary */}
      {(loadingSummary || aiSummary) && (
        <View className="mt-3 pt-3 border-t border-gray-100">
          <View className="bg-blue-50 rounded-xl p-3">
            <Text className="text-xs font-semibold text-primary mb-1">
              🤖 Riassunto AI
            </Text>
            {loadingSummary ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <Text className="text-sm text-gray-700 leading-5">
                {aiSummary}
              </Text>
            )}
          </View>
        </View>
      )}
    </View>
  );
}
