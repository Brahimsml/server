import React, { useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import CloseIcon from "@mui/icons-material/Close";
import SendIcon from "@mui/icons-material/Send";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import AddShoppingCartIcon from "@mui/icons-material/AddShoppingCartOutlined";
import CheckIcon from "@mui/icons-material/Check";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import DirectionsOutlinedIcon from "@mui/icons-material/DirectionsOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { CartContext } from "../Context/CartContext";
import { API_URL } from "../api";
import logo from "../Assets/logo.jpg";
import {
  formatMoney,
  formatOrderDate,
  imageUrl,
  isLowStock,
  onImageError,
  toCartProduct,
  FALLBACK_IMG,
} from "../utils/shop";
import "../Styles/ChatBot.css";

const STORAGE_KEY = "mt-chat";
const MIN_TYPING_MS = 550;

const WELCOME = {
  from: "bot",
  text: "Hi! I'm the MegaTech assistant. I can find products, put together a setup for your budget, compare items, track your orders and show our stores.",
  suggestions: ["Best sellers", "Graphics cards under $1000", "Build a gaming setup for $2000", "Track my order", "Store locations"],
};

const loadChat = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.messages) && saved.messages.length) return saved;
  } catch {}
  return { messages: [WELCOME], context: null };
};

const isPhone = () => window.matchMedia("(max-width: 640px)").matches;

