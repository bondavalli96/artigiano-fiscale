import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "./useAuth";
import type { Artisan } from "@/types";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LEGACY_CACHE_KEY = "artisan_profile";

function getUserScopedCacheKey(userId: string) {
  return `${LEGACY_CACHE_KEY}:${userId}`;
}

export function useArtisan() {
  const { user } = useAuth();
  const [artisan, setArtisan] = useState<Artisan | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchArtisan = useCallback(async () => {
    if (!user) {
      setArtisan(null);
      setLoading(false);
      await AsyncStorage.removeItem(LEGACY_CACHE_KEY);
      return;
    }

    try {
      const scopedKey = getUserScopedCacheKey(user.id);

      // Try user-scoped cache first
      const cached = await AsyncStorage.getItem(scopedKey);
      if (cached) {
        setArtisan(JSON.parse(cached));
        setLoading(false);
      }

      // Cleanup old non-scoped cache key left by previous versions.
      await AsyncStorage.removeItem(LEGACY_CACHE_KEY);

      // Fetch from DB
      const { data, error } = await supabase
        .from("artisans")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error && error.code !== "PGRST116") throw error;

      if (data) {
        setArtisan(data);
        await AsyncStorage.setItem(scopedKey, JSON.stringify(data));
      } else {
        setArtisan(null);
        await AsyncStorage.removeItem(scopedKey);
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
