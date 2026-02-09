import { useState, useEffect } from "react";
import { View, Text } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { MaterialCommunityIcons } from "@expo/vector-icons";

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!(state.isConnected && state.isInternetReachable !== false));
    });

    return () => unsubscribe();
  }, []);

  if (!isOffline) return null;

  return (
    <View className="bg-yellow-500 px-4 py-2 flex-row items-center justify-center">
      <MaterialCommunityIcons name="wifi-off" size={16} color="white" />
      <Text className="text-white text-sm font-medium ml-2">
        Sei offline — alcune funzioni non sono disponibili
      </Text>
    </View>
  );
}
