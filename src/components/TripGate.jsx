import React from 'react';
import { RefreshCw, CloudOff } from 'lucide-react';
import { useTrip } from '../contexts/TripContext';

/**
 * Portão entre o TripProvider e as páginas.
 *
 * Todas as páginas mostram "Nenhuma viagem encontrada" quando `currentTrip` é
 * nulo. Só que nulo também significa "ainda carregando" e "o listener do
 * Firestore caiu" - e é isso que acontece no celular ao voltar de um PDF: o
 * sistema congela a webview, o stream morre e o app anuncia que a viagem sumiu.
 *
 * Aqui os três estados ficam separados: carregando mostra progresso, falha
 * mostra o erro com botão de tentar de novo, e só o caso real de "não há
 * viagem" chega até a página.
 */
const TripGate = ({ children }) => {
  const { loading, error, currentTrip, reconnect } = useTrip();

  // Se já existe viagem na tela, mantemos o conteúdo mesmo durante uma
  // reconexão - piscar um spinner sobre dados válidos é pior que dados velhos.
  if (currentTrip) {
    return children;
  }

  if (loading) {
    return (
      <div className="empty-state">
        <RefreshCw className="w-8 h-8 text-ocean animate-spin mb-4" />
        <p className="text-sand-500">Carregando sua viagem...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="empty-state">
        <div className="w-20 h-20 bg-ocean-50 rounded-full flex items-center justify-center mb-6">
          <CloudOff className="w-10 h-10 text-ocean" />
        </div>
        <h2 className="text-2xl font-bold text-dark mb-3">Não conseguimos carregar sua viagem</h2>
        <p className="text-sand-500 mb-8 max-w-md">
          A conexão com o servidor caiu. Seus dados estão salvos - é só tentar de novo.
        </p>
        <button className="btn-primary" onClick={reconnect}>
          <RefreshCw className="w-5 h-5 inline mr-2" />
          Tentar de novo
        </button>
      </div>
    );
  }

  return children;
};

export default TripGate;
