import './globals.css'
import { Providers } from './providers'
import { Toaster } from 'sonner'

export const metadata = {
  title: 'FinMate — Kelola Keuangan Tanpa Ribet',
  description: 'Aplikasi dashboard keuangan pribadi modern. Catat pemasukan, pengeluaran, dan pantau saldo semua akun dalam satu tempat.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html:'window.addEventListener("error",function(e){if(e.error instanceof DOMException&&e.error.name==="DataCloneError"&&e.message&&e.message.includes("PerformanceServerTiming")){e.stopImmediatePropagation();e.preventDefault()}},true);'}} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          {children}
          <Toaster position="top-right" richColors />
        </Providers>
      </body>
    </html>
  )
}
