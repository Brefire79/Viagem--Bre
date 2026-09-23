import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  disableNetwork,
  enableNetwork
} from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

// Contexto da viagem
const TripContext = createContext({});

// Hook customizado
export const useTrip = () => {
  const context = useContext(TripContext);
  if (!context) {
    throw new Error('useTrip deve ser usado dentro de um TripProvider');
  }
  return context;
};

// Provider da viagem
// Chave usada para lembrar a viagem escolhida entre reinicializações do app.
// No celular o sistema descarta a webview em segundo plano: sem isso, ao voltar
// o app cai na primeira viagem ativa em vez da que o usuário estava vendo.
const SELECTED_TRIP_STORAGE_KEY = 'viagem-colaborativa:selectedTripId';

const readStoredTripId = () => {
  try {
    return window.localStorage.getItem(SELECTED_TRIP_STORAGE_KEY);
  } catch {
    return null;
  }
};

const storeTripId = (tripId) => {
  try {
    if (tripId) {
      window.localStorage.setItem(SELECTED_TRIP_STORAGE_KEY, tripId);
    } else {
      window.localStorage.removeItem(SELECTED_TRIP_STORAGE_KEY);
    }
  } catch {
    // localStorage indisponível (modo privado): a seleção só não sobrevive ao restart
  }
};

