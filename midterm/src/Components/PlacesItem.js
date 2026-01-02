import React from "react";
import "../Styles/Menu.css";

function PlacesItem({ image, name, tel ,address }) {
  return (
    <div className="menuItem">
      <div
        className="menuItem-image"
        style={{ backgroundImage: `url(${image})` }}
      ></div>
      <h2>{name}</h2>
      <p>{address}</p>
      <h2>{tel}</h2>
    </div>
  );
}

export default PlacesItem;
