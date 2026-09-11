import React from 'react';
import { motion } from 'framer-motion';
import {
  Plane, Car, Hotel, MapPin, UtensilsCrossed, Calendar, Wallet, PiggyBank, Tag
} from 'lucide-react';
import { formatCurrency } from '../utils/tripStory';

// Ícone e cor por tipo de evento (mesma paleta do Roteiro e dos PDFs)
const TYPE_STYLE = {
  voo: { icon: Plane, bg: 'bg-ocean', text: 'text-ocean' },
  transfer: { icon: Car, bg: 'bg-aqua', text: 'text-aqua' },
  hospedagem: { icon: Hotel, bg: 'bg-purple-500', text: 'text-purple-600' },
  passeio: { icon: MapPin, bg: 'bg-green-600', text: 'text-green-700' },
  alimentacao: { icon: UtensilsCrossed, bg: 'bg-orange-500', text: 'text-orange-600' }
};
const FALLBACK_STYLE = { icon: Tag, bg: 'bg-gray-500', text: 'text-gray-600' };

const CATEGORY_BAR = {
  aereo: 'bg-ocean',
  transfer: 'bg-aqua',
  hospedagem: 'bg-purple-500',
  passeios: 'bg-green-600',
  alimentacao: 'bg-orange-500',
  outros: 'bg-gray-500'
};

/**
 * Apresentação visual da História: cabeçalho da viagem, um cartão por dia com
 * a linha do tempo dos eventos, e o bloco "Quanto custou". Recebe a mesma
 * estrutura que gera o texto (utils/tripStory.js), então mostra exatamente o
 * que vai para o TXT/MD/PDF.
 */
const StoryTimeline = ({ story }) => {
  if (!story?.days) return null;
  const { intro, days, finance } = story;

  return (
    <div className="space-y-6">
      {/* Capa */}
      <motion.div
        className="rounded-2xl bg-gradient-to-br from-ocean-700 to-ocean text-white p-6 md:p-8 shadow-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <p className="text-xs uppercase tracking-[0.2em] text-ocean-200 mb-2">História da viagem</p>
        <h2 className="text-3xl md:text-4xl font-bold mb-3">{intro.name}</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ocean-100">
          <span className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            {intro.durationDays} {intro.durationDays === 1 ? 'dia' : 'dias'} · {intro.period}
          </span>
          {intro.destination && (
            <span className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              {intro.destination}
            </span>
          )}
        </div>
        {intro.who && <p className="mt-3 text-sm text-white/90">{intro.who}</p>}
      </motion.div>

      {/* Dia a dia */}
      {days.map((day, dayIndex) => (
        <motion.section
          key={day.key}
          className="card p-0 overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + dayIndex * 0.05 }}
        >
          <header className="flex items-center gap-4 px-5 py-4 bg-sand-100 border-b border-sand-300">
            <div className="w-14 h-14 rounded-xl bg-aqua text-white flex flex-col items-center justify-center leading-none flex-shrink-0">
              <span className="text-[10px] uppercase tracking-wider opacity-90">dia</span>
              <span className="text-2xl font-bold">{day.dayNumber}</span>
            </div>
            <div>
              <h3 className="text-lg font-bold text-dark leading-tight">{day.weekday}</h3>
              <p className="text-sm text-sand-600">{day.dateLabel}</p>
            </div>
            <span className="ml-auto text-xs text-sand-500">
              {day.events.length} {day.events.length === 1 ? 'evento' : 'eventos'}
            </span>
          </header>

          <ol className="relative px-5 py-4">
            {/* Trilho da linha do tempo */}
            <span className="absolute left-[4.35rem] top-6 bottom-6 w-px bg-sand-300" aria-hidden="true" />

            {day.events.map((event) => {
              const style = TYPE_STYLE[event.type] || FALLBACK_STYLE;
              const Icon = style.icon;
              return (
                <li key={event.id} className="relative flex gap-3 py-2.5">
                  <span className="w-11 flex-shrink-0 pt-2 text-right font-mono text-xs font-semibold text-aqua">
                    {event.time || '—'}
                  </span>
                  <span className={`relative z-10 w-8 h-8 rounded-lg ${style.bg} text-white flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="font-semibold text-dark leading-snug">{event.title}</p>
                    {event.location && (
                      <p className="text-xs text-sand-600 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </p>
                    )}
                    {event.summary && (
                      <p className="text-sm text-dark-100 mt-1 leading-relaxed">{event.summary}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </motion.section>
      ))}

      {/* Quanto custou */}
      {finance && finance.count > 0 && (
        <motion.section
          className="card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 + days.length * 0.05 }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Wallet className="w-5 h-5 text-ocean" />
            <h3 className="text-xl font-bold text-dark">Quanto custou</h3>
          </div>

          <div className="flex flex-wrap items-end gap-x-6 gap-y-2 mb-5">
            <div>
              <p className="text-xs text-sand-500">Total da viagem</p>
              <p className="text-3xl font-black text-ocean">{formatCurrency(finance.total)}</p>
            </div>
            {finance.totalPending > 0 && (
              <div className="flex gap-2 pb-1">
                <span className="text-xs bg-green-100 text-green-800 px-2.5 py-1 rounded-full font-medium">
                  ✓ {formatCurrency(finance.totalPaid)} pagos
                </span>
                <span className="text-xs bg-orange-100 text-orange-800 px-2.5 py-1 rounded-full font-medium">
                  ⏳ {formatCurrency(finance.totalPending)} a pagar
                </span>
              </div>
            )}
          </div>

          <ul className="space-y-2.5 mb-5">
            {finance.byCategory.map((item) => (
              <li key={item.category}>
                <div className="flex items-baseline justify-between text-sm mb-1">
                  <span className="font-medium text-dark">{item.label}</span>
                  <span className="text-dark">
                    {formatCurrency(item.amount)}
                    <span className="text-xs text-sand-500 ml-2">{item.percent}%</span>
                  </span>
                </div>
                <div className="h-2 bg-sand-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${CATEGORY_BAR[item.category] || 'bg-teal-600'}`}
                    style={{ width: `${Math.max(item.percent, 2)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          {finance.caixas.length > 0 && (
            <div className="border-t border-sand-300 pt-4">
              <p className="text-sm text-dark mb-3">
                <span className="text-sand-500">Pago com:</span>{' '}
                <strong>Viagem {formatCurrency(finance.paidWithTrip)}</strong>
                {finance.caixas.filter(c => c.spent > 0).map(c => (
                  <span key={c.id}> · <strong>{c.name}</strong> {formatCurrency(c.spent)}</span>
                ))}
              </p>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {finance.caixas.map((c) => {
                  const pct = c.reserved > 0 ? Math.min((c.spent / c.reserved) * 100, 100) : (c.spent > 0 ? 100 : 0);
                  const passou = c.balance < -0.005;
                  return (
                    <li key={c.id} className="rounded-xl bg-sand-50 border border-sand-200 p-3">
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-semibold text-dark flex items-center gap-1">
                          <PiggyBank className="w-4 h-4 text-ocean" />
                          {c.name}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${passou ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {passou ? `passou ${formatCurrency(Math.abs(c.balance))}` : `sobra ${formatCurrency(c.balance)}`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-sand-200 rounded-full overflow-hidden mb-1">
                        <div className={`h-full ${passou ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-xs text-sand-600">
                        gastou {formatCurrency(c.spent)} de {formatCurrency(c.reserved)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </motion.section>
      )}
    </div>
  );
};

export default StoryTimeline;
