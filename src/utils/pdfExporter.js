import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// Caracteres fora do WinAnsi (emojis, por exemplo) fazem o jsPDF trocar a string
// inteira para UTF-16, enquanto a fonte padrão continua WinAnsi - o resultado é o
// texto sair "e s p a ç a d o" e com símbolos errados. Por isso todo texto passa
// por uma limpeza antes de ir para o PDF.

// Códigos WinAnsi da faixa 0x80-0x9F (aspas tipográficas, travessões, bullet...)
const WIN_ANSI_EXTRA = new Set([
  0x20AC, 0x201A, 0x0192, 0x201E, 0x2026, 0x2020, 0x2021, 0x02C6, 0x2030, 0x0160,
  0x2039, 0x0152, 0x017D, 0x2018, 0x2019, 0x201C, 0x201D, 0x2022, 0x2013, 0x2014,
  0x02DC, 0x2122, 0x0161, 0x203A, 0x0153, 0x017E, 0x0178
]);

/**
 * Remove caracteres que a fonte padrão do PDF não consegue representar
 * (emojis, ideogramas, etc.) preservando acentuação latina.
 * @param {*} value
 * @returns {string}
 */
export const toPdfSafeText = (value) => {
  if (value === null || value === undefined) return '';

  const normalized = String(value).normalize('NFC');
  let result = '';

  // Array.from percorre por code point, então emojis com pares substitutos
  // (e seletores de variação) são descartados por inteiro.
  for (const char of Array.from(normalized)) {
    const code = char.codePointAt(0);

    if (code === 0x09 || code === 0x0A || code === 0x0D) {
      result += ' ';
    } else if (code >= 0x20 && code <= 0x7E) {
      result += char;
    } else if (code >= 0xA0 && code <= 0xFF) {
      result += char;
    } else if (WIN_ANSI_EXTRA.has(code)) {
      result += char;
    }
    // Demais caracteres são simplesmente ignorados
  }

  return result.replace(/\s{2,}/g, ' ').trim();
};

/**
 * Utilitário para exportar elementos HTML como PDF
 */
export class PDFExporter {
  constructor() {
    this.defaultOptions = {
      format: 'a4',
      orientation: 'portrait',
      unit: 'mm',
      compress: true,
      quality: 0.8,
      margin: 20
    };
  }

  /**
   * Exporta um elemento HTML como PDF
   * @param {HTMLElement} element - Elemento HTML para exportar
   * @param {string} filename - Nome do arquivo PDF
   * @param {Object} options - Opções de configuração
   * @returns {Promise<boolean>} - Sucesso da operação
   */
  async exportElementToPDF(element, filename, options = {}) {
    try {
      const config = { ...this.defaultOptions, ...options };
      
      // Criar canvas do elemento
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        ...config.canvasOptions
      });

      // Criar PDF
      const pdf = new jsPDF({
        orientation: config.orientation,
        unit: config.unit,
        format: config.format,
        compress: config.compress
      });

      const imgData = canvas.toDataURL('image/png', config.quality);
      
      // Calcular dimensões
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const marginX = config.margin;
      const marginY = config.margin;
      
      const availableWidth = pdfWidth - (marginX * 2);
      const availableHeight = pdfHeight - (marginY * 2);
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(availableWidth / imgWidth, availableHeight / imgHeight);
      
      const finalWidth = imgWidth * ratio;
      const finalHeight = imgHeight * ratio;
      
      // Centralizar horizontalmente
      const x = marginX + (availableWidth - finalWidth) / 2;
      const y = marginY;

      // Adicionar imagem ao PDF
      pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
      
      // Salvar arquivo
      pdf.save(`${filename}.pdf`);
      
