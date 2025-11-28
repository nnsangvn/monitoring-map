import "@goongmaps/goong-js/dist/goong-js.css";
import { useEffect, useRef } from "react";

const GOONG_MAPTILES_KEY = import.meta.env.VITE_GOONG_MAPTILES_KEY;

export default function App() {
  const mapContainer = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Không cần load script nữa vì đã có trong index.html
    // Chỉ cần khởi tạo map
    (window as any).goongjs.accessToken = GOONG_MAPTILES_KEY;

    const map = new (window as any).goongjs.Map({
      container: mapContainer.current!,
      style: "https://tiles.goong.io/assets/goong_map_web.json",
      center: [106.705611, 10.760948],
      zoom: 12,
    });

    // === 1. NÚT ZOOM + / − ===
    map.addControl(
      new (window as any).goongjs.NavigationControl({
        showCompass: false,
        showZoom: true,
        visualizePitch: false,
      }),
      "top-right"
    );

    // Cleanup nếu cần
    return () => {
      map.remove();
    };
  }, []);

  return <div ref={mapContainer} style={{ width: "100vw", height: "100vh" }} />;
}
