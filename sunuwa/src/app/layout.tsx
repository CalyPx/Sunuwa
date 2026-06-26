import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'सुनुवाइ — नागरिकको आवाज, सरकारसम्म',
  description: 'नेपालको पहिलो नागरिक-सरकार बुद्धिमत्ता प्रणाली। AI ले तपाईंको उजुरी सही निकायमा पुर्‍याउँछ।',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ne">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;500;600;700;800&family=Noto+Sans+Devanagari:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}
