// src/types/goong.d.ts - Type definitions cho Goong JS (dựa trên Mapbox GL JS)
declare namespace goongjs {
  // Core Map class
  export interface MapOptions {
    container: HTMLElement | string;
    style: string | object;
    center?: [number, number];
    zoom?: number;
    pitch?: number;
    bearing?: number;
  }

  export class Map {
    constructor(options: MapOptions);
    addControl(
      control: Control,
      position?: "top-left" | "top-right" | "bottom-left" | "bottom-right"
    ): this;
    addLayer(layer: LayerSpecification, beforeId?: string): this;
    addSource(id: string, source: AnySourceData): this;
    addImage(
      name: string,
      image: HTMLImageElement | ImageData,
      options?: { pixelRatio?: number; sdf?: boolean }
    ): void;
    getSource(id: string): AnySourceImpl;
    getLayer(id: string): LayerSpecification | null;
    getStyle(): StyleSpecification;
    setLayoutProperty(layerId: string, name: string, value: any): void;
    on(type: string, layerId: string, listener: (e: MapMouseEvent) => void): this;
    on(type: string, listener: (e: MapEvent) => void): this;
    flyTo(options: {
      center?: [number, number];
      zoom?: number;
      speed?: number;
      pitch?: number;
      easing?: (t: number) => number;
    }): this;
    easeTo(options: { center: [number, number]; zoom: number }): this;
    getCanvas(): HTMLCanvasElement;
    remove(): void;
  }

  // Popup
  export interface PopupOptions {
    closeButton?: boolean;
    closeOnClick?: boolean;
    anchor?: string;
    offset?: number | [number, number];
    maxWidth?: string;
  }

  export class Popup {
    constructor(options?: PopupOptions);
    setLngLat(lngLat: [number, number] | { lng: number; lat: number }): this;
    setHTML(html: string): this;
    addTo(map: Map): this;
  }

  // Controls
  export class NavigationControl {
    constructor(options?: { showCompass?: boolean; showZoom?: boolean; visualizePitch?: boolean });
  }

  export class GeolocateControl {
    constructor(options?: {
      positionOptions?: PositionOptions;
      trackUserLocation?: boolean;
      showUserLocation?: boolean;
      showAccuracyCircle?: boolean;
    });
  }

  // Events (simplified)
  export interface MapEvent {
    target: Map;
    type: string;
  }

  export interface MapMouseEvent extends MapEvent {
    lngLat: { lng: number; lat: number };
    point: { x: number; y: number };
    originalEvent: MouseEvent;
  }

  // Layer/Source specs (simplified)
  export interface LayerSpecification {
    id: string;
    type: "symbol" | "circle" | "line" | "fill";
    source: string;
    filter?: any[]; // eslint-disable-line @typescript-eslint/no-explicit-any
    layout?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
    paint?: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  export type AnySourceData =
    | RasterSourceSpecification
    | VectorSourceSpecification
    | GeoJSONSourceSpecification;
  export interface GeoJSONSourceSpecification {
    type: "geojson";
    data: GeoJSON.FeatureCollection | string;
    cluster?: boolean;
    clusterMaxZoom?: number;
    clusterRadius?: number;
  }

  // Global
  export const accessToken: string;
}

// Augment global window
declare global {
  interface Window {
    goongjs: typeof goongjs;
  }
}

export = goongjs;
