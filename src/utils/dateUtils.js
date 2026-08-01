/**
 * Helpers de data em UTC.
 *
 * Eventos são gravados como instantes UTC (`Date.UTC(...)` em RoteiroPage) para
 * que "2 de outubro 08:00" seja o mesmo dia/hora em qualquer fuso.
 *
 * A consequência é que NÃO se pode formatar essas datas com o `format()` do
 * date-fns nem com `toLocaleDateString()`: os dois usam o fuso local e, no
 * Brasil (UTC-3), a meia-noite UTC vira 21h do dia anterior — o dia da semana e
 * a data saem um dia atrasados.
 *
 * Use sempre as funções deste arquivo para exibir datas de evento e de viagem.
 */

export const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

export const WEEKDAY_NAMES = [
  'domingo', 'segunda-feira', 'terça-feira', 'quarta-feira',
  'quinta-feira', 'sexta-feira', 'sábado'
];

/**
 * Converte Timestamp do Firestore, Date, número ou string para Date.
 * @returns {Date|null} null quando o valor é inválido
 */
export const toDate = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const parsed = value?.toDate ? value.toDate() : (value instanceof Date ? value : new Date(value));
  return isNaN(parsed) ? null : parsed;
};

/**
 * Início do dia (00:00:00.000) em UTC.
 * Aceita 'yyyy-MM-dd' (datas da viagem) ou Date/Timestamp (datas de evento).
 */
export const toUtcDayStart = (value) => {
  if (!value) return null;

  if (typeof value === 'string' && value.includes('-')) {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  const parsed = toDate(value);
  if (!parsed) return null;

  return new Date(Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
    0, 0, 0, 0
  ));
};

/** Último instante do dia (23:59:59.999) em UTC. */
export const toUtcDayEnd = (value) => {
  const start = toUtcDayStart(value);
  if (!start) return null;
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
};

/** Chave 'yyyy-MM-dd' a partir dos componentes UTC. */
export const toUtcDateKey = (value) => {
  const date = toDate(value);
  if (!date) return '';
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
};

/** Date em UTC a partir de uma chave 'yyyy-MM-dd'. */
export const utcDateFromKey = (dateKey) => toUtcDayStart(dateKey);

/** Ex.: "2 de outubro de 2026" (ou sem o ano com `withYear: false`). */
export const formatUtcDate = (value, { withYear = true } = {}) => {
  const date = toDate(value);
  if (!date) return '';

  const day = date.getUTCDate();
  const month = MONTH_NAMES[date.getUTCMonth()];

  return withYear
    ? `${day} de ${month} de ${date.getUTCFullYear()}`
    : `${day} de ${month}`;
};

/** Ex.: "sexta-feira". Substitui format(date, 'EEEE'), que usa o fuso local. */
export const formatUtcWeekday = (value) => {
  const date = toDate(value);
  if (!date) return '';
  return WEEKDAY_NAMES[date.getUTCDay()];
};

/** Ex.: "02/10/2026". */
export const formatUtcShortDate = (value) => {
  const date = toDate(value);
  if (!date) return '';
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}/${date.getUTCFullYear()}`;
};

/** Ex.: "08:30". */
export const formatUtcTime = (value) => {
  const date = toDate(value);
  if (!date) return '';
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
};
