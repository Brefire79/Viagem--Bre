# CLAUDE.md

Guia operacional para trabalhar neste repositório. Foca no que **não é óbvio** lendo o código.
Para visão geral de arquitetura e árvore de arquivos, veja `ARCHITECTURE.md` e `STRUCTURE.md`.

## O que é o app

PWA React de planejamento de viagem colaborativa. Várias pessoas compartilham a mesma viagem e
veem roteiro, despesas e história em tempo real (Firestore `onSnapshot`).

## Comandos

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run preview
```

Não existe suíte de testes automatizados no projeto. Validação é feita com build + verificação
manual no navegador (veja "Como testar PDF" abaixo).

## Stack

React 18 + Vite 5 + Tailwind + framer-motion + Firebase (Auth + Firestore) + vite-plugin-pwa.
Deploy: Netlify. Regras de segurança em `firestore.rules`.

---

## Convenções críticas

### 1. Datas de evento são SEMPRE UTC

Eventos são gravados com `new Date(Date.UTC(ano, mes-1, dia, hora, min))` (ver `RoteiroPage.jsx`).
A intenção é que "2 de outubro 08:00" seja esse dia/hora para todo mundo, independente do fuso.

**Ao ler um evento, use sempre os getters UTC** — `getUTCDate()`, `getUTCHours()`, etc.

```js
// CERTO
const dia = eventDate.getUTCDate();

// ERRADO - no Brasil (UTC-3) mostra o dia anterior para eventos da madrugada
const dia = eventDate.getDate();
format(eventDate, 'd/MM');            // date-fns formata em fuso local
eventDate.toLocaleDateString('pt-BR'); // idem
```

Isso já causou dois bugs reais: eventos da madrugada sumindo da História e datas exibidas um dia
antes. `HistoriaPage.jsx` tem `toUtcDayStart` / `toUtcDayEnd` / `formatUtcDate` para isso.

### 2. Datas da viagem são strings `'yyyy-MM-dd'`

`trip.startDate` / `trip.endDate` vêm de `<input type="date">`, ou seja, string pura — não Timestamp.
Nunca faça `new Date('2026-10-02')` (isso é interpretado como UTC e vira dia anterior no Brasil
quando formatado localmente). Faça o split manual e monte com `Date.UTC`.

Dados antigos podem usar `start_date` / `end_date` (snake_case). Leia com fallback:
`trip.startDate || trip.start_date`.

### 3. Todo texto que vai para PDF passa por `toPdfSafeText`

O jsPDF usa fontes padrão com codificação WinAnsi. Se a string tiver **um único** caractere fora
dessa tabela (emoji, por exemplo), o jsPDF converte a string inteira para UTF-16 mas mantém a fonte
WinAnsi — o texto sai `a s s i m` com símbolos errados.

`toPdfSafeText` (em `src/utils/pdfExporter.js`) remove emoji/CJK e **preserva** acentuação latina,
aspas tipográficas, bullets e travessões. Os títulos de evento dos usuários costumam ter emoji
(✈️), então isso não é hipotético.

### 4. `pdfExporter` deve ser importado dinamicamente

O chunk do jsPDF + html2canvas tem ~595 kB (174 kB gzip). As páginas são lazy-loaded via
`React.lazy`, então um import estático faria a aba baixar a biblioteca só de abrir.

```js
// CERTO - só baixa quando o usuário clica em exportar
const { pdfExporter } = await import('../utils/pdfExporter');

// ERRADO - entra no chunk da página
import { pdfExporter } from '../utils/pdfExporter';
```

Conferir depois do build: o chunk da página deve conter `import("./pdfExporter-*.js")`, não
`from"./pdfExporter-*.js"`.

### 5. Documentos antigos do Firestore são incompletos

Existem viagens e despesas criadas antes das validações atuais. Sempre programe defensivamente:

- `expense.splitBetween` pode estar **ausente** → cair para `[expense.paidBy]`
- `expense.status` pode estar ausente → tratar como `'pago'` (regra usada no Financeiro)
- `expense.category` pode estar ausente → `'outros'`
- `expense.amount` pode virar `NaN` → normalizar com `Number()` + checagem

Ler `exp.splitBetween.length` direto já derrubou a aba História inteira (tela branca).

### 6. Regra de negócio: pago vs. pendente

Despesas com `status === 'pendente'` **não entram** nos totais. Despesas sem `status` contam como
pagas. Financeiro e História precisam usar a mesma regra, senão as abas mostram números diferentes.

### 7. Toda exportação leva data E hora no nome do arquivo

O navegador não sobrescreve download: exportar duas vezes no mesmo dia com o mesmo nome gera
`arquivo (1).pdf` e mantém o original intacto. O usuário abre o antigo e conclui, com razão, que
"os dados não atualizaram".

```js
// CERTO
`roteiro-${slug}-${format(new Date(), "yyyy-MM-dd_HH'h'mm")}`

