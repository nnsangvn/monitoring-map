import { useCallback } from "react";

/**
 * Custom hook để quản lý popup trên map
 * Hỗ trợ cả popup từ click và hover với logic tự động đóng/mở
 */
export const useMapPopup = () => {
  // ========== POPUP CHO POINT OF SALE ==========
  const showPointOfSalePopup = useCallback((map, pointOfSale, coords, isFromClick = false) => {
    // Xóa popup cũ nếu có
    if (map._pointOfSalePopup) {
      map._pointOfSalePopup.remove();
      map._pointOfSalePopup = null;
    }

    const html = `
      <div class="salesman-popup">
        <ul>
          <li> <strong>${pointOfSale.shop_name}</strong> </li>
          <li><strong>Địa chỉ:</strong> ${pointOfSale.address || "N/A"}</li>
          <li><strong>Trạng thái:</strong> ${pointOfSale.marker_name || "N/A"}</li>
        </ul>
      </div>`;

    const popup = new window.goongjs.Popup({ offset: 25, closeButton: true, maxWidth: "350px" })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map);

    // Đánh dấu popup có phải từ click hay không
    popup._isFromClick = isFromClick;

    // Lưu popup instance vào map để có thể remove sau
    map._pointOfSalePopup = popup;

    // Xóa popup khi popup tự đóng (click close button)
    popup.on("close", () => {
      map._pointOfSalePopup = null;
    });
  }, []);

  const closePointOfSalePopup = useCallback((map) => {
    if (map._pointOfSalePopup) {
      map._pointOfSalePopup.remove();
      map._pointOfSalePopup = null;
    }
  }, []);

  // ========== POPUP CHO SALESMAN ==========
  const showSalemanPopup = useCallback((map, saleman, coords, isFromClick = false) => {
    // Xóa popup cũ nếu có
    if (map._salesmanPopup) {
      map._salesmanPopup.remove();
      map._salesmanPopup = null;
    }

    const html = `
      <div class="salesman-popup">
        <ul>
          <li> <strong>${saleman.name || saleman.saleman_name || "Nhân viên"}</strong> </li>
          <li><strong>Code:</strong> ${saleman.code}</li>
          <li><strong>Thiết bị:</strong> ${saleman.device_name || "N/A"}</li>
          <li><strong>Doanh số tháng:</strong> ${saleman.total_sale_formatted || "N/A"}</li>
          <li><strong>Doanh số ngày:</strong> ${saleman.total_sale_day_formatted || "N/A"}</li>
          <li><strong>Đã viếng thăm:</strong> ${saleman.total_visit_day || 0} cửa hàng</li>
          <li><strong>Chưa viếng thăm:</strong> ${saleman.total_not_visit_day || 0}</li>
          <li><strong>Đơn hôm nay:</strong> ${saleman.order_count_day || 0} đơn</li>
        </ul>
      </div>`;

    const popup = new window.goongjs.Popup({ offset: 25, closeButton: true, maxWidth: "350px" })
      .setLngLat(coords)
      .setHTML(html)
      .addTo(map);

    // Đánh dấu popup có phải từ click hay không
    popup._isFromClick = isFromClick;

    // Lưu popup instance vào map để có thể remove sau
    map._salemanPopup = popup;

    // Xóa popup khi popup tự đóng (click close button)
    popup.on("close", () => {
      map._salemanPopup = null;
    });
  }, []);

  const closeSalemanPopup = useCallback((map) => {
    if (map._salemanPopup) {
      map._salemanPopup.remove();
      map._salemanPopup = null;
    }
  }, []);

  return {
    // Point of Sale popup functions
    showPointOfSalePopup,
    closePointOfSalePopup,
    // Saleman popup functions
    showSalemanPopup,
    closeSalemanPopup,
  };
};
