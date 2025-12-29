// import { StrictMode } from "react";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import "@goongmaps/goong-js/dist/goong-js.css";
// import { BrowserRouter } from "react-router-dom";
import "nprogress/nprogress.css";
import "antd/dist/reset.css";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  // <React.StrictMode>
  // <BrowserRouter>
  <App />
  // </BrowserRouter>
  // </React.StrictMode>
);
