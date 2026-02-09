import { View, Text, TouchableOpacity } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-8 bg-white">
      <MaterialCommunityIcons
        name={icon as any}
        size={64}
        color="#d1d5db"
      />
      <Text className="text-xl font-bold text-gray-700 mt-4 text-center">
        {title}
      </Text>
      <Text className="text-base text-muted mt-2 text-center">
        {description}
      </Text>
      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          className="mt-6 bg-primary rounded-xl px-6 py-3"
          activeOpacity={0.8}
        >
          <Text className="text-white font-semibold">{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
