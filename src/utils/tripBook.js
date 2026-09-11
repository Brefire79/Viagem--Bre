/**
 * Modo Livro da História: transforma a estrutura dia a dia (utils/tripStory.js)
 * em capítulos narrados em primeira pessoa do plural ("embarcamos", "nossa
 * viagem"), com os endereços dentro da frase.
 *
 * Os endereços vêm marcados entre ‹ e › para a tela e o PDF mostrarem em
 * letra menor; o texto puro (TXT/MD/copiar) troca os marcadores por parênteses.
 */
import { formatCurrency } from './tripStory';

const ADDR_OPEN = '‹';
const ADDR_CLOSE = '›';

export const splitAddressSegments = (paragraph) => {
  // "texto ‹endereço› texto" -> [{ text, addr: false }, { text, addr: true }, ...]
  const parts = [];
  const regex = /‹([^›]*)›/g;
  let last = 0;
  let match;
  while ((match = regex.exec(paragraph)) !== null) {
    if (match.index > last) parts.push({ text: paragraph.slice(last, match.index), addr: false });
    parts.push({ text: match[1], addr: true });
    last = regex.lastIndex;
  }
  if (last < paragraph.length) parts.push({ text: paragraph.slice(last), addr: false });
  return parts;
};

export const plainParagraph = (paragraph) => paragraph.replace(/‹([^›]*)›/g, '($1)');

const lower = (text) => text.charAt(0).toLowerCase() + text.slice(1);
const upper = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const trimDot = (text) => String(text || '').replace(/[.\s]+$/, '');

// Período do dia a partir da hora "HH:MM"
const periodOf = (time) => {
  if (!time) return null;
  const hour = Number(time.split(':')[0]);
  if (isNaN(hour)) return null;
  if (hour < 6) return 'madrugada';
  if (hour < 12) return 'manhã';
  if (hour < 15) return 'almoço';
  if (hour < 18) return 'tarde';
  if (hour < 20) return 'fim da tarde';
  return 'noite';
};

const PERIOD_OPENER = {
  madrugada: 'De madrugada',
  manhã: 'Pela manhã',
  almoço: 'Na hora do almoço',
  tarde: 'À tarde',
  'fim da tarde': 'No fim da tarde',
  noite: 'À noite'
};

const FOLLOW_UPS = ['Logo depois', 'Em seguida', 'Mais tarde', 'Na sequência', 'Depois'];

// Verbo por tipo de evento. `nth` é a ordem do tipo dentro do dia.
const verbFor = (event, nth) => {
  // "Jantar no X" já traz a refeição no título: vira "foi hora do jantar no X"
  if (event.type === 'alimentacao' && /^(jantar|almoço|almoco|café|cafe|lanche|brunch)/i.test(event.title)) {
    return 'foi hora do';
  }
  switch (event.type) {
    case 'voo':
      return nth === 0 ? 'embarcamos no' : 'seguimos no';
    case 'transfer':
      return 'seguimos com o transfer:';
    case 'hospedagem':
      return nth === 0 ? 'chegamos ao' : 'trocamos para o';
    case 'passeio':
      return nth === 0 ? 'fomos conhecer' : 'visitamos';
    case 'alimentacao':
      return 'comemos no';
    default:
      return 'tivemos';
  }
};

const withAddress = (event) => (event.location ? ` ${ADDR_OPEN}${event.location}${ADDR_CLOSE}` : '');

const sentenceFor = (event, index, nthOfType, prevPeriod) => {
  const period = periodOf(event.time);
  let opener;
  if (index === 0) {
    opener = period ? `${PERIOD_OPENER[period]}, às ${event.time},` : 'Nesse dia';
  } else if (period && period !== prevPeriod) {
    opener = `${PERIOD_OPENER[period]}, às ${event.time},`;
  } else if (period) {
    opener = `${FOLLOW_UPS[index % FOLLOW_UPS.length]}, às ${event.time},`;
  } else {
    opener = 'Também';
  }

  const verb = verbFor(event, nthOfType);
  const title = verb === 'foi hora do' ? lower(trimDot(event.title)) : trimDot(event.title);
  let body = `${verb} ${title}${withAddress(event)}`;
  if (event.summary) body += ` — ${lower(trimDot(event.summary))}`;
  return { text: `${opener} ${body}.`, body, period: period || prevPeriod };
};

