'use client'

import { useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'
import { Link } from '@/i18n/navigation'

export default function LangToggle({ dark = true }: { dark?: boolean }) {
  const locale   = useLocale()
  const pathname = usePathname()

  // Strip /ne or /en prefix to get the base path
  const base        = pathname.replace(/^\/(ne|en)/, '') || '/'
  const otherLocale = locale === 'ne' ? 'en' : 'ne'
  const label       = locale === 'ne' ? 'EN' : 'नेपाली'

  const border = dark ? 'rgba(255,255,255,0.25)' : 'rgba(11,60,111,0.3)'
  const color  = dark ? 'rgba(255,255,255,0.8)'  : '#0B3C6F'
  const hover  = dark ? 'rgba(255,255,255,0.1)'  : 'rgba(11,60,111,0.07)'

  return (
    <Link
      href={base}
      locale={otherLocale as 'ne' | 'en'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', borderRadius: 6,
        border: `1px solid ${border}`,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
        color, textDecoration: 'none',
        fontFamily: locale === 'ne' ? 'system-ui' : 'Noto Sans Devanagari, sans-serif',
        transition: 'background 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.background = hover)}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} style={{ flexShrink: 0 }}>
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/>
      </svg>
      {label}
    </Link>
  )
}
