import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Switch,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { Stack } from "expo-router";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useArtisan } from "@/hooks/useArtisan";
import { supabase } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";
import type { PaymentMethodsConfig } from "@/types";

const DEFAULT_PAYMENT_METHODS: PaymentMethodsConfig = {
  bank_transfer: true,
  card: false,
  stripe_link: false,
  other: false,
};

type PlanKey = "starter" | "pro" | "business";
const PLAN_ORDER: PlanKey[] = ["starter", "pro", "business"];

function isPlanKey(value: string | null | undefined): value is PlanKey {
  return value === "starter" || value === "pro" || value === "business";
}

export default function BillingSettingsScreen() {
  const { artisan, refetch } = useArtisan();
  const { t } = useI18n();

  const [paymentMethods, setPaymentMethods] =
    useState<PaymentMethodsConfig>(DEFAULT_PAYMENT_METHODS);
  const [stripePaymentLink, setStripePaymentLink] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [subscriptionPlan, setSubscriptionPlan] = useState<PlanKey>("starter");
  const [saving, setSaving] = useState(false);

  const planPackages = useMemo<
    Record<PlanKey, { label: string; price: string; features: string[] }>
  >(
    () => ({
      starter: {
        label: t("planStarter"),
        price: t("planPriceStarter"),
        features: [t("tabQuotes"), t("tabInvoices"), t("tabAgenda")],
      },
      pro: {
        label: t("planPro"),
        price: t("planPricePro"),
        features: [
          t("tabQuotes"),
          t("tabInvoices"),
          t("tabAgenda"),
          t("remindersTitle"),
          t("inboxAi"),
        ],
      },
      business: {
        label: t("planBusiness"),
        price: t("planPriceBusiness"),
        features: [
          t("tabQuotes"),
          t("tabInvoices"),
          t("tabAgenda"),
          t("remindersTitle"),
          t("inboxAi"),
          t("planFeatureCustomTemplates"),
          t("planFeatureMarketplaceStorytelling"),
        ],
      },
    }),
    [t]
  );

  useEffect(() => {
    if (!artisan) return;
    setPaymentMethods({
      ...DEFAULT_PAYMENT_METHODS,
      ...(artisan.payment_methods || {}),
    });
    setStripePaymentLink(artisan.stripe_payment_link || "");
    setPaymentNotes(artisan.payment_notes || "");
    setSubscriptionPlan(
      isPlanKey(artisan.subscription_plan) ? artisan.subscription_plan : "starter"
    );
  }, [artisan]);

  const toggleMethod = (key: keyof PaymentMethodsConfig) => {
    setPaymentMethods((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSave = async () => {
    if (!artisan) return;

    setSaving(true);
    try {
      const selectedFeatures = planPackages[subscriptionPlan].features;
      const { error } = await supabase
        .from("artisans")
        .update({
          payment_methods: paymentMethods,
          stripe_payment_link: stripePaymentLink.trim() || null,
          payment_notes: paymentNotes.trim() || null,
          subscription_plan: subscriptionPlan,
          subscription_features: selectedFeatures,
        })
        .eq("id", artisan.id);

      if (error) throw error;

      await refetch();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("saved"), t("settingsSaved"));
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const handleUpgrade = async () => {
    if (stripePaymentLink.trim()) {
      await Linking.openURL(stripePaymentLink.trim());
      return;
    }
    Alert.alert(t("upgradePlan"), t("upgradePlanHint"));
  };

  return (
    <>
      <Stack.Screen options={{ title: t("billingSettings") }} />
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      >
        <View className="bg-white rounded-xl p-4 mb-3">
          <Text className="text-base font-semibold mb-3">{t("payments")}</Text>

          <View className="flex-row items-center justify-between py-2">
            <Text className="text-sm text-gray-700">{t("bankTransfer")}</Text>
            <Switch
              value={!!paymentMethods.bank_transfer}
              onValueChange={() => toggleMethod("bank_transfer")}
            />
          </View>
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-sm text-gray-700">{t("cardPayment")}</Text>
            <Switch value={!!paymentMethods.card} onValueChange={() => toggleMethod("card")} />
          </View>
          <View className="flex-row items-center justify-between py-2">
            <Text className="text-sm text-gray-700">{t("stripeLink")}</Text>
            <Switch
              value={!!paymentMethods.stripe_link}
              onValueChange={() => toggleMethod("stripe_link")}
            />
          </View>
          <View className="flex-row items-center justify-between py-2 mb-2">
            <Text className="text-sm text-gray-700">{t("otherPayments")}</Text>
            <Switch value={!!paymentMethods.other} onValueChange={() => toggleMethod("other")} />
          </View>

          <Text className="text-sm font-medium text-gray-700 mb-1">{t("stripePaymentUrl")}</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-3"
            value={stripePaymentLink}
            onChangeText={setStripePaymentLink}
            autoCapitalize="none"
            placeholder="https://buy.stripe.com/..."
            placeholderTextColor="#9ca3af"
          />

          <Text className="text-sm font-medium text-gray-700 mb-1">{t("paymentNotes")}</Text>
          <TextInput
            className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
            value={paymentNotes}
            onChangeText={setPaymentNotes}
            placeholder={t("paymentNotesPlaceholder")}
            placeholderTextColor="#9ca3af"
            multiline
          />
        </View>

        <View className="bg-white rounded-xl p-4 mb-3">
          <Text className="text-base font-semibold mb-3">{t("subscription")}</Text>

          <View className="flex-row gap-2 mb-3">
            {PLAN_ORDER.map((plan) => (
              <TouchableOpacity
                key={plan}
                onPress={() => setSubscriptionPlan(plan)}
                className={`flex-1 rounded-xl px-3 py-2.5 items-center ${
                  subscriptionPlan === plan
                    ? "bg-primary"
                    : "bg-white border border-gray-300"
                }`}
              >
                <Text
                  className={`text-sm font-semibold ${
                    subscriptionPlan === plan ? "text-white" : "text-gray-700"
                  }`}
                >
                  {planPackages[plan].label}
                </Text>
                <Text
                  className={`text-[11px] mt-0.5 ${
                    subscriptionPlan === plan ? "text-blue-100" : "text-gray-500"
                  }`}
                >
                  {planPackages[plan].price}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text className="text-sm text-muted mb-2">{t("includedFeatures")}</Text>
          {planPackages[subscriptionPlan].features.map((feature) => (
            <View key={feature} className="flex-row items-center mb-1">
              <MaterialCommunityIcons name="check-circle" size={16} color="#16a34a" />
              <Text className="text-sm text-gray-700 ml-2">{feature}</Text>
            </View>
          ))}

          <View className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-3">
            <Text className="text-xs text-blue-700 font-semibold">
              {t("planFeatureMarketplaceStorytelling")}
            </Text>
            <Text className="text-xs text-blue-600 mt-1">
              {t("marketplacePricingValue")}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleUpgrade}
            className="mt-4 border border-primary rounded-xl py-3 items-center"
          >
            <Text className="text-primary font-semibold">{t("upgradePlan")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <View className="absolute left-0 right-0 bottom-0 bg-white border-t border-gray-100 px-5 py-4">
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          className="bg-primary rounded-xl py-3.5 items-center flex-row justify-center"
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <MaterialCommunityIcons name="content-save" size={18} color="white" />
              <Text className="text-white font-semibold ml-2">{t("save")}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </>
  );
}
