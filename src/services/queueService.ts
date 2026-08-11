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
export async function updateQueueEntry(id: string, status: string) { if (!supabase) throw new Error('Supabase não configurado'); const { data, error } = await supabase.rpc('update_queue_status', { p_entry_id: id, p_status: status }); if (error) throw error; return mapEntry(data) }
export async function createQueueEntry(storeId: string, motoboyId: string) { if (!supabase) throw new Error('Supabase não configurado'); const { data, error } = await supabase.rpc('enter_queue', { p_store_id: storeId, p_motoboy_id: motoboyId }); if (error) throw error; return mapEntry(data) }
export async function createMotoboy(storeId: string, input: { name: string; phone: string; plate: string }) { if (!supabase) throw new Error('Supabase não configurado'); const { data, error } = await supabase.from('motoboys').insert({ store_id: storeId, name: input.name, phone: input.phone, plate: input.plate, status: 'active' }).select().single(); if (error) throw error; return mapMoto(data) }
export async function setMotoboyStatus(id: string, active: boolean) { if (!supabase) throw new Error('Supabase não configurado'); const { data, error } = await supabase.from('motoboys').update({ status: active ? 'active' : 'inactive', updated_at: new Date().toISOString() }).eq('id', id).select().single(); if (error) throw error; return mapMoto(data) }
export async function removeMotoboy(id: string) { if (!supabase) throw new Error('Supabase não configurado'); const { error } = await supabase.from('motoboys').delete().eq('id', id); if (error) throw error }
export type StoreSettingsInput = { name: string; accentColor: string; estimatedServiceTime: number; callPhrase: string; callRepeat: number; attendanceTimeout: number; allowVoluntaryExit: boolean; allowNewEntries: boolean; tvPositions: number; volume: number }
export async function loadStoreSettings(storeId: string) { if (!supabase) throw new Error('Supabase não configurado'); const [{ data: store, error: storeError }, { data: settings, error: settingsError }] = await Promise.all([supabase.from('stores').select('*').eq('id', storeId).single(), supabase.from('store_settings').select('*').eq('store_id', storeId).maybeSingle()]); if (storeError) throw storeError; if (settingsError) throw settingsError; return { store, settings } }
export async function saveStoreSettings(storeId: string, input: StoreSettingsInput) { if (!supabase) throw new Error('Supabase não configurado'); const { error: storeError } = await supabase.from('stores').update({ name: input.name, accent_color: input.accentColor, estimated_service_time: input.estimatedServiceTime, call_phrase: input.callPhrase, call_repeat: input.callRepeat, attendance_timeout: input.attendanceTimeout, allow_voluntary_exit: input.allowVoluntaryExit, allow_new_entries: input.allowNewEntries, tv_positions: input.tvPositions, updated_at: new Date().toISOString() }).eq('id', storeId); if (storeError) throw storeError; const { error: settingsError } = await supabase.from('store_settings').upsert({ store_id: storeId, volume: input.volume, updated_at: new Date().toISOString() }); if (settingsError) throw settingsError }
export function subscribeQueue(storeId: string, callback: () => void) { const client = supabase; if (!client) return () => undefined; const channel = client.channel(`queue-${storeId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'queue_entries', filter: `store_id=eq.${storeId}` }, callback).on('postgres_changes', { event: '*', schema: 'public', table: 'motoboys', filter: `store_id=eq.${storeId}` }, callback).subscribe(); return () => { void client.removeChannel(channel) } }

function mapEntry(row: Record<string, unknown>): Entry { return { id: String(row.id), motoId: String(row.motoboy_id), status: row.status as Entry['status'], position: Number(row.position), enteredAt: String(row.entered_at), calledAt: row.called_at ? String(row.called_at) : undefined, finishedAt: row.finished_at ? String(row.finished_at) : undefined } }
function mapMoto(row: Record<string, unknown>): Moto { return { id: String(row.id), name: String(row.name), phone: String(row.phone || ''), plate: String(row.plate || ''), model: String(row.motorcycle_model || ''), active: row.status === 'active', lastAccess: row.last_access_at ? String(row.last_access_at) : undefined, attendances: 0 } }
