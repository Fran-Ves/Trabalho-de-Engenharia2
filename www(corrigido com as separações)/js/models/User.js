
class User {
    constructor(data = {}) {
        this.id = data.id || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = data.name || '';
        this.email = data.email || '';
        this.password = data.password || ''; // Em produção, usar hash
        this.type = data.type || USER_TYPES.USER;
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = Date.now();
        
        // Campos específicos de posto
        if (this.type === USER_TYPES.POSTO) {
            this.cnpj = data.cnpj || '';
            this.stationId = data.stationId || null;
        }
    }

    static async create(data) {
        const user = new User(data);
        await user.save();
        return user;
    }

    async save() {
        if (!window.app?.database) {
            throw new Error('Database não inicializado');
        }
        
        this.updatedAt = Date.now();
        await window.app.database.put('users', this.toJSON());
        
        // Disparar evento de atualização
        window.dispatchEvent(new CustomEvent('user:updated', {
            detail: { userId: this.id }
        }));
    }

    static async findById(id) {
        const data = await window.app.database.get('users', id);
        return data ? new User(data) : null;
    }

    static async findByEmail(email) {
        const users = await window.app.database.getAll('users');
        const userData = users.find(u => u.email === email);
        return userData ? new User(userData) : null;
    }

    static async findAll() {
        const data = await window.app.database.getAll('users');
        return data.map(item => new User(item));
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            email: this.email,
            password: this.password,
            type: this.type,
            cnpj: this.cnpj,
            stationId: this.stationId,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        };
    }

    // Verificar se a senha está correta (simplificado)
    checkPassword(password) {
        return this.password === password; // Em produção, comparar hash
    }
}

window.User = User;