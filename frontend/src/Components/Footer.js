import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import InstagramIcon from "@mui/icons-material/Instagram";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import logo from "../Assets/logo.svg";
import { API_URL } from "../api";
import SHOP_INFO from "../utils/shopInfo";
import "../Styles/theme.css";
import "../Styles/Shell.css";

// Opens the shop filtered to one category
const categoryLink = (name) =>
  name === "All" ? "/shop" : `/shop?category=${encodeURIComponent(name)}`;

/*
  Footer column. On computers every column is open; on phones each one is a
  tap-to-open section so the footer stays short.
*/
const FooterSection = ({ id, title, open, onToggle, className = "", children }) => (
  <nav className={`ft-col ${className} ${open ? "is-open" : ""}`} aria-label={title}>
    <h3>
      <button type="button" className="ft-toggle" onClick={() => onToggle(id)} aria-expanded={open} aria-controls={`ft-${id}`}>
        {title}
        <ExpandMoreIcon className="ft-toggle__icon" fontSize="small" />
      </button>
    </h3>
    <div className="ft-links" id={`ft-${id}`}>
      {children}
    </div>
  </nav>
);

const Footer = () => {
  const [categories, setCategories] = useState([]);
  const [open, setOpen] = useState(null); // which phone section is open

  useEffect(() => {
    axios
      .get(`${API_URL}/categories`)
      .then((res) => setCategories(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const toggle = (id) => setOpen((cur) => (cur === id ? null : id));

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
              <a href={SHOP_INFO.instagram} target="_blank" rel="noopener noreferrer" aria-label="MegaTech on Instagram">
                <InstagramIcon fontSize="small" />
              </a>
            </div>
          </div>

          <FooterSection id="shop" title="Shop" open={open === "shop"} onToggle={toggle}>
            <Link to={categoryLink("All")}>All products</Link>
            {categories.map((c) => (
              <Link key={c.id} to={categoryLink(c.name)}>
                {c.name}
              </Link>
            ))}
          </FooterSection>

          <FooterSection id="help" title="Help" open={open === "help"} onToggle={toggle}>
            <Link to="/my-orders">My orders</Link>
            <Link to="/cart">Shopping cart</Link>
            <Link to="/menu">Find a store</Link>
            <Link to="/about">About us</Link>
            <Link to="/contact">Contact us</Link>
            <Link to="/shipping">Shipping &amp; delivery</Link>
            <Link to="/returns">Returns</Link>
          </FooterSection>

          <FooterSection id="contact" title="Get in touch" open={open === "contact"} onToggle={toggle} className="ft-contact">
            <a href={`tel:${SHOP_INFO.phoneLink}`}>
              <PhoneOutlinedIcon fontSize="small" /> {SHOP_INFO.phone}
            </a>
            <a href={`mailto:${SHOP_INFO.email}`}>
              <MailOutlineIcon fontSize="small" /> {SHOP_INFO.email}
            </a>
            <span>
              <PlaceOutlinedIcon fontSize="small" /> {SHOP_INFO.country}
            </span>
          </FooterSection>
        </div>

        <div className="ft-bottom">
          <p>
            © {new Date().getFullYear()} {SHOP_INFO.name}. All rights reserved.
          </p>
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
