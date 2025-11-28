import "@goongmaps/goong-js/dist/goong-js.css";
import { useEffect, useRef, useState } from "react";
import salesmenData from "./data/saleman.json";
import "./App.css";
import { fetchSaleMan } from "./service/api.ts";
import type { SalesMan } from "./types/api";

const GOONG_MAPTILES_KEY = import.meta.env.VITE_GOONG_MAPTILES_KEY;

// SVG icon cho user
const USER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <circle cx="12" cy="8" r="5"/>
  <path d="M20 21a8 8 0 1 0-16 0"/>
</svg>`;

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  const [saleMan, setSaleMan] = useState<SalesMan[]>([]);

  const loadSalesmen = async () => {
    const res = await fetchSaleMan();
    console.log("🚀 ~ loadSalesmen ~ res:", JSON.stringify(res, null, 2));
    if (res.data) {
      setSaleMan(res.data);
    }
  };

  useEffect(() => {
    loadSalesmen();
  }, []);

  // Log saleMan khi state thay đổi
  useEffect(() => {
    console.log("🚀 ~ saleMan state:", saleMan);
    console.log("🚀 ~ saleMan length:", saleMan.length);
  }, [saleMan]);

  useEffect(() => {
    if (!mapContainer.current) return;

    (window as any).goongjs.accessToken = GOONG_MAPTILES_KEY;

    const map = new (window as any).goongjs.Map({
      container: mapContainer.current!,
      // style: "https://tiles.goong.io/assets/navigation_day.json",
      style: "https://tiles.goong.io/assets/goong_map_web.json",
      center: [106.705611, 10.760948],
      zoom: 12,
    });

    mapRef.current = map;

    // ========== HÀM HIỂN THỊ POPUP ==========
    const showSalesmanPopup = (salesman: any, coords: [number, number]) => {
      const formatMoney = (amount: number) => {
        return new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
        }).format(amount);
      };

      const popupHTML = `
        <div class="salesman-popup">
          <div class="salesman-name">${salesman.name}</div>
          <ul>
            <li><strong>Mã NV:</strong> ${salesman.salesman_code}</li>
            <li><strong>Thiết bị:</strong> ${salesman.device}</li>
            <li><strong>Doanh số tháng:</strong> ${formatMoney(salesman.sales_month)}</li>
            <li><strong>Doanh số ngày:</strong> ${formatMoney(salesman.sales_today)}</li>
            <li><strong>Đã viếng thăm:</strong> ${salesman.visited} cửa hàng</li>
            <li><strong>Chưa viếng thăm:</strong> ${salesman.not_visited} cửa hàng</li>
            <li><strong>Đơn hàng hôm nay:</strong> ${salesman.orders_today} đơn</li>
          </ul>
        </div>
      `;

      new (window as any).goongjs.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: true,
        maxWidth: "350px",
      })
        .setLngLat(coords)
        .setHTML(popupHTML)
        .addTo(map);
    };

    // ========== HÀM FLY TO SALESMAN ==========
    const flyToSalesman = (salesmen: any[]) => {
      const params = new URLSearchParams(window.location.search);
      const salesmanCode = params.get("salesman_code");

      if (!salesmanCode) {
        console.log("ℹ️ Không có salesman_code trong URL");
        return;
      }

      const salesman = salesmen.find((sm) => sm.salesman_code === salesmanCode);

      if (!salesman) {
        console.warn(`⚠️ Không tìm thấy salesman với code: ${salesmanCode}`);
        alert(`Không tìm thấy nhân viên với mã: ${salesmanCode}`);
        return;
      }

      console.log(`✈️ Đang di chuyển đến vị trí của ${salesman.name} (${salesmanCode})`);

      map.flyTo({
        center: salesman.coords,
        speed: 1,
        zoom: 16,
        pitch: 30,
        easing(t: number) {
          if (t === 1) {
            console.log("✅ Đã di chuyển đến vị trí nhân viên thành công!");
            setTimeout(() => {
              showSalesmanPopup(salesman, salesman.coords);
            }, 500);
          }
          return t;
        },
      });
    };

    // ========== CREATE SVG MARKER ==========
    const createSVGMarker = (color: string, iconSvg: string) => {
      const coloredIcon = iconSvg.replace(/currentColor/g, "white");
      return `<svg width="32" height="48" viewBox="0 0 48 64" xmlns="http://www.w3.org/2000/svg">
        <path d="M24 0C10.745 0 0 10.745 0 24c0 18.273 24 40 24 40s24-21.727 24-40C48 10.745 37.255 0 24 0z" fill="${color}"/>
        <g transform="translate(12, 9) scale(1)">
          ${coloredIcon.replace(/<svg[^>]*>|<\/svg>/g, "")}
        </g>
      </svg>`;
    };

    map.on("load", () => {
      // === 1. NÚT ZOOM + / − ===
      map.addControl(
        new (window as any).goongjs.NavigationControl({
          showCompass: false,
          showZoom: true,
          visualizePitch: false,
        }),
        "top-right"
      );

      // === 2. NÚT LA BÀN (Compass) ===
      map.addControl(
        new (window as any).goongjs.NavigationControl({
          showZoom: false,
          showCompass: true,
          visualizePitch: false,
        }),
        "top-right"
      );

      // === 3. NÚT ĐỊNH VỊ HIỆN TẠI ===
      map.addControl(
        new (window as any).goongjs.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showAccuracyCircle: true,
          showUserLocation: true,
        }),
        "top-right"
      );

      // ========== VẼ NHÂN VIÊN BÁN HÀNG ==========
      const salesmenGeoJSON = {
        type: "FeatureCollection",
        features: salesmenData.map((sm) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: sm.coords,
          },
          properties: sm,
        })),
      };

      map.addSource("salesmen", {
        type: "geojson",
        data: salesmenGeoJSON,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // Định nghĩa 4 màu theo visit_status
      const svgVisitedWithOrder = createSVGMarker("#61A340", USER_ICON_SVG);
      const svgVisitedNoOrder = createSVGMarker("#F01919", USER_ICON_SVG);
      const svgVisitedClosed = createSVGMarker("#FCEA24", USER_ICON_SVG);
      const svgNotVisited = createSVGMarker("#949494", USER_ICON_SVG);

      // Hàm load image từ SVG
      const loadImageFromSVG = (svg: string, name: string, callback: () => void) => {
        const img = new Image();
        img.onload = () => {
          map.addImage(name, img);
          callback();
        };
        img.src = "data:image/svg+xml;base64," + btoa(svg);
      };

      let loadedCount = 0;
      const onAllLoaded = () => {
        loadedCount++;
        if (loadedCount === 4) {
          // === LAYER 1: CLUSTER CIRCLES ===
          map.addLayer({
            id: "clusters",
            type: "circle",
            source: "salesmen",
            filter: ["has", "point_count"],
            paint: {
              "circle-color": [
                "step",
                ["get", "point_count"],
                "#61A340",
                10,
                "#FCEA24",
                30,
                "#F01919",
              ],
              "circle-radius": ["step", ["get", "point_count"], 20, 10, 30, 30, 40],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
              "circle-opacity": 0.9,
            },
          });

          // === LAYER 2: CLUSTER COUNT ===
          map.addLayer({
            id: "cluster-count",
            type: "symbol",
            source: "salesmen",
            filter: ["has", "point_count"],
            layout: {
              "text-field": "{point_count_abbreviated}",
              "text-size": 12,
            },
            paint: {
              "text-color": "#ffffff",
            },
          });

          // === LAYER 3: UNCLUSTERED POINTS ===
          map.addLayer({
            id: "salesman-points",
            type: "symbol",
            source: "salesmen",
            filter: ["!", ["has", "point_count"]],
            layout: {
              "icon-image": [
                "match",
                ["get", "visit_status"],
                "visited_with_order",
                "icon-visited-with-order",
                "visited_no_order",
                "icon-visited-no-order",
                "visited_closed",
                "icon-visited-closed",
                "not_visited",
                "icon-not-visited",
                "icon-not-visited",
              ],
              "icon-size": 0.8,
              "icon-allow-overlap": true,
              "icon-anchor": "bottom",
            },
          });

          console.log("✅ Đã load 4 icons và 3 layers thành công!");
        }
      };

      // Load 4 icons
      loadImageFromSVG(svgVisitedWithOrder, "icon-visited-with-order", onAllLoaded);
      loadImageFromSVG(svgVisitedNoOrder, "icon-visited-no-order", onAllLoaded);
      loadImageFromSVG(svgVisitedClosed, "icon-visited-closed", onAllLoaded);
      loadImageFromSVG(svgNotVisited, "icon-not-visited", onAllLoaded);

      // Click vào nhân viên → hiện popup
      map.on("click", "salesman-points", (e: any) => {
        const feature = e.features[0];
        const sm = feature.properties;
        showSalesmanPopup(sm, feature.geometry.coordinates);
      });

      // Hover effect
      map.on("mouseenter", "salesman-points", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "salesman-points", () => {
        map.getCanvas().style.cursor = "";
      });

      // Click vào cluster → zoom in
      map.on("click", "clusters", (e: any) => {
        const features = e.features;
        const clusterId = features[0].properties.cluster_id;
        map.getSource("salesmen").getClusterExpansionZoom(clusterId, (err: any, zoom: number) => {
          if (err) return;
          map.easeTo({
            center: features[0].geometry.coordinates,
            zoom: zoom,
          });
        });
      });

      // Hover effect cho cluster
      map.on("mouseenter", "clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "clusters", () => {
        map.getCanvas().style.cursor = "";
      });

      console.log("✅ Đã vẽ", salesmenData.length, "nhân viên lên bản đồ");

      // Xử lý URL parameters
      flyToSalesman(salesmenData);
    });

    return () => {
      map.remove();
    };
  }, []);

  return (
    <>
      <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />

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
