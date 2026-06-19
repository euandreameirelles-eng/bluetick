const WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Verifica se a janela de 24h do WhatsApp está aberta.
 * A janela abre quando o cliente envia uma mensagem e expira 24h depois.
 */
export function isWindowOpen(lastCustomerMessageAt: string | null): boolean {
  if (!lastCustomerMessageAt) return false
  const elapsed = Date.now() - new Date(lastCustomerMessageAt).getTime()
  return elapsed < WINDOW_MS
}

/**
 * Retorna quantos milissegundos restam na janela de 24h.
 * Retorna 0 se a janela estiver fechada ou nunca tiver sido aberta.
 */
export function getWindowRemainingMs(lastCustomerMessageAt: string | null): number {
  if (!lastCustomerMessageAt) return 0
  const elapsed = Date.now() - new Date(lastCustomerMessageAt).getTime()
  return Math.max(0, WINDOW_MS - elapsed)
}