      return true;
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      return false;
    }
  }

  /**
   * Exporta dados financeiros como PDF
   * @param {Object} data - Dados da viagem e despesas
   * @param {string} filename - Nome do arquivo
   * @returns {Promise<boolean>}
   */
  async exportFinanceReport(data, filename = 'relatorio-financeiro') {
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const margin = 20;
      let yPosition = margin;

      // Configurações de fonte
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(0, 51, 102); // Cor ocean

      // Título
      pdf.text('Relatório Financeiro da Viagem', margin, yPosition);
      yPosition += 15;

      // Informações da viagem
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);

      if (data.trip) {
        pdf.text(toPdfSafeText(`Viagem: ${data.trip.name}`), margin, yPosition);
        yPosition += 7;

        if (data.trip.destination) {
          pdf.text(toPdfSafeText(`Destino: ${data.trip.destination}`), margin, yPosition);
          yPosition += 7;
        }
        
        if (data.trip.startDate && data.trip.endDate) {
          // Conversão local para evitar problemas UTC
          const formatLocalDate = (dateStr) => {
            if (typeof dateStr === 'string') {
              const [year, month, day] = dateStr.split('-').map(Number);
              const localDate = new Date(year, month - 1, day);
              return localDate.toLocaleDateString('pt-BR');
            }
            return new Date(dateStr).toLocaleDateString('pt-BR');
          };
          const startDate = formatLocalDate(data.trip.startDate);
          const endDate = formatLocalDate(data.trip.endDate);
          pdf.text(`Período: ${startDate} - ${endDate}`, margin, yPosition);
          yPosition += 7;
        }
      }

      yPosition += 10;

      // Resumo financeiro
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('Resumo Financeiro', margin, yPosition);
      yPosition += 10;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);

      if (data.summary) {
        pdf.text(`Total Gasto: R$ ${data.summary.total.toFixed(2)}`, margin, yPosition);
        yPosition += 6;
        pdf.text(`Número de Despesas: ${data.summary.count}`, margin, yPosition);
        yPosition += 6;
        pdf.text(`Gasto Médio: R$ ${data.summary.average.toFixed(2)}`, margin, yPosition);
        yPosition += 10;
      }

      // Lista de despesas
      if (data.expenses && data.expenses.length > 0) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.text('Despesas Detalhadas', margin, yPosition);
        yPosition += 10;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);

        data.expenses.forEach((expense, index) => {
          if (yPosition > 250) { // Nova página se necessário
            pdf.addPage();
            yPosition = margin;
          }

          const date = expense.date?.toDate ? 
            expense.date.toDate().toLocaleDateString('pt-BR') : 
            new Date(expense.date).toLocaleDateString('pt-BR');

          const amount = Number(expense.amount);
          const safeAmount = isNaN(amount) ? 0 : amount;

          pdf.text(toPdfSafeText(`${index + 1}. ${expense.description}`), margin, yPosition);
          yPosition += 5;
          pdf.text(`   Valor: R$ ${safeAmount.toFixed(2)} | Data: ${date}`, margin + 5, yPosition);
          yPosition += 5;
          pdf.text(toPdfSafeText(`   Categoria: ${expense.category || 'outros'} | Pago por: ${expense.paidByName || 'N/A'}`), margin + 5, yPosition);
          yPosition += 8;
        });
      }

      // Rodapé
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(`Página ${i} de ${pageCount}`, margin, 285);
        pdf.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, 290);
      }

      pdf.save(`${filename}.pdf`);
      return true;
    } catch (error) {
      console.error('Erro ao exportar relatório financeiro:', error);
      return false;
    }
  }

  /**
   * Exporta o roteiro completo da viagem como PDF (texto vetorial, pronto para
   * impressão). Não depende de html2canvas: monta o documento a partir dos
   * dados, então o PDF sai sempre com o roteiro atualizado e legível.
   *
   * @param {Object} data - { trip, days, summary, participants }
   * @param {string} filename - Nome do arquivo (sem extensão)
   * @param {Object} options - Opções de conteúdo e destino
   * @returns {Promise<{success: boolean, url?: string, error?: string}>}
   */
  async exportItinerary(data, filename = 'roteiro-viagem', options = {}) {
    const opts = {
      includeChecklist: true,
      includeLocation: true,
      includeDescription: true,
      includeParticipants: true,
      includeNotes: false,
      output: 'save', // 'save' | 'print'
      ...options
    };

    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // Paleta alinhada ao tema do app (ocean / aqua / sand / dark)
      const COLOR = {
        ocean: [30, 71, 99],
        aqua: [188, 90, 46],
        dark: [27, 42, 56],
        muted: [117, 106, 82],
        line: [226, 215, 190],
        sand: [247, 241, 228],
        sandDeep: [239, 231, 213]
      };
      const TYPE_COLOR = {
        voo: COLOR.ocean,
        transfer: COLOR.aqua,
        hospedagem: [139, 92, 246],
        passeio: [34, 197, 94],
        alimentacao: [249, 115, 22]
      };

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 14;
      const contentW = pageW - margin * 2;
      const bottomLimit = pageH - 20; // espaço reservado para o rodapé
      const topAfterBreak = margin + 4;

      let y = margin;

      const setFill = (c) => pdf.setFillColor(c[0], c[1], c[2]);
      const setText = (c) => pdf.setTextColor(c[0], c[1], c[2]);
      const setDraw = (c) => pdf.setDrawColor(c[0], c[1], c[2]);

      // Quebra de página quando o bloco não couber inteiro
      const ensureSpace = (needed) => {
        if (y + needed > bottomLimit) {
          pdf.addPage();
          y = topAfterBreak;
          return true;
        }
        return false;
      };

      const trip = data.trip || {};
      const days = Array.isArray(data.days) ? data.days : [];
      const summary = data.summary || {};

      // ===== Cabeçalho da capa =====
      setFill(COLOR.ocean);
      pdf.rect(0, 0, pageW, 34, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(20);
      pdf.setTextColor(255, 255, 255);
      pdf.text('Roteiro da Viagem', margin, 15);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      const headerLine = [toPdfSafeText(trip.name), toPdfSafeText(trip.destination)]
        .filter(Boolean)
        .join('  -  ');
      if (headerLine) {
        pdf.text(pdf.splitTextToSize(headerLine, contentW)[0], margin, 23);
      }

      pdf.setFontSize(9);
      pdf.setTextColor(215, 228, 238);
      const tripPeriod = toPdfSafeText(trip.period);
      if (tripPeriod) {
        pdf.text(tripPeriod, margin, 29.5);
      }

      y = 44;

      // ===== Faixa de resumo =====
      const summaryBits = [];
      if (summary.totalEvents != null) {
        summaryBits.push(`${summary.totalEvents} ${summary.totalEvents === 1 ? 'evento' : 'eventos'}`);
      }
      if (summary.totalDays != null) {
        summaryBits.push(`${summary.totalDays} ${summary.totalDays === 1 ? 'dia com programação' : 'dias com programação'}`);
      }
      if (summary.byType && summary.byType.length) {
        summary.byType.forEach(({ label, count }) => summaryBits.push(`${toPdfSafeText(label)}: ${count}`));
      }

      if (summaryBits.length) {
        const summaryLines = pdf.splitTextToSize(summaryBits.join('   |   '), contentW - 8);
        const boxH = 8 + summaryLines.length * 4.6;
        setFill(COLOR.sandDeep);
        pdf.roundedRect(margin, y, contentW, boxH, 2.5, 2.5, 'F');
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9.5);
        setText(COLOR.dark);
        let sy = y + 6;
        summaryLines.forEach((line) => {
          pdf.text(line, margin + 4, sy);
          sy += 4.6;
        });
        y += boxH + 5;
      }

      // ===== Participantes =====
      if (opts.includeParticipants && Array.isArray(data.participants) && data.participants.length) {
        const participantNames = data.participants.map(toPdfSafeText).filter(Boolean).join(', ');
        const partLines = pdf.splitTextToSize(`Viajantes: ${participantNames}`, contentW);
        ensureSpace(partLines.length * 4.6 + 3);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9.5);
        setText(COLOR.muted);
        partLines.forEach((line) => {
          pdf.text(line, margin, y);
          y += 4.6;
        });
        y += 3;
      }

      // ===== Dias e eventos =====
      if (!days.length) {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(11);
        setText(COLOR.muted);
        pdf.text('Nenhum evento cadastrado neste roteiro.', margin, y + 4);
        y += 12;
      }

      // Mede um evento (quebra de linhas + altura) sem desenhar, para decidir
      // quebras de página antes de começar a escrever o bloco.
      const measureEvent = (event) => {
        const checkboxW = opts.includeChecklist ? 6.5 : 0;
        const timeW = 15;
        const textX = margin + checkboxW + timeW;
        const textW = contentW - checkboxW - timeW;

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10.5);
        const titleLines = pdf.splitTextToSize(toPdfSafeText(event.title) || 'Sem título', textW);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9);
        const safeLocation = toPdfSafeText(event.location);
        const locationLines = (opts.includeLocation && safeLocation)
          ? pdf.splitTextToSize(`Local: ${safeLocation}`, textW)
          : [];

        const safeDescription = toPdfSafeText(event.description);
        const descLines = (opts.includeDescription && safeDescription)
          ? pdf.splitTextToSize(safeDescription, textW - 2)
          : [];

        const blockH =
          4 + // badge do tipo
          titleLines.length * 4.8 +
          locationLines.length * 4.2 +
          (descLines.length ? descLines.length * 4.2 + 2 : 0) +
          6;

        return { checkboxW, textX, titleLines, locationLines, descLines, blockH };
      };

      days.forEach((day) => {
        const dayEvents = Array.isArray(day.events) ? day.events : [];

        // Cabeçalho do dia só entra na página se o primeiro evento couber junto,
        // evitando um cabeçalho órfão no rodapé.
        const firstEventH = dayEvents.length ? measureEvent(dayEvents[0]).blockH : 10;
        ensureSpace(14 + firstEventH);

        setFill(COLOR.sandDeep);
        pdf.roundedRect(margin, y, contentW, 10, 2, 2, 'F');
        setFill(COLOR.ocean);
        pdf.rect(margin, y, 1.8, 10, 'F');

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11.5);
        setText(COLOR.ocean);
        pdf.text(toPdfSafeText(day.title), margin + 5, y + 6.6);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        setText(COLOR.muted);
        const dayMeta = [toPdfSafeText(day.weekday), `${dayEvents.length} ${dayEvents.length === 1 ? 'evento' : 'eventos'}`]
          .filter(Boolean)
          .join('  |  ');
        pdf.text(dayMeta, pageW - margin - 3, y + 6.6, { align: 'right' });

        y += 14;

        dayEvents.forEach((event) => {
          // Pré-calcula a altura do bloco para não cortar o evento entre páginas
          const { checkboxW, textX, titleLines, locationLines, descLines, blockH } = measureEvent(event);

          ensureSpace(blockH);
          const blockTop = y;

          // Caixa para marcar no papel
          if (opts.includeChecklist) {
            setDraw(COLOR.muted);
            pdf.setLineWidth(0.3);
            pdf.rect(margin, blockTop + 1.2, 4, 4, 'S');
          }

          // Horário
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          setText(COLOR.ocean);
          pdf.text(toPdfSafeText(event.time) || '--:--', margin + checkboxW, blockTop + 4.6);

          // Etiqueta do tipo
          const typeColor = TYPE_COLOR[event.type] || COLOR.muted;
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(7.5);
          const typeLabel = toPdfSafeText(event.typeLabel).toUpperCase();
          if (typeLabel) {
            const labelW = pdf.getTextWidth(typeLabel) + 4;
            setFill(typeColor);
            pdf.roundedRect(textX, blockTop, labelW, 4.6, 1.2, 1.2, 'F');
            pdf.setTextColor(255, 255, 255);
            pdf.text(typeLabel, textX + 2, blockTop + 3.3);
          }

          let ey = blockTop + 9.4;

          // Título
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10.5);
          setText(COLOR.dark);
          titleLines.forEach((line) => {
            pdf.text(line, textX, ey);
            ey += 4.8;
          });

          // Local
          if (locationLines.length) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            setText(COLOR.muted);
            locationLines.forEach((line) => {
              pdf.text(line, textX, ey);
              ey += 4.2;
            });
          }

          // Descrição
          if (descLines.length) {
            ey += 1;
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);
            setText(COLOR.dark);
            descLines.forEach((line) => {
              pdf.text(line, textX + 2, ey);
              ey += 4.2;
            });
          }

          y = ey + 3;

          // Separador sutil entre eventos
          setDraw(COLOR.line);
          pdf.setLineWidth(0.2);
          pdf.line(textX, y - 1.5, pageW - margin, y - 1.5);
        });

        y += 4;
      });

      // ===== Anotações =====
      if (opts.includeNotes) {
        ensureSpace(40);
        y += 2;
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        setText(COLOR.ocean);
        pdf.text('Anotações', margin, y);
        y += 5;

        setDraw(COLOR.line);
        pdf.setLineWidth(0.25);
        for (let i = 0; i < 8; i++) {
          if (ensureSpace(8)) {
            // continua as linhas na nova página
          }
          pdf.line(margin, y, pageW - margin, y);
          y += 8;
        }
      }

      // ===== Rodapé em todas as páginas =====
      const generatedAt = `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        setDraw(COLOR.line);
        pdf.setLineWidth(0.3);
        pdf.line(margin, pageH - 14, pageW - margin, pageH - 14);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        setText(COLOR.muted);
        const safeTripName = toPdfSafeText(trip.name);
        const footerLeft = safeTripName ? `${safeTripName} - atualizado em ${generatedAt}` : `Atualizado em ${generatedAt}`;
        pdf.text(pdf.splitTextToSize(footerLeft, contentW - 30)[0], margin, pageH - 9.5);
        pdf.text(`Página ${i} de ${pageCount}`, pageW - margin, pageH - 9.5, { align: 'right' });
      }

      if (opts.output === 'print') {
        return { success: true, url: pdf.output('bloburl').toString() };
      }

      pdf.save(`${filename}.pdf`);
      return { success: true };
    } catch (error) {
      console.error('Erro ao exportar roteiro:', error);
      return { success: false, error: error?.message || 'Erro desconhecido' };
    }
  }

  /**
   * Exporta a história da viagem como PDF
   * @param {Object} data - Dados da história
   * @param {string} filename - Nome do arquivo
   * @returns {Promise<boolean>}
   */
  async exportTripStory(data, filename = 'historia-viagem') {
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const margin = 20;
      const maxWidth = 170;
      let yPosition = margin;

      // Configurações de fonte
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(0, 51, 102); // Cor ocean

      // Título
      pdf.text('História da Viagem', margin, yPosition);
      yPosition += 15;

      // Informações da viagem
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(12);
      pdf.setTextColor(0, 0, 0);

      if (data.trip) {
        pdf.text(toPdfSafeText(data.trip.name), margin, yPosition);
        yPosition += 7;

        const destination = toPdfSafeText(data.trip.destination);
        if (destination) {
          pdf.text(destination, margin, yPosition);
          yPosition += 7;
        }
      }

      yPosition += 10;

      // História.
      // O texto vem em Markdown com emojis; aqui os marcadores viram formatação
      // real (títulos em negrito, listas com bullet) e os caracteres que a fonte
      // do PDF não suporta são removidos.
      if (data.story) {
        const storyBlocks = String(data.story).split('\n');

        storyBlocks.forEach((rawLine) => {
          const headingMatch = rawLine.match(/^(#{1,3})\s+(.*)$/);
          const isListItem = /^[-*]\s+/.test(rawLine);

          // Remove marcadores de Markdown e caracteres não suportados
          let content = rawLine
            .replace(/^(#{1,3})\s+/, '')
            .replace(/^[-*]\s+/, '')
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1');

          content = toPdfSafeText(content);

          // Linha divisória do Markdown
          if (/^-{3,}$/.test(rawLine.trim())) {
            if (yPosition > 270) { pdf.addPage(); yPosition = margin; }
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(0.3);
            pdf.line(margin, yPosition, margin + maxWidth, yPosition);
            yPosition += 6;
            return;
          }

          // Linha em branco vira espaçamento
          if (!content) {
            yPosition += 3;
            return;
          }

          if (headingMatch) {
            const level = headingMatch[1].length;
            const fontSize = level === 1 ? 16 : level === 2 ? 13 : 11.5;
            yPosition += level === 1 ? 4 : 3;
            if (yPosition > 265) { pdf.addPage(); yPosition = margin; }
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(fontSize);
            pdf.setTextColor(0, 51, 102);
          } else {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(11);
            pdf.setTextColor(0, 0, 0);
          }

          const indent = isListItem ? 5 : 0;
          const prefix = isListItem ? '- ' : '';
          const lines = pdf.splitTextToSize(prefix + content, maxWidth - indent);

          lines.forEach((line) => {
            if (yPosition > 270) {
              pdf.addPage();
              yPosition = margin;
            }
            pdf.text(line, margin + indent, yPosition);
            yPosition += headingMatch ? 7 : 6;
          });

          if (headingMatch) yPosition += 2;
        });
      }

      // Eventos detalhados
      if (data.events && data.events.length > 0) {
        yPosition += 10;
        
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(14);
        pdf.text('Eventos da Viagem', margin, yPosition);
        yPosition += 10;

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);

        data.events.forEach((event, index) => {
          if (yPosition > 250) { // Nova página se necessário
            pdf.addPage();
            yPosition = margin;
          }

          // Eventos são gravados em UTC; formatar pelo fuso local mostraria o dia
          // anterior para eventos da madrugada.
          const eventDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
          const date = isNaN(eventDate)
            ? ''
            : `${String(eventDate.getUTCDate()).padStart(2, '0')}/${String(eventDate.getUTCMonth() + 1).padStart(2, '0')}/${eventDate.getUTCFullYear()}`;

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          pdf.setTextColor(0, 0, 0);
          pdf.text(toPdfSafeText(`${date} - ${event.title}`), margin, yPosition);
          yPosition += 6;

          const eventDescription = toPdfSafeText(event.description);
          if (eventDescription) {
            pdf.setFont('helvetica', 'normal');
            const descLines = pdf.splitTextToSize(eventDescription, maxWidth - 10);
            descLines.forEach((line) => {
              if (yPosition > 270) {
                pdf.addPage();
                yPosition = margin;
              }
              pdf.text(line, margin + 5, yPosition);
              yPosition += 5;
            });
          }
          
          yPosition += 5;
        });
      }

      // Rodapé
      const pageCount = pdf.internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(128, 128, 128);
        pdf.text(`Página ${i} de ${pageCount}`, margin, 285);
        pdf.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, 290);
      }

      pdf.save(`${filename}.pdf`);
      return true;
    } catch (error) {
      console.error('Erro ao exportar história da viagem:', error);
      return false;
    }
  }
}

// Instância singleton
export const pdfExporter = new PDFExporter();

/**
 * Abre a caixa de impressão do navegador para um PDF já gerado (blob URL).
 * Usa um iframe oculto e se limpa sozinho, para não deixar resíduo na página.
 * Se o navegador bloquear a impressão embutida (comum em mobile), abre o PDF
 * em uma nova aba como alternativa.
 *
 * @param {string} url - blob URL do PDF
 * @returns {Promise<boolean>} - true se a impressão foi disparada
 */
export const printPdfFromUrl = (url) => new Promise((resolve) => {
  let settled = false;
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '1px';
  iframe.style.height = '1px';
  iframe.style.opacity = '0';
  iframe.style.border = '0';
  iframe.style.pointerEvents = 'none';

  const cleanup = () => {
    // Espera o diálogo de impressão consumir o documento antes de remover
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 60000);
  };

  const finish = (ok) => {
    if (settled) return;
    settled = true;
    cleanup();
    resolve(ok);
  };

  iframe.onload = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      finish(true);
    } catch (error) {
      console.warn('Impressão embutida indisponível, abrindo em nova aba:', error);
      const win = window.open(url, '_blank');
      finish(!!win);
    }
  };

  iframe.onerror = () => {
    const win = window.open(url, '_blank');
    finish(!!win);
  };

  document.body.appendChild(iframe);
  iframe.src = url;

  // Rede de segurança: se o iframe não carregar, cai para nova aba
  setTimeout(() => {
    if (!settled) {
      const win = window.open(url, '_blank');
      finish(!!win);
    }
  }, 4000);
});