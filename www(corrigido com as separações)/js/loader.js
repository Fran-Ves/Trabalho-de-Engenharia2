// loader.js - Substitua TODO o conteúdo por:

console.log('🚀 Iniciando carregamento da aplicação...');

// Lista de scripts na ORDEM CORRETA
const scripts = [
    'js/route-integration.js',
    'js/models/Database.js',
    'js/config/constants.js',
    'js/models/Station.js',
    'js/models/User.js',
    'js/models/Route.js',
    'js/views/Toast.js',
    'js/views/UI.js',
    'js/views/Sidebar.js',
    'js/utils/geoutils.js',
    'js/utils/formatters.js',
    'js/controllers/MapController.js',
    'js/controllers/AuthController.js',
    'js/controllers/StationController.js',
    'js/controllers/RouteController.js',
    'js/controllers/DriverController.js',
    'js/app.js',
    'js/init-checker.js'
];

// Função para carregar um script
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = false; // IMPORTANTE: carregar em ordem
        script.onload = () => {
            console.log(`✅ ${src} carregado`);
            resolve();
        };
        script.onerror = () => {
            console.error(`❌ Erro ao carregar ${src}`);
            // Não rejeitar, continuar com outros scripts
            resolve();
        };
        document.head.appendChild(script);
    });
}

// Carregar todos os scripts sequencialmente
async function loadAllScripts() {
    console.log('📦 Carregando scripts...');
    
    for (const src of scripts) {
        await loadScript(src);
        // Pequena pausa entre scripts
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    console.log('✅ Todos os scripts carregados');
    
    // Aguardar um pouco e inicializar
    setTimeout(async () => {
        if (typeof App !== 'undefined') {
            console.log('🎯 Inicializando aplicação...');
            try {
                window.app = new App();
                await window.app.init();
                console.log('🎉 Aplicação inicializada com sucesso!');
            } catch (error) {
                console.error('❌ Erro na inicialização:', error);
            }
        } else {
            console.error('❌ Classe App não encontrada após carregamento');
        }
    }, 500);
}
// Iniciar carregamento quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadAllScripts);
} else {
    loadAllScripts();
}
// Script de verificação de botões de login.
setTimeout(() => {
    console.log('🔍 Verificando botões de login...');
    
    // Verificar se os botões existem
    const profileBtn = document.getElementById('profileBtn');
    const addBtn = document.getElementById('addBtn');
    const homeCadastrar = document.getElementById('homeCadastrar');
    
    console.log('✅ Botão perfil:', profileBtn ? 'EXISTE' : 'NÃO EXISTE');
    console.log('✅ Botão adicionar:', addBtn ? 'EXISTE' : 'NÃO EXISTE');
    console.log('✅ Botão homeCadastrar:', homeCadastrar ? 'EXISTE' : 'NÃO EXISTE');
    
    // Adicionar event listeners diretos para debug
    if (profileBtn) {
        profileBtn.addEventListener('click', (e) => {
            console.log('👤 Botão perfil clicado diretamente');
            e.stopPropagation();
        });
    }
    
    if (addBtn) {
        addBtn.addEventListener('click', (e) => {
            console.log('➕ Botão adicionar clicado diretamente');
            e.stopPropagation();
        });
    }
}, 2000);