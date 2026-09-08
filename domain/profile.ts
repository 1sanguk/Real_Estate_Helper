export type HousingProfile = {
  birthDate: string;
  residenceRegion: string;
  householdSize: string;
  monthlyIncome: string;
  totalAssets: string;
  isHomeless: boolean;
  ownsCar: boolean;
  carValue: string;
  isMarried: boolean;
  hasChildren: boolean;
  childCount: string;
  householdType: string;
  marriageDate: string;
  expectedMarriageDate: string;
  spouseHasIncome: boolean;
  youngestChildBirthDate: string;
  isPregnant: boolean;
  activityStatus: string;
  graduationDate: string;
  realEstateAssets: string;
  financialAssets: string;
  otherAssets: string;
  totalDebt: string;
  receivesLivelihoodBenefit: boolean;
  receivesHousingBenefit: boolean;
  isNearPoverty: boolean;
  isSupportedSingleParent: boolean;
  subscriptionPaymentCount: string;
  residenceStartDate: string;
};

export const emptyHousingProfile: HousingProfile = {
  birthDate: '', residenceRegion: '', householdSize: '1', monthlyIncome: '', totalAssets: '',
  isHomeless: true, ownsCar: false, carValue: '', isMarried: false, hasChildren: false, childCount: '0',
  householdType: 'single', marriageDate: '', expectedMarriageDate: '', spouseHasIncome: false,
  youngestChildBirthDate: '', isPregnant: false, activityStatus: 'employed', graduationDate: '',
  realEstateAssets: '', financialAssets: '', otherAssets: '', totalDebt: '', receivesLivelihoodBenefit: false,
  receivesHousingBenefit: false, isNearPoverty: false, isSupportedSingleParent: false,
  subscriptionPaymentCount: '0', residenceStartDate: '',
};

export const regionOptions = ['서울특별시','부산광역시','대구광역시','인천광역시','광주광역시','대전광역시','울산광역시','세종특별자치시','경기도','강원특별자치도','충청북도','충청남도','전북특별자치도','전라남도','경상북도','경상남도','제주특별자치도'];
