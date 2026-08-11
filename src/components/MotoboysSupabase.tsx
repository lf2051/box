import { useState } from 'react'
import { Pause, Plus, Search, Trash2 } from 'lucide-react'
import { createMotoboy, removeMotoboy, setMotoboyStatus } from '../services/queueService'

type Moto = { id: string; name: string; phone: string; plate: string; model: string; active: boolean; lastAccess?: string; attendances: number }
type Props = { motos: Moto[]; setMotos: React.Dispatch<React.SetStateAction<Moto[]>>; onAdd: (id: string) => void; storeId?: string; onNotice: (message: string) => void }

export default function MotoboysSupabase({ motos, setMotos, onAdd, storeId, onNotice }: Props) {
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [plate, setPlate] = useState('')
  const [saving, setSaving] = useState(false)
  const filtered = motos.filter(moto => moto.name.toLowerCase().includes(query.toLowerCase()))
  const save = async () => {
    if (!name.trim()) { onNotice('Informe o nome completo do motoboy.'); return }
    if (!storeId) { onNotice('A loja do Supabase não está configurada.'); return }
    setSaving(true)
    try {
      const moto = await createMotoboy(storeId, { name: name.trim(), phone: phone.trim() || '-', plate: plate.trim() || '-' })
      setMotos(current => [...current, moto])
      setName(''); setPhone(''); setPlate('')
      onNotice('Motoboy salvo no Supabase.')
    } catch (error) { onNotice(error instanceof Error ? error.message : 'Não foi possível salvar o motoboy.') } finally { setSaving(false) }
  }
  const toggle = async (moto: Moto) => { try { const updated = await setMotoboyStatus(moto.id, !moto.active); setMotos(current => current.map(item => item.id === moto.id ? updated : item)); onNotice('Status atualizado no Supabase.') } catch (error) { onNotice(error instanceof Error ? error.message : 'Não foi possível atualizar.') } }
  const remove = async (moto: Moto) => { if (!window.confirm(`Excluir ${moto.name}?`)) return; try { await removeMotoboy(moto.id); setMotos(current => current.filter(item => item.id !== moto.id)); onNotice('Motoboy excluído do Supabase.') } catch (error) { onNotice(error instanceof Error ? error.message : 'Não foi possível excluir.') } }
  return <><div className="heading"><div><div className="eyebrow">CADASTRO</div><h1>Motoboys</h1><p>Cadastre e acompanhe os motoboys da loja.</p></div><div className="actions"><input className="search-input" value={query} onChange={event => setQuery(event.target.value)} placeholder="Pesquisar..." /><button className="primary" onClick={() => void save()}><Plus size={16} /> Novo motoboy</button></div></div><section className="panel form-inline"><input value={name} onChange={event => setName(event.target.value)} placeholder="Nome completo" /><input value={phone} onChange={event => setPhone(event.target.value)} placeholder="Telefone" /><input value={plate} onChange={event => setPlate(event.target.value)} placeholder="Placa da moto" /><button className="primary" onClick={() => void save()} disabled={saving}><Plus size={16} /> {saving ? 'Salvando...' : 'Salvar motoboy'}</button></section><section className="panel table-panel"><table><thead><tr><th>NOME</th><th>TELEFONE</th><th>PLACA</th><th>STATUS</th><th>ÚLTIMO ACESSO</th><th>ATEND.</th><th>AÇÕES</th></tr></thead><tbody>{filtered.map(moto => <tr key={moto.id}><td><b>{moto.name}</b></td><td>{moto.phone}</td><td>{moto.plate}</td><td><span className={`badge ${moto.active ? 'active' : 'inactive'}`}>{moto.active ? 'Ativo' : 'Inativo'}</span></td><td>{moto.lastAccess || '-'}</td><td>{moto.attendances}</td><td className="row-actions"><button onClick={() => void toggle(moto)}><Pause size={15} /></button><button onClick={() => onAdd(moto.id)}><Plus size={15} /></button><button onClick={() => void remove(moto)}><Trash2 size={15} /></button></td></tr>)}</tbody></table></section></>
}
