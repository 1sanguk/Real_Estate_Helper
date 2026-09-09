'use client';

export type ListingSearchState = {
  query: string;
  region: string;
  possibleOnly: boolean;
};

const DEFAULT_SEARCH_STATE: ListingSearchState = {
  query: '',
  region: '',
  possibleOnly: true,
};

function searchStateKey(userId: string, savedOnly: boolean) {
  return `listing-search:${userId}:${savedOnly ? 'saved' : 'all'}`;
}

function viewedListingsKey(userId: string) {
  return `viewed-listings:${userId}`;
}

export function loadListingSearchState(userId: string, savedOnly: boolean) {
  try {
    const stored = window.sessionStorage.getItem(searchStateKey(userId, savedOnly));
    if (!stored) return DEFAULT_SEARCH_STATE;
    const parsed = JSON.parse(stored) as Partial<ListingSearchState>;
    return {
      query: typeof parsed.query === 'string' ? parsed.query : '',
      region: typeof parsed.region === 'string' ? parsed.region : '',
      possibleOnly:
        typeof parsed.possibleOnly === 'boolean' ? parsed.possibleOnly : true,
    };
  } catch {
    return DEFAULT_SEARCH_STATE;
  }
}

export function saveListingSearchState(
  userId: string,
  savedOnly: boolean,
  state: ListingSearchState,
) {
  window.sessionStorage.setItem(
    searchStateKey(userId, savedOnly),
    JSON.stringify(state),
  );
}

export function loadViewedListingIds(userId: string) {
  try {
    const stored = window.localStorage.getItem(viewedListingsKey(userId));
    const parsed = stored ? (JSON.parse(stored) as unknown) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function markListingViewed(userId: string, listingId: string) {
  const viewedIds = new Set(loadViewedListingIds(userId));
  viewedIds.add(listingId);
  window.localStorage.setItem(
    viewedListingsKey(userId),
    JSON.stringify([...viewedIds]),
  );
}
