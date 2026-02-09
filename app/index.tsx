import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";

export default function IndexScreen() {
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace("/(auth)/login");
        return;
      }

      // Check if artisan profile exists (onboarding completed)
      const { data: artisan } = await supabase
        .from("artisans")
        .select("id")
        .eq("user_id", session.user.id)
        .single();

      if (artisan) {
        router.replace("/(tabs)");
      } else {
        router.replace("/onboarding");
      }
    } catch {
      router.replace("/(auth)/login");
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#2563eb" />
    </View>
  );
}
