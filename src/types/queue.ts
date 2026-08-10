export type EntryStatus = 'waiting' | 'called' | 'attending' | 'completed' | 'skipped' | 'cancelled'
export type Entry = { id: string; motoId: string; status: EntryStatus; position: number; enteredAt: string; calledAt?: string; finishedAt?: string }
export type Moto = { id: string; name: string; phone: string; plate: string; model: string; active: boolean; lastAccess?: string; attendances: number }
