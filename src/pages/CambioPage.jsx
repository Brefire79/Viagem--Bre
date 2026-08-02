import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { pageVariants, cardVariants } from '../utils/motionVariants';

const CURRENCIES = [
  { code: 'USD', name: 'Dólar Americano', country: 'Estados Unidos', symbol: '$' },
  { code: 'EUR', name: 'Euro', country: 'Europa', symbol: '€' },
  { code: 'COP', name: 'Peso Colombiano', country: 'Colômbia', symbol: '$' },
  { code: 'ARS', name: 'Peso Argentino', country: 'Argentina', symbol: '$' },
  { code: 'CLP', name: 'Peso Chileno', country: 'Chile', symbol: '$' }
];

// Último recurso: só valem para a primeira abertura sem internet e sem nada
// salvo. Assim que a cotação do dia chega, o localStorage assume.
const DEFAULT_RATES = {
  USD: 5.07,
  EUR: 5.83,
  COP: 0.0016,
  ARS: 0.0034,
  CLP: 0.0055
};

const RATES_KEY = 'currencyRates';
const FETCHED_AT_KEY = 'currencyRatesFetchedAt';

// Uma requisição só, com base BRL, traz todas as moedas da lista.
// A API é gratuita, não pede chave e envia Access-Control-Allow-Origin: *.
// O host precisa estar no connect-src do CSP (netlify.toml).
const RATES_ENDPOINT = 'https://open.er-api.com/v6/latest/BRL';

// A fonte atualiza uma vez por dia; buscar mais que isso é só gastar rede.
const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;

const readStoredRates = () => {
  try {
    return JSON.parse(localStorage.getItem(RATES_KEY) || '{}');
  } catch {
    return {};
  }
};

const readFetchedAt = () => {
  const stored = Number(localStorage.getItem(FETCHED_AT_KEY));
  return Number.isFinite(stored) && stored > 0 ? stored : null;
};

// A taxa de COP/ARS/CLP é da ordem de 0,001: arredondar para 4 casas já muda o
// resultado de uma conversão grande. Guardamos 6 dígitos significativos.
const toRate = (perBrl) => {
  const value = Number(perBrl);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Number((1 / value).toPrecision(6));
};

