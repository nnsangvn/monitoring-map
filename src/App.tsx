import "@goongmaps/goong-js/dist/goong-js.css";
import { useCallback, useEffect, useRef, useState } from "react";
import "./App.css";
import { fetchSaleMan } from "./service/api.ts";
import type { SalesMan } from "./types/api";

const GOONG_MAPTILES_KEY = import.meta.env.VITE_GOONG_MAPTILES_KEY;

// SVG icon cho user
const USER_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="6" r="4"/><path d="M20 17.5c0 2.485 0 4.5-8 4.5s-8-2.015-8-4.5S7.582 13 12 13s8 2.015 8 4.5Z"/></g></svg>`;

// Hàm tạo icon nhân viên đẹp (có bóng, mũi tên, dễ đổi màu) - để dùng sau
// const createSalesmanIcon = (bgColor: string): string => {
//   return `
// <svg width="44" height="56" viewBox="0 0 44 56" xmlns="http://www.w3.org/2000/svg">
//   <!-- Bóng đổ nhẹ -->
//   <ellipse cx="22" cy="50" rx="16" ry="5" fill="rgba(0,0,0,0.25)"/>
//
//   <!-- Vòng tròn chính + viền trắng -->
//   <circle cx="22" cy="20" r="17" fill="${bgColor}" stroke="#ffffff" stroke-width="4"/>
//
//   <!-- Icon người (màu trắng) -->
//   <g transform="translate(14,12)" fill="none" stroke="#ffffff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
//     <circle cx="8" cy="4" r="4"/>
//     <path d="M16 16c0 2.5-8 5.5-8 5.5s-8-3-8-5.5S3.5 11 8 11s8 2.5 8 5.5Z"/>
//   </g>
//
//   <!-- Mũi tên nhọn bên dưới -->
//   <path d="M22 38 L13 52 L31 52 Z" fill="${bgColor}" stroke="#ffffff" stroke-width="3"/>
// </svg>
//   `.trim();
// };

