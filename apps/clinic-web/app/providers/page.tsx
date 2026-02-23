export default function ProvidersPage() {
    const providers = [
        { id: "DR-001", name: "Dr. Anita Smith", role: "Pediatrician", status: "online", consults: 12, rating: 4.9, earned: "₹18,000" },
        { id: "DR-002", name: "Dr. Rajesh Mehra", role: "Pediatrician", status: "online", consults: 8, rating: 4.8, earned: "₹12,500" },
        { id: "DR-003", name: "Dr. Priya Desai", role: "Dermatologist", status: "offline", consults: 5, rating: 4.7, earned: "₹7,200" },
        { id: "PH-001", name: "Raj Kumar", role: "Phlebotomist", status: "online", consults: 15, rating: 4.6, earned: "₹5,400" },
        { id: "PH-002", name: "Sunita Devi", role: "Phlebotomist", status: "offline", consults: 9, rating: 4.5, earned: "₹3,100" },
        { id: "NR-001", name: "Deepa Nair", role: "Home Nurse", status: "online", consults: 3, rating: 4.9, earned: "₹4,800" },
    ];

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Providers</h2>
                    <p className="text-sm text-gray-500 mt-1">All registered healthcare providers and their availability</p>
                </div>
                <button className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors">
                    + Onboard Provider
                </button>
            </div>

            {/* Provider Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {providers.map((provider) => (
                    <div key={provider.id} className="glass-card p-5 hover:border-blue-500/20 transition-colors">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600/30 to-purple-600/30 flex items-center justify-center text-lg font-bold text-blue-400">
                                    {provider.name.charAt(0)}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-white">{provider.name}</p>
                                    <p className="text-[10px] text-gray-500 font-mono">{provider.id} · {provider.role}</p>
                                </div>
                            </div>
                            <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${provider.status === "online" ? "badge-online" : "badge-offline"
                                }`}>
                                {provider.status}
                            </span>
                        </div>

                        <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/5">
                            <div>
                                <p className="text-lg font-black text-white">{provider.consults}</p>
                                <p className="text-[10px] text-gray-600">Consults</p>
                            </div>
                            <div>
                                <p className="text-lg font-black text-white">⭐ {provider.rating}</p>
                                <p className="text-[10px] text-gray-600">Rating</p>
                            </div>
                            <div>
                                <p className="text-lg font-black text-white">{provider.earned}</p>
                                <p className="text-[10px] text-gray-600">Earned</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
