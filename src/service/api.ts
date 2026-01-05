import type { ApiResponse, SalesMan } from "../types/api";
import axiosClient from "./axiosClient";

const GOONG_API_KEY = import.meta.env.VITE_GOONG_API_KEY;

// ======== DMS - API ========
const fetchSaleMan = (parent_code: string) => {
  const URL = `/report-hierarchical-trees?parent_code=${parent_code}&type=USER&limit=999`;
  return axiosClient.get<ApiResponse<SalesMan>>(URL);
};

// Danh sách điểm bán
// Example from:1-12-2025 to:31-12-2025  dd-mm-yyyy
const getPointOfSale = (salemanCode: string, from?: string, to?: string) => {
  const URL = `https://api-smac.newweb.vn/v0/client/get-client-info-by-map?saleman_code=${salemanCode}&from=${from}&to=${to}`;
  return axiosClient.get(URL);
};

const getSalemanTracking = (salemanCode: string, from: string, to: string) => {
  const URL = `https://api-smac.newweb.vn/v0/client/saleman-route-tracking?saleman_code=${salemanCode}&from=${from}&to=${to}`;
  return axiosClient.get(URL);
};

// ======== Goong API - ========
const direction = () => {
  const URL = `https://rsapi.goong.io/v2/direction?origin=21.046623224000029,105.790168203000060&destination=21.046666732000062,105.790169569000060&vehicle=car&api_key=${GOONG_API_KEY}`;
  return axiosClient.get(URL);
};

export { fetchSaleMan, direction, getPointOfSale, getSalemanTracking };
