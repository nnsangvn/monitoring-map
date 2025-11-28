// import axios from "axios";
import type { ApiResponse, SalesMan } from "../types/api";
import axiosClient from "./axiosClient";

const fetchSaleMan = () => {
  const URL = "/report-hierarchical-trees?parent_code=NSM-250708001&type=USER&limit=999";
  return axiosClient.get<ApiResponse<SalesMan>>(URL);
};

export { fetchSaleMan };
