export type ExtractedRule = {
  ruleKey: string;
  operator: string;
  numericValue: number | null;
  textValue: string | null;
  description: string;
  evidenceText: string;
  confidence: number;
};

export type ExtractedDocument = {
  documentName: string;
  requirementType: '필수' | '조건부' | '확인 필요';
  issuer: string | null;
  evidenceText: string;
};

const documentDefinitions = [
  ['주민등록등본', /주민등록(?:표)?\s*등본/, '정부24'],
  ['주민등록초본', /주민등록(?:표)?\s*초본/, '정부24'],
  ['가족관계증명서', /가족관계증명서/, '전자가족관계등록시스템'],
  ['혼인관계증명서', /혼인관계증명서/, '전자가족관계등록시스템'],
  ['기본증명서', /기본증명서/, '전자가족관계등록시스템'],
  ['건강보험 자격득실확인서', /건강보험\s*자격득실확인서/, '국민건강보험공단'],
  ['건강보험료 납부확인서', /건강보험료\s*납부확인서/, '국민건강보험공단'],
  ['소득금액증명', /소득금액증명(?:원)?/, '국세청 홈택스'],
  ['사실증명', /사실증명[^\n]{0,20}신고사실없음/, '국세청 홈택스'],
  ['재직증명서', /재직증명서/, '근무처'],
  ['금융정보 제공동의서', /금융정보\s*(?:등\s*)?제공\s*동의서/, '공고문 서식'],
  ['자산보유사실 확인서', /자산보유사실\s*확인서/, '공고문 서식'],
  ['개인정보 수집·이용 동의서', /개인정보\s*수집[^\n]{0,20}(?:이용|제공)\s*동의서/, '공고문 서식'],
  ['임신진단서', /임신진단서/, '의료기관'],
  ['장애인증명서', /장애인증명서/, '정부24'],
  ['한부모가족증명서', /한부모가족증명서/, '정부24'],
  ['재학증명서', /재학증명서/, '학교'],
  ['졸업증명서', /졸업증명서/, '학교'],
  ['근로계약서', /근로계약서/, '근무처'],
] as const;

function evidenceAround(text: string, index: number, length: number): string {
  return text.slice(Math.max(0, index - 80), Math.min(text.length, index + length + 140))
    .replace(/\s+/g, ' ').trim();
}

export function extractRequiredDocuments(text: string): ExtractedDocument[] {
  const found = new Map<string, ExtractedDocument>();
  for (const [name, pattern, issuer] of documentDefinitions) {
    const match = pattern.exec(text);
    if (!match) continue;
    const evidence = evidenceAround(text, match.index, match[0].length);
    const conditionContext = text.slice(Math.max(0, match.index - 80), match.index + match[0].length);
    const requirementType = /해당자|해당하는 경우|해당 세대/.test(conditionContext)
      ? '조건부'
      : /제출서류|구비서류|필수서류|공통서류/.test(evidence)
        ? '필수'
        : '확인 필요';
    found.set(name, { documentName: name, requirementType, issuer, evidenceText: evidence });
  }
  return [...found.values()];
}

export function extractEligibilityRules(text: string): ExtractedRule[] {
  const rules: ExtractedRule[] = [];
  const add = (rule: ExtractedRule) => {
    if (!rules.some((item) => item.ruleKey === rule.ruleKey && item.description === rule.description)) rules.push(rule);
  };
  const normalized = text.replace(/\s+/g, ' ');
  const ageRange = /만\s*(\d{1,2})세\s*이상[^.。\n]{0,80}?만\s*(\d{1,2})세\s*이하/.exec(normalized);
  if (ageRange) {
    const evidence = evidenceAround(normalized, ageRange.index, ageRange[0].length);
    add({ ruleKey: 'age_min', operator: 'gte', numericValue: Number(ageRange[1]), textValue: null, description: `만 ${ageRange[1]}세 이상`, evidenceText: evidence, confidence: 0.95 });
    add({ ruleKey: 'age_max', operator: 'lte', numericValue: Number(ageRange[2]), textValue: null, description: `만 ${ageRange[2]}세 이하`, evidenceText: evidence, confidence: 0.95 });
  }
  const asset = /총자산[^.。\n]{0,80}?([0-9][0-9,]*)\s*만원\s*이하/.exec(normalized);
  if (asset) add({ ruleKey: 'total_assets_max', operator: 'lte', numericValue: Number(asset[1].replaceAll(',', '')), textValue: null, description: `총자산 ${asset[1]}만원 이하`, evidenceText: evidenceAround(normalized, asset.index, asset[0].length), confidence: 0.85 });
  const car = /자동차[^.。\n]{0,100}?([0-9][0-9,]*)\s*만원\s*이하/.exec(normalized);
  if (car) add({ ruleKey: 'car_value_max', operator: 'lte', numericValue: Number(car[1].replaceAll(',', '')), textValue: null, description: `자동차 가액 ${car[1]}만원 이하`, evidenceText: evidenceAround(normalized, car.index, car[0].length), confidence: 0.85 });
  const income = /도시근로자[^.。\n]{0,140}?월평균소득[^.。\n]{0,100}?(\d{2,3})\s*%\s*이하/.exec(normalized);
  if (income) add({ ruleKey: 'income_percent_max', operator: 'lte', numericValue: Number(income[1]), textValue: null, description: `도시근로자 월평균소득 ${income[1]}% 이하`, evidenceText: evidenceAround(normalized, income.index, income[0].length), confidence: 0.75 });
  const homeless = /무주택세대구성원|무주택자인/.exec(normalized);
  if (homeless) add({ ruleKey: 'homeless_required', operator: 'eq', numericValue: null, textValue: 'true', description: '무주택 요건', evidenceText: evidenceAround(normalized, homeless.index, homeless[0].length), confidence: 0.9 });
  return rules;
}
