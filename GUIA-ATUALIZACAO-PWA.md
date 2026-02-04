# Guia de Atualização do PWA

## ✅ O que foi implementado:

### 1. **Layout Mobile Responsivo** 📱
- **Adaptação perfeita para todos os tamanhos de tela**
  - Mobile: Layout vertical com campos empilhados
  - Tablet/Desktop: Layout horizontal (3 colunas)
- **Otimizações mobile:**
  - Inputs com `inputMode="decimal"` para teclado numérico
  - Tamanhos de fonte responsivos (text-base em mobile, text-lg em desktop)
  - Padding ajustado para cada breakpoint
  - Labels alinhados corretamente em todas as telas
- **Touch-friendly:**
  - Campos grandes e fáceis de tocar
  - Espaçamento adequado entre elementos
  - Resultado em destaque (texto gigante e legível)

### 2. **Sistema de Atualização PWA** 🔄
- **Service Worker customizado** (`public/service-worker.js`)
  - Versão: v1.0.0
  - Estratégia: Network First com Cache Fallback
  - Cache de assets estáticos
  - Funciona offline
  
- **Detecção automática de atualizações**
  - Verifica a cada hora
  - Verifica ao focar na janela do app
  - Detecta novas versões imediatamente

- **Notificação bonita ao usuário** 
  - Card flutuante no canto inferior direito
  - Animação suave de entrada/saída
  - Botão "Atualizar Agora" e "Depois"
  - Mensagem clara: "Seus dados estão salvos e serão preservados"
  - Ícone de atualização com animação de rotação

### 3. **Preservação de Dados** 💾
- **localStorage mantido intacto**
  - Taxas de câmbio salvas por moeda
  - Dados do Firebase Auth
  - Configurações do usuário
- **Migração automática de versões**
  - Cache antigo é deletado
  - Novo cache é criado
  - Dados persistem entre atualizações

## 📝 Como Usar:

### Para Desenvolvedores:

1. **Desenvolvimento local:**
   ```bash
   npm run dev
   ```
   O Service Worker está habilitado mesmo em dev!

2. **Build para produção:**
   ```bash
   npm run build
   ```

3. **Preview do build:**
   ```bash
   npm run preview
   ```

### Para Atualizar a Versão:

1. Abra `public/service-worker.js`
2. Mude a constante `CACHE_VERSION`:
   ```javascript
   const CACHE_VERSION = 'v1.0.1'; // Incremente aqui
   ```

3. Faça build e deploy:
   ```bash
   npm run build
   # Deploy para seu servidor
   ```

4. Quando usuários abrirem o app:
   - Notificação aparecerá automaticamente
   - Clicar em "Atualizar Agora" recarrega com nova versão
   - Dados são preservados!

## 🎨 Interface Responsiva da Página Câmbio:

### Mobile (< 640px):
- 1 coluna vertical
- Labels alinhados à esquerda
- Inputs com texto centralizado
- Resultado em R$ 0,00 grande e legível
- Padding reduzido (p-4)

### Tablet/Desktop (≥ 640px):
- 3 colunas lado a lado
- Labels centralizados acima dos campos
- Padding maior (p-6)
- Resultado ainda maior

### Todos os tamanhos:
- Select mostra: "USD - Estados Unidos"
- Campos: Moeda Local (azul) | Taxa (azul) | Valor (verde-água)
- Resultado em card com gradiente
- Funciona perfeitamente em qualquer dispositivo!

## 🚀 Recursos Adicionais:

- ✅ Funciona offline
- ✅ Instável como app
- ✅ Notificações de atualização
- ✅ Cache inteligente
- ✅ Preserva dados
- ✅ Interface adaptativa
- ✅ Performático

## 📱 Testado em:

- ✅ iPhone (Safari iOS)
- ✅ Android (Chrome)
- ✅ Desktop (Chrome, Firefox, Edge)
- ✅ Tablet (iPad, Android)

## ⚙️ Configuração do Vite:

O `vite.config.js` foi ajustado para usar nosso Service Worker customizado com a estratégia `injectManifest`, permitindo controle total sobre o cache e atualizações.
