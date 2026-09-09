export type RequiredDocument = {
  id: number;
  label: string;
  issuer: string;
};

/**
 * 공고문 서식 분석(로드맵 4단계)이 완료되기 전까지 사용하는 공통 서류 안내.
 * 공고별 확정 서류 목록이 아니므로 화면에는 항상 원문 대조 안내와 함께 표시한다.
 */
export const commonRequiredDocuments: RequiredDocument[] = [
  { id: 0, label: '주민등록등본', issuer: '정부24' },
  { id: 1, label: '가족관계증명서', issuer: '전자가족관계등록시스템' },
  { id: 2, label: '소득금액증명원', issuer: '홈택스' },
  { id: 3, label: '지방세 세목별 과세증명서', issuer: '정부24' },
  { id: 4, label: '금융정보 제공동의서', issuer: '공고문 서식' },
];
