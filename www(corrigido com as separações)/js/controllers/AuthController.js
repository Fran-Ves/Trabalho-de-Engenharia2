const USER_TYPES = window.USER_TYPES;

class AuthController {
    constructor(database) {
        this.database = database;
        this.currentUser = null;
    }

    async init() {
        return Promise.resolve();
    }

    async restoreSession() {
        try {
            // VERIFIQUE se a store existe antes de acessar
            if (!this.database.db || !this.database.db.objectStoreNames.contains('sessions')) {
                console.log('⚠️ Store de sessões não disponível');
                return;
            }
            
            const session = await this.database.get('sessions', 'currentUser');
            if (session) {
                this.currentUser = new User(session.data);
                console.log('✅ Sessão restaurada:', this.currentUser.name);
            }
        } catch (error) {
            console.error('⚠️ Erro ao restaurar sessão (não crítico):', error);
            // Não lançar erro, apenas continuar sem sessão
        }
    }

    async registerUser(userData) {
        try {
            // Verificar se email já existe
            const existingUser = await User.findByEmail(userData.email);
            if (existingUser) {
                throw new Error('Este email já está cadastrado');
            }
            
            const user = await User.create(userData);
            await this.login(user.email, userData.password);
            
            Toast.show('✅ Cadastro realizado com sucesso!');
            UI.showScreen('main');
            
            return user;
        } catch (error) {
            console.error('Erro no cadastro:', error);
            Toast.show(`❌ ${error.message}`);
            throw error;
        }
    }

    async registerStation(stationData) {
        try {
            // Verificar se já existe posto com este CNPJ
            const users = await User.findAll();
            const existingStation = users.find(u => 
                u.type === USER_TYPES.POSTO && u.cnpj === stationData.cnpj
            );
            
            if (existingStation) {
                throw new Error('Já existe um posto cadastrado com este CNPJ');
            }
            
            // Criar o posto como uma estação
            const station = await Station.create({
                name: stationData.name,
                cnpj: stationData.cnpj,
                coords: stationData.coords,
                isVerified: true,
                trustScore: 10
            });
            
            // Criar usuário do tipo posto
            const user = await User.create({
                name: stationData.name,
                email: stationData.email || `${stationData.cnpj}@posto.com`,
                password: stationData.password,
                type: USER_TYPES.POSTO,
                cnpj: stationData.cnpj,
                stationId: station.id
            });
            
            await this.login(user.email, stationData.password);
            
            Toast.show('✅ Posto cadastrado com sucesso!');
            UI.showScreen('main');
            
            return { user, station };
        } catch (error) {
            console.error('Erro no cadastro do posto:', error);
            Toast.show(`❌ ${error.message}`);
            throw error;
        }
    }

    async login(email, password) {
        try {
            const user = await User.findByEmail(email);
            
            if (!user) {
                throw new Error('Email não encontrado');
            }
            
            if (!user.checkPassword(password)) {
                throw new Error('Senha incorreta');
            }
            
            this.currentUser = user;
            await this.database.setCurrentUser(user.toJSON());
            this.updateProfileIcon();
            
            const welcomeName = user.type === USER_TYPES.POSTO ? 
                user.name : user.name.split(' ')[0];
            
            Toast.show(`✅ Bem-vindo, ${welcomeName}!`);
            UI.showScreen('main');
            
            // Se for posto, perguntar se quer atualizar preços
            if (user.type === USER_TYPES.POSTO && user.stationId) {
                setTimeout(() => {
                    if (confirm("Deseja atualizar os preços do seu posto agora?")) {
                        window.app?.controllers?.station?.promptUpdatePrice(user.stationId);
                    }
                }, 500);
            }
            
            return user;
        } catch (error) {
            console.error('Erro no login:', error);
            Toast.show(`❌ ${error.message}`);
            throw error;
        }
    }

    async loginStation(name, cnpj) {
        try {
            const users = await User.findAll();
            const user = users.find(u => 
                u.type === USER_TYPES.POSTO && 
                u.name === name && 
                u.cnpj === cnpj
            );
            
            if (!user) {
                throw new Error('Posto não encontrado');
            }
            
            this.currentUser = user;
            await this.database.setCurrentUser(user.toJSON());
            this.updateProfileIcon();
            
            Toast.show(`✅ Bem-vindo, ${user.name}!`);
            UI.showScreen('main');
            
            // Perguntar se quer atualizar preços
            if (user.stationId) {
                setTimeout(() => {
                    if (confirm("Deseja atualizar os preços do seu posto agora?")) {
                        window.app?.controllers?.station?.promptUpdatePrice(user.stationId);
                    }
                }, 500);
            }
            
            return user;
        } catch (error) {
            console.error('Erro no login do posto:', error);
            Toast.show(`❌ ${error.message}`);
            throw error;
        }
    }

    async logout() {
        this.currentUser = null;
        await this.database.clearCurrentUser();
        this.updateProfileIcon();
        
        Toast.show('👋 Você saiu da conta');
        UI.showScreen('main');
    }

    updateProfileIcon() {
        const btn = document.getElementById('profileBtn');
        if (!btn) return;
        
        btn.innerHTML = this.currentUser ? 
            '<i class="fa-solid fa-user-check"></i>' : 
            '<i class="fa-solid fa-user"></i>';
    }

    isLoggedIn() {
        return !!this.currentUser;
    }

    isStationOwner() {
        return this.currentUser?.type === USER_TYPES.POSTO;
    }

    getCurrentUserStationId() {
        return this.currentUser?.stationId;
    }
}

window.AuthController = AuthController;