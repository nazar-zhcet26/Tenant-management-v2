// src/components/useHelpdeskRealtimeToasts.js
import { useEffect, useRef } from "react";
import { useToast } from "./ToastProvider";
import { supabase } from "../supabase";

/**
 * Realtime → Toast bridge for Helpdesk.
 * - Listens to 4 tables and shows coalesced toasts with a "Refresh" action.
 * - If helpdeskId is provided, applies server-side filters (ignored if column not present).
 */
export function useHelpdeskRealtimeToasts(helpdeskId) {
  const { toast } = useToast();
  const bufferRef = useRef({ count: 0, timer: null });

  const showToast = (label) => {
    const buf = bufferRef.current;

    // If we’re in a 2s coalescing window, just increment
    if (buf.timer) {
      buf.count += 1;
      return;
    }

    // Start window and show the first toast immediately
    buf.count = 1;
    buf.timer = window.setTimeout(() => {
      if (buf.count > 1) {
        toast({
          title: "New activity",
          description: `${buf.count} updates just came in — click Refresh to view.`,
          actionLabel: "Refresh",
          onAction: () => window.dispatchEvent(new Event("pc-refresh")),
        });
      }
      buf.count = 0;
      clearTimeout(buf.timer);
      buf.timer = null;
    }, 2000);

    // First toast
    toast({
      title: "New activity",
      description: `${label} — click Refresh to view.`,
      actionLabel: "Refresh",
      onAction: () => window.dispatchEvent(new Event("pc-refresh")),
    });
  };

  useEffect(() => {
    // Helper to build a channel with optional server-side filter
    const subscribe = (key, table, handler, filterColumn) => {
      const opts = {
        event: "*",
        schema: "public",
        table,
      };
      // Only attach filter if we have an id AND a column name to filter by
      if (helpdeskId && filterColumn) {
        // If the column doesn't exist in the table, Supabase will ignore this filter silently.
        opts.filter = `${filterColumn}=eq.${helpdeskId}`;
      }

      return supabase
        .channel(key)
        .on("postgres_changes", opts, handler)
        .subscribe();
    };

    // 1) helpdesk_assignments — status/assignment changes
    const ch1 = subscribe(
      "helpdesk-assignments",
      "helpdesk_assignments",
      (p) => {
        const a = (p.new ?? p.old) || {};
        const id = a.id ? `Ticket #${a.id}` : "A ticket";
        const change =
          p.eventType === "UPDATE" ? "updated" :
          p.eventType === "INSERT" ? "created" :
          "changed";
        showToast(`${id} ${change}`);
      },
      // change this to your scoping column if present:
      "helpdesk_user_id"
    );

    // 2) contractor_final_reports — contractor submitted/updated final report
    const ch2 = subscribe(
      "helpdesk-finalreports",
      "contractor_final_reports",
      (p) => {
        const fr = (p.new ?? p.old) || {};
        const id = fr.id ? `Final report ${fr.id}` : "A final report";
        showToast(`${id} updated by contractor`);
      },
      // if your final reports table also carries helpdesk_user_id or joins, set column name here:
      "helpdesk_user_id"
    );

    // 3) contractor_responses — accept/reject notifications
    const ch3 = subscribe(
      "helpdesk-contractor-responses",
      "contractor_responses",
      (p) => {
        const r = (p.new ?? p.old) || {};
        const label =
          r.status === "accepted"
            ? `Contractor accepted Ticket #${r.assignment_id}`
            : r.status === "rejected"
            ? `Contractor rejected Ticket #${r.assignment_id}${r.reason ? ` — ${r.reason}` : ""}`
            : `Contractor response on Ticket #${r.assignment_id ?? ""}`;
        showToast(label);
      },
      // if contractor_responses has a helpdesk_user_id or equivalent:
      "helpdesk_user_id"
    );

    // 4) maintenance_reports — landlord approvals
    const ch4 = subscribe(
      "helpdesk-landlord-approvals",
      "maintenance_reports",
      (p) => {
        const mr = (p.new ?? p.old) || {};
        if ((p.eventType === "UPDATE" || p.eventType === "INSERT") && mr.status === "approved") {
          showToast(`Landlord approved report #${mr.id} — ready to triage`);
        }
      },
      // if maintenance_reports has a helpdesk_user_id routing column:
      "helpdesk_user_id"
    );

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
      supabase.removeChannel(ch4);
    };
  }, [helpdeskId, toast]);
}
