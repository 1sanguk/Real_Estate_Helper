'use client';

import { useEffect, useRef, useState } from 'react';
import maplibregl, { type Map as MapLibreMap, type Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { OfficialListing } from '@/domain/dashboard';

type Coordinates = { longitude: number; latitude: number; exact: boolean };

const KOREA_CENTER: [number, number] = [127.7669, 35.9078];
const REGION_CENTERS: Record<string, [number, number]> = {
  서울: [126.978, 37.5665], 서울특별시: [126.978, 37.5665], 부산: [129.0756, 35.1796], 부산광역시: [129.0756, 35.1796],
  대구: [128.6014, 35.8714], 대구광역시: [128.6014, 35.8714], 인천: [126.7052, 37.4563], 인천광역시: [126.7052, 37.4563],
  광주: [126.8526, 35.1595], 광주광역시: [126.8526, 35.1595], 대전: [127.3845, 36.3504], 대전광역시: [127.3845, 36.3504],
  울산: [129.3114, 35.5384], 울산광역시: [129.3114, 35.5384], 세종: [127.289, 36.4801], 세종특별자치시: [127.289, 36.4801],
  경기: [127.009, 37.275], 경기도: [127.009, 37.275], 강원: [127.7298, 37.8854], 강원특별자치도: [127.7298, 37.8854],
  충북: [127.4917, 36.6357], 충청북도: [127.4917, 36.6357], 충남: [126.6728, 36.6588], 충청남도: [126.6728, 36.6588],
  전북: [127.1088, 35.8203], 전북특별자치도: [127.1088, 35.8203], 전남: [126.4629, 34.8161], 전라남도: [126.4629, 34.8161],
  경북: [128.5058, 36.5759], 경상북도: [128.5058, 36.5759], 경남: [128.6919, 35.2383], 경상남도: [128.6919, 35.2383],
  제주: [126.5312, 33.4996], 제주특별자치도: [126.5312, 33.4996],
};
const AGENCY_COLORS = { LH: '#2563eb', SH: '#16a34a', HUG: '#dc2626' } as const;

function approximateCoordinates(listing: OfficialListing, index: number): Coordinates {
  const center = REGION_CENTERS[listing.region] ?? KOREA_CENTER;
  const angle = (index * 137.5 * Math.PI) / 180;
  const distance = 0.025 + (index % 4) * 0.008;
  return { longitude: center[0] + Math.cos(angle) * distance, latitude: center[1] + Math.sin(angle) * distance, exact: false };
}

async function geocodeAddress(listing: OfficialListing, signal: AbortSignal): Promise<Coordinates | null> {
  if (!listing.address) return null;
  const cacheKey = `listing-geocode:${listing.address}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return JSON.parse(cached) as Coordinates;
  const query = listing.address.includes(listing.region) ? listing.address : `${listing.region} ${listing.address}`;
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=kr&q=${encodeURIComponent(query)}`, { signal });
  if (!response.ok) return null;
  const [result] = await response.json() as Array<{ lon: string; lat: string }>;
  if (!result) return null;
  const coordinates = { longitude: Number(result.lon), latitude: Number(result.lat), exact: true };
  localStorage.setItem(cacheKey, JSON.stringify(coordinates));
  return coordinates;
}

export function ListingMap({ listings }: { listings: OfficialListing[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [coordinates, setCoordinates] = useState<Record<string, Coordinates>>({});

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    mapRef.current = new maplibregl.Map({ container: containerRef.current, style: 'https://tiles.openfreemap.org/styles/liberty', center: KOREA_CENTER, zoom: 6.2 });
    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    return () => { mapRef.current?.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initial = Object.fromEntries(listings.map((listing, index) => [listing.id, approximateCoordinates(listing, index)]));
    setCoordinates(initial);
    void (async () => {
      for (const listing of listings) {
        if (!listing.address || controller.signal.aborted) continue;
        try {
          const result = await geocodeAddress(listing, controller.signal);
          if (result) setCoordinates((current) => ({ ...current, [listing.id]: result }));
          await new Promise((resolve) => setTimeout(resolve, 1100));
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return;
        }
      }
    })();
    return () => controller.abort();
  }, [listings]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const marker of markersRef.current) marker.remove();
    markersRef.current = listings.flatMap((listing) => {
      const point = coordinates[listing.id];
      if (!point) return [];
      const markerElement = document.createElement('button');
      markerElement.type = 'button';
      markerElement.title = `${listing.agency} ${listing.title}${point.exact ? '' : ' (대략 위치)'}`;
      markerElement.className = 'grid size-9 place-items-center rounded-full border-2 border-white text-xs font-black text-white shadow-lg';
      markerElement.style.backgroundColor = AGENCY_COLORS[listing.agency];
      markerElement.textContent = listing.agency;
      const popupElement = document.createElement('div');
      const agency = document.createElement('strong'); agency.textContent = `${listing.agency} · ${listing.program}`;
      const title = document.createElement('a'); title.href = `/listings/view?id=${encodeURIComponent(listing.id)}`; title.textContent = listing.title; title.className = 'block mt-1 font-bold';
      const address = document.createElement('p'); address.textContent = listing.address ?? `${listing.region} 중심 기준 대략 위치`; address.className = 'mt-1 text-xs';
      popupElement.append(agency, title, address);
      const marker = new maplibregl.Marker({ element: markerElement }).setLngLat([point.longitude, point.latitude]).setPopup(new maplibregl.Popup({ offset: 22 }).setDOMContent(popupElement)).addTo(map);
      return [marker];
    });
  }, [listings, coordinates]);

  return <div className="relative overflow-hidden rounded-2xl border bg-white"><div ref={containerRef} className="h-[62vh] min-h-[480px] w-full" /><div className="absolute bottom-3 left-3 z-10 rounded-lg bg-white/95 px-3 py-2 text-xs shadow"><div className="flex gap-3"><span className="text-blue-600">● LH</span><span className="text-green-600">● SH</span><span className="text-red-600">● HUG</span></div><p className="mt-1 text-muted-foreground">주소가 없는 공고는 지역 중심의 대략 위치로 표시됩니다.</p></div></div>;
}
