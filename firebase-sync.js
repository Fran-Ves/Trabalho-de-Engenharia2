/* firebase-sync.js - Sistema de sincronização para Firebase 8.x */
console.log('🔄 Inicializando Firebase Sync (v8.x)...');

class FirebaseSync {
    constructor() {
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.lastSync = localStorage.getItem('lastFirebaseSync') || 0;
        this.currentFirebaseUser = null;
        
        // Inicializar
        this.init();
    }
    
    init() {
        // Verificar se Firebase está disponível
        if (!this.isFirebaseAvailable()) {
            console.log('⚠️ Firebase não disponível para sincronização');
            return;
        }
        
        // Inicializar Firebase se não estiver
        if (!firebase.apps.length) {
            console.warn('⚠️ Firebase não inicializado, tentando...');
            if (typeof initializeFirebase === 'function') {
                initializeFirebase();
            }
        }
        
        // Configurar listeners de rede
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Configurar listener de autenticação
        this.setupAuthListener();
        
        console.log('✅ Firebase Sync inicializado (v8.x)');
    }
    
    isFirebaseAvailable() {
        return typeof firebase !== 'undefined' && 
               firebase.auth && 
               firebase.firestore;
    }
    
    setupAuthListener() {
        if (!this.isFirebaseAvailable()) return;
        
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                console.log('👤 Usuário Firebase autenticado:', user.email);
                this.currentFirebaseUser = user;
                
                // Iniciar sincronização
                setTimeout(() => this.syncAllData(), 1000);
                
                // Configurar listeners em tempo real
                this.setupRealtimeListeners();
            } else {
                console.log('👤 Nenhum usuário Firebase autenticado');
                this.currentFirebaseUser = null;
            }
        });
    }
    
    handleOnline() {
        console.log('🌐 Online - verificando sincronização...');
        this.isOnline = true;
        
        if (this.currentFirebaseUser) {
            this.syncAllData();
        }
    }
    
    handleOffline() {
        console.log('📴 Offline - modo local ativado');
        this.isOnline = false;
    }
    
    // ========== AUTENTICAÇÃO ==========
    async signIn(email, password) {
        if (!this.isFirebaseAvailable()) {
            throw new Error('Firebase não disponível');
        }
        
        try {
            const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
            console.log('✅ Login Firebase bem-sucedido');
            return userCredential.user;
        } catch (error) {
            console.error('❌ Erro login Firebase:', error.message);
            throw error;
        }
    }
    
    async signUp(email, password, name) {
        if (!this.isFirebaseAvailable()) {
            throw new Error('Firebase não disponível');
        }
        
        try {
            const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
            
            // Atualizar perfil
            await userCredential.user.updateProfile({
                displayName: name
            });
            
            // Salvar dados do usuário no Firestore
            await firebase.firestore().collection('users').doc(userCredential.user.uid).set({
                name: name,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                type: 'user',
                localUserId: currentUser ? currentUser.id : null
            });
            
            console.log('✅ Cadastro Firebase bem-sucedido');
            return userCredential.user;
            
        } catch (error) {
            console.error('❌ Erro cadastro Firebase:', error.message);
            throw error;
        }
    }
    
    async signOut() {
        if (!this.isFirebaseAvailable()) return;
        
        try {
            await firebase.auth().signOut();
            this.currentFirebaseUser = null;
            console.log('✅ Logout Firebase');
        } catch (error) {
            console.error('❌ Erro logout:', error);
        }
    }
    
    // ========== SINCRONIZAÇÃO BÁSICA ==========
    async syncAllData() {
        if (!this.isOnline || !this.currentFirebaseUser || this.syncInProgress) {
            return;
        }
        
        this.syncInProgress = true;
        console.log('🔄 Iniciando sincronização...');
        
        try {
            // Enviar dados locais para Firebase
            await this.pushLocalToFirebase();
            
            // Baixar dados do Firebase
            await this.pullFromFirebase();
            
            this.lastSync = Date.now();
            localStorage.setItem('lastFirebaseSync', this.lastSync);
            
            console.log('✅ Sincronização completa');
            showToast('✅ Dados sincronizados');
            
        } catch (error) {
            console.error('❌ Erro na sincronização:', error);
            showToast('❌ Falha na sincronização');
        } finally {
            this.syncInProgress = false;
        }
    }
    
    async pushLocalToFirebase() {
        console.log('📤 Enviando dados locais...');
        
        // Enviar estações
        for (const station of gasData) {
            await this.syncStationToFirebase(station);
        }
        
        // Enviar usuários (apenas não anônimos)
        const nonAnonymousUsers = users.filter(u => !u.id.startsWith('anon_') && !u.id.startsWith('user_'));
        for (const user of nonAnonymousUsers) {
            await this.syncUserToFirebase(user);
        }
    }
    
    async pullFromFirebase() {
        console.log('📥 Baixando dados do Firebase...');
        
        try {
            // Baixar estações
            const stationsSnapshot = await firebase.firestore()
                .collection('stations')
                .get();
            
            stationsSnapshot.forEach(doc => {
                this.syncStationFromFirebase(doc.id, doc.data());
            });
            
            console.log(`📥 ${stationsSnapshot.size} estações baixadas`);
            
        } catch (error) {
            console.error('❌ Erro ao baixar do Firebase:', error);
        }
    }
    
    // ========== SINCRONIZAÇÃO DE ESTAÇÕES ==========
    async syncStationToFirebase(station) {
        try {
            if (!station.id) return;
            
            const stationRef = firebase.firestore().collection('stations').doc(station.id);
            const stationData = {
                name: station.name || '',
                coords: station.coords || [],
                prices: station.prices || {},
                isVerified: !!station.isVerified,
                trustScore: station.trustScore || 5.0,
                type: station.type || 'posto',
                cnpj: station.cnpj || '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLocalUpdate: Date.now()
            };
            
            const doc = await stationRef.get();
            
            if (!doc.exists) {
                // Nova estação
                stationData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                stationData.createdBy = this.currentFirebaseUser ? this.currentFirebaseUser.uid : 'unknown';
                await stationRef.set(stationData);
                console.log(`➕ Estação enviada: ${station.name}`);
            } else {
                // Atualizar se necessário
                const fbData = doc.data();
                const localUpdateTime = stationData.lastLocalUpdate;
                const fbUpdateTime = fbData.lastLocalUpdate || 0;
                
                if (localUpdateTime > fbUpdateTime) {
                    await stationRef.update(stationData);
                    console.log(`✏️ Estação atualizada: ${station.name}`);
                }
            }
            
        } catch (error) {
            console.error(`❌ Erro ao sincronizar estação:`, error);
        }
    }
    
    syncStationFromFirebase(docId, data) {
        try {
            const localStation = {
                id: docId,
                name: data.name,
                coords: data.coords,
                prices: data.prices || {},
                isVerified: data.isVerified || false,
                trustScore: data.trustScore || 5.0,
                type: data.type || 'posto',
                cnpj: data.cnpj || '',
                lastFirebaseUpdate: Date.now()
            };
            
            // Verificar se já existe localmente
            const existingIndex = gasData.findIndex(s => s.id === docId);
            
            if (existingIndex === -1) {
                // Nova estação - adicionar
                gasData.push(localStation);
                console.log(`➕ Estação adicionada do Firebase: ${localStation.name}`);
            } else {
                // Atualizar se dados do Firebase forem mais recentes
                const localData = gasData[existingIndex];
                const fbUpdateTime = localStation.lastFirebaseUpdate;
                const localUpdateTime = localData.lastLocalUpdate || 0;
                
                if (fbUpdateTime > localUpdateTime) {
                    gasData[existingIndex] = {
                        ...localData,
                        ...localStation,
                        lastFirebaseUpdate: fbUpdateTime
                    };
                    console.log(`✏️ Estação atualizada do Firebase: ${localStation.name}`);
                }
            }
            
        } catch (error) {
            console.error('❌ Erro ao processar estação do Firebase:', error);
        }
    }
    
    // ========== LISTENERS EM TEMPO REAL ==========
    setupRealtimeListeners() {
        if (!this.isFirebaseAvailable() || !this.currentFirebaseUser) return;
        
        try {
            // Ouvir novas/atualizadas estações
            firebase.firestore().collection('stations')
                .where('updatedAt', '>', new Date(this.lastSync))
                .onSnapshot((snapshot) => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added' || change.type === 'modified') {
                            this.syncStationFromFirebase(change.doc.id, change.doc.data());
                            
                            // Atualizar mapa se estiver visível
                            if (typeof renderAllMarkers === 'function') {
                                setTimeout(renderAllMarkers, 100);
                            }
                        }
                    });
                });
            
            console.log('👂 Listeners em tempo real ativados');
            
        } catch (error) {
            console.error('❌ Erro ao configurar listeners:', error);
        }
    }
    
    // ========== BACKUP E RESTAURAÇÃO ==========
    async createBackup() {
        if (!this.currentFirebaseUser) {
            showToast('❌ Faça login para criar backup');
            return;
        }
        
        try {
            console.log('💾 Criando backup...');
            
            const backupData = {
                stations: gasData,
                users: users.filter(u => !u.id.startsWith('anon_')),
                stationComments: stationComments,
                createdAt: new Date().toISOString(),
                createdBy: this.currentFirebaseUser.uid
            };
            
            // Salvar no Firestore
            await firebase.firestore().collection('backups').add(backupData);
            
            // Salvar no Storage como JSON
            const backupJson = JSON.stringify(backupData, null, 2);
            const storageRef = firebase.storage().ref(`backups/backup_${Date.now()}.json`);
            await storageRef.putString(backupJson, 'raw');
            
            showToast('✅ Backup criado com sucesso');
            console.log('✅ Backup salvo');
            
        } catch (error) {
            console.error('❌ Erro ao criar backup:', error);
            showToast('❌ Erro ao criar backup');
        }
    }
    
    // ========== STATUS ==========
    getStatus() {
        return {
            isOnline: this.isOnline,
            isSyncing: this.syncInProgress,
            lastSync: this.lastSync,
            firebaseUser: this.currentFirebaseUser,
            firebaseAvailable: this.isFirebaseAvailable()
        };
    }
}

// Instância global
let firebaseSync = null;

// Inicializar
function initFirebaseSync() {
    try {
        firebaseSync = new FirebaseSync();
        window.firebaseSync = firebaseSync;
        return firebaseSync;
    } catch (error) {
        console.error('❌ Erro ao inicializar Firebase Sync:', error);
        return null;
    }
}

// Exportar
window.FirebaseSync = FirebaseSync;
window.initFirebaseSync = initFirebaseSync;
window.firebaseSync = firebaseSync;