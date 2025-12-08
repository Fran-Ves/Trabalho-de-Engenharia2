/* auth-sqlite.js — autenticação usando SQLite */
console.log('🔐 Inicializando sistema de autenticação SQLite...');

async function saveUser() {
    const name = document.getElementById('userNameScreen')?.value;
    const email = document.getElementById('userEmailScreen')?.value;
    const password = document.getElementById('userPassScreen')?.value;
    
    if (!name || !email || !password) {
        showToast('❌ Preencha todos os campos');
        return;
    }
    
    // Verificar se email já existe
    const emailExists = users.some(u => u.email === email);
    if (emailExists) {
        showToast('❌ Este e-mail já está cadastrado');
        return;
    }
    
    const newUser = {
        id: 'user_' + Date.now(),
        name,
        email,
        password,
        type: 'user',
        createdAt: Date.now()
    };
    
    // Adicionar ao array local
    users.push(newUser);
    
    // Adicionar ao SQLite
    if (window.sqlDB && sqlDB.initialized) {
        await sqlDB.addUser(newUser);
    }
    
    await saveData();
    showToast('✅ Usuário cadastrado com sucesso!');
    goToMainScreen();
}

async function savePosto() {
    const name = document.getElementById('postoNameScreen')?.value;
    const cnpj = document.getElementById('postoCnpjScreen')?.value;
    const password = document.getElementById('postoPassScreen')?.value;
    
    let coords = null;
    
    // Usar localização selecionada
    if (selectedLocationForPosto) {
        coords = [selectedLocationForPosto.lat, selectedLocationForPosto.lng];
    } else if (tempMarker) {
        const latLng = tempMarker.getLatLng();
        coords = [latLng.lat, latLng.lng];
    }
    
    if (!name || !coords || !password) {
        showToast('❌ Nome, Localização e Senha são obrigatórios');
        return;
    }
    
    // Verificar se CNPJ já existe (se fornecido)
    if (cnpj && cnpj.trim() !== '') {
        const cnpjExists = gasData.some(s => s.cnpj === cnpj);
        if (cnpjExists) {
            showToast('❌ Este CNPJ já está cadastrado');
            return;
        }
    }
    
    const newPosto = {
        id: 'posto_' + Date.now(),
        name,
        cnpj: cnpj || '',
        password,
        coords,
        type: 'posto',
        prices: { gas: null, etanol: null, diesel: null },
        isVerified: true,
        trustScore: 10,
        pendingChanges: [],
        createdAt: Date.now()
    };
    
    // Adicionar ao array local
    gasData.push(newPosto);
    
    // Adicionar ao SQLite
    if (window.sqlDB && sqlDB.initialized) {
        await sqlDB.addStation(newPosto);
    }
    
    // Criar usuário correspondente com TODOS os campos necessários
    const postoUser = {
        id: newPosto.id,
        name: newPosto.name,
        email: null, // Mudar de '' para null
        password: newPosto.password,
        cnpj: newPosto.cnpj,
        coords: newPosto.coords,
        type: 'posto',
        photoUrl: '',
        createdAt: Date.now()
    };
    
    users.push(postoUser);
    
    // Salvar no SQLite
    if (window.sqlDB && sqlDB.initialized) {
        await sqlDB.addUser(postoUser);
    }
    
    await saveData();
    renderAllMarkers();
    showToast('✅ Posto cadastrado! Agora você pode fazer login.');
    goToMainScreen();
    
    // Limpar variáveis
    selectingLocationForPosto = false;
    selectedLocationForPosto = null;
    
    if (tempMarker) {
        map.removeLayer(tempMarker);
        tempMarker = null;
    }
    
    // Limpar campos
    document.getElementById('postoNameScreen').value = '';
    document.getElementById('postoCnpjScreen').value = '';
    document.getElementById('postoPassScreen').value = '';
    document.getElementById('locInfoScreen').textContent = 'Nenhum local selecionado';
    document.getElementById('locInfoScreen').style.color = '';
    document.getElementById('locInfoScreen').style.fontWeight = '';
}

function handleLogin() {
    const userFields = document.getElementById('loginUserFields');
    const isUserForm = userFields && !userFields.classList.contains('hidden');
    
    let foundEntity = null;
    
    if (isUserForm) {
        const emailInput = document.getElementById('loginEmailScreen')?.value;
        const passwordInput = document.getElementById('loginPassScreen')?.value;
        
        if (!emailInput || !passwordInput) {
            showToast('❌ Preencha e-mail e senha');
            return;
        }
        
        foundEntity = users.find(u => u.email === emailInput && u.password === passwordInput);
    } else {
        const nameInput = document.getElementById('loginPostoNameScreen')?.value;
        const cnpjInput = document.getElementById('loginPostoCnpjScreen')?.value;
        
        if (!nameInput) {
            showToast('❌ Preencha o nome do posto');
            return;
        }
        
        // Buscar por nome OU CNPJ
        foundEntity = gasData.find(p => 
            (p.name === nameInput) && 
            (!cnpjInput || p.cnpj === cnpjInput)
        );
        
        // Se encontrou o posto, buscar usuário correspondente
        if (foundEntity) {
            const user = users.find(u => u.id === foundEntity.id);
            if (user) {
                foundEntity = user;
            }
        }
    }
    
    if (foundEntity) {
        currentUser = foundEntity;
        
        // Sincronizar dados se for posto
        if (currentUser.type === 'posto') {
            syncPostoWithCurrentUser();
        }
        
        saveData();
        updateProfileIcon();
        
        const welcomeName = currentUser.type === 'posto' ? 
            currentUser.name : (currentUser.name || '').split(' ')[0];
        
        showToast(`✅ Bem-vindo, ${welcomeName || 'Usuário'}!`);
        goToMainScreen();
    } else {
        showToast('❌ Credenciais inválidas');
    }
}

function switchLoginForm(formType) {
    const userFields = document.getElementById('loginUserFields');
    const postoFields = document.getElementById('loginPostoFields');
    const btnLoginUser = document.getElementById('btnLoginUser');
    const btnLoginPosto = document.getElementById('btnLoginPosto');
    
    if (!userFields || !postoFields || !btnLoginUser || !btnLoginPosto) return;
    
    const isUserForm = formType === 'user';
    
    if (isUserForm) {
        userFields.classList.remove('hidden');
        postoFields.classList.add('hidden');
        btnLoginUser.classList.add('active');
        btnLoginPosto.classList.remove('active');
        
        // Limpar campos do posto
        document.getElementById('loginPostoNameScreen').value = '';
        document.getElementById('loginPostoCnpjScreen').value = '';
    } else {
        userFields.classList.add('hidden');
        postoFields.classList.remove('hidden');
        btnLoginUser.classList.remove('active');
        btnLoginPosto.classList.add('active');
        
        // Limpar campos do usuário
        document.getElementById('loginEmailScreen').value = '';
        document.getElementById('loginPassScreen').value = '';
    }
    
    console.log(`🔄 Formulário alterado para: ${isUserForm ? 'Usuário' : 'Posto'}`);
}

function initLoginScreen() {
    switchLoginForm('user');
    
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
}

// Exportar funções globais
window.saveUser = saveUser;
window.savePosto = savePosto;
window.handleLogin = handleLogin;
window.switchLoginForm = switchLoginForm;
window.initLoginScreen = initLoginScreen;

console.log('✅ Sistema de autenticação SQLite pronto');