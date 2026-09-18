'use client';

import { useEffect, useRef, useState } from 'react';
import type { OfficialListing } from '@/domain/dashboard';
import { AGENCY_COLORS, KOREA_CENTER, REGION_CENTERS, approximateCoordinates, createListingPopup, type ListingMapMetadata } from './listing-map';

const NAVER_MAP_SCRIPT_ID = 'naver-map-sdk';
const NAVER_MAP_LOAD_TIMEOUT_MS = 10_000;
const NAVER_MAP_AUTH_FAILURE_EVENT = 'naver-map-auth-failure';

declare global {
  interface Window {
    navermap_authFailure?: () => void;
  }
}

function loadNaverMapSdk(clientId: string): Promise<void> {
  if (typeof naver !== 'undefined' && naver.maps) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(NAVER_MAP_SCRIPT_ID) as HTMLScriptElement | null;
    const timeoutId = window.setTimeout(() => reject(new Error('네이버 지도 SDK 로딩 시간 초과')), NAVER_MAP_LOAD_TIMEOUT_MS);
    const complete = (callback: () => void) => { window.clearTimeout(timeoutId); callback(); };
    window.navermap_authFailure = () => {
      window.dispatchEvent(new Event(NAVER_MAP_AUTH_FAILURE_EVENT));
      complete(() => reject(new Error('네이버 지도 인증 실패')));
    };
    const script = existingScript ?? document.createElement('script');
    script.id = NAVER_MAP_SCRIPT_ID;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}&submodules=geocoder`;
    script.async = true;
    script.addEventListener('load', () => complete(() => typeof naver !== 'undefined' && naver.maps ? resolve() : reject(new Error('네이버 지도 초기화 실패'))), { once: true });
    script.addEventListener('error', () => complete(() => reject(new Error('네이버 지도 SDK 로딩 실패'))), { once: true });
    if (!existingScript) document.head.append(script);
  });
}

function geocodeWithNaver(listing: OfficialListing): Promise<naver.maps.LatLng | null> {
  if (!listing.address) return Promise.resolve(null);
  const query = listing.address.includes(listing.region) ? listing.address : `${listing.region} ${listing.address}`;
  return new Promise((resolve) => {
    naver.maps.Service.geocode({ query }, (status, response) => {
      const address = status === naver.maps.Service.Status.OK ? response.v2.addresses[0] : undefined;
      resolve(address ? new naver.maps.LatLng(Number(address.y), Number(address.x)) : null);
    });
  });
}

function markerContent(listing: OfficialListing, exact: boolean) {
  const color = AGENCY_COLORS[listing.agency];
  const safeTitle = listing.title.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return `<button type="button" title="${listing.agency} ${safeTitle}" style="width:36px;height:36px;border-radius:9999px;border:2px ${exact ? 'solid' : 'dashed'} white;background:${color};color:white;font-size:12px;font-weight:900;box-shadow:0 4px 10px rgb(0 0 0 / 25%);cursor:pointer">${listing.agency}</button>`;
}

function clusterContent(count: number) {
  return `<button type="button" title="이 지역 공고 ${count}건" style="width:44px;height:44px;border-radius:9999px;border:3px solid white;background:#4338ca;color:white;font-size:13px;font-weight:900;box-shadow:0 4px 12px rgb(0 0 0 / 30%);cursor:pointer">${count}</button>`;
}

export function NaverListingMap({ clientId, listings, focusedRegion, metadata, onListingSelect, onToggleSaved, onVisibleListingIdsChange, onFailure }: { clientId: string; listings: OfficialListing[]; focusedRegion: string; metadata: ListingMapMetadata; onListingSelect: (listingId: string) => void; onToggleSaved: (listingId: string) => void; onVisibleListingIdsChange: (listingIds: string[]) => void; onFailure: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<naver.maps.Map | null>(null);
  const markersRef = useRef<naver.maps.Marker[]>([]);
  const infoWindowsRef = useRef<naver.maps.InfoWindow[]>([]);
  const resolvedPositionsRef = useRef<Record<string, naver.maps.LatLng>>({});
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(7);

  useEffect(() => {
    let cancelled = false;
    const handleAuthFailure = () => { if (!cancelled) onFailure(); };
    window.addEventListener(NAVER_MAP_AUTH_FAILURE_EVENT, handleAuthFailure);
    void loadNaverMapSdk(clientId).then(() => {
      if (cancelled || !containerRef.current) return;
      mapRef.current = new naver.maps.Map(containerRef.current, { center: new naver.maps.LatLng(KOREA_CENTER[1], KOREA_CENTER[0]), zoom: 7, zoomControl: true });
      setReady(true);
    }).catch(() => { if (!cancelled) onFailure(); });
    return () => { cancelled = true; window.removeEventListener(NAVER_MAP_AUTH_FAILURE_EVENT, handleAuthFailure); mapRef.current?.destroy(); mapRef.current = null; setReady(false); };
  }, [clientId, onFailure]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const center = REGION_CENTERS[focusedRegion] ?? KOREA_CENTER;
    map.morph(new naver.maps.LatLng(center[1], center[0]), focusedRegion ? 10 : 7);
  }, [focusedRegion, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    const zoomListener = naver.maps.Event.addListener(map, 'zoom_changed', () => setZoom(map.getZoom()));
    const emitVisibleListings = () => {
      const bounds = map.getBounds();
      onVisibleListingIdsChange(listings.filter((listing, index) => bounds.hasPoint(resolvedPositionsRef.current[listing.id] ?? new naver.maps.LatLng(approximateCoordinates(listing, index).latitude, approximateCoordinates(listing, index).longitude))).map((listing) => listing.id));
    };
    const idleListener = naver.maps.Event.addListener(map, 'idle', emitVisibleListings);
    emitVisibleListings();
    return () => { naver.maps.Event.removeListener(zoomListener); naver.maps.Event.removeListener(idleListener); };
  }, [listings, onVisibleListingIdsChange, ready]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    for (const marker of markersRef.current) marker.setMap(null);
    for (const infoWindow of infoWindowsRef.current) infoWindow.close();
    const markers: naver.maps.Marker[] = [];
    const infoWindows: naver.maps.InfoWindow[] = [];
    const approximateListings = listings.filter((listing) => !listing.address);
    const exactListings = listings.filter((listing) => listing.address);
    const renderListingMarker = (listing: OfficialListing, index: number, resolveAddress: boolean) => {
      const approximate = approximateCoordinates(listing, index);
      const position = new naver.maps.LatLng(approximate.latitude, approximate.longitude);
      resolvedPositionsRef.current[listing.id] = position;
      const marker = new naver.maps.Marker({ map, position, title: listing.title, icon: { content: markerContent(listing, false), anchor: new naver.maps.Point(18, 18) } });
      const infoWindow = new naver.maps.InfoWindow({ content: createListingPopup(listing, false, onListingSelect, metadata[listing.id], onToggleSaved), borderWidth: 0, backgroundColor: 'transparent', anchorSize: new naver.maps.Size(12, 12) });
      naver.maps.Event.addListener(marker, 'click', () => infoWindow.getMap() ? infoWindow.close() : infoWindow.open(map, marker));
      markers.push(marker);
      infoWindows.push(infoWindow);
      if (resolveAddress) void geocodeWithNaver(listing).then((resolvedPosition) => {
        if (!resolvedPosition || !marker.getMap()) return;
        resolvedPositionsRef.current[listing.id] = resolvedPosition;
        marker.setPosition(resolvedPosition);
        marker.setIcon({ content: markerContent(listing, true), anchor: new naver.maps.Point(18, 18) });
        infoWindow.setContent(createListingPopup(listing, true, onListingSelect, metadata[listing.id], onToggleSaved));
      });
    };
    exactListings.forEach((listing, index) => renderListingMarker(listing, index, true));
    if (zoom < 11) {
      const groups = new Map<string, OfficialListing[]>();
      for (const listing of approximateListings) groups.set(listing.region, [...(groups.get(listing.region) ?? []), listing]);
      for (const [region, items] of groups) {
        const center = REGION_CENTERS[region] ?? KOREA_CENTER;
        const marker = new naver.maps.Marker({ map, position: new naver.maps.LatLng(center[1], center[0]), title: `${region} 공고 ${items.length}건`, icon: { content: clusterContent(items.length), anchor: new naver.maps.Point(22, 22) } });
        naver.maps.Event.addListener(marker, 'click', () => map.morph(marker.getPosition(), Math.min(12, zoom + 2)));
        markers.push(marker);
        items.forEach((listing) => { resolvedPositionsRef.current[listing.id] = marker.getPosition() as naver.maps.LatLng; });
      }
    } else approximateListings.forEach((listing, index) => renderListingMarker(listing, index, false));
    markersRef.current = markers;
    infoWindowsRef.current = infoWindows;
    return () => { for (const marker of markers) marker.setMap(null); for (const infoWindow of infoWindows) infoWindow.close(); };
  }, [listings, metadata, onListingSelect, onToggleSaved, ready, zoom]);

  return <div className="relative overflow-hidden rounded-2xl border bg-white"><div ref={containerRef} className="h-[62vh] min-h-[480px] w-full" /><div className="absolute bottom-3 left-3 z-10 rounded-lg bg-white/95 px-3 py-2 text-xs shadow"><div className="flex gap-3"><span className="text-blue-600">● LH</span><span className="text-green-600">● SH</span><span className="text-red-600">● HUG</span><span className="text-indigo-700">● 숫자: 묶음</span></div><p className="mt-1 text-muted-foreground">실선은 주소 좌표, 점선은 지역 중심의 대략 위치입니다.</p></div></div>;
}
