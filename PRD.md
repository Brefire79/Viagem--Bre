# PRD — Viagem Colaborativa

**Versão:** 1.1
**Atualizado em:** 31/07/2026
**Status:** em produção (uso real, viagem para Orlando planejada)

---

## 1. Visão

Planejar uma viagem em grupo hoje se espalha por conversa de WhatsApp, planilha de gastos e print
de reserva. Ninguém sabe qual é a versão mais recente do roteiro e, no fim, sempre falta acertar
quem deve quanto a quem.

**Viagem Colaborativa** junta as três coisas em um lugar só: o roteiro dia a dia, a divisão de
despesas e o registro da viagem — sincronizado em tempo real entre todos os participantes, com
uma versão impressa para levar na mochila.

### Princípios

1. **A viagem é do grupo, não de uma pessoa.** Tudo que um participante edita aparece para os
   outros na hora.
2. **Funciona na estrada.** PWA instalável, pensado para celular, resistente a conexão ruim.
3. **O papel ainda importa.** Em aeroporto e parque, celular descarrega. O impresso é um recurso
   de primeira classe, não um "exportar" escondido.
4. **Sem trabalho duplicado.** A história e o impresso se montam a partir do que já foi cadastrado.

---

## 2. Usuários

| Perfil | Descrição | Necessidade principal |
|--------|-----------|----------------------|
| **Organizador** | Monta o roteiro, cadastra reservas, convida o grupo | Ver tudo em um lugar e não perder detalhe de reserva |
| **Participante** | Acompanha e lança as próprias despesas | Saber o que vai acontecer hoje e quanto deve |
| **Viajante offline** | Qualquer um, durante a viagem | Consultar o roteiro sem depender de rede |

---

## 3. Escopo atual

### 3.1 Autenticação e viagens

- Cadastro e login por e-mail/senha (Firebase Auth).
- Uma pessoa cria a viagem (nome, destino, data de início e fim).
- Convite por e-mail. Se o convidado ainda não tem conta, fica em `pendingParticipants` e entra
  automaticamente ao se cadastrar.
- Múltiplas viagens por usuário, com arquivamento. A viagem ativa é a primeira não arquivada.

### 3.2 Aba Roteiro

Coração do app.

- Eventos com tipo (voo, transfer, hospedagem, passeio, alimentação), título, data, hora, local
  e descrição.
- Agrupamento por dia, em ordem cronológica, com timeline visual.
- Contagem regressiva para o início da viagem; durante a viagem, mostra o dia atual.
- Local clicável abre o Google Maps.
- Alteração do período da viagem.
- **Impressão / PDF** (ver seção 4).

### 3.3 Aba Financeiro

- Despesas com categoria, valor, quem pagou, entre quem dividir e status (pago/pendente).
- Cálculo de saldo por pessoa: quanto pagou × quanto deveria pagar → quem recebe, quem paga.
- Despesas pendentes ficam fora dos totais.
- Exportação em PDF do relatório.

### 3.4 Aba História

Narrativa automática montada a partir dos dados da viagem — sem digitar nada.

- Duração, período e participantes.
- Seções por tipo de evento (voos, hospedagem, passeios, gastronomia).
- Resumo financeiro: total, distribuição por categoria e saldo por participante.
- Exporta em `.txt`, `.md` e PDF; ou copia para a área de transferência.
- Só considera eventos dentro do período da viagem.

### 3.5 Aba Câmbio

- Conversão de moeda com taxa configurável, persistida localmente.

### 3.6 Plataforma

- PWA instalável, com service worker e aviso de nova versão disponível.
- Regras de segurança no Firestore: só participantes leem/escrevem a viagem.
- Sanitização de HTML (DOMPurify) na renderização da história.

---

## 4. Roteiro impresso (entregue na v1.1)

### Problema

Durante a viagem o roteiro precisa existir fora do celular: bateria acaba, roaming falha, e em
fila de embarque ninguém quer abrir app. Fora isso, dá segurança ter o comprovante do dia na mão.

### Solução

Botão **Imprimir Roteiro** na aba Roteiro, abrindo um diálogo com opções.

**Requisitos atendidos**

