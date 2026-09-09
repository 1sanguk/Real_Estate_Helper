'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Home,
  LockKeyhole,
  Save,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/features/auth/auth-context';
import {
  emptyHousingProfile,
  regionOptions,
  type HousingProfile,
} from '@/domain/profile';
import { getSupabaseClient } from '@/lib/supabase/client';

const activityOptions = [
  ['student', '대학생'],
  ['prospective_student', '입학·복학 예정자'],
  ['job_seeker', '취업준비생'],
  ['employed', '직장 재직자'],
  ['self_employed', '개인사업자·자영업자'],
  ['unemployed', '현재 미취업'],
  ['other', '그 외 상태'],
] as const;
const householdOptions = [
  ['single', '미혼·1인 가구'],
  ['married', '기혼'],
  ['engaged', '예비 신혼부부'],
  ['single_parent', '한부모 가구'],
] as const;
const optionLabel = (
  options: readonly (readonly [string, string])[],
  value: string,
) =>
  options.find(([optionValue]) => optionValue === value)?.[1] ??
  '선택해 주세요';

export default function ProfileSetupPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [profile, setProfile] = useState<HousingProfile>(emptyHousingProfile);
  const [isInitialSetup, setIsInitialSetup] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
      return;
    }
    const client = getSupabaseClient();
    if (!client || !user) return;
    void client
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        setProfileLoading(false);
        if (!data) return;
        setIsInitialSetup(!data.profile_completed_at);
        setProfile({
          birthDate: data.birth_date ?? '',
          residenceRegion: data.residence_region ?? '',
          householdSize: String(data.household_size ?? 1),
          monthlyIncome:
            data.monthly_income == null ? '' : String(data.monthly_income),
          totalAssets:
            data.total_assets == null ? '' : String(data.total_assets),
          isHomeless: data.is_homeless ?? true,
          ownsCar: data.owns_car ?? false,
          carValue: data.car_value == null ? '' : String(data.car_value),
          isMarried: data.is_married ?? false,
          hasChildren: data.has_children ?? false,
          childCount: String(data.child_count ?? 0),
          householdType: data.household_type ?? 'single',
          marriageDate: data.marriage_date ?? '',
          expectedMarriageDate: data.expected_marriage_date ?? '',
          spouseHasIncome: data.spouse_has_income ?? false,
          youngestChildBirthDate: data.youngest_child_birth_date ?? '',
          isPregnant: data.is_pregnant ?? false,
          activityStatus: data.activity_status ?? 'employed',
          graduationDate: data.graduation_date ?? '',
          realEstateAssets:
            data.real_estate_assets == null
              ? ''
              : String(data.real_estate_assets),
          financialAssets:
            data.financial_assets == null ? '' : String(data.financial_assets),
          otherAssets:
            data.other_assets == null ? '' : String(data.other_assets),
          totalDebt: data.total_debt == null ? '' : String(data.total_debt),
          receivesLivelihoodBenefit: data.receives_livelihood_benefit ?? false,
          receivesHousingBenefit: data.receives_housing_benefit ?? false,
          isNearPoverty: data.is_near_poverty ?? false,
          isSupportedSingleParent: data.is_supported_single_parent ?? false,
          subscriptionPaymentCount: String(
            data.subscription_payment_count ?? 0,
          ),
          residenceStartDate: data.residence_start_date ?? '',
        });
      });
  }, [loading, router, user]);
  function update<K extends keyof HousingProfile>(
    key: K,
    value: HousingProfile[K],
  ) {
    setProfile((current) => ({ ...current, [key]: value }));
  }
  function requestSave(event: React.FormEvent) {
    event.preventDefault();
    setMessage('');
    if (!profile.residenceRegion) {
      setMessage('현재 거주 지역을 선택해 주세요.');
      return;
    }
    setConfirmOpen(true);
  }
  async function save() {
    if (!user || saving) return;
    setConfirmOpen(false);
    setSaving(true);
    setMessage('');
    const client = getSupabaseClient();
    if (!client) {
      setMessage('Supabase 연결값을 확인해 주세요.');
      setSaving(false);
      return;
    }
    try {
      const totalAssets =
        [
          profile.realEstateAssets,
          profile.financialAssets,
          profile.otherAssets,
          profile.carValue,
        ].reduce((sum, value) => sum + Number(value || 0), 0) -
        Number(profile.totalDebt || 0);
      const { error } = await client
        .from('profiles')
        .update({
          birth_date: profile.birthDate,
          residence_region: profile.residenceRegion,
          residence_start_date: profile.residenceStartDate || null,
          household_size: Number(profile.householdSize),
          monthly_income: Number(profile.monthlyIncome),
          total_assets: Math.max(0, totalAssets),
          is_homeless: profile.isHomeless,
          owns_car: profile.ownsCar,
          car_value: profile.ownsCar ? Number(profile.carValue || 0) : null,
          household_type: profile.householdType,
          is_married: profile.householdType === 'married',
          marriage_date: profile.marriageDate || null,
          expected_marriage_date: profile.expectedMarriageDate || null,
          spouse_has_income: profile.spouseHasIncome,
          has_children: profile.hasChildren,
          child_count: profile.hasChildren ? Number(profile.childCount) : 0,
          youngest_child_birth_date: profile.youngestChildBirthDate || null,
          is_pregnant: profile.isPregnant,
          activity_status: profile.activityStatus,
          graduation_date: profile.graduationDate || null,
          real_estate_assets: Number(profile.realEstateAssets || 0),
          financial_assets: Number(profile.financialAssets || 0),
          other_assets: Number(profile.otherAssets || 0),
          total_debt: Number(profile.totalDebt || 0),
          receives_livelihood_benefit: profile.receivesLivelihoodBenefit,
          receives_housing_benefit: profile.receivesHousingBenefit,
          is_near_poverty: profile.isNearPoverty,
          is_supported_single_parent: profile.isSupportedSingleParent,
          subscription_payment_count: Number(
            profile.subscriptionPaymentCount || 0,
          ),
          profile_completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
      if (error) throw error;
      router.replace('/');
    } catch {
      setMessage('저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  }
  if (loading || profileLoading)
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="text-sm text-muted-foreground">
          계정 정보를 확인하고 있어요…
        </p>
      </main>
    );
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ffe6ba,transparent_34%),linear-gradient(180deg,#fffdf8,#fff5ea)] px-6 py-10">
      <div className="mx-auto max-w-5xl">
        <div
          className={`mb-6 flex items-center ${isInitialSetup ? 'justify-end' : 'justify-between'}`}
        >
          {!isInitialSetup && (
            <button
              type="button"
              onClick={() => router.push('/')}
              className="inline-flex items-center gap-2 text-sm font-bold"
            >
              <ArrowLeft className="size-4" /> 돌아가기
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-white">
              <Home className="size-4" />
            </span>
            <strong>내집레이더</strong>
          </div>
        </div>
        <section className="overflow-hidden rounded-[30px] border bg-white shadow-[0_24px_70px_rgba(157,76,47,.13)]">
          <header className="border-b bg-[linear-gradient(120deg,#c94f3a,#e8734f_58%,#f3a452)] p-7 text-white sm:p-9">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="mb-2 text-xs font-bold text-[#ffe39c]">
                  MY HOUSING PROFILE
                </p>
                <h1 className="text-3xl font-extrabold tracking-[-.045em]">
                  내 지원 조건 설정
                </h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/70">
                  LH·SH·HUG 등 공공주거 사업의 자격을 빠르게 확인할 수 있도록
                  기본 정보를 미리 입력해 주세요. 나중에 언제든 수정할 수
                  있습니다.
                </p>
              </div>
              <ShieldCheck className="hidden size-10 text-[#ffe39c] sm:block" />
            </div>
            <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold text-white/85">
              <LockKeyhole className="size-3.5" /> 입력 정보는 로그인한 본인만
              볼 수 있어요
            </div>
          </header>
          <form onSubmit={requestSave} className="space-y-6 p-9">
            <FormSection
              number={1}
              title="기본 정보"
              description="연령, 거주기간, 가구원 수는 지역 우선공급과 소득기준 판정에 사용돼요."
            >
              <div className="grid gap-6 md:grid-cols-2">
                <Field
                  label="생년월일"
                  hint="예: 1995년 3월 15일. 미래 날짜는 입력할 수 없어요."
                >
                  <DateInput
                    value={profile.birthDate}
                    onChange={(value) => update('birthDate', value)}
                    max={today()}
                    required
                  />
                </Field>
                <Field
                  label="현재 거주 지역"
                  hint="현재 주민등록등본상 시·도를 선택해 주세요."
                >
                  <Select
                    value={profile.residenceRegion}
                    onValueChange={(value) =>
                      update('residenceRegion', value ?? '')
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue>
                        {profile.residenceRegion || '지역 선택'}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {regionOptions.map((region) => (
                        <SelectItem key={region} value={region}>
                          {region}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field
                  label="현재 지역 전입일"
                  hint="예: 서울특별시로 전입한 날짜. 거주기간 가점 확인에 사용돼요."
                >
                  <DateInput
                    value={profile.residenceStartDate}
                    onChange={(value) => update('residenceStartDate', value)}
                    max={today()}
                  />
                </Field>
                <Field
                  label="가구원 수"
                  hint="본인을 포함해 함께 심사받는 가족 수를 입력해 주세요. 예: 혼자 거주하면 1명"
                >
                  <IntegerInput
                    value={profile.householdSize}
                    onChange={(value) => update('householdSize', value)}
                    placeholder="예: 1"
                    min={1}
                    max={20}
                    required
                  />
                </Field>
                <Field
                  label="월평균 소득"
                  hint="가구 전체의 세전 월소득 합계입니다. 예: 320만원"
                >
                  <MoneyInput
                    value={profile.monthlyIncome}
                    onChange={(value) => update('monthlyIncome', value)}
                    placeholder="예: 320"
                  />
                </Field>
                <Field
                  label="청약통장 납입회차"
                  hint="실제 납입이 인정된 횟수입니다. 통장이 없으면 0을 입력해 주세요."
                >
                  <IntegerInput
                    value={profile.subscriptionPaymentCount}
                    onChange={(value) =>
                      update('subscriptionPaymentCount', value)
                    }
                    placeholder="예: 24"
                    min={0}
                  />
                </Field>
              </div>
            </FormSection>
            <FormSection
              number={2}
              title="청년 자격 정보"
              description="청년 전세·매입임대의 대학생 및 취업준비생 자격을 확인하는 항목이에요."
            >
              <div className="grid gap-6 md:grid-cols-2">
                <Field
                  label="현재 상태"
                  hint="현재 본인에게 가장 가까운 활동 상태를 선택해 주세요."
                >
                  <Select
                    value={profile.activityStatus}
                    onValueChange={(value) =>
                      update('activityStatus', value ?? 'other')
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue>
                        {optionLabel(activityOptions, profile.activityStatus)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {activityOptions.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {profile.activityStatus === 'job_seeker' && (
                  <Field
                    label="졸업·중퇴일"
                    hint="최종 학교를 졸업하거나 중퇴한 날짜를 입력해 주세요."
                  >
                    <DateInput
                      value={profile.graduationDate}
                      onChange={(value) => update('graduationDate', value)}
                      max={today()}
                    />
                  </Field>
                )}
              </div>
            </FormSection>
            <FormSection
              number={3}
              title="주택 및 자산"
              description="공식 심사 구조에 맞춰 자산 종류별 금액과 부채를 나눠 입력해요."
            >
              <div className="grid gap-6 md:grid-cols-2">
                <Field
                  label="무주택 여부"
                  hint="본인과 심사 대상 가구원이 주택 또는 분양권을 보유했는지 선택해 주세요."
                >
                  <BooleanChoice
                    value={profile.isHomeless}
                    onChange={(value) => update('isHomeless', value)}
                    yes="무주택"
                    no="주택 보유"
                  />
                </Field>
                <Field
                  label="부동산 자산"
                  hint="토지·건물 등 부동산의 공시가격 기준 추정액입니다."
                >
                  <MoneyInput
                    value={profile.realEstateAssets}
                    onChange={(value) => update('realEstateAssets', value)}
                    placeholder="예: 0"
                  />
                </Field>
                <Field
                  label="금융자산"
                  hint="예금, 적금, 주식, 보험 해약환급금 등을 합산해 주세요."
                >
                  <MoneyInput
                    value={profile.financialAssets}
                    onChange={(value) => update('financialAssets', value)}
                    placeholder="예: 2500"
                  />
                </Field>
                <Field
                  label="기타자산"
                  hint="임차보증금 등 부동산·금융·자동차 외 자산을 입력해 주세요."
                >
                  <MoneyInput
                    value={profile.otherAssets}
                    onChange={(value) => update('otherAssets', value)}
                    placeholder="예: 1000"
                  />
                </Field>
                <Field
                  label="인정 부채"
                  hint="금융기관 대출 등 공공주택 심사에서 인정될 수 있는 부채입니다."
                >
                  <MoneyInput
                    value={profile.totalDebt}
                    onChange={(value) => update('totalDebt', value)}
                    placeholder="예: 1500"
                  />
                </Field>
                <Field
                  label="자동차 보유 여부"
                  hint="본인 또는 가구원이 보유한 자동차가 있는지 선택해 주세요."
                >
                  <BooleanChoice
                    value={profile.ownsCar}
                    onChange={(value) => update('ownsCar', value)}
                    yes="있음"
                    no="없음"
                  />
                </Field>
                {profile.ownsCar && (
                  <Field
                    label="자동차 기준가액 추정"
                    hint="구매가격이 아니라 현재 차량기준가액 추정치입니다."
                  >
                    <MoneyInput
                      value={profile.carValue}
                      onChange={(value) => update('carValue', value)}
                      placeholder="예: 1800"
                    />
                  </Field>
                )}
              </div>
            </FormSection>
            <FormSection
              number={4}
              title="가족 정보"
              description="신혼·신생아·한부모 공급의 순위와 소득기준 판정에 사용돼요."
            >
              <div className="grid gap-6 md:grid-cols-2">
                <Field
                  label="가구 유형"
                  hint="혼인신고 여부와 현재 가족 형태를 기준으로 선택해 주세요."
                >
                  <Select
                    value={profile.householdType}
                    onValueChange={(value) =>
                      update('householdType', value ?? 'single')
                    }
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue>
                        {optionLabel(householdOptions, profile.householdType)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {householdOptions.map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {profile.householdType === 'married' && (
                  <Field
                    label="혼인신고일"
                    hint="가족관계증명서상 혼인신고 날짜를 입력해 주세요."
                  >
                    <DateInput
                      value={profile.marriageDate}
                      onChange={(value) => update('marriageDate', value)}
                      max={today()}
                    />
                  </Field>
                )}
                {profile.householdType === 'engaged' && (
                  <Field
                    label="혼인 예정일"
                    hint="공고에서 정한 입주 전 혼인 가능 여부 판단에 사용돼요."
                  >
                    <DateInput
                      value={profile.expectedMarriageDate}
                      onChange={(value) =>
                        update('expectedMarriageDate', value)
                      }
                    />
                  </Field>
                )}
                {['married', 'engaged'].includes(profile.householdType) && (
                  <Field
                    label="배우자 소득 여부"
                    hint="근로·사업 등 정기적인 소득이 있다면 ‘있음’을 선택해 주세요."
                  >
                    <BooleanChoice
                      value={profile.spouseHasIncome}
                      onChange={(value) => update('spouseHasIncome', value)}
                      yes="있음"
                      no="없음"
                    />
                  </Field>
                )}
                <Field
                  label="자녀 여부"
                  hint="태아는 아래 임신 항목에서 별도로 선택해 주세요."
                >
                  <BooleanChoice
                    value={profile.hasChildren}
                    onChange={(value) => update('hasChildren', value)}
                    yes="있음"
                    no="없음"
                  />
                </Field>
                {profile.hasChildren && (
                  <>
                    <Field
                      label="자녀 수"
                      hint="현재 출생한 자녀 수만 숫자로 입력해 주세요."
                    >
                      <IntegerInput
                        value={profile.childCount}
                        onChange={(value) => update('childCount', value)}
                        placeholder="예: 1"
                        min={1}
                        max={20}
                        required
                      />
                    </Field>
                    <Field
                      label="막내 자녀 생년월일"
                      hint="신생아 우선공급 판단에 사용될 수 있어요."
                    >
                      <DateInput
                        value={profile.youngestChildBirthDate}
                        onChange={(value) =>
                          update('youngestChildBirthDate', value)
                        }
                        max={today()}
                      />
                    </Field>
                  </>
                )}
                <Field
                  label="현재 임신 중인 자녀"
                  hint="임신진단서로 증빙 가능한 태아가 있는지 선택해 주세요."
                >
                  <BooleanChoice
                    value={profile.isPregnant}
                    onChange={(value) => update('isPregnant', value)}
                    yes="있음"
                    no="없음"
                  />
                </Field>
              </div>
            </FormSection>
            <FormSection
              number={5}
              title="우선공급·복지 자격"
              description="해당되는 자격을 선택해 주세요. 실제 신청 시 수급자증명서 등 증빙이 필요합니다."
            >
              <div className="grid gap-6 md:grid-cols-2">
                <Field
                  label="생계급여 수급"
                  hint="국민기초생활보장법에 따른 생계급여 수급자 여부입니다."
                >
                  <BooleanChoice
                    value={profile.receivesLivelihoodBenefit}
                    onChange={(value) =>
                      update('receivesLivelihoodBenefit', value)
                    }
                    yes="해당"
                    no="미해당"
                  />
                </Field>
                <Field
                  label="주거급여 수급"
                  hint="현재 주거급여를 받고 있는지 선택해 주세요."
                >
                  <BooleanChoice
                    value={profile.receivesHousingBenefit}
                    onChange={(value) =>
                      update('receivesHousingBenefit', value)
                    }
                    yes="해당"
                    no="미해당"
                  />
                </Field>
                <Field
                  label="차상위계층"
                  hint="차상위계층 확인서를 발급받을 수 있는 경우 ‘해당’을 선택해 주세요."
                >
                  <BooleanChoice
                    value={profile.isNearPoverty}
                    onChange={(value) => update('isNearPoverty', value)}
                    yes="해당"
                    no="미해당"
                  />
                </Field>
                <Field
                  label="지원대상 한부모가족"
                  hint="한부모가족증명서 발급 대상인 경우 선택해 주세요."
                >
                  <BooleanChoice
                    value={profile.isSupportedSingleParent}
                    onChange={(value) =>
                      update('isSupportedSingleParent', value)
                    }
                    yes="해당"
                    no="미해당"
                  />
                </Field>
              </div>
            </FormSection>
            <div className="rounded-xl bg-secondary px-4 py-3 text-xs leading-5 text-muted-foreground">
              <CheckCircle2 className="mr-2 inline size-4 text-primary" />이
              정보는 자동 자격 탐색을 돕기 위한 참고 자료이며 실제 신청 자격은
              각 기관의 최신 공고문을 기준으로 확인해야 합니다.
            </div>
            {message && (
              <p
                role="status"
                className="rounded-xl bg-primary/10 px-4 py-3 text-sm font-bold text-primary"
              >
                {message}
              </p>
            )}
            <Button
              type="submit"
              className="h-12 w-full rounded-xl text-base"
              disabled={saving}
            >
              <Save className="size-4" />
              {saving ? '저장 중…' : '내 조건 저장하기'}
            </Button>
          </form>
        </section>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>입력한 조건을 저장할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              저장한 정보는 맞춤 공공주택 자격 분석에 사용되며, 이후에도 내 조건
              설정에서 수정할 수 있습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>다시 확인하기</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={() => void save()}
              disabled={saving}
            >
              확인하고 저장
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
function FormSection({
  number,
  title,
  description,
  children,
}: {
  number: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-[#fffaf4] p-6">
      <div className="mb-6 flex items-start gap-4 border-b pb-5">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-sm font-black text-white">
          {number}
        </span>
        <div>
          <h2 className="text-xl font-extrabold tracking-[-.035em]">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
function digitsOnly(value: string) {
  return value.replace(/\D/g, '');
}
function normalizeDate(value: string) {
  const [year, ...rest] = value.split('-');
  return [year.slice(0, 4), ...rest].join('-').slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function DateInput({
  value,
  onChange,
  max,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  max?: string;
  required?: boolean;
}) {
  return (
    <Input
      type="date"
      value={value}
      min="1900-01-01"
      max={max}
      onChange={(event) => onChange(normalizeDate(event.target.value))}
      required={required}
    />
  );
}
function IntegerInput({
  value,
  onChange,
  placeholder,
  min,
  max,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  min: number;
  max?: number;
  required?: boolean;
}) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      value={value}
      placeholder={placeholder}
      onChange={(event) => {
        const next = digitsOnly(event.target.value);
        if (max !== undefined && Number(next) > max) return;
        onChange(next);
      }}
      required={required}
      aria-label={`숫자 입력, 최솟값 ${min}`}
    />
  );
}
function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(digitsOnly(event.target.value))}
        className="pr-12"
        required
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
        만원
      </span>
    </div>
  );
}
function BooleanChoice({
  value,
  onChange,
  yes,
  no,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  yes: string;
  no: string;
}) {
  return (
    <RadioGroup
      value={value ? 'yes' : 'no'}
      onValueChange={(next) => onChange(next === 'yes')}
      className="grid grid-cols-2 gap-2"
    >
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-semibold">
        <RadioGroupItem value="yes" />
        {yes}
      </label>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-semibold">
        <RadioGroupItem value="no" />
        {no}
      </label>
    </RadioGroup>
  );
}
