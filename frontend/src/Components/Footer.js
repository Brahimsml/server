import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import InstagramIcon from "@mui/icons-material/Instagram";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import logo from "../Assets/logo.jpg";
import { API_URL } from "../api";
import "../Styles/theme.css";
import "../Styles/Shell.css";

// Opens the shop filtered to one category
const categoryLink = (name) =>
  name === "All" ? "/shop" : `/shop?category=${encodeURIComponent(name)}`;

const Footer = () => {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    axios
      .get(`${API_URL}/categories`)
      .then((res) => setCategories(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  return (
    <footer className="ft mt-scope">
      <div className="ft-inner">
        <div className="ft-top">
          <div className="ft-brand">
            <Link to="/home" className="ft-logo">
              <img src={logo} alt="" />
              <span>MegaTech</span>
            </Link>
            <p>
              Premium PC accessories, gaming peripherals and setup essentials built for performance
              and style.
            </p>
            <div className="ft-socials">
              <a
                href="https://www.instagram.com/brahimsml"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="MegaTech on Instagram"
              >
                <InstagramIcon fontSize="small" />
              </a>
            </div>
          </div>

          <nav className="ft-col" aria-label="Shop">
            <h3>Shop</h3>
            <Link to={categoryLink("All")}>All products</Link>
            {categories.map((c) => (
              <Link key={c.id} to={categoryLink(c.name)}>
                {c.name}
              </Link>
            ))}
          </nav>

          <nav className="ft-col" aria-label="Help">
            <h3>Help</h3>
            <Link to="/my-orders">My orders</Link>
            <Link to="/cart">Shopping cart</Link>
            <Link to="/menu">Find a store</Link>
            <Link to="/about">About us</Link>
            <Link to="/contact">Contact us</Link>
            <Link to="/shipping">Shipping &amp; delivery</Link>
            <Link to="/returns">Returns</Link>
          </nav>

          <div className="ft-col ft-contact">
            <h3>Get in touch</h3>
            <a href="tel:+96170123456">
              <PhoneOutlinedIcon fontSize="small" /> 70 123 456
            </a>
            <a href="mailto:support@megatech.com">
              <MailOutlineIcon fontSize="small" /> support@megatech.com
            </a>
            <span>
              <PlaceOutlinedIcon fontSize="small" /> Lebanon
            </span>
          </div>
        </div>

        <div className="ft-bottom">
          <p>© {new Date().getFullYear()} MegaTech. All rights reserved.</p>
          <div className="ft-legal">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/admin/login" className="ft-staff">
              Staff login
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
