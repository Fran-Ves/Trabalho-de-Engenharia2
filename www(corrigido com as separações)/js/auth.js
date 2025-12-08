/* auth.js — registro, login e controle de sessão */
async function saveUser() {
    const name = document.getElementById('userNameScreen')?.value;
    const email = document.getElementById('userEmailScreen')?.value;
    const password = document.getElementById('userPassScreen')?.value;
  
    if (!name || !email || !password) {
      showToast('❌ Preencha todos os campos');
      return;
    }
  
    const newUser = { 
      id: 'user_' + Date.now(), 
      name, 
      email, 
      password, 
      type: 'user' 
    };
    
    // Adicionar ao array local
    users.push(newUser);
    
    // Adicionar ao IndexedDB se disponível
    if (typeof dbPut === 'function') {
      await dbPut('users', newUser);
    }
    
    await saveData();
    showToast('✅ Usuário cadastrado com sucesso!');
    goToMainScreen();
    if (firebaseSync && firebaseSync.currentFirebaseUser) {
        setTimeout(() => {
            firebaseSync.syncStationToFirebase(newPosto);
        }, 1000);
    }
  }

  async function savePosto() {
    const name = document.getElementById('postoNameScreen')?.value;
    const cnpj = document.getElementById('postoCnpjScreen')?.value;
    const password = document.getElementById('postoPassScreen')?.value;
    
    let coords = null;
    
    // Usar a localização selecionada
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
    
    const newPosto = {
        id: 'posto_' + Date.now(),
        name, 
        cnpj, 
        password,
        coords, 
        type: 'posto',
        prices: { gas: null, etanol: null, diesel: null },
        isVerified: true,
        trustScore: 10,
        pendingChanges: []
    };
    
    // Adicionar ao array local
    gasData.push(newPosto);
    
    // Adicionar ao IndexedDB se disponível
    if (typeof dbPut === 'function') {
        try {
            await dbPut('stations', newPosto);
        } catch (error) {
            console.error('❌ Erro ao salvar no IndexedDB:', error);
        }
    }
    
    await saveData();
    renderAllMarkers();
    showToast('✅ Posto cadastrado! Agora você pode fazer login.');
    goToMainScreen();

    if (firebaseSync && firebaseSync.currentFirebaseUser) {
        setTimeout(() => {
            firebaseSync.syncStationToFirebase(newPosto);
        }, 1000);
    }
    
    // Limpar variáveis de seleção
    selectingLocationForPosto = false;
    selectedLocationForPosto = null;
    
    if (tempMarker) { 
        map.removeLayer(tempMarker); 
        tempMarker = null; 
    }
    
    // Limpar campos do formulário
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
        if (!emailInput || !passwordInput) { showToast('❌ Preencha e-mail e senha'); return; }
        foundEntity = users.find(u => u.email === emailInput && u.password === passwordInput);
    } else {
        const nameInput = document.getElementById('loginPostoNameScreen')?.value;
        const cnpjInput = document.getElementById('loginPostoCnpjScreen')?.value;
        if (!nameInput || !cnpjInput) { showToast('❌ Preencha nome e CNPJ do posto'); return; }
        foundEntity = gasData.find(p => p.name === nameInput && p.cnpj === cnpjInput);
    }

    if (foundEntity) {
        currentUser = foundEntity;
        if (!currentUser.type) currentUser.type = foundEntity.cnpj ? 'posto' : 'user';
        
        // Sincronizar dados se for posto
        if (currentUser.type === 'posto') {
            setTimeout(() => {
                syncPostoWithCurrentUser();
            }, 100);
        }
        
        saveData();
        updateProfileIcon();
        const welcomeName = currentUser.type === 'posto' ? currentUser.name : (currentUser.name || '').split(' ')[0];
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

    // Determinar qual formulário mostrar
    const isUserForm = formType === 'user';
    
    if (isUserForm) {
        // Mostrar formulário de usuário
        userFields.classList.remove('hidden');
        postoFields.classList.add('hidden');
        
        // Atualizar botões de escolha
        btnLoginUser.classList.add('active');
        btnLoginPosto.classList.remove('active');
        
        // Limpar campos do formulário de posto (opcional)
        document.getElementById('loginPostoNameScreen').value = '';
        document.getElementById('loginPostoCnpjScreen').value = '';
    } else {
        // Mostrar formulário de posto
        userFields.classList.add('hidden');
        postoFields.classList.remove('hidden');
        
        // Atualizar botões de escolha
        btnLoginUser.classList.remove('active');
        btnLoginPosto.classList.add('active');
        
        // Limpar campos do formulário de usuário (opcional)
        document.getElementById('loginEmailScreen').value = '';
        document.getElementById('loginPassScreen').value = '';
    }
    
    console.log(`🔄 Formulário alterado para: ${isUserForm ? 'Usuário' : 'Posto'}`);
}

function initLoginScreen() {
    // Garantir que o formulário de usuário esteja ativo por padrão
    switchLoginForm('user');
    
    // Adicionar event listeners para os botões de escolha
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

// Inicializar quando a tela de login for mostrada
window.addEventListener('DOMContentLoaded', function() {
    // Verificar se estamos na tela de login e inicializar
    if (document.getElementById('screenLoginUser')) {
        initLoginScreen();
    }
});