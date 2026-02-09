import { Stack } from "expo-router";
import { EmptyState } from "@/components/EmptyState";

export default function QuotesScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Preventivi" }} />
      <EmptyState
        icon="file-document-outline"
        title="Nessun preventivo"
        description="Crea un lavoro e poi genera il preventivo"
      />
    </>
  );
}
