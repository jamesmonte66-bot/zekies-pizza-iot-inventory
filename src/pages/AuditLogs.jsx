
import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";

import {
  Activity,
  CalendarDays,
  ClipboardList,
  Download,
  RefreshCw,
  Search,
  User,
  Package,
  AlertCircle,
  FileText,
} from "lucide-react";

import { database } from "../firebase";
import "../App.css";

function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  /* =========================================
     FORMAT DATE
  ========================================= */

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";

    let date;

    if (typeof timestamp === "number") {
      date = new Date(
        timestamp < 1000000000000
          ? timestamp * 1000
          : timestamp
      );
    } else {
      date = new Date(timestamp);
    }

    if (Number.isNaN(date.getTime())) {
      return "Invalid date";
    }

    return date.toLocaleString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  /* =========================================
     FIREBASE LISTENER
  ========================================= */

  useEffect(() => {
    const logsRef = ref(database, "AuditLogs");

    const unsubscribe = onValue(
      logsRef,
      (snapshot) => {
        const data = snapshot.val();

        const records = data
          ? Object.entries(data).map(([id, value]) => ({
              id,
              ...value,
            }))
          : [];

        records.sort((a, b) => {
          const timeA = new Date(
            typeof a.timestamp === "number" &&
            a.timestamp < 1000000000000
              ? a.timestamp * 1000
              : a.timestamp || 0
          ).getTime();

          const timeB = new Date(
            typeof b.timestamp === "number" &&
            b.timestamp < 1000000000000
              ? b.timestamp * 1000
              : b.timestamp || 0
          ).getTime();

          return (
            (Number.isFinite(timeB) ? timeB : 0) -
            (Number.isFinite(timeA) ? timeA : 0)
          );
        });

        setLogs(records);
        setLastUpdated(new Date());
        setLoading(false);
        setError("");
      },
      (firebaseError) => {
        console.error("Audit Logs Firebase Error:", firebaseError);
        setError(firebaseError.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  /* =========================================
     SEARCH AND FILTER
  ========================================= */

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const action = String(
        log.action || ""
      ).toUpperCase();

      const matchesAction =
        actionFilter === "ALL" ||
        action === actionFilter;

      const searchableText = [
        log.user,
        log.userName,
        log.userFullName,
        log.userId,
        log.email,
        log.action,
        log.description,
        log.product,
        log.transactionId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = searchableText.includes(
        search.trim().toLowerCase()
      );

      return matchesAction && matchesSearch;
    });
  }, [logs, search, actionFilter]);

  /* =========================================
     ACTION BADGE
  ========================================= */

  const getActionClass = (action) => {
    const value = String(action || "").toUpperCase();

    if (
      value.includes("STOCK IN") ||
      value.includes("ADD") ||
      value.includes("RESTORE")
    ) {
      return "audit-success";
    }

    if (
      value.includes("STOCK OUT") ||
      value.includes("DELETE")
    ) {
      return "audit-danger";
    }

    if (value.includes("ARCHIVE")) {
      return "audit-warning";
    }

    if (
      value.includes("LOGIN") ||
      value.includes("LOGOUT")
    ) {
      return "audit-info";
    }

    return "audit-neutral";
  };

  /* =========================================
     MANUAL REFRESH
  ========================================= */

  const handleRefresh = () => {
    setLoading(true);
    setError("");

    const logsRef = ref(database, "AuditLogs");

    onValue(
      logsRef,
      (snapshot) => {
        const data = snapshot.val();

        const records = data
          ? Object.entries(data).map(([id, value]) => ({
              id,
              ...value,
            }))
          : [];

        setLogs(records);
        setLastUpdated(new Date());
        setLoading(false);
      },
      {
        onlyOnce: true,
      }
    );
  };

  /* =========================================
     CSV EXPORT
  ========================================= */

  const escapeCSV = (value) => {
    let text = String(value ?? "");

    if (/^[\s]*[=+\-@\t\r]/.test(text)) {
      text = "'" + text;
    }

    return `"${text.replace(/"/g, '""')}"`;
  };

  const handleExport = () => {
    if (filteredLogs.length === 0) {
      alert("No audit logs available to export.");
      return;
    }

    const headers = [
      "Log ID",
      "Date and Time",
      "User",
      "User ID",
      "Email",
      "Action",
      "Description",
      "Product",
      "Transaction ID",
    ];

    const rows = filteredLogs.map((log) => [
      log.id,
      formatDate(log.timestamp),
      log.userName || log.userFullName || log.user || "",
      log.userId || "",
      log.email || "",
      log.action || "",
      log.description || "",
      log.product || "",
      log.transactionId || "",
    ]);

    const csv = [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) =>
        row.map(escapeCSV).join(",")
      ),
    ].join("\n");

    const blob = new Blob(
      ["\uFEFF" + csv],
      {
        type: "text/csv;charset=utf-8;",
      }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `Audit_Logs_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  /* =========================================
     SUMMARY
  ========================================= */

  const stockInCount = logs.filter(
    (log) =>
      String(log.action || "").toUpperCase() === "STOCK IN"
  ).length;

  const stockOutCount = logs.filter(
    (log) =>
      String(log.action || "").toUpperCase() === "STOCK OUT"
  ).length;

  const uniqueUsers = new Set(
    logs
      .map((log) => log.userId || log.email || log.user)
      .filter(Boolean)
  ).size;

  /* =========================================
     PAGE
  ========================================= */

  return (
    <div className="audit-page">

      {/* HEADER */}

      <div className="audit-header">
        <div>
          <div className="audit-title">
            <div className="audit-title-icon">
              <ClipboardList size={25} />
            </div>

            <div>
              <h1>Audit Logs</h1>
              <p>
                Track and monitor activities in your inventory system.
              </p>
            </div>
          </div>
        </div>

        <div className="audit-header-actions">
          <button
            type="button"
            className="audit-refresh-btn"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw size={17} />
            Refresh
          </button>

          <button
            type="button"
            className="audit-export-btn"
            onClick={handleExport}
            disabled={filteredLogs.length === 0}
          >
            <Download size={17} />
            Export CSV
          </button>
        </div>
      </div>

      {/* SUMMARY CARDS */}

      <div className="audit-stats">

        <div className="audit-stat-card">
          <div className="audit-stat-icon">
            <ClipboardList size={22} />
          </div>

          <div>
            <span>Total Activities</span>
            <h2>{logs.length}</h2>
          </div>
        </div>

        <div className="audit-stat-card">
          <div className="audit-stat-icon">
            <Activity size={22} />
          </div>

          <div>
            <span>Stock In Activities</span>
            <h2>{stockInCount}</h2>
          </div>
        </div>

        <div className="audit-stat-card">
          <div className="audit-stat-icon">
            <Package size={22} />
          </div>

          <div>
            <span>Stock Out Activities</span>
            <h2>{stockOutCount}</h2>
          </div>
        </div>

        <div className="audit-stat-card">
          <div className="audit-stat-icon">
            <User size={22} />
          </div>

          <div>
            <span>Users Recorded</span>
            <h2>{uniqueUsers}</h2>
          </div>
        </div>

      </div>

      {/* FILTERS */}

      <div className="audit-filter-card">

        <div className="audit-search">
          <Search size={18} />

          <input
            type="text"
            placeholder="Search user, action, product, transaction..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />
        </div>

        <select
          className="audit-filter-select"
          value={actionFilter}
          onChange={(event) =>
            setActionFilter(event.target.value)
          }
        >
          <option value="ALL">All Activities</option>
          <option value="STOCK IN">Stock In</option>
          <option value="STOCK OUT">Stock Out</option>
          <option value="ARCHIVE">Archive</option>
          <option value="RESTORE">Restore</option>
          <option value="DELETE">Delete</option>
          <option value="LOGIN">Login</option>
          <option value="LOGOUT">Logout</option>
        </select>

        <button
          type="button"
          className="audit-reset-btn"
          onClick={() => {
            setSearch("");
            setActionFilter("ALL");
          }}
        >
          Reset
        </button>

      </div>

      {/* TABLE */}

      <div className="audit-table-card">

        <div className="audit-table-heading">
          <div>
            <h3>Activity History</h3>
            <p>Recorded system activities</p>
          </div>

          <span className="audit-record-count">
            {filteredLogs.length} Records
          </span>
        </div>

        {loading ? (
          <div className="audit-state">
            <RefreshCw size={25} />
            <p>Loading audit logs...</p>
          </div>
        ) : error ? (
          <div className="audit-state audit-error">
            <AlertCircle size={27} />
            <h3>Unable to load audit logs</h3>
            <p>{error}</p>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="audit-state">
            <FileText size={35} />
            <h3>No audit records found</h3>
            <p>
              {logs.length === 0
                ? "No activities have been recorded in Firebase yet."
                : "Try changing your search or activity filter."}
            </p>
          </div>
        ) : (
          <div className="audit-table-wrapper">
            <table className="audit-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Description</th>
                  <th>Product</th>
                  <th>Transaction ID</th>
                </tr>
              </thead>

              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <div className="audit-date">
                        <CalendarDays size={15} />
                        <span>
                          {formatDate(log.timestamp)}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="audit-user">
                        <strong>
                          {log.userName ||
                            log.userFullName ||
                            log.user ||
                            "Unknown User"}
                        </strong>

                        <small>
                          {log.email || log.userId || "No user ID"}
                        </small>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`audit-badge ${getActionClass(
                          log.action
                        )}`}
                      >
                        {log.action || "UNKNOWN"}
                      </span>
                    </td>

                    <td>
                      {log.description || "No description"}
                    </td>

                    <td>
                      {log.product || "-"}
                    </td>

                    <td>
                      {log.transactionId || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* FOOTER */}

      <div className="audit-footer">
        <span>
          Showing {filteredLogs.length} of {logs.length} records
        </span>

        <span>
          Last updated:{" "}
          {lastUpdated
            ? lastUpdated.toLocaleTimeString()
            : "Not yet updated"}
        </span>
      </div>

    </div>
  );
}

export default AuditLogs;
