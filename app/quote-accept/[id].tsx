import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { supabase } from "@/lib/supabase";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { useI18n } from "@/lib/i18n";
import type { Quote, QuoteItem } from "@/types";
import * as Haptics from "expo-haptics";

export default function QuoteAcceptScreen() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    const fetchQuote = async () => {
      const { data } = await supabase
        .from("quotes")
        .select("*, client:clients(*), job:jobs(*)")
        .eq("id", id)
        .single();
      setQuote(data);
      if (data?.status === "accepted") {
        setAccepted(true);
      }
      setLoading(false);
    };
    fetchQuote();
  }, [id]);

  const handleAccept = async () => {
    if (!quote) return;

    setAccepting(true);
    try {
      const { error } = await supabase
        .from("quotes")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", quote.id);

      if (error) throw error;

      // Update job status
      if (quote.job_id) {
        await supabase
          .from("jobs")
          .update({ status: "accepted" })
          .eq("id", quote.job_id);
      }

      setAccepted(true);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("acceptError"));
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t("quoteTitle") }} />
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </>
    );
  }

  if (!quote) {
    return (
      <>
        <Stack.Screen options={{ title: t("quoteTitle") }} />
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="text-muted">{t("quoteNotFound")}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: `${t("quoteTitle")} ${quote.quote_number}`,
          headerBackVisible: false,
        }}
      />
      <ScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      >
        {/* Header */}
        <View className="items-center mb-6">
          <Text className="text-2xl font-bold text-primary mb-1">
            {quote.quote_number}
          </Text>
          <Text className="text-sm text-muted">
            {formatDate(quote.created_at)}
          </Text>
        </View>

        {/* Job title */}
        {quote.job && (
          <View className="bg-gray-50 rounded-xl p-4 mb-4">
            <Text className="text-xs text-muted mb-1">{t("job")}</Text>
            <Text className="text-base font-semibold">
              {quote.job.title}
            </Text>
          </View>
        )}

        {/* Items */}
        <Text className="text-sm font-semibold text-gray-700 mb-2">
          {t("quoteItemsLabel")}
        </Text>
        {quote.items.map((item: QuoteItem, index: number) => (
          <View
            key={index}
            className="flex-row justify-between py-3 border-b border-gray-100"
          >
            <View className="flex-1 mr-4">
              <Text className="text-sm font-medium">{item.description}</Text>
              <Text className="text-xs text-muted">
                {item.quantity} {item.unit} × {formatCurrency(item.unit_price)}
              </Text>
            </View>
            <Text className="text-sm font-semibold">
              {formatCurrency(item.total)}
            </Text>
          </View>
        ))}

        {/* Totals */}
        <View className="mt-4 pt-4 border-t border-gray-200">
          <View className="flex-row justify-between mb-1">
            <Text className="text-sm text-muted">{t("subtotal")}</Text>
            <Text className="text-sm">{formatCurrency(quote.subtotal)}</Text>
          </View>
          <View className="flex-row justify-between mb-1">
            <Text className="text-sm text-muted">
              {t("vatRate", { rate: String(quote.vat_rate) })}
            </Text>
            <Text className="text-sm">
              {formatCurrency(quote.vat_amount)}
            </Text>
          </View>
          <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-200">
            <Text className="text-xl font-bold">{t("total")}</Text>
            <Text className="text-xl font-bold text-primary">
              {formatCurrency(quote.total)}
            </Text>
          </View>
        </View>

        {/* Notes */}
        {quote.notes && (
          <View className="mt-4 bg-yellow-50 rounded-xl p-3">
            <Text className="text-xs font-semibold text-yellow-800 mb-1">
              {t("notes")}
            </Text>
            <Text className="text-sm text-yellow-900">{quote.notes}</Text>
          </View>
        )}

        {/* Valid until */}
        {quote.valid_until && (
          <Text className="text-xs text-muted mt-3 text-center">
            {t("validUntilDate", { date: formatDate(quote.valid_until) })}
          </Text>
        )}

        {/* Accepted confirmation */}
        {accepted && (
          <View className="mt-6 bg-green-50 rounded-xl p-6 items-center">
            <Text className="text-4xl mb-2">✅</Text>
            <Text className="text-lg font-bold text-green-700">
              {t("quoteAccepted")}
            </Text>
            <Text className="text-sm text-green-600 text-center mt-1">
              {t("quoteAcceptedMsg")}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Accept button */}
      {!accepted && (
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
          <TouchableOpacity
            onPress={handleAccept}
            disabled={accepting}
            className="bg-success rounded-xl py-4 items-center"
            activeOpacity={0.8}
          >
            {accepting ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-lg font-semibold">
                {t("acceptQuote")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}
