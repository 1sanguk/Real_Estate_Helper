'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  CircleAlert,
  FileCheck2,
  Heart,
  ShieldCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  assessListing,
  assessListingWithRules,
  mapOfficialListingRow,
  type DashboardProfile,
  type OfficialListing,
  type StoredEligibilityRule,
} from '@/domain/dashboard';
import { commonRequiredDocuments } from '@/domain/documents';
import { useAuth } from '@/features/auth/auth-context';
import { useUserPreferences } from '@/features/user-data/use-user-preferences';
import { getSupabaseClient } from '@/lib/supabase/client';

export default function ListingDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const router = useRouter();
  const { loading, user } = useAuth();
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [listing, setListing] = useState<OfficialListing | null>(null);
  const [detail, setDetail] = useState<{ application_schedules: Record<string, unknown>[]; complexes: Record<string, unknown>[] } | null>(null);
  const [attachments, setAttachments] = useState<Array<{ id: number; name: string; document_type: string; source_url: string }>>([]);
  const [rules, setRules] = useState<StoredEligibilityRule[]>([]);
  const [requiredDocuments, setRequiredDocuments] = useState<Array<{ id: number; document_name: string; requirement_type: string; issuer: string | null; evidence_text: string }>>([]);
  const [notFound, setNotFound] = useState(false);
  const [listingError, setListingError] = useState('');
  const [pageLoading, setPageLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [savePending, setSavePending] = useState(false);
  const [docPendingId, setDocPendingId] = useState<number | null>(null);
  const {
    savedListingIds,
    toggleSavedListing,
    checkedDocumentIds,
    toggleDocument,
  } = useUserPreferences(user?.id);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !id) return;
    const client = getSupabaseClient();
    if (!client) {
      setListingError('공고 서버에 연결할 수 없습니다.');
      setPageLoading(false);
      return;
    }
    void client
      .from('profiles')
      .select(
        'birth_date,residence_region,household_size,monthly_income,total_assets,is_homeless,activity_status,household_type,owns_car,car_value,profile_completed_at',
      )
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) setProfile(data as DashboardProfile);
      });
    void client
      .from('official_listings')
      .select('*')
      .eq('source_listing_id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        setPageLoading(false);
        if (error) {
          setListingError('공고를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
          return;
        }
        if (!data) {
          setNotFound(true);
          return;
        }
        setListing(mapOfficialListingRow(data));
      });
    void Promise.all([
      client.from('listing_details').select('application_schedules,complexes').eq('source_listing_id', id).maybeSingle(),
      client.from('listing_attachments').select('id,name,document_type,source_url').eq('source_listing_id', id).order('id'),
      client.from('listing_eligibility_rules').select('rule_key,operator,numeric_value,text_value,description,evidence_text,confidence').eq('source_listing_id', id).order('id'),
      client.from('listing_required_documents').select('id,document_name,requirement_type,issuer,evidence_text').eq('source_listing_id', id).order('requirement_type').order('id'),
    ]).then(([detailResult, attachmentResult, ruleResult, documentResult]) => {
      if (!detailResult.error && detailResult.data) setDetail(detailResult.data);
      if (!attachmentResult.error && attachmentResult.data) setAttachments(attachmentResult.data);
      if (!ruleResult.error && ruleResult.data) setRules(ruleResult.data);
      if (!documentResult.error && documentResult.data) setRequiredDocuments(documentResult.data);
    });
  }, [user, id]);

  async function saveListing() {
    if (savePending || !listing) return;
    setSavePending(true);
    try {
      const saved = savedListingIds.includes(listing.id);
      if (!(await toggleSavedListing(listing.id))) throw new Error();
      setActionMessage(saved ? '관심 공고에서 해제했습니다.' : '관심 공고에 저장했습니다.');
    } catch {
      setActionMessage('관심 공고 저장에 실패했습니다. 다시 시도해 주세요.');
    } finally {
      setSavePending(false);
    }
  }

  async function checkDocument(documentId: number) {
    if (docPendingId !== null) return;
    setDocPendingId(documentId);
    try {
      if (!(await toggleDocument(documentId))) throw new Error();
    } catch {
      setActionMessage('서류 준비 상태를 저장하지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setDocPendingId(null);
    }
  }

  if (loading || !user)
    return (
      <main className="grid min-h-screen place-items-center">
        <p className="text-sm font-semibold text-muted-foreground">
          공고 상세를 불러오고 있어요…
        </p>
      </main>
    );

  const assessment = profile && listing
    ? rules.length ? assessListingWithRules(profile, listing, rules) : assessListing(profile, listing)
    : null;
  const displayedDocuments = requiredDocuments.length
    ? requiredDocuments.map((document) => ({ id: document.id, label: document.document_name, issuer: document.issuer ?? '공고문 확인', requirementType: document.requirement_type, evidence: document.evidence_text }))
    : commonRequiredDocuments.map((document) => ({ ...document, requirementType: '공통 안내', evidence: '' }));
  const readyCount = displayedDocuments.filter((doc) =>
    checkedDocumentIds.includes(doc.id),
  ).length;
  const docProgress = Math.round(
    displayedDocuments.length ? (readyCount / displayedDocuments.length) * 100 : 0,
  );

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3 px-8">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            목록으로
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-4xl space-y-6 px-8 py-9">
        {actionMessage && (
          <p role="status" className="rounded border p-3 text-sm">
            {actionMessage}
          </p>
        )}
        {pageLoading && <p className="p-6">공고를 불러오고 있습니다…</p>}
        {!pageLoading && listingError && (
          <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm font-bold text-destructive">
            {listingError}
          </p>
        )}
        {!pageLoading && notFound && (
          <p className="rounded-xl border p-6 text-sm">
            해당 공고를 찾을 수 없습니다. 목록에서 다시 확인해 주세요.
          </p>
        )}
        {!pageLoading && listing && (
          <>
            <section className="rounded-2xl border bg-white p-6">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-md bg-[#eaf2ff] px-2 py-1 text-xs font-black text-[#315fa8]">
                  {listing.agency}
                </span>
                <span className="text-xs font-bold text-muted-foreground">
                  {listing.program} · {listing.status} · 공고일 {listing.publishedAt}
                </span>
              </div>
              <h1 className="text-2xl font-black tracking-[-.03em]">{listing.title}</h1>
              <p className="mt-3 text-sm text-muted-foreground">
                {listing.region}
                {listing.address ? ` · ${listing.address}` : ''}
                {listing.area ? ` · ${listing.area}` : ''}
                {listing.units ? ` · ${listing.units}` : ''}
              </p>
              {listing.applicationPeriod && (
                <p className="mt-2 text-sm font-bold">접수기간 {listing.applicationPeriod}</p>
              )}
              {listing.minimumAge && (
                <p className="mt-2 text-sm font-bold">지원 연령 만 {listing.minimumAge}세 이상</p>
              )}
              <div className="mt-4 flex gap-2">
                <Button type="button" variant="outline" disabled={savePending} onClick={() => void saveListing()}>
                  <Heart className="size-4" fill={savedListingIds.includes(listing.id) ? 'currentColor' : 'none'} />
                  {savedListingIds.includes(listing.id) ? '저장됨' : '관심 저장'}
                </Button>
                <a
                  href={listing.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-bold text-white"
                >
                  공식 원문 확인
                  <ArrowUpRight className="size-4" />
                </a>
              </div>
            </section>

            {assessment && (
              <section className="rounded-2xl border bg-white p-6">
                <div className="mb-3 flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" />
                  <h2 className="font-extrabold">내 조건 기준 사전 진단</h2>
                </div>
                <span
                  className={`text-sm font-black ${assessment.tone === 'success' ? 'text-primary' : assessment.tone === 'danger' ? 'text-destructive' : 'text-[#8a6512]'}`}
                >
                  {assessment.status}
                </span>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{assessment.reason}</p>
              </section>
            )}

            {rules.length > 0 && (
              <section className="rounded-2xl border bg-white p-6">
                <h2 className="font-extrabold">공고문에서 확인한 자격 조건</h2>
                <div className="mt-4 space-y-2">
                  {rules.map((rule, index) => (
                    <details key={`${rule.rule_key}-${index}`} className="rounded-xl border p-3 text-sm">
                      <summary className="cursor-pointer font-bold">{rule.description}</summary>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">근거: {rule.evidence_text}</p>
                    </details>
                  ))}
                </div>
              </section>
            )}

            {(detail?.complexes.length || detail?.application_schedules.length) && (
              <section className="rounded-2xl border bg-white p-6">
                <h2 className="font-extrabold">공급 및 신청 일정</h2>
                {detail.complexes.map((complex, index) => (
                  <div key={`complex-${index}`} className="mt-3 rounded-xl bg-secondary p-4 text-sm leading-6">
                    <strong>{String(complex.SBD_LGO_NM ?? '공급 단지')}</strong>
                    <p>{String(complex.LCT_ARA_ADR ?? complex.LCT_ARA_DTL_ADR ?? '')}</p>
                    <p>{complex.SC_AR ? `전용면적 ${String(complex.SC_AR)}㎡` : ''}{complex.HSH_CNT ? ` · ${String(complex.HSH_CNT)}호` : ''}</p>
                  </div>
                ))}
                {detail.application_schedules.map((schedule, index) => (
                  <div key={`schedule-${index}`} className="mt-3 border-t pt-3 text-sm leading-6">
                    <strong>{String(schedule.TOY ?? `일정 ${index + 1}`)}</strong>
                    <p>신청 {String(schedule.RQS_SCD ?? '일자 확인 필요')} {String(schedule.RQS_HR ?? '')}</p>
                    {Boolean(schedule.CTRT_ST_DT || schedule.CTRT_ED_DT) && <p>계약 {String(schedule.CTRT_ST_DT ?? '')} ~ {String(schedule.CTRT_ED_DT ?? '')}</p>}
                  </div>
                ))}
              </section>
            )}

            {attachments.length > 0 && (
              <section className="rounded-2xl border bg-white p-6">
                <h2 className="font-extrabold">공식 첨부파일</h2>
                <p className="mt-1 text-sm text-muted-foreground">자격 기준과 최종 제출 서류는 첨부 공고문에서 확인할 수 있습니다.</p>
                <div className="mt-4 space-y-2">
                  {attachments.map((attachment) => (
                    <a key={attachment.id} href={attachment.source_url} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-xl border p-3 text-sm font-bold hover:bg-secondary">
                      <span>{attachment.name}<small className="ml-2 font-normal text-muted-foreground">{attachment.document_type}</small></span>
                      <ArrowUpRight className="size-4" />
                    </a>
                  ))}
                </div>
              </section>
            )}

            <section className="rounded-2xl border bg-white p-6">
              <div className="mb-3 flex items-center gap-2">
                <FileCheck2 className="size-5 text-primary" />
                <h2 className="font-extrabold">{requiredDocuments.length ? '이 공고의 제출 준비 서류' : '제출 준비 서류(공통 안내)'}</h2>
              </div>
              <p className="mb-4 flex items-start gap-2 rounded-xl bg-[#fff8e6] p-3 text-xs leading-5 text-[#725a16]">
                <CircleAlert className="mt-0.5 size-4 shrink-0" />
                {requiredDocuments.length ? '공고문에서 자동 추출한 서류입니다. 조건부 여부와 제출 형식은 근거를 펼쳐 확인하고 공식 원문과 대조해 주세요.' : '아래 서류는 공공주택 신청에 공통적으로 요구되는 예시입니다. 실제 필요 서류와 제출 형식은 공식 원문에서 확인해야 합니다.'}
              </p>
              <div className="mb-3 flex justify-between text-sm font-bold">
                <span>준비 현황</span>
                <span className="text-primary">
                  {readyCount} / {displayedDocuments.length}
                </span>
              </div>
              <Progress value={docProgress} className="mb-4" />
              <div className="space-y-1">
                {displayedDocuments.map((doc) => (
                  <label
                    key={doc.id}
                    htmlFor={`doc-${doc.id}`}
                    className="flex cursor-pointer items-start gap-3 rounded-xl p-3 hover:bg-secondary"
                  >
                    <Checkbox
                      id={`doc-${doc.id}`}
                      checked={checkedDocumentIds.includes(doc.id)}
                      disabled={docPendingId !== null}
                      onCheckedChange={() => void checkDocument(doc.id)}
                      className="mt-0.5"
                    />
                    <span className="min-w-0">
                      <span
                        className={`block text-sm font-bold ${checkedDocumentIds.includes(doc.id) ? 'text-muted-foreground line-through' : ''}`}
                      >
                        {doc.label}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">발급: {doc.issuer}</span>
                      <span className="block text-[11px] font-bold text-primary">{doc.requirementType}</span>
                      {doc.evidence && <details className="mt-1 text-[11px] text-muted-foreground"><summary>공고문 근거 보기</summary><p className="mt-1 leading-5">{doc.evidence}</p></details>}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