export const TripProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentTrip, setCurrentTrip] = useState(null);
  const [trips, setTrips] = useState([]); // Todas as viagens do usuário
  const [events, setEvents] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [participantsData, setParticipantsData] = useState({});
  const [loading, setLoading] = useState(true);
  // Guarda a falha do listener para que a tela mostre "erro + tentar de novo"
  // em vez de "Nenhuma viagem encontrada", que faz o usuário achar que perdeu tudo.
  const [error, setError] = useState(null);
  // Incrementado para forçar a reassinatura de todos os listeners do Firestore.
  const [reconnectToken, setReconnectToken] = useState(0);

  // Guarda a viagem escolhida pelo usuário. Sem isso, qualquer atualização
  // vinda do Firestore voltava para a primeira viagem ativa e descartava a
  // seleção - com mais de uma viagem salva, o app parecia mostrar dados velhos.
  const selectedTripIdRef = useRef(readStoredTripId());

  // Reabre as conexões do Firestore e reassina os listeners.
  //
  // Ao abrir um PDF, o app vai para segundo plano e o sistema congela (ou
  // descarta) a webview. Os streams do Firestore morrem e os onSnapshot param de
  // entregar: a viagem some da tela e só volta quando o app é fechado e reaberto.
  // Derrubar e subir a rede força o SDK a reconstruir os streams.
  const reconnect = useCallback(async () => {
    setError(null);
    setReconnectToken((token) => token + 1);

    if (!db) return;

    try {
      await disableNetwork(db);
      await enableNetwork(db);
    } catch (networkError) {
      console.error('Erro ao reconectar ao Firestore:', networkError.message);
    }
  }, []);

  // Detecta a volta do segundo plano e reconecta.
  useEffect(() => {
    if (!user) return;

    // Só reconecta depois de um tempo real em segundo plano. Alternar de aba por
    // um instante não derruba nada e não vale o ciclo de rede.
    const MIN_HIDDEN_MS = 2000;
    let hiddenSince = document.visibilityState === 'hidden' ? Date.now() : null;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSince = Date.now();
        return;
      }

      if (hiddenSince !== null && Date.now() - hiddenSince >= MIN_HIDDEN_MS) {
        reconnect();
      }
      hiddenSince = null;
    };

    // bfcache: a página volta viva, mas com as conexões de rede já cortadas
    const handlePageShow = (event) => {
      if (event.persisted) reconnect();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('online', reconnect);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('online', reconnect);
    };
  }, [user, reconnect]);

  // Monitora a viagem atual do usuário (apenas viagens ativas)
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (!db) {
      setLoading(false);
      return;
    }

    const tripsRef = collection(db, 'trips');
    const q = query(
      tripsRef,
      where('participants', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Salva todas as viagens
      const allTrips = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTrips(allTrips);

      // Mantém a viagem que o usuário escolheu (se ela ainda existir).
      // Só cai para a primeira viagem ativa quando não há escolha válida.
      const selectedTrip = selectedTripIdRef.current
        ? allTrips.find(trip => trip.id === selectedTripIdRef.current)
        : null;

      const activeTrip = selectedTrip || allTrips.find(trip => trip.status !== 'archived');

      if (activeTrip) {
        selectedTripIdRef.current = activeTrip.id;
        storeTripId(activeTrip.id);
        setCurrentTrip(activeTrip);
        setParticipants(activeTrip.participants || []);
      } else {
        selectedTripIdRef.current = null;
        storeTripId(null);
        setCurrentTrip(null);
        setParticipants([]);
      }
      setError(null);
      setLoading(false);
    }, (snapshotError) => {
      console.error('Erro ao carregar viagem:', snapshotError.message);
      setError(snapshotError.message || 'Não foi possível carregar a viagem');
      setLoading(false);
    });

    return unsubscribe;
  }, [user, reconnectToken]);

  // Monitora eventos da viagem
  useEffect(() => {
    if (!currentTrip || !db) return;

    const eventsRef = collection(db, 'events');
    const q = query(
      eventsRef,
      where('tripId', '==', currentTrip.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(eventsData);
    }, (error) => {
      console.error('Erro ao carregar eventos:', error.message);
    });

    return unsubscribe;
  }, [currentTrip?.id, reconnectToken]);

  // Monitora despesas da viagem
  useEffect(() => {
    if (!currentTrip || !db) return;

    const expensesRef = collection(db, 'expenses');
    const q = query(
      expensesRef,
      where('tripId', '==', currentTrip.id)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const expensesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setExpenses(expensesData);
    }, (error) => {
      console.error('Erro ao carregar despesas:', error.message);
    });

    return unsubscribe;
  }, [currentTrip?.id, reconnectToken]);

  // Busca dados dos participantes
  useEffect(() => {
    if (!currentTrip || !db) return;
    
    const fetchParticipants = async () => {
      const data = {};
      for (const uid of currentTrip.participants) {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            data[uid] = userData;
          } else {
            console.warn('Usuário não encontrado no Firestore; criando documento...');
            // Se não existe, tentar buscar do Auth e criar
            const displayName = uid.substring(0, 8) + '...';
            data[uid] = {
              displayName,
              email: 'Usuário'
            };
            // Criar documento no Firestore
            try {
              await setDoc(doc(db, 'users', uid), {
                uid,
                displayName,
                email: 'usuario@email.com',
                createdAt: serverTimestamp()
              });
            } catch (createError) {
              console.error(`[ERROR] Erro ao criar documento para ${uid}:`, createError);
            }
          }
        } catch (error) {
          console.error(`[ERROR] Erro ao buscar participante ${uid}:`, error);
          data[uid] = {
            displayName: uid.substring(0, 8) + '...',
            email: 'Usuário'
          };
        }
      }
      setParticipantsData(data);
    };
    
    fetchParticipants();
  }, [currentTrip]);

  // ========== SELECIONAR VIAGEM ==========

  // Troca a viagem ativa. A escolha fica registrada e sobrevive às
  // atualizações em tempo real do Firestore.
  const selectTrip = (tripId) => {
    const trip = trips.find(item => item.id === tripId);

    if (!trip) {
      return { success: false, error: 'Viagem não encontrada' };
    }

    selectedTripIdRef.current = trip.id;
    storeTripId(trip.id);
    setCurrentTrip(trip);
    setParticipants(trip.participants || []);

    // Zera os dados da viagem anterior para não exibir conteúdo de outra
    // viagem enquanto os novos snapshots não chegam
    setEvents([]);
    setExpenses([]);

    return { success: true };
  };

  // ========== CRIAR VIAGEM ==========

  const createTrip = async (tripData) => {
    if (!user || !db) return { success: false, error: 'Usuário não autenticado' };

    try {
      const tripsRef = collection(db, 'trips');
      const docRef = await addDoc(tripsRef, {
        ...tripData,
        participants: [user.uid],
        createdBy: user.uid,
        createdAt: serverTimestamp()
      });
      return { success: true, tripId: docRef.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ========== ATUALIZAR VIAGEM ==========

  const updateTrip = async (tripId, tripData) => {
    if (!user || !db) return { success: false, error: 'Usuário não autenticado' };

    try {
      const tripRef = doc(db, 'trips', tripId);
      await updateDoc(tripRef, {
        ...tripData,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ========== ADICIONAR PARTICIPANTE ==========

  const addParticipant = async (tripId, participantEmail) => {
    if (!user || !db) return { success: false, error: 'Usuário não autenticado' };

    try {
      
      // Validação de entrada
      const cleanEmail = participantEmail.toLowerCase().trim();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error('E-mail inválido');
      }

      // Verificar se o usuário atual é participante da viagem
      const tripRef = doc(db, 'trips', tripId);
      const tripDoc = await getDoc(tripRef);
      
      if (!tripDoc.exists()) {
        throw new Error('Viagem não encontrada');
      }

      const tripData = tripDoc.data();
      
      if (!tripData.participants.includes(user.uid)) {
        throw new Error('Você não tem permissão para adicionar participantes');
      }

      // Verificar se o email já está na lista de pendentes
      const pendingParticipants = tripData.pendingParticipants || [];
      if (pendingParticipants.includes(cleanEmail)) {
        throw new Error('Este e-mail já foi convidado');
      }

      // Buscar usuário pelo email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', cleanEmail));
      const querySnapshot = await getDocs(q);


      if (querySnapshot.empty) {
        // SOLUÇÃO 2: Usuário não existe, adicionar como participante pendente
        
        await updateDoc(tripRef, {
          pendingParticipants: arrayUnion(cleanEmail),
          updatedAt: serverTimestamp()
        });
        
        return { 
          success: true, 
          pending: true, 
          message: `Convite enviado para ${cleanEmail}. Quando criar uma conta, será adicionado automaticamente.` 
        };
      }

      // Usuário existe - adicionar normalmente
      const userDoc = querySnapshot.docs[0];
      const participantId = userDoc.id;
      const participantData = userDoc.data();
      

      // Verificar se já é participante
      if (tripData.participants.includes(participantId)) {
        throw new Error('Este usuário já é participante da viagem');
      }

      // Validar que não é o mesmo usuário
      if (participantId === user.uid) {
        throw new Error('Você já é participante');
      }

      // Adicionar participante
      await updateDoc(tripRef, {
        participants: arrayUnion(participantId),
        updatedAt: serverTimestamp()
      });
      
      return { success: true, pending: false };
    } catch (error) {
      console.error('[ERROR] Erro ao adicionar participante:', error.message);
      return { success: false, error: error.message };
    }
  };

  // ========== REMOVER PARTICIPANTE ==========

  const removeParticipant = async (tripId, participantId) => {
    if (!user || !db) return { success: false, error: 'Usuário não autenticado' };

    try {
      // Verificar permissões
      const tripRef = doc(db, 'trips', tripId);
      const tripDoc = await getDoc(tripRef);
      
      if (!tripDoc.exists()) {
        throw new Error('Viagem não encontrada');
      }

      const tripData = tripDoc.data();
      
      // Verificar se o usuário atual é participante
      if (!tripData.participants.includes(user.uid)) {
        throw new Error('Você não tem permissão para remover participantes');
      }

      // Não permitir remover o criador da viagem
      if (participantId === tripData.createdBy) {
        throw new Error('Não é possível remover o criador da viagem');
      }

      // Remover participante
      await updateDoc(tripRef, {
        participants: arrayRemove(participantId),
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ========== OPERAÇÕES COM EVENTOS ==========

  const addEvent = async (eventData) => {
    if (!currentTrip || !db) return { success: false, error: 'Nenhuma viagem selecionada' };

    try {
      const eventsRef = collection(db, 'events');
      const docRef = await addDoc(eventsRef, {
        ...eventData,
        tripId: currentTrip.id,
        createdBy: user.uid,
        createdAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Erro ao adicionar evento:', error.message);
      return { success: false, error: error.message };
    }
  };

  const updateEvent = async (eventId, eventData) => {
    if (!currentTrip || !db) return { success: false, error: 'Nenhuma viagem selecionada' };

    try {
      const eventRef = doc(db, 'events', eventId);
      await updateDoc(eventRef, {
        ...eventData,
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const deleteEvent = async (eventId) => {
    if (!currentTrip || !db) return { success: false, error: 'Nenhuma viagem selecionada' };

    try {
      const eventRef = doc(db, 'events', eventId);
      await deleteDoc(eventRef);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ========== CAIXAS (reservas de dinheiro da viagem) ==========
  // As caixas moram no documento da viagem: `trips/{id}.caixas` é um array de
  // { id, name, amount }. Substitui o array inteiro - quem chama já monta a
  // lista final (criar, renomear, apagar), o que evita dois updates parciais
  // se disputarem no Firestore.
  //
  // Caixa em dólar: + { currency: 'USD', foreignAmount (US$ levados), rate
  // (R$ pagos por US$ 1) }. `amount` continua em R$ (= foreignAmount × rate)
  // para que totais, História e PDFs sigam lendo só `amount`.
  const saveCaixas = async (caixas) => {
    if (!currentTrip || !db) return { success: false, error: 'Nenhuma viagem selecionada' };

    const limpas = (Array.isArray(caixas) ? caixas : [])
      .map(caixa => {
        const base = {
          id: String(caixa.id),
          name: String(caixa.name || '').trim(),
          amount: Number(caixa.amount) || 0
        };
        if (caixa.currency !== 'USD') return base;
        const foreignAmount = Number(caixa.foreignAmount) || 0;
        const rate = Number(caixa.rate) || 0;
        return {
          ...base,
          currency: 'USD',
          foreignAmount,
          rate,
          amount: Math.round(foreignAmount * rate * 100) / 100
        };
      })
      .filter(caixa => caixa.id && caixa.name);

    return updateTrip(currentTrip.id, { caixas: limpas });
  };

  // ========== CATEGORIAS EXTRAS DE DESPESA ==========
  // Além das seis fixas (aereo, transfer, ...), a viagem pode ter categorias
  // próprias em `trips/{id}.customCategories` = [{ id, name }]. A despesa
  // guarda o `id` em `category`, como já faz com as fixas.
  const saveCustomCategories = async (categoriesList) => {
    if (!currentTrip || !db) return { success: false, error: 'Nenhuma viagem selecionada' };

    const limpas = (Array.isArray(categoriesList) ? categoriesList : [])
      .map(item => ({
        id: String(item.id),
        name: String(item.name || '').trim(),
        // Arquivada: some do formulário, mas continua rotulando as despesas
        // antigas (apagar não pode mexer no que já foi lançado)
        archived: Boolean(item.archived)
      }))
      .filter(item => item.id && item.name);

    return updateTrip(currentTrip.id, { customCategories: limpas });
  };

  // ========== OPERAÇÕES COM DESPESAS ==========

  const addExpense = async (expenseData) => {
    if (!currentTrip || !db) return { success: false, error: 'Nenhuma viagem selecionada' };

    try {
      // Validações de segurança
      if (!expenseData.amount || expenseData.amount <= 0) {
        throw new Error('Valor da despesa deve ser maior que zero');
      }

      if (!expenseData.paidBy || !participants.includes(expenseData.paidBy)) {
        throw new Error('Pagador inválido ou não é participante da viagem');
      }

      if (!expenseData.splitBetween || expenseData.splitBetween.length === 0) {
        throw new Error('Selecione pelo menos um participante para dividir a despesa');
      }

      // Validar que todos em splitBetween são participantes válidos
      const invalidParticipants = expenseData.splitBetween.filter(
        id => !participants.includes(id)
      );
      if (invalidParticipants.length > 0) {
        throw new Error('Um ou mais participantes selecionados são inválidos');
      }

      const expensesRef = collection(db, 'expenses');
      const docRef = await addDoc(expensesRef, {
        ...expenseData,
        amount: Number(expenseData.amount),
        tripId: currentTrip.id,
        createdAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      console.error('Erro ao adicionar despesa:', error.message);
      return { success: false, error: error.message };
    }
  };

  const updateExpense = async (expenseId, expenseData) => {
    if (!currentTrip || !db) return { success: false, error: 'Nenhuma viagem selecionada' };

    try {
      const expenseRef = doc(db, 'expenses', expenseId);
      await updateDoc(expenseRef, {
        ...expenseData,
        amount: Number(expenseData.amount),
        updatedAt: serverTimestamp()
      });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  const deleteExpense = async (expenseId) => {
    if (!currentTrip || !db) return { success: false, error: 'Nenhuma viagem selecionada' };

    try {
      const expenseRef = doc(db, 'expenses', expenseId);
      await deleteDoc(expenseRef);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // ========== EXCLUIR VIAGEM ==========

  const deleteTrip = async (tripId) => {
    if (!user || !db) return { success: false, error: 'Usuário não autenticado' };

    try {
      // Verificar se é o criador
      const tripRef = doc(db, 'trips', tripId);
      const tripDoc = await getDoc(tripRef);
      
      if (!tripDoc.exists()) {
        throw new Error('Viagem não encontrada');
      }

      const tripData = tripDoc.data();
      
      if (tripData.createdBy !== user.uid) {
        throw new Error('Apenas o criador pode excluir a viagem');
      }

      // Excluir todos os eventos relacionados
      const eventsRef = collection(db, 'events');
      const eventsQuery = query(eventsRef, where('tripId', '==', tripId));
      const eventsSnapshot = await getDocs(eventsQuery);
      
      const deleteEventPromises = eventsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteEventPromises);

      // Excluir todas as despesas relacionadas
      const expensesRef = collection(db, 'expenses');
      const expensesQuery = query(expensesRef, where('tripId', '==', tripId));
      const expensesSnapshot = await getDocs(expensesQuery);
      
      const deleteExpensePromises = expensesSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deleteExpensePromises);

      // Excluir a viagem
      await deleteDoc(tripRef);
      
      // Resetar currentTrip se era a viagem atual
      if (currentTrip?.id === tripId) {
        selectedTripIdRef.current = null;
        storeTripId(null);
        setCurrentTrip(null);
      }

      return { success: true };
    } catch (error) {
      console.error('[ERROR] Erro ao excluir viagem:', error);
      return { success: false, error: error.message };
    }
  };

  const value = {
    currentTrip,
    trips, // Todas as viagens (ativas e arquivadas)
    selectTrip, // Troca a viagem ativa preservando a escolha do usuário
    setCurrentTrip, // Uso legado; prefira selectTrip
    events,
    expenses,
    participants,
    participantsData,
    loading,
    error, // Falha ao carregar a viagem (listener do Firestore caiu)
    reconnect, // Refaz as conexões do Firestore e reassina os listeners
    createTrip,
    updateTrip,
    deleteTrip,
    addParticipant,
    removeParticipant,
    addEvent,
    updateEvent,
    deleteEvent,
    addExpense,
    updateExpense,
    deleteExpense,
    saveCaixas, // Substitui a lista de caixas (reservas) da viagem atual
    saveCustomCategories // Substitui a lista de categorias extras da viagem atual
  };

  return (
    <TripContext.Provider value={value}>
      {children}
    </TripContext.Provider>
  );
};
