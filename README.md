# 🌍 Viagem Colaborativa - PWA

Um aplicativo Progressive Web App (PWA) moderno para planejamento colaborativo de viagens, com controle financeiro completo e geração automática da história da viagem.

## ✨ Funcionalidades

### 1️⃣ Roteiro Colaborativo
- Criar e gerenciar eventos de viagem em tempo real
- Tipos de eventos:
  - ✈️ Voos
  - 🚗 Transfers
  - 🏨 Hospedagem
  - 🗺️ Passeios
  - 🍽️ Alimentação
- Visualização organizada por data
- Sincronização automática entre todos os participantes

### 2️⃣ Controle Financeiro
- Cadastro completo de despesas
- Categorização por tipo
- Divisão personalizada entre participantes
- Cálculos automáticos:
  - Total da viagem
  - Total por categoria
  - Total por pessoa
  - Balanço (quem deve/quem recebe)
- Interface visual intuitiva com gráficos

### 3️⃣ História da Viagem
- Geração automática de narrativa
- Resumo completo da experiência
- Integração de dados financeiros
- Exportação em Markdown
- Cópia rápida para compartilhamento

## 🚀 Como Começar

> 📖 **IMPORTANTE**: Consulte os guias detalhados antes de começar:
> - 📘 [GUIA-FIREBASE.md](GUIA-FIREBASE.md) - Guia completo de configuração (15-20 min)
> - ✅ [CHECKLIST-FIREBASE.md](CHECKLIST-FIREBASE.md) - Checklist de progresso
> - ⚡ [SETUP.md](SETUP.md) - Resumo rápido

### Pré-requisitos

- Node.js 18+ instalado
- Conta Google/Gmail (para Firebase)
- Editor de código (VS Code recomendado)

### Instalação Rápida

1. **Instalar dependências**
```powershell
npm install
```

2. **Configurar Firebase**
   
Siga o guia completo: [GUIA-FIREBASE.md](GUIA-FIREBASE.md)

Resumo dos passos principais:
- Criar projeto no Firebase Console
- Ativar Authentication (E-mail/Senha)
- Ativar Firestore Database (Modo teste)
- Copiar credenciais
- Criar arquivo `.env` com as credenciais
- Alterar `USE_MOCK_DATA = false` em `src/firebase.js`

3. **Iniciar o servidor**
```powershell
npm run dev
```

4. **Abrir no navegador**
```
http://localhost:5173
```

5. **Criar primeira conta e viagem**
   
Ver instruções detalhadas no [GUIA-FIREBASE.md](GUIA-FIREBASE.md#-passo-8-criar-sua-primeira-conta)

---

2. **Instale as dependências**
```powershell
npm install
```

3. **Configure o Firebase**

a) Acesse [Firebase Console](https://console.firebase.google.com/)

b) Crie um novo projeto

c) Ative os seguintes serviços:
   - **Authentication** → Email/Password
   - **Firestore Database** → Modo de teste (para desenvolvimento)

d) Nas configurações do projeto, copie as credenciais

