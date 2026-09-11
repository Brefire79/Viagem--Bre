import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrip } from '../contexts/TripContext';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Sparkles, Download, Copy, Check, Save, FileText, File } from 'lucide-react';
import { format } from 'date-fns';
import { pageVariants, storyParagraphVariants, buttonVariants, modalContentVariants } from '../utils/motionVariants';
import DOMPurify from 'dompurify';
import { buildTripStory, formatCurrency } from '../utils/tripStory';
import { buildTripBook } from '../utils/tripBook';
import StoryTimeline from '../components/StoryTimeline';
import StoryBook from '../components/StoryBook';
import { Clock, BookOpen as BookIcon } from 'lucide-react';

// Modo de leitura escolhido fica no aparelho (não é dado da viagem)
const MODE_KEY = 'historia-modo';
const readStoredMode = () => {
  try {
    const value = window.localStorage.getItem(MODE_KEY);
    return value === 'livro' ? 'livro' : 'timeline';
  } catch {
    return 'timeline';
  }
};

// Carimbo com data E hora no nome do arquivo. Só com a data, exportar duas vezes
// no mesmo dia fazia o navegador salvar "arquivo (1)" e manter o antigo intacto —
// abrir o arquivo original dava a impressão de que os dados não atualizaram.
const exportStamp = () => format(new Date(), "yyyy-MM-dd_HH'h'mm");

