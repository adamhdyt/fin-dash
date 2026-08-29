'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { apiFetch, getToken, getUser, clearAuth, formatIDR, formatDate, ACCOUNT_TYPES } from '@/lib/api'
import { toast } from 'sonner'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid, BarChart, Bar } from 'recharts'
import {
  Wallet, TrendingUp, TrendingDown, PlusCircle, LogOut, LayoutDashboard, ArrowLeftRight,
  Tag, Download, Trash2, Edit2, ArrowUpCircle, ArrowDownCircle, Loader2, Search, Menu, X,
  Target, AlertTriangle, CheckCircle2, Upload, FileText, Trophy, Plus
} from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Data
  const [summary, setSummary] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [transactions, setTransactions] = useState([])
  const [trxTotal, setTrxTotal] = useState(0)

  // Filters
  const [trxFilter, setTrxFilter] = useState({ type: 'all', account_id: 'all', search: '' })

  // Dialog states
  const [trxDialog, setTrxDialog] = useState({ open: false, editing: null })
  const [accDialog, setAccDialog] = useState({ open: false, editing: null })
  const [catDialog, setCatDialog] = useState({ open: false, editing: null })

  useEffect(() => {
    if (!getToken()) {
      router.replace('/login')
      return
    }
    setUser(getUser())
    loadAll()
  }, [])

  const loadAll = async () => {
    setLoading(true)
    try {
      const [s, a, c] = await Promise.all([
        apiFetch('/dashboard/summary'),
        apiFetch('/accounts'),
        apiFetch('/categories'),
      ])
      setSummary(s)
      setAccounts(a.accounts)
      setCategories(c.categories)
      await loadTransactions()
    } catch (e) {
      toast.error(e.message)
      if (e.message === 'Unauthorized') { clearAuth(); router.push('/login') }
    } finally {
      setLoading(false)
    }
  }

  const loadTransactions = useCallback(async () => {
    const params = new URLSearchParams()
    if (trxFilter.type !== 'all') params.set('type', trxFilter.type)
    if (trxFilter.account_id !== 'all') params.set('account_id', trxFilter.account_id)
    if (trxFilter.search) params.set('search', trxFilter.search)
    params.set('limit', '200')
    const r = await apiFetch(`/transactions?${params.toString()}`)
    setTransactions(r.transactions)
    setTrxTotal(r.total)
  }, [trxFilter])

  const refreshSummary = async () => {
    const [s, a] = await Promise.all([apiFetch('/dashboard/summary'), apiFetch('/accounts')])
    setSummary(s); setAccounts(a.accounts)
  }

  useEffect(() => { if (user) loadTransactions() }, [trxFilter, user, loadTransactions])

  const logout = () => { clearAuth(); router.push('/') }

  const handleExport = async () => {
    const token = getToken()
    const res = await fetch('/api/export/csv', { headers: { Authorization: `Bearer ${token}` } })
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `finmate-transactions-${Date.now()}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(url)
    toast.success('CSV berhasil di-download!')
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  const navItems = [
    { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard },
    { id: 'transactions', label: 'Transaksi', icon: ArrowLeftRight },
    { id: 'pockets', label: 'Kantong', icon: Wallet },
    { id: 'budgets', label: 'Budget', icon: Target },
    { id: 'goals', label: 'Goals', icon: Trophy },
    { id: 'categories', label: 'Kategori', icon: Tag },
    { id: 'import', label: 'Import CSV', icon: Upload },
    { id: 'export', label: 'Export Data', icon: Download },
  ]

  return (
    <div className="min-h-screen bg-muted/30 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 h-screen bg-card border-r w-64 z-40 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 flex items-center gap-2 border-b">
          <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold">F</div>
          <span className="font-bold text-xl">FinMate</span>
        </div>
        <nav className="p-3 space-y-1">
          {navItems.map((n) => (
            <button key={n.id} onClick={() => { setTab(n.id); setSidebarOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${tab === n.id ? 'bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'hover:bg-muted text-muted-foreground'}`}>
              <n.icon className="h-4 w-4" />{n.label}
            </button>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t bg-card">
          <div className="px-3 py-2 mb-2">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={logout}>
            <LogOut className="h-4 w-4 mr-2" /> Keluar
          </Button>
        </div>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur border-b px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">{navItems.find((n) => n.id === tab)?.label}</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Kelola keuangan Anda dengan mudah</p>
            </div>
          </div>
          <Button onClick={() => setTrxDialog({ open: true, editing: null })} className="bg-emerald-600 hover:bg-emerald-700">
            <PlusCircle className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Tambah Transaksi</span>
            <span className="sm:hidden">Baru</span>
          </Button>
        </header>

        <div className="p-4 md:p-8">
          {tab === 'overview' && <OverviewTab summary={summary} accounts={accounts} onAddTrx={() => setTrxDialog({ open: true, editing: null })} categories={categories} />}
          {tab === 'transactions' && (
            <TransactionsTab
              transactions={transactions} accounts={accounts} categories={categories}
              filter={trxFilter} setFilter={setTrxFilter} total={trxTotal}
              onEdit={(t) => setTrxDialog({ open: true, editing: t })}
              onDelete={async (id) => {
                if (!confirm('Hapus transaksi ini?')) return
                await apiFetch(`/transactions/${id}`, { method: 'DELETE' })
                toast.success('Transaksi dihapus')
                await loadTransactions(); await refreshSummary()
              }}
            />
          )}
          {tab === 'pockets' && (
            <AccountsTab accounts={accounts}
              onAdd={() => setAccDialog({ open: true, editing: null })}
              onEdit={(a) => setAccDialog({ open: true, editing: a })}
              onDelete={async (id) => {
                if (!confirm('Hapus kantong ini beserta semua transaksinya?')) return
                await apiFetch(`/accounts/${id}`, { method: 'DELETE' })
                toast.success('Kantong dihapus')
                await loadAll()
              }}
            />
          )}
          {tab === 'budgets' && (
            <BudgetsTab categories={categories} onRefreshSummary={refreshSummary} />
          )}
          {tab === 'goals' && (
            <GoalsTab />
          )}
          {tab === 'categories' && (
            <CategoriesTab categories={categories}
              onAdd={() => setCatDialog({ open: true, editing: null })}
              onEdit={(c) => setCatDialog({ open: true, editing: c })}
              onDelete={async (id) => {
                if (!confirm('Hapus kategori ini?')) return
                await apiFetch(`/categories/${id}`, { method: 'DELETE' })
                toast.success('Kategori dihapus')
                const c = await apiFetch('/categories'); setCategories(c.categories)
              }}
            />
          )}
          {tab === 'export' && <ExportTab onExport={handleExport} accounts={accounts} />}
          {tab === 'import' && <ImportTab accounts={accounts} categories={categories} onImported={loadAll} />}
        </div>
      </main>

      <TransactionDialog
        state={trxDialog} setState={setTrxDialog}
        accounts={accounts} categories={categories}
        onSaved={async () => { await loadTransactions(); await refreshSummary() }}
      />
      <AccountDialog
        state={accDialog} setState={setAccDialog}
        onSaved={async () => { await loadAll() }}
      />
      <CategoryDialog
        state={catDialog} setState={setCatDialog}
        onSaved={async () => { const c = await apiFetch('/categories'); setCategories(c.categories) }}
      />
    </div>
  )
}

