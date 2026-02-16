import { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

interface Props {
  artisanId: string;
}

interface ComplianceStatus {
  level: "green" | "amber" | "red";
  warnings: string[];
}

export function ComplianceWidget({ artisanId }: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState<ComplianceStatus>({
    level: "green",
    warnings: [],
  });

  const checkCompliance = useCallback(async () => {
    const warnings: string[] = [];

    try {
      // Check for invoices not sent to SdI (older than 12 days)
      const twelveAgo = new Date();
      twelveAgo.setDate(twelveAgo.getDate() - 12);

      const { count: unsent } = await supabase
        .from("invoices_active")
        .select("id", { count: "exact", head: true })
        .eq("artisan_id", artisanId)
        .in("sdi_status", ["not_sent"])
        .in("status", ["sent", "paid"])
        .lt("created_at", twelveAgo.toISOString());

      if (unsent && unsent > 0) {
        warnings.push(
          t("fiscalWarnings", { count: String(unsent) })
        );
      }

      // Check forfettario threshold
      const { data: profile } = await supabase
        .from("fiscal_profiles")
        .select("regime")
        .eq("artisan_id", artisanId)
        .single();

      if (profile?.regime === "forfettario") {
        const currentYear = new Date().getFullYear();
        const { data: tracking } = await supabase
          .from("fiscal_year_tracking")
          .select("total_revenue")
          .eq("artisan_id", artisanId)
          .eq("year", currentYear)
          .single();

        const revenue = tracking?.total_revenue || 0;
        if (revenue >= 85000) {
          warnings.push(t("forfettarioAlert85"));
        } else if (revenue >= 70000) {
          warnings.push(t("forfettarioAlert70"));
        }
      }

      // Check overdue invoices
      const { count: overdue } = await supabase
        .from("invoices_active")
        .select("id", { count: "exact", head: true })
        .eq("artisan_id", artisanId)
        .eq("status", "overdue");

      if (overdue && overdue > 0) {
        warnings.push(
          t("toCollectCount", { count: String(overdue) })
        );
      }

      // Determine level
      let level: "green" | "amber" | "red" = "green";
      if (warnings.length > 0) {
        const hasRedWarning = warnings.some(
          (w) =>
            w.includes("85") || w.includes("superato")
        );
        level = hasRedWarning ? "red" : "amber";
      }

      setStatus({ level, warnings });
    } catch {
      // Silently fail
    }
  }, [artisanId, t]);

  useEffect(() => {
    checkCompliance();
  }, [checkCompliance]);

  const iconColor =
    status.level === "green"
      ? "#16a34a"
      : status.level === "amber"
      ? "#d97706"
      : "#dc2626";

  const bgColor =
    status.level === "green"
      ? "bg-green-50"
      : status.level === "amber"
      ? "bg-amber-50"
      : "bg-red-50";

  const borderColor =
    status.level === "green"
      ? "border-green-200"
      : status.level === "amber"
      ? "border-amber-200"
      : "border-red-200";

  return (
    <TouchableOpacity
      onPress={() => router.push("/(tabs)/settings/fiscal" as any)}
      activeOpacity={0.8}
      className={`${bgColor} border ${borderColor} rounded-xl p-4`}
    >
      <View className="flex-row items-center mb-1">
        <MaterialCommunityIcons
          name={
            status.level === "green"
              ? "check-circle"
              : status.level === "amber"
              ? "alert"
              : "alert-circle"
          }
          size={20}
          color={iconColor}
        />
        <Text
          className={`text-sm font-semibold ml-2 ${
            status.level === "green"
              ? "text-green-800"
              : status.level === "amber"
              ? "text-amber-800"
              : "text-red-800"
          }`}
        >
          {status.level === "green"
            ? t("fiscalAllGood")
            : t("fiscalCompliance")}
        </Text>
      </View>
      {status.warnings.length > 0 && (
        <View className="mt-1">
          {status.warnings.map((warning, idx) => (
            <Text
              key={idx}
              className={`text-xs mt-0.5 ${
                status.level === "red" ? "text-red-700" : "text-amber-700"
              }`}
            >
              {warning}
            </Text>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}
