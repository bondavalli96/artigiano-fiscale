import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { formatCurrency, formatDateShort } from "@/lib/utils/format";
import { EmptyState } from "@/components/EmptyState";
import { useI18n } from "@/lib/i18n";
import type { InvoiceActive, Client } from "@/types";

interface ClientGroup {
  client: Client;
  invoices: InvoiceActive[];
  totalOwed: number;
  maxDaysOverdue: number;
}

export default function RemindersScreen() {
  const { t } = useI18n();
  const { artisan } = useArtisan();
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sending, setSending] = useState(false);

  const fetchUnpaid = useCallback(async () => {
    if (!artisan) return;

    try {
      const { data } = await supabase
        .from("invoices_active")
        .select("*, client:clients(*)")
        .eq("artisan_id", artisan.id)
        .in("status", ["sent", "overdue"])
        .is("paid_at", null)
        .order("payment_due", { ascending: true });

      if (!data) {
        setGroups([]);
        return;
      }

      // Group by client
      const map = new Map<string, ClientGroup>();
      for (const inv of data) {
        if (!inv.client) continue;
        const clientId = inv.client.id;

        const daysOverdue = inv.payment_due
          ? Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(inv.payment_due).getTime()) /
                  (1000 * 60 * 60 * 24)
              )
            )
          : 0;

        if (map.has(clientId)) {
          const group = map.get(clientId)!;
          group.invoices.push(inv);
          group.totalOwed += inv.total || 0;
          group.maxDaysOverdue = Math.max(group.maxDaysOverdue, daysOverdue);
        } else {
          map.set(clientId, {
            client: inv.client,
            invoices: [inv],
            totalOwed: inv.total || 0,
            maxDaysOverdue: daysOverdue,
          });
        }
      }

      setGroups(Array.from(map.values()).sort((a, b) => b.maxDaysOverdue - a.maxDaysOverdue));
    } catch (err) {
      console.error("Fetch unpaid error:", err);
    } finally {
      setLoading(false);
    }
  }, [artisan]);

  useEffect(() => {
    fetchUnpaid();
  }, [fetchUnpaid]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUnpaid();
    setRefreshing(false);
  }, [fetchUnpaid]);

  const toggleSelection = (clientId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) {
        next.delete(clientId);
      } else {
        next.add(clientId);
      }
      return next;
    });
  };

  const toggleAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selected.size === groups.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(groups.map((g) => g.client.id)));
    }
  };

  const getSelectedGroups = () => groups.filter((g) => selected.has(g.client.id));

  const buildReminderMessage = (group: ClientGroup) => {
    const invoiceList = group.invoices
      .map(
        (inv) =>
          t("invoiceListItem", {
            number: inv.invoice_number,
            amount: formatCurrency(inv.total),
            dueInfo: inv.payment_due ? ` (${t("dueInfo", { date: formatDateShort(inv.payment_due) })})` : ""
          })
      )
      .join("\n");

    return t("reminderMsg", {
      name: group.client.name,
      invoiceList,
      total: formatCurrency(group.totalOwed),
      businessName: artisan?.business_name || ""
    });
  };

  const handleSendWhatsApp = async () => {
    const selectedGroups = getSelectedGroups();
    const withPhone = selectedGroups.filter((g) => g.client.phone);

    if (withPhone.length === 0) {
      Alert.alert(
        t("noPhone"),
        t("noPhoneMsg")
      );
      return;
    }

    setSending(true);
    try {
      for (const group of withPhone) {
        const phone = group.client
          .phone!.replace(/\s+/g, "")
          .replace(/^0/, "+39");
        const normalizedPhone = phone.startsWith("+") ? phone : `+39${phone}`;
        const message = encodeURIComponent(buildReminderMessage(group));
        const url = `whatsapp://send?phone=${normalizedPhone}&text=${message}`;

        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
          // Small delay between openURL calls
          await new Promise((r) => setTimeout(r, 500));
        }

        // Update reminders_sent for each invoice
        for (const inv of group.invoices) {
          await supabase
            .from("invoices_active")
            .update({
              reminders_sent: (inv.reminders_sent || 0) + 1,
              last_reminder_at: new Date().toISOString(),
              status: "overdue",
            })
            .eq("id", inv.id);
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(
        t("remindersSentTitle"),
        t("whatsappOpened", {
          count: String(withPhone.length),
          suffix: withPhone.length === 1 ? t("clientSuffixOne") : t("clientSuffixMany")
        })
      );
      setSelected(new Set());
      fetchUnpaid();
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("sendFailed"));
    } finally {
      setSending(false);
    }
  };

  const handleSendEmail = async () => {
    const selectedGroups = getSelectedGroups();
    const invoiceIds = selectedGroups.flatMap((g) =>
      g.invoices.map((inv) => inv.id)
    );

    if (invoiceIds.length === 0) return;

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-reminder", {
        body: {
          artisanId: artisan?.id,
          invoiceIds,
        },
      });

      if (error) throw error;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const processed = data?.processed || 0;
      const emailsSent = data?.results?.filter((r: any) => r.emailSent).length || 0;

      Alert.alert(
        t("remindersSentTitle"),
        `${processed} ${processed === 1 ? t("invoiceSuffixOne") : t("invoiceSuffixMany")}, ${emailsSent} email ${emailsSent === 1 ? "inviata" : "inviate"}`
      );
      setSelected(new Set());
      fetchUnpaid();
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("sendFailed"));
    } finally {
      setSending(false);
    }
  };

  const handleSendReminders = () => {
    const count = selected.size;
    if (count === 0) return;

    Alert.alert(
      t("sendRemindersCount", { count: String(count) }),
      t("howToSend"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("whatsapp"),
          onPress: handleSendWhatsApp,
        },
        {
          text: t("emailLabel"),
          onPress: handleSendEmail,
        },
      ]
    );
  };

  const renderClientRow = ({ item }: { item: ClientGroup }) => {
    const isSelected = selected.has(item.client.id);

    return (
      <TouchableOpacity
        onPress={() => toggleSelection(item.client.id)}
        className={`mx-4 mb-2 rounded-xl p-4 border ${
          isSelected
            ? "bg-blue-50 border-primary"
            : "bg-white border-gray-100"
        }`}
        activeOpacity={0.7}
      >
        <View className="flex-row items-center">
          {/* Checkbox */}
          <View
            className={`w-6 h-6 rounded-md border-2 items-center justify-center mr-3 ${
              isSelected ? "bg-primary border-primary" : "border-gray-300"
            }`}
          >
            {isSelected && (
              <MaterialCommunityIcons name="check" size={16} color="white" />
            )}
          </View>

          {/* Client info */}
          <View className="flex-1">
            <Text className="text-base font-semibold">{item.client.name}</Text>
            <View className="flex-row items-center mt-1">
              <Text className="text-sm text-muted">
                {t("invoicesSuffix", {
                  count: String(item.invoices.length),
                  suffix: item.invoices.length === 1 ? t("invoiceSuffixOne") : t("invoiceSuffixMany")
                })}
              </Text>
              {item.maxDaysOverdue > 0 && (
                <View className="bg-red-100 rounded-full px-2 py-0.5 ml-2">
                  <Text className="text-xs text-red-700 font-medium">
                    {t("daysLateShort", { days: String(item.maxDaysOverdue) })}
                  </Text>
                </View>
              )}
            </View>
            {/* Contact info icons */}
            <View className="flex-row items-center mt-1">
              {item.client.phone && (
                <View className="flex-row items-center mr-3">
                  <MaterialCommunityIcons
                    name="whatsapp"
                    size={14}
                    color="#16a34a"
                  />
                  <Text className="text-xs text-muted ml-1">
                    {item.client.phone}
                  </Text>
                </View>
              )}
              {item.client.email && (
                <View className="flex-row items-center">
                  <MaterialCommunityIcons
                    name="email-outline"
                    size={14}
                    color="#2563eb"
                  />
                  <Text className="text-xs text-muted ml-1" numberOfLines={1}>
                    {item.client.email}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Total */}
          <Text className="text-lg font-bold text-danger">
            {formatCurrency(item.totalOwed)}
          </Text>
        </View>

        {/* Invoice details */}
        {item.invoices.length > 0 && (
          <View className="mt-2 pt-2 border-t border-gray-100">
            {item.invoices.map((inv) => (
              <View
                key={inv.id}
                className="flex-row justify-between items-center py-1"
              >
                <Text className="text-xs text-muted">{inv.invoice_number}</Text>
                <Text className="text-xs text-muted">
                  {formatCurrency(inv.total)}
                </Text>
                <Text className="text-xs text-muted">
                  {inv.payment_due
                    ? t("dueDate", { date: formatDateShort(inv.payment_due) })
                    : ""}
                </Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t("remindersTitle") }} />
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t("paymentReminders") }} />
      <View className="flex-1 bg-gray-50">
        {groups.length === 0 ? (
          <EmptyState
            icon="check-circle"
            title={t("noReminders")}
            description={t("allClientsUpToDate")}
          />
        ) : (
          <>
            {/* Header with select all */}
            <View className="px-4 py-3 flex-row items-center justify-between">
              <Text className="text-sm text-muted">
                {t("clientsWithPending", {
                  count: String(groups.length),
                  suffix: groups.length === 1 ? t("clientSuffixOne") : t("clientSuffixMany")
                })}
              </Text>
              <TouchableOpacity onPress={toggleAll}>
                <Text className="text-sm text-primary font-semibold">
                  {selected.size === groups.length
                    ? t("deselectAll")
                    : t("selectAll")}
                </Text>
              </TouchableOpacity>
            </View>

            <FlatList
              data={groups}
              keyExtractor={(item) => item.client.id}
              renderItem={renderClientRow}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
              contentContainerStyle={{ paddingBottom: 100 }}
            />

            {/* Bottom action bar */}
            {selected.size > 0 && (
              <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
                <TouchableOpacity
                  onPress={handleSendReminders}
                  disabled={sending}
                  className="bg-warning rounded-xl py-4 items-center"
                  activeOpacity={0.8}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons
                        name="send"
                        size={20}
                        color="white"
                      />
                      <Text className="text-white text-lg font-semibold ml-2">
                        {t("sendRemindersCount", { count: String(selected.size) })}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    </>
  );
}
