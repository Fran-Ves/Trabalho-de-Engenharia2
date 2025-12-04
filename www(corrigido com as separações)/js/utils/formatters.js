// Utilitários para formatação de dados

class Formatters {
    // Formatar preço
    static formatPrice(price) {
        if (price === null || price === undefined || price === '') {
            return '--';
        }
        return `R$ ${parseFloat(price).toFixed(2).replace('.', ',')}`;
    }

    // Formatar data
    static formatDate(date, format = 'short') {
        const d = new Date(date);
        
        if (format === 'short') {
            return d.toLocaleDateString('pt-BR');
        } else if (format === 'datetime') {
            return d.toLocaleString('pt-BR');
        } else if (format === 'relative') {
            const now = new Date();
            const diffMs = now - d;
            const diffMins = Math.round(diffMs / 60000);
            const diffHours = Math.round(diffMs / 3600000);
            const diffDays = Math.round(diffMs / 86400000);
            
            if (diffMins < 1) {
                return 'agora';
            } else if (diffMins < 60) {
                return `há ${diffMins} min`;
            } else if (diffHours < 24) {
                return `há ${diffHours} h`;
            } else if (diffDays < 7) {
                return `há ${diffDays} dias`;
            } else {
                return d.toLocaleDateString('pt-BR');
            }
        }
        
        return d.toLocaleDateString('pt-BR');
    }

    // Formatar número de telefone
    static formatPhone(phone) {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');
        
        if (cleaned.length === 11) {
            return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        } else if (cleaned.length === 10) {
            return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
        }
        
        return phone;
    }

    // Formatar CNPJ
    static formatCNPJ(cnpj) {
        if (!cnpj) return '';
        const cleaned = cnpj.replace(/\D/g, '');
        
        if (cleaned.length === 14) {
            return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
        }
        
        return cnpj;
    }

    // Formatar endereço
    static formatAddress(street, number, neighborhood, city, state) {
        const parts = [];
        if (street) parts.push(street);
        if (number) parts.push(number);
        if (neighborhood) parts.push(neighborhood);
        if (city || state) parts.push(`${city || ''}${city && state ? ' - ' : ''}${state || ''}`);
        
        return parts.join(', ');
    }

    // Truncar texto
    static truncate(text, maxLength = 50, suffix = '...') {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + suffix;
    }

    // Escapar HTML
    static escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Capitalizar primeira letra
    static capitalize(text) {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }

    // Formatar pontuação de confiança
    static formatTrustScore(score) {
        if (!score) return '--/10';
        return `${parseFloat(score).toFixed(1)}/10`;
    }
}

window.Formatters = Formatters;