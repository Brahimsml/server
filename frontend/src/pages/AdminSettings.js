import { useState } from "react";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import api from "../api";
import { useAdmin } from "../Components/admin/AdminLayout";
import { PageHeader, apiError } from "../Components/admin/AdminUI";

const EMPTY = { current: "", next: "", confirm: "" };

function AdminSettings() {
  const { notify } = useAdmin();
  const [values, setValues] = useState(EMPTY);
  const [show, setShow] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const admin = JSON.parse(localStorage.getItem("admin") || "null");

  const set = (name) => (e) => {
    setValues((v) => ({ ...v, [name]: e.target.value }));
    setErrors((er) => ({ ...er, [name]: undefined }));
    setFormError("");
  };

  const validate = () => {
    const e = {};
    if (!values.current) e.current = "Enter your current password.";
    if (values.next.length < 8) e.next = "Use at least 8 characters.";
    else if (values.next === values.current) e.next = "Choose a password different from the current one.";
    if (values.confirm !== values.next) e.confirm = "The passwords don't match.";
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    try {
      setSaving(true);
      await api.put("/admin/password", { currentPassword: values.current, newPassword: values.next });
      setValues(EMPTY);
      notify("Your password was changed");
    } catch (err) {
      console.error(err);
      setFormError(apiError(err, "We couldn't change your password. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const fieldClass = (name) => `mt-field ${errors[name] ? "mt-field--invalid" : ""}`;
  const type = show ? "text" : "password";

  // Simple strength hint for the new password
  const strength = (() => {
    const p = values.next;
    if (!p) return null;
    let score = 0;
    if (p.length >= 8) score++;
    if (p.length >= 12) score++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score++;
    if (/\d/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (p.length < 8) return { label: "Too short", cls: "ad-hint--warn" };
    return score >= 4 ? { label: "Strong", cls: "" } : score >= 3 ? { label: "Good", cls: "" } : { label: "Weak: add numbers, symbols or more characters", cls: "ad-hint--warn" };
  })();

  return (
    <>
      <PageHeader title="Settings" subtitle="Your admin account." />

      <div className="ad-form" style={{ gridTemplateColumns: "minmax(0, 640px)" }}>
        <section className="mt-panel">
          <div className="ad-panel-head">
            <div>
              <h2>Account</h2>
              <p>You are signed in as</p>
            </div>
          </div>
          <div className="ad-panel-body">
            <strong>{admin?.email || "Administrator"}</strong>
          </div>
        </section>

        <section className="mt-panel">
          <div className="ad-panel-head">
            <div>
              <h2>Change password</h2>
              <p>Use at least 8 characters. A mix of letters, numbers and symbols is best.</p>
            </div>
            <button
              type="button"
              className="ad-icon-btn"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide passwords" : "Show passwords"}
              title={show ? "Hide passwords" : "Show passwords"}
            >
              {show ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
            </button>
          </div>

          <form className="ad-panel-body" onSubmit={handleSubmit} noValidate>
            {formError && (
              <div className="mt-alert mt-alert--error" role="alert">
                {formError}
              </div>
            )}

            <label className={fieldClass("current")}>
              <span>Current password</span>
              <input type={type} autoComplete="current-password" value={values.current} onChange={set("current")} />
              {errors.current && <small className="mt-field__error">{errors.current}</small>}
            </label>

            <label className={fieldClass("next")}>
              <span>New password</span>
              <input type={type} autoComplete="new-password" value={values.next} onChange={set("next")} />
              {errors.next ? (
                <small className="mt-field__error">{errors.next}</small>
              ) : (
                strength && <small className={`ad-hint ${strength.cls}`}>Strength: {strength.label}</small>
              )}
            </label>

            <label className={fieldClass("confirm")}>
              <span>Confirm new password</span>
              <input type={type} autoComplete="new-password" value={values.confirm} onChange={set("confirm")} />
              {errors.confirm && <small className="mt-field__error">{errors.confirm}</small>}
            </label>

            <button type="submit" className="mt-btn mt-btn--primary" disabled={saving}>
              {saving ? "Saving…" : "Change password"}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}

export default AdminSettings;
