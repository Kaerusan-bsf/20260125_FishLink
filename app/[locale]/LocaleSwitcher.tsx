'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';

const LOCALES = ['ja', 'en', 'km'] as const;

function replaceLocale(pathname: string, nextLocale: string) {
  return pathname.replace(/^\/(ja|en|km)(\/|$)/, `/${nextLocale}$2`);
}

export default function LocaleSwitcher() {
  const pathname = usePathname(); // /en/profile

  return (
    <div className="nav-links">
      {LOCALES.map((l) => (
        <Link key={l} href={replaceLocale(pathname, l)}>
          {l.toUpperCase()}
        </Link>
      ))}
    </div>
  );
}
