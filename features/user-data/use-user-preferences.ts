'use client';
import { useCallback, useEffect, useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase/client';

export function useUserPreferences(userId: string | undefined) {
  const [savedListingIds, setSavedListingIds] = useState<string[]>([]);
  const [checkedDocumentIds, setCheckedDocumentIds] = useState<number[]>([]);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client || !userId) {
      setSavedListingIds([]);
      setCheckedDocumentIds([]);
      return;
    }
    void Promise.all([
      client
        .from('saved_listings')
        .select('source_listing_id')
        .eq('user_id', userId),
      client
        .from('document_checks')
        .select('document_key')
        .eq('user_id', userId)
        .eq('is_ready', true),
    ]).then(([savedResult, documentResult]) => {
      if (!savedResult.error)
        setSavedListingIds(
          savedResult.data.map((row) => String(row.source_listing_id)),
        );
      if (!documentResult.error)
        setCheckedDocumentIds(
          documentResult.data.map((row) => Number(row.document_key)),
        );
    });
  }, [userId]);

  const toggleSavedListing = useCallback(
    async (listingId: string) => {
      const client = getSupabaseClient();
      if (!client || !userId) return false;
      const isSaved = savedListingIds.includes(listingId);
      const result = isSaved
        ? await client
            .from('saved_listings')
            .delete()
            .eq('user_id', userId)
            .eq('source_listing_id', String(listingId))
        : await client
            .from('saved_listings')
            .insert({ user_id: userId, source_listing_id: String(listingId) });
      if (result.error) throw result.error;
      setSavedListingIds((current) =>
        isSaved
          ? current.filter((id) => id !== listingId)
          : [...current, listingId],
      );
      return true;
    },
    [savedListingIds, userId],
  );

  const toggleDocument = useCallback(
    async (documentId: number) => {
      const client = getSupabaseClient();
      if (!client || !userId) return false;
      const isReady = checkedDocumentIds.includes(documentId);
      const { error } = await client
        .from('document_checks')
        .upsert({
          user_id: userId,
          document_key: String(documentId),
          is_ready: !isReady,
          updated_at: new Date().toISOString(),
        });
      if (error) throw error;
      setCheckedDocumentIds((current) =>
        isReady
          ? current.filter((id) => id !== documentId)
          : [...current, documentId],
      );
      return true;
    },
    [checkedDocumentIds, userId],
  );

  return {
    savedListingIds,
    checkedDocumentIds,
    toggleSavedListing,
    toggleDocument,
  };
}
