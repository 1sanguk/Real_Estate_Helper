export type DashboardProfile = {
  birth_date: string | null;
  residence_region: string | null;
  household_size: number | null;
  monthly_income: number | null;
  total_assets: number | null;
  is_homeless: boolean | null;
  activity_status: string | null;
  household_type: string | null;
  owns_car: boolean | null;
  car_value: number | null;
  is_married?: boolean | null;
  has_children?: boolean | null;
  child_count?: number | null;
  marriage_date?: string | null;
  expected_marriage_date?: string | null;
  spouse_has_income?: boolean | null;
  youngest_child_birth_date?: string | null;
  is_pregnant?: boolean | null;
  graduation_date?: string | null;
  receives_livelihood_benefit?: boolean | null;
  receives_housing_benefit?: boolean | null;
  is_near_poverty?: boolean | null;
  is_supported_single_parent?: boolean | null;
  subscription_payment_count?: number | null;
  residence_start_date?: string | null;
  profile_completed_at: string | null;
};

export type OfficialListing = {
  id: string;
  agency: 'LH' | 'SH' | 'HUG';
  title: string;
  program: string;
  region: string;
  address?: string;
  area?: string;
  units?: string;
  publishedAt: string;
  applicationPeriod?: string;
  status: string;
  minimumAge?: number;
  sourceUrl: string;
};

export type OfficialListingRow = {
  source_listing_id: string;
  agency: 'LH' | 'SH' | 'HUG';
  title: string;
  program: string;
  region: string;
  address?: string | null;
  area?: string | null;
  units?: string | null;
  published_at?: string | null;
  application_period?: string | null;
  status: string;
  minimum_age?: number | null;
  source_url: string;
};

export const ACTIVE_LISTING_STATUSES = ['공고중', '정정공고중', '접수중'] as const;

export function isActiveListingStatus(status: string) {
  return ACTIVE_LISTING_STATUSES.includes(
    status.trim() as (typeof ACTIVE_LISTING_STATUSES)[number],
  );
}

export function mapOfficialListingRow(row: OfficialListingRow): OfficialListing {
  return {
    id: row.source_listing_id,
    agency: row.agency,
    title: row.title,
    program: row.program,
    region: row.region,
    address: row.address ?? undefined,
    area: row.area ?? undefined,
    units: row.units ?? undefined,
    publishedAt: row.published_at ?? '',
    applicationPeriod: row.application_period ?? undefined,
    status: row.status,
    minimumAge: row.minimum_age ?? undefined,
    sourceUrl: row.source_url,
  };
}

export type LhApiRow = Record<string, unknown>;
export type StoredEligibilityRule = {
  rule_key: string;
  operator: string;
  numeric_value: number | null;
  text_value: string | null;
  description: string;
  evidence_text?: string;
  confidence?: number;
};

function textValue(row: LhApiRow, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) return String(value).trim();
  }
  return '';
}

function displayDate(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length === 8 ? `${digits.slice(0,4)}-${digits.slice(4,6)}-${digits.slice(6)}` : value;
}

