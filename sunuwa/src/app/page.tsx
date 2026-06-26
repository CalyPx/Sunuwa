import { redirect } from 'next/navigation'

// Root page redirects to default locale (Nepali)
export default function RootPage() {
  redirect('/ne')
}
