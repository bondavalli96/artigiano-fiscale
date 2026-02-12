import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { InboxItem, InboxItemStatus } from "@/types";

export function useInbox(artisanId: string | undefined) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | InboxItemStatus>("all");

  const fetchItems = useCallback(async () => {
    if (!artisanId) return;
    setLoading(true);

    let query = supabase
      .from("inbox_items")
      .select("*")
      .eq("artisan_id", artisanId)
      .order("created_at", { ascending: false });

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;

    if (!error && data) {
      setItems(data as InboxItem[]);
    }
    setLoading(false);
  }, [artisanId, filter]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Realtime subscription
  useEffect(() => {
    if (!artisanId) return;

    const channel = supabase
      .channel("inbox-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inbox_items",
          filter: `artisan_id=eq.${artisanId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setItems((prev) => [payload.new as InboxItem, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            setItems((prev) =>
              prev.map((item) =>
                item.id === (payload.new as InboxItem).id
                  ? (payload.new as InboxItem)
                  : item
              )
            );
          } else if (payload.eventType === "DELETE") {
            setItems((prev) =>
              prev.filter(
                (item) => item.id !== (payload.old as { id: string }).id
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [artisanId]);

  const uploadAndClassify = useCallback(
    async (params: {
      fileUri?: string;
      fileType: string;
      fileName?: string;
      rawText?: string;
      mimeType?: string;
    }) => {
      if (!artisanId) throw new Error("No artisan ID");

      let fileUrl: string | null = null;

      // Upload file to storage if provided
      if (params.fileUri) {
        const response = await fetch(params.fileUri);
        const blob = await response.blob();
        const ext = params.fileName?.split(".").pop() || "jpg";
        const path = `${artisanId}/${Date.now()}.${ext}`;

        const { error: uploadErr } = await supabase.storage
          .from("inbox")
          .upload(path, blob, {
            contentType: params.mimeType || "application/octet-stream",
            upsert: false,
          });

        if (uploadErr) throw uploadErr;

        const {
          data: { publicUrl },
        } = supabase.storage.from("inbox").getPublicUrl(path);
        fileUrl = publicUrl;
      }

      // Create inbox item
      const { data: newItem, error: insertErr } = await supabase
        .from("inbox_items")
        .insert({
          artisan_id: artisanId,
          source: "manual",
          file_url: fileUrl,
          file_type: params.fileType,
          file_name: params.fileName || null,
          raw_text: params.rawText || null,
          status: "new",
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;

      // Trigger classification
      const { error: classifyErr } = await supabase.functions.invoke(
        "classify-inbox-item",
        {
          body: { inboxItemId: newItem.id },
        }
      );

      if (classifyErr) {
        console.warn("Classification trigger failed:", classifyErr);
      }

      return newItem.id;
    },
    [artisanId]
  );

  const routeItem = useCallback(
    async (
      inboxItemId: string,
      overrideClassification?: string,
      overrideData?: Record<string, unknown>
    ) => {
      const { data, error } = await supabase.functions.invoke(
        "route-inbox-item",
        {
          body: { inboxItemId, overrideClassification, overrideData },
        }
      );

      if (error) throw error;
      return data;
    },
    []
  );

  const deleteItem = useCallback(async (inboxItemId: string) => {
    // Delete file from storage if exists
    const item = items.find((i) => i.id === inboxItemId);
    if (item?.file_url) {
      const urlParts = item.file_url.split("/inbox/");
      if (urlParts[1]) {
        await supabase.storage.from("inbox").remove([urlParts[1]]);
      }
    }

    const { error } = await supabase
      .from("inbox_items")
      .delete()
      .eq("id", inboxItemId);

    if (error) throw error;

    setItems((prev) => prev.filter((i) => i.id !== inboxItemId));
  }, [items]);

  const retryClassify = useCallback(async (inboxItemId: string) => {
    await supabase
      .from("inbox_items")
      .update({ status: "new", error_message: null })
      .eq("id", inboxItemId);

    const { error } = await supabase.functions.invoke(
      "classify-inbox-item",
      {
        body: { inboxItemId },
      }
    );

    if (error) throw error;
  }, []);

  return {
    items,
    loading,
    filter,
    setFilter,
    refresh: fetchItems,
    uploadAndClassify,
    routeItem,
    deleteItem,
    retryClassify,
  };
}
