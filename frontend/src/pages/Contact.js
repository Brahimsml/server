import { useState } from "react";
import { Link } from "react-router-dom";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import api from "../api";
import SHOP_INFO from "../utils/shopInfo";
import { DEFAULT_DELIVERY_FEE, whatsappLink } from "../utils/shop";
import "../Styles/theme.css";
import "../Styles/ContactPage.css";
import usePageTitle from "../utils/usePageTitle";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM = { topic: "product", fname: "", email: "", phone: "", order: "", message: "" };

// What the message is about (sent at the top of the message, so the team sees it first)
const TOPICS = [
  { id: "order", label: "An order" },
  { id: "product", label: "A product" },
  { id: "returns", label: "Returns" },
  { id: "other", label: "Something else" },
];

const validate = (data) => {
  const e = {};
  if (data.fname.trim().length < 3) e.fname = "Please enter your full name (at least 3 characters).";
  if (!emailRegex.test(data.email.trim())) e.email = "Please enter a valid email address.";
  if (data.message.trim().length < 10) e.message = "Please write at least 10 characters.";
  return e;
};

// Short answers to the questions customers ask most
const FAQS = [
  {
    q: "How long does delivery take, and how much is it?",
    a: (
      <>
        We deliver all over Lebanon for ${DEFAULT_DELIVERY_FEE}. Beirut orders arrive faster; other areas take a little
        longer. <Link to="/shipping">Delivery info</Link>
      </>
    ),
  },
  {
    q: "How do I pay?",
    a: <>Cash on delivery: you pay the driver when your order arrives.</>,
  },
  {
    q: "Where is my order?",
    a: (
      <>
        Sign in and open <Link to="/my-orders">My orders</Link> to see the status of every order. We also email you
        when it changes.
      </>
    ),
  },
  {
    q: "Can I cancel an order?",
    a: (
      <>
        Yes, while it's still pending: open it in <Link to="/my-orders">My orders</Link> and press Cancel. If it's already
        on its way, message us.
      </>
    ),
  },
  {
    q: "Can I return a product?",
    a: (
      <>
        You have 7 days to change your mind. <Link to="/returns">How returns work</Link>
      </>
    ),
  },
];

