import React, { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import CloseIcon from "@mui/icons-material/Close";
import AuthForm from "./AuthForm";
import logo from "../Assets/logo.svg";
import { getUser } from "../utils/auth";
import "../Styles/Login.css";
import "../Styles/AuthModal.css";

/*
  The sign-in popup, like Noon or Nike: Sign in, Google, Create account and the email code,
  without leaving the page. Opened with openSignIn() (utils/auth.js) or a <SignInLink>.
  Afterwards the page reloads so the cart, wishlist and menu bar pick up the account
  (or goes to `redirect` when one was given). Centred card on computers, bottom sheet on phones.
*/
const safePath = (path) => (path && path.startsWith("/") && !path.startsWith("//") ? path : null);

const AuthModal = () => {
  const [open, setOpen] = useState(null); // { mode, context, redirect, key } while showing
  const panelRef = useRef(null);
  const returnFocus = useRef(null);
  const { pathname } = useLocation();

  useEffect(() => {
    const show = (e) => {
      if (getUser()) return; // already signed in
      returnFocus.current = document.activeElement;
      setOpen({ ...(e.detail || {}), key: Date.now() });
    };
    window.addEventListener("megatech:sign-in", show);
    return () => window.removeEventListener("megatech:sign-in", show);
  }, []);

  // Moving to another page (Forgot password, Terms...) closes it
  useEffect(() => setOpen(null), [pathname]);

  // While open: Esc closes, Tab stays inside, the page behind doesn't scroll
  useEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    panel?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll("a[href], button:not([disabled]), input, iframe, [tabindex]:not([tabindex='-1'])")];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusBack = returnFocus.current;
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      focusBack?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const signedIn = () => {
    const to = safePath(open.redirect);
    if (to) window.location.href = to;
    else window.location.reload();
  };

  return (
    <div className="auth-modal">
      <div className="auth-modal__backdrop" onClick={() => setOpen(null)} aria-hidden="true" />
      <div className="auth-modal__panel" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title" tabIndex={-1} ref={panelRef}>
        <div className="auth-modal__head">
          <img src={logo} alt="" />
          <span>MegaTech</span>
          <button type="button" className="auth-modal__close" onClick={() => setOpen(null)} aria-label="Close">
            <CloseIcon fontSize="small" />
          </button>
        </div>
        <div className="auth-modal__body">
          <AuthForm key={open.key} initialMode={open.mode} context={open.context} onSignedIn={signedIn} titleTag="h2" titleId="auth-modal-title" />
        </div>
        <p className="auth-modal__trust">Cash on delivery · 7-day returns · Delivery all over Lebanon</p>
      </div>
    </div>
  );
};

export default AuthModal;
