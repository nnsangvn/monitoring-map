import { useEffect, useState } from "react";
import { getSalemanTracking } from "../service/api";

export const useSalemanRouteTracking = (salemanCode, from, to) => {
  const [salemanTracking, setSalemanTracking] = useState([]);

  useEffect(() => {
    const loadSalemanTracking = async () => {
      try {
        const res = await getSalemanTracking(salemanCode, from || "01-12-2025", to || "31-12-2025");
        if (res.data.data) {
          setSalemanTracking(res.data.data);
        }
      } catch (error) {
        console.error("Lỗi khi fetch saleman tracking:", error);
      }
    };
    if (salemanCode) {
      loadSalemanTracking();
    }
  }, [salemanCode, from, to]);

  return salemanTracking;
};
