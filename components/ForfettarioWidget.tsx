import { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils/format";

interface Props {
  artisanId: string;
}

export function ForfettarioWidget({ artisanId }: Props) {
  const { t, locale } = useI18n();
  const [regime, setRegime] = useState<string | null>(null);
  const [revenue, setRevenue] = useState(0);
  const limit = 85000;

  const fetchData = useCallback(async () => {
    try {
      const { data: profile } = await supabase
        .from("fiscal_profiles")
        .select("regime")
        .eq("artisan_id", artisanId)
        .single();

      if (!profile || profile.regime !== "forfettario") {
        setRegime(profile?.regime || null);
        return;
      }

      setRegime("forfettario");

      const currentYear = new Date().getFullYear();
      const { data: tracking } = await supabase
        .from("fiscal_year_tracking")
        .select("total_revenue")
        .eq("artisan_id", artisanId)
        .eq("year", currentYear)
        .single();

      setRevenue(tracking?.total_revenue || 0);
    } catch {
      // No profile
    }
  }, [artisanId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (regime !== "forfettario") return null;

  const percent = Math.min((revenue / limit) * 100, 100);
  const barColor =
    percent >= 80
      ? "bg-red-500"
      : percent >= 60
      ? "bg-amber-500"
      : "bg-green-500";

  return (
    <TouchableOpacity
      onPress={() => router.push("/(tabs)/settings/fiscal" as any)}
      activeOpacity={0.8}
      className="bg-white rounded-xl p-4 shadow-sm"
    >
      <View className="flex-row items-center mb-2">
        <MaterialCommunityIcons name="leaf" size={18} color="#16a34a" />
        <Text className="text-xs font-semibold text-green-700 ml-1.5">
          {t("forfettarioTracker")}
        </Text>
      </View>

      <View className="bg-gray-200 rounded-full h-2.5 mb-2 overflow-hidden">
        <View
          className={`h-2.5 rounded-full ${barColor}`}
          style={{ width: `${percent}%` }}
        />
      </View>

      <Text className="text-xs text-gray-600">
        {t("forfettarioRevenue", {
          amount: formatCurrency(revenue, locale),
          limit: formatCurrency(limit, locale),
        })}
      </Text>
    </TouchableOpacity>
  );
}
