import React, { useEffect, useRef, useState } from "react";

/*
  A picture inside a box of a fixed shape, placed the way the admin set it with the crop tool:
    aspect  the box's width / height (32/9 top banner, 1 for a category circle...). The box's real
            shape is measured on screen, so a box that's taller on phones still places it right.
    zoom    100 = fills the box exactly (edges trimmed if the shapes differ),
            lower = zoomed out (down to the whole picture), higher = zoomed in
    x, y    0-100: which part stays in view (or where it sits when zoomed out)
    fill    what shows around a zoomed-out picture: "dark" (the site's background) or "blur"
            (a soft, blurred copy of the same picture, like Instagram)
    phoneSrc  an optional picture made for phones: shown instead of `src` on screens up to 860px
              wide (the browser only downloads the one it shows)
    srcSet, sizes, phoneSrcSet  smaller copies of the pictures (utils/shop imageSrcSet), so the
              browser downloads the smallest one that still looks sharp
  The picture file is never changed. Until the picture has loaded it shows like a plain cover photo.
*/

// Size of the picture in % of the box when it exactly fills it
const coverSize = (ratio, aspect) => (ratio > aspect ? { w: (ratio / aspect) * 100, h: 100 } : { w: 100, h: (aspect / ratio) * 100 });

// The zoom (in %) at which the whole picture just fits in the box
export const fitZoom = (ratio, aspect) => {
  const { w, h } = coverSize(ratio, aspect);
  return Math.floor((100 / Math.max(w, h)) * 100);
};

// Where the picture goes, in % of the box: { width, height, left, top }
export const framePlacement = (ratio, aspect, zoom = 100, x = 50, y = 50) => {
  const { w, h } = coverSize(ratio, aspect);
  const s = Math.max(Number(zoom) || 100, fitZoom(ratio, aspect)) / 100;
  const width = w * s;
  const height = h * s;
  return { width, height, left: ((100 - width) * x) / 100, top: ((100 - height) * y) / 100 };
};

const PHONE_SCREEN = "(max-width: 860px)";

const FramedImage = ({ src, srcSet, sizes, phoneSrc, phoneSrcSet, aspect, zoom = 100, x = 50, y = 50, fill = "dark", className = "", alt = "", loading = "lazy", onError, ...rest }) => {
  const [ratio, setRatio] = useState(null);
  const [shown, setShown] = useState(src); // the picture the browser picked (phone or computer one)
  const [boxAspect, setBoxAspect] = useState(null);
  const imgRef = useRef(null);
  const boxRef = useRef(null);
  const measure = (img) => {
    if (!img?.naturalWidth) return;
    setRatio(img.naturalWidth / img.naturalHeight);
    setShown(img.currentSrc || img.src);
  };

  // the box's real shape on this screen (e.g. the top banner is taller on phones)
  useEffect(() => {
    const box = boxRef.current;
    if (!box || !window.ResizeObserver) return undefined;
    const ro = new ResizeObserver(() => {
      const { width, height } = box.getBoundingClientRect();
      if (width > 0 && height > 0) setBoxAspect(width / height);
    });
    ro.observe(box);
    return () => ro.disconnect();
  }, []);

  // a picture already in the browser's cache can finish loading before React listens
  useEffect(() => {
    setRatio(null);
    if (imgRef.current?.complete) measure(imgRef.current);
  }, [src, phoneSrc]);
  const place = ratio ? framePlacement(ratio, boxAspect || aspect, zoom, x, y) : null;
  const zoomedOut = place && (place.width < 99.5 || place.height < 99.5);

  const img = (
    <img
      ref={imgRef}
      className="mt-frame__img"
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      loading={loading}
      onError={onError}
      onLoad={(e) => measure(e.target)}
      style={
        place
          ? { width: `${place.width}%`, height: `${place.height}%`, left: `${place.left}%`, top: `${place.top}%` }
          : { width: "100%", height: "100%", left: 0, top: 0, objectFit: "cover", objectPosition: `${x}% ${y}%` }
      }
    />
  );

  return (
    <span ref={boxRef} className={`mt-frame ${className}`} {...rest}>
      {zoomedOut && fill === "blur" && <img className="mt-frame__blur" src={shown || src} alt="" aria-hidden="true" />}
      {phoneSrc ? (
        <picture>
          <source media={PHONE_SCREEN} srcSet={phoneSrcSet || phoneSrc} sizes={phoneSrcSet ? "100vw" : undefined} />
          {img}
        </picture>
      ) : (
        img
      )}
    </span>
  );
};

export default FramedImage;
