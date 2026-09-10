import type { NextConfig } from 'next';

// GitHub Pages는 커스텀 도메인이 없으면 https://<계정>.github.io/Real_Estate_Helper/ 처럼
// 저장소 이름이 경로에 붙는다. 모든 링크·정적 자산이 이 경로 밑에서 풀리도록 고정한다.
const nextConfig: NextConfig = {
  output: 'export',
  basePath: '/Real_Estate_Helper',
};

export default nextConfig;
