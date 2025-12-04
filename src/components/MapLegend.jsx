import { useState } from "react";

export default function MapLegend() {
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  return (
    <>
      {/* Toggle button - chỉ hiển thị trên mobile */}
      <button
        className="legend-toggle-btn"
        onClick={() => setIsLegendOpen(!isLegendOpen)}
        type="button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M11 17h2v-6h-2zm1-8q.425 0 .713-.288T13 8t-.288-.712T12 7t-.712.288T11 8t.288.713T12 9m0 13q-2.075 0-3.9-.788t-3.175-2.137T2.788 15.9T2 12t.788-3.9t2.137-3.175T8.1 2.788T12 2t3.9.788t3.175 2.137T21.213 8.1T22 12t-.788 3.9t-2.137 3.175t-3.175 2.138T12 22m0-2q3.35 0 5.675-2.325T20 12t-2.325-5.675T12 4T6.325 6.325T4 12t2.325 5.675T12 20m0-8"
            strokeWidth={0.5}
            stroke="currentColor"
          ></path>
        </svg>
      </button>

      {/* Legend - Chú thích */}
      <div className={`map-legend ${isLegendOpen ? "open" : ""}`}>
        <h4>Chú thích</h4>
        <div className="legend-item">
          <div className="legend-color visited-order"></div>
          <div className="legend-text">Viếng thăm có đơn hàng</div>
        </div>
        <div className="legend-item">
          <div className="legend-color visited-no-order"></div>
          <div className="legend-text">Viếng thăm không có đơn hàng</div>
        </div>
        <div className="legend-item">
          <div className="legend-color visited-closed"></div>
          <div className="legend-text">Khách hàng đóng cửa</div>
        </div>
        <div className="legend-item">
          <div className="legend-color not-visited"></div>
          <div className="legend-text">Chưa ghé thăm</div>
        </div>
      </div>
    </>
  );
}
