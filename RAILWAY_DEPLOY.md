# Deploy no Railway

## 1) Criar o projeto
1. No Railway, clique em `New Project`.
2. Selecione `Deploy from GitHub repo`.
3. Escolha este repositorio.

O Railway vai usar:
- `npm install` no build
- `npm run build` para gerar o frontend
- `npm run start` no runtime (definido em `railway.json`)

## 2) Variaveis de ambiente
Configure no servico:

- `PORT` = `3001` (ou deixe sem valor; Railway injeta automaticamente)
- `WWEB_DATA_PATH` = `/data`
- `WPP_AUTO_CLEAR_SESSION` = `1`
- `WPP_AUTO_RESTART_ON_FAIL` = `1`
- `GEMINI_API_KEY` (se usar Gemini)
- `OPENAI_API_KEY` (se usar OpenAI)
- `AUDIO_REPLY_MODE` = `off` | `incoming_audio` | `all`

Opcional:
- `WWEB_VERSION`
- `PUPPETEER_EXECUTABLE_PATH`
- `SKIP_PUPPETEER_BROWSER_DOWNLOAD` = `1` (somente se ja houver Chrome no ambiente)

## 3) Volume persistente (obrigatorio para sessao WhatsApp)
1. No servico, abra `Volumes`.
2. Crie um volume e monte em `/data`.

Sem volume, a sessao do WhatsApp pode ser perdida em restart/redeploy.

## 4) Rotas apos deploy
- Frontend (SPA): `GET /`
- Status do bot (JSON): `GET /status`
- QR para autenticar: `GET /qr`
- Imagem QR: `GET /qr.png`
- API bairros: `GET/POST /bairros`
- API catalogo: `GET/POST /catalogo`
- API config: `GET/POST /config`

Quando autenticado, `GET /status` deve retornar `status: "conectado"`.
