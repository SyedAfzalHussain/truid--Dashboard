"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
} from "chart.js";

ChartJS.register(
    BarElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend
);

export default function Dashboard() {
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [clientsData, setClientsData] = useState({
        1: null,
        2: null,
        3: null,
    });
    const [clientsLoading, setClientsLoading] = useState({
        1: false,
        2: false,
        3: false,
    });
    const [fetchingDisabled, setFetchingDisabled] = useState(false);
    const [error, setError] = useState("");


    const MAX_DAYS = 40;

    const isDateRangeValid = (fromDate, toDate) => {
        if (!fromDate || !toDate) return false;

        const from = new Date(fromDate);
        const to = new Date(toDate);

        const diffInMs = to - from;
        const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

        return diffInDays <= MAX_DAYS && diffInDays >= 0;
    };


    const formatDate = (date) => {
        if (!date) return "";
        const d = new Date(date);
        return d.toISOString().split("T")[0];
    };

    useEffect(() => {
        const token = getToken();
        if (!token) {
            router.replace("/");
        } else {
            setAuthorized(true);
        }
    }, [router]);


    const getToken = () =>
        document.cookie
            .split("; ")
            .find((row) => row.startsWith("userKey="))
            ?.split("=")[1];



    /** 🔐 AUTH CHECK */
    // useEffect(() => {
    //     const token = getToken();

    //     if (!token) {
    //         router.replace("/");
    //         return;
    //     }

    //     // Minimal token validation using API
    //     fetch("https://trueidmapp.askaribank.com.pk/services-count/", {
    //         method: "POST",
    //         headers: {
    //             "Content-Type": "application/json",
    //             Authorization: `Token ${token}`,
    //         },
    //         body: JSON.stringify({
    //             client,
    //             from_date: formatDate(fromDate), // 2025-04-01
    //             to_date: formatDate(toDate),
    //         }),
    //     }).then((res) => {
    //         if (res.status === 401 || res.status === 403) {
    //             document.cookie = "userKey=; Max-Age=0; path=/";
    //             router.replace("/");
    //         } else {
    //             setAuthorized(true);
    //         }
    //     });
    // }, [router]);

    /** 📊 FETCH DASHBOARD DATA FOR ALL CLIENTS IN PARALLEL */
    const fetchData = async () => {
        const token = getToken();
        if (!token) {
            router.replace("/");
            return;
        }

        if (!fromDate || !toDate) {
            setError("Please select From Date and To Date");
            return;
        }

        if (!isDateRangeValid(fromDate, toDate)) {
            setError("Date range must not be more than 40 days");
            return;
        }

        setError("");
        setFetchingDisabled(true);

        // Reset previous data and set all clients to loading
        setClientsData({ 1: null, 2: null, 3: null });
        setClientsLoading({ 1: true, 2: true, 3: true });

        const clients = ["1", "2", "3"];

        // Fetch data for all clients in parallel using Promise.all
        try {
            const fetchPromises = clients.map(async (clientId) => {
                const res = await fetch(
                    "https://trueidmapp.askaribank.com.pk/services-count/",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Token ${token}`,
                        },
                        body: JSON.stringify({
                            client: clientId,
                            from_date: formatDate(fromDate),
                            to_date: formatDate(toDate),
                        }),
                    }
                );

                if (res.status === 401 || res.status === 403) {
                    document.cookie = "userKey=; Max-Age=0; path=/";
                    router.replace("/");
                    return null;
                }

                if (!res.ok) {
                    console.error(`Failed to fetch data for client ${clientId}. Status: ${res.status}`);
                    return null;
                }

                const result = await res.json();
                return { clientId, data: result };
            });

            const results = await Promise.all(fetchPromises);

            // Update all clients data at once
            const newClientsData = { 1: null, 2: null, 3: null };
            results.forEach(result => {
                if (result && result.clientId) {
                    newClientsData[result.clientId] = result.data;
                }
            });
            setClientsData(newClientsData);
            setClientsLoading({ 1: false, 2: false, 3: false });

        } catch (err) {
            console.error("Fetch failed:", err);
            setClientsLoading({ 1: false, 2: false, 3: false });
        }

        setFetchingDisabled(false);
    };

    const clearError = () => setError("");

    const handleLogout = () => {
        document.cookie = "userKey=; Max-Age=0; path=/";
        router.replace("/");
    };

    /** 📊 AGGREGATE DATA BY SERVICE TYPE */
    const getServiceAggregatedData = () => {
        const servicesMap = {};

        [1, 2, 3].forEach((clientId) => {
            const clientData = clientsData[clientId];
            if (!clientData?.services_count) return;

            Object.entries(clientData.services_count).forEach(([serviceName, serviceData]) => {
                if (!servicesMap[serviceName]) {
                    servicesMap[serviceName] = {
                        total: 0,
                        verified: 0,
                        notVerified: 0,
                        clients: {}
                    };
                }

                const verified = serviceData?.verfied ?? serviceData?.verified ?? 0;
                const notVerified = serviceData?.not_verified ?? 0;
                const total = serviceData?.total ?? 0;

                servicesMap[serviceName].total += total;
                servicesMap[serviceName].verified += verified;
                servicesMap[serviceName].notVerified += notVerified;
                servicesMap[serviceName].clients[clientId] = {
                    verified,
                    notVerified,
                    total
                };
            });
        });

        return servicesMap;
    };

    /** 📊 GET OVERALL TOTALS */
    const getOverallTotals = () => {
        let totalCount = 0;
        let verifiedCount = 0;
        let notVerifiedCount = 0;

        [1, 2, 3].forEach((clientId) => {
            const clientData = clientsData[clientId];
            if (clientData) {
                totalCount += clientData.total_count || 0;
                verifiedCount += clientData.verfied || clientData.verified || 0;
                notVerifiedCount += clientData.not_verified || 0;
            }
        });

        return { totalCount, verifiedCount, notVerifiedCount };
    };

    const hasAnyData = () => {
        return clientsData[1]?.services_count || clientsData[2]?.services_count || clientsData[3]?.services_count;
    };

    if (!authorized) {
        return null; // prevents UI flash
    }

    return (
        <div className="dashboard-wrapper">
            <h1 className="dashboard-title">Analytics Dashboard</h1>
            <button className="logout-btn" onClick={handleLogout} title="Logout">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                </button>

            {/* LOGOS */}
            <div className="logos-container">
                <img src="/Askari-bank-logo.png" alt="Askari Bank Logo" className="dashboard-logo" />
                <img src="/truid_logo_main.png" alt="Truid Logo" className="dashboard-logo" />
            </div>

            {/* FILTER CARD */}
            <div className="filter-card">
                <div className="filter-group">
                    <label>From Date</label>
                    <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); clearError(); }} />
                </div>

                <div className="filter-group">
                    <label>To Date</label>
                    <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); clearError(); }} />
                </div>

                <button className="fetch-btn" onClick={fetchData} disabled={fetchingDisabled}>
                    {fetchingDisabled ? "Fetching..." : "Fetch Data"}
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            {/* LOADING STATE */}
            {(clientsLoading[1] || clientsLoading[2] || clientsLoading[3]) && (
                <div className="client-section">
                    <div className="kpi-grid">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="kpi-card">
                                <div className="skeleton skeleton-kpi"></div>
                            </div>
                        ))}
                    </div>
                    <div className="charts-grid">
                        <div className="chart-card">
                            <div className="skeleton skeleton-title"></div>
                            <div className="skeleton skeleton-chart"></div>
                        </div>
                    </div>
                </div>
            )}

            {/* DATA DISPLAY - ORGANIZED BY SERVICE TYPE */}
            {!fetchingDisabled && hasAnyData() && (
                <>
                    {/* OVERALL TOTALS */}

                    {/* SERVICE BREAKDOWNS */}
                    {(() => {
                        const servicesMap = getServiceAggregatedData();
                        return Object.entries(servicesMap).map(([serviceName, serviceData]) => (
                            <ServiceBreakdown
                                key={serviceName}
                                serviceName={serviceName}
                                serviceData={serviceData}
                            />
                        ));
                    })()}
                    <div className="overall-summary-section">
                        <h2 className="client-title">Overall Totals (All Clients)</h2>
                        {(() => {
                            const { totalCount, verifiedCount, notVerifiedCount } = getOverallTotals();
                            return (
                                <div className="kpi-grid">
                                    <Kpi title="Total Count" value={totalCount} />
                                    <Kpi title="Verified" value={verifiedCount} />
                                    <Kpi title="Not Verified" value={notVerifiedCount} />
                                </div>
                            );
                        })()}
                        <div className="chart-card">
                        <h3>Overall Verification Overview</h3>
                        <Bar
                            data={{
                                labels: ["Verified", "Not Verified"],
                                datasets: [
                                    {
                                        label: "Count",
                                        data: [
                                            (clientsData[1]?.verfied || clientsData[1]?.verified || 0) +
                                            (clientsData[2]?.verfied || clientsData[2]?.verified || 0) +
                                            (clientsData[3]?.verfied || clientsData[3]?.verified || 0),
                                            (clientsData[1]?.not_verified || 0) +
                                            (clientsData[2]?.not_verified || 0) +
                                            (clientsData[3]?.not_verified || 0),
                                        ],
                                        backgroundColor: ["#0488BB", "#696969"],
                                    },
                                ],
                            }}
                            options={{
                                responsive: true,
                                maintainAspectRatio: true,
                                plugins: {
                                    legend: {
                                        labels: {
                                            color: "#333",
                                            font: {
                                                size: 12
                                            }
                                        }
                                    }
                                },
                                scales: {
                                    y: {
                                        ticks: {
                                            color: "rgba(0, 0, 0, 0.7)",
                                            font: {
                                                size: 11
                                            }
                                        },
                                        grid: {
                                            color: "rgba(0, 0, 0, 0.1)"
                                        }
                                    },
                                    x: {
                                        ticks: {
                                            color: "rgba(0, 0, 0, 0.7)",
                                            font: {
                                                size: 11
                                            }
                                        },
                                        grid: {
                                            color: "rgba(0, 0, 0, 0.1)"
                                        }
                                    }
                                }
                            }}
                        />
                    </div>
                    </div>
                </>
            )}
        </div>
    );
}

function Kpi({ title, value }) {
    return (
        <div className="kpi-card">
            <span>{title}</span>
            <br />
            <strong>{value}</strong>
        </div>
    );
}

/** 📊 SERVICE BREAKDOWN WITH CLIENT DETAILS */
function ServiceBreakdown({ serviceName, serviceData }) {
    const getIcon = (name) => {
        const service = name.toLowerCase().replace(/_/g, " ");

        if (service.includes("face") || service.includes("liveness")) {
            return (
                <svg className="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="9" cy="9" r="4"></circle>
                    <path d="M21 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
            );
        }
        if (service.includes("document") || service.includes("capture")) {
            return (
                <svg className="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
            );
        }
        if (service.includes("ocr") || service.includes("text") || service.includes("extraction")) {
            return (
                <svg className="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M4 7V4h16v3M9 20h6M12 4v16"></path>
                </svg>
            );
        }
        if (service.includes("fingerprint")) {
            return (
                <svg className="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 6"></path>
                    <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 6-6 6 6 0 0 1 6 6c0 2.5-.5 4.5-1 5.5"></path>
                    <path d="M12 12v4c0 2.5.5 4.5 1 5.5"></path>
                </svg>
            );
        }
        if (service.includes("matching") || service.includes("selfie")) {
            return (
                <svg className="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-3-3.87M9 21v-2a4 4 0 0 1 3-3.87"></path>
                    <circle cx="9" cy="7" r="4"></circle>
                    <circle cx="15" cy="7" r="4"></circle>
                </svg>
            );
        }
        return (
            <svg className="service-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
        );
    };

    const formatName = (name) => {
        return name
            .split("_")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    };


    return (
        <div className="client-section">
            <h2 className="client-title">
                <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {getIcon(serviceName)}
                    {formatName(serviceName)}
                </span>
            </h2>

            {/* Service Total Summary */}
            <div className="kpi-grid">
                <Kpi title="Total Count" value={serviceData.total} />
                <Kpi title="Verified" value={serviceData.verified} />
                <Kpi title="Not Verified" value={serviceData.notVerified} />
            </div>

            {/* Client Breakdown */}
            <div className="chart-card services-card">
                <h3>Client Breakdown</h3>
                <div className="client-breakdown-grid">
                    {[1, 2, 3].map((clientId) => {
                        const clientServiceData = serviceData.clients[clientId];
                        if (!clientServiceData) return null;

                        const clientVerifiedPercent = clientServiceData.total > 0
                            ? Math.round((clientServiceData.verified / clientServiceData.total) * 100)
                            : 0;

                        return (
                            <div key={clientId} className="client-breakdown-card">
                                <h4>Client {clientId}</h4>
                                <div className="breakdown-stats">
                                    <div className="stat-row">
                                        <span className="stat-label">Total:</span>
                                        <span className="stat-value">{clientServiceData.total}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span className="stat-label">Verified:</span>
                                        <span className="stat-value stat-verified">{clientServiceData.verified}</span>
                                    </div>
                                    <div className="stat-row">
                                        <span className="stat-label">Not Verified:</span>
                                        <span className="stat-value stat-not-verified">{clientServiceData.notVerified}</span>
                                    </div>
                                    <div className="progress-bar">
                                        <div
                                            className="progress-fill progress-verified"
                                            style={{ width: `${clientVerifiedPercent}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
