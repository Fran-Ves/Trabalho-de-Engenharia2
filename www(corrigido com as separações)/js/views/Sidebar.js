
class Sidebar {
    static init() {
        this.setupEventListeners();
    }

    static setupEventListeners() {
        // Botão fechar sidebar
        const closeBtn = document.getElementById('sidebarClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.hide();
            });
        }
        
        // Botões de ordenação
        const sortByPrice = document.getElementById('sortByPrice');
        const sortByTrust = document.getElementById('sortByTrust');
        
        if (sortByPrice) {
            sortByPrice.addEventListener('click', () => {
                this.setSortMode('price');
            });
        }
        
        if (sortByTrust) {
            sortByTrust.addEventListener('click', () => {
                this.setSortMode('trust');
            });
        }
    }

    static show() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.remove('hidden');
            // Disparar evento
            window.dispatchEvent(new CustomEvent('sidebar:shown'));
        }
    }

    static hide() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.add('hidden');
            // Disparar evento
            window.dispatchEvent(new CustomEvent('sidebar:hidden'));
        }
    }

    static setSortMode(mode) {
        const sortByPrice = document.getElementById('sortByPrice');
        const sortByTrust = document.getElementById('sortByTrust');
        
        if (sortByPrice && sortByTrust) {
            if (mode === 'price') {
                sortByPrice.classList.add('active');
                sortByTrust.classList.remove('active');
            } else {
                sortByPrice.classList.remove('active');
                sortByTrust.classList.add('active');
            }
        }
        
        // Notificar o RouteController
        if (window.app?.controllers?.route) {
            window.app.controllers.route.setSortMode(mode);
        }
        
        Toast.show(`Ordenando por ${mode === 'price' ? 'preço' : 'confiança'}`);
    }

    static updateRouteInfo(stationCount, sortMode) {
        const info = document.getElementById('routeInfoCompact');
        if (info) {
            info.textContent = `${stationCount} postos na rota (por ${sortMode === 'price' ? 'preço' : 'confiança'})`;
        }
    }

    static clearList() {
        const list = document.getElementById('routeSidebarList');
        if (list) {
            list.innerHTML = '<li><span class="name">Nenhum posto encontrado</span></li>';
        }
    }
}

window.Sidebar = Sidebar;