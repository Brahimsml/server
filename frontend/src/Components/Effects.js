import { useEffect } from "react";

/*
  Small, library-free effects for the shop pages (styles in Styles/fx.css):
  - sections and cards fade in as they scroll into view
  - cards tilt a little towards the pointer; the banner gets a soft spotlight
  - the navbar knows when the page is scrolled
  Nothing runs for people who ask for reduced motion, and only the
  customer pages (.is-shop) are touched.
*/
const REVEAL = [
  ".is-shop .mt-section",
  ".is-shop .hp-trust",
  ".is-shop .mt-cta",
  ".is-shop .pc-card",
  ".is-shop .hp-cat",
  ".is-shop .mt-head",
  ".is-shop .sh-head",
  ".is-shop .pc-side",
].join(",");

const TILT = ".is-shop .pc-card, .is-shop .hp-cat";
const SPOTLIGHT = ".is-shop .hp-slider";
const MAGNET = ".is-shop .mt-btn--primary, .is-shop .auth-submit, .is-shop .cart-btn--primary";
const MAGNET_PULL = 0.18; // how far a gold button leans towards the pointer
const MAGNET_MAX = 6; // px
const MAX_TILT = 5; // degrees

const Effects = () => {
  useEffect(() => {
    const root = document.documentElement;

    // Navbar shadow once the page is scrolled
    const onScroll = () => root.toggleAttribute("data-scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) {
      return () => window.removeEventListener("scroll", onScroll);
    }

    // Scroll reveal
    const seen = new WeakSet();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    const scan = () => {
      document.querySelectorAll(REVEAL).forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        // cards in a row appear one after another
        const index = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
        el.style.setProperty("--fx-i", String(Math.min(index, 8)));
        el.classList.add("fx-reveal");
        io.observe(el);
      });
    };

    root.classList.add("fx-ready");
    scan();
    // pages and product grids render later (routing, loading, paging)
    let queued = false;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        scan();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    // Tilt + pointer light (mouse / pen only)
    let active = null;
    let magnet = null;
    const release = (el) => {
      el.style.removeProperty("--bx");
      el.style.removeProperty("--by");
    };
    const reset = (el) => {
      el.style.removeProperty("--rx");
      el.style.removeProperty("--ry");
    };
    const onMove = (e) => {
      if (e.pointerType === "touch") return;

      // gold buttons lean gently towards the pointer
      const btn = e.target.closest?.(MAGNET);
      if (magnet && magnet !== btn) release(magnet);
      magnet = btn;
      if (btn && !btn.disabled) {
        const b = btn.getBoundingClientRect();
        const clamp = (v) => Math.max(-MAGNET_MAX, Math.min(MAGNET_MAX, v));
        btn.style.setProperty("--bx", `${clamp((e.clientX - b.left - b.width / 2) * MAGNET_PULL).toFixed(1)}px`);
        btn.style.setProperty("--by", `${clamp((e.clientY - b.top - b.height / 2) * MAGNET_PULL).toFixed(1)}px`);
      }

      const card = e.target.closest?.(TILT);
      if (active && active !== card) reset(active);
      active = card;

      const lit = card || e.target.closest?.(SPOTLIGHT);
      if (!lit) return;
      const r = lit.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      lit.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
      lit.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
      if (card) {
        card.style.setProperty("--ry", `${((x - 0.5) * MAX_TILT * 2).toFixed(2)}deg`);
        card.style.setProperty("--rx", `${((0.5 - y) * MAX_TILT * 2).toFixed(2)}deg`);
      }
    };
    const onLeave = () => {
      if (active) reset(active);
      if (magnet) release(magnet);
      active = null;
      magnet = null;
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      mo.disconnect();
      io.disconnect();
      root.classList.remove("fx-ready");
    };
  }, []);

  return null;
};

export default Effects;
