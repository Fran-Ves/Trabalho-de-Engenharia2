/* auth.js — registro, login e controle de sessão */
function saveUser() {
    const name = document.getElementById('userNameScreen')?.value;
    const email = document.getElementById('userEmailScreen')?.value;
    const password = document.getElementById('userPassScreen')?.value;

    if (!name || !email || !password) {
        showToast('❌ Preencha todos os campos');
        return;
    }

    const newUser = { id: 'user_' + Date.now(), name, email, password, type: 'user' };
    users.push(newUser);
    saveData();
    showToast('✅ Usuário cadastrado com sucesso!');
    hideScreen('screenRegisterUser');
}

function savePosto() {
    const name = document.getElementById('postoNameScreen')?.value;
    const cnpj = document.getElementById('postoCnpjScreen')?.value;
    const password = document.getElementById('postoPassScreen')?.value || prompt("Defina uma senha para este posto:");

    let coords = null;
    if (tempMarker) {
        const latLng = tempMarker.getLatLng();
        coords = [latLng.lat, latLng.lng];
    }

    if (!name || !coords || !password) {
        showToast('❌ Nome, Localização e Senha são obrigatórios');
        return;
    }

    const newPosto = {
        id: 'posto_' + Date.now(),
        name, cnpj, password,
        coords, type: 'posto',
        prices: { gas: null, etanol: null, diesel: null },
        isVerified: true,
        trustScore: 10
    };

    gasData.push(newPosto);
    saveData();
    renderAllMarkers();
    showToast('✅ Posto cadastrado! Agora você pode fazer login.');
    hideScreen('screenRegisterPosto');

    if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
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
        saveData();
        updateProfileIcon();
        const welcomeName = currentUser.type === 'posto' ? currentUser.name : (currentUser.name || '').split(' ')[0];
        showToast(`✅ Bem-vindo, ${welcomeName || 'Usuário'}!`);
        hideScreen('screenLoginUser');

        if (currentUser.type === 'posto') {
            setTimeout(() => {
                if (confirm("Deseja atualizar os preços do seu posto agora?")) {
                    promptNewPrice(currentUser.id);
                }
            }, 500);
        }
    } else {
        showToast('❌ Credenciais inválidas');
    }
}

function switchLoginForm(isUser) {
    const userFields = document.getElementById('loginUserFields');
    const postoFields = document.getElementById('loginPostoFields');

    if (!userFields || !postoFields) return;
    if (isUser) {
        userFields.classList.remove('hidden');
        postoFields.classList.add('hidden');
    } else {
        userFields.classList.add('hidden');
        postoFields.classList.remove('hidden');
    }
}
