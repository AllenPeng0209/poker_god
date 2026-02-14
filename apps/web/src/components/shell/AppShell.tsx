'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useI18n } from '@/components/i18n/I18nProvider';
import { AICoachDrawer } from '@/components/coach/AICoachDrawer';

type NavItem = {
  labelKey: string;
  href: Route;
  icon: string;
};

const NAV_ITEMS: NavItem[] = [
  { labelKey: 'shell.nav.study', href: '/app/study', icon: 'S' },
  { labelKey: 'shell.nav.practice', href: '/app/practice', icon: 'P' },
  { labelKey: 'shell.nav.analyze', href: '/app/analyze', icon: 'A' },
  { labelKey: 'shell.nav.reports', href: '/app/reports', icon: 'R' },
  { labelKey: 'shell.nav.aiCoach', href: '/app/ai-coach/history', icon: 'C' }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { locale, setLocale, t } = useI18n();
  const pathname = usePathname();
  const [isDrawerOpen, setDrawerOpen] = useState(true);
  const [isCompactScreen, setCompactScreen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1024px)');
    const updateViewport = () => {
      setCompactScreen(mediaQuery.matches);
      setDrawerOpen(!mediaQuery.matches);
    };

    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, []);

  useEffect(() => {
    if (isCompactScreen) {
      setDrawerOpen(false);
    }
  }, [isCompactScreen, pathname]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        setDrawerOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={isDrawerOpen ? 'wizard-shell wizard-shell--drawer-open' : 'wizard-shell'}>
      <header className="wizard-topbar">
        <div className="wizard-topbar__left">
          <button
            type="button"
            className="wizard-icon-button"
            onClick={() => {
              setDrawerOpen((prev) => !prev);
            }}
            aria-label={t('shell.aria.toggleDrawer')}
          >
            ≡
          </button>
          <div>
            <p className="wizard-brand">{t('shell.brand.title')}</p>
            <small className="wizard-subtitle">{t('shell.brand.subtitle')}</small>
          </div>
        </div>

        <div className="wizard-topbar__right">
          <AICoachDrawer pathname={pathname} />
          <button
            type="button"
            className="wizard-icon-button"
            onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}
            aria-label={locale === 'zh-CN' ? t('shell.locale.toggleToEn') : t('shell.locale.toggleToZh')}
          >
            {locale === 'zh-CN' ? t('shell.locale.toggleToEn') : t('shell.locale.toggleToZh')}
          </button>
          <button type="button" className="wizard-upgrade">
            {t('shell.topbar.upgrade')}
          </button>
          <button type="button" className="wizard-icon-button">
            {t('shell.topbar.upload')}
          </button>
        </div>
      </header>

      <aside className={isDrawerOpen ? 'wizard-drawer wizard-drawer--open' : 'wizard-drawer'} aria-label={t('shell.aria.drawer')}>
        <div className="wizard-drawer__header">
          <span>{t('shell.drawer.navigation')}</span>
          <small>Cmd/Ctrl + B</small>
        </div>

        <nav className="wizard-drawer__nav">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? 'wizard-drawer__item wizard-drawer__item--active' : 'wizard-drawer__item'}
              >
                <span className="wizard-drawer__icon">{item.icon}</span>
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        <Link href="/app/dashboard" className="wizard-drawer__back">
          {t('shell.drawer.backToDashboard')}
        </Link>
      </aside>

      {isDrawerOpen && isCompactScreen ? (
        <button
          type="button"
          aria-label={t('shell.aria.closeDrawer')}
          className="wizard-overlay"
          onClick={() => {
            setDrawerOpen(false);
          }}
        />
      ) : null}

      <main className="wizard-main">
        <div className="wizard-main-content">{children}</div>
      </main>
    </div>
  );
}
