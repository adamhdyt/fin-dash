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

    // ============ PUBLIC BLOG ENDPOINTS (no auth) ============
    if (route === '/blog/posts' && method === 'GET') {
      const url = new URL(request.url)
      const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
      const perPage = 10
      const category = url.searchParams.get('category')
      const search = url.searchParams.get('search')
      const filter = { status: 'published' }
      if (category) filter.category = category
      if (search) filter.title = { $regex: search, $options: 'i' }
      const total = await db.collection('blog_posts').countDocuments(filter)
      const posts = await db.collection('blog_posts').find(filter)
        .sort({ published_at: -1 })
        .skip((page - 1) * perPage).limit(perPage).toArray()
      // Also get all unique categories
      const categories = await db.collection('blog_posts').distinct('category', { status: 'published' })
      return handleCORS(NextResponse.json({
        posts: posts.map(stripId), page, perPage, total,
        totalPages: Math.ceil(total / perPage), categories,
      }))
    }

    const publicBlogSlugMatch = route.match(/^\/blog\/posts\/([^/]+)$/)
    if (publicBlogSlugMatch && method === 'GET') {
      const slug = publicBlogSlugMatch[1]
      const post = await db.collection('blog_posts').findOne({ slug, status: 'published' })
      if (!post) return handleCORS(NextResponse.json({ error: 'Post tidak ditemukan' }, { status: 404 }))
      const related = await db.collection('blog_posts').find({
        status: 'published', category: post.category, _id: { $ne: post._id }
      }).sort({ published_at: -1 }).limit(3).toArray()
      return handleCORS(NextResponse.json({ post: stripId(post), related: related.map(stripId) }))
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

    // ============ IMPORT CSV ============
    // POST /api/import/transactions
    // Body: { rows: [{date, amount, type, category_name, account_name, note, tags}], default_account_id, default_category_id_expense, default_category_id_income, commit: bool }
    if (route === '/import/transactions' && method === 'POST') {
      const body = await request.json()
      const { rows = [], default_account_id, default_category_id_expense, default_category_id_income, commit = false } = body || {}
      if (!Array.isArray(rows) || rows.length === 0) return badRequest('Rows kosong')

      const [accounts, categories] = await Promise.all([
        db.collection('accounts').find({ user_id: userId }).toArray(),
        db.collection('categories').find({ user_id: userId }).toArray(),
      ])
      const accByName = Object.fromEntries(accounts.map((a) => [a.name.toLowerCase().trim(), a._id]))
      const catByName = {}
      categories.forEach((c) => { catByName[`${c.type}::${c.name.toLowerCase().trim()}`] = c._id })

      const validAccountId = (id) => accounts.some((a) => a._id === id)
      const validCatId = (id) => categories.some((c) => c._id === id)

      if (!default_account_id || !validAccountId(default_account_id)) return badRequest('default_account_id tidak valid')
      if (default_category_id_expense && !validCatId(default_category_id_expense)) return badRequest('default_category_id_expense tidak valid')
      if (default_category_id_income && !validCatId(default_category_id_income)) return badRequest('default_category_id_income tidak valid')

      const preview = rows.map((r, idx) => {
        const errors = []
        // Type
        let type = (r.type || 'expense').toString().toLowerCase().trim()
        if (!['income', 'expense'].includes(type)) type = 'expense'

        // Amount
        const rawAmount = String(r.amount ?? '').replace(/[^\d.-]/g, '')
        const amount = Number(rawAmount)
        if (!amount || amount <= 0 || isNaN(amount)) errors.push('Jumlah tidak valid')

        // Date
        let date = null
        if (r.date) {
          const d = new Date(r.date)
          if (!isNaN(d.getTime())) date = d
        }
        if (!date) errors.push('Tanggal tidak valid')

        // Account resolution
        let account_id = default_account_id
        if (r.account_name) {
          const found = accByName[String(r.account_name).toLowerCase().trim()]
          if (found) account_id = found
        }

        // Category resolution
        let category_id = null
        if (r.category_name) {
          const key = `${type}::${String(r.category_name).toLowerCase().trim()}`
          if (catByName[key]) category_id = catByName[key]
        }
        if (!category_id) {
          category_id = type === 'income' ? default_category_id_income : default_category_id_expense
        }
        if (!category_id) errors.push('Kategori tidak dapat di-resolve (set fallback)')

        return {
          index: idx + 1,
          valid: errors.length === 0,
          errors,
          resolved: {
            type, amount, date, account_id, category_id,
            note: r.note || '',
            tags: r.tags ? String(r.tags).split(/[;,]/).map((t) => t.trim()).filter(Boolean) : [],
          },
          raw: r,
        }
      })

      const summary = {
        total: preview.length,
        valid: preview.filter((p) => p.valid).length,
        invalid: preview.filter((p) => !p.valid).length,
      }

      if (commit) {
        const toInsert = preview.filter((p) => p.valid).map((p) => ({
          _id: uuidv4(),
          user_id: userId,
          type: p.resolved.type,
          amount: p.resolved.amount,
          account_id: p.resolved.account_id,
          category_id: p.resolved.category_id,
          transfer_to_account_id: null,
          date: p.resolved.date,
          note: p.resolved.note,
          tags: p.resolved.tags,
          created_at: new Date(),
        }))
        if (toInsert.length > 0) await db.collection('transactions').insertMany(toInsert)
        summary.inserted = toInsert.length
      }

      // Slim preview for response
      const previewOut = preview.map((p) => ({
        index: p.index,
        valid: p.valid,
        errors: p.errors,
        resolved: p.valid ? {
          type: p.resolved.type,
          amount: p.resolved.amount,
          date: p.resolved.date,
          account_id: p.resolved.account_id,
          category_id: p.resolved.category_id,
          note: p.resolved.note,
          tags: p.resolved.tags,
        } : null,
        raw: p.raw,
      }))

      return handleCORS(NextResponse.json({ preview: previewOut, summary }))
    }

    // ============ GOALS ============
    // Schema: { _id, user_id, name, target_amount, current_amount, target_date, icon, created_at }
    if (route === '/goals' && method === 'GET') {
      const goals = await db.collection('goals').find({ user_id: userId }).sort({ created_at: -1 }).toArray()
      const enriched = goals.map((g) => {
        const percent = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0
        const remaining = Math.max(0, g.target_amount - g.current_amount)
        let projectionMonths = null
        let projectionDate = null
        // Estimate months to target based on average monthly saving
        // Simple heuristic: if created_at + current_amount>0, monthly_avg = current_amount / months_since_created
        if (g.current_amount > 0 && remaining > 0) {
          const created = new Date(g.created_at)
          const now = new Date()
          const monthsPassed = Math.max(1, (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth()) + (now.getDate() >= created.getDate() ? 1 : 0))
          const monthlyAvg = g.current_amount / monthsPassed
          if (monthlyAvg > 0) {
            projectionMonths = Math.ceil(remaining / monthlyAvg)
            projectionDate = new Date(now.getFullYear(), now.getMonth() + projectionMonths, 1)
          }
        }
        return {
          ...stripId(g),
          percent,
          remaining,
          projection_months: projectionMonths,
          projection_date: projectionDate,
        }
      })
      return handleCORS(NextResponse.json({ goals: enriched }))
    }

    if (route === '/goals' && method === 'POST') {
      const body = await request.json()
      const { name, target_amount, current_amount, target_date, icon } = body || {}
      if (!name || !target_amount) return badRequest('name & target_amount wajib diisi')
      const goal = {
        _id: uuidv4(),
        user_id: userId,
        name,
        target_amount: Number(target_amount),
        current_amount: Number(current_amount) || 0,
        target_date: target_date ? new Date(target_date) : null,
        icon: icon || '🎯',
        created_at: new Date(),
      }
      await db.collection('goals').insertOne(goal)
      return handleCORS(NextResponse.json({ goal: stripId(goal) }))
    }

    const goalMatch = route.match(/^\/goals\/([^/]+)$/)
    if (goalMatch) {
      const id = goalMatch[1]
      if (method === 'PUT') {
        const body = await request.json()
        const update = {}
        ;['name', 'icon'].forEach((k) => { if (body[k] !== undefined) update[k] = body[k] })
        if (body.target_amount !== undefined) update.target_amount = Number(body.target_amount)
        if (body.current_amount !== undefined) update.current_amount = Number(body.current_amount)
        if (body.target_date !== undefined) update.target_date = body.target_date ? new Date(body.target_date) : null
        await db.collection('goals').updateOne({ _id: id, user_id: userId }, { $set: update })
        return handleCORS(NextResponse.json({ ok: true }))
      }
      if (method === 'DELETE') {
        await db.collection('goals').deleteOne({ _id: id, user_id: userId })
        return handleCORS(NextResponse.json({ ok: true }))
      }
    }

    const goalContribMatch = route.match(/^\/goals\/([^/]+)\/contribute$/)
    if (goalContribMatch && method === 'POST') {
      const id = goalContribMatch[1]
      const body = await request.json()
      const amount = Number(body.amount)
      if (!amount) return badRequest('amount wajib diisi')
      const goal = await db.collection('goals').findOne({ _id: id, user_id: userId })
      if (!goal) return badRequest('Goal tidak ditemukan')
      await db.collection('goals').updateOne({ _id: id, user_id: userId }, { $inc: { current_amount: amount } })
      return handleCORS(NextResponse.json({ ok: true, current_amount: (goal.current_amount || 0) + amount }))
    }

    // ============ RECURRING TRANSACTIONS ============
    // Schema: { _id, user_id, name, type, amount, account_id, category_id, frequency (daily|weekly|monthly|yearly), start_date, next_date, end_date?, active, created_at }
    const advanceDate = (date, frequency) => {
      const d = new Date(date)
      if (frequency === 'daily') d.setDate(d.getDate() + 1)
      else if (frequency === 'weekly') d.setDate(d.getDate() + 7)
      else if (frequency === 'monthly') d.setMonth(d.getMonth() + 1)
      else if (frequency === 'yearly') d.setFullYear(d.getFullYear() + 1)
      return d
    }

    const materializeRecurring = async () => {
      const now = new Date()
      const dueList = await db.collection('recurring').find({
        user_id: userId, active: true, next_date: { $lte: now }
      }).toArray()
      for (const r of dueList) {
        let next = new Date(r.next_date)
        const created = []
        // safety limit: max 60 generations per call to avoid runaway
        let count = 0
        while (next <= now && count < 60) {
          if (r.end_date && next > new Date(r.end_date)) break
          created.push({
            _id: uuidv4(),
            user_id: userId,
            type: r.type,
            amount: r.amount,
            account_id: r.account_id,
            category_id: r.category_id,
            transfer_to_account_id: null,
            date: new Date(next),
            note: r.note || `Recurring: ${r.name}`,
            tags: ['recurring'],
            recurring_id: r._id,
            created_at: new Date(),
          })
          next = advanceDate(next, r.frequency)
          count++
        }
        if (created.length > 0) await db.collection('transactions').insertMany(created)
        const shouldDeactivate = r.end_date && next > new Date(r.end_date)
        await db.collection('recurring').updateOne(
          { _id: r._id },
          { $set: { next_date: next, ...(shouldDeactivate ? { active: false } : {}) } }
        )
      }
    }

    if (route === '/recurring' && method === 'GET') {
      await materializeRecurring()
      const items = await db.collection('recurring').find({ user_id: userId }).sort({ created_at: -1 }).toArray()
      return handleCORS(NextResponse.json({ recurring: items.map(stripId) }))
    }
    if (route === '/recurring' && method === 'POST') {
      const body = await request.json()
      const { name, type, amount, account_id, category_id, frequency, start_date, end_date, note } = body || {}
      if (!name || !type || !amount || !account_id || !category_id || !frequency || !start_date) return badRequest('Field wajib tidak lengkap')
      if (!['daily', 'weekly', 'monthly', 'yearly'].includes(frequency)) return badRequest('frequency invalid')
      if (!['income', 'expense'].includes(type)) return badRequest('type invalid')
      const r = {
        _id: uuidv4(), user_id: userId, name, type, amount: Number(amount),
        account_id, category_id, frequency,
        start_date: new Date(start_date), next_date: new Date(start_date),
        end_date: end_date ? new Date(end_date) : null,
        note: note || '', active: true, created_at: new Date(),
      }
      await db.collection('recurring').insertOne(r)
      // materialize immediately if start_date <= today
      await materializeRecurring()
      return handleCORS(NextResponse.json({ recurring: stripId(r) }))
    }
    const recMatch = route.match(/^\/recurring\/([^/]+)$/)
    if (recMatch) {
      const id = recMatch[1]
      if (method === 'PUT') {
        const body = await request.json()
        const update = {}
        ;['name', 'type', 'account_id', 'category_id', 'frequency', 'note', 'active'].forEach((k) => {
          if (body[k] !== undefined) update[k] = body[k]
        })
        if (body.amount !== undefined) update.amount = Number(body.amount)
        if (body.end_date !== undefined) update.end_date = body.end_date ? new Date(body.end_date) : null
        await db.collection('recurring').updateOne({ _id: id, user_id: userId }, { $set: update })
        return handleCORS(NextResponse.json({ ok: true }))
      }
      if (method === 'DELETE') {
        await db.collection('recurring').deleteOne({ _id: id, user_id: userId })
        return handleCORS(NextResponse.json({ ok: true }))
      }
    }

    // ============ DEBTS (Utang & Piutang) ============
    // Schema: { _id, user_id, kind (debt|receivable), name, party_name, amount_total, amount_paid, due_date?, interest_rate?, note, created_at }
    if (route === '/debts' && method === 'GET') {
      const items = await db.collection('debts').find({ user_id: userId }).sort({ created_at: -1 }).toArray()
      const enriched = items.map((d) => {
        const remaining = Math.max(0, (d.amount_total || 0) - (d.amount_paid || 0))
        const percent = d.amount_total > 0 ? Math.min(100, Math.round((d.amount_paid / d.amount_total) * 100)) : 0
        return { ...stripId(d), remaining, percent, is_paid: remaining === 0 }
      })
      return handleCORS(NextResponse.json({ debts: enriched }))
    }
    if (route === '/debts' && method === 'POST') {
      const body = await request.json()
      const { kind, name, party_name, amount_total, amount_paid, due_date, interest_rate, note } = body || {}
      if (!kind || !name || !amount_total) return badRequest('kind, name, amount_total wajib diisi')
      if (!['debt', 'receivable'].includes(kind)) return badRequest('kind invalid')
      const d = {
        _id: uuidv4(), user_id: userId, kind, name,
        party_name: party_name || '',
        amount_total: Number(amount_total),
        amount_paid: Number(amount_paid) || 0,
        due_date: due_date ? new Date(due_date) : null,
        interest_rate: interest_rate ? Number(interest_rate) : null,
        note: note || '', created_at: new Date(),
      }
      await db.collection('debts').insertOne(d)
      return handleCORS(NextResponse.json({ debt: stripId(d) }))
    }
    const debtMatch = route.match(/^\/debts\/([^/]+)$/)
    if (debtMatch) {
      const id = debtMatch[1]
      if (method === 'PUT') {
        const body = await request.json()
        const update = {}
        ;['kind', 'name', 'party_name', 'note'].forEach((k) => { if (body[k] !== undefined) update[k] = body[k] })
        if (body.amount_total !== undefined) update.amount_total = Number(body.amount_total)
        if (body.amount_paid !== undefined) update.amount_paid = Number(body.amount_paid)
        if (body.due_date !== undefined) update.due_date = body.due_date ? new Date(body.due_date) : null
        if (body.interest_rate !== undefined) update.interest_rate = body.interest_rate ? Number(body.interest_rate) : null
        await db.collection('debts').updateOne({ _id: id, user_id: userId }, { $set: update })
        return handleCORS(NextResponse.json({ ok: true }))
      }
      if (method === 'DELETE') {
        await db.collection('debts').deleteOne({ _id: id, user_id: userId })
        return handleCORS(NextResponse.json({ ok: true }))
      }
    }
    const debtPayMatch = route.match(/^\/debts\/([^/]+)\/pay$/)
    if (debtPayMatch && method === 'POST') {
      const id = debtPayMatch[1]
      const body = await request.json()
      const amount = Number(body.amount)
      if (!amount || amount <= 0) return badRequest('amount wajib > 0')
      const d = await db.collection('debts').findOne({ _id: id, user_id: userId })
      if (!d) return badRequest('Tidak ditemukan')
      await db.collection('debts').updateOne({ _id: id, user_id: userId }, { $inc: { amount_paid: amount } })
      return handleCORS(NextResponse.json({ ok: true, amount_paid: (d.amount_paid || 0) + amount }))
    }

    // ============ REPORTS ============
    // GET /api/reports/net-worth?months=12
    if (route === '/reports/net-worth' && method === 'GET') {
      const url = new URL(request.url)
      const months = Math.min(parseInt(url.searchParams.get('months') || '12'), 24)
      const now = new Date()
      const accounts = await db.collection('accounts').find({ user_id: userId }).toArray()
      const debts = await db.collection('debts').find({ user_id: userId, kind: 'debt' }).toArray()
      // Compute for each month-end going back
      const result = []
      for (let i = months - 1; i >= 0; i--) {
        const endDate = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999)
        // assets = sum of account initial_balance + sum of income/transferIn - expense/transferOut where date <= endDate
        const trxAgg = await db.collection('transactions').aggregate([
          { $match: { user_id: userId, date: { $lte: endDate } } },
          {
            $group: {
              _id: '$account_id',
              income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
              expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
              transferOut: { $sum: { $cond: [{ $eq: ['$type', 'transfer'] }, '$amount', 0] } },
            },
          },
        ]).toArray()
        const transferInAgg = await db.collection('transactions').aggregate([
          { $match: { user_id: userId, date: { $lte: endDate }, type: 'transfer' } },
          { $group: { _id: '$transfer_to_account_id', transferIn: { $sum: '$amount' } } },
        ]).toArray()
        const trxMap = Object.fromEntries(trxAgg.map((r) => [r._id, r]))
        const trxInMap = Object.fromEntries(transferInAgg.map((r) => [r._id, r.transferIn]))
        let assets = 0
        for (const a of accounts) {
          if (new Date(a.created_at) > endDate) continue
          const t = trxMap[a._id] || { income: 0, expense: 0, transferOut: 0 }
          const ti = trxInMap[a._id] || 0
          assets += (a.initial_balance || 0) + t.income - t.expense - t.transferOut + ti
        }
        // liabilities = sum of unpaid debts existing at endDate (approx: created_at <= endDate)
        const liabilities = debts
          .filter((d) => new Date(d.created_at) <= endDate)
          .reduce((s, d) => s + Math.max(0, (d.amount_total || 0) - (d.amount_paid || 0)), 0)
        result.push({
          label: endDate.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }),
          assets, liabilities, net_worth: assets - liabilities,
        })
      }
      return handleCORS(NextResponse.json({ series: result }))
    }

    // GET /api/reports/cash-flow?year=2025
    if (route === '/reports/cash-flow' && method === 'GET') {
      const url = new URL(request.url)
      const year = parseInt(url.searchParams.get('year') || String(new Date().getFullYear()))
      const start = new Date(year, 0, 1)
      const end = new Date(year, 11, 31, 23, 59, 59, 999)
      const agg = await db.collection('transactions').aggregate([
        { $match: { user_id: userId, date: { $gte: start, $lte: end }, type: { $in: ['income', 'expense'] } } },
        {
          $group: {
            _id: { m: { $month: '$date' }, t: '$type' },
            total: { $sum: '$amount' },
          },
        },
      ]).toArray()
      const months = []
      for (let m = 1; m <= 12; m++) {
        const label = new Date(year, m - 1, 1).toLocaleDateString('id-ID', { month: 'short' })
        months.push({ month: m, label, income: 0, expense: 0, net: 0 })
      }
      agg.forEach((r) => {
        const idx = r._id.m - 1
        months[idx][r._id.t] = r.total
      })
      months.forEach((mo) => { mo.net = mo.income - mo.expense })
      const totalIncome = months.reduce((s, m) => s + m.income, 0)
      const totalExpense = months.reduce((s, m) => s + m.expense, 0)
      return handleCORS(NextResponse.json({
        year, months,
        summary: { total_income: totalIncome, total_expense: totalExpense, net: totalIncome - totalExpense },
      }))
    }

    // ============ ADMIN ============
    const isAdmin = auth.role === 'admin'
    // Claim admin: if no admin exists yet, promote current user (bootstrap)
    if (route === '/admin/claim' && method === 'POST') {
      const existingAdmin = await db.collection('users').findOne({ role: 'admin' })
      if (existingAdmin && existingAdmin._id !== userId) {
        return handleCORS(NextResponse.json({ error: 'Admin sudah ada' }, { status: 403 }))
      }
      await db.collection('users').updateOne({ _id: userId }, { $set: { role: 'admin' } })
      const user = await db.collection('users').findOne({ _id: userId })
      const { password_hash: _, ...safe } = user
      const token = signToken(user)
      return handleCORS(NextResponse.json({ ok: true, token, user: stripId(safe) }))
    }

    if (!isAdmin && route.startsWith('/admin')) {
      return handleCORS(NextResponse.json({ error: 'Admin only' }, { status: 403 }))
    }

    // Admin: list all posts (incl. drafts)
    if (route === '/admin/blog/posts' && method === 'GET') {
      const posts = await db.collection('blog_posts').find({}).sort({ created_at: -1 }).toArray()
      return handleCORS(NextResponse.json({ posts: posts.map(stripId) }))
    }
    if (route === '/admin/blog/posts' && method === 'POST') {
      const body = await request.json()
      const { title, slug, excerpt, meta_title, meta_description, og_image, cover_image, content, category, tags, status } = body || {}
      if (!title || !content) return badRequest('title & content wajib diisi')
      const generateSlug = (s) => s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').slice(0, 80)
      const finalSlug = slug ? generateSlug(slug) : generateSlug(title)
      // ensure unique
      const dup = await db.collection('blog_posts').findOne({ slug: finalSlug })
      if (dup) return badRequest('Slug sudah dipakai, gunakan slug lain')
      const wordCount = String(content).split(/\s+/).length
      const readingTime = Math.max(1, Math.round(wordCount / 200))
      const user = await db.collection('users').findOne({ _id: userId })
      const post = {
        _id: uuidv4(),
        title, slug: finalSlug,
        excerpt: excerpt || String(content).replace(/<[^>]*>/g, '').slice(0, 180) + '...',
        meta_title: meta_title || title,
        meta_description: meta_description || excerpt || '',
        og_image: og_image || cover_image || null,
        cover_image: cover_image || null,
        content, category: category || 'Umum',
        tags: Array.isArray(tags) ? tags : [],
        status: status || 'draft',
        author_id: userId, author_name: user?.name || 'Admin',
        reading_time_minutes: readingTime,
        published_at: status === 'published' ? new Date() : null,
        created_at: new Date(), updated_at: new Date(),
      }
      await db.collection('blog_posts').insertOne(post)
      return handleCORS(NextResponse.json({ post: stripId(post) }))
    }
    const adminPostMatch = route.match(/^\/admin\/blog\/posts\/([^/]+)$/)
    if (adminPostMatch) {
      const id = adminPostMatch[1]
      if (method === 'GET') {
        const post = await db.collection('blog_posts').findOne({ _id: id })
        if (!post) return handleCORS(NextResponse.json({ error: 'Not found' }, { status: 404 }))
        return handleCORS(NextResponse.json({ post: stripId(post) }))
      }
      if (method === 'PUT') {
        const body = await request.json()
        const update = { updated_at: new Date() }
        ;['title', 'excerpt', 'meta_title', 'meta_description', 'og_image', 'cover_image', 'content', 'category'].forEach((k) => {
          if (body[k] !== undefined) update[k] = body[k]
        })
        if (body.tags !== undefined) update.tags = Array.isArray(body.tags) ? body.tags : []
        if (body.slug !== undefined) update.slug = body.slug.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-')
        if (body.status !== undefined) {
          update.status = body.status
          if (body.status === 'published') {
            const existing = await db.collection('blog_posts').findOne({ _id: id })
            if (existing && !existing.published_at) update.published_at = new Date()
          }
        }
        if (body.content !== undefined) {
          const wc = String(body.content).split(/\s+/).length
          update.reading_time_minutes = Math.max(1, Math.round(wc / 200))
        }
        await db.collection('blog_posts').updateOne({ _id: id }, { $set: update })
        return handleCORS(NextResponse.json({ ok: true }))
      }
      if (method === 'DELETE') {
        await db.collection('blog_posts').deleteOne({ _id: id })
        return handleCORS(NextResponse.json({ ok: true }))
      }
    }

    // Admin: users list
    if (route === '/admin/users' && method === 'GET') {
      const users = await db.collection('users').find({}).sort({ created_at: -1 }).toArray()
      // Get metadata: transaction counts
      const enriched = await Promise.all(users.map(async (u) => {
        const trxCount = await db.collection('transactions').countDocuments({ user_id: u._id })
        const { password_hash: _, ...safe } = u
        return { ...stripId(safe), transaction_count: trxCount }
      }))
      return handleCORS(NextResponse.json({ users: enriched }))
    }

    // Admin dashboard stats
    if (route === '/admin/stats' && method === 'GET') {
      const [totalUsers, totalTransactions, totalPosts, publishedPosts] = await Promise.all([
        db.collection('users').countDocuments({}),
        db.collection('transactions').countDocuments({}),
        db.collection('blog_posts').countDocuments({}),
        db.collection('blog_posts').countDocuments({ status: 'published' }),
      ])
      // User growth last 6 months
      const now = new Date()
      const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
      const growth = await db.collection('users').aggregate([
        { $match: { created_at: { $gte: sixAgo } } },
        { $group: { _id: { y: { $year: '$created_at' }, m: { $month: '$created_at' } }, count: { $sum: 1 } } },
      ]).toArray()
      const growthMap = {}
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${d.getMonth() + 1}`
        growthMap[key] = { label: d.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }), count: 0 }
      }
      growth.forEach((g) => {
        const key = `${g._id.y}-${g._id.m}`
        if (growthMap[key]) growthMap[key].count = g.count
      })
      return handleCORS(NextResponse.json({
        total_users: totalUsers, total_transactions: totalTransactions,
        total_posts: totalPosts, published_posts: publishedPosts,
        user_growth: Object.values(growthMap),
      }))
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