| # | Requisito | Como |
|---|-----------|------|
| R1 | Refletir sempre o roteiro atual | O PDF é montado do mesmo agrupamento que a tela exibe |
| R2 | Servir para gerenciar a viagem no papel | Caixas de marcação (☐) por evento, opcionais |
| R3 | Escolher o que entra | Locais, descrições, viajantes, espaço para anotações |
| R4 | Imprimir direto ou salvar | "Imprimir" abre o diálogo do navegador; "Baixar PDF" salva |
| R5 | Não pesar o app | jsPDF carregado sob demanda, só ao clicar |
| R6 | Legível e profissional | Texto vetorial (não print de tela), cabeçalho, tipos coloridos, rodapé com data de atualização e paginação |

**Regras de layout**

- Cabeçalho de dia nunca fica órfão: só entra na página se o primeiro evento couber junto.
- Evento nunca é cortado no meio entre páginas.
- Rodapé em toda página: nome da viagem, data/hora de geração e "Página X de Y".

### Não-objetivos (por ora)

- Editar o PDF depois de gerado.
- Enviar o PDF por e-mail pelo app.
- Impressão só de um intervalo de dias.

---

## 5. Requisitos não funcionais

| Área | Requisito |
|------|-----------|
| **Performance** | Abrir uma aba não deve baixar bibliotecas que ela não usa naquele momento |
| **Offline** | Roteiro consultável sem rede (cache do PWA) |
| **Fuso horário** | Um evento marcado às 08:00 aparece às 08:00 para todos, em qualquer fuso |
| **Dados legados** | Nenhuma tela pode quebrar por documento antigo com campo faltando |
| **Consistência** | O mesmo número (ex.: total gasto) não pode divergir entre abas |
| **Segurança** | Só participantes acessam a viagem; nenhum segredo no cliente além das chaves públicas do Firebase |
| **Acessibilidade de uso** | Interface em pt-BR, mobile-first, alvos de toque confortáveis |

---

## 6. Decisões técnicas relevantes

**PDF gerado por texto, não por captura de tela.** A alternativa (html2canvas) produziria um
retrato da interface: pesado, texto não selecionável, dependente de gradientes e animações. Montar
o documento a partir dos dados dá controle de quebra de página e um resultado legível na impressão.

**Datas de evento em UTC.** Garante que o horário não mude conforme o fuso do aparelho. O custo é
que toda leitura precisa usar getters UTC — a origem de bugs recorrentes. Ver `CLAUDE.md`.

**Estado global em Context, sem biblioteca externa.** O app tem uma viagem ativa por vez e poucos
dados; `TripContext` com `onSnapshot` resolve sem Redux/Zustand.

**Limpeza de texto para PDF.** Emojis nos títulos são comuns e quebram a codificação da fonte
padrão do jsPDF. Todo texto passa por um filtro que preserva acentuação e descarta o que a fonte
não representa.

---

## 7. Backlog

### Correções conhecidas

- [ ] `manualStory` em `HistoriaPage` não tem interface de edição — o estado existe mas nunca muda.
      Decidir: implementar edição manual da história ou remover o código morto.
- [ ] A História considera todas as despesas da viagem, sem filtrar pelo período. Se uma despesa
      tiver data fora do intervalo, ela entra no total mesmo assim.
- [ ] Listas do Markdown viram `<li>` sem `<ul>` na renderização da história.
- [ ] Muitos `console.log` de debug no código (removidos no build de produção pelo terser, mas
      poluem o desenvolvimento).

### Melhorias

- [ ] Imprimir apenas um intervalo de dias do roteiro.
- [ ] Anexar comprovantes (foto/PDF) a um evento ou despesa.
- [ ] Notificação do próximo evento durante a viagem.
- [ ] Checklist de bagagem por viagem.
- [ ] Múltiplas moedas na aba Financeiro, integrada ao Câmbio.
- [ ] Editar/remover participante já aceito.

---

## 8. Métricas de sucesso

Este é um app de uso pessoal/familiar. Sucesso não é escala, é confiança:

1. O grupo usa o app como fonte única do roteiro durante a viagem inteira.
2. Ninguém precisa refazer conta de divisão de despesa em outro lugar.
3. O roteiro impresso é usado na viagem sem precisar de correção à mão.
4. Nenhuma tela quebra com os dados reais das viagens salvas.
