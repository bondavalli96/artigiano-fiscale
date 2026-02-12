import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
} from "react-native";
import { Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { useI18n } from "@/lib/i18n";

export default function ProfileSettingsScreen() {
  const { artisan, refetch } = useArtisan();
  const { t } = useI18n();

  const [businessName, setBusinessName] = useState("");
  const [countryCode, setCountryCode] = useState<"IT" | "ES" | "PT">("IT");
  const [companyNumber, setCompanyNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [fiscalCode, setFiscalCode] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [sdiCode, setSdiCode] = useState("0000000");
  const [defaultVatRate, setDefaultVatRate] = useState("22");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "signature" | null>(null);

  useEffect(() => {
    if (!artisan) return;
    setBusinessName(artisan.business_name || "");
    setCountryCode((artisan.country_code as "IT" | "ES" | "PT") || "IT");
    setCompanyNumber(artisan.company_registration_number || "");
    setVatNumber(artisan.vat_number || "");
    setFiscalCode(artisan.fiscal_code || "");
    setAddress(artisan.address || "");
    setEmail(artisan.email || "");
    setPhone(artisan.phone || "");
    setWebsite(artisan.website || "");
    setSdiCode(artisan.sdi_code || "0000000");
    setDefaultVatRate(String(artisan.default_vat_rate ?? 22));
    setLogoUrl(artisan.logo_url || null);
    setSignatureUrl(artisan.signature_url || null);
  }, [artisan]);

  const pickAndUploadImage = async (target: "logo" | "signature") => {
    if (!artisan) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("permissionDenied"), t("allowGalleryAccess"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploading(target);
    try {
      const uri = result.assets[0].uri;
      const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${target}_${artisan.id}_${Date.now()}.${ext}`;
      const bucket = target === "logo" ? "logos" : "signatures";

      const response = await fetch(uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, blob, {
          contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
      const publicUrl = urlData.publicUrl;

      const updatePatch =
        target === "logo" ? { logo_url: publicUrl } : { signature_url: publicUrl };

      const { error: updateError } = await supabase
        .from("artisans")
        .update(updatePatch)
        .eq("id", artisan.id);

      if (updateError) throw updateError;

      if (target === "logo") {
        setLogoUrl(publicUrl);
      } else {
        setSignatureUrl(publicUrl);
      }

      await refetch();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("saveError"));
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    if (!artisan) return;
    if (!businessName.trim()) {
      Alert.alert(t("error"), t("enterBusinessName"));
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      Alert.alert(t("error"), t("enterBusinessEmail"));
      return;
    }

    setSaving(true);
    try {
      const parsedVatRate = parseFloat(defaultVatRate) || 22;

      const { error } = await supabase
        .from("artisans")
        .update({
          business_name: businessName.trim(),
          country_code: countryCode,
          company_registration_number: companyNumber.trim() || null,
          vat_number: vatNumber.trim() || null,
          fiscal_code: fiscalCode.trim() || null,
          address: address.trim() || null,
          email: email.trim(),
          phone: phone.trim() || null,
          website: website.trim() || null,
          sdi_code: countryCode === "IT" ? sdiCode.trim() || "0000000" : "0000000",
          default_vat_rate: parsedVatRate,
        })
        .eq("id", artisan.id);

      if (error) throw error;

      await refetch();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("saved"), t("profileUpdated"));
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: t("profile") }} />
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      >
        <View className="bg-white rounded-xl p-4 mb-3">
          <Text className="text-sm font-medium text-gray-700 mb-1">{t("businessName")}</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-3"
            value={businessName}
            onChangeText={setBusinessName}
            placeholder={t("businessNamePlaceholder")}
            placeholderTextColor="#9ca3af"
          />

          <Text className="text-sm font-medium text-gray-700 mb-2">{t("country")}</Text>
          <View className="flex-row gap-2 mb-3">
            {(["IT", "ES", "PT"] as const).map((country) => (
              <TouchableOpacity
                key={country}
                onPress={() => setCountryCode(country)}
                className={`flex-1 rounded-xl border py-2.5 items-center ${
                  countryCode === country
                    ? "bg-primary border-primary"
                    : "bg-white border-gray-300"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    countryCode === country ? "text-white" : "text-gray-700"
                  }`}
                >
                  {country === "IT"
                    ? t("italy")
                    : country === "ES"
                    ? t("spain")
                    : t("portugal")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-sm font-medium text-gray-700 mb-1">{t("companyNumber")}</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-3"
            value={companyNumber}
            onChangeText={setCompanyNumber}
            placeholder={t("companyNumberPlaceholder")}
            placeholderTextColor="#9ca3af"
          />

          <Text className="text-sm font-medium text-gray-700 mb-1">{t("vatNumber")}</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-3"
            value={vatNumber}
            onChangeText={setVatNumber}
            placeholder="12345678901"
            placeholderTextColor="#9ca3af"
          />

          <Text className="text-sm font-medium text-gray-700 mb-1">{t("fiscalCode")}</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-3"
            value={fiscalCode}
            onChangeText={(value) => setFiscalCode(value.toUpperCase())}
            placeholder="RSSMRA80A01H501U"
            placeholderTextColor="#9ca3af"
          />

          <Text className="text-sm font-medium text-gray-700 mb-1">{t("address")}</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-3"
            value={address}
            onChangeText={setAddress}
            placeholder={t("addressPlaceholder")}
            placeholderTextColor="#9ca3af"
          />

          <Text className="text-sm font-medium text-gray-700 mb-1">{t("businessEmail")}</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-3"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="info@azienda.it"
            placeholderTextColor="#9ca3af"
          />

          <Text className="text-sm font-medium text-gray-700 mb-1">{t("phone")}</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-3"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder={t("phonePlaceholder")}
            placeholderTextColor="#9ca3af"
          />

          <Text className="text-sm font-medium text-gray-700 mb-1">{t("website")}</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-3"
            value={website}
            onChangeText={setWebsite}
            autoCapitalize="none"
            placeholder="https://www.azienda.it"
            placeholderTextColor="#9ca3af"
          />

          {countryCode === "IT" && (
            <>
              <Text className="text-sm font-medium text-gray-700 mb-1">{t("sdiCode")}</Text>
              <TextInput
                className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-3"
                value={sdiCode}
                onChangeText={setSdiCode}
                maxLength={7}
                placeholder="0000000"
                placeholderTextColor="#9ca3af"
              />
            </>
          )}

          <Text className="text-sm font-medium text-gray-700 mb-1">{t("defaultVatRate")}</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
            value={defaultVatRate}
            onChangeText={setDefaultVatRate}
            keyboardType="decimal-pad"
            placeholder="22"
            placeholderTextColor="#9ca3af"
          />
        </View>

        <View className="bg-white rounded-xl p-4 mb-3">
          <Text className="text-base font-semibold mb-3">{t("brandTitle")}</Text>

          <Text className="text-sm font-medium text-gray-700 mb-2">{t("businessLogo")}</Text>
          <TouchableOpacity
            onPress={() => pickAndUploadImage("logo")}
            className="border border-gray-300 rounded-xl p-3 bg-gray-50 mb-3"
          >
            {logoUrl ? (
              <Image
                source={{ uri: logoUrl }}
                style={{ width: "100%", height: 78, borderRadius: 8 }}
                resizeMode="contain"
              />
            ) : (
              <View className="flex-row items-center">
                <MaterialCommunityIcons name="image-plus" size={18} color="#6b7280" />
                <Text className="text-sm text-gray-600 ml-2">{t("uploadLogo")}</Text>
              </View>
            )}
            {uploading === "logo" && <ActivityIndicator className="mt-2" color="#2563eb" />}
          </TouchableOpacity>

          <Text className="text-sm font-medium text-gray-700 mb-2">{t("signature")}</Text>
          <TouchableOpacity
            onPress={() => pickAndUploadImage("signature")}
            className="border border-gray-300 rounded-xl p-3 bg-gray-50"
          >
            {signatureUrl ? (
              <Image
                source={{ uri: signatureUrl }}
                style={{ width: "100%", height: 64, borderRadius: 8 }}
                resizeMode="contain"
              />
            ) : (
              <View className="flex-row items-center">
                <MaterialCommunityIcons name="draw-pen" size={18} color="#6b7280" />
                <Text className="text-sm text-gray-600 ml-2">{t("uploadSignature")}</Text>
              </View>
            )}
            {uploading === "signature" && (
              <ActivityIndicator className="mt-2" color="#2563eb" />
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View className="absolute left-0 right-0 bottom-0 bg-white border-t border-gray-100 px-5 py-4">
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className="bg-primary rounded-xl py-3.5 items-center"
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text className="text-white font-semibold">{t("save")}</Text>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}
