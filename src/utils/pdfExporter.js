import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  COLOR, TYPE_COLOR, PAGE,
  setFill, setInk, setStroke,
  fieldLabel, dataText, perforation, hairline,
  drawHeader, drawFieldStrip, drawFooters
} from './pdfTheme';

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
   * Exporta o relatório financeiro da viagem como PDF, no mesmo sistema visual
   * do roteiro. Os valores saem em fonte monoespaçada e alinhados à direita,
   * então as casas decimais ficam em coluna e dá para conferir de bater o olho.
   *
   * @param {Object} data - { trip, expenses, summary }
   * @param {string} filename - Nome do arquivo (sem extensão)
   * @returns {Promise<boolean>}
   */
  async exportFinanceReport(data, filename = 'relatorio-financeiro') {
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const { margin, width: pageW, contentWidth, bottomLimit } = PAGE;
      const trip = data.trip || {};
      const summary = data.summary || {};

      const money = (value) => {
        const number = Number(value);
        return `R$ ${(isNaN(number) ? 0 : number).toFixed(2).replace('.', ',')}`;
      };

      // Datas da viagem em UTC (evita cair um dia antes no fuso do Brasil)
      const formatTripDate = (value) => {
        if (!value) return '';
        if (typeof value === 'string' && value.includes('-')) {
          const [year, month, day] = value.split('-').map(Number);
          if (!year || !month || !day) return '';
          return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
        }
        const parsed = value?.toDate ? value.toDate() : new Date(value);
        if (isNaN(parsed)) return '';
        return `${String(parsed.getUTCDate()).padStart(2, '0')}/${String(parsed.getUTCMonth() + 1).padStart(2, '0')}/${parsed.getUTCFullYear()}`;
      };

      const periodo = [formatTripDate(trip.startDate), formatTripDate(trip.endDate)]
        .filter(Boolean)
        .join(' — ');

      // ===== Cabeçalho =====
      let y = drawHeader(pdf, {
        kind: 'relatório financeiro',
        title: toPdfSafeText(trip.name) || 'Viagem',
        subtitle: toPdfSafeText(trip.destination),
        stampLabel: 'total',
        stampValue: summary.total != null ? money(summary.total) : ''
      });

      // ===== Faixa de campos =====
      y = drawFieldStrip(pdf, [
        { label: 'despesas', value: summary.count != null ? String(summary.count) : '' },
        { label: 'gasto médio', value: summary.average != null ? money(summary.average) : '' },
        { label: 'pendente', value: summary.totalPending ? money(summary.totalPending) : '' },
        { label: 'período', value: periodo }
      ], y);

      const ensureSpace = (needed) => {
        if (y + needed > bottomLimit) {
          pdf.addPage();
          y = margin + 6;
          return true;
        }
        return false;
      };

      // ===== Despesas =====
      const expenses = Array.isArray(data.expenses) ? data.expenses : [];

      if (!expenses.length) {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(10.5);
        setInk(pdf, COLOR.muted);
        pdf.text('Nenhuma despesa registrada nesta viagem.', margin, y + 4);
      } else {
        fieldLabel(pdf, 'despesas detalhadas', margin, y, { size: 7, color: COLOR.ocean, spacing: 1 });
        y += 6;

        const dateWidth = 22;
        const valueWidth = 30;
        const textX = margin + dateWidth;
        const textWidth = contentWidth - dateWidth - valueWidth - 4;

        expenses.forEach((expense, index) => {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          const descLines = pdf.splitTextToSize(
            toPdfSafeText(expense.description) || 'Despesa sem descrição',
            textWidth
          );

          const height = descLines.length * 4.8 + 8.5;
          ensureSpace(height);
          const top = y;

          // Data, em monoespaçada
          const date = expense.date?.toDate ? expense.date.toDate() : new Date(expense.date);
          const dateLabel = isNaN(date)
            ? '--/--'
            : `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
          dataText(pdf, dateLabel, margin, top + 3.6, { size: 9, color: COLOR.muted });

          // Descrição
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          setInk(pdf, COLOR.ink);
          let cursorY = top + 3.6;
          descLines.forEach((line) => {
            pdf.text(line, textX, cursorY);
            cursorY += 4.8;
          });

          // Categoria e pagador
          const category = toPdfSafeText(expense.category) || 'outros';
          const categoryColor = TYPE_COLOR[category] || COLOR.muted;
          setFill(pdf, categoryColor);
          pdf.rect(textX, cursorY - 2.4, 2.1, 2.1, 'F');

          const detalhe = [category, expense.paidByName ? `pago por ${toPdfSafeText(expense.paidByName)}` : '']
            .filter(Boolean)
            .join(' · ');
          fieldLabel(pdf, detalhe, textX + 3.6, cursorY - 0.6, { size: 6.2, spacing: 0.6 });

          // Valor, alinhado à direita em monoespaçada
          const pendente = expense.status === 'pendente';
          dataText(pdf, money(expense.amount), pageW - margin, top + 3.6, {
            size: 10, color: pendente ? COLOR.muted : COLOR.ocean, align: 'right'
          });

          if (pendente) {
            fieldLabel(pdf, 'pendente', pageW - margin, top + 7.6, {
              size: 5.8, color: COLOR.terracotta, spacing: 0.6, align: 'right'
            });
          }

          y = top + height;

          if (index < expenses.length - 1) {
            perforation(pdf, margin, y - 2.5, pageW - margin, { dash: [0.6, 1.4] });
          }
        });
      }

      // ===== Rodapé =====
      drawFooters(pdf, {
        docLabel: toPdfSafeText(trip.name),
        generatedAt: `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      });

      pdf.save(`${filename}.pdf`);
      return true;
    } catch (error) {
      console.error('Erro ao exportar relatório financeiro:', error);
      return false;
    }
  }

  /**
   * Exporta o roteiro completo da viagem como PDF, na linguagem visual de um
   * bilhete de embarque: canhoto destacável por dia, picotes, rótulos de campo
   * em caixa alta e horários em fonte monoespaçada.
   *
   * Não depende de html2canvas: monta o documento a partir dos dados, então o
   * PDF sai sempre com o roteiro atualizado, leve e com texto selecionável.
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

      const { margin, width: pageW, contentWidth, bottomLimit } = PAGE;
      const topAfterBreak = margin + 6;

      const trip = data.trip || {};
      const days = Array.isArray(data.days) ? data.days : [];
      const summary = data.summary || {};

      // ===== Cabeçalho =====
      let y = drawHeader(pdf, {
        kind: 'roteiro de viagem',
        title: toPdfSafeText(trip.name) || 'Viagem',
        subtitle: toPdfSafeText(trip.destination),
        stampLabel: 'período',
        stampValue: toPdfSafeText(trip.period)
      });

      // ===== Faixa de campos =====
      const participantNames = (Array.isArray(data.participants) ? data.participants : [])
        .map(toPdfSafeText)
        .filter(Boolean);

      y = drawFieldStrip(pdf, [
        { label: 'eventos', value: summary.totalEvents != null ? String(summary.totalEvents) : '' },
        { label: 'dias', value: summary.totalDays != null ? String(summary.totalDays) : '' },
        {
          label: participantNames.length === 1 ? 'viajante' : 'viajantes',
          value: opts.includeParticipants && participantNames.length ? String(participantNames.length) : ''
        }
      ], y);

      // Nomes dos viajantes, discretos, abaixo da faixa
      if (opts.includeParticipants && participantNames.length) {
        const linhas = pdf.splitTextToSize(participantNames.join(' · '), contentWidth);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.5);
        setInk(pdf, COLOR.muted);
        linhas.forEach((linha) => {
          pdf.text(linha, margin, y);
          y += 4.2;
        });
        y += 3;
      }

      // Quebra de página quando o bloco não couber inteiro
      const ensureSpace = (needed) => {
        if (y + needed > bottomLimit) {
          pdf.addPage();
          y = topAfterBreak;
          return true;
        }
        return false;
      };

      // Geometria das colunas do "bilhete"
      const stubWidth = 15;          // canhoto do dia
      const checkboxWidth = opts.includeChecklist ? 7 : 0;
      const timeWidth = 16;
      const dividerX = margin + stubWidth + checkboxWidth + timeWidth;
      const textX = dividerX + 4;
      const textWidth = pageW - margin - textX;

      // Mede um evento sem desenhar, para decidir a quebra de página antes.
      // A altura acompanha o conteúdo real: sem rótulo de tipo (dado legado),
      // o bloco encolhe e o fio vertical não sobra embaixo.
      const measureEvent = (event) => {
        const typeLabel = toPdfSafeText(event.typeLabel);

        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10.5);
        const titleLines = pdf.splitTextToSize(toPdfSafeText(event.title) || 'Sem título', textWidth);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8.6);
        const safeLocation = toPdfSafeText(event.location);
        const locationLines = (opts.includeLocation && safeLocation)
          ? pdf.splitTextToSize(safeLocation, textWidth)
          : [];

        const safeDescription = toPdfSafeText(event.description);
        const descLines = (opts.includeDescription && safeDescription)
          ? pdf.splitTextToSize(safeDescription, textWidth)
          : [];

        // Onde a primeira linha do título assenta, em relação ao topo do bloco
        const titleStart = typeLabel ? 8 : 4.2;

        const contentHeight =
          titleStart +
          titleLines.length * 4.9 +
          locationLines.length * 4.1 +
          (descLines.length ? descLines.length * 4.1 + 1.5 : 0);

        return { typeLabel, titleLines, locationLines, descLines, titleStart, contentHeight, height: contentHeight + 3 };
      };

      if (!days.length) {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(10.5);
        setInk(pdf, COLOR.muted);
        pdf.text('Nenhum evento cadastrado neste roteiro.', margin, y + 4);
        y += 12;
      }

      days.forEach((day) => {
        const dayEvents = Array.isArray(day.events) ? day.events : [];

        // O cabeçalho do dia só entra se o primeiro evento couber junto
        const firstEventHeight = dayEvents.length ? measureEvent(dayEvents[0]).height : 10;
        ensureSpace(15 + firstEventHeight);

        // ===== Cupom do dia: canhoto + corpo =====
        const couponHeight = 13;

        // Corpo em papel
        setFill(pdf, COLOR.sandDeep);
        pdf.rect(margin, y, contentWidth, couponHeight, 'F');

        // Canhoto terracota
        setFill(pdf, COLOR.terracotta);
        pdf.rect(margin, y, stubWidth, couponHeight, 'F');

        // Dia e mês dentro do canhoto
        const dayNumber = toPdfSafeText(day.dayNumber || '');
        const monthShort = toPdfSafeText(day.monthShort || '');
        if (dayNumber) {
          dataText(pdf, dayNumber, margin + stubWidth / 2, y + 7.4, {
            size: 13, color: COLOR.white, align: 'center'
          });
        }
        if (monthShort) {
          fieldLabel(pdf, monthShort, margin + stubWidth / 2, y + 11, {
            size: 5.5, color: [246, 220, 205], spacing: 0.5, align: 'center'
          });
        }

        // Picote vertical separando canhoto e corpo
        setStroke(pdf, COLOR.white);
        pdf.setLineWidth(0.4);
        pdf.setLineDashPattern([0.9, 1.1], 0);
        pdf.line(margin + stubWidth, y + 1.4, margin + stubWidth, y + couponHeight - 1.4);
        pdf.setLineDashPattern([], 0);

        // Data por extenso e dia da semana
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        setInk(pdf, COLOR.ocean);
        pdf.text(toPdfSafeText(day.title), margin + stubWidth + 5, y + 6.2);

        fieldLabel(pdf, toPdfSafeText(day.weekday), margin + stubWidth + 5, y + 10.4, {
          size: 6.2, spacing: 0.7
        });

        fieldLabel(pdf, `${dayEvents.length} ${dayEvents.length === 1 ? 'evento' : 'eventos'}`,
          pageW - margin - 6, y + 8.4, { size: 6.2, spacing: 0.6, align: 'right' });

        y += couponHeight + 6;

        // ===== Eventos do dia =====
        dayEvents.forEach((event, eventIndex) => {
          const { typeLabel, titleLines, locationLines, descLines, titleStart, contentHeight, height } = measureEvent(event);

          ensureSpace(height);
          const top = y;

          // Caixa para marcar no papel
          if (opts.includeChecklist) {
            setStroke(pdf, COLOR.rule);
            pdf.setLineWidth(0.35);
            pdf.rect(margin + stubWidth, top + 0.6, 3.8, 3.8, 'S');
          }

          // Horário, em monoespaçada — a coluna de dados do bilhete
          dataText(pdf, toPdfSafeText(event.time) || '--:--',
            margin + stubWidth + checkboxWidth, top + 3.9,
            { size: 10, color: COLOR.terracotta });

          // Fio vertical separando dados do conteúdo, na altura exata do bloco
          setStroke(pdf, COLOR.rule);
          pdf.setLineWidth(0.25);
          pdf.line(dividerX, top - 1, dividerX, top + contentHeight - 2);

          // Rótulo do tipo: quadrado de cor + texto espaçado
          const typeColor = TYPE_COLOR[event.type] || COLOR.muted;
          let cursorY = top + titleStart;

          if (typeLabel) {
            setFill(pdf, typeColor);
            pdf.rect(textX, top + 1.1, 2.1, 2.1, 'F');
            fieldLabel(pdf, typeLabel, textX + 3.6, top + 3.1, { size: 6.2, color: typeColor, spacing: 0.8 });
          }

          // Título
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10.5);
          setInk(pdf, COLOR.ink);
          titleLines.forEach((line) => {
            pdf.text(line, textX, cursorY);
            cursorY += 4.9;
          });

          // Local
          if (locationLines.length) {
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.6);
            setInk(pdf, COLOR.muted);
            locationLines.forEach((line) => {
              pdf.text(line, textX, cursorY);
              cursorY += 4.1;
            });
          }

          // Descrição
          if (descLines.length) {
            cursorY += 1.5;
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.6);
            setInk(pdf, COLOR.ink);
            descLines.forEach((line) => {
              pdf.text(line, textX, cursorY);
              cursorY += 4.1;
            });
          }

          y = cursorY + 2.5;

          // Picote entre eventos (menos após o último do dia)
          if (eventIndex < dayEvents.length - 1) {
            perforation(pdf, textX, y, pageW - margin, { dash: [0.6, 1.4] });
            y += 4;
          }
        });

        y += 7;
      });

      // ===== Anotações =====
      if (opts.includeNotes) {
        ensureSpace(46);
        y += 2;
        fieldLabel(pdf, 'anotações', margin, y, { size: 7, color: COLOR.ocean, spacing: 1 });
        y += 5;

        for (let i = 0; i < 8; i++) {
          ensureSpace(8);
          perforation(pdf, margin, y, pageW - margin, { dash: [0.5, 1.6] });
          y += 8;
        }
      }

      // ===== Rodapé =====
      drawFooters(pdf, {
        docLabel: toPdfSafeText(trip.name),
        generatedAt: `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      });

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

      const { margin, width: pageW, contentWidth } = PAGE;
      const maxWidth = contentWidth;
      const trip = data.trip || {};

      // ===== Cabeçalho (mesmo sistema do roteiro e do financeiro) =====
      let yPosition = drawHeader(pdf, {
        kind: 'história da viagem',
        title: toPdfSafeText(trip.name) || 'Viagem',
        subtitle: toPdfSafeText(trip.destination)
      });

      yPosition += 2;

      // História.
      // O texto vem em Markdown com emojis; aqui os marcadores viram formatação
      // real (títulos em negrito, listas com bullet) e os caracteres que a fonte
      // do PDF não suporta são removidos.
      if (data.story) {
        const storyBlocks = String(data.story).split('\n');
        let tituloPrincipalIgnorado = false;

        storyBlocks.forEach((rawLine) => {
          const headingMatch = rawLine.match(/^(#{1,3})\s+(.*)$/);
          const isListItem = /^[-*]\s+/.test(rawLine);

          // O nome da viagem já está no cabeçalho: pula o primeiro título
          if (headingMatch && headingMatch[1].length === 1 && !tituloPrincipalIgnorado) {
            tituloPrincipalIgnorado = true;
            return;
          }

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
          const prefix = isListItem ? '· ' : ''; // bullet do WinAnsi
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
        yPosition += 8;

        // O título não pode ficar sozinho no rodapé: só permanece nesta página
        // se o primeiro evento couber junto (o laço abaixo quebra a partir de 250)
        if (yPosition > 236) {
          pdf.addPage();
          yPosition = margin + 6;
        }

        fieldLabel(pdf, 'eventos da viagem', margin, yPosition, { size: 7, color: COLOR.ocean, spacing: 1 });
        yPosition += 4;
        perforation(pdf, margin, yPosition, pageW - margin);
        yPosition += 7;

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

      // ===== Rodapé =====
      drawFooters(pdf, {
        docLabel: toPdfSafeText(trip.name),
        generatedAt: `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      });

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