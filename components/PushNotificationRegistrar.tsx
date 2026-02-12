import { useEffect } from "react";
import { Platform } from "react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";

async function registerExpoPushToken() {
  if (Platform.OS === "web" || !Device.isDevice) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (finalStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
  const tokenResponse = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  return tokenResponse.data || null;
}

export function PushNotificationRegistrar() {
  const { artisan } = useArtisan();

  useEffect(() => {
    let mounted = true;

    const syncPushToken = async () => {
      if (!artisan?.id) return;
      try {
        const token = await registerExpoPushToken();
        if (!mounted || !token) return;
        if (artisan.expo_push_token === token) return;

        const { error } = await supabase
          .from("artisans")
          .update({ expo_push_token: token })
          .eq("id", artisan.id);

        if (error) {
          console.error("Push token update failed:", error.message);
        }
      } catch (error) {
        console.error("Push token registration failed:", (error as Error).message);
      }
    };

    void syncPushToken();
    return () => {
      mounted = false;
    };
  }, [artisan?.id, artisan?.expo_push_token]);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data || {};
      const itemId = typeof data.itemId === "string" ? data.itemId : null;
      const type = typeof data.type === "string" ? data.type : null;
      if (type === "inbox" && itemId) {
        router.push(`/(tabs)/inbox/${itemId}` as any);
      }
    });

    return () => sub.remove();
  }, []);

  return null;
}

