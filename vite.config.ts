import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      // Cho phép hiển thị trong iframe từ mọi nguồn
      "X-Frame-Options": "ALLOWALL",
      // Hoặc sử dụng Content-Security-Policy để kiểm soát chi tiết hơn
      "Content-Security-Policy": "frame-ancestors *",
    },
  },
  preview: {
    headers: {
      // Áp dụng cho chế độ preview
      "X-Frame-Options": "ALLOWALL",
    },
  },
});
