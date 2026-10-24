import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import PlacesItem from "../Components/PlacesItem";
import { API_URL } from "../api";
import { imageUrl } from "../utils/shop";
import "../Styles/theme.css";
import "../Styles/Locations.css";
import usePageTitle from "../utils/usePageTitle";

const Menu = () => {
  usePageTitle("Our stores");
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_URL}/places`)
      .then((res) => setPlaces(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error("Error fetching places:", err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="mt-page">
      <div className="mt-container">
        <header className="mt-head mt-head--center">
          <div>
            <span className="mt-eyebrow">Our stores</span>
            <h1 className="mt-title">Visit a MegaTech store</h1>
            <p className="mt-lead">
              See the latest PC accessories, gaming peripherals and hardware in person, and get
              advice from our team.
            </p>
          </div>
        </header>

        {error && (
          <div className="mt-alert mt-alert--error" role="alert">
            We couldn't load our store locations right now. Please try again in a moment.
          </div>
        )}

        {loading ? (
          <div className="loc-grid">
            {[0, 1, 2].map((i) => (
              <div key={i} className="mt-skeleton loc-skeleton" />
            ))}
          </div>
        ) : places.length === 0 && !error ? (
          <div className="mt-panel mt-empty">
            <div className="mt-empty__icon">
              <StorefrontOutlinedIcon fontSize="inherit" />
            </div>
            <h3>No stores listed yet</h3>
            <p>Our store locations will appear here soon.</p>
          </div>
        ) : (
          <div className="loc-grid">
            {places.map((loc) => (
              <PlacesItem
                key={loc.id}
                image={imageUrl(loc.image)}
                name={loc.name}
                tel={loc.tel}
                address={loc.address}
                lat={loc.lat}
                lng={loc.lng}
              />
            ))}
          </div>
        )}

        <section className="mt-cta">
          <div>
            <h2>Can't make it to a store?</h2>
            <p>Order online and track it from your account, or send us a question.</p>
          </div>
          <div className="mt-cta__actions">
            <Link to="/shop" className="mt-btn mt-btn--primary">
              Shop online
            </Link>
            <Link to="/contact" className="mt-btn mt-btn--secondary">
              Contact us
            </Link>
          </div>
        </section>
      </div>
    </section>
  );
};

export default Menu;
