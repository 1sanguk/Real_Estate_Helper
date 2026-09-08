import Link from 'next/link';
import { Home } from 'lucide-react';

export function AuthShell({ title, description, children, footer }: { title: string; description: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-[#f4f7f5] px-6 py-12"><section className="w-full max-w-md rounded-[28px] border bg-white p-9 shadow-[0_20px_60px_rgba(12,54,47,.08)]"><Link href="/" className="mb-8 flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-primary text-white"><Home className="size-[18px]"/></span><strong className="text-lg tracking-[-.04em]">내집레이더</strong></Link><h1 className="text-2xl font-extrabold tracking-[-.04em]">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p><div className="mt-7">{children}</div>{footer&&<div className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">{footer}</div>}</section></main>;
}
