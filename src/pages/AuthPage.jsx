import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Plane, Mail, Lock, User } from 'lucide-react';

const AuthPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, register } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let result;
    if (isLogin) {
      result = await login(email, password);
    } else {
      if (!displayName.trim()) {
        setError('Por favor, insira seu nome');
        setLoading(false);
        return;
      }
      result = await register(email, password, displayName);
    }

    if (!result.success) {
      // Traduz mensagens de erro comuns do Firebase
      const errorMessages = {
        'auth/user-not-found': 'Usuário não encontrado',
        'auth/wrong-password': 'Senha incorreta',
        'auth/email-already-in-use': 'Este e-mail já está em uso',
        'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres',
        'auth/invalid-email': 'E-mail inválido'
      };
      
      const errorCode = result.error.match(/auth\/[\w-]+/)?.[0];
      setError(errorMessages[errorCode] || 'Erro ao autenticar. Tente novamente.');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-ocean-400 via-aqua-400 to-ocean-500 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full shadow-lg mb-4">
            <Plane className="w-10 h-10 text-ocean" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Viagem Breno & Claudia</h1>
          <p className="text-ocean-50">Planeje sua viagem em grupo com facilidade</p>
        </div>

        {/* Card de autenticação */}
        <div className="card">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 p-1 bg-sand-200 rounded-xl">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                isLogin 
                  ? 'bg-white text-ocean shadow-sm' 
                  : 'text-sand-500 hover:text-dark'
              }`}
            >
              Entrar
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                !isLogin 
                  ? 'bg-white text-ocean shadow-sm' 
                  : 'text-sand-500 hover:text-dark'
              }`}
            >
              Criar conta
            </button>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nome (apenas no registro) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-dark-100 mb-2">
                  Nome completo
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sand-500" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="input pl-11"
                    placeholder="Seu nome"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            {/* E-mail */}
            <div>
              <label className="block text-sm font-medium text-dark-100 mb-2">
                E-mail
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sand-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-11"
                  placeholder="seu@email.com"
                  required
                />
              </div>
            </div>

            {/* Senha */}
            <div>
              <label className="block text-sm font-medium text-dark-100 mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sand-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-11"
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {/* Mensagem de erro */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                {error}
              </div>
            )}

            {/* Botão de submit */}
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
            >
              {loading ? 'Carregando...' : isLogin ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          {/* Informação adicional */}
          <p className="text-center text-sm text-sand-500 mt-6">
            {isLogin ? 'Primeira vez aqui?' : 'Já tem uma conta?'}
            {' '}
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
              }}
              className="text-ocean font-medium hover:underline"
            >
              {isLogin ? 'Criar conta' : 'Fazer login'}
            </button>
          </p>
        </div>

        {/* Informação sobre PWA */}
        <div className="text-center mt-6 text-ocean-50 text-sm">
          💡 Adicione este app à sua tela inicial para acesso rápido
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