const chapterTitle = (day, isFirst, isLast) => {
  const types = day.events.map(e => e.type);
  if (isFirst && types.includes('voo')) return 'A partida';
  if (isLast && types.includes('voo')) return 'A volta para casa';
  const passeio = day.events.find(e => e.type === 'passeio');
  if (passeio) {
    // Título curto: até a primeira vírgula/travessão, no máximo cinco palavras
    const head = trimDot(passeio.title).split(/\s*[,—–:(]\s*|\s+-\s+/)[0].trim();
    const words = head.split(/\s+/).slice(0, 5).join(' ');
    return words.length > 42 ? `${words.slice(0, 40).trim()}…` : words;
  }
  if (types.includes('hospedagem')) return 'Chegada ao hotel';
  if (types.includes('voo')) return 'Dia de voo';
  return `Dia ${day.dayNumber}`;
};

const listInProse = (items) => {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
};

/**
 * @param {Object} story - retorno de buildTripStory (intro, days, finance)
 * @returns {null | { chapters, epilogue, closing, text }}
 */
export const buildTripBook = (story) => {
  if (!story?.days?.length) return null;
  const { intro, days, finance } = story;
  const lastIndex = days.length - 1;

  const chapters = days.map((day, dayIndex) => {
    const isFirst = dayIndex === 0;
    const isLast = dayIndex === lastIndex;
    const typeCount = {};
    const sentences = [];
    let prevPeriod = null;

    day.events.forEach((event, index) => {
      const nth = typeCount[event.type] || 0;
      typeCount[event.type] = nth + 1;
      const { text, body, period } = sentenceFor(event, index, nth, prevPeriod);
      prevPeriod = period;

      // Abertura do primeiro capítulo: "Nossa viagem começou de madrugada: às 03:50 embarcamos..."
      if (isFirst && index === 0) {
        const firstPeriod = periodOf(event.time);
        sentences.push(firstPeriod
          ? `Nossa viagem começou ${lower(PERIOD_OPENER[firstPeriod])}: às ${event.time} ${body}.`
          : `Nossa viagem começou. ${upper(body)}.`);
      } else {
        sentences.push(text);
      }
    });

    if (isLast && !isFirst && sentences.length) {
      sentences.unshift('Chegou o dia da volta.');
    }

    // Dois a três eventos por parágrafo, para o texto respirar
    const paragraphs = [];
    for (let i = 0; i < sentences.length; i += 3) {
      paragraphs.push(sentences.slice(i, i + 3).join(' '));
    }

    return {
      number: dayIndex + 1,
      title: chapterTitle(day, isFirst, isLast),
      dateLabel: `${day.weekday}, ${day.dateLabel}`,
      paragraphs
    };
  });

  // Epílogo: os números do Financeiro em prosa
  let epilogue = '';
  if (finance && finance.count > 0) {
    epilogue = `Ao todo, a viagem custou ${formatCurrency(finance.total)}`;
    if (finance.totalPending > 0) {
      epilogue += ` — ${formatCurrency(finance.totalPaid)} já pagos e ${formatCurrency(finance.totalPending)} a pagar`;
    }
    epilogue += '.';

    if (finance.byCategory.length) {
      const [first, ...rest] = finance.byCategory;
      epilogue += ` A maior fatia foi ${lower(first.label)} (${first.percent}%)`;
      if (rest.length) {
        epilogue += `, seguida de ${listInProse(rest.map(c => `${lower(c.label)} (${c.percent}%)`))}`;
      }
      epilogue += '.';
    }

    if (finance.caixas.length) {
      const usadas = finance.caixas.filter(c => c.spent > 0);
      if (usadas.length === 0) {
        epilogue += ' Tudo saiu do caixa comum da viagem';
      } else {
        epilogue += ` ${formatCurrency(finance.paidWithTrip)} saíram do caixa comum e ${listInProse(usadas.map(c => `a caixa ${c.name} cobriu ${formatCurrency(c.spent)}`))}`;
      }
      const situacao = finance.caixas.map(c => (
        c.balance < -0.005
          ? `${c.name} passou ${formatCurrency(Math.abs(c.balance))} do reservado`
          : `${c.name} ainda tem ${formatCurrency(c.balance)} dos ${formatCurrency(c.reserved)} reservados`
      ));
      epilogue += `; ${listInProse(situacao)}.`;
    }
  }

  const closing = {
    who: intro.who,
    date: new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
  };

  // ===== Texto (Markdown) =====
  let text = `# ${intro.name}\n\n`;
  text += `${intro.durationDays} ${intro.durationDays === 1 ? 'dia' : 'dias'} · ${intro.period}`;
  if (intro.destination) text += ` · ${intro.destination}`;
  if (intro.who) text += `\n${intro.who}`;
  text += '\n\n';
  chapters.forEach(chapter => {
    text += `## Capítulo ${chapter.number} — ${chapter.title}\n*${chapter.dateLabel}*\n\n`;
    chapter.paragraphs.forEach(p => { text += `${plainParagraph(p)}\n\n`; });
  });
  if (epilogue) text += `## Epílogo — Quanto custou o sonho\n\n${epilogue}\n\n`;
  text += `— Fim —\n\n*${[closing.who, `escrito em ${closing.date}`].filter(Boolean).join(' · ')}*\n`;

  return { chapters, epilogue, closing, text };
};
