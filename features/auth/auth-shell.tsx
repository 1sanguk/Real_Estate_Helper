import Link from 'next/link';
import { Home } from 'lucide-react';

export function AuthShell({ title, description, children, footer }: { title: string; description: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#ffe5b7,transparent_38%),linear-gradient(145deg,#fffaf2,#fff0e5)] px-6 py-12"><section className="w-full max-w-md rounded-[30px] border bg-white p-9 shadow-[0_24px_70px_rgba(157,76,47,.14)]"><Link href="/" className="mb-8 flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-xl bg-primary text-white shadow-[0_7px_18px_rgba(223,96,71,.28)]"><Home className="size-[18px]"/></span><strong className="text-lg tracking-[-.04em]">내집레이더</strong></Link><h1 className="text-2xl font-extrabold tracking-[-.04em]">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p><div className="mt-7">{children}</div>{footer&&<div className="mt-6 border-t pt-5 text-center text-sm text-muted-foreground">{footer}</div>}</section></main>;
}
