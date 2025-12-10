import "@goongmaps/goong-js/dist/goong-js.css";
import { useCallback, useEffect, useRef, useState } from "react";
import "../App.css";
import "../index.css";
import { fetchSaleMan } from "../service/api.ts";
import { APP_COLORS } from "../constants/colors.js";
import { USER_ICON_SVG } from "../constants/icon.js";
import { createSVGMarker } from "../utils/marker.js";
import accessToken from "./access_token.jsx";

goongjs.accessToken = accessToken;

export default function Map() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const params = new URLSearchParams(window.location.search);
  const parentCode = params.get("parent_code");

  const [saleMan, setSaleMan] = useState([]);

  useEffect(() => {
    const loadSalesmen = async () => {
      const res = await fetchSaleMan(parentCode);
      if (res.data.data) {
        setSaleMan(res.data.data);
      }
    };
    loadSalesmen();
  }, []);

  // Log saleMan khi state thay đổi
  useEffect(() => {
    // console.log("🚀 ~ saleMan state:", saleMan);
    // console.log("🚀 ~ saleMan length:", saleMan.length);
  }, [saleMan]);

  // ========== HÀM HIỂN THỊ POPUP ==========
  const showSalesmanPopup = useCallback((map, salesman, coords) => {
    const html = `
      <div class="salesman-popup">
        <ul>
          <li> <strong>${salesman.name}</strong> </li>
          <li><strong>Code:</strong> ${salesman.code}</li>
          <li><strong>Thiết bị:</strong> ${salesman.device_name || "N/A"}</li>
          <li><strong>Doanh số tháng:</strong> ${salesman.total_sale}</li>
          <li><strong>Doanh số ngày:</strong> ${salesman.total_sale_completed}</li>
          <li><strong>Đã viếng thăm:</strong> ${salesman.total_visit_day} cửa hàng</li>
          <li><strong>Chưa viếng thăm:</strong>${salesman.total_not_visit_day} </li>
          <li><strong>Đơn hôm nay:</strong> ${salesman.order_count_day} đơn</li>
        </ul>
      </div>`;
    const popup = new window.goongjs.Popup({ offset: 25, closeButton: true, maxWidth: "350px" })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map);
  }, []);

  // ========== HÀM FLY TO SALESMAN ==========
  const flyToSalesman = useCallback(
    (map, salesmen) => {
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

      const coords = [parseFloat(salesman.long), parseFloat(salesman.lat)];

      map.flyTo({
        center: coords,
        speed: 1,
        zoom: 16,
        pitch: 30,
        easing(t) {
          if (t === 1) {
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

  // ========== CREATE PULSING DOT ==========
  const createPulsingDot = (color = "rgba(0, 181, 255, 1)") => {
    const size = 150;

    return {
      width: size,
      height: size,
      data: new Uint8Array(size * size * 4),

      onAdd: function (map) {
        const canvas = document.createElement("canvas");
        canvas.width = this.width;
        canvas.height = this.height;
        this.context = canvas.getContext("2d");
        this.map = map;
      },

      render: function () {
        const duration = 1000;
        const t = (performance.now() % duration) / duration;

        const radius = (this.width / 2) * 0.3;
        const outerRadius = (this.width / 2) * 0.7 * t + radius;
        const context = this.context;

        // Clear canvas
        context.clearRect(0, 0, this.width, this.height);

        // Draw outer circle (pulsing effect)
        context.beginPath();
        context.arc(this.width / 2, this.height / 2, outerRadius, 0, Math.PI * 2);
        // Màu ngoài mờ dần
        const outerColor = color.replace("1)", `${1 - t})`);
        context.fillStyle = outerColor;
        context.fill();

        // Draw inner circle (solid)
        context.beginPath();
        context.arc(this.width / 2, this.height / 2, radius, 0, Math.PI * 2);
        context.fillStyle = color;
        context.strokeStyle = "white";
        context.lineWidth = 2 + 4 * (1 - t);
        context.fill();
        context.stroke();

        // Update image data
        this.data = context.getImageData(0, 0, this.width, this.height).data;

        // Trigger repaint for animation
        this.map.triggerRepaint();

        return true;
      },
    };
  };

  // ========== HÀM CẬP NHẬT DỮ LIỆU NHÂN VIÊN ==========
  const updateSalesmenData = useCallback((map, salesmen) => {
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
            coordinates: [parseFloat(sm.long), parseFloat(sm.lat)],
          },
          properties: {
            ...sm,
            // TẠO THUỘC TÍNH ĐỂ DỄ DÙNG TRONG CASE (rất quan trọng!)
            salesmanStatus: sm.is_online === 1 ? "online" : "offline",
          },
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
    const saleman_green = createSVGMarker(APP_COLORS.GREEN, USER_ICON_SVG);
    const saleman_red = createSVGMarker(APP_COLORS.RED, USER_ICON_SVG);
    const saleman_yellow = createSVGMarker(APP_COLORS.YELLOW, USER_ICON_SVG);
    const saleman_gray = createSVGMarker(APP_COLORS.GRAY, USER_ICON_SVG);

    // Hàm load image từ SVG
    const loadImageFromSVG = (svg, name, callback) => {
      const img = new Image();
      img.onload = () => {
        map.addImage(name, img);
        callback();
      };
      img.src = "data:image/svg+xml;base64," + btoa(svg);
    };

    const onAllLoaded = () => {
      if (map.getLayer("clusters")) return;

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

      // Tạo pulsing dots với màu khác nhau cho online/offline
      const pulsingDotBlue = createPulsingDot(
        APP_COLORS.BLUE.replace("rgb", "rgba").replace(")", ", 1)")
      );
      const pulsingDotRed = createPulsingDot(
        APP_COLORS.RED.replace("rgb", "rgba").replace(")", ", 1)")
      );

      map.addImage("pulsing-dot-blue", pulsingDotBlue, { pixelRatio: 3 });
      map.addImage("pulsing-dot-red", pulsingDotRed, { pixelRatio: 3 });

      // Layer pulsing dots - PHẢI THÊM TRƯỚC salesman-points
      map.addLayer({
        id: "salesman-pulse",
        type: "symbol",
        source: "salesmen",
        filter: [
          "all",
          ["!", ["has", "point_count"]], // không phải cluster
          ["==", ["get", "salesmanStatus"], "online"], // CHỈ khi online
        ],
        layout: {
          "icon-image": "pulsing-dot-blue", // cố định luôn là blue
          "icon-size": 0.5, // Nhỏ hơn icon chính
          "icon-allow-overlap": true,
          "icon-anchor": "center", // Center để pulse ở giữa
        },
      });

      // === LAYER 4: SALESMAN POINTS (trên pulsing dots) ===
      map.addLayer({
        id: "salesman-points",
        type: "symbol",
        source: "salesmen",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": [
            "case",
            ["==", ["get", "salesmanStatus"], "online"],
            "icon-saleman-green",
            "icon-saleman-red",
          ],
          "icon-size": 0.8,
          "icon-allow-overlap": true,
          "icon-anchor": "bottom",
        },
      });
    };

    // Load icons cho tất cả nhân viên
    loadImageFromSVG(saleman_green, "icon-saleman-green", onAllLoaded);
    loadImageFromSVG(saleman_red, "icon-saleman-red", onAllLoaded);
    loadImageFromSVG(saleman_yellow, "icon-saleman-yellow", onAllLoaded);
    loadImageFromSVG(saleman_gray, "icon-saleman-gray", onAllLoaded);
  }, []);

  // ========== TẠO MAP (CHỈ 1 LẦN) ==========
  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new goongjs.Map({
      container: mapContainer.current,
      style: "https://tiles.goong.io/assets/goong_map_web.json",
      center: [106.72055776537006, 10.803239881310812],
      zoom: 12,
    });

    mapRef.current = map;

    map.on("load", () => {
      // TẮT POI + NHÃN KHÔNG CẦN (chờ map load xong)
      // Danh sách các layer cần GIỮ LẠI (whitelist)
      const keepLayers = new Set([
        // Layers của shops
        "shops-clusters",
        "shops-cluster-count",
        "shops-unclustered-point",
        "shops-simple-point",
        "shops-labels",
        // Layers của distributors
        "distributors-clusters",
        "distributors-cluster-count",
        "distributors-unclustered-point",
        "distributors-simple-point",
        "distributors-labels",
        // Layers của warehouses
        "warehouses-clusters",
        "warehouses-cluster-count",
        "warehouses-unclustered-point",
        "warehouses-simple-point",
        "warehouses-labels",
      ]);

      // Danh sách các pattern cần GIỮ LẠI (kiểm tra bằng includes)
      const keepPatterns = [
        "poi-airport", // Sân bay
        "water",
        "highway-shield-1", // Quốc Lộ
        "highway-shield-2", // Tỉnh Lộ
        "highway-name-major", // Tên đường chính
        "highway-name-medium", // Tên đường chính
        "road-oneway-spaced-large",
        "road-major",
        "lake-name_priority_2",
        "place-city-capital-vietnam",
        "place-city-capital", // Thủ đô HN
        "place-city1", // TP trực thuộc TW
        "place-city2", // Tỉnh
        "place-village",
        "ocean", // Biển đông
        "place-island", // Đảo nhỏ
        "place-archipelago", // Quần đảo hoàng sa/ Trường Sa
      ];

      // Hàm kiểm tra layer có nên giữ lại không
      const shouldKeepLayer = (layerId) => {
        // Kiểm tra trong whitelist
        if (keepLayers.has(layerId)) return true;

        // Kiểm tra các pattern
        return keepPatterns.some((pattern) => layerId.includes(pattern));
      };

      // Duyệt qua tất cả layers và ẩn các symbol layer không cần thiết
      map.getStyle().layers.forEach((layer) => {
        // Chỉ xử lý symbol layers (POI và labels)
        if (layer.type === "symbol") {
          const layerId = layer.id;

          // Nếu layer không nằm trong danh sách giữ lại thì ẩn đi
          if (!shouldKeepLayer(layerId)) {
            try {
              map.setLayoutProperty(layerId, "visibility", "none");
            } catch (error) {
              // Một số layer có thể không tồn tại hoặc đã bị xóa
              console.warn(`Không thể ẩn layer: ${layerId}`, error);
            }
          }
        }
      });

      // === 1. NÚT ZOOM + / − ===
      map.addControl(
        new goongjs.NavigationControl({
          showCompass: false,
          showZoom: true,
          visualizePitch: false,
        }),
        "top-right"
      );

      // === 2. NÚT LA BÀN (Compass) ===
      map.addControl(
        new goongjs.NavigationControl({
          showZoom: false,
          showCompass: true,
          visualizePitch: false,
        }),
        "top-right"
      );

      // === 3. NÚT ĐỊNH VỊ HIỆN TẠI ===
      map.addControl(
        new goongjs.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: true,
          showAccuracyCircle: true,
          showUserLocation: true,
        }),
        "top-right"
      );

      // === 4. NÚT FULLSCREEN ===
      map.addControl(new goongjs.FullscreenControl());

      // Setup event handlers cho click và hover
      // Click vào nhân viên → hiện popup (sẽ được thêm sau khi có layers)
      map.on("click", "salesman-points", (e) => {
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
      map.on("click", "clusters", (e) => {
        const features = e.features;
        const clusterId = features[0].properties.cluster_id;
        map.getSource("salesmen").getClusterExpansionZoom(clusterId, (err, zoom) => {
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
    });

    return () => map.remove();
  }, []); // CHỈ chạy 1 lần khi mount

  // ========== CẬP NHẬT DỮ LIỆU KHI saleMan THAY ĐỔI ==========
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.loaded()) return;
    if (saleMan.length === 0) return;

    updateSalesmenData(mapRef.current, saleMan);
    flyToSalesman(mapRef.current, saleMan);
  }, [saleMan, updateSalesmenData, flyToSalesman]);

  return (
    <div
      ref={mapContainer}
      style={{
        position: "absolute",
        inset: 0,
        width: "100vw",
        height: "100vh",
      }}
    />
  );
}
