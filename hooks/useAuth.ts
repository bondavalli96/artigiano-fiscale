import { useEffect, useState } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

const LEGACY_ARTISAN_CACHE_KEY = "artisan_profile";

async function clearLocalAuthState() {
  // Local-only sign out clears corrupted/stale persisted session without server-side dependency.
  await supabase.auth.signOut({ scope: "local" });
  await AsyncStorage.removeItem(LEGACY_ARTISAN_CACHE_KEY);
}

async function validateSession(initialSession: Session | null) {
  if (!initialSession) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    await clearLocalAuthState();
    return null;
  }

  return initialSession;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(async ({ data: { session } }) => {
        const validSession = await validateSession(session);
        setSession(validSession);
        setUser(validSession?.user ?? null);
      })
      .catch(async () => {
        await clearLocalAuthState();
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") {
        await AsyncStorage.removeItem(LEGACY_ARTISAN_CACHE_KEY);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return { session, user, loading, signIn, signUp, signOut };
}
