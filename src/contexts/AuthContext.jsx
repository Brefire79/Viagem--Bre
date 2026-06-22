import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { auth, db } from '../firebase';

// Traduz os códigos de erro do Firebase Auth para mensagens claras em português.
const authErrorMessages = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.',
  'auth/invalid-email': 'Esse e-mail não parece válido.',
  'auth/user-disabled': 'Esta conta foi desativada.',
  'auth/user-not-found': 'Não encontramos uma conta com esse e-mail.',
  'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
  'auth/weak-password': 'A senha precisa ter ao menos 6 caracteres.',
  'auth/missing-password': 'Digite sua senha.',
  'auth/too-many-requests': 'Muitas tentativas seguidas. Espere um pouco e tente de novo.',
  'auth/network-request-failed': 'Sem conexão. Verifique sua internet e tente de novo.',
  'auth/operation-not-allowed': 'Esse método de login está desativado.'
};

const getAuthErrorMessage = (error) =>
  authErrorMessages[error?.code] || 'Não foi possível concluir. Tente de novo em instantes.';

// Contexto de autenticação
const AuthContext = createContext({});

// Hook customizado
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

// Provider de autenticação
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Monitora mudanças no estado de autenticação
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Função de login
  const login = async (email, password) => {
    if (!auth) {
      return { success: false, error: 'Firebase não configurado' };
    }

    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      
      // Atualizar dados do usuário no Firestore
      try {
        await setDoc(doc(db, 'users', result.user.uid), {
          uid: result.user.uid,
          displayName: result.user.displayName || '',
          email: result.user.email,
          photoURL: result.user.photoURL || null,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (firestoreError) {
        console.warn('[WARN] Erro ao atualizar perfil no login:', firestoreError);
      }

      // Verificar se este email tem convites pendentes (para usuários já criados)
      const tripsRef = collection(db, 'trips');
      const q = query(tripsRef, where('pendingParticipants', 'array-contains', email.toLowerCase().trim()));
      const querySnapshot = await getDocs(q);

      // Ativar participação em viagens pendentes
      for (const tripDoc of querySnapshot.docs) {
        const tripRef = doc(db, 'trips', tripDoc.id);
        await updateDoc(tripRef, {
          participants: arrayUnion(result.user.uid),
          pendingParticipants: arrayRemove(email.toLowerCase().trim()),
          updatedAt: serverTimestamp()
        });
      }

      return { success: true, user: result.user };
    } catch (error) {
      console.error('[ERROR] Erro no login:', error);
      return { success: false, error: getAuthErrorMessage(error) };
    }
  };

  // Função de registro
  const register = async (email, password, displayName) => {
    if (!auth || !db) {
      return { success: false, error: 'Firebase não configurado' };
    }

    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      
      // Atualiza o nome do usuário no Auth
      if (displayName) {
        await updateProfile(result.user, { displayName });
      }
      
      // Salva o usuário no Firestore
      await setDoc(doc(db, 'users', result.user.uid), {
        uid: result.user.uid,
        displayName: displayName || '',
        email: email,
        photoURL: null,
        createdAt: serverTimestamp(),
        trips: []
      });

      // Verificar se este email tem convites pendentes em alguma viagem
      const tripsRef = collection(db, 'trips');
      const q = query(tripsRef, where('pendingParticipants', 'array-contains', email.toLowerCase().trim()));
      const querySnapshot = await getDocs(q);

      // Para cada viagem que tem este email como pendente
      for (const tripDoc of querySnapshot.docs) {
        const tripRef = doc(db, 'trips', tripDoc.id);
        // Adicionar o UID aos participants e remover o email dos pendentes
        await updateDoc(tripRef, {
          participants: arrayUnion(result.user.uid),
          pendingParticipants: arrayRemove(email.toLowerCase().trim()),
          updatedAt: serverTimestamp()
        });
      }

      return { success: true, user: result.user };
    } catch (error) {
      console.error('[ERROR] Erro no registro:', error);
      return { success: false, error: getAuthErrorMessage(error) };
    }
  };

  // Função de logout
  const logout = async () => {
    if (!auth) {
      return { success: false, error: 'Firebase não configurado' };
    }

    try {
      await firebaseSignOut(auth);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  // Função para atualizar o nome de exibição
  const updateDisplayName = async (newDisplayName) => {
    if (!auth || !user) {
      return { success: false, error: 'Usuário não autenticado' };
    }

    try {
      // Atualiza no Firebase Auth
      await updateProfile(auth.currentUser, {
        displayName: newDisplayName
      });

      // Atualiza no Firestore
      await setDoc(doc(db, 'users', user.uid), {
        displayName: newDisplayName
      }, { merge: true });

      return { success: true };
    } catch (error) {
      console.error('[ERROR] Erro ao atualizar nome:', error);
      return { success: false, error: getAuthErrorMessage(error) };
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    updateDisplayName
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
