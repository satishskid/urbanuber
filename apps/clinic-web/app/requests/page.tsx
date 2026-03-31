"use client";

import { useEffect, useState } from "react";
import {
  getServiceRequests,
  pollData,
  PollSubscription,
} from "@skids/api-client";

interface ServiceRequest {
  id: string;
  patient_id?: string;
  service_type?: string;
  status: string;
  provider_id?: string;
  created_at?: string;
  [key: string]: unknown;
}

export default function RequestsPage() {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [filter, setFilter] = useState("All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sub = pollData(
      () => getServiceRequests(),
      (list) => {
        setRequests(list as unknown as ServiceRequest[]);
        setLoading(false);
      },
      5000,
    );
    return () => sub.stop();
  }, []);

  const filtered =
    filter === "All"
      ? requests
      : requests.filter(
          (r) => r.status?.toLowerCase() === filter.toLowerCase(),
        );

  const statusColor = (status: string) => {
    const s = status?.toUpperCase();
    if (s === "PENDING" || s === "pending") return "badge-pending";
    if (s === "ACCEPTED" || s === "accepted") return "badge-accepted";
    return "badge-completed";
  };

  const dotColor = (status: string) => {
    const s = status?.toUpperCase();
    if (s === "PENDING") return "bg-amber-400 animate-pulse";
    if (s === "ACCEPTED") return "bg-blue-400";
    return "bg-green-400";
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">
            Service Requests
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {loading ? "Loading..." : `${requests.length} total requests`}
            <span className="text-green-400 ml-2">● Live</span>
          </p>
        </div>
        <div className="flex gap-2">
          {["All", "PENDING", "ACCEPTED", "COMPLETED"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filter === f
                  ? "bg-white/10 text-white"
                  : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-sm text-gray-600">
            {loading ? "Connecting..." : "No service requests found."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => (
            <div
              key={req.id}
              className="glass-card p-5 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${dotColor(req.status)}`}
                />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-white">
                      {req.patient_id || "Unknown Patient"}
                    </span>
                    <span className="text-[10px] font-mono text-gray-600">
                      {req.id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{req.service_type || "—"}</span>
                    <span>•</span>
                    <span>{req.provider_id || "Unassigned"}</span>
                    {req.created_at && (
                      <>
                        <span>•</span>
                        <span>{timeAgo(new Date(req.created_at))}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor(req.status)}`}
                >
                  {req.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
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
