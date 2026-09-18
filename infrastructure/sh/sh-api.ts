import type { LhApiRow, OfficialListing } from '../../domain/dashboard.ts';

export const DEFAULT_SH_RSS_URL =
  'https://www.i-sh.co.kr/main/lay2/program/S1T294C295/www/rss/rssNoticeWrite.do';

const SH_ORIGIN = 'https://www.i-sh.co.kr';
const USER_AGENT = 'PublicHousingCollector/1.0 (+https://github.com/parksteve/Real_Estate_Helper)';
const EXCLUDED_TITLE_WORDS = [
  '접수결과', '접수 결과', '접수마감', '접수 마감', '당첨자', '계약결과', '계약 결과',
  '입주 안내', '서류심사대상자', '공급대상자 발표', '예비대상자 발표', '채용', '입찰',
  '상가', '토지 매각', '분양 2차 공고',
];

export type ShAttachment = {
  name: string;
  documentType: string;
  sourceUrl: string;
};

export type ShNoticeDetail = {
  sourceListingId: string;
  applicationPeriod?: string;
  attachments: ShAttachment[];
  rawData: LhApiRow;
};

export type ShFetchResult = {
  listings: OfficialListing[];
  details: ShNoticeDetail[];
  rowsById: Map<string, LhApiRow>;
};

type RssNotice = {
  seq: string;
  title: string;
  link: string;
  publishedAt: string;
  content: string;
};

function decodeEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

function textContent(value: string): string {
  return decodeEntities(value).replace(/<\/?[A-Za-z][^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function element(item: string, name: string): string {
  return item.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, 'i'))?.[1] ?? '';
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function rssDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : isoDate(parsed);
}

export function parseShRss(xml: string): RssNotice[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].flatMap((match) => {
    const item = match[1] ?? '';
    const link = textContent(element(item, 'link')).replace(/^http:/, 'https:');
    const seq = new URL(link, SH_ORIGIN).searchParams.get('seq') ?? '';
    const title = textContent(element(item, 'title'));
    if (!seq || !title) return [];
    return [{
      seq,
      title,
      link,
      publishedAt: rssDate(textContent(element(item, 'pubDate'))),
      content: textContent(element(item, 'content:encoded')),
    }];
  });
}

export function isActualShHousingNotice(title: string): boolean {
  const normalized = title.replace(/\s+/g, ' ').trim();
  if (EXCLUDED_TITLE_WORDS.some((word) => normalized.includes(word))) return false;
  return /(?:입주자|예비입주자).{0,12}모집\s*공고|모집\s*공고.{0,12}(?:입주자|예비입주자)/.test(normalized);
}

function normalizeDate(year: string, month: string, day: string): string {
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function extractShApplicationPeriod(text: string): string | undefined {
  const normalized = textContent(text).replace(/[()]/g, ' ');
  const labeled = normalized.match(
    /(?:청약\s*접수|신청\s*기간|접수\s*기간|입주\s*신청)[^\d]{0,30}(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})일?[^~～\d]{0,20}[~～-]\s*(?:(20\d{2})[.\-/년]\s*)?(\d{1,2})[.\-/월]\s*(\d{1,2})일?/i,
  );
  if (labeled) {
    const start = normalizeDate(labeled[1]!, labeled[2]!, labeled[3]!);
    const end = normalizeDate(labeled[4] ?? labeled[1]!, labeled[5]!, labeled[6]!);
    return end >= start ? `${start}~${end}` : undefined;
  }

  const label = normalized.match(/(?:청약\s*접수|신청\s*기간|접수\s*기간|입주\s*신청서?\s*접수)/i);
  if (label?.index == null) return undefined;
  const datePattern = /(20\d{2})[.\-/년]\s*(\d{1,2})[.\-/월]\s*(\d{1,2})일?/g;
  const before = [...normalized.slice(Math.max(0, label.index - 120), label.index).matchAll(datePattern)].at(-1);
  const after = [...normalized
    .slice(label.index + label[0].length, label.index + label[0].length + 180)
    .matchAll(datePattern)][0];
  if (!before || !after) return undefined;
  const start = normalizeDate(before[1]!, before[2]!, before[3]!);
  const end = normalizeDate(after[1]!, after[2]!, after[3]!);
  return end >= start ? `${start}~${end}` : undefined;
}

