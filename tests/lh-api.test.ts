import assert from 'node:assert/strict';
import test from 'node:test';
import { extractLhRows, LhApiClient } from '../infrastructure/lh/lh-api.ts';

void test('공공데이터포털의 배열 래퍼 안에서 실제 dsList만 추출한다', () => {
  const response = [{
    dsSch: [{ PAGE: 1, PG_SZ: 100 }],
    dsList: [{ PAN_ID: 'P-100', PAN_NM: '국민임대 공고' }],
  }];
  assert.deepEqual(extractLhRows(response), [
    { PAN_ID: 'P-100', PAN_NM: '국민임대 공고' },
  ]);
});

void test('LH API 클라이언트가 공고 중복을 제거하고 공급정보를 조회한다', async () => {
  const requestedUrls: string[] = [];
  const mockFetch: typeof fetch = async (input) => {
    const url = String(input);
    requestedUrls.push(url);
    const isSupply = url.includes('/supply');
    const body = isSupply
      ? [{ dsList: [{ PAN_ID: 'P-1', HSH_CNT: '12' }] }]
      : [{ dsList: [
          { PAN_ID: 'P-1', PAN_NM: '첫 공고' },
          { PAN_ID: 'P-1', PAN_NM: '중복 공고' },
        ] }];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = new LhApiClient({
    serviceKey: 'test-key',
    announcementUrl: 'https://example.test/notices',
    supplyUrl: 'https://example.test/supply',
    fetchImplementation: mockFetch,
  });
  const notices = await client.fetchAnnouncements();
  const supplies = await client.fetchSupplies(notices);
  assert.equal(notices.length, 1);
  assert.equal(supplies[0].HSH_CNT, '12');
  assert.match(requestedUrls[0], /serviceKey=test-key/);
  assert.match(requestedUrls[1], /PAN_ID=P-1/);
});

void test('비정상 JSON 응답은 명확한 오류로 중단한다', async () => {
  const client = new LhApiClient({
    serviceKey: 'test-key',
    announcementUrl: 'https://example.test/notices',
    fetchImplementation: async () => new Response('<html>장애</html>', { status: 200 }),
  });
  await assert.rejects(() => client.fetchAnnouncements(), /JSON이 아닌 응답/);
});
