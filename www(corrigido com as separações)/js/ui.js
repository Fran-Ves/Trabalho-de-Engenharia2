/* ui.js — funções que controlam telas, sidebar e perfil (sem anexar listeners repetidos) */
let selectedLocationForPosto = null; 
window.preventAutoSaveUser = true;

function setupUI() {
    console.log('🎨 Configurando UI...');
    
    // Inicializar pilha de navegação
    resetNavigationStack();
    
    // Esconder todas as telas primeiro
    hideAllScreens();
    
    // Iniciar com o mapa visível
    showScreen('main');
    
    // Atualizar ícone do perfil
    updateProfileIcon();
    
    // Garantir que elementos do mapa estejam visíveis
    document.body.classList.add('map-visible');
}

function hideAllScreens() {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.add('hidden');
        screen.setAttribute('aria-hidden', 'true');
    });
}

function showScreen(screenId) {
    hideAllScreens();
    manageFocusWhenSwitchingScreens(currentScreenId, screenId);
    const screen = document.getElementById(screenId);

    if (window.preventAutoSaveUser) {
    console.log("⛔ Auto-save de usuário bloqueado");
    } else {
        saveUserChanges(); // Mas deixe de chamar automaticamente
    }
    
    if (screen) {
        // Primeiro remover o aria-hidden antes de focar
        screen.classList.remove('hidden');
        screen.setAttribute('aria-hidden', 'false');
        
        // Se não estiver navegando para trás, adicionar à pilha
        if (!isNavigatingBack) {
            // Se a tela atual não for a mesma que estamos indo, adicionar à pilha
            if (currentScreenId && currentScreenId !== screenId) {
                // Não adicionar duplicados consecutivos
                if (navigationStack.length === 0 || navigationStack[navigationStack.length - 1] !== currentScreenId) {
                    navigationStack.push(currentScreenId);
                }
            }
        } else {
            // Se está navegando para trás, resetar a flag
            isNavigatingBack = false;
        }
        
        // Atualizar tela atual
        previousScreenId = currentScreenId;
        currentScreenId = screenId;
        
        // Gerenciar botão de voltar
        const backBtn = document.getElementById('topbarBackBtn');
        if (backBtn) {
            // Mostrar botão de voltar se não estiver na tela principal E houver telas na pilha
            if (screenId === 'main' && navigationStack.length === 0) {
                backBtn.classList.add('hidden');
            } else {
                backBtn.classList.remove('hidden');
            }
        }

        // GERENCIAR VISIBILIDADE DOS ELEMENTOS DO MAPA
        const homeQuick = document.getElementById('homeQuick');
        const sidebar = document.getElementById('sidebar');
        const routePanel = document.querySelector('.route-panel');
        const driverPanel = document.getElementById('driverModePanel');
        const quickMenu = document.getElementById('quickMenu');
        const searchResults = document.querySelector('.search-results');
        const minimalRecommendations = document.getElementById('minimalRecommendations');

        if (screenId === 'main') {
            // MOSTRAR elementos do mapa (apenas quando na tela principal)
            if (homeQuick) homeQuick.classList.remove('hidden');
            document.body.classList.add('map-visible');
            
            // Apenas mostrar sidebar se houver rota ativa
            if (routeFoundStations && routeFoundStations.length > 0) {
                if (sidebar) sidebar.classList.remove('hidden');
                adjustHomeButtonsForSidebar(true);
            } else {
                if (sidebar) sidebar.classList.add('hidden');
                adjustHomeButtonsForSidebar(false);
            }
        } else {
            // ESCONDER todos os elementos do mapa quando em outra tela
            if (homeQuick) homeQuick.classList.add('hidden');
            if (sidebar) sidebar.classList.add('hidden');
            if (routePanel) routePanel.classList.add('hidden');
            if (driverPanel) driverPanel.classList.add('hidden');
            if (quickMenu) quickMenu.classList.add('hidden');
            if (searchResults) searchResults.classList.add('hidden');
            if (minimalRecommendations) minimalRecommendations.classList.add('hidden');
            
            document.body.classList.remove('map-visible');
            adjustHomeButtonsForSidebar(false);
        }
        
        // INICIALIZAR FORMULÁRIO DE LOGIN SE NECESSÁRIO
        if (screenId === 'screenLoginUser') {
            setTimeout(() => {
                initLoginForm();
            }, 50);
        }
        
        // Adicionar: Focar no primeiro elemento interativo da tela
        if (screenId !== 'main') {
            setTimeout(() => {
                const focusableElements = screen.querySelectorAll(
                    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusableElements.length > 0) {
                    focusableElements[0].focus();
                }
            }, 100);
        }
    }
}

function goBack() {
    console.log('↩️ Navegando para trás...');
    console.log('Pilha atual:', navigationStack);
    
    if (navigationStack.length === 0) {
        // Se a pilha está vazia, ir para a tela principal
        showScreen('main');
        return;
    }
    
    // Remover a tela atual da pilha (se estiver lá)
    const currentIndex = navigationStack.indexOf(currentScreenId);
    if (currentIndex !== -1) {
        navigationStack.splice(currentIndex, 1);
    }
    
    // Pegar a última tela da pilha
    const lastScreen = navigationStack.pop();
    
    if (lastScreen) {
        // Ativar flag de navegação para trás
        isNavigatingBack = true;
        showScreen(lastScreen);
    } else {
        // Se não houver telas na pilha, ir para a tela principal
        showScreen('main');
    }
}

function resetNavigationStack() {
    navigationStack = [];
    isNavigatingBack = false;
    console.log('🔄 Pilha de navegação resetada');
}

function goToMainScreen() {
    resetNavigationStack();
    showScreen('main');
}

function hideScreen(screenId) {
    const screen = document.getElementById(screenId);
    if (screen) {
        // Remover foco de qualquer elemento dentro da tela antes de escondê-la
        const focusedElement = document.activeElement;
        if (screen.contains(focusedElement)) {
            // Mover foco para um elemento seguro (mapa ou botão da barra superior)
            const mapContainer = document.getElementById('map');
            if (mapContainer) {
                mapContainer.focus();
            }
        }
        
        screen.classList.add('hidden');
        screen.setAttribute('aria-hidden', 'true');
    }
    
    // Voltar para a tela principal usando a nova lógica
    goBack();
}

function adjustHomeButtonsForSidebar(sidebarOpen) {
    const homeQuick = document.getElementById('homeQuick');
    if (!homeQuick) return;
    
    if (sidebarOpen) {
        homeQuick.classList.add('sidebar-open');
        // Forçar reajuste
        setTimeout(() => {
            adjustHomeQuickPosition();
            equalizeButtonSizes();
        }, 50);
    } else {
        homeQuick.classList.remove('sidebar-open');
        homeQuick.style.right = '20px';
        homeQuick.style.left = 'auto';
        
        // Forçar reajuste
        setTimeout(() => {
            adjustHomeQuickPosition();
            equalizeButtonSizes();
        }, 50);
    }
}