// 4 icon theo trạng thái (để dùng sau)
// const ICONS = {
//   hasOrder: createSalesmanIcon("#27AE60"), // Xanh lá đậm - Có đơn hàng
//   visitedOnly: createSalesmanIcon("#F39C12"), // Cam - Ghé thăm, không đơn
//   closed: createSalesmanIcon("#E74C3C"), // Đỏ - Cửa hàng đóng cửa
//   notVisited: createSalesmanIcon("#95A5A6"), // Xám - Chưa ghé
// };

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [isLegendOpen, setIsLegendOpen] = useState(false);

  const [saleMan, setSaleMan] = useState<SalesMan[]>([]);

  useEffect(() => {
    const loadSalesmen = async () => {
      const res = await fetchSaleMan();
      if (res.data) {
        setSaleMan(res.data);
      }
    };
    loadSalesmen();
  }, []);

  // Log saleMan khi state thay đổi
  useEffect(() => {
    console.log("🚀 ~ saleMan state:", saleMan);
    console.log("🚀 ~ saleMan length:", saleMan.length);
  }, [saleMan]);

  // ========== HÀM HIỂN THỊ POPUP ==========
  const showSalesmanPopup = useCallback(
    (map: any, salesman: SalesMan, coords: [number, number]) => {
      const formatMoney = (n: number) =>
        new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
      const html = `
      <div class="salesman-popup">
        <div class="salesman-name">${salesman.name}</div>
        <ul>
          <li><strong>Mã NV:</strong> ${salesman.code}</li>
          <li><strong>Thiết bị:</strong> ${salesman.device_name || "N/A"}</li>
          <li><strong>Doanh số tháng:</strong> ${formatMoney(salesman.total_sale)}</li>
          <li><strong>Doanh số ngày:</strong> ${formatMoney(salesman.total_sale_completed)}</li>
          <li><strong>Đã viếng thăm:</strong> ${salesman.total_visit_day} cửa hàng</li>
          <li><strong>Đơn hôm nay:</strong> ${salesman.order_count_day} đơn</li>
        </ul>
      </div>`;
      new window.goongjs.Popup({ offset: 25, closeButton: true, maxWidth: "350px" })
        .setLngLat(coords)
        .setHTML(html)
        .addTo(map);
    },
    []
  );

  // ========== HÀM FLY TO SALESMAN ==========
  const flyToSalesman = useCallback(
    (map: any, salesmen: SalesMan[]) => {
      const params = new URLSearchParams(window.location.search);
      const parentCode = params.get("parent_code");

      if (!parentCode) {
        console.log("ℹ️ Không có parent_code trong URL");
        return;
      }

      const salesman = salesmen.find((sm) => sm.code === parentCode);

      if (!salesman) {
        console.warn(`⚠️ Không tìm thấy salesman với code: ${parentCode}`);
        alert(`Không tìm thấy nhân viên với mã: ${parentCode}`);
        return;
      }

      if (!salesman.lat || !salesman.long) {
        alert(`Nhân viên ${salesman.name} không có tọa độ`);
        return;
      }

      const coords: [number, number] = [parseFloat(salesman.long), parseFloat(salesman.lat)];

      console.log(`✈️ Đang di chuyển đến vị trí của ${salesman.name} (${parentCode})`);

      map.flyTo({
        center: coords,
        speed: 1,
        zoom: 16,
        pitch: 30,
        easing(t: number) {
          if (t === 1) {
            console.log("✅ Đã di chuyển đến vị trí nhân viên thành công!");
            setTimeout(() => {
              showSalesmanPopup(map, salesman, coords);
            }, 500);
          }
          return t;
        },
      });
    },
    [showSalesmanPopup]
  );

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

  // ========== HÀM CẬP NHẬT DỮ LIỆU NHÂN VIÊN ==========
  const updateSalesmenData = useCallback((map: any, salesmen: SalesMan[]) => {
    // Xóa source và layers cũ nếu có
    if (map.getSource("salesmen")) {
      if (map.getLayer("salesman-points")) map.removeLayer("salesman-points");
      if (map.getLayer("cluster-count")) map.removeLayer("cluster-count");
      if (map.getLayer("clusters")) map.removeLayer("clusters");
      map.removeSource("salesmen");
    }

    // Tạo GeoJSON mới
    const salesmenGeoJSON = {
      type: "FeatureCollection",
      features: salesmen
        .filter((sm) => sm.long && sm.lat)
        .map((sm) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [parseFloat(sm.long!), parseFloat(sm.lat!)],
          },
          properties: sm,
        })),
    };

    // Thêm source mới
    map.addSource("salesmen", {
      type: "geojson",
      data: salesmenGeoJSON,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });

    // Tạm thời tất cả nhân viên dùng màu xanh
    const svgVisitedWithOrder = createSVGMarker("#61A340", USER_ICON_SVG);

    // Hàm load image từ SVG
    const loadImageFromSVG = (svg: string, name: string, callback: () => void) => {
      const img = new Image();
      img.onload = () => {
        map.addImage(name, img);
        callback();
      };
      img.src = "data:image/svg+xml;base64," + btoa(svg);
    };

    const onAllLoaded = () => {
      // === LAYER 1: CLUSTER CIRCLES ===
      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "salesmen",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#61A340", 10, "#FCEA24", 30, "#F01919"],
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
          "icon-image": "icon-visited-with-order",
          "icon-size": 0.8,
          "icon-allow-overlap": true,
          "icon-anchor": "bottom",
        },
      });

      console.log("✅ Đã load icon và 3 layers thành công!");
      console.log("✅ Đã vẽ", salesmen.length, "nhân viên lên bản đồ");
    };

    // Load icon màu xanh cho tất cả nhân viên
    loadImageFromSVG(svgVisitedWithOrder, "icon-visited-with-order", onAllLoaded);
  }, []);

  // ========== TẠO MAP (CHỈ 1 LẦN) ==========
  useEffect(() => {
    if (!mapContainer.current) return;

    // Set accessToken trước khi tạo map
    if (GOONG_MAPTILES_KEY) {
      (window.goongjs as any).accessToken = GOONG_MAPTILES_KEY;
    }

    const map = new window.goongjs.Map({
      container: mapContainer.current!,
      style: "https://tiles.goong.io/assets/goong_map_web.json",
      center: [106.72055776537006, 10.803239881310812],
      zoom: 13,
    });

    mapRef.current = map;

    map.on("load", () => {
      // TẮT POI + NHÃN KHÔNG CẦN, NHƯNG GIỮ LẠI TÊN ĐƯỜNG
      map.getStyle().layers.forEach((layer: any) => {
        const id = layer.id;
        if (
          layer.type === "symbol" &&
          !id.startsWith("salesman") &&
          !id.startsWith("cluster") &&
          !id.includes("road-label") &&
          !id.includes("road-number") &&
          !id.includes("motorway-shield") &&
          !id.includes("trunk-shield") &&
          !id.includes("street")
        ) {
          map.setLayoutProperty(id, "visibility", "none");
        }
      });

      // === 1. NÚT ZOOM + / − ===
      map.addControl(
        new window.goongjs.NavigationControl({
          showCompass: false,
          showZoom: true,
          visualizePitch: false,
        }),
        "top-right"
      );

      // === 2. NÚT LA BÀN (Compass) ===
      map.addControl(
        new window.goongjs.NavigationControl({
          showZoom: false,
          showCompass: true,
          visualizePitch: false,
        }),
        "top-right"
      );

      // === 3. NÚT ĐỊNH VỊ HIỆN TẠI ===
      map.addControl(
        new window.goongjs.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showAccuracyCircle: true,
          showUserLocation: true,
        }),
        "top-right"
      );

      // Setup event handlers cho click và hover
      // Click vào nhân viên → hiện popup (sẽ được thêm sau khi có layers)
      map.on("click", "salesman-points", (e: any) => {
        const feature = e.features[0];
        const sm = feature.properties;
        showSalesmanPopup(map, sm, feature.geometry.coordinates);
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

      // Nếu đã có dữ liệu saleMan, cập nhật ngay
      if (saleMan.length > 0) {
        updateSalesmenData(map, saleMan);
        flyToSalesman(map, saleMan);
      }
    });

    return () => {
      map.remove();
    };
  }, []); // CHỈ chạy 1 lần khi mount

  // ========== CẬP NHẬT DỮ LIỆU KHI saleMan THAY ĐỔI ==========
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.loaded()) return;
    if (saleMan.length === 0) return;

    updateSalesmenData(mapRef.current, saleMan);
    flyToSalesman(mapRef.current, saleMan);
  }, [saleMan, updateSalesmenData, flyToSalesman]);

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
