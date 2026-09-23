import jsPDF from 'jspdf';
import { splitAddressSegments } from './tripBook';
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
        { label: 'pago', value: summary.totalPaid != null ? money(summary.totalPaid) : '' },
        { label: 'a pagar', value: summary.totalPending ? money(summary.totalPending) : '' },
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

      // ===== Reservas por caixa =====
      // Mesmo comparativo da tela: reservado x gasto (pago + pendente) por caixa.
      const caixas = Array.isArray(data.caixas) ? data.caixas : [];
      if (caixas.length) {
        const rowH = 6.2;
        ensureSpace(8 + rowH * (caixas.length + 2));

        fieldLabel(pdf, 'reservas por caixa', margin, y, { size: 7, color: COLOR.ocean, spacing: 1 });
        y += 5;

        const colGasto = pageW - margin - 62;
        const colReservado = pageW - margin - 31;
        const colSaldo = pageW - margin;
        fieldLabel(pdf, 'caixa', margin, y, { size: 5.8, spacing: 0.6 });
        fieldLabel(pdf, 'gasto', colGasto, y, { size: 5.8, spacing: 0.6, align: 'right' });
        fieldLabel(pdf, 'reservado', colReservado, y, { size: 5.8, spacing: 0.6, align: 'right' });
        fieldLabel(pdf, 'saldo', colSaldo, y, { size: 5.8, spacing: 0.6, align: 'right' });
        y += 2;
        perforation(pdf, margin, y, pageW - margin, { dash: [0.6, 1.4] });
        y += rowH - 1.5;

        let totalReservado = 0;
        let totalGasto = 0;
        caixas.forEach((caixa) => {
          const reservado = Number(caixa.reserved) || 0;
          const gasto = Number(caixa.spent) || 0;
          const saldo = reservado - gasto;
          totalReservado += reservado;
          totalGasto += gasto;

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9.5);
          setInk(pdf, COLOR.ink);
          const nome = pdf.splitTextToSize(toPdfSafeText(caixa.name) || 'Caixa', contentWidth - 100)[0];
          pdf.text(nome, margin, y);

          dataText(pdf, money(gasto), colGasto, y, { size: 9, color: COLOR.muted, align: 'right' });
          dataText(pdf, money(reservado), colReservado, y, { size: 9, color: COLOR.ink, align: 'right' });
          dataText(pdf, (saldo < 0 ? '-' : '') + money(Math.abs(saldo)), colSaldo, y, {
            size: 9, color: saldo < -0.005 ? COLOR.terracotta : COLOR.ocean, align: 'right'
          });
          y += rowH;
        });

        perforation(pdf, margin, y - rowH + 2, pageW - margin, { dash: [0.6, 1.4] });
        const saldoTotal = totalReservado - totalGasto;
        fieldLabel(pdf, 'total das caixas', margin, y, { size: 6.2, spacing: 0.6 });
        dataText(pdf, money(totalGasto), colGasto, y, { size: 9, color: COLOR.muted, align: 'right' });
        dataText(pdf, money(totalReservado), colReservado, y, { size: 9, align: 'right' });
        dataText(pdf, (saldoTotal < 0 ? '-' : '') + money(Math.abs(saldoTotal)), colSaldo, y, {
          size: 9, color: saldoTotal < -0.005 ? COLOR.terracotta : COLOR.ocean, align: 'right'
        });
        y += rowH;

        if (Number(data.semCaixa) > 0) {
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(8);
          setInk(pdf, COLOR.muted);
          pdf.text(`${money(data.semCaixa)} lançados sem caixa.`, margin, y);
          y += rowH;
        }
        y += 3;
      }

      // ===== Previsão total =====
      // Mesma conta do bloco da tela: já lançado + o que ainda sobra nas caixas.
      const forecast = data.forecast;
      if (forecast) {
        const rowH = 6.2;
        ensureSpace(8 + rowH * 6);

        fieldLabel(pdf, 'previsão total', margin, y, { size: 7, color: COLOR.ocean, spacing: 1 });
        y += 5;
        perforation(pdf, margin, y - 3, pageW - margin, { dash: [0.6, 1.4] });
        y += 2;

        [
          ['Pago com Viagem', forecast.pagoComViagem],
          ['Já gasto das caixas', forecast.gastoCaixas],
          ['Ainda nas caixas', forecast.aindaNasCaixas]
        ].forEach(([label, valor]) => {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9.5);
          setInk(pdf, COLOR.ink);
          pdf.text(label, margin, y);
          dataText(pdf, money(valor), pageW - margin, y, { size: 9, align: 'right' });
          y += rowH;
        });

        perforation(pdf, margin, y - rowH + 2, pageW - margin, { dash: [0.6, 1.4] });
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(10.5);
        setInk(pdf, COLOR.ink);
        pdf.text('Se gastarmos tudo das caixas', margin, y + 0.5);
        dataText(pdf, money(forecast.total), pageW - margin, y + 0.5, { size: 11, color: COLOR.ocean, align: 'right' });
        y += rowH;

        const total = Number(forecast.total) || 0;
        const pct = total > 0 ? Math.round(((Number(forecast.jaFoi) || 0) / total) * 100) : 0;
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(8);
        setInk(pdf, COLOR.muted);
        pdf.text(
          `Já foi ${money(forecast.jaFoi)} (${pct}%)` +
            (Number(forecast.aPagar) > 0 ? `, incluindo ${money(forecast.aPagar)} a pagar.` : '.'),
          margin, y
        );
        y += rowH + 3;
      }

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
          const category = toPdfSafeText(expense.categoryLabel || expense.category) || 'outros';
          const categoryColor = TYPE_COLOR[expense.category] || COLOR.muted;
          setFill(pdf, categoryColor);
          pdf.rect(textX, cursorY - 2.4, 2.1, 2.1, 'F');

          const detalhe = [category, expense.caixaName ? `pago com ${toPdfSafeText(expense.caixaName)}` : '']
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
   * Exporta a história da viagem como PDF: um bloco por dia, com os eventos em
   * uma linha cada (hora, tipo, título, resumo curto), e o "Quanto custou" com
   * os mesmos números do Financeiro. Desenha a partir da estrutura montada em
   * utils/tripStory.js - não interpreta o Markdown - para o PDF nunca divergir
   * do que a tela mostra.
   *
   * @param {Object} data - { trip, intro, days, finance }
   * @param {string} filename - Nome do arquivo (sem extensão)
   * @returns {Promise<boolean>}
   */
  async exportTripStory(data, filename = 'historia-viagem') {
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const { margin, width: pageW, contentWidth, bottomLimit } = PAGE;
      const trip = data.trip || {};
      const intro = data.intro || {};
      const days = Array.isArray(data.days) ? data.days : [];
      const finance = data.finance || null;

      const money = (value) => {
        const number = Number(value);
        return `R$ ${(isNaN(number) ? 0 : number).toFixed(2).replace('.', ',')}`;
      };

      let y = drawHeader(pdf, {
        kind: 'história da viagem',
        title: toPdfSafeText(trip.name) || 'Viagem',
        subtitle: toPdfSafeText(trip.destination),
        stampLabel: 'duração',
        stampValue: intro.durationDays ? `${intro.durationDays} ${intro.durationDays === 1 ? 'dia' : 'dias'}` : ''
      });

      y = drawFieldStrip(pdf, [
        { label: 'período', value: toPdfSafeText(intro.shortPeriod || intro.period) },
        { label: 'viajantes', value: toPdfSafeText(intro.who) },
        { label: 'total', value: finance && finance.count ? money(finance.total) : '' }
      ], y);

      const ensureSpace = (needed) => {
        if (y + needed > bottomLimit) {
          pdf.addPage();
          y = margin + 6;
          return true;
        }
        return false;
      };

      // ===== Dia a dia =====
      const timeWidth = 14;
      const dotWidth = 4;
      const textX = margin + timeWidth + dotWidth;
      const textWidth = contentWidth - timeWidth - dotWidth;

      if (!days.length) {
        pdf.setFont('helvetica', 'italic');
        pdf.setFontSize(10.5);
        setInk(pdf, COLOR.muted);
        pdf.text('Nenhum evento no período da viagem.', margin, y + 4);
        y += 10;
      }

      days.forEach((day) => {
        // Cabeçalho do dia não pode ficar órfão no rodapé: exige espaço para
        // a faixa (15) e um evento inteiro (título + tipo + resumo)
        ensureSpace(32);

        // Faixa do dia: carimbo terracota com o número, dia da semana em
        // destaque e a data ao lado, como o canhoto de um bilhete
        setFill(pdf, COLOR.sandDeep);
        pdf.rect(margin, y, contentWidth, 11, 'F');
        setFill(pdf, COLOR.terracotta);
        pdf.rect(margin, y, 16, 11, 'F');
        fieldLabel(pdf, 'dia', margin + 8, y + 3.6, { size: 4.6, color: COLOR.white, spacing: 0.8, align: 'center' });
        dataText(pdf, String(day.dayNumber), margin + 8, y + 9.2, { size: 11, color: COLOR.white, align: 'center' });
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        setInk(pdf, COLOR.ink);
        pdf.text(toPdfSafeText(day.weekday), margin + 20, y + 7.2);
        const weekdayWidth = pdf.getTextWidth(toPdfSafeText(day.weekday));
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(9.5);
        setInk(pdf, COLOR.muted);
        pdf.text(toPdfSafeText(day.dateLabel), margin + 22 + weekdayWidth, y + 7.2);
        const eventCount = (day.events || []).length;
        fieldLabel(pdf, `${eventCount} ${eventCount === 1 ? 'evento' : 'eventos'}`, pageW - margin - 3, y + 7, { size: 5.8, spacing: 0.6, align: 'right' });
        y += 15;

        const railX = margin + timeWidth + 1.1;
        const railTop = y - 1;
        const railPage = pdf.internal.getNumberOfPages();

        (day.events || []).forEach((event) => {
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          const titleLine = toPdfSafeText(event.title) || 'Evento';
          const titleLines = pdf.splitTextToSize(titleLine, textWidth);

          const metaLine = [event.typeLabel, event.location]
            .map(toPdfSafeText)
            .filter(Boolean)
            .join(' · ');
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(9);
          const summary = toPdfSafeText(event.summary);
          const summaryLines = summary ? pdf.splitTextToSize(summary, textWidth) : [];
          const detailLines = summaryLines; // usado no cálculo de altura abaixo

          const height = titleLines.length * 4.6 + (metaLine ? 3.8 : 0) + summaryLines.length * 4.2 + 4;
          ensureSpace(height);
          const top = y;

          // Hora em monoespaçada (ou o tipo, quando o evento é o dia todo)
          dataText(pdf, event.time || '', margin, top + 3.6, { size: 9, color: COLOR.terracotta });

          // Marcador colorido por tipo, sobre o trilho da linha do tempo
          const typeColor = TYPE_COLOR[event.type] || COLOR.muted;
          setFill(pdf, typeColor);
          pdf.circle(margin + timeWidth + 1.1, top + 2.4, 1.5, 'F');

          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          setInk(pdf, COLOR.ink);
          let cursorY = top + 3.6;
          titleLines.forEach((line) => {
            pdf.text(line, textX, cursorY);
            cursorY += 4.6;
          });

          if (metaLine) {
            fieldLabel(pdf, metaLine, textX, cursorY - 0.8, { size: 6, spacing: 0.5, color: typeColor });
            cursorY += 3.8;
          }

          if (summaryLines.length) {
            pdf.setFont('helvetica', 'italic');
            pdf.setFontSize(9);
            setInk(pdf, COLOR.muted);
            summaryLines.forEach((line) => {
              pdf.text(line, textX, cursorY);
              cursorY += 4.2;
            });
          }

          y = top + height;
        });

        // Trilho vertical ligando os eventos do dia (só se não houve quebra de página)
        if ((day.events || []).length > 1 && pdf.internal.getNumberOfPages() === railPage) {
          setStroke(pdf, COLOR.rule);
          pdf.setLineWidth(0.3);
          pdf.line(railX, railTop, railX, y - 2);
        }

        y += 4;
      });

      // ===== Quanto custou =====
      if (finance && finance.count > 0) {
        const rowH = 6;
        const linhas = 3 + (finance.byCategory?.length || 0) + (finance.caixas?.length ? finance.caixas.length + 3 : 0);
        ensureSpace(12 + rowH * linhas);

        y += 2;
        fieldLabel(pdf, 'quanto custou', margin, y, { size: 7, color: COLOR.ocean, spacing: 1 });
        y += 2;
        perforation(pdf, margin, y, pageW - margin, { dash: [0.6, 1.4] });
        y += 7;

        fieldLabel(pdf, 'total da viagem', margin, y, { size: 6, spacing: 0.6 });
        dataText(pdf, money(finance.total), pageW - margin, y, { size: 11, color: COLOR.ocean, align: 'right' });
        y += rowH;
        if (finance.totalPending > 0) {
          pdf.setFont('helvetica', 'italic');
          pdf.setFontSize(8.5);
          setInk(pdf, COLOR.muted);
          pdf.text(`${money(finance.totalPaid)} pagos · ${money(finance.totalPending)} a pagar`, margin, y);
          y += rowH;
        }
        y += 1;

        // Barra proporcional por categoria: o olho compara sem ler os números
        const barX = margin + 46;
        const barW = contentWidth - 46 - 34;
        (finance.byCategory || []).forEach((item) => {
          const color = TYPE_COLOR[item.category] || COLOR.muted;
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(9);
          setInk(pdf, COLOR.ink);
          pdf.text(pdf.splitTextToSize(toPdfSafeText(item.label), 42)[0], margin, y);
          setFill(pdf, COLOR.sandDeep);
          pdf.rect(barX, y - 3, barW, 3.2, 'F');
          setFill(pdf, color);
          pdf.rect(barX, y - 3, Math.max(barW * (item.percent / 100), 0.8), 3.2, 'F');
          fieldLabel(pdf, `${item.percent}%`, barX + barW + 2, y, { size: 6, spacing: 0.3 });
          dataText(pdf, money(item.amount), pageW - margin, y, { size: 9, align: 'right' });
          y += rowH;
        });

        if (finance.caixas?.length) {
          y += 2;
          ensureSpace(rowH * (finance.caixas.length + 2));
          fieldLabel(pdf, 'pago com', margin, y, { size: 6, spacing: 0.6 });
          const pagoCom = [`Viagem ${money(finance.paidWithTrip)}`]
            .concat(finance.caixas.filter(c => c.spent > 0).map(c => `${toPdfSafeText(c.name)} ${money(c.spent)}`))
            .join(' · ');
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          setInk(pdf, COLOR.ink);
          pdf.text(pagoCom, margin + 22, y);
          y += rowH + 1;

          fieldLabel(pdf, 'caixas', margin, y, { size: 6, spacing: 0.6 });
          fieldLabel(pdf, 'reservado', pageW - margin - 31, y, { size: 5.8, spacing: 0.6, align: 'right' });
          fieldLabel(pdf, 'saldo', pageW - margin, y, { size: 5.8, spacing: 0.6, align: 'right' });
          y += rowH - 1;
          finance.caixas.forEach((c) => {
            pdf.setFont('helvetica', 'bold');
            pdf.setFontSize(9.5);
            setInk(pdf, COLOR.ink);
            pdf.text(toPdfSafeText(c.name) || 'Caixa', margin, y);
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(8.5);
            setInk(pdf, COLOR.muted);
            pdf.text(`gastou ${money(c.spent)}`, margin + 55, y);
            dataText(pdf, money(c.reserved), pageW - margin - 31, y, { size: 9, align: 'right' });
            dataText(pdf, (c.balance < 0 ? '-' : '') + money(Math.abs(c.balance)), pageW - margin, y, {
              size: 9, color: c.balance < -0.005 ? COLOR.terracotta : COLOR.ocean, align: 'right'
            });
            y += rowH;
          });
        }
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

  /**
   * Exporta a História no modo Livro: capa, capítulos por dia em fonte
   * serifada com letra capitular, endereços em letra menor dentro do texto e
   * epílogo com os valores. Recebe o `book` montado em utils/tripBook.js.
   *
   * @param {Object} data - { trip, intro, book }
   * @param {string} filename - Nome do arquivo (sem extensão)
   * @returns {Promise<boolean>}
   */
  async exportTripBook(data, filename = 'historia-livro') {
    try {
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const { margin, width: pageW, height: pageH } = PAGE;
      const trip = data.trip || {};
      const intro = data.intro || {};
      const book = data.book || { chapters: [], epilogue: '', closing: {} };

      // Margens de livro: mais generosas que as dos bilhetes
      const textMargin = margin + 10;
      const textWidth = pageW - textMargin * 2;
      const bottom = pageH - 26;
      const BODY_SIZE = 11.5;
      const BODY_LEAD = 6.4;
      const ADDR_SIZE = 8.5;

      // Papel
      const paintPaper = () => {
        setFill(pdf, COLOR.sand);
        pdf.rect(0, 0, pageW, pageH, 'F');
      };
      paintPaper();

      let y = 0;
      const newPage = () => {
        pdf.addPage();
        paintPaper();
        y = margin + 12;
      };
      const ensure = (needed) => {
        if (y + needed > bottom) newPage();
      };

      // ===== Capa =====
      y = 96;
      fieldLabel(pdf, 'história da viagem', pageW / 2, y, { size: 7.5, color: COLOR.terracotta, spacing: 2, align: 'center' });
      y += 14;
      pdf.setFont('times', 'bold');
      pdf.setFontSize(30);
      setInk(pdf, COLOR.ink);
      const titleLines = pdf.splitTextToSize(toPdfSafeText(intro.name || trip.name) || 'Viagem', textWidth);
      titleLines.forEach((line) => {
        pdf.text(line, pageW / 2, y, { align: 'center' });
        y += 13;
      });
      y += 2;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      setInk(pdf, COLOR.muted);
      const meta = [
        intro.durationDays ? `${intro.durationDays} ${intro.durationDays === 1 ? 'dia' : 'dias'}` : '',
        intro.period,
        intro.destination
      ].filter(Boolean).map(toPdfSafeText).join('  ·  ');
      pdf.text(meta, pageW / 2, y, { align: 'center' });
      y += 10;
      perforation(pdf, pageW / 2 - 25, y, pageW / 2 + 25, { dash: [0.6, 1.4] });
      y += 10;
      if (intro.who) {
        pdf.setFont('times', 'italic');
        pdf.setFontSize(13);
        setInk(pdf, COLOR.ink);
        pdf.text(toPdfSafeText(intro.who), pageW / 2, y, { align: 'center' });
      }
      newPage();

      // ===== Parágrafo com trechos em estilos diferentes =====
      // Quebra o texto palavra a palavra, medindo cada uma na fonte certa, para
      // o endereço sair menor e cinza no meio da frase.
      const styleFor = (addr) => {
        if (addr) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(ADDR_SIZE);
          setInk(pdf, COLOR.muted);
        } else {
          pdf.setFont('times', 'normal');
          pdf.setFontSize(BODY_SIZE);
          setInk(pdf, COLOR.ink);
        }
      };

      const layoutParagraph = (paragraph, { dropCap = false } = {}) => {
        const segments = splitAddressSegments(paragraph).map(seg => ({
          addr: seg.addr,
          text: seg.addr ? `(${seg.text})` : seg.text
        }));

        // Palavras com estilo, preservando espaços (o toPdfSafeText é aplicado
        // por palavra para não perder o espaço entre a frase e o endereço)
        const words = [];
        segments.forEach((seg) => {
          seg.text.split(/(\s+)/).forEach((piece) => {
            if (!piece) return;
            const isSpace = /^\s+$/.test(piece);
            const text = isSpace ? ' ' : toPdfSafeText(piece);
            if (text) words.push({ text, addr: seg.addr, space: isSpace });
          });
        });

        let capital = '';
        if (dropCap && words.length && !words[0].addr && !words[0].space) {
          capital = words[0].text.charAt(0);
          words[0] = { ...words[0], text: words[0].text.slice(1) };
        }

        // Letra capitular ocupa duas linhas à esquerda
        const capWidth = capital ? 11 : 0;
        const lines = [];
        let current = [];
        let currentWidth = 0;
        const widthOf = (word) => { styleFor(word.addr); return pdf.getTextWidth(word.text); };
        const lineLimit = () => textWidth - (lines.length < 2 ? capWidth : 0);

        words.forEach((word) => {
          const w = widthOf(word);
          if (!word.space && currentWidth + w > lineLimit() && current.length) {
            // remove espaço no fim da linha
            while (current.length && current[current.length - 1].space) current.pop();
            lines.push(current);
            current = [];
            currentWidth = 0;
          }
          if (word.space && current.length === 0) return;
          current.push(word);
          currentWidth += w;
        });
        if (current.length) lines.push(current);

        ensure(BODY_LEAD * Math.min(lines.length, 2) + 2);

        if (capital) {
          pdf.setFont('times', 'bold');
          pdf.setFontSize(30);
          setInk(pdf, COLOR.ocean);
          pdf.text(capital, textMargin, y + BODY_LEAD + 2.6);
        }

        lines.forEach((line, lineIndex) => {
          if (lineIndex > 0) ensure(BODY_LEAD);
          let x = textMargin + (capital && lineIndex < 2 ? capWidth : 0);
          line.forEach((word) => {
            styleFor(word.addr);
            pdf.text(word.text, x, y + 4);
            x += pdf.getTextWidth(word.text);
          });
          y += BODY_LEAD;
        });
        y += 3;
      };

      // ===== Capítulos =====
      const chapterHeading = (kicker, title, subtitle) => {
        ensure(40);
        if (y > margin + 12) y += 6;
        fieldLabel(pdf, kicker, textMargin, y, { size: 7, color: COLOR.terracotta, spacing: 1.6 });
        y += 8;
        pdf.setFont('times', 'bold');
        pdf.setFontSize(19);
        setInk(pdf, COLOR.ink);
        pdf.splitTextToSize(toPdfSafeText(title), textWidth).forEach((line) => {
          pdf.text(line, textMargin, y);
          y += 8.5;
        });
        if (subtitle) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(9);
          setInk(pdf, COLOR.muted);
          pdf.text(toPdfSafeText(subtitle), textMargin, y - 1);
          y += 6;
        }
        y += 3;
      };

      book.chapters.forEach((chapter, index) => {
        if (index > 0) {
          ensure(50);
          perforation(pdf, textMargin, y + 2, pageW - textMargin, { dash: [0.6, 1.6] });
          y += 8;
        }
        chapterHeading(`capítulo ${chapter.number}`, chapter.title, chapter.dateLabel);
        chapter.paragraphs.forEach((paragraph, pIndex) => layoutParagraph(paragraph, { dropCap: pIndex === 0 }));
      });

      // ===== Epílogo =====
      if (book.epilogue) {
        ensure(50);
        perforation(pdf, textMargin, y + 2, pageW - textMargin, { dash: [0.6, 1.6] });
        y += 8;
        chapterHeading('epílogo', 'Quanto custou o sonho');
        layoutParagraph(book.epilogue);
      }

      // ===== Fecho =====
      ensure(24);
      y += 8;
      pdf.setFont('times', 'italic');
      pdf.setFontSize(12);
      setInk(pdf, COLOR.ink);
      pdf.text('— Fim —', pageW / 2, y, { align: 'center' });
      y += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      setInk(pdf, COLOR.muted);
      const closing = [book.closing?.who, book.closing?.date ? `escrito em ${book.closing.date}` : '']
        .filter(Boolean).map(toPdfSafeText).join('  ·  ');
      if (closing) pdf.text(closing, pageW / 2, y, { align: 'center' });

      // ===== Rodapé =====
      drawFooters(pdf, {
        docLabel: toPdfSafeText(trip.name),
        generatedAt: `${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
      });

      pdf.save(`${filename}.pdf`);
      return true;
    } catch (error) {
      console.error('Erro ao exportar o livro da viagem:', error);
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