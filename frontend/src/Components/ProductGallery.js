import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import ZoomInIcon from "@mui/icons-material/ZoomIn";
import { FALLBACK_IMG, imageSrcSet, imageUrl, onImageError } from "../utils/shop";

/*
  Product photos, like big-store apps:
  - phones: swipe the photo left/right (it follows the finger), tap to open it full screen
  - computers: the mouse zooms in where it points, click to open it full screen
  - full screen: pinch or double-tap to zoom (click with a mouse), drag to look around,
    swipe or arrows for the next photo, Esc to close
    photos   image file names (main photo first)
    index    which one is shown; onIndex(i) changes it
    children badges drawn on the photo (Best Seller, -20%)
*/
const MAX_ZOOM = 4;
const TAP_ZOOM = 2.5;
const SWIPE_PART = 0.18; // swipe at least this part of the width to change photo
const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

// Past the first or last photo the row only follows the finger a little
const resist = (dx, index, count) => ((index === 0 && dx > 0) || (index === count - 1 && dx < 0) ? dx / 3 : dx);

/* ===================== Photo on the product page ===================== */
const ProductGallery = ({ photos, index, onIndex, alt, children }) => {
  const count = photos.length;
  const [drag, setDrag] = useState(0);
  const [lens, setLens] = useState(null); // mouse zoom point { x, y } in %
  const [viewer, setViewer] = useState(false);
  const box = useRef(null);
  const touch = useRef(null);

  const go = useCallback((i) => onIndex(clamp(i, 0, count - 1)), [onIndex, count]);
  const step = (dir) => onIndex((index + dir + count) % count);

  const onPointerDown = (e) => {
    if (e.target.closest("button")) return;
    touch.current = { x: e.clientX, y: e.clientY, type: e.pointerType, axis: null, dx: 0 };
  };

  const onPointerMove = (e) => {
    if (e.pointerType === "mouse") {
      const r = box.current.getBoundingClientRect();
      setLens({ x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * 100 });
      return;
    }
    const t = touch.current;
    if (!t) return;
    const dx = e.clientX - t.x;
    const dy = e.clientY - t.y;
    if (!t.axis && Math.hypot(dx, dy) > 8) t.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
    if (t.axis === "x" && count > 1) {
      t.dx = dx;
      setDrag(resist(dx, index, count));
    }
  };

  const onPointerUp = (e) => {
    const t = touch.current;
    touch.current = null;
    if (!t) return;
    if (t.axis === "x") {
      const width = box.current.offsetWidth;
      if (Math.abs(t.dx) > width * SWIPE_PART) go(index + (t.dx < 0 ? 1 : -1));
      setDrag(0);
    } else if (!t.axis && !e.target.closest("button")) {
      setViewer(true); // a tap or click opens the photo full screen
    }
  };

  const onPointerCancel = () => {
    touch.current = null;
    setDrag(0);
  };

  return (
    <div className="pd-gallery">
      <div
        ref={box}
        className={`pd-media ${lens ? "is-zooming" : ""}`}
        tabIndex={0}
        role="group"
        aria-roledescription="carousel"
        aria-label={count > 1 ? `Photo ${index + 1} of ${count}. Press Enter to open it full screen.` : "Press Enter to open the photo full screen."}
        onKeyDown={(e) => {
          if (e.key === "Enter") setViewer(true);
          if (count < 2) return;
          if (e.key === "ArrowRight") step(1);
          if (e.key === "ArrowLeft") step(-1);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={(e) => e.pointerType === "mouse" && setLens(null)}
      >
        {children}
        <div
          className="pd-track"
          style={{ transform: `translateX(calc(${-index * 100}% + ${drag}px))`, transition: drag ? "none" : undefined }}
        >
          {photos.map((img, i) => (
            <div className="pd-slide" key={`${img}-${i}`} aria-hidden={i !== index}>
              <img
                src={imageUrl(img) || FALLBACK_IMG}
                srcSet={imageSrcSet(img)}
                sizes="(max-width: 900px) 100vw, 640px"
                alt={i === 0 ? alt : `${alt}, photo ${i + 1}`}
                loading={i === 0 ? "eager" : "lazy"}
                draggable={false}
                onError={onImageError}
                style={i === index && lens ? { transformOrigin: `${lens.x}% ${lens.y}%` } : undefined}
              />
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button type="button" className="pd-arrow pd-arrow--prev" onClick={() => step(-1)} aria-label="Previous photo">
              <ChevronLeftIcon />
            </button>
            <button type="button" className="pd-arrow pd-arrow--next" onClick={() => step(1)} aria-label="Next photo">
              <ChevronRightIcon />
            </button>
            <span className="pd-count">
              {index + 1} / {count}
            </span>
          </>
        )}
        <span className="pd-zoom-hint" aria-hidden="true">
          <ZoomInIcon fontSize="inherit" />
        </span>
      </div>

      {count > 1 && (
        <div className="pd-thumbs" role="tablist" aria-label="Product photos">
          {photos.map((img, i) => (
            <button
              key={`${img}-${i}`}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show photo ${i + 1}`}
              className={i === index ? "is-active" : ""}
              onClick={() => onIndex(i)}
            >
              <img src={imageUrl(img)} srcSet={imageSrcSet(img, 320)} sizes="90px" alt="" loading="lazy" onError={onImageError} />
            </button>
          ))}
        </div>
      )}

      {viewer && <PhotoViewer photos={photos} index={index} onIndex={onIndex} alt={alt} onClose={() => setViewer(false)} />}
    </div>
  );
};

/* ===================== Full screen photos ===================== */
const NO_ZOOM = { s: 1, x: 0, y: 0 };

const PhotoViewer = ({ photos, index, onIndex, alt, onClose }) => {
  const count = photos.length;
  const [view, setViewState] = useState(NO_ZOOM); // zoom (s) and position (x, y in px)
  const [drag, setDrag] = useState(0);
  const [moving, setMoving] = useState(false);
  const viewRef = useRef(NO_ZOOM);
  const stage = useRef(null);
  const dialog = useRef(null);
  const closeBtn = useRef(null);
  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const lastTap = useRef(null);

  const setView = (v) => {
    viewRef.current = v;
    setViewState(v);
  };

  // Keep the zoomed photo from sliding out of the screen
  const fit = (s, x, y) => {
    const w = stage.current?.offsetWidth || 0;
    const h = stage.current?.offsetHeight || 0;
    const mx = ((s - 1) * w) / 2;
    const my = ((s - 1) * h) / 2;
    return { s, x: clamp(x, -mx, mx), y: clamp(y, -my, my) };
  };

  // A point on the screen, measured from the middle of the photo area
  const fromCenter = (cx, cy) => {
    const r = stage.current.getBoundingClientRect();
    return { px: cx - r.left - r.width / 2, py: cy - r.top - r.height / 2 };
  };

  // Zoom in on the point that was tapped/clicked, or back out
  const toggleZoom = (cx, cy) => {
    if (viewRef.current.s > 1) return setView(NO_ZOOM);
    const { px, py } = fromCenter(cx, cy);
    setView(fit(TAP_ZOOM, -px * (TAP_ZOOM - 1), -py * (TAP_ZOOM - 1)));
  };

  const go = (i) => {
    if (i < 0 || i >= count) return;
    setView(NO_ZOOM);
    onIndex(i);
  };

  // Open: lock the page behind, focus the close button; close: give focus back
  useEffect(() => {
    const before = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeBtn.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      before?.focus?.();
    };
  }, []);

  // Keys work wherever the focus is while the viewer is open (clicking the photo moves it)
  const onKeyDown = (e) => {
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === "ArrowLeft") go(index - 1);
    else if (e.key === "Tab") {
      // keep the keyboard inside the viewer
      const items = [...dialog.current.querySelectorAll("button:not(:disabled)")];
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (!dialog.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      }
    }
  };
  const keyHandler = useRef(onKeyDown);
  keyHandler.current = onKeyDown;
  useEffect(() => {
    const listen = (e) => keyHandler.current(e);
    document.addEventListener("keydown", listen);
    return () => document.removeEventListener("keydown", listen);
  }, []);

  const onPointerDown = (e) => {
    if (e.target.closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = viewRef.current;
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const { px, py } = fromCenter(mid.x, mid.y);
      // the spot of the photo under the fingers stays under them while zooming
      gesture.current = { pinch: true, d0: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), s0: v.s, qx: (px - v.x) / v.s, qy: (py - v.y) / v.s };
      setDrag(0);
    } else if (pts.length === 1) {
      gesture.current = { x0: e.clientX, y0: e.clientY, vx: v.x, vy: v.y, axis: null, dx: 0, moved: false, type: e.pointerType };
    }
    setMoving(true);
  };

  const onPointerMove = (e) => {
    const g = gesture.current;
    const v = viewRef.current;
    // mouse over a zoomed photo: it follows the mouse, like a magnifier
    if (e.pointerType === "mouse" && !pointers.current.has(e.pointerId)) {
      if (v.s > 1) {
        const { px, py } = fromCenter(e.clientX, e.clientY);
        setView(fit(v.s, -px * (v.s - 1), -py * (v.s - 1)));
      }
      return;
    }
    if (!pointers.current.has(e.pointerId) || !g) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];

    if (g.pinch && pts.length >= 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const s = clamp((g.s0 * d) / g.d0, 1, MAX_ZOOM);
      const { px, py } = fromCenter((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
      setView(fit(s, px - g.qx * s, py - g.qy * s));
      return;
    }
    if (g.pinch) return;

    const dx = e.clientX - g.x0;
    const dy = e.clientY - g.y0;
    if (Math.hypot(dx, dy) > 8) g.moved = true;
    if (v.s > 1) {
      setView(fit(v.s, g.vx + dx, g.vy + dy)); // look around the zoomed photo
    } else if (count > 1) {
      if (!g.axis && g.moved) g.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (g.axis === "x") {
        g.dx = dx;
        setDrag(resist(dx, index, count));
      }
    }
  };

  const onPointerUp = (e) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    const left = [...pointers.current.values()];

    if (g?.pinch) {
      if (viewRef.current.s < 1.05) setView(NO_ZOOM);
      // one finger still down: carry on moving the photo with it
      gesture.current = left.length
        ? { x0: left[0].x, y0: left[0].y, vx: viewRef.current.x, vy: viewRef.current.y, axis: null, dx: 0, moved: true }
        : null;
      if (!left.length) setMoving(false);
      return;
    }

    gesture.current = null;
    setMoving(false);
    if (!g) return;

    if (g.axis === "x") {
      const width = stage.current.offsetWidth;
      if (Math.abs(g.dx) > width * SWIPE_PART) go(index + (g.dx < 0 ? 1 : -1));
      setDrag(0);
      return;
    }
    if (g.moved) return;

    // A click zooms in or out; on touch screens it's a double-tap (like the Photos app)
    if (g.type === "mouse") return toggleZoom(e.clientX, e.clientY);
    const now = Date.now();
    const prev = lastTap.current;
    if (prev && now - prev.t < 320 && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < 30) {
      lastTap.current = null;
      toggleZoom(e.clientX, e.clientY);
    } else {
      lastTap.current = { t: now, x: e.clientX, y: e.clientY };
    }
  };

  const onPointerCancel = (e) => {
    pointers.current.delete(e.pointerId);
    if (!pointers.current.size) {
      gesture.current = null;
      setMoving(false);
      setDrag(0);
    }
  };

  const zoomed = view.s > 1;

  return createPortal(
    <div ref={dialog} className="pv" role="dialog" aria-modal="true" aria-label={`${alt}: photos`}>
      <div className="pv-bar">
        <span className="pv-count">{count > 1 ? `${index + 1} / ${count}` : ""}</span>
        <span className="pv-tip pv-tip--touch">{zoomed ? "Drag to look around" : "Pinch or double-tap to zoom"}</span>
        <span className="pv-tip pv-tip--mouse">{zoomed ? "Move the mouse to look around, click to zoom out" : "Click to zoom in"}</span>
        <button ref={closeBtn} type="button" className="pv-close" onClick={onClose} aria-label="Close photos">
          <CloseIcon />
        </button>
      </div>

      <div
        ref={stage}
        className={`pv-stage ${zoomed ? "is-zoomed" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div
          className="pv-track"
          style={{ transform: `translateX(calc(${-index * 100}% + ${drag}px))`, transition: drag ? "none" : undefined }}
        >
          {photos.map((img, i) => (
            <div className="pv-slide" key={`${img}-${i}`} aria-hidden={i !== index}>
              <img
                src={imageUrl(img) || FALLBACK_IMG}
                srcSet={imageSrcSet(img, 2400)}
                sizes="100vw"
                alt={i === 0 ? alt : `${alt}, photo ${i + 1}`}
                draggable={false}
                onError={onImageError}
                style={
                  i === index
                    ? { transform: `translate(${view.x}px, ${view.y}px) scale(${view.s})`, transition: moving ? "none" : undefined }
                    : undefined
                }
              />
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button type="button" className="pv-arrow pv-arrow--prev" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Previous photo">
              <ChevronLeftIcon />
            </button>
            <button type="button" className="pv-arrow pv-arrow--next" onClick={() => go(index + 1)} disabled={index === count - 1} aria-label="Next photo">
              <ChevronRightIcon />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="pv-thumbs">
          {photos.map((img, i) => (
            <button
              key={`${img}-${i}`}
              type="button"
              className={i === index ? "is-active" : ""}
              onClick={() => go(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-current={i === index ? "true" : undefined}
            >
              <img src={imageUrl(img)} srcSet={imageSrcSet(img, 320)} sizes="64px" alt="" loading="lazy" onError={onImageError} />
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body
  );
};

export default ProductGallery;
