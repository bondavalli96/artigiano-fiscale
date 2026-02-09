import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";

interface Suggestion {
  type: "pricing" | "client" | "expense" | "efficiency";
  suggestion: string;
  priority: "high" | "medium" | "low";
}

interface AISuggestionBannerProps {
  maxSuggestions?: number;
}

const TYPE_ICONS: Record<string, string> = {
  pricing: "tag",
  client: "account",
  expense: "cash-minus",
  efficiency: "lightning-bolt",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "#dc2626",
  medium: "#f59e0b",
  low: "#2563eb",
};

export function AISuggestionBanner({
  maxSuggestions = 1,
}: AISuggestionBannerProps) {
  const { artisan } = useArtisan();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (!artisan) return;

      try {
        const { data, error } = await supabase.functions.invoke(
          "analyze-patterns",
          { body: { artisanId: artisan.id } }
        );

        if (!error && data?.suggestions?.length > 0) {
          setSuggestions(data.suggestions.slice(0, maxSuggestions));
          // Animate in
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
          }).start();
        }
      } catch {
        // Silently fail
      }
    };

    fetchSuggestions();
  }, [artisan, maxSuggestions, slideAnim]);

  const handleDismiss = async (index: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDismissed((prev) => new Set(prev).add(index));
  };

  const handleApply = async (index: number) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDismissed((prev) => new Set(prev).add(index));
  };

  const visibleSuggestions = suggestions.filter((_, i) => !dismissed.has(i));

  if (visibleSuggestions.length === 0) return null;

  return (
    <Animated.View
      style={{ transform: [{ translateY: slideAnim }] }}
    >
      {visibleSuggestions.map((suggestion, index) => (
        <View
          key={index}
          className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-2"
        >
          <View className="flex-row items-start">
            <View
              className="w-8 h-8 rounded-full items-center justify-center mr-3"
              style={{
                backgroundColor:
                  PRIORITY_COLORS[suggestion.priority] + "20",
              }}
            >
              <MaterialCommunityIcons
                name={
                  (TYPE_ICONS[suggestion.type] || "lightbulb") as any
                }
                size={18}
                color={PRIORITY_COLORS[suggestion.priority]}
              />
            </View>
            <View className="flex-1">
              <Text className="text-xs font-semibold text-primary mb-1">
                🤖 Suggerimento AI
              </Text>
              <Text className="text-sm text-gray-700 leading-5">
                {suggestion.suggestion}
              </Text>
            </View>
          </View>

          <View className="flex-row justify-end gap-3 mt-3">
            <TouchableOpacity
              onPress={() => handleDismiss(index)}
              className="px-4 py-1.5"
            >
              <Text className="text-sm text-muted">Ignora</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleApply(index)}
              className="bg-primary px-4 py-1.5 rounded-lg"
            >
              <Text className="text-sm text-white font-medium">
                Capito
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </Animated.View>
  );
}
