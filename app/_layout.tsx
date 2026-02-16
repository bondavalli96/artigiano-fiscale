import "@/global.css";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";
import { PaperProvider } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useColorScheme } from "@/components/useColorScheme";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PushNotificationRegistrar } from "@/components/PushNotificationRegistrar";
import { I18nProvider } from "@/lib/i18n";
import { initializeSentry, setUser } from "@/lib/sentry";
import { useAuth } from "@/hooks/useAuth";

// Initialize Sentry BEFORE app renders
initializeSentry();

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "index",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, artisan } = useAuth();

  // Update Sentry user context when auth changes
  useEffect(() => {
    if (user && artisan) {
      setUser({
        id: user.id,
        email: user.email,
        username: artisan.business_name,
      });
    } else {
      setUser(null);
    }
  }, [user, artisan]);

  return (
    <I18nProvider>
    <SafeAreaProvider>
      <PaperProvider>
        <ThemeProvider
          value={colorScheme === "dark" ? DarkTheme : DefaultTheme}
        >
          <OfflineBanner />
          <PushNotificationRegistrar />
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="quote-accept" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: "modal" }} />
          </Stack>
        </ThemeProvider>
      </PaperProvider>
    </SafeAreaProvider>
    </I18nProvider>
  );
}
