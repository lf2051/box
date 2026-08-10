import { supabase } from '../lib/supabase'
import type { Entry, Moto } from '../types/queue'

export async function loadStoreQueue(storeId: string) {
  if (!supabase) return { entries: [] as Entry[], motos: [] as Moto[] }
  const [{ data: entries, error: entriesError }, { data: motos, error: motosError }] = await Promise.all([
    supabase.from('queue_entries').select('*').eq('store_id', storeId).in('status', ['waiting', 'called', 'attending']).order('position'),
    supabase.from('motoboys').select('*').eq('store_id', storeId).order('name'),
  ])
  if (entriesError) throw entriesError
  if (motosError) throw motosError
  return { entries: (entries || []).map(mapEntry), motos: (motos || []).map(mapMoto) }
}

export async function callNext(storeId: string) { if (!supabase) throw new Error('Supabase não configurado'); const { data, error } = await supabase.rpc('call_next', { p_store_id: storeId }); if (error) throw error; return data ? mapEntry(data) : null }
export async function updateQueueEntry(id: string, status: string) { if (!supabase) throw new Error('Supabase não configurado'); const { data, error } = await supabase.from('queue_entries').update({ status, finished_at: ['completed', 'cancelled', 'skipped'].includes(status) ? new Date().toISOString() : undefined, updated_at: new Date().toISOString() }).eq('id', id).select().single(); if (error) throw error; return mapEntry(data) }
export async function createQueueEntry(storeId: string, motoboyId: string) { if (!supabase) throw new Error('Supabase não configurado'); const { data, error } = await supabase.rpc('enter_queue', { p_store_id: storeId, p_motoboy_id: motoboyId }); if (error) throw error; return mapEntry(data) }
export function subscribeQueue(storeId: string, callback: () => void) { const client = supabase; if (!client) return () => undefined; const channel = client.channel(`queue-${storeId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `store_id=eq.${storeId}` }, callback).on('postgres_changes', { event: '*', schema: 'public', table: 'motoboys', filter: `store_id=eq.${storeId}` }, callback).subscribe(); return () => { void client.removeChannel(channel) } }

function mapEntry(row: Record<string, unknown>): Entry { return { id: String(row.id), motoId: String(row.motoboy_id), status: row.status as Entry['status'], position: Number(row.position), enteredAt: String(row.entered_at), calledAt: row.called_at ? String(row.called_at) : undefined, finishedAt: row.finished_at ? String(row.finished_at) : undefined } }
function mapMoto(row: Record<string, unknown>): Moto { return { id: String(row.id), name: String(row.name), phone: String(row.phone || ''), plate: String(row.plate || ''), model: String(row.motorcycle_model || ''), active: row.status === 'active', lastAccess: row.last_access_at ? String(row.last_access_at) : undefined, attendances: 0 } }
