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
import { Alert, Button } from "antd";

goongjs.accessToken = accessToken;

export default function RouteMap() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const routeAnimationTimerRef = useRef(null); // Thêm ref để lưu timer
  const routeAnimationIdRef = useRef(null); // requestAnimationFrame ID
  const routeAnimationStateRef = useRef({
    currentIndex: 1,
    fullCoordinates: [],
    isPaused: false,
    startTime: null, // Thời gian bắt đầu animation
  }); // Lưu trạng thái animation
  const [shouldDrawRoute, setShouldDrawRoute] = useState(false); // mặc định là false → không vẽ animation
  const [showStaticRoute, setShowStaticRoute] = useState(false); // Bật/tắt hiển thị lộ trình tĩnh
  const [isPaused, setIsPaused] = useState(false); // Trạng thái tạm dừng
  const [isAnimating, setIsAnimating] = useState(false); // Trạng thái đang animation

  // Lưu query params vào state khi mount lần đầu
  const [queryParams, setQueryParams] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return {
      salemanCode: params.get("saleman_code"),
      from: params.get("from"),
      to: params.get("to"),
    };
  });

  // // Cập nhật query params khi URL thay đổi
  useEffect(() => {
    const updateQueryParams = () => {
      const params = new URLSearchParams(window.location.search);
      const newParams = {
        salemanCode: params.get("saleman_code"),
        from: params.get("from"),
        to: params.get("to"),
      };

      setQueryParams((prev) => {
        if (!prev.from || !prev.to || !prev.salemanCode) {
          return newParams;
        }
        if (
          prev.salemanCode !== newParams.salemanCode ||
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
  const { salemanCode, from, to } = queryParams;

  // Sử dụng hooks để fetch data
  const pointOfSale = usePointofSale(salemanCode, from, to);
  const salemanTracking = useSalemanRouteTracking(salemanCode, from, to);

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

    const popup = new goongjs.Popup({ offset: 25, closeButton: true, maxWidth: "350px" })
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

  // POPUP SALEMAN
  const showSalemanPopup = useCallback((map, salemanCode, coords, isFromClick = false) => {
    // Xóa popup cũ nếu có
    if (map._salemanPopup) {
      map._salemanPopup.remove();
      map._salemanPopup = null;
    }

    const html = `
      <div class="salesman-popup">
        <ul>
          <li> <strong>Nhân viên</strong> </li>
          <li><strong>Code:</strong> ${salemanCode}</li>
          <li><strong>Vị trí hiện tại</strong></li>
        </ul>
      </div>`;

    const popup = new goongjs.Popup({ offset: 25, closeButton: true, maxWidth: "350px" })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map);

    // Đánh dấu popup có phải từ click hay không
    popup._isFromClick = isFromClick;

    // Lưu popup instance vào map để có thể remove sau
    map._salemanPopup = popup;

    // Xóa popup khi popup tự đóng (click close button)
    popup.on("close", () => {
      map._salemanPopup = null;
    });
  }, []);

  // Hàm đóng popup saleman
  const closeSalemanPopup = useCallback((map) => {
    if (map._salemanPopup) {
      map._salemanPopup.remove();
      map._salemanPopup = null;
    }
  }, []);

  // ========== HÀM KIỂM TRA CÓ MARKER POS GẦN ĐÓ KHÔNG ==========
  const hasNearbyPOSMarker = useCallback(
    (salemanCoord, posPoints, thresholdMeters = 5) => {
      if (!posPoints || posPoints.length === 0) return false;
      if (!salemanCoord) return false;

      // Kiểm tra xem có điểm POS nào trong bán kính thresholdMeters không
      for (const pos of posPoints) {
        if (!pos.long || !pos.lat) continue;
        const posCoord = [parseFloat(pos.long), parseFloat(pos.lat)];
        const distance = getDistanceMeters(salemanCoord, posCoord);
        if (distance <= thresholdMeters) {
          return true;
        }
      }
      return false;
    },
    [getDistanceMeters]
  );

  // ========== HÀM CẬP NHẬT DỮ LIỆU MAP (GỘP SALEMAN + POS) ==========
  const updateMapData = useCallback(
    (map, salemanCoordinates, posPoints) => {
      // Xóa source và layers cũ nếu có
      if (map.getSource("map-data")) {
        if (map.getLayer("saleman-marker-point")) map.removeLayer("saleman-marker-point");
        if (map.getLayer("point-of-sale-points")) map.removeLayer("point-of-sale-points");
        if (map.getLayer("point-of-sale-cluster-count"))
          map.removeLayer("point-of-sale-cluster-count");
        if (map.getLayer("point-of-sale-clusters")) map.removeLayer("point-of-sale-clusters");
        map.removeSource("map-data");
      }

      // Lấy điểm cuối cùng làm vị trí hiện tại của saleman
      const currentPosition =
        salemanCoordinates && salemanCoordinates.length > 0
          ? salemanCoordinates[salemanCoordinates.length - 1]
          : null;

      // Kiểm tra có marker POS gần đó không
      const hasNearbyPOS = currentPosition
        ? hasNearbyPOSMarker(currentPosition, posPoints, 150)
        : false;

      // Tạo GeoJSON gộp cả saleman VÀ point of sale
      const combinedGeoJSON = {
        type: "FeatureCollection",
        features: [
          // Feature từ saleman (nếu có)
          ...(currentPosition
            ? [
                {
                  type: "Feature",
                  geometry: {
                    type: "Point",
                    coordinates: currentPosition,
                  },
                  properties: {
                    dataType: "saleman", // ← QUAN TRỌNG: đánh dấu loại data
                    salemanCode: salemanCode,
                    hasNearby: hasNearbyPOS ? 1 : 0,
                  },
                },
              ]
            : []),
          // Features từ point of sale (thêm type vào properties)
          ...posPoints
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

      // Tạo icon cho saleman và POS
      const saleman_icon = createSVGMarker(APP_COLORS.GREEN, USER_ICON_SVG);
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
          id: "point-of-sale-cluster-count",
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

        // === LAYER 3: SALEMAN MARKER ===
        map.addLayer({
          id: "saleman-marker-point",
          type: "symbol",
          source: "map-data",
          filter: [
            "all",
            ["!", ["has", "point_count"]], // không phải cluster
            ["==", ["get", "dataType"], "saleman"], // CHỈ saleman
          ],
          layout: {
            "icon-image": "icon-saleman-current",
            "icon-size": ["step", ["zoom"], 0.8, 16, 1.2],
            "icon-allow-overlap": true,
            "icon-anchor": "bottom",
            "icon-rotate": ["case", ["==", ["get", "hasNearby"], 1], 45, 0],
            "icon-rotation-alignment": "map",
          },
        });

        // === LAYER 4: POS POINTS ===
        map.addLayer({
          id: "point-of-sale-points",
          type: "symbol",
          source: "map-data",
          filter: [
            "all",
            ["!", ["has", "point_count"]], // không phải cluster
            ["==", ["get", "dataType"], "pointOfSale"], // CHỈ point of sale
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
            "icon-rotate": 0,
          },
        });

        // Đăng ký event listeners chỉ 1 lần (kiểm tra xem đã đăng ký chưa)
        if (!map._salemanEventsRegistered) {
          // Click vào marker saleman → hiện popup
          map.on("click", "saleman-marker-point", (e) => {
            e.originalEvent.stopPropagation();
            const feature = e.features[0];
            if (map._salemanPopup) {
              closeSalemanPopup(map);
            } else {
              showSalemanPopup(map, salemanCode, feature.geometry.coordinates, true);
            }
          });

          // Hover vào marker saleman → hiện popup
          map.on("mouseenter", "saleman-marker-point", (e) => {
            map.getCanvas().style.cursor = "pointer";
            const feature = e.features[0];
            if (!map._salemanPopup || !map._salemanPopup._isFromClick) {
              showSalemanPopup(map, salemanCode, feature.geometry.coordinates, false);
            }
          });

          // Mouseleave → đóng popup
          map.on("mouseleave", "saleman-marker-point", () => {
            map.getCanvas().style.cursor = "";
            if (map._salemanPopup && !map._salemanPopup._isFromClick) {
              closeSalemanPopup(map);
            }
          });

          // Đánh dấu đã đăng ký events
          map._salemanEventsRegistered = true;
        }
      };

      // Load icons
      loadImageFromSVG(saleman_icon, "icon-saleman-current", onAllLoaded);
      loadImageFromSVG(pos_green, "icon-pos-green", onAllLoaded);
      loadImageFromSVG(pos_yellow, "icon-pos-yellow", onAllLoaded);
      loadImageFromSVG(pos_red, "icon-pos-red", onAllLoaded);
      loadImageFromSVG(pos_gray, "icon-pos-gray", onAllLoaded);
    },
    [salemanCode, showSalemanPopup, closeSalemanPopup, hasNearbyPOSMarker]
  );

  // ========== HÀM CẬP NHẬT CHỈ VỊ TRÍ SALEMAN (DÙNG CHO ANIMATION) ==========
  const updateSalemanMarker = useCallback(
    (map, coordinates, forceNoRotate = false) => {
      if (!coordinates || coordinates.length === 0) return;
      if (!map.getSource("map-data")) return;

      // Lấy điểm cuối cùng làm vị trí hiện tại của saleman
      const currentPosition = coordinates[coordinates.length - 1];
      if (!currentPosition) return;

      // Kiểm tra có marker POS gần đó không
      const hasNearbyPOS = hasNearbyPOSMarker(currentPosition, pointOfSale, 150);

      // Lấy data hiện tại và cập nhật feature saleman
      const currentData = map.getSource("map-data")._data;
      const salemanFeatureIndex = currentData.features.findIndex(
        (f) => f.properties.dataType === "saleman"
      );

      if (salemanFeatureIndex !== -1) {
        // Cập nhật vị trí saleman
        currentData.features[salemanFeatureIndex].geometry.coordinates = currentPosition;
        currentData.features[salemanFeatureIndex].properties.hasNearby = forceNoRotate
          ? 0
          : hasNearbyPOS
          ? 1
          : 0;
      } else {
        // Thêm feature saleman nếu chưa có
        currentData.features.unshift({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: currentPosition,
          },
          properties: {
            dataType: "saleman",
            salemanCode: salemanCode,
            hasNearby: forceNoRotate ? 0 : hasNearbyPOS ? 1 : 0,
          },
        });
      }

      map.getSource("map-data").setData(currentData);
    },
    [salemanCode, hasNearbyPOSMarker, pointOfSale]
  );

  // ========== HÀM VẼ ROUTE TĨNH (KHÔNG ANIMATION) ==========
  const drawRouteStatic = useCallback((map, coordinates) => {
    if (!coordinates || coordinates.length === 0) {
      // console.log("⚠️ [drawRouteStatic] Coordinates rỗng, không vẽ");
      return;
    }

    // Clear timer cũ nếu có
    if (routeAnimationTimerRef.current) {
      clearInterval(routeAnimationTimerRef.current);
      routeAnimationTimerRef.current = null;
    }

    // Cancel animation frame nếu có
    if (routeAnimationIdRef.current) {
      cancelAnimationFrame(routeAnimationIdRef.current);
      routeAnimationIdRef.current = null;
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
          "line-opacity": 0.6,
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
  const startRouteAnimation = useCallback(
    (map, fullCoordinates, startIndex = 1) => {
      if (!map || !map.getSource("route")) return;

      setIsAnimating(true);
      setIsPaused(false);
      routeAnimationStateRef.current.isPaused = false;
      routeAnimationStateRef.current.currentIndex = startIndex;
      routeAnimationStateRef.current.fullCoordinates = fullCoordinates;
      routeAnimationStateRef.current.startTime = null; // Reset start time

      // Cập nhật marker với forceNoRotate = true khi bắt đầu animation
      if (fullCoordinates.length > 0) {
        const currentCoords = fullCoordinates.slice(0, startIndex);
        updateSalemanMarker(map, currentCoords.length > 0 ? currentCoords : fullCoordinates, true);
      }

      // Hàm cập nhật line và marker
      const updateLineAndMarker = (coords, index) => {
        if (!map.getSource("route")) return;

        // 1. Cập nhật line
        const currentData = map.getSource("route")._data;
        currentData.features[0].geometry.coordinates.push(coords[index]);
        map.getSource("route").setData(currentData);

        // 2. Cập nhật marker salesman trong map-data
        if (map.getSource("map-data")) {
          const mapData = map.getSource("map-data")._data;
          const salemanFeatureIndex = mapData.features.findIndex(
            (f) => f.properties.dataType === "saleman"
          );

          if (salemanFeatureIndex !== -1) {
            // Cập nhật vị trí saleman
            mapData.features[salemanFeatureIndex].geometry.coordinates = coords[index];
            // Không xoay icon trong khi animation
            mapData.features[salemanFeatureIndex].properties.hasNearby = 0;
          } else {
            // Thêm feature saleman nếu chưa có
            mapData.features.unshift({
              type: "Feature",
              geometry: {
                type: "Point",
                coordinates: coords[index],
              },
              properties: {
                dataType: "saleman",
                salemanCode: salemanCode,
                hasNearby: 0,
              },
            });
          }
          map.getSource("map-data").setData(mapData);
        }

        // 3. Pan map đến điểm mới
        map.panTo(coords[index]);
      };

      // Hàm animate với requestAnimationFrame
      const animate = (timestamp) => {
        // Kiểm tra nếu đang pause thì không làm gì
        if (routeAnimationStateRef.current.isPaused) {
          routeAnimationIdRef.current = requestAnimationFrame(animate);
          return;
        }

        // Khởi tạo startTime lần đầu
        if (!routeAnimationStateRef.current.startTime) {
          routeAnimationStateRef.current.startTime = timestamp;
        }

        const elapsed = timestamp - routeAnimationStateRef.current.startTime;
        const coords = routeAnimationStateRef.current.fullCoordinates;

        // Tính index dựa trên thời gian (300ms mỗi bước)
        const calculatedIndex = Math.floor(elapsed / 300) + startIndex;

        // Chỉ cập nhật khi có điểm mới
        if (
          calculatedIndex > routeAnimationStateRef.current.currentIndex &&
          calculatedIndex < coords.length
        ) {
          // Cập nhật tất cả các điểm từ currentIndex đến calculatedIndex
          for (let i = routeAnimationStateRef.current.currentIndex; i < calculatedIndex; i++) {
            updateLineAndMarker(coords, i);
          }
          routeAnimationStateRef.current.currentIndex = calculatedIndex;
        }

        // Tiếp tục animation nếu chưa hết
        if (calculatedIndex < coords.length) {
          routeAnimationIdRef.current = requestAnimationFrame(animate);
        } else {
          // Dừng animation khi đã vẽ hết
          if (routeAnimationIdRef.current) {
            cancelAnimationFrame(routeAnimationIdRef.current);
            routeAnimationIdRef.current = null;
          }
          setIsAnimating(false);

          // Khôi phục lại marker về trạng thái bình thường (không force no rotate)
          if (coords.length > 0) {
            updateSalemanMarker(map, coords, false);
          }

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
      };

      // Bắt đầu animation
      routeAnimationIdRef.current = requestAnimationFrame(animate);
    },
    [salemanCode, hasNearbyPOSMarker, pointOfSale, updateSalemanMarker]
  );

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
            "line-opacity": 1,
            "line-width": 6,
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
      // Click vào điểm bán → hiện popup (popup này sẽ không tự đóng khi mouseleave)
      map.on("click", "point-of-sale-points", (e) => {
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

      // Hover vào marker → hiện popup
      map.on("mouseenter", "point-of-sale-points", (e) => {
        map.getCanvas().style.cursor = "pointer";
        const feature = e.features[0];
        const point = feature.properties;
        // Chỉ show popup nếu chưa có popup nào từ click (tránh duplicate)
        if (!map._pointOfSalePopup || !map._pointOfSalePopup._isFromClick) {
          showPointOfSalePopup(map, point, feature.geometry.coordinates, false);
        }
      });

      // Mouseleave → đóng popup (chỉ đóng popup từ hover, không đóng popup từ click)
      map.on("mouseleave", "point-of-sale-points", () => {
        map.getCanvas().style.cursor = "";
        // Chỉ đóng popup nếu nó được tạo từ hover (không phải từ click)
        if (map._pointOfSalePopup && !map._pointOfSalePopup._isFromClick) {
          closePointOfSalePopup(map);
        }
      });

      // Click vào cluster → zoom in
      map.on("click", "point-of-sale-clusters", (e) => {
        const features = e.features;
        const clusterId = features[0].properties.cluster_id;
        map.getSource("map-data").getClusterExpansionZoom(clusterId, (err, zoom) => {
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

  // ========== CẬP NHẬT DỮ LIỆU MAP KHI pointOfSale HOẶC routeCoordinates THAY ĐỔI ==========
  useEffect(() => {
    if (!mapRef.current || !mapRef.current.loaded()) return;

    // Cập nhật map data với cả saleman và POS
    updateMapData(mapRef.current, routeCoordinates, pointOfSale);
  }, [pointOfSale, routeCoordinates, updateMapData]);

  // Cleanup timer khi component unmount
  useEffect(() => {
    return () => {
      if (routeAnimationTimerRef.current) {
        clearInterval(routeAnimationTimerRef.current);
        routeAnimationTimerRef.current = null;
      }
      //  Cancel animation frame
      if (routeAnimationIdRef.current) {
        cancelAnimationFrame(routeAnimationIdRef.current);
        routeAnimationIdRef.current = null;
      }
    };
  }, []);

  // ========== HÀM XỬ LÝ TẠM DỪNG ==========
  const handlePause = useCallback(() => {
    routeAnimationStateRef.current.isPaused = true;
    setIsPaused(true);
    // Lưu lại thời gian đã trôi qua
    routeAnimationStateRef.current.pausedTime = performance.now();
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

    // Điều chỉnh startTime để tiếp tục từ vị trí đúng
    if (routeAnimationStateRef.current.pausedTime && routeAnimationStateRef.current.startTime) {
      const pauseDuration = performance.now() - routeAnimationStateRef.current.pausedTime;
      routeAnimationStateRef.current.startTime += pauseDuration;
    }

    // Nếu animation đã dừng hoàn toàn, khởi động lại
    if (!routeAnimationIdRef.current) {
      startRouteAnimation(map, fullCoordinates, currentIndex);
    }
  }, [startRouteAnimation]);

  // ========== HÀM XỬ LÝ DỪNG LUÔN ==========
  const handleStop = useCallback(() => {
    // Clear timer cũ (nếu còn dùng setInterval ở đâu đó)
    if (routeAnimationTimerRef.current) {
      clearInterval(routeAnimationTimerRef.current);
      routeAnimationTimerRef.current = null;
    }

    // Cancel animation frame
    if (routeAnimationIdRef.current) {
      cancelAnimationFrame(routeAnimationIdRef.current);
      routeAnimationIdRef.current = null;
    }

    // Xóa route trên map
    const map = mapRef.current;
    if (map && map.loaded()) {
      // Khôi phục lại marker về trạng thái bình thường (cho phép xoay lại nếu gần POS)
      if (routeCoordinates.length > 0) {
        updateSalemanMarker(map, routeCoordinates, false);
      }

      // Xóa route animation layers
      if (map.getLayer("route-line")) {
        map.removeLayer("route-line");
      }
      if (map.getLayer("route-start-point")) {
        map.removeLayer("route-start-point");
      }

      // Xóa route animation sources - QUAN TRỌNG: Xóa riêng từng source
      if (map.getSource("route")) {
        map.removeSource("route");
      }
      if (map.getSource("route-start-point")) {
        map.removeSource("route-start-point");
      }
    }

    // Reset tất cả state
    setShouldDrawRoute(false);
    setIsPaused(false);
    setIsAnimating(false);
    routeAnimationStateRef.current = {
      currentIndex: 1,
      fullCoordinates: [],
      isPaused: false,
      startTime: null,
    };
  }, [updateSalemanMarker, routeCoordinates]);

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

    // Bật showStaticRoute: nếu không còn dữ liệu route thì xoá route tĩnh cũ
    if (routeCoordinates.length === 0) {
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
      {/* Nút bấm nổi trên bản đồ / hoặc thông báo lỗi nếu không có lộ trình */}
      {!shouldDrawRoute && (
        <div
          style={{
            position: "absolute",
            top: "20px", // thấp hơn DatePicker + Alert
            left: "20px",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {/* Nút bật/tắt lộ trình tĩnh - độc lập với animation */}
          {routeCoordinates.length > 0 && (
            <Button
              danger={showStaticRoute}
              type="primary"
              onClick={() => setShowStaticRoute((prev) => !prev)}
              style={{
                height: 40,
                padding: "0 18px",
                borderRadius: "8px",
                fontSize: "14px",
                fontWeight: "bold",
                // backgroundColor: showStaticRoute ? "red" : "blue",
              }}
            >
              {showStaticRoute ? "Tắt lộ trình tĩnh" : "Bật lộ trình tĩnh"}
            </Button>
          )}

          {routeCoordinates.length > 0 && from == to ? (
            <Button
              type="primary"
              onClick={() => {
                // Bật flag để useEffect phía dưới chạy updateRouteData → vẽ animation
                setShouldDrawRoute(true);
              }}
              style={{
                height: 40,
                padding: "0 24px",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              Xem lộ trình
            </Button>
          ) : (
            from &&
            to &&
            (salemanTracking?.length === 0 || routeCoordinates.length === 0) && (
              <Alert
                title={`Không có lộ trình cho ngày ${from} - ${to}`}
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
            <Button
              type="default"
              onClick={handlePause}
              style={{
                height: 40,
                padding: "0 20px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "bold",
                backgroundColor: "#f39c12",
                color: "white",
                border: "none",
              }}
            >
              Tạm dừng
            </Button>
          )}
          {/* Hiển thị nút Tiếp tục khi đang pause */}
          {isPaused && (
            <Button
              type="default"
              onClick={handleResume}
              style={{
                height: 40,
                padding: "0 20px",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "bold",
                backgroundColor: "#27ae60",
                color: "white",
                border: "none",
              }}
            >
              Tiếp tục
            </Button>
          )}
          {/* Luôn hiển thị nút Dừng luôn */}
          <Button
            danger
            type="primary"
            onClick={handleStop}
            style={{
              height: 40,
              padding: "0 20px",
              borderRadius: "6px",
              fontSize: "14px",
              fontWeight: "bold",
            }}
          >
            Dừng
          </Button>
        </div>
      )}

      <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />
    </div>
  );
}
