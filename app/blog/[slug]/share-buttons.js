'use client'
import { useEffect, useState } from 'react'
import { Copy } from 'lucide-react'

export default function ClientShare({ title, slug }) {
  const [url, setUrl] = useState('')
  useEffect(() => { setUrl(window.location.href) }, [])
  const share = (platform) => {
    const enc = encodeURIComponent(url)
    const text = encodeURIComponent(title)
    const map = {
      whatsapp: `https://wa.me/?text=${text}%20${enc}`,
      twitter: `https://twitter.com/intent/tweet?url=${enc}&text=${text}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc}`,
    }
    window.open(map[platform], '_blank')
  }
  const copy = async () => {
    await navigator.clipboard.writeText(url)
    alert('Link disalin!')
  }
  return (
    <div className="flex gap-2">
      <button onClick={() => share('whatsapp')} className="px-3 py-1.5 rounded-lg border text-sm hover:bg-emerald-50">WhatsApp</button>
      <button onClick={() => share('twitter')} className="px-3 py-1.5 rounded-lg border text-sm hover:bg-emerald-50">X / Twitter</button>
      <button onClick={() => share('facebook')} className="px-3 py-1.5 rounded-lg border text-sm hover:bg-emerald-50">Facebook</button>
      <button onClick={copy} className="px-3 py-1.5 rounded-lg border text-sm hover:bg-emerald-50 inline-flex items-center gap-1"><Copy className="h-3 w-3" />Copy</button>
    </div>
  )
}
