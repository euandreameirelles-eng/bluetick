'use client'

/**
 * Conversa Page - Geist Design System
 *
 * Interface de chat minimalista seguindo os princípios do Geist:
 * - Hierarquia visual clara
 * - Espaçamento consistente
 * - Cores de alto contraste
 * - Transições suaves
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Send,
  Bot,
  User,
  Loader2,
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  XCircle,
  Sparkles,
  Sun,
  Moon,
  Smile,
  MessageSquareDashed,
  Search,
  X,
} from 'lucide-react'
import EmojiPicker, { type EmojiClickData, Theme } from 'emoji-picker-react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useAttendant } from '@/components/attendant/AttendantProvider'
import { useTheme } from '../../layout'
import { toast } from 'sonner'
import { isWindowOpen } from '@/lib/inbox/window-utils'

// =============================================================================
// TYPES
// =============================================================================

interface Message {
  id: string
  conversation_id: string
  direction: 'inbound' | 'outbound'
  content: string
  message_type: string
  wa_message_id: string | null
  delivery_status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed'
  is_ai_generated: boolean
  created_at: string
}

interface Contact {
  id: string
  name: string | null
  phone: string
}

interface Conversation {
  id: string
  phone: string
  status: string
  mode: 'bot' | 'human'
  priority: string | null
  ai_agent_id: string | null
  contact?: Contact | null
  ai_agent?: { name: string } | null
  last_message_at: string
}

type ConversationStatus = 'ai_active' | 'human_active' | 'handoff_requested'

// =============================================================================
// API FUNCTIONS
// =============================================================================

interface QuickReply {
  id: string
  title: string
  content: string
  shortcut: string | null
}

type FetchFn = (url: string, options?: RequestInit) => Promise<Response>

async function fetchConversation(id: string, fetchFn: FetchFn): Promise<Conversation> {
  const res = await fetchFn(`/api/inbox/conversations/${id}`)
  if (!res.ok) throw new Error('Conversa não encontrada')
  return res.json()
}

async function fetchMessages(id: string, fetchFn: FetchFn, limit = 50): Promise<{ messages: Message[]; hasMore: boolean }> {
  const res = await fetchFn(`/api/inbox/conversations/${id}/messages?limit=${limit}`)
  if (!res.ok) throw new Error('Erro ao buscar mensagens')
  return res.json()
}

async function sendMessage(conversationId: string, content: string, fetchFn: FetchFn): Promise<Message> {
  const res = await fetchFn(`/api/inbox/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, message_type: 'text' }),
  })
  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error || 'Erro ao enviar mensagem')
  }
  return res.json()
}

async function takeoverConversation(id: string, fetchFn: FetchFn): Promise<void> {
  const res = await fetchFn(`/api/inbox/conversations/${id}/takeover`, { method: 'POST' })
  if (!res.ok) throw new Error('Erro ao assumir conversa')
}

async function returnToBot(id: string, fetchFn: FetchFn): Promise<void> {
  const res = await fetchFn(`/api/inbox/conversations/${id}/return-to-bot`, { method: 'POST' })
  if (!res.ok) throw new Error('Erro ao devolver para IA')
}

async function fetchQuickReplies(fetchFn: FetchFn): Promise<QuickReply[]> {
  try {
    const res = await fetchFn('/api/inbox/quick-replies')
    if (!res.ok) return []
    return res.json()
  } catch {
    return []
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function mapConversationStatus(conv: Conversation): ConversationStatus {
  if (conv.priority === 'urgent') return 'handoff_requested'
  if (conv.mode === 'human') return 'human_active'
  return 'ai_active'
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getInitials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// =============================================================================
// COMPONENTS
// =============================================================================

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === 'outbound'

  const StatusIcon = () => {
    switch (message.delivery_status) {
      case 'read':
        return <CheckCheck size={14} className="text-[var(--chat-status-read)]" />
      case 'delivered':
        return <CheckCheck size={14} />
      case 'sent':
        return <Check size={14} />
      case 'pending':
        return <Clock size={14} />
      case 'failed':
        return <XCircle size={14} className="text-[var(--geist-error)]" />
      default:
        return null
    }
  }

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`
          relative px-4 py-2.5 rounded-2xl
          ${isOutbound
            ? 'bg-[var(--chat-bubble-outbound)] text-[var(--chat-bubble-outbound-text)] rounded-br-sm'
            : 'bg-[var(--chat-bubble-inbound)] text-[var(--chat-bubble-inbound-text)] rounded-bl-sm border border-[var(--geist-border)]'
          }
        `}
        style={{ maxWidth: 'min(75%, 500px)' }}
      >
        {/* AI Badge */}
        {message.is_ai_generated && (
          <div className="flex items-center gap-1 mb-1.5 -mt-0.5">
            <Sparkles size={12} className="text-[var(--geist-success)]" />
            <span className="text-[10px] font-medium text-[var(--geist-success)]">IA</span>
          </div>
        )}

        {/* Content */}
        <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </p>

        {/* Footer: Time + Status */}
        <div className={`flex items-center gap-1.5 mt-1.5 ${isOutbound ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[11px] text-[var(--chat-timestamp)]">
            {formatTime(message.created_at)}
          </span>
          {isOutbound && (
            <span className="text-[var(--chat-timestamp)]">
              <StatusIcon />
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function Header({
  conversation,
  onBack,
  resolvedTheme,
  onToggleTheme,
}: {
  conversation: Conversation
  onBack: () => void
  resolvedTheme: 'light' | 'dark'
  onToggleTheme: () => void
}) {
  // Avatar color based on mode - simplified palette
  const getAvatarColor = () => {
    if (conversation.priority === 'urgent') return 'var(--geist-red)'
    if (conversation.mode === 'bot') return 'var(--geist-foreground-secondary)'
    return '#00a884' // Verde WhatsApp para modo humano
  }

  return (
    <header className="shrink-0 h-16 px-4 flex items-center gap-3 border-b border-[var(--geist-border)] bg-[var(--geist-background)]">
      <button
        onClick={onBack}
        className="p-2 -ml-2 rounded-lg hover:bg-[var(--geist-component-bg)] transition-colors"
        aria-label="Voltar"
      >
        <ArrowLeft size={20} className="text-[var(--geist-foreground-secondary)]" />
      </button>

      {/* Avatar colorido */}
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 shadow-sm"
        style={{
          backgroundColor: getAvatarColor(),
          color: '#ffffff',
        }}
      >
        {getInitials(conversation.contact?.name ?? null)}
      </div>

      <div className="flex-1 min-w-0">
        <h1 className="font-semibold text-[15px] truncate">
          {conversation.contact?.name || 'Desconhecido'}
        </h1>
        <p className="text-[13px] text-[var(--geist-foreground-tertiary)] truncate">
          {conversation.contact?.phone || conversation.phone}
        </p>
      </div>

      {/* Theme toggle with amber color */}
      <button
        onClick={onToggleTheme}
        className="p-2 rounded-lg hover:bg-[var(--geist-component-bg)] transition-colors"
        aria-label={resolvedTheme === 'dark' ? 'Modo claro' : 'Modo escuro'}
      >
        {resolvedTheme === 'dark' ? (
          <Sun size={18} style={{ color: 'var(--geist-amber)' }} />
        ) : (
          <Moon size={18} style={{ color: 'var(--geist-purple)' }} />
        )}
      </button>
    </header>
  )
}

function formatWaitTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffMins < 1) return 'agora'
  if (diffMins < 60) return `há ${diffMins}min`
  if (diffHours < 24) return `há ${diffHours}h`
  return `há mais de 1 dia`
}

function StatusBar({
  status,
  onTakeOver,
  onReturnToAI,
  isLoading,
  canReply,
  canHandoff,
  lastMessageAt,
}: {
  status: ConversationStatus
  onTakeOver: () => void
  onReturnToAI: () => void
  isLoading: boolean
  canReply: boolean
  canHandoff: boolean
  lastMessageAt?: string
}) {
  if (!canReply) return null

  const isAIActive = status === 'ai_active' || status === 'handoff_requested'
  const isUrgent = status === 'handoff_requested'
  const isHuman = status === 'human_active'
  const waitTime = lastMessageAt && isUrgent ? formatWaitTime(lastMessageAt) : null

  // Colors based on status - simplified palette (green, red, neutral)
  const getStatusStyles = () => {
    if (isUrgent) return {
      bg: 'var(--geist-error-light)',
      iconColor: 'var(--geist-red)',
      textColor: 'var(--geist-red)',
    }
    if (isAIActive) return {
      bg: 'var(--geist-component-bg)',
      iconColor: 'var(--geist-foreground-secondary)',
      textColor: 'var(--geist-foreground-secondary)',
    }
    // Modo humano - verde WhatsApp
    return {
      bg: 'rgba(0, 168, 132, 0.1)',
      iconColor: '#00a884',
      textColor: '#00a884',
    }
  }
  const statusStyles = getStatusStyles()

  return (
    <div
      className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-[var(--geist-border)]"
      style={{ backgroundColor: statusStyles.bg }}
    >
      <div className="flex items-center gap-2">
        {isUrgent ? (
          <>
            <AlertCircle size={16} style={{ color: statusStyles.iconColor }} />
            <span className="text-[13px] font-medium" style={{ color: statusStyles.textColor }}>
              Cliente aguardando {waitTime || 'atendimento'}
            </span>
          </>
        ) : isAIActive ? (
          <>
            <Sparkles size={16} style={{ color: statusStyles.iconColor }} />
            <span className="text-[13px] font-medium" style={{ color: statusStyles.textColor }}>
              IA está atendendo
            </span>
          </>
        ) : (
          <>
            <User size={16} style={{ color: statusStyles.iconColor }} />
            <span className="text-[13px] font-medium" style={{ color: statusStyles.textColor }}>
              Você está atendendo
            </span>
          </>
        )}
      </div>

      {isAIActive ? (
        <button
          onClick={onTakeOver}
          disabled={isLoading}
          className="px-4 py-1.5 rounded-full text-[13px] font-semibold transition-all disabled:opacity-50 hover:brightness-110"
          style={{
            backgroundColor: isUrgent ? 'var(--geist-red)' : '#00a884',
            color: '#ffffff',
          }}
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Assumir'}
        </button>
      ) : canHandoff ? (
        <button
          onClick={onReturnToAI}
          disabled={isLoading}
          className="px-4 py-1.5 rounded-full text-[13px] font-medium transition-all disabled:opacity-50 hover:brightness-110"
          style={{
            backgroundColor: '#00a884',
            color: '#ffffff',
          }}
        >
          {isLoading ? <Loader2 size={14} className="animate-spin" /> : 'Devolver para IA'}
        </button>
      ) : null}
    </div>
  )
}

function MessageInput({
  value,
  onChange,
  onSend,
  isLoading,
  disabled,
  quickReplies,
  resolvedTheme,
}: {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  isLoading: boolean
  disabled: boolean
  quickReplies: QuickReply[]
  resolvedTheme: 'light' | 'dark'
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`
    }
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    const textarea = inputRef.current
    if (!textarea) return
    const start = textarea.selectionStart ?? value.length
    const end = textarea.selectionEnd ?? value.length
    const newValue = value.slice(0, start) + emojiData.emoji + value.slice(end)
    onChange(newValue)
    setEmojiOpen(false)
    setTimeout(() => {
      textarea.focus()
      const pos = start + emojiData.emoji.length
      textarea.setSelectionRange(pos, pos)
    }, 0)
  }

  const handleQuickReplySelect = (content: string) => {
    onChange(value.trim() ? `${value.trimEnd()} ${content}` : content)
    setQrOpen(false)
    setSearch('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  const filteredReplies = quickReplies.filter((qr) => {
    if (!search.trim()) return true
    const s = search.toLowerCase()
    return (
      qr.title.toLowerCase().includes(s) ||
      qr.content.toLowerCase().includes(s) ||
      qr.shortcut?.toLowerCase().includes(s)
    )
  })

  return (
    <div className="shrink-0 border-t border-[var(--geist-border)] bg-[var(--geist-background)]">
      <div className="flex items-end gap-2 px-3 py-3">
        {/* Respostas rápidas */}
        <Popover open={qrOpen} onOpenChange={setQrOpen}>
          <PopoverTrigger asChild>
            <button
              disabled={disabled}
              aria-label="Respostas rápidas"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--geist-foreground-secondary)] hover:text-[var(--geist-foreground)] hover:bg-[var(--geist-component-bg)] transition-colors disabled:opacity-40 shrink-0"
            >
              <MessageSquareDashed size={18} />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-80 p-0">
            <div className="p-3 border-b border-[var(--geist-border)]">
              <p className="text-sm font-medium mb-2">Respostas rápidas</p>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--geist-foreground-tertiary)]" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-8 py-1.5 text-sm rounded-lg bg-[var(--geist-component-bg)] border border-[var(--geist-border)] focus:outline-none focus:border-[var(--geist-blue)]"
                  autoFocus
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--geist-foreground-tertiary)]"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <div className="max-h-[260px] overflow-y-auto">
              {filteredReplies.length === 0 ? (
                <p className="p-4 text-sm text-center text-[var(--geist-foreground-tertiary)]">
                  {search ? 'Nenhuma resposta encontrada' : 'Nenhuma resposta rápida cadastrada'}
                </p>
              ) : (
                <div className="p-1">
                  {filteredReplies.map((qr) => (
                    <button
                      key={qr.id}
                      onClick={() => handleQuickReplySelect(qr.content)}
                      className="w-full px-3 py-2 rounded-md text-left hover:bg-[var(--geist-component-bg)] transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{qr.title}</span>
                        {qr.shortcut && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--geist-component-bg)] text-[var(--geist-foreground-secondary)] font-mono shrink-0">
                            /{qr.shortcut}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--geist-foreground-tertiary)] mt-0.5 line-clamp-1">
                        {qr.content}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Emoji */}
        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <button
              disabled={disabled}
              aria-label="Emoji"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--geist-foreground-secondary)] hover:text-[var(--geist-foreground)] hover:bg-[var(--geist-component-bg)] transition-colors disabled:opacity-40 shrink-0"
            >
              <Smile size={18} />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-auto p-0 border-none shadow-xl">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              theme={resolvedTheme === 'dark' ? Theme.DARK : Theme.LIGHT}
              lazyLoadEmojis
              searchPlaceholder="Buscar emoji..."
              height={380}
              width={320}
            />
          </PopoverContent>
        </Popover>

        {/* Textarea */}
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite uma mensagem..."
          rows={1}
          disabled={disabled}
          className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--geist-component-bg)] text-[var(--geist-foreground)] placeholder:text-[var(--geist-foreground-tertiary)] text-[14px] resize-none focus:outline-none focus:ring-2 focus:ring-[var(--geist-blue)] max-h-[120px] disabled:opacity-50 border border-[var(--geist-border)] focus:border-[var(--geist-blue)]"
        />

        {/* Enviar */}
        <button
          onClick={onSend}
          disabled={!value.trim() || isLoading || disabled}
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0 disabled:opacity-30 hover:scale-105 transition-all shadow-lg"
          style={{ backgroundColor: 'var(--geist-blue)', color: '#ffffff' }}
          aria-label="Enviar"
        >
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
        </button>
      </div>
    </div>
  )
}

