import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "remixicon/fonts/remixicon.css";
import { App } from "./App";
import "./index.css";
import { Netplay } from "./Netplay";

ReactDOM.createRoot(document.getElementById("reactRoot")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" index element={<App />} />
        <Route path="netplay" element={<Netplay />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