e) Crie um arquivo `.env` na raiz do projeto:
```env
VITE_FIREBASE_API_KEY=sua-api-key
VITE_FIREBASE_AUTH_DOMAIN=seu-projeto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=seu-projeto-id
VITE_FIREBASE_STORAGE_BUCKET=seu-projeto.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

4. **Inicie o servidor de desenvolvimento**
```powershell
npm run dev
```

5. **Abra no navegador**
```
http://localhost:5173
```

## 📱 Instalando como PWA

### No Chrome (Desktop)
1. Abra o site
2. Clique no ícone de instalação na barra de endereço
3. Clique em "Instalar"

### No Android/iOS
1. Abra no navegador
2. Menu → "Adicionar à tela inicial"
3. O app aparecerá como nativo

## 🏗️ Estrutura do Projeto

```
viagem-Bre/
├── public/                    # Arquivos estáticos
│   └── pwa-512x512.png       # Ícone do PWA
├── src/
│   ├── components/           # Componentes reutilizáveis
│   │   └── Layout.jsx        # Layout principal com navegação
│   ├── contexts/             # Contextos React
│   │   ├── AuthContext.jsx   # Autenticação
│   │   └── TripContext.jsx   # Dados da viagem
│   ├── pages/                # Páginas da aplicação
│   │   ├── AuthPage.jsx      # Login/Registro
│   │   ├── RoteiroPage.jsx   # Roteiro colaborativo
│   │   ├── FinanceiroPage.jsx # Controle financeiro
│   │   └── HistoriaPage.jsx  # História da viagem
│   ├── App.jsx               # Configuração de rotas
│   ├── main.jsx              # Ponto de entrada
│   ├── firebase.js           # Configuração Firebase
│   └── index.css             # Estilos globais
├── index.html                # HTML base
├── vite.config.js            # Configuração Vite + PWA
├── tailwind.config.js        # Configuração Tailwind
├── package.json              # Dependências
└── README.md                 # Esta documentação
```

## 🎨 Design System

### Paleta de Cores

```css
Azul Oceano: #0EA5E9  /* Primário */
Verde Água:  #2DD4BF  /* Secundário */
Areia Clara: #F8FAFC  /* Background */
Cinza Escuro: #0F172A /* Texto */
```

### Componentes Reutilizáveis

- `.card` - Card com sombra e bordas arredondadas
- `.btn-primary` - Botão primário azul
- `.btn-secondary` - Botão secundário verde
- `.btn-outline` - Botão com borda
- `.input` - Campo de entrada padronizado
- `.badge` - Tag/etiqueta

## 🔥 Estrutura do Firestore

### Coleção: `trips`
```javascript
{
  name: "Viagem para Paris",
  participants: ["userId1", "userId2"],
  createdBy: "userId1",
  createdAt: Timestamp,
  
  // Subcoleção: events
  events: [
    {
      type: "voo",
      title: "Voo para Paris",
      description: "Air France AF123",
      date: Timestamp,
      location: "Aeroporto CDG",
      createdBy: "userId1",
      createdAt: Timestamp
    }
  ],
  
  // Subcoleção: expenses
  expenses: [
    {
      category: "aereo",
      description: "Passagem Paris",
      amount: 2500.00,
      paidBy: "userId1",
      splitBetween: ["userId1", "userId2"],
      date: Timestamp,
      createdBy: "userId1",
      createdAt: Timestamp
    }
  ]
}
```

## 📊 Exemplos de Uso

### 1. Criar uma Nova Viagem

Atualmente simplificado - a primeira viagem é criada automaticamente. Em produção, adicione uma tela de criação:

```javascript
const createTrip = async () => {
  const result = await createTrip({
    name: "Viagem dos Sonhos",
    participants: [user.uid]
  });
};
```

### 2. Adicionar Evento ao Roteiro

```javascript
const addEvent = async () => {
  await addEvent({
    type: 'passeio',
    title: 'Torre Eiffel',
    description: 'Visita ao marco mais famoso de Paris',
    date: new Date('2026-07-15T14:00'),
    location: 'Paris, França'
  });
};
```

### 3. Adicionar Despesa

```javascript
const addExpense = async () => {
  await addExpense({
    category: 'passeios',
    description: 'Ingresso Torre Eiffel',
    amount: 150.00,
    paidBy: user.uid,
    splitBetween: [user.uid, 'otherId'],
    date: new Date()
  });
};
```

## 🧮 Cálculos Financeiros

### Total por Categoria
```javascript
const byCategory = expenses.reduce((acc, exp) => {
  acc[exp.category] = (acc[exp.category] || 0) + Number(exp.amount);
  return acc;
}, {});
```

### Balanço por Pessoa
```javascript
// Quanto cada um pagou
const paidByPerson = expenses.reduce((acc, exp) => {
  acc[exp.paidBy] = (acc[exp.paidBy] || 0) + Number(exp.amount);
  return acc;
}, {});

// Quanto cada um deveria pagar
const shouldPayPerPerson = expenses.reduce((acc, exp) => {
  const amountPerPerson = Number(exp.amount) / exp.splitBetween.length;
  exp.splitBetween.forEach(personId => {
    acc[personId] = (acc[personId] || 0) + amountPerPerson;
  });
  return acc;
}, {});

// Balanço final
const balance = {};
allParticipants.forEach(personId => {
  balance[personId] = (paidByPerson[personId] || 0) - (shouldPayPerPerson[personId] || 0);
});
```

## 🚀 Deploy para Produção

### Netlify (Recomendado)

1. **Build do projeto**
```powershell
npm run build
```

2. **Deploy**
   - Crie conta no [Netlify](https://netlify.com)
   - Conecte seu repositório GitHub
   - Configure:
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Adicione as variáveis de ambiente do Firebase

### Firebase Hosting

```powershell
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

## 🔒 Regras de Segurança do Firestore

Configure em Firebase Console → Firestore → Regras:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Apenas usuários autenticados
    match /trips/{tripId} {
      allow read: if request.auth != null && 
                     request.auth.uid in resource.data.participants;
      allow write: if request.auth != null && 
                      request.auth.uid in resource.data.participants;
      
      // Subcoleções herdam permissões
      match /events/{eventId} {
        allow read, write: if request.auth != null && 
                              request.auth.uid in get(/databases/$(database)/documents/trips/$(tripId)).data.participants;
      }
      
      match /expenses/{expenseId} {
        allow read, write: if request.auth != null && 
                              request.auth.uid in get(/databases/$(database)/documents/trips/$(tripId)).data.participants;
      }
    }
  }
}
```

## 🎯 Próximas Melhorias

- [ ] Múltiplas viagens por usuário
- [ ] Upload de fotos nos eventos
- [ ] Chat entre participantes
- [ ] Notificações push
- [ ] Modo offline completo
- [ ] Exportar história como PDF
- [ ] Integração com mapas
- [ ] Previsão de gastos com IA

## 🐛 Solução de Problemas

### Erro: "Firebase not configured"
- Verifique se o arquivo `.env` está correto
- Reinicie o servidor de desenvolvimento

### Erro: "Permission denied"
- Configure as regras do Firestore (veja acima)
- Verifique se o usuário está autenticado

### PWA não instala
- Use HTTPS (Netlify fornece automaticamente)
- Verifique se os ícones estão no diretório `public`

## 📄 Licença

Este projeto é de código aberto e pode ser usado livremente.

## 👤 Breno Luis

Desenvolvido com ❤️ para facilitar o planejamento de viagens em grupo.

---

**Dúvidas?** Abra uma issue ou consulte a [documentação do Firebase](https://firebase.google.com/docs).
