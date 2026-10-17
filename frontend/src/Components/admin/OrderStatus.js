import React from "react";
import api from "../../api";
import { useAdmin } from "./AdminLayout";
import { apiError } from "./AdminUI";
import { orderStatus, ORDER_STATUS_OPTIONS } from "../../utils/shop";

/*
  Change an order's status from the admin.
  Returns true when the change was saved.
  Cancelling asks first: stock goes back and it can't be reopened (the server enforces that too).
*/
export const useChangeOrderStatus = () => {
  const { notify, confirm } = useAdmin();

  return async (order, next) => {
    const current = orderStatus(order.status).key;
    if (next === current) return false;

    if (next === "cancelled") {
      const ok = await confirm({
        title: `Cancel order #${order.id}?`,
        message:
          "The items go back into stock and the customer gets an email. A cancelled order can't be reopened.",
        confirmLabel: "Cancel order",
        cancelLabel: "Keep order",
        danger: true,
      });
      if (!ok) return false;
    }

    try {
      await api.put(`/orders/${order.id}/status`, { status: next });
      notify(`Order #${order.id} is now ${orderStatus(next).label.toLowerCase()}. The customer was emailed.`);
      return true;
    } catch (err) {
      console.error(err);
      notify(apiError(err, "We couldn't update the order status."), "error");
      return false;
    }
  };
};

// Status dropdown that looks like a colored badge
export const OrderStatusSelect = ({ order, onChange }) => {
  const status = orderStatus(order.status);
  const cancelled = status.key === "cancelled";

  return (
    <select
      className={`ad-status-select mt-badge--${status.key}`}
      value={status.key}
      disabled={cancelled}
      title={cancelled ? "Cancelled orders can't be reopened" : "Change status"}
      aria-label={`Status of order #${order.id}`}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
    >
      {ORDER_STATUS_OPTIONS.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
};
