import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack, router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { useI18n } from "@/lib/i18n";
import type { AIFlags } from "@/types";

const CATEGORIES = [
  "materiali",
  "servizi",
  "attrezzature",
  "trasporto",
  "altro",
];

export default function NewPassiveInvoiceScreen() {
  const { t } = useI18n();
  const { artisan } = useArtisan();
  const [supplierName, setSupplierName] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [category, setCategory] = useState("materiali");
  const [subtotal, setSubtotal] = useState("");
  const [vatAmount, setVatAmount] = useState("");
  const [total, setTotal] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [paymentDue, setPaymentDue] = useState("");
  const [notes, setNotes] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [flags, setFlags] = useState<AIFlags | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extracted, setExtracted] = useState(false);

  const uploadAndAnalyze = async (uri: string, mimeType: string) => {
    setAnalyzing(true);
    try {
      // Upload file to Supabase Storage
      const fileName = `passive_${Date.now()}.${mimeType.includes("pdf") ? "pdf" : "jpg"}`;
      const fileContent = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const binaryString = atob(fileContent);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, bytes, {
          contentType: mimeType,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("documents")
        .getPublicUrl(fileName);

      setFileUrl(urlData.publicUrl);

      // Call AI extraction
      const { data, error } = await supabase.functions.invoke(
        "extract-invoice",
        {
          body: {
            imageUrl: urlData.publicUrl,
            artisanId: artisan?.id,
          },
        }
      );

      if (error) throw error;

      // Populate form with extracted data
      if (data.extracted) {
        const e = data.extracted;
        if (e.supplier_name) setSupplierName(e.supplier_name);
        if (e.invoice_number) setInvoiceNumber(e.invoice_number);
        if (e.category) setCategory(e.category);
        if (e.subtotal) setSubtotal(e.subtotal.toString());
        if (e.vat_amount) setVatAmount(e.vat_amount.toString());
        if (e.total) setTotal(e.total.toString());
        if (e.issue_date) setIssueDate(e.issue_date);
        if (e.payment_due) setPaymentDue(e.payment_due);
        setExtracted(true);
      }

      if (data.flags && Object.keys(data.flags).length > 0) {
        setFlags(data.flags);
      }

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
    } catch (err: any) {
      Alert.alert(t("error"), t("analysisFailed") + ": " + (err.message || ""));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t("permissionDenied"),
        t("allowCameraAccess")
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadAndAnalyze(result.assets[0].uri, "image/jpeg");
    }
  };

  const handleGallery = async () => {
    const permission =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        t("permissionDenied"),
        t("allowGalleryAccess")
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      await uploadAndAnalyze(result.assets[0].uri, "image/jpeg");
    }
  };

  const handleDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf", "text/xml"],
      copyToCacheDirectory: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const mimeType = asset.mimeType || "application/pdf";
      await uploadAndAnalyze(asset.uri, mimeType);
    }
  };

  const handleSave = async () => {
    if (!artisan) return;
    if (!supplierName.trim()) {
      Alert.alert(t("error"), t("enterSupplierName"));
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("invoices_passive").insert({
        artisan_id: artisan.id,
        supplier_name: supplierName.trim(),
        invoice_number: invoiceNumber.trim() || null,
        category,
        subtotal: parseFloat(subtotal) || null,
        vat_amount: parseFloat(vatAmount) || null,
        total: parseFloat(total) || null,
        issue_date: issueDate || null,
        payment_due: paymentDue || null,
        original_file_url: fileUrl,
        ai_flags: flags,
        notes: notes.trim() || null,
      });

      if (error) throw error;
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
      router.back();
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t("newPassiveInvoice") }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 bg-white"
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Upload methods */}
          {!extracted && !analyzing && (
            <View className="mb-6">
              <Text className="text-base font-semibold text-gray-700 mb-3">
                {t("uploadInvoice")}
              </Text>
              <View className="gap-3">
                <TouchableOpacity
                  onPress={handleCamera}
                  className="flex-row items-center bg-blue-50 border border-blue-200 rounded-xl p-4"
                >
                  <MaterialCommunityIcons
                    name="camera"
                    size={24}
                    color="#2563eb"
                  />
                  <View className="ml-3">
                    <Text className="text-base font-medium text-primary">
                      {t("takePhoto")}
                    </Text>
                    <Text className="text-xs text-muted">
                      {t("photographInvoice")}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleDocument}
                  className="flex-row items-center bg-blue-50 border border-blue-200 rounded-xl p-4"
                >
                  <MaterialCommunityIcons
                    name="file-document"
                    size={24}
                    color="#2563eb"
                  />
                  <View className="ml-3">
                    <Text className="text-base font-medium text-primary">
                      {t("filePdfXml")}
                    </Text>
                    <Text className="text-xs text-muted">
                      {t("selectFromFiles")}
                    </Text>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handleGallery}
                  className="flex-row items-center bg-blue-50 border border-blue-200 rounded-xl p-4"
                >
                  <MaterialCommunityIcons
                    name="image"
                    size={24}
                    color="#2563eb"
                  />
                  <View className="ml-3">
                    <Text className="text-base font-medium text-primary">
                      {t("fromGallery")}
                    </Text>
                    <Text className="text-xs text-muted">
                      {t("chooseExistingPhoto")}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              <View className="items-center mt-4">
                <TouchableOpacity
                  onPress={() => setExtracted(true)}
                >
                  <Text className="text-sm text-primary">
                    {t("orEnterManually")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Analyzing spinner */}
          {analyzing && (
            <View className="items-center py-12">
              <ActivityIndicator size="large" color="#2563eb" />
              <Text className="text-primary font-medium mt-4">
                {t("analyzingInvoice")}
              </Text>
            </View>
          )}

          {/* AI warnings */}
          {flags && flags.message && (
            <View className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
              <View className="flex-row items-center">
                <MaterialCommunityIcons
                  name="alert"
                  size={18}
                  color="#d97706"
                />
                <Text className="text-sm text-yellow-800 font-medium ml-2">
                  {t("warning")}
                </Text>
              </View>
              <Text className="text-sm text-yellow-700 mt-1">
                {flags.message}
              </Text>
            </View>
          )}

          {/* Editable form */}
          {(extracted || analyzing) && !analyzing && (
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-1">
                {t("supplier")}
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-3"
                placeholder={t("supplierPlaceholder")}
                placeholderTextColor="#9ca3af"
                value={supplierName}
                onChangeText={setSupplierName}
              />

              <Text className="text-sm font-medium text-gray-700 mb-1">
                {t("invoiceNumber")}
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-3"
                placeholder={t("invoiceNumberPlaceholder")}
                placeholderTextColor="#9ca3af"
                value={invoiceNumber}
                onChangeText={setInvoiceNumber}
              />

              <Text className="text-sm font-medium text-gray-700 mb-1">
                {t("category")}
              </Text>
              <View className="flex-row flex-wrap gap-2 mb-3">
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-full ${
                      category === cat
                        ? "bg-primary"
                        : "bg-gray-100"
                    }`}
                  >
                    <Text
                      className={`text-sm capitalize ${
                        category === cat
                          ? "text-white font-medium"
                          : "text-gray-600"
                      }`}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View className="flex-row gap-3 mb-3">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-700 mb-1">
                    {t("subtotalEur")}
                  </Text>
                  <TextInput
                    className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    value={subtotal}
                    onChangeText={setSubtotal}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-700 mb-1">
                    {t("vatEur")}
                  </Text>
                  <TextInput
                    className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                    keyboardType="decimal-pad"
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    value={vatAmount}
                    onChangeText={setVatAmount}
                  />
                </View>
              </View>

              <Text className="text-sm font-medium text-gray-700 mb-1">
                {t("totalEur")}
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-3"
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor="#9ca3af"
                value={total}
                onChangeText={setTotal}
              />

              <View className="flex-row gap-3 mb-3">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-700 mb-1">
                    {t("issueDate")}
                  </Text>
                  <TextInput
                    className="border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9ca3af"
                    value={issueDate}
                    onChangeText={setIssueDate}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-700 mb-1">
                    {t("paymentDueDate")}
                  </Text>
                  <TextInput
                    className="border border-gray-300 rounded-xl px-4 py-3 text-sm bg-gray-50"
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor="#9ca3af"
                    value={paymentDue}
                    onChangeText={setPaymentDue}
                  />
                </View>
              </View>

              <Text className="text-sm font-medium text-gray-700 mb-1">
                {t("notes")}
              </Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 min-h-[60]"
                placeholder={t("additionalNotes")}
                placeholderTextColor="#9ca3af"
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
              />
            </View>
          )}
        </ScrollView>

        {/* Save button */}
        {extracted && !analyzing && (
          <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
            <TouchableOpacity
              onPress={handleSave}
              disabled={saving || !supplierName.trim()}
              className={`rounded-xl py-4 items-center ${
                supplierName.trim() ? "bg-primary" : "bg-gray-300"
              }`}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-lg font-semibold">
                  {t("confirmAndSave")}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
}
