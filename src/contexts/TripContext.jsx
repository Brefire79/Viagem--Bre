import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
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
  arrayRemove
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
export const TripProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentTrip, setCurrentTrip] = useState(null);
  const [trips, setTrips] = useState([]); // Todas as viagens do usuário
  const [events, setEvents] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [participantsData, setParticipantsData] = useState({});
  const [loading, setLoading] = useState(true);

  // Guarda a viagem escolhida pelo usuário. Sem isso, qualquer atualização
  // vinda do Firestore voltava para a primeira viagem ativa e descartava a
  // seleção - com mais de uma viagem salva, o app parecia mostrar dados velhos.
  const selectedTripIdRef = useRef(null);

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
        setCurrentTrip(activeTrip);
        setParticipants(activeTrip.participants || []);
      } else {
        selectedTripIdRef.current = null;
        setCurrentTrip(null);
        setParticipants([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('Erro ao carregar viagem:', error.message);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

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
      console.log(`[DEBUG] Carregados ${eventsData.length} eventos para trip ${currentTrip.id}`);
      setEvents(eventsData);
    }, (error) => {
      console.error('Erro ao carregar eventos:', error.message);
    });

    return unsubscribe;
  }, [currentTrip?.id]);

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
      console.log(`[DEBUG] Carregadas ${expensesData.length} despesas para trip ${currentTrip.id}`);
      setExpenses(expensesData);
    }, (error) => {
      console.error('Erro ao carregar despesas:', error.message);
    });

    return unsubscribe;
  }, [currentTrip?.id]);

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
            console.log(`[DEBUG] Participante carregado:`, uid, userData.displayName);
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
              console.log(`[DEBUG] Documento criado para usuário ${uid}`);
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
      console.log('[DEBUG] Tentando adicionar participante:', { tripId, email: participantEmail });
      
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
      console.log('[DEBUG] Dados da viagem:', { participants: tripData.participants, currentUser: user.uid });
      
      if (!tripData.participants.includes(user.uid)) {
        throw new Error('Você não tem permissão para adicionar participantes');
      }

      // Verificar se o email já está na lista de pendentes
      const pendingParticipants = tripData.pendingParticipants || [];
      if (pendingParticipants.includes(cleanEmail)) {
        throw new Error('Este e-mail já foi convidado');
      }

      // Buscar usuário pelo email
      console.log('[DEBUG] Buscando usuário com email:', cleanEmail);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', cleanEmail));
      const querySnapshot = await getDocs(q);

      console.log('[DEBUG] Resultado da busca:', { empty: querySnapshot.empty, size: querySnapshot.size });

      if (querySnapshot.empty) {
        // SOLUÇÃO 2: Usuário não existe, adicionar como participante pendente
        console.log('[DEBUG] Usuário não encontrado, adicionando como pendente...');
        
        await updateDoc(tripRef, {
          pendingParticipants: arrayUnion(cleanEmail),
          updatedAt: serverTimestamp()
        });
        
        console.log('[DEBUG] Participante pendente adicionado com sucesso!');
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
      
      console.log('[DEBUG] Usuário encontrado:', { id: participantId, email: participantData.email, name: participantData.displayName });

      // Verificar se já é participante
      if (tripData.participants.includes(participantId)) {
        throw new Error('Este usuário já é participante da viagem');
      }

      // Validar que não é o mesmo usuário
      if (participantId === user.uid) {
        throw new Error('Você já é participante');
      }

      // Adicionar participante
      console.log('[DEBUG] Adicionando participante ao Firestore...');
      await updateDoc(tripRef, {
        participants: arrayUnion(participantId),
        updatedAt: serverTimestamp()
      });
      
      console.log('[DEBUG] Participante adicionado com sucesso!');
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
      console.log(`[DEBUG] Evento criado: ${docRef.id} para trip ${currentTrip.id}`);
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
      console.log(`[DEBUG] Despesa criada: ${docRef.id} para trip ${currentTrip.id}`);
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
    deleteExpense
  };

  return (
    <TripContext.Provider value={value}>
      {children}
    </TripContext.Provider>
  );
};
