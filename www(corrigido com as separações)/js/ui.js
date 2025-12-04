/* ui.js — funções que controlam telas, sidebar e perfil (sem anexar listeners repetidos) */

let selectedLocationForPosto = null; 

function setupUI() {
    console.log('🎨 Configurando UI...');
    
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
    const screen = document.getElementById(screenId);
    
    if (screen) {
        screen.classList.remove('hidden');
        screen.setAttribute('aria-hidden', 'false');
        previousScreenId = currentScreenId;
        currentScreenId = screenId;

        // Gerenciar botão de voltar
        const backBtn = document.getElementById('topbarBackBtn');
        if (backBtn) {
            if (screenId === 'main') {
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
    }
}

function hideScreen(screenId) {
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('hidden');
        screen.setAttribute('aria-hidden', 'true');
    }
    
    // Sempre voltar para o mapa principal
    showScreen('main');
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
                ${isPosto ? 
                    `<button class="big-btn" style="background:#e65100" onclick="promptNewPrice('${currentUser.id}')">
                        <i class="fa-solid fa-tag"></i> Atualizar Meus Preços
                     </button>` 
                    : 
                    `<button onclick="showToast('Histórico em breve...')">Ver Histórico</button>`
                }
                <button class="btn-secondary" onclick="logout()" style="margin-top:10px;">Sair da Conta</button>
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
    currentUser = null;
    saveData();
    updateProfileIcon();
    showToast('✅ Você saiu da conta');
    renderProfileScreen();
}

function startLocationSelectionForPosto() {
    selectingLocationForPosto = true;
    selectedLocationForPosto = null;
    
    // Esconder todos os elementos do mapa
    hideAllMapElements();
    
    // Criar botão de retorno
    createBackToCadastroButton();
    
    // Mostrar mensagem
    showToast('📍 Clique no mapa para selecionar a localização do posto');
}

function finishLocationSelection(latlng) {
    selectingLocationForPosto = false;
    selectedLocationForPosto = latlng;
    
    // Atualizar o campo na tela de cadastro
    const locInfo = document.getElementById('locInfoScreen');
    if (locInfo) {
        locInfo.textContent = `Lat: ${latlng.lat.toFixed(5)}, Lng: ${latlng.lng.toFixed(5)}`;
        locInfo.style.color = '#1976d2';
        locInfo.style.fontWeight = 'bold';
    }
    
    // Limpar marcador temporário se existir
    if (tempMarker) {
        map.removeLayer(tempMarker);
    }
    
    // Adicionar novo marcador
    tempMarker = L.marker(latlng, {
        icon: L.divIcon({
            className: 'temp-marker',
            html: '<i class="fa-solid fa-map-pin" style="color: #e53935; font-size: 24px;"></i>',
            iconSize: [24, 24],
            iconAnchor: [12, 24]
        })
    }).addTo(map);
    
    // Voltar para a tela de cadastro
    showScreen('screenRegisterPosto');
}

function finishLocationSelection(latlng) {
    console.log('📍 Finalizando seleção de localização:', latlng);
    
    selectingLocationForPosto = false;
    selectedLocationForPosto = latlng;
    
    // Atualizar o campo na tela de cadastro
    const locInfo = document.getElementById('locInfoScreen');
    if (locInfo) {
        locInfo.textContent = `Lat: ${latlng.lat.toFixed(5)}, Lng: ${latlng.lng.toFixed(5)}`;
        locInfo.style.color = '#1976d2';
        locInfo.style.fontWeight = 'bold';
        locInfo.classList.add('selected');
    }
    
    // Limpar marcador temporário se existir
    if (tempMarker) {
        map.removeLayer(tempMarker);
    }
    
    // Adicionar novo marcador
    tempMarker = L.marker(latlng, {
        icon: L.divIcon({
            className: 'temp-marker',
            html: '<i class="fa-solid fa-map-pin" style="color: #e53935; font-size: 24px;"></i>',
            iconSize: [24, 24],
            iconAnchor: [12, 24]
        })
    }).addTo(map);
    
    // IMPORTANTE: Forçar retorno à tela de cadastro
    console.log('🔄 Voltando para tela de cadastro...');
    
    // Pequeno delay para garantir que o DOM esteja pronto
    setTimeout(() => {
        showScreen('screenRegisterPosto');
        showToast('✅ Localização selecionada! Complete os outros dados.');
    }, 100);
}

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
        showScreen('screenRegisterPosto');
        backBtn.remove();
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