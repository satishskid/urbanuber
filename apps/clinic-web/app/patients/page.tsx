"use client";

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../lib/firebase";

interface Patient {
    id: string;
    phone: string;
    subscription_tier: string;
    [key: string]: unknown;
}

export default function PatientsPage() {
    const [patients, setPatients] = useState<Patient[]>([]);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsub = onSnapshot(collection(db, "patients"), (snap) => {
            const list = snap.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as Patient[];
            setPatients(list);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const filtered = patients.filter(
        (p) =>
            p.id.toLowerCase().includes(search.toLowerCase()) ||
            (p.phone || "").includes(search)
    );

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h2 className="text-3xl font-black text-white tracking-tight">Patients</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        {loading ? "Loading..." : `${patients.length} registered patients`}
                        <span className="text-green-400 ml-2">● Live</span>
                    </p>
                </div>
            </div>

            <div className="mb-6">
                <input
                    type="text"
                    placeholder="Search by ID or phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full max-w-md px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-300 placeholder:text-gray-600 focus:outline-none focus:border-blue-500/50 transition-colors"
                />
            </div>

            <div className="glass-card overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-white/5">
                            <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Patient ID</th>
                            <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Phone</th>
                            <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Tier</th>
                            <th className="text-left p-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-sm text-gray-600">
                                    {loading ? "Connecting to Firestore..." : "No patients found. They will appear here as they register."}
                                </td>
                            </tr>
                        ) : (
                            filtered.map((patient) => (
                                <tr key={patient.id} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center text-xs font-bold text-blue-400">
                                                {(patient.id || "?").charAt(0).toUpperCase()}
                                            </div>
                                            <span className="text-sm font-mono text-gray-300">{patient.id}</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-sm text-gray-400">{patient.phone || "—"}</td>
                                    <td className="p-4">
                                        <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider badge-accepted">
                                            {patient.subscription_tier || "free"}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <button className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors">
                                            View Timeline →
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
