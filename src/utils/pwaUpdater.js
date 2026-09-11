/**
 * Utilitário para gerenciar atualizações do PWA
 * Monitora o Service Worker e notifica o usuário sobre novas versões
 */

export class PWAUpdater {
  constructor() {
    this.updateCallback = null;
    this.registration = null;
  }

  /**
   * Registra o Service Worker e configura listeners de atualização
   * @param {Function} onUpdate - Callback chamado quando houver atualização
   */
  async register(onUpdate) {
    if (!('serviceWorker' in navigator)) {
      console.log('Service Worker não suportado neste navegador');
      return;
    }

    this.updateCallback = onUpdate;

    try {
      // Registra o Service Worker
      this.registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/'
      });

      console.log('Service Worker registrado com sucesso');

      // Quando um SW novo assume o controle de uma aba que já estava sob um SW
      // antigo, recarrega uma vez. Assim o celular instalado pega a versão nova
      // ao abrir o app, sem depender de tocar no aviso. Na primeira instalação
      // não há controller anterior, então não recarrega.
      const tinhaController = Boolean(navigator.serviceWorker.controller);
      let recarregou = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!tinhaController || recarregou) return;
        recarregou = true;
        window.location.reload();
      });

      // Confere na hora se há versão nova (o navegador só faz isso sozinho a
      // cada 24h ou em navegação, e o app instalado raramente navega)
      this.checkForUpdates();

      // Verifica atualizações periodicamente (a cada hora)
      setInterval(() => {
        this.checkForUpdates();
      }, 60 * 60 * 1000);

      // Verifica atualizações ao focar na janela
      window.addEventListener('focus', () => {
        this.checkForUpdates();
      });

      // Listener para mensagens do Service Worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SW_UPDATED') {
          console.log('Nova versão do app detectada:', event.data.version);
          if (this.updateCallback) {
            this.updateCallback(event.data.version);
          }
        }
      });

      // Listener para quando um novo SW está esperando
      if (this.registration.waiting) {
        if (this.updateCallback) {
          this.updateCallback();
        }
      }

      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration.installing;
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('Nova versão disponível');
            if (this.updateCallback) {
              this.updateCallback();
            }
          }
        });
      });

    } catch (error) {
      console.error('Erro ao registrar Service Worker:', error);
    }
  }

  /**
   * Verifica manualmente se há atualizações disponíveis
   */
  async checkForUpdates() {
    if (this.registration) {
      try {
        await this.registration.update();
        console.log('Verificação de atualização concluída');
      } catch (error) {
        console.error('Erro ao verificar atualizações:', error);
      }
    }
  }

  /**
   * Aplica a atualização e recarrega a página
   */
  applyUpdate() {
    if (!this.registration || !this.registration.waiting) {
      window.location.reload();
      return;
    }

    // Envia mensagem para o SW ativar
    this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });

    // O listener de controllerchange registrado em register() recarrega a
    // página quando o novo SW assumir o controle
  }
}

// Instância singleton
export const pwaUpdater = new PWAUpdater();
