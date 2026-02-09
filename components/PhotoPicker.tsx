import { View, Text, TouchableOpacity, Image, ScrollView, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

interface PhotoPickerProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
}

export function PhotoPicker({
  photos,
  onPhotosChange,
  maxPhotos = 5,
}: PhotoPickerProps) {
  const pickImage = async (useCamera: boolean) => {
    if (photos.length >= maxPhotos) {
      Alert.alert("Limite raggiunto", `Massimo ${maxPhotos} foto`);
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      quality: 0.7,
      allowsMultipleSelection: !useCamera,
      selectionLimit: maxPhotos - photos.length,
    };

    let result;
    if (useCamera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permesso negato", "Consenti l'accesso alla fotocamera nelle impostazioni");
        return;
      }
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permesso negato", "Consenti l'accesso alla galleria nelle impostazioni");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync(options);
    }

    if (!result.canceled && result.assets.length > 0) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const newUris = result.assets.map((asset) => asset.uri);
      onPhotosChange([...photos, ...newUris].slice(0, maxPhotos));
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  return (
    <View>
      {/* Photo thumbnails */}
      {photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="mb-3"
          contentContainerStyle={{ gap: 8 }}
        >
          {photos.map((uri, index) => (
            <View key={index} className="relative">
              <Image
                source={{ uri }}
                className="w-20 h-20 rounded-lg"
                resizeMode="cover"
              />
              <TouchableOpacity
                onPress={() => removePhoto(index)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full items-center justify-center"
              >
                <MaterialCommunityIcons name="close" size={14} color="white" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Action buttons */}
      <View className="flex-row gap-3">
        <TouchableOpacity
          onPress={() => pickImage(true)}
          className="flex-1 flex-row items-center justify-center border border-gray-300 rounded-xl py-3"
        >
          <MaterialCommunityIcons name="camera" size={20} color="#6b7280" />
          <Text className="ml-2 text-gray-700">Fotocamera</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => pickImage(false)}
          className="flex-1 flex-row items-center justify-center border border-gray-300 rounded-xl py-3"
        >
          <MaterialCommunityIcons name="image" size={20} color="#6b7280" />
          <Text className="ml-2 text-gray-700">Galleria</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-xs text-muted mt-1 text-center">
        {photos.length}/{maxPhotos} foto
      </Text>
    </View>
  );
}
