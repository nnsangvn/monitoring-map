import "@goongmaps/goong-js/dist/goong-js.css";
import { useCallback, useEffect, useRef, useState } from "react";
import "../App.css";
import "../index.css";
import { APP_COLORS } from "../constants/colors.js";
import { POS_ICON_SVG, USER_ICON_SVG } from "../constants/icon";
import { createSVGMarker } from "../utils/marker.js";
import accessToken from "./access_token.jsx";
import { useSaleMan } from "../hooks/useSaleMan.js";
import { usePointofSale } from "../hooks/usePointofSale.js";

goongjs.accessToken = accessToken;

export default function Map() {
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false); // Thêm state để track map đã load

  // Lưu query params vào state khi mount lần đầu
  const [queryParams, setQueryParams] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      parentCode: params.get("parent_code"),
      from: params.get("from"),
      to: params.get("to"),
    };
  });

  // Cập nhật query params khi URL thay đổi
  useEffect(() => {
    const updateQueryParams = () => {
      const params = new URLSearchParams(window.location.search);
      const newParams = {
        parentCode: params.get("parent_code"),
        from: params.get("from"),
        to: params.get("to"),
      };

      setQueryParams((prev) => {
        if (!prev.from || !prev.to || !prev.parentCode) {
          return newParams;
        }
        if (
          prev.parentCode !== newParams.parentCode ||
          prev.from !== newParams.from ||
          prev.to !== newParams.to
        ) {
          return newParams;
        }
        return prev;
      });
    };

    // Đọc ngay lần đầu
    updateQueryParams();

    // Lưu URL hiện tại để so sánh
    let lastUrl = window.location.href;

    // Kiểm tra URL mỗi 500ms
    const checkUrlInterval = setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        updateQueryParams();
      }
    }, 500);

    // Lắng nghe popstate
    const handlePopState = () => {
      lastUrl = window.location.href;
      updateQueryParams();
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      clearInterval(checkUrlInterval);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  // Sử dụng queryParams từ state
  const { parentCode, from, to } = queryParams;

  // Sử dụng hooks để fetch data
  const saleMan = useSaleMan(parentCode);
  const pointOfSale = usePointofSale(parentCode, from, to);

  // === SHOW SALESMAN POPUP ===
  const showSalesmanPopup = useCallback((map, salesman, coords, isFromClick = false) => {
    // Xóa popup cũ nếu có
    if (map._salesmanPopup) {
      map._salesmanPopup.remove();
      map._salesmanPopup = null;
    }

    const html = `
      <div class="salesman-popup">
        <ul>
          <li> <strong>${salesman.name}</strong> </li>
          <li><strong>Code:</strong> ${salesman.code}</li>
          <li><strong>Thiết bị:</strong> ${salesman.device_name || "N/A"}</li>
          <li><strong>Doanh số tháng:</strong> ${salesman.total_sale_formatted}</li>
          <li><strong>Doanh số ngày:</strong> ${salesman.total_sale_day_formatted}</li>
          <li><strong>Đã viếng thăm:</strong> ${salesman.total_visit_day} cửa hàng</li>
          <li><strong>Chưa viếng thăm:</strong>${salesman.total_not_visit_day} </li>
          <li><strong>Đơn hôm nay:</strong> ${salesman.order_count_day} đơn</li>
        </ul>
      </div>`;
    const popup = new window.goongjs.Popup({ offset: 25, closeButton: true, maxWidth: "350px" })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map);

    // Đánh dấu popup có phải từ click hay không
    popup._isFromClick = isFromClick;

    // Lưu popup instance vào map để có thể remove sau
    map._salesmanPopup = popup;

    // Xóa popup khi popup tự đóng (click close button)
    popup.on("close", () => {
      map._salesmanPopup = null;
    });
  }, []);

  // Hàm đóng popup salesman
  const closeSalesmanPopup = useCallback((map) => {
    if (map._salesmanPopup) {
      map._salesmanPopup.remove();
      map._salesmanPopup = null;
    }
  }, []);

  // === SHOW POINT OF SALE POPUP ===
  const showPointOfSalePopup = useCallback((map, pointOfSale, coords, isFromClick = false) => {
    // Xóa popup cũ nếu có
    if (map._pointOfSalePopup) {
      map._pointOfSalePopup.remove();
      map._pointOfSalePopup = null;
    }

    const html = `
      <div class="salesman-popup">
        <ul>
          <li> <strong>${pointOfSale.shop_name}</strong> </li>
          <li><strong>Địa chỉ:</strong> ${pointOfSale.address || "N/A"}</li>
          <li><strong>Trạng thái:</strong> ${pointOfSale.marker_name || "N/A"}</li>
        </ul>
      </div>`;

    const popup = new window.goongjs.Popup({ offset: 25, closeButton: true, maxWidth: "350px" })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map);

    // Đánh dấu popup có phải từ click hay không
    popup._isFromClick = isFromClick;

    // Lưu popup instance vào map để có thể remove sau
    map._pointOfSalePopup = popup;

    // Xóa popup khi popup tự đóng (click close button)
    popup.on("close", () => {
      map._pointOfSalePopup = null;
    });
  }, []);

  // Hàm đóng popup điểm bán
  const closePointOfSalePopup = useCallback((map) => {
    if (map._pointOfSalePopup) {
      map._pointOfSalePopup.remove();
      map._pointOfSalePopup = null;
    }
  }, []);

  // === FLY TO SALESMAN ===
  const flyToSalesman = useCallback(
    (map, salesmen) => {
      if (!parentCode) {
        console.log("ℹ️ Không có parent_code trong URL");
        return;
      }

      const salesman = salesmen.find((sm) => sm.code === parentCode);

      if (!salesman) {
        // console.warn(`⚠️ Không tìm thấy salesman với code: ${parentCode}`);
        // alert(`Không tìm thấy sale với mã: ${parentCode}`);
        return;
      }

      if (!salesman.lat || !salesman.long) {
        // Chỉ hiển thị alert cho SALEMAN (sales_position = '1')
        if (salesman.sales_position === "1") {
          alert(`Sale ${salesman.name} không có tọa độ`);
        }
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
    [parentCode, showSalesmanPopup]
  );

  // === CREATE PULSING DOT ===
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
        this.context = canvas.getContext("2d", { willReadFrequently: true });
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

  // ========== HÀM CẬP NHẬT DỮ LIỆU MAP (GỘP SALEMAN + POS) ==========
  const updateMapData = useCallback(
    (map, salesmen) => {
      // Xóa source và layers cũ nếu có
      if (map.getSource("map-data")) {
        if (map.getLayer("salesman-points")) map.removeLayer("salesman-points");
        if (map.getLayer("pos-points")) map.removeLayer("pos-points");
        if (map.getLayer("cluster-count")) map.removeLayer("cluster-count");
        if (map.getLayer("clusters")) map.removeLayer("clusters");
        if (map.getLayer("salesman-pulse")) map.removeLayer("salesman-pulse");
        map.removeSource("map-data");
      }

      // Tạo GeoJSON gộp cả salesmen VÀ point of sale
      const combinedGeoJSON = {
        type: "FeatureCollection",
        features: [
          // Features từ salesmen (thêm type vào properties)
          ...salesmen
            .filter((sm) => sm.long && sm.lat)
            .map((sm) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [parseFloat(sm.long), parseFloat(sm.lat)],
              },
              properties: {
                ...sm,
                dataType: "salesman", // ← QUAN TRỌNG: đánh dấu loại data
                salesmanStatus: sm.is_online === 1 ? "online" : "offline",
              },
            })),
          // Features từ point of sale (thêm type vào properties)
          ...pointOfSale
            .filter((pos) => pos.long && pos.lat)
            .map((pos) => ({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: [parseFloat(pos.long), parseFloat(pos.lat)],
              },
              properties: {
                ...pos,
                dataType: "pointOfSale", // ← QUAN TRỌNG: đánh dấu loại data
                marker: pos.marker?.toUpperCase() || "GRAY",
              },
            })),
        ],
      };

      // Thêm source mới
      map.addSource("map-data", {
        type: "geojson",
        data: combinedGeoJSON,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });

      // Tạm thời tất cả nhân viên dùng màu xanh
      const saleman_green = createSVGMarker(APP_COLORS.GREEN, USER_ICON_SVG);
      const saleman_red = createSVGMarker(APP_COLORS.RED, USER_ICON_SVG);
      const saleman_yellow = createSVGMarker(APP_COLORS.YELLOW, USER_ICON_SVG);
      const saleman_gray = createSVGMarker(APP_COLORS.GRAY, USER_ICON_SVG);

      const pos_green = createSVGMarker(APP_COLORS.GREEN, POS_ICON_SVG);
      const pos_yellow = createSVGMarker(APP_COLORS.YELLOW, POS_ICON_SVG);
      const pos_red = createSVGMarker(APP_COLORS.RED, POS_ICON_SVG);
      const pos_gray = createSVGMarker(APP_COLORS.GRAY, POS_ICON_SVG);

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
          source: "map-data",
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
          source: "map-data",
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
          source: "map-data",
          filter: [
            "all",
            ["!", ["has", "point_count"]], // không phải cluster
            ["==", ["get", "dataType"], "salesman"], // CHỈ khi là salesman
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
          source: "map-data",
          filter: [
            "all",
            ["!", ["has", "point_count"]], // không phải cluster
            ["==", ["get", "dataType"], "salesman"], // ← CHỈ salesmen
          ],
          layout: {
            "icon-image": [
              "case",
              ["==", ["get", "salesmanStatus"], "online"],
              "icon-saleman-green",
              "icon-saleman-red",
            ],
            "icon-size": ["step", ["zoom"], 0.8, 16, 1.2],
            "icon-allow-overlap": true,
            "icon-anchor": "bottom",
          },
        });

        // === LAYER 5: POINT OF SALE (CHỈ point of sale) ===
        map.addLayer({
          id: "pos-points",
          type: "symbol",
          source: "map-data",
          filter: [
            "all",
            ["!", ["has", "point_count"]], // không phải cluster
            ["==", ["get", "dataType"], "pointOfSale"], // ← CHỈ point of sale
          ],
          layout: {
            "icon-image": [
              "case",
              ["==", ["get", "marker"], "GREEN"],
              "icon-pos-green",
              ["==", ["get", "marker"], "YELLOW"],
              "icon-pos-yellow",
              ["==", ["get", "marker"], "RED"],
              "icon-pos-red",
              "icon-pos-gray",
            ],
            "icon-size": ["step", ["zoom"], 0.8, 16, 1.2],
            "icon-allow-overlap": true,
            "icon-anchor": "bottom",
            // POS markers không xoay
            "icon-rotate": 0,
          },
        });
      };

      // Load icons cho tất cả nhân viên
      loadImageFromSVG(saleman_green, "icon-saleman-green", onAllLoaded);
      loadImageFromSVG(saleman_red, "icon-saleman-red", onAllLoaded);
      loadImageFromSVG(saleman_yellow, "icon-saleman-yellow", onAllLoaded);
      loadImageFromSVG(saleman_gray, "icon-saleman-gray", onAllLoaded);

      loadImageFromSVG(pos_green, "icon-pos-green", onAllLoaded);
      loadImageFromSVG(pos_yellow, "icon-pos-yellow", onAllLoaded);
      loadImageFromSVG(pos_red, "icon-pos-red", onAllLoaded);
      loadImageFromSVG(pos_gray, "icon-pos-gray", onAllLoaded);
    },
    [saleMan, pointOfSale]
  );

  // === KHỞI TẠO MAP (CHỈ 1 LẦN) ===
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new goongjs.Map({
      container: mapContainerRef.current,
      style: "https://tiles.goong.io/assets/goong_map_web.json",
      center: [106.72055776537006, 10.803239881310812],
      zoom: 12,
    });

    mapRef.current = map;

    map.on("load", () => {
      setIsMapLoaded(true); // Đánh dấu map đã load

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
        e.originalEvent.stopPropagation();
        const feature = e.features[0];
        const sm = feature.properties;
        // Nếu popup đã tồn tại và đang hiển thị, đóng nó đi
        if (map._salesmanPopup) {
          closeSalesmanPopup(map);
        } else {
          showSalesmanPopup(map, sm, feature.geometry.coordinates, true);
        }
      });

      // Hover vào salesman marker → hiện popup
      map.on("mouseenter", "salesman-points", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features[0];
        const sm = feature.properties;
        // Chỉ show popup nếu chưa có popup nào từ click (tránh duplicate)
        if (!map._salesmanPopup || !map._salesmanPopup._isFromClick) {
          showSalesmanPopup(map, sm, feature.geometry.coordinates, false);
        }
      });

      // Mouseleave → đóng popup (chỉ đóng popup từ hover, không đóng popup từ click)
      map.on("mouseleave", "salesman-points", () => {
        map.getCanvas().style.cursor = "";
        // Chỉ đóng popup nếu nó được tạo từ hover (không phải từ click)
        if (map._salesmanPopup && !map._salesmanPopup._isFromClick) {
          closeSalesmanPopup(map);
        }
      });

      // Click vào điểm bán → hiện popup (popup này sẽ không tự đóng khi mouseleave)
      map.on("click", "pos-points", (e) => {
        e.originalEvent.stopPropagation();
        const feature = e.features[0];
        const point = feature.properties;
        // Nếu popup đã tồn tại và đang hiển thị, đóng nó đi
        if (map._pointOfSalePopup) {
          closePointOfSalePopup(map);
        } else {
          showPointOfSalePopup(map, point, feature.geometry.coordinates, true);
        }
      });

      // Hover vào POS marker → hiện popup
      map.on("mouseenter", "pos-points", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features[0];
        const point = feature.properties;
        // Chỉ show popup nếu chưa có popup nào từ click (tránh duplicate)
        if (!map._pointOfSalePopup || !map._pointOfSalePopup._isFromClick) {
          showPointOfSalePopup(map, point, feature.geometry.coordinates, false);
        }
      });

      // Mouseleave → đóng popup (chỉ đóng popup từ hover, không đóng popup từ click)
      map.on("mouseleave", "pos-points", () => {
        map.getCanvas().style.cursor = "";
        // Chỉ đóng popup nếu nó được tạo từ hover (không phải từ click)
        if (map._pointOfSalePopup && !map._pointOfSalePopup._isFromClick) {
          closePointOfSalePopup(map);
        }
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

    return () => {
      map.remove();
      setIsMapLoaded(false);
    };
  }, []); // CHỈ chạy 1 lần khi mount

  // === VẼ: KHI CÓ DATA VÀ MAP ĐÃ LOAD ===
  useEffect(() => {
    if (!mapRef.current || !isMapLoaded) return;
    if (saleMan.length === 0) return;

    // Gọi hàm vẽ data
    updateMapData(mapRef.current, saleMan);
    flyToSalesman(mapRef.current, saleMan);
  }, [saleMan, isMapLoaded, updateMapData, flyToSalesman]);

  return (
    <div
      ref={mapContainerRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100vw",
        height: "100vh",
      }}
    />
  );
}
