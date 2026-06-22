// Configuração do Firebase
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';

// Validação de ambiente
const isProduction = import.meta.env.PROD;
const USE_MOCK_DATA = false;

// Configuração do Firebase com fallbacks seguros
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Validar se todas as variáveis estão presentes
const isConfigValid = Object.values(firebaseConfig).every(val => val && val !== 'undefined');

// Inicializa o Firebase
let app = null;
let auth = null;
let db = null;

if (!USE_MOCK_DATA && isConfigValid) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);

    // Cache persistente (IndexedDB) com suporte a múltiplas abas.
    // Substitui enableIndexedDbPersistence (deprecado no SDK 10).
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
    });
  } catch (error) {
    // Silenciosamente falha se Firebase não inicializar
  }
}

// Exporta as instâncias (podem ser null em modo mock ou erro)
export { auth, db };
export default app;
