import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, ChevronRight, X } from 'lucide-react'
import { supabase, supabaseConfigured } from '../lib/supabase'

type Row = { entry_id: string; motoboy_id: string; name: string; queue_position: number; status: string; entered_at: string; called_at?: string }

export default function PublicEntrySupabase({ storeSlug }: { storeSlug: string }) {
  const storageKey = `qr-queue-public-${storeSlug}`
  const saved = JSON.parse(localStorage.getItem(storageKey) || 'null') as { entryId?: string; name?: string; phone?: string; position?: number } | null
  const urlCode = new URLSearchParams(window.location.search).get('code') || ''
  const [name, setName] = useState(saved?.name || '')
  const [phone, setPhone] = useState(saved?.phone || '')
  const [code, setCode] = useState(urlCode)
  const [rows, setRows] = useState<Row[]>([])
  const [notice, setNotice] = useState('')
  const [entered, setEntered] = useState(Boolean(saved?.entryId))
  const previous = useRef('')

  const beep = () => { try { const context = new AudioContext(); const oscillator = context.createOscillator(); oscillator.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + .25) } catch { /* o navegador pode exigir uma interação */ } }
  const refresh = async () => {
    if (!supabaseConfigured || !supabase || !code) return
    const { data, error } = await supabase.rpc('get_public_queue', { p_store_slug: storeSlug, p_code: code })
    if (error || !data) return
    const next = data as Row[]
    setRows(next)
    const current = next.find(row => row.entry_id === saved?.entryId)
    if (!current) return
    const state = `${current.status}:${current.queue_position}`
    if (previous.current && previous.current !== state) {
      const message = current.status === 'called' ? 'Você foi chamado. Dirija-se ao balcão.' : current.queue_position <= 2 ? 'Prepare-se, você será o próximo.' : `A fila foi atualizada. Sua posição é ${current.queue_position}º.`
      setNotice(message); beep(); window.speechSynthesis?.speak(new SpeechSynthesisUtterance(message))
    }
    previous.current = state
  }
  useEffect(() => { if (!entered) return; void refresh(); const timer = window.setInterval(() => void refresh(), 1500); return () => window.clearInterval(timer) }, [entered, code])

  const current = rows.find(row => row.entry_id === saved?.entryId)
  const ahead = useMemo(() => rows.filter(row => row.status === 'waiting' && row.queue_position < (current?.queue_position || saved?.position || 0)).slice(0, 10), [rows, current?.queue_position, saved?.position])
  const submit = async () => {
    const acceptedCode = urlCode || localStorage.getItem('qr-queue-code') || ''
    if (!code || code !== acceptedCode) { setNotice('Código expirado. Escaneie o QR Code novamente.'); return }
    if (saved?.entryId) { setEntered(true); setNotice('Acesso confirmado.'); return }
    if (!name.trim() || !phone.trim()) { setNotice('Preencha nome e telefone.'); return }
    if (supabaseConfigured && supabase) {
      const { data, error } = await supabase.rpc('join_queue', { p_store_slug: storeSlug, p_name: name.trim(), p_phone: phone.trim() })
      if (error || !data) { setNotice(error?.message.includes('ALREADY_IN_QUEUE') ? 'Este telefone já está na fila.' : `Não foi possível entrar: ${error?.message || 'erro no Supabase'}`); return }
      const result = data as { entry_id: string; position: number }
      localStorage.setItem(storageKey, JSON.stringify({ name, phone, entryId: result.entry_id, position: result.position }))
      setEntered(true); setNotice('Você entrou na fila com sucesso.'); beep(); return
    }
    setNotice('Supabase não configurado neste endereço.');
  }

  if (!entered) return <div className="public-entry"><div className="public-card"><div className="brand centered"><span className="brand-mark">▰</span><div><b>Box Fila</b><small>Fila inteligente</small></div></div><div className="eyebrow">ENTRADA NA FILA</div><h1>Entre na fila</h1><p>Informe seus dados e o código exibido no balcão.</p><label>Nome completo<input value={name} onChange={event => setName(event.target.value)} placeholder="Seu nome" /></label><label>Telefone<input value={phone} onChange={event => setPhone(event.target.value)} placeholder="(31) 99999-9999" /></label><label>Código de autenticação<input inputMode="numeric" maxLength={4} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, ''))} placeholder="4 dígitos" /></label><button className="primary full" onClick={() => void submit()}>Entrar na fila <ChevronRight size={16} /></button>{notice && <div className="notification-window">{notice}</div>}</div></div>
  const position = current?.queue_position || saved?.position || 0
  return <div className="public-entry"><div className="public-card"><div className="brand centered"><span className="brand-mark">▰</span><div><b>Box Fila</b><small>Fila inteligente</small></div></div>{notice && <div className="notification-window"><Bell size={17} /><span>{notice}</span><button onClick={() => setNotice('')}><X size={14} /></button></div>}<div className="eyebrow">ZÉ BARREIRO</div><h1>Você está na fila</h1><div className="public-position"><small>SUA POSIÇÃO</small><strong>{position}º</strong><span>{ahead.length ? `${ahead.length} pessoa(s) antes de você` : 'Você é o próximo da fila'}</span></div><section className="ahead-list"><h2>FILA À SUA FRENTE</h2>{ahead.length ? ahead.map((row, index) => <div className="ahead-row" key={row.entry_id}><b>{index + 1}º</b><span>{row.name}</span></div>) : <p>Nenhuma pessoa antes de você.</p>}</section><p className="muted">A fila é atualizada automaticamente nesta janela.</p></div></div>
}
