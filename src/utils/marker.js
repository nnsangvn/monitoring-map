/**
 * Tạo SVG marker với icon tùy chỉnh và màu sắc
 * @param {string} color - Màu sắc cho marker
 * @param {string} iconSVG - SVG icon để nhúng vào marker
 * @returns {string} SVG string hoàn chỉnh
 */
export const createSVGMarker = (color, iconSVG) => {
  const coloredIcon = iconSVG.replace(/currentColor/g, color);
  return `<svg width="32" height="48" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 0C10.745 0 0 10.745 0 24c0 18.273 24 40 24 40s24-21.727 24-40C48 10.745 37.255 0 24 0z" fill="${color}" stroke="${color}"/>
    <g transform="translate(12, 9) scale(1)">
      ${coloredIcon.replace(/<svg[^>]*>|<\/svg>/g, "")}
    </g>
  </svg>`;
};
