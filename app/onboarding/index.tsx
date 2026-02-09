import { useState } from "react";
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
  Switch,
} from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { TRADES } from "@/constants/trades";
import { validateVAT, validateFiscalCode } from "@/lib/utils/validators";

type PriceListSuggestion = {
  description: string;
  unit: string;
  category: string;
  selected: boolean;
};

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1: Trade
  const [selectedTrade, setSelectedTrade] = useState("");

  // Step 2: Fiscal data
  const [businessName, setBusinessName] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [fiscalCode, setFiscalCode] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [sdiCode, setSdiCode] = useState("0000000");

  // Step 3: Input preference
  const [preferredInput, setPreferredInput] = useState<"voice" | "text">(
    "text"
  );

  // Step 4: AI Price list
  const [priceItems, setPriceItems] = useState<PriceListSuggestion[]>([]);
  const [loadingPriceList, setLoadingPriceList] = useState(false);
  const [customDescription, setCustomDescription] = useState("");
  const [customUnit, setCustomUnit] = useState("ore");

  const totalSteps = 4;

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step < totalSteps - 1) {
      setStep(step + 1);
      if (step === 2) fetchPriceList();
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
        "Nota",
        "Non sono riuscito a generare il listino. Puoi aggiungerlo manualmente dopo."
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
      Alert.alert("Errore", "Inserisci la ragione sociale");
      return;
    }

    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Utente non trovato");

      // Save artisan profile
      const { data: artisan, error: artisanError } = await supabase
        .from("artisans")
        .insert({
          user_id: user.id,
          business_name: businessName.trim(),
          trade: selectedTrade,
          vat_number: vatNumber.trim() || null,
          fiscal_code: fiscalCode.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          email: user.email,
          preferred_input: preferredInput,
          sdi_code: sdiCode.trim() || "0000000",
        })
        .select()
        .single();

      if (artisanError) throw artisanError;

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
      Alert.alert("Errore", err.message || "Errore durante il salvataggio");
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return selectedTrade !== "";
      case 1:
        return businessName.trim() !== "";
      case 2:
        return true;
      case 3:
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
          Passo {step + 1} di {totalSteps}
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
                Che lavoro fai?
              </Text>
              <Text className="text-muted mb-6">
                Seleziona il tuo mestiere
              </Text>
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
                I tuoi dati
              </Text>
              <Text className="text-muted mb-6">
                Serviranno per preventivi e fatture
              </Text>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  Ragione sociale *
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                  placeholder="Es. Mario Rossi Impianti"
                  value={businessName}
                  onChangeText={setBusinessName}
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  Partita IVA
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                  placeholder="12345678901"
                  value={vatNumber}
                  onChangeText={setVatNumber}
                  keyboardType="number-pad"
                  maxLength={11}
                />
                {vatNumber.length === 11 && !validateVAT(vatNumber) && (
                  <Text className="text-danger text-xs mt-1">
                    P.IVA non valida
                  </Text>
                )}
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  Codice Fiscale
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                  placeholder="RSSMRA80A01H501U"
                  value={fiscalCode}
                  onChangeText={(t) => setFiscalCode(t.toUpperCase())}
                  autoCapitalize="characters"
                  maxLength={16}
                />
                {fiscalCode.length === 16 &&
                  !validateFiscalCode(fiscalCode) && (
                    <Text className="text-danger text-xs mt-1">
                      Codice fiscale non valido
                    </Text>
                  )}
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  Indirizzo
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                  placeholder="Via Roma 1, 20100 Milano"
                  value={address}
                  onChangeText={setAddress}
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  Telefono
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                  placeholder="+39 333 1234567"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm font-medium text-gray-700 mb-1">
                  Codice SDI
                </Text>
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                  placeholder="0000000"
                  value={sdiCode}
                  onChangeText={setSdiCode}
                  maxLength={7}
                />
              </View>
            </View>
          )}

          {/* Step 2: Input preference */}
          {step === 2 && (
            <View>
              <Text className="text-2xl font-bold mb-2">
                Come preferisci descrivere i lavori?
              </Text>
              <Text className="text-muted mb-6">
                Potrai sempre cambiare dopo
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
                <Text className="text-xl font-bold">Voce</Text>
                <Text className="text-muted text-center mt-1">
                  Parla e l'AI trascrive e organizza tutto
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
                <Text className="text-xl font-bold">Testo</Text>
                <Text className="text-muted text-center mt-1">
                  Scrivi la descrizione del lavoro
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 3: AI Price list */}
          {step === 3 && (
            <View>
              <Text className="text-2xl font-bold mb-2">
                Il tuo listino
              </Text>
              <Text className="text-muted mb-4">
                L'AI ha generato un listino base. Seleziona le voci che usi e
                aggiungi le tue.
              </Text>

              {loadingPriceList ? (
                <View className="items-center py-10">
                  <ActivityIndicator size="large" color="#2563eb" />
                  <Text className="text-muted mt-4">
                    Sto generando il listino...
                  </Text>
                </View>
              ) : (
                <>
                  <View className="bg-blue-50 rounded-xl p-3 mb-4 flex-row items-center">
                    <Text className="text-2xl mr-2">🤖</Text>
                    <Text className="text-sm text-primary flex-1">
                      Bozza AI — seleziona le voci che usi, deseleziona le
                      altre. I prezzi li aggiungerai dopo.
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
                      Aggiungi voce personalizzata
                    </Text>
                    <View className="flex-row gap-2">
                      <TextInput
                        className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-base bg-gray-50"
                        placeholder="Descrizione"
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
              Indietro
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
            <Text className="text-white text-base font-medium">Avanti</Text>
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
                Fatto! Vai alla dashboard
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}
