import { Providers } from "@/providers";
import { createRoot } from "react-dom/client";
import { Route, BrowserRouter as Router, Routes } from "react-router";
import App from "./app";
import Home from "./home";
import "./styles.css";
const root = createRoot(document.getElementById("app")!);

root.render(
  <Providers>
    <Router>
      <Routes>
        <Route path="/" element={<Home />}></Route>
        <Route path="/c/:threadID" element={<App />}></Route>
      </Routes>
    </Router>
  </Providers>
);
