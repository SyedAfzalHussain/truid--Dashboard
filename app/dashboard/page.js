"use client";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip, FunnelChart, Funnel,

    PieChart,
    Pie,
    Cell,
} from "recharts";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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

        setClientsData({ 1: null, 2: null, 3: null });
        setClientsLoading({ 1: true, 2: true, 3: true });

        const clients = ["1", "2", "3"];

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

    /** 📊 AGGREGATE DATA FOR OVERALL FUNNEL */
    const getAggregatedFunnelData = () => {
        let totalCount = 0;
        let verified = 0;
        let notVerified = 0;
        let pending = 0;
        let incomplete = 0;
        const servicesMap = {};

        [1, 2, 3].forEach((clientId) => {
            const clientData = clientsData[clientId];
            if (!clientData) return;

            totalCount += clientData.total_count || 0;
            verified += clientData.verfied || clientData.verified || 0;
            notVerified += clientData.not_verified || 0;
            pending += clientData.pending || 0;
            incomplete += clientData.incomplete || 0;

            if (clientData.services_count) {
                Object.entries(clientData.services_count).forEach(([serviceName, serviceData]) => {
                    if (!servicesMap[serviceName]) {
                        servicesMap[serviceName] = {
                            total: 0,
                            verified: 0,
                            notVerified: 0,
                            pending: 0,
                            matchedApplicants: 0,
                            notMatchedApplicants: 0,
                        };
                    }

                    servicesMap[serviceName].total += serviceData?.total || 0;
                    servicesMap[serviceName].verified += serviceData?.verfied ?? serviceData?.verified ?? 0;
                    servicesMap[serviceName].notVerified += serviceData?.not_verified ?? 0;
                    servicesMap[serviceName].pending += serviceData?.Pending ?? 0;
                    servicesMap[serviceName].matchedApplicants += serviceData?.matched_applicants ?? 0;
                    servicesMap[serviceName].notMatchedApplicants += serviceData?.not_matched_applicants ?? 0;
                });
            }
        });

        // Sort services by total count (descending)
        const sortedServices = Object.entries(servicesMap)
            .sort(([, a], [, b]) => b.total - a.total)
            .map(([name, data]) => ({ name, ...data }));

        return {
            totalCount,
            verified,
            notVerified,
            pending,
            incomplete,
            services: sortedServices,
        };
    };

    const hasAnyData = () => {
        return clientsData[1]?.services_count || clientsData[2]?.services_count || clientsData[3]?.services_count;
    };

    if (!authorized) {
        return null; // prevents UI flash
    }

    const funnelData = getAggregatedFunnelData();

    return (
        <div className="dashboard-wrapper">
            {/* Logout Button - Top Right */}
            <button className="logout-btn" onClick={handleLogout} title="Logout">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                    <polyline points="16 17 21 12 16 7"></polyline>
                    <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
            </button>

            <h1 className="dashboard-title">Analytics Dashboard</h1>

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
                <div className="funnel-section">
                    <div className="funnel-card">
                        <div className="skeleton skeleton-funnel"></div>
                    </div>
                </div>
            )}

            {/* DATA DISPLAY - FUNNEL VISUALIZATION */}
            {!fetchingDisabled && hasAnyData() && (
                <>
                    {/* OVERALL FUNNEL */}
                    <FunnelVisualization
                        title="Overall Funnel (All Clients)"
                        data={funnelData}
                    />

                    {/* PER CLIENT FUNNELS */}
                    {[1, 2, 3].map((clientId) => {
                        const clientData = clientsData[clientId];
                        if (!clientData?.services_count) return null;

                        const services = Object.entries(clientData.services_count)
                            .sort(([, a], [, b]) => (b?.total || 0) - (a?.total || 0))
                            .map(([name, data]) => ({
                                name,
                                total: data?.total || 0,
                                verified: data?.verfied ?? data?.verified ?? 0,
                                notVerified: data?.not_verified ?? 0,
                                pending: data?.Pending ?? 0,
                                matchedApplicants: data?.matched_applicants ?? 0,
                                notMatchedApplicants: data?.not_matched_applicants ?? 0,
                            }));

                        const clientFunnelData = {
                            totalCount: clientData.total_count || 0,
                            verified: clientData.verfied || clientData.verified || 0,
                            notVerified: clientData.not_verified || 0,
                            pending: clientData.pending || 0,
                            incomplete: clientData.incomplete || 0,
                            services,
                        };

                        return (
                            <FunnelVisualization
                                key={clientId}
                                title={`Client ${clientId} Funnel - ${clientData.client_name || 'Unknown'}`}
                                data={clientFunnelData}
                            />
                        );
                    })}
                </>
            )}
        </div>
    );
}