export function shApplicationStatus(period: string | undefined, now = new Date()): string {
  if (!period) return '공고중';
  const [start, end] = period.split('~');
  const today = isoDate(now);
  if (end && today > end) return '접수마감';
  if (start && today >= start) return '접수중';
  return '공고중';
}

function programFromTitle(title: string): string {
  const programs = ['장기전세', '국민임대', '행복주택', '매입임대', '전세임대', '공공임대', '사회주택'];
  return programs.find((program) => title.includes(program)) ?? '공공임대';
}

export function parseShDetail(html: string, seq: string): { text: string; attachments: ShAttachment[] } {
  const downListSource = html.match(/initParam\.downList\s*=\s*(\[[\s\S]*?\]);/)?.[1];
  let downList: Array<{ brdId?: string; seq?: string; fileSeq?: string; oriFileNm?: string; fileTp?: string }> = [];
  if (downListSource) {
    try {
      downList = JSON.parse(downListSource);
    } catch {
      downList = [];
    }
  }
  const attachments = downList.flatMap((file) => {
    if (!file.brdId || !file.fileSeq || !file.oriFileNm) return [];
    const query = new URLSearchParams({
      brdId: file.brdId,
      seq: file.seq ?? seq,
      fileTp: file.fileTp ?? 'A',
      fileSeq: file.fileSeq,
    });
    return [{
      name: file.oriFileNm,
      documentType: /모집\s*공고/.test(file.oriFileNm) ? '모집공고문' : '첨부파일',
      sourceUrl: `${SH_ORIGIN}/main/com/file/innoFD.do?${query}`,
    }];
  });
  return { text: textContent(html), attachments };
}

async function fetchText(url: string, timeoutMs: number): Promise<string> {
  const response = await fetch(url, {
    headers: { accept: 'text/html,application/rss+xml,application/xml;q=0.9,*/*;q=0.8', 'user-agent': USER_AGENT },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`SH 공고 응답 오류: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const charset = response.headers.get('content-type')?.match(/charset=([^;]+)/i)?.[1]?.trim().toLowerCase();
  if (charset?.includes('euc-kr')) return new TextDecoder('euc-kr').decode(bytes);
  return new TextDecoder('utf-8').decode(bytes);
}

export class ShApiClient {
  private readonly rssUrl: string;
  private readonly timeoutMs: number;
  private readonly now: () => Date;

  constructor(
    rssUrl = DEFAULT_SH_RSS_URL,
    timeoutMs = 20_000,
    now = () => new Date(),
  ) {
    this.rssUrl = rssUrl;
    this.timeoutMs = timeoutMs;
    this.now = now;
  }

  async fetchListings(): Promise<ShFetchResult> {
    const notices = parseShRss(await fetchText(this.rssUrl, this.timeoutMs)).filter((notice) =>
      isActualShHousingNotice(notice.title));
    const listings: OfficialListing[] = [];
    const details: ShNoticeDetail[] = [];
    const rowsById = new Map<string, LhApiRow>();

    for (const notice of notices) {
      const html = await fetchText(notice.link, this.timeoutMs);
      const detail = parseShDetail(html, notice.seq);
      if (!detail.attachments.some((attachment) => attachment.documentType === '모집공고문')) continue;
      const applicationPeriod = extractShApplicationPeriod(`${notice.content} ${detail.text}`);
      const id = `SH-${notice.seq}`;
      const rawData = { seq: notice.seq, rss: notice, attachments: detail.attachments };
      listings.push({
        id,
        agency: 'SH',
        title: notice.title,
        program: programFromTitle(notice.title),
        region: '서울특별시',
        publishedAt: notice.publishedAt,
        applicationPeriod,
        status: shApplicationStatus(applicationPeriod, this.now()),
        sourceUrl: notice.link,
      });
      details.push({ sourceListingId: id, applicationPeriod, attachments: detail.attachments, rawData });
      rowsById.set(id, rawData);
    }
    return { listings, details, rowsById };
  }
}
