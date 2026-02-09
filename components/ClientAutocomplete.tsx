import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import type { Client } from "@/types";

interface ClientAutocompleteProps {
  artisanId: string;
  selectedClient: Client | null;
  onSelect: (client: Client | null) => void;
}

export function ClientAutocomplete({
  artisanId,
  selectedClient,
  onSelect,
}: ClientAutocompleteProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Client[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const search = async () => {
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("artisan_id", artisanId)
        .ilike("name", `%${query}%`)
        .limit(5);
      setResults(data || []);
    };

    const timeout = setTimeout(search, 300);
    return () => clearTimeout(timeout);
  }, [query, artisanId]);

  const handleSelect = (client: Client) => {
    onSelect(client);
    setQuery(client.name);
    setShowDropdown(false);
  };

  const handleCreateNew = async () => {
    if (!newName.trim()) return;

    const { data, error } = await supabase
      .from("clients")
      .insert({
        artisan_id: artisanId,
        name: newName.trim(),
        phone: newPhone.trim() || null,
      })
      .select()
      .single();

    if (!error && data) {
      onSelect(data);
      setQuery(data.name);
      setShowNewForm(false);
      setNewName("");
      setNewPhone("");
    }
  };

  if (selectedClient) {
    return (
      <View className="flex-row items-center bg-blue-50 rounded-xl px-4 py-3">
        <MaterialCommunityIcons name="account" size={20} color="#2563eb" />
        <Text className="flex-1 ml-2 text-base font-medium">
          {selectedClient.name}
        </Text>
        <TouchableOpacity
          onPress={() => {
            onSelect(null);
            setQuery("");
          }}
        >
          <MaterialCommunityIcons name="close" size={20} color="#6b7280" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <TextInput
        className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-gray-50"
        placeholder="Cerca cliente o aggiungi nuovo..."
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setShowDropdown(true);
        }}
        onFocus={() => setShowDropdown(true)}
      />

      {showDropdown && (query.length >= 2 || showNewForm) && (
        <View className="border border-gray-200 rounded-xl mt-1 bg-white overflow-hidden">
          {results.map((client) => (
            <TouchableOpacity
              key={client.id}
              onPress={() => handleSelect(client)}
              className="px-4 py-3 border-b border-gray-100 flex-row items-center"
            >
              <MaterialCommunityIcons
                name="account"
                size={18}
                color="#6b7280"
              />
              <View className="ml-2">
                <Text className="font-medium">{client.name}</Text>
                {client.phone && (
                  <Text className="text-xs text-muted">{client.phone}</Text>
                )}
              </View>
            </TouchableOpacity>
          ))}

          {!showNewForm ? (
            <TouchableOpacity
              onPress={() => {
                setShowNewForm(true);
                setNewName(query);
              }}
              className="px-4 py-3 flex-row items-center"
            >
              <MaterialCommunityIcons
                name="account-plus"
                size={18}
                color="#2563eb"
              />
              <Text className="ml-2 text-primary font-medium">
                Crea nuovo cliente
              </Text>
            </TouchableOpacity>
          ) : (
            <View className="p-3">
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2 mb-2 text-sm"
                placeholder="Nome cliente"
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                className="border border-gray-300 rounded-lg px-3 py-2 mb-2 text-sm"
                placeholder="Telefono (opzionale)"
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
              />
              <View className="flex-row gap-2">
                <TouchableOpacity
                  onPress={() => setShowNewForm(false)}
                  className="flex-1 border border-gray-300 rounded-lg py-2 items-center"
                >
                  <Text className="text-gray-700 text-sm">Annulla</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleCreateNew}
                  className="flex-1 bg-primary rounded-lg py-2 items-center"
                >
                  <Text className="text-white text-sm font-medium">Crea</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}
