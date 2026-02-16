import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { useI18n } from "@/lib/i18n";
import { formatCurrency } from "@/lib/utils/format";
import type { FiscalProfile, FiscalYearTracking, FiscalRegime, SdiProvider } from "@/types";

export default function FiscalSettingsScreen() {
  const { artisan } = useArtisan();
  const { t, locale } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fiscalProfile, setFiscalProfile] = useState<FiscalProfile | null>(null);
  const [yearTracking, setYearTracking] = useState<FiscalYearTracking | null>(null);
  const [sdiApiKey, setSdiApiKey] = useState("");
  const [testingConnection, setTestingConnection] = useState(false);

  const fetchData = useCallback(async () => {
    if (!artisan) return;
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from("fiscal_profiles")
        .select("*")
        .eq("artisan_id", artisan.id)
        .single();

      setFiscalProfile(profile);

      const currentYear = new Date().getFullYear();
      const { data: tracking } = await supabase
        .from("fiscal_year_tracking")
        .select("*")
        .eq("artisan_id", artisan.id)
        .eq("year", currentYear)
        .single();

      setYearTracking(tracking);
    } catch {
      // No fiscal profile yet
    } finally {
      setLoading(false);
    }
  }, [artisan]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const changeRegime = async (newRegime: FiscalRegime) => {
    if (!artisan) return;

    if (fiscalProfile && fiscalProfile.regime === newRegime) return;

    const doChange = async () => {
      setSaving(true);
      try {
        if (fiscalProfile) {
          await supabase
            .from("fiscal_profiles")
            .update({ regime: newRegime, updated_at: new Date().toISOString() })
            .eq("id", fiscalProfile.id);
        } else {
          await supabase
            .from("fiscal_profiles")
            .insert({ artisan_id: artisan.id, regime: newRegime });
        }
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t("ok"), t("fiscalRegimeChanged"));
        fetchData();
      } catch (err: any) {
        Alert.alert(t("error"), err.message);
      } finally {
        setSaving(false);
      }
    };

    if (fiscalProfile) {
      Alert.alert(t("fiscalRegime"), t("fiscalRegimeWarning"), [
        { text: t("cancel"), style: "cancel" },
        { text: t("confirm"), onPress: doChange },
      ]);
    } else {
      doChange();
    }
  };

  const selectSdiProvider = async (provider: SdiProvider | null) => {
    if (!artisan || !fiscalProfile) return;
    setSaving(true);
    try {
      await supabase
        .from("fiscal_profiles")
        .update({
          sdi_provider: provider,
          updated_at: new Date().toISOString(),
        })
        .eq("id", fiscalProfile.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      fetchData();
    } catch (err: any) {
      Alert.alert(t("error"), err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveSdiApiKey = async () => {
    if (!artisan || !fiscalProfile || !sdiApiKey.trim()) return;
    setSaving(true);
    try {
      await supabase
        .from("fiscal_profiles")
        .update({
          sdi_provider_api_key_encrypted: sdiApiKey.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", fiscalProfile.id);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("ok"), t("sdiApiKeySaved"));
      setSdiApiKey("");
      fetchData();
    } catch (err: any) {
      Alert.alert(t("error"), err.message);
    } finally {
      setSaving(false);
    }
  };

  const testSdiConnection = async () => {
    if (!artisan || !fiscalProfile?.sdi_provider) return;
    setTestingConnection(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-to-sdi", {
        body: {
          action: "test_connection",
          artisanId: artisan.id,
        },
      });
      if (error) throw error;
      if (data?.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t("ok"), t("sdiConnectionOk"));
      } else {
        Alert.alert(t("error"), data?.error || t("sdiConnectionFailed"));
      }
    } catch {
      Alert.alert(t("error"), t("sdiConnectionFailed"));
    } finally {
      setTestingConnection(false);
    }
  };

  const sdiProviders: { key: SdiProvider; label: string; icon: string }[] = [
    { key: "fatture_in_cloud", label: "Fatture in Cloud", icon: "cloud-outline" },
    { key: "aruba", label: "Aruba", icon: "server" },
    { key: "fattura24", label: "Fattura24", icon: "receipt" },
  ];

  const revenuePercent = yearTracking
    ? Math.min((yearTracking.total_revenue / 85000) * 100, 100)
    : 0;

  const getBarColor = () => {
    if (revenuePercent >= 80) return "bg-red-500";
    if (revenuePercent >= 60) return "bg-amber-500";
    return "bg-green-500";
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t("fiscalRegime") }} />
        <View className="flex-1 items-center justify-center bg-gray-50">
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t("fiscalRegime") }} />
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Current regime */}
        <View className="mx-4 mt-4 mb-2">
          <Text className="text-xs font-semibold text-gray-500 uppercase mb-2">
            {t("fiscalRegime")}
          </Text>
        </View>

        <TouchableOpacity
          onPress={() => changeRegime("ordinario")}
          disabled={saving}
          className={`bg-white mx-4 rounded-xl p-4 mb-2 flex-row items-center border-2 ${
            fiscalProfile?.regime === "ordinario"
              ? "border-primary"
              : "border-transparent"
          }`}
        >
          <MaterialCommunityIcons
            name="file-document-outline"
            size={24}
            color={
              fiscalProfile?.regime === "ordinario" ? "#2563eb" : "#6b7280"
            }
          />
          <View className="flex-1 ml-3">
            <Text
              className={`text-base font-semibold ${
                fiscalProfile?.regime === "ordinario"
                  ? "text-primary"
                  : "text-gray-800"
              }`}
            >
              {t("regimeOrdinario")}
            </Text>
            <Text className="text-xs text-muted">{t("regimeOrdinarioDesc")}</Text>
          </View>
          {fiscalProfile?.regime === "ordinario" && (
            <MaterialCommunityIcons name="check-circle" size={24} color="#2563eb" />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => changeRegime("forfettario")}
          disabled={saving}
          className={`bg-white mx-4 rounded-xl p-4 mb-2 flex-row items-center border-2 ${
            fiscalProfile?.regime === "forfettario"
              ? "border-green-500"
              : "border-transparent"
          }`}
        >
          <MaterialCommunityIcons
            name="leaf"
            size={24}
            color={
              fiscalProfile?.regime === "forfettario" ? "#16a34a" : "#6b7280"
            }
          />
          <View className="flex-1 ml-3">
            <Text
              className={`text-base font-semibold ${
                fiscalProfile?.regime === "forfettario"
                  ? "text-green-700"
                  : "text-gray-800"
              }`}
            >
              {t("regimeForfettario")}
            </Text>
            <Text className="text-xs text-muted">
              {t("regimeForfettarioDesc")}
            </Text>
          </View>
          {fiscalProfile?.regime === "forfettario" && (
            <MaterialCommunityIcons
              name="check-circle"
              size={24}
              color="#16a34a"
            />
          )}
        </TouchableOpacity>

        {/* Forfettario tracker */}
        {fiscalProfile?.regime === "forfettario" && (
          <View className="mx-4 mt-4 bg-white rounded-xl p-4">
            <View className="flex-row items-center mb-3">
              <MaterialCommunityIcons
                name="chart-bar"
                size={20}
                color="#16a34a"
              />
              <Text className="text-base font-semibold ml-2">
                {t("forfettarioTracker")}
              </Text>
            </View>

            {/* Progress bar */}
            <View className="bg-gray-200 rounded-full h-4 mb-2 overflow-hidden">
              <View
                className={`h-4 rounded-full ${getBarColor()}`}
                style={{ width: `${revenuePercent}%` }}
              />
            </View>

            <Text className="text-sm text-gray-600 mb-1">
              {t("forfettarioRevenue", {
                amount: formatCurrency(yearTracking?.total_revenue || 0, locale),
                limit: formatCurrency(85000, locale),
              })}
            </Text>

            <Text className="text-xs text-muted">
              {Math.round(revenuePercent)}%
            </Text>

            {revenuePercent >= 80 && (
              <View className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3 flex-row items-start">
                <MaterialCommunityIcons
                  name="alert-circle"
                  size={18}
                  color="#dc2626"
                />
                <Text className="text-xs text-red-800 ml-2 flex-1">
                  {revenuePercent >= 100
                    ? t("forfettarioAlert85")
                    : t("forfettarioAlert80")}
                </Text>
              </View>
            )}
            {revenuePercent >= 60 && revenuePercent < 80 && (
              <View className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 flex-row items-start">
                <MaterialCommunityIcons
                  name="alert"
                  size={18}
                  color="#d97706"
                />
                <Text className="text-xs text-amber-800 ml-2 flex-1">
                  {t("forfettarioAlert70")}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* SdI Provider section */}
        {fiscalProfile && (
          <View className="mx-4 mt-6">
            <Text className="text-xs font-semibold text-gray-500 uppercase mb-2">
              {t("sdiProvider")}
            </Text>
            <Text className="text-xs text-muted mb-3">
              {t("sdiProviderDesc")}
            </Text>

            {sdiProviders.map((provider) => (
              <TouchableOpacity
                key={provider.key}
                onPress={() =>
                  selectSdiProvider(
                    fiscalProfile?.sdi_provider === provider.key
                      ? null
                      : provider.key
                  )
                }
                disabled={saving}
                className={`bg-white rounded-xl p-4 mb-2 flex-row items-center border-2 ${
                  fiscalProfile?.sdi_provider === provider.key
                    ? "border-primary"
                    : "border-transparent"
                }`}
              >
                <MaterialCommunityIcons
                  name={provider.icon as any}
                  size={24}
                  color={
                    fiscalProfile?.sdi_provider === provider.key
                      ? "#2563eb"
                      : "#6b7280"
                  }
                />
                <Text
                  className={`flex-1 ml-3 text-base font-medium ${
                    fiscalProfile?.sdi_provider === provider.key
                      ? "text-primary"
                      : "text-gray-800"
                  }`}
                >
                  {provider.label}
                </Text>
                {fiscalProfile?.sdi_provider === provider.key && (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={24}
                    color="#2563eb"
                  />
                )}
              </TouchableOpacity>
            ))}

            {fiscalProfile?.sdi_provider && (
              <View className="bg-white rounded-xl p-4 mt-2">
                <Text className="text-sm font-semibold mb-2">
                  {t("sdiApiKeyLabel")}
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-gray-50 mb-3"
                  placeholder={t("sdiApiKeyPlaceholder")}
                  placeholderTextColor="#9ca3af"
                  value={sdiApiKey}
                  onChangeText={setSdiApiKey}
                  secureTextEntry
                  autoCapitalize="none"
                />
                {fiscalProfile.sdi_provider_api_key_encrypted && (
                  <View className="flex-row items-center mb-3">
                    <MaterialCommunityIcons
                      name="check-circle-outline"
                      size={16}
                      color="#16a34a"
                    />
                    <Text className="text-xs text-green-700 ml-1">
                      {t("sdiApiKeyConfigured")}
                    </Text>
                  </View>
                )}
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={saveSdiApiKey}
                    disabled={saving || !sdiApiKey.trim()}
                    className={`flex-1 rounded-lg py-2.5 items-center ${
                      sdiApiKey.trim() ? "bg-primary" : "bg-gray-300"
                    }`}
                  >
                    <Text className="text-white text-sm font-medium">
                      {t("save")}
                    </Text>
                  </TouchableOpacity>
                  {fiscalProfile.sdi_provider_api_key_encrypted && (
                    <TouchableOpacity
                      onPress={testSdiConnection}
                      disabled={testingConnection}
                      className="flex-1 border border-primary rounded-lg py-2.5 items-center"
                    >
                      {testingConnection ? (
                        <ActivityIndicator size="small" color="#2563eb" />
                      ) : (
                        <Text className="text-primary text-sm font-medium">
                          {t("sdiTestConnection")}
                        </Text>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
          </View>
        )}

        {saving && (
          <View className="mx-4 mt-4 items-center">
            <ActivityIndicator size="small" color="#2563eb" />
          </View>
        )}
      </ScrollView>
    </>
  );
}
