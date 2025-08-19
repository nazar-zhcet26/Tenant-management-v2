// src/components/useHelpdeskRealtimeToasts.js
import { useEffect, useRef } from "react";
import { useToast } from "./ToastProvider";
import { supabase } from "../supabase";

/**
 * Realtime → Toast bridge for Helpdesk.
 * - Listens to 4 tables and shows coalesced toasts with a "Refresh" action.
 * - Colors match Helpdesk STATUS: pending=amber, assigned=blue, accepted=green, review=violet, completed=teal, rejected=red.
 * - Enriches description with Property + Contractor names when possible.
 */
export function useHelpdeskRealtimeToasts(helpdeskId) {
  const { toast } = useToast();
  const bufferRef = useRef({ count: 0, timer: null });

  const statusToColor = (status) => {
    switch ((status || "").toLowerCase()) {
      case "pending":   return "amber";
      case "assigned":  return "blue";
      case "accepted":  return "green";
      case "review":    return "violet";
      case "completed": return "teal";
      case "rejected":  return "red";
      default:          return "gray";
    }
  };

  const showToast = ({ title, description, color }) => {
    const buf = bufferRef.current;

    if (buf.timer) { buf.count += 1; return; }

    buf.count = 1;
    buf.timer = window.setTimeout(() => {
      if (buf.count > 1) {
        toast({
          title: "New activity",
          description: `${buf.count} updates just came in — click Refresh to view.`,
          color: "gray",
          actionLabel: "Refresh",
          onAction: () => window.dispatchEvent(new Event("pc-refresh")),
        });
      }
      buf.count = 0;
      clearTimeout(buf.timer);
      buf.timer = null;
    }, 2000);

    toast({
      title,
      description: `${description} — click Refresh to view.`,
      color,
      actionLabel: "Refresh",
      onAction: () => window.dispatchEvent(new Event("pc-refresh")),
    });
  };

  // Small helper to fetch names for richer toast text
  const getNamesForAssignment = async (assignmentId) => {
    try {
      const { data, error } = await supabase
        .from("helpdesk_assignments")
        .select(`
          id,
          contractor:contractor_id ( full_name ),
          maintenance_reports:report_id (
            id,
            property:property_id ( name )
          )
        `)
        .eq("id", assignmentId)
        .maybeSingle();
      if (error || !data) return { contractorName: null, propertyName: null };
      const contractorName = data.contractor?.full_name || null;
      const propertyName = data.maintenance_reports?.property?.name || null;
      return { contractorName, propertyName };
    } catch (_e) {
      return { contractorName: null, propertyName: null };
    }
  };

  useEffect(() => {
    const subscribe = (key, table, handler, filterColumn) => {
      const opts = { event: "*", schema: "public", table };
      if (helpdeskId && filterColumn) {
        opts.filter = `${filterColumn}=eq.${helpdeskId}`;
      }
      return supabase.channel(key).on("postgres_changes", opts, handler).subscribe();
    };

    // 1) helpdesk_assignments — status/assignment changes (assigned/pending/accepted/review/completed/rejected)
    const ch1 = subscribe(
      "helpdesk-assignments",
      "helpdesk_assignments",
      async (p) => {
        const a = (p.new ?? p.old) || {};
        const ticket = a.id || "—";
        const status = a.status || "changed";
        const { contractorName, propertyName } = await getNamesForAssignment(ticket);
        const labelParts = [];
        labelParts.push(propertyName ? propertyName : "Property");
        if (contractorName) labelParts.push(`with ${contractorName}`);
        const desc = `${status} — ${labelParts.join(" ")}`;
        showToast({
          title: `Ticket #${String(ticket).slice(0, 8)}`,
          description: desc,
          color: statusToColor(status),
        });
      },
      "helpdesk_user_id"
    );

    // 2) contractor_final_reports — submitted/updated (goes into review → violet)
    const ch2 = subscribe(
      "helpdesk-finalreports",
      "contractor_final_reports",
      async (p) => {
        const fr = (p.new ?? p.old) || {};
        const ticket = fr.assignment_id || "—";
        const { contractorName, propertyName } = await getNamesForAssignment(ticket);
        const desc = `final report submitted ${contractorName ? `by ${contractorName}` : ""} — ${propertyName || "Property"}`;
        showToast({
          title: `Ticket #${String(ticket).slice(0, 8)}`,
          description: desc,
          color: "violet",
        });
      },
      "helpdesk_user_id"
    );

    // 3) contractor_responses — accept/reject (green/red)
    const ch3 = subscribe(
      "helpdesk-contractor-responses",
      "contractor_responses",
      async (p) => {
        const r = (p.new ?? p.old) || {};
        const ticket = r.assignment_id || "—";
        const status = r.status || "response";
        const { contractorName, propertyName } = await getNamesForAssignment(ticket);
        const reason = r.reason ? ` — ${r.reason}` : "";
        const desc = `${status}${contractorName ? ` by ${contractorName}` : ""}${reason} — ${propertyName || "Property"}`;
        showToast({
          title: `Ticket #${String(ticket).slice(0, 8)}`,
          description: desc,
          color: status === "accepted" ? "green" : status === "rejected" ? "red" : "gray",
        });
      },
      "helpdesk_user_id"
    );

    // 4) maintenance_reports — landlord approvals → pending (amber)
    const ch4 = subscribe(
      "helpdesk-landlord-approvals",
      "maintenance_reports",
      async (p) => {
        const mr = (p.new ?? p.old) || {};
        // Only signal when status is now approved → Helpdesk sees this as pending intake
        if ((p.eventType === "UPDATE" || p.eventType === "INSERT") && mr.status === "approved") {
          const ticket = mr.id || "—";
          // We might not yet have an assignment row, so property name from maintenance_reports would be ideal.
          // If not directly available, fall back to a generic message.
          const propertyName = mr.property_name || null; // use if your view/table provides it
          showToast({
            title: `Ticket #${String(ticket).slice(0, 8)}`,
            description: `approved by landlord — ${propertyName || "Pending intake"}`,
            color: "amber",
          });
        }
      },
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
