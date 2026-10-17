import { useEffect, useMemo, useState } from "react";
import ReplyIcon from "@mui/icons-material/Reply";
import CheckIcon from "@mui/icons-material/Check";
import MarkEmailUnreadOutlinedIcon from "@mui/icons-material/MarkEmailUnreadOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import api from "../api";
import { useAdmin } from "../Components/admin/AdminLayout";
import { PageHeader, SearchBox, FilterTabs, apiError, messageStatus, messageBadge } from "../Components/admin/AdminUI";
import { formatOrderDate } from "../utils/shop";

const TABS = [
  { value: "all", label: "All" },
  { value: "new", label: "New" },
  { value: "read", label: "Read" },
  { value: "done", label: "Done" },
];

function AdminContacts() {
  const { notify, confirm } = useAdmin();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);

  const fetchMessages = (showNotice) =>
    api
      .get("/contacts")
      .then((res) => {
        setMessages(Array.isArray(res.data) ? res.data : []);
        setError("");
        if (showNotice) notify("Inbox refreshed");
      })
      .catch((err) => {
        console.error(err);
        setError("We couldn't load messages. Please refresh the page.");
      })
      .finally(() => setLoading(false));

  useEffect(() => {
    fetchMessages(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const counts = useMemo(() => {
    const c = { all: messages.length, new: 0, read: 0, done: 0 };
    messages.forEach((m) => (c[messageStatus(m.status).key] += 1));
    return c;
  }, [messages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return messages.filter((m) => {
      if (tab !== "all" && messageStatus(m.status).key !== tab) return false;
      if (!q) return true;
      return `${m.full_name} ${m.email} ${m.message}`.toLowerCase().includes(q);
    });
  }, [messages, tab, search]);

  const setStatus = async (m, status, { quiet = false } = {}) => {
    try {
      await api.put(`/contacts/${m.id}/status`, { status });
      setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, status } : x)));
      if (!quiet) notify(`Message from ${m.full_name} marked as ${status}`);
    } catch (err) {
      console.error(err);
      notify(apiError(err, "We couldn't update this message."), "error");
    }
  };

  const toggleOpen = (m) => {
    const opening = openId !== m.id;
    setOpenId(opening ? m.id : null);
    // Opening a new message marks it as read, like an email inbox
    if (opening && messageStatus(m.status).key === "new") setStatus(m, "read", { quiet: true });
  };

  const handleDelete = async (m) => {
    const ok = await confirm({
      title: "Delete message?",
      message: `The message from ${m.full_name} will be removed permanently.`,
      confirmLabel: "Delete message",
      danger: true,
    });
    if (!ok) return;

    try {
      await api.delete(`/contacts/${m.id}`);
      setMessages((list) => list.filter((x) => x.id !== m.id));
      notify("Message deleted");
    } catch (err) {
      console.error(err);
      notify(apiError(err, "We couldn't delete this message."), "error");
    }
  };

  const replyLink = (m) =>
    `mailto:${m.email}?subject=${encodeURIComponent("Re: Your message to MegaTech")}&body=${encodeURIComponent(
      `Hi ${m.full_name},\n\n\n\n---\nYou wrote:\n${m.message}`
    )}`;

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle={loading ? "Loading messages…" : `${counts.all} messages · ${counts.new} unread`}
        actions={
          <button type="button" className="mt-btn mt-btn--secondary" onClick={() => fetchMessages(true)}>
            <RefreshIcon /> Refresh
          </button>
        }
      />

      {error && <div className="mt-alert mt-alert--error">{error}</div>}

      <section className="mt-panel">
        <FilterTabs
          label="Message status"
          value={tab}
          onChange={setTab}
          tabs={TABS.map((t) => ({ ...t, count: counts[t.value] }))}
        />
        <div className="ad-toolbar">
          <SearchBox value={search} onChange={setSearch} placeholder="Search by name, email or message" />
        </div>

        {loading ? (
          <div className="ad-panel-body" style={{ display: "grid", gap: 10 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="mt-skeleton" style={{ height: 64, borderRadius: 10 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-empty">
            <div className="mt-empty__icon">
              <MailOutlineIcon fontSize="inherit" />
            </div>
            <h3>{messages.length === 0 ? "No messages yet" : "Nothing here"}</h3>
            <p>
              {messages.length === 0
                ? "Messages from the Contact page will show up here."
                : "No messages match this filter."}
            </p>
          </div>
        ) : (
          <ul className="ad-inbox">
            {filtered.map((m) => {
              const st = messageStatus(m.status);
              const open = openId === m.id;
              const { date, time } = formatOrderDate(m.created_at);

              return (
                <li key={m.id} className={`ad-msg ${st.key === "new" ? "is-new" : ""} ${open ? "is-open" : ""}`}>
                  <button type="button" className="ad-msg__row" onClick={() => toggleOpen(m)} aria-expanded={open}>
                    <span className="ad-msg__dot" aria-hidden="true" />
                    <div style={{ minWidth: 0 }}>
                      <div className="ad-msg__who">
                        <strong>{m.full_name}</strong>
                        <span>{m.email}</span>
                      </div>
                      {!open && <p className="ad-msg__preview">{m.message}</p>}
                    </div>
                    <div className="ad-msg__side">
                      <span className={`mt-badge mt-badge--${messageBadge[st.key] || "neutral"}`}>{st.label}</span>
                      {date}
                    </div>
                  </button>

                  {open && (
                    <div className="ad-msg__body">
                      <p className="ad-msg__text">{m.message}</p>
                      <div className="ad-msg__actions">
                        <a className="mt-btn mt-btn--primary mt-btn--sm" href={replyLink(m)}>
                          <ReplyIcon /> Reply by email
                        </a>
                        {st.key !== "done" ? (
                          <button type="button" className="mt-btn mt-btn--secondary mt-btn--sm" onClick={() => setStatus(m, "done")}>
                            <CheckIcon /> Mark as done
                          </button>
                        ) : (
                          <button type="button" className="mt-btn mt-btn--secondary mt-btn--sm" onClick={() => setStatus(m, "new")}>
                            <MarkEmailUnreadOutlinedIcon /> Mark as new
                          </button>
                        )}
                        <button type="button" className="mt-btn mt-btn--ghost mt-btn--sm" onClick={() => handleDelete(m)}>
                          <DeleteOutlineIcon /> Delete
                        </button>
                        <span className="ad-hint" style={{ marginLeft: "auto", alignSelf: "center" }}>
                          Received {date}
                          {time && ` at ${time}`}
                        </span>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

export default AdminContacts;
