/* firebase-sync.js - Sistema de sincronização entre SQLite e Firebase */
class FirebaseSync {
    constructor() {
        this.isOnline = navigator.onLine;
        this.syncInProgress = false;
        this.lastSync = localStorage.getItem('lastFirebaseSync') || 0;
        this.authStateChanged = false;
        
        // Eventos de rede
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Inicializar Firebase Auth listener
        this.initAuthListener();
    }
    
    async initAuthListener() {
        if (!isFirebaseAvailable()) return;
        
        firebaseAuth.onAuthStateChanged(async (user) => {
            if (user) {
                console.log('👤 Usuário Firebase autenticado:', user.uid);
                this.currentFirebaseUser = user;
                await this.syncAllData();
            } else {
                console.log('👤 Nenhum usuário Firebase autenticado');
                this.currentFirebaseUser = null;
            }
        });
    }
    
    handleOnline() {
        console.log('🌐 Online - Iniciando sincronização...');
        this.isOnline = true;
        this.syncAllData();
    }
    
    handleOffline() {
        console.log('📴 Offline - Modo local ativado');
        this.isOnline = false;
    }
    
    // ========== AUTENTICAÇÃO ==========
    async signIn(email, password) {
        if (!isFirebaseAvailable()) {
            throw new Error('Firebase não disponível');
        }
        
        try {
            const userCredential = await firebaseAuth.signInWithEmailAndPassword(email, password);
            console.log('✅ Login Firebase bem-sucedido');
            return userCredential.user;
        } catch (error) {
            console.error('❌ Erro login Firebase:', error);
            throw error;
        }
    }
    
    async signUp(email, password, name) {
        if (!isFirebaseAvailable()) {
            throw new Error('Firebase não disponível');
        }
        
        try {
            const userCredential = await firebaseAuth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName: name });
            
            // Salvar dados do usuário no Firestore
            await firebaseDB.collection('users').doc(userCredential.user.uid).set({
                name: name,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                type: 'user'
            });
            
