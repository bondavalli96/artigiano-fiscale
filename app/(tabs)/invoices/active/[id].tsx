import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { StatusBadge } from "@/components/StatusBadge";
import { formatCurrency, formatDate, formatDateShort } from "@/lib/utils/format";
import { QuickShareButtons } from "@/components/QuickShareButtons";
import { useI18n } from "@/lib/i18n";
import { recalculateClientReliability } from "@/lib/utils/reliability";
import type { InvoiceActive, QuoteItem } from "@/types";

export default function InvoiceActiveDetailScreen() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { artisan } = useArtisan();

  const TIMELINE_STEPS = [
    { key: "draft", label: t("invoiceDraft"), icon: "📝" },
    { key: "sent", label: t("invoiceSent"), icon: "📤" },
    { key: "paid", label: t("invoicePaid"), icon: "✅" },
  ];
  const [invoice, setInvoice] = useState<InvoiceActive | null>(null);
  const [loading, setLoading] = useState(true);
  const [markingPaid, setMarkingPaid] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchInvoice = useCallback(async () => {
    const { data } = await supabase
      .from("invoices_active")
      .select("*, client:clients(*)")
      .eq("id", id)
      .single();
    setInvoice(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const handleMarkPaid = async () => {
    if (!invoice) return;

    Alert.alert(
      t("confirmPayment"),
      t("confirmPaymentMsg"),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("confirm"),
          onPress: async () => {
            setMarkingPaid(true);
            try {
              const { error } = await supabase
                .from("invoices_active")
                .update({
                  status: "paid",
                  paid_at: new Date().toISOString(),
                })
                .eq("id", invoice.id);

              if (error) throw error;
              // Recalculate client reliability based on payment history
              if (invoice.client_id) {
                await recalculateClientReliability(invoice.client_id);
              }
              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              fetchInvoice();
            } catch (err: any) {
              Alert.alert(t("error"), err.message);
            } finally {
              setMarkingPaid(false);
            }
          },
        },
      ]
    );
  };

  const handleSharePdf = async () => {
    if (!invoice?.pdf_url) {
      Alert.alert(t("error"), t("noPdfAvailable"));
      return;
    }

    setSharing(true);
    try {
      const fileUri =
        FileSystem.cacheDirectory +
        `fattura_${invoice.invoice_number}.html`;
      await FileSystem.downloadAsync(invoice.pdf_url, fileUri);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/html",
          dialogTitle: `Fattura ${invoice.invoice_number}`,
        });
      }
    } catch (err: any) {
      Alert.alert(t("error"), err.message);
    } finally {
      setSharing(false);
    }
  };

  const handleSendReminder = async () => {
    if (!invoice || !artisan) return;

    Alert.alert(
      t("sendReminderTitle"),
      t("sendReminderMsg", { number: invoice.invoice_number }),
      [
        { text: t("cancel"), style: "cancel" },
        {
          text: t("send"),
          onPress: async () => {
            try {
              await supabase
                .from("invoices_active")
                .update({
                  reminders_sent: (invoice.reminders_sent || 0) + 1,
                  last_reminder_at: new Date().toISOString(),
                })
                .eq("id", invoice.id);

              await Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Success
              );
              Alert.alert(t("reminderSent"), t("reminderRecorded"));
              fetchInvoice();
            } catch (err: any) {
              Alert.alert(t("error"), err.message);
            }
          },
        },
      ]
    );
  };

  const handleDuplicate = async () => {
    if (!invoice || !artisan) return;

    setDuplicating(true);
    try {
      const { count } = await supabase
        .from("invoices_active")
        .select("id", { count: "exact", head: true })
        .eq("artisan_id", artisan.id);

      const newNumber = `FT-${new Date().getFullYear()}-${String(
        (count || 0) + 1
      ).padStart(3, "0")}`;

      const { data: duplicated, error } = await supabase
        .from("invoices_active")
        .insert({
          quote_id: invoice.quote_id,
          artisan_id: invoice.artisan_id,
          client_id: invoice.client_id,
          invoice_number: newNumber,
          status: "draft",
          items: invoice.items,
          subtotal: invoice.subtotal,
          vat_rate: invoice.vat_rate,
          vat_amount: invoice.vat_amount,
          total: invoice.total,
          payment_due: invoice.payment_due,
          pdf_url: invoice.pdf_url,
        })
        .select("*, client:clients(*)")
        .single();

      if (error) throw error;

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setInvoice(duplicated);
      Alert.alert(t("saved"), t("invoiceDuplicated"));
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("saveError"));
    } finally {
      setDuplicating(false);
    }
  };

  const handleDelete = () => {
    if (!invoice) return;

    Alert.alert(t("delete"), t("deleteInvoiceConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            const { error } = await supabase
              .from("invoices_active")
              .delete()
              .eq("id", invoice.id);
            if (error) throw error;

            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
            router.replace("/(tabs)/invoices" as any);
          } catch (err: any) {
            Alert.alert(t("error"), err.message || t("saveError"));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const getTimelineIndex = () => {
    if (!invoice) return -1;
    if (invoice.status === "paid") return 2;
    if (invoice.status === "sent" || invoice.status === "overdue") return 1;
    return 0;
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t("invoiceTitle") }} />
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </>
    );
  }

  if (!invoice) {
    return (
      <>
        <Stack.Screen options={{ title: t("invoiceTitle") }} />
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="text-muted">{t("invoiceNotFound")}</Text>
        </View>
      </>
    );
  }

  const timelineIdx = getTimelineIndex();

  return (
    <>
      <Stack.Screen options={{ title: invoice.invoice_number }} />
      <ScrollView
        className="flex-1 bg-white"
        contentContainerStyle={{ padding: 20, paddingBottom: 140 }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between mb-4">
          <View>
            <Text className="text-2xl font-bold">{invoice.invoice_number}</Text>
            <Text className="text-sm text-muted">
              {formatDate(invoice.created_at)}
            </Text>
          </View>
          <StatusBadge status={invoice.status} />
        </View>

        {/* Timeline */}
        <View className="bg-gray-50 rounded-xl p-4 mb-4">
          <Text className="text-xs font-semibold text-muted mb-3">
            {t("invoiceStatus")}
          </Text>
          <View className="flex-row items-center justify-between">
            {TIMELINE_STEPS.map((step, i) => (
              <View key={step.key} className="items-center flex-1">
                <View
                  className={`w-10 h-10 rounded-full items-center justify-center mb-1 ${
                    i <= timelineIdx ? "bg-primary" : "bg-gray-200"
                  }`}
                >
                  <Text className="text-lg">{step.icon}</Text>
                </View>
                <Text
                  className={`text-xs ${
                    i <= timelineIdx ? "text-primary font-semibold" : "text-muted"
                  }`}
                >
                  {step.label}
                </Text>
                {i < TIMELINE_STEPS.length - 1 && (
                  <View
                    className={`absolute top-5 left-[60%] w-full h-0.5 ${
                      i < timelineIdx ? "bg-primary" : "bg-gray-200"
                    }`}
                  />
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Client info */}
        {invoice.client && (
          <View className="bg-gray-50 rounded-xl p-3 mb-4">
            <Text className="text-xs text-muted">{t("client")}</Text>
            <Text className="text-base font-medium">
              {invoice.client.name}
            </Text>
            {invoice.client.phone && (
              <Text className="text-sm text-muted">
                {invoice.client.phone}
              </Text>
            )}
          </View>
        )}

        {/* Items */}
        <Text className="text-sm font-semibold text-gray-700 mb-2">
          {t("invoiceItems")}
        </Text>
        {invoice.items.map((item: QuoteItem, index: number) => (
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
            <Text className="text-sm">{formatCurrency(invoice.subtotal)}</Text>
          </View>
          <View className="flex-row justify-between mb-1">
            <Text className="text-sm text-muted">
              {t("vatRate", { rate: String(invoice.vat_rate) })}
            </Text>
            <Text className="text-sm">
              {formatCurrency(invoice.vat_amount)}
            </Text>
          </View>
          <View className="flex-row justify-between mt-2 pt-2 border-t border-gray-200">
            <Text className="text-xl font-bold">{t("total")}</Text>
            <Text className="text-xl font-bold text-primary">
              {formatCurrency(invoice.total)}
            </Text>
          </View>
        </View>

        {/* Payment info */}
        {invoice.payment_due && (
          <View className="mt-4 bg-yellow-50 rounded-xl p-3">
            <Text className="text-sm">
              <Text className="font-medium">{t("paymentDue")} </Text>
              {formatDate(invoice.payment_due)}
            </Text>
          </View>
        )}

        {invoice.paid_at && (
          <View className="mt-2 bg-green-50 rounded-xl p-3">
            <Text className="text-sm text-green-700">
              <Text className="font-medium">{t("paidOn")} </Text>
              {formatDate(invoice.paid_at)}
            </Text>
          </View>
        )}

        {/* Reminder info */}
        {invoice.reminders_sent > 0 && (
          <Text className="text-xs text-muted mt-3">
            {t("remindersSentCount", { count: String(invoice.reminders_sent) })}
            {invoice.last_reminder_at &&
              ` (${t("lastReminderDate", { date: formatDateShort(invoice.last_reminder_at) })})`}
          </Text>
        )}
      </ScrollView>

      {/* Bottom actions */}
      <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
        {invoice.status !== "paid" && (
          <View className="flex-row gap-3 mb-2">
            <TouchableOpacity
              onPress={handleMarkPaid}
              disabled={markingPaid}
              className="flex-1 bg-success rounded-xl py-3.5 items-center"
              activeOpacity={0.8}
            >
              {markingPaid ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-semibold">
                  {t("markPaid")}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSendReminder}
              className="flex-1 bg-warning rounded-xl py-3.5 items-center"
              activeOpacity={0.8}
            >
              <Text className="text-white font-semibold">{t("sendReminder")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {invoice.pdf_url && (
          <>
            <TouchableOpacity
              onPress={handleSharePdf}
              disabled={sharing}
              className="border border-primary rounded-xl py-3 items-center"
              activeOpacity={0.8}
            >
              {sharing ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : (
                <Text className="text-primary font-semibold">
                  {t("sharePdf")}
                </Text>
              )}
            </TouchableOpacity>
            <QuickShareButtons
              pdfUrl={invoice.pdf_url}
              clientPhone={invoice.client?.phone || null}
              clientEmail={invoice.client?.email || null}
              documentType="fattura"
              documentNumber={invoice.invoice_number}
              total={invoice.total}
              artisanName={artisan?.business_name || ""}
            />
          </>
        )}

        <View className="flex-row gap-2 mt-2">
          <TouchableOpacity
            onPress={handleDuplicate}
            disabled={duplicating}
            className="flex-1 border border-gray-300 rounded-xl py-2.5 items-center"
            activeOpacity={0.8}
          >
            {duplicating ? (
              <ActivityIndicator size="small" color="#6b7280" />
            ) : (
              <Text className="text-gray-700 font-medium">{t("duplicate")}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleDelete}
            disabled={deleting}
            className="flex-1 border border-red-300 rounded-xl py-2.5 items-center"
            activeOpacity={0.8}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <Text className="text-danger font-medium">{t("delete")}</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}
