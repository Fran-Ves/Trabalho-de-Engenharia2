export class User {
  constructor(id, name, email, password, type = 'user') {
    this.id = id;
    this.name = name;
    this.email = email;
    this.password = password;
    this.type = type;
  }
}