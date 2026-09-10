import assert from 'node:assert/strict';
import test from 'node:test';
import { runListingChangeWorkflow } from '../application/listing-change-workflow.ts';
import { detectListingChanges, preserveKnownListingDetails, type ComparableListing } from '../domain/listing-changes.ts';

function listing(overrides: Partial<ComparableListing> = {}): ComparableListing {
  return {
    source_listing_id: 'LH-1',
    title: '국민임대 모집',
    program: '국민임대',
    region: '서울특별시',
    address: '서울시 강남구',
    area: '전용 36㎡',
    units: '공급 10명',
    published_at: '2026-09-10',
    application_period: '2026-09-15~2026-09-16',
    status: '공고중',
    minimum_age: null,
    source_url: 'https://example.test/notice',
    ...overrides,
  };
}

void test('정정공고의 주요 변경 필드와 전후 값을 감지한다', () => {
  const changes = detectListingChanges(
    [listing()],
    [listing({ application_period: '2026-09-15~2026-09-18', units: '공급 12명' })],
  );
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0].changes.map((change) => change.field), ['units', 'application_period']);
  assert.match(changes[0].summary, /2026-09-18/);
});

void test('신규 공고와 동일한 재수집 결과는 변경 이력으로 만들지 않는다', () => {
  assert.deepEqual(detectListingChanges([], [listing()]), []);
  assert.deepEqual(detectListingChanges([listing()], [listing()]), []);
});

void test('LangGraph가 변경 감지 후 영향받은 공고를 수집한다', async () => {
  const result = await runListingChangeWorkflow(
    [listing()],
    [listing({ status: '정정공고중' })],
  );
  assert.equal(result.changes.length, 1);
  assert.deepEqual(result.changedListingIds, ['LH-1']);
});

void test('재수집에서 누락된 공급 정보는 기존 확인값을 보존한다', () => {
  const [merged] = preserveKnownListingDetails(
    [listing({ area: null, units: null, status: '접수마감' })],
    [listing({ area: '전용 36㎡', units: '공급 10명', status: '접수중' })],
  );
  assert.equal(merged.area, '전용 36㎡');
  assert.equal(merged.units, '공급 10명');
  assert.equal(merged.status, '접수마감');
});
