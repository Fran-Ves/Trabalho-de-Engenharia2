/* firebase-config.js - Configuração do Firebase 8.x */
console.log('🔥 Configurando Firebase 8.x...');

// Configuração do Firebase
const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID",
    appId: "SEU_APP_ID",
    measurementId: "G-MEASUREMENT_ID"
};

// Verificar se Firebase está disponível
function isFirebaseAvailable() {
    return typeof firebase !== 'undefined' && 
           typeof firebase.auth !== 'undefined' &&
           typeof firebase.firestore !== 'undefined';
}

// Inicializar Firebase se disponível
function initializeFirebase() {
    try {
        if (isFirebaseAvailable() && !firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase inicializado (v8.x)');
            
            // Ativar persistência offline
            if (firebase.firestore) {
                firebase.firestore().enablePersistence()
                    .then(() => console.log('✅ Persistência Firestore ativada'))
                    .catch(err => {
                        if (err.code == 'failed-precondition') {
                            console.warn('⚠️ Múltiplas abas abertas, persistência não ativada');
                        } else if (err.code == 'unimplemented') {
                            console.warn('⚠️ Persistência não suportada neste navegador');
                        }
                    });
            }
            
            return true;
        } else if (firebase.apps.length > 0) {
            console.log('✅ Firebase já inicializado');
            return true;
        }
    } catch (error) {
        console.error('❌ Erro ao inicializar Firebase:', error);
    }
    
    return false;
}

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeFirebase);
} else {
    initializeFirebase();
}

// Exportar
window.isFirebaseAvailable = isFirebaseAvailable;
window.initializeFirebase = initializeFirebase;