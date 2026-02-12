import { View, Text } from "react-native";
import { useI18n } from "@/lib/i18n";

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useI18n();

  const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
    draft: { label: t("statusDraft"), bg: "bg-gray-100", text: "text-gray-600" },
    quoted: { label: t("statusQuoted"), bg: "bg-blue-100", text: "text-blue-700" },
    accepted: { label: t("statusAccepted"), bg: "bg-green-100", text: "text-green-700" },
    invoiced: { label: t("statusInvoiced"), bg: "bg-purple-100", text: "text-purple-700" },
    completed: { label: t("statusCompleted"), bg: "bg-emerald-100", text: "text-emerald-700" },
    sent: { label: t("statusSent"), bg: "bg-blue-100", text: "text-blue-700" },
    rejected: { label: t("statusRejected"), bg: "bg-red-100", text: "text-red-700" },
    expired: { label: t("statusExpired"), bg: "bg-orange-100", text: "text-orange-700" },
    paid: { label: t("statusPaid"), bg: "bg-green-100", text: "text-green-700" },
    overdue: { label: t("statusOverdue"), bg: "bg-red-100", text: "text-red-700" },
  };

  const config = STATUS_CONFIG[status] || {
    label: status,
    bg: "bg-gray-100",
    text: "text-gray-600",
  };

  return (
    <View className={`px-2 py-1 rounded-full ${config.bg}`}>
      <Text className={`text-xs font-semibold ${config.text}`}>
        {config.label}
      </Text>
    </View>
  );
}
