'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { apiFetch, setAuth } from '@/lib/api'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const data = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify(form) })
      setAuth(data.token, data.user)
      toast.success(`Selamat datang kembali, ${data.user.name}!`)
      router.push('/dashboard')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 justify-center mb-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold text-lg">F</div>
            <span className="font-bold text-xl">FinMate</span>
          </Link>
          <CardTitle className="text-2xl">Masuk ke akun</CardTitle>
          <CardDescription>Lanjutkan mengelola keuangan Anda</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="kamu@email.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700">
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Masuk
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Belum punya akun? <Link href="/register" className="text-emerald-600 font-medium hover:underline">Daftar gratis</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
