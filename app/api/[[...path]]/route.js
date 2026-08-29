import { MongoClient } from 'mongodb'
import { v4 as uuidv4 } from 'uuid'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// MongoDB connection
let client
let db

async function connectToMongo() {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URL)
    await client.connect()
    db = client.db(process.env.DB_NAME)
  }
  return db
}

function handleCORS(response) {
  response.headers.set('Access-Control-Allow-Origin', process.env.CORS_ORIGINS || '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  response.headers.set('Access-Control-Allow-Credentials', 'true')
  return response
}

export async function OPTIONS() {
  return handleCORS(new NextResponse(null, { status: 200 }))
}

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me'

function signToken(user) {
  return jwt.sign({ uid: user._id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '30d' })
}

function getAuthUser(request) {
  try {
    const header = request.headers.get('authorization') || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return null
    return jwt.verify(token, JWT_SECRET)
  } catch (e) {
    return null
  }
}

function unauthorized() {
  return handleCORS(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }))
}

function badRequest(msg) {
  return handleCORS(NextResponse.json({ error: msg }, { status: 400 }))
}

const DEFAULT_CATEGORIES = [
  // Income
  { name: 'Gaji', type: 'income', icon: '💰', color: '#10b981' },
  { name: 'Bonus', type: 'income', icon: '🎁', color: '#059669' },
  { name: 'Investasi', type: 'income', icon: '📈', color: '#047857' },
  { name: 'Freelance', type: 'income', icon: '💼', color: '#065f46' },
  { name: 'Lainnya (Pemasukan)', type: 'income', icon: '💵', color: '#34d399' },
  // Expense
  { name: 'Makanan & Minuman', type: 'expense', icon: '🍽️', color: '#ef4444' },
  { name: 'Transportasi', type: 'expense', icon: '🚗', color: '#f97316' },
  { name: 'Belanja', type: 'expense', icon: '🛍️', color: '#f59e0b' },
  { name: 'Tagihan & Utilitas', type: 'expense', icon: '💡', color: '#eab308' },
  { name: 'Hiburan', type: 'expense', icon: '🎬', color: '#8b5cf6' },
  { name: 'Kesehatan', type: 'expense', icon: '🏥', color: '#ec4899' },
  { name: 'Pendidikan', type: 'expense', icon: '📚', color: '#3b82f6' },
  { name: 'Rumah Tangga', type: 'expense', icon: '🏠', color: '#06b6d4' },
  { name: 'Lainnya (Pengeluaran)', type: 'expense', icon: '📝', color: '#6b7280' },
]

async function seedDefaultsForUser(db, userId) {
  const cats = DEFAULT_CATEGORIES.map((c) => ({
    _id: uuidv4(),
    user_id: userId,
    name: c.name,
    type: c.type,
    icon: c.icon,
    color: c.color,
    is_default: true,
    created_at: new Date(),
  }))
  await db.collection('categories').insertMany(cats)

  // Default account: Kas
  const account = {
    _id: uuidv4(),
    user_id: userId,
    name: 'Kas',
    type: 'cash',
    initial_balance: 0,
    currency: 'IDR',
    icon: '💵',
    created_at: new Date(),
  }
  await db.collection('accounts').insertOne(account)
}

async function computeAccountBalance(db, userId, accountId) {
  const account = await db.collection('accounts').findOne({ _id: accountId, user_id: userId })
  if (!account) return 0
  const pipeline = [
    { $match: { user_id: userId, $or: [{ account_id: accountId }, { transfer_to_account_id: accountId }] } },
    {
      $group: {
        _id: null,
        income: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'income'] }, { $eq: ['$account_id', accountId] }] }, '$amount', 0] } },
        expense: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'expense'] }, { $eq: ['$account_id', accountId] }] }, '$amount', 0] } },
        transferOut: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'transfer'] }, { $eq: ['$account_id', accountId] }] }, '$amount', 0] } },
        transferIn: { $sum: { $cond: [{ $and: [{ $eq: ['$type', 'transfer'] }, { $eq: ['$transfer_to_account_id', accountId] }] }, '$amount', 0] } },
      },
    },
  ]
  const agg = await db.collection('transactions').aggregate(pipeline).toArray()
  const t = agg[0] || { income: 0, expense: 0, transferOut: 0, transferIn: 0 }
  return (account.initial_balance || 0) + t.income - t.expense - t.transferOut + t.transferIn
}

function stripId(doc) {
  if (!doc) return doc
  const { _id, ...rest } = doc
  return { id: _id, ...rest }
}

