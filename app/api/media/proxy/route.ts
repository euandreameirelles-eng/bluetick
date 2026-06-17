import { NextRequest, NextResponse } from 'next/server'
import { requireSessionOrApiKey } from '@/lib/request-auth'
import { getWhatsAppCredentials } from '@/lib/whatsapp-credentials'

export const dynamic = 'force-dynamic'

const ALLOWED_HOSTS = ['lookaside.fbsbx.com', 'mmg.whatsapp.net', 'cdn.whatsapp.net']
const MAX_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB

export async function GET(request: NextRequest) {
  const auth = await requireSessionOrApiKey(request)
  if (auth) return auth

  const url = request.nextUrl.searchParams.get('url')
  if (!url) {
    return NextResponse.json({ error: 'Parâmetro url ausente' }, { status: 400 })
  }

  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return NextResponse.json({ error: 'URL inválida' }, { status: 400 })
  }

  // Aceita apenas domínios da Meta para evitar uso indevido do proxy
  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return NextResponse.json({ error: 'Host não permitido' }, { status: 403 })
  }

  const credentials = await getWhatsAppCredentials()
  if (!credentials?.accessToken) {
    return NextResponse.json({ error: 'Credenciais do WhatsApp não configuradas' }, { status: 500 })
  }

  let metaResponse: Response
  try {
    metaResponse = await fetch(url, {
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
    })
  } catch {
    return NextResponse.json({ error: 'Falha ao buscar mídia na Meta' }, { status: 502 })
  }

  if (!metaResponse.ok) {
    let metaBody: unknown = null
    try { metaBody = await metaResponse.json() } catch { /* ignora */ }
    return NextResponse.json(
      { error: 'Meta retornou erro', status: metaResponse.status, detail: metaBody },
      { status: metaResponse.status }
    )
  }

  const contentType = metaResponse.headers.get('content-type') || 'application/octet-stream'
  const contentLength = metaResponse.headers.get('content-length')

  if (contentLength && parseInt(contentLength) > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Arquivo muito grande (máx 20 MB)' }, { status: 413 })
  }

  const buffer = await metaResponse.arrayBuffer()

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
