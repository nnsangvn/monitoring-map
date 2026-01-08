import { useEffect, useState } from "react";
import { fetchSaleMan } from "../service/api.ts";

export const useSaleMan = (parentCode, reloadKey = 0) => {
  const [saleMan, setSaleMan] = useState([]);

  useEffect(() => {
    const loadSalesmen = async () => {
      try {
        const res = await fetchSaleMan(parentCode);
        if (res.data.data) {
          setSaleMan(res.data.data);
        }
      } catch (error) {
        console.error("Lỗi khi fetch data:", error);
      }
    };
    loadSalesmen();
  }, [parentCode, reloadKey]);

  return saleMan;
};
