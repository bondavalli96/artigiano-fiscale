import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { QuoteEditor } from "@/components/QuoteEditor";
import { formatDateShort } from "@/lib/utils/format";
import { QuickShareButtons } from "@/components/QuickShareButtons";
import { useI18n } from "@/lib/i18n";
import type { Quote, QuoteItem, Job, PriceListItem, QuoteTemplate } from "@/types";

export default function QuoteDetailScreen() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { artisan } = useArtisan();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [vatRate, setVatRate] = useState(22);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingPdf, setSendingPdf] = useState(false);
  const [isAIDraft, setIsAIDraft] = useState(false);
  const [converting, setConverting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [templates, setTemplates] = useState<QuoteTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);

  // Load existing quote or fetch job to generate one
  useEffect(() => {
    const load = async () => {
      if (!artisan || !id) return;

      // First, check if a quote already exists for this job
      const { data: existingQuote } = await supabase
        .from("quotes")
        .select("*, client:clients(*), job:jobs(*)")
        .eq("job_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingQuote) {
        setQuote(existingQuote);
        setItems(
          (existingQuote.items || []).map((i: any) => ({
            description: i.description || "",
            quantity: i.quantity ?? i.qty ?? 0,
            unit: i.unit || "ore",
            unit_price: i.unit_price ?? 0,
            total: i.total ?? 0,
          }))
        );
        setVatRate(existingQuote.vat_rate || artisan.default_vat_rate || 22);
        setNotes(existingQuote.notes || "");
        setValidUntil(existingQuote.valid_until || "");
        setJob(existingQuote.job || null);
        setLoading(false);
        return;
      }

      // Otherwise, load the job
      const { data: jobData } = await supabase
        .from("jobs")
        .select("*, client:clients(*)")
        .eq("id", id)
        .single();

      if (jobData) {
        setJob(jobData);
        // Set default valid_until to 30 days from now
        const thirtyDays = new Date();
        thirtyDays.setDate(thirtyDays.getDate() + 30);
        setValidUntil(thirtyDays.toISOString().split("T")[0]);
        if (artisan.default_vat_rate) {
          setVatRate(artisan.default_vat_rate);
        }
      }

      // Fetch available templates
      if (artisan) {
        const { data: tplData } = await supabase
          .from("quote_templates")
          .select("*")
          .eq("artisan_id", artisan.id)
          .order("usage_count", { ascending: false });
        setTemplates(tplData || []);
      }

      setLoading(false);
    };
    load();
  }, [id, artisan]);

  // Apply template to current quote
  const applyTemplate = useCallback(
    async (template: QuoteTemplate) => {
      setItems(template.items);
      setVatRate(template.vat_rate || artisan?.default_vat_rate || 22);
      if (template.notes) setNotes(template.notes);
      setShowTemplates(false);

      // Increment usage count
      await supabase
        .from("quote_templates")
        .update({ usage_count: (template.usage_count || 0) + 1 })
        .eq("id", template.id);

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
    },
    [artisan?.default_vat_rate]
  );

  // Generate AI quote suggestion
  const generateAIQuote = useCallback(async () => {
    if (!job || !artisan) return;

    setGenerating(true);
    try {
      // Fetch artisan's price list
      const { data: priceList } = await supabase
        .from("price_list")
        .select("description, unit, default_price")
        .eq("artisan_id", artisan.id);

      const description = [
        job.title,
        job.description,
        job.transcription,
        job.ai_extracted_data?.tipo_lavoro,
        job.ai_extracted_data?.materiali?.join(", "),
        job.ai_extracted_data?.note,
      ]
        .filter(Boolean)
        .join(". ");

      const { data, error } = await supabase.functions.invoke(
        "suggest-quote",
        {
          body: {
            jobDescription: description,
            priceList: priceList || [],
            artisanTrade: artisan.trade,
          },
        }
      );

      if (error) throw error;
      if (data.items && data.items.length > 0) {
        setItems(data.items);
        setIsAIDraft(true);
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      }
    } catch (err: any) {
      Alert.alert(
        t("error"),
        t("aiGenerationFailed") + ": " + (err.message || "")
      );
    } finally {
      setGenerating(false);
    }
  }, [job, artisan]);

  // Save quote
  const handleSave = useCallback(
    async (andSend = false) => {
      if (!artisan || !job) return;
      if (items.length === 0) {
        Alert.alert(t("error"), t("addAtLeastOneItem"));
        return;
      }

      setSaving(true);
      try {
        const subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const vatAmount = subtotal * (vatRate / 100);
        const total = subtotal + vatAmount;

        if (quote) {
          // Update existing quote
          const { error } = await supabase
            .from("quotes")
            .update({
              items,
              subtotal,
              vat_rate: vatRate,
              vat_amount: vatAmount,
              total,
              notes: notes.trim() || null,
              valid_until: validUntil || null,
              status: andSend ? "sent" : "draft",
            })
            .eq("id", quote.id);
          if (error) throw error;
        } else {
          // Generate quote number
          const { count } = await supabase
            .from("quotes")
            .select("id", { count: "exact", head: true })
            .eq("artisan_id", artisan.id);

          const quoteNumber = `PRV-${new Date().getFullYear()}-${String(
            (count || 0) + 1
          ).padStart(3, "0")}`;

          const { data: newQuote, error } = await supabase
            .from("quotes")
            .insert({
              job_id: job.id,
              artisan_id: artisan.id,
              client_id: job.client_id || null,
              quote_number: quoteNumber,
              status: andSend ? "sent" : "draft",
              items,
              subtotal,
              vat_rate: vatRate,
              vat_amount: vatAmount,
              total,
              notes: notes.trim() || null,
              valid_until: validUntil || null,
            })
            .select()
            .single();

          if (error) throw error;
          setQuote(newQuote);

          // Update job status to quoted
          await supabase
            .from("jobs")
            .update({ status: "quoted" })
            .eq("id", job.id);
        }

        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );

        if (andSend) {
          await handleGenerateAndShare();
        } else {
          Alert.alert(t("saved"), t("quoteSavedAsDraft"));
        }
      } catch (err: any) {
        Alert.alert(t("error"), err.message || t("saveError"));
      } finally {
        setSaving(false);
      }
    },
    [artisan, job, quote, items, vatRate, notes, validUntil]
  );

  // Generate PDF and share
  const handleGenerateAndShare = useCallback(async () => {
    if (!artisan || !job) return;

    setSendingPdf(true);
    try {
      const subtotal = items.reduce((sum, item) => sum + item.total, 0);
      const vatAmount = subtotal * (vatRate / 100);
      const total = subtotal + vatAmount;

      const quoteNumber =
        quote?.quote_number ||
        `PRV-${new Date().getFullYear()}-${Date.now().toString().slice(-3)}`;

      const { data, error } = await supabase.functions.invoke(
        "generate-pdf",
        {
          body: {
            type: "quote",
            number: quoteNumber,
            artisan: {
              business_name: artisan.business_name,
              company_registration_number: artisan.company_registration_number,
              vat_number: artisan.vat_number,
              fiscal_code: artisan.fiscal_code,
              address: artisan.address,
              phone: artisan.phone,
              email: artisan.email,
              website: artisan.website,
              sdi_code: artisan.sdi_code,
              logo_url: artisan.logo_url,
              signature_url: artisan.signature_url,
            },
            client: job.client
              ? {
                  name: job.client.name,
                  address: job.client.address,
                  phone: job.client.phone,
                  email: job.client.email,
                }
              : undefined,
            items,
            subtotal,
            vat_rate: vatRate,
            vat_amount: vatAmount,
            total,
            notes: notes.trim() || undefined,
            valid_until: validUntil || undefined,
            template_key: artisan.invoice_template_key || "classic",
            template_file_url: artisan.invoice_template_file_url || undefined,
            field_visibility: artisan.invoice_field_visibility || undefined,
            payment_methods: artisan.payment_methods || undefined,
            date: formatDateShort(new Date()),
          },
        }
      );

      if (error) throw error;

      // Update pdf_url on quote
      if (quote && data.pdfUrl) {
        await supabase
          .from("quotes")
          .update({ pdf_url: data.pdfUrl, status: "sent" })
          .eq("id", quote.id);
      }

      // Download and share
      if (data.pdfUrl) {
        const fileUri =
          FileSystem.cacheDirectory + `preventivo_${quoteNumber}.html`;
        await FileSystem.downloadAsync(data.pdfUrl, fileUri);

        const canShare = await Sharing.isAvailableAsync();
        if (canShare) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "text/html",
            dialogTitle: `Preventivo ${quoteNumber}`,
          });
        }
      }

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
    } catch (err: any) {
      Alert.alert(t("error"), t("pdfGenerationFailed") + ": " + (err.message || ""));
    } finally {
      setSendingPdf(false);
    }
  }, [artisan, job, quote, items, vatRate, notes, validUntil]);

  // Convert accepted quote to invoice
  const handleConvertToInvoice = useCallback(async () => {
    if (!artisan || !quote) return;

    setConverting(true);
    try {
      // Generate invoice number
      const { count } = await supabase
        .from("invoices_active")
        .select("id", { count: "exact", head: true })
        .eq("artisan_id", artisan.id);

      const invoiceNumber = `FT-${new Date().getFullYear()}-${String(
        (count || 0) + 1
      ).padStart(3, "0")}`;

      // Payment due = 30 days from now
      const paymentDue = new Date();
      paymentDue.setDate(paymentDue.getDate() + 30);

      // Generate invoice PDF
      const { data: pdfData } = await supabase.functions.invoke(
        "generate-pdf",
        {
          body: {
            type: "invoice",
            number: invoiceNumber,
            artisan: {
              business_name: artisan.business_name,
              company_registration_number: artisan.company_registration_number,
              vat_number: artisan.vat_number,
              fiscal_code: artisan.fiscal_code,
              address: artisan.address,
              phone: artisan.phone,
              email: artisan.email,
              website: artisan.website,
              sdi_code: artisan.sdi_code,
              logo_url: artisan.logo_url,
              signature_url: artisan.signature_url,
            },
            client: quote.client
              ? {
                  name: quote.client.name,
                  address: quote.client.address,
                  phone: quote.client.phone,
                  email: quote.client.email,
                }
              : job?.client
              ? {
                  name: job.client.name,
                  address: job.client.address,
                  phone: job.client.phone,
                  email: job.client.email,
                }
              : undefined,
            items: quote.items,
            subtotal: quote.subtotal,
            vat_rate: quote.vat_rate,
            vat_amount: quote.vat_amount,
            total: quote.total,
            payment_due: formatDateShort(paymentDue),
            template_key: artisan.invoice_template_key || "classic",
            template_file_url: artisan.invoice_template_file_url || undefined,
            field_visibility: artisan.invoice_field_visibility || undefined,
            payment_methods: artisan.payment_methods || undefined,
            date: formatDateShort(new Date()),
          },
        }
      );

      const { error } = await supabase.from("invoices_active").insert({
        quote_id: quote.id,
        artisan_id: artisan.id,
        client_id: quote.client_id || null,
        invoice_number: invoiceNumber,
        status: "sent",
        items: quote.items,
        subtotal: quote.subtotal,
        vat_rate: quote.vat_rate,
        vat_amount: quote.vat_amount,
        total: quote.total,
        payment_due: paymentDue.toISOString().split("T")[0],
        pdf_url: pdfData?.pdfUrl || null,
      });

      if (error) throw error;

      // Update job status
      if (job) {
        await supabase
          .from("jobs")
          .update({ status: "invoiced" })
          .eq("id", job.id);
      }

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
      Alert.alert(
        t("invoiceCreated"),
        t("invoiceCreatedMsg", { number: invoiceNumber }),
        [
          {
            text: t("goToInvoices"),
            onPress: () => router.push("/(tabs)/invoices" as any),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("saveError"));
    } finally {
      setConverting(false);
    }
  }, [artisan, quote, job]);

  const handleDuplicateQuote = useCallback(async () => {
    if (!artisan || !quote || !job) return;

    setDuplicating(true);
    try {
      const { count } = await supabase
        .from("quotes")
        .select("id", { count: "exact", head: true })
        .eq("artisan_id", artisan.id);

      const nextNumber = `PRV-${new Date().getFullYear()}-${String(
        (count || 0) + 1
      ).padStart(3, "0")}`;

      const { data: duplicated, error } = await supabase
        .from("quotes")
        .insert({
          job_id: job.id,
          artisan_id: artisan.id,
          client_id: quote.client_id,
          quote_number: nextNumber,
          status: "draft",
          items: quote.items,
          subtotal: quote.subtotal,
          vat_rate: quote.vat_rate,
          vat_amount: quote.vat_amount,
          total: quote.total,
          notes: quote.notes,
          valid_until: quote.valid_until,
        })
        .select("*, client:clients(*), job:jobs(*)")
        .single();

      if (error) throw error;

      setQuote(duplicated);
      setItems(
        (duplicated.items || []).map((i: any) => ({
          description: i.description || "",
          quantity: i.quantity ?? i.qty ?? 0,
          unit: i.unit || "ore",
          unit_price: i.unit_price ?? 0,
          total: i.total ?? 0,
        }))
      );
      setVatRate(duplicated.vat_rate || artisan.default_vat_rate || 22);
      setNotes(duplicated.notes || "");
      setValidUntil(duplicated.valid_until || "");

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("saved"), t("quoteDuplicated"));
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("saveError"));
    } finally {
      setDuplicating(false);
    }
  }, [artisan, quote, job]);

  const handleDeleteQuote = useCallback(() => {
    if (!quote) return;

    Alert.alert(t("delete"), t("deleteQuoteConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          setDeleting(true);
          try {
            const { error } = await supabase.from("quotes").delete().eq("id", quote.id);
            if (error) throw error;

            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
            router.push("/(tabs)/quotes" as any);
          } catch (err: any) {
            Alert.alert(t("error"), err.message || t("saveError"));
          } finally {
            setDeleting(false);
          }
        },
      },
    ]);
  }, [quote, t]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t("quoteTitle") }} />
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </>
    );
  }

  if (!job) {
    return (
      <>
        <Stack.Screen options={{ title: t("quoteTitle") }} />
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="text-muted">{t("jobNotFound")}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: quote ? `Prev. ${quote.quote_number}` : t("newQuoteTitle"),
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1 bg-gray-50"
      >
        {/* Job info header */}
        <View className="bg-white px-4 py-3 border-b border-gray-100">
          <Text className="text-base font-semibold">{job.title}</Text>
          {job.client && (
            <Text className="text-sm text-muted">{job.client.name}</Text>
          )}
        </View>

        {/* AI generate button or editor */}
        {items.length === 0 && !generating && !showTemplates ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-6xl mb-4">🤖</Text>
            <Text className="text-lg font-semibold text-center mb-2">
              {t("generateAIQuote")}
            </Text>
            <Text className="text-sm text-muted text-center mb-6">
              {t("aiQuoteDesc")}
            </Text>
            <TouchableOpacity
              onPress={generateAIQuote}
              className="bg-primary rounded-xl py-4 px-8 w-full items-center"
              activeOpacity={0.8}
            >
              <Text className="text-white text-lg font-semibold">
                {t("generateAIDraft")}
              </Text>
            </TouchableOpacity>
            {templates.length > 0 && (
              <TouchableOpacity
                onPress={() => setShowTemplates(true)}
                className="mt-3 border border-primary rounded-xl py-3.5 px-8 w-full items-center"
                activeOpacity={0.8}
              >
                <Text className="text-primary font-semibold">
                  {t("useTemplate", { count: String(templates.length) })}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() =>
                setItems([
                  {
                    description: "",
                    quantity: 1,
                    unit: "ore",
                    unit_price: 0,
                    total: 0,
                  },
                ])
              }
              className="mt-4"
            >
              <Text className="text-primary text-sm">
                {t("orCreateManually")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : items.length === 0 && !generating && showTemplates ? (
          <View className="flex-1">
            <View className="px-4 py-3 flex-row items-center justify-between">
              <Text className="text-base font-semibold">{t("chooseTemplate")}</Text>
              <TouchableOpacity onPress={() => setShowTemplates(false)}>
                <Text className="text-primary text-sm">{t("back")}</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={templates}
              keyExtractor={(t) => t.id}
              renderItem={({ item: tpl }) => {
                const subtotal = tpl.items.reduce(
                  (sum: number, i: QuoteItem) => sum + i.quantity * i.unit_price,
                  0
                );
                return (
                  <TouchableOpacity
                    onPress={() => applyTemplate(tpl)}
                    className="bg-white mx-4 mb-2 rounded-xl p-4 border border-gray-100"
                    activeOpacity={0.7}
                  >
                    <Text className="text-base font-semibold">{tpl.name}</Text>
                    {tpl.description && (
                      <Text className="text-sm text-muted" numberOfLines={1}>
                        {tpl.description}
                      </Text>
                    )}
                    <Text className="text-xs text-muted mt-1">
                      {t("templateItemsCount", { count: String(tpl.items.length) })} · {t("totalSubtotal")}:{" "}
                      {new Intl.NumberFormat("it-IT", {
                        style: "currency",
                        currency: "EUR",
                      }).format(subtotal)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        ) : generating ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="text-primary font-medium mt-4">
              {t("generatingQuote")}
            </Text>
          </View>
        ) : (
          <View className="flex-1">
            <QuoteEditor
              items={items}
              onItemsChange={setItems}
              vatRate={vatRate}
              onVatRateChange={setVatRate}
              isAIDraft={isAIDraft}
            />

            {/* Notes */}
            <View className="px-4 pb-2">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                {t("notes")}
              </Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white min-h-[60]"
                placeholder={t("additionalNotes")}
                placeholderTextColor="#9ca3af"
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Valid until */}
            <View className="px-4 pb-2">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                {t("validUntil")}
              </Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white"
                placeholder="2026-03-11"
                placeholderTextColor="#9ca3af"
                value={validUntil}
                onChangeText={setValidUntil}
              />
            </View>
          </View>
        )}

        {/* Bottom actions */}
        {items.length > 0 && (
          <View className="bg-white border-t border-gray-100 px-5 py-4">
            {quote?.status === "accepted" ? (
              <>
                <TouchableOpacity
                  onPress={handleConvertToInvoice}
                  disabled={converting}
                  className="bg-success rounded-xl py-4 items-center"
                  activeOpacity={0.8}
                >
                  {converting ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <Text className="text-white text-lg font-semibold">
                      {t("createInvoice")}
                    </Text>
                  )}
                </TouchableOpacity>
                {quote?.pdf_url && (
                  <QuickShareButtons
                    pdfUrl={quote.pdf_url}
                    clientPhone={quote.client?.phone || job?.client?.phone || null}
                    clientEmail={quote.client?.email || job?.client?.email || null}
                    documentType="preventivo"
                    documentNumber={quote.quote_number}
                    total={quote.total}
                    artisanName={artisan?.business_name || ""}
                  />
                )}
              </>
            ) : (
              <>
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => handleSave(false)}
                    disabled={saving}
                    className="flex-1 border border-primary rounded-xl py-3.5 items-center"
                    activeOpacity={0.8}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#2563eb" />
                    ) : (
                      <Text className="text-primary font-semibold">
                        {t("saveDraft")}
                      </Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleSave(true)}
                    disabled={saving || sendingPdf}
                    className="flex-1 bg-primary rounded-xl py-3.5 items-center"
                    activeOpacity={0.8}
                  >
                    {sendingPdf ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <Text className="text-white font-semibold">
                        {t("generatePdfSend")}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                {quote?.pdf_url && (
                  <QuickShareButtons
                    pdfUrl={quote.pdf_url}
                    clientPhone={quote.client?.phone || job?.client?.phone || null}
                    clientEmail={quote.client?.email || job?.client?.email || null}
                    documentType="preventivo"
                    documentNumber={quote.quote_number}
                    total={quote.total}
                    artisanName={artisan?.business_name || ""}
                  />
                )}
              </>
            )}

            {quote && (
              <View className="flex-row gap-2 mt-2">
                <TouchableOpacity
                  onPress={handleDuplicateQuote}
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
                  onPress={handleDeleteQuote}
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
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
}
