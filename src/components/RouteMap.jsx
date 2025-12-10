import "@goongmaps/goong-js/dist/goong-js.css";
import { useCallback, useEffect, useRef, useState } from "react";
import "../App.css";
import "../index.css";
import { getPointOfSale, getSalemanTracking } from "../service/api";
import { APP_COLORS } from "../constants/colors";
import { POS_ICON_SVG } from "../constants/icon";
import { createSVGMarker } from "../utils/marker";

const GOONG_API_KEY = import.meta.env.VITE_GOONG_API_KEY;
const GOONG_MAPTILES_KEY = import.meta.env.VITE_GOONG_MAPTILES_KEY;

export default function RouteMap() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const routeAnimationTimerRef = useRef(null); // Thêm ref để lưu timer
  const [shouldDrawRoute, setShouldDrawRoute] = useState(false); // mặc định là false → không vẽ
  const params = new URLSearchParams(window.location.search);
  const salemanCode = params.get("saleman_code");
  const from = params.get("from");
  const to = params.get("to");
  // Danh sách điểm bán
  const [pointOfSale, setPointOfSale] = useState([]);
  const [salemanTracking, setSalemanTracking] = useState([]);
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  useEffect(() => {
    const loadPointOfSale = async () => {
      const res = await getPointOfSale(salemanCode, from || "01-12-2025", to || "31-12-2025");
      if (res.data.data) {
        setPointOfSale(res.data.data);
      }
    };
    loadPointOfSale();
  }, [salemanCode, from, to]);

  useEffect(() => {
    const loadSalemanTracking = async () => {
      const res = await getSalemanTracking(salemanCode, from || "01-12-2025", to || "31-12-2025");
      if (res.data.data) {
        setSalemanTracking(res.data.data);
      }
    };
    loadSalemanTracking();
  }, [salemanCode, from, to]);

  useEffect(() => {
    if (salemanTracking.length === 0) {
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

    // Format như trong ví dụ GeoJSON
    const routeData = {
      coordinates: coordinates,
    };

    // console.log("🚀 ~ Route Data (coordinates format):", routeData);
    // console.log("🚀 ~ Coordinates array:", coordinates);

    setRouteCoordinates(coordinates);
  }, [salemanTracking]);

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
    new window.goongjs.Popup({ offset: 25, closeButton: true, maxWidth: "350px" })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map);
  }, []);

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

  // ========== HÀM VẼ ROUTE TỪ SALEMAN TRACKING ==========
  const updateRouteData = useCallback((map, coordinates) => {
    if (!coordinates || coordinates.length === 0) return;

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

    // Setup viewport - jump to điểm đầu tiên
    if (fullCoordinates.length > 0) {
      map.jumpTo({
        center: fullCoordinates[0],
        zoom: 14,
      });
      map.setPitch(30);
    }

    // Animation: thêm từng điểm một theo interval
    let i = 1; // Bắt đầu từ điểm thứ 2 (điểm đầu đã có)
    routeAnimationTimerRef.current = setInterval(() => {
      if (i < fullCoordinates.length && map.getSource("route")) {
        // Lấy data hiện tại
        const currentData = map.getSource("route")._data;

        // Thêm điểm mới vào coordinates
        currentData.features[0].geometry.coordinates.push(fullCoordinates[i]);

        // Update source với data mới
        map.getSource("route").setData(currentData);

        // Pan map đến điểm mới
        map.panTo(fullCoordinates[i]);

        i++;
      } else {
        // Dừng animation khi đã vẽ hết
        if (routeAnimationTimerRef.current) {
          clearInterval(routeAnimationTimerRef.current);
          routeAnimationTimerRef.current = null;
        }

        // Fit bounds để hiển thị toàn bộ route sau khi vẽ xong
        if (fullCoordinates.length > 0) {
          const bounds = fullCoordinates.reduce((bounds, coord) => {
            return bounds.extend(coord);
          }, new window.goongjs.LngLatBounds(fullCoordinates[0], fullCoordinates[0]));

          map.fitBounds(bounds, {
            padding: { top: 50, bottom: 50, left: 50, right: 50 },
            duration: 1000,
          });
        }
      }
    }, 200); // Interval 100ms

    // Fit map để hiển thị toàn bộ route
    if (coordinates.length > 0) {
      const bounds = coordinates.reduce((bounds, coord) => {
        return bounds.extend(coord);
      }, new window.goongjs.LngLatBounds(coordinates[0], coordinates[0]));

      map.fitBounds(bounds, {
        padding: { top: 50, bottom: 50, left: 50, right: 50 },
        duration: 1000,
      });
    }
  }, []);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Set accessToken trước khi tạo map
    if (GOONG_MAPTILES_KEY) {
      window.goongjs.accessToken = GOONG_MAPTILES_KEY;
    }

    const map = new window.goongjs.Map({
      container: mapContainer.current,
      // style: "https://tiles.goong.io/assets/navigation_day.json",
      style: "https://tiles.goong.io/assets/goong_map_web.json",
      center: [106.720527, 10.8032399],
      zoom: 16,
    });

    mapRef.current = map;

    map.on("load", () => {
      // console.log("Map loaded");

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

      // // Nếu đã có dữ liệu pointOfSale, cập nhật ngay
      // if (pointOfSale.length > 0) {
      //   updatePointOfSaleData(map, pointOfSale);
      // }

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

  // Cleanup timer khi component unmount
  useEffect(() => {
    return () => {
      if (routeAnimationTimerRef.current) {
        clearInterval(routeAnimationTimerRef.current);
        routeAnimationTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;
    if (!shouldDrawRoute) return;
    if (routeCoordinates.length === 0) return;

    updateRouteData(map, routeCoordinates);
  }, [shouldDrawRoute, routeCoordinates, updateRouteData]);

  // ========== VẼ ROUTE KHI CÓ COORDINATES ==========
  // useEffect(() => {
  //   if (!mapRef.current || !mapRef.current.loaded()) return;
  //   if (routeCoordinates.length === 0) return;

  //   updateRouteData(mapRef.current, routeCoordinates);
  // }, [routeCoordinates, updateRouteData]);

  return (
    <>
      {/* <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} /> */}
      <div style={{ position: "relative", width: "100%", height: "100vh" }}>
        {/* Nút bấm nổi trên bản đồ */}
        {routeCoordinates.length > 0 && !shouldDrawRoute && (
          <button
            onClick={() => setShouldDrawRoute(true)}
            style={{
              position: "absolute",
              top: "20px",
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 10,
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
        )}

        <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />
      </div>
    </>
  );
}
