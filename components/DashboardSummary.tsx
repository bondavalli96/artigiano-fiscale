import { View, Text } from "react-native";
import { formatCurrency } from "@/lib/utils/format";

interface DashboardSummaryProps {
  income: number;
  expenses: number;
}

export function DashboardSummary({ income, expenses }: DashboardSummaryProps) {
  const margin = income - expenses;
  const maxVal = Math.max(income, expenses, 1);

  return (
    <View className="bg-white rounded-xl p-4 shadow-sm">
      <Text className="text-base font-semibold mb-3">Questo mese</Text>

      <View className="mb-3">
        <View className="flex-row justify-between mb-1">
          <Text className="text-sm text-muted">Entrate</Text>
          <Text className="text-sm font-semibold text-success">
            {formatCurrency(income)}
          </Text>
        </View>
        <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <View
            className="h-full bg-green-500 rounded-full"
            style={{ width: `${(income / maxVal) * 100}%` }}
          />
        </View>
      </View>

      <View className="mb-3">
        <View className="flex-row justify-between mb-1">
          <Text className="text-sm text-muted">Uscite</Text>
          <Text className="text-sm font-semibold text-danger">
            {formatCurrency(expenses)}
          </Text>
        </View>
        <View className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <View
            className="h-full bg-red-500 rounded-full"
            style={{ width: `${(expenses / maxVal) * 100}%` }}
          />
        </View>
      </View>

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
    </View>
  );
}
