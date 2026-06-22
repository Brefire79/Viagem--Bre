import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { useTrip } from '../contexts/TripContext';
import { Users, Mail, Trash2, Edit2, Check, X, Archive, Eye, Calendar } from 'lucide-react';
import { doc, updateDoc, arrayRemove } from 'firebase/firestore';
import { db } from '../firebase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const GerenciarViagemPage = () => {
  const { user, updateDisplayName } = useAuth();
  const { currentTrip, participantsData, updateTrip, addParticipant, removeParticipant, deleteTrip, trips, setCurrentTrip } = useTrip();
  
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(currentTrip?.name || '');
  const [isEditingDestination, setIsEditingDestination] = useState(false);
  const [editedDestination, setEditedDestination] = useState(currentTrip?.destination || '');
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editedStartDate, setEditedStartDate] = useState(currentTrip?.startDate || '');
  const [editedEndDate, setEditedEndDate] = useState(currentTrip?.endDate || '');
  
  const [isEditingUserName, setIsEditingUserName] = useState(false);
  const [editedUserName, setEditedUserName] = useState(user?.displayName || '');
  
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [participantEmail, setParticipantEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  const [editingParticipantId, setEditingParticipantId] = useState(null);
  const [editingParticipantName, setEditingParticipantName] = useState('');
  
  const [showArchived, setShowArchived] = useState(false);
  const [showEndTripModal, setShowEndTripModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isViewingArchived = currentTrip?.status === 'archived';

  // Formata "YYYY-MM-DD" -> "DD/MM/YYYY" sem passar por Date (evita shift de timezone)
  const formatTripDate = (d) => {
    if (!d || typeof d !== 'string') return '';
    const [y, m, day] = d.split('-');
    return day && m && y ? `${day}/${m}/${y}` : d;
  };

  if (!currentTrip) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <p className="text-sand-400 text-lg">Nenhuma viagem selecionada</p>
        </div>
      </div>
    );
  }

  const handleSaveName = async () => {
    if (!editedName.trim()) return;
    
    setLoading(true);
    try {
      await updateTrip(currentTrip.id, { name: editedName });
      setIsEditingName(false);
      setSuccess('Nome atualizado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao atualizar nome');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDestination = async () => {
    if (!editedDestination.trim()) return;
    
    setLoading(true);
    try {
      await updateTrip(currentTrip.id, { destination: editedDestination });
      setIsEditingDestination(false);
      setSuccess('Destino atualizado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao atualizar destino');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDates = async () => {
    if (!editedStartDate || !editedEndDate) {
      setError('Preencha as duas datas');
      setTimeout(() => setError(''), 3000);
      return;
    }
    if (editedEndDate < editedStartDate) {
      setError('A data de término não pode ser antes da data de início');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setLoading(true);
    try {
      await updateTrip(currentTrip.id, { startDate: editedStartDate, endDate: editedEndDate });
      setIsEditingDates(false);
      setSuccess('Datas atualizadas com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Erro ao atualizar as datas');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUserName = async () => {
    if (!editedUserName.trim()) return;
    
    setLoading(true);
    try {
      const result = await updateDisplayName(editedUserName);
      if (result.success) {
        setIsEditingUserName(false);
        setSuccess('Seu nome foi atualizado com sucesso!');
        setTimeout(() => setSuccess(''), 3000);
        // Recarregar a página para atualizar o nome em todos os lugares
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setError(result.error || 'Erro ao atualizar nome');
        setTimeout(() => setError(''), 3000);
      }
    } catch (err) {
      setError('Erro ao atualizar nome');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleAddParticipant = async (e) => {
    e.preventDefault();
    if (!participantEmail.trim()) return;

    setLoading(true);
    setError('');
    
    const result = await addParticipant(currentTrip.id, participantEmail);
    
    if (result.success) {
      setParticipantEmail('');
      setShowAddParticipant(false);
      if (result.pending) {
        setSuccess(result.message || 'Convite enviado! A pessoa será adicionada quando criar uma conta.');
      } else {
        setSuccess('Participante adicionado com sucesso!');
      }
      setTimeout(() => setSuccess(''), 5000);
    } else {
      setError(result.error || 'Erro ao adicionar participante');
      setTimeout(() => setError(''), 3000);
    }
    
    setLoading(false);
  };

  const handleDeleteTrip = async () => {
    setLoading(true);
    setError('');
    
    const result = await deleteTrip(currentTrip.id);
    
    if (result.success) {
      setSuccess('Viagem excluída com sucesso!');
      setShowDeleteModal(false);
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(result.error || 'Erro ao excluir viagem');
      setTimeout(() => setError(''), 3000);
    }
    
    setLoading(false);
  };

  const handleEditParticipantName = (participantId) => {
    const participant = participantsData[participantId];
    let currentName = 'Carregando...';
    if (participant?.displayName) {
      currentName = participant.displayName;
    } else if (participant?.email) {
      currentName = participant.email.split('@')[0];
    }
    
    setEditingParticipantId(participantId);
    setEditingParticipantName(currentName);
  };

  const handleSaveParticipantName = async (participantId) => {
    if (!editingParticipantName.trim()) {
      setError('Nome não pode estar vazio');
      setTimeout(() => setError(''), 3000);
      return;
    }

    setLoading(true);
    try {
      const userRef = doc(db, 'users', participantId);
      await updateDoc(userRef, {
        displayName: editingParticipantName
      });
      
      setEditingParticipantId(null);
      setEditingParticipantName('');
      setSuccess('Nome do participante atualizado com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('[ERROR] Erro ao atualizar nome do participante:', err);
      setError('Erro ao atualizar nome do participante');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveParticipant = async (participantId) => {
    if (participantId === currentTrip.createdBy) {
      setError('Não é possível remover o criador da viagem');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (!window.confirm('Tem certeza que deseja remover este participante?')) {
      return;
    }

    setLoading(true);
    const result = await removeParticipant(currentTrip.id, participantId);
    
    if (result.success) {
      setSuccess('Participante removido com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setError(result.error || 'Erro ao remover participante');
      setTimeout(() => setError(''), 3000);
    }
    
    setLoading(false);
  };

  const handleEndTrip = async () => {
    if (!window.confirm('Tem certeza que deseja encerrar esta viagem? Ela será arquivada e você poderá criar uma nova viagem.')) {
      return;
    }

    setLoading(true);
    try {
      const tripRef = doc(db, 'trips', currentTrip.id);
      await updateDoc(tripRef, {
        status: 'archived',
        endedAt: new Date(),
        updatedAt: new Date()
      });

      setSuccess('Viagem encerrada com sucesso! Crie uma nova viagem para continuar.');
      setTimeout(() => {
        setShowEndTripModal(false);
        setSuccess('');
        window.location.reload(); // Recarregar para limpar viagem atual
      }, 2000);
    } catch (err) {
      setError('Erro ao encerrar viagem');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Indicador de Viagem Arquivada */}
      {isViewingArchived && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-aqua-600/20 border border-aqua-500 rounded-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Archive className="w-5 h-5 text-aqua-400" />
              <div>
                <p className="text-aqua-300 font-semibold">Visualizando viagem arquivada</p>
                <p className="text-aqua-400 text-sm">Esta viagem foi encerrada e está no modo somente leitura</p>
              </div>
            </div>
            <button
              onClick={() => {
                const activeTrip = trips.find(trip => trip.status !== 'archived');
                if (activeTrip) {
                  setCurrentTrip(activeTrip);
                  setSuccess('Voltou para viagem ativa');
                  setTimeout(() => setSuccess(''), 3000);
                } else {
                  setSuccess('Não há viagem ativa no momento');
                  setTimeout(() => setSuccess(''), 3000);
                }
              }}
              className="px-4 py-2 bg-aqua-600 text-white rounded-lg hover:bg-aqua-700 transition-all"
            >
              Voltar para Viagem Ativa
            </button>
          </div>
        </motion.div>
      )}

      {/* Mensagens de feedback */}
      {success && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-green-500/20 border border-green-500 rounded-lg text-green-400"
        >
          {success}
        </motion.div>
      )}

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-400"
        >
          {error}
        </motion.div>
      )}

      {/* Botão Encerrar Viagem - Apenas para viagens ativas */}
      {!isViewingArchived && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-orange-600 to-red-600 rounded-xl p-6 shadow-lg mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
                <Archive className="w-6 h-6" />
                Encerrar Viagem Atual
              </h2>
            <p className="text-orange-100 text-sm">
              Finalize esta viagem e arquive todos os dados. Você poderá visualizá-la no histórico.
            </p>
          </div>
          <button
            onClick={() => setShowEndTripModal(true)}
            className="px-6 py-3 bg-white text-orange-600 rounded-lg hover:bg-orange-50 font-semibold transition-all flex items-center gap-2 whitespace-nowrap"
            disabled={loading}
          >
            <Archive className="w-5 h-5" />
            Salvar e Fechar
          </button>
        </div>
      </motion.div>
      )}

      {/* Modal de Confirmação de Encerramento */}
      <AnimatePresence>
        {showEndTripModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowEndTripModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-ocean-800 rounded-xl p-6 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-2xl font-bold text-white mb-4">Encerrar Viagem?</h3>
              <p className="text-sand-300 mb-6">
                Tem certeza que deseja encerrar "<strong>{currentTrip.name}</strong>"?
                <br /><br />
                A viagem será arquivada e você poderá:
                <br />• Visualizá-la no histórico
                <br />• Ver todos os eventos e despesas
                <br />• Criar uma nova viagem
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowEndTripModal(false)}
                  className="flex-1 px-4 py-3 bg-ocean-700 text-white rounded-lg hover:bg-ocean-600 transition-all"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEndTrip}
                  className="flex-1 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all font-semibold"
                  disabled={loading}
                >
                  {loading ? 'Encerrando...' : 'Sim, Encerrar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Histórico de Viagens Arquivadas */}
      {trips.filter(trip => trip.status === 'archived').length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-ocean-800 rounded-xl p-6 shadow-lg mb-8"
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-6 h-6 text-aqua-400" />
              Histórico de Viagens
            </h2>
            <span className="text-sm text-sand-400">
              {trips.filter(trip => trip.status === 'archived').length} {trips.filter(trip => trip.status === 'archived').length === 1 ? 'viagem' : 'viagens'} concluída{trips.filter(trip => trip.status === 'archived').length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="space-y-4">
            {trips
              .filter(trip => trip.status === 'archived')
              .sort((a, b) => {
                const dateA = a.endedAt?.toDate?.() || a.endedAt || new Date(0);
                const dateB = b.endedAt?.toDate?.() || b.endedAt || new Date(0);
                return dateB - dateA; // Mais recente primeiro
              })
              .map((trip) => {
                const startDate = trip.createdAt?.toDate?.() || trip.createdAt || new Date();
                const endDate = trip.endedAt?.toDate?.() || trip.endedAt || new Date();
                const participantCount = (trip.participants?.length || 0) + (trip.pendingParticipants?.length || 0);

                return (
                  <motion.div
                    key={trip.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="bg-ocean-700/50 rounded-lg p-4 border border-ocean-600 hover:border-aqua-500/50 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-2">
                          {trip.name}
                        </h3>
                        <div className="space-y-1 text-sm text-sand-400">
                          <p className="flex items-center gap-2">
                            <span className="text-aqua-400">📍</span>
                            {trip.destination || 'Destino não informado'}
                          </p>
                          <p className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-aqua-400" />
                            {format(startDate, "d 'de' MMMM", { locale: ptBR })}
                            {' → '}
                            {format(endDate, "d 'de' MMMM, yyyy", { locale: ptBR })}
                          </p>
                          <p className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-aqua-400" />
                            {participantCount} {participantCount === 1 ? 'participante' : 'participantes'}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setCurrentTrip(trip);
                            setSuccess('Visualizando viagem arquivada');
                            setTimeout(() => setSuccess(''), 3000);
                          }}
                          className="px-4 py-2 bg-aqua-600 text-white rounded-lg hover:bg-aqua-700 transition-all flex items-center gap-2 whitespace-nowrap"
                        >
                          <Eye className="w-4 h-4" />
                          Abrir
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Tem certeza que deseja excluir permanentemente a viagem "${trip.name}"? Esta ação não pode ser desfeita.`)) {
                              setLoading(true);
                              deleteTrip(trip.id).then((result) => {
                                if (result.success) {
                                  setSuccess('Viagem excluída com sucesso!');
                                  setTimeout(() => setSuccess(''), 3000);
                                } else {
                                  setError(result.error || 'Erro ao excluir viagem');
                                  setTimeout(() => setError(''), 3000);
                                }
                                setLoading(false);
                              });
                            }
                          }}
                          disabled={loading}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                          Apagar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        </motion.div>
      )}

      {/* Detalhes da Viagem */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-ocean-800 rounded-xl p-6 shadow-lg mb-8"
      >
        <h2 className="text-2xl font-bold text-white mb-6">Detalhes da Viagem</h2>

        {/* Seu Nome */}
        <div className="mb-6 p-4 bg-ocean-900/20 border border-aqua-500/30 rounded-lg">
          <label className="block text-sm font-medium text-aqua-300 mb-2">
            Seu Nome
          </label>
          {isEditingUserName ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={editedUserName}
                onChange={(e) => setEditedUserName(e.target.value)}
                placeholder="Digite seu nome completo"
                className="flex-1 px-4 py-2 bg-ocean-700 border border-aqua-500 rounded-lg text-white focus:outline-none focus:border-aqua-400"
                disabled={loading}
              />
              <button
                onClick={handleSaveUserName}
                disabled={loading || !editedUserName.trim()}
                className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={20} />
              </button>
              <button
                onClick={() => {
                  setIsEditingUserName(false);
                  setEditedUserName(user?.displayName || '');
                }}
                disabled={loading}
                className="p-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-2 bg-ocean-700 rounded-lg">
              <span className="text-white">
                {participantsData[user?.uid]?.displayName || user?.displayName || user?.email?.split('@')[0] || 'Não definido'}
              </span>
              {!isViewingArchived && (
                <button
                  onClick={() => {
                    setIsEditingUserName(true);
                    setEditedUserName(participantsData[user?.uid]?.displayName || user?.displayName || '');
                  }}
                  className="p-2 text-aqua-400 hover:text-aqua-300"
                >
                  <Edit2 size={18} />
                </button>
              )}
            </div>
          )}
          <p className="text-xs text-aqua-300 mt-2">Este nome aparecerá para todos os participantes</p>
        </div>

        {/* Nome da Viagem */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-sand-300 mb-2">
            Nome da Viagem {isViewingArchived && <span className="text-aqua-400 text-xs">(somente leitura)</span>}
          </label>
          {isEditingName && !isViewingArchived ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                className="flex-1 px-4 py-2 bg-ocean-700 border border-ocean-600 rounded-lg text-white focus:outline-none focus:border-aqua-500"
                disabled={loading}
              />
              <button
                onClick={handleSaveName}
                disabled={loading || !editedName.trim()}
                className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={20} />
              </button>
              <button
                onClick={() => {
                  setIsEditingName(false);
                  setEditedName(currentTrip.name);
                }}
                disabled={loading}
                className="p-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-2 bg-ocean-700 rounded-lg">
              <span className="text-white">{currentTrip.name}</span>
              {!isViewingArchived && (
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-2 text-aqua-400 hover:text-aqua-300"
                >
                  <Edit2 size={18} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Destino */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-sand-300 mb-2">
            Destino {isViewingArchived && <span className="text-aqua-400 text-xs">(somente leitura)</span>}
          </label>
          {isEditingDestination && !isViewingArchived ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={editedDestination}
                onChange={(e) => setEditedDestination(e.target.value)}
                className="flex-1 px-4 py-2 bg-ocean-700 border border-ocean-600 rounded-lg text-white focus:outline-none focus:border-aqua-500"
                disabled={loading}
              />
              <button
                onClick={handleSaveDestination}
                disabled={loading || !editedDestination.trim()}
                className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Check size={20} />
              </button>
              <button
                onClick={() => {
                  setIsEditingDestination(false);
                  setEditedDestination(currentTrip.destination);
                }}
                disabled={loading}
                className="p-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
              >
                <X size={20} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-2 bg-ocean-700 rounded-lg">
              <span className="text-white">{currentTrip.destination || 'Não especificado'}</span>
              {!isViewingArchived && (
                <button
                  onClick={() => setIsEditingDestination(true)}
                  className="p-2 text-aqua-400 hover:text-aqua-300"
                >
                  <Edit2 size={18} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Período da Viagem (datas) */}
        <div className="mb-2">
          <label className="block text-sm font-medium text-sand-300 mb-2">
            Período da Viagem {isViewingArchived && <span className="text-aqua-400 text-xs">(somente leitura)</span>}
          </label>
          {isEditingDates && !isViewingArchived ? (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <span className="block text-xs text-sand-400 mb-1">Início</span>
                  <input
                    type="date"
                    value={editedStartDate}
                    onChange={(e) => setEditedStartDate(e.target.value)}
                    className="w-full px-4 py-2 bg-ocean-700 border border-ocean-600 rounded-lg text-white focus:outline-none focus:border-aqua-500"
                    disabled={loading}
                  />
                </div>
                <div className="flex-1">
                  <span className="block text-xs text-sand-400 mb-1">Término</span>
                  <input
                    type="date"
                    value={editedEndDate}
                    onChange={(e) => setEditedEndDate(e.target.value)}
                    className="w-full px-4 py-2 bg-ocean-700 border border-ocean-600 rounded-lg text-white focus:outline-none focus:border-aqua-500"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveDates}
                  disabled={loading}
                  className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check size={20} />
                </button>
                <button
                  onClick={() => {
                    setIsEditingDates(false);
                    setEditedStartDate(currentTrip.startDate || '');
                    setEditedEndDate(currentTrip.endDate || '');
                  }}
                  disabled={loading}
                  className="p-2 bg-ocean-600 text-white rounded-lg hover:bg-ocean-700"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-xs text-orange-300/90">Atenção: alterar as datas muda o período do roteiro.</p>
            </div>
          ) : (
            <div className="flex items-center justify-between px-4 py-2 bg-ocean-700 rounded-lg">
              <span className="text-white flex items-center gap-2">
                <Calendar size={16} className="text-sand-400" />
                {currentTrip.startDate && currentTrip.endDate
                  ? `${formatTripDate(currentTrip.startDate)} a ${formatTripDate(currentTrip.endDate)}`
                  : 'Datas não definidas'}
              </span>
              {!isViewingArchived && (
                <button
                  onClick={() => {
                    setIsEditingDates(true);
                    setEditedStartDate(currentTrip.startDate || '');
                    setEditedEndDate(currentTrip.endDate || '');
                  }}
                  className="p-2 text-aqua-400 hover:text-aqua-300"
                >
                  <Edit2 size={18} />
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {/* Botão de Excluir Viagem (apenas para criador) */}
      {currentTrip.createdBy === user?.uid && !isViewingArchived && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-red-900/20 border border-red-500/30 rounded-xl p-6 shadow-lg mb-8"
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-red-400 mb-2 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Zona de Perigo
              </h3>
              <p className="text-sand-300 text-sm mb-1">
                Excluir permanentemente esta viagem e todos os dados relacionados.
              </p>
              <p className="text-red-400 text-xs">
                ⚠️ Esta ação não pode ser desfeita!
              </p>
            </div>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2 shrink-0"
            >
              <Trash2 size={18} />
              Excluir Viagem
            </button>
          </div>
        </motion.div>
      )}

      {/* Participantes */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-ocean-800 rounded-xl p-6 shadow-lg"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="text-aqua-400" />
            Participantes ({(currentTrip.participants?.length || 0) + (currentTrip.pendingParticipants?.length || 0)})
            {isViewingArchived && <span className="text-aqua-400 text-xs ml-2">(somente leitura)</span>}
          </h2>
          {!isViewingArchived && (
            <button
              onClick={() => setShowAddParticipant(!showAddParticipant)}
              className="px-4 py-2 bg-aqua-600 text-white rounded-lg hover:bg-aqua-700 flex items-center gap-2"
            >
              <Mail size={18} />
              Adicionar por E-mail
            </button>
          )}
        </div>

        {/* Formulário para adicionar participante */}
        {showAddParticipant && !isViewingArchived && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleAddParticipant}
            className="mb-6 p-4 bg-ocean-700 rounded-lg"
          >
            <label className="block text-sm font-medium text-sand-300 mb-2">
              E-mail do Participante
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={participantEmail}
                onChange={(e) => setParticipantEmail(e.target.value)}
                placeholder="usuario@email.com"
                className="flex-1 px-4 py-2 bg-ocean-800 border border-ocean-600 rounded-lg text-white focus:outline-none focus:border-aqua-500"
                disabled={loading}
                required
              />
              <button
                type="submit"
                disabled={loading || !participantEmail.trim()}
                className="px-6 py-2 bg-aqua-600 text-white rounded-lg hover:bg-aqua-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Adicionando...' : 'Adicionar'}
              </button>
            </div>
          </motion.form>
        )}

        {/* Lista de Participantes */}
        <div className="space-y-3">
          {currentTrip.participants?.map((participantId) => {
            const participant = participantsData[participantId];
            const isCreator = participantId === currentTrip.createdBy;
            const isCurrentUser = participantId === user?.uid;
            
            // Determinar nome de exibição
            let displayName = 'Carregando...';
            if (participant?.displayName) {
              displayName = participant.displayName;
            } else if (participant?.email) {
              displayName = participant.email.split('@')[0];
            } else if (isCurrentUser) {
              displayName = 'Você';
            } else {
              displayName = participantId.substring(0, 8);
            }

            return (
              <motion.div
                key={participantId}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between p-4 bg-ocean-700 rounded-lg"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 bg-aqua-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                    {editingParticipantId === participantId ? editingParticipantName.charAt(0).toUpperCase() : displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingParticipantId === participantId ? (
                      <div className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={editingParticipantName}
                          onChange={(e) => setEditingParticipantName(e.target.value)}
                          className="flex-1 px-2 py-1 bg-ocean-600 border border-aqua-500 rounded text-white text-sm focus:outline-none focus:border-aqua-400"
                          autoFocus
                          disabled={loading}
                        />
                        <button
                          onClick={() => handleSaveParticipantName(participantId)}
                          disabled={loading}
                          className="p-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 flex-shrink-0"
                          title="Salvar nome"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingParticipantId(null);
                            setEditingParticipantName('');
                          }}
                          disabled={loading}
                          className="p-1 bg-ocean-600 text-white rounded hover:bg-sand-500 disabled:opacity-50 flex-shrink-0"
                          title="Cancelar"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-white font-medium flex items-center gap-2 flex-wrap">
                          {displayName}
                          {isCreator && (
                            <span className="text-xs px-2 py-1 bg-aqua-600 rounded-full">
                              Criador
                            </span>
                          )}
                          {isCurrentUser && !isCreator && (
                            <span className="text-xs px-2 py-1 bg-blue-600 rounded-full">
                              Você
                            </span>
                          )}
                        </p>
                        <p className="text-sand-400 text-sm">
                          {participant?.email || 'E-mail não disponível'}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {!isViewingArchived && (
                  <div className="flex gap-1 flex-shrink-0">
                    {editingParticipantId !== participantId && !isCreator && (
                      <button
                        onClick={() => handleEditParticipantName(participantId)}
                        disabled={loading}
                        className="p-2 text-aqua-400 hover:text-aqua-300 hover:bg-aqua-500/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Editar nome"
                      >
                        <Edit2 size={18} />
                      </button>
                    )}
                    {!isCreator && (
                      <button
                        onClick={() => handleRemoveParticipant(participantId)}
                        disabled={loading}
                        className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Remover participante"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        {currentTrip.participants?.length === 0 && (
          <div className="text-center py-8 text-sand-400">
            Nenhum participante ainda. Adicione pessoas para começar!
          </div>
        )}

        {/* Participantes Pendentes */}
        {currentTrip.pendingParticipants && currentTrip.pendingParticipants.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-sand-300 mb-4 flex items-center gap-2">
              <Mail className="w-5 h-5 text-orange-400" />
              Convites Pendentes ({currentTrip.pendingParticipants.length})
            </h3>
            <div className="space-y-3">
              {currentTrip.pendingParticipants.map((email, index) => (
                <motion.div
                  key={email}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 bg-orange-900/20 border border-orange-500/30 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center text-white">
                      <Mail className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-white font-medium flex items-center gap-2">
                        {email}
                        <span className="text-xs px-2 py-1 bg-orange-600 rounded-full">
                          Aguardando
                        </span>
                      </p>
                      <p className="text-orange-300 text-sm">
                        Será adicionado quando criar uma conta
                      </p>
                    </div>
                  </div>

                  {!isViewingArchived && (
                    <button
                      onClick={async () => {
                        if (window.confirm(`Cancelar convite para ${email}?`)) {
                          setLoading(true);
                          try {
                            const tripRef = doc(db, 'trips', currentTrip.id);
                            await updateDoc(tripRef, {
                              pendingParticipants: arrayRemove(email)
                            });
                            setSuccess('Convite cancelado!');
                            setTimeout(() => setSuccess(''), 3000);
                        } catch (err) {
                          setError('Erro ao cancelar convite');
                          setTimeout(() => setError(''), 3000);
                        } finally {
                          setLoading(false);
                        }
                      }
                    }}
                    disabled={loading}
                    className="p-2 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Cancelar convite"
                  >
                    <X size={18} />
                  </button>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Modal de Confirmação de Exclusão */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-ocean-800 rounded-xl max-w-md w-full p-6 shadow-xl"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">
                Excluir Viagem?
              </h3>
              <p className="text-sand-300 mb-4">
                Tem certeza que deseja excluir permanentemente a viagem <strong>"{currentTrip.name}"</strong>?
              </p>
              <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4 mb-4">
                <p className="text-red-400 text-sm font-semibold mb-2">
                  ⚠️ Esta ação irá excluir:
                </p>
                <ul className="text-red-300 text-sm text-left space-y-1">
                  <li>• Todos os eventos do roteiro</li>
                  <li>• Todas as despesas financeiras</li>
                  <li>• Todos os registros da história</li>
                  <li>• Dados de todos os participantes</li>
                </ul>
              </div>
              <p className="text-red-400 font-bold text-sm">
                Esta ação não pode ser desfeita!
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-ocean-700 text-white rounded-lg hover:bg-ocean-600 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteTrip}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 font-semibold"
              >
                {loading ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default GerenciarViagemPage;
