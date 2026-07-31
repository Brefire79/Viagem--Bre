import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrip } from '../contexts/TripContext';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, Sparkles, Download, Copy, Check, Save, FileText, File } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { pageVariants, storyParagraphVariants, buttonVariants, modalOverlayVariants, modalContentVariants } from '../utils/motionVariants';
import DOMPurify from 'dompurify';

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// Converte 'yyyy-MM-dd' (ou Timestamp/Date) para o início do dia em UTC.
// Todo o app grava eventos em UTC, então as comparações de período também
// precisam ser feitas em UTC para não escorregar um dia no fuso do Brasil.
const toUtcDayStart = (value) => {
  if (!value) return null;

  if (typeof value === 'string' && value.includes('-')) {
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  const parsed = value?.toDate ? value.toDate() : new Date(value);
  if (isNaN(parsed)) return null;

  return new Date(Date.UTC(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth(),
    parsed.getUTCDate(),
    0, 0, 0, 0
  ));
};

// Mesmo que toUtcDayStart, mas no último instante do dia
const toUtcDayEnd = (value) => {
  const start = toUtcDayStart(value);
  if (!start) return null;
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
};

// Formata uma data usando os componentes UTC (o format() do date-fns usa o fuso
// local e mostraria o dia anterior para datas gravadas à meia-noite UTC)
const formatUtcDate = (date, { withYear = true } = {}) => {
  if (!date || isNaN(date)) return '';
  const day = date.getUTCDate();
  const month = MONTH_NAMES[date.getUTCMonth()];
  return withYear
    ? `${day} de ${month} de ${date.getUTCFullYear()}`
    : `${day} de ${month}`;
};

const HistoriaPage = () => {
  const { user } = useAuth();
  const { currentTrip, events, expenses, participants, participantsData } = useTrip();
  const [copied, setCopied] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [manualStory, setManualStory] = useState("");

  // Função para exportar PDF
  const handleExportPDF = async () => {
    if (!currentTrip || !tripStory) {
      alert('Nenhuma história encontrada para exportar');
      return;
    }

    // Ordenar eventos por data
    const sortedEvents = events.length > 0 ? [...events].sort((a, b) => {
      const dateA = a.date?.toDate?.() || new Date(a.date);
      const dateB = b.date?.toDate?.() || new Date(b.date);
      return dateA - dateB;
    }) : [];

    // Preparar dados para exportação
    const exportData = {
      trip: {
        name: currentTrip.name,
        destination: currentTrip.destination,
        startDate: currentTrip.startDate,
        endDate: currentTrip.endDate
      },
      story: tripStory.text,
      events: sortedEvents
    };

    const filename = `historia-${currentTrip.name.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}`;

    // Carrega o gerador de PDF sob demanda para não pesar a abertura da aba
    const { pdfExporter } = await import('../utils/pdfExporter');
    const success = await pdfExporter.exportTripStory(exportData, filename);

    setShowSaveMenu(false);

    if (success) {
      alert('PDF exportado com sucesso!');
    } else {
      alert('Erro ao exportar PDF. Tente novamente.');
    }
  };

  // Gera a história da viagem
  const tripStory = useMemo(() => {
    if (!currentTrip || events.length === 0) return null;

    // Se o usuário editou manualmente, prioriza o texto manual
    if (manualStory) {
      return { text: manualStory };
    }

    // Filtra eventos que estão dentro do período da viagem.
    // Os eventos são gravados em UTC (ver RoteiroPage), então o período também
    // precisa ser montado em UTC - caso contrário, no fuso do Brasil, eventos da
    // madrugada do primeiro dia ficavam de fora e a madrugada do dia seguinte ao
    // fim entrava indevidamente.
    let filteredEvents = events;
    if (currentTrip.startDate && currentTrip.endDate) {
      const tripStart = toUtcDayStart(currentTrip.startDate);
      const tripEnd = toUtcDayEnd(currentTrip.endDate);

      if (tripStart && tripEnd) {
        filteredEvents = events.filter(event => {
          const eventDate = event.date?.toDate?.() || new Date(event.date);
          if (isNaN(eventDate)) return false;
          return eventDate >= tripStart && eventDate <= tripEnd;
        });
      }
    }

    if (filteredEvents.length === 0) return null;

    // Ordena eventos por data
    const sortedEvents = [...filteredEvents].sort((a, b) => {
      const dateA = a.date?.toDate?.() || new Date(a.date);
      const dateB = b.date?.toDate?.() || new Date(b.date);
      return dateA - dateB;
    });

    // Usa as datas definidas na viagem ou pega do primeiro/último evento
    let firstDate, lastDate;
    if (currentTrip.startDate && currentTrip.endDate) {
      firstDate = toUtcDayStart(currentTrip.startDate);
      lastDate = toUtcDayStart(currentTrip.endDate);
    }

    if (!firstDate || !lastDate) {
      const firstEvent = sortedEvents[0];
      const lastEvent = sortedEvents[sortedEvents.length - 1];
      firstDate = firstEvent.date?.toDate?.() || new Date(firstEvent.date);
      lastDate = lastEvent.date?.toDate?.() || new Date(lastEvent.date);
    }

    const tripDuration = Math.max(1, differenceInDays(lastDate, firstDate) + 1);

    // Agrupa eventos por tipo
    const eventsByType = sortedEvents.reduce((acc, event) => {
      if (!acc[event.type]) acc[event.type] = [];
      acc[event.type].push(event);
      return acc;
    }, {});

    // Cálculos financeiros.
    // Mesma regra da aba Financeiro: despesas sem status são consideradas pagas
    // (compatibilidade com dados antigos) e as pendentes ficam de fora do total,
    // para que os dois lugares nunca mostrem números diferentes.
    const amountOf = (exp) => {
      const value = Number(exp.amount);
      return isNaN(value) ? 0 : value;
    };

    const paidExpenses = expenses.filter(exp => !exp.status || exp.status === 'pago');
    const pendingExpenses = expenses.filter(exp => exp.status === 'pendente');

    const totalSpent = paidExpenses.reduce((sum, exp) => sum + amountOf(exp), 0);
    const totalPending = pendingExpenses.reduce((sum, exp) => sum + amountOf(exp), 0);

    const expensesByCategory = paidExpenses.reduce((acc, exp) => {
      const category = exp.category || 'outros';
      acc[category] = (acc[category] || 0) + amountOf(exp);
      return acc;
    }, {});

    const formatCurrency = (value) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      }).format(value);
    };

    const categoryLabels = {
      aereo: 'passagens aéreas',
      hospedagem: 'hospedagem',
      alimentacao: 'alimentação',
      passeio: 'passeios',
      transfer: 'transporte',
      outros: 'outros'
    };

    // Lista de participantes
    const participantNames = participants
      .map(id => participantsData[id]?.displayName || id.substring(0, 8))
      .join(', ');

    // Gera a história
    let story = `# ${currentTrip.name}\n\n`;
    story += `## Uma Aventura de ${tripDuration} ${tripDuration === 1 ? 'Dia' : 'Dias'}\n\n`;
    story += `Entre ${formatUtcDate(firstDate)} e ${formatUtcDate(lastDate)}, `;
    story += participantNames
      ? `${participantNames} ${participants.length === 1 ? 'embarcou' : 'embarcamos'} em uma jornada memorável. `
      : `embarcamos em uma jornada memorável. `;
    story += `Esta é a história de como criamos memórias que vão durar para sempre.\n\n`;

    story += `## 🗺️ Nosso Roteiro\n\n`;

    // Eventos de voo
    if (eventsByType.voo && eventsByType.voo.length > 0) {
      story += `### Voando Alto\n\n`;
      story += `Nossa aventura começou com ${eventsByType.voo.length} ${eventsByType.voo.length === 1 ? 'voo' : 'voos'}, `;
      story += `levando-nos através dos céus rumo ao destino dos nossos sonhos. `;
      eventsByType.voo.forEach((event, index) => {
        story += `${event.title}`;
        if (event.location) story += ` em ${event.location}`;
        if (index < eventsByType.voo.length - 1) story += '. ';
      });
      story += `.\n\n`;
    }

    // Eventos de hospedagem
    if (eventsByType.hospedagem && eventsByType.hospedagem.length > 0) {
      const hosp = eventsByType.hospedagem[0];
      story += `### Onde Ficamos\n\n`;
      story += `Encontramos nosso lar longe de casa em **${hosp.title}**`;
      if (hosp.location) story += ` (${hosp.location})`;
      story += `. `;
      if (hosp.description) story += `${hosp.description}. `;
      story += `Foi o lugar perfeito para descansar entre as aventuras.\n\n`;
    }

    // Eventos de passeio
    if (eventsByType.passeio && eventsByType.passeio.length > 0) {
      story += `### Explorando o Destino\n\n`;
      story += `Vivemos ${eventsByType.passeio.length} ${eventsByType.passeio.length === 1 ? 'experiência incrível' : 'experiências incríveis'}:\n\n`;
      eventsByType.passeio.forEach(event => {
        const eventDate = event.date?.toDate?.() || new Date(event.date);
        story += `- **${event.title}** - ${formatUtcDate(eventDate, { withYear: false })}`;
        if (event.description) story += `: ${event.description}`;
        story += `\n`;
      });
      story += `\n`;
    }

    // Eventos de alimentação
    if (eventsByType.alimentacao && eventsByType.alimentacao.length > 0) {
      story += `### Sabores da Viagem\n\n`;
      story += `A gastronomia foi parte essencial da nossa experiência. `;
      story += `Descobrimos ${eventsByType.alimentacao.length} ${eventsByType.alimentacao.length === 1 ? 'lugar especial' : 'lugares especiais'} `;
      story += `para saborear a culinária local, desde refeições simples até experiências gastronômicas memoráveis.\n\n`;
    }

    // Seção financeira
    story += `## 💰 Investimento na Experiência\n\n`;
    story += `Para tornar essa viagem realidade, investimos um total de **${formatCurrency(totalSpent)}**. `;

    const expenseCount = paidExpenses.length;
    story += `Ao longo de ${expenseCount} ${expenseCount === 1 ? 'transação' : 'transações'}, `;
    story += `gerenciamos cuidadosamente nossos recursos para aproveitar ao máximo cada momento.\n\n`;

    if (pendingExpenses.length > 0) {
      story += `Ainda há ${pendingExpenses.length} ${pendingExpenses.length === 1 ? 'despesa pendente' : 'despesas pendentes'}, `;
      story += `somando ${formatCurrency(totalPending)}, que não entram nos totais abaixo.\n\n`;
    }

    if (totalSpent > 0) {
      story += `### Distribuição dos Gastos\n\n`;
      Object.entries(expensesByCategory)
        .sort(([, a], [, b]) => b - a)
        .forEach(([category, amount]) => {
          const percentage = ((amount / totalSpent) * 100).toFixed(1);
          story += `- **${categoryLabels[category] || category}**: ${formatCurrency(amount)} (${percentage}%)\n`;
        });
      story += `\n`;
    }

    // Cálculos financeiros detalhados por participante
    const paidByPerson = paidExpenses.reduce((acc, exp) => {
      if (!exp.paidBy) return acc;
      acc[exp.paidBy] = (acc[exp.paidBy] || 0) + amountOf(exp);
      return acc;
    }, {});

    // Despesas antigas podem não ter splitBetween gravado; nesse caso a despesa
    // fica com quem pagou (mesma regra da aba Financeiro). Sem esta proteção a
    // aba inteira quebrava ao ler dados antigos.
    const shouldPayPerPerson = paidExpenses.reduce((acc, exp) => {
      const splitBetween = Array.isArray(exp.splitBetween) && exp.splitBetween.length > 0
        ? exp.splitBetween
        : (exp.paidBy ? [exp.paidBy] : []);

      const splitCount = splitBetween.length;
      if (!splitCount) return acc;

      const amountPerPerson = amountOf(exp) / splitCount;
      splitBetween.forEach(personId => {
        acc[personId] = (acc[personId] || 0) + amountPerPerson;
      });

      return acc;
    }, {});

    const balance = {};
    const allParticipants = [...new Set([...Object.keys(paidByPerson), ...Object.keys(shouldPayPerPerson)])];
    
    allParticipants.forEach(personId => {
      const paid = paidByPerson[personId] || 0;
      const shouldPay = shouldPayPerPerson[personId] || 0;
      balance[personId] = paid - shouldPay;
    });

    // Resumo financeiro por pessoa
    if (allParticipants.length > 0) {
      story += `### Resumo Financeiro por Participante\n\n`;
    }
    allParticipants.forEach(personId => {
      const participantName = participantsData[personId]?.displayName || personId.substring(0, 8);
      const paid = paidByPerson[personId] || 0;
      const shouldPay = shouldPayPerPerson[personId] || 0;
      const balanceAmount = balance[personId];

      story += `**${participantName}**\n`;
      story += `- Pagou: ${formatCurrency(paid)}\n`;
      story += `- Deve pagar: ${formatCurrency(shouldPay)}\n`;
      
      if (balanceAmount > 0.01) {
        story += `- 💚 Deve receber: ${formatCurrency(balanceAmount)}\n`;
      } else if (balanceAmount < -0.01) {
        story += `- 🔴 Deve pagar: ${formatCurrency(Math.abs(balanceAmount))}\n`;
      } else {
        story += `- ✅ Está quite\n`;
      }
      story += `\n`;
    });
    story += `\n`;

    // Conclusão
    story += `## ✨ Reflexões Finais\n\n`;
    story += `Esta viagem foi mais do que destinos visitados ou dinheiro gasto. `;
    story += `Foi sobre os momentos compartilhados, as risadas, as descobertas e as conexões criadas. `;
    story += `Cada experiência, desde os voos até as refeições, contribuiu para uma jornada que ficará gravada em nossas memórias.\n\n`;
    
    story += `Obrigado por fazer parte desta aventura. Que venham muitas outras!\n\n`;
    story += `---\n\n`;
    story += `*História gerada automaticamente em ${format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: ptBR })}*\n`;

    return { text: story };
  }, [currentTrip, currentTrip?.startDate, currentTrip?.endDate, events, expenses, participants, participantsData]);

  const handleCopy = async () => {
    if (tripStory) {
      await navigator.clipboard.writeText(tripStory.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (tripStory) {
      const blob = new Blob([tripStory.text], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historia-viagem-${format(new Date(), 'yyyy-MM-dd')}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const handleSaveAsText = () => {
    if (tripStory) {
      // Remove markdown formatting para texto puro
      const plainText = tripStory.text
        .replace(/^#+ /gm, '')
        .replace(/\*\*(.+?)\*\*/g, '$1')
        .replace(/\*(.+?)\*/g, '$1')
        .replace(/^- /gm, '• ');

      const blob = new Blob([plainText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `historia-viagem-${currentTrip.name?.replace(/\s+/g, '-').toLowerCase() || 'viagem'}-${format(new Date(), 'yyyy-MM-dd')}.txt`;
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
    handleExportPDF();
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
        .replace(/^### (.+)$/gm, '<h3 class="text-xl font-bold text-dark mt-6 mb-3">$1</h3>')
        .replace(/^## (.+)$/gm, '<h2 class="text-2xl font-bold text-dark mt-8 mb-4 flex items-center gap-2">$1</h2>')
        .replace(/^# (.+)$/gm, '<h1 class="text-4xl font-bold text-dark mb-2">$1</h1>')
        // Negrito
        .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-ocean">$1</strong>')
        // Lista
        .replace(/^- (.+)$/gm, '<li class="ml-6 mb-2">$1</li>')
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
              Um resumo automático da sua experiência, pronto para compartilhar
            </motion.p>
          </div>

          {/* Botão Exportar PDF */}
          {tripStory && (
            <motion.button
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              onClick={handleExportPDF}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-semibold flex items-center gap-2 transition-colors"
            >
              <Download className="h-4 w-4" />
              Exportar PDF
            </motion.button>
          )}
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
                      <div className="font-medium text-dark">PDF (.pdf)</div>
                      <div className="text-xs text-sand-500">Pronto para imprimir</div>
                    </div>
                  </motion.button>
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

      {/* Preview da história com animação progressiva */}
      <motion.div 
        className="card"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
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
