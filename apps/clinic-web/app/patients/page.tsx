export default function PatientsPage() {
    const patients = [
        { id: "P-1247", name: "Arjun Mehta", age: 4, lastVisit: "Today", status: "Active", condition: "Otitis Media" },
        { id: "P-1243", name: "Priya Sharma", age: 7, lastVisit: "Yesterday", status: "Active", condition: "Upper RTI" },
        { id: "P-1240", name: "Rohit Kumar", age: 2, lastVisit: "2 days ago", status: "Follow-up", condition: "Fever of Unknown Origin" },
        { id: "P-1235", name: "Sneha Reddy", age: 5, lastVisit: "3 days ago", status: "Discharged", condition: "Viral Gastroenteritis" },
        { id: "P-1228", name: "Vikram Singh", age: 8, lastVisit: "1 week ago", status: "Active", condition: "Asthma Exacerbation" },
        { id: "P-1201", name: "Ananya Iyer", age: 3, lastVisit: "1 week ago", status: "Lab Pending", condition: "Anemia Screening" },
    ];

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Patients</h2>
                    <p className="text-sm text-gray-500 mt-1">All registered patients and their clinical status</p>
                </div>
                <button className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors">
                    + Add Patient
                </button>
            </div>

            {/* Search */}
            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Search by name, ID, or condition..."
                    className="w-full max-w-md px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/5">
                            <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Patient</th>
                            <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Age</th>
                            <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Condition</th>
                            <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Last Visit</th>
                            <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                            <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {patients.map((patient) => (
                            <tr key={patient.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                <td className="p-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-xs font-bold text-blue-400">
                                            {patient.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium text-white">{patient.name}</p>
                                            <p className="text-[10px] font-mono text-gray-600">{patient.id}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-4 text-sm text-gray-400">{patient.age}y</td>
                                <td className="p-4 text-sm text-gray-300">{patient.condition}</td>
                                <td className="p-4 text-sm text-gray-500">{patient.lastVisit}</td>
                                <td className="p-4">
                                    <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${patient.status === "Active" ? "badge-accepted" :
                                            patient.status === "Lab Pending" ? "badge-pending" :
                                                patient.status === "Follow-up" ? "badge-pending" :
                                                    "badge-completed"
                                        }`}>
                                        {patient.status}
                                    </span>
                                </td>
                                <td className="p-4">
                                    <button className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
                                        View Timeline →
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
