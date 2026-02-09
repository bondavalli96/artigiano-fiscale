import { Stack } from "expo-router";
import { EmptyState } from "@/components/EmptyState";

export default function InvoicesScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Fatture" }} />
      <EmptyState
        icon="currency-eur"
        title="Nessuna fattura"
        description="Le fatture appariranno qui quando convertirai un preventivo"
      />
    </>
  );
}
