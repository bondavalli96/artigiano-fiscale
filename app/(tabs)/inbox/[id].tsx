import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import type { InboxItem, InboxClassification } from "@/types";

const CLASS_CONFIG: Record<string, { icon: string; color: string; bg: string; label: string }> = {
  job: { icon: "hammer", color: "#2563eb", bg: "#dbeafe", label: "inboxClassJob" },
  invoice_passive: { icon: "receipt", color: "#d97706", bg: "#fef3c7", label: "inboxClassInvoice" },
  client_info: { icon: "account", color: "#059669", bg: "#d1fae5", label: "inboxClassClient" },
  receipt: { icon: "cash-register", color: "#7c3aed", bg: "#ede9fe", label: "inboxClassReceipt" },
  other: { icon: "help-circle", color: "#6b7280", bg: "#f3f4f6", label: "inboxClassOther" },
};

const CLASSIFICATION_OPTIONS: InboxClassification[] = [
  "job",
  "invoice_passive",
  "client_info",
  "receipt",
  "other",
];

function flattenExtractedData(data: Record<string, unknown>): Record<string, string> {
  const flat: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v == null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      flat[k] = String(v);
    } else if (Array.isArray(v)) {
      // Array of primitives: join. Array of objects: stringify each.
      flat[k] = v.map((item) =>
        typeof item === "object" && item !== null ? JSON.stringify(item) : String(item)
      ).join(", ");
    } else if (typeof v === "object") {
      // Nested object: flatten its keys with parent prefix
      for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
        if (nv != null) flat[`${k}_${nk}`] = String(nv);
      }
    }
  }
  return flat;
}

