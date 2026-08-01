/**
 * Sistema visual dos PDFs — linguagem de bilhete de embarque.
 *
 * A ideia: o impresso é um documento de viagem, não um relatório. Ele empresta o
 * vocabulário da passagem aérea — canhoto destacável, picote, rótulos de campo em
 * caixa alta espaçada e dados em fonte monoespaçada (horários e valores alinham
 * em coluna, como num bilhete de verdade).
 *
 * Regra de ouro: a cor forte aparece pouco. O canhoto terracota de cada dia é o
 * único elemento chamativo; todo o resto é tinta marinha, cinza e fio fino.
 *
 * Todas as funções assumem unidade em milímetros e página A4 retrato.
 */

// ===== Cores (paleta do app) =====
export const COLOR = {
  ocean: [30, 71, 99],        // tinta marinha - estrutura e faixa do topo
  terracotta: [188, 90, 46],  // acento único - canhoto, horários
  ink: [27, 42, 56],          // texto corrido
  muted: [117, 106, 82],      // texto de apoio
  rule: [203, 188, 152],      // fios e picotes
  sand: [247, 241, 228],      // papel
  sandDeep: [239, 231, 213],  // blocos
  white: [255, 255, 255]
};

// Cor por tipo de evento / categoria de despesa
export const TYPE_COLOR = {
  voo: [30, 71, 99],
  transfer: [188, 90, 46],
  hospedagem: [109, 76, 143],
  passeio: [42, 122, 78],
  passeios: [42, 122, 78],
  alimentacao: [193, 116, 38],
  aereo: [30, 71, 99],
  outros: [117, 106, 82]
};

// ===== Medidas =====
export const PAGE = {
  width: 210,
  height: 297,
  margin: 16,
  get contentWidth() { return this.width - this.margin * 2; },
  get bottomLimit() { return this.height - 22; }
};

// ===== Primitivas de desenho =====

export const setFill = (pdf, color) => pdf.setFillColor(color[0], color[1], color[2]);
export const setInk = (pdf, color) => pdf.setTextColor(color[0], color[1], color[2]);
export const setStroke = (pdf, color) => pdf.setDrawColor(color[0], color[1], color[2]);

/**
 * Texto em caixa alta com entreletra — o rótulo de campo do bilhete.
 * (ex.: "EVENTOS", "EMITIDO EM", "VOO")
 */
export const fieldLabel = (pdf, text, x, y, { size = 6.5, color = COLOR.muted, spacing = 0.5, align } = {}) => {
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(size);
  setInk(pdf, color);
  pdf.setCharSpace(spacing);
  pdf.text(String(text).toUpperCase(), x, y, align ? { align } : undefined);
  pdf.setCharSpace(0); // estado global do jsPDF: sempre restaurar
};

/** Dado monoespaçado — horários, códigos e valores. */
export const dataText = (pdf, text, x, y, { size = 10, color = COLOR.ink, bold = true, align } = {}) => {
  pdf.setFont('courier', bold ? 'bold' : 'normal');
  pdf.setFontSize(size);
  setInk(pdf, color);
  pdf.text(String(text), x, y, align ? { align } : undefined);
};

/** Linha picotada, o gesto que dá a leitura de bilhete. */
export const perforation = (pdf, x1, y, x2, { color = COLOR.rule, dash = [0.8, 1.2], width = 0.25 } = {}) => {
  setStroke(pdf, color);
  pdf.setLineWidth(width);
  pdf.setLineDashPattern(dash, 0);
  pdf.line(x1, y, x2, y);
  pdf.setLineDashPattern([], 0); // estado global: sempre restaurar
};

/** Fio contínuo fino. */
export const hairline = (pdf, x1, y, x2, { color = COLOR.rule, width = 0.25 } = {}) => {
  setStroke(pdf, color);
  pdf.setLineWidth(width);
  pdf.line(x1, y, x2, y);
};

/**
 * Cabeçalho do documento: faixa marinha + tipo do documento + título,
 * fechada por um fio terracota e um picote.
 *
 * @returns {number} y onde o conteúdo pode começar
 */
export const drawHeader = (pdf, { kind, title, subtitle, stampLabel, stampValue }) => {
  const { width, margin } = PAGE;
  const bandHeight = 30;

  setFill(pdf, COLOR.ocean);
  pdf.rect(0, 0, width, bandHeight, 'F');

  fieldLabel(pdf, kind, margin, 11, { size: 7, color: [168, 194, 214], spacing: 1.1 });

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(19);
  setInk(pdf, COLOR.white);
  pdf.text(pdf.splitTextToSize(title || '', width - margin * 2 - 52)[0], margin, 21);

  if (subtitle) {
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    setInk(pdf, [190, 210, 226]);
    pdf.text(pdf.splitTextToSize(subtitle, width - margin * 2 - 52)[0], margin, 26.5);
  }

  // Canhoto do topo, alinhado à direita — o "campo" da passagem
  if (stampValue) {
    fieldLabel(pdf, stampLabel || 'período', width - margin, 12.5, {
      size: 6, color: [168, 194, 214], spacing: 0.9, align: 'right'
    });
    dataText(pdf, stampValue, width - margin, 19.5, { size: 10, color: COLOR.white, align: 'right' });
  }

  // Fio terracota + picote: a "dobra" do bilhete
  setFill(pdf, COLOR.terracotta);
  pdf.rect(0, bandHeight, width, 1.1, 'F');
  perforation(pdf, margin, bandHeight + 4.4, width - margin);

  return bandHeight + 10;
};

/**
 * Faixa de campos do bilhete: rótulo em cima, dado monoespaçado embaixo,
 * separados por fios verticais.
 *
 * @param {Array<{label: string, value: string}>} fields
 * @returns {number} novo y
 */
export const drawFieldStrip = (pdf, fields, y) => {
  const { margin, contentWidth } = PAGE;
  const usable = fields.filter(f => f && f.value);
  if (!usable.length) return y;

  const height = 13;
  setFill(pdf, COLOR.sandDeep);
  pdf.rect(margin, y, contentWidth, height, 'F');

  const columnWidth = contentWidth / usable.length;

  usable.forEach((field, index) => {
    const x = margin + columnWidth * index + 4;
    fieldLabel(pdf, field.label, x, y + 5, { size: 5.8, spacing: 0.7 });
    dataText(pdf, field.value, x, y + 10.2, { size: 9, color: COLOR.ocean });

    if (index > 0) {
      setStroke(pdf, COLOR.rule);
      pdf.setLineWidth(0.25);
      pdf.line(margin + columnWidth * index, y + 2.5, margin + columnWidth * index, y + height - 2.5);
    }
  });

  return y + height + 6;
};

/** Rodapé em todas as páginas, no tom de um talão. */
export const drawFooters = (pdf, { docLabel, generatedAt }) => {
  const { width, height, margin } = PAGE;
  const total = pdf.internal.getNumberOfPages();
  const baseline = height - 12;

  for (let page = 1; page <= total; page++) {
    pdf.setPage(page);
    perforation(pdf, margin, baseline - 5, width - margin);

    fieldLabel(pdf, `emitido em ${generatedAt}`, margin, baseline, { size: 6, spacing: 0.4 });

    if (docLabel) {
      fieldLabel(pdf, docLabel, width / 2, baseline, { size: 6, spacing: 0.4, align: 'center' });
    }

    dataText(pdf, `${String(page).padStart(2, '0')}/${String(total).padStart(2, '0')}`, width - margin, baseline, {
      size: 8, color: COLOR.ocean, align: 'right'
    });
  }
};