// ERRADO - dois exports no mesmo dia disputam o mesmo nome
`roteiro-${slug}-${format(new Date(), 'yyyy-MM-dd')}`
```

Vale para os cinco pontos de exportação: roteiro (PDF), história (PDF/MD/TXT) e financeiro (PDF).

### 8. Ao mudar dados, verifique TODOS os consumidores

Um mesmo dado alimenta várias telas e arquivos. Ao mexer em evento, despesa ou viagem, percorra a
cadeia inteira antes de dar por pronto:

| Origem | Consumidores que precisam refletir a mudança |
|--------|----------------------------------------------|
| `events` | Roteiro (lista + contador), História (texto), PDF do roteiro, PDF/MD/TXT da história |
| `expenses` | Financeiro (totais e saldos), História (seção financeira), PDF do financeiro |
| `trip` (datas) | Contagem regressiva, filtro de período da História, cabeçalho dos PDFs |

Checagens que evitam o erro clássico de "exportou desatualizado":

- A exportação usa o **mesmo conjunto** que a tela mostra? (O PDF da História já listou eventos
  fora do período enquanto o texto usava os filtrados.)
- O `useMemo` tem no array de dependências tudo que ele lê?
- O nome do arquivo muda a cada exportação? (ver item 7)

### 9. Existe mais de uma viagem

Por padrão `currentTrip` é a **primeira viagem não arquivada** (`status !== 'archived'`), mas a
escolha do usuário tem prioridade e é guardada em `selectedTripIdRef` no `TripContext`.

Para trocar de viagem use **`selectTrip(tripId)`**, nunca `setCurrentTrip` direto — este último não
registra a escolha, então o próximo snapshot do Firestore volta para a primeira viagem ativa e o
app parece "não ter atualizado".

Ao mexer em qualquer aba, considere: viagem sem eventos, viagem sem despesas, viagem arquivada e
viagem com dados antigos.

---

## Modelo de dados (Firestore)

| Coleção    | Campos principais                                                                 |
|------------|-----------------------------------------------------------------------------------|
| `trips`    | `name`, `destination`, `startDate`, `endDate` (strings), `participants[]` (uids), `pendingParticipants[]` (emails), `createdBy`, `status` |
| `events`   | `tripId`, `type`, `title`, `description`, `date` (Timestamp UTC), `time`, `location`, `createdBy` |
| `expenses` | `tripId`, `description`, `amount`, `category`, `paidBy`, `splitBetween[]`, `status`, `date` |
| `users`    | `uid`, `displayName`, `email`                                                     |

Tipos de evento válidos: `voo`, `transfer`, `hospedagem`, `passeio`, `alimentacao`.
Categorias de despesa: `aereo`, `transfer`, `hospedagem`, `passeios`, `alimentacao`, `outros`.

Nota: o tipo de evento é `passeio` (singular) e a categoria de despesa é `passeios` (plural). Não
são o mesmo campo — não unifique sem migrar os dados.

---

## Estilo de UI

- Paleta em `tailwind.config.js`: `ocean` (tinta marinha, ações), `aqua` (terracota, destaque),
  `sand` (papel, fundos), `dark` (texto). Os nomes são legado; os valores são o tema "diário de viagem".
- Classes prontas em `src/index.css`: `.btn-primary`, `.btn-outline`, `.card`, `.input`, `.modal-overlay`,
  `.modal-container`, `.empty-state`, `.badge`.
- Modais seguem o padrão: `document.body.style.overflow = 'hidden'` ao abrir e `''` ao fechar
  (incluindo cancelar e clicar no overlay). Esquecer disso trava o scroll da página.
- Textos da interface em português (pt-BR).

## Como testar PDF

Não dá para conferir PDF só lendo código — a quebra de página e a codificação de fonte precisam
ser vistas. Fluxo usado:

1. Criar um HTML temporário na raiz (o Vite serve arquivos da raiz) que importe
   `/src/utils/pdfExporter.js` e exponha uma função no `window`.
2. Rodar os cenários pelo navegador (completo, vazio, campos faltando, muitos eventos, acentos e emoji).
3. Baixar o PDF e rasterizar para inspecionar de verdade:

```bash
gswin64c -dNOPAUSE -dBATCH -sDEVICE=png16m -r100 -sOutputFile=p%d.png arquivo.pdf
```

4. Apagar o HTML temporário ao terminar.

Cenários que já pegaram bugs: título com emoji, evento com `type` desconhecido (dado legado),
descrição muito longa (quebra de página), dia com cabeçalho no rodapé da página (órfão).

## Antes de entregar

- `npm run build` tem que passar limpo.
- Conferir o console do navegador sem erros.
- Se mexeu em export de PDF: gerar e olhar as páginas rasterizadas.
- Se mexeu em cálculo financeiro: conferir se Financeiro e História batem.
- Não commitar `.env` nem arquivos de teste temporários.
