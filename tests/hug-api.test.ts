import assert from 'node:assert/strict';
import test from 'node:test';
import { HugApiClient } from '../infrastructure/hug/hug-api.ts';

void test('HUG 공식 공급 행을 모집 단위별 공고로 묶고 공식 공고문을 연결한다', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
    if (url.includes('khug.or.kr')) return new Response(
      '<a href="https://www.khug.or.kr/hug/homepage_file_upload/jeonse_notice_260901.pdf">입주자 모집공고문</a>',
      { status: 200 },
    );
    return new Response(JSON.stringify({
      totalCount: 2,
      data: [
        { 모집공고일자: '2026-09-01', 청약접수시작일자: '2026-09-10', 청약접수종료일자: '2099-09-20', 지역구분명: '서울', 지역상세구분코드명: '강서구', '전용면적(제곱미터)': '45' },
        { 모집공고일자: '2026-09-01', 청약접수시작일자: '2026-09-10', 청약접수종료일자: '2099-09-20', 지역구분명: '서울', 지역상세구분코드명: '양천구', '전용면적(제곱미터)': '59' },
      ],
    }), { status: 200 });
  };
  try {
    const result = await new HugApiClient('https://example.com/hug', 'key').fetchListings();
    assert.equal(result.listings.length, 1);
    assert.equal(result.listings[0].agency, 'HUG');
    assert.equal(result.listings[0].status, '접수중');
    assert.equal(result.listings[0].units, '공급주택 2호');
    assert.equal(result.details[0]?.attachments[0]?.documentType, '모집공고문');
  } finally {
    globalThis.fetch = previousFetch;
  }
});
