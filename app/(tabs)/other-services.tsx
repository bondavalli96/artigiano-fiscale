import { ScrollView, Text, View } from "react-native";
import { Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useI18n } from "@/lib/i18n";

export default function OtherServicesScreen() {
  const { t } = useI18n();

  return (
    <>
      <Stack.Screen options={{ title: t("tabOtherServices") }} />
      <ScrollView
        className="flex-1 bg-gray-50"
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        <View className="bg-white rounded-2xl p-5 mb-4 border border-blue-100">
          <View className="flex-row items-center mb-2">
            <MaterialCommunityIcons
              name="view-grid-plus-outline"
              size={24}
              color="#2563eb"
            />
            <Text className="ml-2 text-lg font-bold text-gray-900">
              {t("otherServicesTitle")}
            </Text>
          </View>
          <Text className="text-sm text-gray-600">{t("otherServicesSubtitle")}</Text>
        </View>

        <View className="bg-white rounded-2xl p-5 border border-gray-200">
          <View className="self-start bg-blue-100 rounded-full px-3 py-1 mb-3">
            <Text className="text-xs font-semibold text-blue-700">
              {t("marketplaceBadge")}
            </Text>
          </View>

          <Text className="text-lg font-bold text-gray-900 mb-2">
            {t("marketplaceTitle")}
          </Text>
          <Text className="text-sm text-gray-600 mb-4">
            {t("marketplaceDescription")}
          </Text>

          <View className="gap-3">
            {[t("marketplaceFeature1"), t("marketplaceFeature2"), t("marketplaceFeature3")].map(
              (feature) => (
                <View key={feature} className="flex-row items-start">
                  <MaterialCommunityIcons
                    name="check-circle-outline"
                    size={18}
                    color="#16a34a"
                    style={{ marginTop: 2 }}
                  />
                  <Text className="ml-2 flex-1 text-sm text-gray-700">{feature}</Text>
                </View>
              )
            )}
          </View>

          <View className="mt-5 bg-gray-50 rounded-xl p-3 border border-gray-200">
            <Text className="text-xs uppercase text-gray-500 font-semibold">
              {t("marketplacePricingLabel")}
            </Text>
            <Text className="text-base font-bold text-gray-900 mt-1">
              {t("marketplacePricingValue")}
            </Text>
            <Text className="text-xs text-gray-500 mt-1">{t("marketplaceStatus")}</Text>
          </View>
        </View>
      </ScrollView>
    </>
  );
}
