# Copa do Mundo 2026 — Classificação (PWA)

App de uma página com a classificação dos 12 grupos da Copa do Mundo 2026, saldo de gols e jogos recentes/próximos. Pode ser instalado como app (PWA) no celular ou computador.

## Estrutura dos arquivos

```
copa2026-pwa/
├── index.html          → o app inteiro (HTML + CSS + JS)
├── manifest.json        → identidade do app (nome, ícone, cores)
├── service-worker.js    → cache offline e suporte à instalação
└── icons/
    ├── icon-192.png
    ├── icon-512.png
    └── icon-maskable-512.png
```

## ⚠️ Importante: este app NÃO atualiza os dados sozinho

Hospedar como PWA muda a *aparência* (ícone, tela cheia, abre offline) — não cria conexão com a internet para buscar placares novos. Sempre que quiser dados atualizados, peça ao Claude no chat ("atualiza a tabela da Copa") e suba a nova versão do `index.html` por cima da antiga.

---

## Passo 1 — Subir no GitHub

1. Crie um repositório novo no GitHub (pode ser público), ex: `copa-2026-classificacao`.
2. Pelo site do GitHub: clique em **Add file → Upload files** e arraste todos os arquivos desta pasta (mantendo a subpasta `icons/`).
3. Confirme o commit (**Commit changes**).

Se preferir usar o terminal:
```bash
cd copa2026-pwa
git init
git add .
git commit -m "Primeira versão do app"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/copa-2026-classificacao.git
git push -u origin main
```

## Passo 2 — Publicar na Vercel

1. Acesse [vercel.com](https://vercel.com) e entre com sua conta GitHub.
2. Clique em **Add New → Project**.
3. Selecione o repositório `copa-2026-classificacao`.
4. Em **Framework Preset**, escolha **Other** (é HTML puro, sem build).
5. Deixe **Build Command** e **Output Directory** vazios.
6. Clique em **Deploy**.

Em menos de um minuto a Vercel te dá uma URL pública, algo como:
`https://copa-2026-classificacao.vercel.app`

## Passo 3 — Instalar no celular

Abra essa URL da Vercel no navegador do celular:

- **Android (Chrome):** vai aparecer um banner "Instalar app" automaticamente, ou toque no menu (⋮) → **Instalar aplicativo**.
- **iPhone (Safari):** toque no ícone de compartilhar → **Adicionar à Tela de Início**. (No iPhone, o Safari não mostra o banner automático, mas o atalho funciona igual.)

No computador (Chrome/Edge), vai aparecer um ícone de instalação (⊕ ou tela com seta) na barra de endereço.

## Quando quiser atualizar os dados

1. Peça ao Claude para atualizar a tabela.
2. Baixe o novo `index.html` que ele te entregar.
3. No GitHub, abra o arquivo `index.html` do repositório → ícone de lápis (editar) → cole o conteúdo novo → **Commit changes**.
4. A Vercel publica a atualização automaticamente em alguns segundos — quem já instalou o app recebe a versão nova na próxima vez que abrir com internet.
