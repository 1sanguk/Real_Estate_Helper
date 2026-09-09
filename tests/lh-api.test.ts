import assert from 'node:assert/strict';
import test from 'node:test';
import { extractLhRows, LhApiClient, parseLhNoticeDetail } from '../infrastructure/lh/lh-api.ts';

void test('공공데이터포털의 배열 래퍼 안에서 실제 dsList만 추출한다', () => {
  const response = [{
    dsSch: [{ PAGE: 1, PG_SZ: 100 }],
    dsList: [{ PAN_ID: 'P-100', PAN_NM: '국민임대 공고' }],
  }];
  assert.deepEqual(extractLhRows(response), [
    { PAN_ID: 'P-100', PAN_NM: '국민임대 공고' },
  ]);
});

void test('공급정보의 dsList01을 검색조건 dsSch보다 우선 추출한다', () => {
  const response = [
    { dsSch: [{ PAN_ID: 'P-1' }] },
    { dsList01Nm: [{ NAME: '공급대상주택' }], dsList01: [{ HO_NO: '101', DDO_AR: '36.2', ADR: '서울시' }] },
  ];
  assert.deepEqual(extractLhRows(response), [{ HO_NO: '101', DDO_AR: '36.2', ADR: '서울시' }]);
});

void test('상세정보 응답에서 일정·첨부파일·단지를 분리한다', () => {
  const detail = parseLhNoticeDetail('P-1', [
    { dsSch: [{ PAN_ID: 'P-1' }] },
    {
      dsSplScdl: [{ RQS_SCD: '2026-09-10' }],
      dsAhflInfo: [{ CMN_AHFL_NM: '공고문.pdf', AHFL_URL: 'https://example.test/a.pdf' }],
      dsSbd: [{ SBD_LGO_NM: '테스트단지' }],
      dsCtrtPlc: [{ CTRT_PLC_ADR: '서울시' }],
    },
  ]);
  assert.equal(detail.panId, 'P-1');
  assert.equal(detail.attachments[0].CMN_AHFL_NM, '공고문.pdf');
  assert.equal(detail.complexes[0].SBD_LGO_NM, '테스트단지');
  assert.equal(detail.schedules.length, 1);
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
          { PAN_ID: 'P-1', PAN_NM: '첫 공고', SPL_INF_TP_CD: '131', CCR_CNNT_SYS_DS_CD: '03', UPP_AIS_TP_CD: '13', AIS_TP_CD: '26' },
          { PAN_ID: 'P-1', PAN_NM: '중복 공고', SPL_INF_TP_CD: '131', CCR_CNNT_SYS_DS_CD: '03', UPP_AIS_TP_CD: '13', AIS_TP_CD: '26' },
        ] }];
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = new LhApiClient({
    serviceKey: 'common-key',
    announcementUrl: 'https://example.test/notices',
    supplyUrl: 'https://example.test/supply',
    fetchImplementation: mockFetch,
  });
  const notices = await client.fetchAnnouncements();
  const supplies = await client.fetchSupplies(notices);
  assert.equal(notices.length, 1);
  assert.equal(supplies[0].HSH_CNT, '12');
  assert.equal(supplies[0].PAN_ID, 'P-1');
  assert.match(requestedUrls[0], /serviceKey=common-key/);
  assert.match(requestedUrls[1], /serviceKey=common-key/);
  assert.match(requestedUrls[0], /\/notices\/lhLeaseNoticeInfo1\?/);
  assert.match(requestedUrls[1], /\/supply\/getLeaseNoticeSplInfo1\?/);
  assert.match(requestedUrls[1], /PAN_ID=P-1/);
  assert.match(requestedUrls[1], /SPL_INF_TP_CD=131/);
});

void test('비정상 JSON 응답은 명확한 오류로 중단한다', async () => {
  const client = new LhApiClient({
    serviceKey: 'test-key',
    announcementUrl: 'https://example.test/notices',
    fetchImplementation: async () => new Response('<html>장애</html>', { status: 200 }),
  });
  await assert.rejects(() => client.fetchAnnouncements(), /JSON이 아닌 응답/);
});

void test('URL Encoding 인증키도 한 번만 인코딩해 전송한다', async () => {
  let requestedUrl = '';
  const client = new LhApiClient({
    serviceKey: 'abc%2Bdef%2Fghi%3D',
    announcementUrl: 'https://example.test/notices',
    fetchImplementation: async (input) => {
      requestedUrl = String(input);
      return new Response(JSON.stringify([{ dsList: [] }]), { status: 200 });
    },
  });
  await client.fetchAnnouncements();
  assert.match(requestedUrl, /serviceKey=abc%2Bdef%2Fghi%3D/);
  assert.doesNotMatch(requestedUrl, /%252B/);
});

void test('일시적인 네트워크 실패 후 LH API 호출을 다시 시도한다', async () => {
  let attempts = 0;
  const client = new LhApiClient({
    serviceKey: 'test-key',
    announcementUrl: 'https://example.test/notices',
    retryBaseDelayMs: 1,
    fetchImplementation: async () => {
      attempts += 1;
      if (attempts === 1) throw new TypeError('fetch failed');
      return new Response(JSON.stringify([{ dsList: [] }]), { status: 200 });
    },
  });
  await client.fetchAnnouncements();
  assert.equal(attempts, 2);
});
