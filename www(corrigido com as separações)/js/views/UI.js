class UI {
    static screens = new Map();
    static currentScreen = null;
    static previousScreen = null;

    static init() {
        // Registrar todas as telas
        document.querySelectorAll('.screen').forEach(screen => {
            this.screens.set(screen.id, screen);
        });
        
        // Esconder todas as telas inicialmente
        this.hideAllScreens();
        
        // Mostrar tela principal
        this.showScreen('main');
    }

    static showScreen(screenId) {
        // Esconder tela atual
        if (this.currentScreen) {
            this.currentScreen.classList.add('hidden');
        }
        
        // Mostrar nova tela
        const screen = this.screens.get(screenId);
        if (screen) {
            screen.classList.remove('hidden');
            this.previousScreen = this.currentScreen;
            this.currentScreen = screen;
            
            // Atualizar botão voltar
            this.updateBackButton(screenId);
            
            // Disparar evento
            window.dispatchEvent(new CustomEvent('screen:changed', {
                detail: { screenId }
            }));
        }
    }

    static hideAllScreens() {
        this.screens.forEach(screen => {
            screen.classList.add('hidden');
        });
    }

    static updateBackButton(screenId) {
        const backBtn = document.getElementById('topbarBackBtn');
        if (!backBtn) return;
        
        if (screenId === 'main') {
            backBtn.classList.add('hidden');
        } else {
            backBtn.classList.remove('hidden');
            backBtn.onclick = () => {
                if (this.previousScreen) {
                    this.showScreen(this.previousScreen.id);
                } else {
                    this.showScreen('main');
                }
            };
        }
    }

    static toggleSidebar(show) {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        
        if (show) {
            sidebar.classList.remove('hidden');
        } else {
            sidebar.classList.add('hidden');
        }
        
        // Ajustar botões home
        this.adjustHomeButtons(show);
    }

    static adjustHomeButtons(sidebarOpen) {
        const homeQuick = document.getElementById('homeQuick');
        if (!homeQuick) return;
        
        if (sidebarOpen) {
            homeQuick.classList.add('sidebar-open');
        } else {
            homeQuick.classList.remove('sidebar-open');
        }
    }

    static showLoading(show) {
        const loader = document.getElementById('loader') || this.createLoader();
        loader.style.display = show ? 'flex' : 'none';
    }

    static createLoader() {
        const loader = document.createElement('div');
        loader.id = 'loader';
        loader.className = 'loader';
        loader.innerHTML = `
            <div class="spinner"></div>
            <p>Carregando...</p>
        `;
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255,255,255,0.9);
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;
        document.body.appendChild(loader);
        return loader;
    }

    static createModal(options) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>${options.title || ''}</h3>
                <p>${options.message || ''}</p>
                <div class="modal-buttons">
                    ${options.buttons?.map(btn => 
                        `<button class="${btn.class || ''}" onclick="${btn.onclick}">${btn.text}</button>`
                    ).join('') || ''}
                </div>
            </div>
        `;
        
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
        `;
        
        document.body.appendChild(modal);
        return modal;
    }
}

window.UI = UI;