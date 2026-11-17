
import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";

import {
  Download,
  FileText,
  Search,
  TrendingDown,
  TrendingUp,
  Archive,
  CalendarDays,
  Printer,
  RefreshCw,
  Filter,
  X,
  Package,
  AlertCircle,
} from "lucide-react";

import { database } from "../firebase";
import "../App.css";

const getStatus = (transaction) =>
  String(transaction.Status || "NO CHANGE").trim().toUpperCase();

const getTimestamp = (transaction) => {
  const value = transaction.Timestamp;

  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const numeric = Number(value);

  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric < 1000000000000
      ? numeric * 1000
      : numeric;
  }

  const parsed = new Date(value).getTime();

  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (timestamp) => {
  if (!timestamp) return "Not available";

  return new Date(timestamp).toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatNumber = (value, decimals = 2) => {
  return (Number(value) || 0).toLocaleString("en-PH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

function Reports() {
  const [transactions, setTransactions] = useState([]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [archiveFilter, setArchiveFilter] = useState("ACTIVE");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);

  // =========================================
  // FIREBASE REALTIME LISTENER
  // =========================================

  useEffect(() => {
    const transactionsRef = ref(database, "Transactions");
    const connectionRef = ref(database, ".info/connected");

    const unsubscribeConnection = onValue(
      connectionRef,
      (snapshot) => {
        setConnected(snapshot.val() === true);
      },
      () => setConnected(false)
    );

    const unsubscribeTransactions = onValue(
      transactionsRef,
      (snapshot) => {
        const data = snapshot.val();

        const records = data
          ? Object.entries(data).map(([id, transaction]) => ({
              id,
              ...(transaction || {}),
            }))
          : [];

        records.sort(
          (a, b) => getTimestamp(b) - getTimestamp(a)
        );

        setTransactions(records);
        setError("");
        setLoading(false);
      },
      (firebaseError) => {
        console.error("Reports Firebase error:", firebaseError);

        setError(
          firebaseError.code === "PERMISSION_DENIED"
            ? "Access denied. Check your Firebase database permissions."
            : "Unable to load reports. Please check your connection."
        );

        setLoading(false);
      }
    );

    return () => {
      unsubscribeConnection();
      unsubscribeTransactions();
    };
  }, []);

  // =========================================
  // FILTER TRANSACTIONS
  // =========================================

  const filteredTransactions = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return transactions.filter((transaction) => {
      const product = String(
        transaction.Product || "Unknown product"
      ).toLowerCase();

      const uid = String(
        transaction.UID || ""
      ).toLowerCase();

      const status = getStatus(transaction);

      const transactionId = String(
        transaction.id
      ).toLowerCase();

      const matchesSearch =
        !keyword ||
        product.includes(keyword) ||
        uid.includes(keyword) ||
        status.toLowerCase().includes(keyword) ||
        transactionId.includes(keyword);

      const matchesStatus =
        statusFilter === "ALL" ||
        status === statusFilter;

      const archived = transaction.Archived === true;

      const matchesArchive =
        archiveFilter === "ALL" ||
        (archiveFilter === "ACTIVE" && !archived) ||
        (archiveFilter === "ARCHIVED" && archived);

      const timestamp = getTimestamp(transaction);

      const matchesStartDate =
        !startDate ||
        (timestamp > 0 &&
          timestamp >= new Date(`${startDate}T00:00:00`).getTime());

      const matchesEndDate =
        !endDate ||
        (timestamp > 0 &&
          timestamp <= new Date(`${endDate}T23:59:59.999`).getTime());

      return (
        matchesSearch &&
        matchesStatus &&
        matchesArchive &&
        matchesStartDate &&
        matchesEndDate
      );
    });
  }, [
    transactions,
    search,
    statusFilter,
    archiveFilter,
    startDate,
    endDate,
  ]);

  // =========================================
  // REPORT STATISTICS
  // =========================================

  const stockInCount = filteredTransactions.filter(
    (item) => getStatus(item) === "STOCK IN"
  ).length;

  const stockOutCount = filteredTransactions.filter(
    (item) => getStatus(item) === "STOCK OUT"
  ).length;

  const archivedCount = filteredTransactions.filter(
    (item) => item.Archived === true
  ).length;

  // =========================================
  // RESET FILTERS
  // =========================================

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("ALL");
    setArchiveFilter("ACTIVE");
    setStartDate("");
    setEndDate("");
  };

  // =========================================
  // CSV EXPORT
  // =========================================

  const exportCSV = () => {
    if (filteredTransactions.length === 0) {
      window.alert("There are no transaction records to export.");
      return;
    }

    const headings = [
      "Transaction ID",
      "Product",
      "RFID UID",
      "Weight (kg)",
      "Quantity",
      "Unit",
      "Status",
      "Final Stock",
      "Archive Status",
      "Device Timestamp",
    ];

    const escapeCSV = (value) => {
      let text = String(value ?? "");

      // Prevent spreadsheet formula injection.
      if (/^[\s]*[=+\-@]/.test(text)) {
        text = `'${text}`;
      }

      return `"${text.replace(/"/g, '""')}"`;
    };

    const rows = filteredTransactions.map((transaction) => [
      transaction.id,
      transaction.Product || "Unknown product",
      transaction.UID || "",
      formatNumber(transaction.Weight),
      formatNumber(transaction.Quantity),
      transaction.Unit || "",
      getStatus(transaction),
      transaction.FinalQuantity ?? "",
      transaction.Archived ? "Archived" : "Active",
      formatDate(getTimestamp(transaction)),
    ]);

    const csvContent = [
      headings,
      ...rows,
    ]
      .map((row) => row.map(escapeCSV).join(","))
      .join("\r\n");

    // UTF-8 BOM for Excel compatibility.
    const blob = new Blob(
      ["\uFEFF", csvContent],
      { type: "text/csv;charset=utf-8;" }
    );

    const downloadURL = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = downloadURL;
    link.download = `inventory-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(downloadURL), 1000);
  };

  // =========================================
  // PRINT REPORT
  // =========================================

  const printReport = () => {
    if (filteredTransactions.length === 0) {
      window.alert("There are no records to print.");
      return;
    }

    window.print();
  };

  // =========================================
  // STATUS BADGES
  // =========================================

  const getStatusClass = (status) => {
    switch (getStatus({ Status: status })) {
      case "STOCK IN":
        return "status stock-in";

      case "STOCK OUT":
        return "status stock-out";

      default:
        return "status no-change";
    }
  };

  // =========================================
  // MAIN INTERFACE
  // =========================================

  return (
    <main className="reports-page">

      {/* PAGE HEADER */}

      <header className="page-header reports-page-header">
        <div>
          <span className="reports-eyebrow">
            INVENTORY MANAGEMENT
          </span>

          <h2>Inventory Reports</h2>

          <p>
            Monitor, analyze, and export your inventory
            transaction records.
          </p>
        </div>

        <div className="reports-header-actions">
          <span
            className={`reports-connection ${
              connected ? "online" : "offline"
            }`}
          >
            <span />
            {connected ? "Live Connection" : "Offline"}
          </span>

          <button
            type="button"
            className="export-button"
            onClick={exportCSV}
            disabled={loading || filteredTransactions.length === 0}
          >
            <Download size={17} />
            Export CSV
          </button>

          <button
            type="button"
            className="reports-print-button"
            onClick={printReport}
            disabled={loading || filteredTransactions.length === 0}
          >
            <Printer size={17} />
            Print
          </button>
        </div>
      </header>

      {/* ERROR MESSAGE */}

      {error && (
        <div className="reports-error" role="alert">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {/* SUMMARY CARDS */}

      <section className="summary-grid reports-summary">

        <ReportCard
          title="Total Records"
          value={loading ? "..." : filteredTransactions.length}
          description="Matching transactions"
          icon={<FileText size={23} />}
          type="total"
        />

        <ReportCard
          title="Stock In"
          value={loading ? "..." : stockInCount}
          description="Recorded additions"
          icon={<TrendingUp size={23} />}
          type="stock-in"
        />

        <ReportCard
          title="Stock Out"
          value={loading ? "..." : stockOutCount}
          description="Recorded deductions"
          icon={<TrendingDown size={23} />}
          type="stock-out"
        />

        <ReportCard
          title="Archived"
          value={loading ? "..." : archivedCount}
          description="Archived records in results"
          icon={<Archive size={23} />}
          type="archived"
        />

      </section>

      {/* REPORT TABLE */}

      <section className="panel reports-panel">

        {/* TABLE HEADER */}

        <div className="panel-header reports-filter-header">

          <div>
            <h3>Transaction Report</h3>

            <p>
              Search and filter inventory activities
              before exporting.
            </p>
          </div>

          <span className="reports-result-count">
            {filteredTransactions.length} records
          </span>

        </div>

        {/* FILTER SECTION */}

        <div className="reports-filter-section">

          {/* SEARCH */}

          <div className="reports-search-box">
            <Search size={18} />

            <input
              type="search"
              placeholder="Search product, RFID, or ID..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* STATUS FILTER */}

          <div className="reports-select-control">
            <Filter size={16} />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
              aria-label="Filter by status"
            >
              <option value="ALL">All Statuses</option>
              <option value="STOCK IN">Stock In</option>
              <option value="STOCK OUT">Stock Out</option>
              <option value="NO CHANGE">No Change</option>
            </select>
          </div>

          {/* ARCHIVE FILTER */}

          <div className="reports-select-control">
            <Archive size={16} />

            <select
              value={archiveFilter}
              onChange={(event) =>
                setArchiveFilter(event.target.value)
              }
              aria-label="Filter archive status"
            >
              <option value="ACTIVE">Active Records</option>
              <option value="ARCHIVED">Archived Records</option>
              <option value="ALL">All Records</option>
            </select>
          </div>

          {/* DATE FILTERS */}

          <div className="reports-date-control">
            <CalendarDays size={16} />

            <input
              type="date"
              aria-label="Start date"
              value={startDate}
              max={endDate || undefined}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>

          <div className="reports-date-control">
            <CalendarDays size={16} />

            <input
              type="date"
              aria-label="End date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>

          {/* RESET */}

          <button
            type="button"
            className="reports-reset-button"
            onClick={resetFilters}
          >
            <RefreshCw size={15} />
            Reset
          </button>

        </div>

        {/* RESULTS INFORMATION */}

        <div className="reports-results-info">
          <span>
            Showing <strong>{filteredTransactions.length}</strong> of{" "}
            <strong>{transactions.length}</strong> transactions
          </span>

          <span>
            {archiveFilter === "ACTIVE"
              ? "Active records"
              : archiveFilter === "ARCHIVED"
                ? "Archived records"
                : "All records"}
          </span>
        </div>

        {/* TRANSACTION TABLE */}

        <div className="table-wrapper reports-table-wrapper">

          <table className="reports-table">

            <thead>
              <tr>
                <th>Product</th>
                <th>RFID UID</th>
                <th>Weight</th>
                <th>Quantity</th>
                <th>Final Stock</th>
                <th>Status</th>
                <th>Date & Time</th>
                <th>Record</th>
              </tr>
            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td colSpan="8" className="empty-state">
                    <RefreshCw className="reports-spin" size={20} />
                    <span>Loading transaction records...</span>
                  </td>
                </tr>
              ) : error && transactions.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state">
                    Unable to load transaction records.
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty-state">
                    <Package size={25} />
                    <strong>No matching transactions</strong>
                    <span>
                      Try changing your search or filters.
                    </span>
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => {
                  const status = getStatus(transaction);
                  const timestamp = getTimestamp(transaction);

                  return (
                    <tr key={transaction.id}>

                      <td>
                        <div className="reports-product-cell">
                          <strong>
                            {transaction.Product || "Unknown product"}
                          </strong>

                          <small>
                            ID: {transaction.id}
                          </small>
                        </div>
                      </td>

                      <td className="reports-uid">
                        {transaction.UID || "Not available"}
                      </td>

                      <td>
                        {formatNumber(transaction.Weight)} kg
                      </td>

                      <td>
                        <strong>
                          {formatNumber(
                            transaction.Quantity,
                            transaction.Unit === "kg" ? 2 : 0
                          )}
                        </strong>{" "}
                        {transaction.Unit || ""}
                      </td>

                      <td>
                        {transaction.FinalQuantity !== undefined &&
                        transaction.FinalQuantity !== null
                          ? formatNumber(transaction.FinalQuantity)
                          : "—"}
                      </td>

                      <td>
                        <span className={getStatusClass(status)}>
                          {status}
                        </span>
                      </td>

                      <td>
                        <div className="reports-date-cell">
                          <strong>{formatDate(timestamp)}</strong>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`reports-record-badge ${
                            transaction.Archived
                              ? "archived"
                              : "active"
                          }`}
                        >
                          {transaction.Archived
                            ? "Archived"
                            : "Active"}
                        </span>
                      </td>

                    </tr>
                  );
                })
              )}

            </tbody>

          </table>

        </div>

        {/* FOOTER */}

        <footer className="reports-footer">
          <span>
            Report generated from Firebase transaction records.
          </span>

          <span>
            {connected
              ? "Realtime synchronization active"
              : "Waiting for connection"}
          </span>
        </footer>

      </section>

    </main>
  );
}

// =========================================
// REPORT SUMMARY CARD
// =========================================

function ReportCard({
  title,
  value,
  description,
  icon,
  type,
}) {
  return (
    <article className={`summary-card reports-card ${type}`}>
      <div className="reports-card-content">
        <p>{title}</p>
        <h3>{value}</h3>
        <small>{description}</small>
      </div>

      <div className={`summary-icon reports-icon ${type}`}>
        {icon}
      </div>
    </article>
  );
}

export default Reports;
