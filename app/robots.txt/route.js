export async function GET() {
  const base = process.env.NEXT_PUBLIC_BASE_URL || ''
  const body = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /dashboard\n\nSitemap: ${base}/sitemap.xml\n`
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } })
}
