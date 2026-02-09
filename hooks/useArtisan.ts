import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import type { Artisan } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CACHE_KEY = "artisan_profile";

export function useArtisan() {
  const { user } = useAuth();
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchArtisan = useCallback(async () => {
    if (!user) {
      setArtisan(null);
      setLoading(false);
      return;
    }

    try {
      // Try cache first
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        setArtisan(JSON.parse(cached));
        setLoading(false);
      }

      // Fetch from DB
      const { data, error } = await supabase
        .from("artisans")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setArtisan(data);
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
      } else {
        setArtisan(null);
        await AsyncStorage.removeItem(CACHE_KEY);
      }
    } catch (err) {
      console.error("Error fetching artisan:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchArtisan();
  }, [fetchArtisan]);

  return { artisan, loading, refetch: fetchArtisan };
}
