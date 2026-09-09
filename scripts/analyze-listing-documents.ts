import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { extractEligibilityRules, extractRequiredDocuments } from '../domain/eligibility-extraction.ts';
import { extractRemoteDocumentText } from '../infrastructure/documents/extract-text.ts';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경 변수가 필요합니다.`);
  return value;
}

const db = createClient(required('NEXT_PUBLIC_SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const { data: listings, error: listingError } = await db.from('official_listings').select('source_listing_id').in('status', ['공고중', '정정공고중', '접수중']);
if (listingError) throw listingError;
const listingIds = (listings ?? []).map((item) => item.source_listing_id);
const { data: attachments, error: attachmentError } = await db.from('listing_attachments')
  .select('id,source_listing_id,name,document_type,source_url').in('source_listing_id', listingIds)
  .or('document_type.ilike.%공고문%,name.ilike.%.pdf,name.ilike.%.hwpx');
if (attachmentError) throw attachmentError;
const { data: completedAnalyses, error: completedError } = await db.from('listing_document_analyses')
  .select('attachment_id').eq('extraction_status', 'succeeded');
if (completedError) throw completedError;
const completedIds = new Set((completedAnalyses ?? []).map((item) => item.attachment_id));

const selected = new Map<string, typeof attachments[number]>();
for (const attachment of attachments ?? []) {
  const current = selected.get(attachment.source_listing_id);
  const score = (item: typeof attachment) => (item.document_type.includes('정정공고문') ? 4 : item.document_type.includes('공고문') ? 2 : 0) + (item.name.toLowerCase().endsWith('.pdf') ? 2 : 1);
  if (!current || score(attachment) > score(current)) selected.set(attachment.source_listing_id, attachment);
}

let succeeded = 0;
const pending = [...selected.values()].filter((attachment) =>
  process.env.FORCE_DOCUMENT_ANALYSIS === 'true' || !completedIds.has(attachment.id));
for (const attachment of pending) {
  try {
    const text = await extractRemoteDocumentText(attachment.source_url, attachment.name);
    const contentHash = createHash('sha256').update(text).digest('hex');
    const now = new Date().toISOString();
    const { error: analysisError } = await db.from('listing_document_analyses').upsert({
      attachment_id: attachment.id, source_listing_id: attachment.source_listing_id,
      extraction_status: 'succeeded', text_content: text, content_hash: contentHash,
      error_message: null, analyzed_at: now,
    }, { onConflict: 'attachment_id' });
    if (analysisError) throw analysisError;
    const rules = extractEligibilityRules(text).map((rule) => ({
      source_listing_id: attachment.source_listing_id, attachment_id: attachment.id,
      rule_key: rule.ruleKey, operator: rule.operator, numeric_value: rule.numericValue,
      text_value: rule.textValue, description: rule.description,
      evidence_text: rule.evidenceText, confidence: rule.confidence, analyzed_at: now,
    }));
    const documents = extractRequiredDocuments(text).map((document) => ({
      source_listing_id: attachment.source_listing_id, attachment_id: attachment.id,
      document_name: document.documentName, requirement_type: document.requirementType,
      issuer: document.issuer, evidence_text: document.evidenceText, analyzed_at: now,
    }));
    if (rules.length) {
      const { error } = await db.from('listing_eligibility_rules').upsert(rules, { onConflict: 'source_listing_id,rule_key,description' });
      if (error) throw error;
    }
    if (documents.length) {
      const { error } = await db.from('listing_required_documents').upsert(documents, { onConflict: 'source_listing_id,document_name,requirement_type' });
      if (error) throw error;
    }
    succeeded++;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.from('listing_document_analyses').upsert({
      attachment_id: attachment.id, source_listing_id: attachment.source_listing_id,
      extraction_status: /지원하지 않는/.test(message) ? 'unsupported' : 'failed',
      error_message: message.slice(0, 1000), analyzed_at: new Date().toISOString(),
    }, { onConflict: 'attachment_id' });
    console.warn(`문서 분석 실패 (${attachment.source_listing_id}): ${message}`);
  }
}
console.log(`문서 분석 완료: 전체 ${selected.size}건, 신규 대상 ${pending.length}건, 성공 ${succeeded}건`);
