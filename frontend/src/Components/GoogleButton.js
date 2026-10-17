import React, { useEffect, useRef } from "react";

// "Continue with Google" using Google's own sign-in button.
// Hidden until REACT_APP_GOOGLE_CLIENT_ID is set in frontend/.env.
const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let scriptPromise;
const loadGoogleScript = () => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = resolve;
      script.onerror = () => {
        scriptPromise = null; // allow a retry next time
        reject(new Error("Google script failed to load"));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
};

export const googleEnabled = Boolean(CLIENT_ID);

const GoogleButton = ({ onCredential, onError, text = "continue_with" }) => {
  const holder = useRef(null);
  // keep the latest callbacks without re-rendering Google's button
  const handlers = useRef({ onCredential, onError });
  handlers.current = { onCredential, onError };

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;

    loadGoogleScript()
      .then(() => {
        if (cancelled || !holder.current) return;
        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: (response) => handlers.current.onCredential?.(response.credential),
        });
        holder.current.innerHTML = "";
        window.google.accounts.id.renderButton(holder.current, {
          theme: "filled_black",
          size: "large",
          shape: "pill",
          text,
          width: Math.min(400, holder.current.offsetWidth || 320),
        });
      })
      .catch(() => handlers.current.onError?.("Google sign-in couldn't load. Check your connection."));

    return () => {
      cancelled = true;
    };
  }, [text]);

  if (!CLIENT_ID) return null;
  return <div ref={holder} className="auth-google" />;
};

export default GoogleButton;
