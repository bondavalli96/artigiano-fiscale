import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { useI18n } from "@/lib/i18n";

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

function normalizeSuggestionType(value: unknown): Suggestion["type"] {
  if (
    value === "pricing" ||
    value === "client" ||
    value === "expense" ||
    value === "efficiency"
  ) {
    return value;
  }
  return "efficiency";
}

function normalizePriority(value: unknown): Suggestion["priority"] {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return "medium";
}

export function AISuggestionBanner({
  maxSuggestions = 1,
}: AISuggestionBannerProps) {
  const { artisan } = useArtisan();
  const { t, locale } = useI18n();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cacheKey = artisan
    ? `ai_suggestions:${artisan.id}:${locale}:${maxSuggestions}`
    : null;

  const storeSuggestionsCache = useCallback(
    async (nextSuggestions: Suggestion[]) => {
      if (!cacheKey) return;
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(nextSuggestions));
      } catch {
        // Ignore cache failures
      }
    },
    [cacheKey]
  );

  const loadSuggestionsCache = useCallback(async () => {
    if (!cacheKey) return;
    try {
      const raw = await AsyncStorage.getItem(cacheKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setSuggestions(parsed as Suggestion[]);
        slideAnim.setValue(0);
      }
    } catch {
      // Ignore cache failures
    }
  }, [cacheKey, slideAnim]);

  const loadSuggestionsFromDb = useCallback(async (): Promise<Suggestion[]> => {
    if (!artisan) return [];

    try {
      const { data, error } = await supabase
        .from("ai_patterns")
        .select("pattern_type, suggestion, data, created_at")
        .eq("artisan_id", artisan.id)
        .not("suggestion", "is", null)
        .order("created_at", { ascending: false })
        .limit(maxSuggestions);

      if (error || !Array.isArray(data)) {
        return [];
      }

      return data
        .map((row: any) => ({
          type: normalizeSuggestionType(row.pattern_type),
          suggestion: typeof row.suggestion === "string" ? row.suggestion : "",
          priority: normalizePriority(row?.data?.priority),
        }))
        .filter((row) => row.suggestion.trim().length > 0);
    } catch {
      return [];
    }
  }, [artisan, maxSuggestions]);

  const fetchSuggestions = useCallback(
    async (isCancelled = false) => {
      if (!artisan) {
        setSuggestions([]);
        setLoadingSuggestions(false);
        return;
      }

      setLoadingSuggestions(true);

      try {
        const { data, error } = await supabase.functions.invoke(
          "analyze-patterns",
          { body: { artisanId: artisan.id, locale } }
        );

        let nextSuggestions: Suggestion[] = [];
        if (!error && data?.suggestions?.length > 0) {
          nextSuggestions = (data.suggestions.slice(0, maxSuggestions) as Suggestion[]) || [];
        } else {
          nextSuggestions = await loadSuggestionsFromDb();
        }

        if (!isCancelled) {
          if (nextSuggestions.length > 0) {
            setSuggestions(nextSuggestions);
            setDismissed(new Set());
            void storeSuggestionsCache(nextSuggestions);
          }
        }
      } catch {
        if (!isCancelled) {
          const fallbackSuggestions = await loadSuggestionsFromDb();
          if (fallbackSuggestions.length > 0) {
            setSuggestions(fallbackSuggestions);
            setDismissed(new Set());
            void storeSuggestionsCache(fallbackSuggestions);
          }
        }
      } finally {
        if (!isCancelled) {
          setLoadingSuggestions(false);
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 8,
          }).start();
        }
      }
    },
    [
      artisan,
      locale,
      maxSuggestions,
      slideAnim,
      storeSuggestionsCache,
      loadSuggestionsFromDb,
    ]
  );

  const scheduleSuggestionsRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }
    refreshTimerRef.current = setTimeout(() => {
      void fetchSuggestions(false);
    }, 900);
  }, [fetchSuggestions]);

  useEffect(() => {
    let isCancelled = false;

    void loadSuggestionsCache();
    void fetchSuggestions(isCancelled);

    return () => {
      isCancelled = true;
    };
  }, [fetchSuggestions, loadSuggestionsCache]);

  useFocusEffect(
    useCallback(() => {
      void fetchSuggestions(false);
      return () => {};
    }, [fetchSuggestions])
  );

  useEffect(() => {
    if (!artisan) return;

    const tablesToWatch = [
      "quotes",
      "invoices_active",
      "invoices_passive",
      "clients",
      "price_list",
      "jobs",
    ] as const;

    const channel = supabase.channel(`ai-suggestions-inputs-${artisan.id}`);

    tablesToWatch.forEach((table) => {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `artisan_id=eq.${artisan.id}`,
        },
        () => {
          scheduleSuggestionsRefresh();
        }
      );
    });

    channel.subscribe();

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [artisan, scheduleSuggestionsRefresh]);

  const handleDismiss = async (index: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDismissed((prev) => new Set(prev).add(index));
  };

  const handleApply = async (index: number) => {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setDismissed((prev) => new Set(prev).add(index));
  };

  const visibleSuggestions = suggestions.filter((_, i) => !dismissed.has(i));

  return (
    <Animated.View
      style={{ transform: [{ translateY: slideAnim }] }}
    >
      {visibleSuggestions.length > 0 ? (
        visibleSuggestions.map((suggestion, index) => (
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
                  🤖 {t("aiSuggestion")}
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
                <Text className="text-sm text-muted">{t("dismiss")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleApply(index)}
                className="bg-primary px-4 py-1.5 rounded-lg"
              >
                <Text className="text-sm text-white font-medium">
                  {t("understood")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      ) : (
        <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-2">
          <Text className="text-xs font-semibold text-primary mb-1">
            🤖 {t("aiSuggestion")}
          </Text>
          <Text className="text-sm text-gray-700 leading-5">
            {loadingSuggestions ? t("loading") : t("aiSuggestionNoData")}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}
