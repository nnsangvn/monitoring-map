import { useEffect, useState } from "react";
import { getSalemanTracking } from "../service/api";

export const useSalemanRouteTracking = (salemanCode, from, to, reloadKey = 0) => {
  const [salemanTracking, setSalemanTracking] = useState([]);

  useEffect(() => {
    const loadSalemanTracking = async () => {
      try {
        const res = await getSalemanTracking(salemanCode, from, to);
        if (res?.data?.data) {
          setSalemanTracking(res.data.data);
        }
      } catch (error) {
        console.error("Lỗi khi fetch saleman tracking:", error);
      }
    };
    if (salemanCode) {
      loadSalemanTracking();
    }
  }, [salemanCode, from, to, reloadKey]);

  return salemanTracking;
};
