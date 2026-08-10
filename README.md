# QR Queue

Painel React/Vite para gerenciamento de fila de motoboys, com visual escuro e amarelo baseado nas telas fornecidas.

## Executar

```bash
npm install
copy .env.example .env
npm run dev
npm run build
npm run preview
```

Sem variáveis Supabase, o frontend funciona em modo local para demonstração. Em produção, preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e aplique as migrations em `supabase/migrations` pelo Supabase CLI ou SQL Editor.

As migrations criam o modelo multi-loja, RLS, índices, prevenção de duplicidade, `join_queue` e `call_next`. Ative Auth por e-mail e confirme as tabelas `queue_entries`, `queue_history` e `motoboys` em Realtime. O deploy é compatível com Vercel, Netlify ou qualquer host de arquivos estáticos.

## Deploy no Vercel

Importe o repositório no Vercel com estas opções:

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`

Cadastre no projeto Vercel as variáveis `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` e `VITE_STORE_ID` nos ambientes Preview e Production. O arquivo `vercel.json` já mantém as rotas públicas, como `/entrar/ze-barreiro`, funcionando após o refresh.

## Configuração do Supabase

No SQL Editor, execute as migrations em ordem. Crie a loja em `stores`, copie o UUID para `VITE_STORE_ID` e crie o perfil do usuário autenticado em `profiles`. Em Database > Replication, habilite `queue_entries`, `queue_history` e `motoboys`. Em Authentication, habilite login por e-mail e senha.
