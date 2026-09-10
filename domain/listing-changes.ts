export const TRACKED_LISTING_FIELDS = [
  'title',
  'program',
  'region',
  'address',
  'area',
  'units',
  'published_at',
  'application_period',
  'status',
  'minimum_age',
  'source_url',
] as const;

export type TrackedListingField = (typeof TRACKED_LISTING_FIELDS)[number];

export type ComparableListing = Record<TrackedListingField, unknown> & {
  source_listing_id: string;
};

export type ListingFieldChange = {
  field: TrackedListingField;
  label: string;
  before: string | null;
  after: string | null;
};

export type ListingChange = {
  sourceListingId: string;
  changes: ListingFieldChange[];
  summary: string;
  fingerprint: string;
};

const PRESERVED_WHEN_MISSING_FIELDS = [
  'address',
  'area',
  'units',
  'application_period',
  'minimum_age',
] as const;

const FIELD_LABELS: Record<TrackedListingField, string> = {
  title: '공고명',
  program: '사업 유형',
  region: '지역',
  address: '주소',
  area: '공급 면적',
  units: '공급 수',
  published_at: '공고일',
  application_period: '접수 기간',
  status: '진행 상태',
  minimum_age: '최소 연령',
  source_url: '공식 원문',
};

function normalized(value: unknown): string | null {
  if (value == null || value === '') return null;
  return String(value).trim();
}

function hashText(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function detectListingChanges(
  existingListings: ComparableListing[],
  incomingListings: ComparableListing[],
): ListingChange[] {
  const existingById = new Map(existingListings.map((listing) => [listing.source_listing_id, listing]));
  const detected: ListingChange[] = [];
  for (const incoming of incomingListings) {
    const existing = existingById.get(incoming.source_listing_id);
    if (!existing) continue;
    const changes = TRACKED_LISTING_FIELDS.flatMap((field): ListingFieldChange[] => {
      const before = normalized(existing[field]);
      const after = normalized(incoming[field]);
      return before === after ? [] : [{ field, label: FIELD_LABELS[field], before, after }];
    });
    if (!changes.length) continue;
    const summary = changes.map((change) => `${change.label}: ${change.before ?? '미확인'} → ${change.after ?? '미확인'}`).join(' · ');
    detected.push({
      sourceListingId: incoming.source_listing_id,
      changes,
      summary,
      fingerprint: hashText(`${incoming.source_listing_id}|${JSON.stringify(changes)}`),
    });
  }
  return detected;
}

export function preserveKnownListingDetails<T extends ComparableListing>(
  incomingListings: T[],
  existingListings: ComparableListing[],
): T[] {
  const existingById = new Map(existingListings.map((listing) => [listing.source_listing_id, listing]));
  return incomingListings.map((incoming) => {
    const existing = existingById.get(incoming.source_listing_id);
    if (!existing) return incoming;
    const merged = { ...incoming };
    for (const field of PRESERVED_WHEN_MISSING_FIELDS) {
      if (normalized(merged[field]) == null && normalized(existing[field]) != null) {
        merged[field] = existing[field];
      }
    }
    return merged;
  });
}
