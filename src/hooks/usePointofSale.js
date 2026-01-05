import { useEffect, useState } from "react";
import { getPointOfSale } from "../service/api";

export const usePointofSale = (salemanCode, from, to) => {
  const [pointOfSale, setPointOfSale] = useState([]);

  useEffect(() => {
    const loadPointOfSale = async () => {
      try {
        const res = await getPointOfSale(salemanCode, from, to);
        if (res.data.data) {
          setPointOfSale(res.data.data);
        }
      } catch (error) {
        console.error("Lỗi khi fetch point of sale:", error);
      }
    };
    if (salemanCode) {
      loadPointOfSale();
    }
  }, [salemanCode, from, to]);

  return pointOfSale;
};
