import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Clock, Share2 } from 'lucide-react'
import ClientShare from './share-buttons'

async function fetchPost(slug) {
  const base = process.env.NEXT_PUBLIC_BASE_URL || ''
  try {
    const res = await fetch(`${base}/api/blog/posts/${slug}`, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    return null
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params
  const data = await fetchPost(slug)
  if (!data?.post) return { title: 'Artikel tidak ditemukan' }
  const p = data.post
  return {
    title: p.meta_title || p.title,
    description: p.meta_description || p.excerpt,
    openGraph: {
      title: p.meta_title || p.title,
      description: p.meta_description || p.excerpt,
      images: p.og_image || p.cover_image ? [p.og_image || p.cover_image] : [],
    },
  }
}

export default async function BlogDetailPage({ params }) {
  const { slug } = await params
  const data = await fetchPost(slug)
  if (!data?.post) notFound()
  const { post, related = [] } = data

  const publishedDate = post.published_at ? new Date(post.published_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : null

  return (
    <div className="min-h-screen bg-background">
      <nav className="container mx-auto flex items-center justify-between py-6 px-4 border-b">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white font-bold">F</div>
          <span className="font-bold text-xl">FinMate</span>
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/blog" className="font-medium">Blog</Link>
          <Link href="/register" className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg">Daftar Gratis</Link>
        </div>
      </nav>

      <article className="container mx-auto px-4 py-10 max-w-3xl">
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" />Kembali ke Blog
        </Link>
        <div className="text-sm text-emerald-600 font-medium mb-3">{post.category}</div>
        <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4">{post.title}</h1>
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-8">
          <span>Oleh <b className="text-foreground">{post.author_name}</b></span>
          {publishedDate && <span>{publishedDate}</span>}
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{post.reading_time_minutes} menit baca</span>
        </div>
        {post.cover_image && (
          <div className="aspect-video rounded-2xl overflow-hidden mb-10 bg-muted">
            <img src={post.cover_image} alt={post.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="prose prose-lg max-w-none dark:prose-invert prose-headings:font-bold prose-a:text-emerald-600 prose-headings:mt-8 prose-headings:mb-4"
          dangerouslySetInnerHTML={{ __html: renderContent(post.content) }} />

        {post.tags && post.tags.length > 0 && (
          <div className="mt-10 pt-6 border-t flex flex-wrap gap-2">
            {post.tags.map((t) => (
              <span key={t} className="text-xs bg-muted px-3 py-1 rounded-full">#{t}</span>
            ))}
          </div>
        )}

        <div className="mt-10 pt-6 border-t flex items-center gap-3">
          <span className="text-sm text-muted-foreground inline-flex items-center gap-2"><Share2 className="h-4 w-4" />Bagikan:</span>
          <ShareLinks title={post.title} slug={slug} />
        </div>

        {related.length > 0 && (
          <div className="mt-16">
            <h3 className="text-2xl font-bold mb-6">Artikel Terkait</h3>
            <div className="grid gap-4 md:grid-cols-3">
              {related.map((p) => (
                <Link key={p.id} href={`/blog/${p.slug}`} className="group rounded-xl border overflow-hidden bg-card hover:shadow-md transition">
                  <div className="p-4">
                    <div className="text-xs text-emerald-600 font-medium mb-1">{p.category}</div>
                    <p className="font-semibold line-clamp-2 group-hover:text-emerald-600">{p.title}</p>
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{p.excerpt}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-16 rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 text-white p-8 text-center">
          <h3 className="text-2xl font-bold">Siap membenahi keuangan Anda?</h3>
          <p className="mt-2 text-emerald-50">Coba FinMate gratis — catat pemasukan, budget, dan pantau saldo dalam 1 dashboard.</p>
          <Link href="/register" className="mt-6 inline-block bg-white text-emerald-700 hover:bg-emerald-50 px-6 py-2.5 rounded-lg font-medium">Daftar Gratis</Link>
        </div>
      </article>
    </div>
  )
}

function renderContent(content) {
  if (!content) return ''
  // If content is HTML (contains tags), return as-is
  if (/<[a-z][\s\S]*>/i.test(content)) return content
  // Otherwise treat as markdown-lite: convert simple patterns
  let html = content
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>')
  // Wrap in paragraphs
  html = html.split(/\n\n+/).map((para) => {
    if (/^<(h1|h2|h3|ul|ol|blockquote)/.test(para.trim())) return para
    return `<p>${para.replace(/\n/g, '<br/>')}</p>`
  }).join('\n')
  return html
}

function ShareLinks({ title, slug }) {
  return (
    <ClientShare title={title} slug={slug} />
  )
}
