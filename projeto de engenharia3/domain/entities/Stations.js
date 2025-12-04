export class Station {
  constructor(id, name, coords, type = 'posto') {
    this.id = id;
    this.name = name;
    this.coords = coords;
    this.type = type;
    this.prices = { gas: null, etanol: null, diesel: null };
    this.isVerified = false;
    this.trustScore = 5.0;
    this.pendingChanges = [];
    this.isBestValue = false;
  }

  updatePrice(fuelType, price) {
    if (!this.prices) this.prices = {};
    this.prices[fuelType] = parseFloat(price).toFixed(2);
  }

  addPendingChange(change) {
    if (!this.pendingChanges) this.pendingChanges = [];
    this.pendingChanges.unshift(change);
  }

  confirmPendingChange(index, userId) {
    if (!this.pendingChanges || !this.pendingChanges[index]) return false;
    
    const change = this.pendingChanges[index];
    if (change.users.includes(userId)) return false;
    
    change.votes += 1;
    change.users.push(userId);
    this.trustScore = Math.min(10, (parseFloat(this.trustScore) || 5) + 0.5);
    
    if (change.votes >= 3) {
      this.updatePrice(change.type, change.price);
      this.pendingChanges.splice(index, 1);
      this.isVerified = true;
      return true;
    }
    return false;
  }
}