import { View, Text } from "react-native";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  draft: { label: "Bozza", bg: "bg-gray-100", text: "text-gray-600" },
  quoted: { label: "Preventivato", bg: "bg-blue-100", text: "text-blue-700" },
  accepted: { label: "Accettato", bg: "bg-green-100", text: "text-green-700" },
  invoiced: { label: "Fatturato", bg: "bg-purple-100", text: "text-purple-700" },
  completed: { label: "Completato", bg: "bg-emerald-100", text: "text-emerald-700" },
  sent: { label: "Inviato", bg: "bg-blue-100", text: "text-blue-700" },
  rejected: { label: "Rifiutato", bg: "bg-red-100", text: "text-red-700" },
  expired: { label: "Scaduto", bg: "bg-orange-100", text: "text-orange-700" },
  paid: { label: "Pagata", bg: "bg-green-100", text: "text-green-700" },
  overdue: { label: "Scaduta", bg: "bg-red-100", text: "text-red-700" },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
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
