document.addEventListener('DOMContentLoaded', function() {
    loadData();
    setupUI();
    initMap();
    attachEventListeners();
});

function attachEventListeners() {
    console.log('🔗 Anexando event listeners...');
    
    const homeBuscar = document.getElementById('homeBuscar');
    const homeTraçar = document.getElementById('homeTraçar');
    const homeCadastrar = document.getElementById('homeCadastrar');
    
    if (homeBuscar) {
        homeBuscar.addEventListener('click', function() {
            console.log('🔍 Botão Buscar clicado');
            document.getElementById('searchInput')?.focus();
        });
    }
    
    if (homeTraçar) {
        homeTraçar.addEventListener('click', function() {
            console.log('🛣️ Botão Traçar Rota clicado');
            startRouteMode();
        });
    }
    
    if (homeCadastrar) {
        homeCadastrar.addEventListener('click', function() {
            console.log('➕ Botão Cadastrar clicado');
            showScreen('screenRegisterPosto');
        });
    }
    
    const topbarBackBtn = document.getElementById('topbarBackBtn');
    const profileBtn = document.getElementById('profileBtn');
    const addBtn = document.getElementById('addBtn');
    const locationBtn = document.getElementById('locationBtn');
    
    if (topbarBackBtn) {
        topbarBackBtn.addEventListener('click', function() {
            console.log('↩️ Botão Voltar clicado');
            if (previousScreenId) {
                showScreen(previousScreenId);
            } else {
                hideAllScreens();
                showScreen('main');
            }
        });
    }
    
    if (profileBtn) {
        profileBtn.addEventListener('click', function() {
            console.log('👤 Botão Perfil clicado');
            showScreen('screenProfile');
            renderProfileScreen();
        });
    }
    
    if (addBtn) {
        addBtn.addEventListener('click', function(ev) {
            ev.stopPropagation();
            console.log('➕ Botão Add clicado');
            showScreen('screenRegisterPosto');
        });
    }
    
    if (locationBtn) {
        locationBtn.addEventListener('click', function() {
            console.log('📍 Botão Localização clicado');
            toggleLocationTracking();
        });
    }
    
    const sidebarClose = document.getElementById('sidebarClose');
    const sbCadastrarPosto = document.getElementById('sbCadastrarPosto');
    const sbTracarRotas = document.getElementById('sbTracarRotas');
    
    if (sidebarClose) {
        sidebarClose.addEventListener('click', function() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.add('hidden');
                adjustHomeButtonsForSidebar(false);
                console.log('🗂️ Sidebar fechada - botões reposicionados');
            }
        });
    }
    
    if (sbCadastrarPosto) {
        sbCadastrarPosto.addEventListener('click', function() {
            showScreen('screenRegisterPosto');
        });
    }
    
    if (sbTracarRotas) {
        sbTracarRotas.addEventListener('click', function() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.add('hidden');
                adjustHomeButtonsForSidebar(false);
            }
            
            startRouteMode();
        });
    }
    
    const saveUserBtn = document.getElementById('saveUserScreenBtn');
    const savePostoBtn = document.getElementById('savePostoScreenBtn');
    const loginUserBtn = document.getElementById('loginUserScreenBtn');
    const backFromRouteBtn = document.getElementById('backFromRouteBtn');
    
    if (saveUserBtn) {
        saveUserBtn.addEventListener('click', saveUser);
    }
    
    if (savePostoBtn) {
        savePostoBtn.addEventListener('click', savePosto);
    }
    
    if (loginUserBtn) {
        loginUserBtn.addEventListener('click', handleLogin);
    }
    
    if (backFromRouteBtn) {
        backFromRouteBtn.addEventListener('click', function() {
            hideScreen('screenRoute');
        });
    }
    
    const selectOnMapBtn = document.getElementById('selectOnMapScreenBtn');
    if (selectOnMapBtn) {
        selectOnMapBtn.addEventListener('click', function() {
            selectingLocationForPosto = true;
            hideScreen('screenRegisterPosto');
            showToast('📍 Toque no mapa para selecionar a localização do posto');
        });
    }

    const btnLoginUser = document.getElementById('btnLoginUser');
    const btnLoginPosto = document.getElementById('btnLoginPosto');

    if (btnLoginUser) {
        btnLoginUser.addEventListener('click', function() {
            switchLoginForm('user');
        });
    }

    if (btnLoginPosto) {
        btnLoginPosto.addEventListener('click', function() {
            switchLoginForm('posto');
        });
    }

    const sortByPrice = document.getElementById('sortByPrice');
    const sortByTrust = document.getElementById('sortByTrust');

    if (sortByPrice) {
        sortByPrice.addEventListener('click', function() {
            currentSortMode = 'price';
            sortByPrice.classList.add('active');
            sortByTrust.classList.remove('active');
            
            if (routeFoundStations.length > 0) {
                renderRouteStationsPanel(routeFoundStations);
            }
        });
    }
    
    if (sortByTrust) {
        sortByTrust.addEventListener('click', function() {
            currentSortMode = 'trust';
            sortByTrust.classList.add('active');
            sortByPrice.classList.remove('active');
            
            if (routeFoundStations.length > 0) {
                renderRouteStationsPanel(routeFoundStations);
            }
        });
    }

    if (sidebarClose) {
        sidebarClose.addEventListener('click', function() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.add('hidden');
                adjustHomeButtonsForSidebar(false);
            }
        });
    }

    const homeMotorista = document.getElementById('homeMotorista');
    const exitDriverModeBtn = document.getElementById('exitDriverMode');
    const stopRouteBtn = document.getElementById('stopRouteBtn');
    const toggleDriverModeBtn = document.getElementById('toggleDriverMode');
    
    if (homeMotorista) {
        homeMotorista.addEventListener('click', function() {
            console.log('🚗 Botão Modo Motorista clicado');
            enterDriverMode();
        });
    }
    
    if (exitDriverModeBtn) {
        exitDriverModeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('❌ Fechando modo motorista (Botão X)...');
            exitDriverModeHandler();
        });
    }

    if (stopRouteBtn) {
        stopRouteBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🛑 Parando rota (Botão Parar Rota)...');
            stopCurrentRoute();
        });
    }

    if (toggleDriverModeBtn) {
        toggleDriverModeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🚪 Saindo do modo motorista (Botão Sair do Modo)...');
            exitDriverModeHandler();
        });
    }
    
    // Adiciona listeners para elementos dinâmicos
    document.addEventListener('click', function(e) {
        // Pode adicionar outros eventos delegados aqui
    });
}

window.handleLocationSelection = handleLocationSelection;
window.handleRoutePointSelection = handleRoutePointSelection;
window.startRouteMode = startRouteMode;
window.promptNewPrice = promptNewPrice;
window.confirmPrice = confirmPrice;