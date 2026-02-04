import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Save, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { pageVariants, cardVariants, buttonVariants } from '../utils/motionVariants';

const CURRENCIES = [
  { code: 'USD', name: 'Dólar Americano', country: 'Estados Unidos', symbol: '$' },
  { code: 'EUR', name: 'Euro', country: 'Europa', symbol: '€' },
  { code: 'COP', name: 'Peso Colombiano', country: 'Colômbia', symbol: '$' },
  { code: 'ARS', name: 'Peso Argentino', country: 'Argentina', symbol: '$' },
  { code: 'CLP', name: 'Peso Chileno', country: 'Chile', symbol: '$' }
];

const DEFAULT_RATES = {
  USD: 5.20,
  EUR: 5.60,
  COP: 0.0013,
  ARS: 0.0057,
  CLP: 0.0055
};

const CambioPage = () => {
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [rate, setRate] = useState(DEFAULT_RATES.USD);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Carrega taxa salva do localStorage ao mudar moeda
  useEffect(() => {
    const savedRates = JSON.parse(localStorage.getItem('currencyRates') || '{}');
    if (savedRates[selectedCurrency]) {
      setRate(savedRates[selectedCurrency]);
    } else {
      setRate(DEFAULT_RATES[selectedCurrency]);
    }
  }, [selectedCurrency]);

  // Monitora status online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Calcula resultado
  const totalBRL = amount && rate ? (parseFloat(amount) * parseFloat(rate)) : 0;

  // Atualiza taxa via API
  const updateRateOnline = async () => {
    if (!isOnline) {
      showStatus('Sem conexão com a internet', 'error');
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(
        `https://api.exchangerate.host/latest?base=${selectedCurrency}&symbols=BRL`
      );
      
      if (!response.ok) throw new Error('Erro ao buscar taxa');
      
      const data = await response.json();
      const newRate = data.rates?.BRL;
      
      if (newRate) {
        setRate(newRate.toFixed(4));
        
        // Salva automaticamente
        const savedRates = JSON.parse(localStorage.getItem('currencyRates') || '{}');
        savedRates[selectedCurrency] = newRate.toFixed(4);
        localStorage.setItem('currencyRates', JSON.stringify(savedRates));
        
        showStatus('Taxa atualizada e salva!', 'success');
      } else {
        throw new Error('Taxa não encontrada');
      }
    } catch (error) {
      console.error('Erro ao atualizar taxa:', error);
      showStatus('Erro ao buscar taxa. Use modo manual.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  // Salva taxa manual
  const saveRateManual = () => {
    if (!rate || parseFloat(rate) <= 0) {
      showStatus('Digite uma taxa válida', 'error');
      return;
    }

    const savedRates = JSON.parse(localStorage.getItem('currencyRates') || '{}');
    savedRates[selectedCurrency] = parseFloat(rate).toFixed(4);
    localStorage.setItem('currencyRates', JSON.stringify(savedRates));
    
    showStatus('Taxa salva com sucesso!', 'success');
  };

  // Mostra mensagem de status
  const showStatus = (message, type) => {
    setStatusMessage(message);
    setStatusType(type);
    setTimeout(() => {
      setStatusMessage('');
      setStatusType('');
    }, 3000);
  };

  // Formata valor em BRL
  const formatBRL = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Formata número genérico
  const formatNumber = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const selectedCurrencyData = CURRENCIES.find(c => c.code === selectedCurrency);

  return (
    <motion.div
      className="w-full max-w-lg mx-auto px-4 sm:px-0"
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <motion.h1 
          className="text-2xl sm:text-3xl font-bold text-dark mb-1 sm:mb-2 flex items-center gap-2 sm:gap-3"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-ocean" />
          Conversor de Moeda
        </motion.h1>
        <motion.p 
          className="text-sm sm:text-base text-sand-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          Converta de moeda estrangeira para Real (BRL)
        </motion.p>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className={`mb-4 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium ${
            statusType === 'success' 
              ? 'bg-green-50 text-green-700 border-2 border-green-200'
              : statusType === 'error'
              ? 'bg-red-50 text-red-700 border-2 border-red-200'
              : 'bg-ocean-50 text-ocean-700 border-2 border-ocean-200'
          }`}
        >
          {statusType === 'success' && <CheckCircle className="w-5 h-5" />}
          {statusType === 'error' && <AlertCircle className="w-5 h-5" />}
          {statusMessage}
        </motion.div>
      )}

      {/* Main Card - Layout Responsivo */}
      <motion.div
        className="card p-4 sm:p-6"
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        {/* Grid: 1 coluna em mobile, 3 colunas em desktop */}
        <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-0">
          {/* Moeda Local */}
          <div className="flex flex-col">
            <label className="block text-xs font-bold text-red-600 mb-2 uppercase text-left sm:text-center">
              Moeda Local
            </label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full px-4 py-3 sm:py-4 bg-ocean text-white rounded-xl font-semibold text-base sm:text-lg border-0 focus:outline-none focus:ring-2 focus:ring-ocean-600 text-left sm:text-center"
              style={{ WebkitAppearance: 'none', appearance: 'none' }}
            >
              {CURRENCIES.map(currency => (
                <option key={currency.code} value={currency.code}>
                  {currency.code} - {currency.country}
                </option>
              ))}
            </select>
          </div>

          {/* Taxa */}
          <div className="flex flex-col">
            <label className="block text-xs font-bold text-red-600 mb-2 uppercase text-left sm:text-center">
              Taxa
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0.0000"
              min="0"
              step="0.0001"
              className="w-full px-4 py-3 sm:py-4 bg-ocean text-white rounded-xl font-semibold text-base sm:text-lg border-0 focus:outline-none focus:ring-2 focus:ring-ocean-600 placeholder-ocean-200 text-center"
            />
          </div>

          {/* Valor da Moeda */}
          <div className="flex flex-col">
            <label className="block text-xs font-bold text-red-600 mb-2 uppercase text-left sm:text-center">
              Valor da Moeda
            </label>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full px-4 py-3 sm:py-4 bg-aqua text-white rounded-xl font-semibold text-base sm:text-lg border-0 focus:outline-none focus:ring-2 focus:ring-aqua-600 placeholder-aqua-200 text-center"
            />
          </div>
        </div>

        {/* Botões ocultos conforme solicitação */}
        {/* 
        <div className="flex flex-col sm:flex-row gap-3">
          <motion.button
            onClick={updateRateOnline}
            disabled={!isOnline || isUpdating}
            className="btn-primary flex items-center justify-center gap-2 flex-1"
            variants={buttonVariants}
            initial="rest"
            whileHover={isOnline && !isUpdating ? "hover" : "rest"}
            whileTap={isOnline && !isUpdating ? "tap" : "rest"}
          >
            <RefreshCw className={`w-5 h-5 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating ? 'Atualizando...' : 'Atualizar Taxa'}
          </motion.button>

          <motion.button
            onClick={saveRateManual}
            className="btn-secondary flex items-center justify-center gap-2 flex-1"
            variants={buttonVariants}
            initial="rest"
            whileHover="hover"
            whileTap="tap"
          >
            <Save className="w-5 h-5" />
            Salvar Taxa
          </motion.button>
        </div>
        */}

        {!isOnline && (
          <div className="mt-4 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Offline - usando taxa manual
          </div>
        )}
      </motion.div>

      {/* Resultado Grande */}
      <motion.div
        className="mt-4 sm:mt-6 bg-gradient-to-br from-ocean-50 to-aqua-50 border-2 border-ocean-200 p-4 sm:p-6 rounded-xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <div className="text-center py-2 sm:py-4">
          <p className="text-sm sm:text-base font-semibold text-dark mb-2 sm:mb-3">
            Total em Reais
          </p>
          <p className="text-4xl sm:text-5xl md:text-6xl font-bold text-ocean mb-2 sm:mb-4">
            {formatBRL(totalBRL)}
          </p>
          {amount && rate && totalBRL > 0 && (
            <p className="text-xs sm:text-sm text-sand-500 font-medium px-2">
              {selectedCurrencyData?.symbol} {formatNumber(parseFloat(amount))} {selectedCurrency} × R$ {parseFloat(rate).toFixed(4)} = {formatBRL(totalBRL)}
            </p>
          )}
        </div>
      </motion.div>

      {/* Info Card */}
      <motion.div
        className="mt-3 sm:mt-4 p-3 sm:p-4 bg-ocean-50 border border-ocean-200 rounded-xl"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      >
        <p className="text-xs sm:text-sm text-ocean-700">
          💡 <strong>Dica:</strong> As taxas são salvas automaticamente. Funciona offline!
        </p>
      </motion.div>
    </motion.div>
  );
};

export default CambioPage;
