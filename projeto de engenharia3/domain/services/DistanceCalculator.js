export class DistanceCalculator {
  // Distância entre dois pontos (Haversine)
  haversineDistance(p1, p2) {
    const R = 6371; // Raio da Terra em km
    const toRad = deg => (deg * Math.PI) / 180;

    const dLat = toRad(p2.lat - p1.lat);
    const dLng = toRad(p2.lng - p1.lng);

    const lat1 = toRad(p1.lat);
    const lat2 = toRad(p2.lat);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  }

  // Distância perpendicular entre um ponto e um segmento
  pointToSegmentDistance(point, segA, segB) {
    // Converter para vetores
    const toRad = deg => (deg * Math.PI) / 180;

    const lat1 = toRad(segA.lat);
    const lng1 = toRad(segA.lng);
    const lat2 = toRad(segB.lat);
    const lng2 = toRad(segB.lng);
    const latP = toRad(point.lat);
    const lngP = toRad(point.lng);

    // Vetores
    const A = { x: lat1, y: lng1 };
    const B = { x: lat2, y: lng2 };
    const P = { x: latP, y: lngP };

    // Vetor AB
    const AB = { x: B.x - A.x, y: B.y - A.y };

    // Vetor AP
    const AP = { x: P.x - A.x, y: P.y - A.y };

    // Projeção escalar (t)
    const ab2 = AB.x ** 2 + AB.y ** 2;
    const ap_ab = AP.x * AB.x + AP.y * AB.y;
    let t = ap_ab / ab2;

    // Limitar ao segmento
    t = Math.max(0, Math.min(1, t));

    // Coordenada projetada
    const proj = {
      lat: A.x + AB.x * t,
      lng: A.y + AB.y * t
    };

    // Converter de volta para graus
    proj.lat = proj.lat * (180 / Math.PI);
    proj.lng = proj.lng * (180 / Math.PI);

    return this.haversineDistance(point, proj);
  }
}
