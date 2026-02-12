import { View, Text, TouchableOpacity, Alert, ScrollView } from "react-native";
import { Stack, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { useI18n } from "@/lib/i18n";
import * as Haptics from "expo-haptics";

export default function SettingsScreen() {
  const { artisan } = useArtisan();
  const { t, locale, setLocale } = useI18n();

  const handleSignOut = async () => {
    Alert.alert(t("signOut"), t("signOutConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("signOut"),
        style: "destructive",
        onPress: async () => {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType.Warning
          );
          await supabase.auth.signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  const toggleLanguage = async () => {
    const locales: Array<"it" | "en" | "es" | "pt"> = ["it", "en", "es", "pt"];
    const currentIndex = locales.indexOf(locale);
    const newLocale = locales[(currentIndex + 1) % locales.length];
    setLocale(newLocale);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <>
      <Stack.Screen options={{ title: t("settings") }} />
      <ScrollView className="flex-1 bg-gray-50 pt-4" contentContainerStyle={{ paddingBottom: 120 }}>
        {artisan && (
          <View className="bg-white mx-4 rounded-xl p-4 mb-4">
            <Text className="text-lg font-bold">{artisan.business_name}</Text>
            <Text className="text-sm text-muted capitalize">
              {artisan.trade}
            </Text>
            {artisan.vat_number && (
              <Text className="text-xs text-muted mt-1">
                {t("vatPrefix")}{artisan.vat_number}
              </Text>
            )}
          </View>
        )}

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/settings/profile" as any)}
          className="bg-white mx-4 rounded-xl p-4 mb-2 flex-row items-center"
        >
          <MaterialCommunityIcons
            name="office-building-cog-outline"
            size={24}
            color="#6b7280"
          />
          <Text className="flex-1 ml-3 text-base">{t("profile")}</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color="#d1d5db"
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/settings/billing" as any)}
          className="bg-white mx-4 rounded-xl p-4 mb-2 flex-row items-center"
        >
          <MaterialCommunityIcons
            name="credit-card-settings-outline"
            size={24}
            color="#6b7280"
          />
          <Text className="flex-1 ml-3 text-base">{t("billingSettings")}</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color="#d1d5db"
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() =>
            router.push("/(tabs)/settings/invoice-customization" as any)
          }
          className="bg-white mx-4 rounded-xl p-4 mb-2 flex-row items-center"
        >
          <MaterialCommunityIcons
            name="file-document-edit-outline"
            size={24}
            color="#6b7280"
          />
          <Text className="flex-1 ml-3 text-base">{t("invoiceCustomization")}</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color="#d1d5db"
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/settings/price-list")}
          className="bg-white mx-4 rounded-xl p-4 mb-2 flex-row items-center"
        >
          <MaterialCommunityIcons
            name="format-list-bulleted"
            size={24}
            color="#6b7280"
          />
          <Text className="flex-1 ml-3 text-base">{t("priceList")}</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color="#d1d5db"
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/settings/clients" as any)}
          className="bg-white mx-4 rounded-xl p-4 mb-2 flex-row items-center"
        >
          <MaterialCommunityIcons
            name="account-group"
            size={24}
            color="#6b7280"
          />
          <Text className="flex-1 ml-3 text-base">{t("clients")}</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color="#d1d5db"
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/settings/templates" as any)}
          className="bg-white mx-4 rounded-xl p-4 mb-2 flex-row items-center"
        >
          <MaterialCommunityIcons
            name="file-document-multiple"
            size={24}
            color="#6b7280"
          />
          <Text className="flex-1 ml-3 text-base">{t("quoteTemplates")}</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color="#d1d5db"
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/settings/brand" as any)}
          className="bg-white mx-4 rounded-xl p-4 mb-2 flex-row items-center"
        >
          <MaterialCommunityIcons
            name="image-edit"
            size={24}
            color="#6b7280"
          />
          <Text className="flex-1 ml-3 text-base">{t("brandLogo")}</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color="#d1d5db"
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/settings/export" as any)}
          className="bg-white mx-4 rounded-xl p-4 mb-2 flex-row items-center"
        >
          <MaterialCommunityIcons
            name="download"
            size={24}
            color="#6b7280"
          />
          <Text className="flex-1 ml-3 text-base">{t("exportForAccountant")}</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color="#d1d5db"
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/other-services" as any)}
          className="bg-white mx-4 rounded-xl p-4 mb-2 flex-row items-center"
        >
          <MaterialCommunityIcons
            name="view-grid-plus-outline"
            size={24}
            color="#6b7280"
          />
          <Text className="flex-1 ml-3 text-base">{t("tabOtherServices")}</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color="#d1d5db"
          />
        </TouchableOpacity>

        {/* Email Forwarding */}
        {artisan?.inbox_email && (
          <View className="bg-white mx-4 rounded-xl p-4 mb-2">
            <View className="flex-row items-center mb-2">
              <MaterialCommunityIcons
                name="email-fast-outline"
                size={24}
                color="#6b7280"
              />
              <Text className="flex-1 ml-3 text-base font-medium">
                {t("inboxEmailForwarding")}
              </Text>
            </View>
            <Text className="text-xs text-gray-400 mb-2">
              {t("inboxEmailDesc")}
            </Text>
            <TouchableOpacity
              onPress={async () => {
                await Clipboard.setStringAsync(artisan.inbox_email!);
                await Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success
                );
                Alert.alert(t("ok"), t("inboxEmailCopied"));
              }}
              className="bg-gray-50 rounded-lg p-3 flex-row items-center"
            >
              <Text className="flex-1 text-sm font-mono text-gray-700">
                {artisan.inbox_email}
              </Text>
              <MaterialCommunityIcons
                name="content-copy"
                size={18}
                color="#2563eb"
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Language toggle */}
        <TouchableOpacity
          onPress={toggleLanguage}
          className="bg-white mx-4 rounded-xl p-4 mb-2 flex-row items-center"
        >
          <MaterialCommunityIcons
            name="translate"
            size={24}
            color="#6b7280"
          />
          <Text className="flex-1 ml-3 text-base">{t("language")}</Text>
          <View className="flex-row items-center">
            <Text className="text-sm text-muted mr-2">
              {{
                it: "🇮🇹 Italiano",
                en: "🇬🇧 English",
                es: "🇪🇸 Español",
                pt: "🇵🇹 Português",
              }[locale]}
            </Text>
            <MaterialCommunityIcons
              name="swap-horizontal"
              size={20}
              color="#2563eb"
            />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSignOut}
          className="bg-white mx-4 rounded-xl p-4 mt-8 flex-row items-center justify-center"
        >
          <MaterialCommunityIcons name="logout" size={20} color="#dc2626" />
          <Text className="ml-2 text-danger font-semibold">{t("signOut")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </>
  );
}
