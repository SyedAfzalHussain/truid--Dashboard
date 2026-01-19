"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bar, Doughnut } from "react-chartjs-2";
import {
    Chart as ChartJS,
    BarElement,
    ArcElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend,
} from "chart.js";

ChartJS.register(
    BarElement,
    ArcElement,
    CategoryScale,
    LinearScale,
    Tooltip,
    Legend
);

export default function Dashboard() {
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);
    const [client, setClient] = useState("3");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [dataFetched, setDataFetched] = useState(false);


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
    //     fetch("https://askari-test.truid.ai/services-count/", {
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

    /** 📊 FETCH DASHBOARD DATA */
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
        setLoading(true);
        setData(null);
        setDataFetched(false);

        try {
            const res = await fetch(
                "https://askari-test.truid.ai/services-count/",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Token ${token}`,
                    },
                    body: JSON.stringify({
                        client,
                        from_date: formatDate(fromDate),
                        to_date: formatDate(toDate),
                    }),
                }
            );

            if (res.status === 401 || res.status === 403) {
                document.cookie = "userKey=; Max-Age=0; path=/";
                router.replace("/");
                return;
            }

            if (!res.ok) {
                setError(`Failed to fetch data. Status: ${res.status}`);
                return;
            }

            const result = await res.json();

            if (!result || Object.keys(result).length === 0) {
                setError("No data found for the selected client and date range");
                setDataFetched(true);
                return;
            }

            setData(result);
            setDataFetched(true);
        } catch (err) {
            console.error("Fetch failed:", err);
            setError("Failed to fetch data. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const clearError = () => setError("");


    if (!authorized) {
        return null; // prevents UI flash
    }

    return (
        <div className="dashboard-wrapper">
            <h1 className="dashboard-title">Analytics Dashboard</h1>

            {/* FILTER CARD */}
            <div className="filter-card">
                <div className="filter-group">
                    <label>Client</label>
                    <select value={client} onChange={(e) => setClient(e.target.value)}>
                        <option value="3">3</option>
                        <option value="2">2</option>
                        <option value="1">1</option>
                    </select>
                </div>

                <div className="filter-group">
                    <label>From Date</label>
                    <input type="date" value={fromDate} onChange={(e) => { setFromDate(e.target.value); clearError(); }} />
                </div>

                <div className="filter-group">
                    <label>To Date</label>
                    <input type="date" value={toDate} onChange={(e) => { setToDate(e.target.value); clearError(); }} />
                </div>

                <button className="fetch-btn" onClick={fetchData}>
                    {loading ? "Loading..." : "Fetch Data"}
                </button>
            </div>

            {error && <div className="error-message">{error}</div>}

            {/* DASHBOARD DATA */}
            {dataFetched && !data?.services_count && !error && (
                <div className="no-data-message">
                    No data available for the selected client and date range
                </div>
            )}

            {data && data.services_count && (
                <>
                    <div className="kpi-grid">
                        <Kpi title="Total Count" value={data.total_count ?? 0} />
                        <Kpi title="Verified" value={data.verified ?? 0} />
                        <Kpi title="Not Verified" value={data.not_verified ?? 0} />
                        <Kpi title="Incomplete" value={data.incomplete ?? 0} />
                    </div>

                    <div className="charts-grid">
                        <div className="chart-card">
                            <h3>Services Distribution</h3>
                            <Doughnut
                                data={{
                                    labels: Object.keys(data.services_count || {}),
                                    datasets: [
                                        {
                                            data: Object.values(data.services_count || {}).map(
                                                (s) => s?.total || 0
                                            ),
                                            backgroundColor: [
                                                "#43cea2",
                                                "#667eea",
                                                "#ffb703",
                                                "#ef476f",
                                                "#06d6a0",
                                                "#118ab2",
                                            ],
                                        },
                                    ],
                                }}
                            />
                        </div>

                        <div className="chart-card">
                            <h3>Verification Overview</h3>
                            <Bar
                                data={{
                                    labels: ["Verified", "Not Verified", "Incomplete"],
                                    datasets: [
                                        {
                                            label: "Count",
                                            data: [
                                                data.verified ?? 0,
                                                data.not_verified ?? 0,
                                                data.incomplete ?? 0,
                                            ],
                                            backgroundColor: "#43cea2",
                                        },
                                    ],
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