function renderProfileScreen() {
    const content = document.getElementById('profileContentScreen');
    if (!content) return;

    let html = '';
    if (!currentUser) {
        html = `
            <div style="text-align:center; padding: 20px;">
                <i class="fa-solid fa-circle-user" style="font-size: 48px; color:#ccc;"></i>
                <p>Você não está logado.</p>
                <div class="actions" style="flex-direction: column;">
                    <button class="big-btn" style="background:#1976d2" onclick="showScreen('screenLoginUser')">Fazer Login</button>
                    <button class="btn-secondary" onclick="showScreen('screenRegisterUser')">Criar Conta Motorista</button>
                    <button class="btn-secondary" onclick="showScreen('screenRegisterPosto')">Cadastrar meu Posto</button>
                </div>
            </div>
        `;
    } else {
        const isPosto = currentUser.type === 'posto';
        const icon = isPosto ? 'fa-gas-pump' : 'fa-user';
        const subtitle = isPosto ? `CNPJ: ${currentUser.cnpj || ''}` : currentUser.email || '';
        const color = isPosto ? '#e65100' : '#1976d2';

        html = `
            <div class="profile-card">
                <div class="profile-avatar" style="color: ${color}; background: ${isPosto ? '#fff3e0' : '#eef2f7'}">
                    <i class="fa-solid ${icon}"></i>
                </div>
                <div class="profile-info">
                    <b style="font-size:16px;">${escapeHtml(currentUser.name || 'Usuário')}</b><br>
                    <span class="muted" style="font-size:12px;">${escapeHtml(subtitle)}</span>
                    <br>
                    <span style="font-size:10px; background:${color}; color:white; padding:2px 6px; border-radius:4px;">
                        ${isPosto ? 'CONTA EMPRESARIAL' : 'MOTORISTA'}
                    </span>
                </div>
            </div>
            <div class="profile-actions" style="flex-direction: column; margin-top:20px;">
                <button class="big-btn" style="background:#4CAF50" onclick="showEditProfileScreen()">
                    <i class="fa-solid fa-pen-to-square"></i> Editar Perfil
                </button>
                ${isPosto ? 
                    `<button class="big-btn" style="background:#e65100" onclick="promptNewPrice('${currentUser.id}')">
                        <i class="fa-solid fa-tag"></i> Atualizar Meus Preços
                    </button>` 
                    : 
                    `<button class="btn-secondary" onclick="showToast('Histórico em breve...')">Ver Histórico</button>`
                }
                <button class="btn-secondary" onclick="logout()" style="margin-top:10px;">Sair da Conta</button>
                <button class="btn-secondary" onclick="showDeleteAccountScreen()" 
                        style="margin-top:20px; background-color: #f44336; color: white;">
                    <i class="fa-solid fa-trash"></i> Remover Conta
                </button>
            </div>
        `;
    }

    content.innerHTML = html;
}

function updateProfileIcon() {
    const profileBtn = document.getElementById('profileBtn');
    if (!profileBtn) return;
    if (currentUser) {
        profileBtn.innerHTML = `<i class="fa-solid fa-user-check"></i>`;
    } else {
        profileBtn.innerHTML = `<i class="fa-solid fa-user"></i>`;
    }
}

function logout() {
    // Verificar se realmente quer sair
    if (!confirm('Deseja realmente sair da sua conta?')) {
        return;
    }
    
    currentUser = null;
    saveData();
    updateProfileIcon();
    showToast('✅ Você saiu da conta');
    renderProfileScreen();
    
    // Se estava no modo motorista, sair também
    if (driverMode) {
        exitDriverModeHandler();
    }
}

function startLocationSelectionForPosto() {
    console.log('📍 Iniciando seleção de localização para cadastro...');
    
    // Resetar variável temporária
    window.tempSelectedLocation = null;
    
    // Definir contexto de cadastro
    window.locationSelectionContext = 'cadastro';
    window.fromCadastro = true;
    
    selectingLocationForPosto = true;
    
    // Mostrar o mapa principal
    window.preventAutoSaveUser = true;
    showScreen('main');
    
    // Esconder elementos do mapa
    hideAllMapElements();
    
    // Criar botão de voltar para cadastro
    createBackToCadastroButton();
    
    // Limpar marcador temporário anterior
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
    
    // Configurar listener do mapa
    if (map && !map._editingLocationListener) {
        map.on('click', onMapClickForEditing);
        map._editingLocationListener = true;
    }
    
    // Centralizar na localização do usuário se disponível
    if (userLocationMarker) {
        const userCoords = userLocationMarker.getLatLng();
        map.setView(userCoords, 15);
        console.log('📍 Centralizado na localização do usuário:', userCoords);
    }
    
    showToast('📍 Clique no mapa para selecionar a localização do posto');
}

function onMapClickForEditing(e) {
    if (!selectingLocationForPosto) {
        return;
    }

    console.log('📍 Mapa clicado para edição:', e.latlng);
    
    // Chamar a função global handleLocationSelection com o evento COMPLETO
    if (typeof window.handleLocationSelection === 'function') {
        window.handleLocationSelection(e);
    }
    
    // Remover o listener imediatamente
    if (map._editingLocationListener) {
        map.off('click', onMapClickForEditing);
        map._editingLocationListener = false;
    }
}

// function finishLocationSelection(latlng) {
//     console.log('📍 Finalizando seleção de localização:', latlng);
    
//     // Verificar se estamos editando um posto existente ou cadastrando novo
//     const isEditMode = currentScreenId === 'screenEditProfile' || 
//                       (document.getElementById('screenEditProfile') && 
//                        !document.getElementById('screenEditProfile').classList.contains('hidden'));
    
//     console.log('🔍 Modo de operação:', isEditMode ? 'EDICAO' : 'CADASTRO');
    
//     // Criar objeto padronizado
//     const selected = {
//         lat: latlng.lat,
//         lng: latlng.lng,
//         coords: [latlng.lat, latlng.lng]
//     };
    
//     // Limpar marcador temporário anterior
//     if (tempMarker) {
//         map.removeLayer(tempMarker);
//         tempMarker = null;
//     }
    
//     // Adicionar novo marcador temporário
//     tempMarker = L.marker(latlng, {
//         icon: L.divIcon({
//             className: 'temp-marker',
//             html: '<i class="fa-solid fa-map-pin" style="color: #e53935; font-size: 24px;"></i>',
//             iconSize: [24, 24],
//             iconAnchor: [12, 24]
//         })
//     }).addTo(map);
    
//     if (isEditMode) {
//         // MODO EDIÇÃO - voltar para tela de edição
//         console.log('🔄 Voltando para tela de edição...');
        
//         // Salvar a localização em uma variável global temporária
//         window.tempSelectedLocation = selected;
        
//         // Atualizar o campo na tela de edição se existir
//         const locInfo = document.getElementById('editPostoLocInfo');
//         if (locInfo) {
//             locInfo.textContent = `Lat: ${selected.lat.toFixed(5)}, Lng: ${selected.lng.toFixed(5)}`;
//             locInfo.style.color = '#1976d2';
//             locInfo.style.fontWeight = 'bold';
//             locInfo.classList.add('selected');
//             locInfo.dataset.lat = selected.lat;
//             locInfo.dataset.lng = selected.lng;
//         }
        
//         // Limpar variável de controle
//         selectingLocationForPosto = false;
        
//         // Remover listener do mapa
//         if (map._editingLocationListener) {
//             map.off('click', onMapClickForEditing);
//             map._editingLocationListener = false;
//         }
        
