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
import * as Haptics from "expo-haptics";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { PhotoPicker } from "@/components/PhotoPicker";
import { ClientAutocomplete } from "@/components/ClientAutocomplete";
import { useI18n } from "@/lib/i18n";
import type { Client, AIExtractedJobData } from "@/types";

export default function NewJobScreen() {
  const { t } = useI18n();
  const { artisan } = useArtisan();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [transcription, setTranscription] = useState("");
  const [aiData, setAiData] = useState<AIExtractedJobData | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleRecordingComplete = async (uri: string) => {
    setAudioUri(uri);
    setTranscribing(true);

    try {
      // Upload audio to Supabase Storage
      const fileName = `audio_${Date.now()}.m4a`;
      const fileContent = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("recordings")
        .upload(fileName, decode(fileContent), {
          contentType: "audio/m4a",
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("recordings")
        .getPublicUrl(fileName);

      // Call transcription Edge Function
      const { data, error } = await supabase.functions.invoke("transcribe", {
        body: { audioUrl: urlData.publicUrl },
      });

      if (error) throw error;
      setTranscription(data.transcription || "");
      setDescription((prev) =>
        prev ? `${prev}\n${data.transcription}` : data.transcription
      );
    } catch (err: any) {
      Alert.alert(t("error"), t("transcriptionFailed") + ": " + (err.message || ""));
    } finally {
      setTranscribing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!description.trim()) {
      Alert.alert(t("error"), t("enterDescFirst"));
      return;
    }

    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-job", {
        body: {
          text: description,
          artisanTrade: artisan?.trade || "artigiano",
        },
      });

      if (error) throw error;
      setAiData(data.extracted);
      if (data.extracted?.tipo_lavoro && !title) {
        setTitle(data.extracted.tipo_lavoro);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert(t("error"), t("analysisFailed") + ": " + (err.message || ""));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!artisan) return;
    if (!title.trim()) {
      Alert.alert(t("error"), t("enterJobTitle"));
      return;
    }

    setSaving(true);
    try {
      // Upload photos to Supabase Storage
      const photoUrls: string[] = [];
      for (const photoUri of photos) {
        const fileName = `photo_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
        const fileContent = await FileSystem.readAsStringAsync(photoUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const { error: upErr } = await supabase.storage
          .from("photos")
          .upload(fileName, decode(fileContent), {
            contentType: "image/jpeg",
          });
        if (!upErr) {
          const { data: urlData } = supabase.storage
            .from("photos")
            .getPublicUrl(fileName);
          photoUrls.push(urlData.publicUrl);
        }
      }

      const { error } = await supabase.from("jobs").insert({
        artisan_id: artisan.id,
        client_id: selectedClient?.id || null,
        title: title.trim(),
        description: description.trim() || null,
        transcription: transcription || null,
        photos: photoUrls.length > 0 ? photoUrls : null,
        ai_extracted_data: aiData || null,
        status: "draft",
      });

      if (error) throw error;
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t("newJobTitle") }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 bg-white"
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Client */}
          <Text className="text-sm font-medium text-gray-700 mb-1">
            {t("client")}
          </Text>
          {artisan && (
            <ClientAutocomplete
              artisanId={artisan.id}
              selectedClient={selectedClient}
              onSelect={setSelectedClient}
            />
          )}

          {/* Title */}
          <Text className="text-sm font-medium text-gray-700 mb-1 mt-4">
            {t("jobTitle")}
          </Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
            placeholder={t("jobTitlePlaceholder")}
            placeholderTextColor="#9ca3af"
            value={title}
            onChangeText={setTitle}
          />

          {/* Description */}
          <Text className="text-sm font-medium text-gray-700 mb-1 mt-4">
            {t("description")}
          </Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 min-h-[100]"
            placeholder={t("describeJob")}
            placeholderTextColor="#9ca3af"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Voice recorder */}
          <VoiceRecorder
            onRecordingComplete={handleRecordingComplete}
            disabled={transcribing}
          />
          {transcribing && (
            <View className="flex-row items-center justify-center mb-3">
              <ActivityIndicator size="small" color="#2563eb" />
              <Text className="ml-2 text-sm text-primary">
                {t("transcribing")}
              </Text>
            </View>
          )}

          {/* Photos */}
          <Text className="text-sm font-medium text-gray-700 mb-2 mt-2">
            {t("photos", { count: "" })}
          </Text>
          <PhotoPicker photos={photos} onPhotosChange={setPhotos} />

          {/* AI Analyze button */}
          {description.trim() && !aiData && (
            <TouchableOpacity
              onPress={handleAnalyze}
              disabled={analyzing}
              className="mt-6 bg-blue-50 border border-blue-200 rounded-xl py-3 items-center flex-row justify-center"
            >
              {analyzing ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <Text className="text-2xl mr-2">🤖</Text>
              )}
              <Text className="text-primary font-semibold ml-1">
                {analyzing ? t("analyzing") : t("analyzeAI")}
              </Text>
            </TouchableOpacity>
          )}

          {/* AI extracted data */}
          {aiData && (
            <View className="mt-4 bg-blue-50 rounded-xl p-4">
              <Text className="text-sm font-semibold text-primary mb-2">
                🤖 {t("aiExtractedData")}
              </Text>
              {aiData.tipo_lavoro && (
                <Text className="text-sm mb-1">
                  <Text className="font-medium">{t("type")}: </Text>
                  {aiData.tipo_lavoro}
                </Text>
              )}
              {aiData.materiali && aiData.materiali.length > 0 && (
                <Text className="text-sm mb-1">
                  <Text className="font-medium">{t("materials")}: </Text>
                  {aiData.materiali.join(", ")}
                </Text>
              )}
              {aiData.urgenza && (
                <Text className="text-sm mb-1">
                  <Text className="font-medium">{t("urgency")}: </Text>
                  {aiData.urgenza}
                </Text>
              )}
              {aiData.note && (
                <Text className="text-sm">
                  <Text className="font-medium">{t("notes")}: </Text>
                  {aiData.note}
                </Text>
              )}
            </View>
          )}
        </ScrollView>

        {/* Save button */}
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !title.trim()}
            className={`rounded-xl py-4 items-center ${
              title.trim() ? "bg-primary" : "bg-gray-300"
            }`}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-lg font-semibold">
                {t("saveJob")}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

// Helper to decode base64 for Supabase upload
function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}
