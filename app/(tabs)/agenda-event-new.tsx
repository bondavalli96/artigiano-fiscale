import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, router } from "expo-router";
import * as Haptics from "expo-haptics";
import { useArtisan } from "@/hooks/useArtisan";
import { supabase } from "@/lib/supabase";
import { ClientAutocomplete } from "@/components/ClientAutocomplete";
import { useI18n } from "@/lib/i18n";
import type { Client } from "@/types";

function getTodayDate() {
  const now = new Date();
  return now.toISOString().split("T")[0];
}

function getRoundedTime() {
  const now = new Date();
  const minutes = now.getMinutes();
  const rounded = minutes < 30 ? "30" : "00";
  const hour = minutes < 30 ? now.getHours() : now.getHours() + 1;
  return `${String(hour).padStart(2, "0")}:${rounded}`;
}

export default function NewAgendaEventScreen() {
  const { t } = useI18n();
  const { artisan } = useArtisan();

  const [title, setTitle] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [eventDate, setEventDate] = useState(getTodayDate());
  const [eventTime, setEventTime] = useState(getRoundedTime());
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = useMemo(() => title.trim().length > 0, [title]);

  const handleSave = async () => {
    if (!artisan || !canSave) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("agenda_events").insert({
        artisan_id: artisan.id,
        client_id: selectedClient?.id || null,
        title: title.trim(),
        event_date: eventDate,
        event_time: eventTime.trim() || null,
        location: location.trim() || null,
        description: description.trim() || null,
        notes: notes.trim() || null,
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
      <Stack.Screen options={{ title: t("newAgendaEvent") }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 bg-white"
          contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          <Text className="text-sm font-medium text-gray-700 mb-1">{t("eventTitle")}</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-3"
            placeholder={t("eventTitlePlaceholder")}
            placeholderTextColor="#9ca3af"
            value={title}
            onChangeText={setTitle}
          />

          <Text className="text-sm font-medium text-gray-700 mb-1">{t("client")}</Text>
          {artisan && (
            <ClientAutocomplete
              artisanId={artisan.id}
              selectedClient={selectedClient}
              onSelect={setSelectedClient}
            />
          )}

          <Text className="text-sm font-medium text-gray-700 mb-1 mt-3">{t("eventDate")}</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-3"
            placeholder="2026-02-12"
            placeholderTextColor="#9ca3af"
            value={eventDate}
            onChangeText={setEventDate}
          />

          <Text className="text-sm font-medium text-gray-700 mb-1">{t("eventTime")}</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-3"
            placeholder="14:30"
            placeholderTextColor="#9ca3af"
            value={eventTime}
            onChangeText={setEventTime}
          />

          <Text className="text-sm font-medium text-gray-700 mb-1">{t("eventLocation")}</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-3"
            placeholder={t("eventLocationPlaceholder")}
            placeholderTextColor="#9ca3af"
            value={location}
            onChangeText={setLocation}
          />

          <Text className="text-sm font-medium text-gray-700 mb-1">{t("description")}</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 min-h-[90] mb-3"
            placeholder={t("eventDescriptionPlaceholder")}
            placeholderTextColor="#9ca3af"
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
          />

          <Text className="text-sm font-medium text-gray-700 mb-1">{t("notes")}</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 min-h-[80]"
            placeholder={t("eventNotesPlaceholder")}
            placeholderTextColor="#9ca3af"
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />
        </ScrollView>

        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !canSave}
            className={`rounded-xl py-4 items-center ${canSave ? "bg-primary" : "bg-gray-300"}`}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-lg font-semibold">{t("saveEvent")}</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </>
  );
}
