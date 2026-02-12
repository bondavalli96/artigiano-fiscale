import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
} from "react-native";
import { Stack } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useArtisan } from "@/hooks/useArtisan";
import { formatCurrency } from "@/lib/utils/format";
import { useI18n } from "@/lib/i18n";
import type { PriceListItem } from "@/types";

export default function PriceListScreen() {
  const { artisan } = useArtisan();
  const { t, locale } = useI18n();
  const [items, setItems] = useState<PriceListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newDesc, setNewDesc] = useState("");
  const [newUnit, setNewUnit] = useState("ore");
  const [newPrice, setNewPrice] = useState("");

  const fetchItems = useCallback(async () => {
    if (!artisan) return;

    const { data } = await supabase
      .from("price_list")
      .select("*")
      .eq("artisan_id", artisan.id)
      .order("usage_count", { ascending: false });

    setItems(data || []);
    setLoading(false);
  }, [artisan]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAdd = async () => {
    if (!artisan || !newDesc.trim()) return;

    try {
      const { error } = await supabase.from("price_list").insert({
        artisan_id: artisan.id,
        description: newDesc.trim(),
        unit: newUnit,
        default_price: parseFloat(newPrice) || null,
        category: "manodopera",
      });

      if (error) throw error;
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
      setNewDesc("");
      setNewPrice("");
      setAdding(false);
      fetchItems();
    } catch (err: any) {
      Alert.alert(t("error"), err.message);
    }
  };

  const startEdit = (item: PriceListItem) => {
    setEditingId(item.id);
    setNewDesc(item.description);
    setNewUnit(item.unit);
    setNewPrice(item.default_price ? String(item.default_price) : "");
    setAdding(true);
  };

  const handleUpdate = async () => {
    if (!editingId || !newDesc.trim()) return;

    try {
      const { error } = await supabase
        .from("price_list")
        .update({
          description: newDesc.trim(),
          unit: newUnit,
          default_price: parseFloat(newPrice) || null,
        })
        .eq("id", editingId);

      if (error) throw error;
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
      );
      setNewDesc("");
      setNewPrice("");
      setAdding(false);
      setEditingId(null);
      fetchItems();
    } catch (err: any) {
      Alert.alert(t("error"), err.message);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(t("delete"), t("deleteItem"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          await supabase.from("price_list").delete().eq("id", id);
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          fetchItems();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: t("priceListTitle") }} />
        <View className="flex-1 items-center justify-center bg-white">
          <Text className="text-muted">{t("loading")}</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: t("priceListTitle") }} />
      <View className="flex-1 bg-gray-50">
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
          ListHeaderComponent={
            adding ? (
              <View className="bg-white mx-4 mb-3 rounded-xl p-4 border border-primary">
                <TextInput
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50 mb-2"
                  placeholder={t("itemDescPlaceholder")}
                  placeholderTextColor="#9ca3af"
                  value={newDesc}
                  onChangeText={setNewDesc}
                  autoFocus
                />
                <View className="flex-row gap-2 mb-3">
                  <TextInput
                    className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                    placeholder={t("unitPlaceholder")}
                    placeholderTextColor="#9ca3af"
                    value={newUnit}
                    onChangeText={setNewUnit}
                  />
                  <TextInput
                    className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
                    placeholder={t("priceEur")}
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                    value={newPrice}
                    onChangeText={setNewPrice}
                  />
                </View>
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => {
                      setAdding(false);
                      setEditingId(null);
                    }}
                    className="flex-1 border border-gray-300 rounded-xl py-2.5 items-center"
                  >
                    <Text className="text-gray-600">{t("cancel")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={editingId ? handleUpdate : handleAdd}
                    className="flex-1 bg-primary rounded-xl py-2.5 items-center"
                  >
                    <Text className="text-white font-semibold">
                      {editingId ? t("save") : t("add")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => startEdit(item)}
              className="bg-white mx-4 mb-2 rounded-xl p-4 flex-row items-center"
              activeOpacity={0.7}
            >
              <View className="flex-1">
                <Text className="text-base font-medium">
                  {item.description}
                </Text>
                <Text className="text-xs text-muted">
                  {item.unit}
                  {item.category ? ` · ${item.category}` : ""}
                  {item.usage_count > 0
                    ? ` · ${t("usedCount", { count: String(item.usage_count) })}`
                    : ""}
                </Text>
              </View>
              {item.default_price && (
                <Text className="text-base font-semibold text-primary mr-3">
                  {formatCurrency(item.default_price, locale)}
                </Text>
              )}
              <TouchableOpacity
                onPress={() => handleDelete(item.id)}
                hitSlop={8}
              >
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={20}
                  color="#ef4444"
                />
              </TouchableOpacity>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View className="items-center py-8">
              <Text className="text-muted">
                {t("noItems")}
              </Text>
            </View>
          }
        />

        {/* Add button */}
        {!adding && (
          <View className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-5 py-4">
            <TouchableOpacity
              onPress={() => setAdding(true)}
              className="bg-primary rounded-xl py-4 items-center flex-row justify-center"
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="plus" size={20} color="white" />
              <Text className="text-white text-base font-semibold ml-2">
                {t("newItem")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </>
  );
}
