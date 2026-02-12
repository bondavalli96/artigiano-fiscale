import { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate } from "@/lib/utils/format";
import { useI18n } from "@/lib/i18n";
import type { Job } from "@/types";

export default function JobDetailScreen() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchJob = async () => {
      const { data } = await supabase
        .from("jobs")
        .select("*, client:clients(*)")
        .eq("id", id)
        .single();
      setJob(data);
      setLoading(false);
    };
    fetchJob();
  }, [id]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t("jobDetail") }} />
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </>
    );
  }

  if (!job) {
    return (
      <>
        <Stack.Screen options={{ title: t("jobDetail") }} />
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="text-muted">{t("jobNotFound")}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: job.title }} />
      <ScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
      >
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold flex-1">{job.title}</Text>
          <StatusBadge status={job.status} />
        </View>

        {job.client && (
          <View className="bg-gray-50 rounded-xl p-3 mb-4">
            <Text className="text-xs text-muted">{t("client")}</Text>
            <Text className="text-base font-medium">{job.client.name}</Text>
            {job.client.phone && (
              <Text className="text-sm text-muted">{job.client.phone}</Text>
            )}
          </View>
        )}

        <Text className="text-xs text-muted mb-4">
          {t("createdOn", { date: formatDate(job.created_at) })}
        </Text>

        {job.description && (
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-1">
              {t("description")}
            </Text>
            <Text className="text-base text-gray-600">{job.description}</Text>
          </View>
        )}

        {job.transcription && (
          <View className="mb-4 bg-blue-50 rounded-xl p-3">
            <Text className="text-sm font-semibold text-primary mb-1">
              🎤 {t("voiceTranscription")}
            </Text>
            <Text className="text-sm text-gray-700">{job.transcription}</Text>
          </View>
        )}

        {/* Photos carousel */}
        {job.photos && job.photos.length > 0 && (
          <View className="mb-4">
            <Text className="text-sm font-semibold text-gray-700 mb-2">
              {t("photos", { count: String(job.photos.length) })}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {job.photos.map((url, index) => (
                <Image
                  key={index}
                  source={{ uri: url }}
                  className="w-48 h-36 rounded-xl mr-3"
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* AI extracted data */}
        {job.ai_extracted_data && (
          <View className="bg-blue-50 rounded-xl p-4 mb-4">
            <Text className="text-sm font-semibold text-primary mb-2">
              🤖 {t("aiExtractedData")}
            </Text>
            {job.ai_extracted_data.tipo_lavoro && (
              <Text className="text-sm mb-1">
                <Text className="font-medium">{t("type")}: </Text>
                {job.ai_extracted_data.tipo_lavoro}
              </Text>
            )}
            {Array.isArray(job.ai_extracted_data.materiali) &&
              job.ai_extracted_data.materiali.length > 0 && (
                <Text className="text-sm mb-1">
                  <Text className="font-medium">{t("materials")}: </Text>
                  {job.ai_extracted_data.materiali.join(", ")}
                </Text>
              )}
            {job.ai_extracted_data.urgenza && (
              <Text className="text-sm mb-1">
                <Text className="font-medium">{t("urgency")}: </Text>
                {job.ai_extracted_data.urgenza}
              </Text>
            )}
            {job.ai_extracted_data.note && (
              <Text className="text-sm">
                <Text className="font-medium">{t("notes")}: </Text>
                {job.ai_extracted_data.note}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* Bottom action */}
      {(job.status === "draft" || job.status === "quoted") && (
        <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
          <TouchableOpacity
            onPress={() =>
              router.push(`/(tabs)/quotes/${job.id}` as any)
            }
            className="bg-primary rounded-xl py-4 items-center"
            activeOpacity={0.8}
          >
            <Text className="text-white text-lg font-semibold">
              {t("createQuote")}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );
}
