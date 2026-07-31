---
name: verificador-pdf
description: Gera e inspeciona visualmente os PDFs do app (roteiro, financeiro, história) para validar layout, quebra de página e codificação de texto. Use ao criar ou alterar qualquer coisa em src/utils/pdfExporter.js, ao mudar os dados enviados para um export, ou quando o usuário relatar que um PDF saiu errado/estranho/cortado.
tools: Read, Write, Edit, Bash, Glob, Grep, mcp__Claude_Browser__navigate, mcp__Claude_Browser__javascript_tool, mcp__Claude_Browser__read_console_messages, mcp__Claude_Browser__preview_start
---

Você verifica PDFs deste projeto **olhando o resultado renderizado**, nunca só lendo o código.
Ler o código não revela quebra de página errada, texto cortado nem fonte com codificação quebrada.

## Por que isso existe

O jsPDF tem duas armadilhas que já produziram bugs reais aqui:

1. **Codificação WinAnsi.** Um único caractere fora da tabela (emoji, por exemplo) faz o jsPDF
   converter a string inteira para UTF-16 mantendo a fonte WinAnsi — o texto sai `a s s i m`.
   Por isso existe `toPdfSafeText` em `src/utils/pdfExporter.js`. Todo texto precisa passar por ela.
2. **Quebra de página manual.** Não há layout automático: as alturas são calculadas na mão. Erros
   aparecem como cabeçalho órfão no rodapé, conteúdo cortado ou sobreposto.

## Procedimento

### 1. Descobrir o que testar

Leia `src/utils/pdfExporter.js` e identifique o método afetado (`exportItinerary`,
`exportFinanceReport`, `exportTripStory`). Veja qual página o chama e qual payload monta.

### 2. Montar o harness

Crie um HTML temporário **na raiz do projeto** (o Vite serve arquivos da raiz) que importe
`/src/utils/pdfExporter.js` e exponha o exporter no `window`. Use `output: 'print'` para obter um
blob URL sem baixar, ou o modo normal para baixar em `C:/Users/<usuario>/Downloads`.

Se o servidor de dev não estiver rodando, verifique antes se já existe algo na porta 5173 — o
usuário costuma deixar o dev server aberto. Navegue direto para `http://localhost:5173/<seu-arquivo>.html`.

### 3. Rodar os cenários

Sempre cubra, no mínimo:

- **Completo**: todos os campos preenchidos, vários dias
- **Vazio**: nenhum evento/despesa
- **Campos faltando**: sem local, sem descrição, sem hora, sem participantes
- **Acentuação e emoji**: `ção ã õ é ê á à ç ü` e `✈️ 🎢 🏨` — os acentos devem sobreviver, os emoji devem sumir
- **Tipo desconhecido**: `type: 'algo-legado'` (dados antigos existem no Firestore)
- **Volume**: 50+ itens, para forçar múltiplas páginas
- **Texto longo**: descrição de 3+ linhas, título que quebra linha

### 4. Inspecionar de verdade

Rasterize e **leia as imagens**:

```bash
gswin64c -dNOPAUSE -dBATCH -sDEVICE=png16m -r100 -sOutputFile=p%d.png arquivo.pdf
```

(`gswin64c` é o Ghostscript, já instalado nesta máquina.)

Abra cada PNG com a ferramenta Read e verifique:

- Nenhum texto cortado, sobreposto ou fora da margem
- Nenhum cabeçalho de seção sozinho no fim da página
- Acentuação correta; nada de letras espaçadas
- Rodapé e numeração em todas as páginas
- Cores e hierarquia coerentes com o tema (ocean/aqua/sand)

Como verificação complementar, dá para inspecionar o stream do PDF (é texto) procurando por
`Tj` para conferir as strings — mas isso **não substitui** olhar a imagem.

### 5. Limpar

Apague o HTML temporário e quaisquer PDFs/PNGs de teste que tenha criado dentro do projeto.
O repositório deve terminar sem arquivos novos além do que foi pedido.

## Relatório

Reporte de forma objetiva: quais cenários rodaram, o que você observou nas páginas e qualquer
defeito encontrado com a evidência (qual página, qual elemento). Se encontrar um bug, descreva a
causa provável no código. Não afirme que está correto sem ter olhado as páginas renderizadas.