async function handleRoute(request, { params }) {
  const { path = [] } = await params
  const route = `/${path.join('/')}`
  const method = request.method

  try {
    const db = await connectToMongo()

    // Health
    if ((route === '/' || route === '/root') && method === 'GET') {
      return handleCORS(NextResponse.json({ message: 'FinMate API running' }))
    }

    // ============ AUTH ============
    if (route === '/auth/register' && method === 'POST') {
      const body = await request.json()
      const { email, password, name } = body || {}
      if (!email || !password || !name) return badRequest('email, password, name wajib diisi')
      if (password.length < 6) return badRequest('Password minimal 6 karakter')
      const existing = await db.collection('users').findOne({ email: email.toLowerCase() })
      if (existing) return badRequest('Email sudah terdaftar')
      const password_hash = await bcrypt.hash(password, 10)
      const user = {
        _id: uuidv4(),
        email: email.toLowerCase(),
        name,
        password_hash,
        role: 'user',
        currency_default: 'IDR',
        payment_status: 'trial',
        created_at: new Date(),
      }
      await db.collection('users').insertOne(user)
      await seedDefaultsForUser(db, user._id)
      const token = signToken(user)
      const { password_hash: _, ...safe } = user
      return handleCORS(NextResponse.json({ token, user: stripId(safe) }))
    }

    if (route === '/auth/login' && method === 'POST') {
      const body = await request.json()
      const { email, password } = body || {}
      if (!email || !password) return badRequest('email & password wajib diisi')
      const user = await db.collection('users').findOne({ email: email.toLowerCase() })
      if (!user) return badRequest('Email atau password salah')
      const ok = await bcrypt.compare(password, user.password_hash)
      if (!ok) return badRequest('Email atau password salah')
      const token = signToken(user)
      const { password_hash: _, ...safe } = user
      return handleCORS(NextResponse.json({ token, user: stripId(safe) }))
    }

    if (route === '/auth/me' && method === 'GET') {
      const auth = getAuthUser(request)
      if (!auth) return unauthorized()
      const user = await db.collection('users').findOne({ _id: auth.uid })
      if (!user) return unauthorized()
      const { password_hash: _, ...safe } = user
      return handleCORS(NextResponse.json({ user: stripId(safe) }))
    }

    // All routes below require auth
    const auth = getAuthUser(request)
    if (!auth) return unauthorized()
    const userId = auth.uid

    // ============ ACCOUNTS ============
    if (route === '/accounts' && method === 'GET') {
      const accounts = await db.collection('accounts').find({ user_id: userId }).sort({ created_at: 1 }).toArray()
      const withBalance = await Promise.all(
        accounts.map(async (a) => ({
          ...stripId(a),
          balance: await computeAccountBalance(db, userId, a._id),
        }))
      )
      return handleCORS(NextResponse.json({ accounts: withBalance }))
    }

    if (route === '/accounts' && method === 'POST') {
      const body = await request.json()
      const { name, type, initial_balance, icon } = body || {}
      if (!name || !type) return badRequest('name & type wajib diisi')
      const acc = {
        _id: uuidv4(),
        user_id: userId,
        name,
        type, // cash | bank | ewallet | credit_card | investment
        initial_balance: Number(initial_balance) || 0,
        currency: 'IDR',
        icon: icon || '💳',
        created_at: new Date(),
      }
      await db.collection('accounts').insertOne(acc)
      return handleCORS(NextResponse.json({ account: { ...stripId(acc), balance: acc.initial_balance } }))
    }

    const accMatch = route.match(/^\/accounts\/([^/]+)$/)
    if (accMatch) {
      const id = accMatch[1]
      if (method === 'PUT') {
        const body = await request.json()
        const update = {}
        ;['name', 'type', 'icon'].forEach((k) => { if (body[k] !== undefined) update[k] = body[k] })
        if (body.initial_balance !== undefined) update.initial_balance = Number(body.initial_balance) || 0
        await db.collection('accounts').updateOne({ _id: id, user_id: userId }, { $set: update })
        return handleCORS(NextResponse.json({ ok: true }))
      }
      if (method === 'DELETE') {
        // Delete related transactions too
        await db.collection('transactions').deleteMany({ user_id: userId, $or: [{ account_id: id }, { transfer_to_account_id: id }] })
        await db.collection('accounts').deleteOne({ _id: id, user_id: userId })
        return handleCORS(NextResponse.json({ ok: true }))
      }
    }

    // ============ CATEGORIES ============
    if (route === '/categories' && method === 'GET') {
      const cats = await db.collection('categories').find({ user_id: userId }).sort({ type: 1, name: 1 }).toArray()
      return handleCORS(NextResponse.json({ categories: cats.map(stripId) }))
    }

    if (route === '/categories' && method === 'POST') {
      const body = await request.json()
      const { name, type, icon, color } = body || {}
      if (!name || !type) return badRequest('name & type wajib diisi')
      const cat = {
        _id: uuidv4(),
        user_id: userId,
        name,
        type,
        icon: icon || '📌',
        color: color || '#6b7280',
        is_default: false,
        created_at: new Date(),
      }
      await db.collection('categories').insertOne(cat)
      return handleCORS(NextResponse.json({ category: stripId(cat) }))
    }

    const catMatch = route.match(/^\/categories\/([^/]+)$/)
    if (catMatch) {
      const id = catMatch[1]
      if (method === 'PUT') {
        const body = await request.json()
        const update = {}
        ;['name', 'type', 'icon', 'color'].forEach((k) => { if (body[k] !== undefined) update[k] = body[k] })
        await db.collection('categories').updateOne({ _id: id, user_id: userId }, { $set: update })
        return handleCORS(NextResponse.json({ ok: true }))
      }
      if (method === 'DELETE') {
        await db.collection('categories').deleteOne({ _id: id, user_id: userId })
        return handleCORS(NextResponse.json({ ok: true }))
      }
    }

    // ============ TRANSACTIONS ============
    if (route === '/transactions' && method === 'GET') {
      const url = new URL(request.url)
      const q = url.searchParams
      const limit = Math.min(parseInt(q.get('limit') || '100'), 500)
      const skip = parseInt(q.get('skip') || '0')
      const filter = { user_id: userId }
      if (q.get('type')) filter.type = q.get('type')
      if (q.get('account_id')) filter.account_id = q.get('account_id')
      if (q.get('category_id')) filter.category_id = q.get('category_id')
      if (q.get('from') || q.get('to')) {
        filter.date = {}
        if (q.get('from')) filter.date.$gte = new Date(q.get('from'))
        if (q.get('to')) filter.date.$lte = new Date(q.get('to'))
      }
      if (q.get('search')) {
        filter.note = { $regex: q.get('search'), $options: 'i' }
      }
      const total = await db.collection('transactions').countDocuments(filter)
      const items = await db.collection('transactions').find(filter).sort({ date: -1, created_at: -1 }).skip(skip).limit(limit).toArray()
      return handleCORS(NextResponse.json({ transactions: items.map(stripId), total }))
    }

    if (route === '/transactions' && method === 'POST') {
      const body = await request.json()
      const { type, amount, account_id, category_id, transfer_to_account_id, date, note, tags } = body || {}
      if (!type || !amount || !account_id || !date) return badRequest('type, amount, account_id, date wajib diisi')
      if (!['income', 'expense', 'transfer'].includes(type)) return badRequest('type tidak valid')
      if (type === 'transfer' && !transfer_to_account_id) return badRequest('transfer_to_account_id wajib untuk transfer')
      if ((type === 'income' || type === 'expense') && !category_id) return badRequest('category_id wajib untuk income/expense')

      const trx = {
        _id: uuidv4(),
        user_id: userId,
        type,
        amount: Number(amount),
        account_id,
        category_id: category_id || null,
        transfer_to_account_id: transfer_to_account_id || null,
        date: new Date(date),
        note: note || '',
        tags: Array.isArray(tags) ? tags : [],
        created_at: new Date(),
      }
      await db.collection('transactions').insertOne(trx)
      return handleCORS(NextResponse.json({ transaction: stripId(trx) }))
    }

    const trxMatch = route.match(/^\/transactions\/([^/]+)$/)
    if (trxMatch) {
      const id = trxMatch[1]
      if (method === 'PUT') {
        const body = await request.json()
        const update = {}
        ;['type', 'account_id', 'category_id', 'transfer_to_account_id', 'note'].forEach((k) => {
          if (body[k] !== undefined) update[k] = body[k]
        })
        if (body.amount !== undefined) update.amount = Number(body.amount)
        if (body.date !== undefined) update.date = new Date(body.date)
        if (body.tags !== undefined) update.tags = Array.isArray(body.tags) ? body.tags : []
        await db.collection('transactions').updateOne({ _id: id, user_id: userId }, { $set: update })
        return handleCORS(NextResponse.json({ ok: true }))
      }
      if (method === 'DELETE') {
        await db.collection('transactions').deleteOne({ _id: id, user_id: userId })
        return handleCORS(NextResponse.json({ ok: true }))
      }
    }

    // ============ BUDGETS ============
    // Schema: { _id, user_id, category_id (ref categories), amount, month (YYYY-MM), created_at }
    if (route === '/budgets' && method === 'GET') {
      const url = new URL(request.url)
      const monthParam = url.searchParams.get('month') // YYYY-MM
      const now = new Date()
      let month = monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const [y, m] = month.split('-').map(Number)
      const startOfMonth = new Date(y, m - 1, 1)
      const endOfMonth = new Date(y, m, 0, 23, 59, 59, 999)

      const budgets = await db.collection('budgets').find({ user_id: userId, month }).toArray()
      // compute spent per category in that month
      const spentAgg = await db.collection('transactions').aggregate([
        { $match: { user_id: userId, type: 'expense', date: { $gte: startOfMonth, $lte: endOfMonth } } },
        { $group: { _id: '$category_id', total: { $sum: '$amount' } } },
      ]).toArray()
      const spentMap = Object.fromEntries(spentAgg.map((r) => [r._id, r.total]))
      const cats = await db.collection('categories').find({ user_id: userId, type: 'expense' }).toArray()
      const catMap = Object.fromEntries(cats.map((c) => [c._id, c]))

      const enriched = budgets.map((b) => {
        const cat = catMap[b.category_id]
        const spent = spentMap[b.category_id] || 0
        const percent = b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0
        return {
          id: b._id,
          category_id: b.category_id,
          category_name: cat?.name || 'Kategori dihapus',
          category_icon: cat?.icon || '❓',
          category_color: cat?.color || '#6b7280',
          amount: b.amount,
          month: b.month,
          spent,
          remaining: b.amount - spent,
          percent,
          status: percent >= 100 ? 'over' : percent >= 80 ? 'warning' : 'safe',
        }
      })
      // sort by percent desc
      enriched.sort((a, b) => b.percent - a.percent)

      return handleCORS(NextResponse.json({ budgets: enriched, month }))
    }

    if (route === '/budgets' && method === 'POST') {
      const body = await request.json()
      const { category_id, amount, month } = body || {}
      if (!category_id || !amount || !month) return badRequest('category_id, amount, month wajib diisi')
      // upsert - one budget per category per month
      const existing = await db.collection('budgets').findOne({ user_id: userId, category_id, month })
      if (existing) {
        await db.collection('budgets').updateOne({ _id: existing._id }, { $set: { amount: Number(amount) } })
        return handleCORS(NextResponse.json({ ok: true, id: existing._id }))
      }
      const b = {
        _id: uuidv4(),
        user_id: userId,
        category_id,
        amount: Number(amount),
        month,
        created_at: new Date(),
      }
      await db.collection('budgets').insertOne(b)
      return handleCORS(NextResponse.json({ budget: stripId(b) }))
    }

    const budgetMatch = route.match(/^\/budgets\/([^/]+)$/)
    if (budgetMatch) {
      const id = budgetMatch[1]
      if (method === 'PUT') {
        const body = await request.json()
        const update = {}
        if (body.amount !== undefined) update.amount = Number(body.amount)
        await db.collection('budgets').updateOne({ _id: id, user_id: userId }, { $set: update })
        return handleCORS(NextResponse.json({ ok: true }))
      }
      if (method === 'DELETE') {
        await db.collection('budgets').deleteOne({ _id: id, user_id: userId })
        return handleCORS(NextResponse.json({ ok: true }))
      }
    }

    // ============ DASHBOARD SUMMARY ============
    if (route === '/dashboard/summary' && method === 'GET') {
      const url = new URL(request.url)
      const monthParam = url.searchParams.get('month') // YYYY-MM
      const now = new Date()
      let year, month
      if (monthParam) {
        const [y, m] = monthParam.split('-').map(Number)
        year = y; month = m - 1
      } else {
        year = now.getFullYear(); month = now.getMonth()
      }
      const startOfMonth = new Date(year, month, 1)
      const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999)

      // Accounts total
      const accounts = await db.collection('accounts').find({ user_id: userId }).toArray()
      const balances = await Promise.all(accounts.map(async (a) => await computeAccountBalance(db, userId, a._id)))
      const totalBalance = balances.reduce((sum, b) => sum + b, 0)

      // This month income/expense
      const monthAgg = await db.collection('transactions').aggregate([
        { $match: { user_id: userId, date: { $gte: startOfMonth, $lte: endOfMonth }, type: { $in: ['income', 'expense'] } } },
        { $group: { _id: '$type', total: { $sum: '$amount' } } },
      ]).toArray()
      let incomeMonth = 0, expenseMonth = 0
      monthAgg.forEach((r) => { if (r._id === 'income') incomeMonth = r.total; if (r._id === 'expense') expenseMonth = r.total })

      // Top expense categories this month
      const catAgg = await db.collection('transactions').aggregate([
        { $match: { user_id: userId, date: { $gte: startOfMonth, $lte: endOfMonth }, type: 'expense' } },
        { $group: { _id: '$category_id', total: { $sum: '$amount' } } },
        { $sort: { total: -1 } },
        { $limit: 8 },
      ]).toArray()
      const catIds = catAgg.map((c) => c._id).filter(Boolean)
      const cats = await db.collection('categories').find({ _id: { $in: catIds } }).toArray()
      const catMap = Object.fromEntries(cats.map((c) => [c._id, c]))
      const topCategories = catAgg.map((c) => ({
        category_id: c._id,
        name: catMap[c._id]?.name || 'Tanpa kategori',
        icon: catMap[c._id]?.icon || '📝',
        color: catMap[c._id]?.color || '#6b7280',
        total: c.total,
      }))

      // Trend last 6 months
      const sixAgo = new Date(year, month - 5, 1)
      const trendAgg = await db.collection('transactions').aggregate([
        { $match: { user_id: userId, date: { $gte: sixAgo, $lte: endOfMonth }, type: { $in: ['income', 'expense'] } } },
        { $group: { _id: { y: { $year: '$date' }, m: { $month: '$date' }, t: '$type' }, total: { $sum: '$amount' } } },
      ]).toArray()
      const trendMap = {}
      for (let i = 5; i >= 0; i--) {
        const d = new Date(year, month - i, 1)
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`
        trendMap[key] = { label: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }), income: 0, expense: 0 }
      }
      trendAgg.forEach((r) => {
        const key = `${r._id.y}-${r._id.m}`
        if (trendMap[key]) trendMap[key][r._id.t] = r.total
      })
      const trend = Object.values(trendMap)

      // Recent transactions
      const recent = await db.collection('transactions').find({ user_id: userId }).sort({ date: -1, created_at: -1 }).limit(5).toArray()

      return handleCORS(NextResponse.json({
        totalBalance,
        incomeMonth,
        expenseMonth,
        netMonth: incomeMonth - expenseMonth,
        topCategories,
        trend,
        recentTransactions: recent.map(stripId),
        accountsCount: accounts.length,
      }))
    }

    // ============ EXPORT CSV ============
    if (route === '/export/csv' && method === 'GET') {
      const url = new URL(request.url)
      const from = url.searchParams.get('from')
      const to = url.searchParams.get('to')
      const account_id = url.searchParams.get('account_id')
      const filter = { user_id: userId }
      if (from || to) {
        filter.date = {}
        if (from) filter.date.$gte = new Date(from)
        if (to) filter.date.$lte = new Date(to)
      }
      if (account_id) filter.account_id = account_id

      const [items, accounts, categories] = await Promise.all([
        db.collection('transactions').find(filter).sort({ date: -1 }).toArray(),
        db.collection('accounts').find({ user_id: userId }).toArray(),
        db.collection('categories').find({ user_id: userId }).toArray(),
      ])
      const accMap = Object.fromEntries(accounts.map((a) => [a._id, a.name]))
      const catMap = Object.fromEntries(categories.map((c) => [c._id, c.name]))

      const header = ['Tanggal', 'Tipe', 'Jumlah (IDR)', 'Akun', 'Kategori', 'Tujuan Transfer', 'Catatan', 'Tags']
      const rows = items.map((t) => [
        new Date(t.date).toISOString().slice(0, 10),
        t.type,
        t.amount,
        accMap[t.account_id] || '',
        t.category_id ? (catMap[t.category_id] || '') : '',
        t.transfer_to_account_id ? (accMap[t.transfer_to_account_id] || '') : '',
        (t.note || '').replace(/"/g, '""'),
        (t.tags || []).join('; '),
      ])
      const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
      const res = new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="finmate-transactions-${Date.now()}.csv"`,
        },
      })
      return handleCORS(res)
    }

    return handleCORS(NextResponse.json({ error: `Route ${route} not found` }, { status: 404 }))
  } catch (error) {
    console.error('API Error:', error)
    return handleCORS(NextResponse.json({ error: 'Internal server error', detail: error.message }, { status: 500 }))
  }
}

export const GET = handleRoute
export const POST = handleRoute
export const PUT = handleRoute
export const DELETE = handleRoute
export const PATCH = handleRoute
