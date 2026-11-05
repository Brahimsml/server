import React, { useRef, useState } from "react";
import BannerSlide, { PROMO_ASPECT } from "./BannerSlide";

/*
  One promo section on the home page (Admin → Banners → Promo sections).
  Computers: the banners side by side. Phones: 2 or 3 banners become a swipe row (the next one
  peeking in) with dots under it that follow the swipe, like the Amazon or Noon apps.
*/
const PromoRow = ({ promo }) => {
  const rowRef = useRef(null);
  const [current, setCurrent] = useState(0);
  const many = promo.slots.length > 1;

  // which banner is in view (from how far the row has been swiped)
  const step = () => {
    const [a, b] = rowRef.current?.children || [];
    return a && b ? b.offsetLeft - a.offsetLeft : 1;
  };
  const onScroll = () => {
    const el = rowRef.current;
    if (!el) return;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
    setCurrent(atEnd ? promo.slots.length - 1 : Math.round(el.scrollLeft / step()));
  };
  const goTo = (i) => rowRef.current?.scrollTo({ left: i * step(), behavior: "smooth" });

  return (
    <section className="mt-section hp-promo-wrap" aria-label="Offers">
      <div className={`hp-promos hp-promos--${promo.layout}`} ref={rowRef} onScroll={many ? onScroll : undefined}>
        {promo.slots.map((slot) => (
          <div key={slot.id} className="hp-promo">
            <BannerSlide banner={slot} placeholder={false} aspect={PROMO_ASPECT[promo.layout]} />
          </div>
        ))}
      </div>
      {many && (
        <div className="hp-promo-dots">
          {promo.slots.map((slot, i) => (
            <button
              key={slot.id}
              type="button"
              className={i === current ? "is-active" : ""}
              aria-label={`Show offer ${i + 1} of ${promo.slots.length}`}
              aria-current={i === current ? "true" : undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export default PromoRow;
