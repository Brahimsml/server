import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/*
  Visitor statistics with Google Analytics 4.
  Off until REACT_APP_GA_ID (e.g. G-ABC123XYZ) is set in frontend/.env.
  Counts a page view on every page change. Admin pages are never counted,
  and no names, emails or orders are sent.
*/
const GA_ID = process.env.REACT_APP_GA_ID;
const ADMIN_PATH = /^\/(admin|products|categories|places|orders|contacts)(\/|$)/;

let loaded = false;
const load = () => {
  if (loaded || !GA_ID) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments); // eslint-disable-line prefer-rest-params
  };
  window.gtag("js", new Date());
  window.gtag("config", GA_ID, { send_page_view: false, anonymize_ip: true });

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
  document.head.appendChild(script);
};

export const analyticsEnabled = Boolean(GA_ID);

const Analytics = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (!GA_ID || ADMIN_PATH.test(pathname)) return;
    load();
    // wait a moment so the page has its own title
    const t = setTimeout(() => {
      window.gtag("event", "page_view", {
        page_path: pathname + search,
        page_location: window.location.href,
        page_title: document.title,
      });
    }, 300);
    return () => clearTimeout(t);
  }, [pathname, search]);

  return null;
};

export default Analytics;
