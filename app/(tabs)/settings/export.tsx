import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { useI18n } from "@/lib/i18n";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Haptics from "expo-haptics";
import JSZip from "jszip";
import {
  exportFiscalComplianceByCountry,
  normalizeComplianceCountry,
  type ComplianceCountry,
} from "@/lib/compliance";

type Period = "month" | "quarter" | "year";

interface InvoiceWithPdf {
  id: string;
  invoice_number: string;
  total: number;
  pdf_url: string | null;
  client?: { name?: string } | null;
}

function getPeriodRange(period: Period) {
  const now = new Date();
  let start: Date;

  if (period === "quarter") {
    const q = Math.floor(now.getMonth() / 3);
    start = new Date(now.getFullYear(), q * 3, 1);
  } else if (period === "year") {
    start = new Date(now.getFullYear(), 0, 1);
  } else {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  return {
    start: start.toISOString(),
    end: now.toISOString(),
    label:
      period === "year"
        ? `${now.getFullYear()}`
        : period === "quarter"
        ? `Q${Math.floor(now.getMonth() / 3) + 1} ${now.getFullYear()}`
        : `${(now.getMonth() + 1).toString().padStart(2, "0")}/${now.getFullYear()}`,
  };
}

export default function ExportScreen() {
  const { t } = useI18n();
  const { artisan } = useArtisan();
  const [period, setPeriod] = useState<Period>("month");
  const [exporting, setExporting] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [counts, setCounts] = useState({ active: 0, passive: 0 });
  const [invoiceDocs, setInvoiceDocs] = useState<InvoiceWithPdf[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exportingCompliance, setExportingCompliance] = useState(false);

  const range = getPeriodRange(period);
  const complianceCountry: ComplianceCountry = normalizeComplianceCountry(
    artisan?.country_code
  );
  const complianceRegimeLabel =
    complianceCountry === "IT"
      ? t("complianceRegimeIT")
      : complianceCountry === "ES"
      ? t("complianceRegimeES")
      : t("complianceRegimePT");

  const fetchCounts = useCallback(async () => {
    if (!artisan) return;
    const r = getPeriodRange(period);

    const [{ count: ac }, { count: pc }, { data: activeWithPdf }] = await Promise.all([
      supabase
        .from("invoices_active")
        .select("id", { count: "exact", head: true })
        .eq("artisan_id", artisan.id)
        .gte("created_at", r.start),
      supabase
        .from("invoices_passive")
        .select("id", { count: "exact", head: true })
        .eq("artisan_id", artisan.id)
        .gte("created_at", r.start),
      supabase
        .from("invoices_active")
        .select("id, invoice_number, total, pdf_url, client:clients(name)")
        .eq("artisan_id", artisan.id)
        .gte("created_at", r.start)
        .not("pdf_url", "is", null)
        .order("created_at", { ascending: false }),
    ]);

    setCounts({ active: ac || 0, passive: pc || 0 });
    setInvoiceDocs((activeWithPdf as InvoiceWithPdf[]) || []);
    setSelectedIds(new Set());
  }, [artisan, period]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  const handleExport = async () => {
    if (!artisan) return;
    setExporting(true);

    try {
      const r = getPeriodRange(period);

      const { data: active } = await supabase
        .from("invoices_active")
        .select("*, client:clients(name)")
        .eq("artisan_id", artisan.id)
        .gte("created_at", r.start)
        .order("created_at", { ascending: true });

      const { data: passive } = await supabase
        .from("invoices_passive")
        .select("*")
        .eq("artisan_id", artisan.id)
        .gte("created_at", r.start)
        .order("created_at", { ascending: true });

      const activeHeader =
        "Numero;Cliente;Data;Imponibile;IVA;Totale;Stato;Scadenza;Pagata il\n";
      const activeRows = (active || [])
        .map((inv: any) =>
          [
            inv.invoice_number,
            inv.client?.name || "",
            inv.created_at?.split("T")[0] || "",
            inv.subtotal?.toFixed(2) || "0.00",
            inv.vat_amount?.toFixed(2) || "0.00",
            inv.total?.toFixed(2) || "0.00",
            inv.status,
            inv.payment_due || "",
            inv.paid_at?.split("T")[0] || "",
          ].join(";")
        )
        .join("\n");

      const passiveHeader =
        "Numero;Fornitore;Data;Imponibile;IVA;Totale;Categoria;Scadenza;Pagata\n";
      const passiveRows = (passive || [])
        .map((inv: any) =>
          [
            inv.invoice_number || "",
            inv.supplier_name || "",
            inv.issue_date || inv.created_at?.split("T")[0] || "",
            inv.subtotal?.toFixed(2) || "0.00",
            inv.vat_amount?.toFixed(2) || "0.00",
            inv.total?.toFixed(2) || "0.00",
            inv.category || "",
            inv.payment_due || "",
            inv.paid ? "SI" : "NO",
          ].join(";")
        )
        .join("\n");

      const activeCsv = activeHeader + activeRows;
      const passiveCsv = passiveHeader + passiveRows;

      const dir = FileSystem.cacheDirectory + "export/";
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

      const activeFile = dir + `fatture_emesse_${r.label.replace("/", "-")}.csv`;
      const passiveFile = dir + `fatture_ricevute_${r.label.replace("/", "-")}.csv`;

      await FileSystem.writeAsStringAsync(activeFile, activeCsv);
      await FileSystem.writeAsStringAsync(passiveFile, passiveCsv);

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      if (await Sharing.isAvailableAsync()) {
        if ((active || []).length > 0) {
          await Sharing.shareAsync(activeFile, {
            mimeType: "text/csv",
            dialogTitle: t("exportActiveInvoices"),
          });
        }
        if ((passive || []).length > 0) {
          await Sharing.shareAsync(passiveFile, {
            mimeType: "text/csv",
            dialogTitle: t("exportPassiveInvoices"),
          });
        }
      } else {
        Alert.alert(t("exportReady"), t("exportSavedLocally"));
      }
    } catch (err: any) {
      Alert.alert(t("error"), err.message);
    } finally {
      setExporting(false);
    }
  };

  const toggleInvoiceSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleExportZip = async () => {
    const selectedInvoices = invoiceDocs.filter((invoice) => selectedIds.has(invoice.id));
    if (selectedInvoices.length === 0) return;

    setZipping(true);
    try {
      const dir = FileSystem.cacheDirectory + "export/";
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

      const zip = new JSZip();

      for (const invoice of selectedInvoices) {
        if (!invoice.pdf_url) continue;

        const response = await fetch(invoice.pdf_url);
        if (!response.ok) continue;

        const blob = await response.blob();
        const bytes = await blob.arrayBuffer();
        const guessedExt = invoice.pdf_url.toLowerCase().includes(".pdf") ? "pdf" : "html";
        const safeName = (invoice.invoice_number || invoice.id).replace(/[^a-zA-Z0-9_-]/g, "_");
        zip.file(`${safeName}.${guessedExt}`, bytes);
      }

      const zipBase64 = await zip.generateAsync({ type: "base64" });
      const zipPath = dir + `fatture_${range.label.replace("/", "-")}.zip`;

      await FileSystem.writeAsStringAsync(zipPath, zipBase64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Sharing.shareAsync(zipPath, {
        mimeType: "application/zip",
        dialogTitle: t("exportZipInvoices"),
      });
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("saveError"));
    } finally {
      setZipping(false);
    }
  };

  const handleComplianceExport = async () => {
    if (!artisan) return;
    setExportingCompliance(true);

    try {
      const r = getPeriodRange(period);
      const { data: active } = await supabase
        .from("invoices_active")
        .select("id, invoice_number, total, vat_amount, created_at, client:clients(name)")
        .eq("artisan_id", artisan.id)
        .gte("created_at", r.start)
        .order("created_at", { ascending: true });

      const documents = (active || []).map((inv: any) => ({
        id: inv.id,
        number: inv.invoice_number || inv.id,
        issueDate: inv.created_at?.split("T")[0] || "",
        total: inv.total || 0,
        vatAmount: inv.vat_amount || 0,
        customerName: inv.client?.name || "-",
      }));

      const compliance = await exportFiscalComplianceByCountry(complianceCountry, {
        documents,
        business: {
          businessName: artisan.business_name,
          vatNumber: artisan.vat_number,
          fiscalCode: artisan.fiscal_code,
        },
      });

      const dir = FileSystem.cacheDirectory + "export/";
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const ext = compliance.format === "XML" ? "xml" : "json";
      const outputPath = dir + `compliance_${complianceCountry}_${r.label.replace("/", "-")}.${ext}`;

      await FileSystem.writeAsStringAsync(outputPath, compliance.content);

      if (compliance.warnings.length > 0) {
        Alert.alert(
          t("fiscalComplianceExport"),
          compliance.warnings.join("\n")
        );
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Sharing.shareAsync(outputPath, {
        mimeType: ext === "xml" ? "application/xml" : "application/json",
        dialogTitle: t("downloadComplianceFile"),
      });
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("saveError"));
    } finally {
      setExportingCompliance(false);
    }
  };

  const PERIODS: { label: string; value: Period }[] = [
    { label: t("monthPeriod"), value: "month" },
    { label: t("quarterPeriod"), value: "quarter" },
    { label: t("yearPeriod"), value: "year" },
  ];

  return (
    <>
      <Stack.Screen options={{ title: t("exportTitle") }} />
      <ScrollView className="flex-1 bg-gray-50" contentContainerStyle={{ padding: 16 }}>
        <Text className="text-sm font-semibold text-gray-500 uppercase mb-2">{t("periodLabel")}</Text>
        <View className="flex-row gap-2 mb-6">
          {PERIODS.map((p) => (
            <TouchableOpacity
              key={p.value}
              onPress={() => setPeriod(p.value)}
              className={`flex-1 py-3 rounded-xl items-center ${
                period === p.value ? "bg-primary" : "bg-white border border-gray-200"
              }`}
            >
              <Text
                className={`text-sm font-semibold ${
                  period === p.value ? "text-white" : "text-gray-600"
                }`}
              >
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="bg-white rounded-xl p-4 mb-4">
          <Text className="text-lg font-bold mb-3">{t("exportSummary")}</Text>

          <View className="flex-row items-center mb-3">
            <MaterialCommunityIcons name="file-document-outline" size={20} color="#2563eb" />
            <Text className="flex-1 ml-2 text-base">{t("exportActiveInvoices")}</Text>
            <Text className="text-base font-semibold">{counts.active}</Text>
          </View>

          <View className="flex-row items-center">
            <MaterialCommunityIcons name="file-download-outline" size={20} color="#f59e0b" />
            <Text className="flex-1 ml-2 text-base">{t("exportPassiveInvoices")}</Text>
            <Text className="text-base font-semibold">{counts.passive}</Text>
          </View>
        </View>

        <View className="bg-blue-50 rounded-xl p-3 mb-6">
          <Text className="text-sm text-blue-800">{t("exportInfo")}</Text>
        </View>

        <TouchableOpacity
          onPress={handleExport}
          disabled={exporting || (counts.active === 0 && counts.passive === 0)}
          className={`rounded-xl py-4 items-center flex-row justify-center mb-4 ${
            counts.active === 0 && counts.passive === 0 ? "bg-gray-300" : "bg-primary"
          }`}
          activeOpacity={0.8}
        >
          {exporting ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <MaterialCommunityIcons name="download" size={20} color="white" />
              <Text className="text-white text-lg font-semibold ml-2">{t("exportCsv")}</Text>
            </>
          )}
        </TouchableOpacity>

        <View className="bg-white rounded-xl p-4 mb-6">
          <Text className="text-base font-semibold mb-2">{t("fiscalComplianceExport")}</Text>
          <Text className="text-sm text-muted">
            {t("country")}:{" "}
            {complianceCountry === "IT"
              ? t("italy")
              : complianceCountry === "ES"
              ? t("spain")
              : t("portugal")}
          </Text>
          <Text className="text-sm text-muted mb-3">
            {t("complianceRegime")}: {complianceRegimeLabel}
          </Text>
          <Text className="text-xs text-blue-800 mb-3">
            {t("complianceCountryDrivenDesc")}
          </Text>

          <TouchableOpacity
            onPress={handleComplianceExport}
            disabled={exportingCompliance}
            className="bg-primary rounded-xl py-3.5 items-center mb-4"
            activeOpacity={0.8}
          >
            {exportingCompliance ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold">
                {t("downloadComplianceFile")}
              </Text>
            )}
          </TouchableOpacity>

          <Text className="text-base font-semibold mb-2">{t("exportZipInvoices")}</Text>
          <Text className="text-sm text-muted mb-3">{t("exportZipInvoicesDesc")}</Text>

          {invoiceDocs.length === 0 ? (
            <Text className="text-sm text-muted">{t("noInvoices")}</Text>
          ) : (
            <>
              {invoiceDocs.slice(0, 30).map((invoice) => {
                const selected = selectedIds.has(invoice.id);
                return (
                  <TouchableOpacity
                    key={invoice.id}
                    onPress={() => toggleInvoiceSelection(invoice.id)}
                    className={`rounded-lg px-3 py-2 mb-2 border ${
                      selected ? "bg-blue-50 border-primary" : "bg-gray-50 border-gray-200"
                    }`}
                  >
                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 mr-2">
                        <Text className="text-sm font-semibold">{invoice.invoice_number}</Text>
                        <Text className="text-xs text-muted" numberOfLines={1}>
                          {invoice.client?.name || "-"} · {invoice.total?.toFixed(2) || "0.00"} EUR
                        </Text>
                      </View>
                      <MaterialCommunityIcons
                        name={selected ? "checkbox-marked" : "checkbox-blank-outline"}
                        size={20}
                        color={selected ? "#2563eb" : "#9ca3af"}
                      />
                    </View>
                  </TouchableOpacity>
                );
              })}

              <TouchableOpacity
                onPress={handleExportZip}
                disabled={zipping || selectedIds.size === 0}
                className={`mt-2 rounded-xl py-3.5 items-center ${
                  selectedIds.size === 0 ? "bg-gray-300" : "bg-primary"
                }`}
                activeOpacity={0.8}
              >
                {zipping ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text className="text-white font-semibold">
                    {t("downloadZipCount", { count: String(selectedIds.size) })}
                  </Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </>
  );
}
