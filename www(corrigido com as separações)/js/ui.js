/* ui.js — funções que controlam telas, sidebar e perfil (sem anexar listeners repetidos) */

function setupUI() {
    console.log('🎨 Configurando UI...');
    hideAllScreens();

    const homeQuick = document.getElementById('homeQuick');
    if (homeQuick) homeQuick.classList.remove('hidden');

    const backBtn = document.getElementById('topbarBackBtn');
    if (backBtn) backBtn.classList.add('hidden');

    updateProfileIcon();
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

        const backBtn = document.getElementById('topbarBackBtn');
        if (backBtn) {
            if (screenId === 'main') backBtn.classList.add('hidden');
            else backBtn.classList.remove('hidden');
        }
    }
}

function hideScreen(screenId) {
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('hidden');
        screen.setAttribute('aria-hidden', 'true');
    }
    showScreen('main');
}

function adjustHomeButtonsForSidebar(sidebarOpen) {
    const homeQuick = document.getElementById('homeQuick');
    if (!homeQuick) return;
    if (sidebarOpen) homeQuick.classList.add('sidebar-open');
    else homeQuick.classList.remove('sidebar-open');
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
