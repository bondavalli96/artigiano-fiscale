import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  SectionList,
  RefreshControl,
  Alert,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { useI18n } from "@/lib/i18n";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { AgendaEvent, Job } from "@/types";

function getDateRange() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const endOfWeek = new Date(today);
  const daysUntilSunday = 7 - today.getDay();
  endOfWeek.setDate(endOfWeek.getDate() + daysUntilSunday);

  return {
    today: today.toISOString().split("T")[0],
    tomorrow: tomorrow.toISOString().split("T")[0],
    endOfWeek: endOfWeek.toISOString().split("T")[0],
  };
}

function formatWeekday(dateStr: string, locale: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const days =
    locale === "it"
      ? ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"]
      : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const day = date.getDate();
  const month = date.getMonth() + 1;
  return `${days[date.getDay()]} ${day}/${month}`;
}

interface JobWithClient extends Job {
  itemType: "job";
}

interface EventWithClient extends AgendaEvent {
  itemType: "event";
}

type AgendaListItem = JobWithClient | EventWithClient;

function sortAgendaItems(items: AgendaListItem[]) {
  return [...items].sort((a, b) => {
    const aTime = a.itemType === "event" ? a.event_time || "99:99" : "99:99";
    const bTime = b.itemType === "event" ? b.event_time || "99:99" : "99:99";
    return aTime.localeCompare(bTime);
  });
}

