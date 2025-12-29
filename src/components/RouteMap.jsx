import "@goongmaps/goong-js/dist/goong-js.css";
import { useCallback, useEffect, useRef, useState } from "react";
import "../App.css";
import "../index.css";
import { APP_COLORS } from "../constants/colors";
import { POS_ICON_SVG, USER_ICON_SVG } from "../constants/icon";
import { createSVGMarker } from "../utils/marker";
import accessToken from "./access_token.jsx";
import { usePointofSale } from "../hooks/usePointofSale.js";
import { useSalemanRouteTracking } from "../hooks/useSalemanRouteTracking.js";
import { DatePicker, Alert } from "antd";
import dayjs from "dayjs";

goongjs.accessToken = accessToken;

export default function RouteMap() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const routeAnimationTimerRef = useRef(null); // Thêm ref để lưu timer
  const routeAnimationStateRef = useRef({ currentIndex: 1, fullCoordinates: [], isPaused: false }); // Lưu trạng thái animation
  const [shouldDrawRoute, setShouldDrawRoute] = useState(false); // mặc định là false → không vẽ animation
  const [showStaticRoute, setShowStaticRoute] = useState(false); // Bật/tắt hiển thị lộ trình tĩnh
  const [isPaused, setIsPaused] = useState(false); // Trạng thái tạm dừng
  const [isAnimating, setIsAnimating] = useState(false); // Trạng thái đang animation
  const [selectedDate, setSelectedDate] = useState(null); // Ngày được chọn từ DatePicker
  const params = new URLSearchParams(window.location.search);
  const salemanCode = params.get("saleman_code");
  const from = params.get("from");
  const to = params.get("to");

  // Format ngày thành dd/mm/yyyy để truyền vào API
  const formattedDate = selectedDate
    ? dayjs(selectedDate).format("DD-MM-YYYY")
    : dayjs().format("DD-MM-YYYY");

  // Sử dụng hooks để fetch data
  const pointOfSale = usePointofSale(salemanCode, from, to);
  const salemanTracking = useSalemanRouteTracking(salemanCode, formattedDate, formattedDate);

  const [routeCoordinates, setRouteCoordinates] = useState([]);

  // ========== HÀM TÍNH KHOẢNG CÁCH GIỮA 2 ĐIỂM ==========
  // Hàm tính khoảng cách giữa 2 điểm [lng, lat] (đơn vị: mét)
  // Dùng công thức Haversine đơn giản
  const getDistanceMeters = useCallback((coord1, coord2) => {
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;

    const R = 6371000; // Bán kính Trái Đất (mét)
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // khoảng cách (mét)
  }, []);

  // ========== HÀM LỌC CÁC ĐIỂM GẦN NHAU ==========
  // Ngưỡng khoảng cách tối thiểu (đơn vị: mét)
  const MIN_DISTANCE = 12; // Bỏ qua nếu gần hơn MIN_DISTANCE mét

  const filterNearbyPoints = useCallback(
    (coordinates) => {
      if (!coordinates || coordinates.length === 0) return [];

      // Luôn giữ điểm đầu tiên
      const filtered = [coordinates[0]];

      for (let i = 1; i < coordinates.length; i++) {
        const lastPoint = filtered[filtered.length - 1];
        const currentPoint = coordinates[i];

        // Chỉ thêm điểm nếu khoảng cách với điểm cuối cùng >= MIN_DISTANCE
        if (getDistanceMeters(lastPoint, currentPoint) >= MIN_DISTANCE) {
          filtered.push(currentPoint);
        }
      }

      return filtered;
    },
    [getDistanceMeters]
  );

  useEffect(() => {
    if (salemanTracking?.length === 0) {
      setRouteCoordinates([]);
      return;
    }

    // Map dữ liệu từ API thành format coordinates [long, lat]
    const coordinates = salemanTracking
      .filter((track) => track.long && track.lat) // Lọc những item có đầy đủ lat, long
      .map((track) => [
        parseFloat(track.long), // Longitude trước
        parseFloat(track.lat), // Latitude sau
      ]);

    // Lọc các điểm gần nhau
    const filteredCoordinates = filterNearbyPoints(coordinates);

    // Format như trong ví dụ GeoJSON
    const routeData = {
      coordinates: filteredCoordinates,
    };

    // console.log("🚀 ~ Route Data (coordinates format):", routeData);
    // console.log("🚀 ~ Coordinates array:", filteredCoordinates);
    // console.log(`🚀 ~ Đã lọc từ ${coordinates.length} xuống ${filteredCoordinates.length} điểm`);

    setRouteCoordinates(filteredCoordinates);
  }, [salemanTracking, filterNearbyPoints]);

  // POPUP POS
  const showPointOfSalePopup = useCallback((map, pointOfSale, coords) => {
    const html = `
      <div class="salesman-popup">
        <ul>
          <li> <strong>${pointOfSale.shop_name}</strong> </li>
          <li><strong>Địa chỉ:</strong> ${pointOfSale.address || "N/A"}</li>
          <li><strong>Trạng thái:</strong> ${pointOfSale.marker_name || "N/A"}</li>
        </ul>
      </div>`;
    new goongjs.Popup({ offset: 25, closeButton: true, maxWidth: "350px" })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map);
  }, []);

  // POPUP SALEMAN
  const showSalemanPopup = useCallback((map, salemanCode, coords) => {
    const html = `
      <div class="salesman-popup">
        <ul>
          <li> <strong>Nhân viên</strong> </li>
          <li><strong>Code:</strong> ${salemanCode}</li>
          <li><strong>Vị trí hiện tại</strong></li>
        </ul>
      </div>`;
    new goongjs.Popup({ offset: 25, closeButton: true, maxWidth: "350px" })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map);
  }, []);

  // ========== HÀM VẼ MARKER CHO SALEMAN ==========
  const updateSalemanMarker = useCallback(
    (map, coordinates) => {
      if (!coordinates || coordinates.length === 0) return;

      // Xóa source và layer cũ nếu có
      if (map.getSource("saleman-marker")) {
        if (map.getLayer("saleman-marker-point")) map.removeLayer("saleman-marker-point");
        map.removeSource("saleman-marker");
      }

      // Lấy điểm cuối cùng làm vị trí hiện tại của saleman
      const currentPosition = coordinates[coordinates.length - 1];

      if (!currentPosition) return;

      // Tạo GeoJSON cho marker saleman
      const salemanMarkerGeoJSON = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: currentPosition,
            },
            properties: {
              salemanCode: salemanCode,
            },
          },
        ],
      };

      // Thêm source cho saleman marker
      map.addSource("saleman-marker", {
        type: "geojson",
        data: salemanMarkerGeoJSON,
      });

      // Tạo icon cho saleman (màu xanh)
      const saleman_icon = createSVGMarker(APP_COLORS.GREEN, USER_ICON_SVG);

      // Hàm load image từ SVG
      const loadImageFromSVG = (svg, name, callback) => {
        const img = new Image();
        img.onload = () => {
          map.addImage(name, img);
          callback();
        };
        img.src = "data:image/svg+xml;base64," + btoa(svg);
      };

      loadImageFromSVG(saleman_icon, "icon-saleman-current", () => {
        // Thêm layer cho saleman marker
        if (!map.getLayer("saleman-marker-point")) {
          map.addLayer({
            id: "saleman-marker-point",
            type: "symbol",
            source: "saleman-marker",
            layout: {
              "icon-image": "icon-saleman-current",
              "icon-size": 1.0,
              "icon-allow-overlap": true,
              "icon-anchor": "bottom",
            },
          });

          // Click vào marker → hiện popup
          map.on("click", "saleman-marker-point", (e) => {
            const feature = e.features[0];
            showSalemanPopup(map, salemanCode, feature.geometry.coordinates);
          });

          // Hover effect
          map.on("mouseenter", "saleman-marker-point", () => {
            map.getCanvas().style.cursor = "pointer";
          });

          map.on("mouseleave", "saleman-marker-point", () => {
            map.getCanvas().style.cursor = "";
          });
        }
      });
    },
    [salemanCode, showSalemanPopup]
  );

  // ========== HÀM CẬP NHẬT DỮ LIỆU ĐIỂM BÁN ==========
  const updatePointOfSaleData = useCallback((map, points) => {
    // Xóa source và layers cũ nếu có
    if (map.getSource("pointOfSale")) {
      if (map.getLayer("point-of-sale-points")) map.removeLayer("point-of-sale-points");
      if (map.getLayer("point-of-sale-cluster-count"))
        map.removeLayer("point-of-sale-cluster-count");
      if (map.getLayer("point-of-sale-clusters")) map.removeLayer("point-of-sale-clusters");
      map.removeSource("pointOfSale");
    }

    // Tạo GeoJSON cho điểm bán (POS)
    const pointOfSaleGeoJSON = {
      type: "FeatureCollection",
      features: points
        .filter((point) => point.long && point.lat)
        .map((point) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [parseFloat(point.long), parseFloat(point.lat)],
          },
          properties: {
            ...point,
            marker: point.marker?.toUpperCase() || "GRAY",
          },
        })),
    };

    // Thêm source mới
    map.addSource("pointOfSale", {
      type: "geojson",
      data: pointOfSaleGeoJSON,
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    });

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
      if (map.getLayer("point-of-sale-clusters")) return;
      // === LAYER 1: CLUSTER CIRCLES ===
      map.addLayer({
        id: "point-of-sale-clusters",
        type: "circle",
        source: "pointOfSale",
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
        id: "point-of-sale-cluster-count",
        type: "symbol",
        source: "pointOfSale",
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
        id: "point-of-sale-points",
        type: "symbol",
        source: "pointOfSale",
        filter: ["!", ["has", "point_count"]],
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
          "icon-size": 0.8,
          "icon-allow-overlap": true,
          "icon-anchor": "bottom",
        },
      });
    };

    // Load icon cho tất cả điểm bán
    loadImageFromSVG(pos_green, "icon-pos-green", onAllLoaded);
    loadImageFromSVG(pos_yellow, "icon-pos-yellow", onAllLoaded);
    loadImageFromSVG(pos_red, "icon-pos-red", onAllLoaded);
    loadImageFromSVG(pos_gray, "icon-pos-gray", onAllLoaded);
  }, []);

  // ========== HÀM VẼ ROUTE TĨNH (KHÔNG ANIMATION) ==========
  const drawRouteStatic = useCallback((map, coordinates) => {
    // console.log("🎨 [drawRouteStatic] Hàm được gọi với", coordinates?.length || 0, "điểm");
    if (!coordinates || coordinates.length === 0) {
      // console.log("⚠️ [drawRouteStatic] Coordinates rỗng, không vẽ");
      return;
    }

    // Clear timer cũ nếu có
    if (routeAnimationTimerRef.current) {
      clearInterval(routeAnimationTimerRef.current);
      routeAnimationTimerRef.current = null;
    }

    // Xóa source và layer cũ của route tĩnh nếu có
    if (map.getSource("route-static")) {
      if (map.getLayer("route-static-line")) map.removeLayer("route-static-line");
      map.removeSource("route-static");
    }

    // Xóa source route-static-start-point nếu tồn tại
    if (map.getSource("route-static-start-point")) {
      if (map.getLayer("route-static-start-point")) map.removeLayer("route-static-start-point");
      map.removeSource("route-static-start-point");
    }

    // Tạo data với TOÀN BỘ coordinates cho route tĩnh
    const routeData = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: {
            type: "LineString",
            coordinates: coordinates, // Vẽ toàn bộ route một lần
          },
          properties: {},
        },
      ],
    };

    // Thêm source cho route tĩnh với toàn bộ coordinates
    map.addSource("route-static", {
      type: "geojson",
      data: routeData,
    });

    // Thêm layer để vẽ đường đi (tĩnh)
    if (!map.getLayer("route-static-line")) {
      map.addLayer({
        id: "route-static-line",
        type: "line",
        source: "route-static",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "green", // màu của line
          "line-opacity": 0.75,
          "line-width": 5,
        },
      });
    }

    // Thêm điểm bắt đầu (start marker) cho route tĩnh
    if (coordinates.length > 0) {
      const startPointGeoJSON = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "Point",
              coordinates: coordinates[0],
            },
            properties: {
              type: "start",
            },
          },
        ],
      };

      map.addSource("route-static-start-point", {
        type: "geojson",
        data: startPointGeoJSON,
      });

      // Thêm layer cho điểm bắt đầu (tĩnh)
      if (!map.getLayer("route-static-start-point")) {
        map.addLayer({
          id: "route-static-start-point",
          type: "circle",
          source: "route-static-start-point",
          paint: {
            "circle-radius": 8,
            "circle-color": "#00ff00",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      }
    }

    // Fit bounds để hiển thị toàn bộ route
    if (coordinates.length > 0) {
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new window.goongjs.LngLatBounds(coordinates[0], coordinates[0]));

      map.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        duration: 2000,
      });
    }

    // Set state
    setIsAnimating(false);
    setIsPaused(false);

    // console.log("✅ [drawRouteStatic] Đã vẽ xong route tĩnh với", coordinates.length, "điểm");
  }, []);

  // ========== HÀM BẮT ĐẦU ANIMATION ROUTE ==========
  const startRouteAnimation = useCallback((map, fullCoordinates, startIndex = 1) => {
    if (!map || !map.getSource("route")) return;

    setIsAnimating(true);
    setIsPaused(false);
    routeAnimationStateRef.current.isPaused = false;
    routeAnimationStateRef.current.currentIndex = startIndex;
    routeAnimationStateRef.current.fullCoordinates = fullCoordinates;

    routeAnimationTimerRef.current = setInterval(() => {
      // Kiểm tra nếu đang pause thì không làm gì
      if (routeAnimationStateRef.current.isPaused) {
        return;
      }

      const i = routeAnimationStateRef.current.currentIndex;
      const coords = routeAnimationStateRef.current.fullCoordinates;

      if (i < coords.length && map.getSource("route")) {
        // Lấy data hiện tại
        const currentData = map.getSource("route")._data;

        // Thêm điểm mới vào coordinates
        currentData.features[0].geometry.coordinates.push(coords[i]);

        // Update source với data mới
        map.getSource("route").setData(currentData);

        // Pan map đến điểm mới
        map.panTo(coords[i]);

        routeAnimationStateRef.current.currentIndex = i + 1;
      } else {
        // Dừng animation khi đã vẽ hết
        if (routeAnimationTimerRef.current) {
          clearInterval(routeAnimationTimerRef.current);
          routeAnimationTimerRef.current = null;
        }
        setIsAnimating(false);

        // Fit bounds để hiển thị toàn bộ route sau khi vẽ xong
        if (coords.length > 0) {
          const bounds = coords.reduce((bounds, coord) => {
            return bounds.extend(coord);
          }, new window.goongjs.LngLatBounds(coords[0], coords[0]));

          map.fitBounds(bounds, {
            padding: { top: 50, bottom: 50, left: 50, right: 50 },
            duration: 2000,
          });
        }
      }
    }, 300); // Interval 200ms - Tốc độ vẽ
  }, []);

  // ========== HÀM VẼ ROUTE TỪ SALEMAN TRACKING ==========
  const updateRouteData = useCallback(
    (map, coordinates) => {
      if (!coordinates || coordinates.length === 0) return;

      // Set isAnimating ngay từ đầu để các nút điều khiển hiển thị
      setIsAnimating(true);
      setIsPaused(false);

      // Clear timer cũ nếu có
      if (routeAnimationTimerRef.current) {
        clearInterval(routeAnimationTimerRef.current);
        routeAnimationTimerRef.current = null;
      }

      // Xóa source và layer cũ nếu có
      if (map.getSource("route")) {
        if (map.getLayer("route-line")) map.removeLayer("route-line");
        if (map.getLayer("route-start-point")) map.removeLayer("route-start-point");
        map.removeSource("route");
      }

      // Lưu full coordinate list để dùng sau
      const fullCoordinates = [...coordinates];

      // Bắt đầu chỉ với điểm đầu tiên
      const initialData = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: fullCoordinates.length > 0 ? [fullCoordinates[0]] : [],
            },
            properties: {},
          },
        ],
      };

      // Thêm source cho route với điểm đầu tiên
      map.addSource("route", {
        type: "geojson",
        data: initialData,
      });

      // Thêm layer để vẽ đường đi
      if (!map.getLayer("route-line")) {
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: {
            "line-join": "round",
            "line-cap": "round",
          },
          paint: {
            "line-color": "#3887be",
            "line-opacity": 0.75,
            "line-width": 5,
          },
        });
      }

      // Thêm điểm bắt đầu (start marker)
      if (fullCoordinates.length > 0) {
        const startPointGeoJSON = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: fullCoordinates[0],
              },
              properties: {
                type: "start",
              },
            },
          ],
        };

        map.addSource("route-start-point", {
          type: "geojson",
          data: startPointGeoJSON,
        });

        // Thêm layer cho điểm bắt đầu (có thể tùy chỉnh icon sau)
        if (!map.getLayer("route-start-point")) {
          map.addLayer({
            id: "route-start-point",
            type: "circle",
            source: "route-start-point",
            paint: {
              "circle-radius": 8,
              "circle-color": "#00ff00",
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          });
        }
      }

      // Setup viewport - ease to điểm đầu tiên với animation mượt mà
      if (fullCoordinates.length > 0) {
        map.easeTo({
          center: fullCoordinates[0],
          zoom: 14,
          duration: 2000,
        });
        map.setPitch(30);
      }

      // Bắt đầu animation
      startRouteAnimation(map, fullCoordinates, 1);
    },
    [startRouteAnimation]
  );

  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new goongjs.Map({
      container: mapContainer.current,
      // style: "https://tiles.goong.io/assets/navigation_day.json",
      style: "https://tiles.goong.io/assets/goong_map_web.json",
      center: [106.720527, 10.8032399],
      zoom: 16,
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
      // Click vào điểm bán → hiện popup (có thể tùy chỉnh sau)
      map.on("click", "point-of-sale-points", (e) => {
        const feature = e.features[0];
        const point = feature.properties;
        showPointOfSalePopup(map, point, feature.geometry.coordinates);
      });

      // Hover effect
      map.on("mouseenter", "point-of-sale-points", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "point-of-sale-points", () => {
        map.getCanvas().style.cursor = "";
      });

      // Click vào cluster → zoom in
      map.on("click", "point-of-sale-clusters", (e) => {
        const features = e.features;
        const clusterId = features[0].properties.cluster_id;
        map.getSource("pointOfSale").getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          map.easeTo({
            center: features[0].geometry.coordinates,
            zoom: zoom,
          });
        });
      });

      // Hover effect cho cluster
      map.on("mouseenter", "point-of-sale-clusters", () => {
        map.getCanvas().style.cursor = "pointer";
      });

      map.on("mouseleave", "point-of-sale-clusters", () => {
        map.getCanvas().style.cursor = "";
      });
    });

    return () => {
      map.remove();
    };
  }, []); // CHỈ chạy 1 lần khi mount

  // ========== CẬP NHẬT DỮ LIỆU KHI pointOfSale THAY ĐỔI ==========
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.loaded()) return;
    if (pointOfSale.length === 0) return;

    updatePointOfSaleData(mapRef.current, pointOfSale);
  }, [pointOfSale, updatePointOfSaleData]);

  // ========== CẬP NHẬT MARKER SALEMAN KHI CÓ DỮ LIỆU TRACKING ==========
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.loaded()) return;
    if (routeCoordinates.length === 0) return;

    updateSalemanMarker(mapRef.current, routeCoordinates);
  }, [routeCoordinates, updateSalemanMarker]);

  // Cleanup timer khi component unmount
  useEffect(() => {
    return () => {
      if (routeAnimationTimerRef.current) {
        clearInterval(routeAnimationTimerRef.current);
        routeAnimationTimerRef.current = null;
      }
    };
  }, []);

  // ========== HÀM XỬ LÝ TẠM DỪNG ==========
  const handlePause = useCallback(() => {
    routeAnimationStateRef.current.isPaused = true;
    setIsPaused(true);
  }, []);

  // ========== HÀM XỬ LÝ TIẾP TỤC ==========
  const handleResume = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.loaded() || !map.getSource("route")) return;

    const { currentIndex, fullCoordinates } = routeAnimationStateRef.current;

    // Nếu đã vẽ hết thì không làm gì
    if (currentIndex >= fullCoordinates.length) {
      setIsAnimating(false);
      return;
    }

    // Tiếp tục animation từ vị trí hiện tại
    routeAnimationStateRef.current.isPaused = false;
    setIsPaused(false);

    // Nếu timer đã bị clear, tạo lại
    if (!routeAnimationTimerRef.current) {
      startRouteAnimation(map, fullCoordinates, currentIndex);
    }
  }, [startRouteAnimation]);

  // ========== HÀM XỬ LÝ DỪNG LUÔN ==========
  const handleStop = useCallback(() => {
    // Clear timer
    if (routeAnimationTimerRef.current) {
      clearInterval(routeAnimationTimerRef.current);
      routeAnimationTimerRef.current = null;
    }

    // Xóa route trên map
    const map = mapRef.current;
    if (map && map.loaded()) {
      if (map.getSource("route")) {
        if (map.getLayer("route-line")) map.removeLayer("route-line");
        if (map.getLayer("route-start-point")) map.removeLayer("route-start-point");
        map.removeSource("route");
      }
    }

    // Reset tất cả state
    setShouldDrawRoute(false);
    setIsPaused(false);
    setIsAnimating(false);
    routeAnimationStateRef.current = { currentIndex: 1, fullCoordinates: [], isPaused: false };
  }, []);

  // ========== VẼ ROUTE TĨNH KHI CÓ DỮ LIỆU ROUTE & MAP ĐÃ LOAD ==========
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;

    // Nếu tắt showStaticRoute thì xóa layer/static source nếu có
    if (!showStaticRoute) {
      if (map.getSource("route-static")) {
        if (map.getLayer("route-static-line")) map.removeLayer("route-static-line");
        map.removeSource("route-static");
      }
      if (map.getSource("route-static-start-point")) {
        if (map.getLayer("route-static-start-point")) map.removeLayer("route-static-start-point");
        map.removeSource("route-static-start-point");
      }
      return;
    }

    // Bật showStaticRoute: chỉ vẽ khi có dữ liệu
    if (routeCoordinates.length === 0) return;

    // console.log("✅ [drawRouteStatic] Bắt đầu vẽ route tĩnh với", routeCoordinates.length, "điểm");
    drawRouteStatic(map, routeCoordinates);
  }, [routeCoordinates, showStaticRoute, drawRouteStatic]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;
    if (!shouldDrawRoute) return;
    if (routeCoordinates.length === 0) return;

    updateRouteData(map, routeCoordinates);
  }, [shouldDrawRoute, routeCoordinates, updateRouteData]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100vh" }}>
      {/* DatePicker để chọn ngày xem lộ trình */}
      <div
        style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          zIndex: 10,
          background: "white",
          padding: "12px",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <DatePicker
          placeholder="Chọn ngày"
          format="DD-MM-YYYY"
          onChange={(date) => setSelectedDate(date)}
          style={{ width: "120px" }}
          allowClear
        />
      </div>

      {/* Nút bấm nổi trên bản đồ / hoặc thông báo lỗi nếu không có lộ trình */}
      {!shouldDrawRoute && (
        <div
          style={{
            position: "absolute",
            top: "90px", // thấp hơn DatePicker + Alert
            left: "20px",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {/* Nút bật/tắt lộ trình tĩnh - độc lập với animation */}
          {routeCoordinates.length > 0 && (
            <button
              onClick={() => setShowStaticRoute((prev) => !prev)}
              style={{
                padding: "8px 18px",
                background: showStaticRoute ? "#16a085" : "#7f8c8d",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "bold",
                boxShadow: "0 3px 8px rgba(0,0,0,0.2)",
                cursor: "pointer",
              }}
            >
              {showStaticRoute ? "Tắt lộ trình tĩnh" : "Bật lộ trình tĩnh"}
            </button>
          )}

          {routeCoordinates.length > 0 ? (
            <button
              onClick={() => {
                // Bật flag để useEffect phía dưới chạy updateRouteData → vẽ animation
                setShouldDrawRoute(true);
              }}
              style={{
                padding: "12px 24px",
                background: "#3887be",
                color: "white",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "bold",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
                cursor: "pointer",
              }}
            >
              Xem lộ trình
            </button>
          ) : (
            selectedDate &&
            (salemanTracking?.length === 0 || routeCoordinates.length === 0) && (
              <Alert
                title={`Không có lộ trình cho ngày ${dayjs(selectedDate).format("DD-MM-YYYY")}`}
                type="warning"
                showIcon
                style={{ fontSize: "14px", padding: "8px 12px", background: "white" }}
              />
            )
          )}
        </div>
      )}

      {/* Các nút điều khiển khi đang xem lộ trình */}
      {shouldDrawRoute && routeCoordinates.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "90px", // cùng vị trí với nút "Xem lộ trình"
            left: "20px",
            zIndex: 10,
            display: "flex",
            gap: "12px",
            background: "white",
            padding: "12px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          {/* Hiển thị nút Tạm dừng khi đang animation và chưa pause */}
          {isAnimating && !isPaused && (
            <button
              onClick={handlePause}
              style={{
                padding: "10px 20px",
                background: "#f39c12",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.target.style.background = "#e67e22")}
              onMouseLeave={(e) => (e.target.style.background = "#f39c12")}
            >
              Tạm dừng
            </button>
          )}
          {/* Hiển thị nút Tiếp tục khi đang pause */}
          {isPaused && (
            <button
              onClick={handleResume}
              style={{
                padding: "10px 20px",
                background: "#27ae60",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "bold",
                cursor: "pointer",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) => (e.target.style.background = "#229954")}
              onMouseLeave={(e) => (e.target.style.background = "#27ae60")}
            >
              Tiếp tục
            </button>
          )}
          {/* Luôn hiển thị nút Dừng luôn */}
          <button
            onClick={handleStop}
            style={{
              padding: "10px 20px",
              background: "#e74c3c",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "bold",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => (e.target.style.background = "#c0392b")}
            onMouseLeave={(e) => (e.target.style.background = "#e74c3c")}
          >
            Dừng
          </button>
        </div>
      )}

      <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />
    </div>
  );
}
