import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  Linking,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "@/lib/supabase";
import { TRADES } from "@/constants/trades";
import { validateVAT, validateFiscalCode } from "@/lib/utils/validators";
import { useI18n } from "@/lib/i18n";

type PriceListSuggestion = {
  description: string;
  unit: string;
  category: string;
  selected: boolean;
};

export default function OnboardingScreen() {
  const { t } = useI18n();
  const onboardingVideoUrl = process.env.EXPO_PUBLIC_ONBOARDING_VIDEO_URL;
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Trade
  const [selectedTrade, setSelectedTrade] = useState("");

  // Step 2: Fiscal data
  const [businessName, setBusinessName] = useState("");
  const [countryCode, setCountryCode] = useState<"IT" | "ES" | "PT">("IT");
  const [vatNumber, setVatNumber] = useState("");
  const [fiscalCode, setFiscalCode] = useState("");
  const [companyRegistrationNumber, setCompanyRegistrationNumber] = useState("");
  const [address, setAddress] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [sdiCode, setSdiCode] = useState("0000000");
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [signatureUri, setSignatureUri] = useState<string | null>(null);

  // Step 2: Fiscal regime (IT only)
  const [fiscalRegime, setFiscalRegime] = useState<"ordinario" | "forfettario" | "">(
    ""
  );

  // Step 3: Input preference
  const [preferredInput, setPreferredInput] = useState<"voice" | "text">(
    "text"
  );

  // Step 4: AI Price list
  const [priceItems, setPriceItems] = useState<PriceListSuggestion[]>([]);
  const [loadingPriceList, setLoadingPriceList] = useState(false);
  const [customDescription, setCustomDescription] = useState("");
  const [customUnit, setCustomUnit] = useState("ore");

  const totalSteps = countryCode === "IT" ? 5 : 4;

  useEffect(() => {
    const loadUserEmail = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setBusinessEmail(user.email);
      }
    };
    loadUserEmail();
  }, []);

  const pickImage = async (target: "logo" | "signature") => {
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
    if (target === "logo") {
      setLogoUri(result.assets[0].uri);
    } else {
      setSignatureUri(result.assets[0].uri);
    }
  };

  const uploadImage = async (
    uri: string,
    bucket: "logos" | "signatures",
    filePrefix: string,
    artisanId: string
  ) => {
    const ext = uri.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${filePrefix}_${artisanId}_${Date.now()}.${ext}`;

    const response = await fetch(uri);
    const blob = await response.blob();

    const { error } = await supabase.storage.from(bucket).upload(fileName, blob, {
      contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
      upsert: true,
    });
    if (error) throw error;

    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return urlData.publicUrl;
  };

  // The step that triggers price list loading depends on whether the fiscal step is shown
  const priceListTriggerStep = countryCode === "IT" ? 3 : 2;

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < totalSteps - 1) {
      const nextStep = step + 1;
      // Skip fiscal regime step for non-IT countries
      if (countryCode !== "IT" && nextStep === 2) {
        setStep(3);
        return;
      }
      setStep(nextStep);
      if (step === priceListTriggerStep) fetchPriceList();
    }
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const fetchPriceList = async () => {
    if (priceItems.length > 0) return;
    setLoadingPriceList(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "suggest-price-list",
        { body: { trade: selectedTrade } }
      );
      if (error) throw error;
      const items = (data.items || []).map(
        (item: Omit<PriceListSuggestion, "selected">) => ({
          ...item,
          selected: true,
        })
      );
      setPriceItems(items);
    } catch (err: any) {
      console.error("Price list error:", err);
      Alert.alert(
        t("note"),
        t("priceListFailed")
      );
    } finally {
      setLoadingPriceList(false);
    }
  };

  const togglePriceItem = (index: number) => {
    setPriceItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const addCustomItem = () => {
    if (!customDescription.trim()) return;
    setPriceItems((prev) => [
      ...prev,
      {
        description: customDescription.trim(),
        unit: customUnit,
        category: "manodopera",
        selected: true,
      },
    ]);
    setCustomDescription("");
  };

  const handleComplete = async () => {
    if (!businessName.trim()) {
      Alert.alert(t("error"), t("enterBusinessName"));
      return;
    }
    if (!businessEmail.trim() || !businessEmail.includes("@")) {
      Alert.alert(t("error"), t("enterBusinessEmail"));
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non trovato");

      // Generate inbox email address
      const inboxPrefix = `inbox-${user.id.substring(0, 8)}`;
      const inboxEmail = `${inboxPrefix}@artigianoai.it`;

      // Save artisan profile
      const { data: artisan, error: artisanError } = await supabase
        .from("artisans")
        .insert({
          user_id: user.id,
          business_name: businessName.trim(),
          trade: selectedTrade,
          country_code: countryCode,
          company_registration_number:
            companyRegistrationNumber.trim() || null,
          vat_number: vatNumber.trim() || null,
          fiscal_code: fiscalCode.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: businessEmail.trim(),
          website: website.trim() || null,
          preferred_input: preferredInput,
          sdi_code: countryCode === "IT" ? sdiCode.trim() || "0000000" : "0000000",
          default_vat_rate: 22,
          inbox_email: inboxEmail,
        })
        .select()
        .single();

      if (artisanError) throw artisanError;

      if (artisan) {
        const patch: Record<string, string> = {};
        if (logoUri) {
          patch.logo_url = await uploadImage(logoUri, "logos", "logo", artisan.id);
        }
        if (signatureUri) {
          patch.signature_url = await uploadImage(
            signatureUri,
            "signatures",
            "signature",
            artisan.id
          );
        }
        if (Object.keys(patch).length > 0) {
          await supabase.from("artisans").update(patch).eq("id", artisan.id);
        }
      }

      // Save fiscal profile (IT only)
      if (artisan && countryCode === "IT" && fiscalRegime) {
        const { error: fiscalError } = await supabase
          .from("fiscal_profiles")
          .insert({
            artisan_id: artisan.id,
            regime: fiscalRegime,
          });
        if (fiscalError) console.error("Fiscal profile save error:", fiscalError);
      }

      // Save selected price list items
      const selectedItems = priceItems.filter((item) => item.selected);
      if (selectedItems.length > 0 && artisan) {
        const { error: priceError } = await supabase
          .from("price_list")
          .insert(
            selectedItems.map((item) => ({
              artisan_id: artisan.id,
              description: item.description,
              unit: item.unit,
              category: item.category,
            }))
          );
        if (priceError) console.error("Price list save error:", priceError);
      }

      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
      router.replace("/(tabs)");
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("saveError"));
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return selectedTrade !== "";
      case 1:
        return businessName.trim() !== "" && businessEmail.trim() !== "";
      case 2: // Fiscal regime (IT) or Input preference (non-IT)
        return countryCode === "IT" ? fiscalRegime !== "" : true;
      case 3: // Input preference (IT) or Price list (non-IT)
        return true;
      case 4: // Price list (IT only)
        return true;
      default:
        return false;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Progress bar */}
      <View className="px-6 pt-4 pb-2">
        <View className="flex-row gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <View
              key={i}
              className={`flex-1 h-1 rounded-full ${
                i <= step ? "bg-primary" : "bg-gray-200"
              }`}
            />
          ))}
        </View>
        <Text className="text-sm text-muted mt-2">
          {t("stepOf", { step: String(step + 1), total: String(totalSteps) })}
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Step 0: Trade selection */}
          {step === 0 && (
            <View>
              <Text className="text-2xl font-bold mb-2">
                {t("whatJob")}
              </Text>
              <Text className="text-muted mb-6">
                {t("selectTrade")}
              </Text>
              {onboardingVideoUrl ? (
                <TouchableOpacity
                  onPress={() => Linking.openURL(onboardingVideoUrl)}
                  className="mb-5 bg-blue-50 border border-blue-200 rounded-xl p-3 flex-row items-center"
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="play-circle-outline" size={24} color="#2563eb" />
                  <View className="ml-3 flex-1">
                    <Text className="text-sm font-semibold text-primary">
                      {t("watchTutorial")}
                    </Text>
                    <Text className="text-xs text-blue-800">
                      {t("watchTutorialDesc")}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="open-in-new" size={18} color="#2563eb" />
                </TouchableOpacity>
              ) : null}
              <View className="flex-row flex-wrap gap-3">
                {TRADES.map((trade) => (
                  <TouchableOpacity
                    key={trade.id}
                    onPress={() => {
                      setSelectedTrade(trade.id);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    className={`w-[47%] p-4 rounded-xl border-2 items-center ${
                      selectedTrade === trade.id
                        ? "border-primary bg-blue-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <MaterialCommunityIcons
                      name={trade.icon as any}
                      size={32}
                      color={
                        selectedTrade === trade.id ? "#2563eb" : "#6b7280"
                      }
                    />
                    <Text
                      className={`mt-2 font-medium ${
                        selectedTrade === trade.id
                          ? "text-primary"
                          : "text-gray-700"
                      }`}
                    >
                      {trade.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Step 1: Fiscal data */}
          {step === 1 && (
            <View>
              <Text className="text-2xl font-bold mb-2">
                {t("yourData")}
              </Text>
              <Text className="text-muted mb-6">
                {t("dataUsedFor")}
              </Text>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  {t("businessName")}
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                  placeholder={t("businessNamePlaceholder")}
                  placeholderTextColor="#9ca3af"
                  value={businessName}
                  onChangeText={setBusinessName}
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">
                  {t("country")}
                </Text>
                <View className="flex-row gap-2">
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
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  {t("companyNumber")}
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                  placeholder={t("companyNumberPlaceholder")}
                  placeholderTextColor="#9ca3af"
                  value={companyRegistrationNumber}
                  onChangeText={setCompanyRegistrationNumber}
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  {t("businessEmail")}
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                  placeholder="info@azienda.it"
                  placeholderTextColor="#9ca3af"
                  value={businessEmail}
                  onChangeText={setBusinessEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  {t("vatNumber")}
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                  placeholder="12345678901"
                  placeholderTextColor="#9ca3af"
                  value={vatNumber}
                  onChangeText={setVatNumber}
                  keyboardType="number-pad"
                  maxLength={11}
                />
                {vatNumber.length === 11 && !validateVAT(vatNumber) && (
                  <Text className="text-danger text-xs mt-1">
                    {t("vatInvalid")}
                  </Text>
                )}
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  {t("fiscalCode")}
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                  placeholder="RSSMRA80A01H501U"
                  placeholderTextColor="#9ca3af"
                  value={fiscalCode}
                  onChangeText={(text) => setFiscalCode(text.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={16}
                />
                {fiscalCode.length === 16 &&
                  !validateFiscalCode(fiscalCode) && (
                    <Text className="text-danger text-xs mt-1">
                      {t("fiscalCodeInvalid")}
                    </Text>
                  )}
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  {t("address")}
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                  placeholder={t("addressPlaceholder")}
                  placeholderTextColor="#9ca3af"
                  value={address}
                  onChangeText={setAddress}
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  {t("phone")}
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                  placeholder={t("phonePlaceholder")}
                  placeholderTextColor="#9ca3af"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  {t("website")}
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                  placeholder="https://www.azienda.it"
                  placeholderTextColor="#9ca3af"
                  value={website}
                  onChangeText={setWebsite}
                  autoCapitalize="none"
                />
              </View>

              {countryCode === "IT" && (
                <View className="mb-4">
                  <Text className="text-sm font-medium text-gray-700 mb-1">
                    {t("sdiCode")}
                  </Text>
                  <TextInput
                    className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                    placeholder="0000000"
                    placeholderTextColor="#9ca3af"
                    value={sdiCode}
                    onChangeText={setSdiCode}
                    maxLength={7}
                  />
                </View>
              )}

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-2">
                  {t("businessLogo")}
                </Text>
                <TouchableOpacity
                  onPress={() => pickImage("logo")}
                  className="border border-gray-300 rounded-xl p-3 bg-gray-50"
                >
                  {logoUri ? (
                    <Image
                      source={{ uri: logoUri }}
                      style={{ width: "100%", height: 80, borderRadius: 8 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons name="image-plus" size={18} color="#6b7280" />
                      <Text className="text-sm text-gray-600 ml-2">
                        {t("uploadLogo")}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <View className="mb-2">
                <Text className="text-sm font-medium text-gray-700 mb-2">
                  {t("signature")}
                </Text>
                <TouchableOpacity
                  onPress={() => pickImage("signature")}
                  className="border border-gray-300 rounded-xl p-3 bg-gray-50"
                >
                  {signatureUri ? (
                    <Image
                      source={{ uri: signatureUri }}
                      style={{ width: "100%", height: 64, borderRadius: 8 }}
                      resizeMode="contain"
                    />
                  ) : (
                    <View className="flex-row items-center">
                      <MaterialCommunityIcons
                        name="draw-pen"
                        size={18}
                        color="#6b7280"
                      />
                      <Text className="text-sm text-gray-600 ml-2">
                        {t("uploadSignature")}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Step 2: Fiscal Regime (IT only) */}
          {step === 2 && countryCode === "IT" && (
            <View>
              <Text className="text-2xl font-bold mb-2">
                {t("fiscalRegime")}
              </Text>
              <Text className="text-muted mb-6">
                {t("fiscalRegimeDesc")}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  setFiscalRegime("ordinario");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
                className={`p-5 rounded-xl border-2 mb-4 ${
                  fiscalRegime === "ordinario"
                    ? "border-primary bg-blue-50"
                    : "border-gray-200"
                }`}
              >
                <View className="flex-row items-center">
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={28}
                    color={fiscalRegime === "ordinario" ? "#2563eb" : "#6b7280"}
                  />
                  <View className="ml-3 flex-1">
                    <Text className={`text-lg font-bold ${
                      fiscalRegime === "ordinario" ? "text-primary" : "text-gray-800"
                    }`}>
                      {t("regimeOrdinario")}
                    </Text>
                    <Text className="text-muted text-sm mt-0.5">
                      {t("regimeOrdinarioDesc")}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setFiscalRegime("forfettario");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
                className={`p-5 rounded-xl border-2 mb-4 ${
                  fiscalRegime === "forfettario"
                    ? "border-green-500 bg-green-50"
                    : "border-gray-200"
                }`}
              >
                <View className="flex-row items-center">
                  <MaterialCommunityIcons
                    name="leaf"
                    size={28}
                    color={fiscalRegime === "forfettario" ? "#16a34a" : "#6b7280"}
                  />
                  <View className="ml-3 flex-1">
                    <Text className={`text-lg font-bold ${
                      fiscalRegime === "forfettario" ? "text-green-700" : "text-gray-800"
                    }`}>
                      {t("regimeForfettario")}
                    </Text>
                    <Text className="text-muted text-sm mt-0.5">
                      {t("regimeForfettarioDesc")}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex-row items-start">
                <MaterialCommunityIcons name="information-outline" size={18} color="#d97706" />
                <Text className="text-xs text-amber-800 ml-2 flex-1">
                  {t("regimeNonSoDesc")}
                </Text>
              </View>
            </View>
          )}

          {/* Step 2 (non-IT) / Step 3 (IT): Input preference */}
          {((step === 2 && countryCode !== "IT") || (step === 3 && countryCode === "IT")) && (
            <View>
              <Text className="text-2xl font-bold mb-2">
                {t("inputPreference")}
              </Text>
              <Text className="text-muted mb-6">
                {t("canChangeAfter")}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  setPreferredInput("voice");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
                className={`p-6 rounded-xl border-2 items-center mb-4 ${
                  preferredInput === "voice"
                    ? "border-primary bg-blue-50"
                    : "border-gray-200"
                }`}
              >
                <Text className="text-4xl mb-2">🎤</Text>
                <Text className="text-xl font-bold">{t("voice")}</Text>
                <Text className="text-muted text-center mt-1">
                  {t("voiceDesc")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setPreferredInput("text");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                }}
                className={`p-6 rounded-xl border-2 items-center ${
                  preferredInput === "text"
                    ? "border-primary bg-blue-50"
                    : "border-gray-200"
                }`}
              >
                <Text className="text-4xl mb-2">⌨️</Text>
                <Text className="text-xl font-bold">{t("text")}</Text>
                <Text className="text-muted text-center mt-1">
                  {t("textDesc")}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 3 (non-IT) / Step 4 (IT): AI Price list */}
          {((step === 3 && countryCode !== "IT") || (step === 4 && countryCode === "IT")) && (
            <View>
              <Text className="text-2xl font-bold mb-2">
                {t("yourPriceList")}
              </Text>
              <Text className="text-muted mb-4">
                {t("priceListAiDesc")}
              </Text>

              {loadingPriceList ? (
                <View className="items-center py-10">
                  <ActivityIndicator size="large" color="#2563eb" />
                  <Text className="text-muted mt-4">
                    {t("generatingPriceList")}
                  </Text>
                </View>
              ) : (
                <>
                  <View className="bg-blue-50 rounded-xl p-3 mb-4 flex-row items-center">
                    <Text className="text-2xl mr-2">🤖</Text>
                    <Text className="text-sm text-primary flex-1">
                      {t("aiDraftPriceList")}
                    </Text>
                  </View>

                  {priceItems.map((item, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => togglePriceItem(index)}
                      className={`flex-row items-center p-3 rounded-lg mb-2 ${
                        item.selected ? "bg-gray-50" : "bg-white opacity-50"
                      }`}
                    >
                      <View
                        className={`w-6 h-6 rounded border-2 items-center justify-center mr-3 ${
                          item.selected
                            ? "bg-primary border-primary"
                            : "border-gray-300"
                        }`}
                      >
                        {item.selected && (
                          <MaterialCommunityIcons
                            name="check"
                            size={16}
                            color="white"
                          />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="font-medium">{item.description}</Text>
                        <Text className="text-xs text-muted">
                          {item.unit} • {item.category}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}

                  {/* Add custom item */}
                  <View className="mt-4 pt-4 border-t border-gray-200">
                    <Text className="font-medium mb-2">
                      {t("addCustomItem")}
                    </Text>
                    <View className="flex-row gap-2">
                      <TextInput
                        className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-base bg-gray-50"
                        placeholder={t("description")}
                        placeholderTextColor="#9ca3af"
                        value={customDescription}
                        onChangeText={setCustomDescription}
                      />
                      <TouchableOpacity
                        onPress={addCustomItem}
                        className="bg-primary rounded-xl px-4 py-2 justify-center"
                      >
                        <Text className="text-white font-medium">+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              )}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Navigation buttons */}
      <View className="px-6 pb-4 pt-2 border-t border-gray-100 flex-row gap-3">
        {step > 0 && (
          <TouchableOpacity
            onPress={goBack}
            className="flex-1 border border-gray-300 rounded-xl py-4 items-center"
          >
            <Text className="text-gray-700 text-base font-medium">
              {t("back")}
            </Text>
          </TouchableOpacity>
        )}

        {step < totalSteps - 1 ? (
          <TouchableOpacity
            onPress={goNext}
            disabled={!canProceed()}
            className={`flex-1 rounded-xl py-4 items-center ${
              canProceed() ? "bg-primary" : "bg-gray-300"
            }`}
          >
            <Text className="text-white text-base font-medium">{t("next")}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleComplete}
            disabled={loading}
            className="flex-1 bg-success rounded-xl py-4 items-center"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white text-base font-semibold">
                {t("done")}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
