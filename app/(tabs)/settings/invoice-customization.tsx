import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useArtisan } from "@/hooks/useArtisan";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import type { InvoiceFieldVisibility } from "@/types";

const TEMPLATE_OPTIONS = [
  { key: "classic", title: "Classic", accent: "#2563eb" },
  { key: "modern", title: "Modern", accent: "#0f766e" },
  { key: "compact", title: "Compact", accent: "#334155" },
  { key: "bold", title: "Bold", accent: "#b91c1c" },
  { key: "minimal", title: "Minimal", accent: "#4b5563" },
] as const;

const DEFAULT_VISIBILITY: InvoiceFieldVisibility = {
  quantity: true,
  unit: true,
  article_code: false,
  discount: false,
  vat_column: true,
  due_date: true,
  payment_method: true,
  notes: true,
  signature: true,
};

export default function InvoiceCustomizationScreen() {
  const { artisan, refetch } = useArtisan();
  const { t } = useI18n();

  const [templateKey, setTemplateKey] = useState("classic");
  const [customTemplateUrl, setCustomTemplateUrl] = useState<string | null>(null);
  const [fieldVisibility, setFieldVisibility] =
    useState<InvoiceFieldVisibility>(DEFAULT_VISIBILITY);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!artisan) return;
    setTemplateKey(artisan.invoice_template_key || "classic");
    setCustomTemplateUrl(artisan.invoice_template_file_url || null);
    setFieldVisibility({
      ...DEFAULT_VISIBILITY,
      ...(artisan.invoice_field_visibility || {}),
    });
  }, [artisan]);

  const FIELD_TOGGLES = useMemo(
    () => [
      { key: "quantity", label: t("showQuantity") },
      { key: "unit", label: t("showUnit") },
      { key: "article_code", label: t("showArticleCode") },
      { key: "discount", label: t("showDiscount") },
      { key: "vat_column", label: t("showVatColumn") },
      { key: "due_date", label: t("showDueDate") },
      { key: "payment_method", label: t("showPaymentMethod") },
      { key: "notes", label: t("showNotes") },
      { key: "signature", label: t("showSignature") },
    ],
    [t]
  );

  const toggleField = (key: keyof InvoiceFieldVisibility) => {
    setFieldVisibility((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleCustomTemplateUpload = async () => {
    if (!artisan) return;

    setUploading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
      });

      if (result.canceled || !result.assets[0]) {
        setUploading(false);
        return;
      }

      const asset = result.assets[0];
      const ext = asset.name.split(".").pop() || "pdf";
      const fileName = `invoice_template_${artisan.id}_${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, blob, {
          contentType: asset.mimeType || "application/octet-stream",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("documents").getPublicUrl(fileName);
      setCustomTemplateUrl(urlData.publicUrl);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("importFailed"));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!artisan) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("artisans")
        .update({
          invoice_template_key: templateKey,
          invoice_template_file_url: customTemplateUrl,
          invoice_field_visibility: fieldVisibility,
        })
        .eq("id", artisan.id);

      if (error) throw error;

      await refetch();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("saved"), t("invoiceCustomizationSaved"));
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t("invoiceCustomization") }} />
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      >
        <View className="bg-white rounded-xl p-4 mb-3">
          <Text className="text-base font-semibold mb-3">{t("invoiceTemplates")}</Text>
          <View className="flex-row flex-wrap gap-2">
            {TEMPLATE_OPTIONS.map((option) => {
              const selected = option.key === templateKey;
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setTemplateKey(option.key)}
                  className={`w-[48%] rounded-xl border p-3 ${
                    selected ? "border-primary bg-blue-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <View
                    style={{ backgroundColor: option.accent, height: 6, borderRadius: 8 }}
                    className="mb-2"
                  />
                  <Text className="text-sm font-semibold text-gray-800">{option.title}</Text>
                  <Text className="text-xs text-muted mt-1">{t("templatePreview")}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View className="bg-white rounded-xl p-4 mb-3">
          <Text className="text-base font-semibold mb-2">{t("customInvoiceTemplate")}</Text>
          <Text className="text-sm text-muted mb-3">{t("customInvoiceTemplateDesc")}</Text>

          <TouchableOpacity
            onPress={handleCustomTemplateUpload}
            disabled={uploading}
            className="border border-primary rounded-xl py-3 items-center flex-row justify-center"
            activeOpacity={0.8}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="#2563eb" />
            ) : (
              <>
                <MaterialCommunityIcons name="file-upload" size={18} color="#2563eb" />
                <Text className="text-primary font-semibold ml-2">{t("uploadTemplate")}</Text>
              </>
            )}
          </TouchableOpacity>

          {customTemplateUrl && (
            <View className="mt-3 bg-gray-50 rounded-lg p-3">
              <Text className="text-xs text-gray-500">{t("customTemplateActive")}</Text>
              <Text className="text-xs text-gray-700" numberOfLines={1}>
                {customTemplateUrl}
              </Text>
            </View>
          )}
        </View>

        <View className="bg-white rounded-xl p-4 mb-3">
          <Text className="text-base font-semibold mb-3">{t("invoiceFields")}</Text>
          {FIELD_TOGGLES.map((field) => {
            const value = !!fieldVisibility[field.key as keyof InvoiceFieldVisibility];
            return (
              <View
                key={field.key}
                className="flex-row items-center justify-between py-2 border-b border-gray-100"
              >
                <Text className="text-sm text-gray-700">{field.label}</Text>
                <Switch
                  value={value}
                  onValueChange={() =>
                    toggleField(field.key as keyof InvoiceFieldVisibility)
                  }
                />
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View className="absolute left-0 right-0 bottom-0 bg-white border-t border-gray-100 px-5 py-4">
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className="bg-primary rounded-xl py-3.5 items-center"
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white font-semibold">{t("save")}</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}
