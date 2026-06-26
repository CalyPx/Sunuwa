import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

// Use these instead of next/link, next/navigation in pages/components
// They automatically prefix links with the current locale (/ne/submit, /en/submit etc.)
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing)