//         // Remover botão de voltar
//         const backBtn = document.getElementById('backToEditProfileBtn');
//         if (backBtn) backBtn.remove();
        
//         const cancelBtn = document.getElementById('cancelLocationSelectionBtn');
//         if (cancelBtn) cancelBtn.remove();
        
//         // Voltar para tela de edição
//         setTimeout(() => {
//             showScreen('screenEditProfile');
//             showToast('✅ Localização selecionada! Clique em Salvar para aplicar.');
//         }, 300);
        
//     } else {
//         // MODO CADASTRO - voltar para tela de cadastro
//         console.log('🔄 Voltando para tela de cadastro...');
        
//         // Salvar para cadastro
//         selectedLocationForPosto = latlng;
        
//         // Atualizar o campo na tela de cadastro
//         const locInfo = document.getElementById('locInfoScreen');
//         if (locInfo) {
//             locInfo.textContent = `Lat: ${latlng.lat.toFixed(5)}, Lng: ${latlng.lng.toFixed(5)}`;
//             locInfo.style.color = '#1976d2';
//             locInfo.style.fontWeight = 'bold';
//             locInfo.classList.add('selected');
//         }
        
//         // Limpar variável de controle
//         selectingLocationForPosto = false;
        
//         // Remover listener do mapa
//         if (map._editingLocationListener) {
//             map.off('click', onMapClickForEditing);
//             map._editingLocationListener = false;
//         }
        
//         // Remover botão de voltar
//         const backBtn = document.getElementById('backToCadastroBtn');
//         if (backBtn) backBtn.remove();
        
//         // Voltar para tela de cadastro
//         setTimeout(() => {
//             showScreen('screenRegisterPosto');
//             showToast('✅ Localização selecionada! Complete os outros dados.');
//         }, 300);
//     }
// }

// function finishLocationSelection(latlng) {
//     console.log('📍 Finalizando seleção de localização:', latlng);
    
//     selectingLocationForPosto = false;
//     selectedLocationForPosto = latlng;
    
//     // Atualizar o campo na tela de cadastro
//     const locInfo = document.getElementById('locInfoScreen');
//     if (locInfo) {
//         locInfo.textContent = `Lat: ${latlng.lat.toFixed(5)}, Lng: ${latlng.lng.toFixed(5)}`;
//         locInfo.style.color = '#1976d2';
//         locInfo.style.fontWeight = 'bold';
//         locInfo.classList.add('selected');
//     }
    
//     // Limpar marcador temporário se existir
//     if (tempMarker) {
//         map.removeLayer(tempMarker);
//     }
    
//     // Adicionar novo marcador
//     tempMarker = L.marker(latlng, {
//         icon: L.divIcon({
//             className: 'temp-marker',
//             html: '<i class="fa-solid fa-map-pin" style="color: #e53935; font-size: 24px;"></i>',
//             iconSize: [24, 24],
//             iconAnchor: [12, 24]
//         })
//     }).addTo(map);
    
//     // IMPORTANTE: Forçar retorno à tela de cadastro
//     console.log('🔄 Voltando para tela de cadastro...');
    
//     // Pequeno delay para garantir que o DOM esteja pronto
//     setTimeout(() => {
//         showScreen('screenRegisterPosto');
//         showToast('✅ Localização selecionada! Complete os outros dados.');
//     }, 100);
// }

function createBackToCadastroButton() {
    const existingBtn = document.getElementById('backToCadastroBtn');
    if (existingBtn) existingBtn.remove();
    
    const backBtn = document.createElement('button');
    backBtn.id = 'backToCadastroBtn';
    backBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Voltar ao Cadastro';
    backBtn.style.cssText = `
        position: fixed;
        top: 70px;
        left: 10px;
        z-index: 2000;
        background: #1976d2;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 8px;
        font-weight: bold;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
    `;
    
    backBtn.addEventListener('click', function() {
        cancelLocationSelection();
        showScreen('screenEditProfile');
    });
    
    document.body.appendChild(backBtn);
}

function hideAllMapElements() {
    const elementsToHide = [
        'homeQuick',
        'sidebar',
        'driverModePanel',
        'quickMenu',
        'minimalRecommendations'
    ];
    
    elementsToHide.forEach(id => {
        const element = document.getElementById(id);
        if (element) element.classList.add('hidden');
    });
    
    // Esconder elementos por classe
    document.querySelectorAll('.route-panel, .search-results').forEach(el => {
        el.classList.add('hidden');
    });
    
    adjustHomeButtonsForSidebar(false);
}

function adjustHomeQuickPosition() {
    const homeQuick = document.getElementById('homeQuick');
    if (!homeQuick) return;
    
    const sidebar = document.getElementById('sidebar');
    const sidebarWidth = sidebar && !sidebar.classList.contains('hidden') ? 320 : 0;
    
    // Verificar se há espaço suficiente à direita
    const viewportWidth = window.innerWidth;
    const homeQuickWidth = homeQuick.offsetWidth;
    const neededRightSpace = homeQuickWidth + 20; // 20px de margem
    
    // Se a sidebar estiver aberta, considerar seu espaço
    const totalRightSpaceNeeded = neededRightSpace + sidebarWidth;
    
    if (totalRightSpaceNeeded > viewportWidth) {
        // Se não couber, mover para a esquerda
        const availableLeftSpace = viewportWidth - neededRightSpace;
        if (availableLeftSpace > 100) { // Se tiver espaço na esquerda
            homeQuick.style.right = 'auto';
            homeQuick.style.left = '20px';
            homeQuick.classList.remove('sidebar-open');
        } else {
            // Se não couber em nenhum lado, reduzir tamanho
            homeQuick.style.maxWidth = '160px';
            homeQuick.style.right = '10px';
        }
    } else {
        // Resetar para posição padrão
        homeQuick.style.right = sidebarWidth > 0 ? `${sidebarWidth + 20}px` : '20px';
        homeQuick.style.left = 'auto';
        homeQuick.style.maxWidth = '200px';
        
        if (sidebarWidth > 0) {
            homeQuick.classList.add('sidebar-open');
        } else {
            homeQuick.classList.remove('sidebar-open');
        }
    }
    
    // Verificar altura também
    const viewportHeight = window.innerHeight;
    const homeQuickHeight = homeQuick.offsetHeight;
    const topPosition = 80; // posição padrão do topo
    
    if (homeQuickHeight + topPosition + 20 > viewportHeight) {
        // Se não couber na vertical, reduzir espaçamento entre botões
        const homeButtons = homeQuick.querySelector('.home-buttons');
        if (homeButtons) {
            homeButtons.style.gap = '6px';
        }
    }
}

function equalizeButtonSizes() {
    const bigButtons = document.querySelectorAll('.big-btn');
    if (bigButtons.length === 0) return;
    
    // Encontrar a altura máxima
    let maxHeight = 0;
    let maxWidth = 0;
    
    bigButtons.forEach(btn => {
        btn.style.height = 'auto'; // Reset para calcular altura real
    });
    
    // Pequeno delay para garantir que o DOM foi renderizado
    setTimeout(() => {
        bigButtons.forEach(btn => {
            const rect = btn.getBoundingClientRect();
            maxHeight = Math.max(maxHeight, rect.height);
            maxWidth = Math.max(maxWidth, rect.width);
        });
        
        // Aplicar altura e largura máxima a todos os botões
        bigButtons.forEach(btn => {
            btn.style.minHeight = `${maxHeight}px`;
            btn.style.width = '100%';
        });
    }, 50);
}

