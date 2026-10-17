import { useState } from "react";
import { Link } from "react-router-dom";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import MemoryOutlinedIcon from "@mui/icons-material/MemoryOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import api from "../api";
import "../Styles/theme.css";
import "../Styles/ContactPage.css";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM = { fname: "", email: "", message: "" };

const validate = (data) => {
  const e = {};
  if (data.fname.trim().length < 3) e.fname = "Please enter your full name (at least 3 characters).";
  if (!emailRegex.test(data.email.trim())) e.email = "Please enter a valid email address.";
  if (data.message.trim().length < 10) e.message = "Please write at least 10 characters.";
  return e;
};

const TOPICS = [
  { icon: ScheduleOutlinedIcon, title: "Fast support", text: "We usually reply within 24 hours." },
  { icon: MemoryOutlinedIcon, title: "Product help", text: "Availability, compatibility and recommendations." },
  { icon: ReceiptLongOutlinedIcon, title: "Order support", text: "Questions about checkout or an existing order." },
];

function Contact() {
  const [form, setForm] = useState(EMPTY_FORM);
  // Only show a field's error after the user has left it or tried to send
  const [touched, setTouched] = useState({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [failMsg, setFailMsg] = useState("");

  const errors = validate(form);
  const showError = (name) => touched[name] && errors[name];

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

    try {
      setLoading(true);
      setFailMsg("");

      await api.post("/contact", {
        fname: form.fname.trim(),
        email: form.email.trim(),
        message: form.message.trim(),
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

  return (
    <section className="mt-page">
      <div className="mt-container ct-layout">
        {/* ===== INFO ===== */}
        <div className="ct-info">
          <span className="mt-eyebrow">Contact</span>
          <h1 className="mt-title">Let's talk about your setup</h1>
          <p className="mt-lead">
            Have a question about products, orders, our stores, or your next PC build? Send us a
            message and our team will get back to you.
          </p>

          <div className="ct-methods">
            <a className="ct-method mt-panel" href="tel:+96170123456">
              <span className="ct-icon">
                <PhoneOutlinedIcon />
              </span>
              <span>
                <small>Call us</small>
                <strong>70 123 456</strong>
              </span>
            </a>

            <a className="ct-method mt-panel" href="mailto:support@megatech.com">
              <span className="ct-icon">
                <MailOutlineIcon />
              </span>
              <span>
                <small>Email</small>
                <strong>support@megatech.com</strong>
              </span>
            </a>

            <Link className="ct-method mt-panel" to="/menu">
              <span className="ct-icon">
                <StorefrontOutlinedIcon />
              </span>
              <span>
                <small>Visit</small>
                <strong>Find a store near you</strong>
              </span>
            </Link>
          </div>

          <ul className="ct-topics">
            {TOPICS.map(({ icon: Icon, title, text }) => (
              <li key={title}>
                <Icon fontSize="small" />
                <div>
                  <strong>{title}</strong>
                  <span>{text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* ===== FORM ===== */}
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
              <p className="ct-card__sub">We'll reply within 24 hours.</p>

              {failMsg && (
                <div className="mt-alert mt-alert--error" role="alert">
                  {failMsg}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
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

                <label className={`mt-field ${showError("message") ? "mt-field--invalid" : ""}`}>
                  <span>Message</span>
                  <textarea
                    name="message"
                    rows={6}
                    placeholder="How can we help?"
                    value={form.message}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    aria-invalid={!!showError("message")}
                  />
                  {showError("message") && (
                    <small className="mt-field__error">{errors.message}</small>
                  )}
                </label>

                <button type="submit" className="mt-btn mt-btn--primary mt-btn--block" disabled={loading}>
                  {loading ? "Sending..." : "Send message"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default Contact;
