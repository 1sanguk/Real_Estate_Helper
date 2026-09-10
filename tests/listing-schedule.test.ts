import assert from 'node:assert/strict';
import test from 'node:test';
import { createListingSchedule, datesInRange, parseApplicationPeriod } from '../domain/listing-schedule.ts';
import type { OfficialListing } from '../domain/dashboard.ts';

void test('공고 접수 기간의 여러 날짜 표기를 해석한다', () => {
  assert.deepEqual(parseApplicationPeriod('2026.09.15 ~ 2026.09.18'), {
    startDate: '2026-09-15',
    endDate: '2026-09-18',
  });
  assert.deepEqual(parseApplicationPeriod('20260915~09.18'), {
    startDate: '2026-09-15',
    endDate: '2026-09-18',
  });
  assert.deepEqual(parseApplicationPeriod('2026.12.30~01.03'), {
    startDate: '2026-12-30',
    endDate: '2027-01-03',
  });
});

void test('접수 시작일부터 마감일까지 달력 날짜를 만든다', () => {
  assert.deepEqual(datesInRange('2026-09-29', '2026-10-02'), [
    '2026-09-29',
    '2026-09-30',
    '2026-10-01',
    '2026-10-02',
  ]);
});

void test('오늘을 기준으로 마감 D-day를 계산한다', () => {
  const listing = {
    id: 'LH-1',
    agency: 'LH',
    title: '청년 매입임대',
    applicationPeriod: '2026-09-15~2026-09-18',
  } as OfficialListing;
  const schedule = createListingSchedule(listing, new Date(2026, 8, 10, 18));
  assert.equal(schedule?.daysUntilDeadline, 8);
});