export default function AgendaScreen() {
  const { t, locale } = useI18n();
  const { artisan } = useArtisan();
  const [jobs, setJobs] = useState<JobWithClient[]>([]);
  const [events, setEvents] = useState<EventWithClient[]>([]);
  const [unscheduled, setUnscheduled] = useState<JobWithClient[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const dates = useMemo(() => getDateRange(), []);

  const fetchAgenda = useCallback(async () => {
    if (!artisan) return;

    const [{ data: scheduledJobs }, { data: noDateJobs }, { data: agendaEvents }] =
      await Promise.all([
        supabase
          .from("jobs")
          .select("*, client:clients(*)")
          .eq("artisan_id", artisan.id)
          .gte("scheduled_date", dates.today)
          .lte("scheduled_date", dates.endOfWeek)
          .order("scheduled_date", { ascending: true }),
        supabase
          .from("jobs")
          .select("*, client:clients(*)")
          .eq("artisan_id", artisan.id)
          .is("scheduled_date", null)
          .in("status", ["draft", "quoted", "accepted"])
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("agenda_events")
          .select("*, client:clients(*)")
          .eq("artisan_id", artisan.id)
          .gte("event_date", dates.today)
          .lte("event_date", dates.endOfWeek)
          .order("event_date", { ascending: true })
          .order("event_time", { ascending: true }),
      ]);

    setJobs((scheduledJobs || []).map((item) => ({ ...item, itemType: "job" })));
    setUnscheduled((noDateJobs || []).map((item) => ({ ...item, itemType: "job" })));
    setEvents((agendaEvents || []).map((item) => ({ ...item, itemType: "event" })));
    setLoading(false);
  }, [artisan, dates]);

  useEffect(() => {
    fetchAgenda();
  }, [fetchAgenda]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAgenda();
    setRefreshing(false);
  }, [fetchAgenda]);

  const assignDate = async (jobId: string, date: string) => {
    await supabase.from("jobs").update({ scheduled_date: date }).eq("id", jobId);
    await fetchAgenda();
  };

  const showDatePicker = (job: Job) => {
    Alert.alert(t("agendaAssignDate"), job.title, [
      {
        text: t("agendaToday"),
        onPress: () => assignDate(job.id, dates.today),
      },
      {
        text: t("agendaTomorrow"),
        onPress: () => assignDate(job.id, dates.tomorrow),
      },
      { text: t("cancel"), style: "cancel" },
    ]);
  };

  const buildEventShareMessage = (event: EventWithClient) => {
    const chunks = [
      `${t("eventTitle")}: ${event.title}`,
      `${t("eventDate")}: ${event.event_date}`,
    ];

    if (event.event_time) chunks.push(`${t("eventTime")}: ${event.event_time}`);
    if (event.location) chunks.push(`${t("eventLocation")}: ${event.location}`);
    if (event.description) chunks.push(`${t("description")}: ${event.description}`);

    return chunks.join("\n");
  };

  const shareEvent = (event: EventWithClient) => {
    const message = buildEventShareMessage(event);

    Alert.alert(t("shareAppointment"), event.title, [
      {
        text: "WhatsApp",
        onPress: async () => {
          const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
          const canOpen = await Linking.canOpenURL(url);
          if (canOpen) {
            await Linking.openURL(url);
          } else {
            Alert.alert(t("whatsappNotAvailable"), t("whatsappNotInstalled"));
          }
        },
      },
      {
        text: "Email",
        onPress: async () => {
          const subject = encodeURIComponent(`${t("shareAppointment")} - ${event.title}`);
          const body = encodeURIComponent(message);
          await Linking.openURL(`mailto:?subject=${subject}&body=${body}`);
        },
      },
      { text: t("cancel"), style: "cancel" },
    ]);
  };

  const sections = useMemo(() => {
    const todayItems = sortAgendaItems([
      ...jobs.filter((j) => j.scheduled_date === dates.today),
      ...events.filter((e) => e.event_date === dates.today),
    ]);

    const tomorrowItems = sortAgendaItems([
      ...jobs.filter((j) => j.scheduled_date === dates.tomorrow),
      ...events.filter((e) => e.event_date === dates.tomorrow),
    ]);

    const weekItems = sortAgendaItems([
      ...jobs.filter(
        (j) =>
          j.scheduled_date &&
          j.scheduled_date > dates.tomorrow &&
          j.scheduled_date <= dates.endOfWeek
      ),
      ...events.filter(
        (e) => e.event_date > dates.tomorrow && e.event_date <= dates.endOfWeek
      ),
    ]);

    const result: { title: string; data: AgendaListItem[] }[] = [];
    if (todayItems.length > 0) result.push({ title: t("agendaToday"), data: todayItems });
    if (tomorrowItems.length > 0)
      result.push({ title: t("agendaTomorrow"), data: tomorrowItems });
    if (weekItems.length > 0) result.push({ title: t("agendaThisWeek"), data: weekItems });
    if (unscheduled.length > 0)
      result.push({ title: t("agendaUnscheduled"), data: unscheduled });

    return result;
  }, [jobs, events, unscheduled, dates, t]);

  const todayFormatted = useMemo(() => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      day: "numeric",
      month: "long",
    };
    return now.toLocaleDateString(locale === "it" ? "it-IT" : "en-US", options);
  }, [locale]);

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-muted">{t("loading")}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-5 pt-4 pb-3 border-b border-gray-100">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-gray-900 capitalize">{todayFormatted}</Text>
            <Text className="text-sm text-muted mt-1">
              {jobs.length + events.length} {t("agendaScheduledJobs")}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => router.push("/(tabs)/agenda-event-new" as any)}
            className="bg-primary rounded-lg px-3 py-2"
            activeOpacity={0.8}
          >
            <Text className="text-white text-sm font-semibold">{t("newAgendaEvent")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {sections.length === 0 ? (
        <EmptyState
          icon="calendar-blank"
          title={t("agendaEmpty")}
          description={t("agendaEmptyDesc")}
          actionLabel={t("newAgendaEvent")}
          onAction={() => router.push("/(tabs)/agenda-event-new" as any)}
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => `${item.itemType}-${item.id}`}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text className="text-sm font-bold text-gray-500 uppercase px-5 pt-4 pb-2">
              {section.title}
            </Text>
          )}
          renderItem={({ item, section }) => {
            const isUnscheduled = section.title === t("agendaUnscheduled");

            if (item.itemType === "event") {
              return (
                <View className="bg-white mx-4 mb-2 rounded-xl p-4 border border-gray-100">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-base font-semibold flex-1 mr-2" numberOfLines={1}>
                      {item.title}
                    </Text>
                    <TouchableOpacity
                      onPress={() => shareEvent(item)}
                      className="bg-green-50 rounded-lg px-2 py-1"
                    >
                      <MaterialCommunityIcons name="share-variant" size={16} color="#16a34a" />
                    </TouchableOpacity>
                  </View>

                  <View className="flex-row items-center mb-1">
                    <MaterialCommunityIcons name="clock-outline" size={14} color="#6b7280" />
                    <Text className="text-xs text-muted ml-1">
                      {item.event_time || "--:--"} · {formatWeekday(item.event_date, locale)}
                    </Text>
                  </View>

                  {item.location && (
                    <View className="flex-row items-center mb-1">
                      <MaterialCommunityIcons name="map-marker-outline" size={14} color="#6b7280" />
                      <Text className="text-xs text-muted ml-1" numberOfLines={1}>
                        {item.location}
                      </Text>
                    </View>
                  )}

                  {item.description && (
                    <Text className="text-sm text-gray-600 mt-1" numberOfLines={2}>
                      {item.description}
                    </Text>
                  )}
                </View>
              );
            }

            return (
              <TouchableOpacity
                onPress={() => router.push(`/(tabs)/jobs/${item.id}` as any)}
                className="bg-white mx-4 mb-2 rounded-xl p-4"
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Text className="text-base font-semibold flex-1 mr-2" numberOfLines={1}>
                    {item.title}
                  </Text>
                  <StatusBadge status={item.status} />
                </View>

                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    {item.client && (
                      <View className="flex-row items-center mr-3">
                        <MaterialCommunityIcons name="account" size={14} color="#9ca3af" />
                        <Text className="text-sm text-muted ml-1">{item.client.name}</Text>
                      </View>
                    )}
                    {!isUnscheduled && item.scheduled_date && (
                      <Text className="text-xs text-gray-400">
                        {formatWeekday(item.scheduled_date, locale)}
                      </Text>
                    )}
                  </View>

                  {item.status === "invoiced" && (
                    <MaterialCommunityIcons name="currency-eur" size={16} color="#f59e0b" />
                  )}
                  {item.status === "completed" && (
                    <MaterialCommunityIcons name="check-circle" size={16} color="#22c55e" />
                  )}

                  {isUnscheduled && (
                    <TouchableOpacity
                      onPress={() => showDatePicker(item)}
                      className="bg-primary/10 rounded-lg px-2 py-1 ml-2"
                    >
                      <Text className="text-xs text-primary font-medium">{t("agendaSchedule")}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}
