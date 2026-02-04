import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, X } from 'lucide-react';
import { pwaUpdater } from '../utils/pwaUpdater';

const UpdateNotification = () => {
  const [showUpdate, setShowUpdate] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Registra o PWA updater e configura callback
    pwaUpdater.register(() => {
      setShowUpdate(true);
    });
  }, []);

  const handleUpdate = () => {
    setIsUpdating(true);
    setTimeout(() => {
      pwaUpdater.applyUpdate();
    }, 500);
  };

  const handleDismiss = () => {
    setShowUpdate(false);
  };

  return (
    <AnimatePresence>
      {showUpdate && (
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-50"
        >
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-ocean-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-ocean to-aqua p-4 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <RefreshCw className="w-6 h-6" />
                  </motion.div>
                  <div>
                    <h3 className="font-bold text-lg">Nova versão disponível!</h3>
                    <p className="text-xs text-ocean-50">Atualize para aproveitar as novidades</p>
                  </div>
                </div>
                <button
                  onClick={handleDismiss}
                  className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-sm text-dark-50 mb-4">
                Uma nova versão do app está pronta! Seus dados estão salvos e serão preservados.
              </p>

              <div className="flex gap-2">
                <motion.button
                  onClick={handleUpdate}
                  disabled={isUpdating}
                  className="flex-1 bg-ocean text-white px-4 py-3 rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-ocean-600 transition-colors disabled:opacity-50"
                  whileHover={{ scale: isUpdating ? 1 : 1.02 }}
                  whileTap={{ scale: isUpdating ? 1 : 0.98 }}
                >
                  <RefreshCw className={`w-5 h-5 ${isUpdating ? 'animate-spin' : ''}`} />
                  {isUpdating ? 'Atualizando...' : 'Atualizar Agora'}
                </motion.button>

                <motion.button
                  onClick={handleDismiss}
                  className="px-4 py-3 rounded-xl font-semibold text-sand-500 hover:bg-sand-100 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Depois
                </motion.button>
              </div>
            </div>

            {/* Info Footer */}
            <div className="bg-ocean-50 px-4 py-2 border-t border-ocean-100">
              <p className="text-xs text-ocean-700">
                ✨ <strong>Novidade:</strong> Suas taxas de câmbio e dados ficam salvos!
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UpdateNotification;