function DisabledInputNotice({ message }: { message: string }) {
  return (
    <div className="shrink-0 px-4 py-4 border-t border-[var(--geist-border)] bg-[var(--geist-background-secondary)]">
      <p className="text-[13px] text-[var(--geist-foreground-tertiary)] text-center">
        {message}
      </p>
    </div>
  )
}

// =============================================================================
// MAIN PAGE
// =============================================================================

export default function ConversaPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { isAuthenticated, canReply, canHandoff, attendantFetch } = useAttendant()
  const { resolvedTheme, setTheme } = useTheme()

  const conversationId = params.id as string
  const token = searchParams.get('token')
  const [newMessage, setNewMessage] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Queries
  const { data: conversation, isLoading: convLoading, error: convError } = useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: () => fetchConversation(conversationId, attendantFetch),
    enabled: isAuthenticated,
    refetchInterval: 5000,
  })

  const { data: messagesData, isLoading: msgsLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => fetchMessages(conversationId, attendantFetch, 100),
    enabled: isAuthenticated,
    refetchInterval: 3000,
  })

  const { data: quickReplies = [] } = useQuery({
    queryKey: ['attendant-quick-replies'],
    queryFn: () => fetchQuickReplies(attendantFetch),
    enabled: isAuthenticated,
    staleTime: 60000,
  })

  const messages = messagesData?.messages ?? []
  const status = conversation ? mapConversationStatus(conversation) : 'ai_active'

  // Mutations
  const sendMutation = useMutation({
    mutationFn: (content: string) => sendMessage(conversationId, content, attendantFetch),
    onSuccess: () => {
      setNewMessage('')
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const takeoverMutation = useMutation({
    mutationFn: () => takeoverConversation(conversationId, attendantFetch),
    onSuccess: () => {
      toast.success('Você assumiu o atendimento')
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const returnMutation = useMutation({
    mutationFn: () => returnToBot(conversationId, attendantFetch),
    onSuccess: () => {
      toast.success('Conversa devolvida para IA')
      queryClient.invalidateQueries({ queryKey: ['conversation', conversationId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = useCallback(() => {
    if (!newMessage.trim() || sendMutation.isPending) return
    sendMutation.mutate(newMessage.trim())
  }, [newMessage, sendMutation])

  const handleBack = () => {
    const backUrl = token ? `/atendimento?token=${token}` : '/atendimento'
    router.push(backUrl)
  }

  // Loading
  if (convLoading || msgsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--geist-background)]">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--geist-foreground-tertiary)]" />
      </div>
    )
  }

  // Error
  if (convError || !conversation) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-[var(--geist-background)]">
        <AlertCircle className="w-12 h-12 text-[var(--geist-error)] mb-4" />
        <h2 className="text-lg font-semibold mb-2">Conversa não encontrada</h2>
        <button
          onClick={handleBack}
          className="text-[var(--geist-success)] text-sm hover:underline"
        >
          Voltar para lista
        </button>
      </div>
    )
  }

  const windowOpen = isWindowOpen(conversation.last_customer_message_at)
  const canSendMessages = canReply && status === 'human_active' && windowOpen

  return (
    <div className="flex flex-col h-screen bg-[var(--geist-background)]">
      <Header
        conversation={conversation}
        onBack={handleBack}
        resolvedTheme={resolvedTheme}
        onToggleTheme={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      />

      <StatusBar
        status={status}
        onTakeOver={() => takeoverMutation.mutate()}
        onReturnToAI={() => returnMutation.mutate()}
        isLoading={takeoverMutation.isPending || returnMutation.isPending}
        canReply={canReply}
        canHandoff={canHandoff}
        lastMessageAt={conversation.last_message_at}
      />

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 bg-[var(--geist-background)]">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-[14px] text-[var(--geist-foreground-tertiary)]">
              Nenhuma mensagem ainda
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {canSendMessages ? (
        <MessageInput
          value={newMessage}
          onChange={setNewMessage}
          onSend={handleSend}
          isLoading={sendMutation.isPending}
          disabled={false}
          quickReplies={quickReplies}
          resolvedTheme={resolvedTheme}
        />
      ) : !canReply ? (
        <DisabledInputNotice message="Você tem permissão apenas para visualizar" />
      ) : status !== 'human_active' ? (
        <DisabledInputNotice message="Assuma o atendimento para enviar mensagens" />
      ) : (
        <DisabledInputNotice message="Janela de 24h encerrada — aguarde o cliente responder ou use um template" />
      )}
    </div>
  )
}
