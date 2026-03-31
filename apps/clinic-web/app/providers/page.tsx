"use client";

import { useEffect, useState } from "react";
import { getProviders, pollData, PollSubscription } from "@skids/api-client";

interface Provider {
  id: string;
  name: string;
  role: string;
  is_online: number;
  service_tags?: string;
  geohash?: string;
  [key: string]: unknown;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const subRef = useState<PollSubscription<any> | null>(null);

  useEffect(() => {
    const sub = pollData(
      () => getProviders(),
      (list) => {
        setProviders(list as unknown as Provider[]);
        setLoading(false);
      },
      5000,
    );
    return () => sub.stop();
  }, []);

  const onlineCount = providers.filter((p) => p.is_online === 1).length;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tight">
            Providers
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {loading
              ? "Loading..."
              : `${onlineCount} online / ${providers.length} total`}
            <span className="text-green-400 ml-2">● Live</span>
          </p>
        </div>
      </div>

      {providers.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-sm text-gray-600">
            {loading ? "Connecting..." : "No providers registered yet."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className="glass-card p-5 hover:border-blue-500/20 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600/30 to-purple-600/30 flex items-center justify-center text-lg font-bold text-blue-400">
                    {(provider.name || provider.id).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      {provider.name || provider.id}
                    </p>
                    <p className="text-[10px] text-gray-500 font-mono">
                      {provider.role}
                    </p>
                  </div>
                </div>
                <span
                  className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    provider.is_online === 1 ? "badge-online" : "badge-offline"
                  }`}
                >
                  {provider.is_online === 1 ? "online" : "offline"}
                </span>
              </div>

              {provider.service_tags && provider.service_tags !== "[]" && (
                <div className="flex flex-wrap gap-1.5 pt-3 border-t border-white/5">
                  {JSON.parse(provider.service_tags || "[]").map(
                    (tag: string) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded-md text-[10px] bg-white/5 text-gray-400"
                      >
                        {tag}
                      </span>
                    ),
                  )}
                </div>
              )}

              {provider.geohash && (
                <p className="text-[10px] text-gray-600 mt-3 font-mono">
                  📍 {provider.geohash}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