            console.log('✅ Cadastro Firebase bem-sucedido');
            return userCredential.user;
        } catch (error) {
            console.error('❌ Erro cadastro Firebase:', error);
            throw error;
        }
    }
    
    async signOut() {
        if (!isFirebaseAvailable()) return;
        
        try {
            await firebaseAuth.signOut();
            this.currentFirebaseUser = null;
            console.log('✅ Logout Firebase');
        } catch (error) {
            console.error('❌ Erro logout:', error);
        }
    }
    
    // ========== SINCRONIZAÇÃO DE DADOS ==========
    async syncAllData() {
        if (!this.isOnline || !this.currentFirebaseUser || this.syncInProgress) return;
        
        this.syncInProgress = true;
        console.log('🔄 Iniciando sincronização completa...');
        
        try {
            // 1. Enviar dados locais para Firebase
            await this.pushLocalToFirebase();
            
            // 2. Baixar dados do Firebase
            await this.pullFromFirebase();
            
            // 3. Sincronizar comentários
            await this.syncComments();
            
            this.lastSync = Date.now();
            localStorage.setItem('lastFirebaseSync', this.lastSync);
            
            console.log('✅ Sincronização completa concluída');
            showToast('✅ Dados sincronizados com nuvem');
            
        } catch (error) {
            console.error('❌ Erro na sincronização:', error);
            showToast('❌ Falha na sincronização');
        } finally {
            this.syncInProgress = false;
        }
    }
    
    async pushLocalToFirebase() {
        console.log('📤 Enviando dados locais para Firebase...');
        
        // Enviar estações
        for (const station of gasData) {
            await this.syncStationToFirebase(station);
        }
        
        // Enviar usuários
        for (const user of users) {
            await this.syncUserToFirebase(user);
        }
        
        // Enviar comentários pendentes
        await this.pushPendingComments();
    }
    
    async pullFromFirebase() {
        console.log('📥 Baixando dados do Firebase...');
        
        try {
            // Baixar estações
            const stationsSnapshot = await firebaseDB.collection('stations').get();
            const firebaseStations = [];
            
            stationsSnapshot.forEach(doc => {
                const station = { id: doc.id, ...doc.data() };
                firebaseStations.push(station);
                
                // Sincronizar com SQLite
                this.syncStationToLocal(station);
            });
            
            console.log(`📥 ${firebaseStations.length} estações baixadas do Firebase`);
            
            // Baixar usuários
            const usersSnapshot = await firebaseDB.collection('users').get();
            const firebaseUsers = [];
            
            usersSnapshot.forEach(doc => {
                const user = { id: doc.id, ...doc.data() };
                firebaseUsers.push(user);
                
                // Sincronizar com SQLite
                this.syncUserToLocal(user);
            });
            
            console.log(`📥 ${firebaseUsers.length} usuários baixados do Firebase`);
            
        } catch (error) {
            console.error('❌ Erro ao baixar do Firebase:', error);
        }
    }
    
    // ========== SINCRONIZAÇÃO DE ESTAÇÕES ==========
    async syncStationToFirebase(station) {
        try {
            const stationRef = firebaseDB.collection('stations').doc(station.id);
            const stationData = {
                name: station.name,
                coords: station.coords,
                prices: station.prices,
                isVerified: station.isVerified || false,
                trustScore: station.trustScore || 5.0,
                type: station.type || 'posto',
                cnpj: station.cnpj || '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLocalUpdate: Date.now()
            };
            
            // Verificar se já existe no Firebase
            const doc = await stationRef.get();
            
            if (!doc.exists) {
                // Nova estação
                stationData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                stationData.createdBy = this.currentFirebaseUser?.uid;
                await stationRef.set(stationData);
                console.log(`➕ Estação ${station.name} enviada para Firebase`);
            } else {
                // Atualizar se dados locais forem mais recentes
                const fbData = doc.data();
                const localUpdateTime = stationData.lastLocalUpdate;
                const fbUpdateTime = fbData.lastLocalUpdate || 0;
                
                if (localUpdateTime > fbUpdateTime) {
                    await stationRef.update(stationData);
                    console.log(`✏️ Estação ${station.name} atualizada no Firebase`);
                }
            }
            
        } catch (error) {
            console.error(`❌ Erro ao sincronizar estação ${station.name}:`, error);
        }
    }
    
    async syncStationToLocal(firebaseStation) {
        try {
            // Converter dados do Firebase para formato local
            const localStation = {
                id: firebaseStation.id,
                name: firebaseStation.name,
                coords: firebaseStation.coords,
                prices: firebaseStation.prices || {},
                isVerified: firebaseStation.isVerified || false,
                trustScore: firebaseStation.trustScore || 5.0,
                type: firebaseStation.type || 'posto',
                cnpj: firebaseStation.cnpj || '',
                lastFirebaseUpdate: Date.now()
            };
            
            // Verificar se existe localmente
            const existingIndex = gasData.findIndex(s => s.id === localStation.id);
            
            if (existingIndex === -1) {
                // Nova estação
                gasData.push(localStation);
                console.log(`➕ Estação ${localStation.name} adicionada do Firebase`);
            } else {
                // Atualizar se dados do Firebase forem mais recentes
                const localStationData = gasData[existingIndex];
                const fbUpdateTime = localStation.lastFirebaseUpdate;
                const localUpdateTime = localStationData.lastLocalUpdate || 0;
                
                if (fbUpdateTime > localUpdateTime) {
                    gasData[existingIndex] = {
                        ...localStationData,
                        ...localStation,
                        lastFirebaseUpdate: fbUpdateTime
                    };
                    console.log(`✏️ Estação ${localStation.name} atualizada do Firebase`);
                }
            }
            
            // Salvar no SQLite
            if (window.sqlDB && sqlDB.initialized) {
                await sqlDB.updateStation(localStation);
            }
            
        } catch (error) {
            console.error(`❌ Erro ao sincronizar estação do Firebase:`, error);
        }
    }
    
    // ========== SINCRONIZAÇÃO DE USUÁRIOS ==========
    async syncUserToFirebase(user) {
        try {
            // Pular usuários anônimos
            if (user.id.startsWith('anon_') || user.id.startsWith('user_')) {
                return;
            }
            
            const userRef = firebaseDB.collection('users').doc(user.id);
            const userData = {
                name: user.name,
                email: user.email,
                type: user.type || 'user',
                cnpj: user.cnpj || '',
                coords: user.coords || null,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLocalUpdate: Date.now()
            };
            
            const doc = await userRef.get();
            
            if (!doc.exists) {
                userData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
                await userRef.set(userData);
                console.log(`➕ Usuário ${user.name} enviado para Firebase`);
            } else {
                const fbData = doc.data();
                const localUpdateTime = userData.lastLocalUpdate;
                const fbUpdateTime = fbData.lastLocalUpdate || 0;
                
                if (localUpdateTime > fbUpdateTime) {
                    await userRef.update(userData);
                    console.log(`✏️ Usuário ${user.name} atualizado no Firebase`);
                }
            }
            
        } catch (error) {
            console.error(`❌ Erro ao sincronizar usuário:`, error);
        }
    }
    
    async syncUserToLocal(firebaseUser) {
        try {
            const localUser = {
                id: firebaseUser.id,
                name: firebaseUser.name,
                email: firebaseUser.email,
                type: firebaseUser.type || 'user',
                cnpj: firebaseUser.cnpj || '',
                coords: firebaseUser.coords || null,
                lastFirebaseUpdate: Date.now()
            };
            
            const existingIndex = users.findIndex(u => u.id === localUser.id);
            
            if (existingIndex === -1) {
                users.push(localUser);
                console.log(`➕ Usuário ${localUser.name} adicionado do Firebase`);
            } else {
                const localUserData = users[existingIndex];
                const fbUpdateTime = localUser.lastFirebaseUpdate;
                const localUpdateTime = localUserData.lastLocalUpdate || 0;
                
                if (fbUpdateTime > localUpdateTime) {
                    users[existingIndex] = {
                        ...localUserData,
                        ...localUser,
                        lastFirebaseUpdate: fbUpdateTime
                    };
                    console.log(`✏️ Usuário ${localUser.name} atualizado do Firebase`);
                }
            }
            
        } catch (error) {
            console.error(`❌ Erro ao sincronizar usuário do Firebase:`, error);
        }
    }
    
    // ========== SINCRONIZAÇÃO DE COMENTÁRIOS ==========
    async syncComments() {
        console.log('💬 Sincronizando comentários...');
        
        try {
            // Enviar comentários locais para Firebase
            for (const stationId in stationComments) {
                for (const comment of stationComments[stationId]) {
                    await this.syncCommentToFirebase(comment, stationId);
                }
            }
            
            // Baixar comentários do Firebase
            const commentsSnapshot = await firebaseDB.collection('comments')
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get();
            
            commentsSnapshot.forEach(doc => {
                this.syncCommentToLocal(doc.id, doc.data());
            });
            
            console.log(`💬 ${commentsSnapshot.size} comentários sincronizados`);
            
        } catch (error) {
            console.error('❌ Erro ao sincronizar comentários:', error);
        }
    }
    
    async syncCommentToFirebase(comment, stationId) {
        try {
            // Verificar se já foi sincronizado
            if (comment.firebaseId) return;
            
            const commentData = {
                stationId: stationId,
                userId: comment.user_id || 'anonymous',
                userName: comment.user_name || 'Usuário',
                rating: comment.rating || 0,
                text: comment.text || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                localCreatedAt: comment.date
            };
            
            const docRef = await firebaseDB.collection('comments').add(commentData);
            
            // Atualizar comentário local com ID do Firebase
            comment.firebaseId = docRef.id;
            console.log(`➕ Comentário enviado para Firebase: ${docRef.id}`);
            
        } catch (error) {
            console.error('❌ Erro ao enviar comentário:', error);
        }
    }
    
    async syncCommentToLocal(firebaseId, commentData) {
        try {
            // Verificar se já existe localmente
            const exists = Object.values(stationComments).flat()
                .some(comment => comment.firebaseId === firebaseId);
            
            if (exists) return;
            
            const localComment = {
                id: `comment_${firebaseId}`,
                firebaseId: firebaseId,
                station_id: commentData.stationId,
                user_id: commentData.userId,
                user_name: commentData.userName,
                rating: commentData.rating,
                text: commentData.text,
                date: commentData.localCreatedAt || Date.now(),
                is_public: 1
            };
            
            // Adicionar ao array local
            if (!stationComments[localComment.station_id]) {
                stationComments[localComment.station_id] = [];
            }
            
            stationComments[localComment.station_id].push(localComment);
            
            // Salvar no SQLite
            if (window.sqlDB && sqlDB.initialized) {
                await sqlDB.addComment(localComment);
            }
            
        } catch (error) {
            console.error('❌ Erro ao baixar comentário:', error);
        }
    }
    
    async pushPendingComments() {
        // Coletar todos os comentários sem firebaseId
        const pendingComments = [];
        
        for (const stationId in stationComments) {
            stationComments[stationId].forEach(comment => {
                if (!comment.firebaseId) {
                    pendingComments.push({ comment, stationId });
                }
            });
        }
        
        if (pendingComments.length > 0) {
            console.log(`📤 Enviando ${pendingComments.length} comentários pendentes...`);
            
            for (const { comment, stationId } of pendingComments) {
                await this.syncCommentToFirebase(comment, stationId);
            }
        }
    }
    
    // ========== SINCRONIZAÇÃO EM TEMPO REAL ==========
    setupRealtimeListeners() {
        if (!isFirebaseAvailable()) return;
        
        // Ouvir novas estações em tempo real
        firebaseDB.collection('stations')
            .where('updatedAt', '>', new Date(this.lastSync))
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added' || change.type === 'modified') {
                        this.syncStationToLocal({
                            id: change.doc.id,
                            ...change.doc.data()
                        });
                        renderAllMarkers();
                    }
                });
            });
        
        // Ouvir novos comentários em tempo real
        firebaseDB.collection('comments')
            .orderBy('createdAt', 'desc')
            .limit(20)
            .onSnapshot((snapshot) => {
                snapshot.docChanges().forEach(change => {
                    if (change.type === 'added') {
                        this.syncCommentToLocal(change.doc.id, change.doc.data());
                        
                        // Atualizar popup se estiver aberto
                        const stationId = change.doc.data().stationId;
                        refreshStationComments(stationId);
                    }
                });
            });
        
        console.log('👂 Listeners em tempo real ativados');
    }
    
    // ========== UTILIDADES ==========
    async backupToFirebase() {
        if (!this.currentFirebaseUser) {
            showToast('❌ Faça login para fazer backup');
            return;
        }
        
        try {
            console.log('💾 Criando backup completo no Firebase...');
            
            // Criar objeto de backup
            const backupData = {
                stations: gasData,
                users: users.filter(u => !u.id.startsWith('anon_')),
                stationComments: stationComments,
                priceHistory: priceHistory,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                createdBy: this.currentFirebaseUser.uid
            };
            
            // Salvar no Firestore
            await firebaseDB.collection('backups').add(backupData);
            
            // Salvar no Storage como JSON
            const backupJson = JSON.stringify(backupData, null, 2);
            const storageRef = firebaseStorage.ref(`backups/backup_${Date.now()}.json`);
            await storageRef.putString(backupJson, 'raw');
            
            showToast('✅ Backup completo criado no Firebase');
            console.log('✅ Backup salvo no Firebase');
            
        } catch (error) {
            console.error('❌ Erro ao criar backup:', error);
            showToast('❌ Erro ao criar backup');
        }
    }
    
    async restoreFromBackup(backupId) {
        if (!this.currentFirebaseUser) {
            showToast('❌ Faça login para restaurar backup');
            return;
        }
        
        try {
            console.log('🔄 Restaurando backup...');
            
            const backupDoc = await firebaseDB.collection('backups').doc(backupId).get();
            
            if (!backupDoc.exists) {
                throw new Error('Backup não encontrado');
            }
            
            const backupData = backupDoc.data();
            
            // Restaurar dados
            gasData = backupData.stations || [];
            users = backupData.users || [];
            stationComments = backupData.stationComments || {};
            priceHistory = backupData.priceHistory || {};
            
            // Salvar no SQLite
            if (window.sqlDB && sqlDB.initialized) {
                for (const station of gasData) {
                    await sqlDB.addStation(station);
                }
                for (const user of users) {
                    await sqlDB.addUser(user);
                }
                for (const stationId in stationComments) {
                    for (const comment of stationComments[stationId]) {
                        await sqlDB.addComment(comment);
                    }
                }
            }
            
            // Atualizar interface
            renderAllMarkers();
            saveData();
            
            showToast('✅ Backup restaurado com sucesso');
            console.log('✅ Backup restaurado');
            
        } catch (error) {
            console.error('❌ Erro ao restaurar backup:', error);
            showToast('❌ Erro ao restaurar backup');
        }
    }
    
    // Verificar status da sincronização
    getSyncStatus() {
        return {
            isOnline: this.isOnline,
            isSyncing: this.syncInProgress,
            lastSync: this.lastSync,
            firebaseUser: this.currentFirebaseUser,
            pendingItems: this.getPendingSyncCount()
        };
    }
    
    getPendingSyncCount() {
        let count = 0;
        
        // Comentários pendentes
        for (const stationId in stationComments) {
            count += stationComments[stationId].filter(c => !c.firebaseId).length;
        }
        
        return count;
    }
}

// Instância global
let firebaseSync = null;

// Inicializar sincronização
async function initFirebaseSync() {
    if (!isFirebaseAvailable()) {
        console.log('⚠️ Firebase não disponível - Modo offline apenas');
        return null;
    }
    
    try {
        firebaseSync = new FirebaseSync();
        window.firebaseSync = firebaseSync;
        
        // Configurar listeners em tempo real após autenticação
        setTimeout(() => {
            if (firebaseSync) {
                firebaseSync.setupRealtimeListeners();
            }
        }, 2000);
        
        console.log('✅ Firebase Sync inicializado');
        return firebaseSync;
    } catch (error) {
        console.error('❌ Erro ao inicializar Firebase Sync:', error);
        return null;
    }
}

// Funções globais
window.initFirebaseSync = initFirebaseSync;
window.FirebaseSync = FirebaseSync;