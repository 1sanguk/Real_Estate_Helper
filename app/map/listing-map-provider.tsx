'use client';

import { useCallback, useState } from 'react';
import type { OfficialListing } from '@/domain/dashboard';
import { ListingMap, type ListingMapMetadata } from './listing-map';
import { NaverListingMap } from './naver-listing-map';

type ListingMapProviderProps = {
  listings: OfficialListing[];
  focusedRegion: string;
  metadata: ListingMapMetadata;
  onListingSelect: (listingId: string) => void;
  onToggleSaved: (listingId: string) => void;
  onVisibleListingIdsChange: (listingIds: string[]) => void;
};

export function ListingMapProvider(props: ListingMapProviderProps) {
  const clientId = process.env.NEXT_PUBLIC_NCP_MAPS_CLIENT_ID;
  const [useFallback, setUseFallback] = useState(!clientId);
  const activateFallback = useCallback(() => setUseFallback(true), []);

  if (useFallback || !clientId) {
    return <><ListingMap {...props} />{useFallback && clientId && <output className="mt-2 block text-xs text-muted-foreground">네이버 지도를 불러오지 못해 기본 지도로 전환했습니다.</output>}</>;
  }
  return <NaverListingMap clientId={clientId} {...props} onFailure={activateFallback} />;
}
