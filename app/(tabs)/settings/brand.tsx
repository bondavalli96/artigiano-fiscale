import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { useI18n } from "@/lib/i18n";

export default function BrandSettingsScreen() {
  const { artisan, refetch } = useArtisan();
  const { t } = useI18n();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (artisan?.logo_url) {
      setLogoUrl(artisan.logo_url);
    }
  }, [artisan]);

  const pickAndUploadLogo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("permissionDenied"), t("logoGalleryPermission"));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [3, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const ext = asset.uri.split(".").pop() || "jpg";
      const fileName = `logo_${artisan!.id}_${Date.now()}.${ext}`;

      const response = await fetch(asset.uri);
      const blob = await response.blob();

      const { error: uploadError } = await supabase.storage
        .from("logos")
        .upload(fileName, blob, {
          contentType: asset.mimeType || `image/${ext}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("logos")
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      const { error: updateError } = await supabase
        .from("artisans")
        .update({ logo_url: publicUrl })
        .eq("id", artisan!.id);

      if (updateError) throw updateError;

      setLogoUrl(publicUrl);
      await refetch();
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert(t("logoUploaded"), t("logoUploadedMsg"));
    } catch (err: any) {
      Alert.alert(t("error"), err.message || t("logoUploadFailed"));
    } finally {
      setUploading(false);
    }
  };

  const removeLogo = async () => {
    Alert.alert(t("removeLogo"), t("removeLogoConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("remove"),
        style: "destructive",
        onPress: async () => {
          setRemoving(true);
          try {
            const { error } = await supabase
              .from("artisans")
              .update({ logo_url: null })
              .eq("id", artisan!.id);

            if (error) throw error;

            setLogoUrl(null);
            await refetch();
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Success
            );
          } catch (err: any) {
            Alert.alert(t("error"), err.message);
          } finally {
            setRemoving(false);
          }
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: t("brandTitle") }} />
      <View className="flex-1 bg-gray-50 pt-4">
        {/* Logo section */}
        <View className="bg-white mx-4 rounded-xl p-5 mb-4">
          <Text className="text-base font-semibold mb-1">{t("businessLogo")}</Text>
          <Text className="text-sm text-muted mb-4">
            {t("logoDesc")}
          </Text>

          {logoUrl ? (
            <View className="items-center mb-4">
              <View className="bg-gray-50 rounded-xl p-4 w-full items-center">
                <Image
                  source={{ uri: logoUrl }}
                  style={{ width: 200, height: 80 }}
                  resizeMode="contain"
                />
              </View>
            </View>
          ) : (
            <View className="items-center mb-4">
              <View className="bg-gray-50 rounded-xl p-8 w-full items-center">
                <MaterialCommunityIcons
                  name="image-plus"
                  size={48}
                  color="#9ca3af"
                />
                <Text className="text-sm text-muted mt-2">
                  {t("noLogo")}
                </Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={pickAndUploadLogo}
            disabled={uploading}
            className="bg-primary rounded-xl py-3.5 items-center mb-2"
            activeOpacity={0.8}
          >
            {uploading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <View className="flex-row items-center">
                <MaterialCommunityIcons name="upload" size={20} color="white" />
                <Text className="text-white font-semibold ml-2">
                  {logoUrl ? t("changeLogo") : t("uploadLogo")}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {logoUrl && (
            <TouchableOpacity
              onPress={removeLogo}
              disabled={removing}
              className="border border-danger rounded-xl py-3 items-center"
              activeOpacity={0.8}
            >
              {removing ? (
                <ActivityIndicator size="small" color="#dc2626" />
              ) : (
                <Text className="text-danger font-semibold">{t("removeLogo")}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Info */}
        <View className="mx-4 bg-blue-50 rounded-xl p-4">
          <View className="flex-row items-start">
            <MaterialCommunityIcons
              name="information"
              size={20}
              color="#2563eb"
            />
            <Text className="text-sm text-blue-800 ml-2 flex-1">
              {t("logoFormats")}
            </Text>
          </View>
        </View>
      </View>
    </>
  );
}
