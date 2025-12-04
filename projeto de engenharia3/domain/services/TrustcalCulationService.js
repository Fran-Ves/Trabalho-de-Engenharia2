export class TrustCalculationService {
  static calculate(station) {
    let score = 5.0;
    
    if (station.isVerified) score += 3.0;
    if (station.priceHistory && Object.keys(station.priceHistory).length > 5) score += 1.0;
    if (!station.pendingChanges || station.pendingChanges.length === 0) score += 1.0;
    if (station.prices?.gas && parseFloat(station.prices.gas) < 6.00) score += 0.5;
    
    const fuelCount = Object.keys(station.prices || {}).filter(k => station.prices[k]).length;
    if (fuelCount >= 2) score += 0.5;
    
    return Math.min(10, score).toFixed(1);
  }
}