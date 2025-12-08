/* migrate-indexeddb-to-sqlite.js - Migrar dados do IndexedDB para SQLite */
async function migrateOldData() {
    console.log('🔄 Verificando dados antigos do IndexedDB...');
    
    try {
        // Verificar se há dados no localStorage (fallback antigo)
        const oldStations = localStorage.getItem('stations');
        const oldUsers = localStorage.getItem('users');
        const oldComments = localStorage.getItem('stationComments');
        
        if ((oldStations && oldStations !== '[]') || 
            (oldUsers && oldUsers !== '[]') ||
            (oldComments && oldComments !== '{}')) {
            
            console.log('📦 Dados antigos encontrados, migrando...');
            
            if (!window.sqlDB || !sqlDB.initialized) {
                await initSQLDatabase();
            }
            
            // Migrar estações
            if (oldStations) {
                const stations = JSON.parse(oldStations);
                for (const station of stations) {
                    try {
                        await sqlDB.addStation(station);
                        console.log(`✅ Migrada estação: ${station.name}`);
                    } catch (e) {
                        console.warn(`⚠️ Erro ao migrar estação ${station.name}:`, e);
                    }
                }
            }
            
            // Migrar usuários
            if (oldUsers) {
                const users = JSON.parse(oldUsers);
                for (const user of users) {
                    try {
                        await sqlDB.addUser(user);
                        console.log(`✅ Migrado usuário: ${user.name}`);
                    } catch (e) {
                        console.warn(`⚠️ Erro ao migrar usuário ${user.name}:`, e);
                    }
                }
            }
            
            // Migrar comentários
            if (oldComments) {
                const commentsObj = JSON.parse(oldComments);
                for (const stationId in commentsObj) {
                    for (const comment of commentsObj[stationId]) {
                        try {
                            await sqlDB.addComment(comment);
                            console.log(`✅ Migrado comentário para posto ${stationId}`);
                        } catch (e) {
                            console.warn(`⚠️ Erro ao migrar comentário:`, e);
                        }
                    }
                }
            }
            
            // Limpar dados antigos
            localStorage.removeItem('stations');
            localStorage.removeItem('users');
            localStorage.removeItem('stationComments');
            localStorage.removeItem('pendingPrices');
            localStorage.removeItem('certifications');
            localStorage.removeItem('priceHistory');
            
            console.log('✅ Migração completa! Dados antigos removidos.');
            showToast('✅ Dados migrados para novo sistema!');
        }
        
    } catch (error) {
        console.error('❌ Erro na migração:', error);
    }
}

// Executar migração após inicialização
setTimeout(migrateOldData, 3000);