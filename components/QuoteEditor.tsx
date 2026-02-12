import { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { formatCurrency } from "@/lib/utils/format";
import type { QuoteItem } from "@/types";
import { useI18n } from "@/lib/i18n";

const UNITS = ["ore", "pezzi", "metri", "metro quadro", "forfait"];

interface QuoteEditorProps {
  items: QuoteItem[];
  onItemsChange: (items: QuoteItem[]) => void;
  vatRate: number;
  onVatRateChange: (rate: number) => void;
  isAIDraft?: boolean;
}

export function QuoteEditor({
  items,
  onItemsChange,
  vatRate,
  onVatRateChange,
  isAIDraft,
}: QuoteEditorProps) {
  const { t } = useI18n();
  const [editingVat, setEditingVat] = useState(false);
  const [vatInput, setVatInput] = useState(vatRate.toString());

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const vatAmount = subtotal * (vatRate / 100);
  const total = subtotal + vatAmount;

  const updateItem = useCallback(
    (index: number, field: keyof QuoteItem, value: string) => {
      const updated = [...items];
      const item = { ...updated[index] };

      if (field === "description") {
        item.description = value;
      } else if (field === "quantity") {
        item.quantity = parseFloat(value) || 0;
        item.total = item.quantity * item.unit_price;
      } else if (field === "unit") {
        item.unit = value;
      } else if (field === "unit_price") {
        item.unit_price = parseFloat(value) || 0;
        item.total = item.quantity * item.unit_price;
      }

      updated[index] = item;
      onItemsChange(updated);
    },
    [items, onItemsChange]
  );

  const removeItem = useCallback(
    (index: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const updated = items.filter((_, i) => i !== index);
      onItemsChange(updated);
    },
    [items, onItemsChange]
  );

  const addItem = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onItemsChange([
      ...items,
      {
        description: "",
        quantity: 1,
        unit: "ore",
        unit_price: 0,
        total: 0,
      },
    ]);
  }, [items, onItemsChange]);

  const cycleUnit = useCallback(
    (index: number) => {
      const currentUnit = items[index].unit;
      const currentIdx = UNITS.indexOf(currentUnit);
      const nextIdx = (currentIdx + 1) % UNITS.length;
      updateItem(index, "unit", UNITS[nextIdx]);
      Haptics.selectionAsync();
    },
    [items, updateItem]
  );

  const handleVatSave = () => {
    const rate = parseFloat(vatInput);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      Alert.alert(t("error"), t("invalidVatRate"));
      return;
    }
    onVatRateChange(rate);
    setEditingVat(false);
  };

  const renderItem = ({ item, index }: { item: QuoteItem; index: number }) => (
    <View className="bg-white rounded-xl p-4 mb-2 mx-4 border border-gray-100">
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-2">
          <TextInput
            className="text-base font-medium text-gray-900 mb-2 border-b border-gray-200 pb-1"
            placeholder={t("descriptionPlaceholder")}
            placeholderTextColor="#9ca3af"
            value={item.description}
            onChangeText={(v) => updateItem(index, "description", v)}
          />
          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center">
              <Text className="text-xs text-muted mr-1">{t("qty")}</Text>
              <TextInput
                className="text-sm font-medium bg-gray-50 rounded px-2 py-1 w-14 text-center"
                keyboardType="decimal-pad"
                value={(item.quantity ?? (item as any).qty ?? 0).toString()}
                onChangeText={(v) => updateItem(index, "quantity", v)}
              />
            </View>
            <TouchableOpacity
              onPress={() => cycleUnit(index)}
              className="bg-gray-100 rounded px-2 py-1"
            >
              <Text className="text-xs text-gray-600">{item.unit}</Text>
            </TouchableOpacity>
            <View className="flex-row items-center">
              <Text className="text-xs text-muted mr-1">€</Text>
              <TextInput
                className="text-sm font-medium bg-gray-50 rounded px-2 py-1 w-20 text-center"
                keyboardType="decimal-pad"
                value={(item.unit_price ?? 0).toString()}
                onChangeText={(v) => updateItem(index, "unit_price", v)}
              />
            </View>
          </View>
        </View>
        <View className="items-end">
          <TouchableOpacity
            onPress={() => removeItem(index)}
            className="mb-2"
            hitSlop={8}
          >
            <MaterialCommunityIcons name="close-circle" size={22} color="#ef4444" />
          </TouchableOpacity>
          <Text className="text-base font-bold text-gray-900">
            {formatCurrency(item.total)}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View className="flex-1">
      {isAIDraft && (
        <View className="bg-blue-50 mx-4 rounded-xl p-3 mb-3 flex-row items-center">
          <Text className="text-2xl mr-2">🤖</Text>
          <Text className="text-sm text-primary font-medium flex-1">
            {t("aiDraftModify")}
          </Text>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderItem}
        ListFooterComponent={
          <View className="px-4 pb-4">
            {/* Add row button */}
            <TouchableOpacity
              onPress={addItem}
              className="flex-row items-center justify-center border border-dashed border-gray-300 rounded-xl py-3 mb-4"
            >
              <MaterialCommunityIcons name="plus" size={20} color="#6b7280" />
              <Text className="ml-2 text-gray-600 font-medium">
                {t("addRow")}
              </Text>
            </TouchableOpacity>

            {/* Totals */}
            <View className="bg-white rounded-xl p-4 border border-gray-100">
              <View className="flex-row justify-between mb-2">
                <Text className="text-sm text-muted">{t("subtotal")}</Text>
                <Text className="text-sm font-medium">
                  {formatCurrency(subtotal)}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => setEditingVat(true)}
                className="flex-row justify-between mb-2"
              >
                <Text className="text-sm text-muted">
                  {t("vatRate", { rate: String(vatRate) })}{" "}
                  <Text className="text-xs text-primary">✏️</Text>
                </Text>
                <Text className="text-sm font-medium">
                  {formatCurrency(vatAmount)}
                </Text>
              </TouchableOpacity>

              {editingVat && (
                <View className="flex-row items-center gap-2 mb-2 bg-gray-50 rounded p-2">
                  <Text className="text-sm text-muted">{t("vatRateLabel")}</Text>
                  <TextInput
                    className="text-sm font-medium bg-white rounded px-2 py-1 w-16 text-center border border-gray-200"
                    keyboardType="decimal-pad"
                    value={vatInput}
                    onChangeText={setVatInput}
                    autoFocus
                  />
                  <Text className="text-sm text-muted">%</Text>
                  <TouchableOpacity onPress={handleVatSave}>
                    <Text className="text-sm font-semibold text-primary">
                      OK
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <View className="border-t border-gray-200 pt-2 flex-row justify-between">
                <Text className="text-lg font-bold">{t("total")}</Text>
                <Text className="text-lg font-bold text-primary">
                  {formatCurrency(total)}
                </Text>
              </View>
            </View>
          </View>
        }
      />
    </View>
  );
}
