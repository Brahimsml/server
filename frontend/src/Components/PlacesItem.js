import React from "react";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import DirectionsOutlinedIcon from "@mui/icons-material/DirectionsOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import { onImageError } from "../utils/shop";

const hasCoords = (lat, lng) =>
  lat !== null && lat !== "" && lng !== null && lng !== "" &&
  Number.isFinite(Number(lat)) && Number.isFinite(Number(lng));

function PlacesItem({ image, name, tel, address, lat, lng }) {
  const coords = hasCoords(lat, lng);

  const mapSrc = coords
    ? `https://www.google.com/maps?q=${lat},${lng}&hl=en&z=15&output=embed`
    : null;

  // Directions open in Google Maps (by coordinates, or by address if none)
  const directionsUrl = coords
    ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
    : address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;

  return (
    <article className="loc-card">
      <div className="loc-card__media">
        {image ? (
          <img src={image} alt={name} loading="lazy" onError={onImageError} />
        ) : (
          <div className="loc-card__noimg">
            <StorefrontOutlinedIcon fontSize="inherit" />
          </div>
        )}
      </div>

      <div className="loc-card__body">
        <h2>{name}</h2>

        <ul className="loc-card__details">
          {address && (
            <li>
              <PlaceOutlinedIcon fontSize="small" />
              <span>{address}</span>
            </li>
          )}
          {tel && (
            <li>
              <PhoneOutlinedIcon fontSize="small" />
              <a href={`tel:${tel}`}>{tel}</a>
            </li>
          )}
        </ul>

        <div className="loc-card__actions">
          {directionsUrl && (
            <a
              className="mt-btn mt-btn--primary mt-btn--sm"
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <DirectionsOutlinedIcon /> Directions
            </a>
          )}
          {tel && (
            <a className="mt-btn mt-btn--secondary mt-btn--sm" href={`tel:${tel}`}>
              <PhoneOutlinedIcon /> Call
            </a>
          )}
        </div>
      </div>

      {mapSrc && (
        <div className="loc-card__map">
          <iframe
            title={`Map of ${name}`}
            src={mapSrc}
            loading="lazy"
            allowFullScreen=""
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}
    </article>
  );
}

export default PlacesItem;
