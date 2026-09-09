import type { LhApiRow, OfficialListing } from '../../domain/dashboard.ts';

type HugApiResponse = {
  data?: LhApiRow[];
  totalCount?: number;
  currentCount?: number;
};

type SwaggerDocument = {
  host?: string;
  basePath?: string;
  paths?: Record<string, { get?: { summary?: string } }>;
};

function value(row: LhApiRow, key: string) {
  const item = row[key];
  return item == null ? '' : String(item).trim();
}

function compactDate(input: string) {
  return input.replace(/\D/g, '').slice(0, 8);
}

function displayDate(input: string) {
  const digits = compactDate(input);
  return digits.length === 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}` : input;
}

function currentStatus(endDate: string, today = new Date()) {
  const end = new Date(`${displayDate(endDate)}T23:59:59+09:00`);
  return !Number.isNaN(end.getTime()) && end >= today ? '접수중' : '접수마감';
}

function normalizeServiceKey(serviceKey: string) {
  try {
    return decodeURIComponent(serviceKey.trim());
  } catch {
    return serviceKey.trim();
  }
}

export class HugApiClient {
  private readonly apiUrl: string;
  private readonly serviceKey: string;

  constructor(apiUrl: string, serviceKey: string) {
    this.apiUrl = apiUrl;
    this.serviceKey = normalizeServiceKey(serviceKey);
  }

  private async resolveApiUrl() {
    const configuredUrl = new URL(this.apiUrl);
    if (configuredUrl.hostname !== 'infuser.odcloud.kr' || !configuredUrl.pathname.includes('/oas/docs'))
      return this.apiUrl;

    const response = await fetch(configuredUrl, { headers: { accept: 'application/json' } });
    if (!response.ok) throw new Error(`HUG API 명세 응답 오류: HTTP ${response.status}`);
    const document = (await response.json()) as SwaggerDocument;
    const latestPath = Object.entries(document.paths ?? {})
      .sort(([, left], [, right]) => (right.get?.summary ?? '').localeCompare(left.get?.summary ?? ''))
      .at(0)?.[0];
    if (!document.host || !latestPath) throw new Error('HUG API 명세에서 실제 요청 경로를 찾지 못했습니다.');
    return `https://${document.host}${document.basePath ?? ''}${latestPath}`;
  }

  async fetchListings(): Promise<{ listings: OfficialListing[]; rowsById: Map<string, LhApiRow[]> }> {
    const rows: LhApiRow[] = [];
    const perPage = 1000;
    const apiUrl = await this.resolveApiUrl();
    for (let page = 1; page <= 20; page++) {
      const url = new URL(apiUrl);
      url.searchParams.set('page', String(page));
      url.searchParams.set('perPage', String(perPage));
      url.searchParams.set('serviceKey', this.serviceKey);
      url.searchParams.set('returnType', 'JSON');
      const response = await fetch(url, { headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`HUG API 응답 오류: HTTP ${response.status}`);
      const body = (await response.json()) as HugApiResponse;
      rows.push(...(body.data ?? []));
      if (!body.data?.length || rows.length >= (body.totalCount ?? 0)) break;
    }

    const groups = new Map<string, LhApiRow[]>();
    for (const row of rows) {
      const announced = compactDate(value(row, '모집공고일자'));
      const start = compactDate(value(row, '청약접수시작일자'));
      const end = compactDate(value(row, '청약접수종료일자'));
      const region = value(row, '지역구분명') || '전국';
      if (!announced || !end) continue;
      const id = `HUG-${announced}-${start}-${end}-${region}`;
      (groups.get(id) ?? groups.set(id, []).get(id))?.push(row);
    }

    const listings = [...groups.entries()].map(([id, group]) => {
      const first = group[0];
      const areas = group.map((row) => Number(value(row, '전용면적(제곱미터)'))).filter((area) => Number.isFinite(area) && area > 0);
      const announced = value(first, '모집공고일자');
      const start = value(first, '청약접수시작일자');
      const end = value(first, '청약접수종료일자');
      const region = value(first, '지역구분명') || '전국';
      return {
        id,
        agency: 'HUG' as const,
        title: `${displayDate(announced)} HUG 든든전세주택 ${region} 모집`,
        program: '든든전세주택',
        region,
        address: value(first, '지역상세구분코드명') || undefined,
        area: areas.length ? `전용 ${Math.min(...areas)}~${Math.max(...areas)}㎡` : undefined,
        units: `공급주택 ${group.length.toLocaleString()}호`,
        publishedAt: displayDate(announced),
        applicationPeriod: `${displayDate(start)}~${displayDate(end)}`,
        status: currentStatus(end),
        sourceUrl: 'https://www.khug.or.kr/jeonse/web/s07/s070101.jsp',
      };
    });
    return { listings, rowsById: groups };
  }
}
