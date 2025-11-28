import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import NProgress from "nprogress";

NProgress.configure({
  showSpinner: false,
  trickleSpeed: 100,
  minimum: 0.2,
});

const ACCESS_TOKEN = import.meta.env.VITE_ACCESS_TOKEN as string;
const BASE_URL = import.meta.env.VITE_BASE_BACKEND_URL as string;

// Set config defaults when creating the instance
const axiosClient = axios.create({
  baseURL: BASE_URL,
});

// Add a request interceptor
axiosClient.interceptors.request.use(
  function (config: InternalAxiosRequestConfig) {
    NProgress.start();

    if (ACCESS_TOKEN && config.headers) {
      config.headers.Authorization = "Bearer " + ACCESS_TOKEN;
    }

    return config;
  },
  function (error: AxiosError) {
    NProgress.done();
    return Promise.reject(error);
  }
);

// Add a response interceptor
axiosClient.interceptors.response.use(
  function (response: AxiosResponse) {
    NProgress.done();
    // Nếu response có cấu trúc { data: { data: ... } } thì return data.data
    if (response.data && typeof response.data === "object" && "data" in response.data) {
      return response.data;
    }
    return response;
  },
  function (error: AxiosError) {
    NProgress.done();
    if (error.response && error.response.data) {
      return error.response.data;
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
