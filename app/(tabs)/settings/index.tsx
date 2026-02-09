import { View, Text, TouchableOpacity, Alert } from "react-native";
import { Stack, router } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import * as Haptics from "expo-haptics";

export default function SettingsScreen() {
  const { artisan } = useArtisan();

  const handleSignOut = async () => {
    Alert.alert("Esci", "Vuoi uscire dal tuo account?", [
      { text: "Annulla", style: "cancel" },
      {
        text: "Esci",
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

  return (
    <>
      <Stack.Screen options={{ title: "Impostazioni" }} />
      <View className="flex-1 bg-gray-50 pt-4">
        {artisan && (
          <View className="bg-white mx-4 rounded-xl p-4 mb-4">
            <Text className="text-lg font-bold">{artisan.business_name}</Text>
            <Text className="text-sm text-muted capitalize">
              {artisan.trade}
            </Text>
            {artisan.vat_number && (
              <Text className="text-xs text-muted mt-1">
                P.IVA: {artisan.vat_number}
              </Text>
            )}
          </View>
        )}

        <TouchableOpacity
          onPress={() => router.push("/(tabs)/settings/price-list")}
          className="bg-white mx-4 rounded-xl p-4 mb-2 flex-row items-center"
        >
          <MaterialCommunityIcons
            name="format-list-bulleted"
            size={24}
            color="#6b7280"
          />
          <Text className="flex-1 ml-3 text-base">Listino prezzi</Text>
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color="#d1d5db"
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleSignOut}
          className="bg-white mx-4 rounded-xl p-4 mt-8 flex-row items-center justify-center"
        >
          <MaterialCommunityIcons name="logout" size={20} color="#dc2626" />
          <Text className="ml-2 text-danger font-semibold">Esci</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}