const ChatBot = () => {
  const { addToCart } = useContext(CartContext);
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [{ messages, context }, setChat] = useState(loadChat);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState({}); // productId -> "added" | "failed"
  const [notice, setNotice] = useState(null);
  const [teaser, setTeaser] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const noticeTimer = useRef(null);

  // keep the conversation while the customer browses
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ messages: messages.slice(-40), context }));
    } catch {}
  }, [messages, context]);

  // small "Need help?" bubble once per visit
  useEffect(() => {
    if (sessionStorage.getItem("mt-chat-teased")) return;
    const t = setTimeout(() => {
      setTeaser(true);
      try {
        sessionStorage.setItem("mt-chat-teased", "1");
      } catch {}
    }, 8000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    setTeaser(false);
    setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // always show the newest message
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, loading, open]);

  useEffect(() => () => clearTimeout(noticeTimer.current), []);

  const send = async (raw) => {
    const text = String(raw || "").trim();
    if (!text || loading) return;

    setInput("");
    setChat((c) => ({ ...c, messages: [...c.messages, { from: "user", text }] }));
    setLoading(true);
    const started = Date.now();

    let answer;
    try {
      const token = sessionStorage.getItem("userToken");
      const res = await fetch(`${API_URL}/chatbot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text, context }),
      });
      answer = await res.json();
    } catch (err) {
      console.error("Chatbot error:", err);
      answer = { reply: "I can't connect right now. Please check your connection and try again." };
    }

    // a short pause so the reply doesn't feel robotic
    const wait = MIN_TYPING_MS - (Date.now() - started);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    setChat((c) => ({
      messages: [...c.messages, { from: "bot", text: answer.reply || "Sorry, I couldn't answer that.", ...pick(answer) }],
      context: answer.context || null,
    }));
    setLoading(false);
  };

  const pick = (a) => ({
    products: a.products,
    stores: a.stores,
    orders: a.orders,
    actions: a.actions,
    suggestions: a.suggestions,
  });

  const restart = () => {
    setChat({ messages: [WELCOME], context: null });
    setAdded({});
    setNotice(null);
  };

  const go = (to) => {
    navigate(to);
    if (isPhone()) setOpen(false);
  };

  const add = (product) => {
    const ok = addToCart(toCartProduct(product), { silent: true });
    setAdded((a) => ({ ...a, [product.id]: ok ? "added" : "failed" }));
    setNotice(
      ok
        ? { text: `${product.name} was added to your cart.`, ok: true }
        : { text: `You already have all available ${product.name} in your cart.`, ok: false }
    );
    clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 4000);
  };

  const lastBotIndex = messages.map((m) => m.from).lastIndexOf("bot");

  return (
    <>
      {!open && (
        <div className="cb-launch">
          {teaser && (
            <div className="cb-teaser" role="status">
              <button type="button" className="cb-teaser__text" onClick={() => setOpen(true)}>
                Need help choosing? Ask me anything.
              </button>
              <button type="button" className="cb-teaser__close" onClick={() => setTeaser(false)} aria-label="Dismiss">
                <CloseIcon fontSize="inherit" />
              </button>
            </div>
          )}
          <button type="button" className="chatbot-float" onClick={() => setOpen(true)} aria-label="Open chat assistant">
            <ChatBubbleOutlineIcon />
          </button>
        </div>
      )}

      {open && (
        <section className="chatbot-box" role="dialog" aria-label="MegaTech assistant">
          <header className="cb-head">
            <img src={logo} alt="" className="cb-avatar" />
            <div className="cb-head__title">
              <strong>MegaTech Assistant</strong>
              <span>
                <i className="cb-online" /> Online · replies instantly
              </span>
            </div>
            <button type="button" className="cb-icon" onClick={restart} aria-label="Start a new chat" title="New chat">
              <RestartAltIcon fontSize="small" />
            </button>
            <button type="button" className="cb-icon" onClick={() => setOpen(false)} aria-label="Close chat" title="Close">
              <CloseIcon fontSize="small" />
            </button>
          </header>

          <div className="cb-messages" ref={listRef} aria-live="polite">
            {messages.map((m, i) =>
              m.from === "user" ? (
                <div key={i} className="cb-row cb-row--user">
                  <div className="cb-bubble cb-bubble--user">{m.text}</div>
                </div>
              ) : (
                <div key={i} className="cb-row cb-row--bot">
                  <img src={logo} alt="" className="cb-avatar cb-avatar--small" />
                  <div className="cb-bot">
                    <div className="cb-bubble cb-bubble--bot">{m.text}</div>

                    {m.products?.length > 0 && (
                      <div className="cb-products">
                        {m.products.map((p) => {
                          const soldOut = Number(p.stock_quantity) <= 0;
                          const state = added[p.id];
                          return (
                            <article key={p.id} className="cb-product">
                              <div className="cb-product__img">
                                <img src={imageUrl(p.image) || FALLBACK_IMG} alt="" loading="lazy" onError={onImageError} />
                              </div>
                              <div className="cb-product__body">
                                <strong title={p.name}>{p.name}</strong>
                                <span className="cb-product__price">{formatMoney(p.price)}</span>
                                <span className={`cb-stock ${soldOut ? "is-out" : isLowStock(p.stock_quantity) ? "is-low" : ""}`}>
                                  {soldOut ? "Sold out" : isLowStock(p.stock_quantity) ? `Only ${p.stock_quantity} left` : "In stock"}
                                </span>
                                <div className="cb-product__actions">
                                  <button
                                    type="button"
                                    className={`cb-btn cb-btn--primary ${state === "added" ? "is-added" : ""}`}
                                    disabled={soldOut}
                                    onClick={() => add(p)}
                                    aria-label={`Add ${p.name} to cart`}
                                  >
                                    {state === "added" ? <CheckIcon fontSize="inherit" /> : <AddShoppingCartIcon fontSize="inherit" />}
                                    {soldOut ? "Sold out" : state === "added" ? "Added" : "Add"}
                                  </button>
                                  <button
                                    type="button"
                                    className="cb-btn"
                                    onClick={() => go(`/shop?category=${encodeURIComponent(p.category_name)}`)}
                                    aria-label={`See more ${p.category_name}`}
                                  >
                                    More
                                  </button>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    )}

                    {m.stores?.length > 0 && (
                      <div className="cb-cards">
                        {m.stores.map((s) => (
                          <article key={s.id} className="cb-card">
                            <strong>{s.name}</strong>
                            <span className="cb-card__line">
                              <PlaceOutlinedIcon fontSize="inherit" /> {s.address}
                            </span>
                            <div className="cb-card__actions">
                              {s.tel && (
                                <a className="cb-btn" href={`tel:${s.tel}`}>
                                  <PhoneOutlinedIcon fontSize="inherit" /> {s.tel}
                                </a>
                              )}
                              {s.lat && s.lng && (
                                <a
                                  className="cb-btn"
                                  href={`https://www.google.com/maps/dir/?api=1&destination=${s.lat},${s.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  <DirectionsOutlinedIcon fontSize="inherit" /> Directions
                                </a>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    )}

                    {m.orders?.length > 0 && (
                      <div className="cb-cards">
                        {m.orders.map((o) => (
                          <button key={o.id} type="button" className="cb-card cb-order" onClick={() => go(`/my-orders/${o.id}`)}>
                            <div>
                              <strong>Order #{o.id}</strong>
                              <span className="cb-card__line">
                                {formatOrderDate(o.created_at).date} · {formatMoney(o.total)}
                              </span>
                            </div>
                            <span className={`cb-status cb-status--${o.status}`}>{o.statusLabel}</span>
                            <ChevronRightIcon fontSize="small" />
                          </button>
                        ))}
                      </div>
                    )}

                    {m.actions?.length > 0 && (
                      <div className="cb-actions">
                        {m.actions.map((a) => (
                          <button key={a.to} type="button" className="cb-btn cb-btn--primary" onClick={() => go(a.to)}>
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}

                    {i === lastBotIndex && !loading && m.suggestions?.length > 0 && (
                      <div className="cb-chips">
                        {m.suggestions.map((s) => (
                          <button key={s} type="button" className="cb-chip" onClick={() => send(s)}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            )}

            {loading && (
              <div className="cb-row cb-row--bot">
                <img src={logo} alt="" className="cb-avatar cb-avatar--small" />
                <div className="cb-bubble cb-bubble--bot cb-typing" aria-label="Assistant is typing">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>

          {notice && (
            <div className={`cb-notice ${notice.ok ? "" : "is-warn"}`} role="status">
              <span>{notice.text}</span>
              {notice.ok && (
                <button type="button" onClick={() => go("/cart")}>
                  View cart
                </button>
              )}
            </div>
          )}

          <form
            className="cb-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about products, orders, stores…"
              maxLength={500}
              aria-label="Your message"
            />
            <button type="submit" disabled={!input.trim() || loading} aria-label="Send">
              <SendIcon fontSize="small" />
            </button>
          </form>
        </section>
      )}
    </>
  );
};

export default ChatBot;
