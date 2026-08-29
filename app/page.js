'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Wallet, TrendingUp, PieChart, Download, Shield, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react'

const features = [
  { icon: Wallet, title: 'Multi Akun Keuangan', desc: 'Catat kas, rekening bank, e-wallet, dan kartu kredit dalam satu tempat.' },
  { icon: TrendingUp, title: 'Dashboard Real-time', desc: 'Lihat cash flow, tren pemasukan vs pengeluaran, dan saldo otomatis terupdate.' },
  { icon: PieChart, title: 'Analisa Kategori', desc: 'Ketahui ke mana uang Anda pergi lewat grafik kategori pengeluaran yang jelas.' },
  { icon: Download, title: 'Export CSV', desc: 'Backup data kapan saja atau lanjutkan analisa di spreadsheet.' },
  { icon: Shield, title: 'Data Aman', desc: 'Semua data tersimpan aman di server, hanya Anda yang bisa akses.' },
  { icon: Sparkles, title: 'Modern & Simpel', desc: 'UI bersih, cepat, dark mode, dan responsive di semua device.' },
]

const comparison = [
  { feature: 'Input transaksi cepat', spreadsheet: false, finmate: true },
  { feature: 'Saldo otomatis terupdate', spreadsheet: false, finmate: true },
  { feature: 'Grafik visualisasi', spreadsheet: 'Manual', finmate: 'Otomatis' },
  { feature: 'Multi akun keuangan', spreadsheet: 'Sheet terpisah', finmate: true },
  { feature: 'Akses dari HP', spreadsheet: 'Ribet', finmate: true },
  { feature: 'Backup data', spreadsheet: 'Manual', finmate: 'CSV 1-klik' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white dark:from-emerald-950 dark:via-background dark:to-background">
      {/* Nav */}
      <nav className="container mx-auto flex items-center justify-between py-6 px-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold">F</div>
          <span className="font-bold text-xl">FinMate</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login"><Button variant="ghost">Masuk</Button></Link>
          <Link href="/register"><Button className="bg-emerald-600 hover:bg-emerald-700">Daftar Gratis</Button></Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16 md:py-24 text-center">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-4 py-1.5 text-sm text-emerald-700 dark:text-emerald-300 mb-6">
          <Sparkles className="h-4 w-4" />
          <span>Beta terbuka — Coba gratis sekarang</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight max-w-4xl mx-auto leading-tight">
          Kelola Keuangan <span className="text-emerald-600">Tanpa Spreadsheet</span>,<br />Lebih Rapi Setiap Hari.
        </h1>
        <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Catat pemasukan & pengeluaran, pantau saldo semua akun, dan lihat ke mana uang Anda pergi — dalam satu dashboard yang cantik & cepat.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/register">
            <Button size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white text-base h-12 px-8">
              Mulai Gratis <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="h-12 px-8 text-base">
              Sudah punya akun? Masuk
            </Button>
          </Link>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Tidak perlu kartu kredit. Data Anda tetap milik Anda.</p>

        {/* Preview card */}
        <div className="mt-16 max-w-5xl mx-auto">
          <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden">
            <div className="bg-emerald-600 text-white p-4 flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-white/40"></div>
              <div className="h-3 w-3 rounded-full bg-white/40"></div>
              <div className="h-3 w-3 rounded-full bg-white/40"></div>
              <span className="ml-2 text-sm opacity-80">finmate.app/dashboard</span>
            </div>
            <div className="p-6 md:p-10 bg-gradient-to-br from-emerald-50 to-white dark:from-emerald-950 dark:to-background">
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl bg-white dark:bg-card border p-4 text-left">
                  <p className="text-xs text-muted-foreground">Total Saldo</p>
                  <p className="text-2xl font-bold text-emerald-600">Rp 24.500.000</p>
                </div>
                <div className="rounded-xl bg-white dark:bg-card border p-4 text-left">
                  <p className="text-xs text-muted-foreground">Pemasukan Bulan Ini</p>
                  <p className="text-2xl font-bold text-blue-600">Rp 8.200.000</p>
                </div>
                <div className="rounded-xl bg-white dark:bg-card border p-4 text-left">
                  <p className="text-xs text-muted-foreground">Pengeluaran</p>
                  <p className="text-2xl font-bold text-rose-600">Rp 3.750.000</p>
                </div>
              </div>
              <div className="h-40 rounded-xl bg-white dark:bg-card border p-4 flex items-end gap-2">
                {[40, 65, 45, 80, 55, 90].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col gap-1 items-center">
                    <div className="w-full rounded-t bg-emerald-500" style={{ height: `${h}%` }}></div>
                    <span className="text-xs text-muted-foreground">M{i+1}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">Semua yang Anda butuhkan</h2>
          <p className="mt-3 text-muted-foreground text-lg">Fokus ke keuangan, biar sistem yang urus catat-mencatatnya.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <Card key={i} className="hover:shadow-lg transition-shadow border-emerald-100 dark:border-emerald-900/30">
              <CardContent className="p-6">
                <div className="h-11 w-11 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 flex items-center justify-center mb-4">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold">Spreadsheet vs FinMate</h2>
          <p className="mt-3 text-muted-foreground text-lg">Kenapa harus repot lagi dengan Excel?</p>
        </div>
        <div className="max-w-3xl mx-auto rounded-2xl border overflow-hidden">
          <div className="grid grid-cols-3 bg-muted/50 p-4 font-semibold text-sm">
            <div>Fitur</div>
            <div className="text-center">Spreadsheet</div>
            <div className="text-center text-emerald-600">FinMate</div>
          </div>
          {comparison.map((row, i) => (
            <div key={i} className="grid grid-cols-3 p-4 border-t items-center text-sm">
              <div className="font-medium">{row.feature}</div>
              <div className="text-center text-muted-foreground">
                {typeof row.spreadsheet === 'boolean' ? (row.spreadsheet ? '✓' : '—') : row.spreadsheet}
              </div>
              <div className="text-center font-medium text-emerald-600">
                {typeof row.finmate === 'boolean' ? (row.finmate ? <CheckCircle2 className="inline h-5 w-5" /> : '—') : row.finmate}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="max-w-3xl mx-auto rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white p-10 md:p-16 text-center">
          <h2 className="text-3xl md:text-4xl font-bold">Siap membenahi keuangan Anda?</h2>
          <p className="mt-3 text-emerald-50 text-lg">Daftar gratis. Butuh 30 detik. Langsung bisa dipakai.</p>
          <Link href="/register">
            <Button size="lg" className="mt-8 bg-white text-emerald-700 hover:bg-emerald-50 h-12 px-8 text-base">
              Mulai Sekarang <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="container mx-auto px-4 py-8 border-t text-center text-sm text-muted-foreground">
        <p>© 2025 FinMate — Kelola keuangan lebih rapi, tanpa ribet.</p>
      </footer>
    </div>
  )
}
