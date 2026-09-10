import assert from 'node:assert/strict';
import test from 'node:test';
import { applicationPeriodFromSchedules, createListingSchedule, datesInRange, parseApplicationPeriod } from '../domain/listing-schedule.ts';
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

void test('상세 API의 신청 시작·종료 일시로 누락된 접수 기간을 보완한다', () => {
  assert.equal(applicationPeriodFromSchedules([{
    ACP_ST_DTTM: '2026.09.22 10:00',
    ACP_ED_DTTM: '2026.09.22 12:00',
    LTR_DTTM: '2026.09.22 15:00',
  }]), '2026-09-22~2026-09-22');
  assert.equal(applicationPeriodFromSchedules([{ RQS_SCD: '2026-09-15' }]), '2026-09-15~2026-09-15');
});
