import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-primary">
        ArtigianoAI
      </Text>
      <Text className="mt-2 text-base text-muted">
        Il tuo copilota per lavori, preventivi e fatture
      </Text>
    </View>
  );
}
