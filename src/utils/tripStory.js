/**
 * Monta a História da viagem: um resumo dia a dia dos eventos mais um bloco
 * "Quanto custou" com os mesmos números da aba Financeiro.
 *
 * Devolve dados estruturados (`days`, `finance`) para o PDF desenhar do seu
 * jeito e o texto em Markdown (`text`) para a tela, o .md, o .txt e o "Copiar".
 * Os dois saem da mesma passada, então nunca contam coisas diferentes.
 */
import {
  toDate,
  toUtcDayStart,
  toUtcDayEnd,
  toUtcDateKey,
  utcDateFromKey,
  formatUtcDate,
  formatUtcWeekday,
  formatUtcShortDate,
  formatUtcTime
} from './dateUtils';

export const EVENT_TYPE_META = {
  voo: { emoji: '✈️', label: 'Voo' },
  transfer: { emoji: '🚗', label: 'Transfer' },
  hospedagem: { emoji: '🏨', label: 'Hospedagem' },
  passeio: { emoji: '📍', label: 'Passeio' },
  alimentacao: { emoji: '🍽️', label: 'Refeição' }
};

// Rótulos das categorias de despesa. Atenção: a categoria é `passeios`
// (plural), diferente do tipo de evento `passeio` - ver CLAUDE.md.
export const EXPENSE_CATEGORY_LABELS = {
  aereo: 'Aéreo',
  transfer: 'Transfer',
  hospedagem: 'Hospedagem',
  passeios: 'Passeios',
  alimentacao: 'Alimentação',
  outros: 'Outros'
};

export const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL'
}).format(Number(value) || 0);

const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : '');

/**
 * Primeira frase da descrição, curta. O detalhe completo (checklists,
 * endereços, telefones) fica no Roteiro; aqui é só o gancho da história.
 */