const HistoriaPage = () => {
  useAuth(); // mantém o hook no lugar caso a página volte a precisar do usuário
  const { currentTrip, events, expenses, participants, participantsData } = useTrip();
  const [copied, setCopied] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [manualStory, setManualStory] = useState("");
  const [mode, setMode] = useState(readStoredMode); // 'timeline' | 'livro'

  const changeMode = (next) => {
    setMode(next);
    try { window.localStorage.setItem(MODE_KEY, next); } catch { /* sem storage, segue em memória */ }
  };

  // Função para exportar PDF
  const handleExportPDF = async (format = mode) => {
    if (!currentTrip || !tripStory) {
      alert('Nenhuma história encontrada para exportar');
      return;
    }

    // O PDF desenha a partir da mesma estrutura (dias + finanças) que gerou o
    // texto da tela, então nunca lista evento ou valor que a História não mostra
    const exportData = {
      trip: {
        name: currentTrip.name,
        destination: currentTrip.destination,
        startDate: currentTrip.startDate,
        endDate: currentTrip.endDate
      },
      intro: tripStory.intro,
      days: tripStory.days,
      finance: tripStory.finance
    };

    const slug = currentTrip.name.toLowerCase().replace(/\s+/g, '-');
    const filename = `historia-${format === 'livro' ? 'livro-' : ''}${slug}-${exportStamp()}`;

    // Carrega o gerador de PDF sob demanda para não pesar a abertura da aba
    const { pdfExporter } = await import('../utils/pdfExporter');
    const success = format === 'livro' && tripBook
      ? await pdfExporter.exportTripBook({ ...exportData, book: tripBook }, filename)
      : await pdfExporter.exportTripStory(exportData, filename);

    setShowSaveMenu(false);

    if (success) {
      alert('PDF exportado com sucesso!');
    } else {
      alert('Erro ao exportar PDF. Tente novamente.');
    }
  };

  // Gera a história da viagem (dia a dia + quanto custou). A lógica mora em
  // utils/tripStory.js para o PDF usar exatamente a mesma estrutura.
  const tripStory = useMemo(() => {
    if (!currentTrip) return null;

    // Se o usuário editou manualmente, prioriza o texto manual
    if (manualStory) {
      return { text: manualStory };
    }

    const participantNames = participants
      .map(id => participantsData[id]?.displayName || '')
      .filter(Boolean);

    return buildTripStory({ trip: currentTrip, events, expenses, participantNames });
  }, [currentTrip, currentTrip?.startDate, currentTrip?.endDate, currentTrip?.caixas, currentTrip?.customCategories, events, expenses, participants, participantsData, manualStory]);

  // Modo Livro: capítulos narrados a partir da mesma estrutura
  const tripBook = useMemo(() => (tripStory?.days ? buildTripBook(tripStory) : null), [tripStory]);

  // Texto que vai para Copiar / TXT / MD: acompanha o modo escolhido
  const activeText = mode === 'livro' && tripBook ? tripBook.text : tripStory?.text;

  const handleCopy = async () => {
    if (tripStory) {
      await navigator.clipboard.writeText(activeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (tripStory) {
      const blob = new Blob([activeText], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historia-viagem-${currentTrip?.name?.replace(/\s+/g, '-').toLowerCase() || 'viagem'}-${exportStamp()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleSaveAsText = () => {
    if (tripStory) {
      // Remove markdown formatting para texto puro
      const plainText = activeText
        .replace(/^#+ /gm, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/^- /gm, '• ');

      const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historia-viagem-${currentTrip.name?.replace(/\s+/g, '-').toLowerCase() || 'viagem'}-${exportStamp()}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setShowSaveMenu(false);
    }
  };

  const handleSaveAsMarkdown = () => {
    handleDownload();
    setShowSaveMenu(false);
  };

  const handleSaveAsPDF = () => {
    handleExportPDF('timeline');
  };

  const handleSaveAsBookPDF = () => {
    handleExportPDF('livro');
  };

  // Preview da história em HTML com animação
  const renderStory = (storyObj) => {
    if (!storyObj || !storyObj.text) return [];
    
    // Divide o markdown em seções (por títulos ##)
    const sections = storyObj.text.split(/^## /gm).filter(s => s.trim());
    
    return sections.map((section, index) => {
      // Restaura o ## no início da seção
      const sectionWithTitle = index > 0 ? `## ${section}` : section;
      
      // Conversão simples de Markdown para HTML
      let html = sectionWithTitle
        // Títulos
        .replace(/^### (.+)$/gm, '<h3 class="text-lg font-bold text-dark mt-6 mb-2 pb-1 border-b border-sand-300">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-dark mt-8 mb-4 flex items-center gap-2">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 class="text-4xl font-bold text-dark mb-2">$1</h1>')
        // Negrito
        .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-dark">$1</strong>')
        // Lista
        .replace(/^- (.+)$/gm, '<li class="ml-1 mb-2 list-none text-dark-50 leading-relaxed">$1</li>')
        // Itálico
        .replace(/\*(.+?)\*/g, '<em class="italic">$1</em>')
        // Linha horizontal
        .replace(/^---$/gm, '<hr class="my-6 border-sand-300" />')
        // Parágrafos
        .replace(/^(?!<[h|l|u]|<\/|<hr)(.+)$/gm, '<p class="mb-4 text-dark-50 leading-relaxed">$1</p>');

      // Sanitizar HTML para prevenir XSS
      const sanitizedHtml = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: ['h1', 'h2', 'h3', 'h4', 'p', 'strong', 'em', 'ul', 'ol', 'li', 'hr'],
        ALLOWED_ATTR: ['class']
      });

      return { html: sanitizedHtml, index };
    });
  };

  if (!currentTrip) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card text-center py-12">
          <BookOpen className="w-16 h-16 text-sand-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-dark mb-2">Nenhuma viagem encontrada</h2>
          <p className="text-sand-500">Crie uma viagem para gerar sua história</p>
        </div>
      </div>
    );
  }

  if (!tripStory) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-dark mb-2">História da Viagem</h1>
          <p className="text-sand-500">
            A história será gerada automaticamente ao adicionar eventos
          </p>
        </div>

        <div className="card text-center py-12">
          <BookOpen className="w-16 h-16 text-sand-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-dark mb-2">Sua história está sendo escrita...</h3>
          <p className="text-sand-500 mb-4">
            Adicione eventos ao roteiro para gerar a história automática da sua viagem
          </p>
          <p className="text-sm text-sand-400">
            💡 A história será criada com base nos eventos e despesas da viagem
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="max-w-4xl mx-auto"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <motion.h1 
              className="text-3xl font-bold text-dark mb-2 flex items-center gap-3"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              >
                <Sparkles className="w-8 h-8 text-ocean" />
              </motion.div>
              História da Viagem
            </motion.h1>
            <motion.p
              className="text-sand-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              O que fizemos em cada dia e quanto custou, pronto para compartilhar
            </motion.p>

            {/* Mostra de onde vem o conteúdo, para conferir antes de exportar */}
            <motion.p
              className="text-xs text-sand-500 mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              {currentTrip.name} • {tripStory.events?.length ?? 0}{' '}
              {(tripStory.events?.length ?? 0) === 1 ? 'evento' : 'eventos'} em {tripStory.days?.length ?? 0}{' '}
              {(tripStory.days?.length ?? 0) === 1 ? 'dia' : 'dias'} •{' '}
              {tripStory.finance
                ? `total ${formatCurrency(tripStory.finance.total)}${tripStory.finance.totalPending > 0 ? ` (${formatCurrency(tripStory.finance.totalPending)} a pagar)` : ''}`
                : `${expenses.length} ${expenses.length === 1 ? 'despesa' : 'despesas'}`}
            </motion.p>
          </div>

        </div>
      </div>

      {/* Ações */}
      <motion.div 
        className="flex flex-wrap gap-3 mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {/* Botão principal: Salvar História */}
        <div className="relative">
          <motion.button
            onClick={() => setShowSaveMenu(!showSaveMenu)}
            className="btn-primary flex items-center gap-2 shadow-md"
            variants={buttonVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
          >
            <Save className="w-5 h-5" />
            Salvar história da viagem
          </motion.button>

          {/* Menu dropdown de opções de salvamento */}
          <AnimatePresence>
            {showSaveMenu && (
              <motion.div
                className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-sand-200 overflow-hidden z-10"
                variants={modalContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <div className="p-2">
                  <motion.button
                    onClick={handleSaveAsText}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-sand-50 transition-colors text-left"
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <FileText className="w-5 h-5 text-ocean" />
                    <div>
                      <div className="font-medium text-dark">Texto simples (.txt)</div>
                      <div className="text-xs text-sand-500">Sem formatação</div>
                    </div>
                  </motion.button>

                  <motion.button
                    onClick={handleSaveAsMarkdown}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-sand-50 transition-colors text-left"
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <File className="w-5 h-5 text-ocean" />
                    <div>
                      <div className="font-medium text-dark">Markdown (.md)</div>
                      <div className="text-xs text-sand-500">Com formatação</div>
                    </div>
                  </motion.button>

                  <motion.button
                    onClick={handleSaveAsPDF}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-sand-50 transition-colors text-left"
                    whileHover={{ x: 4 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Download className="w-5 h-5 text-ocean" />
                    <div>
                      <div className="font-medium text-dark">PDF — Linha do tempo</div>
                      <div className="text-xs text-sand-500">Dia a dia, pronto para imprimir</div>
                    </div>
                  </motion.button>

                  {tripBook && (
                    <motion.button
                      onClick={handleSaveAsBookPDF}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-sand-50 transition-colors text-left"
                      whileHover={{ x: 4 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <BookIcon className="w-5 h-5 text-aqua" />
                      <div>
                        <div className="font-medium text-dark">PDF — Livro</div>
                        <div className="text-xs text-sand-500">Capítulos narrados, para guardar</div>
                      </div>
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          onClick={handleCopy}
          className="btn-secondary flex items-center gap-2"
          variants={buttonVariants}
          initial="rest"
          whileHover="hover"
          whileTap="tap"
        >
          {copied ? (
            <>
              <Check className="w-5 h-5" />
              Copiado!
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              Copiar Texto
            </>
          )}
        </motion.button>
      </motion.div>

      {/* Overlay para fechar menu ao clicar fora */}
      <AnimatePresence>
        {showSaveMenu && (
          <motion.div
            className="fixed inset-0 z-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSaveMenu(false)}
          />
        )}
      </AnimatePresence>

      {/* Seletor de modo de leitura */}
      {tripStory.days && (
        <div className="inline-flex rounded-full border border-sand-300 bg-white p-1 mb-4">
          <button
            type="button"
            onClick={() => changeMode('timeline')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              mode === 'timeline' ? 'bg-ocean text-white' : 'text-sand-600 hover:text-dark'
            }`}
          >
            <Clock className="w-4 h-4" />
            Linha do tempo
          </button>
          <button
            type="button"
            onClick={() => changeMode('livro')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              mode === 'livro' ? 'bg-aqua text-white' : 'text-sand-600 hover:text-dark'
            }`}
          >
            <BookIcon className="w-4 h-4" />
            Livro
          </button>
        </div>
      )}

      {/* Preview da história com animação progressiva */}
      <motion.div
        className={tripStory.days ? '' : 'card'}
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        {tripStory.days ? (
          // História gerada: linha do tempo visual ou livro narrado
          mode === 'livro' && tripBook
            ? <StoryBook intro={tripStory.intro} book={tripBook} />
            : <StoryTimeline story={tripStory} />
        ) : (
          // Texto editado à mão: renderiza o Markdown
          <div className="prose prose-lg max-w-none">
            {renderStory(tripStory).map(({ html, index }) => (
              <motion.div
                key={index}
                variants={storyParagraphVariants}
                initial="hidden"
                animate="visible"
                custom={index}
              >
                <div dangerouslySetInnerHTML={{ __html: html }} />
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Dica */}
      <motion.div 
        className="mt-6 p-4 bg-ocean-50 border border-ocean-200 rounded-xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.5, duration: 0.3 }}
      >
        <p className="text-sm text-ocean-700">
          💡 <strong>Dica:</strong> Você pode copiar este texto e colar em um documento, 
          compartilhar nas redes sociais ou salvar como lembrança da viagem!
        </p>
      </motion.div>

      {/* Informação sobre atualização */}
      <motion.div 
        className="mt-4 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8 }}
      >
        <p className="text-xs text-sand-500">
          Esta história é atualizada automaticamente conforme você adiciona eventos e despesas
        </p>
      </motion.div>
    </motion.div>
  );
};

export default HistoriaPage;
