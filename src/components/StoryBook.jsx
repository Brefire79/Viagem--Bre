import React from 'react';
import { motion } from 'framer-motion';
import { splitAddressSegments } from '../utils/tripBook';

/** Parágrafo com os endereços em letra menor e cor suave. */
const BookParagraph = ({ text, dropCap }) => (
  <p className={`font-display text-[17px] leading-[1.8] text-dark mb-4 ${dropCap ? 'story-dropcap' : ''}`}>
    {splitAddressSegments(text).map((part, index) => (
      part.addr
        ? <span key={index} className="font-sans text-[12px] text-sand-600">({part.text})</span>
        : <React.Fragment key={index}>{part.text}</React.Fragment>
    ))}
  </p>
);

/**
 * Modo Livro da História: uma "página de papel" com capítulos por dia,
 * narrativa corrida e epílogo com os valores.
 */
const StoryBook = ({ intro, book }) => {
  if (!book) return null;

  return (
    <motion.article
      className="rounded-2xl bg-sand-100 border border-sand-300 shadow-sm px-6 py-8 md:px-12 md:py-12"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Frontispício */}
      <header className="text-center mb-10 pb-8 border-b border-dashed border-sand-400">
        <p className="text-[11px] uppercase tracking-[0.25em] text-aqua mb-3">História da viagem</p>
        <h2 className="font-display text-3xl md:text-4xl font-bold text-dark mb-2">{intro.name}</h2>
        <p className="text-sm text-sand-600">
          {intro.durationDays} {intro.durationDays === 1 ? 'dia' : 'dias'} · {intro.period}
          {intro.destination ? ` · ${intro.destination}` : ''}
        </p>
        {intro.who && <p className="font-display italic text-dark-100 mt-3">{intro.who}</p>}
      </header>

      {book.chapters.map((chapter, index) => (
        <section key={chapter.number} className={index > 0 ? 'mt-10 pt-8 border-t border-dashed border-sand-400' : ''}>
          <p className="text-[11px] uppercase tracking-[0.22em] text-aqua">Capítulo {chapter.number}</p>
          <h3 className="font-display text-2xl font-bold text-dark mt-1">{chapter.title}</h3>
          <p className="text-sm text-sand-600 mb-5">{chapter.dateLabel}</p>
          {chapter.paragraphs.map((paragraph, pIndex) => (
            <BookParagraph key={pIndex} text={paragraph} dropCap={pIndex === 0} />
          ))}
        </section>
      ))}

      {book.epilogue && (
        <section className="mt-10 pt-8 border-t border-dashed border-sand-400">
          <p className="text-[11px] uppercase tracking-[0.22em] text-aqua">Epílogo</p>
          <h3 className="font-display text-2xl font-bold text-dark mt-1 mb-5">Quanto custou o sonho</h3>
          <div className="rounded-xl bg-sand-200 px-5 py-4">
            <p className="font-display text-[16px] leading-[1.8] text-dark m-0">{book.epilogue}</p>
          </div>
        </section>
      )}

      <footer className="text-center mt-10 text-sm text-sand-600">
        <p className="font-display text-dark mb-1">— Fim —</p>
        <p>{[book.closing.who, `escrito em ${book.closing.date}`].filter(Boolean).join(' · ')}</p>
      </footer>
    </motion.article>
  );
};

export default StoryBook;
