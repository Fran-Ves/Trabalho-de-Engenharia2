/* main-sqlite.js — script principal usando apenas SQLite */
console.log('🚀 Inicializando aplicação com SQLite...');

// Variável global para controle de inicialização
let appInitialized = false;

// Função principal de inicialização
async function initializeApp() {
    if (appInitialized) {
        console.log('⚠️ Aplicação já inicializada');
        return;
    }
    
    console.log('📱 Iniciando processo de inicialização...');
    
    try {
        // 1. INICIALIZAR SQLITE
        console.log('🗃️ Passo 1: Inicializando SQLite...');
        if (typeof initSQLDatabase === 'function') {
            await initSQLDatabase();
            console.log('✅ SQLite inicializado');
        } else {
            console.error('❌ SQLite não disponível');
            throw new Error('SQLite não disponível');
        }
        
        // 2. CARREGAR DADOS
        console.log('📥 Passo 2: Carregando dados...');
        if (typeof loadData === 'function') {
            await loadData();
            console.log('✅ Dados carregados');
        } else {
            console.error('❌ Função loadData não encontrada');
            throw new Error('loadData não encontrada');
        }
        
        // 3. INICIALIZAR INTERFACE
        console.log('🎨 Passo 3: Configurando interface...');
        if (typeof setupUI === 'function') {
            setupUI();
            console.log('✅ Interface configurada');
        }
        
        // 4. INICIALIZAR MAPA
        console.log('🗺️ Passo 4: Inicializando mapa...');
        if (typeof initMap === 'function') {
            initMap();
            console.log('✅ Mapa inicializado');
        }
        
        // 5. CONFIGURAR EVENT LISTENERS
        console.log('🔗 Passo 5: Configurando eventos...');
        if (typeof attachEventListeners === 'function') {
            attachEventListeners();
            console.log('✅ Eventos configurados');
        }
        
        // 6. ADICIONAR ESTAÇÕES DE EXEMPLO SE NECESSÁRIO
        console.log('➕ Passo 6: Verificando estações...');
        if (gasData.length === 0 && typeof addSampleStations === 'function') {
            await addSampleStations();
            console.log('✅ Estações de exemplo adicionadas');
        }
        
        // 7. MARCAR COMO INICIALIZADO
        appInitialized = true;

        if (typeof addBackupButton === 'function') {
            addBackupButton();
        }
        
        // 8. AJUSTES FINAIS
        setTimeout(() => {
            if (typeof adjustHomeQuickPosition === 'function') {
                adjustHomeQuickPosition();
            }
            if (typeof equalizeButtonSizes === 'function') {
                equalizeButtonSizes();
            }
            console.log('🎉 Aplicação totalmente carregada!');
            showToast('✅ Aplicação pronta!');
        }, 500);
        
    } catch (error) {
        console.error('❌ ERRO na inicialização:', error);
        
        // TENTAR FALLBACK SIMPLES
        try {
            console.log('🔄 Tentando fallback simples...');
            
            // Carregar dados do localStorage
            if (typeof loadDataFromLocalStorage === 'function') {
                loadDataFromLocalStorage();
            } else {
                // Fallback manual
                try {
                    gasData = JSON.parse(localStorage.getItem('stations') || '[]');
                    users = JSON.parse(localStorage.getItem('users') || '[]');
                    currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
                    stationComments = JSON.parse(localStorage.getItem('stationComments') || '{}');
                } catch (e) {
                    gasData = [];
                    users = [];
                    currentUser = null;
                    stationComments = {};
                }
            }
            
            // Inicializar UI e mapa mesmo sem SQLite
            if (typeof setupUI === 'function') setupUI();
            if (typeof initMap === 'function') initMap();
            if (typeof attachEventListeners === 'function') attachEventListeners();
            
            showToast('⚠️ Modo offline básico (sem SQLite)');
            
        } catch (fallbackError) {
            console.error('❌ Falha no fallback:', fallbackError);
            showToast('❌ Erro crítico. Recarregue a página.');
            
            // Mostrar mensagem de erro ao usuário
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #ffebee;
                color: #c62828;
                padding: 20px;
                border-radius: 10px;
                z-index: 9999;
                text-align: center;
                max-width: 80%;
                box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            `;
            errorDiv.innerHTML = `
                <h3>❌ Erro de Inicialização</h3>
                <p>Não foi possível iniciar a aplicação.</p>
                <p><small>${error.message || 'Erro desconhecido'}</small></p>
                <button onclick="location.reload()" 
                        style="margin-top: 10px; padding: 8px 16px; background: #c62828; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Recarregar Página
                </button>
            `;
            document.body.appendChild(errorDiv);
        }
    }
}

function showStationOptions(stations, query) {
    if (!stations || stations.length === 0) return;
    
    if (stations.length <= 3) {
        const stationNames = stations.map(s => s.name).join(', ');
        if (confirm(`Encontramos ${stations.length} postos:\n${stationNames}\n\nDeseja ver o primeiro?`)) {
            if (typeof navigateToStation === 'function') {
                navigateToStation(stations[0].id);
            }
        }
    } else {
        if (typeof navigateToStation === 'function') {
            navigateToStation(stations[0].id);
        }
        showToast(`Encontramos ${stations.length} postos. Indo para o primeiro: ${stations[0].name}`);
    }
}

// Função de busca
function handleSearch() {
    const searchInput = document.getElementById('searchInput');
    if (!searchInput) return;
    
    const query = searchInput.value.trim();
    
    if (!query) {
        showToast('Digite o nome de um posto');
        searchInput.focus();
        return;
    }
    
    if (typeof findStationByName === 'function') {
        const station = findStationByName(query);
        if (station) {
            if (typeof navigateToStation === 'function') {
                navigateToStation(station.id);
            }
            searchInput.value = '';
        } else {
            const similarStations = gasData.filter(s => 
                s.name && s.name.toLowerCase().includes(query.toLowerCase())
            );
            
            if (similarStations.length > 0) {
                if (similarStations.length === 1) {
                    if (typeof navigateToStation === 'function') {
                        navigateToStation(similarStations[0].id);
                    }
                } else {
                    if (typeof showStationOptions === 'function') {
                        showStationOptions(similarStations, query);
                    }
                }
            } else {
                showToast(`❌ Nenhum posto encontrado com "${query}"`);
            }
        }
    }
}

function navigateToStation(stationId) {
    const station = gasData.find(s => s.id === stationId);
    if (station && station.coords) {
        // Centralizar no mapa
        if (map) {
            map.setView(station.coords, 16);
        }
        
        // Abrir popup se o marcador existir
        setTimeout(() => {
            const markers = gasMarkers.getLayers();
            const marker = markers.find(m => m.stationId === stationId);
            if (marker) {
                marker.openPopup();
            }
        }, 500);
        
        showToast(`📍 Indo para: ${station.name}`);
    }
}

// Event listeners básicos
function attachEventListeners() {
    console.log('🔗 Configurando eventos...');
    
    // 1. LISTENERS DE BUSCA
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    
    if (searchInput) {
        searchInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch();
            }
        });
    }
    
    if (searchBtn) {
        searchBtn.addEventListener('click', handleSearch);
    }
    
    // 2. BOTÕES DA HOME
    const homeBuscar = document.getElementById('homeBuscar');
    const homeTraçar = document.getElementById('homeTraçar');
    const homeCadastrar = document.getElementById('homeCadastrar');
    const homeMotorista = document.getElementById('homeMotorista');
    
    if (homeBuscar) {
        homeBuscar.addEventListener('click', function() {
            console.log('🔍 Botão Buscar clicado');
            const searchInput = document.getElementById('searchInput');
            if (searchInput) {
                searchInput.focus();
                if (searchInput.value.trim()) {
                    handleSearch();
                }
            }
        });
    }
    
    if (homeTraçar) {
        homeTraçar.addEventListener('click', function() {
            console.log('🛣️ Botão Traçar Rota clicado');
            if (typeof startRouteMode === 'function') {
                startRouteMode();
            }
        });
    }
    
    if (homeCadastrar) {
        homeCadastrar.addEventListener('click', function() {
            console.log('➕ Botão Cadastrar clicado');
            if (typeof showScreen === 'function') {
                showScreen('screenRegisterPosto');
            }
        });
    }
    
    if (homeMotorista) {
        homeMotorista.addEventListener('click', function() {
            console.log('🚗 Botão Modo Motorista clicado');
            if (typeof enterDriverMode === 'function') {
                enterDriverMode();
            } else {
                console.error('❌ enterDriverMode não está definido');
                showToast('Erro ao ativar modo motorista');
            }
        });
    }
    
    // 3. BOTÕES DA TOOLBAR
    const topbarBackBtn = document.getElementById('topbarBackBtn');
    const profileBtn = document.getElementById('profileBtn');
    const addBtn = document.getElementById('addBtn');
    const locationBtn = document.getElementById('locationBtn');
    
    if (topbarBackBtn) {
        topbarBackBtn.addEventListener('click', function() {
            console.log('↩️ Botão Voltar clicado');
            if (typeof goBack === 'function') {
                goBack();
            }
        });
    }
    
    if (profileBtn) {
        profileBtn.addEventListener('click', function() {
            console.log('👤 Botão Perfil clicado');
            if (typeof showScreen === 'function') {
                showScreen('screenProfile');
            }
            if (typeof renderProfileScreen === 'function') {
                renderProfileScreen();
            }
        });
    }
    
    if (addBtn) {
        addBtn.addEventListener('click', function(ev) {
            ev.stopPropagation();
            console.log('➕ Botão Add clicado');
            if (typeof showScreen === 'function') {
                showScreen('screenRegisterPosto');
            }
        });
    }
    
    if (locationBtn) {
        locationBtn.addEventListener('click', function() {
            console.log('📍 Botão Localização clicado');
            if (typeof toggleLocationTracking === 'function') {
                toggleLocationTracking();
            }
        });
    }
    
    // 4. SIDEBAR
    const sidebarClose = document.getElementById('sidebarClose');
    const sbCadastrarPosto = document.getElementById('sbCadastrarPosto');
    const sbTracarRotas = document.getElementById('sbTracarRotas');
    
    if (sidebarClose) {
        sidebarClose.addEventListener('click', function() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.add('hidden');
                if (typeof adjustHomeButtonsForSidebar === 'function') {
                    adjustHomeButtonsForSidebar(false);
                }
                console.log('🗂️ Sidebar fechada');
            }
        });
    }
    
    if (sbCadastrarPosto) {
        sbCadastrarPosto.addEventListener('click', function() {
            if (typeof showScreen === 'function') {
                showScreen('screenRegisterPosto');
            }
        });
    }
    
    if (sbTracarRotas) {
        sbTracarRotas.addEventListener('click', function() {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) {
                sidebar.classList.add('hidden');
                if (typeof adjustHomeButtonsForSidebar === 'function') {
                    adjustHomeButtonsForSidebar(false);
                }
            }
            
            if (typeof startRouteMode === 'function') {
                startRouteMode();
            }
        });
    }
    
    // 5. BOTÕES DE FORMULÁRIO
    const saveUserBtn = document.getElementById('saveUserScreenBtn');
    const savePostoBtn = document.getElementById('savePostoScreenBtn');
    const loginUserBtn = document.getElementById('loginUserScreenBtn');
    const backFromRouteBtn = document.getElementById('backFromRouteBtn');
    const selectOnMapBtn = document.getElementById('selectOnMapScreenBtn');
    
    if (saveUserBtn && typeof saveUser === 'function') {
        saveUserBtn.addEventListener('click', saveUser);
    }
    
    if (savePostoBtn && typeof savePosto === 'function') {
        savePostoBtn.addEventListener('click', savePosto);
    }
    
    if (loginUserBtn && typeof handleLogin === 'function') {
        loginUserBtn.addEventListener('click', handleLogin);
    }
    
    if (backFromRouteBtn) {
        backFromRouteBtn.addEventListener('click', function() {
            if (typeof hideScreen === 'function') {
                hideScreen('screenRoute');
            }
        });
    }
    
    if (selectOnMapBtn) {
        selectOnMapBtn.addEventListener('click', function() {
            if (typeof startLocationSelectionForPosto === 'function') {
                startLocationSelectionForPosto();
            }
            if (typeof hideScreen === 'function') {
                hideScreen('screenRegisterPosto');
            }
        });
    }
    
    // 6. LOGIN FORM SWITCH
    const btnLoginUser = document.getElementById('btnLoginUser');
    const btnLoginPosto = document.getElementById('btnLoginPosto');
    
    if (btnLoginUser && typeof switchLoginForm === 'function') {
        btnLoginUser.addEventListener('click', function() {
            console.log('👤 Botão Usuário clicado');
            switchLoginForm('user');
        });
    }
    
    if (btnLoginPosto && typeof switchLoginForm === 'function') {
        btnLoginPosto.addEventListener('click', function() {
            console.log('⛽ Botão Posto clicado');
            switchLoginForm('posto');
        });
    }
    
    // 7. SORTING
    const sortByPrice = document.getElementById('sortByPrice');
    const sortByTrust = document.getElementById('sortByTrust');
    
    if (sortByPrice) {
        sortByPrice.addEventListener('click', function() {
            if (typeof window.currentSortMode !== 'undefined') {
                window.currentSortMode = 'price';
                sortByPrice.classList.add('active');
                sortByTrust.classList.remove('active');
                
                if (typeof window.routeFoundStations !== 'undefined' && 
                    window.routeFoundStations.length > 0 &&
                    typeof renderRouteStationsPanel === 'function') {
                    renderRouteStationsPanel(window.routeFoundStations);
                }
            }
        });
    }
    
    if (sortByTrust) {
        sortByTrust.addEventListener('click', function() {
            if (typeof window.currentSortMode !== 'undefined') {
                window.currentSortMode = 'trust';
                sortByTrust.classList.add('active');
                sortByPrice.classList.remove('active');
                
                if (typeof window.routeFoundStations !== 'undefined' && 
                    window.routeFoundStations.length > 0 &&
                    typeof renderRouteStationsPanel === 'function') {
                    renderRouteStationsPanel(window.routeFoundStations);
                }
            }
        });
    }
    
    // 8. DRIVER MODE
    const exitDriverModeBtn = document.getElementById('exitDriverMode');
    const stopRouteBtn = document.getElementById('stopRouteBtn');
    const toggleDriverModeBtn = document.getElementById('toggleDriverMode');
    
    if (exitDriverModeBtn && typeof exitDriverModeHandler === 'function') {
        exitDriverModeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('❌ Fechando modo motorista...');
            exitDriverModeHandler();
        });
    }
    
    if (stopRouteBtn && typeof stopCurrentRoute === 'function') {
        stopRouteBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🛑 Parando rota...');
            stopCurrentRoute();
        });
    }
    
    if (toggleDriverModeBtn && typeof exitDriverModeHandler === 'function') {
        toggleDriverModeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('🚪 Saindo do modo motorista...');
            exitDriverModeHandler();
        });
    }
    
    // 9. INICIALIZAR FORMULÁRIO DE LOGIN SE VISÍVEL
    if (document.getElementById('screenLoginUser') && 
        !document.getElementById('screenLoginUser').classList.contains('hidden') &&
        typeof initLoginForm === 'function') {
        setTimeout(() => {
            initLoginForm();
        }, 100);
    }
    
    console.log('✅ Todos os event listeners configurados');
}

window.addEventListener('beforeunload', async function(e) {
    if (window.sqlDB && sqlDB.initialized && sqlDB.autoSaveEnabled) {
        console.log('💾 Salvando banco de dados antes de sair...');
        try {
            await sqlDB.backupToLocalStorage('sqlite_backup_auto');
            console.log('✅ Backup automático salvo');
        } catch (error) {
            console.error('❌ Erro no backup automático:', error);
        }
    }
});

// Também adicione tratamento para visibilidade da página
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'hidden') {
        // Página está sendo minimizada/trocada
        if (window.sqlDB && sqlDB.initialized && sqlDB.autoSaveEnabled) {
            sqlDB.backupToLocalStorage('sqlite_backup_auto').catch(console.error);
        }
    }
});

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado, preparando inicialização...');
    
    // Configurar event listeners básicos imediatamente
    // (chamamos apenas attachEventListeners para configurar busca e outros)
    attachEventListeners();
    
    // Aguardar um pouco para garantir que tudo carregou
    setTimeout(() => {
        initializeApp();
    }, 100);
});

// Exportar funções globais
window.handleSearch = handleSearch;
window.initializeApp = initializeApp;
window.attachEventListeners = attachEventListeners;
window.showStationOptions = showStationOptions;
window.showStationOptions = showStationOptions;
window.navigateToStation = navigateToStation;

console.log('✅ Script principal SQLite carregado');