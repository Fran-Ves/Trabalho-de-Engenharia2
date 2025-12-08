/* firebase-config.js - Configuração do Firebase */
const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_MESSAGING_SENDER_ID",
    appId: "SEU_APP_ID",
    measurementId: "G-MEASUREMENT_ID"
};

// Inicializar Firebase
try {
    if (typeof firebase !== 'undefined' && firebase.apps.length === 0) {
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase inicializado');
        
        // Inicializar serviços
        window.firebaseAuth = firebase.auth();
        window.firebaseDB = firebase.firestore();
        window.firebaseStorage = firebase.storage();
        
        // Habilitar persistência offline do Firestore
        firebase.firestore().enablePersistence()
            .then(() => console.log('✅ Persistência Firestore ativada'))
            .catch(err => console.warn('⚠️ Persistência não suportada:', err));
    }
} catch (error) {
    console.error('❌ Erro ao inicializar Firebase:', error);
}

// Verificar se Firebase está disponível
function isFirebaseAvailable() {
    return typeof firebase !== 'undefined' && 
           typeof firebase.firestore !== 'undefined' &&
           typeof firebase.auth !== 'undefined';
}

// Exportar funções
window.isFirebaseAvailable = isFirebaseAvailable;