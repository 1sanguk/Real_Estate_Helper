'use client';

export type ListingSearchState = {
  agency: string;
  searchTarget: 'title' | 'content' | 'all';
  query: string;
  region: string;
  possibleOnly: boolean;
  pageSize: 10 | 20 | 50;
};

const DEFAULT_SEARCH_STATE: ListingSearchState = {
  agency: '',
  searchTarget: 'all',
  query: '',
  region: '',
  possibleOnly: true,
  pageSize: 10,
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
      agency: typeof parsed.agency === 'string' ? parsed.agency : '',
      searchTarget: ['title', 'content', 'all'].includes(parsed.searchTarget ?? '')
        ? parsed.searchTarget as ListingSearchState['searchTarget']
        : 'all',
      query: typeof parsed.query === 'string' ? parsed.query : '',
      region: typeof parsed.region === 'string' ? parsed.region : '',
      possibleOnly:
        typeof parsed.possibleOnly === 'boolean' ? parsed.possibleOnly : true,
      pageSize: [10, 20, 50].includes(parsed.pageSize ?? 0)
        ? parsed.pageSize as ListingSearchState['pageSize']
        : 10,
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