const CambioPage = () => {
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [amount, setAmount] = useState('');
  const [rates, setRates] = useState(() => ({ ...DEFAULT_RATES, ...readStoredRates() }));
  const [fetchedAt, setFetchedAt] = useState(readFetchedAt);
  // Taxa digitada na hora. Sobrepõe a do dia até trocar de moeda, para que uma
  // atualização automática não apague o que o usuário está digitando.
  const [manualRate, setManualRate] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const rate = manualRate !== null ? manualRate : rates[selectedCurrency] ?? '';
  const isBusy = useRef(false);

  // Mostra mensagem de status
  const showStatus = (message, type) => {
    setStatusMessage(message);
    setStatusType(type);
    setTimeout(() => {
      setStatusMessage('');
      setStatusType('');
    }, 3000);
  };

  // Busca a cotação do dia de todas as moedas de uma vez.
  // `force` ignora a janela de 6h (usado pelo botão de atualizar).
  const refreshRates = useCallback(async (force = false) => {
    if (isBusy.current) return;
    if (!navigator.onLine) return;

    const last = readFetchedAt();
    if (!force && last && Date.now() - last < REFRESH_AFTER_MS) return;

    isBusy.current = true;
    setIsUpdating(true);

    try {
      const response = await fetch(RATES_ENDPOINT);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      // A API responde 200 mesmo em erro: quem diz se deu certo é o `result`.
      if (data.result !== 'success' || !data.rates) {
        throw new Error(data['error-type'] || 'Resposta inesperada da cotação');
      }

      const novas = {};
      CURRENCIES.forEach(({ code }) => {
        const converted = toRate(data.rates[code]);
        if (converted !== null) novas[code] = converted;
      });

      if (!Object.keys(novas).length) throw new Error('Nenhuma moeda reconhecida');

      const agora = Date.now();
      setRates((anteriores) => {
        const atualizadas = { ...anteriores, ...novas };
        try {
          localStorage.setItem(RATES_KEY, JSON.stringify(atualizadas));
          localStorage.setItem(FETCHED_AT_KEY, String(agora));
        } catch {
          // localStorage cheio ou bloqueado: a taxa vale para esta sessão
        }
        return atualizadas;
      });
      setFetchedAt(agora);
      setManualRate(null);

      if (force) showStatus('Cotação atualizada!', 'success');
    } catch (error) {
      console.error('Erro ao atualizar cotação:', error);
      if (force) showStatus('Não foi possível buscar a cotação agora.', 'error');
    } finally {
      isBusy.current = false;
      setIsUpdating(false);
    }
  }, []);

  // Busca ao abrir a aba e sempre que o app volta ao primeiro plano.
  // A janela de 6h evita requisição a cada troca de aba.
  useEffect(() => {
    refreshRates();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshRates();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refreshRates]);

  // Monitora status online/offline. Voltar a ter internet força a busca:
  // é o momento em que a taxa em tela tem mais chance de estar velha.
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      refreshRates(true);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [refreshRates]);

  // Trocar de moeda descarta a digitação manual e volta para a taxa do dia
  useEffect(() => {
    setManualRate(null);
  }, [selectedCurrency]);

  // Calcula resultado
  const totalBRL = amount && rate ? (parseFloat(amount) * parseFloat(rate)) : 0;

  // Data da última cotação, em linguagem de gente
  const describeFetchedAt = () => {
    if (!fetchedAt) return 'Taxa de referência - ainda não atualizada';

    const data = new Date(fetchedAt);
    const hoje = new Date().toDateString() === data.toDateString();
    const hora = data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    if (hoje) return `Cotação de hoje, ${hora}`;
    return `Cotação de ${data.toLocaleDateString('pt-BR')}, ${hora}`;
  };

  // Taxas pequenas (COP, ARS, CLP) precisam de mais casas para fazer sentido
  const formatRate = (value) => {
    const number = parseFloat(value);
    if (!Number.isFinite(number)) return '-';
    return number < 0.01 ? number.toFixed(6) : number.toFixed(4);
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
            <div className="flex items-center justify-between mb-2 gap-2">
              <label className="block text-xs font-bold text-red-600 uppercase text-left">
                Taxa
              </label>
              <button
                type="button"
                onClick={() => refreshRates(true)}
                disabled={!isOnline || isUpdating}
                className="flex items-center gap-1 text-xs font-semibold text-ocean disabled:opacity-40"
                aria-label="Atualizar cotação agora"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdating ? 'animate-spin' : ''}`} />
                {isUpdating ? 'Buscando...' : 'Atualizar'}
              </button>
            </div>
            <input
              type="number"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setManualRate(e.target.value)}
              placeholder="0.0000"
              min="0"
              step="0.000001"
              className="w-full px-4 py-3 sm:py-4 bg-ocean text-white rounded-xl font-semibold text-base sm:text-lg border-0 focus:outline-none focus:ring-2 focus:ring-ocean-600 placeholder-ocean-200 text-center"
            />
            <p className="mt-2 text-xs text-sand-500 text-center">
              {manualRate !== null ? 'Taxa digitada por você' : describeFetchedAt()}
            </p>
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

        {!isOnline && (
          <div className="mt-4 px-4 py-2 bg-yellow-50 text-yellow-700 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Offline - usando a última cotação salva
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
              {selectedCurrencyData?.symbol} {formatNumber(parseFloat(amount))} {selectedCurrency} × R$ {formatRate(rate)} = {formatBRL(totalBRL)}
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
          💡 <strong>Dica:</strong> a cotação se atualiza sozinha sempre que você abre o app com
          internet, e fica salva para funcionar offline. Dá para digitar outra taxa por cima quando
          quiser usar a da sua casa de câmbio.
        </p>
      </motion.div>
    </motion.div>
  );
};

export default CambioPage;
