import { View, Text } from "react-native";
import { Stack } from "expo-router";
import { EmptyState } from "@/components/EmptyState";
import { router } from "expo-router";

export default function JobsScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Lavori" }} />
      <EmptyState
        icon="hammer"
        title="Nessun lavoro"
        description="Aggiungi il tuo primo lavoro per iniziare"
        actionLabel="+ Nuovo Lavoro"
        onAction={() => router.push("/(tabs)/jobs/new")}
      />
    </>
  );
}
