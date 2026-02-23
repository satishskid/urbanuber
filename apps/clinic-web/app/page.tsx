export default function DashboardPage() {
  // Mock data — in production these would come from Firestore real-time listeners
  const stats = [
    { label: "Active Patients", value: "1,247", change: "+12%", icon: "👶", color: "bg-blue-500/10 text-blue-400" },
    { label: "Online Providers", value: "23", change: "+3", icon: "🩺", color: "bg-green-500/10 text-green-400" },
    { label: "Pending Requests", value: "8", change: "-2", icon: "📋", color: "bg-amber-500/10 text-amber-400" },
    { label: "Revenue (Today)", value: "₹45,200", change: "+18%", icon: "💰", color: "bg-purple-500/10 text-purple-400" },
  ];

  const recentActivity = [
    { time: "2 min ago", text: "Dr. Smith completed consultation for Patient #1247", type: "completed" },
    { time: "5 min ago", text: "Lab dispatch accepted by Phlebotomist Raj (CBC for Patient #1201)", type: "accepted" },
    { time: "8 min ago", text: "New telehealth request from Patient #1250 — Pediatric consult", type: "pending" },
    { time: "12 min ago", text: "Payment ₹500 split: ₹450 → Dr. Mehra, ₹50 → Platform", type: "completed" },
    { time: "15 min ago", text: "PDF Lab Report uploaded for Patient #1198 (CBC)", type: "completed" },
    { time: "20 min ago", text: "Prescription signed: Amoxicillin 250mg for Patient #1243", type: "accepted" },
  ];

  return (
    <div className="p-8">
      {/* Header */}
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
              <span className="text-xs font-mono text-green-400">{stat.change}</span>
            </div>
            <p className="text-2xl font-black text-white">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Live Activity</h3>
          <div className="space-y-3">
            {recentActivity.map((activity, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl hover:bg-white/[0.02] transition-colors">
                <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${activity.type === "completed" ? "bg-green-400" :
                    activity.type === "accepted" ? "bg-blue-400" : "bg-amber-400"
                  }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 leading-relaxed">{activity.text}</p>
                  <p className="text-[10px] text-gray-600 mt-1 font-mono">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full text-left p-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition-colors border border-blue-500/10">
              <p className="text-sm font-bold text-blue-400">📞 Override Dispatch</p>
              <p className="text-xs text-gray-500 mt-1">Manually assign a provider to a pending request</p>
            </button>
            <button className="w-full text-left p-4 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 transition-colors border border-purple-500/10">
              <p className="text-sm font-bold text-purple-400">📊 Export Reports</p>
              <p className="text-xs text-gray-500 mt-1">Download CSV of today&apos;s transactions</p>
            </button>
            <button className="w-full text-left p-4 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 transition-colors border border-amber-500/10">
              <p className="text-sm font-bold text-amber-400">⚙️ System Health</p>
              <p className="text-xs text-gray-500 mt-1">Check Edge API, Firebase, and Stripe status</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
