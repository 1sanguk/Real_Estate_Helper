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
  profile_completed_at: string | null;
};

export type OfficialListing = {
  id: string;
  agency: 'LH';
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

export type LhApiRow = Record<string, unknown>;

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
  const areas = supplies.map(item => Number(textValue(item, 'DDO_AR', 'ddoAr', 'SIL_SQMT'))).filter(Number.isFinite);
  const units = supplies.reduce((sum,item)=>sum+Number(textValue(item,'HSH_CNT','hshCnt','SPL_HSH_CNT')||0),0);
  const detailUrl = textValue(row, 'DTL_URL', 'dtlUrl', 'URL');
  return {
    id,
    agency: 'LH',
    title,
    program: textValue(row, 'AIS_TP_CD_NM', 'UPP_AIS_TP_NM', 'aisTpCdNm') || '분양·임대',
    region: textValue(row, 'CNP_CD_NM', 'ARA_HDQ_NM', 'cnpCdNm') || '지역 미확인',
    address: textValue(supplies[0] ?? {}, 'LCC_NT_NM', 'lccNtNm', 'LGDNG_ADDR'),
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
    .filter(([key]) => profile[key] === null || profile[key] === '')
    .map(([, label]) => label);
  return {
    percent: Math.round(
      ((completionFields.length - missing.length) / completionFields.length) *
        100,
    ),
    missing,
  };
}
export function assessListing(
  profile: DashboardProfile,
  listing: OfficialListing,
) {
  const age = calculateAge(profile.birth_date);
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
