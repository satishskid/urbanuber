export default function RequestsPage() {
    const requests = [
        { id: "SR-0081", patient: "Arjun Mehta", type: "Telehealth", provider: "Dr. Smith", status: "ACCEPTED", time: "2 min ago", amount: "₹500" },
        { id: "SR-0080", patient: "Ananya Iyer", type: "Home Lab (CBC)", provider: "Phlebotomist Raj", status: "ACCEPTED", time: "5 min ago", amount: "₹350" },
        { id: "SR-0079", patient: "New Patient #1250", type: "Telehealth", provider: "—", status: "PENDING", time: "8 min ago", amount: "₹500" },
        { id: "SR-0078", patient: "Priya Sharma", type: "Rx Delivery", provider: "MedPlus Pharmacy", status: "COMPLETED", time: "12 min ago", amount: "₹220" },
        { id: "SR-0077", patient: "Rohit Kumar", type: "Telehealth", provider: "Dr. Mehra", status: "COMPLETED", time: "15 min ago", amount: "₹500" },
        { id: "SR-0076", patient: "Sneha Reddy", type: "Home Lab (LFT)", provider: "—", status: "PENDING", time: "25 min ago", amount: "₹600" },
    ];

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Service Requests</h2>
                    <p className="text-sm text-gray-500 mt-1">Live feed of all healthcare service requests</p>
                </div>
                <div className="flex gap-2">
                    {["All", "Pending", "Accepted", "Completed"].map((filter) => (
                        <button
                            key={filter}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filter === "All"
                                    ? "bg-white/10 text-white"
                                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                }`}
                        >
                            {filter}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-3">
                {requests.map((req) => (
                    <div key={req.id} className="glass-card p-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${req.status === "PENDING" ? "bg-amber-400 animate-pulse" :
                                    req.status === "ACCEPTED" ? "bg-blue-400" :
                                        "bg-green-400"
                                }`} />
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-bold text-white">{req.patient}</span>
                                    <span className="text-[10px] font-mono text-gray-600">{req.id}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-500">
                                    <span>{req.type}</span>
                                    <span>•</span>
                                    <span>{req.provider}</span>
                                    <span>•</span>
                                    <span>{req.time}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <span className="text-sm font-mono text-gray-400">{req.amount}</span>
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${req.status === "PENDING" ? "badge-pending" :
                                    req.status === "ACCEPTED" ? "badge-accepted" :
                                        "badge-completed"
                                }`}>
                                {req.status}
                            </span>
                            {req.status === "PENDING" && (
                                <button className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors">
                                    Assign
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
