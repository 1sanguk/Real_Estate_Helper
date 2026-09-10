'use client';

import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  assessListingWithRules,
  getEligibilityChecks,
  type DashboardProfile,
  type OfficialListing,
  type StoredEligibilityRule,
} from '@/domain/dashboard';

type NumericProfileKey = 'monthly_income' | 'total_assets' | 'household_size' | 'subscription_payment_count' | 'car_value';

const SIMULATION_FIELDS: Array<{ key: NumericProfileKey; label: string; unit: string; min: number; step: number }> = [
  { key: 'monthly_income', label: '월평균 소득', unit: '만원', min: 0, step: 10 },
  { key: 'total_assets', label: '총자산', unit: '만원', min: 0, step: 100 },
  { key: 'household_size', label: '가구원 수', unit: '명', min: 1, step: 1 },
  { key: 'subscription_payment_count', label: '청약 납입', unit: '회', min: 0, step: 1 },
  { key: 'car_value', label: '자동차 가액', unit: '만원', min: 0, step: 10 },
];

function numericValue(profile: DashboardProfile, key: NumericProfileKey) {
  const value = profile[key];
  return typeof value === 'number' ? value : 0;
}

export function EligibilitySimulator({
  profile,
  listing,
  rules,
}: {
  profile: DashboardProfile;
  listing: OfficialListing;
  rules: StoredEligibilityRule[];
}) {
  const [simulation, setSimulation] = useState(() => Object.fromEntries(
    SIMULATION_FIELDS.map((field) => [field.key, numericValue(profile, field.key)]),
  ) as Record<NumericProfileKey, number>);
  const simulatedProfile = useMemo(() => ({ ...profile, ...simulation }), [profile, simulation]);
  const currentAssessment = assessListingWithRules(profile, listing, rules);
  const simulatedAssessment = assessListingWithRules(simulatedProfile, listing, rules);
  const currentChecks = new Map(getEligibilityChecks(profile, listing, rules).map((check) => [check.key, check]));
  const changedChecks = getEligibilityChecks(simulatedProfile, listing, rules).filter((check) => currentChecks.get(check.key)?.status !== check.status);

  function reset() {
    setSimulation(Object.fromEntries(
      SIMULATION_FIELDS.map((field) => [field.key, numericValue(profile, field.key)]),
    ) as Record<NumericProfileKey, number>);
  }

  return (
    <section className="rounded-2xl border bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><SlidersHorizontal className="size-5 text-primary" /><h2 className="font-extrabold">조건 변경 시뮬레이터</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">저장된 정보는 바꾸지 않고, 조건이 달라졌을 때 판정 변화를 미리 확인합니다.</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={reset}><RotateCcw className="size-4" />현재 조건으로 초기화</Button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SIMULATION_FIELDS.filter((field) => field.key !== 'car_value' || profile.owns_car).map((field) => (
          <label key={field.key} className="rounded-xl bg-secondary p-3 text-sm font-bold">
            <span>{field.label}</span>
            <span className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min={field.min}
                step={field.step}
                value={simulation[field.key]}
                onChange={(event) => setSimulation((current) => ({ ...current, [field.key]: Math.max(field.min, Number(event.target.value) || 0) }))}
                className="min-w-0 w-full rounded-lg border px-3 py-2"
              />
              <small className="min-w-fit text-muted-foreground">{field.unit}</small>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border p-4"><span className="text-xs font-bold text-muted-foreground">현재 판정</span><p className="mt-1 font-black">{currentAssessment.status}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{currentAssessment.reason}</p></div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4"><span className="text-xs font-bold text-primary">변경 후 예상 판정</span><p className="mt-1 font-black text-primary">{simulatedAssessment.status}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{simulatedAssessment.reason}</p></div>
      </div>
      <div className="mt-4 rounded-xl bg-[#fff8e6] p-4 text-sm">
        <strong>달라지는 조건</strong>
        {changedChecks.length ? <ul className="mt-2 space-y-1 text-xs text-muted-foreground">{changedChecks.map((check) => <li key={check.key}>· {check.label}: {currentChecks.get(check.key)?.status} → {check.status}</li>)}</ul> : <p className="mt-1 text-xs text-muted-foreground">입력한 값으로 달라지는 자동 판정 조건이 없습니다.</p>}
      </div>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">시뮬레이션은 공고문에서 구조화된 조건만 비교하는 참고 결과이며 실제 신청 자격을 확정하지 않습니다.</p>
    </section>
  );
}
