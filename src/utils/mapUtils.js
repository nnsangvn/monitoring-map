// utils/mapUtils.js
const METERS_PER_PIXEL_AT_ZOOM = (zoom) => (40075016.686 * Math.cos(0)) / Math.pow(2, zoom + 8); // approx tại equator

/**
 * Kiểm tra salesman có gần bất kỳ POS nào không (trong khoảng maxDistance mét)
 * @returns {boolean} true nếu gần ít nhất 1 POS
 */
function isSalesmanNearAnyPOS(salesmanFeature, posFeatures, maxDistance = 10) {
  const salesmanCoord = salesmanFeature.geometry.coordinates;
  for (const pos of posFeatures) {
    const posCoord = pos.geometry.coordinates;
    const distance = haversineDistance(
      salesmanCoord[1],
      salesmanCoord[0],
      posCoord[1],
      posCoord[0]
    );
    if (distance <= maxDistance) return true;
  }
  return false;
}

/**
 * Tính offset pixel cho salesman khi gần POS
 * @param {number} zoom - current map zoom level
 * @returns {[number, number]} offset [x, y] in pixels (positive x = right, positive y = down)
 */
function getSalesmanOffset(zoom) {
  const pixelsAtZoom16 = 20; // khoảng 20px lệch tại zoom 16 (khoảng 5-8m)
  const scale = Math.pow(1.5, zoom - 16); // tăng/giảm theo zoom
  const offsetPx = pixelsAtZoom16 * scale;

  // Lệch lên trên + sang trái một chút (phổ biến & đẹp mắt)
  return [-offsetPx * 0.6, -offsetPx]; // [x: -12px, y: -20px] tại zoom 16
}

// Haversine (copy từ câu trả lời trước)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // mét
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export { getSalesmanOffset, haversineDistance };
