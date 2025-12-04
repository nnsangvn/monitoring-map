import "@goongmaps/goong-js/dist/goong-js.css";
import "./App.css";
import Map from "./components/Map";
import RouteMap from "./components/RouteMap";
import MapLegend from "./components/MapLegend";

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const routeMap = params.get("route") === "true";
  return (
    <>
      {routeMap ? <RouteMap /> : <Map />}
      <MapLegend />
    </>
  );
}