/** 📊 FUNNEL VISUALIZATION COMPONENT */
function FunnelVisualization({ title, data }) {
    const formatName = (name) => {
        return name
            .split("_")
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ");
    };

    // Prepare funnel chart data
    const funnelChartData = [
        { name: "Total Applications", value: data.totalCount, fill: "#2255FF" },
        ...data.services.map((service, index) => ({
            name: formatName(service.name),
            value: service.total,
            fill: `hsl(${200 + index * 15}, 70%, 55%)`,
            details: service
        })),
    ];

    // Prepare outcome breakdown data
    const outcomeData = [
        { name: "Verified", value: data.verified, fill: "#0488BB" },
        { name: "Pending", value: data.pending, fill: "#ffa502" },
        { name: "Not Verified", value: data.notVerified, fill: "#696969" },
        { name: "Incomplete", value: data.incomplete, fill: "#d63031" }
    ].filter(item => item.value > 0);

    const CustomFunnelLabel = ({ x, y, width, height, value, name }) => {
        return (
            <g>
                <text
                    x={x + width / 2}
                    y={y + height / 2 - 8}
                    fill="#fff"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontWeight="700"
                    fontSize="16"
                    style={{ textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
                >
                    {value.toLocaleString()}
                </text>
                <text
                    x={x + width / 2}
                    y={y + height / 2 + 10}
                    fill="#fff"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize="12"
                    opacity="0.9"
                >
                    {name?.length > 20 ? name?.substring(0, 20) + '...' : name}
                </text>
            </g>
        );
    };

    return (
        <div className="funnel-section">
            <h2 className="funnel-title">{title}</h2>

            {/* Overall Summary Cards */}
            <div className="overall-summary-cards">
                <div className="summary-card summary-total">
                    <div className="summary-label">Total Applications</div>
                    <div className="summary-value">{data.totalCount.toLocaleString()}</div>
                </div>
                <div className="summary-card summary-verified">
                    <div className="summary-label">Verified</div>
                    <div className="summary-value">{data.verified.toLocaleString()}</div>
                </div>
                <div className="summary-card summary-pending">
                    <div className="summary-label">Pending</div>
                    <div className="summary-value">{data.pending.toLocaleString()}</div>
                </div>
                <div className="summary-card summary-not-verified">
                    <div className="summary-label">Not Verified</div>
                    <div className="summary-value">{data.notVerified.toLocaleString()}</div>
                </div>
                {data.incomplete > 0 && (
                    <div className="summary-card summary-incomplete">
                        <div className="summary-label">Incomplete</div>
                        <div className="summary-value">{data.incomplete.toLocaleString()}</div>
                    </div>
                )}
            </div>

            {/* Funnel Chart */}
            <div className="funnel-chart-section">
                <h3 className="section-subtitle">Application Flow Funnel</h3>
                <div className="funnel-chart-container">
                    <ResponsiveContainer width="100%" height={500}>
                        <FunnelChart>
                            <Tooltip
                                contentStyle={{
                                    background: 'rgba(255, 255, 255, 0.95)',
                                    border: '1px solid rgba(0, 0, 0, 0.1)',
                                    borderRadius: '8px',
                                    padding: '10px',
                                }}
                                formatter={(value) => value.toLocaleString()}
                            />
                            <Funnel
                                dataKey="value"
                                data={funnelChartData}
                                isAnimationActive
                                label={CustomFunnelLabel}
                            >
                                {funnelChartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Funnel>
                        </FunnelChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Detailed Service Breakdown */}
            <div className="services-breakdown-section">
                <h3 className="section-subtitle">Service Details</h3>
                <div className="services-breakdown-grid">
                    {data.services.map((service, index) => {
                        const hasPending = service.pending > 0;
                        const hasFingerprintData = service.matchedApplicants > 0 || service.notMatchedApplicants > 0;
                        const verifiedPercent = service.total > 0 ? ((service.verified / service.total) * 100).toFixed(1) : 0;

                        return (
                            <>
                            {/* {service?.name === 'fingerprint_capture' ?
                                (
                                    <div key={service.name} className="service-detail-card fingerprint-service-card">
                                        <div className="service-detail-header">
                                            <div className="service-detail-title">
                                                <div className="service-icon-small">
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <div className="service-detail-name">{formatName(service.name)}</div>
                                                    <div className="service-detail-total">{service.total.toLocaleString()} Total</div>
                                                </div>
                                            </div>
                                            <div className="service-detail-verified-rate" style={{ color: '#0488BB' }}>
                                                {verifiedPercent}%
                                            </div>
                                        </div>
                                    </div>
                                )
                                : ( */}
                                    <div key={service.name} className="service-detail-card">
                                        <div className="service-detail-header">
                                            <div className="service-detail-title">
                                                <div className="service-icon-small">
                                                    {index + 1}
                                                </div>
                                                <div>
                                                    <div className="service-detail-name">{formatName(service.name)}</div>
                                                    <div className="service-detail-total">{service.total.toLocaleString()} Total</div>
                                                </div>
                                            </div>
                                            <div className="service-detail-verified-rate" style={{ color: '#0488BB' }}>
                                                {verifiedPercent}%
                                            </div>
                                        </div>
                                        {/* {service?.name === 'fingerprint_capture' ? (
                                    <div className="fingerprint-banner">
                                        <strong>Note:</strong> This service includes fingerprint matching data.
                                    </div>
                                ):( */}
                                        <div className="service-detail-metrics">
                                            <div className="metric-detail-row">
                                                <div className="metric-detail-label">Verified</div>
                                                <div className="metric-detail-value metric-verified">
                                                    {service.verified.toLocaleString()}
                                                </div>
                                                <div className="metric-detail-bar">
                                                    <div
                                                        className="metric-bar-fill metric-verified-fill"
                                                        style={{ width: `${verifiedPercent}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {service.notVerified > 0 && (
                                                <div className="metric-detail-row">
                                                    <div className="metric-detail-label">Not Verified</div>
                                                    <div className="metric-detail-value metric-not-verified">
                                                        {service.notVerified.toLocaleString()}
                                                    </div>
                                                </div>
                                            )}

                                            {hasPending && (
                                                <div className="metric-detail-row">
                                                    <div className="metric-detail-label">Pending</div>
                                                    <div className="metric-detail-value metric-pending">
                                                        {service.pending.toLocaleString()}
                                                    </div>
                                                </div>
                                            )}

                                            {/* {hasFingerprintData && (
                                        <div className="fingerprint-detail-section">
                                            <div className="fp-divider"></div>
                                            <div className="fp-detail-title">Fingerprint Matching</div>
                                            <div className="fp-detail-grid">
                                                <div className="fp-detail-item">
                                                    <div className="fp-detail-label">Matched Applicants</div>
                                                    <div className="fp-detail-value fp-matched">
                                                        {service.matchedApplicants.toLocaleString()}
                                                    </div>
                                                </div>
                                                <div className="fp-detail-item">
                                                    <div className="fp-detail-label">Not Matched</div>
                                                    <div className="fp-detail-value fp-not-matched">
                                                        {service.notMatchedApplicants.toLocaleString()}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )} */}
                                        </div>
                                        {/* )} */}
                                    </div>
                                {/* )} */}
                            </>
                        );
                    })}
                </div >
            </div>

            {/* Conversion Metrics */}
            <div className="conversion-metrics-section">
                <h3 className="section-subtitle">Conversion Metrics</h3>
                <div className="conversion-metrics-grid">
                    <div className="conversion-metric-card">
                        <div className="conversion-metric-label">Conversion Rate</div>
                        <div className="conversion-metric-value">
                            {data.totalCount > 0 ? ((data.verified / data.totalCount) * 100).toFixed(1) : 0}%
                        </div>
                        <div className="conversion-metric-desc">
                            {data.verified.toLocaleString()} of {data.totalCount.toLocaleString()} applications
                        </div>
                    </div>
                    <div className="conversion-metric-card">
                        <div className="conversion-metric-label">Drop Off Rate</div>
                        <div className="conversion-metric-value negative">
                            {data.totalCount > 0 ? (((data.totalCount - data.verified) / data.totalCount) * 100).toFixed(1) : 0}%
                        </div>
                        <div className="conversion-metric-desc">
                            {(data.totalCount - data.verified).toLocaleString()} applications not verified
                        </div>
                    </div>
                    <div className="conversion-metric-card">
                        <div className="conversion-metric-label">Pending Rate</div>
                        <div className="conversion-metric-value warning">
                            {data.totalCount > 0 ? ((data.pending / data.totalCount) * 100).toFixed(1) : 0}%
                        </div>
                        <div className="conversion-metric-desc">
                            {data.pending.toLocaleString()} applications pending
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
