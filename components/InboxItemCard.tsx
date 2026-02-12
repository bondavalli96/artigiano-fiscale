import { View, Text, TouchableOpacity, Image } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "@/lib/i18n";
import type { InboxItem } from "@/types";

const CLASS_CONFIG: Record<
  string,
  { icon: string; color: string; bg: string }
> = {
  job: { icon: "hammer", color: "#2563eb", bg: "#dbeafe" },
  invoice_passive: { icon: "receipt", color: "#d97706", bg: "#fef3c7" },
  client_info: { icon: "account", color: "#059669", bg: "#d1fae5" },
  receipt: { icon: "cash-register", color: "#7c3aed", bg: "#ede9fe" },
  other: { icon: "help-circle", color: "#6b7280", bg: "#f3f4f6" },
};

const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string }
> = {
  new: { color: "#2563eb", bg: "#dbeafe" },
  classifying: { color: "#d97706", bg: "#fef3c7" },
  classified: { color: "#059669", bg: "#d1fae5" },
  routed: { color: "#6b7280", bg: "#f3f4f6" },
  error: { color: "#dc2626", bg: "#fee2e2" },
};

const CLASS_LABELS: Record<string, string> = {
  job: "inboxClassJob",
  invoice_passive: "inboxClassInvoice",
  client_info: "inboxClassClient",
  receipt: "inboxClassReceipt",
  other: "inboxClassOther",
};

const STATUS_LABELS: Record<string, string> = {
  new: "inboxNew_status",
  classifying: "inboxClassifying",
  classified: "inboxClassified_status",
  routed: "inboxRouted_status",
  error: "inboxError_status",
};

interface InboxItemCardProps {
  item: InboxItem;
  onPress: (item: InboxItem) => void;
}

export function InboxItemCard({ item, onPress }: InboxItemCardProps) {
  const { t } = useI18n();

  const classConfig = CLASS_CONFIG[item.classification || "other"] || CLASS_CONFIG.other;
  const statusConfig = STATUS_CONFIG[item.status] || STATUS_CONFIG.new;

  const isImage = item.file_type === "image" && item.file_url;
  const timeAgo = getTimeAgo(item.created_at);

  return (
    <TouchableOpacity
      onPress={() => onPress(item)}
      activeOpacity={0.7}
      className="bg-white rounded-xl p-4 mb-2 mx-4 border border-gray-100"
    >
      <View className="flex-row">
        {/* Thumbnail or icon */}
        {isImage ? (
          <Image
            source={{ uri: item.file_url! }}
            className="w-14 h-14 rounded-lg mr-3"
            resizeMode="cover"
          />
        ) : (
          <View
            className="w-14 h-14 rounded-lg mr-3 items-center justify-center"
            style={{ backgroundColor: classConfig.bg }}
          >
            <MaterialCommunityIcons
              name={classConfig.icon as any}
              size={26}
              color={classConfig.color}
            />
          </View>
        )}

        {/* Content */}
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            {/* Classification badge */}
            {item.classification && (
              <View
                className="px-2 py-0.5 rounded-full"
                style={{ backgroundColor: classConfig.bg }}
              >
                <Text
                  className="text-xs font-semibold"
                  style={{ color: classConfig.color }}
                >
                  {t(CLASS_LABELS[item.classification] as any)}
                </Text>
              </View>
            )}

            {/* Status badge */}
            <View
              className="px-2 py-0.5 rounded-full"
              style={{ backgroundColor: statusConfig.bg }}
            >
              <Text
                className="text-xs font-medium"
                style={{ color: statusConfig.color }}
              >
                {t(STATUS_LABELS[item.status] as any)}
              </Text>
            </View>
          </View>

          {/* Summary */}
          <Text className="text-sm text-gray-900 font-medium" numberOfLines={2}>
            {item.ai_summary || item.file_name || item.raw_text?.slice(0, 100) || "..."}
          </Text>

          {/* Meta */}
          <View className="flex-row items-center mt-1">
            {item.source === "email" && (
              <View className="flex-row items-center mr-2">
                <MaterialCommunityIcons
                  name="email-outline"
                  size={12}
                  color="#9ca3af"
                />
                <Text className="text-xs text-gray-400 ml-1" numberOfLines={1}>
                  {item.source_email_from?.split("@")[0] || "email"}
                </Text>
              </View>
            )}
            {item.confidence != null && item.confidence > 0 && (
              <Text className="text-xs text-gray-400 mr-2">
                {Math.round(item.confidence * 100)}%
              </Text>
            )}
            <Text className="text-xs text-gray-400">{timeAgo}</Text>
          </View>
        </View>

        {/* Arrow */}
        <View className="justify-center ml-1">
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color="#d1d5db"
          />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "ora";
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}g`;
  return date.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}
