import React from "react";
import { Link } from "react-router-dom";
import { AccountLink } from "./SignInLink";
import InstagramIcon from "@mui/icons-material/Instagram";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import logo from "../Assets/logo.svg";
import SHOP_INFO from "../utils/shopInfo";
import { whatsappLink } from "../utils/shop";
import "../Styles/theme.css";
import "../Styles/Shell.css";

/*
  Site footer, short and quiet: logo and one line, three small link columns, one bottom line
  with the legal links and round contact icons, then the big MegaTech wordmark
  (styles: Styles/ModernPreview.css, "MODERN FOOTER").
*/
const Footer = () => {
  const whatsapp = whatsappLink(SHOP_INFO.phone, "Hi MegaTech, I have a question.");
  return (
    <footer className="mf mt-scope">
      <div className="mf-inner">
        <div className="mf-cols">
          <div className="mf-brand">
            <Link to="/home" className="mf-logo">
              <img src={logo} alt="" />
              <span>MegaTech</span>
            </Link>
            <p>PC parts and gaming gear, delivered all over Lebanon.</p>
          </div>

          <nav aria-label="Shop">
            <h3>Shop</h3>
            <Link to="/shop">All products</Link>
            <Link to="/shop?sale=1">Deals</Link>
            <Link to="/shop">Categories</Link>
          </nav>

          <nav aria-label="Help">
            <h3>Help</h3>
            <AccountLink to="/my-orders">Orders</AccountLink>
            <Link to="/shipping">Shipping</Link>
            <Link to="/returns">Returns</Link>
            <Link to="/contact">Contact</Link>
          </nav>

          <nav aria-label="Company">
            <h3>Company</h3>
            <Link to="/about">About</Link>
            <Link to="/menu">Stores</Link>
          </nav>
        </div>

        <div className="mf-bottom">
          <p>
            © {new Date().getFullYear()} {SHOP_INFO.name}
          </p>
          <div className="mf-legal">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/admin/login">Staff login</Link>
          </div>
          <div className="mf-socials">
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" aria-label="MegaTech on WhatsApp">
                <WhatsAppIcon fontSize="small" />
              </a>
            )}
            <a href={SHOP_INFO.instagram} target="_blank" rel="noopener noreferrer" aria-label="MegaTech on Instagram">
              <InstagramIcon fontSize="small" />
            </a>
            <a href={`mailto:${SHOP_INFO.email}`} aria-label="Email MegaTech">
              <MailOutlineIcon fontSize="small" />
            </a>
          </div>
        </div>
      </div>

      <div className="mf-word" aria-hidden="true">
        MegaTech
      </div>
    </footer>
  );
};

export default Footer;
