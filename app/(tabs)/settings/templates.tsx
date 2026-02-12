import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { formatCurrency } from "@/lib/utils/format";
import { useI18n } from "@/lib/i18n";
import { EmptyState } from "@/components/EmptyState";
import type { QuoteTemplate, QuoteItem } from "@/types";

const UNITS = ["ore", "pezzi", "metri", "metro quadro", "forfait"];

export default function TemplatesScreen() {
  const { artisan } = useArtisan();
  const { t, locale } = useI18n();
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<QuoteTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [generatingDefaults, setGeneratingDefaults] = useState(false);

  // Editing state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [vatRate, setVatRate] = useState(22);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!artisan) return;

    const { data } = await supabase
      .from("quote_templates")
      .select("*")
      .eq("artisan_id", artisan.id)
      .order("usage_count", { ascending: false });

    setTemplates(data || []);
    setLoading(false);
  }, [artisan]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const startCreate = () => {
    setName("");
    setDescription("");
    setItems([
      { description: "", quantity: 1, unit: "ore", unit_price: 0, total: 0 },
    ]);
    setVatRate(22);
    setNotes("");
    setEditing(null);
    setCreating(true);
  };

  const startEdit = (template: QuoteTemplate) => {
    setName(template.name);
    setDescription(template.description || "");
    setItems(template.items || []);
    setVatRate(template.vat_rate || 22);
    setNotes(template.notes || "");
    setEditing(template);
    setCreating(true);
  };

  const cancelEdit = () => {
    setCreating(false);
    setEditing(null);
  };

  const updateItem = (index: number, field: keyof QuoteItem, value: string) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index] };

      if (field === "description") {
        item.description = value;
      } else if (field === "quantity") {
        item.quantity = parseFloat(value) || 0;
        item.total = item.quantity * item.unit_price;
      } else if (field === "unit") {
        const currentIdx = UNITS.indexOf(item.unit);
        item.unit = UNITS[(currentIdx + 1) % UNITS.length];
      } else if (field === "unit_price") {
        item.unit_price = parseFloat(value) || 0;
        item.total = item.quantity * item.unit_price;
      }

      updated[index] = item;
      return updated;
    });
  };

  const addItem = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) => [
      ...prev,
      { description: "", quantity: 1, unit: "ore", unit_price: 0, total: 0 },
    ]);
  };

  const removeItem = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!artisan || !name.trim()) {
      Alert.alert(t("error"), t("enterTemplateName"));
      return;
    }
    if (items.length === 0) {
      Alert.alert(t("error"), t("addAtLeastOneItemTemplate"));
      return;
    }

    setSaving(true);
    try {
      const recalcItems = items.map((item) => ({
        ...item,
        total: item.quantity * item.unit_price,
      }));

      if (editing) {
        const { error } = await supabase
          .from("quote_templates")
          .update({
            name: name.trim(),
            description: description.trim() || null,
            items: recalcItems,
            vat_rate: vatRate,
            notes: notes.trim() || null,
          })
          .eq("id", editing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("quote_templates").insert({
          artisan_id: artisan.id,
          name: name.trim(),
          description: description.trim() || null,
          items: recalcItems,
          vat_rate: vatRate,
          notes: notes.trim() || null,
          source: "manual",
        });

        if (error) throw error;
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCreating(false);
      setEditing(null);
      fetchTemplates();
    } catch (err: any) {
      Alert.alert(t("error"), err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (template: QuoteTemplate) => {
    Alert.alert(t("deleteTemplate"), t("deleteTemplateMsg", { name: template.name }), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          await supabase.from("quote_templates").delete().eq("id", template.id);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          fetchTemplates();
        },
      },
    ]);
  };

  const handleImportFromFile = async () => {
    setImporting(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["image/*", "application/pdf"],
      });

      if (result.canceled || !result.assets[0]) {
        setImporting(false);
        return;
      }

      const asset = result.assets[0];

      // Upload file to storage
      const ext = asset.name.split(".").pop() || "jpg";
      const fileName = `template_import_${artisan!.id}_${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, blob, {
          contentType: asset.mimeType || "application/octet-stream",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      // Call AI extraction
      const { data, error } = await supabase.functions.invoke(
        "extract-template",
        {
          body: {
            fileUrl: urlData.publicUrl,
            artisanTrade: artisan!.trade,
          },
        }
      );

      if (error) throw error;

      if (data?.name && data?.items) {
        // Pre-fill the editor with extracted data
        setName(data.name);
        setDescription(data.description || t("importedFromFile"));
        setItems(data.items);
        setVatRate(data.vat_rate || 22);
        setNotes(data.notes || "");
        setEditing(null);
        setCreating(true);

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
        Alert.alert(
          t("templateExtracted"),
          t("templateExtractedMsg")
        );
      } else {
        Alert.alert(t("error"), t("extractionFailed"));
      }
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("importFailed"));
    } finally {
      setImporting(false);
    }
  };

  const handleGenerateDefaults = async () => {
    if (!artisan) return;

    setGeneratingDefaults(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "suggest-default-templates",
        {
          body: { trade: artisan.trade },
        }
      );

      if (error) throw error;

      if (data?.templates && data.templates.length > 0) {
        for (const tpl of data.templates) {
          await supabase.from("quote_templates").insert({
            artisan_id: artisan.id,
            name: tpl.name,
            description: tpl.description,
            items: tpl.items,
            vat_rate: 22,
            is_default: true,
            source: "ai",
          });
        }

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
        Alert.alert(
          t("templatesCreated"),
          t("templatesCreatedMsg", { count: String(data.templates.length), trade: artisan.trade })
        );
        fetchTemplates();
      }
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("generationFailed"));
    } finally {
      setGeneratingDefaults(false);
    }
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t("templatesTitle") }} />
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </>
    );
  }

  // ---- EDITOR MODE ----
  if (creating) {
    return (
      <>
        <Stack.Screen
          options={{ title: editing ? t("editTemplate") : t("newTemplateTitle") }}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 bg-gray-50"
        >
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 120 }}
          >
            {/* Template name */}
            <View className="bg-white px-4 py-3 mb-2">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                {t("templateName")}
              </Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 text-base bg-gray-50"
                placeholder={t("templateNamePlaceholder")}
                placeholderTextColor="#9ca3af"
                value={name}
                onChangeText={setName}
                autoFocus
              />
            </View>

            {/* Description */}
            <View className="bg-white px-4 py-3 mb-2">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                {t("descriptionOptional")}
              </Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50"
                placeholder={t("descriptionOptionalPlaceholder")}
                placeholderTextColor="#9ca3af"
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* Items editor */}
            <View className="px-4 py-2">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                {t("quoteItems")}
              </Text>
            </View>

            {items.map((item, index) => (
              <View
                key={index}
                className="bg-white mx-4 mb-2 rounded-xl p-3 border border-gray-100"
              >
                <View className="flex-row items-center mb-2">
                  <TextInput
                    className="flex-1 text-sm bg-gray-50 rounded px-2 py-1.5"
                    placeholder={t("descriptionPlaceholder")}
                    placeholderTextColor="#9ca3af"
                    value={item.description}
                    onChangeText={(val) =>
                      updateItem(index, "description", val)
                    }
                  />
                  <TouchableOpacity
                    onPress={() => removeItem(index)}
                    className="ml-2"
                    hitSlop={8}
                  >
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={20}
                      color="#ef4444"
                    />
                  </TouchableOpacity>
                </View>
                <View className="flex-row items-center gap-2">
                  <View className="flex-1">
                    <Text className="text-xs text-muted mb-0.5">{t("qty")}</Text>
                    <TextInput
                      className="text-sm bg-gray-50 rounded px-2 py-1.5 text-center"
                      keyboardType="decimal-pad"
                      value={item.quantity > 0 ? String(item.quantity) : ""}
                      onChangeText={(val) =>
                        updateItem(index, "quantity", val)
                      }
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted mb-0.5">{t("unit")}</Text>
                    <TouchableOpacity
                      onPress={() => updateItem(index, "unit", "")}
                      className="bg-gray-50 rounded px-2 py-1.5 items-center"
                    >
                      <Text className="text-sm">{item.unit}</Text>
                    </TouchableOpacity>
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted mb-0.5">{t("priceEurShort")}</Text>
                    <TextInput
                      className="text-sm bg-gray-50 rounded px-2 py-1.5 text-center"
                      keyboardType="decimal-pad"
                      value={
                        item.unit_price > 0 ? String(item.unit_price) : ""
                      }
                      onChangeText={(val) =>
                        updateItem(index, "unit_price", val)
                      }
                    />
                  </View>
                  <View className="flex-1">
                    <Text className="text-xs text-muted mb-0.5">{t("totalLabel")}</Text>
                    <Text className="text-sm font-semibold text-center py-1.5">
                      {formatCurrency(item.quantity * item.unit_price, locale)}
                    </Text>
                  </View>
                </View>
              </View>
            ))}

            <TouchableOpacity
              onPress={addItem}
              className="mx-4 mb-4 border border-dashed border-gray-300 rounded-xl py-3 items-center"
            >
              <View className="flex-row items-center">
                <MaterialCommunityIcons name="plus" size={18} color="#6b7280" />
                <Text className="text-sm text-muted ml-1">{t("addItemShort")}</Text>
              </View>
            </TouchableOpacity>

            {/* Notes */}
            <View className="bg-white px-4 py-3 mb-2">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                {t("notesOptional")}
              </Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50"
                placeholder={t("notesFixedPlaceholder")}
                placeholderTextColor="#9ca3af"
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>
          </ScrollView>

          {/* Save/Cancel bar */}
          <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={cancelEdit}
                className="flex-1 border border-gray-300 rounded-xl py-3.5 items-center"
              >
                <Text className="text-gray-600 font-semibold">{t("cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleSave}
                disabled={saving}
                className="flex-1 bg-primary rounded-xl py-3.5 items-center"
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white font-semibold">
                    {t("saveTemplate")}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </>
    );
  }

  // ---- LIST MODE ----
  return (
    <>
      <Stack.Screen options={{ title: t("templatesTitle") }} />
      <View className="flex-1 bg-gray-50">
        {templates.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <EmptyState
              icon="file-document-multiple"
              title={t("noTemplates")}
              description={t("templatesDesc")}
            />
            <View className="w-full px-4 mt-4 gap-3">
              <TouchableOpacity
                onPress={startCreate}
                className="bg-primary rounded-xl py-4 items-center flex-row justify-center"
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="plus" size={20} color="white" />
                <Text className="text-white font-semibold ml-2">
                  {t("createManually")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleImportFromFile}
                disabled={importing}
                className="border border-primary rounded-xl py-4 items-center flex-row justify-center"
                activeOpacity={0.8}
              >
                {importing ? (
                  <ActivityIndicator size="small" color="#2563eb" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="file-upload"
                      size={20}
                      color="#2563eb"
                    />
                    <Text className="text-primary font-semibold ml-2">
                      {t("importFromFile")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleGenerateDefaults}
                disabled={generatingDefaults}
                className="border border-green-600 rounded-xl py-4 items-center flex-row justify-center"
                activeOpacity={0.8}
              >
                {generatingDefaults ? (
                  <ActivityIndicator size="small" color="#16a34a" />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name="robot"
                      size={20}
                      color="#16a34a"
                    />
                    <Text className="text-green-700 font-semibold ml-2">
                      {t("generateStandard")}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            <FlatList
              data={templates}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingTop: 8, paddingBottom: 160 }}
              renderItem={({ item }) => {
                const subtotal = item.items.reduce(
                  (sum, i) => sum + (i.quantity * i.unit_price || 0),
                  0
                );
                return (
                  <TouchableOpacity
                    onPress={() => startEdit(item)}
                    className="bg-white mx-4 mb-2 rounded-xl p-4"
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-base font-semibold flex-1">
                        {item.name}
                      </Text>
                      <View className="flex-row items-center">
                        {item.source === "ai" && (
                          <View className="bg-green-100 rounded-full px-2 py-0.5 mr-2">
                            <Text className="text-xs text-green-700">AI</Text>
                          </View>
                        )}
                        {item.source === "import" && (
                          <View className="bg-blue-100 rounded-full px-2 py-0.5 mr-2">
                            <Text className="text-xs text-blue-700">
                              {t("imported")}
                            </Text>
                          </View>
                        )}
                        <TouchableOpacity
                          onPress={() => handleDelete(item)}
                          hitSlop={8}
                        >
                          <MaterialCommunityIcons
                            name="trash-can-outline"
                            size={18}
                            color="#ef4444"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                    {item.description && (
                      <Text className="text-sm text-muted mb-1" numberOfLines={1}>
                        {item.description}
                      </Text>
                    )}
                    <Text className="text-xs text-muted">
                      {item.items.length} voc
                      {item.items.length === 1 ? "e" : "i"} ·{" "}
                      {formatCurrency(subtotal, locale)} + IVA
                      {item.usage_count > 0
                        ? ` · ${t("usedCountShort", { count: String(item.usage_count) })}`
                        : ""}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />

            {/* Bottom action buttons */}
            <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={startCreate}
                  className="flex-1 bg-primary rounded-xl py-3.5 items-center flex-row justify-center"
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons
                    name="plus"
                    size={18}
                    color="white"
                  />
                  <Text className="text-white font-semibold ml-1">{t("newTemplate")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleImportFromFile}
                  disabled={importing}
                  className="flex-1 border border-primary rounded-xl py-3.5 items-center flex-row justify-center"
                  activeOpacity={0.8}
                >
                  {importing ? (
                    <ActivityIndicator size="small" color="#2563eb" />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name="file-upload"
                        size={18}
                        color="#2563eb"
                      />
                      <Text className="text-primary font-semibold ml-1">
                        {t("importShort")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleGenerateDefaults}
                  disabled={generatingDefaults}
                  className="flex-1 border border-green-600 rounded-xl py-3.5 items-center flex-row justify-center"
                  activeOpacity={0.8}
                >
                  {generatingDefaults ? (
                    <ActivityIndicator size="small" color="#16a34a" />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name="robot"
                        size={18}
                        color="#16a34a"
                      />
                      <Text className="text-green-700 font-semibold ml-1">
                        {t("standardShort")}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
      </View>
    </>
  );
}
