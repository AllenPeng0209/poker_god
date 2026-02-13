'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

type NavItem = {
  label: string;
  href: Route;
  icon: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Study', href: '/app/study', icon: 'S' },
  { label: 'Practice', href: '/app/practice', icon: 'P' },
  { label: 'Analyze', href: '/app/analyze', icon: 'A' },
  { label: 'Reports', href: '/app/reports', icon: 'R' },
  { label: 'AI Coach', href: '/app/ai-coach/history', icon: 'C' }
];

export function AppShell({ children }: { children: React.ReactNode }) {
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

  const headerTitle = useMemo(() => {
    const matched = NAV_ITEMS.find((item) => pathname.startsWith(item.href));
    return matched?.label ?? 'Study';
  }, [pathname]);

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
            aria-label="Toggle drawer"
          >
            ≡
          </button>
          <div>
            <p className="wizard-brand">ZENGTO Wizard</p>
            <small className="wizard-subtitle">M1 Learning Loop</small>
          </div>
        </div>

        <nav className="wizard-topnav" aria-label="Module tabs">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={isActive ? 'wizard-topnav__link wizard-topnav__link--active' : 'wizard-topnav__link'}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="wizard-topbar__right">
          <button type="button" className="wizard-upgrade">
            Upgrade
          </button>
          <button type="button" className="wizard-icon-button">
            Upload
          </button>
        </div>
      </header>

      <aside className={isDrawerOpen ? 'wizard-drawer wizard-drawer--open' : 'wizard-drawer'} aria-label="Drawer">
        <div className="wizard-drawer__header">
          <span>Navigation</span>
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
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <Link href="/" className="wizard-drawer__back">
          Back to landing
        </Link>
      </aside>

      {isDrawerOpen && isCompactScreen ? (
        <button
          type="button"
          aria-label="Close drawer"
          className="wizard-overlay"
          onClick={() => {
            setDrawerOpen(false);
          }}
        />
      ) : null}

      <main className="wizard-main">
        <section className="wizard-page-header">
          <div>
            <p className="topbar-eyebrow">Workspace</p>
            <h2>{headerTitle}</h2>
          </div>
          <p className="wizard-page-hint">Prototype UI matching GTOWizard dashboard style.</p>
        </section>
        <div className="wizard-main-content">{children}</div>
      </main>
    </div>
  );
}