export default function InboxDetailScreen() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [item, setItem] = useState<InboxItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [routing, setRouting] = useState(false);
  const [showClassPicker, setShowClassPicker] = useState(false);
  const [editedData, setEditedData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!id) return;

    const fetchItem = async () => {
      const { data, error } = await supabase
        .from("inbox_items")
        .select("*")
        .eq("id", id)
        .single();

      if (!error && data) {
        setItem(data as InboxItem);
        if (data.ai_extracted_data) {
          setEditedData(flattenExtractedData(data.ai_extracted_data as Record<string, unknown>));
        }
      }
      setLoading(false);
    };

    fetchItem();

    // Subscribe to changes
    const channel = supabase
      .channel(`inbox-item-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "inbox_items",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setItem(payload.new as InboxItem);
          if ((payload.new as InboxItem).ai_extracted_data) {
            setEditedData(flattenExtractedData(
              (payload.new as InboxItem).ai_extracted_data as Record<string, unknown>
            ));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const handleRoute = async (overrideClass?: InboxClassification) => {
    if (!item) return;
    setRouting(true);
    try {
      // Build override data from edited fields
      const overrideData: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(editedData)) {
        overrideData[k] = v;
      }

      const { data, error } = await supabase.functions.invoke(
        "route-inbox-item",
        {
          body: {
            inboxItemId: item.id,
            overrideClassification: overrideClass || undefined,
            overrideData: Object.keys(overrideData).length > 0 ? overrideData : undefined,
          },
        }
      );

      if (error) throw error;

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("ok"), t("inboxRouteSuccess"), [
        { text: t("ok"), onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(t("error"), t("inboxRouteFailed"));
    } finally {
      setRouting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(t("delete"), t("inboxDeleteConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          if (!item) return;
          // Delete file from storage
          if (item.file_url) {
            const urlParts = item.file_url.split("/inbox/");
            if (urlParts[1]) {
              await supabase.storage.from("inbox").remove([urlParts[1]]);
            }
          }
          await supabase.from("inbox_items").delete().eq("id", item.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          router.back();
        },
      },
    ]);
  };

  const handleRetry = async () => {
    if (!item) return;
    try {
      await supabase
        .from("inbox_items")
        .update({ status: "new", error_message: null })
        .eq("id", item.id);

      await supabase.functions.invoke("classify-inbox-item", {
        body: { inboxItemId: item.id },
      });

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      Alert.alert(t("error"), t("inboxClassifyFailed"));
    }
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#2563eb" />
      </SafeAreaView>
    );
  }

  if (!item) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <Text className="text-gray-400">Item not found</Text>
      </SafeAreaView>
    );
  }

  const classConfig = CLASS_CONFIG[item.classification || "other"] || CLASS_CONFIG.other;

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-100 bg-white">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900 ml-3 flex-1">
          {t("inboxTitle")}
        </Text>
        <TouchableOpacity onPress={handleDelete} hitSlop={8}>
          <MaterialCommunityIcons name="delete-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* File preview */}
        {item.file_type === "image" && item.file_url && (
          <Image
            source={{ uri: item.file_url }}
            className="w-full h-64"
            resizeMode="contain"
            style={{ backgroundColor: "#f3f4f6" }}
          />
        )}

        {item.file_type === "pdf" && item.file_url && (
          <View className="w-full h-32 bg-gray-100 items-center justify-center">
            <MaterialCommunityIcons name="file-pdf-box" size={48} color="#ef4444" />
            <Text className="text-sm text-gray-500 mt-1">{item.file_name || "PDF"}</Text>
          </View>
        )}

        {item.file_type === "audio" && (
          <View className="w-full h-20 bg-gray-100 items-center justify-center flex-row">
            <MaterialCommunityIcons name="microphone" size={32} color="#6b7280" />
            <Text className="text-sm text-gray-500 ml-2">{item.file_name || "Audio"}</Text>
          </View>
        )}

        {/* Status */}
        {(item.status === "classifying" || item.status === "new") && (
          <View className="mx-4 mt-4 p-4 bg-yellow-50 rounded-xl flex-row items-center">
            <ActivityIndicator size="small" color="#d97706" />
            <Text className="ml-3 text-sm text-yellow-700 font-medium flex-1">
              {t("inboxClassifyingItem")}
            </Text>
          </View>
        )}

        {item.status === "error" && (
          <View className="mx-4 mt-4 p-4 bg-red-50 rounded-xl">
            <View className="flex-row items-center">
              <MaterialCommunityIcons name="alert-circle" size={20} color="#dc2626" />
              <Text className="ml-2 text-sm text-red-700 font-medium flex-1">
                {item.error_message || t("inboxError_status")}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleRetry}
              className="mt-2 bg-red-100 rounded-lg py-2 items-center"
            >
              <Text className="text-sm font-semibold text-red-700">Riprova</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Classification card */}
        {item.classification && item.status === "classified" && (
          <View className="mx-4 mt-4 p-4 bg-white rounded-xl border border-gray-100">
            <View className="flex-row items-center mb-3">
              <View
                className="w-10 h-10 rounded-full items-center justify-center mr-3"
                style={{ backgroundColor: classConfig.bg }}
              >
                <MaterialCommunityIcons
                  name={classConfig.icon as any}
                  size={22}
                  color={classConfig.color}
                />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-gray-900">
                  {t(classConfig.label as any)}
                </Text>
                {item.confidence != null && (
                  <Text className="text-xs text-gray-400">
                    {t("inboxConfidence", { pct: String(Math.round(item.confidence * 100)) })}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => setShowClassPicker(!showClassPicker)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg"
              >
                <Text className="text-xs text-gray-600 font-medium">
                  {t("inboxChangeType")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Class picker */}
            {showClassPicker && (
              <View className="flex-row flex-wrap gap-2 mb-3 pt-3 border-t border-gray-100">
                {CLASSIFICATION_OPTIONS.map((cls) => {
                  const cfg = CLASS_CONFIG[cls];
                  const isSelected = cls === item.classification;
                  return (
                    <TouchableOpacity
                      key={cls}
                      onPress={() => {
                        handleRoute(cls);
                        setShowClassPicker(false);
                      }}
                      className={`flex-row items-center px-3 py-2 rounded-lg border ${
                        isSelected ? "border-blue-300 bg-blue-50" : "border-gray-200"
                      }`}
                    >
                      <MaterialCommunityIcons
                        name={cfg.icon as any}
                        size={16}
                        color={cfg.color}
                      />
                      <Text className="ml-1.5 text-sm font-medium" style={{ color: cfg.color }}>
                        {t(cfg.label as any)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* AI Summary */}
            {item.ai_summary && (
              <View className="bg-blue-50 rounded-lg p-3 mb-3">
                <Text className="text-xs font-semibold text-blue-600 mb-1">
                  {t("inboxAiSummary")}
                </Text>
                <Text className="text-sm text-gray-700">{item.ai_summary}</Text>
              </View>
            )}

            {/* Extracted data - editable */}
            {Object.keys(editedData).length > 0 && (
              <View>
                <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase">
                  {t("inboxExtractedData")}
                </Text>
                {Object.entries(editedData).map(([key, value]) => (
                  <View key={key} className="flex-row items-center mb-2">
                    <Text className="text-xs text-gray-500 w-28 capitalize">
                      {key.replace(/_/g, " ")}
                    </Text>
                    <TextInput
                      className="flex-1 text-sm bg-gray-50 rounded px-2 py-1.5 border border-gray-200"
                      value={value}
                      onChangeText={(v) =>
                        setEditedData((prev) => ({ ...prev, [key]: v }))
                      }
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Raw text */}
        {item.raw_text && (
          <View className="mx-4 mt-4 p-4 bg-white rounded-xl border border-gray-100">
            <Text className="text-xs font-semibold text-gray-500 mb-2">
              Testo originale
            </Text>
            <Text className="text-sm text-gray-700">{item.raw_text}</Text>
          </View>
        )}

        {/* Email info */}
        {item.source === "email" && (
          <View className="mx-4 mt-4 p-4 bg-white rounded-xl border border-gray-100">
            <Text className="text-xs font-semibold text-gray-500 mb-2">Email</Text>
            {item.source_email_from && (
              <Text className="text-sm text-gray-700 mb-1">
                Da: {item.source_email_from}
              </Text>
            )}
            {item.source_email_subject && (
              <Text className="text-sm text-gray-700">
                Oggetto: {item.source_email_subject}
              </Text>
            )}
          </View>
        )}

        {/* Routed info */}
        {item.status === "routed" && (
          <View className="mx-4 mt-4 p-4 bg-green-50 rounded-xl flex-row items-center">
            <MaterialCommunityIcons name="check-circle" size={20} color="#059669" />
            <Text className="ml-2 text-sm text-green-700 font-medium">
              {t("inboxRouted_status")} → {item.routed_to_table || ""}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom action */}
      {item.status === "classified" && (
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-4 pb-8">
          <TouchableOpacity
            onPress={() => handleRoute()}
            disabled={routing}
            className={`py-3.5 rounded-xl items-center ${
              routing ? "bg-gray-200" : "bg-blue-600"
            }`}
          >
            {routing ? (
              <ActivityIndicator size="small" color="#6b7280" />
            ) : (
              <Text className="text-base font-bold text-white">
                {t("inboxConfirmRoute")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