export const summarizeDescription = (description, maxLength = 120) => {
  const text = String(description || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';

  // Corta na primeira frase (ponto, exclamação, interrogação ou ponto e
  // vírgula). Dois-pontos não conta: "Prioridades: X, Y" perderia o conteúdo.
  const match = text.match(/^(.+?[.!?;])(\s|$)/);
  let sentence = (match ? match[1] : text).replace(/[.;]+$/, '').trim();

  if (sentence.length > maxLength) {
    const cut = sentence.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(' ');
    sentence = `${cut.slice(0, lastSpace > 60 ? lastSpace : maxLength).trim()}…`;
  }
  return sentence;
};

const amountOf = (expense) => {
  const value = Number(expense?.amount);
  return isNaN(value) ? 0 : value;
};

/**
 * @param {Object} params
 * @param {Object} params.trip - viagem atual (name, destination, startDate, endDate, caixas)
 * @param {Array} params.events
 * @param {Array} params.expenses
 * @param {Array<string>} params.participantNames - nomes já resolvidos
 * @returns {null | { text, events, days, finance, intro }}
 */
export const buildTripStory = ({ trip, events = [], expenses = [], participantNames = [] }) => {
  if (!trip || events.length === 0) return null;

  // ===== Período e filtro (tudo em UTC - ver CLAUDE.md) =====
  const startDate = trip.startDate || trip.start_date;
  const endDate = trip.endDate || trip.end_date;
  let tripStart = startDate ? toUtcDayStart(startDate) : null;
  let tripEnd = endDate ? toUtcDayEnd(endDate) : null;

  let filteredEvents = events.filter(event => toDate(event.date));
  if (tripStart && tripEnd) {
    filteredEvents = filteredEvents.filter(event => {
      const eventDate = toDate(event.date);
      return eventDate >= tripStart && eventDate <= tripEnd;
    });
  }
  if (filteredEvents.length === 0) return null;

  const sortedEvents = [...filteredEvents].sort((a, b) => toDate(a.date) - toDate(b.date));

  if (!tripStart || !tripEnd) {
    tripStart = toUtcDayStart(toDate(sortedEvents[0].date));
    tripEnd = toUtcDayEnd(toDate(sortedEvents[sortedEvents.length - 1].date));
  }
  const firstDay = toUtcDayStart(tripStart);
  const lastDay = toUtcDayStart(tripEnd);
  const durationDays = Math.max(1, Math.round((lastDay - firstDay) / 86400000) + 1);

  // ===== Dia a dia =====
  const byDay = new Map();
  sortedEvents.forEach(event => {
    const key = toUtcDateKey(event.date);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(event);
  });

  const days = [...byDay.entries()].map(([key, dayEvents]) => {
    const date = utcDateFromKey(key);
    const dayNumber = Math.round((date - firstDay) / 86400000) + 1;
    return {
      key,
      dayNumber,
      weekday: capitalize(formatUtcWeekday(date)),
      dateLabel: formatUtcDate(date, { withYear: false }),
      events: dayEvents.map(event => {
        const meta = EVENT_TYPE_META[event.type] || { emoji: '•', label: 'Evento' };
        return {
          id: event.id,
          type: event.type,
          emoji: meta.emoji,
          typeLabel: meta.label,
          // Só mostra hora se o evento foi salvo com hora (00:00 sem `time` = dia todo)
          time: event.time ? formatUtcTime(event.date) : '',
          title: String(event.title || 'Sem título').trim(),
          location: String(event.location || '').trim(),
          summary: summarizeDescription(event.description)
        };
      })
    };
  });

  // ===== Quanto custou (mesma regra do Financeiro) =====
  const paidExpenses = expenses.filter(exp => !exp.status || exp.status === 'pago');
  const pendingExpenses = expenses.filter(exp => exp.status === 'pendente');
  const totalPaid = paidExpenses.reduce((sum, exp) => sum + amountOf(exp), 0);
  const totalPending = pendingExpenses.reduce((sum, exp) => sum + amountOf(exp), 0);
  const total = totalPaid + totalPending;

  const byCategoryMap = expenses.reduce((acc, exp) => {
    const category = exp.category || 'outros';
    acc[category] = (acc[category] || 0) + amountOf(exp);
    return acc;
  }, {});
  const byCategory = Object.entries(byCategoryMap)
    .filter(([, amount]) => amount > 0)
    .sort(([, a], [, b]) => b - a)
    .map(([category, amount]) => ({
      category,
      label: EXPENSE_CATEGORY_LABELS[category] || capitalize(category),
      amount,
      percent: total > 0 ? Math.round((amount / total) * 100) : 0
    }));

  const caixas = Array.isArray(trip.caixas) ? trip.caixas : [];
  const caixaIds = new Set(caixas.map(caixa => caixa.id));
  let paidWithTrip = 0;
  const spentByCaixa = {};
  expenses.forEach(exp => {
    if (exp.caixaId && caixaIds.has(exp.caixaId)) {
      spentByCaixa[exp.caixaId] = (spentByCaixa[exp.caixaId] || 0) + amountOf(exp);
    } else {
      paidWithTrip += amountOf(exp);
    }
  });
  const caixasResumo = caixas.map(caixa => {
    const reserved = Number(caixa.amount) || 0;
    const spent = spentByCaixa[caixa.id] || 0;
    return { id: caixa.id, name: caixa.name, reserved, spent, balance: reserved - spent };
  });

  const finance = {
    count: expenses.length,
    total,
    totalPaid,
    totalPending,
    byCategory,
    paidWithTrip,
    caixas: caixasResumo
  };

  // ===== Intro =====
  const names = participantNames.filter(Boolean);
  const who = names.length <= 1
    ? names.join('')
    : `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  const intro = {
    name: trip.name || 'Viagem',
    destination: trip.destination || '',
    who,
    durationDays,
    period: `${formatUtcDate(firstDay, { withYear: false })} a ${formatUtcDate(lastDay)}`,
    shortPeriod: `${formatUtcShortDate(firstDay).slice(0, 5)} a ${formatUtcShortDate(lastDay)}`
  };

  // ===== Texto (Markdown) =====
  let text = `# ${intro.name}\n\n`;
  text += `${durationDays} ${durationDays === 1 ? 'dia' : 'dias'} · ${intro.period}`;
  if (intro.destination) text += ` · ${intro.destination}`;
  if (who) text += `\n${who}`;
  text += `\n\n## Dia a dia\n\n`;

  days.forEach(day => {
    text += `### ${day.weekday}, ${day.dateLabel} — Dia ${day.dayNumber}\n\n`;
    day.events.forEach(event => {
      let line = `- ${event.emoji} `;
      if (event.time) line += `${event.time} · `;
      line += `**${event.title}**`;
      if (event.location) line += ` (${event.location})`;
      if (event.summary) line += ` — ${event.summary}`;
      text += `${line}\n`;
    });
    text += `\n`;
  });

  text += `## Quanto custou\n\n`;
  if (finance.count === 0) {
    text += `Nenhuma despesa lançada ainda.\n\n`;
  } else {
    text += `Total da viagem: **${formatCurrency(total)}**`;
    if (totalPending > 0) {
      text += ` (${formatCurrency(totalPaid)} pagos · ${formatCurrency(totalPending)} a pagar)`;
    }
    text += `\n\n`;

    if (byCategory.length) {
      text += byCategory.map(item => `${item.label} ${item.percent}%`).join(' · ') + `\n\n`;
      byCategory.forEach(item => {
        text += `- ${item.label}: ${formatCurrency(item.amount)}\n`;
      });
      text += `\n`;
    }

    if (caixasResumo.length) {
      text += `Pago com: Viagem ${formatCurrency(paidWithTrip)}`;
      caixasResumo.filter(c => c.spent > 0).forEach(c => {
        text += ` · ${c.name} ${formatCurrency(c.spent)}`;
      });
      text += `\n\n### Caixas\n\n`;
      caixasResumo.forEach(c => {
        const situacao = c.balance < -0.005
          ? `passou ${formatCurrency(Math.abs(c.balance))}`
          : `sobra ${formatCurrency(c.balance)}`;
        text += `- ${c.name}: reservou ${formatCurrency(c.reserved)}, gastou ${formatCurrency(c.spent)} — ${situacao}\n`;
      });
      text += `\n`;
    }
  }

  text += `---\n\n*Gerado em ${new Date().toLocaleDateString('pt-BR')}*\n`;

  return { text, events: sortedEvents, days, finance, intro };
};
