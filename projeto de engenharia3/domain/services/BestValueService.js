export class BestValueService {
  static calculateBestValue(stations) {
    let bestStation = null;
    let bestScore = -Infinity;
    
    stations.forEach(station => {
      if (station.prices?.gas && parseFloat(station.trustScore) >= 6.0) {
        const price = parseFloat(station.prices.gas);
        const trust = parseFloat(station.trustScore);
        const valueScore = (10 - price) * trust;
        if (valueScore > bestScore) {
          bestScore = valueScore;
          bestStation = station;
        }
      }
    });
    
    // Resetar todos
    stations.forEach(s => s.isBestValue = false);
    if (bestStation) {
      bestStation.isBestValue = true;
    }
    return bestStation;
  }
}