import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useI18n } from "@/lib/i18n";
import { useMemo } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type TabIconName = keyof typeof MaterialCommunityIcons.glyphMap;
type TabMeta = {
  label: string;
  icon: TabIconName;
};

const SCROLLABLE_TAB_ORDER = [
  "index",
  "jobs",
  "invoices",
  "agenda",
  "quotes",
  "inbox",
  "stats",
  "other-services",
  "settings",
] as const;

function ScrollableTabBar({
  state,
  descriptors,
  navigation,
  tabMetaMap,
}: BottomTabBarProps & { tabMetaMap: Record<string, TabMeta> }) {
  const insets = useSafeAreaInsets();

  const orderedRoutes = SCROLLABLE_TAB_ORDER.map((routeName) =>
    state.routes.find((route) => route.name === routeName)
  ).filter((route): route is (typeof state.routes)[number] => Boolean(route));

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: "#e5e7eb",
        backgroundColor: "#ffffff",
        paddingTop: 4,
        paddingBottom: Math.max(6, insets.bottom),
      }}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: 8,
          alignItems: "center",
        }}
      >
        {orderedRoutes.map((route) => {
          const isFocused = state.routes[state.index]?.key === route.key;
          const meta = tabMetaMap[route.name];
          const label = meta?.label ?? route.name;
          const iconName = meta?.icon ?? "circle-outline";

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={descriptors[route.key].options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={{
                minWidth: 78,
                marginHorizontal: 3,
                borderRadius: 14,
                paddingHorizontal: 10,
                paddingVertical: 6,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isFocused ? "#eff6ff" : "transparent",
              }}
            >
              <MaterialCommunityIcons
                name={iconName}
                size={22}
                color={isFocused ? "#2563eb" : "#6b7280"}
              />
              <Text
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  fontWeight: "600",
                  color: isFocused ? "#2563eb" : "#6b7280",
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default function TabLayout() {
  const { t } = useI18n();

  const tabMetaMap = useMemo<Record<string, TabMeta>>(
    () => ({
      index: { label: t("tabHome"), icon: "home" },
      jobs: { label: t("tabJobs"), icon: "hammer" },
      invoices: { label: t("tabInvoices"), icon: "currency-eur" },
      agenda: { label: t("tabAgenda"), icon: "calendar-today" },
      quotes: { label: t("tabQuotes"), icon: "file-document-outline" },
      inbox: { label: t("tabInbox"), icon: "inbox-arrow-down" },
      stats: { label: t("tabStats"), icon: "chart-bar" },
      "other-services": { label: t("tabOtherServices"), icon: "view-grid-plus-outline" },
      settings: { label: t("tabSettings"), icon: "cog" },
    }),
    [t]
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerTitleStyle: {
          fontWeight: "700",
        },
      }}
      tabBar={(props) => <ScrollableTabBar {...props} tabMetaMap={tabMetaMap} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabHome"),
        }}
      />
      <Tabs.Screen
        name="jobs"
        options={{
          title: t("tabJobs"),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: t("tabInvoices"),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: t("tabAgenda"),
        }}
      />
      <Tabs.Screen
        name="quotes"
        options={{
          title: t("tabQuotes"),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: t("tabInbox"),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: t("tabStats"),
        }}
      />
      <Tabs.Screen
        name="other-services"
        options={{
          title: t("tabOtherServices"),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t("tabSettings"),
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="agenda-event-new"
        options={{
          href: null,
          title: t("newAgendaEvent"),
        }}
      />
    </Tabs>
  );
}
