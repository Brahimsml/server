import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Start each new page at the top (React Router keeps the old scroll position otherwise).
// A link to a section (e.g. /home#best-sellers) scrolls to that section instead, waiting
// a moment for it to appear while the page loads.
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return undefined;
    }
    let tries = 0;
    const find = setInterval(() => {
      const target = document.getElementById(decodeURIComponent(hash.slice(1)));
      if (target || ++tries > 30) {
        clearInterval(find);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
        else window.scrollTo(0, 0);
      }
    }, 100);
    return () => clearInterval(find);
  }, [pathname, hash]);

  return null;
};

export default ScrollToTop;