export function mapLhApiListing(row: LhApiRow, supplies: LhApiRow[] = []): OfficialListing | null {
  const id = textValue(row, 'PAN_ID', 'panId', 'pan_id');
  const title = textValue(row, 'PAN_NM', 'panNm', 'pan_nm');
  if (!id || !title) return null;
  const areas = supplies.map(item => Number(textValue(item, 'DDO_AR', 'ddoAr', 'SIL_SQMT'))).filter(value => Number.isFinite(value) && value > 0);
  const countedUnits = supplies.reduce((sum,item)=>sum+Number(textValue(item,'HSH_CNT','hshCnt','SPL_HSH_CNT')||0),0);
  const units = countedUnits || supplies.filter(item => textValue(item, 'HO_NO', 'hoNo')).length;
  const detailUrl = textValue(row, 'DTL_URL', 'dtlUrl', 'URL');
  return {
    id,
    agency: 'LH',
    title,
    program: textValue(row, 'AIS_TP_CD_NM', 'UPP_AIS_TP_NM', 'aisTpCdNm') || '분양·임대',
    region: textValue(row, 'CNP_CD_NM', 'ARA_HDQ_NM', 'cnpCdNm') || '지역 미확인',
    address: textValue(supplies[0] ?? {}, 'LCC_NT_NM', 'lccNtNm', 'LGDNG_ADDR', 'ADR'),
    area: areas.length ? `전용 ${Math.min(...areas)}~${Math.max(...areas)}㎡` : undefined,
    units: units > 0 ? `공급 ${units.toLocaleString()}명` : undefined,
    publishedAt: displayDate(textValue(row, 'PAN_NT_ST_DT', 'panNtStDt', 'PAN_DT')),
    applicationPeriod: [textValue(row,'ACP_ST_DT','acpStDt'),textValue(row,'ACP_ED_DT','acpEdDt')].filter(Boolean).map(displayDate).join('~') || undefined,
    status: textValue(row, 'PAN_SS', 'PAN_SS_NM', 'panSs') || '상태 미확인',
    sourceUrl: detailUrl || `https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?panId=${encodeURIComponent(id)}`,
  };
}

export function mapLhApiResponse(rows: LhApiRow[], supplyRows: LhApiRow[]): OfficialListing[] {
  return rows.map(row=>mapLhApiListing(row,supplyRows.filter(supply=>textValue(supply,'PAN_ID','panId','pan_id')===textValue(row,'PAN_ID','panId','pan_id')))).filter((listing):listing is OfficialListing=>listing!==null);
}

export const officialListings: OfficialListing[] = [
  {
    id: '2015122300020652',
    agency: 'LH',
    title: '2026년 9월 부천시 국민임대주택 예비입주자 모집',
    program: '국민임대',
    region: '경기도',
    area: '전용 36.79~51.64㎡',
    units: '예비입주자 65명',
    publishedAt: '2026-09-07',
    applicationPeriod: '2026.09.21~09.22',
    status: '공고중',
    sourceUrl:
      'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?aisTpCd=07&ccrCnntSysDsCd=03&mi=1026&panId=2015122300020652&uppAisTpCd=06',
  },
  {
    id: '2015122300020578',
    agency: 'LH',
    title: '인천옹진백령 국민임대주택 예비입주자 모집',
    program: '국민임대',
    region: '인천광역시',
    address: '옹진군 백령면 백령로278번길 133-31',
    area: '전용 26.8~43.33㎡',
    units: '예비입주자 6명',
    publishedAt: '2026-09-07',
    status: '공고중',
    sourceUrl:
      'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?aisTpCd=07&ccrCnntSysDsCd=03&mi=1026&panId=2015122300020578&uppAisTpCd=06',
  },
  {
    id: '2015122300020701',
    agency: 'LH',
    title: '김제하동 국민임대주택 모집공고',
    program: '고령자용 국민임대',
    region: '전북특별자치도',
    address: '김제시 하동1길 127',
    area: '전용 34.28~42.87㎡',
    units: '예비입주자 6명',
    publishedAt: '2026-09-07',
    applicationPeriod: '2026.09.15~09.17',
    status: '공고중',
    minimumAge: 65,
    sourceUrl:
      'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?aisTpCd=07&ccrCnntSysDsCd=03&mi=1026&panId=2015122300020701&uppAisTpCd=06',
  },
  {
    id: '2015122300020697',
    agency: 'LH',
    title: '인천옹진연평 국민임대주택 예비입주자 모집',
    program: '국민임대',
    region: '인천광역시',
    address: '옹진군 연평면 연평로 198',
    area: '전용 24.7~46.79㎡',
    units: '예비입주자 6명',
    publishedAt: '2026-09-07',
    status: '공고중',
    sourceUrl:
      'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?aisTpCd=07&ccrCnntSysDsCd=03&mi=1026&panId=2015122300020697&uppAisTpCd=06',
  },
  {
    id: '2015122300020668',
    agency: 'LH',
    title: '남양주마석2단지 국민임대주택 예비입주자 모집',
    program: '국민임대',
    region: '경기도',
    address: '남양주시 화도읍 맷돌로91번길 7',
    area: '전용 51.49~59.64㎡',
    units: '예비입주자 70명',
    publishedAt: '2026-09-07',
    status: '공고중',
    sourceUrl:
      'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?aisTpCd=07&ccrCnntSysDsCd=03&mi=1026&panId=2015122300020668&uppAisTpCd=06',
  },
  {
    id: '2015122300020662',
    agency: 'LH',
    title: '김포지역 국민임대주택 예비입주자 모집',
    program: '국민임대',
    region: '경기도',
    address: '김포 마송·장기·양곡',
    area: '전용 36.2~59.89㎡',
    publishedAt: '2026-09-07',
    status: '정정공고중',
    sourceUrl:
      'https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?aisTpCd=07&ccrCnntSysDsCd=03&mi=1026&panId=2015122300020662&uppAisTpCd=06',
  },
];

