import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrip } from '../contexts/TripContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, Plane, Car, Hotel, MapPin, UtensilsCrossed, MoreHorizontal,
  DollarSign, TrendingUp, Users, X, Edit2, Trash2, Receipt, Download,
  Wallet, PiggyBank, HeartHandshake, Tag
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { pageVariants, cardVariants, buttonVariants, modalOverlayVariants, modalContentVariants } from '../utils/motionVariants';

// Dia de hoje no fuso do aparelho, para sugerir na despesa nova. É o "agora"
// de quem está lançando, não uma data de calendário salva - por isso fuso
// local. toISOString() dava o dia em UTC: à noite (21h no Brasil, 20h em
// Orlando) a despesa já vinha sugerida com a data de amanhã.
const hojeLocal = () => format(new Date(), 'yyyy-MM-dd');

const FinanceiroPage = () => {
  const { user } = useAuth();
  const { expenses, addExpense, updateExpense, deleteExpense, saveCaixas, saveCustomCategories, currentTrip, participants, participantsData } = useTrip();
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState({
    category: 'aereo',
    description: '',
    amount: '',
    paidBy: user?.uid || '',
    date: hojeLocal(),
    status: 'pago', // 'pago' ou 'pendente'
    splitBetween: [],
    caixaId: '' // Caixa (reserva) de onde o dinheiro sai; '' = sem caixa
  });

  // Caixas: dinheiro separado antes da viagem ("Breno", "Claudia", "Comida"...).
  // Viagem antiga não tem o campo, então sempre cai para lista vazia.
  const caixas = useMemo(
    () => (Array.isArray(currentTrip?.caixas) ? currentTrip.caixas : []),
    [currentTrip?.caixas]
  );
  const [showCaixaModal, setShowCaixaModal] = useState(false);
  const [editingCaixa, setEditingCaixa] = useState(null);
  const [caixaForm, setCaixaForm] = useState({ name: '', amount: '' });

  // Categorias de despesas: as seis fixas mais as criadas pelo usuário nesta
  // viagem (trip.customCategories). As extras usam o mesmo ícone e ganham cor
  // por ordem de criação.
  const customCategories = useMemo(
    () => (Array.isArray(currentTrip?.customCategories) ? currentTrip.customCategories : []),
    [currentTrip?.customCategories]
  );
  const CUSTOM_COLORS = ['bg-teal-600', 'bg-pink-500', 'bg-indigo-500', 'bg-amber-600', 'bg-cyan-600', 'bg-rose-600'];
  const categories = useMemo(() => {
    const base = {
      aereo: { icon: Plane, label: 'Aéreo', color: 'bg-ocean' },
      transfer: { icon: Car, label: 'Transfer', color: 'bg-aqua' },
      hospedagem: { icon: Hotel, label: 'Hospedagem', color: 'bg-purple-500' },
      passeios: { icon: MapPin, label: 'Passeios', color: 'bg-green-500' },
      alimentacao: { icon: UtensilsCrossed, label: 'Alimentação', color: 'bg-orange-500' },
      outros: { icon: MoreHorizontal, label: 'Outros', color: 'bg-gray-500' }
    };
    customCategories.forEach((item, index) => {
      base[item.id] = {
        icon: Tag,
        label: item.name,
        color: CUSTOM_COLORS[index % CUSTOM_COLORS.length],
        custom: true,
        archived: Boolean(item.archived)
      };
    });
    return base;
  }, [customCategories]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editingCategories, setEditingCategories] = useState(false); // mostra o × nas extras
  const [categoryForm, setCategoryForm] = useState('');

  // Função para exportar PDF
  const handleExportPDF = async () => {
    if (!currentTrip || !expenses.length) {
      alert('Nenhuma despesa encontrada para exportar');
      return;
    }

    const sortedExpenses = sortExpensesByDate(expenses);
    
    // Preparar dados para exportação
    const exportData = {
      trip: {
        name: currentTrip.name,
        destination: currentTrip.destination,
        startDate: currentTrip.startDate,
        endDate: currentTrip.endDate
      },
      expenses: sortedExpenses.map(expense => ({
        ...expense,
        paidByName: getParticipantName(expense.paidBy),
        caixaName: caixas.find(caixa => caixa.id === expense.caixaId)?.name || 'Viagem',
        categoryLabel: (categories[expense.category] || categories.outros).label,
        categoryIsCustom: Boolean(categories[expense.category]?.custom)
      })),
      // O relatório mostra os mesmos números do topo da tela: o total é tudo que
      // foi lançado, com pago e pendente discriminados. Antes o "gasto médio"
      // dividia só o total pago pela contagem de TODAS as despesas.
      // Reservas por caixa, com o mesmo gasto que a tela mostra
      caixas: caixas.map(caixa => ({
        name: caixa.name,
        reserved: Number(caixa.amount) || 0,
        spent: calculations.byCaixa[caixa.id] || 0
      })),
      semCaixa: calculations.semCaixa,
      // Mesma previsão do bloco da tela (só existe com caixa criada)
      forecast: caixas.length > 0 ? {
        total: calculations.previsaoTotal,
        pagoComViagem: calculations.semCaixa,
        gastoCaixas: calculations.gastoCaixas,
        aindaNasCaixas: calculations.aindaNasCaixas,
        jaFoi: calculations.totalGeral,
        aPagar: calculations.totalPending
      } : null,
      summary: {
        total: calculations.totalGeral,
        totalPaid: calculations.total,
        totalPending: calculations.totalPending,
        count: sortedExpenses.length,
        average: sortedExpenses.length > 0 ? calculations.totalGeral / sortedExpenses.length : 0
      }
    };

    // Data E hora no nome: exportar duas vezes no mesmo dia precisa gerar dois
    // arquivos distintos, senão o antigo continua no disco e parece desatualizado
    const filename = `financeiro-${currentTrip.name.toLowerCase().replace(/\s+/g, '-')}-${format(new Date(), "yyyy-MM-dd_HH'h'mm")}`;

    // Carrega o gerador de PDF sob demanda para não pesar a abertura da aba
    const { pdfExporter } = await import('../utils/pdfExporter');
    const success = await pdfExporter.exportFinanceReport(exportData, filename);
    
    if (success) {
      alert('PDF exportado com sucesso!');
    } else {
      alert('Erro ao exportar PDF. Tente novamente.');
    }
  };

  // Função auxiliar para pegar nome do participante
  const getParticipantName = (uid) => {
    return participantsData[uid]?.displayName || 'Carregando...';
  };

  // Função para ordenar despesas por data (crescente - mais antiga primeiro)
  const sortExpensesByDate = (expensesToSort) => {
    return [...expensesToSort].sort((a, b) => {
      // Converter Firestore Timestamp ou Date para Date JavaScript
      let dateA, dateB;
      
      if (a.date?.toDate) {
        dateA = a.date.toDate();
      } else if (a.date instanceof Date) {
        dateA = a.date;
      } else {
        dateA = new Date(a.date);
      }
      
      if (b.date?.toDate) {
        dateB = b.date.toDate();
      } else if (b.date instanceof Date) {
        dateB = b.date;
      } else {
        dateB = new Date(b.date);
      }
      
      return dateA.getTime() - dateB.getTime();
    });
  };

  // Cálculos financeiros
  const calculations = useMemo(() => {
    // Filtrar despesas: se não tem status, considera como pago (compatibilidade com dados antigos)
    const paidExpenses = expenses.filter(exp => !exp.status || exp.status === 'pago');
    const pendingExpenses = expenses.filter(exp => exp.status === 'pendente');
    
    // Total geral (despesas pagas)
    const total = paidExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);
    const totalPending = pendingExpenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    // Tudo que já foi lançado na viagem, pago ou não. É esse o número que
    // responde "quanto essa viagem custa" - o usuário lança uma conta pendente
    // (hotel, ingresso a pagar) e espera ver o compromisso aparecer em algum
    // lugar. `total` continua só com os pagos porque é dele que saem os saldos
    // de quem deve a quem, a História e o relatório.
    const totalGeral = total + totalPending;

    // Total por categoria. `byCategory` é sobre tudo que foi lançado, para que
    // as fatias fechem com o totalGeral exibido no topo.
    const byCategory = expenses.reduce((acc, exp) => {
      const categoria = exp.category || 'outros';
      acc[categoria] = (acc[categoria] || 0) + Number(exp.amount || 0);
      return acc;
    }, {});

    // Total por pessoa (quanto cada um pagou - despesas pagas)
    const paidByPerson = paidExpenses.reduce((acc, exp) => {
      acc[exp.paidBy] = (acc[exp.paidBy] || 0) + Number(exp.amount);
      return acc;
    }, {});

    // Quanto cada pessoa deveria pagar (divisão justa - despesas pagas)
    const shouldPayPerPerson = paidExpenses.reduce((acc, exp) => {
      const splitBetween = Array.isArray(exp.splitBetween) && exp.splitBetween.length > 0
        ? exp.splitBetween
        : [exp.paidBy];

      const splitCount = splitBetween.length;
      if (!splitCount) return acc;

      const amountPerPerson = Number(exp.amount) / splitCount;
      splitBetween.forEach(personId => {
        acc[personId] = (acc[personId] || 0) + amountPerPerson;
      });
      
      return acc;
    }, {});

    // Gasto por caixa. Conta pago E pendente: um compromisso já assumido
    // (hotel a pagar) já saiu da reserva na prática. Despesa cuja caixa foi
    // apagada, ou que nunca teve caixa, cai em `semCaixa`.
    const byCaixa = {};
    let semCaixa = 0;
    const caixaIds = new Set(caixas.map(caixa => caixa.id));
    expenses.forEach(exp => {
      const valor = Number(exp.amount) || 0;
      if (exp.caixaId && caixaIds.has(exp.caixaId)) {
        byCaixa[exp.caixaId] = (byCaixa[exp.caixaId] || 0) + valor;
      } else {
        semCaixa += valor;
      }
    });
    const totalReservado = caixas.reduce((sum, caixa) => sum + (Number(caixa.amount) || 0), 0);
    const gastoCaixas = Object.values(byCaixa).reduce((sum, valor) => sum + valor, 0);

    // Previsão total: o que já foi lançado + o que ainda sobra nas caixas, ou
    // seja, quanto a viagem custa se o dinheiro das caixas for todo gasto.
    // Caixa que passou do reservado não soma nada: o excesso já está no gasto
    // e não pode descontar a sobra das outras caixas.
    const aindaNasCaixas = caixas.reduce((sum, caixa) => {
      const sobra = (Number(caixa.amount) || 0) - (byCaixa[caixa.id] || 0);
      return sum + Math.max(0, sobra);
    }, 0);
    const previsaoTotal = totalGeral + aindaNasCaixas;
    // Caixas acima do reservado: é por causa delas que "Ainda nas caixas" (só
    // sobras) difere do "Ainda sobra" do bloco Nossas caixas (sobra - excesso).
    const caixasQuePassaram = caixas
      .filter(caixa => (Number(caixa.amount) || 0) - (byCaixa[caixa.id] || 0) < -0.005)
      .map(caixa => caixa.name);

    // Balanço final (quem deve/recebe)
    const balance = {};
    const allParticipants = [...new Set([...Object.keys(paidByPerson), ...Object.keys(shouldPayPerPerson)])];
    
    allParticipants.forEach(personId => {
      const paid = paidByPerson[personId] || 0;
      const shouldPay = shouldPayPerPerson[personId] || 0;
      balance[personId] = paid - shouldPay;
    });

    return {
      total,
      totalPending,
      totalGeral,
      paidCount: paidExpenses.length,
      pendingCount: pendingExpenses.length,
      byCategory,
      byCaixa,
      semCaixa,
      totalReservado,
      gastoCaixas,
      aindaNasCaixas,
      previsaoTotal,
      caixasQuePassaram,
      paidByPerson,
      shouldPayPerPerson,
      balance
    };
  }, [expenses, caixas]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validação
    if (!formData.date) {
      alert('Por favor, selecione uma data para a despesa');
      return;
    }

    if (!formData.amount || Number(formData.amount) <= 0) {
      alert('Digite um valor válido para a despesa');
      return;
    }

    if (!formData.paidBy) {
      alert('Por favor, selecione quem pagou');
      return;
    }

    // Cria data em UTC para evitar problemas de timezone
    const [year, month, day] = formData.date.split('-').map(Number);
    
    // Validação de valores numéricos
    if (isNaN(year) || isNaN(month) || isNaN(day)) {
      alert('Data inválida. Verifique os valores inseridos.');
      return;
    }
    
    // Criar Date em UTC (meio-dia) para evitar problemas de fuso horário
    const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0));
    
    const expenseData = {
      ...formData,
      amount: Number(formData.amount),
      date: utcDate,
      status: formData.status || 'pago',
      caixaId: formData.caixaId || null,
      // Despesa dividida entre os participantes marcados (ou só o pagador como fallback)
      splitBetween: (formData.splitBetween && formData.splitBetween.length > 0)
        ? formData.splitBetween
        : [formData.paidBy]
    };

    let result;
    if (editingExpense) {
      result = await updateExpense(editingExpense.id, expenseData);
    } else {
      result = await addExpense(expenseData);
    }

    if (result.success) {
      handleCloseModal();
    } else {
      alert('Erro ao salvar despesa: ' + (result.error || 'Erro desconhecido'));
    }
  };

  const handleOpenModal = (expense = null) => {
    if (expense) {
      // Converte data usando UTC
      let expenseDate;
      if (expense.date?.toDate) {
        expenseDate = expense.date.toDate();
      } else if (expense.date instanceof Date) {
        expenseDate = expense.date;
      } else {
        expenseDate = new Date(expense.date);
      }
      
      // Extrair componentes em UTC
      const year = expenseDate.getUTCFullYear();
      const month = expenseDate.getUTCMonth() + 1;
      const day = expenseDate.getUTCDate();
      
      setEditingExpense(expense);
      setFormData({
        category: expense.category,
        description: expense.description,
        amount: expense.amount.toString(),
        paidBy: expense.paidBy,
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        status: expense.status || 'pago',
        splitBetween: Array.isArray(expense.splitBetween) && expense.splitBetween.length > 0
          ? expense.splitBetween
          : (participants || []),
        caixaId: expense.caixaId || ''
      });
    } else {
      setEditingExpense(null);
      // Definir paidBy como primeiro participante ou usuário atual
      const defaultPaidBy = (user?.uid && participants?.includes(user.uid))
        ? user.uid
        : (participants?.[0] || user?.uid || '');
      
      setFormData({
        category: 'aereo',
        description: '',
        amount: '',
        paidBy: defaultPaidBy,
        date: hojeLocal(),
        status: 'pago',
        // Por padrao, divide entre todos os participantes
        splitBetween: participants && participants.length > 0
          ? [...participants]
          : (user?.uid ? [user.uid] : []),
        caixaId: caixaParaCategoria('aereo')
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingExpense(null);
    setEditingCategories(false);
  };

  // Caixa cujo nome coincide com o rótulo da categoria (ex.: caixa "Alimentação"
  // para a categoria alimentacao). Serve só de sugestão ao escolher a
  // categoria; o usuário troca à vontade.
  const caixaParaCategoria = (categoryKey) => {
    const label = categories[categoryKey]?.label;
    if (!label) return '';
    const normaliza = (texto) => String(texto || '')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().trim();
    const alvo = normaliza(label);
    const achada = caixas.find(caixa => normaliza(caixa.name) === alvo);
    return achada ? achada.id : '';
  };

  const handleSelectCategory = (key) => {
    const sugerida = caixaParaCategoria(key);
    setFormData({ ...formData, category: key, caixaId: sugerida || formData.caixaId });
  };

  // ===== Caixas (criar / renomear / apagar) =====
  const handleOpenCaixaModal = (caixa = null) => {
    setEditingCaixa(caixa);
    setCaixaForm(caixa
      ? { name: caixa.name, amount: String(caixa.amount ?? '') }
      : { name: '', amount: '' });
    document.body.style.overflow = 'hidden';
    setShowCaixaModal(true);
  };

  const handleCloseCaixaModal = () => {
    document.body.style.overflow = '';
    setShowCaixaModal(false);
    setEditingCaixa(null);
  };

  const handleSubmitCaixa = async (e) => {
    e.preventDefault();
    const name = caixaForm.name.trim();
    const amount = Number(caixaForm.amount);
    if (!name) {
      alert('Dê um nome para a caixa (ex.: Breno, Claudia, Comida)');
      return;
    }
    if (isNaN(amount) || amount < 0) {
      alert('Digite um valor válido para a reserva');
      return;
    }

    const novaLista = editingCaixa
      ? caixas.map(caixa => caixa.id === editingCaixa.id ? { ...caixa, name, amount } : caixa)
      : [...caixas, { id: `caixa_${Date.now().toString(36)}`, name, amount }];

    const result = await saveCaixas(novaLista);
    if (result.success) {
      handleCloseCaixaModal();
    } else {
      alert('Erro ao salvar caixa: ' + (result.error || 'Erro desconhecido'));
    }
  };

  // ===== Categorias extras (criar / apagar) =====
  const handleOpenCategoryModal = () => {
    setCategoryForm('');
    document.body.style.overflow = 'hidden';
    setShowCategoryModal(true);
  };

  const handleCloseCategoryModal = () => {
    document.body.style.overflow = '';
    setShowCategoryModal(false);
  };

  const handleSubmitCategory = async (e) => {
    e.preventDefault();
    const name = categoryForm.trim();
    if (!name) {
      alert('Dê um nome para a categoria (ex.: Compras, Gasolina)');
      return;
    }
    const normaliza = (texto) => String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const jaExiste = Object.values(categories).some(item => !item.archived && normaliza(item.label) === normaliza(name));
    if (jaExiste) {
      alert('Já existe uma categoria com esse nome');
      return;
    }

    // Se existia uma arquivada com esse nome, reativa (mantém o id das despesas antigas)
    const arquivada = customCategories.find(item => item.archived && normaliza(item.name) === normaliza(name));
    const nova = arquivada ? { ...arquivada, archived: false } : { id: `cat_${Date.now().toString(36)}`, name };
    const result = await saveCustomCategories(
      arquivada
        ? customCategories.map(item => (item.id === arquivada.id ? nova : item))
        : [...customCategories, nova]
    );
    if (result.success) {
      // Já deixa a categoria nova selecionada na despesa que está sendo lançada
      setFormData(prev => ({ ...prev, category: nova.id }));
      handleCloseCategoryModal();
    } else {
      alert('Erro ao criar categoria: ' + (result.error || 'Erro desconhecido'));
    }
  };

  const handleDeleteCategory = async (categoryId) => {
    const item = customCategories.find(c => c.id === categoryId);
    if (!item) return;
    const usadas = expenses.filter(exp => exp.category === categoryId).length;
    const aviso = usadas > 0
      ? `Apagar a categoria "${item.name}"? As ${usadas} ${usadas === 1 ? 'despesa já lançada continua' : 'despesas já lançadas continuam'} como estão; a categoria só some das opções.`
      : `Apagar a categoria "${item.name}"?`;
    if (!window.confirm(aviso)) return;
    // Com despesa lançada, arquiva (preserva os dados); sem despesa, remove de vez
    const result = await saveCustomCategories(
      usadas > 0
        ? customCategories.map(c => (c.id === categoryId ? { ...c, archived: true } : c))
        : customCategories.filter(c => c.id !== categoryId)
    );
    if (result.success) {
      if (formData.category === categoryId) setFormData(prev => ({ ...prev, category: 'outros' }));
    } else {
      alert('Erro ao apagar categoria: ' + (result.error || 'Erro desconhecido'));
    }
  };

  const handleDeleteCaixa = async (caixa) => {
    const gasto = calculations.byCaixa[caixa.id] || 0;
    const aviso = gasto > 0
      ? `Apagar a caixa "${caixa.name}"? As despesas lançadas nela continuam na viagem, só ficam sem caixa.`
      : `Apagar a caixa "${caixa.name}"?`;
    if (!window.confirm(aviso)) return;
    const result = await saveCaixas(caixas.filter(item => item.id !== caixa.id));
    if (!result.success) {
      alert('Erro ao apagar caixa: ' + (result.error || 'Erro desconhecido'));
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (window.confirm('Tem certeza que deseja excluir esta despesa?')) {
      await deleteExpense(expenseId);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  if (!currentTrip) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="card text-center py-12">
          <DollarSign className="w-16 h-16 text-sand-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-dark mb-2">Nenhuma viagem encontrada</h2>
          <p className="text-sand-500">Crie uma viagem para começar</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      className="max-w-6xl mx-auto"
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
              className="text-3xl font-bold text-dark mb-2"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              💰 Financeiro
            </motion.h1>
            <motion.p 
              className="text-sand-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
            >
              Quanto reservamos, quanto já foi e quanto ainda sobra
            </motion.p>
          </div>
          
          {/* Botão Exportar PDF */}
          {expenses.length > 0 && (
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

      {/* 1️⃣ TOPO – RESUMO ABSOLUTO */}
      <motion.div 
        className="card bg-gradient-to-br from-ocean to-ocean-700 text-white mb-6 p-6 md:p-8"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <div className="text-center mb-4 md:mb-6">
          <p className="text-xs md:text-sm opacity-80 uppercase tracking-wider mb-2">Total da Viagem</p>
          <motion.p
            className="text-4xl md:text-5xl lg:text-6xl font-black"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          >
            {formatCurrency(calculations.totalGeral)}
          </motion.p>

          {/* Pago e pendente lado a lado. Antes o topo mostrava só o pago: quem
              lançava uma conta pendente via o número não se mexer e concluía
              que o app não tinha registrado a despesa. */}
          <div className="flex justify-center gap-3 mt-3 flex-wrap">
            <span className="bg-white bg-opacity-20 backdrop-blur-sm rounded-full px-3 py-1 text-xs md:text-sm font-semibold">
              ✓ {formatCurrency(calculations.total)} pago
            </span>
            {calculations.totalPending > 0 && (
              <span className="bg-orange-500 bg-opacity-90 rounded-full px-3 py-1 text-xs md:text-sm font-semibold">
                ⏳ {formatCurrency(calculations.totalPending)} a pagar
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-6">
          {Object.entries(categories).map(([key, { icon: Icon, label }], index) => {
            const amount = calculations.byCategory[key] || 0;
            if (amount === 0) return null;
            const percentage = calculations.totalGeral > 0 ? (amount / calculations.totalGeral) * 100 : 0;

            return (
              <motion.div 
                key={key} 
                className="bg-white bg-opacity-20 backdrop-blur-sm rounded-lg p-3"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + (index * 0.05) }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-medium truncate">{label}</span>
                </div>
                <p className="text-base md:text-lg font-bold truncate">{formatCurrency(amount)}</p>
                <p className="text-xs opacity-75">{percentage.toFixed(0)}%</p>
              </motion.div>
            );
          })}
        </div>

        <div className="flex justify-center gap-6 md:gap-8 text-center pt-4 border-t border-white border-opacity-30">
          <div>
            <p className="text-xs opacity-80 mb-1">Despesas Pagas</p>
            <p className="text-xl md:text-2xl font-bold">{calculations.paidCount}</p>
          </div>
          {calculations.pendingCount > 0 && (
            <div>
              <p className="text-xs opacity-80 mb-1">Pendentes</p>
              <p className="text-xl md:text-2xl font-bold text-orange-200">{calculations.pendingCount}</p>
            </div>
          )}
          <div>
            <p className="text-xs opacity-80 mb-1">Participantes</p>
            <p className="text-xl md:text-2xl font-bold">{participants.length}</p>
          </div>
        </div>
      </motion.div>

      {/* 2️⃣ NOSSO CAIXA - a viagem é do casal, o dinheiro é um só.
          Compara APENAS o que saiu das caixas com o que foi reservado nelas.
          O que foi pago com "Viagem" (aéreo, hotel, carro...) é dinheiro
          guardado à parte e não desconta de caixa nenhuma - misturar os dois
          fazia o bloco dizer "passou R$ 12 mil" logo que as caixas diminuíam. */}
      {(() => {
        const gastoCaixas = calculations.gastoCaixas;
        const sobra = calculations.totalReservado - gastoCaixas;
        const temReserva = calculations.totalReservado > 0;
        const estourou = temReserva && sobra < -0.005;
        const tom600 = estourou ? 'text-orange-600' : 'text-green-600';
        const tom700 = estourou ? 'text-orange-700' : 'text-green-700';
        return (
          <motion.div
            className={`card mb-6 border-4 ${estourou ? 'border-orange-400 bg-orange-50' : 'border-green-400 bg-green-50'}`}
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5, type: 'spring' }}
          >
            <div className="text-center py-4 md:py-6">
              <HeartHandshake className={`w-12 h-12 mx-auto mb-3 ${tom600}`} />
              <h2 className={`text-xl md:text-2xl lg:text-3xl font-black mb-1 ${tom700}`}>
                Nossas caixas
              </h2>
              <p className={`text-sm md:text-base mb-5 px-4 ${tom600}`}>
                Dinheiro que cada um separou para gastar na viagem
              </p>
              <div className="grid grid-cols-3 gap-2 md:gap-4 px-2">
                <div>
                  <p className={`text-xs mb-1 ${tom600}`}>Reservado</p>
                  <p className="text-lg md:text-2xl font-black text-dark truncate">
                    {temReserva ? formatCurrency(calculations.totalReservado) : '—'}
                  </p>
                </div>
                <div>
                  <p className={`text-xs mb-1 ${tom600}`}>Gasto das caixas</p>
                  <p className="text-lg md:text-2xl font-black text-dark truncate">
                    {formatCurrency(gastoCaixas)}
                  </p>
                </div>
                <div>
                  <p className={`text-xs mb-1 ${tom600}`}>
                    {estourou ? 'Passou' : 'Ainda sobra'}
                  </p>
                  <p className={`text-lg md:text-2xl font-black truncate ${tom600}`}>
                    {temReserva ? formatCurrency(Math.abs(sobra)) : '—'}
                  </p>
                </div>
              </div>
              {calculations.semCaixa > 0 && (
                <p className="text-xs text-sand-600 mt-4 px-4">
                  Além disso, <strong className="text-dark">{formatCurrency(calculations.semCaixa)}</strong> foram pagos com dinheiro da Viagem
                  (aéreo, hotel, carro…) — já guardado à parte, não desconta das caixas.
                </p>
              )}
              {!temReserva && (
                <p className="text-xs text-sand-500 mt-4 px-4">
                  Crie caixas abaixo com o dinheiro separado para a viagem e acompanhe o que sobra.
                </p>
              )}
            </div>
          </motion.div>
        );
      })()}

      {/* PREVISÃO TOTAL - quanto a viagem custa se o que sobra nas caixas for
          todo gasto. Sem caixa a previsão seria igual ao Total da Viagem, então
          o bloco nem aparece. */}
      {caixas.length > 0 && (() => {
        const previsao = calculations.previsaoTotal;
        const pctDe = (valor) => (previsao > 0 ? (valor / previsao) * 100 : 0);
        const partes = [
          { label: 'Pago com Viagem', valor: calculations.semCaixa, cor: 'bg-aqua' },
          { label: 'Já gasto das caixas', valor: calculations.gastoCaixas, cor: 'bg-ocean' },
          { label: 'Ainda nas caixas', valor: calculations.aindaNasCaixas, cor: 'bg-ocean-200' }
        ];
        return (
          <motion.div
            className="card mb-6 border-2 border-ocean"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
          >
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-5 h-5 text-ocean" />
              <h2 className="text-lg font-bold text-dark">Previsão total</h2>
            </div>
            <p className="text-sm text-sand-500 mb-3">
              Quanto a viagem vai custar se gastarmos tudo o que ainda está nas caixas
            </p>
            <p className="text-3xl md:text-4xl font-black text-dark mb-4">
              {formatCurrency(previsao)}
            </p>

            <div className="flex w-full h-3 rounded-full overflow-hidden bg-sand-200 mb-4">
              {partes.map(parte => (
                <div
                  key={parte.label}
                  className={`h-full ${parte.cor} transition-all duration-500`}
                  style={{ width: `${pctDe(parte.valor)}%` }}
                />
              ))}
            </div>

            <div className="space-y-2 text-sm">
              {partes.map(parte => (
                <div key={parte.label} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded ${parte.cor} flex-shrink-0`} />
                  <span className="text-sand-600">{parte.label}</span>
                  <span className="ml-auto font-semibold text-dark">{formatCurrency(parte.valor)}</span>
                </div>
              ))}
            </div>

            <p className="text-xs text-sand-600 border-t border-sand-200 mt-4 pt-3">
              Já foi <strong className="text-dark">{formatCurrency(calculations.totalGeral)}</strong>
              {' '}({pctDe(calculations.totalGeral).toFixed(0)}%)
              {calculations.totalPending > 0 && (
                <>. Inclui {formatCurrency(calculations.totalPending)} a pagar</>
              )}
              .
            </p>
            {calculations.caixasQuePassaram.length > 0 && (
              <p className="text-xs text-sand-500 mt-2">
                "Ainda nas caixas" soma só as caixas que têm sobra. O que{' '}
                {calculations.caixasQuePassaram.join(', ')}{' '}
                {calculations.caixasQuePassaram.length === 1 ? 'passou' : 'passaram'} do reservado já
                está no gasto — por isso é diferente do "Ainda sobra" de Nossas caixas.
              </p>
            )}
          </motion.div>
        );
      })()}

      {/* 3️⃣ RESERVAS POR CAIXA */}
      <motion.div
        className="mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-bold text-dark flex items-center gap-2">
            <Wallet className="w-5 h-5 text-ocean" />
            Reservas por caixa
          </h2>
          <button
            type="button"
            onClick={() => handleOpenCaixaModal()}
            className="btn-outline text-sm px-4 py-2 flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Nova caixa
          </button>
        </div>

        {caixas.length === 0 ? (
          <div className="card text-center py-8">
            <PiggyBank className="w-12 h-12 text-sand-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-dark mb-1">Nenhuma caixa ainda</h3>
            <p className="text-sm text-sand-500 px-4">
              Separe o dinheiro da viagem em caixas (ex.: Breno, Claudia, Comida, Compras).
              Ao lançar uma despesa você escolhe de qual caixa ela sai.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {caixas.map((caixa, index) => {
              const reservado = Number(caixa.amount) || 0;
              const gasto = calculations.byCaixa[caixa.id] || 0;
              const saldo = reservado - gasto;
              const pct = reservado > 0 ? Math.min((gasto / reservado) * 100, 100) : (gasto > 0 ? 100 : 0);
              const passou = saldo < -0.005;
              const quase = !passou && reservado > 0 && pct >= 85;
              const barra = passou ? 'bg-red-500' : quase ? 'bg-orange-400' : 'bg-green-500';
              const pill = passou
                ? 'bg-red-100 text-red-800'
                : quase ? 'bg-orange-100 text-orange-800' : 'bg-green-100 text-green-800';

              return (
                <motion.div
                  key={caixa.id}
                  className={`card p-4 ${passou ? 'border-red-300' : quase ? 'border-orange-300' : ''}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.65 + index * 0.05 }}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="font-bold text-dark truncate flex items-center gap-2">
                      <PiggyBank className="w-4 h-4 text-ocean flex-shrink-0" />
                      <span className="truncate">{caixa.name}</span>
                    </h3>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenCaixaModal(caixa)}
                        className="p-1.5 hover:bg-ocean-50 rounded-lg transition-all"
                        aria-label={`Editar caixa ${caixa.name}`}
                      >
                        <Edit2 className="w-4 h-4 text-ocean" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCaixa(caixa)}
                        className="p-1.5 hover:bg-red-50 rounded-lg transition-all"
                        aria-label={`Apagar caixa ${caixa.name}`}
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-sand-500">Reservado {formatCurrency(reservado)}</p>
                  <div className="w-full h-2 bg-sand-200 rounded-full overflow-hidden my-2">
                    <div className={`h-full ${barra} transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-dark">Gasto {formatCurrency(gasto)}</span>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${pill}`}>
                      {passou ? `passou ${formatCurrency(Math.abs(saldo))}` : `sobra ${formatCurrency(saldo)}`}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

      </motion.div>

      {/* Botão adicionar despesa */}
      <motion.button
        onClick={() => handleOpenModal()}
        className="btn-primary w-full sm:w-auto mb-6 shadow-lg"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.98 }}
      >
        <Plus className="w-5 h-5 inline mr-2" />
        Adicionar Despesa
      </motion.button>

      {/* Lista de despesas */}
      {expenses.length === 0 ? (
        <motion.div 
          className="card text-center py-12"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
        >
          <Receipt className="w-16 h-16 text-sand-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-dark mb-2">Nenhuma despesa ainda</h3>
          <p className="text-sand-500">Adicione a primeira despesa da viagem</p>
        </motion.div>
      ) : (
        <motion.div 
          className="card"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <h2 className="text-xl font-bold text-dark mb-4 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-ocean" />
            Todas as Despesas ({expenses.length})
          </h2>
          <div className="space-y-6">
          {(() => {
            // Agrupar despesas por data
            const sortedExpenses = sortExpensesByDate(expenses);
            const groupedByDate = {};
            
            sortedExpenses.forEach(expense => {
              let expenseDate;
              if (expense.date?.toDate) {
                expenseDate = expense.date.toDate();
              } else if (expense.date instanceof Date) {
                expenseDate = expense.date;
              } else {
                expenseDate = new Date(expense.date);
              }
              
              const day = expenseDate.getUTCDate();
              const month = expenseDate.getUTCMonth();
              const year = expenseDate.getUTCFullYear();
              const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              
              if (!groupedByDate[dateKey]) {
                groupedByDate[dateKey] = [];
              }
              groupedByDate[dateKey].push(expense);
            });
            
            // Renderizar grupos por data
            return Object.keys(groupedByDate).map((dateKey, dateIdx) => {
              const expensesOnDate = groupedByDate[dateKey];
              const [year, month, day] = dateKey.split('-').map(Number);
              const displayDate = new Date(year, month - 1, day);
              const totalOnDate = expensesOnDate.reduce((sum, exp) => sum + Number(exp.amount), 0);
              
              return (
                <div key={dateKey} className="space-y-3">
                  {/* Header da data */}
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-ocean-100 to-aqua-100 rounded-lg flex items-center justify-center">
                        <span className="text-sm font-bold text-ocean">{day}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-dark">
                          {format(displayDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-sand-500">
                          {expensesOnDate.length} {expensesOnDate.length === 1 ? 'despesa' : 'despesas'}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-ocean">
                      {formatCurrency(totalOnDate)}
                    </p>
                  </div>
                  
                  {/* Despesas do dia */}
                  <div className="space-y-2 pl-4">
          {expensesOnDate.map((expense, index) => {
            // Despesa antiga pode não ter categoria, ou ter uma que não existe
            // mais: ler direto do mapa quebrava a aba inteira (tela branca).
            const category = categories[expense.category] || categories.outros;
            const CategoryIcon = category.icon;
            const categoryColor = category.color;
            let expenseDate;
            if (expense.date?.toDate) {
              expenseDate = expense.date.toDate();
            } else if (expense.date instanceof Date) {
              expenseDate = expense.date;
            } else {
              expenseDate = new Date(expense.date);
            }
            
            // Extrair data em UTC para exibição correta
            const day = expenseDate.getUTCDate();
            const month = expenseDate.getUTCMonth();
            const year = expenseDate.getUTCFullYear();
            const displayDate = new Date(year, month, day);
            
            // Considera despesas sem status como pagas (compatibilidade)
            const isPendente = expense.status === 'pendente';
            const isPago = expense.status === 'pago';
            const caixaDaDespesa = expense.caixaId ? caixas.find(caixa => caixa.id === expense.caixaId) : null;

            return (
              <motion.div 
                key={expense.id} 
                className={`p-4 rounded-xl transition-all relative ${
                  isPendente
                    ? 'bg-orange-50 hover:bg-orange-100 border-2 border-orange-200'
                    : 'bg-sand-50 hover:bg-sand-100'
                }`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: dateIdx * 0.05 + (index * 0.03) }}
                whileHover={{ x: 4 }}
              >
                {/* Badge de status pendente */}
                {isPendente && (
                  <div className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md flex items-center gap-1">
                    <span>⏳</span>
                    PENDENTE
                  </div>
                )}
                
                <div className="flex gap-4">
                  {/* Ícone */}
                  <div className={`${categoryColor} w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isPendente && 'opacity-60'}`}>
                    <CategoryIcon className="w-6 h-6 text-white" />
                  </div>

                  {/* Conteúdo */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`badge ${categoryColor} bg-opacity-20 text-xs`}>
                            {category.label}
                          </span>
                          {isPago && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                              ✓ Pago
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-dark">
                          {expense.description}
                        </h3>
                      </div>
                      
                      {/* Ações */}
                      <div className="flex gap-1">
                        <motion.button
                          onClick={() => handleOpenModal(expense)}
                          className="p-2 hover:bg-ocean-50 rounded-lg transition-all"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Edit2 className="w-4 h-4 text-ocean" />
                        </motion.button>
                        <motion.button
                          onClick={() => handleDeleteExpense(expense.id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-all"
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </motion.button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="text-sm text-sand-500">
                        <span className="flex items-center gap-1">
                          {caixaDaDespesa
                            ? <PiggyBank className="w-4 h-4 text-ocean" />
                            : <Plane className="w-4 h-4 text-aqua" />}
                          Pago com: <strong className="text-dark">{caixaDaDespesa ? caixaDaDespesa.name : 'Viagem'}</strong>
                        </span>
                      </div>
                      <p className="text-xl font-bold text-ocean">
                        {formatCurrency(expense.amount)}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
                  </div>
                </div>
              );
            });
          })()}
          </div>
        </motion.div>
      )}

      {/* Modal de adicionar/editar despesa */}
      {showModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            // Só fecha se clicar no overlay, não no modal
            if (e.target === e.currentTarget) {
              handleCloseModal();
            }
          }}
        >
          <div 
            className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do modal */}
            <div className="flex items-center justify-between p-6 border-b border-sand-300">
              <h2 className="text-2xl font-bold text-dark">
                {editingExpense ? 'Editar Despesa' : 'Nova Despesa'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-sand-200 rounded-lg transition-all"
              >
                <X className="w-5 h-5 text-dark" />
              </button>
            </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 overflow-y-auto">
              {/* Categoria */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-dark-100">
                    Categoria *
                  </label>
                  {customCategories.some(item => !item.archived) && (
                    <button
                      type="button"
                      onClick={() => setEditingCategories(v => !v)}
                      className={`text-xs font-medium px-3 py-1 rounded-full border transition-all flex items-center gap-1 ${
                        editingCategories
                          ? 'bg-ocean text-white border-ocean'
                          : 'border-sand-300 text-sand-600 hover:border-ocean hover:text-ocean'
                      }`}
                    >
                      <Edit2 className="w-3 h-3" />
                      {editingCategories ? 'Concluir' : 'Editar'}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(categories)
                    // Arquivada só aparece se for a categoria da despesa que está sendo editada
                    .filter(([key, item]) => !item.archived || formData.category === key)
                    .map(([key, { icon: Icon, label, color, custom, archived }]) => (
                    <div key={key} className="relative">
                      <button
                        type="button"
                        onClick={() => handleSelectCategory(key)}
                        className={`w-full flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                          formData.category === key
                            ? `${color} border-transparent text-white`
                            : 'border-sand-300 hover:border-sand-400'
                        }`}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" />
                        <span className="text-sm font-medium truncate">{label}</span>
                      </button>
                      {custom && !archived && editingCategories && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(key)}
                          className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-sand-300 text-red-500 flex items-center justify-center shadow-sm hover:bg-red-50"
                          aria-label={`Apagar categoria ${label}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleOpenCategoryModal}
                    className="flex items-center gap-2 p-3 rounded-xl border-2 border-dashed border-ocean-200 text-ocean hover:border-ocean hover:bg-ocean-50 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    <span className="text-sm font-medium">Nova categoria</span>
                  </button>
                </div>
              </div>

              {/* Pago com: dinheiro comum da viagem ou uma das caixas. "Viagem"
                  é a ausência de caixa (caixaId vazio) - o valor entra no total
                  mas não desconta de nenhuma reserva. */}
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Pago com *
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, caixaId: '' })}
                    className={`px-3 py-2 rounded-full text-sm font-medium border-2 transition-all flex items-center gap-1 ${
                      !formData.caixaId
                        ? 'bg-aqua border-aqua text-white'
                        : 'border-aqua-200 text-aqua-700 hover:border-aqua'
                    }`}
                  >
                    <Plane className="w-4 h-4" />
                    Viagem
                  </button>
                  {caixas.map(caixa => (
                    <button
                      key={caixa.id}
                      type="button"
                      onClick={() => setFormData({ ...formData, caixaId: caixa.id })}
                      className={`px-3 py-2 rounded-full text-sm font-medium border-2 transition-all flex items-center gap-1 ${
                        formData.caixaId === caixa.id
                          ? 'bg-ocean border-ocean text-white'
                          : 'border-ocean-200 text-ocean-700 hover:border-ocean'
                      }`}
                    >
                      <PiggyBank className="w-4 h-4" />
                      {caixa.name}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-sand-500 mt-1">
                  "Viagem" é o dinheiro comum; as caixas descontam da reserva de cada uma.
                </p>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Descrição *
                </label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input"
                  placeholder="Ex: Passagem aérea São Paulo"
                  required
                />
              </div>

              {/* Valor e Data */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-100 mb-2">
                    Valor (R$) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="input"
                    placeholder="0.00"
                    required
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-100 mb-2">
                    Data *
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>

              {/* "Quem pagou" e "Dividir entre" não aparecem mais: a viagem é do
                  casal e o dinheiro é um só. Os campos continuam gravados por
                  compatibilidade (pagador = quem lançou, dividido entre todos). */}

              {/* Status do pagamento */}
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Situação *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'pago' })}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-semibold ${
                      formData.status === 'pago' 
                        ? 'border-green-500 bg-green-50 text-green-700' 
                        : 'border-sand-200 bg-sand-50 text-sand-600'
                    }`}
                  >
                    <span>✅</span> Pago
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, status: 'pendente' })}
                    className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-semibold ${
                      formData.status === 'pendente' 
                        ? 'border-orange-500 bg-orange-50 text-orange-700' 
                        : 'border-sand-200 bg-sand-50 text-sand-600'
                    }`}
                  >
                    <span>⏳</span> Pendente
                  </button>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-outline flex-1"
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingExpense ? 'Salvar' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal de nova categoria (fica por cima do modal da despesa) */}
      {showCategoryModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[60] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseCategoryModal();
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-sand-300">
              <h2 className="text-2xl font-bold text-dark flex items-center gap-2">
                <Tag className="w-6 h-6 text-ocean" />
                Nova Categoria
              </h2>
              <button
                type="button"
                onClick={handleCloseCategoryModal}
                className="p-2 hover:bg-sand-200 rounded-lg transition-all"
                aria-label="Fechar"
              >
                <X className="w-5 h-5 text-dark" />
              </button>
            </div>
            <form onSubmit={handleSubmitCategory} className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Nome da categoria *
                </label>
                <input
                  type="text"
                  value={categoryForm}
                  onChange={(e) => setCategoryForm(e.target.value)}
                  className="input"
                  placeholder="Ex: Compras, Gasolina, Ingressos"
                  maxLength={30}
                  autoFocus
                  required
                />
                <p className="text-xs text-sand-500 mt-1">
                  Vale para esta viagem. Aparece no Financeiro, na História e nos PDFs.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCloseCategoryModal} className="btn-outline flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1">
                  Criar categoria
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de criar/editar caixa */}
      {showCaixaModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseCaixaModal();
          }}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-sand-300">
              <h2 className="text-2xl font-bold text-dark flex items-center gap-2">
                <PiggyBank className="w-6 h-6 text-ocean" />
                {editingCaixa ? 'Editar Caixa' : 'Nova Caixa'}
              </h2>
              <button
                type="button"
                onClick={handleCloseCaixaModal}
                className="p-2 hover:bg-sand-200 rounded-lg transition-all"
                aria-label="Fechar"
              >
                <X className="w-5 h-5 text-dark" />
              </button>
            </div>

            <form onSubmit={handleSubmitCaixa} className="p-4 md:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Nome da caixa *
                </label>
                <input
                  type="text"
                  value={caixaForm.name}
                  onChange={(e) => setCaixaForm({ ...caixaForm, name: e.target.value })}
                  className="input"
                  placeholder="Ex: Breno, Claudia, Comida, Compras"
                  maxLength={40}
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Valor reservado (R$) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={caixaForm.amount}
                  onChange={(e) => setCaixaForm({ ...caixaForm, amount: e.target.value })}
                  className="input"
                  placeholder="0.00"
                  required
                />
                <p className="text-xs text-sand-500 mt-1">
                  Quanto separamos nesta caixa para levar na viagem.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCloseCaixaModal} className="btn-outline flex-1">
                  Cancelar
                </button>
                <button type="submit" className="btn-primary flex-1">
                  {editingCaixa ? 'Salvar' : 'Criar caixa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default FinanceiroPage;

