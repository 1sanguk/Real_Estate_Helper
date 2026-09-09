import assert from 'node:assert/strict';
import test from 'node:test';
import { assessListing, calculateAge, mapLhApiResponse, mapOfficialListingRow, profileCompletion, type DashboardProfile } from '../domain/dashboard.ts';

const completeProfile: DashboardProfile = { birth_date:'1990-09-08', residence_region:'경기도', household_size:1, monthly_income:180, total_assets:2500, is_homeless:true, activity_status:'employed', household_type:'single', owns_car:false, car_value:null, profile_completed_at:'2026-09-08T00:00:00Z' };

void test('무주택 정보가 없으면 같은 지역이어도 가능성 있음으로 판정하지 않는다', () => {
  const listing = mapLhApiResponse([{ PAN_ID: 'missing', PAN_NM: '공고', CNP_CD_NM: '경기도' }], [])[0];
  assert.equal(assessListing({ ...completeProfile, is_homeless: null }, listing).status, '추가 확인');
});

void test('면적이 없는 공급정보를 0제곱미터로 표시하지 않는다', () => {
  const listing = mapLhApiResponse([{ PAN_ID: 'area', PAN_NM: '공고' }], [{ PAN_ID: 'area', HSH_CNT: '3' }])[0];
  assert.equal(listing.area, undefined);
});

test('LH 목록과 공급 모의 응답을 화면 공고 형식으로 결합한다',()=>{
  const listings=mapLhApiResponse([{PAN_ID:'P-100',PAN_NM:'테스트 국민임대 모집',AIS_TP_CD_NM:'국민임대',CNP_CD_NM:'경기도',PAN_NT_ST_DT:'20260908',PAN_SS:'공고중',DTL_URL:'https://apply.lh.or.kr/example'}],[{PAN_ID:'P-100',DDO_AR:'36.5',HSH_CNT:'20',LCC_NT_NM:'경기도 수원시'},{PAN_ID:'P-100',DDO_AR:'46.2',HSH_CNT:'10'}]);
  assert.equal(listings.length,1);assert.equal(listings[0].id,'P-100');assert.equal(listings[0].area,'전용 36.5~46.2㎡');assert.equal(listings[0].units,'공급 30명');assert.equal(listings[0].publishedAt,'2026-09-08');
});

test('필수 식별자가 없는 잘못된 API 행은 화면에서 제외한다',()=>{assert.deepEqual(mapLhApiResponse([{PAN_ID:'P-1'}],[]),[])});
test('생년월일로 기준일의 만 나이를 계산한다',()=>{assert.equal(calculateAge('1990-09-09',new Date('2026-09-08T12:00:00+09:00')),35);assert.equal(calculateAge('1990-09-08',new Date('2026-09-08T12:00:00+09:00')),36)});
test('저장된 월소득 180은 누락으로 판단하지 않는다',()=>{const result=profileCompletion(completeProfile);assert.equal(result.percent,100);assert.equal(completeProfile.monthly_income,180)});
test('무주택·동일 지역이면 가능성 있음으로, 유주택이면 어려움으로 판정한다',()=>{const listing=mapLhApiResponse([{PAN_ID:'P-2',PAN_NM:'경기 국민임대',CNP_CD_NM:'경기도'}],[])[0];assert.equal(assessListing(completeProfile,listing).status,'가능성 있음');assert.equal(assessListing({...completeProfile,is_homeless:false},listing).status,'어려움')});
test('누락된 프로필 항목 이름과 완성도를 반환한다',()=>{const result=profileCompletion({...completeProfile,birth_date:null,monthly_income:null});assert.equal(result.percent,78);assert.deepEqual(result.missing,['생년월일','월평균 소득'])});
test('공고 상세 조회를 위해 DB 행을 화면 공고 형식으로 변환한다',()=>{const listing=mapOfficialListingRow({source_listing_id:'P-3',agency:'LH',title:'상세 테스트 공고',program:'국민임대',region:'경기도',address:null,area:null,units:null,published_at:'2026-09-08',application_period:null,status:'공고중',minimum_age:null,source_url:'https://example.com'});assert.equal(listing.id,'P-3');assert.equal(listing.address,undefined);assert.equal(listing.publishedAt,'2026-09-08')});
