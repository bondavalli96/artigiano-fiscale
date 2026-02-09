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
} from "react-native";
import { Stack, useLocalSearchParams, router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { QuoteEditor } from "@/components/QuoteEditor";
import { formatDateShort } from "@/lib/utils/format";
import type { Quote, QuoteItem, Job, PriceListItem } from "@/types";

export default function QuoteDetailScreen() {
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
        setItems(existingQuote.items || []);
        setVatRate(existingQuote.vat_rate || 22);
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
      }

      setLoading(false);
    };
    load();
  }, [id, artisan]);

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
        "Errore",
        "Generazione AI fallita: " + (err.message || "")
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
        Alert.alert("Errore", "Aggiungi almeno una voce al preventivo");
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
          Alert.alert("Salvato", "Preventivo salvato come bozza");
        }
      } catch (err: any) {
        Alert.alert("Errore", err.message || "Errore durante il salvataggio");
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
              vat_number: artisan.vat_number,
              fiscal_code: artisan.fiscal_code,
              address: artisan.address,
              phone: artisan.phone,
              email: artisan.email,
              sdi_code: artisan.sdi_code,
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
      Alert.alert("Errore", "Generazione PDF fallita: " + (err.message || ""));
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
              vat_number: artisan.vat_number,
              fiscal_code: artisan.fiscal_code,
              address: artisan.address,
              phone: artisan.phone,
              email: artisan.email,
              sdi_code: artisan.sdi_code,
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
        "Fattura Creata",
        `Fattura ${invoiceNumber} creata con successo`,
        [
          {
            text: "Vai alle Fatture",
            onPress: () => router.push("/(tabs)/invoices" as any),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert("Errore", err.message || "Errore durante la conversione");
    } finally {
      setConverting(false);
    }
  }, [artisan, quote, job]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "Preventivo" }} />
        <View className="flex-1 items-center justify-center bg-white">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </>
    );
  }

  if (!job) {
    return (
      <>
        <Stack.Screen options={{ title: "Preventivo" }} />
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="text-muted">Lavoro non trovato</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: quote ? `Prev. ${quote.quote_number}` : "Nuovo Preventivo",
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
        {items.length === 0 && !generating ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-6xl mb-4">🤖</Text>
            <Text className="text-lg font-semibold text-center mb-2">
              Genera preventivo con AI
            </Text>
            <Text className="text-sm text-muted text-center mb-6">
              L'AI analizzerà il lavoro e il tuo listino per creare una bozza
              di preventivo che potrai modificare liberamente
            </Text>
            <TouchableOpacity
              onPress={generateAIQuote}
              className="bg-primary rounded-xl py-4 px-8"
              activeOpacity={0.8}
            >
              <Text className="text-white text-lg font-semibold">
                Genera Bozza AI
              </Text>
            </TouchableOpacity>
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
                oppure crea manualmente
              </Text>
            </TouchableOpacity>
          </View>
        ) : generating ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="text-primary font-medium mt-4">
              Sto generando il preventivo...
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
                Note
              </Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white min-h-[60]"
                placeholder="Note aggiuntive..."
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* Valid until */}
            <View className="px-4 pb-2">
              <Text className="text-sm font-medium text-gray-700 mb-1">
                Valido fino al (YYYY-MM-DD)
              </Text>
              <TextInput
                className="border border-gray-200 rounded-xl px-4 py-3 text-sm bg-white"
                placeholder="2026-03-11"
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
                    Crea Fattura
                  </Text>
                )}
              </TouchableOpacity>
            ) : (
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
                      Salva Bozza
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
                      Genera PDF e Invia
                    </Text>
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
