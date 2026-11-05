import React, { useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { CartContext } from "../Context/CartContext";
import MiniCart from "./MiniCart";
import NavSearch from "./NavSearch";
import ShopMegaMenu from "./ShopMegaMenu";
import { useWishlist } from "../Context/WishlistContext";

import ShoppingCartOutlinedIcon from "@mui/icons-material/ShoppingCartOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LocalOfferOutlinedIcon from "@mui/icons-material/LocalOfferOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";

import logo from "../Assets/logo.svg";
import "../Styles/theme.css";
import "../Styles/Shell.css";
import { clearUserSession, getUser } from "../utils/auth";
import SignInLink, { AccountLink } from "./SignInLink";
import api from "../api";
import SHOP_INFO from "../utils/shopInfo";
import { groupCategories, imageUrl, normalizeLabel, onImageError, imageSrcSet, saleOf } from "../utils/shop";

const ADMIN_LINKS = [
  { to: "/admin/dashboard", label: "Dashboard", icon: DashboardOutlinedIcon },
  { to: "/products/admin", label: "Products", icon: Inventory2OutlinedIcon },
  { to: "/places/admin", label: "Places", icon: PlaceOutlinedIcon },
  { to: "/orders/admin", label: "Orders", icon: ReceiptLongOutlinedIcon },
  { to: "/contacts/admin", label: "Messages", icon: MailOutlineIcon },
];

const NavBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { cartCount, miniCart, openMiniCart, closeMiniCart } = useContext(CartContext);

  // "account" | "admin" | null — which dropdown is open
  const [openMenu, setOpenMenu] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [badgeBump, setBadgeBump] = useState(false);
  const [categories, setCategories] = useState([]); // "Shop by category" in the phone menu

  // Reloaded on every page change, so a category added in the admin shows up straight away.
  // Product counts come along, so empty categories stay out of the menus.
  const [catCounts, setCatCounts] = useState(null);
  const [dealsCount, setDealsCount] = useState(0); // products on sale: "Deals" shows only when there are some
  const onDeals = location.pathname === "/shop" && new URLSearchParams(location.search).get("sale") === "1";
  const [shopIds, setShopIds] = useState(null); // products customers can see right now
  useEffect(() => {
    api
      .get("/categories")
      .then((res) => setCategories(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
    api
      .get("/products")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : [];
        const counts = {};
        list.forEach((p) => {
          counts[p.category_id] = (counts[p.category_id] || 0) + 1;
        });
        setCatCounts(counts);
        setDealsCount(list.filter((p) => saleOf(p)).length);
        setShopIds(new Set(list.map((p) => p.id)));
      })
      .catch(() => {});
  }, [location.pathname]);
  // Main entries only (groups and categories on their own), like big store menus; a group counts
  // the products of its categories. Empty ones stay out once the counts are known.
  const groupTotal = (g, counts) => (counts?.[g.id] || 0) + g.children.reduce((sum, c) => sum + (counts?.[c.id] || 0), 0);
  const mainCategories = groupCategories(categories);
  const shownCategories = catCounts ? mainCategories.filter((g) => groupTotal(g, catCounts)) : mainCategories;

  // Second row: categories that don't fit go into a "More" menu
  const catsRef = useRef(null);
  const [hiddenCats, setHiddenCats] = useState([]);
  useLayoutEffect(() => {
    const row = catsRef.current;
    if (!row) return undefined;
    const measure = () => {
      const top = row.getBoundingClientRect().top;
      const hidden = [...row.children]
        .filter((a) => a.getBoundingClientRect().top > top + 4)
        .map((a) => a.dataset.name);
      setHiddenCats((cur) => (cur.join("|") === hidden.join("|") ? cur : hidden));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(row);
    return () => ro.disconnect();
  }, [categories, catCounts]);

  // Phone menu: a photo and product count for each category, loaded the first time it opens
  const [catInfo, setCatInfo] = useState(null);
  const countsOf = (info) => Object.fromEntries(Object.entries(info || {}).map(([id, v]) => [id, v.count]));
  const [openGroup, setOpenGroup] = useState(null); // the group opened in the phone menu
  useEffect(() => {
    if (!mobileOpen || catInfo) return;
    api
      .get("/products")
      .then((res) => {
        const info = {};
        (Array.isArray(res.data) ? res.data : []).forEach((p) => {
          const entry = (info[p.category_id] = info[p.category_id] || { count: 0, pick: null });
          entry.count += 1;
          if (!p.image) return;
          const rank = (x) => [Number(!!normalizeLabel(x.label)), Number(x.price)];
          const [la, pa] = rank(p);
          const [lb, pb] = entry.pick ? rank(entry.pick) : [-1, -1];
          if (la > lb || (la === lb && pa > pb)) entry.pick = p;
        });
        setCatInfo(info);
      })
      .catch(() => setCatInfo({}));
  }, [mobileOpen, catInfo]);

  const headerRef = useRef(null);
  const accountRef = useRef(null);
  const adminRef = useRef(null);
  const cartRef = useRef(null);
  const moreRef = useRef(null);
  const prevCount = useRef(cartCount);

  const { items: wishlist } = useWishlist();
  // The heart counts only saved products the shop shows (a hidden one stays saved, but isn't counted)
  const savedCount = shopIds ? wishlist.filter((p) => shopIds.has(p.id)).length : wishlist.length;
  const isAdmin = !!localStorage.getItem("adminToken");
  const user = getUser();
  const firstName = (user?.name || "Account").trim().split(/\s+/)[0];
  const initial = (user?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  // Close everything when the page changes
  useEffect(() => {
    setOpenMenu(null);
    setMobileOpen(false);
    closeMiniCart();
  }, [location.pathname, closeMiniCart]);

  // Close dropdowns on outside click / Escape
  useEffect(() => {
    const onDown = (e) => {
      if (openMenu === "account" && !accountRef.current?.contains(e.target)) setOpenMenu(null);
      if (openMenu === "admin" && !adminRef.current?.contains(e.target)) setOpenMenu(null);
      if (openMenu === "more" && !moreRef.current?.contains(e.target)) setOpenMenu(null);
      if (miniCart.open && !cartRef.current?.contains(e.target)) closeMiniCart();
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setMobileOpen(false);
        closeMiniCart();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu, miniCart.open, closeMiniCart]);

  // Lock page scroll behind the phone menu; let CSS hide the chat button under overlays
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    document.body.classList.toggle("nb-menu-open", mobileOpen);
    document.body.classList.toggle("nb-cart-open", miniCart.open);
    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("nb-menu-open", "nb-cart-open");
    };
  }, [mobileOpen, miniCart.open]);

  // Little bounce on the cart badge when the count goes up
  useEffect(() => {
    if (cartCount > prevCount.current) {
      setBadgeBump(true);
      const t = setTimeout(() => setBadgeBump(false), 450);
      prevCount.current = cartCount;
      return () => clearTimeout(t);
    }
    prevCount.current = cartCount;
  }, [cartCount]);

  // While scrolling:
  //  - computers: the bar turns into a slim one (logo, search, account, cart; no category row)
  //    and goes back to full size at the top of the page, like Best Buy / Newegg
  //  - phones: the bar slides away while you scroll down and comes back as soon as you scroll up
  // On phones it stays put near the top, while a menu is open, or while you're using it.
  const [barHidden, setBarHidden] = useState(false);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    const computer = window.matchMedia("(min-width: 901px)");
    const onScroll = () => {
      const y = window.scrollY;
      if (computer.matches) {
        setBarHidden(false);
        setCompact(y > 160);
        lastY = y;
        return;
      }
      setCompact(false);
      const header = headerRef.current;
      const inUse = header && (header.matches(":hover") || header.contains(document.activeElement));
      if (y < 160 || openMenu || mobileOpen || miniCart.open) setBarHidden(false);
      else if (y > lastY + 8 && !inUse) setBarHidden(true);
      else if (y < lastY - 4) setBarHidden(false);
      lastY = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [openMenu, mobileOpen, miniCart.open]);
  useEffect(() => setBarHidden(false), [location.pathname]);
  useEffect(() => {
    if (miniCart.open || mobileOpen) setBarHidden(false); // e.g. "Add to cart" opens the cart
  }, [miniCart.open, mobileOpen]);
  // sticky parts of pages (shop filters…) move up while the bar is away or slim
  useEffect(() => {
    document.body.classList.toggle("nb-hidden", barHidden);
    document.body.classList.toggle("nb-compact", compact);
    document.body.classList.add("nb-has-search"); // phones: the bar is taller (search row)
    return () => document.body.classList.remove("nb-hidden", "nb-compact", "nb-has-search");
  }, [barHidden, compact]);

  const toggleMenu = (name) => setOpenMenu((cur) => (cur === name ? null : name));

  const toggleCart = () => {
    setOpenMenu(null);
    setMobileOpen(false);
    if (miniCart.open) closeMiniCart();
    else openMiniCart();
  };

  // Full reload so everything tied to the account (like the wishlist) is cleared
  const logoutUser = () => {
    clearUserSession();
    setOpenMenu(null);
    setMobileOpen(false);
    window.location.href = "/home";
  };

  const logoutAdmin = () => {
    localStorage.removeItem("adminToken");
    localStorage.removeItem("admin");
    setOpenMenu(null);
    setMobileOpen(false);
    navigate("/admin/login");
  };

  const isHome = location.pathname === "/" || location.pathname === "/home";
  const activeCategory = new URLSearchParams(location.search).get("category");
  const linkClass = ({ isActive }, to) =>
    `nb-link ${isActive || (to === "/home" && isHome) ? "is-active" : ""}`;

  return (
    <>
    {/* computers: keeps the full bar's space, so the page never moves when the bar gets slim */}
    <div className="nb-spacer" aria-hidden="true" />
    <header
      className={`nb mt-scope ${barHidden ? "is-hidden" : ""} ${compact ? "is-compact" : ""}`}
      ref={headerRef}
      style={barHidden ? { top: -((headerRef.current?.offsetHeight || 130) + 4) } : undefined}
    >
      <div className="nb-inner">
        <button
          type="button"
          className="nb-icon-btn nb-burger"
          onClick={() => {
            closeMiniCart();
            setMobileOpen((v) => !v);
          }}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="nb-mobile"
        >
          {mobileOpen ? <CloseIcon /> : <MenuIcon />}
        </button>

        <Link to="/home" className="nb-brand" aria-label="MegaTech home">
          <img src={logo} alt="" />
          <span>MegaTech</span>
        </Link>

        <div className="nb-actions">
          <NavSearch />

          {/* ===== Admin menu (only for signed-in admins) ===== */}
          {isAdmin && (
            <div className="nb-dropdown nb-admin" ref={adminRef}>
              <button
                type="button"
                className={`nb-pill ${openMenu === "admin" ? "is-open" : ""}`}
                onClick={() => toggleMenu("admin")}
                aria-haspopup="menu"
                aria-expanded={openMenu === "admin"}
              >
                <AdminPanelSettingsOutlinedIcon fontSize="small" />
                <span>Admin</span>
                <KeyboardArrowDownIcon fontSize="small" className="nb-chevron" />
              </button>

              {openMenu === "admin" && (
                <div className="nb-menu" role="menu">
                  {ADMIN_LINKS.map(({ to, label, icon: Icon }) => (
                    <Link key={to} to={to} role="menuitem">
                      <Icon fontSize="small" /> {label}
                    </Link>
                  ))}
                  <hr />
                  <button type="button" role="menuitem" onClick={logoutAdmin}>
                    <LogoutIcon fontSize="small" /> Admin sign out
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ===== Account ===== */}
          {user ? (
            <div className="nb-dropdown nb-account" ref={accountRef}>
              <button
                type="button"
                className={`nb-pill ${openMenu === "account" ? "is-open" : ""}`}
                onClick={() => toggleMenu("account")}
                aria-haspopup="menu"
                aria-expanded={openMenu === "account"}
                aria-label="Account menu"
              >
                <span className="nb-avatar">{initial}</span>
                <span className="nb-account__name">{firstName}</span>
                <KeyboardArrowDownIcon fontSize="small" className="nb-chevron" />
              </button>

              {openMenu === "account" && (
                <div className="nb-menu" role="menu">
                  <div className="nb-menu__head">
                    <strong>{user.name}</strong>
                    {user.email && <span>{user.email}</span>}
                  </div>
                  <Link to="/account" role="menuitem">
                    <ManageAccountsOutlinedIcon fontSize="small" /> My account
                  </Link>
                  <Link to="/my-orders" role="menuitem">
                    <ReceiptLongOutlinedIcon fontSize="small" /> My orders
                  </Link>
                  <Link to="/wishlist" role="menuitem">
                    <FavoriteBorderIcon fontSize="small" /> Wishlist
                  </Link>
                  <hr />
                  <button type="button" role="menuitem" onClick={logoutUser}>
                    <LogoutIcon fontSize="small" /> Sign out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="nb-dropdown nb-guest">
              <SignInLink className="nb-pill nb-signin">
                <PersonOutlineIcon />
                <span>Sign in</span>
                <KeyboardArrowDownIcon fontSize="small" className="nb-chevron" />
              </SignInLink>

              {/* computers: opens on hover */}
              <div className="nb-menu nb-guest__menu" role="menu">
                <SignInLink className="mt-btn mt-btn--primary nb-guest__signin" role="menuitem">
                  Sign in
                </SignInLink>
                <p className="nb-guest__new">
                  New customer? <SignInLink mode="register">Create an account</SignInLink>
                </p>
                <hr />
                <AccountLink to="/my-orders" role="menuitem">
                  <ReceiptLongOutlinedIcon fontSize="small" /> My orders
                </AccountLink>
                <Link to="/wishlist" role="menuitem">
                  <FavoriteBorderIcon fontSize="small" /> Wishlist
                </Link>
                <Link to="/contact" role="menuitem">
                  <ChatBubbleOutlineIcon fontSize="small" /> Help &amp; contact
                </Link>
              </div>
            </div>
          )}

          {/* ===== Wishlist ===== */}
          <Link
            to="/wishlist"
            className="nb-icon-btn nb-wish"
            aria-label={`Wishlist, ${savedCount} ${savedCount === 1 ? "item" : "items"}`}
          >
            <FavoriteBorderIcon />
            <span className="nb-act__label">Wishlist</span>
            {savedCount > 0 && <span className="nb-badge">{savedCount > 99 ? "99+" : savedCount}</span>}
          </Link>

          {/* ===== Cart ===== */}
          <div className="nb-cart" ref={cartRef}>
            <button
              type="button"
              className={`nb-icon-btn nb-cart__btn ${miniCart.open ? "is-open" : ""}`}
              onClick={toggleCart}
              aria-label={`Cart, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
              aria-expanded={miniCart.open}
            >
              <ShoppingCartOutlinedIcon />
              <span className="nb-act__label">Cart</span>
              {cartCount > 0 && (
                <span className={`nb-badge ${badgeBump ? "is-bump" : ""}`}>
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </button>

            <MiniCart />
          </div>
        </div>
      </div>

      {/* ===== Phones: a search bar under the top row on every page, like big store apps ===== */}
      <div className="nb-phone-search">
        <NavSearch bar />
      </div>

      {/* ===== Second row (computers): every category one click away, like big stores ===== */}
      <div className="nb-sub">
        <div className="nb-sub__inner">
          <ShopMegaMenu linkClass={linkClass} />
          {/* Deals first, in red, like "Today's Deals" on big stores (only while something is on sale) */}
          {dealsCount > 0 && (
            <Link to="/shop?sale=1" className={`nb-sublink nb-deals ${onDeals ? "is-active" : ""}`} aria-current={onDeals ? "page" : undefined}>
              <LocalOfferOutlinedIcon fontSize="small" /> Deals
            </Link>
          )}
          <nav className="nb-sub__cats" aria-label="Categories" ref={catsRef}>
            {shownCategories.map((c) => (
              <Link
                key={c.id}
                data-name={c.name}
                to={`/shop?category=${encodeURIComponent(c.name)}`}
                className={`nb-sublink ${location.pathname === "/shop" && activeCategory === c.name ? "is-active" : ""}`}
              >
                {c.name}
              </Link>
            ))}
          </nav>
          {hiddenCats.length > 0 && (
            // opens on hover (mouse) and on click / tap (touch screens, keyboards)
            <div className={`nb-dropdown nb-more ${openMenu === "more" ? "is-open" : ""}`} ref={moreRef}>
              <button
                type="button"
                className="nb-sublink"
                aria-haspopup="menu"
                aria-expanded={openMenu === "more"}
                onClick={() => toggleMenu("more")}
              >
                More <KeyboardArrowDownIcon fontSize="small" className="nb-chevron" />
              </button>
              <div className="nb-menu nb-more__menu" role="menu">
                {hiddenCats.map((name) => (
                  <Link key={name} to={`/shop?category=${encodeURIComponent(name)}`} role="menuitem" onClick={() => setOpenMenu(null)}>
                    {name}
                  </Link>
                ))}
              </div>
            </div>
          )}
          <NavLink to="/menu" className={(st) => `nb-sublink nb-sub__store ${st.isActive ? "is-active" : ""}`}>
            <PlaceOutlinedIcon fontSize="small" /> Find a store
          </NavLink>
        </div>
      </div>

      {/* ===== Phone menu: drawer from the left ===== */}
      {mobileOpen && (
        <>
          <div className="nb-drawer-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <nav className="nb-drawer" id="nb-mobile" aria-label="Menu" role="dialog" aria-modal="true">
            <div className="nb-drawer__head">
              <Link to="/home" className="nb-brand" aria-label="MegaTech home">
                <img src={logo} alt="" />
                <span>MegaTech</span>
              </Link>
              <button type="button" className="nb-icon-btn" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <CloseIcon />
              </button>
            </div>

            <div className="nb-drawer__body">
              {user ? (
                <Link to="/account" className="nb-drawer__user">
                  <span className="nb-avatar">{initial}</span>
                  <span className="nb-drawer__user-text">
                    <strong>Hi, {firstName}</strong>
                    {user.email && <small>{user.email}</small>}
                  </span>
                  <ChevronRightIcon fontSize="small" />
                </Link>
              ) : (
                // one slim line, like the Amazon app ("Hello, sign in"); new customers sign up from there too
                <SignInLink className="nb-drawer__user nb-drawer__user--guest" onClick={() => setMobileOpen(false)}>
                  <span className="nb-avatar nb-avatar--guest" aria-hidden="true">
                    <PersonOutlineIcon fontSize="small" />
                  </span>
                  <span className="nb-drawer__user-text">
                    <strong>Hello, sign in</strong>
                    <small>Track orders, save a wishlist</small>
                  </span>
                  <ChevronRightIcon fontSize="small" />
                </SignInLink>
              )}

              {categories.length > 0 && (
                <>
                  <div className="nb-drawer__labelrow">
                    <p className="nb-drawer__label">Shop by category</p>
                    <Link to="/shop" className="nb-drawer__seeall">
                      All products
                    </Link>
                  </div>
                  <ul className="nb-drawer__list nb-drawer__list--plain">
                    {dealsCount > 0 && (
                      <li>
                        <Link to="/shop?sale=1" className="nb-drawer__link nb-drawer__cat nb-drawer__deals">
                          <span className="nb-drawer__thumb nb-drawer__thumb--deals" aria-hidden="true">
                            <LocalOfferOutlinedIcon />
                          </span>
                          <span className="nb-drawer__catname">
                            Deals
                            <small>
                              {dealsCount} {dealsCount === 1 ? "product" : "products"} on sale
                            </small>
                          </span>
                          <ChevronRightIcon fontSize="small" className="nb-drawer__chev" />
                        </Link>
                      </li>
                    )}
                    {mainCategories
                      .filter((g) => !catInfo || groupTotal(g, countsOf(catInfo))) // hide empty ones once counts are known
                      .map((g) => {
                        const kids = g.children.filter((c) => !catInfo || catInfo[c.id]?.count);
                        const total = catInfo ? groupTotal(g, countsOf(catInfo)) : null;
                        const pic = g.image || catInfo?.[g.id]?.pick?.image || kids.map((c) => c.image || catInfo?.[c.id]?.pick?.image).find(Boolean);
                        const row = (
                          <>
                            <span className="nb-drawer__thumb" aria-hidden="true">
                              {pic && <img src={imageUrl(pic)} srcSet={imageSrcSet(pic, 320)} sizes="48px" alt="" loading="lazy" onError={onImageError} />}
                            </span>
                            <span className="nb-drawer__catname">
                              {g.name}
                              {total !== null && (
                                <small>
                                  {total} {total === 1 ? "product" : "products"}
                                </small>
                              )}
                            </span>
                          </>
                        );
                        // a group opens in place to show its categories (like shopping apps)
                        if (kids.length) {
                          const open = openGroup === g.id;
                          return (
                            <li key={g.id}>
                              <button
                                type="button"
                                className={`nb-drawer__link nb-drawer__cat ${open ? "is-open" : ""}`}
                                aria-expanded={open}
                                onClick={() => setOpenGroup(open ? null : g.id)}
                              >
                                {row}
                                <ExpandMoreIcon fontSize="small" className="nb-drawer__chev nb-drawer__chev--down" />
                              </button>
                              {open && (
                                <ul className="nb-drawer__sub">
                                  <li>
                                    <Link to={`/shop?category=${encodeURIComponent(g.name)}`} className="nb-drawer__sublink nb-drawer__sublink--all">
                                      All {g.name}
                                    </Link>
                                  </li>
                                  {kids.map((c) => (
                                    <li key={c.id}>
                                      <Link to={`/shop?category=${encodeURIComponent(c.name)}`} className="nb-drawer__sublink">
                                        {c.name}
                                        {catInfo?.[c.id] && <small>{catInfo[c.id].count}</small>}
                                      </Link>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          );
                        }
                        return (
                          <li key={g.id}>
                            <Link to={`/shop?category=${encodeURIComponent(g.name)}`} className="nb-drawer__link nb-drawer__cat">
                              {row}
                              <ChevronRightIcon fontSize="small" className="nb-drawer__chev" />
                            </Link>
                          </li>
                        );
                      })}
                  </ul>
                </>
              )}

              {user && (
                <>
                  <p className="nb-drawer__label">Your account</p>
                  <ul className="nb-drawer__list">
                    <li>
                      <NavLink to="/my-orders" className={(st) => `nb-drawer__link ${st.isActive ? "is-active" : ""}`}>
                        <ReceiptLongOutlinedIcon fontSize="small" />
                        <span>My orders</span>
                        <ChevronRightIcon fontSize="small" className="nb-drawer__chev" />
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/wishlist" className={(st) => `nb-drawer__link ${st.isActive ? "is-active" : ""}`}>
                        <FavoriteBorderIcon fontSize="small" />
                        <span>Wishlist</span>
                        {savedCount > 0 && <span className="nb-drawer__count">{savedCount}</span>}
                        <ChevronRightIcon fontSize="small" className="nb-drawer__chev" />
                      </NavLink>
                    </li>
                    <li>
                      <NavLink to="/account" className={(st) => `nb-drawer__link ${st.isActive ? "is-active" : ""}`}>
                        <ManageAccountsOutlinedIcon fontSize="small" />
                        <span>Account settings</span>
                        <ChevronRightIcon fontSize="small" className="nb-drawer__chev" />
                      </NavLink>
                    </li>
                  </ul>
                </>
              )}

              {!user && (
                <>
                  <p className="nb-drawer__label">Your account</p>
                  <ul className="nb-drawer__list">
                    <li>
                      <AccountLink to="/my-orders" className="nb-drawer__link" onClick={() => setMobileOpen(false)}>
                        <ReceiptLongOutlinedIcon fontSize="small" />
                        <span>My orders</span>
                        <ChevronRightIcon fontSize="small" className="nb-drawer__chev" />
                      </AccountLink>
                    </li>
                    <li>
                      <NavLink to="/wishlist" className={(st) => `nb-drawer__link ${st.isActive ? "is-active" : ""}`}>
                        <FavoriteBorderIcon fontSize="small" />
                        <span>Wishlist</span>
                        {savedCount > 0 && <span className="nb-drawer__count">{savedCount}</span>}
                        <ChevronRightIcon fontSize="small" className="nb-drawer__chev" />
                      </NavLink>
                    </li>
                  </ul>
                </>
              )}

              {isAdmin && (
                <>
                  <p className="nb-drawer__label">Admin</p>
                  <ul className="nb-drawer__list">
                    {ADMIN_LINKS.map(({ to, label, icon: Icon }) => (
                      <li key={to}>
                        <NavLink to={to} className="nb-drawer__link">
                          <Icon fontSize="small" />
                          <span>{label}</span>
                          <ChevronRightIcon fontSize="small" className="nb-drawer__chev" />
                        </NavLink>
                      </li>
                    ))}
                    <li>
                      <button type="button" className="nb-drawer__link" onClick={logoutAdmin}>
                        <LogoutIcon fontSize="small" />
                        <span>Admin sign out</span>
                      </button>
                    </li>
                  </ul>
                </>
              )}

              {/* smaller links at the bottom, like big store apps */}
              <div className="nb-drawer__help">
                <p className="nb-drawer__label">Help &amp; info</p>
                <Link to="/menu">
                  <PlaceOutlinedIcon fontSize="small" /> Find a store
                </Link>
                <Link to="/contact">
                  <ChatBubbleOutlineIcon fontSize="small" /> Contact us
                </Link>
                <Link to="/about">
                  <InfoOutlinedIcon fontSize="small" /> About MegaTech
                </Link>
                <a href={`tel:${SHOP_INFO.phoneLink}`}>
                  <PhoneOutlinedIcon fontSize="small" /> {SHOP_INFO.phone}
                </a>
                <a href={`mailto:${SHOP_INFO.email}`}>
                  <MailOutlineIcon fontSize="small" /> {SHOP_INFO.email}
                </a>
              </div>

              {user && (
                <button type="button" className="nb-drawer__signout" onClick={logoutUser}>
                  <LogoutIcon fontSize="small" /> Sign out
                </button>
              )}
            </div>
          </nav>
        </>
      )}
    </header>
    </>
  );
};

export default NavBar;
