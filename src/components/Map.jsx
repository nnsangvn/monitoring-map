import "@goongmaps/goong-js/dist/goong-js.css";
import { useCallback, useEffect, useRef, useState } from "react";
import "../App.css";
import "../index.css";
import { direction, fetchSaleMan } from "../service/api.ts";
import { APP_COLORS } from "../constants/colors.js";
import { USER_ICON_SVG } from "../constants/icon.js";
import { createSVGMarker } from "../utils/marker.js";

const GOONG_MAPTILES_KEY = import.meta.env.VITE_GOONG_MAPTILES_KEY;
const GOONG_API_KEY = import.meta.env.VITE_GOONG_API_KEY;

export default function Map() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const params = new URLSearchParams(window.location.search);
  const parentCode = params.get("parent_code");

  const [saleMan, setSaleMan] = useState([]);

  // const loadDirection = async () => {
  //   const res = await direction();
  //   console.log("🚀 ~ loadDirection ~ res:", res.data);
  //   // if (res.data) {
  //   //   console.log("🚀 ~ loadDirection ~ res.data:", res.data);
  //   // }
  // };

  // loadDirection();

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

    // Thêm event listener cho button sau khi popup được render
    // setTimeout(() => {
    //   const routeButton = document.getElementById("route-button");
    //   if (routeButton) {
    //     routeButton.addEventListener("click", () => {
    //       const salemanCode = routeButton.getAttribute("data-code");
    //       window.location.href = `/?route=true&saleman_code=${salemanCode}`;
    //     });
    //   }
    // }, 100);
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

    // Set accessToken trước khi tạo map
    if (GOONG_MAPTILES_KEY) {
      window.goongjs.accessToken = GOONG_MAPTILES_KEY;
    }

    const map = new window.goongjs.Map({
      container: mapContainer.current,
      style: "https://tiles.goong.io/assets/goong_map_web.json",
      center: [106.72055776537006, 10.803239881310812],
      zoom: 12,
    });

    mapRef.current = map;

    map.on("load", () => {
      // // Tìm layer symbol đầu tiên để chèn tuyến đường phía dưới chữ
      // let firstSymbolId;
      // const layers = map.getStyle().layers;
      // for (let i = 0; i < layers.length; i++) {
      //   if (layers[i].type === "symbol") {
      //     firstSymbolId = layers[i].id;
      //     break;
      //   }
      // }

      // // Khởi tạo Goong SDK
      // const goongClient = goongSdk({ accessToken: GOONG_API_KEY });

      // // Tọa độ gốc và đích (bạn có thể thay đổi)
      // const origin = "10.80167766728457, 106.72081560591285";
      // const destination = "10.800365395965589, 106.71821713931104";
      // const waypoints = [
      //   { coordinates: [10.801663713971633, 106.71895804653684] }, // Điểm 2
      //   // ... thêm bao nhiêu cũng được (tối đa 25 điểm tổng cộng: origin + waypoints + destination)
      // ];

      // goongClient.directions
      //   .getDirections({
      //     origin: origin,
      //     destination: destination,
      //     // waypoints: waypoints,
      //     vehicle: "car",
      //   })
      //   .send()
      //   .then((response) => {
      //     const route = response.body.routes[0];

      //     let geojson = {
      //       type: "Feature",
      //       properties: {},
      //       geometry: {
      //         type: "LineString",
      //         coordinates: [],
      //       },
      //     };

      //     // Ưu tiên dùng overview_polyline nếu hợp lệ
      //     if (route && route.overview_polyline && route.overview_polyline.points) {
      //       try {
      //         const decoded = polyline.toGeoJSON(route.overview_polyline.points);
      //         if (decoded.coordinates && decoded.coordinates.length > 1) {
      //           geojson.geometry.coordinates = decoded.coordinates;
      //         }
      //       } catch (e) {
      //         console.warn("Lỗi decode polyline, dùng fallback", e);
      //       }
      //     }

      //     // Fallback: nếu polyline lỗi hoặc quá ngắn → tự tạo đường thẳng từ start → end
      //     if (geojson.geometry.coordinates.length < 2) {
      //       console.warn("Dùng fallback LineString trực tiếp");
      //       const start = route.legs[0].start_location;
      //       const end = route.legs[0].end_location;
      //       geojson.geometry.coordinates = [
      //         [start.lng, start.lat],
      //         [end.lng, end.lat],
      //       ];
      //     }

      //     // Xóa source/layer cũ nếu đã tồn tại
      //     if (map.getSource("route")) {
      //       map.removeLayer("route");
      //       map.removeSource("route");
      //     }

      //     // Thêm source
      //     map.addSource("route", {
      //       type: "geojson",
      //       data: geojson,
      //     });

      //     // Thêm layer tuyến đường
      //     map.addLayer(
      //       {
      //         id: "route",
      //         type: "line",
      //         source: "route",
      //         layout: {
      //           "line-join": "round",
      //           "line-cap": "round",
      //         },
      //         paint: {
      //           "line-color": "blue",
      //           "line-width": 5,
      //           "line-opacity": 0.9,
      //         },
      //       },
      //       firstSymbolId
      //     ); // vẽ dưới chữ

      //     // Thêm marker điểm đầu và điểm cuối (tùy chọn)
      //     new goongjs.Marker({ color: "#4CAF50" })
      //       .setLngLat([route.legs[0].start_location.lng, route.legs[0].start_location.lat])
      //       .addTo(map);

      //     new goongjs.Marker({ color: "#f44336" })
      //       .setLngLat([route.legs[0].end_location.lng, route.legs[0].end_location.lat])
      //       .addTo(map);

      //     // Fit bản đồ vừa với tuyến đường
      //     const bounds = new goongjs.LngLatBounds();
      //     geojson.geometry.coordinates.forEach((coord) => bounds.extend(coord));
      //     map.fitBounds(bounds, { padding: 100, duration: 1500 });
      //   })
      //   .catch((err) => {
      //     console.error("Lỗi gọi Directions API:", err);
      //     alert("Không thể lấy tuyến đường. Kiểm tra API key và mạng!");
      //   });

      // // Direction Matrix
      // goongClient.directions
      //   .getDirectionMatrix({
      //     origins: points.map((p) => p.coords.join(",")),
      //     destinations: points.map((p) => p.coords.join(",")),
      //     vehicle: "car",
      //   })
      //   .send()
      //   .then((response) => {
      //     console.log("🚀 ~ response:", response);
      //   })
      //   .catch((err) => {
      //     console.error("Lỗi gọi Direction Matrix API:", err);
      //     alert("Không thể lấy ma trận tuyến đường. Kiểm tra API key và mạng!");
      //   });

      // TẮT POI + NHÃN KHÔNG CẦN
      map.getStyle().layers.forEach((layer) => {
        const id = layer.id;
        // console.log("🚀 ~ id:", id);
        const type = layer.type;
        //   console.log("🚀 ~ type:", type);
        if (
          layer.type === "symbol" &&
          !id.startsWith("salesman") &&
          !id.startsWith("cluster") &&
          !id.includes("poi-airport") && // Sân bay
          !id.includes("water") &&
          !id.includes("highway-shield-1") && // Quốc Lộ
          !id.includes("highway-shield-2") && // Tỉnh Lộ
          !id.includes("highway-name-major") && // Tên đường chính
          !id.includes("highway-name-medium") && // Tên đường chính
          !id.includes("road-oneway-spaced-large") &&
          !id.includes("road-major") &&
          !id.includes("lake-name_priority_2") &&
          !id.includes("place-city-capital-vietnam") &&
          !id.includes("place-city-capital") && // Thủ đô HN
          !id.includes("place-city1") && // TP trực thuộc TW
          !id.includes("place-city2") && // Tỉnh
          !id.includes("place-village") &&
          !id.includes("lake-name_priority_2") &&
          !id.includes("ocean") && // Biển đông
          !id.includes("place-island") && // Đảo nhỏ
          !id.includes("place-archipelago") // Quần đảo hoàng sa/ Trường Sa
        ) {
          map.setLayoutProperty(id, "visibility", "none");
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