const completionFields: Array<[keyof DashboardProfile, string]> = [
  ['birth_date', '생년월일'],
  ['residence_region', '현재 거주 지역'],
  ['household_size', '가구원 수'],
  ['monthly_income', '월평균 소득'],
  ['total_assets', '총자산'],
  ['is_homeless', '무주택 여부'],
  ['activity_status', '현재 활동 상태'],
  ['household_type', '가구 유형'],
  ['owns_car', '자동차 보유 여부'],
];

export function calculateAge(
  birthDate: string | null,
  today = new Date(),
): number | null {
  if (!birthDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  )
    age--;
  return age;
}
export function profileCompletion(profile: DashboardProfile) {
  const missing = completionFields
    .filter(([key]) => profile[key] == null || profile[key] === '')
    .map(([, label]) => label);
  return {
    percent: Math.round(
      ((completionFields.length - missing.length) / completionFields.length) *
        100,
    ),
    missing,
  };
}

export type EligibilityCheckStatus = '충족' | '미충족' | '확인 필요';

export type EligibilityCheck = {
  key: string;
  label: string;
  status: EligibilityCheckStatus;
  detail: string;
};

export function getEligibilityChecks(
  profile: DashboardProfile,
  listing: OfficialListing,
  rules: StoredEligibilityRule[] = [],
): EligibilityCheck[] {
  const age = calculateAge(profile.birth_date);
  const yearsSince = (date: string | null | undefined) => {
    if (!date) return null;
    const parsed = new Date(`${date}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return (Date.now() - parsed.getTime()) / (365.2425 * 86_400_000);
  };
  const checks: EligibilityCheck[] = [
    {
      key: 'homeless',
      label: '무주택',
      status:
        profile.is_homeless == null
          ? '확인 필요'
          : profile.is_homeless
            ? '충족'
            : '미충족',
      detail:
        profile.is_homeless == null
          ? '무주택 여부를 입력해야 합니다.'
          : profile.is_homeless
            ? '저장된 정보상 무주택입니다.'
            : '저장된 정보상 주택을 보유하고 있습니다.',
    },
    {
      key: 'region',
      label: '거주지역',
      status:
        profile.residence_region && profile.residence_region === listing.region
          ? '충족'
          : '확인 필요',
      detail:
        profile.residence_region && profile.residence_region === listing.region
          ? `${listing.region} 거주 조건이 일치합니다.`
          : '타 지역 신청 가능 여부와 지역 우선순위를 공고문에서 확인해야 합니다.',
    },
  ];

  const effectiveRules = listing.minimumAge
    ? [
        ...rules,
        {
          rule_key: 'age_min',
          operator: 'gte',
          numeric_value: listing.minimumAge,
          text_value: null,
          description: `만 ${listing.minimumAge}세 이상`,
        },
      ]
    : rules;

  for (const rule of effectiveRules) {
    let check: EligibilityCheck | null = null;
    if (rule.confidence != null && rule.confidence < 0.8) {
      checks.push({ key: `review-${rule.rule_key}-${rule.description}`, label: rule.description, status: '확인 필요', detail: '자동 추출 신뢰도가 낮아 공식 원문 또는 관리자 검수가 필요합니다.' });
      continue;
    }
    if (rule.rule_key === 'age_min' && rule.numeric_value != null) {
      check = {
        key: `age-min-${rule.numeric_value}`,
        label: '최소 연령',
        status: age == null ? '확인 필요' : age >= rule.numeric_value ? '충족' : '미충족',
        detail: age == null ? '생년월일 입력이 필요합니다.' : `${age}세 / 기준 ${rule.numeric_value}세 이상`,
      };
    } else if (rule.rule_key === 'age_max' && rule.numeric_value != null) {
      check = {
        key: `age-max-${rule.numeric_value}`,
        label: '최대 연령',
        status: age == null ? '확인 필요' : age <= rule.numeric_value ? '충족' : '미충족',
        detail: age == null ? '생년월일 입력이 필요합니다.' : `${age}세 / 기준 ${rule.numeric_value}세 이하`,
      };
    } else if (rule.rule_key === 'total_assets_max' && rule.numeric_value != null) {
      check = {
        key: `assets-${rule.numeric_value}`,
        label: '총자산',
        status: profile.total_assets == null ? '확인 필요' : profile.total_assets <= rule.numeric_value ? '충족' : '미충족',
        detail: profile.total_assets == null ? '총자산 입력이 필요합니다.' : `${profile.total_assets.toLocaleString()}만원 / 기준 ${rule.numeric_value.toLocaleString()}만원 이하`,
      };
    } else if (rule.rule_key === 'car_value_max' && rule.numeric_value != null) {
      const carValue = profile.owns_car ? profile.car_value : 0;
      check = {
        key: `car-${rule.numeric_value}`,
        label: '자동차 가액',
        status: carValue == null ? '확인 필요' : carValue <= rule.numeric_value ? '충족' : '미충족',
        detail: carValue == null ? '자동차 가액 입력이 필요합니다.' : `${carValue.toLocaleString()}만원 / 기준 ${rule.numeric_value.toLocaleString()}만원 이하`,
      };
    } else if (rule.rule_key === 'income_percent_max') {
      check = {
        key: `income-${rule.numeric_value ?? rule.text_value ?? 'rule'}`,
        label: '소득',
        status: '확인 필요',
        detail: `${rule.description} — 가구원 수별 기준금액은 공식 공고문에서 확인해야 합니다.`,
      };
    } else if (rule.rule_key === 'monthly_income_max' && rule.numeric_value != null) {
      const applies = !rule.text_value || Number(rule.text_value) === profile.household_size;
      if (!applies) continue;
      check = {
        key: `monthly-income-${rule.text_value ?? 'all'}-${rule.numeric_value}`,
        label: '월평균소득',
        status: profile.monthly_income == null ? '확인 필요' : profile.monthly_income <= rule.numeric_value ? '충족' : '미충족',
        detail: profile.monthly_income == null ? '월평균소득 입력이 필요합니다.' : `${profile.monthly_income.toLocaleString()}만원 / 기준 ${rule.numeric_value.toLocaleString()}만원 이하`,
      };
    } else if (rule.rule_key === 'marriage_years_max' && rule.numeric_value != null) {
      const marriageYears = yearsSince(profile.marriage_date);
      check = {
        key: `marriage-${rule.numeric_value}`,
        label: '혼인 기간',
        status: marriageYears == null ? '확인 필요' : marriageYears <= rule.numeric_value ? '충족' : '미충족',
        detail: marriageYears == null ? '혼인일 입력이 필요합니다.' : `혼인 약 ${Math.floor(marriageYears)}년 / 기준 ${rule.numeric_value}년 이내`,
      };
    } else if (rule.rule_key === 'subscription_payment_min' && rule.numeric_value != null) {
      check = {
        key: `subscription-${rule.numeric_value}`,
        label: '청약 납입',
        status: profile.subscription_payment_count == null ? '확인 필요' : profile.subscription_payment_count >= rule.numeric_value ? '충족' : '미충족',
        detail: profile.subscription_payment_count == null ? '청약통장 납입 횟수 입력이 필요합니다.' : `${profile.subscription_payment_count}회 / 기준 ${rule.numeric_value}회 이상`,
      };
    } else if (rule.rule_key === 'residence_months_min' && rule.numeric_value != null) {
      const residenceYears = yearsSince(profile.residence_start_date);
      const residenceMonths = residenceYears == null ? null : Math.floor(residenceYears * 12);
      check = {
        key: `residence-months-${rule.numeric_value}`,
        label: '거주 기간',
        status: residenceMonths == null ? '확인 필요' : residenceMonths >= rule.numeric_value ? '충족' : '미충족',
        detail: residenceMonths == null ? '현재 지역 전입일 입력이 필요합니다.' : `약 ${residenceMonths}개월 / 기준 ${rule.numeric_value}개월 이상`,
      };
    } else if (rule.rule_key === 'graduation_years_max' && rule.numeric_value != null) {
      const graduationYears = yearsSince(profile.graduation_date);
      check = {
        key: `graduation-${rule.numeric_value}`,
        label: '졸업 후 기간',
        status: graduationYears == null ? '확인 필요' : graduationYears <= rule.numeric_value ? '충족' : '미충족',
        detail: graduationYears == null ? '졸업일 입력이 필요합니다.' : `졸업 후 약 ${Math.floor(graduationYears)}년 / 기준 ${rule.numeric_value}년 이내`,
      };
    } else if (rule.rule_key === 'children_required') {
      const hasChild = Boolean(profile.has_children || profile.is_pregnant);
      check = { key: 'children-required', label: '자녀·태아', status: hasChild ? '충족' : '미충족', detail: hasChild ? '저장된 정보에 자녀 또는 태아가 있습니다.' : '자녀 또는 태아 요건에 해당하지 않습니다.' };
    } else if (rule.rule_key === 'activity_status' && rule.text_value) {
      const allowed = rule.text_value.split(',');
      check = { key: `activity-${rule.text_value}`, label: '활동 상태', status: profile.activity_status == null ? '확인 필요' : allowed.includes(profile.activity_status) ? '충족' : '미충족', detail: rule.description };
    }
    if (check && !checks.some((item) => item.key === check?.key)) checks.push(check);
  }
  return checks;
}

export function assessListing(
  profile: DashboardProfile,
  listing: OfficialListing,
) {
  const age = calculateAge(profile.birth_date);
  if (profile.is_homeless == null)
    return { status: '추가 확인', tone: 'warning', reason: '무주택 여부가 입력되지 않았습니다. 내 조건에서 확인해 주세요.' } as const;
  if (profile.is_homeless === false)
    return {
      status: '어려움',
      tone: 'danger',
      reason: '국민임대는 무주택 요건 확인이 필요합니다.',
    } as const;
  if (listing.minimumAge && age !== null && age < listing.minimumAge)
    return {
      status: '어려움',
      tone: 'danger',
      reason: `이 공고는 만 ${listing.minimumAge}세 이상 대상입니다.`,
    } as const;
  if (profile.residence_region === listing.region)
    return {
      status: '가능성 있음',
      tone: 'success',
      reason:
        '거주 지역과 무주택 조건이 일치합니다. 소득·자산·순위는 원문 확인이 필요합니다.',
    } as const;
  return {
    status: '추가 확인',
    tone: 'warning',
    reason:
      '타 지역 신청·순위 조건과 소득·자산 기준을 공고문에서 확인해야 합니다.',
  } as const;
}

export function assessListingWithRules(
  profile: DashboardProfile,
  listing: OfficialListing,
  rules: StoredEligibilityRule[],
) {
  const base = assessListing(profile, listing);
  if (base.status === '어려움' || rules.length === 0) return base;
  const age = calculateAge(profile.birth_date);
  const yearsSince = (date: string | null | undefined) => {
    if (!date) return null;
    const parsed = new Date(`${date}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : (Date.now() - parsed.getTime()) / (365.2425 * 86_400_000);
  };
  const unmet: string[] = [];
  const unknown: string[] = [];
  let checked = 0;
  for (const rule of rules) {
    if (rule.confidence != null && rule.confidence < 0.8) {
      unknown.push(rule.description);
      continue;
    }
    if (rule.rule_key === 'age_min' && rule.numeric_value != null)
      age == null ? unknown.push('나이') : age < rule.numeric_value ? unmet.push(rule.description) : checked++;
    else if (rule.rule_key === 'age_max' && rule.numeric_value != null)
      age == null ? unknown.push('나이') : age > rule.numeric_value ? unmet.push(rule.description) : checked++;
    else if (rule.rule_key === 'total_assets_max' && rule.numeric_value != null)
      profile.total_assets == null ? unknown.push('총자산') : profile.total_assets > rule.numeric_value ? unmet.push(rule.description) : checked++;
    else if (rule.rule_key === 'car_value_max' && rule.numeric_value != null && profile.owns_car)
      profile.car_value == null ? unknown.push('자동차 가액') : profile.car_value > rule.numeric_value ? unmet.push(rule.description) : checked++;
    else if (rule.rule_key === 'homeless_required')
      profile.is_homeless == null ? unknown.push('무주택 여부') : !profile.is_homeless ? unmet.push(rule.description) : checked++;
    else if (rule.rule_key === 'income_percent_max') unknown.push('가구원별 소득 기준');
    else if (rule.rule_key === 'monthly_income_max' && rule.numeric_value != null) {
      if (rule.text_value && Number(rule.text_value) !== profile.household_size) continue;
      profile.monthly_income == null ? unknown.push('월평균소득') : profile.monthly_income > rule.numeric_value ? unmet.push(rule.description) : checked++;
    }
    else if (rule.rule_key === 'marriage_years_max' && rule.numeric_value != null) {
      const years = yearsSince(profile.marriage_date);
      years == null ? unknown.push('혼인 기간') : years > rule.numeric_value ? unmet.push(rule.description) : checked++;
    } else if (rule.rule_key === 'subscription_payment_min' && rule.numeric_value != null)
      profile.subscription_payment_count == null ? unknown.push('청약 납입 횟수') : profile.subscription_payment_count < rule.numeric_value ? unmet.push(rule.description) : checked++;
    else if (rule.rule_key === 'residence_months_min' && rule.numeric_value != null) {
      const years = yearsSince(profile.residence_start_date);
      years == null ? unknown.push('거주 기간') : years * 12 < rule.numeric_value ? unmet.push(rule.description) : checked++;
    } else if (rule.rule_key === 'graduation_years_max' && rule.numeric_value != null) {
      const years = yearsSince(profile.graduation_date);
      years == null ? unknown.push('졸업 후 기간') : years > rule.numeric_value ? unmet.push(rule.description) : checked++;
    } else if (rule.rule_key === 'children_required')
      profile.has_children || profile.is_pregnant ? checked++ : unmet.push(rule.description);
    else if (rule.rule_key === 'activity_status' && rule.text_value)
      profile.activity_status == null ? unknown.push('활동 상태') : rule.text_value.split(',').includes(profile.activity_status) ? checked++ : unmet.push(rule.description);
  }
  if (unmet.length)
    return { status: '어려움', tone: 'danger', reason: `공고문 조건 불충족: ${unmet.join(', ')}` } as const;
  if (unknown.length)
    return { status: '추가 확인', tone: 'warning', reason: `${checked}개 조건 충족. 추가 확인: ${[...new Set(unknown)].join(', ')}` } as const;
  if (base.status === '가능성 있음' && checked)
    return { status: '가능성 있음', tone: 'success', reason: `공고문에서 추출한 ${checked}개 조건과 거주 지역·무주택 조건이 일치합니다.` } as const;
  return base;
}
