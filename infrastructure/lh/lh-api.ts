import type { LhApiRow } from '../../domain/dashboard.ts';

export const DEFAULT_LH_ANNOUNCEMENT_URL =
  'https://apis.data.go.kr/B552555/lhLeaseNoticeInfo1/lhLeaseNoticeInfo1';
export const DEFAULT_LH_SUPPLY_URL =
  'https://apis.data.go.kr/B552555/lhLeaseNoticeSplInfo1/getLeaseNoticeSplInfo1';

const PAGE_SIZE = 100;
const MAX_PAGES = 100;
const SUPPLY_REQUEST_INTERVAL_MS = 250;
const MAX_RETRY_COUNT = 3;
const ROW_ID_KEYS = ['PAN_ID', 'panId', 'pan_id'];

function resolveOperationUrl(baseUrl: string, operation: string): string {
  const url = new URL(baseUrl);
  const normalizedPath = url.pathname.replace(/\/$/, '');
  const pathParts = normalizedPath.split('/').filter(Boolean);
  if (pathParts.length === 2 || pathParts.at(-1) !== operation) {
    url.pathname = `${normalizedPath}/${operation}`;
  }
  return url.toString();
}

function normalizeServiceKey(serviceKey: string): string {
  try {
    return serviceKey.includes('%') ? decodeURIComponent(serviceKey) : serviceKey;
  } catch {
    return serviceKey;
  }
}

function parameterValue(row: LhApiRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return '';
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

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
    for (const item of value) {
      if (!isRecord(item)) continue;
      const dataKey = Object.keys(item).find((key) => /^dsList\d*$/.test(key));
      const candidate = dataKey ? item[dataKey] : undefined;
      if (Array.isArray(candidate) && candidate.every(isRecord)) return candidate;
    }
    if (looksLikeListingRows(value)) return value;
    for (const item of value) {
      const rows = extractLhRows(item);
      if (rows.length) return rows;
    }
    return [];
  }
  if (!isRecord(value)) return [];
  for (const key of ['dsList', 'dsList01', 'item', 'items', 'data', 'body', 'response']) {
    if (key in value) {
      if (Array.isArray(value[key]) && value[key].every(isRecord)) return value[key];
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
    this.#serviceKey = normalizeServiceKey(options.serviceKey);
    this.#announcementUrl = resolveOperationUrl(
      options.announcementUrl ?? DEFAULT_LH_ANNOUNCEMENT_URL,
      'lhLeaseNoticeInfo1',
    );
    this.#supplyUrl = resolveOperationUrl(
      options.supplyUrl ?? DEFAULT_LH_SUPPLY_URL,
      'getLeaseNoticeSplInfo1',
    );
    this.#fetch = options.fetchImplementation ?? fetch;
  }

  async fetchAnnouncements(): Promise<LhApiRow[]> {
    const all: LhApiRow[] = [];
    for (let page = 1; page <= MAX_PAGES; page++) {
      const rows = await this.#requestRows(this.#announcementUrl, this.#serviceKey, {
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
    for (let index = 0; index < announcements.length; index++) {
      if (index > 0) await wait(SUPPLY_REQUEST_INTERVAL_MS);
      output.push(...await this.#fetchSupply(announcements[index]));
    }
    return output;
  }

  async #fetchSupply(announcement: LhApiRow): Promise<LhApiRow[]> {
    const panId = getListingId(announcement);
    try {
      const rows = await this.#requestRows(this.#supplyUrl, this.#serviceKey, {
        PAN_ID: panId,
        SPL_INF_TP_CD: parameterValue(announcement, 'SPL_INF_TP_CD', 'splInfTpCd'),
        CCR_CNNT_SYS_DS_CD: parameterValue(announcement, 'CCR_CNNT_SYS_DS_CD', 'ccrCnntSysDsCd'),
        UPP_AIS_TP_CD: parameterValue(announcement, 'UPP_AIS_TP_CD', 'uppAisTpCd'),
        AIS_TP_CD: parameterValue(announcement, 'AIS_TP_CD', 'aisTpCd'),
      });
      return rows.map((row) => ({ ...row, PAN_ID: panId }));
    } catch (error) {
      console.warn(`공급정보 생략 (${panId}):`, error instanceof Error ? error.message : error);
      return [];
    }
  }

  async #requestRows(baseUrl: string, serviceKey: string, params: Record<string, string>): Promise<LhApiRow[]> {
    const url = new URL(baseUrl);
    url.searchParams.set('serviceKey', serviceKey);
    url.searchParams.set('_type', 'json');
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    for (let attempt = 0; attempt <= MAX_RETRY_COUNT; attempt++) {
      const response = await this.#fetch(url, { headers: { accept: 'application/json' } });
      const body = await response.text();
      if ((response.status === 429 || response.status >= 500) && attempt < MAX_RETRY_COUNT) {
        await wait(500 * 2 ** attempt);
        continue;
      }
      if (!response.ok) {
        const safeMessage = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
        throw new Error(`LH API 호출 실패 (${response.status} ${response.statusText})${safeMessage ? `: ${safeMessage}` : ''}`);
      }
      try {
        return extractLhRows(JSON.parse(body));
      } catch {
        throw new Error(`LH API가 JSON이 아닌 응답을 반환했습니다: ${body.slice(0, 160)}`);
      }
    }
    return [];
  }
}