window.addEventListener('load', function() {
    // Ajustar posição inicial
    adjustHomeQuickPosition();
    equalizeButtonSizes();
    
    // Ajustar quando a janela for redimensionada
    window.addEventListener('resize', function() {
        adjustHomeQuickPosition();
        equalizeButtonSizes();
    });
    
    // Ajustar quando a sidebar for aberta/fechada
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.target.id === 'sidebar' || 
                mutation.target.classList.contains('sidebar')) {
                setTimeout(() => {
                    adjustHomeQuickPosition();
                    equalizeButtonSizes();
                }, 100);
            }
        });
    });
    
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        observer.observe(sidebar, { attributes: true, attributeFilter: ['class'] });
    }
});

function initLoginForm() {
    // Garantir que o formulário de usuário seja o padrão
    if (typeof switchLoginForm === 'function') {
        switchLoginForm('user');
    }
    
    // Adicionar event listeners se necessário
    const btnLoginUser = document.getElementById('btnLoginUser');
    const btnLoginPosto = document.getElementById('btnLoginPosto');
    
    if (btnLoginUser && btnLoginPosto) {
        // Remover listeners antigos para evitar duplicação
        btnLoginUser.replaceWith(btnLoginUser.cloneNode(true));
        btnLoginPosto.replaceWith(btnLoginPosto.cloneNode(true));
        
        // Adicionar novos listeners
        document.getElementById('btnLoginUser').addEventListener('click', function() {
            switchLoginForm('user');
        });
        
        document.getElementById('btnLoginPosto').addEventListener('click', function() {
            switchLoginForm('posto');
        });
    }
}

// Adicione estas funções no final do arquivo ui.js

function showEditProfileScreen() {
    console.log('🔄 Mostrando tela de edição de perfil...');
    
    // Verificar se o usuário está logado
    if (!currentUser) {
        showToast('❌ Você precisa estar logado para editar o perfil');
        showScreen('screenProfile');
        return;
    }
    
    // Tentar encontrar a tela de várias maneiras
    let editScreen = document.getElementById('screenEditProfile');
    
    // Se não encontrar, criar dinamicamente
    if (!editScreen) {
        console.log('⚠️ Tela de edição não encontrada, criando dinamicamente...');
        editScreen = createEditProfileScreen();
    }
    
    // Mostrar a tela
    showScreen('screenEditProfile');
    
    // Pequeno delay para garantir que o DOM esteja pronto
    setTimeout(() => {
        renderEditProfileScreen();
    }, 100);
}

