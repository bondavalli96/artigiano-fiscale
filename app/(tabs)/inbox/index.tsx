import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Alert,
  TextInput,
  ActionSheetIOS,
  Platform,
  RefreshControl,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { useI18n } from "@/lib/i18n";
import { useInbox } from "@/hooks/useInbox";
import { InboxItemCard } from "@/components/InboxItemCard";
import type { InboxItem, InboxItemStatus } from "@/types";

// Import useArtisan hook
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

function useArtisanId() {
  const [artisanId, setArtisanId] = useState<string | undefined>();
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const { data } = await supabase
          .from("artisans")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (data) setArtisanId(data.id);
      }
    });
  }, []);
  return artisanId;
}

type FilterType = "all" | InboxItemStatus;

const FILTERS: { key: FilterType; labelKey: string }[] = [
  { key: "all", labelKey: "inboxAll" },
  { key: "new", labelKey: "inboxNew" },
  { key: "classified", labelKey: "inboxClassified" },
  { key: "routed", labelKey: "inboxRouted" },
];

export default function InboxScreen() {
  const { t } = useI18n();
  const artisanId = useArtisanId();
  const {
    items,
    loading,
    filter,
    setFilter,
    refresh,
    uploadAndClassify,
  } = useInbox(artisanId);

  const [uploading, setUploading] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [textInput, setTextInput] = useState("");

  const filteredItems = filter === "all"
    ? items
    : items.filter((i) => i.status === filter);

  const handleAddPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const options = [
      t("inboxAddPhoto"),
      t("inboxAddGallery"),
      t("inboxAddDocument"),
      t("inboxAddText"),
      t("cancel"),
    ];

    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options,
          cancelButtonIndex: options.length - 1,
        },
        (buttonIndex) => {
          handleAction(buttonIndex);
        }
      );
    } else {
      Alert.alert(
        t("inboxTitle"),
        undefined,
        [
          { text: t("inboxAddPhoto"), onPress: () => handleAction(0) },
          { text: t("inboxAddGallery"), onPress: () => handleAction(1) },
          { text: t("inboxAddDocument"), onPress: () => handleAction(2) },
          { text: t("inboxAddText"), onPress: () => handleAction(3) },
          { text: t("cancel"), style: "cancel" },
        ]
      );
    }
  }, [t]);

  const handleAction = async (index: number) => {
    try {
      if (index === 0) {
        // Camera
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t("permissionDenied"), t("allowCameraAccess"));
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          quality: 0.8,
          allowsEditing: false,
        });
        if (!result.canceled && result.assets[0]) {
          await handleUpload(
            result.assets[0].uri,
            "image",
            "photo.jpg",
            "image/jpeg"
          );
        }
      } else if (index === 1) {
        // Gallery
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert(t("permissionDenied"), t("allowGalleryAccess"));
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          quality: 0.8,
          allowsEditing: false,
        });
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          const ext = asset.uri.split(".").pop() || "jpg";
          await handleUpload(
            asset.uri,
            "image",
            `gallery.${ext}`,
            asset.mimeType || "image/jpeg"
          );
        }
      } else if (index === 2) {
        // Document
        const result = await DocumentPicker.getDocumentAsync({
          type: ["application/pdf", "image/*", "application/xml", "text/*"],
          copyToCacheDirectory: true,
        });
        if (!result.canceled && result.assets[0]) {
          const asset = result.assets[0];
          const fileType = asset.mimeType?.startsWith("image/")
            ? "image"
            : asset.mimeType === "application/pdf"
            ? "pdf"
            : "document";
          await handleUpload(
            asset.uri,
            fileType,
            asset.name,
            asset.mimeType || "application/octet-stream"
          );
        }
      } else if (index === 3) {
        // Text input
        setShowTextModal(true);
      }
    } catch (err) {
      Alert.alert(t("error"), (err as Error).message);
    }
  };

  const handleUpload = async (
    uri: string,
    fileType: string,
    fileName: string,
    mimeType: string
  ) => {
    setUploading(true);
    try {
      await uploadAndClassify({
        fileUri: uri,
        fileType,
        fileName,
        mimeType,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert(t("error"), (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    setShowTextModal(false);
    setUploading(true);
    try {
      await uploadAndClassify({
        fileType: "text",
        rawText: textInput.trim(),
      });
      setTextInput("");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert(t("error"), (err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleItemPress = (item: InboxItem) => {
    router.push(`/(tabs)/inbox/${item.id}`);
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={["top"]}>
      {/* Header */}
      <View className="px-4 pt-2 pb-3">
        <Text className="text-2xl font-bold text-gray-900">
          {t("inboxTitle")}
        </Text>
      </View>

      {/* Filter chips */}
      <View className="flex-row px-4 mb-3 gap-2">
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => {
              setFilter(f.key);
              Haptics.selectionAsync();
            }}
            className={`px-3 py-1.5 rounded-full ${
              filter === f.key ? "bg-blue-600" : "bg-white border border-gray-200"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                filter === f.key ? "text-white" : "text-gray-600"
              }`}
            >
              {t(f.labelKey as any)}
              {f.key === "all" && items.length > 0
                ? ` (${items.length})`
                : f.key !== "all"
                ? ` (${items.filter((i) => i.status === f.key).length})`
                : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Uploading indicator */}
      {uploading && (
        <View className="flex-row items-center justify-center py-2 mx-4 mb-2 bg-blue-50 rounded-xl">
          <ActivityIndicator size="small" color="#2563eb" />
          <Text className="ml-2 text-sm text-blue-600 font-medium">
            {t("inboxUploadingFile")}
          </Text>
        </View>
      )}

      {/* List */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InboxItemCard item={item} onPress={handleItemPress} />
        )}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} />
        }
        ListEmptyComponent={
          !loading ? (
            <View className="items-center justify-center py-20 px-8">
              <MaterialCommunityIcons
                name="inbox-arrow-down"
                size={64}
                color="#d1d5db"
              />
              <Text className="text-lg font-semibold text-gray-400 mt-4 text-center">
                {t("inboxEmpty")}
              </Text>
              <Text className="text-sm text-gray-400 mt-1 text-center">
                {t("inboxEmptyDesc")}
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* FAB */}
      <TouchableOpacity
        onPress={handleAddPress}
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-blue-600 items-center justify-center"
        style={{
          shadowColor: "#2563eb",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        <MaterialCommunityIcons name="plus" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Text input modal */}
      <Modal visible={showTextModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-end"
        >
          <View className="bg-white rounded-t-3xl px-4 pt-4 pb-8" style={{
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.1,
            shadowRadius: 12,
          }}>
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold">{t("inboxAddText")}</Text>
              <TouchableOpacity onPress={() => setShowTextModal(false)}>
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color="#6b7280"
                />
              </TouchableOpacity>
            </View>
            <TextInput
              className="border border-gray-200 rounded-xl p-3 text-base min-h-[120px] text-gray-900"
              placeholder={t("inboxTextPlaceholder")}
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              value={textInput}
              onChangeText={setTextInput}
              autoFocus
            />
            <TouchableOpacity
              onPress={handleTextSubmit}
              disabled={!textInput.trim()}
              className={`mt-3 py-3 rounded-xl items-center ${
                textInput.trim() ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <Text
                className={`text-base font-semibold ${
                  textInput.trim() ? "text-white" : "text-gray-400"
                }`}
              >
                {t("inboxSendText")}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
