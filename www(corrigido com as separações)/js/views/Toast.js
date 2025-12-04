class Toast {
    static show(message, duration = 3000) {
        // Criar ou reutilizar elemento toast
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            document.body.appendChild(toast);
        }
        
        // Definir mensagem e mostrar
        toast.textContent = message;
        toast.classList.remove('hidden');
        
        // Esconder após a duração
        setTimeout(() => {
            toast.classList.add('hidden');
        }, duration);
        
        // Log no console (útil para depuração)
        console.log(`💬 Toast: ${message}`);
    }

    static hide() {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.classList.add('hidden');
        }
    }

    static success(message, duration = 3000) {
        this.show(`✅ ${message}`, duration);
    }

    static error(message, duration = 3000) {
        this.show(`❌ ${message}`, duration);
    }

    static warning(message, duration = 3000) {
        this.show(`⚠️ ${message}`, duration);
    }

    static info(message, duration = 3000) {
        this.show(`ℹ️ ${message}`, duration);
    }
}

window.Toast = Toast;