import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '내집레이더 | LH·SH 공공주택 맞춤 탐색',
  description: '내 조건에 맞는 LH·SH 공공주택 공고와 준비 서류를 한눈에 확인하세요.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
