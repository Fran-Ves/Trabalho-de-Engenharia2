class App {
    constructor() {
        this.database = null;
        this.controllers = {};
        this.currentUser = null;
        this.isInitialized = false;
    }

    async init() {
        try {
            console.log('🚀 Inicializando aplicação...');
            
            // 1. Inicializar banco de dados PRIMEIRO
            // await this.initDatabase();
            
            // 2. Inicializar controladores - SEM restaurar sessão ainda
            await this.initControllers();
            
            // 3. Configurar UI
            this.setupUI();
            
            // 4. Configurar event listeners (simplificado)
            this.setupEventListeners();
            
            // 5. AGORA restaurar sessão (depois de tudo inicializado)
            await this.restoreSession();
            
            this.isInitialized = true;
            console.log('✅ Aplicação inicializada');
            
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            // Mostrar apenas mensagem de erro, não tela de emergência
            Toast.show('Aplicação carregada com limitações');
        }
    }

    async initControllers() {
        console.log('🎯 Inicializando controladores...');
        
        // 1. Inicializar MapController primeiro (CRÍTICO)
        this.controllers.map = new MapController(this.database);
        await this.controllers.map.init();
        
        // 2. Obter referência do mapa
        const map = this.controllers.map.getMap();
        console.log('🗺️ Mapa inicializado:', map ? 'SIM' : 'NÃO');
        
        // 3. Inicializar outros controladores
        this.controllers.auth = new AuthController(this.database);
        this.controllers.station = new StationController(this.database);
        this.controllers.route = new RouteController(this.database);
        this.controllers.driver = new DriverController(this.database);
        
        // 4. Inicializar cada controlador, passando o mapa para RouteController
        await this.controllers.auth.init();
        await this.controllers.station.init();
        
        // RouteController precisa do mapa
        if (map) {
            await this.controllers.route.init(map);
        } else {
            console.error('❌ Mapa não disponível para RouteController');
            await this.controllers.route.init(null);
        }
        
        await this.controllers.driver.init();
        
        console.log('✅ Todos os controladores inicializados');
    }

    setupUI() {
        // Garantir que elementos estejam ocultos inicialmente
        document.querySelectorAll('.screen, .sidebar, .driver-mode-panel')
            .forEach(el => el.classList.add('hidden'));
        
        // Mostrar apenas o mapa inicialmente
        document.getElementById('main').classList.remove('hidden');
        
        // Atualizar ícone do perfil
        this.updateProfileIcon();
    }

    setupEventListeners() {
        // Eventos delegados para melhor performance
        document.addEventListener('click', (e) => {
            this.handleGlobalClick(e);
        });

        // Eventos específicos
        // this.setupButtonEvents();
        // this.setupFormEvents();
        // this.setupMapEvents();
    }

    handleGlobalClick(e) {
        const target = e.target;
        console.log('🖱️ Clicou em:', target.id, target.className);
        
        // Busca
        if (target.id === 'searchBtn' || target.closest('#searchBtn')) {
            this.handleSearch();
        }
        
        // Botão de localização
        if (target.id === 'locationBtn' || target.closest('#locationBtn')) {
            this.controllers.map.toggleLocationTracking();
        }
        
        // PERFIL / LOGIN
        if (target.id === 'profileBtn' || target.closest('#profileBtn')) {
            console.log('👤 Botão perfil clicado');
            if (this.currentUser) {
                console.log('✅ Usuário logado, mostrando perfil');
                UI.showScreen('screenProfile');
                this.renderProfileScreen();
            } else {
                console.log('❌ Usuário não logado, mostrando login');
                UI.showScreen('screenLoginUser');
                this.setupLoginScreen();
            }
        }
        
        // BOTÃO DE ADICIONAR (+)
        if (target.id === 'addBtn' || target.closest('#addBtn')) {
            console.log('➕ Botão adicionar clicado');
            this.handleAddButton();
        }
        
        // Botões da home
        if (target.id === 'homeBuscar' || target.closest('#homeBuscar')) {
            document.getElementById('searchInput')?.focus();
        }
        if (target.id === 'homeTraçar' || target.id === 'sbTracarRotas' || target.closest('#homeTraçar') || target.closest('#sbTracarRotas')) {
            this.controllers.route.startRouteMode();
        }
        if (target.id === 'homeCadastrar' || target.closest('#homeCadastrar')) {
            console.log('🏪 Botão cadastrar posto clicado');
            this.handleAddButton();
        }
        if (target.id === 'homeMotorista' || target.closest('#homeMotorista')) {
            this.controllers.driver.enterDriverMode();
        }
        
        // Botões dentro das telas de login/cadastro
        this.handleScreenButtons(e);
    }

    handleAddButton() {
        console.log('➕ Lidando com botão adicionar');
        if (this.currentUser) {
            // Usuário logado: mostrar opções baseadas no tipo
            if (this.currentUser.type === USER_TYPES.POSTO) {
                // Dono de posto: editar preços
                this.showEditPricesForCurrentStation();
            } else {
                // Usuário comum: cadastrar posto
                UI.showScreen('screenRegisterPosto');
                this.setupPostoRegistrationScreen();
            }
        } else {
            // Usuário não logado: mostrar tela de login
            UI.showScreen('screenLoginUser');
            this.setupLoginScreen();
        }
    }

    handleScreenButtons(e) {
        const target = e.target;
        
        // TELA DE LOGIN
        if (target.id === 'btnLoginUser' || target.closest('#btnLoginUser')) {
            this.switchLoginType('user');
        }
        if (target.id === 'btnLoginPosto' || target.closest('#btnLoginPosto')) {
            this.switchLoginType('posto');
        }
        if (target.id === 'loginUserScreenBtn' || target.closest('#loginUserScreenBtn')) {
            this.submitLogin();
        }
        
        // TELA DE CADASTRO DE USUÁRIO
        if (target.id === 'saveUserScreenBtn' || target.closest('#saveUserScreenBtn')) {
            this.registerUser();
        }
        
        // TELA DE CADASTRO DE POSTO
        if (target.id === 'savePostoScreenBtn' || target.closest('#savePostoScreenBtn')) {
            this.registerPosto();
        }
        if (target.id === 'selectOnMapScreenBtn' || target.closest('#selectOnMapScreenBtn')) {
            this.selectLocationOnMap();
        }
        
        // BOTÃO VOLTAR
        if (target.id === 'topbarBackBtn' || target.closest('#topbarBackBtn')) {
            UI.showScreen('main');
        }
    }

    async handleSearch() {
        const input = document.getElementById('searchInput');
        const query = input?.value.trim();
        
        if (!query) {
            Toast.show('Digite o nome de um posto');
            return;
        }
        
        const stations = await this.controllers.station.search(query);
        if (stations.length === 0) {
            Toast.show(`Nenhum posto encontrado com "${query}"`);
            return;
        }
        
        if (stations.length === 1) {
            this.controllers.map.navigateToStation(stations[0].id);
        } else {
            this.showStationOptions(stations);
        }
        
        input.value = '';
    }

    showStationOptions(stations) {
        // Implementar modal de seleção
        const options = stations.slice(0, 5).map(s => 
            `<li onclick="app.controllers.map.navigateToStation('${s.id}')">
                ${s.name} - R$ ${s.prices?.gas || '--'}
            </li>`
        ).join('');
        
        const modal = document.createElement('div');
        modal.className = 'search-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>${stations.length} postos encontrados</h3>
                <ul>${options}</ul>
                <button onclick="this.closest('.search-modal').remove()">Fechar</button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async restoreSession() {
        try {
            if (this.controllers.auth) {
                // Chame um método específico para restaurar sessão
                await this.controllers.auth.restoreSession();
                this.currentUser = this.controllers.auth.currentUser;
                this.updateProfileIcon();
            }
        } catch (error) {
            console.error('Erro ao restaurar sessão:', error);
        }
    }

    updateProfileIcon() {
        const btn = document.getElementById('profileBtn');
        if (!btn) return;
        
        if (this.currentUser) {
            btn.innerHTML = '<i class="fa-solid fa-user-check"></i>';
            btn.title = 'Meu Perfil (Logado)';
        } else {
            btn.innerHTML = '<i class="fa-solid fa-user"></i>';
            btn.title = 'Entrar / Cadastrar';
        }
    }

    showEmergencyMessage() {
        // Fallback para modo offline básico
        document.body.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <h2>⚠️ Modo Offline</h2>
                <p>O aplicativo está funcionando com recursos limitados.</p>
                <button onclick="location.reload()">Tentar Novamente</button>
            </div>
        `;
    }

    setupLoginScreen() {
        console.log('🖥️ Configurando tela de login');
        
        // Definir botões de tipo de login
        const btnUser = document.getElementById('btnLoginUser');
        const btnPosto = document.getElementById('btnLoginPosto');
        const userFields = document.getElementById('loginUserFields');
        const postoFields = document.getElementById('loginPostoFields');
        
        if (btnUser && btnPosto) {
            // Resetar estado
            btnUser.classList.add('active');
            btnPosto.classList.remove('active');
            if (userFields) userFields.classList.remove('hidden');
            if (postoFields) postoFields.classList.add('hidden');
            
            // Limpar campos
            const emailInput = document.getElementById('loginEmailScreen');
            const passInput = document.getElementById('loginPassScreen');
            const postoNameInput = document.getElementById('loginPostoNameScreen');
            const postoCNPJInput = document.getElementById('loginPostoCnpjScreen');
            
            if (emailInput) emailInput.value = '';
            if (passInput) passInput.value = '';
            if (postoNameInput) postoNameInput.value = '';
            if (postoCNPJInput) postoCNPJInput.value = '';
        }
    }

    switchLoginType(type) {
        console.log('🔄 Mudando tipo de login para:', type);
        
        const btnUser = document.getElementById('btnLoginUser');
        const btnPosto = document.getElementById('btnLoginPosto');
        const userFields = document.getElementById('loginUserFields');
        const postoFields = document.getElementById('loginPostoFields');
        
        if (!btnUser || !btnPosto || !userFields || !postoFields) return;
        
        if (type === 'user') {
            btnUser.classList.add('active');
            btnPosto.classList.remove('active');
            userFields.classList.remove('hidden');
            postoFields.classList.add('hidden');
        } else {
            btnUser.classList.remove('active');
            btnPosto.classList.add('active');
            userFields.classList.add('hidden');
            postoFields.classList.remove('hidden');
        }
    }

    async submitLogin() {
        console.log('🔐 Submetendo login...');
        
        const btnUser = document.getElementById('btnLoginUser');
        const isUserLogin = btnUser?.classList.contains('active');
        
        try {
            if (isUserLogin) {
                // Login de usuário comum
                const email = document.getElementById('loginEmailScreen')?.value;
                const password = document.getElementById('loginPassScreen')?.value;
                
                if (!email || !password) {
                    Toast.show('❌ Preencha todos os campos');
                    return;
                }
                
                console.log('📧 Tentando login com email:', email);
                await this.controllers.auth.login(email, password);
                
            } else {
                // Login de posto
                const name = document.getElementById('loginPostoNameScreen')?.value;
                const cnpj = document.getElementById('loginPostoCnpjScreen')?.value;
                
                if (!name || !cnpj) {
                    Toast.show('❌ Preencha todos os campos');
                    return;
                }
                
                console.log('🏪 Tentando login de posto:', name);
                await this.controllers.auth.loginStation(name, cnpj);
            }
            
            // Atualizar estado da aplicação
            this.currentUser = this.controllers.auth.currentUser;
            this.updateProfileIcon();
            
        } catch (error) {
            console.error('❌ Erro no login:', error);
            // O erro já foi mostrado pelo AuthController
        }
    }

    setupPostoRegistrationScreen() {
        console.log('🏪 Configurando tela de cadastro de posto');
        
        // Limpar campos
        const nameInput = document.getElementById('postoNameScreen');
        const cnpjInput = document.getElementById('postoCnpjScreen');
        const passInput = document.getElementById('postoPassScreen');
        const locInfo = document.getElementById('locInfoScreen');
        
        if (nameInput) nameInput.value = '';
        if (cnpjInput) cnpjInput.value = '';
        if (passInput) passInput.value = '';
        if (locInfo) locInfo.textContent = 'Nenhum local selecionado';
        
        // Resetar localização selecionada
        window.selectedLocationForPosto = null;
    }

    async registerUser() {
        console.log('👤 Registrando novo usuário...');
        
        const name = document.getElementById('userNameScreen')?.value;
        const email = document.getElementById('userEmailScreen')?.value;
        const password = document.getElementById('userPassScreen')?.value;
        
        if (!name || !email || !password) {
            Toast.show('❌ Preencha todos os campos');
            return;
        }
        
        try {
            await this.controllers.auth.registerUser({
                name,
                email,
                password,
                type: USER_TYPES.USER
            });
            
            // Atualizar estado da aplicação
            this.currentUser = this.controllers.auth.currentUser;
            this.updateProfileIcon();
            
        } catch (error) {
            console.error('❌ Erro no cadastro:', error);
        }
    }

    async registerPosto() {
        console.log('🏪 Registrando novo posto...');
        
        const name = document.getElementById('postoNameScreen')?.value;
        const cnpj = document.getElementById('postoCnpjScreen')?.value;
        const password = document.getElementById('postoPassScreen')?.value;
        
        if (!name || !cnpj || !password) {
            Toast.show('❌ Preencha todos os campos');
            return;
        }
        
        // Verificar localização
        if (!window.selectedLocationForPosto) {
            Toast.show('❌ Selecione a localização no mapa');
            return;
        }
        
        try {
            await this.controllers.auth.registerStation({
                name,
                cnpj,
                password,
                coords: [window.selectedLocationForPosto.lat, window.selectedLocationForPosto.lng]
            });
            
            // Atualizar estado da aplicação
            this.currentUser = this.controllers.auth.currentUser;
            this.updateProfileIcon();
            
        } catch (error) {
            console.error('❌ Erro no cadastro do posto:', error);
        }
    }

    selectLocationOnMap() {
        console.log('🗺️ Ativando seleção de localização no mapa...');
        
        // Mostrar o mapa
        UI.showScreen('main');
        
        // Configurar para selecionar localização
        window.selectingLocationForPosto = true;
        
        // Adicionar evento único ao mapa
        const map = this.controllers.map?.map;
        if (!map) {
            Toast.show('❌ Mapa não disponível');
            return;
        }
        
        // Função para lidar com clique no mapa
        const clickHandler = (e) => {
            console.log('📍 Localização selecionada:', e.latlng);
            
            // Salvar localização
            window.selectedLocationForPosto = e.latlng;
            
            // Remover evento
            map.off('click', clickHandler);
            
            // Voltar para tela de cadastro
            UI.showScreen('screenRegisterPosto');
            
            // Atualizar texto de localização
            const locInfo = document.getElementById('locInfoScreen');
            if (locInfo) {
                locInfo.textContent = `Lat: ${e.latlng.lat.toFixed(6)}, Lng: ${e.latlng.lng.toFixed(6)}`;
                locInfo.classList.add('selected');
            }
            
            // Mostrar marcador temporário no mapa
            if (this.controllers.map) {
                // Limpar marcador anterior
                if (window.tempLocationMarker && map.hasLayer(window.tempLocationMarker)) {
                    map.removeLayer(window.tempLocationMarker);
                }
                
                // Adicionar novo marcador
                window.tempLocationMarker = L.marker(e.latlng, {
                    icon: L.divIcon({
                        className: 'temp-marker',
                        html: '<i class="fa-solid fa-map-pin" style="color: #e53935; font-size: 24px;"></i>',
                        iconSize: [24, 24],
                        iconAnchor: [12, 24]
                    })
                }).addTo(map);
            }
            
            Toast.show('✅ Localização selecionada!');
        };
        
        // Adicionar evento
        map.on('click', clickHandler);
        
        // Mostrar instruções
        Toast.show('📍 Clique no mapa para selecionar a localização do posto');
        
        // Adicionar botão para cancelar
        this.showCancelLocationSelection();
    }

    showCancelLocationSelection() {
        // Remover botão anterior se existir
        const existingBtn = document.getElementById('cancelLocationBtn');
        if (existingBtn) existingBtn.remove();
        
        // Criar botão de cancelar
        const cancelBtn = document.createElement('button');
        cancelBtn.id = 'cancelLocationBtn';
        cancelBtn.innerHTML = '<i class="fa-solid fa-times"></i> Cancelar seleção';
        cancelBtn.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: #dc3545;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: bold;
            z-index: 2000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        cancelBtn.addEventListener('click', () => {
            // Remover evento do mapa
            const map = this.controllers.map?.map;
            if (map) {
                map.off('click'); // Remover todos os eventos de clique
            }
            
            // Remover botão
            cancelBtn.remove();
            
            // Limpar estado
            window.selectingLocationForPosto = false;
            
            // Voltar para tela de cadastro
            UI.showScreen('screenRegisterPosto');
            
            Toast.show('❌ Seleção de localização cancelada');
        });
        
        document.body.appendChild(cancelBtn);
    }

    showEditPricesForCurrentStation() {
        const stationId = this.currentUser?.stationId;
        if (!stationId) {
            Toast.show('❌ Nenhum posto associado a esta conta');
            return;
        }
        
        // Mostrar tela de edição de preços
        UI.showScreen('screenEditPrices');
        
        // Carregar dados do posto
        this.loadStationForPriceEdit(stationId);
    }

    async loadStationForPriceEdit(stationId) {
        try {
            const station = await Station.findById(stationId);
            if (station) {
                // Atualizar título
                const title = document.getElementById('editPostoName');
                if (title) title.textContent = station.name;
                
                // Preencher campos de preço
                const gasInput = document.getElementById('priceGas');
                const etanolInput = document.getElementById('priceEtanol');
                const dieselInput = document.getElementById('priceDiesel');
                
                if (gasInput) gasInput.value = station.prices.gas || '';
                if (etanolInput) etanolInput.value = station.prices.etanol || '';
                if (dieselInput) dieselInput.value = station.prices.diesel || '';
                
                // Configurar botão de salvar
                const saveBtn = document.getElementById('savePricesBtn');
                if (saveBtn) {
                    saveBtn.onclick = () => this.saveStationPrices(stationId);
                }
                
                // Configurar botão de cancelar
                const cancelBtn = document.getElementById('cancelPricesBtn');
                if (cancelBtn) {
                    cancelBtn.onclick = () => UI.showScreen('main');
                }
            }
        } catch (error) {
            console.error('❌ Erro ao carregar dados do posto:', error);
            Toast.show('❌ Erro ao carregar dados do posto');
        }
    }

    async saveStationPrices(stationId) {
        const gasPrice = document.getElementById('priceGas')?.value;
        const etanolPrice = document.getElementById('priceEtanol')?.value;
        const dieselPrice = document.getElementById('priceDiesel')?.value;
        
        try {
            const station = await Station.findById(stationId);
            if (!station) {
                throw new Error('Posto não encontrado');
            }
            
            // Atualizar preços
            if (gasPrice) station.updatePrice('gas', gasPrice);
            if (etanolPrice) station.updatePrice('etanol', etanolPrice);
            if (dieselPrice) station.updatePrice('diesel', dieselPrice);
            
            // Salvar alterações
            await station.save();
            
            Toast.show('✅ Preços atualizados com sucesso!');
            UI.showScreen('main');
            
        } catch (error) {
            console.error('❌ Erro ao salvar preços:', error);
            Toast.show('❌ Erro ao atualizar preços');
        }
    }

    renderProfileScreen() {
        console.log('👤 Renderizando tela de perfil...');
        
        const profileContent = document.getElementById('profileContentScreen');
        if (!profileContent) return;
        
        if (!this.currentUser) {
            profileContent.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <p>Nenhum usuário logado</p>
                    <button onclick="app.showLoginScreen()" style="background: #1976d2; color: white; border: none; padding: 10px 20px; border-radius: 5px; margin-top: 10px;">
                        Fazer Login
                    </button>
                </div>
            `;
            return;
        }
        
        const isPosto = this.currentUser.type === USER_TYPES.POSTO;
        
        profileContent.innerHTML = `
            <div class="profile-card">
                <div class="profile-avatar">
                    <i class="fa-solid ${isPosto ? 'fa-gas-pump' : 'fa-user'}"></i>
                </div>
                <div class="profile-info">
                    <h3>${this.currentUser.name}</h3>
                    <p>${isPosto ? 'Posto de Combustível' : 'Usuário'}</p>
                    <p>${this.currentUser.email || ''}</p>
                    ${isPosto && this.currentUser.cnpj ? `<p>CNPJ: ${this.currentUser.cnpj}</p>` : ''}
                    <p><small>Cadastrado em: ${new Date(this.currentUser.createdAt).toLocaleDateString('pt-BR')}</small></p>
                </div>
            </div>
            
            <div class="profile-actions">
                ${isPosto ? `
                    <button onclick="app.showEditPricesForCurrentStation()" style="flex: 1; background: #1976d2; color: white; border: none; padding: 12px; border-radius: 8px;">
                        <i class="fa-solid fa-edit"></i> Editar Preços
                    </button>
                ` : ''}
                
                <button onclick="app.logout()" style="flex: 1; background: #dc3545; color: white; border: none; padding: 12px; border-radius: 8px;">
                    <i class="fa-solid fa-sign-out-alt"></i> Sair
                </button>
            </div>
        `;
    }

    showLoginScreen() {
        UI.showScreen('screenLoginUser');
        this.setupLoginScreen();
    }

    async logout() {
        try {
            await this.controllers.auth.logout();
            this.currentUser = null;
            this.updateProfileIcon();
            UI.showScreen('main');
            Toast.show('👋 Você saiu da conta');
        } catch (error) {
            console.error('❌ Erro ao sair:', error);
        }
    }

}

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', async () => {
    window.app = new App();
    await app.init();
});

window.App = App; // Torna a classe global
console.log('📦 Classe App registrada globalmente');