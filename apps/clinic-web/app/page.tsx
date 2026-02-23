"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "../lib/firebase";

interface Stat {
  label: string;
  value: string;
  icon: string;
  color: string;
}

interface ActivityItem {
  id: string;
  text: string;
  time: string;
  type: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stat[]>([
    { label: "Active Patients", value: "—", icon: "👶", color: "bg-blue-500/10 text-blue-400" },
    { label: "Online Providers", value: "—", icon: "🩺", color: "bg-green-500/10 text-green-400" },
    { label: "Pending Requests", value: "—", icon: "📋", color: "bg-amber-500/10 text-amber-400" },
    { label: "Ledger Events", value: "—", icon: "📝", color: "bg-purple-500/10 text-purple-400" },
  ]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    // Listen to patients count
    const unsubPatients = onSnapshot(collection(db, "patients"), (snap) => {
      setStats((prev) =>
        prev.map((s) =>
          s.label === "Active Patients" ? { ...s, value: String(snap.size) } : s
        )
      );
    });

    // Listen to online providers
    const unsubProviders = onSnapshot(collection(db, "providers"), (snap) => {
      const onlineCount = snap.docs.filter((d) => d.data().is_online === true).length;
      setStats((prev) =>
        prev.map((s) =>
          s.label === "Online Providers" ? { ...s, value: `${onlineCount}/${snap.size}` } : s
        )
      );
    });

    // Listen to pending service requests
    const unsubRequests = onSnapshot(collection(db, "service_requests"), (snap) => {
      const pending = snap.docs.filter((d) => d.data().status === "PENDING").length;
      setStats((prev) =>
        prev.map((s) =>
          s.label === "Pending Requests" ? { ...s, value: String(pending) } : s
        )
      );
    });

    // Listen to clinical ledger (latest events as activity feed)
    const ledgerQuery = query(
      collection(db, "clinical_ledger"),
      orderBy("timestamp", "desc"),
      limit(10)
    );
    const unsubLedger = onSnapshot(ledgerQuery, (snap) => {
      setStats((prev) =>
        prev.map((s) =>
          s.label === "Ledger Events" ? { ...s, value: String(snap.size) } : s
        )
      );
      const items: ActivityItem[] = snap.docs.map((doc) => {
        const d = doc.data();
        const eventType = d.event_type || "UNKNOWN";
        const providerId = d.provider_uid || "unknown";
        let text = `Event: ${eventType}`;
        if (eventType === "TRIAGE") text = `Triage submitted by Provider ${providerId}`;
        if (eventType === "RX_SIGNED") text = `Prescription signed by Provider ${providerId}`;
        if (eventType === "LAB_UPLOAD") text = `Lab result uploaded for request ${d.request_id || "?"}`;

        const ts = d.timestamp?.toDate?.();
        const time = ts ? timeAgo(ts) : "just now";

        return {
          id: doc.id,
          text,
          time,
          type: eventType === "RX_SIGNED" ? "completed" : eventType === "TRIAGE" ? "accepted" : "pending",
        };
      });
      setActivity(items);
    });

    return () => {
      unsubPatients();
      unsubProviders();
      unsubRequests();
      unsubLedger();
    };
  }, []);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-3xl font-black text-white tracking-tight">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">Real-time overview of Skids healthcare operations</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <div key={stat.label} className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <span className={`text-2xl w-10 h-10 flex items-center justify-center rounded-xl ${stat.color}`}>
                {stat.icon}
              </span>
            </div>
            <p className="text-2xl font-black text-white">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Activity Feed + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">
            Live Activity {activity.length > 0 && <span className="text-green-400 ml-2">● Live</span>}
          </h3>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-600 py-8 text-center">
              No clinical ledger events yet. Events will appear here in real-time as providers submit consults.
            </p>
          ) : (
            <div className="space-y-3">
              {activity.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.02] transition-colors">
                  <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${item.type === "completed" ? "bg-green-400" :
                      item.type === "accepted" ? "bg-blue-400" : "bg-amber-400"
                    }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-300 leading-relaxed">{item.text}</p>
                    <p className="text-[10px] text-gray-600 mt-1 font-mono">{item.time}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full text-left p-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition-colors border border-blue-500/10">
              <p className="text-sm font-bold text-blue-400">📞 Override Dispatch</p>
              <p className="text-xs text-gray-500 mt-1">Manually assign a provider</p>
            </button>
            <button className="w-full text-left p-4 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 transition-colors border border-purple-500/10">
              <p className="text-sm font-bold text-purple-400">📊 Export Reports</p>
              <p className="text-xs text-gray-500 mt-1">Download CSV of transactions</p>
            </button>
            <button className="w-full text-left p-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 transition-colors border border-amber-500/10">
              <p className="text-sm font-bold text-amber-400">⚙️ System Health</p>
              <p className="text-xs text-gray-500 mt-1">Check API and services status</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
