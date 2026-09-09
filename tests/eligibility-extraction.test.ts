import assert from 'node:assert/strict';
import test from 'node:test';
import { extractEligibilityRules, extractRequiredDocuments } from '../domain/eligibility-extraction.ts';

void test('공고문에서 연령·자산·자동차·무주택 규칙을 근거와 함께 추출한다', () => {
  const text = '신청자는 만 19세 이상 만 39세 이하인 무주택세대구성원이어야 한다. 총자산은 34,500만원 이하, 자동차 가액은 3,708만원 이하이다.';
  const rules = extractEligibilityRules(text);
  assert.equal(rules.find((item) => item.ruleKey === 'age_min')?.numericValue, 19);
  assert.equal(rules.find((item) => item.ruleKey === 'age_max')?.numericValue, 39);
  assert.equal(rules.find((item) => item.ruleKey === 'total_assets_max')?.numericValue, 34500);
  assert.equal(rules.find((item) => item.ruleKey === 'car_value_max')?.numericValue, 3708);
  assert.ok(rules.every((item) => item.evidenceText.length > 0));
});

void test('공고문에서 필수 및 조건부 서류를 구분한다', () => {
  const text = '공통 제출서류: 주민등록등본, 가족관계증명서. 임신한 해당자는 임신진단서를 제출합니다.';
  const documents = extractRequiredDocuments(text);
  assert.equal(documents.find((item) => item.documentName === '주민등록등본')?.requirementType, '필수');
  assert.equal(documents.find((item) => item.documentName === '임신진단서')?.requirementType, '조건부');
});

void test('혼인·청약·거주·졸업 조건을 구조화한다', () => {
  const text = '혼인신고일 기준 7년 이내이며 청약저축 24회 이상 납입해야 한다. 현재 지역에서 2년 이상 계속 거주하고 졸업 후 2년 이내인 취업준비생을 대상으로 한다.';
  const rules = extractEligibilityRules(text);
  assert.equal(rules.find((item) => item.ruleKey === 'marriage_years_max')?.numericValue, 7);
  assert.equal(rules.find((item) => item.ruleKey === 'subscription_payment_min')?.numericValue, 24);
  assert.equal(rules.find((item) => item.ruleKey === 'residence_months_min')?.numericValue, 24);
  assert.equal(rules.find((item) => item.ruleKey === 'graduation_years_max')?.numericValue, 2);
});

void test('가구원 수별 월평균소득 금액을 만원 단위 규칙으로 변환한다', () => {
  const rules = extractEligibilityRules('소득 기준표 1인 가구 월평균소득 4,317,797원 이하');
  const rule = rules.find((item) => item.ruleKey === 'monthly_income_max');
  assert.equal(rule?.textValue, '1');
  assert.equal(rule?.numericValue, 431);
});
