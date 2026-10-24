import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import SearchOffOutlinedIcon from "@mui/icons-material/SearchOffOutlined";
import "../Styles/theme.css";

// Shown for any address the site doesn't know
const NotFound = () => {
  useEffect(() => {
    document.title = "Page not found | MegaTech";
    return () => {
      document.title = "MegaTech | PC Components & Gaming Gear";
    };
  }, []);

  return (
    <section className="mt-page">
      <div className="mt-container">
        <div className="mt-panel mt-empty" style={{ maxWidth: 560, margin: "40px auto 0" }}>
          <div className="mt-empty__icon">
            <SearchOffOutlinedIcon fontSize="inherit" />
          </div>
          <span className="mt-eyebrow">Error 404</span>
          <h3>We couldn't find that page</h3>
          <p>The link may be old or mistyped. Try the shop, or head back home.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link to="/shop" className="mt-btn mt-btn--primary">
              Go to the shop
            </Link>
            <Link to="/home" className="mt-btn mt-btn--secondary">
              Home
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NotFound;
