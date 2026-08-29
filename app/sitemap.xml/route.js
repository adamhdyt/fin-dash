import { MongoClient } from 'mongodb'

async function getPublishedSlugs() {
  const client = new MongoClient(process.env.MONGO_URL)
  try {
    await client.connect()
    const db = client.db(process.env.DB_NAME)
    return await db.collection('blog_posts').find({ status: 'published' }, { projection: { slug: 1, updated_at: 1, published_at: 1 } }).toArray()
  } finally {
    await client.close()
  }
}

export async function GET() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || ''
  const posts = await getPublishedSlugs().catch(() => [])
  const urls = [
    { loc: `${base}/`, priority: '1.0' },
    { loc: `${base}/blog`, priority: '0.8' },
    ...posts.map((p) => ({ loc: `${base}/blog/${p.slug}`, priority: '0.7', lastmod: (p.updated_at || p.published_at) ? new Date(p.updated_at || p.published_at).toISOString() : undefined })),
  ]
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}<priority>${u.priority}</priority></url>`).join('\n')}\n</urlset>`
  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
}
