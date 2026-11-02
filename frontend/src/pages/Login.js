import React, { useState } from "react";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import MarkEmailUnreadOutlinedIcon from "@mui/icons-material/MarkEmailUnreadOutlined";
import AuthForm from "../Components/AuthForm";
import "../Styles/Login.css";
import setupPhoto from "../Assets/apo.jpeg";
import usePageTitle from "../utils/usePageTitle";

// The full Sign in page: direct links, email links and pages that need an account land here.
// Buttons around the site open the same form in a popup instead (Components/AuthModal.js).
const Login = () => {
  const params = new URLSearchParams(window.location.search);
  const redirect = params.get("redirect");
  const [mode, setMode] = useState(params.get("mode") === "register" ? "register" : "login");
  usePageTitle(mode === "register" ? "Create account" : "Sign in");

  // Go back to where they came from (e.g. the cart). Only same-site paths,
  // so a link can't redirect people to another website.
  const goBack = () => {
    window.location.href = redirect && redirect.startsWith("/") && !redirect.startsWith("//") ? redirect : "/home";
  };

  return (
    <section className="auth-page">
      <div className="auth-card">
        <aside className="auth-aside" style={{ "--auth-photo": `url(${setupPhoto})` }}>
          <div className="auth-aside__copy">
            <h2 className="auth-headline">
              Your next setup <span>starts here.</span>
            </h2>
            <p className="auth-tagline">
              One account for your orders, your wishlist and faster checkout, on every device.
            </p>

            <ul className="auth-perks">
              <li>
                <span className="auth-perks__icon">
                  <LocalShippingOutlinedIcon fontSize="small" />
                </span>
                <span>
                  <strong>Track every order</strong>
                  <small>See where your order is, from confirmed to delivered.</small>
                </span>
              </li>
              <li>
                <span className="auth-perks__icon">
                  <FavoriteBorderIcon fontSize="small" />
                </span>
                <span>
                  <strong>Wishlist on all your devices</strong>
                  <small>Save gear on your phone, buy it later on your laptop.</small>
                </span>
              </li>
              <li>
                <span className="auth-perks__icon">
                  <BoltOutlinedIcon fontSize="small" />
                </span>
                <span>
                  <strong>Faster checkout</strong>
                  <small>Your phone and address are filled in for you.</small>
                </span>
              </li>
              <li>
                <span className="auth-perks__icon">
                  <MarkEmailUnreadOutlinedIcon fontSize="small" />
                </span>
                <span>
                  <strong>Order updates by email</strong>
                  <small>A confirmation for every order you place.</small>
                </span>
              </li>
            </ul>
          </div>

          <p className="auth-trust">Cash on delivery · 7-day returns · Delivery all over Lebanon</p>
        </aside>

        <div className="auth-main">
          <AuthForm
            initialMode={mode}
            context={redirect === "/cart" ? "checkout" : redirect === "/wishlist" ? "wishlist" : null}
            onSignedIn={goBack}
            onModeChange={setMode}
          />
        </div>
      </div>
    </section>
  );
};

export default Login;
