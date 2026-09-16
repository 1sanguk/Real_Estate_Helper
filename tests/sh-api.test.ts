import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractShApplicationPeriod,
  isActualShHousingNotice,
  parseShDetail,
  parseShRss,
  shApplicationStatus,
  ShApiClient,
} from '../infrastructure/sh/sh-api.ts';

void test('SH RSS에서 공고 ID와 본문을 읽는다', () => {
  const items = parseShRss(`<?xml version="1.0"?><rss><channel><item>
    <title>2026년 국민임대주택 입주자 모집공고</title>
    <link>http://www.i-sh.co.kr/main/view.do?seq=310001</link>
    <content:encoded><![CDATA[<p>신청 기간 안내</p>]]></content:encoded>
    <pubDate>Tue, 15 Sep 2026 04:39:06 GMT</pubDate>
  </item></channel></rss>`);
  assert.equal(items[0]?.seq, '310001');
  assert.equal(items[0]?.link.startsWith('https:'), true);
  assert.equal(items[0]?.content, '신청 기간 안내');
  assert.equal(items[0]?.publishedAt, '2026-09-15');
});

void test('실제 주택 모집공고만 선별한다', () => {
  assert.equal(isActualShHousingNotice('2026년 국민임대주택 입주자 모집공고'), true);
  assert.equal(isActualShHousingNotice('토지임대부 사회주택 입주자 모집 공고문'), true);
  assert.equal(isActualShHousingNotice('국민임대주택 입주자 모집 접수마감 안내'), false);
  assert.equal(isActualShHousingNotice('국민임대주택 입주자 모집공고 서류심사대상자 발표'), false);
  assert.equal(isActualShHousingNotice('근생시설 임차인 모집공고'), false);
});

void test('본문의 명시적인 신청기간만 정규화한다', () => {
  assert.equal(
    extractShApplicationPeriod('청약접수: 2026. 9. 21.(월) ~ 2026. 9. 23.(수)'),
    '2026-09-21~2026-09-23',
  );
  assert.equal(extractShApplicationPeriod('공고일은 2026. 9. 15.입니다.'), undefined);
  assert.equal(
    extractShApplicationPeriod('2026.09.15 입주 신청자 안내 입주 신청서 접수 ~ 대상자 선정 2026.09.20 이메일 접수'),
    '2026-09-15~2026-09-20',
  );
  assert.equal(shApplicationStatus('2026-09-21~2026-09-23', new Date('2026-09-22')), '접수중');
});

void test('상세 페이지에서 공식 첨부파일 다운로드 주소를 만든다', () => {
  const detail = parseShDetail(`<script>initParam.downList = [{"brdId":"GS0401","seq":"310001","fileSeq":"3","oriFileNm":"입주자 모집공고문.pdf","fileTp":"A"}];</script>`, '310001');
  assert.equal(detail.attachments[0]?.documentType, '모집공고문');
  assert.match(detail.attachments[0]?.sourceUrl ?? '', /innoFD\.do\?brdId=GS0401&seq=310001&fileTp=A&fileSeq=3/);
});

void test('SH 수집 결과를 공고와 상세 자료로 반환한다', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
    if (url.includes('rss')) return new Response(`<rss><channel><item><title>장기전세주택 입주자 모집공고</title><link>https://www.i-sh.co.kr/view.do?seq=99</link><content:encoded><![CDATA[신청기간 2099.1.2.~2099.1.3.]]></content:encoded><pubDate>Tue, 15 Sep 2026 04:39:06 GMT</pubDate></item></channel></rss>`);
    return new Response(`<script>initParam.downList = [{"brdId":"GS0401","seq":"99","fileSeq":"1","oriFileNm":"모집공고문.pdf","fileTp":"A"}];</script>`);
  };
  try {
    const result = await new ShApiClient('https://example.test/rss', 1_000, () => new Date('2098-12-01')).fetchListings();
    assert.equal(result.listings[0]?.id, 'SH-99');
    assert.equal(result.listings[0]?.agency, 'SH');
    assert.equal(result.listings[0]?.applicationPeriod, '2099-01-02~2099-01-03');
    assert.equal(result.details[0]?.attachments.length, 1);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
