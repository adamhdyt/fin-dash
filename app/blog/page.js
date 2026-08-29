import Link from 'next/link'
import { Search } from 'lucide-react'

async function fetchPosts(searchParams) {
  const params = new URLSearchParams()
  if (searchParams?.page) params.set('page', searchParams.page)
  if (searchParams?.category) params.set('category', searchParams.category)
  if (searchParams?.search) params.set('search', searchParams.search)
  const base = process.env.NEXT_PUBLIC_BASE_URL || ''
  try {
    const res = await fetch(`${base}/api/blog/posts?${params.toString()}`, { cache: 'no-store' })
    return await res.json()
  } catch (e) {
    return { posts: [], categories: [], total: 0, totalPages: 0, page: 1 }
  }
}

export const metadata = {
  title: 'Blog FinMate — Tips & Panduan Keuangan Pribadi',
  description: 'Artikel, tips, dan panduan mengelola keuangan pribadi ala FinMate. Belajar budgeting, menabung, investasi, dan bebas dari utang.',
}

export default async function BlogListPage({ searchParams }) {
  const sp = await searchParams
  const data = await fetchPosts(sp)
  const { posts = [], categories = [], total = 0, totalPages = 0, page = 1 } = data
  const activeCategory = sp?.category
  const activeSearch = sp?.search || ''

  return (
    <div className="min-h-screen bg-background">
      <nav className="container mx-auto flex items-center justify-between py-6 px-4 border-b">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold">F</div>
          <span className="font-bold text-xl">FinMate</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/blog" className="font-medium">Blog</Link>
          <Link href="/login" className="text-muted-foreground hover:text-foreground">Masuk</Link>
          <Link href="/register" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg">Daftar Gratis</Link>
        </div>
      </nav>

      <header className="container mx-auto px-4 py-12 md:py-16 text-center">
        <h1 className="text-4xl md:text-5xl font-bold">Blog FinMate</h1>
        <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">Tips, panduan, dan wawasan untuk kelola keuangan pribadi lebih rapi.</p>
      </header>

      <div className="container mx-auto px-4 pb-16 max-w-6xl">
        {/* Search + categories */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-8">
          <form className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input name="search" defaultValue={activeSearch} placeholder="Cari artikel..." className="w-full pl-9 pr-4 py-2.5 rounded-lg border bg-card" />
          </form>
          <div className="flex gap-2 flex-wrap">
            <Link href="/blog" className={`px-3 py-1.5 rounded-full text-sm border ${!activeCategory ? 'bg-emerald-600 text-white border-transparent' : 'hover:bg-muted'}`}>Semua</Link>
            {categories.map((c) => (
              <Link key={c} href={`/blog?category=${encodeURIComponent(c)}`} className={`px-3 py-1.5 rounded-full text-sm border ${activeCategory === c ? 'bg-emerald-600 text-white border-transparent' : 'hover:bg-muted'}`}>{c}</Link>
            ))}
          </div>
        </div>

        {posts.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground">Belum ada artikel dipublikasikan.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((p) => (
              <Link key={p.id} href={`/blog/${p.slug}`} className="group rounded-2xl border overflow-hidden bg-card hover:shadow-lg transition-shadow">
                {p.cover_image ? (
                  <div className="aspect-video bg-muted overflow-hidden">
                    <img src={p.cover_image} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  </div>
                ) : (
                  <div className="aspect-video bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white text-4xl font-bold">
                    {p.title[0]}
                  </div>
                )}
                <div className="p-5">
                  <div className="text-xs text-emerald-600 font-medium mb-2">{p.category}</div>
                  <h2 className="font-bold text-lg mb-2 line-clamp-2 group-hover:text-emerald-600 transition">{p.title}</h2>
                  <p className="text-sm text-muted-foreground line-clamp-3">{p.excerpt}</p>
                  <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{p.author_name}</span>
                    <span>{p.reading_time_minutes} menit baca</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-10">
            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1
              const params = new URLSearchParams()
              params.set('page', String(p))
              if (activeCategory) params.set('category', activeCategory)
              if (activeSearch) params.set('search', activeSearch)
              return (
                <Link key={p} href={`/blog?${params.toString()}`} className={`px-4 py-2 rounded-lg border text-sm ${page === p ? 'bg-emerald-600 text-white border-transparent' : 'hover:bg-muted'}`}>{p}</Link>
              )
            })}
          </div>
        )}
      </div>

      <footer className="border-t container mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
        © 2025 FinMate. Blog untuk edukasi keuangan pribadi.
      </footer>
    </div>
  )
}