// ============ TABS ============
function OverviewTab({ summary, accounts, onAddTrx, categories }) {
  if (!summary) return null
  const trend = summary.trend || []
  const topCats = summary.topCategories || []
  const catMap = Object.fromEntries((categories || []).map((c) => [c.id, c]))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Saldo" value={formatIDR(summary.totalBalance)} icon={Wallet} accent="emerald" />
        <StatCard title="Pemasukan Bulan Ini" value={formatIDR(summary.incomeMonth)} icon={TrendingUp} accent="blue" />
        <StatCard title="Pengeluaran Bulan Ini" value={formatIDR(summary.expenseMonth)} icon={TrendingDown} accent="rose" />
        <StatCard title="Cash Flow Bulan Ini" value={formatIDR(summary.netMonth)} icon={ArrowLeftRight} accent={summary.netMonth >= 0 ? 'emerald' : 'rose'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Tren 6 Bulan Terakhir</CardTitle>
            <CardDescription>Perbandingan pemasukan vs pengeluaran</CardDescription>
          </CardHeader>
          <CardContent>
            {trend.every((t) => t.income === 0 && t.expense === 0) ? (
              <EmptyState message="Belum ada data transaksi. Mulai catat sekarang!" cta="Tambah Transaksi" onCta={onAddTrx} />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" fontSize={12} />
                  <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}jt`} />
                  <Tooltip formatter={(v) => formatIDR(v)} />
                  <Legend />
                  <Bar dataKey="income" name="Pemasukan" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" name="Pengeluaran" fill="#ef4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Kategori Pengeluaran</CardTitle>
            <CardDescription>Bulan ini</CardDescription>
          </CardHeader>
          <CardContent>
            {topCats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Belum ada pengeluaran bulan ini</p>
            ) : (
              <div className="space-y-3">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={topCats} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                      {topCats.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatIDR(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 max-h-40 overflow-auto">
                  {topCats.map((c) => (
                    <div key={c.category_id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span>{c.icon}</span>
                        <span className="truncate">{c.name}</span>
                      </div>
                      <span className="font-medium tabular-nums">{formatIDR(c.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Kantong Keuangan</CardTitle>
          <CardDescription>Saldo semua kantong</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map((a) => (
              <div key={a.id} className="rounded-xl border p-4 flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-10 w-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-xl">{a.icon}</div>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{a.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{ACCOUNT_TYPES.find((t) => t.value === a.type)?.label || a.type}</p>
                  </div>
                </div>
                <p className={`font-bold tabular-nums text-sm ${a.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatIDR(a.balance)}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transaksi Terbaru</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.recentTransactions.length === 0 ? (
            <EmptyState message="Belum ada transaksi. Yuk mulai catat!" cta="Tambah Transaksi" onCta={onAddTrx} />
          ) : (
            <div className="space-y-2">
              {summary.recentTransactions.map((t) => (
                <TransactionRow key={t.id} t={t} accounts={accounts} catMap={catMap} compact />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TransactionsTab({ transactions, accounts, categories, filter, setFilter, total, onEdit, onDelete }) {
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]))
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari catatan..." value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} className="pl-9" />
          </div>
          <Select value={filter.type} onValueChange={(v) => setFilter({ ...filter, type: v })}>
            <SelectTrigger className="w-full md:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua tipe</SelectItem>
              <SelectItem value="income">Pemasukan</SelectItem>
              <SelectItem value="expense">Pengeluaran</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter.account_id} onValueChange={(v) => setFilter({ ...filter, account_id: v })}>
            <SelectTrigger className="w-full md:w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua kantong</SelectItem>
              {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{total} transaksi</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground">Tidak ada transaksi</p>
          ) : (
            <div className="divide-y">
              {transactions.map((t) => (
                <TransactionRow key={t.id} t={t} accounts={accounts} catMap={catMap} onEdit={() => onEdit(t)} onDelete={() => onDelete(t.id)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function TransactionRow({ t, accounts, catMap, onEdit, onDelete, compact }) {
  const accMap = Object.fromEntries(accounts.map((a) => [a.id, a]))
  const isIncome = t.type === 'income'
  const isTransfer = t.type === 'transfer'
  const color = isTransfer ? 'text-blue-600' : isIncome ? 'text-emerald-600' : 'text-rose-600'
  const sign = isTransfer ? '' : isIncome ? '+' : '-'
  const Icon = isTransfer ? ArrowLeftRight : isIncome ? ArrowUpCircle : ArrowDownCircle
  const cat = t.category_id ? catMap[t.category_id] : null

  return (
    <div className="flex items-center justify-between py-3 gap-3">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isTransfer ? 'bg-blue-50 dark:bg-blue-900/30' : isIncome ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-rose-50 dark:bg-rose-900/30'}`}>
          {cat ? <span className="text-lg">{cat.icon}</span> : <Icon className={`h-5 w-5 ${color}`} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">
            {isTransfer ? `Transfer: ${accMap[t.account_id]?.name || '?'} → ${accMap[t.transfer_to_account_id]?.name || '?'}` : (cat?.name || 'Tanpa kategori')}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {formatDate(t.date)} • {accMap[t.account_id]?.name || 'Akun'} {t.note && `• ${t.note}`}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <p className={`font-bold tabular-nums ${color}`}>{sign}{formatIDR(t.amount)}</p>
        {!compact && (
          <>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}><Edit2 className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          </>
        )}
      </div>
    </div>
  )
}

function AccountsTab({ accounts, onAdd, onEdit, onDelete }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onAdd} className="bg-emerald-600 hover:bg-emerald-700">
          <PlusCircle className="h-4 w-4 mr-2" />Tambah Kantong
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((a) => (
          <Card key={a.id}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-2xl">{a.icon}</div>
                  <div>
                    <p className="font-semibold">{a.name}</p>
                    <p className="text-xs text-muted-foreground">{ACCOUNT_TYPES.find((t) => t.value === a.type)?.label || a.type}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(a)}><Edit2 className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={() => onDelete(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Saldo saat ini</p>
              <p className={`text-2xl font-bold tabular-nums ${a.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatIDR(a.balance)}</p>
              {a.initial_balance !== 0 && <p className="text-xs text-muted-foreground mt-1">Saldo awal: {formatIDR(a.initial_balance)}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function CategoriesTab({ categories, onAdd, onEdit, onDelete }) {
  const income = categories.filter((c) => c.type === 'income')
  const expense = categories.filter((c) => c.type === 'expense')
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={onAdd} className="bg-emerald-600 hover:bg-emerald-700">
          <PlusCircle className="h-4 w-4 mr-2" />Tambah Kategori
        </Button>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-lg text-emerald-600">Pemasukan ({income.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {income.map((c) => <CategoryRow key={c.id} c={c} onEdit={() => onEdit(c)} onDelete={() => onDelete(c.id)} />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg text-rose-600">Pengeluaran ({expense.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {expense.map((c) => <CategoryRow key={c.id} c={c} onEdit={() => onEdit(c)} onDelete={() => onDelete(c.id)} />)}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function CategoryRow({ c, onEdit, onDelete }) {
  return (
    <div className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: `${c.color}20` }}>{c.icon}</div>
        <span className="font-medium text-sm">{c.name}</span>
        {c.is_default && <Badge variant="secondary" className="text-xs">Default</Badge>}
      </div>
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Edit2 className="h-3 w-3" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-rose-600" onClick={onDelete}><Trash2 className="h-3 w-3" /></Button>
      </div>
    </div>
  )
}

function ExportTab({ onExport, accounts }) {
  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Export Data ke CSV</CardTitle>
        <CardDescription>Download semua transaksi Anda dalam format CSV untuk backup atau analisa di Excel/Google Sheets.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-4 bg-muted/30">
          <p className="text-sm font-medium mb-1">Format file:</p>
          <p className="text-xs text-muted-foreground">Kolom: Tanggal, Tipe, Jumlah, Kantong, Kategori, Tujuan Transfer, Catatan, Tags</p>
        </div>
        <Button onClick={onExport} size="lg" className="bg-emerald-600 hover:bg-emerald-700">
          <Download className="h-4 w-4 mr-2" />Download CSV Sekarang
        </Button>
      </CardContent>
    </Card>
  )
}

// ============ BUDGETS TAB ============
function BudgetsTab({ categories, onRefreshSummary }) {
  const now = new Date()
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const [month, setMonth] = useState(defaultMonth)
  const [budgets, setBudgets] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState({ open: false, editing: null })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await apiFetch(`/budgets?month=${month}`)
      setBudgets(r.budgets)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }, [month])

  useEffect(() => { load() }, [load])

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0)
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0)
  const overallPercent = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0

  const monthLabel = new Date(month + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
  const expenseCategories = categories.filter((c) => c.type === 'expense')
  const budgetedCategoryIds = new Set(budgets.map((b) => b.category_id))
  const availableCategories = expenseCategories.filter((c) => !budgetedCategoryIds.has(c.id))

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-44" />
          <span className="text-sm text-muted-foreground hidden md:inline">Budget untuk <b>{monthLabel}</b></span>
        </div>
        <Button onClick={() => setDialog({ open: true, editing: null })} className="bg-emerald-600 hover:bg-emerald-700" disabled={availableCategories.length === 0}>
          <PlusCircle className="h-4 w-4 mr-2" />Tambah Budget
        </Button>
      </div>

      {budgets.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Total Budget Bulan Ini</p>
                <p className="text-2xl font-bold tabular-nums">{formatIDR(totalSpent)} <span className="text-base text-muted-foreground font-normal">/ {formatIDR(totalBudget)}</span></p>
              </div>
              <div className={`text-3xl font-bold ${overallPercent >= 100 ? 'text-rose-600' : overallPercent >= 80 ? 'text-amber-600' : 'text-emerald-600'}`}>{overallPercent}%</div>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all ${overallPercent >= 100 ? 'bg-rose-500' : overallPercent >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                style={{ width: `${Math.min(overallPercent, 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
      ) : budgets.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Target className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium mb-1">Belum ada budget untuk {monthLabel}</p>
            <p className="text-sm text-muted-foreground mb-4">Set budget per kategori untuk mengontrol pengeluaran Anda.</p>
            <Button onClick={() => setDialog({ open: true, editing: null })} className="bg-emerald-600 hover:bg-emerald-700" disabled={availableCategories.length === 0}>
              <PlusCircle className="h-4 w-4 mr-2" />Buat Budget Pertama
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {budgets.map((b) => (
            <BudgetCard key={b.id} b={b}
              onEdit={() => setDialog({ open: true, editing: b })}
              onDelete={async () => {
                if (!confirm(`Hapus budget "${b.category_name}"?`)) return
                await apiFetch(`/budgets/${b.id}`, { method: 'DELETE' })
                toast.success('Budget dihapus')
                await load()
              }}
            />
          ))}
        </div>
      )}

      <BudgetDialog
        state={dialog} setState={setDialog} month={month}
        availableCategories={availableCategories} allExpenseCategories={expenseCategories}
        onSaved={async () => { await load(); if (onRefreshSummary) await onRefreshSummary() }}
      />
    </div>
  )
}

function BudgetCard({ b, onEdit, onDelete }) {
  const StatusIcon = b.status === 'over' ? AlertTriangle : b.status === 'warning' ? AlertTriangle : CheckCircle2
  const statusColor = b.status === 'over' ? 'text-rose-600' : b.status === 'warning' ? 'text-amber-600' : 'text-emerald-600'
  const barColor = b.status === 'over' ? 'bg-rose-500' : b.status === 'warning' ? 'bg-amber-500' : 'bg-emerald-500'
  const statusText = b.status === 'over' ? 'Over budget!' : b.status === 'warning' ? 'Hampir habis' : 'Aman'

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg flex items-center justify-center text-xl" style={{ backgroundColor: `${b.category_color}20` }}>{b.category_icon}</div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{b.category_name}</p>
              <div className={`inline-flex items-center gap-1 text-xs font-medium ${statusColor}`}>
                <StatusIcon className="h-3 w-3" />{statusText}
              </div>
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}><Edit2 className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>

        <div className="flex items-baseline justify-between mb-2">
          <p className="text-sm text-muted-foreground">Terpakai</p>
          <p className={`font-bold tabular-nums ${statusColor}`}>{b.percent}%</p>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden mb-3">
          <div className={`h-full transition-all ${barColor}`} style={{ width: `${Math.min(b.percent, 100)}%` }} />
        </div>
        <div className="flex justify-between text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Terpakai</p>
            <p className="font-semibold tabular-nums">{formatIDR(b.spent)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Budget</p>
            <p className="font-semibold tabular-nums">{formatIDR(b.amount)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{b.remaining < 0 ? 'Lebih' : 'Sisa'}</p>
            <p className={`font-semibold tabular-nums ${b.remaining < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
              {formatIDR(Math.abs(b.remaining))}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function BudgetDialog({ state, setState, month, availableCategories, allExpenseCategories, onSaved }) {
  const editing = state.editing
  const [form, setForm] = useState({ category_id: '', amount: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (state.open) {
      if (editing) setForm({ category_id: editing.category_id, amount: String(editing.amount) })
      else setForm({ category_id: availableCategories[0]?.id || '', amount: '' })
    }
  }, [state.open, editing, availableCategories])

  const save = async () => {
    if (!form.category_id) return toast.error('Pilih kategori')
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Jumlah budget harus > 0')
    setSaving(true)
    try {
      if (editing) {
        await apiFetch(`/budgets/${editing.id}`, { method: 'PUT', body: JSON.stringify({ amount: Number(form.amount) }) })
        toast.success('Budget diperbarui')
      } else {
        await apiFetch('/budgets', { method: 'POST', body: JSON.stringify({ category_id: form.category_id, amount: Number(form.amount), month }) })
        toast.success('Budget dibuat')
      }
      setState({ open: false, editing: null })
      await onSaved()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  const catOptions = editing ? allExpenseCategories : availableCategories

  return (
    <Dialog open={state.open} onOpenChange={(o) => setState({ open: o, editing: o ? editing : null })}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? 'Edit Budget' : 'Budget Baru'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Kategori pengeluaran</Label>
            <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })} disabled={!!editing}>
              <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
              <SelectContent>
                {catOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {editing && <p className="text-xs text-muted-foreground">Kategori tidak bisa diubah setelah budget dibuat</p>}
          </div>
          <div className="space-y-2">
            <Label>Jumlah budget (IDR)</Label>
            <Input type="number" min="0" step="10000" placeholder="500000" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="text-lg font-semibold" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setState({ open: false, editing: null })}>Batal</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ HELPERS ============
function StatCard({ title, value, icon: Icon, accent }) {
  const colors = {
    emerald: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30',
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30',
    rose: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30',
  }
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{title}</p>
          <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${colors[accent]}`}><Icon className="h-4 w-4" /></div>
        </div>
        <p className={`text-2xl font-bold tabular-nums ${accent === 'rose' ? 'text-rose-600' : accent === 'blue' ? 'text-blue-600' : 'text-emerald-600'}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function EmptyState({ message, cta, onCta }) {
  return (
    <div className="text-center py-10">
      <p className="text-muted-foreground mb-4">{message}</p>
      {cta && <Button onClick={onCta} className="bg-emerald-600 hover:bg-emerald-700"><PlusCircle className="h-4 w-4 mr-2" />{cta}</Button>}
    </div>
  )
}

// ============ DIALOGS ============
function TransactionDialog({ state, setState, accounts, categories, onSaved }) {
  const editing = state.editing
  const [form, setForm] = useState({
    type: 'expense', amount: '', account_id: '', category_id: '', transfer_to_account_id: '',
    date: new Date().toISOString().slice(0, 10), note: '', tags: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (state.open) {
      if (editing) {
        setForm({
          type: editing.type, amount: String(editing.amount),
          account_id: editing.account_id, category_id: editing.category_id || '',
          transfer_to_account_id: editing.transfer_to_account_id || '',
          date: new Date(editing.date).toISOString().slice(0, 10),
          note: editing.note || '', tags: (editing.tags || []).join(', '),
        })
      } else {
        setForm({
          type: 'expense', amount: '', account_id: accounts[0]?.id || '', category_id: '',
          transfer_to_account_id: '', date: new Date().toISOString().slice(0, 10), note: '', tags: '',
        })
      }
    }
  }, [state.open, editing, accounts])

  const catsForType = categories.filter((c) => c.type === form.type)

  const save = async () => {
    if (!form.amount || Number(form.amount) <= 0) return toast.error('Jumlah harus lebih dari 0')
    if (!form.account_id) return toast.error('Pilih akun')
    if (form.type !== 'transfer' && !form.category_id) return toast.error('Pilih kategori')
    if (form.type === 'transfer' && !form.transfer_to_account_id) return toast.error('Pilih akun tujuan')
    if (form.type === 'transfer' && form.account_id === form.transfer_to_account_id) return toast.error('Akun asal & tujuan tidak boleh sama')

    setSaving(true)
    try {
      const payload = {
        type: form.type, amount: Number(form.amount), account_id: form.account_id,
        category_id: form.type === 'transfer' ? null : form.category_id,
        transfer_to_account_id: form.type === 'transfer' ? form.transfer_to_account_id : null,
        date: form.date, note: form.note,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      }
      if (editing) {
        await apiFetch(`/transactions/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
        toast.success('Transaksi diperbarui')
      } else {
        await apiFetch('/transactions', { method: 'POST', body: JSON.stringify(payload) })
        toast.success('Transaksi ditambahkan')
      }
      setState({ open: false, editing: null })
      await onSaved()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={state.open} onOpenChange={(o) => setState({ open: o, editing: o ? editing : null })}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Transaksi' : 'Transaksi Baru'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {[
              { v: 'expense', l: 'Pengeluaran', c: 'rose' },
              { v: 'income', l: 'Pemasukan', c: 'emerald' },
              { v: 'transfer', l: 'Transfer', c: 'blue' },
            ].map((t) => (
              <button key={t.v} type="button" onClick={() => setForm({ ...form, type: t.v, category_id: '' })}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition ${form.type === t.v ? `bg-${t.c}-600 text-white border-${t.c}-600` : 'bg-background hover:bg-muted'}`}
                style={form.type === t.v ? { backgroundColor: t.c === 'rose' ? '#e11d48' : t.c === 'emerald' ? '#059669' : '#2563eb', color: 'white', borderColor: 'transparent' } : {}}>
                {t.l}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Jumlah (IDR)</Label>
            <Input type="number" min="0" step="1000" placeholder="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="text-lg font-semibold" />
          </div>

          <div className="space-y-2">
            <Label>{form.type === 'transfer' ? 'Dari kantong' : 'Kantong'}</Label>
            <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
              <SelectTrigger><SelectValue placeholder="Pilih kantong" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {form.type === 'transfer' ? (
            <div className="space-y-2">
              <Label>Ke kantong</Label>
              <Select value={form.transfer_to_account_id} onValueChange={(v) => setForm({ ...form, transfer_to_account_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih kantong tujuan" /></SelectTrigger>
                <SelectContent>
                  {accounts.filter((a) => a.id !== form.account_id).map((a) => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Kategori</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>
                  {catsForType.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Tanggal</Label>
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Catatan (opsional)</Label>
            <Textarea rows={2} placeholder="Contoh: Makan siang di kantor" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Tags (pisahkan dengan koma, opsional)</Label>
            <Input placeholder="liburan, kerja" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setState({ open: false, editing: null })}>Batal</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AccountDialog({ state, setState, onSaved }) {
  const editing = state.editing
  const [form, setForm] = useState({ name: '', type: 'cash', initial_balance: '0', icon: '💵' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (state.open) {
      if (editing) setForm({ name: editing.name, type: editing.type, initial_balance: String(editing.initial_balance || 0), icon: editing.icon })
      else setForm({ name: '', type: 'cash', initial_balance: '0', icon: '💵' })
    }
  }, [state.open, editing])

  const save = async () => {
    if (!form.name.trim()) return toast.error('Nama akun wajib diisi')
    setSaving(true)
    try {
      const payload = { name: form.name.trim(), type: form.type, initial_balance: Number(form.initial_balance) || 0, icon: form.icon }
      if (editing) await apiFetch(`/accounts/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      else await apiFetch('/accounts', { method: 'POST', body: JSON.stringify(payload) })
      toast.success(editing ? 'Akun diperbarui' : 'Akun ditambahkan')
      setState({ open: false, editing: null })
      await onSaved()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={state.open} onOpenChange={(o) => setState({ open: o, editing: o ? editing : null })}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? 'Edit Kantong' : 'Kantong Baru'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nama kantong</Label>
            <Input placeholder="Rekening BCA" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Jenis kantong</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v, icon: ACCOUNT_TYPES.find((t) => t.value === v)?.icon || form.icon })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Saldo awal (IDR)</Label>
            <Input type="number" value={form.initial_balance} onChange={(e) => setForm({ ...form, initial_balance: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Ikon (emoji)</Label>
            <Input maxLength={4} value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setState({ open: false, editing: null })}>Batal</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CategoryDialog({ state, setState, onSaved }) {
  const editing = state.editing
  const [form, setForm] = useState({ name: '', type: 'expense', icon: '📝', color: '#6b7280' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (state.open) {
      if (editing) setForm({ name: editing.name, type: editing.type, icon: editing.icon, color: editing.color })
      else setForm({ name: '', type: 'expense', icon: '📝', color: '#6b7280' })
    }
  }, [state.open, editing])

  const save = async () => {
    if (!form.name.trim()) return toast.error('Nama kategori wajib diisi')
    setSaving(true)
    try {
      if (editing) await apiFetch(`/categories/${editing.id}`, { method: 'PUT', body: JSON.stringify(form) })
      else await apiFetch('/categories', { method: 'POST', body: JSON.stringify(form) })
      toast.success(editing ? 'Kategori diperbarui' : 'Kategori ditambahkan')
      setState({ open: false, editing: null })
      await onSaved()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={state.open} onOpenChange={(o) => setState({ open: o, editing: o ? editing : null })}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? 'Edit Kategori' : 'Kategori Baru'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nama</Label>
            <Input placeholder="Kopi & Cafe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Tipe</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Pengeluaran</SelectItem>
                <SelectItem value="income">Pemasukan</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Ikon (emoji)</Label>
              <Input maxLength={4} value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Warna</Label>
              <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setState({ open: false, editing: null })}>Batal</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


// ============ GOALS TAB ============
function GoalsTab() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialog, setDialog] = useState({ open: false, editing: null })
  const [contribDialog, setContribDialog] = useState({ open: false, goal: null })

  const load = async () => {
    setLoading(true)
    try {
      const r = await apiFetch('/goals')
      setGoals(r.goals)
    } catch (e) { toast.error(e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true, editing: null })} className="bg-emerald-600 hover:bg-emerald-700">
          <PlusCircle className="h-4 w-4 mr-2" />Buat Goal Baru
        </Button>
      </div>
      {loading ? (
        <div className="py-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-600" /></div>
      ) : goals.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium mb-1">Belum ada goal tabungan</p>
            <p className="text-sm text-muted-foreground mb-4">Buat target seperti "Dana Darurat", "DP Rumah", atau "Liburan Bali"</p>
            <Button onClick={() => setDialog({ open: true, editing: null })} className="bg-emerald-600 hover:bg-emerald-700">
              <PlusCircle className="h-4 w-4 mr-2" />Buat Goal Pertama
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => <GoalCard key={g.id} g={g}
            onEdit={() => setDialog({ open: true, editing: g })}
            onContribute={() => setContribDialog({ open: true, goal: g })}
            onDelete={async () => {
              if (!confirm(`Hapus goal "${g.name}"?`)) return
              await apiFetch(`/goals/${g.id}`, { method: 'DELETE' })
              toast.success('Goal dihapus'); await load()
            }} />)}
        </div>
      )}
      <GoalDialog state={dialog} setState={setDialog} onSaved={load} />
      <ContributeDialog state={contribDialog} setState={setContribDialog} onSaved={load} />
    </div>
  )
}

function GoalCard({ g, onEdit, onContribute, onDelete }) {
  const isDone = g.percent >= 100
  const targetDateStr = g.target_date ? formatDate(g.target_date) : null
  const projectionStr = g.projection_date ? formatDate(g.projection_date) : null

  return (
    <Card className={isDone ? 'border-emerald-500 border-2' : ''}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-2xl">{g.icon}</div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{g.name}</p>
              {isDone ? (
                <div className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                  <Trophy className="h-3 w-3" />Target tercapai!
                </div>
              ) : targetDateStr && <p className="text-xs text-muted-foreground">Target: {targetDateStr}</p>}
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEdit}><Edit2 className="h-3.5 w-3.5" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-600" onClick={onDelete}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div className="flex items-baseline justify-between mb-2">
          <p className="text-sm text-muted-foreground">Progress</p>
          <p className="font-bold tabular-nums text-emerald-600">{g.percent}%</p>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden mb-4">
          <div className="h-full transition-all bg-gradient-to-r from-emerald-500 to-teal-500" style={{ width: `${g.percent}%` }} />
        </div>
        <div className="flex justify-between text-sm mb-4">
          <div>
            <p className="text-xs text-muted-foreground">Terkumpul</p>
            <p className="font-semibold tabular-nums text-emerald-600">{formatIDR(g.current_amount)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Target</p>
            <p className="font-semibold tabular-nums">{formatIDR(g.target_amount)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Kurang</p>
            <p className="font-semibold tabular-nums">{formatIDR(g.remaining)}</p>
          </div>
        </div>
        {!isDone && projectionStr && (
          <div className="text-xs text-muted-foreground p-2 rounded-lg bg-muted/50 mb-3">
            📊 Estimasi tercapai: <b className="text-foreground">{projectionStr}</b> (dengan kecepatan menabung saat ini)
          </div>
        )}
        <Button size="sm" onClick={onContribute} className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isDone}>
          <Plus className="h-3.5 w-3.5 mr-1" />Tambah Tabungan
        </Button>
      </CardContent>
    </Card>
  )
}

function GoalDialog({ state, setState, onSaved }) {
  const editing = state.editing
  const [form, setForm] = useState({ name: '', target_amount: '', current_amount: '0', target_date: '', icon: '🎯' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (state.open) {
      if (editing) setForm({
        name: editing.name, target_amount: String(editing.target_amount),
        current_amount: String(editing.current_amount),
        target_date: editing.target_date ? new Date(editing.target_date).toISOString().slice(0, 10) : '',
        icon: editing.icon,
      })
      else setForm({ name: '', target_amount: '', current_amount: '0', target_date: '', icon: '🎯' })
    }
  }, [state.open, editing])

  const save = async () => {
    if (!form.name.trim()) return toast.error('Nama goal wajib diisi')
    if (!form.target_amount || Number(form.target_amount) <= 0) return toast.error('Target harus > 0')
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        target_amount: Number(form.target_amount),
        current_amount: Number(form.current_amount) || 0,
        target_date: form.target_date || null,
        icon: form.icon,
      }
      if (editing) await apiFetch(`/goals/${editing.id}`, { method: 'PUT', body: JSON.stringify(payload) })
      else await apiFetch('/goals', { method: 'POST', body: JSON.stringify(payload) })
      toast.success(editing ? 'Goal diperbarui' : 'Goal dibuat')
      setState({ open: false, editing: null }); await onSaved()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }

  return (
    <Dialog open={state.open} onOpenChange={(o) => setState({ open: o, editing: o ? editing : null })}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? 'Edit Goal' : 'Goal Tabungan Baru'}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3 space-y-2">
              <Label>Nama goal</Label>
              <Input placeholder="Dana Darurat" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Ikon</Label>
              <Input maxLength={4} value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Target jumlah (IDR)</Label>
            <Input type="number" min="0" step="100000" placeholder="10000000" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} className="text-lg font-semibold" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Sudah terkumpul</Label>
              <Input type="number" min="0" value={form.current_amount} onChange={(e) => setForm({ ...form, current_amount: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Tenggat (opsional)</Label>
              <Input type="date" value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setState({ open: false, editing: null })}>Batal</Button>
          <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ContributeDialog({ state, setState, onSaved }) {
  const goal = state.goal
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => { if (state.open) setAmount('') }, [state.open])
  const submit = async () => {
    if (!amount || Number(amount) <= 0) return toast.error('Jumlah harus > 0')
    setSaving(true)
    try {
      await apiFetch(`/goals/${goal.id}/contribute`, { method: 'POST', body: JSON.stringify({ amount: Number(amount) }) })
      toast.success(`Berhasil menambah ${formatIDR(Number(amount))} ke ${goal.name}`)
      setState({ open: false, goal: null }); await onSaved()
    } catch (e) { toast.error(e.message) }
    finally { setSaving(false) }
  }
  if (!goal) return null
  return (
    <Dialog open={state.open} onOpenChange={(o) => setState({ open: o, goal: o ? goal : null })}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{goal.icon} Tambah Tabungan: {goal.name}</DialogTitle>
          <DialogDescription>Sudah terkumpul {formatIDR(goal.current_amount)} dari {formatIDR(goal.target_amount)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Jumlah tabungan (IDR)</Label>
          <Input type="number" min="0" step="10000" placeholder="500000" value={amount} onChange={(e) => setAmount(e.target.value)} className="text-lg font-semibold" autoFocus />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setState({ open: false, goal: null })}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Tambah
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============ IMPORT CSV TAB ============
function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else inQuotes = false
      } else field += c
    } else {
      if (c === '"') inQuotes = true
      else if (c === ',') { row.push(field); field = '' }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = '' }
      else if (c === '\r') { /* skip */ }
      else field += c
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }
  return rows.filter((r) => r.some((f) => f.trim() !== ''))
}

const IMPORT_FIELDS = [
  { key: 'date', label: 'Tanggal', required: true },
  { key: 'amount', label: 'Jumlah', required: true },
  { key: 'type', label: 'Tipe (income/expense)', required: false },
  { key: 'category_name', label: 'Nama Kategori', required: false },
  { key: 'account_name', label: 'Nama Kantong', required: false },
  { key: 'note', label: 'Catatan', required: false },
  { key: 'tags', label: 'Tags', required: false },
]

function ImportTab({ accounts, categories, onImported }) {
  const [step, setStep] = useState(1) // 1=upload, 2=map, 3=preview
  const [rawRows, setRawRows] = useState([]) // parsed CSV
  const [hasHeader, setHasHeader] = useState(true)
  const [mapping, setMapping] = useState({}) // field key -> column index
  const [defaults, setDefaults] = useState({ account_id: '', cat_expense: '', cat_income: '' })
  const [preview, setPreview] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!defaults.account_id && accounts.length > 0) {
      const catExp = categories.find((c) => c.type === 'expense')
      const catInc = categories.find((c) => c.type === 'income')
      setDefaults({ account_id: accounts[0].id, cat_expense: catExp?.id || '', cat_income: catInc?.id || '' })
    }
  }, [accounts, categories])

  const handleFile = async (file) => {
    if (!file) return
    const text = await file.text()
    const parsed = parseCSV(text)
    if (parsed.length === 0) return toast.error('CSV kosong')
    setRawRows(parsed)
    // Auto-guess mapping based on header names
    if (parsed[0]) {
      const headers = parsed[0].map((h) => h.toLowerCase().trim())
      const guess = {}
      headers.forEach((h, i) => {
        if (/tanggal|date/.test(h)) guess.date = i
        else if (/jumlah|amount|nominal/.test(h)) guess.amount = i
        else if (/tipe|type|jenis/.test(h)) guess.type = i
        else if (/kategori|category/.test(h)) guess.category_name = i
        else if (/kantong|akun|account/.test(h)) guess.account_name = i
        else if (/catatan|note|keterangan|deskripsi/.test(h)) guess.note = i
        else if (/tag/.test(h)) guess.tags = i
      })
      setMapping(guess)
    }
    setStep(2)
  }

  const downloadTemplate = () => {
    const csv = [
      ['Tanggal', 'Jumlah', 'Tipe', 'Kategori', 'Kantong', 'Catatan', 'Tags'].join(','),
      '2025-06-01,5000000,income,Gaji,Rekening BCA,Gaji bulanan,',
      '2025-06-02,45000,expense,Makanan & Minuman,Kas,Makan siang,',
      '2025-06-03,150000,expense,Transportasi,Kas,Bensin mingguan,rutin',
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'finmate-template.csv'
    a.click(); URL.revokeObjectURL(url)
  }

  const dataRows = hasHeader ? rawRows.slice(1) : rawRows
  const headers = hasHeader ? rawRows[0] || [] : (rawRows[0] || []).map((_, i) => `Kolom ${i + 1}`)

  const runPreview = async (commit) => {
    if (mapping.date === undefined || mapping.amount === undefined) {
      return toast.error('Kolom Tanggal & Jumlah wajib di-map')
    }
    if (!defaults.account_id) return toast.error('Pilih kantong default')

    const rows = dataRows.map((r) => {
      const obj = {}
      IMPORT_FIELDS.forEach((f) => {
        if (mapping[f.key] !== undefined) obj[f.key] = r[mapping[f.key]] || ''
      })
      return obj
    })

    setBusy(true)
    try {
      const res = await apiFetch('/import/transactions', {
        method: 'POST',
        body: JSON.stringify({
          rows,
          default_account_id: defaults.account_id,
          default_category_id_expense: defaults.cat_expense,
          default_category_id_income: defaults.cat_income,
          commit,
        }),
      })
      setPreview(res)
      if (commit) {
        toast.success(`Berhasil import ${res.summary.inserted} transaksi!`)
        // Reset
        setStep(1); setRawRows([]); setMapping({}); setPreview(null)
        if (onImported) await onImported()
      } else {
        setStep(3)
      }
    } catch (e) { toast.error(e.message) }
    finally { setBusy(false) }
  }

  const accMap = Object.fromEntries(accounts.map((a) => [a.id, a]))
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]))

  return (
    <div className="space-y-4 max-w-5xl">
      <Card>
        <CardHeader>
          <CardTitle>Import CSV dari Excel/Google Sheets</CardTitle>
          <CardDescription>Migrasi data lama Anda dengan 3 langkah mudah: upload → map kolom → konfirmasi.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            {[
              { n: 1, l: 'Upload' }, { n: 2, l: 'Map Kolom' }, { n: 3, l: 'Preview & Import' }
            ].map((s, i, arr) => (
              <div key={s.n} className="flex items-center gap-2 flex-1">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${step >= s.n ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground'}`}>{s.n}</div>
                <span className={`text-sm font-medium ${step >= s.n ? '' : 'text-muted-foreground'}`}>{s.l}</span>
                {i < arr.length - 1 && <div className={`flex-1 h-0.5 ${step > s.n ? 'bg-emerald-600' : 'bg-muted'}`} />}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <Button variant="outline" onClick={downloadTemplate}>
                <FileText className="h-4 w-4 mr-2" />Download Template CSV
              </Button>
              <label className="block border-2 border-dashed rounded-xl p-12 text-center cursor-pointer hover:bg-muted/50 transition">
                <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">Klik untuk upload file CSV</p>
                <p className="text-xs text-muted-foreground mt-1">atau drag & drop file di sini</p>
                <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm">
                <input type="checkbox" id="hasheader" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} />
                <label htmlFor="hasheader">Baris pertama adalah header</label>
                <span className="text-muted-foreground ml-2">• {dataRows.length} baris data terdeteksi</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {IMPORT_FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">{f.label} {f.required && <span className="text-rose-500">*</span>}</Label>
                    <Select value={mapping[f.key] !== undefined ? String(mapping[f.key]) : '-1'}
                      onValueChange={(v) => setMapping({ ...mapping, [f.key]: v === '-1' ? undefined : Number(v) })}>
                      <SelectTrigger><SelectValue placeholder="- Tidak digunakan -" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="-1">- Tidak digunakan -</SelectItem>
                        {headers.map((h, i) => <SelectItem key={i} value={String(i)}>{h || `Kolom ${i + 1}`}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="font-medium text-sm">Default (fallback jika data CSV tidak lengkap):</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Kantong default *</Label>
                    <Select value={defaults.account_id} onValueChange={(v) => setDefaults({ ...defaults, account_id: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Kategori expense fallback</Label>
                    <Select value={defaults.cat_expense} onValueChange={(v) => setDefaults({ ...defaults, cat_expense: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categories.filter((c) => c.type === 'expense').map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Kategori income fallback</Label>
                    <Select value={defaults.cat_income} onValueChange={(v) => setDefaults({ ...defaults, cat_income: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {categories.filter((c) => c.type === 'income').map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Preview of first rows */}
              <div className="border rounded-lg overflow-auto max-h-64">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      {headers.map((h, i) => <th key={i} className="p-2 text-left font-medium">{h || `Kolom ${i + 1}`}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {dataRows.slice(0, 8).map((r, i) => (
                      <tr key={i} className="border-t">
                        {r.map((c, j) => <td key={j} className="p-2">{c}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => { setStep(1); setRawRows([]); setMapping({}) }}>Kembali</Button>
                <Button onClick={() => runPreview(false)} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Preview Data
                </Button>
              </div>
            </div>
          )}

          {step === 3 && preview && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total baris</p>
                  <p className="text-2xl font-bold">{preview.summary.total}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 p-3">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">Valid (akan diimport)</p>
                  <p className="text-2xl font-bold text-emerald-600">{preview.summary.valid}</p>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 dark:bg-rose-900/20 p-3">
                  <p className="text-xs text-rose-700 dark:text-rose-400">Invalid (dilewati)</p>
                  <p className="text-2xl font-bold text-rose-600">{preview.summary.invalid}</p>
                </div>
              </div>

              <div className="border rounded-lg overflow-auto max-h-96">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="p-2 text-left">#</th>
                      <th className="p-2 text-left">Status</th>
                      <th className="p-2 text-left">Tanggal</th>
                      <th className="p-2 text-left">Tipe</th>
                      <th className="p-2 text-right">Jumlah</th>
                      <th className="p-2 text-left">Kantong</th>
                      <th className="p-2 text-left">Kategori</th>
                      <th className="p-2 text-left">Catatan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.preview.map((p) => (
                      <tr key={p.index} className={`border-t ${p.valid ? '' : 'bg-rose-50 dark:bg-rose-900/10'}`}>
                        <td className="p-2">{p.index}</td>
                        <td className="p-2">
                          {p.valid ? <span className="text-emerald-600">✓ Valid</span> : <span className="text-rose-600" title={p.errors.join(', ')}>✗ {p.errors[0]}</span>}
                        </td>
                        <td className="p-2">{p.resolved?.date ? formatDate(p.resolved.date) : p.raw.date}</td>
                        <td className="p-2">{p.resolved?.type || p.raw.type}</td>
                        <td className="p-2 text-right tabular-nums">{p.resolved ? formatIDR(p.resolved.amount) : p.raw.amount}</td>
                        <td className="p-2">{p.resolved?.account_id ? `${accMap[p.resolved.account_id]?.icon || ''} ${accMap[p.resolved.account_id]?.name || '?'}` : ''}</td>
                        <td className="p-2">{p.resolved?.category_id ? `${catMap[p.resolved.category_id]?.icon || ''} ${catMap[p.resolved.category_id]?.name || '?'}` : ''}</td>
                        <td className="p-2 max-w-xs truncate">{p.raw.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep(2)}>Kembali</Button>
                <Button onClick={() => runPreview(true)} disabled={busy || preview.summary.valid === 0} className="bg-emerald-600 hover:bg-emerald-700">
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Import {preview.summary.valid} Transaksi Valid
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
