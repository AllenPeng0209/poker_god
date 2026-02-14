import type { Metadata } from 'next';
import { I18nProvider } from '@/components/i18n/I18nProvider';

import './globals.css';

export const metadata: Metadata = {
  title: 'ZENGTO Web',
  description: 'GTOWizard 风格策略工作台，内置 AI 教练。',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
