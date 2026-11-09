import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/*
  Modern look preview (Components/ModernHome.js, Styles/ModernPreview.css): the home page and the shop.
  ?look=modern on either turns it on for this browser tab, ?look=classic turns it off.
*/
const KEY = "mt-look";
const PAGES = ["/", "/home", "/shop"];

export const isModernLook = (location = window.location) => {
  if (!PAGES.includes(location.pathname)) return false;
  const look = new URLSearchParams(location.search).get("look");
  try {
    if (look === "modern") sessionStorage.setItem(KEY, "modern");
    if (look === "classic") sessionStorage.removeItem(KEY);
    return sessionStorage.getItem(KEY) === "modern";
  } catch {
    return look === "modern";
  }
};

// On a page that uses it: is the modern look on? Adds html.mt-modern while it is.
export const useModernLook = () => {
  const location = useLocation();
  const modern = isModernLook(location);
  useEffect(() => {
    if (!modern) return undefined;
    document.documentElement.classList.add("mt-modern");
    return () => document.documentElement.classList.remove("mt-modern");
  }, [modern]);
  return modern;
};
