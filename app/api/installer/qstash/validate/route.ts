import { NextRequest, NextResponse } from 'next/server';

const REGION_ENDPOINTS: Record<string, string> = {
  'us-east-1': 'https://qstash-us-east-1.upstash.io',
  'eu-central-1': 'https://qstash-eu-central-1.upstash.io',
};

const ALL_ENDPOINTS = Object.values(REGION_ENDPOINTS);

async function tryValidate(baseUrl: string, token: string) {
  const res = await fetch(`${baseUrl}/v2/schedules`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.text().catch(() => '');
  return { res, body };
}

/**
 * POST /api/installer/qstash/validate
 *
 * Valida o token do QStash fazendo uma request à API.
 * Suporta todas as regiões do Upstash (us-east-1, eu-central-1).
 * Usado no step 4 do wizard de instalação.
 */
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'Token QStash é obrigatório' },
        { status: 400 }
      );
    }

    // Tenta detectar o endpoint correto a partir do JWT (campo iss)
    let detectedUrl: string | null = null;
    try {
      const payloadB64 = token.split('.')[1];
      if (payloadB64) {
        const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
        if (payload.iss && typeof payload.iss === 'string') {
          detectedUrl = payload.iss.replace(/\/$/, '');
        }
      }
    } catch {
      // JWT indecodificável: tenta todos os endpoints
    }

    // Ordena os endpoints: o detectado primeiro, depois os demais
    const endpointsToTry = detectedUrl
      ? [detectedUrl, ...ALL_ENDPOINTS.filter(u => u !== detectedUrl)]
      : ALL_ENDPOINTS;

    for (const baseUrl of endpointsToTry) {
      const { res, body } = await tryValidate(baseUrl, token);

      if (res.ok) {
        return NextResponse.json({ valid: true, message: 'Token QStash válido' });
      }

      // Se a API indicar que o token pertence a outra região, tenta a próxima
      if (body.includes('not found in this region')) {
        continue;
      }

      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          { error: 'Token QStash inválido. Verifique se copiou o token correto no painel do Upstash.' },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: `Erro ao validar token: ${body || res.statusText}` },
        { status: res.status }
      );
    }

    return NextResponse.json(
      { error: 'Token QStash não reconhecido em nenhuma região disponível (us-east-1, eu-central-1).' },
      { status: 401 }
    );

  } catch (error) {
    console.error('[installer/qstash/validate] Erro:', error);
    return NextResponse.json(
      { error: 'Erro interno ao validar token' },
      { status: 500 }
    );
  }
}
