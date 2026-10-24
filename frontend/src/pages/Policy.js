import React, { useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import "../Styles/theme.css";
import "../Styles/Policy.css";

/*
  Shop policies. The rules come from the shop owner:
  - delivery fee $5 per order, Beirut is delivered faster than other areas
  - pay cash when the order arrives (online card payment comes later)
  - returns within 7 days
  Change the text here if a rule changes (and DELIVERY_FEE in backend/.env for the fee).
*/
const UPDATED = "October 2026";
const PHONE = "70 123 456";
const EMAIL = "support@megatech.com";

const POLICIES = {
  shipping: {
    title: "Shipping & delivery",
    intro: "How we get your order to you, what it costs and how you pay.",
    sections: [
      {
        heading: "Where we deliver",
        body: [
          "We deliver across Lebanon. Orders in Beirut usually arrive faster; other areas take a little longer.",
          "Our team may call you on the phone number you gave at checkout to confirm your order and the delivery time.",
        ],
      },
      {
        heading: "Delivery fee",
        body: ["Delivery costs $5 per order. You'll see it in your order summary before you place the order."],
      },
      {
        heading: "Paying for your order",
        body: [
          "You pay cash on delivery, when your order arrives.",
          "We never ask for your card details on this website or by email.",
        ],
      },
      {
        heading: "Tracking your order",
        body: [
          "You can follow every order in My orders, and we email you each time its status changes.",
        ],
      },
    ],
  },
  returns: {
    title: "Returns",
    intro: "Changed your mind or something isn't right? Here's how returns work.",
    sections: [
      {
        heading: "7-day returns",
        body: [
          "You can return a product within 7 days of receiving it.",
          "Please keep the product in the condition you received it, with its box, accessories and paperwork, so we can accept the return.",
        ],
      },
      {
        heading: "How to return a product",
        body: [
          `Call us on ${PHONE} or email ${EMAIL} with your order number. We'll tell you how to bring or send the product back and arrange your refund or exchange.`,
        ],
      },
      {
        heading: "Faulty or damaged products",
        body: [
          "If a product arrives damaged or doesn't work, contact us as soon as possible with your order number and we'll sort it out.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy policy",
    intro: "What we collect when you shop with MegaTech, and what we do with it.",
    sections: [
      {
        heading: "What we collect",
        body: [
          "Your name and email address when you create an account (or your name and email from Google if you sign in with Google).",
          "Your phone number and delivery address when you place an order, and the details of your orders.",
          "Messages you send us through the contact form.",
          "Your password is stored encrypted; nobody at MegaTech can read it.",
        ],
      },
      {
        heading: "How we use it",
        body: [
          "To deliver your orders, contact you about them, and email you order confirmations, status updates, sign-up codes and password-reset links.",
          "We don't sell your information or share it with advertisers.",
        ],
      },
      {
        heading: "On your device",
        body: [
          "Your shopping cart is saved in your browser so it's still there when you come back. If you tick “Keep me signed in”, your sign-in is also saved for up to 30 days; otherwise it ends when you close the tab.",
        ],
      },
      {
        heading: "Your choices",
        body: [`To see, change or delete your information, contact us on ${PHONE} or ${EMAIL}.`],
      },
    ],
  },
  terms: {
    title: "Terms of use",
    intro: "The rules for using the MegaTech website and placing orders.",
    sections: [
      {
        heading: "Your account",
        body: [
          "You need an account to place an order. Please keep your password private; you're responsible for orders placed from your account.",
        ],
      },
      {
        heading: "Prices and stock",
        body: [
          "Prices are in US dollars and can change at any time; you pay the price shown when you place your order.",
          "Every order is checked against our stock. If a product runs out, we'll tell you and won't charge you for it.",
        ],
      },
      {
        heading: "Orders",
        body: [
          "We may contact you to confirm an order, and we may cancel an order if we can't reach you or deliver to your address.",
          "Delivery, payment and returns follow our Shipping & delivery and Returns pages.",
        ],
      },
      {
        heading: "Questions",
        body: [`Contact us on ${PHONE} or ${EMAIL}.`],
      },
    ],
  },
};

export const POLICY_LINKS = [
  { to: "/shipping", label: "Shipping & delivery" },
  { to: "/returns", label: "Returns" },
  { to: "/privacy", label: "Privacy policy" },
  { to: "/terms", label: "Terms of use" },
];

const Policy = ({ slug }) => {
  const policy = POLICIES[slug];

  useEffect(() => {
    document.title = `${policy.title} | MegaTech`;
    return () => {
      document.title = "MegaTech | PC Components & Gaming Gear";
    };
  }, [policy.title]);

  return (
    <section className="mt-page">
      <div className="mt-container pol">
        <nav className="pol-nav" aria-label="Shop policies">
          {POLICY_LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} className={({ isActive }) => (isActive ? "is-active" : "")}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <article className="pol-body">
          <span className="mt-eyebrow">Help</span>
          <h1 className="mt-title">{policy.title}</h1>
          <p className="mt-lead">{policy.intro}</p>

          {policy.sections.map((s) => (
            <section key={s.heading} className="pol-section">
              <h2>{s.heading}</h2>
              {s.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </section>
          ))}

          <p className="pol-updated">
            Last updated {UPDATED}. Questions? <Link to="/contact">Contact us</Link>.
          </p>
        </article>
      </div>
    </section>
  );
};

export default Policy;
