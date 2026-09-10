import { CheckCircle2, CircleAlert, HelpCircle } from 'lucide-react';
import type { EligibilityCheck } from '@/domain/dashboard';

export function EligibilitySummary({ checks }: { checks: EligibilityCheck[] }) {
  const groups = {
    '충족': checks.filter((check) => check.status === '충족'),
    '미충족': checks.filter((check) => check.status === '미충족'),
    '확인 필요': checks.filter((check) => check.status === '확인 필요'),
  };
  const cards = [
    { status: '충족' as const, icon: CheckCircle2, tone: 'border-primary/25 bg-primary/5 text-primary' },
    { status: '미충족' as const, icon: CircleAlert, tone: 'border-destructive/25 bg-destructive/5 text-destructive' },
    { status: '확인 필요' as const, icon: HelpCircle, tone: 'border-[#e7c675] bg-[#fff8e6] text-[#8a6512]' },
  ];

  return (
    <div className="mt-5">
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map(({ status, icon: Icon, tone }) => (
          <div key={status} className={`rounded-xl border p-4 ${tone}`}>
            <div className="flex items-center justify-between"><span className="text-sm font-bold">{status}</span><Icon className="size-5" /></div>
            <strong className="mt-2 block text-3xl font-black">{groups[status].length}</strong>
          </div>
        ))}
      </div>
      {(groups['미충족'].length > 0 || groups['확인 필요'].length > 0) && (
        <div className="mt-3 rounded-xl bg-secondary p-4 text-sm leading-6">
          {groups['미충족'].length > 0 && <p><strong className="text-destructive">주의:</strong> {groups['미충족'].map((check) => check.label).join(', ')}</p>}
          {groups['확인 필요'].length > 0 && <p><strong className="text-[#8a6512]">원문 확인:</strong> {groups['확인 필요'].map((check) => check.label).join(', ')}</p>}
        </div>
      )}
    </div>
  );
}
