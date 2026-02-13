import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'ZENGTO Web',
  description: 'GTOWizard-style strategy workspace with integrated AI coach.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
