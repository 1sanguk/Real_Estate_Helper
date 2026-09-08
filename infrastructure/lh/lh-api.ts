import type { LhApiRow } from '../../domain/dashboard.ts';

export const DEFAULT_LH_ANNOUNCEMENT_URL =
  'https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1';
export const DEFAULT_LH_SUPPLY_URL =
  'https://apis.data.go.kr/B552555/lhLeaseNoticeSplInfo1/lhLeaseNoticeSplInfo1';

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const SUPPLY_CONCURRENCY = 8;
const ROW_ID_KEYS = ['PAN_ID', 'panId', 'pan_id'];

function isRecord(value: unknown): value is LhApiRow {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function getListingId(row: LhApiRow): string {
  const value = row.PAN_ID ?? row.panId ?? row.pan_id;
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : '';
}

function looksLikeListingRows(value: unknown[]): value is LhApiRow[] {
  return value.length > 0 && value.every(isRecord) && value.some((row) =>
    ROW_ID_KEYS.some((key) => key in row),
  );
}

export function extractLhRows(value: unknown): LhApiRow[] {
  if (Array.isArray(value)) {
    if (looksLikeListingRows(value)) return value;
    for (const item of value) {
      const rows = extractLhRows(item);
      if (rows.length) return rows;
    }
    return [];
  }
  if (!isRecord(value)) return [];
  for (const key of ['dsList', 'item', 'items', 'data', 'body', 'response']) {
    if (key in value) {
      const rows = extractLhRows(value[key]);
      if (rows.length) return rows;
    }
  }
  for (const nested of Object.values(value)) {
    const rows = extractLhRows(nested);
    if (rows.length) return rows;
  }
  return [];
}

export type LhApiClientOptions = {
  serviceKey: string;
  announcementUrl?: string;
  supplyUrl?: string;
  fetchImplementation?: typeof fetch;
};

export class LhApiClient {
  readonly #serviceKey: string;
  readonly #announcementUrl: string;
  readonly #supplyUrl: string;
  readonly #fetch: typeof fetch;

  constructor(options: LhApiClientOptions) {
    this.#serviceKey = options.serviceKey;
    this.#announcementUrl = options.announcementUrl ?? DEFAULT_LH_ANNOUNCEMENT_URL;
    this.#supplyUrl = options.supplyUrl ?? DEFAULT_LH_SUPPLY_URL;
    this.#fetch = options.fetchImplementation ?? fetch;
  }

  async fetchAnnouncements(): Promise<LhApiRow[]> {
    const all: LhApiRow[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const rows = await this.#requestRows(this.#announcementUrl, {
        pageNo: String(page),
        numOfRows: String(PAGE_SIZE),
        PAGE: String(page),
        PG_SZ: String(PAGE_SIZE),
      });
      all.push(...rows);
      if (rows.length < PAGE_SIZE) break;
    }
    return [...new Map(all.filter(getListingId).map((row) => [getListingId(row), row])).values()];
  }

  async fetchSupplies(announcements: LhApiRow[]): Promise<LhApiRow[]> {
    const output: LhApiRow[] = [];
    for (let index = 0; index < announcements.length; index += SUPPLY_CONCURRENCY) {
      const batch = announcements.slice(index, index + SUPPLY_CONCURRENCY);
      const results = await Promise.all(batch.map((row) => this.#fetchSupply(getListingId(row))));
      output.push(...results.flat());
    }
    return output;
  }

  async #fetchSupply(panId: string): Promise<LhApiRow[]> {
    try {
      return await this.#requestRows(this.#supplyUrl, {
        PAN_ID: panId,
        panId,
        pageNo: '1',
        numOfRows: '100',
      });
    } catch (error) {
      console.warn(`공급정보 생략 (${panId}):`, error instanceof Error ? error.message : error);
      return [];
    }
  }

  async #requestRows(baseUrl: string, params: Record<string, string>): Promise<LhApiRow[]> {
    const url = new URL(baseUrl);
    url.searchParams.set('serviceKey', this.#serviceKey);
    url.searchParams.set('_type', 'json');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await this.#fetch(url, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`LH API 호출 실패 (${response.status} ${response.statusText})`);
    const body = await response.text();
    try {
      return extractLhRows(JSON.parse(body));
    } catch {
      throw new Error(`LH API가 JSON이 아닌 응답을 반환했습니다: ${body.slice(0, 160)}`);
    }
  }
}
