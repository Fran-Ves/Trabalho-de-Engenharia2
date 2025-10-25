# Simulação de um banco de dados em memória
class Database:
    def __init__(self):
        self.data = {}

    def get(self, id):
        return self.data.get(id)

    def save(self, cliente):
        self.data[cliente.id] = cliente

    def load_data(self, data):
        self.data = data.copy()

# Classe Cliente
class Cliente:
    def __init__(self, id, nome):
        self.id = id
        self.nome = nome

# Instâncias do banco de dados para leitura e escrita
db_escrita = Database()
db_leitura = Database()

# Comando
class UpdateClienteCommand:
    def __init__(self, id, novo_nome):
        self.id = id
        self.novo_nome = novo_nome

class UpdateClienteHandler:
    def handle(self, command):
        cliente = db_escrita.get(command.id)
        if cliente:
            cliente.nome = command.novo_nome
            db_escrita.save(cliente)
            # Sincroniza a alteração com o banco de leitura
            db_leitura.load_data(db_escrita.data)
        else:
            print(f"Cliente com ID {command.id} não encontrado.")

# Consulta
class GetClienteQuery:
    def __init__(self, id):
        self.id = id

class GetClienteHandler:
    def handle(self, query):
        cliente = db_leitura.get(query.id)
        if cliente:
            return cliente
        else:
            print(f"Cliente com ID {query.id} não encontrado.")
            return None

# Exemplo de uso
if __name__ == "__main__":
    # Criando um cliente e salvando no banco de escrita
    cliente1 = Cliente(1, "João")
    db_escrita.save(cliente1)
    if cliente1:
        print(f"Cliente atualizado: ID={cliente1.id}, Nome={cliente1.nome}")

    # Sincronizando o banco de leitura com o banco de escrita
    db_leitura.load_data(db_escrita.data)

    # Atualizando o nome do cliente
    update_command = UpdateClienteCommand(1, "João Silva")
    update_handler = UpdateClienteHandler()
    update_handler.handle(update_command)

    # Consultando o cliente atualizado
    get_query = GetClienteQuery(1)
    get_handler = GetClienteHandler()
    cliente_atualizado = get_handler.handle(get_query)

    if cliente_atualizado:
        print(f"Cliente atualizado: ID={cliente_atualizado.id}, Nome={cliente_atualizado.nome}")