function createEditProfileScreen() {
    const screen = document.createElement('div');
    screen.id = 'screenEditProfile';
    screen.className = 'screen hidden';
    screen.setAttribute('aria-hidden', 'true');
    
    screen.innerHTML = `
        <div class="screen-inner">
            <div class="screen-header">
                <button class="back-btn" onclick="showScreen('screenProfile')">
                    <i class="fa-solid fa-arrow-left"></i> Voltar
                </button>
                <h2>Editar Perfil</h2>
            </div>
            
            <div id="editProfileContent" class="form-screen">
                <div class="loading-spinner">
                    <i class="fa-solid fa-spinner fa-spin"></i> Carregando...
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(screen);
    console.log('✅ Tela de edição criada dinamicamente');
    return screen;
}

function renderEditProfileScreen() {
    console.log('🎨 Renderizando formulário de edição de perfil...');
    
    const content = document.getElementById('editProfileContent');
    if (!content) {
        console.error('❌ Elemento editProfileContent não encontrado');
        
        // Tentar encontrar de forma alternativa
        const editScreen = document.getElementById('screenEditProfile');
        if (editScreen) {
            const altContent = editScreen.querySelector('#editProfileContent');
            if (altContent) {
                console.log('✅ Elemento encontrado via querySelector');
                renderEditProfileContent(altContent);
                return;
            }
        }
        
        showToast('❌ Erro ao carregar formulário de edição');
        showScreen('screenProfile');
        return;
    }
    
    renderEditProfileContent(content);
}

function renderEditProfileScreen() {
    console.log('🎨 Renderizando formulário de edição de perfil...');
    
    // Tentar várias maneiras de encontrar o elemento
    let content = document.getElementById('editProfileContent');
    
    if (!content) {
        console.log('⚠️ Elemento editProfileContent não encontrado, tentando alternativa...');
        
        // Tentar encontrar dentro da tela
        const editScreen = document.getElementById('screenEditProfile');
        if (editScreen) {
            content = editScreen.querySelector('#editProfileContent');
        }
        
        // Se ainda não encontrar, criar dinamicamente
        if (!content) {
            console.error('❌ Não foi possível encontrar ou criar o elemento editProfileContent');
            showToast('❌ Erro ao carregar formulário de edição');
            
            // Tentar voltar para o perfil
            setTimeout(() => {
                showScreen('screenProfile');
            }, 500);
            return;
        }
    }
    
    // Limpar conteúdo anterior
    content.innerHTML = '';
    
    // Adicionar indicador de carregamento
    content.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-spinner fa-spin"></i> Preparando formulário...</div>';
    
    // Pequeno delay para garantir que o DOM foi atualizado
    setTimeout(() => {
        renderEditProfileContent(content);
    }, 50);
}

function renderEditProfileContent(contentElement) {
    if (!currentUser) {
        contentElement.innerHTML = '<p class="error">Nenhum usuário logado.</p>';
        return;
    }
    
    const isPosto = currentUser.type === 'posto';
    const userId = currentUser.id;
    
    // Limpar conteúdo anterior
    contentElement.innerHTML = '';
    
    // Adicionar classe de formatação
    contentElement.className = 'form-screen';
    
    let html = `
        <div class="form-header">
            <div class="profile-avatar-large" id="profileAvatarPreview" 
                 style="width: 80px; height: 80px; border-radius: 50%; background: ${isPosto ? '#fff3e0' : '#eef2f7'}; 
                        display: flex; align-items: center; justify-content: center; 
                        font-size: 36px; color: ${isPosto ? '#e65100' : '#1976d2'}; margin: 0 auto 10px;">
                <i class="fa-solid ${isPosto ? 'fa-gas-pump' : 'fa-user'}"></i>
            </div>
            <button onclick="changeProfilePhoto()" class="btn-photo">
                <i class="fa-solid fa-camera"></i> Alterar Foto
            </button>
            <input type="file" id="profilePhotoInput" accept="image/*" style="display: none;" 
                   onchange="handleProfilePhotoChange(event)">
        </div>
    `;
    
    if (isPosto) {
        // Formulário para posto
        const station = gasData.find(s => s.id === userId);
        const coords = station?.coords || currentUser.coords;
        
        html += `
            <div class="form-group">
                <label for="editPostoName_${currentUser.id}">Nome do Posto:</label>
                <input type="text" id="editPostoName_${currentUser.id}" 
                    value="${escapeHtml(currentUser.name || station?.name || '')}" 
                    placeholder="Nome do posto" class="form-input">
            </div>
            
            <div class="form-group">
                <label for="editPostoCnpj_${currentUser.id}">CNPJ:</label>
                <input type="text" id="editPostoCnpj_${currentUser.id}" 
                    value="${escapeHtml(currentUser.cnpj || station?.cnpj || '')}" 
                    placeholder="CNPJ" class="form-input" ${currentUser.cnpj ? 'readonly' : ''}>
            </div>
            
            <div class="form-group">
                <label>Localização Atual:</label>
                <div class="location-row">
                    <span class="location-info" id="editPostoLocInfo" 
                          data-lat="${coords ? coords[0] : ''}" 
                          data-lng="${coords ? coords[1] : ''}">
                        ${coords ? `Lat: ${coords[0]?.toFixed(5) || ''}, Lng: ${coords[1]?.toFixed(5) || ''}` : 'Não definida'}
                    </span>
                    <button id="editPostoSelectOnMap" class="btn-location" onclick="startLocationSelectionForEdit()">
                        <i class="fa-solid fa-map-marker-alt"></i> Alterar Localização
                    </button>
                </div>
            </div>

            <div style="margin-top: 8px;">
                <button type="button" onclick="viewCurrentLocationOnMap()" class="btn-secondary">
                    <i class="fa-solid fa-eye"></i> Ver no Mapa
                </button>
            </div>
            
            <h3 class="form-section-title">Preços Atuais</h3>
            <div class="prices-grid">
                <div class="form-group">
                    <label for="editPostoGasPrice_${currentUser.id}">Gasolina (R$)</label>
                    <input type="number" step="0.01" id="editPostoGasPrice_${currentUser.id}" 
                           value="${station?.prices?.gas || ''}" placeholder="0.00" class="form-input">
                </div>
                <div class="form-group">
                    <label for="editPostoEtanolPrice_${currentUser.id}">Etanol (R$)</label>
                    <input type="number" step="0.01" id="editPostoEtanolPrice_${currentUser.id}" 
                           value="${station?.prices?.etanol || ''}" placeholder="0.00" class="form-input">
                </div>
                <div class="form-group">
                    <label for="editPostoDieselPrice_${currentUser.id}">Diesel (R$)</label>
                    <input type="number" step="0.01" id="editPostoDieselPrice_${currentUser.id}" 
                           value="${station?.prices?.diesel || ''}" placeholder="0.00" class="form-input">
                </div>
            </div>
            
            <h3 class="form-section-title">Segurança</h3>
            <div class="form-group">
                <label for="editPostoPassword_${currentUser.id}">Nova Senha (deixe em branco para não alterar):</label>
                <input type="password" id="editPostoPassword_${currentUser.id}" placeholder="Nova senha" class="form-input">
            </div>
            
            <div class="form-group">
                <label for="editPostoPasswordConfirm_${currentUser.id}">Confirmar Nova Senha:</label>
                <input type="password" id="editPostoPasswordConfirm_${currentUser.id}" placeholder="Confirmar nova senha" class="form-input">
            </div>
        `;
    } else {
        // Formulário para usuário motorista
        html += `
            <div class="form-group">
                <label for="editUserName">Nome Completo:</label>
                <input type="text" id="editUserName" value="${escapeHtml(currentUser.name || '')}" 
                       placeholder="Seu nome" class="form-input">
            </div>
            
            <div class="form-group">
                <label for="editUserEmail">E-mail:</label>
                <input type="email" id="editUserEmail" value="${escapeHtml(currentUser.email || '')}" 
                       placeholder="Seu e-mail" class="form-input">
            </div>
            
            <h3 class="form-section-title">Alterar Senha</h3>
            
            <div class="form-group">
                <label for="editUserCurrentPassword">Senha Atual (necessária para alterar):</label>
                <input type="password" id="editUserCurrentPassword" placeholder="Sua senha atual" class="form-input">
            </div>
            
            <div class="form-group">
                <label for="editUserNewPassword">Nova Senha:</label>
                <input type="password" id="editUserNewPassword" placeholder="Nova senha" class="form-input">
            </div>
            
            <div class="form-group">
                <label for="editUserNewPasswordConfirm">Confirmar Nova Senha:</label>
                <input type="password" id="editUserNewPasswordConfirm" placeholder="Confirmar nova senha" class="form-input">
            </div>
            
            <div class="info-box">
                <i class="fa-solid fa-info-circle"></i>
                <p>Deixe os campos de senha em branco se não quiser alterar.</p>
            </div>
        `;
    }
    
    html += `
        <div class="form-actions">
            <button class="btn-primary" onclick="saveProfileChanges()">
                <i class="fa-solid fa-floppy-disk"></i> Salvar Alterações
            </button>
            <button class="btn-secondary" onclick="showScreen('screenProfile')">
                Cancelar
            </button>
        </div>
    `;
    
    contentElement.innerHTML = html;
    
    // IMPORTANTE: Remover event listener antigo para evitar duplicação
    const selectOnMapBtn = document.getElementById('editPostoSelectOnMap');
    if (selectOnMapBtn) {
        // Substituir o elemento para remover listeners antigos
        const newSelectOnMapBtn = selectOnMapBtn.cloneNode(true);
        selectOnMapBtn.parentNode.replaceChild(newSelectOnMapBtn, selectOnMapBtn);
        
        // Adicionar novo listener
        newSelectOnMapBtn.addEventListener('click', function() {
            console.log('📍 Iniciando seleção de localização para EDIÇÃO...');
            startLocationSelectionForEdit();
        });
    }
    
    console.log('✅ Formulário de edição renderizado com sucesso');
}

function viewCurrentLocationOnMap() {
    if (!currentUser || !currentUser.coords) {
        showToast('❌ Nenhuma localização definida');
        return;
    }
    
    showScreen('main');
    map.setView(currentUser.coords, 16);
    
    // Destacar a localização
    const highlightCircle = L.circle(currentUser.coords, {
        radius: 30,
        color: '#1976d2',
        fillColor: '#1976d2',
        fillOpacity: 0.2,
        weight: 2
    }).addTo(map);
    
    setTimeout(() => {
        if (highlightCircle && map.hasLayer(highlightCircle)) {
            map.removeLayer(highlightCircle);
        }
    }, 3000);
    
    showToast('📍 Visualizando localização atual no mapa');
}

function startLocationSelectionForEdit() {
    console.log('📍 Iniciando seleção de localização para edição...');
    
    // Resetar variável temporária
    window.tempSelectedLocation = null;
    
    // DEFINIR CONTEXTO CLARAMENTE COMO 'edit'
    window.locationSelectionContext = 'edit';
    window.fromCadastro = false; // Garantir que não seja cadastro
    
    selectingLocationForPosto = true;
    
    // Mostrar o mapa principal
    window.preventAutoSaveUser = true;
    showScreen('main');
    
    // Esconder elementos do mapa
    hideAllMapElements();
    
    // Criar botão de voltar para edição (APENAS para edição)
    createBackToEditProfileButton();
    
    // Limpar marcador temporário anterior
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
    
    // Configurar listener do mapa
    if (map && !map._editingLocationListener) {
        map.on('click', onMapClickForEditing);
        map._editingLocationListener = true;
    }
    
    // Centralizar na localização atual
    if (currentUser && currentUser.coords) {
        map.setView(currentUser.coords, 15);
        console.log('📍 Centralizado na localização atual do posto:', currentUser.coords);
    } else if (userLocationMarker) {
        const userCoords = userLocationMarker.getLatLng();
        map.setView(userCoords, 15);
        console.log('📍 Centralizado na localização do usuário:', userCoords);
    }
    
    showToast('📍 Clique no mapa para selecionar a nova localização do posto');
}

function createBackToEditProfileButton() {
    const existingBtn = document.getElementById('backToEditProfileBtn');
    if (existingBtn) existingBtn.remove();

    const backBtn = document.createElement('button');
    backBtn.id = 'backToEditProfileBtn';
    backBtn.innerHTML = '<i class="fa-solid fa-arrow-left"></i> Voltar à Edição';
    backBtn.style.cssText = `
        position: fixed;
        top: 70px;
        left: 10px;
        z-index: 2000;
        background: #1976d2;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 8px;
        font-weight: bold;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        cursor: pointer;
    `;

    backBtn.addEventListener('click', function() {
        // Limpar seleção SEM usar cancelLocationSelection (que remove ambos)
        selectingLocationForPosto = false;
        window.tempSelectedLocation = null;
        
        // Remover listener do mapa
        if (map._editingLocationListener) {
            map.off('click', onMapClickForEditing);
            map._editingLocationListener = false;
        }
        
        // Remover marcador temporário
        if (tempMarker) {
            map.removeLayer(tempMarker);
            tempMarker = null;
        }
        
        // Remover APENAS os botões de edição
        backBtn.remove();
        const cancelBtn = document.getElementById('cancelLocationSelectionBtn');
        if (cancelBtn) cancelBtn.remove();
        
        // Voltar para tela de edição
        showScreen('screenEditProfile');
        showToast('Seleção de localização cancelada');
    });

    // Botão opcional: cancelar seleção (SOMENTE para edição)
    const cancelBtn = document.createElement('button');
    cancelBtn.id = 'cancelLocationSelectionBtn';
    cancelBtn.innerHTML = '<i class="fa-solid fa-times"></i> Cancelar seleção';
    cancelBtn.style.cssText = `
        position: fixed;
        top: 120px;
        left: 10px;
        z-index: 2000;
        background: #e53935;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 8px;
        font-weight: bold;
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        cursor: pointer;
    `;

    cancelBtn.addEventListener('click', function() {
        // Limpar seleção
        selectingLocationForPosto = false;
        window.tempSelectedLocation = null;
        
        // Remover listener do mapa
        if (map._editingLocationListener) {
            map.off('click', onMapClickForEditing);
            map._editingLocationListener = false;
        }
        
        // Remover marcador temporário
        if (tempMarker) {
            map.removeLayer(tempMarker);
            tempMarker = null;
        }
        
        // Remover APENAS os botões de edição
        backBtn.remove();
        cancelBtn.remove();
        
        // Voltar para tela de edição
        showScreen('screenEditProfile');
        showToast('Seleção de localização cancelada');
    });

    document.body.appendChild(backBtn);
    document.body.appendChild(cancelBtn);
}

function changeProfilePhoto() {
    document.getElementById('profilePhotoInput').click();
}

function getSelectedLocationForPosto() {
    console.log('🔍 getSelectedLocationForPosto chamado');
    console.log('- tempSelectedLocation:', window.tempSelectedLocation);
    console.log('- selectedLocationForPosto:', selectedLocationForPosto);
    
    // 1. PRIMEIRO: verificar se há uma localização temporária (seleção recente)
    if (window.tempSelectedLocation && window.tempSelectedLocation.coords) {
        console.log('📍 Usando tempSelectedLocation:', window.tempSelectedLocation);
        return window.tempSelectedLocation;
    }
    
    // 2. Verificar elemento da tela de edição (se tem dados)
    const locInfo = document.getElementById('editPostoLocInfo');
    if (locInfo && locInfo.dataset.lat && locInfo.dataset.lng) {
        console.log('📍 Usando dados do elemento locInfo');
        return {
            lat: parseFloat(locInfo.dataset.lat),
            lng: parseFloat(locInfo.dataset.lng),
            coords: [parseFloat(locInfo.dataset.lat), parseFloat(locInfo.dataset.lng)]
        };
    }
    
    // 3. Para cadastro (usar a global)
    if (selectedLocationForPosto) {
        console.log('📍 Usando selectedLocationForPosto');
        return {
            lat: selectedLocationForPosto.lat,
            lng: selectedLocationForPosto.lng,
            coords: [selectedLocationForPosto.lat, selectedLocationForPosto.lng]
        };
    }
    
    // 4. Usar a localização atual do usuário/posto
    if (currentUser && currentUser.coords) {
        console.log('📍 Usando coords atual do usuário');
        return {
            lat: currentUser.coords[0],
            lng: currentUser.coords[1],
            coords: currentUser.coords
        };
    }
    
    console.warn('⚠️ Nenhuma localização encontrada');
    return null;
}

function handleProfilePhotoChange(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        showToast('❌ Por favor, selecione uma imagem válida');
        return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB
        showToast('❌ A imagem é muito grande (máximo 5MB)');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        // Em uma aplicação real, você faria upload para um servidor
        // Aqui vamos apenas simular com uma URL de dados
        const preview = document.getElementById('profileAvatarPreview');
        if (preview) {
            preview.innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
        }
        
        // Salvar temporariamente para usar ao salvar
        currentUser.tempPhotoData = e.target.result;
        showToast('✅ Foto carregada! Clique em Salvar para aplicar.');
    };
    
    reader.readAsDataURL(file);
}

async function saveProfileChanges() {
    if (!currentUser) {
        showToast('❌ Nenhum usuário logado');
        return;
    }
    
    console.log('💾 Salvando alterações do perfil...');
    
    try {
        if (currentUser.type === 'posto') {
            await savePostoChanges();
        } else {
            await saveUserChanges();
        }
        
        // Atualizar foto de perfil se foi alterada
        if (currentUser.tempPhotoData) {
            currentUser.photoUrl = currentUser.tempPhotoData;
            delete currentUser.tempPhotoData;
        }
        
        await saveData();
        showToast('✅ Perfil atualizado com sucesso!');
        
        // Atualizar a tela de perfil
        renderProfileScreen();
        showScreen('screenProfile');
        
    } catch (error) {
        console.error('❌ Erro ao salvar alterações:', error);
        showToast(`❌ ${error.message || 'Erro ao salvar alterações'}`);
    }
}

async function savePostoChanges() {
    console.log('💾 Salvando alterações do posto...');
    
    try {
        if (!currentUser) {
            throw new Error('Nenhum usuário logado');
        }
        
        // DEBUG: Verificar variáveis
        console.log('🔍 DEBUG - Variáveis de localização:');
        console.log('- window.tempSelectedLocation:', window.tempSelectedLocation);
        console.log('- selectingLocationForPosto:', selectingLocationForPosto);
        console.log('- selectedLocationForPosto:', selectedLocationForPosto);
        
        // 1. OBTER DADOS DO FORMULÁRIO
        const nameInput = document.getElementById(`editPostoName_${currentUser.id}`);
        const cnpjInput = document.getElementById(`editPostoCnpj_${currentUser.id}`);
        const gasPriceInput = document.getElementById(`editPostoGasPrice_${currentUser.id}`);
        const etanolPriceInput = document.getElementById(`editPostoEtanolPrice_${currentUser.id}`);
        const dieselPriceInput = document.getElementById(`editPostoDieselPrice_${currentUser.id}`);
        
        if (!nameInput) {
            throw new Error('Campo de nome não encontrado');
        }
        
        const name = nameInput.value.trim();
        const cnpj = cnpjInput ? cnpjInput.value.trim() : '';
        const gasPrice = gasPriceInput ? gasPriceInput.value.trim() : null;
        const etanolPrice = etanolPriceInput ? etanolPriceInput.value.trim() : null;
        const dieselPrice = dieselPriceInput ? dieselPriceInput.value.trim() : null;
        
        console.log('📝 Dados do formulário:', { name, cnpj, gasPrice, etanolPrice, dieselPrice });
        
        // 2. Obter localização
        const selectedLocation = getSelectedLocationForPosto();
        let newCoords = null;
        
        if (selectedLocation) {
            newCoords = selectedLocation.coords;
            console.log('📍 Localização selecionada para salvar:', newCoords);
        } else {
            // Se não tiver localização selecionada, usar a atual
            const station = gasData.find(s => s.id === currentUser.id);
            if (station && station.coords) {
                newCoords = station.coords;
                console.log('📍 Usando localização atual do posto:', newCoords);
            } else if (currentUser.coords) {
                newCoords = currentUser.coords;
                console.log('📍 Usando localização do usuário:', newCoords);
            } else {
                throw new Error('Localização não definida');
            }
        }
        
        if (!newCoords || !Array.isArray(newCoords) || newCoords.length < 2) {
            throw new Error('Localização inválida');
        }
        
        // 3. Validações
        if (!name) {
            throw new Error('Nome do posto é obrigatório');
        }
        
        // 4. Atualizar dados do usuário
        currentUser.name = name;
        if (cnpj) currentUser.cnpj = cnpj;
        currentUser.coords = newCoords;
        
        // 5. Atualizar posto em gasData
        const stationIndex = gasData.findIndex(s => s.id === currentUser.id);
        let station;
        
        if (stationIndex !== -1) {
            // Atualizar posto existente
            station = gasData[stationIndex];
            station.name = name;
            station.coords = newCoords;
            
            // Atualizar preços se fornecidos
            if (!station.prices) station.prices = {};
            if (gasPrice) station.prices.gas = parseFloat(gasPrice).toFixed(2);
            if (etanolPrice) station.prices.etanol = parseFloat(etanolPrice).toFixed(2);
            if (dieselPrice) station.prices.diesel = parseFloat(dieselPrice).toFixed(2);
            
            // Manter outros dados
            station.isVerified = station.isVerified || true;
            station.trustScore = station.trustScore || 10;
            
            console.log('✅ Posto atualizado:', station);
        } else {
            // Criar novo posto (não deveria acontecer, mas é um fallback)
            station = {
                id: currentUser.id,
                name: name,
                coords: newCoords,
                prices: {
                    gas: gasPrice ? parseFloat(gasPrice).toFixed(2) : null,
                    etanol: etanolPrice ? parseFloat(etanolPrice).toFixed(2) : null,
                    diesel: dieselPrice ? parseFloat(dieselPrice).toFixed(2) : null
                },
                isVerified: true,
                trustScore: 10,
                type: 'posto'
            };
            gasData.push(station);
            console.log('⚠️ Posto não encontrado, criando novo:', station);
        }
        
        // 6. Atualizar no IndexedDB
        if (typeof dbPut === 'function') {
            await dbPut('stations', station);
            await dbPut('users', currentUser);
        }
        
        // 7. Atualizar no array de usuários
        const userIndex = users.findIndex(u => u.id === currentUser.id);
        if (userIndex !== -1) {
            users[userIndex] = currentUser;
        }
        
        // 8. Limpar variáveis temporárias
        window.tempSelectedLocation = null;
        if (tempMarker) {
            map.removeLayer(tempMarker);
            tempMarker = null;
        }
        
        // 9. Renderizar marcadores para mostrar a atualização
        renderAllMarkers();
        
        // 10. Salvar dados
        await saveData();
        
        console.log('✅ Alterações do posto salvas com sucesso');
        return true;
        
    } catch (error) {
        console.error('❌ Erro em savePostoChanges:', error);
        throw error;
    }
}

async function saveUserChanges() {
    console.log('💾 Salvando alterações do usuário...');
    
    try {
        // Verificar se ainda estamos na tela de edição
        const editScreen = document.getElementById('screenEditProfile');
        if (!editScreen || editScreen.classList.contains('hidden')) {
            throw new Error('Tela de edição não está mais visível');
        }
        
        // Obter elementos com verificações de segurança
        const nameElement = document.getElementById('editUserName');
        const emailElement = document.getElementById('editUserEmail');
        const currentPasswordElement = document.getElementById('editUserCurrentPassword');
        const newPasswordElement = document.getElementById('editUserNewPassword');
        const confirmPasswordElement = document.getElementById('editUserNewPasswordConfirm');
        
        if (!nameElement || !emailElement) {
            throw new Error('Campos do formulário não encontrados');
        }
        
        const name = nameElement.value ? nameElement.value.trim() : '';
        const email = emailElement.value ? emailElement.value.trim() : '';
        const currentPassword = currentPasswordElement && currentPasswordElement.value ? currentPasswordElement.value : '';
        const newPassword = newPasswordElement && newPasswordElement.value ? newPasswordElement.value : '';
        const confirmPassword = confirmPasswordElement && confirmPasswordElement.value ? confirmPasswordElement.value : '';
        
        console.log('📝 Dados coletados do usuário:', { name, email });
        
        // Validações
        if (!name || !email) {
            throw new Error('Nome e e-mail são obrigatórios');
        }
        
        if (!email.includes('@') || !email.includes('.')) {
            throw new Error('E-mail inválido');
        }
        
        // Verificar senha atual se tentar alterar senha
        if (newPassword) {
            if (!currentPassword) {
                throw new Error('Digite sua senha atual para alterar a senha');
            }
            
            if (currentUser.password !== currentPassword) {
                throw new Error('Senha atual incorreta');
            }
            
            if (newPassword !== confirmPassword) {
                throw new Error('As novas senhas não coincidem');
            }
            
            if (newPassword.length < 6) {
                throw new Error('A nova senha deve ter pelo menos 6 caracteres');
            }
            
            currentUser.password = newPassword;
        }
        
        // Atualizar dados
        currentUser.name = name;
        currentUser.email = email;
        
        // Atualizar no array de usuários
        const userIndex = users.findIndex(u => u.id === currentUser.id);
        if (userIndex !== -1) {
            users[userIndex] = currentUser;
            
            // Atualizar no IndexedDB
            if (typeof dbPut === 'function') {
                await dbPut('users', currentUser);
            }
        }
        
        console.log('✅ Alterações do usuário salvas com sucesso');
        
    } catch (error) {
        console.error('❌ Erro em saveUserChanges:', error);
        throw error;
    }
}

function manageFocusWhenSwitchingScreens(oldScreenId, newScreenId) {
    // Se estamos saindo da tela de perfil (ou qualquer tela) para o mapa
    if (newScreenId === 'main') {
        // Focar em um elemento seguro do mapa
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            setTimeout(() => searchInput.focus(), 50);
        }
    }
    // Se estamos indo para uma tela (não o mapa)
    else if (newScreenId && newScreenId !== 'main') {
        const newScreen = document.getElementById(newScreenId);
        if (newScreen) {
            setTimeout(() => {
                // Encontrar primeiro elemento interativo
                const focusable = newScreen.querySelector(
                    'button, input, select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (focusable) {
                    focusable.focus();
                } else {
                    // Se não houver elementos focáveis, focar na própria tela
                    newScreen.setAttribute('tabindex', '-1');
                    newScreen.focus();
                }
            }, 100);
        }
    }
}

function cancelLocationSelection() {
    console.log('❌ Cancelando seleção de localização');
    clearLocationSelection();
    showToast('Seleção de localização cancelada');
}

function clearLocationSelection() {
    console.log('🧹 Limpando seleção de localização...');
    
    selectingLocationForPosto = false;
    window.tempSelectedLocation = null;
    window.locationSelectionContext = null;
    window.fromCadastro = false;
    
    if (tempMarker) {
        try {
            map.removeLayer(tempMarker);
        } catch (e) {}
        tempMarker = null;
    }
    
    // Remover botões específicos
    const buttonsToRemove = [
        'backToEditProfileBtn',
        'cancelLocationSelectionBtn',
        'backToCadastroBtn'
    ];
    
    buttonsToRemove.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.remove();
            console.log(`✅ Removido botão: ${id}`);
        }
    });
    
    // Remover listener do mapa
    if (map && map._editingLocationListener) {
        map.off('click', onMapClickForEditing);
        map._editingLocationListener = false;
        console.log('✅ Listener do mapa removido');
    }
}

function showDeleteAccountScreen() {
    if (!currentUser) {
        showToast('❌ Você precisa estar logado para esta ação');
        return;
    }
    
    showScreen('screenDeleteAccount');
    
    // Limpar campo de senha ao mostrar a tela
    setTimeout(() => {
        const passwordInput = document.getElementById('deleteAccountPassword');
        if (passwordInput) {
            passwordInput.value = '';
            passwordInput.focus();
        }
    }, 100);
}

async function confirmDeleteAccount() {
    if (!currentUser) {
        showToast('❌ Nenhum usuário logado');
        return;
    }
    
    const passwordInput = document.getElementById('deleteAccountPassword');
    if (!passwordInput) {
        showToast('❌ Erro: campo de senha não encontrado');
        return;
    }
    
    const password = passwordInput.value.trim();
    
    // Verificar senha
    if (password !== currentUser.password) {
        showToast('❌ Senha incorreta');
        passwordInput.focus();
        return;
    }
    
    // Confirmação final
    if (!confirm(`Tem CERTEZA ABSOLUTA que deseja excluir sua conta?\n\n"${currentUser.name}" será permanentemente removido.`)) {
        showToast('Exclusão cancelada');
        return;
    }
    
    try {
        console.log('🗑️ Iniciando exclusão da conta:', currentUser.id);
        
        // 1. Remover usuário do array users
        const userIndex = users.findIndex(u => u.id === currentUser.id);
        if (userIndex !== -1) {
            users.splice(userIndex, 1);
            console.log('✅ Usuário removido do array users');
        }
        
        // 2. Se for posto, remover do array gasData
        if (currentUser.type === 'posto') {
            const stationIndex = gasData.findIndex(s => s.id === currentUser.id);
            if (stationIndex !== -1) {
                gasData.splice(stationIndex, 1);
                console.log('✅ Posto removido do array gasData');
            }
            
            // 3. Remover do IndexedDB (stations) se disponível
            if (typeof dbDelete === 'function') {
                try {
                    await dbDelete('stations', currentUser.id);
                    console.log('✅ Posto removido do IndexedDB (stations)');
                } catch (error) {
                    console.error('❌ Erro ao remover posto do IndexedDB:', error);
                }
            }
        }
        
        // 4. Remover do IndexedDB (users) se disponível
        if (typeof dbDelete === 'function') {
            try {
                await dbDelete('users', currentUser.id);
                console.log('✅ Usuário removido do IndexedDB (users)');
            } catch (error) {
                console.error('❌ Erro ao remover usuário do IndexedDB:', error);
            }
        }
        
        // 5. Remover comentários do usuário
        await removeUserComments(currentUser.id);
        
        // 6. Fazer logout
        currentUser = null;
        localStorage.removeItem('currentUser');
        
        // 7. Atualizar interface
        updateProfileIcon();
        renderProfileScreen();
        
        // 8. Voltar para tela principal
        setTimeout(() => {
            showScreen('main');
            showToast('✅ Conta removida com sucesso');
        }, 500);
        
    } catch (error) {
        console.error('❌ Erro ao remover conta:', error);
        showToast('❌ Erro ao remover conta. Tente novamente.');
    }
}

async function removeUserComments(userId) {
    try {
        if (!window.stationComments) return;
        
        let commentsRemoved = 0;
        
        // Para cada posto nos comentários
        for (const stationId in stationComments) {
            if (stationComments.hasOwnProperty(stationId)) {
                // Filtrar comentários que NÃO são do usuário sendo removido
                const originalLength = stationComments[stationId].length;
                stationComments[stationId] = stationComments[stationId].filter(
                    comment => comment.user_id !== userId
                );
                
                commentsRemoved += (originalLength - stationComments[stationId].length);
                
                // Se o posto ficou sem comentários, remover do objeto
                if (stationComments[stationId].length === 0) {
                    delete stationComments[stationId];
                }
            }
        }
        
        // Salvar comentários atualizados
        saveCommentsToLocalStorage();
        
        console.log(`🗑️ Removidos ${commentsRemoved} comentários do usuário`);
        
    } catch (error) {
        console.error('❌ Erro ao remover comentários do usuário:', error);
    }
}

window.showEditProfileScreen = showEditProfileScreen;
window.saveProfileChanges = saveProfileChanges;
window.changeProfilePhoto = changeProfilePhoto;
window.handleProfilePhotoChange = handleProfilePhotoChange;
window.startLocationSelectionForEdit = startLocationSelectionForEdit;
window.renderEditProfileScreen = renderEditProfileScreen;
window.manageFocusWhenSwitchingScreens = manageFocusWhenSwitchingScreens;
window.initLoginForm = initLoginForm;
window.equalizeButtonSizes = equalizeButtonSizes;
window.adjustHomeQuickPosition = adjustHomeQuickPosition;
window.hideAllMapElements = hideAllMapElements;
window.createBackToCadastroButton = createBackToCadastroButton;
window.startLocationSelectionForPosto = startLocationSelectionForPosto;
window.createBackToEditProfileButton = createBackToEditProfileButton;
window.goBack = goBack;
window.resetNavigationStack = resetNavigationStack;
window.goToMainScreen = goToMainScreen;
window.showDeleteAccountScreen = showDeleteAccountScreen;
window.confirmDeleteAccount = confirmDeleteAccount;