function Contact() {
  usePageTitle("Contact us");
  const [form, setForm] = useState(EMPTY_FORM);
  // Only show a field's error after the user has left it or tried to send
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [failMsg, setFailMsg] = useState("");

  const errors = validate(form);
  const showError = (name) => touched[name] && errors[name];
  const wa = whatsappLink(SHOP_INFO.phone, "Hi MegaTech, I have a question.");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setFailMsg("");
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ fname: true, email: true, message: true });

    if (Object.keys(errors).length > 0) return;

    // The topic, phone and order number go at the top of the message the team receives
    const topic = TOPICS.find((t) => t.id === form.topic)?.label || "Other";
    const details = [
      `Topic: ${topic}`,
      form.phone.trim() && `Phone: ${form.phone.trim()}`,
      form.topic === "order" && form.order.trim() && `Order: #${form.order.trim().replace(/^#/, "")}`,
    ].filter(Boolean);

    try {
      setLoading(true);
      setFailMsg("");

      await api.post("/contact", {
        fname: form.fname.trim(),
        email: form.email.trim(),
        message: `${details.join(" · ")}\n\n${form.message.trim()}`,
      });

      setSent(true);
      setForm(EMPTY_FORM);
      setTouched({});
    } catch (err) {
      console.error("Contact Error:", err);
      setFailMsg(err?.response?.data?.message || "We couldn't send your message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const channels = [
    wa && {
      href: wa,
      external: true,
      icon: WhatsAppIcon,
      title: "WhatsApp",
      detail: "The fastest way to reach us",
      action: "Chat now",
      main: true,
    },
    {
      href: `tel:${SHOP_INFO.phoneLink}`,
      icon: PhoneOutlinedIcon,
      title: "Call us",
      detail: SHOP_INFO.phone,
      action: "Call",
    },
    {
      href: `mailto:${SHOP_INFO.email}`,
      icon: MailOutlineIcon,
      title: "Email",
      detail: SHOP_INFO.email,
      action: "Write to us",
    },
    {
      to: "/menu",
      icon: StorefrontOutlinedIcon,
      title: "Visit a store",
      detail: "See the gear and get advice in person",
      action: "Find a store",
    },
  ].filter(Boolean);

  return (
    <section className="mt-page">
      <div className="mt-container">
        <header className="ct-head">
          <span className="mt-eyebrow">Contact us</span>
          <h1 className="mt-title">How can we help?</h1>
        </header>

        {/* ===== Ways to reach us ===== */}
        <div className="ct-channels">
          {channels.map(({ href, to, external, icon: Icon, title, detail, action, main }) => {
            const inner = (
              <>
                <span className="ct-channel__icon">
                  <Icon />
                </span>
                <strong>{title}</strong>
                <span className="ct-channel__detail">{detail}</span>
                <span className="ct-channel__action">
                  {action} <ArrowForwardIcon fontSize="inherit" />
                </span>
              </>
            );
            const cls = `ct-channel ${main ? "is-main" : ""}`;
            return to ? (
              <Link key={title} to={to} className={cls}>
                {inner}
              </Link>
            ) : (
              <a key={title} href={href} className={cls} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
                {inner}
              </a>
            );
          })}
        </div>

        <div className="ct-layout">
          {/* ===== Form ===== */}
          <div className="ct-card mt-panel">
            {sent ? (
              <div className="ct-sent">
                <div className="mt-empty__icon ct-sent__icon">
                  <CheckCircleOutlineIcon fontSize="inherit" />
                </div>
                <h2>Message sent</h2>
                <p>Thanks for reaching out. Our team will reply to your email within 24 hours.</p>
                <button type="button" className="mt-btn mt-btn--secondary" onClick={() => setSent(false)}>
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <h2>Send us a message</h2>
                <p className="ct-card__sub">We reply within 24 hours.</p>

                {failMsg && (
                  <div className="mt-alert mt-alert--error" role="alert">
                    {failMsg}
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate>
                  <div className="ct-topic" role="radiogroup" aria-label="What is it about?">
                    <span className="ct-topic__label">What is it about?</span>
                    <div className="ct-topic__chips">
                      {TOPICS.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          role="radio"
                          aria-checked={form.topic === t.id}
                          className={form.topic === t.id ? "is-active" : ""}
                          onClick={() => setForm((f) => ({ ...f, topic: t.id }))}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="ct-row">
                    <label className={`mt-field ${showError("fname") ? "mt-field--invalid" : ""}`}>
                      <span>Full name</span>
                      <input
                        name="fname"
                        autoComplete="name"
                        placeholder="Your full name"
                        value={form.fname}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        aria-invalid={!!showError("fname")}
                      />
                      {showError("fname") && <small className="mt-field__error">{errors.fname}</small>}
                    </label>

                    <label className={`mt-field ${showError("email") ? "mt-field--invalid" : ""}`}>
                      <span>Email</span>
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        placeholder="you@example.com"
                        value={form.email}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        aria-invalid={!!showError("email")}
                      />
                      {showError("email") && <small className="mt-field__error">{errors.email}</small>}
                    </label>
                  </div>

                  <div className="ct-row">
                    <label className="mt-field">
                      <span>
                        Phone <em>(optional)</em>
                      </span>
                      <input name="phone" type="tel" autoComplete="tel" placeholder="e.g. 70 123 456" value={form.phone} onChange={handleChange} />
                    </label>

                    {form.topic === "order" && (
                      <label className="mt-field">
                        <span>
                          Order number <em>(optional)</em>
                        </span>
                        <input name="order" inputMode="numeric" placeholder="e.g. 215" value={form.order} onChange={handleChange} />
                      </label>
                    )}
                  </div>

                  <label className={`mt-field ${showError("message") ? "mt-field--invalid" : ""}`}>
                    <span>Message</span>
                    <textarea
                      name="message"
                      rows={5}
                      placeholder={
                        form.topic === "product"
                          ? "Which product, and what would you like to know? (compatibility, availability…)"
                          : "How can we help?"
                      }
                      value={form.message}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      aria-invalid={!!showError("message")}
                    />
                    {showError("message") && <small className="mt-field__error">{errors.message}</small>}
                  </label>

                  <button type="submit" className="mt-btn mt-btn--primary mt-btn--block" disabled={loading}>
                    {loading ? "Sending..." : "Send message"}
                  </button>
                </form>
              </>
            )}
          </div>

          {/* ===== Quick answers ===== */}
          <aside className="ct-faq mt-panel">
            <h2>Quick answers</h2>
            <p className="ct-card__sub">The questions we hear most.</p>
            <div className="ct-faq__list">
              {FAQS.map(({ q, a }) => (
                <details key={q} className="ct-faq__item">
                  <summary>
                    {q}
                    <ExpandMoreIcon className="ct-faq__chev" />
                  </summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
}

export default Contact;
