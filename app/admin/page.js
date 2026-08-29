'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { apiFetch, getToken, getUser, setAuth, clearAuth, formatIDR, formatDate } from '@/lib/api'
import { toast } from 'sonner'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'
import { Users, FileText, LayoutDashboard, LogOut, PlusCircle, Edit2, Trash2, ArrowLeft, Loader2, Eye } from 'lucide-react'

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [tab, setTab] = useState('dashboard')
  const [needsClaim, setNeedsClaim] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      if (!getToken()) { router.replace('/login'); return }
      const u = getUser()
      setUser(u)
      if (u?.role !== 'admin') {
        setNeedsClaim(true)
      }
      setLoading(false)
    })()
  }, [])

  const claimAdmin = async () => {
    try {
      const res = await apiFetch('/admin/claim', { method: 'POST' })
      setAuth(res.token, res.user)
      setUser(res.user); setNeedsClaim(false)
      toast.success('Berhasil menjadi Admin!')
    } catch (e) { toast.error(e.message) }
  }

  const logout = () => { clearAuth(); router.push('/') }

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-600" /></div>
  }

  if (needsClaim) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Akses Admin Panel</CardTitle>
            <CardDescription>Akun Anda ({user.email}) belum memiliki role admin.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Jika belum ada admin di sistem, Anda bisa <b>klaim role admin</b> untuk pertama kalinya. Setelah admin pertama dibuat, tombol ini akan dinonaktifkan untuk user lain.
            </p>
            <div className="flex gap-2">
              <Link href="/dashboard" className="flex-1"><Button variant="outline" className="w-full"><ArrowLeft className="h-4 w-4 mr-2" />Ke Dashboard</Button></Link>
              <Button onClick={claimAdmin} className="flex-1 bg-emerald-600 hover:bg-emerald-700">Klaim Admin</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'posts', label: 'Blog Posts', icon: FileText },
  ]

  return (
    <div className="min-h-screen bg-muted/30 flex">
      <aside className="sticky top-0 h-screen bg-card border-r w-60">
        <div className="p-6 flex items-center gap-2 border-b">
          <div className="h-9 w-9 rounded-xl bg-rose-600 flex items-center justify-center text-white font-bold">A</div>
          <span className="font-bold">Admin FinMate</span>
        </div>
        <nav className="p-3 space-y-1">
          {navItems.map((n) => (
            <button key={n.id} onClick={() => setTab(n.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${tab === n.id ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/40' : 'hover:bg-muted text-muted-foreground'}`}>
              <n.icon className="h-4 w-4" />{n.label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t">
          <Link href="/dashboard" className="block mb-2">
            <Button variant="ghost" size="sm" className="w-full justify-start"><ArrowLeft className="h-4 w-4 mr-2" />User App</Button>
          </Link>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}><LogOut className="h-4 w-4 mr-2" />Keluar</Button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 p-8">
        {tab === 'dashboard' && <AdminDashboard />}
        {tab === 'users' && <UsersTab />}
        {tab === 'posts' && <PostsTab />}
      </main>
    </div>
  )
}

function AdminDashboard() {
  const [stats, setStats] = useState(null)
  useEffect(() => { apiFetch('/admin/stats').then(setStats).catch((e) => toast.error(e.message)) }, [])
  if (!stats) return <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview sistem FinMate</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatBox label="Total User" value={stats.total_users} icon={Users} />
        <StatBox label="Total Transaksi" value={stats.total_transactions} icon={LayoutDashboard} />
        <StatBox label="Total Post" value={stats.total_posts} icon={FileText} />
        <StatBox label="Post Published" value={stats.published_posts} icon={Eye} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>User Growth 6 Bulan Terakhir</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats.user_growth}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="count" name="User baru" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}

function StatBox({ label, value, icon: Icon }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
          <div className="h-8 w-8 rounded-lg bg-emerald-50 flex items-center justify-center"><Icon className="h-4 w-4 text-emerald-600" /></div>
        </div>
        <p className="text-3xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}

function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    apiFetch('/admin/users').then((r) => setUsers(r.users)).catch((e) => toast.error(e.message)).finally(() => setLoading(false))
  }, [])
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Manajemen User</h1>
      {loading ? <Loader2 className="h-6 w-6 animate-spin text-emerald-600" /> : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">Nama</th>
                  <th className="text-left p-3">Email</th>
                  <th className="text-left p-3">Role</th>
                  <th className="text-left p-3">Status Pembayaran</th>
                  <th className="text-right p-3"># Transaksi</th>
                  <th className="text-left p-3">Terdaftar</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-3 font-medium">{u.name}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">
                      <Badge variant={u.role === 'admin' ? 'default' : 'secondary'}>{u.role}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant={u.payment_status === 'lifetime_active' ? 'default' : 'secondary'}>{u.payment_status || 'trial'}</Badge>
                    </td>
                    <td className="p-3 text-right tabular-nums">{u.transaction_count}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function PostsTab() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState({ open: false, editing: null })

  const load = async () => {
    setLoading(true)
    try {
      const r = await apiFetch('/admin/blog/posts')
      setPosts(r.posts)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kelola Blog Posts</h1>
        <Button onClick={() => setDialog({ open: true, editing: null })} className="bg-emerald-600 hover:bg-emerald-700">
          <PlusCircle className="h-4 w-4 mr-2" />Tulis Post Baru
        </Button>
      </div>
      {loading ? <Loader2 className="h-6 w-6 animate-spin text-emerald-600" /> : posts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">Belum ada post</p>
            <p className="text-sm text-muted-foreground mb-4">Buat artikel pertama untuk mulai konten marketing.</p>
            <Button onClick={() => setDialog({ open: true, editing: null })} className="bg-emerald-600 hover:bg-emerald-700">Tulis Post Pertama</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3">Judul</th>
                  <th className="text-left p-3">Kategori</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Slug</th>
                  <th className="text-left p-3">Update</th>
                  <th className="text-right p-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3 font-medium">{p.title}</td>
                    <td className="p-3">{p.category}</td>
                    <td className="p-3"><Badge variant={p.status === 'published' ? 'default' : 'secondary'}>{p.status}</Badge></td>
                    <td className="p-3 text-xs font-mono text-muted-foreground">{p.slug}</td>
                    <td className="p-3 text-muted-foreground">{formatDate(p.updated_at || p.created_at)}</td>
                    <td className="p-3 text-right">
                      {p.status === 'published' && (
                        <a href={`/blog/${p.slug}`} target="_blank" rel="noopener" className="inline-block mr-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-3.5 w-3.5" /></Button>
                        </a>
                      )}
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDialog({ open: true, editing: p })}><Edit2 className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={async () => {
                        if (!confirm('Hapus post ini?')) return
                        await apiFetch(`/admin/blog/posts/${p.id}`, { method: 'DELETE' })
                        toast.success('Post dihapus'); await load()
                      }}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
      <PostEditor state={dialog} setState={setDialog} onSaved={load} />
    </div>
  )
}

function PostEditor({ state, setState, onSaved }) {
  const editing = state.editing
  const [form, setForm] = useState({
    title: '', slug: '', excerpt: '', meta_title: '', meta_description: '',
    og_image: '', cover_image: '', content: '', category: 'Umum', tags: '', status: 'draft',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (state.open) {
      if (editing) setForm({
        title: editing.title, slug: editing.slug, excerpt: editing.excerpt || '',
        meta_title: editing.meta_title || '', meta_description: editing.meta_description || '',
        og_image: editing.og_image || '', cover_image: editing.cover_image || '',
        content: editing.content, category: editing.category || 'Umum',
        tags: (editing.tags || []).join(', '), status: editing.status,
      })
      else setForm({ title: '', slug: '', excerpt: '', meta_title: '', meta_description: '', og_image: '', cover_image: '', content: '', category: 'Umum', tags: '', status: 'draft' })
    }
  }, [state.open, editing])

  const save = async (publishNow = false) => {
    if (!form.title.trim() || !form.content.trim()) return toast.error('Judul & konten wajib diisi')
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug || undefined,
        excerpt: form.excerpt,
        meta_title: form.meta_title || form.title,
        meta_description: form.meta_description || form.excerpt,
        og_image: form.og_image || null,
        cover_image: form.cover_image || null,
        content: form.content,
        category: form.category || 'Umum',
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        status: publishNow ? 'published' : form.status,
      }
      if (editing) await apiFetch(`/admin/blog/posts/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      else await apiFetch('/admin/blog/posts', { method: 'POST', body: JSON.stringify(payload) })
      toast.success(publishNow ? 'Post dipublikasikan!' : (editing ? 'Post disimpan' : 'Post dibuat'))
      setState({ open: false, editing: null }); await onSaved()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={state.open} onOpenChange={(o) => setState({ open: o, editing: o ? editing : null })}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Post' : 'Post Baru'}</DialogTitle>
          <DialogDescription>Isi konten & atur SEO metadata di bawah.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Judul *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Cara Mengatur Budget Bulanan" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Slug (URL)</Label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto dari judul" />
            </div>
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Umum, Tips, Investasi" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Excerpt (ringkasan singkat)</Label>
            <Textarea rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Cover Image URL</Label>
              <Input value={form.cover_image} onChange={(e) => setForm({ ...form, cover_image: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label>OG Image URL</Label>
              <Input value={form.og_image} onChange={(e) => setForm({ ...form, og_image: e.target.value })} placeholder="https://..." />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Konten * (HTML atau Markdown-lite)</Label>
            <Textarea rows={12} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="## Sub judul&#10;&#10;Paragraf pembuka...&#10;&#10;**Poin penting** dengan *emphasis*." className="font-mono text-sm" />
            <p className="text-xs text-muted-foreground">Support: HTML tags, atau markdown sederhana (## H2, ### H3, **bold**, *italic*, [link](url))</p>
          </div>
          <div className="space-y-2">
            <Label>Tags (pisahkan koma)</Label>
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="budgeting, tips, pemula" />
          </div>
          <details className="border rounded-lg p-3">
            <summary className="cursor-pointer font-medium text-sm">SEO Metadata (opsional, auto dari judul & excerpt jika kosong)</summary>
            <div className="mt-3 space-y-3">
              <div className="space-y-2">
                <Label>Meta Title</Label>
                <Input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} placeholder="max 60 karakter untuk optimal SEO" />
              </div>
              <div className="space-y-2">
                <Label>Meta Description</Label>
                <Textarea rows={2} value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} placeholder="max 160 karakter" />
              </div>
            </div>
          </details>
          <div className="flex items-center gap-4">
            <Label>Status:</Label>
            <div className="flex gap-2">
              {['draft', 'published'].map((s) => (
                <button key={s} type="button" onClick={() => setForm({ ...form, status: s })}
                  className={`px-3 py-1.5 rounded-lg text-sm border ${form.status === s ? 'bg-emerald-600 text-white border-transparent' : 'hover:bg-muted'}`}>{s}</button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setState({ open: false, editing: null })}>Batal</Button>
          <Button variant="outline" onClick={() => save(false)} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan Draft
          </Button>
          <Button onClick={() => save(true)} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Publish Sekarang
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
