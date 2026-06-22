import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTrip } from '../contexts/TripContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, 
  MapPin, 
  Calendar,
  Users,
  Car,
  Plane,
  Check,
  Clock,
  Archive,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { format, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { pageVariants, cardVariants, buttonVariants, modalOverlayVariants, modalContentVariants } from '../utils/motionVariants';

const SelecionarViagemPage = () => {
  const { user } = useAuth();
  const { 
    trips, 
    currentTrip, 
    createTrip, 
    updateTrip, 
    selectTrip,
    participantsData 
  } = useTrip();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingTrip, setEditingTrip] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    destination: '',
    startDate: '',
    endDate: '',
    description: '',
    transportType: 'car'
  });

  const resetForm = () => {
    setFormData({
      name: '',
      destination: '',
      startDate: '',
      endDate: '',
      description: '',
      transportType: 'car'
    });
    setEditingTrip(null);
  };

  const handleCreateTrip = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.destination) {
      alert('Por favor, preencha os campos obrigatórios');
      return;
    }

    const result = await createTrip({
      ...formData,
      startDate: formData.startDate ? new Date(formData.startDate) : null,
      endDate: formData.endDate ? new Date(formData.endDate) : null,
      status: 'active'
    });

    if (result.success) {
      setShowCreateModal(false);
      resetForm();
    } else {
      alert('Erro ao criar viagem: ' + result.error);
    }
  };

  const handleUpdateTrip = async (e) => {
    e.preventDefault();
    
    if (!formData.name || !formData.destination || !editingTrip) {
      alert('Por favor, preencha os campos obrigatórios');
      return;
    }

    const result = await updateTrip(editingTrip.id, {
      ...formData,
      startDate: formData.startDate ? new Date(formData.startDate) : null,
      endDate: formData.endDate ? new Date(formData.endDate) : null
    });

    if (result.success) {
      setEditingTrip(null);
      resetForm();
    } else {
      alert('Erro ao atualizar viagem: ' + result.error);
    }
  };

  const handleSelectTrip = async (trip) => {
    if (selectTrip) {
      await selectTrip(trip.id);
    }
  };

  const handleEditTrip = (trip) => {
    setEditingTrip(trip);
    // Função auxiliar para conversão local
    const formatDateForInput = (dateStr) => {
      if (!dateStr) return '';
      if (typeof dateStr === 'string' && dateStr.includes('-')) {
        return dateStr; // Já está no formato yyyy-MM-dd
      }
      // Se for timestamp do Firebase, converter corretamente
      const date = dateStr?.toDate ? dateStr.toDate() : new Date(dateStr);
      return format(date, 'yyyy-MM-dd');
    };
    
    setFormData({
      name: trip.name || '',
      destination: trip.destination || '',
      startDate: formatDateForInput(trip.startDate),
      endDate: formatDateForInput(trip.endDate),
      description: trip.description || '',
      transportType: trip.transportType || 'car'
    });
  };

  const openCreateModal = () => {
    resetForm();
    setShowCreateModal(true);
  };

  const getStatusInfo = (trip) => {
    const now = new Date();
    
    if (trip.status === 'archived') {
      return { label: 'Arquivada', color: 'text-sand-500', icon: Archive };
    }
    
    if (!trip.startDate || !trip.endDate) {
      return { label: 'Em planejamento', color: 'text-blue-500', icon: Clock };
    }
    
    // Conversão local para evitar problemas UTC
    let startDate, endDate;
    if (typeof trip.startDate === 'string') {
      const [year, month, day] = trip.startDate.split('-').map(Number);
      startDate = new Date(year, month - 1, day);
    } else {
      startDate = trip.startDate?.toDate ? trip.startDate.toDate() : new Date(trip.startDate);
    }
    
    if (typeof trip.endDate === 'string') {
      const [year, month, day] = trip.endDate.split('-').map(Number);
      endDate = new Date(year, month - 1, day);
    } else {
      endDate = trip.endDate?.toDate ? trip.endDate.toDate() : new Date(trip.endDate);
    }
    
    if (isBefore(now, startDate)) {
      return { label: 'Futura', color: 'text-blue-500', icon: Clock };
    } else if (isAfter(now, endDate)) {
      return { label: 'Finalizada', color: 'text-sand-500', icon: Check };
    } else {
      return { label: 'Em andamento', color: 'text-green-500', icon: Check };
    }
  };

  const getTransportIcon = (type) => {
    switch (type) {
      case 'plane':
        return Plane;
      case 'car':
        return Car;
      default:
        return Car;
    }
  };

  const activeTrips = trips.filter(trip => trip.status !== 'archived');
  const archivedTrips = trips.filter(trip => trip.status === 'archived');

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="in"
      exit="out"
      className="space-y-6"
    >
      {/* Cabeçalho */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-dark mb-2">Suas Viagens</h1>
        <p className="text-dark-50">
          Gerencie suas viagens ou crie uma nova aventura
        </p>
      </div>

      {/* Botão Nova Viagem */}
      <div className="flex justify-center">
        <motion.button
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
          onClick={openCreateModal}
          className="bg-ocean text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2 hover:bg-ocean/90"
        >
          <Plus className="h-5 w-5" />
          Nova Viagem
        </motion.button>
      </div>

      {/* Lista de Viagens Ativas */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-dark-100">Viagens Ativas</h2>
        
        {activeTrips.length === 0 ? (
          <motion.div
            variants={cardVariants}
            className="bg-white rounded-2xl p-8 text-center border border-sand-300"
          >
            <MapPin className="h-12 w-12 text-sand-500 mx-auto mb-4" />
            <p className="text-dark-50">
              Você ainda não tem viagens ativas. Que tal criar sua primeira aventura?
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTrips.map((trip) => {
              const statusInfo = getStatusInfo(trip);
              const TransportIcon = getTransportIcon(trip.transportType);
              const isSelected = currentTrip?.id === trip.id;
              
              return (
                <motion.div
                  key={trip.id}
                  variants={cardVariants}
                  className={`bg-white rounded-2xl p-6 border-2 cursor-pointer transition-all ${
                    isSelected 
                      ? 'border-ocean shadow-lg' 
                      : 'border-sand-300 hover:border-sand-400 hover:shadow-md'
                  }`}
                  onClick={() => !isSelected && handleSelectTrip(trip)}
                >
                  {/* Status e Seleção */}
                  <div className="flex justify-between items-start mb-4">
                    <div className={`flex items-center gap-2 ${statusInfo.color}`}>
                      <statusInfo.icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{statusInfo.label}</span>
                    </div>
                    
                    {isSelected && (
                      <div className="bg-ocean text-white rounded-full p-1">
                        <Check className="h-4 w-4" />
                      </div>
                    )}
                  </div>

                  {/* Informações da Viagem */}
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold text-dark truncate">
                        {trip.name}
                      </h3>
                      <div className="flex items-center gap-2 text-dark-50 mt-1">
                        <MapPin className="h-4 w-4" />
                        <span className="text-sm truncate">{trip.destination}</span>
                      </div>
                    </div>

                    {/* Datas */}
                    {trip.startDate && trip.endDate && (
                      <div className="flex items-center gap-2 text-dark-50">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm">
                          {(() => {
                            // Conversão local para evitar problemas UTC
                            const formatLocalDate = (dateStr, formatStr) => {
                              if (typeof dateStr === 'string') {
                                const [year, month, day] = dateStr.split('-').map(Number);
                                const localDate = new Date(year, month - 1, day);
                                return format(localDate, formatStr, { locale: ptBR });
                              }
                              return format(new Date(dateStr), formatStr, { locale: ptBR });
                            };
                            return `${formatLocalDate(trip.startDate, 'dd/MM')} - ${formatLocalDate(trip.endDate, 'dd/MM/yyyy')}`;
                          })()}
                        </span>
                      </div>
                    )}

                    {/* Participantes e Transporte */}
                    <div className="flex justify-between items-center text-sm text-sand-500">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{trip.participants?.length || 1} participantes</span>
                      </div>
                      
                      <TransportIcon className="h-4 w-4" />
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex gap-2 mt-4 pt-4 border-t border-sand-200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditTrip(trip);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-dark-50 hover:bg-sand-100 rounded-lg transition-colors"
                    >
                      <Edit2 className="h-4 w-4" />
                      <span className="text-sm">Editar</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Viagens Arquivadas */}
      {archivedTrips.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-dark-100">Viagens Arquivadas</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {archivedTrips.map((trip) => {
              const TransportIcon = getTransportIcon(trip.transportType);
              
              return (
                <motion.div
                  key={trip.id}
                  variants={cardVariants}
                  className="bg-white rounded-2xl p-6 border border-sand-300 opacity-75"
                >
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-lg font-semibold text-dark-50 truncate">
                        {trip.name}
                      </h3>
                      <div className="flex items-center gap-2 text-sand-500 mt-1">
                        <MapPin className="h-4 w-4" />
                        <span className="text-sm truncate">{trip.destination}</span>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-sm text-sand-500">
                      <div className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        <span>{trip.participants?.length || 1} participantes</span>
                      </div>
                      
                      <TransportIcon className="h-4 w-4" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Criar/Editar Viagem */}
      <AnimatePresence>
        {(showCreateModal || editingTrip) && (
          <motion.div
            variants={modalOverlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowCreateModal(false);
                setEditingTrip(null);
                resetForm();
              }
            }}
          >
            <motion.div
              variants={modalContentVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-dark">
                  {editingTrip ? 'Editar Viagem' : 'Nova Viagem'}
                </h3>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingTrip(null);
                    resetForm();
                  }}
                  className="p-2 hover:bg-sand-200 rounded-lg"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={editingTrip ? handleUpdateTrip : handleCreateTrip} className="space-y-4">
                {/* Nome da Viagem */}
                <div>
                  <label className="block text-sm font-medium text-dark-100 mb-2">
                    Nome da Viagem *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-sand-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-ocean/20 focus:border-ocean"
                    placeholder="Ex: Férias em Gramado"
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
                    value={formData.destination}
                    onChange={(e) => setFormData(prev => ({ ...prev, destination: e.target.value }))}
                    className="w-full px-4 py-3 border border-sand-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-ocean/20 focus:border-ocean"
                    placeholder="Ex: Gramado, RS"
                    required
                  />
                </div>

                {/* Datas */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-100 mb-2">
                      Data de Início
                    </label>
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                      className="w-full px-4 py-3 border border-sand-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-ocean/20 focus:border-ocean"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-100 mb-2">
                      Data de Fim
                    </label>
                    <input
                      type="date"
                      value={formData.endDate}
                      onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                      className="w-full px-4 py-3 border border-sand-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-ocean/20 focus:border-ocean"
                    />
                  </div>
                </div>

                {/* Tipo de Transporte */}
                <div>
                  <label className="block text-sm font-medium text-dark-100 mb-2">
                    Transporte Principal
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, transportType: 'car' }))}
                      className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-colors ${
                        formData.transportType === 'car'
                          ? 'border-ocean bg-ocean/10 text-ocean'
                          : 'border-sand-300 text-dark-50 hover:border-sand-400'
                      }`}
                    >
                      <Car className="h-5 w-5" />
                      <span className="font-medium">Carro</span>
                    </button>
                    
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, transportType: 'plane' }))}
                      className={`p-3 rounded-xl border-2 flex items-center justify-center gap-2 transition-colors ${
                        formData.transportType === 'plane'
                          ? 'border-ocean bg-ocean/10 text-ocean'
                          : 'border-sand-300 text-dark-50 hover:border-sand-400'
                      }`}
                    >
                      <Plane className="h-5 w-5" />
                      <span className="font-medium">Avião</span>
                    </button>
                  </div>
                </div>

                {/* Descrição */}
                <div>
                  <label className="block text-sm font-medium text-dark-100 mb-2">
                    Descrição (opcional)
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 border border-sand-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-ocean/20 focus:border-ocean resize-none"
                    placeholder="Descreva sua viagem..."
                  />
                </div>

                {/* Botões */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setEditingTrip(null);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-3 border border-sand-300 text-dark-50 rounded-xl font-semibold hover:bg-sand-100 transition-colors"
                  >
                    Cancelar
                  </button>
                  
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-ocean text-white rounded-xl font-semibold hover:bg-ocean/90 transition-colors"
                  >
                    {editingTrip ? 'Salvar' : 'Criar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SelecionarViagemPage;