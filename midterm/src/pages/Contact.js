import { useState } from "react";
import AA from "../Assets/corsair-pc-accessories.webp";
import "../Styles/Contact.css";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Contact() {
  const [form, setForm] = useState({ fname: "", email: "", message: "" });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState({ loading: false, success: "", fail: "" });

  const validate = (data) => {
    const e = {};

    const name = data.fname.trim();
    const email = data.email.trim();
    const msg = data.message.trim();

    if (name.length < 3) e.fname = "Name must be at least 3 characters.";
    if (!emailRegex.test(email)) e.email = "Please enter a valid email.";
    if (msg.length < 10) e.message = "Message must be at least 10 characters.";

    return e;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm((prev) => {
      const nextForm = { ...prev, [name]: value };

      // live validation
      const tempErrors = validate(nextForm);
      setErrors((prevErr) => ({ ...prevErr, [name]: tempErrors[name] }));

      return nextForm;
    });

    setStatus({ loading: false, success: "", fail: "" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    //  validate before sending
    const v = validate(form);
    setErrors(v);

    if (Object.keys(v).length > 0) {
      setStatus({ loading: false, success: "", fail: "Please fix the errors above." });
      return;
    }

    try {
      setStatus({ loading: true, success: "", fail: "" });

      const res = await fetch("http://localhost:5000/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form), 
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus({ loading: false, success: "", fail: data.message || "Failed to send" });
        return;
      }

      setStatus({ loading: false, success: "Message sent successfully ✅", fail: "" });
      setForm({ fname: "", email: "", message: "" });
      setErrors({});
    } catch (err) {
      setStatus({ loading: false, success: "", fail: "Server error, try again." });
    }
  };

  return (
    <div className="contact" style={{ backgroundImage: `url(${AA})` }}>
      <div className="contact-overlay">
        <div className="contact-card">
          <h1>Contact Us</h1>

          {status.success && (
            <div style={{ background: "#eaffea", padding: 10, borderRadius: 8, marginBottom: 12 }}>
              {status.success}
            </div>
          )}

          {status.fail && (
            <div style={{ background: "#ffecec", padding: 10, borderRadius: 8, marginBottom: 12 }}>
              {status.fail}
            </div>
          )}

          <form id="contact-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="fname">Full Name</label>
            <input
              id="fname"
              name="fname"
              placeholder="Enter full name..."
              type="text"
              value={form.fname}
              onChange={handleChange}
              required
            />
            {errors.fname && <p style={{ color: "red", marginTop: 6 }}>{errors.fname}</p>}

            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              placeholder="Enter email..."
              type="email"
              value={form.email}
              onChange={handleChange}
              required
            />
            {errors.email && <p style={{ color: "red", marginTop: 6 }}>{errors.email}</p>}

            <label htmlFor="message">Message</label>
            <textarea
              id="message"
              name="message"
              placeholder="Enter message..."
              value={form.message}
              onChange={handleChange}
              required
              rows={5}
            />
            {errors.message && <p style={{ color: "red", marginTop: 6 }}>{errors.message}</p>}

            <button type="submit" disabled={status.loading} style={{ opacity: status.loading ? 0.7 : 1 }}>
              {status.loading ? "Sending..." : "Send Message"}
            </button>
          </form>

          <p style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
            We will reply within 24 hours.
          </p>
        </div>
      </div>
    </div>
  );
}

export default Contact;
