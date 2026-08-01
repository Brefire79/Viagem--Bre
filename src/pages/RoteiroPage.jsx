import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrip } from '../contexts/TripContext';
import { Plus, Plane, Car, Hotel, MapPin, UtensilsCrossed, X, Edit2, Trash2, Calendar as CalendarIcon, Clock, MapPinIcon, Check, AlertCircle, CalendarRange, ExternalLink, Printer, Download } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { pageVariants, cardVariants, buttonVariants, modalOverlayVariants, modalContentVariants, successVariants } from '../utils/motionVariants';
import TripCountdown from '../components/TripCountdown';
import { formatUtcDate, formatUtcWeekday, formatUtcShortDate, utcDateFromKey, toUtcDayStart, MONTH_NAMES } from '../utils/dateUtils';

const RoteiroPage = () => {
  const { events, addEvent, updateEvent, deleteEvent, currentTrip, createTrip, updateTrip, participants, participantsData } = useTrip();
  const [showModal, setShowModal] = useState(false);
  const [showTripModal, setShowTripModal] = useState(false);
  const [showEditDatesModal, setShowEditDatesModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printOptions, setPrintOptions] = useState({
    includeChecklist: true,
    includeLocation: true,
    includeDescription: true,
    includeParticipants: true,
    includeNotes: false
  });
  const [editingEvent, setEditingEvent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [editDatesData, setEditDatesData] = useState({
    startDate: '',
    endDate: ''
  });
  const [tripFormData, setTripFormData] = useState({
    name: '',
    destination: '',
    startDate: '',
    endDate: ''
  });
  const [formData, setFormData] = useState({
    type: 'voo',
    title: '',
    description: '',
    date: '',
    time: '',
    location: ''
  });

  // Ícones e labels por tipo de evento
  const eventTypes = {
    voo: { icon: Plane, label: 'Voo', color: 'bg-ocean' },
    transfer: { icon: Car, label: 'Transfer', color: 'bg-aqua' },
    hospedagem: { icon: Hotel, label: 'Hospedagem', color: 'bg-purple-500' },
    passeio: { icon: MapPin, label: 'Passeio', color: 'bg-green-500' },
    alimentacao: { icon: UtensilsCrossed, label: 'Alimentação', color: 'bg-orange-500' }
  };

  // Função para abrir local no Google Maps
  const openLocationInMaps = (location) => {
    if (!location || location.trim() === '') {
      alert('Por favor, digite um local para visualizar no mapa');
      return;
    }
    const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(location)}`;
    window.open(mapsUrl, '_blank');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    // Validação de data
    if (!formData.date) {
      alert('Por favor, selecione uma data para o evento');
      setLoading(false);
      return;
    }

    // Validação de título
    if (!formData.title || formData.title.trim() === '') {
      alert('Por favor, digite um título para o evento');
      setLoading(false);
      return;
    }
    
    // Log do formulário recebido
    console.log('[DEBUG] Dados do formulário:', {
      date: formData.date,
      time: formData.time,
      title: formData.title
    });
    
    // Criar data local sem conversão de timezone
    const [year, month, day] = formData.date.split('-').map(Number);
    const [hours, minutes] = (formData.time || '00:00').split(':').map(Number);
    
    console.log('[DEBUG] Componentes extraídos:', {
      year, month, day, hours, minutes,
      formDataDate: formData.date,
      formDataTime: formData.time
    });
    
    // Validação de valores numéricos
    if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
      alert('Data ou horário inválido. Verifique os valores inseridos.');
      setLoading(false);
      return;
    }
    
    // Criar Date em UTC para evitar problemas de timezone
    // Isso garante que "21 de fevereiro" seja sempre "21 de fevereiro" independente do fuso
    const utcDate = new Date(Date.UTC(year, month - 1, day, hours, minutes));
    
    console.log('[DEBUG] Data criada em UTC:', {
      utcDate,
      getUTCFullYear: utcDate.getUTCFullYear(),
      getUTCMonth: utcDate.getUTCMonth() + 1,
      getUTCDate: utcDate.getUTCDate(),
      getUTCHours: utcDate.getUTCHours(),
      getUTCMinutes: utcDate.getUTCMinutes(),
      toISOString: utcDate.toISOString()
    });
    
    const eventData = {
      ...formData,
      date: utcDate
    };
    
    console.log('[DEBUG] Salvando evento:', {
      id: editingEvent?.id,
      titulo: eventData.title,
      ano: year,
      mes: month,
      dia: day,
      hora: hours,
      minuto: minutes,
      dateUTC: utcDate,
      dataFormatada: `${day}/${month}/${year} ${hours}:${String(minutes).padStart(2, '0')}`,
      dateISO: utcDate.toISOString(),
      timezone: 'UTC (independente de fuso)',
      isEditing: !!editingEvent
    });

    let result;
    if (editingEvent) {
      result = await updateEvent(editingEvent.id, eventData);
    } else {
      result = await addEvent(eventData);
    }

    setLoading(false);
    
    if (result.success) {
      setSuccessMessage(editingEvent ? 'Evento atualizado!' : 'Evento adicionado!');
      setTimeout(() => setSuccessMessage(''), 3000);
      handleCloseModal();
    } else {
      alert('Erro ao salvar evento: ' + (result.error || 'Erro desconhecido'));
    }
  };

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await createTrip({
      name: tripFormData.name,
      destination: tripFormData.destination,
      startDate: tripFormData.startDate,
      endDate: tripFormData.endDate
    });

    setLoading(false);

    if (result.success) {
      setSuccessMessage('Viagem criada com sucesso!');
      setTimeout(() => setSuccessMessage(''), 3000);
      // Restaura scroll ao fechar modal após sucesso
      document.body.style.overflow = '';
      setShowTripModal(false);
      setTripFormData({ name: '', destination: '', startDate: '', endDate: '' });
    } else {
      alert('Erro ao criar viagem: ' + result.error);
    }
  };

  const handleEditDates = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!editDatesData.startDate || !editDatesData.endDate) {
      alert('Por favor, preencha as datas de início e fim');
      setLoading(false);
      return;
    }

    const result = await updateTrip(currentTrip.id, {
      startDate: editDatesData.startDate,
      endDate: editDatesData.endDate
    });

    setLoading(false);

    if (result.success) {
      setSuccessMessage('Datas da viagem atualizadas!');
      setTimeout(() => setSuccessMessage(''), 3000);
      document.body.style.overflow = '';
      setShowEditDatesModal(false);
    } else {
      alert('Erro ao atualizar datas: ' + result.error);
    }
  };

  const handleOpenEditDatesModal = () => {
    setEditDatesData({
      startDate: currentTrip.startDate || currentTrip.start_date || '',
      endDate: currentTrip.endDate || currentTrip.end_date || ''
    });
    document.body.style.overflow = 'hidden';
    setShowEditDatesModal(true);
  };

  const handleOpenModal = (event = null) => {
    if (event) {
      // Converte Firestore Timestamp para Date
      let eventDate;
      if (event.date?.toDate) {
        eventDate = event.date.toDate();
      } else if (event.date instanceof Date) {
        eventDate = event.date;
      } else {
        eventDate = new Date(event.date);
      }
      
      // Extrair componentes da data em UTC para evitar problemas de timezone
      const year = eventDate.getUTCFullYear();
      const month = eventDate.getUTCMonth() + 1;
      const day = eventDate.getUTCDate();
      const hours = eventDate.getUTCHours();
      const minutes = eventDate.getUTCMinutes();
      
      console.log('[DEBUG] Abrindo modal para editar evento:', {
        id: event.id,
        titulo: event.title,
        dateOriginal: event.date,
        dateUTC: eventDate.toISOString(),
        dataFormatada: `${day}/${month}/${year} ${hours}:${String(minutes).padStart(2, '0')}`,
        componentes: { year, month, day, hours, minutes }
      });
      
      setEditingEvent(event);
      setFormData({
        type: event.type,
        title: event.title,
        description: event.description || '',
        date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        time: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
        location: event.location || ''
      });
    } else {
      setEditingEvent(null);
      setFormData({
        type: 'voo',
        title: '',
        description: '',
        date: '',
        time: '',
        location: ''
      });
    }
    // Previne scroll ao abrir modal
    document.body.style.overflow = 'hidden';
    setShowModal(true);
  };

  const handleCloseModal = () => {
    // Restaura scroll ao fechar
    document.body.style.overflow = '';
    setShowModal(false);
    setEditingEvent(null);
    setFormData({
      type: 'voo',
      title: '',
      description: '',
      date: '',
      time: '',
      location: ''
    });
  };

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Tem certeza que deseja excluir este evento?')) {
      await deleteEvent(eventId);
    }
  };

  // Agrupa eventos por data
  const groupEventsByDate = () => {
    const grouped = {};
    events.forEach(event => {
      // Converte Firestore Timestamp ou Date para Date JavaScript
      let eventDate;
      if (event.date?.toDate) {
        eventDate = event.date.toDate();
      } else if (event.date instanceof Date) {
        eventDate = event.date;
      } else if (typeof event.date === 'string' || typeof event.date === 'number') {
        eventDate = new Date(event.date);
      } else {
        console.warn('[WARN] Data inválida para evento:', event.id, event.date);
        eventDate = new Date();
      }
      
      // Usar UTC para garantir consistência independente do fuso horário
      const year = eventDate.getUTCFullYear();
      const month = eventDate.getUTCMonth() + 1;
      const day = eventDate.getUTCDate();
      const hours = eventDate.getUTCHours();
      const minutes = eventDate.getUTCMinutes();
      
      // Criar chave de data usando componentes UTC
      const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      console.log('[DEBUG] Agrupando evento:', {
        id: event.id,
        titulo: event.title,
        dateUTC: eventDate.toISOString(),
        dateKey,
        dataFormatada: `${day}/${month}/${year} ${hours}:${String(minutes).padStart(2, '0')}`,
        componentes: { year, month, day, hours, minutes }
      });
      
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push({ ...event, parsedDate: eventDate });
    });
    
    // Ordenar eventos dentro de cada dia por horário (ordem cronológica)
    Object.keys(grouped).forEach(dateKey => {
      grouped[dateKey].sort((a, b) => {
        const timeA = a.parsedDate.getTime();
        const timeB = b.parsedDate.getTime();
        return timeA - timeB;
      });
      
      // Log da ordem final após ordenação
      console.log(`[DEBUG] Eventos ordenados para ${dateKey}:`, 
        grouped[dateKey].map(e => ({
          titulo: e.title,
          horario: `${String(e.parsedDate.getUTCHours()).padStart(2, '0')}:${String(e.parsedDate.getUTCMinutes()).padStart(2, '0')}`,
          timestamp: e.parsedDate.getTime()
        }))
      );
    });
    
    return grouped;
  };

  const groupedEvents = groupEventsByDate();
  const sortedDates = Object.keys(groupedEvents).sort();

  // ========== IMPRESSÃO / PDF DO ROTEIRO ==========

  // Formata 'yyyy-MM-dd' em UTC (evita cair um dia antes)
  const formatTripDate = (dateStr) => formatUtcShortDate(toUtcDayStart(dateStr));

  // Nome de arquivo sem acentos/espaços
  const slugify = (value) =>
    (value || 'viagem')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'viagem';

  // Monta o payload do PDF a partir do MESMO agrupamento exibido na tela,
  // garantindo que o impresso reflita o roteiro atualizado.
  const buildItineraryData = () => {
    const days = sortedDates.map((dateKey) => {
      const utcDate = utcDateFromKey(dateKey);

      return {
        title: formatUtcDate(utcDate),
        weekday: formatUtcWeekday(utcDate),
        // Canhoto do bilhete: dia em destaque e mês abreviado
        dayNumber: String(utcDate.getUTCDate()).padStart(2, '0'),
        monthShort: MONTH_NAMES[utcDate.getUTCMonth()].slice(0, 3),
        events: groupedEvents[dateKey].map((event) => ({
          time: `${String(event.parsedDate.getUTCHours()).padStart(2, '0')}:${String(event.parsedDate.getUTCMinutes()).padStart(2, '0')}`,
          type: event.type,
          typeLabel: eventTypes[event.type]?.label || event.type || '',
          title: event.title || 'Sem título',
          location: event.location || '',
          description: event.description || ''
        }))
      };
    });

    const byType = Object.entries(eventTypes)
      .map(([key, { label }]) => ({
        label,
        count: events.filter((event) => event.type === key).length
      }))
      .filter((item) => item.count > 0);

    const startDate = currentTrip.startDate || currentTrip.start_date;
    const endDate = currentTrip.endDate || currentTrip.end_date;
    const startLabel = formatTripDate(startDate);
    const endLabel = formatTripDate(endDate);

    return {
      trip: {
        name: currentTrip.name || 'Viagem',
        destination: currentTrip.destination || '',
        period: startLabel && endLabel
          ? `${startLabel} a ${endLabel}`
          : (startLabel || endLabel || '')
      },
      days,
      summary: {
        totalEvents: events.length,
        totalDays: sortedDates.length,
        byType
      },
      participants: (participants || [])
        .map((uid) => participantsData?.[uid]?.displayName)
        .filter(Boolean)
    };
  };

  const handleOpenPrintModal = () => {
    document.body.style.overflow = 'hidden';
    setShowPrintModal(true);
  };

  const handleClosePrintModal = () => {
    document.body.style.overflow = '';
    setShowPrintModal(false);
  };

  // mode: 'print' (abre a impressão) | 'download' (salva o PDF)
  const handleGenerateItinerary = async (mode) => {
    if (!currentTrip || printing) return;

    if (sortedDates.length === 0) {
      alert('Adicione pelo menos um evento antes de imprimir o roteiro.');
      return;
    }

    setPrinting(true);

    try {
      // Carrega o gerador de PDF sob demanda: a biblioteca (jsPDF) só entra na
      // rede quando o usuário realmente pede o impresso, mantendo o Roteiro leve.
      const { pdfExporter, printPdfFromUrl } = await import('../utils/pdfExporter');

      const itineraryData = buildItineraryData();
      // Data E hora no nome: exportar duas vezes no mesmo dia precisa gerar dois
      // arquivos distintos, senão o antigo continua no disco e parece desatualizado
      const filename = `roteiro-${slugify(currentTrip.name)}-${format(new Date(), "yyyy-MM-dd_HH'h'mm")}`;

      const result = await pdfExporter.exportItinerary(itineraryData, filename, {
        ...printOptions,
        output: mode === 'print' ? 'print' : 'save'
      });

      if (!result.success) {
        alert('Erro ao gerar o PDF do roteiro: ' + (result.error || 'Erro desconhecido'));
        return;
      }

      if (mode === 'print') {
        const opened = result.url ? await printPdfFromUrl(result.url) : false;
        if (!opened) {
          alert('Não foi possível abrir a impressão (verifique o bloqueador de pop-ups). Use "Baixar PDF" como alternativa.');
          return;
        }
      }

      setSuccessMessage(mode === 'print' ? 'Roteiro enviado para impressão!' : 'PDF do roteiro gerado!');
      setTimeout(() => setSuccessMessage(''), 3000);
      handleClosePrintModal();
    } catch (error) {
      console.error('Erro ao gerar roteiro em PDF:', error);
      alert('Erro ao gerar o PDF do roteiro. Tente novamente.');
    } finally {
      setPrinting(false);
    }
  };

  const togglePrintOption = (key) => {
    setPrintOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!currentTrip) {
    return (
      <>
        <div className="max-w-4xl mx-auto">
          <div className="empty-state animate-fade-in">
            <div className="w-20 h-20 bg-ocean-50 rounded-full flex items-center justify-center mb-6 animate-bounce-subtle">
              <Plane className="w-10 h-10 text-ocean" />
            </div>
            <h2 className="text-2xl font-bold text-dark mb-3">Nenhuma viagem encontrada</h2>
            <p className="text-sand-500 mb-8 max-w-md">
              Crie sua primeira viagem para começar a planejar momentos inesquecíveis
            </p>
            <button 
              className="btn-primary" 
              onClick={() => {
                console.log('Botão clicado!');
                // Previne scroll ao abrir modal
                document.body.style.overflow = 'hidden';
                setShowTripModal(true);
              }}
            >
              <Plus className="w-5 h-5 inline mr-2" />
              Criar primeira viagem
            </button>
          </div>
        </div>

        {/* Modal de Criação de Viagem */}
        <AnimatePresence>
          {showTripModal && (
            <>
              <motion.div
                className="modal-overlay"
                variants={modalOverlayVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={(e) => {
                  // Só fecha se clicar no overlay, não no modal
                  if (e.target === e.currentTarget) {
                    document.body.style.overflow = '';
                    setShowTripModal(false);
                  }
                }}
              >
                <motion.div
                  className="modal-container"
                  variants={modalContentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="modal-header">
                    <h2 className="text-2xl font-bold text-dark">Criar Nova Viagem</h2>
                    <motion.button
                      onClick={() => {
                        // Restaura scroll ao fechar
                        document.body.style.overflow = '';
                        setShowTripModal(false);
                      }}
                      className="modal-close"
                      whileHover={{ scale: 1.1, rotate: 90 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <X className="w-5 h-5" />
                    </motion.button>
                  </div>

                <form onSubmit={handleCreateTrip} className="space-y-4 p-4 md:p-6 overflow-y-auto">
                  {/* Nome da Viagem */}
                  <div>
                    <label className="block text-sm font-medium text-dark-100 mb-2">
                      Nome da Viagem *
                    </label>
                    <input
                      type="text"
                      value={tripFormData.name}
                      onChange={(e) => setTripFormData({ ...tripFormData, name: e.target.value })}
                      className="input"
                      placeholder="Ex: Viagem para Paris"
                      required
                    />
                  </div>

                  {/* Destino */}
                  <div>
                    <label className="block text-sm font-medium text-dark-100 mb-2">
                      Destino *
                    </label>
                    <input
                      type="text"
                      value={tripFormData.destination}
                      onChange={(e) => setTripFormData({ ...tripFormData, destination: e.target.value })}
                      className="input"
                      placeholder="Ex: Paris, França"
                      required
                    />
                  </div>

                  {/* Data de Início e Fim */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-100 mb-2">
                        Data de Início *
                      </label>
                      <input
                        type="date"
                        value={tripFormData.startDate}
                        onChange={(e) => setTripFormData({ ...tripFormData, startDate: e.target.value })}
                        className="input"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dark-100 mb-2">
                        Data de Fim *
                      </label>
                      <input
                        type="date"
                        value={tripFormData.endDate}
                        onChange={(e) => setTripFormData({ ...tripFormData, endDate: e.target.value })}
                        className="input"
                        min={tripFormData.startDate}
                        required
                      />
                    </div>
                  </div>

                  {/* Botões */}
                  <div className="flex gap-3 pt-4">
                    <motion.button
                      type="button"
                      onClick={() => {
                        // Restaura scroll ao cancelar
                        document.body.style.overflow = '';
                        setShowTripModal(false);
                      }}
                      className="btn-outline flex-1"
                      variants={buttonVariants}
                      initial="rest"
                      whileHover="hover"
                      whileTap="tap"
                    >
                      Cancelar
                    </motion.button>
                    <motion.button 
                      type="submit" 
                      className="btn-primary flex-1"
                      variants={buttonVariants}
                      initial="rest"
                      whileHover="hover"
                      whileTap="tap"
                      disabled={loading}
                    >
                      {loading ? 'Criando...' : 'Criar Viagem'}
                    </motion.button>
                  </div>
                </form>
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  return (
    <motion.div 
      className="max-w-4xl mx-auto pb-8"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Header com gradiente sutil */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <motion.div 
            className="w-10 h-10 bg-gradient-to-br from-ocean to-aqua rounded-xl flex items-center justify-center"
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <CalendarIcon className="w-6 h-6 text-white" />
          </motion.div>
          <div>
            <h1 className="text-3xl font-bold text-dark">Roteiro da Viagem</h1>
            <motion.p 
              className="text-sand-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {events.length} {events.length === 1 ? 'evento planejado' : 'eventos planejados'}
            </motion.p>
          </div>
        </div>
      </div>

      {/* Mensagem de sucesso */}
      <AnimatePresence>
        {successMessage && (
          <motion.div 
            className="success-message mb-6"
            variants={successVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <Check className="w-5 h-5 flex-shrink-0" />
            <span>{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card do Contador da Viagem */}
      {currentTrip && (currentTrip.startDate || currentTrip.start_date) && (
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <TripCountdown 
            startDate={currentTrip.startDate || currentTrip.start_date}
            endDate={currentTrip.endDate || currentTrip.end_date}
            tripName={currentTrip.name}
          />
        </motion.div>
      )}

      {/* Ações do roteiro */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-8">
        <motion.button
          onClick={() => handleOpenModal()}
          className="btn-primary w-full sm:w-auto shadow-lg hover:shadow-xl"
          variants={buttonVariants}
          initial="rest"
          whileHover="hover"
          whileTap="tap"
        >
          <Plus className="w-5 h-5 inline mr-2" />
          Adicionar Evento
        </motion.button>

        {/* Alterar o período da viagem */}
        <motion.button
          onClick={handleOpenEditDatesModal}
          className="btn-outline w-full sm:w-auto flex items-center justify-center gap-2"
          variants={buttonVariants}
          initial="rest"
          whileHover="hover"
          whileTap="tap"
          title="Alterar as datas de início e fim da viagem"
        >
          <CalendarRange className="w-5 h-5" />
          Alterar Datas
        </motion.button>

        {/* Imprimir / exportar o roteiro atualizado */}
        <motion.button
          onClick={handleOpenPrintModal}
          className="btn-outline w-full sm:w-auto sm:ml-auto flex items-center justify-center gap-2"
          variants={buttonVariants}
          initial="rest"
          whileHover="hover"
          whileTap="tap"
          title="Gerar PDF do roteiro para imprimir"
          disabled={printing}
        >
          <Printer className="w-5 h-5" />
          {printing ? 'Gerando...' : 'Imprimir Roteiro'}
        </motion.button>
      </div>

      {/* Lista de eventos */}
      {sortedDates.length === 0 ? (
        <div className="empty-state animate-fade-in">
          <div className="w-20 h-20 bg-ocean-50 rounded-full flex items-center justify-center mb-6">
            <CalendarIcon className="w-10 h-10 text-ocean animate-pulse-soft" />
          </div>
          <h3 className="text-2xl font-bold text-dark mb-3">Comece sua jornada</h3>
          <p className="text-sand-500 mb-8 max-w-md">
            Adicione o primeiro evento e comece a planejar cada detalhe da sua viagem
          </p>
          <button 
            onClick={() => handleOpenModal()}
            className="btn-primary"
          >
            <Plus className="w-5 h-5 inline mr-2" />
            Adicionar primeiro evento
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {sortedDates.map((dateKey, dateIndex) => (
            <motion.div 
              key={dateKey}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: dateIndex * 0.1, duration: 0.3 }}
            >
              {/* Header da data com estilo timeline */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-3 bg-gradient-to-r from-ocean-50 to-transparent pr-8 py-2 rounded-l-full">
                  <motion.div 
                    className="w-10 h-10 bg-ocean rounded-full flex items-center justify-center flex-shrink-0 shadow-md"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: dateIndex * 0.1 + 0.1, type: 'spring', stiffness: 200 }}
                  >
                    <CalendarIcon className="w-5 h-5 text-white" />
                  </motion.div>
                  <div>
                    <h2 className="text-lg font-bold text-dark">
                      {(() => {
                        const [year, month, day] = dateKey.split('-').map(Number);
                        const months = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
                        return `${day} de ${months[month - 1]}`;
                      })()}
                    </h2>
                    <p className="text-xs text-sand-500">
                      {formatUtcWeekday(utcDateFromKey(dateKey))}
                    </p>
                  </div>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-sand-300 to-transparent"></div>
                <span className="text-xs font-medium text-sand-400 bg-sand-100 px-3 py-1 rounded-full">
                  {groupedEvents[dateKey].length} {groupedEvents[dateKey].length === 1 ? 'evento' : 'eventos'}
                </span>
              </div>

              {/* Eventos do dia com linha de conexão */}
              <div className="relative pl-6 space-y-4">
                {/* Linha vertical timeline */}
                <motion.div 
                  className="absolute left-5 top-0 bottom-0 w-0.5 bg-gradient-to-b from-ocean-200 via-aqua-200 to-transparent"
                  initial={{ scaleY: 0, originY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ delay: dateIndex * 0.1 + 0.2, duration: 0.4 }}
                ></motion.div>
                
                {groupedEvents[dateKey].map((event, eventIndex) => {
                  const EventIcon = eventTypes[event.type].icon;
                  const eventColor = eventTypes[event.type].color;

                  return (
                    <motion.div 
                      key={event.id} 
                      className="relative"
                      variants={cardVariants}
                      initial="hidden"
                      animate="visible"
                      custom={dateIndex * 3 + eventIndex}
                    >
                      {/* Dot na timeline */}
                      <motion.div 
                        className={`absolute -left-[26px] top-6 w-3 h-3 ${eventColor} rounded-full border-4 border-sand shadow-sm z-10`}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: (dateIndex * 3 + eventIndex) * 0.04 + 0.15, type: 'spring' }}
                      ></motion.div>
                      
                      <motion.div 
                        className="card-interactive group"
                        whileHover={{ scale: 1.015, transition: { duration: 0.2 } }}
                      >
                        <div className="flex gap-4">
                          {/* Ícone animado */}
                          <motion.div 
                            className={`${eventColor} w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-md`}
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            transition={{ type: 'spring', stiffness: 300 }}
                          >
                            <EventIcon className="w-7 h-7 text-white" />
                          </motion.div>

                          {/* Conteúdo com melhor hierarquia */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`badge ${eventColor} bg-opacity-20 text-xs font-semibold`}>
                                    {eventTypes[event.type].label}
                                  </span>
                                  <span className="text-xs text-sand-400">•</span>
                                  <span className="text-xs text-sand-500 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {String(event.parsedDate.getUTCHours()).padStart(2, '0')}:{String(event.parsedDate.getUTCMinutes()).padStart(2, '0')}
                                  </span>
                                </div>
                                <h3 className="text-lg font-bold text-dark mb-1 group-hover:text-ocean transition-colors">
                                  {event.title}
                                </h3>
                                {event.location && (
                                  <motion.button
                                    type="button"
                                    onClick={() => openLocationInMaps(event.location)}
                                    className="text-sm text-sand-500 hover:text-ocean hover:underline flex items-center gap-1 mb-2 transition-colors"
                                    title="Ver no Google Maps"
                                    whileHover={{ x: 2 }}
                                  >
                                    <MapPinIcon className="w-3.5 h-3.5" />
                                    {event.location}
                                    <ExternalLink className="w-3 h-3 ml-1" />
                                  </motion.button>
                                )}
                              </div>
                              
                              {/* Ações com melhor feedback */}
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <motion.button
                                  onClick={() => handleOpenModal(event)}
                                  className="p-2.5 hover:bg-ocean-50 rounded-xl transition-all"
                                  title="Editar evento"
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  <Edit2 className="w-4 h-4 text-ocean" />
                                </motion.button>
                                <motion.button
                                  onClick={() => handleDeleteEvent(event.id)}
                                  className="p-2.5 hover:bg-red-50 rounded-xl transition-all"
                                  title="Excluir evento"
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </motion.button>
                              </div>
                            </div>

                            {event.description && (
                              <motion.p 
                                className="text-sm text-dark-50 leading-relaxed bg-sand-50 px-3 py-2 rounded-lg"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                transition={{ delay: 0.1 }}
                              >
                                {event.description}
                              </motion.p>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal de adicionar/editar evento */}
      <AnimatePresence>
        {showModal && (
          <>
            {/* Overlay com blur */}
            <motion.div 
              className="modal-overlay"
              variants={modalOverlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => {
                // Só fecha se clicar no overlay, não no modal
                if (e.target === e.currentTarget) {
                  handleCloseModal();
                }
              }}
            >
              <motion.div 
                className="modal-container"
                variants={modalContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header do modal */}
                <div className="modal-header">
                  <h2 className="text-2xl font-bold text-dark">
                    {editingEvent ? 'Editar Evento' : 'Novo Evento'}
                  </h2>
                  <motion.button
                    type="button"
                    onClick={handleCloseModal}
                    className="modal-close"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>

            {/* Formulário */}
            <form onSubmit={handleSubmit} className="p-4 md:p-6 space-y-4 overflow-y-auto">
              {/* Tipo */}
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Tipo de Evento
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {Object.entries(eventTypes).map(([key, { icon: Icon, label, color }]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setFormData({ ...formData, type: key })}
                      className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                        formData.type === key
                          ? `${color} border-transparent text-white`
                          : 'border-sand-300 hover:border-sand-400'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Título */}
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Título *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="input"
                  placeholder="Ex: Voo para São Paulo"
                  required
                />
              </div>

              {/* Data e Hora */}
              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-sm font-medium text-dark-100 mb-2">
                    Hora
                  </label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="input"
                  />
                </div>
              </div>

              {/* Local */}
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Local
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="input flex-1"
                    placeholder="Ex: Aeroporto de Guarulhos"
                  />
                  {formData.location && (
                    <motion.button
                      type="button"
                      onClick={() => openLocationInMaps(formData.location)}
                      className="p-3 bg-ocean hover:bg-ocean-600 text-white rounded-xl transition-all flex items-center gap-2 flex-shrink-0"
                      title="Ver no Google Maps"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <MapPin className="w-5 h-5" />
                      <ExternalLink className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input min-h-[100px] resize-none"
                  placeholder="Adicione detalhes sobre este evento..."
                />
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <motion.button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn-outline flex-1"
                  variants={buttonVariants}
                  initial="rest"
                  whileHover="hover"
                  whileTap="tap"
                >
                  Cancelar
                </motion.button>
                <motion.button 
                  type="submit" 
                  className="btn-primary flex-1 relative"
                  variants={buttonVariants}
                  initial="rest"
                  whileHover="hover"
                  whileTap="tap"
                  disabled={loading}
                >
                  {loading ? (
                    <motion.span
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      Salvando...
                    </motion.span>
                  ) : (
                    editingEvent ? 'Salvar' : 'Adicionar'
                  )}
                </motion.button>
              </div>
            </form>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal de Criação de Viagem */}
      <AnimatePresence>
        {showTripModal && (
          <>
            <motion.div
              className="modal-overlay"
              variants={modalOverlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={() => {
                // Restaura scroll ao fechar
                document.body.style.overflow = '';
                setShowTripModal(false);
              }}
            />
            <motion.div
              className="modal-container"
              variants={modalContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              <div className="modal-header">
                <h2 className="text-2xl font-bold text-dark">Criar Nova Viagem</h2>
                <motion.button
                  onClick={() => {
                    // Restaura scroll ao fechar
                    document.body.style.overflow = '';
                    setShowTripModal(false);
                  }}
                  className="modal-close"
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              <form onSubmit={handleCreateTrip} className="space-y-5 p-6">
                {/* Nome da Viagem */}
                <div>
                  <label className="block text-sm font-medium text-dark-100 mb-2">
                    Nome da Viagem *
                  </label>
                  <input
                    type="text"
                    value={tripFormData.name}
                    onChange={(e) => setTripFormData({ ...tripFormData, name: e.target.value })}
                    className="input"
                    placeholder="Ex: Viagem para Paris"
                    required
                  />
                </div>

                {/* Destino */}
                <div>
                  <label className="block text-sm font-medium text-dark-100 mb-2">
                    Destino *
                  </label>
                  <input
                    type="text"
                    value={tripFormData.destination}
                    onChange={(e) => setTripFormData({ ...tripFormData, destination: e.target.value })}
                    className="input"
                    placeholder="Ex: Paris, França"
                    required
                  />
                </div>

                {/* Botões */}
                <div className="flex gap-3 pt-4">
                  <motion.button
                    type="button"
                    onClick={() => {
                      // Restaura scroll ao cancelar
                      document.body.style.overflow = '';
                      setShowTripModal(false);
                    }}
                    className="btn-outline flex-1"
                    variants={buttonVariants}
                    initial="rest"
                    whileHover="hover"
                    whileTap="tap"
                  >
                    Cancelar
                  </motion.button>
                  <motion.button 
                    type="submit" 
                    className="btn-primary flex-1"
                    variants={buttonVariants}
                    initial="rest"
                    whileHover="hover"
                    whileTap="tap"
                    disabled={loading}
                  >
                    {loading ? 'Criando...' : 'Criar Viagem'}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Modal de Impressão / PDF do Roteiro */}
      <AnimatePresence>
        {showPrintModal && (
          <motion.div
            className="modal-overlay"
            variants={modalOverlayVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={(e) => {
              if (e.target === e.currentTarget && !printing) {
                handleClosePrintModal();
              }
            }}
          >
            <motion.div
              className="modal-container"
              variants={modalContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h2 className="text-2xl font-bold text-dark">Imprimir Roteiro</h2>
                <motion.button
                  type="button"
                  onClick={handleClosePrintModal}
                  className="modal-close"
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  disabled={printing}
                >
                  <X className="w-5 h-5" />
                </motion.button>
              </div>

              <div className="p-4 md:p-6 space-y-5 overflow-y-auto">
                {/* Resumo do que será impresso */}
                <div className="bg-sand-100 border border-sand-300 rounded-xl p-4">
                  <p className="font-bold text-dark mb-1">{currentTrip.name}</p>
                  {currentTrip.destination && (
                    <p className="text-sm text-sand-500">{currentTrip.destination}</p>
                  )}
                  <p className="text-sm text-sand-500 mt-2">
                    {events.length} {events.length === 1 ? 'evento' : 'eventos'} em{' '}
                    {sortedDates.length} {sortedDates.length === 1 ? 'dia' : 'dias'}
                  </p>
                </div>

                {/* Opções de conteúdo */}
                <div>
                  <p className="block text-sm font-medium text-dark-100 mb-3">
                    O que incluir no impresso
                  </p>
                  <div className="space-y-2">
                    {[
                      { key: 'includeChecklist', label: 'Caixas para marcar (☐) em cada evento', hint: 'Ideal para acompanhar o roteiro no papel' },
                      { key: 'includeLocation', label: 'Locais dos eventos' },
                      { key: 'includeDescription', label: 'Descrições dos eventos' },
                      { key: 'includeParticipants', label: 'Lista de viajantes' },
                      { key: 'includeNotes', label: 'Espaço para anotações à mão' }
                    ].map(({ key, label, hint }) => (
                      <label
                        key={key}
                        className="flex items-start gap-3 p-3 border-2 border-sand-300 rounded-xl cursor-pointer hover:border-ocean-200 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={printOptions[key]}
                          onChange={() => togglePrintOption(key)}
                          className="mt-0.5 w-5 h-5 accent-ocean flex-shrink-0"
                        />
                        <span className="text-sm text-dark-100">
                          {label}
                          {hint && <span className="block text-xs text-sand-500 mt-0.5">{hint}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Aviso */}
                <div className="bg-ocean-50 border border-ocean-200 rounded-lg p-3 flex gap-3">
                  <AlertCircle className="w-5 h-5 text-ocean flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-dark-50">
                    O PDF é gerado no seu dispositivo com os dados atuais do roteiro. Sempre que
                    houver mudanças, gere novamente para ter o impresso atualizado.
                  </p>
                </div>

                {/* Ações */}
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <motion.button
                    type="button"
                    onClick={() => handleGenerateItinerary('download')}
                    className="btn-outline flex-1 flex items-center justify-center gap-2"
                    variants={buttonVariants}
                    initial="rest"
                    whileHover="hover"
                    whileTap="tap"
                    disabled={printing}
                  >
                    <Download className="w-5 h-5" />
                    Baixar PDF
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => handleGenerateItinerary('print')}
                    className="btn-primary flex-1 flex items-center justify-center gap-2"
                    variants={buttonVariants}
                    initial="rest"
                    whileHover="hover"
                    whileTap="tap"
                    disabled={printing}
                  >
                    <Printer className="w-5 h-5" />
                    {printing ? 'Gerando...' : 'Imprimir'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de Edição de Datas */}
      <AnimatePresence>
        {showEditDatesModal && (
          <>
            <motion.div
              className="modal-overlay"
              variants={modalOverlayVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  document.body.style.overflow = '';
                  setShowEditDatesModal(false);
                }
              }}
            >
              <motion.div
                className="modal-container"
                variants={modalContentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="modal-header">
                  <h2 className="text-2xl font-bold text-dark">Alterar Datas da Viagem</h2>
                  <motion.button
                    onClick={() => {
                      document.body.style.overflow = '';
                      setShowEditDatesModal(false);
                    }}
                    className="modal-close"
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>

                <form onSubmit={handleEditDates} className="space-y-5 p-6">
                  {/* Data de Início */}
                  <div>
                    <label className="block text-sm font-medium text-dark-100 mb-2">
                      Data de Início da Viagem *
                    </label>
                    <input
                      type="date"
                      value={editDatesData.startDate}
                      onChange={(e) => setEditDatesData({ ...editDatesData, startDate: e.target.value })}
                      className="input"
                      required
                    />
                  </div>

                  {/* Data de Fim */}
                  <div>
                    <label className="block text-sm font-medium text-dark-100 mb-2">
                      Data de Fim da Viagem *
                    </label>
                    <input
                      type="date"
                      value={editDatesData.endDate}
                      onChange={(e) => setEditDatesData({ ...editDatesData, endDate: e.target.value })}
                      className="input"
                      min={editDatesData.startDate}
                      required
                    />
                  </div>

                  {/* Aviso */}
                  <div className="bg-ocean-50 border border-ocean-200 rounded-lg p-3 flex gap-3">
                    <AlertCircle className="w-5 h-5 text-ocean flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-dark-50">
                      As datas da viagem definem o período para a história e filtram os eventos dentro deste período.
                    </p>
                  </div>

                  {/* Botões */}
                  <div className="flex gap-3 pt-4">
                    <motion.button
                      type="button"
                      onClick={() => {
                        document.body.style.overflow = '';
                        setShowEditDatesModal(false);
                      }}
                      className="btn-outline flex-1"
                      variants={buttonVariants}
                      initial="rest"
                      whileHover="hover"
                      whileTap="tap"
                    >
                      Cancelar
                    </motion.button>
                    <motion.button
                      type="submit"
                      className="btn-primary flex-1"
                      variants={buttonVariants}
                      initial="rest"
                      whileHover="hover"
                      whileTap="tap"
                      disabled={loading}
                    >
                      {loading ? 'Salvando...' : 'Salvar Datas'}
                    </motion.button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default RoteiroPage;
