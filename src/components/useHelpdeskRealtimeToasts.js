// src/components/useHelpdeskRealtimeToasts.js
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useRef } from "react";
import { useToast } from "./ToastProvider";
import { supabase } from "../supabase"; // your file from the screenshot

export function useHelpdeskRealtimeToasts(helpdeskId) {
  const { toast } = useToast();
  const bufferRef = useRef({ count: 0, timer: null });

  const showToast = (label) => {
    const buf = bufferRef.current;
    if (buf.timer) {
      buf.count += 1;
      return;
    }
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

    toast({
      title: "New activity",
      description: `${label} — click Refresh to view.`,
      actionLabel: "Refresh",
      onAction: () => window.dispatchEvent(new Event("pc-refresh")),
    });
  };

  useEffect(() => {
    const mk = (key, table, handler) =>
      supabase
        .channel(key)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            // If you have scoping columns later, uncomment one:
            // filter: `helpdesk_user_id=eq.${helpdeskId}`,
            // filter: `helpdesk_team_id=eq.${teamId}`,
          },
          handler
        )
        .subscribe();

    // 1) helpdesk_assignments
    const ch1 = mk("helpdesk-assignments", "helpdesk_assignments", (p) => {
      const a = (p.new ?? p.old) || {};
      const id = a.id ? `Ticket #${a.id}` : "A ticket";
      const change = p.eventType === "UPDATE" ? "updated" : p.eventType === "INSERT" ? "created" : "changed";
      showToast(`${id} ${change}`);
    });

    // 2) contractor_final_reports
    const ch2 = mk("helpdesk-finalreports", "contractor_final_reports", (p) => {
      const fr = (p.new ?? p.old) || {};
      const id = fr.id ? `Final report ${fr.id}` : "A final report";
      showToast(`${id} updated by contractor`);
    });

    // 3) contractor_responses (accepted/rejected)
    const ch3 = mk("helpdesk-contractor-responses", "contractor_responses", (p) => {
      const r = (p.new ?? p.old) || {};
      const label =
        r.status === "accepted"
          ? `Contractor accepted Ticket #${r.assignment_id}`
          : r.status === "rejected"
          ? `Contractor rejected Ticket #${r.assignment_id}${r.reason ? ` — ${r.reason}` : ""}`
          : `Contractor response on Ticket #${r.assignment_id ?? ""}`;
      showToast(label);
    });

    // 4) maintenance_reports (landlord approvals)
    const ch4 = mk("helpdesk-landlord-approvals", "maintenance_reports", (p) => {
      const mr = (p.new ?? p.old) || {};
      if ((p.eventType === "UPDATE" || p.eventType === "INSERT") && mr.status === "approved") {
        showToast(`Landlord approved report #${mr.id} — ready to triage`);
      }
    });

    return () => {
      supabase.removeChannel(ch1);
      supabase.removeChannel(ch2);
      supabase.removeChannel(ch3);
      supabase.removeChannel(ch4);
    };
  }, [helpdeskId]); // eslint-disable-line react-hooks/exhaustive-deps
}
