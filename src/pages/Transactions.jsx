
import { useEffect, useMemo, useState } from "react";

import {
  onValue,
  ref,
  get,
  update,
  remove,
  serverTimestamp,
} from "firebase/database";

import { onAuthStateChanged } from "firebase/auth";

import {
  Activity,
  ArrowDownRight,
  ArrowDownUp,
  ArrowUpRight,
  Archive,
  ArchiveRestore,
  AlertCircle,
  CalendarDays,
  ChartColumn,
  CheckCircle,
  Filter,
  History,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { auth, database } from "../firebase";
import { writeAuditLog } from "../utils/auditLog";
import "../App.css";

// =========================================================
// HELPER FUNCTIONS
// =========================================================

const getTransactionStatus = (transaction) => {
  return String(transaction.Status || "").toUpperCase();
};

const getQuantity = (transaction) => {
  return Math.abs(
    Number(
      transaction.Quantity ??
      transaction.ChangeAmount ??
      0
    ) || 0
  );
};

const getTimestamp = (transaction) => {
  const value = Number(transaction.Timestamp);

  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return value < 1000000000000
    ? value * 1000
    : value;
};

const formatNumber = (value) => {
  return (Number(value) || 0).toLocaleString("en-PH", {
    maximumFractionDigits: 2,
  });
};

const formatDate = (timestamp) => {
  if (!timestamp) return "Date unavailable";

  return new Date(timestamp).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatShortDate = (timestamp) => {
  return new Date(timestamp).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
  });
};

// Audit logging is secondary to the completed transaction operation.
// A logging failure must not undo or misreport a successful transaction change.
const recordTransactionAudit = async (entry) => {
  try {
    await writeAuditLog(entry);
  } catch (auditError) {
    console.error("Transaction succeeded, but audit logging failed:", auditError);
  }
};

// =========================================================
// MAIN COMPONENT
// =========================================================

function Transactions() {
  // TRANSACTION DATA

  const [transactions, setTransactions] = useState([]);

  // USER ROLE

  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);

  // SEARCH AND FILTER

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [archiveView, setArchiveView] = useState(false);

  // LOADING AND CONNECTION

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  // NOTIFICATIONS

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // =======================================================
  // AUTHENTICATION AND ADMIN VERIFICATION
  // =======================================================

  useEffect(() => {
    let active = true;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        if (!currentUser) {
          if (active) {
            setIsAdmin(false);
            setCheckingRole(false);
          }

          return;
        }

        try {
          const snapshot = await get(
            ref(database, `Users/${currentUser.uid}`)
          );

          const profile = snapshot.val();

          if (active) {
            setIsAdmin(
              profile?.role === "admin" &&
              profile?.status === "active"
            );

            setCheckingRole(false);
          }
        } catch (authError) {
          console.error(
            "Admin verification error:",
            authError
          );

          if (active) {
            setIsAdmin(false);
            setCheckingRole(false);
          }
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // =======================================================
  // FIREBASE CONNECTION AND TRANSACTION LISTENER
  // =======================================================

  useEffect(() => {
    const transactionsRef = ref(database, "Transactions");
    const connectionRef = ref(database, ".info/connected");

    const unsubscribeConnection = onValue(
      connectionRef,
      (snapshot) => {
        setConnected(snapshot.val() === true);
      },
      (firebaseError) => {
        console.error(
          "Firebase connection error:",
          firebaseError
        );

        setConnected(false);
      }
    );

    const unsubscribeTransactions = onValue(
      transactionsRef,
      (snapshot) => {
        const data = snapshot.val();

        const records = data
          ? Object.entries(data).map(([id, item]) => ({
              id,
              ...(item || {}),
            }))
          : [];

        records.sort(
          (a, b) =>
            getTimestamp(b) - getTimestamp(a)
        );

        setTransactions(records);
        setError("");
        setLoading(false);
      },
      (firebaseError) => {
        console.error(
          "Transaction loading error:",
          firebaseError
        );

        setError(
          firebaseError.code === "PERMISSION_DENIED"
            ? "Access denied. You do not have permission to view transactions."
            : "Unable to retrieve transactions. Check your Firebase connection."
        );

        setLoading(false);
      }
    );

    return () => {
      unsubscribeConnection();
      unsubscribeTransactions();
    };
  }, []);

  // =======================================================
  // ACTIVE AND ARCHIVED TRANSACTIONS
  // =======================================================

  const activeTransactions = useMemo(
    () =>
      transactions.filter(
        (item) => item.Archived !== true
      ),
    [transactions]
  );

  const archivedTransactions = useMemo(
    () =>
      transactions.filter(
        (item) => item.Archived === true
      ),
    [transactions]
  );

  const currentSource = archiveView
    ? archivedTransactions
    : activeTransactions;

  // =======================================================
  // TRANSACTION STATISTICS
  // =======================================================

  const stockInTransactions = useMemo(
    () =>
      activeTransactions.filter(
        (item) =>
          getTransactionStatus(item) === "STOCK IN"
      ),
    [activeTransactions]
  );

  const stockOutTransactions = useMemo(
    () =>
      activeTransactions.filter(
        (item) =>
          getTransactionStatus(item) === "STOCK OUT"
      ),
    [activeTransactions]
  );

  const productsAffected = useMemo(
    () =>
      new Set(
        activeTransactions
          .map((item) =>
            String(item.Product || "").trim().toLowerCase()
          )
          .filter(Boolean)
      ).size,
    [activeTransactions]
  );

  // =======================================================
  // SEARCH, FILTER AND SORT
  // =======================================================

  const filteredTransactions = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const records = currentSource.filter((item) => {
      const product = String(
        item.Product || ""
      ).toLowerCase();

      const uid = String(
        item.UID || ""
      ).toLowerCase();

      const matchesSearch =
        product.includes(keyword) ||
        uid.includes(keyword);

      const status = getTransactionStatus(item);

      const matchesFilter =
        filter === "all" ||
        (filter === "in" && status === "STOCK IN") ||
        (filter === "out" && status === "STOCK OUT");

      return matchesSearch && matchesFilter;
    });

    return [...records].sort((a, b) => {
      const difference =
        getTimestamp(a) - getTimestamp(b);

      return sortOrder === "newest"
        ? -difference
        : difference;
    });
  }, [
    currentSource,
    search,
    filter,
    sortOrder,
  ]);

  // Selection follows the currently visible, filtered transaction list.
  const visibleIds = filteredTransactions.map((item) => item.id);
  const visibleSelectedCount = visibleIds.filter((id) => selectedIds.includes(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length;
  const selectedTransactions = filteredTransactions.filter((item) => selectedIds.includes(item.id));

  const toggleSelection = (id) => {
    setSelectedIds((previous) => previous.includes(id)
      ? previous.filter((item) => item !== id)
      : [...previous, id]);
  };

  const toggleSelectAll = () => {
    setSelectedIds((previous) => allVisibleSelected
      ? previous.filter((id) => !visibleIds.includes(id))
      : [...new Set([...previous, ...visibleIds])]);
  };

  // =======================================================
  // STOCK MOVEMENT CHART
  // =======================================================

  const historyData = useMemo(() => {
    const grouped = {};

    activeTransactions.forEach((item) => {
      const timestamp = getTimestamp(item);

      if (!timestamp) return;

      const date = new Date(timestamp);

      const key = [
        date.getFullYear(),
        date.getMonth() + 1,
        date.getDate(),
      ].join("-");

      if (!grouped[key]) {
        grouped[key] = {
          date: key,
          timestamp: new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate()
          ).getTime(),
          stockIn: 0,
          stockOut: 0,
        };
      }

      const status = getTransactionStatus(item);

      if (status === "STOCK IN") {
        grouped[key].stockIn += 1;
      }

      if (status === "STOCK OUT") {
        grouped[key].stockOut += 1;
      }
    });

    return Object.values(grouped)
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(-14)
      .map((item) => ({
        ...item,
        label: formatShortDate(item.timestamp),
      }));
  }, [activeTransactions]);

  // =======================================================
  // FILTER COUNTS
  // =======================================================

  const filters = [
    {
      id: "all",
      label: "All Transactions",
      count: currentSource.length,
    },
    {
      id: "in",
      label: "Stock In",
      count: currentSource.filter(
        (item) =>
          getTransactionStatus(item) === "STOCK IN"
      ).length,
    },
    {
      id: "out",
      label: "Stock Out",
      count: currentSource.filter(
        (item) =>
          getTransactionStatus(item) === "STOCK OUT"
      ).length,
    },
  ];

  // =======================================================
  // VERIFY ADMIN BEFORE MANAGEMENT ACTIONS
  // =======================================================

  const verifyAdminAction = async () => {
    const currentUser = auth.currentUser;

    if (!currentUser) {
      throw new Error(
        "Your session has expired. Please log in again."
      );
    }

    const snapshot = await get(
      ref(database, `Users/${currentUser.uid}`)
    );

    const profile = snapshot.val();

    if (
      profile?.role !== "admin" ||
      profile?.status !== "active"
    ) {
      throw new Error(
        "Only an active Admin can manage transactions."
      );
    }

    return currentUser;
  };

  // =======================================================
  // ARCHIVE TRANSACTION
  // =======================================================

  const archiveTransaction = async (transaction) => {
    if (!isAdmin || actionLoading) return;

    const confirmed = window.confirm(
      `Are you sure you want to archive this transaction?\n\nProduct: ${
        transaction.Product || "Unknown product"
      }\n\nThe original transaction details will be preserved.`
    );

    if (!confirmed) return;

    setActionLoading(transaction.id);
    setError("");
    setSuccess("");

    try {
      const admin = await verifyAdminAction();

      // Firebase generates the timestamp.
      // No Date.now() is used.

      await update(
        ref(database, `Transactions/${transaction.id}`),
        {
          Archived: true,
          ArchivedAt: serverTimestamp(),
          ArchivedBy: admin.uid,
        }
      );

      await recordTransactionAudit({
        action: "TRANSACTION_ARCHIVED",
        category: "Transactions",
        details: `Archived transaction for ${transaction.Product || "Unknown product"}`,
        targetId: transaction.id,
      });

      setSuccess(
        "Transaction archived successfully."
      );

    } catch (actionError) {
      console.error("Archive error:", actionError);

      setError(
        actionError.message ||
        "Unable to archive transaction."
      );
    } finally {
      setActionLoading("");
    }
  };

  // =======================================================
  // RESTORE TRANSACTION
  // =======================================================

  const restoreTransaction = async (transaction) => {
    if (!isAdmin || actionLoading) return;

    const confirmed = window.confirm(
      `Restore this transaction?\n\nProduct: ${
        transaction.Product || "Unknown product"
      }`
    );

    if (!confirmed) return;

    setActionLoading(transaction.id);
    setError("");
    setSuccess("");

    try {
      await verifyAdminAction();

      await update(
        ref(database, `Transactions/${transaction.id}`),
        {
          Archived: false,
          ArchivedAt: null,
          ArchivedBy: null,
        }
      );

      await recordTransactionAudit({
        action: "TRANSACTION_RESTORED",
        category: "Transactions",
        details: `Restored transaction for ${transaction.Product || "Unknown product"}`,
        targetId: transaction.id,
      });

      setSuccess(
        "Transaction restored successfully."
      );

    } catch (actionError) {
      console.error("Restore error:", actionError);

      setError(
        actionError.message ||
        "Unable to restore transaction."
      );
    } finally {
      setActionLoading("");
    }
  };

  // =======================================================
  // PERMANENT DELETE TRANSACTION
  // =======================================================

  const deleteTransaction = async (transaction) => {
    if (!isAdmin || actionLoading) return;

    const confirmed = window.confirm(
      `WARNING: PERMANENT DELETION\n\nProduct: ${
        transaction.Product || "Unknown product"
      }\nTransaction ID: ${transaction.id}\n\nThis record will be permanently removed from Firebase and cannot be restored.\n\nAre you sure?`
    );

    if (!confirmed) return;

    setActionLoading(transaction.id);
    setError("");
    setSuccess("");

    try {
      await verifyAdminAction();

      await remove(
        ref(database, `Transactions/${transaction.id}`)
      );

      await recordTransactionAudit({
        action: "TRANSACTION_DELETED",
        category: "Transactions",
        details: `Permanently deleted transaction for ${transaction.Product || "Unknown product"}`,
        targetId: transaction.id,
      });

      setSuccess(
        "Transaction permanently deleted."
      );

    } catch (actionError) {
      console.error("Delete error:", actionError);

      setError(
        actionError.message ||
        "Unable to delete transaction."
      );
    } finally {
      setActionLoading("");
    }
  };

  // Bulk operations are performed as one multi-path Firebase update.
  // Deleting history does NOT reverse stock movements or change inventory totals.
  const bulkAction = async (action) => {
    if (!isAdmin || actionLoading || selectedTransactions.length === 0) return;
    const count = selectedTransactions.length;
    const verb = action === "delete" ? "permanently delete" : action === "restore" ? "restore" : "archive";
    const message = action === "delete"
      ? `Permanently delete ${count} selected transaction(s)?\n\nThis cannot be undone. Inventory quantities will NOT be recalculated.`
      : `${verb[0].toUpperCase() + verb.slice(1)} ${count} selected transaction(s)?`;
    if (!window.confirm(message)) return;

    setActionLoading("bulk");
    setError("");
    setSuccess("");
    try {
      const admin = await verifyAdminAction();
      const updates = {};
      for (const item of selectedTransactions) {
        const path = `Transactions/${item.id}`;
        if (action === "delete") {
          updates[path] = null;
        } else if (action === "archive") {
          updates[`${path}/Archived`] = true;
          updates[`${path}/ArchivedAt`] = serverTimestamp();
          updates[`${path}/ArchivedBy`] = admin.uid;
        } else {
          updates[`${path}/Archived`] = false;
          updates[`${path}/ArchivedAt`] = null;
          updates[`${path}/ArchivedBy`] = null;
        }
      }
      await update(ref(database), updates);

      const auditAction =
        action === "delete"
          ? "TRANSACTION_DELETED"
          : action === "restore"
            ? "TRANSACTION_RESTORED"
            : "TRANSACTION_ARCHIVED";

      await Promise.all(
        selectedTransactions.map((item) =>
          recordTransactionAudit({
            action: auditAction,
            category: "Transactions",
            details: `${action === "delete" ? "Permanently deleted" : action === "restore" ? "Restored" : "Archived"} transaction for ${item.Product || "Unknown product"} (bulk action)`,
            targetId: item.id,
          })
        )
      );

      setSelectedIds((previous) => previous.filter((id) => !selectedTransactions.some((item) => item.id === id)));
      setSuccess(`${count} transaction(s) ${action === "delete" ? "permanently deleted" : action === "restore" ? "restored" : "archived"}.`);
    } catch (actionError) {
      console.error("Bulk transaction action error:", actionError);
      setError(actionError.message || `Unable to ${verb} selected transactions.`);
    } finally {
      setActionLoading("");
    }
  };

  // =======================================================
  // SWITCH ACTIVE / ARCHIVED VIEW
  // =======================================================

  const switchArchiveView = (archived) => {
    setArchiveView(archived);
    setSelectedIds([]);
    setFilter("all");
    setSearch("");
    setError("");
    setSuccess("");
  };

  // =======================================================
  // MAIN INTERFACE
  // =======================================================

  return (
    <main className="transactions-page">

      {/* PAGE HEADER */}

      <header className="transactions-heading">

        <div>
          <span className="transactions-eyebrow">
            INVENTORY ACTIVITY
          </span>

          <h2>Transaction History</h2>

          <p>
            Monitor and manage recorded Stock In and
            Stock Out activities.
          </p>
        </div>

        <div
          className={`transactions-connection ${
            connected ? "online" : "offline"
          }`}
        >
          {connected ? (
            <Wifi size={16} />
          ) : (
            <WifiOff size={16} />
          )}

          <span>
            {connected ? "Live Connection" : "Offline"}
          </span>

          <span className="transactions-connection-dot" />

        </div>

      </header>

      {/* ERROR MESSAGE */}

      {error && (
        <div className="transactions-error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* SUCCESS MESSAGE */}

      {success && (
        <div className="transactions-success" role="status">
          <CheckCircle size={18} />
          <span>{success}</span>
        </div>
      )}

      {/* SUMMARY CARDS */}

      <section className="transactions-summary-grid">

        <SummaryCard
          title="Active Transactions"
          value={
            loading
              ? "..."
              : formatNumber(activeTransactions.length)
          }
          description="Current transaction records"
          icon={<History size={21} />}
          type="total"
        />

        <SummaryCard
          title="Stock In"
          value={
            loading
              ? "..."
              : formatNumber(stockInTransactions.length)
          }
          description="Recorded stock additions"
          icon={<ArrowUpRight size={21} />}
          type="stock-in"
        />

        <SummaryCard
          title="Stock Out"
          value={
            loading
              ? "..."
              : formatNumber(stockOutTransactions.length)
          }
          description="Recorded stock deductions"
          icon={<ArrowDownRight size={21} />}
          type="stock-out"
        />

        <SummaryCard
          title="Products Affected"
          value={
            loading
              ? "..."
              : formatNumber(productsAffected)
          }
          description="Distinct products in active history"
          icon={<Package size={21} />}
          type="quantity"
        />

      </section>

      {/* STOCK MOVEMENT CHART */}

      <section className="transactions-chart-card">

        <div className="transactions-card-heading">

          <div className="transactions-card-title-icon">
            <ChartColumn size={20} />
          </div>

          <div className="transactions-card-heading-text">

            <h3>Stock Movement Activity</h3>

            <p>
              Number of Stock In and Stock Out transactions
              over the latest 14 active transaction dates.
            </p>

          </div>

          <span className="transactions-chart-badge">
            <span />
            Live Data
          </span>

        </div>

        <div className="transactions-chart">

          {loading ? (
            <div className="transactions-empty">
              <RefreshCw
                size={22}
                className="transactions-spin"
              />

              <strong>Loading chart...</strong>
            </div>

          ) : error ? (
            <div className="transactions-empty">
              <Activity size={24} />

              <strong>Chart data unavailable</strong>
            </div>

          ) : historyData.length === 0 ? (
            <div className="transactions-empty">
              <ChartColumn size={25} />

              <strong>No transaction data available</strong>

              <span>
                Recorded stock movements will appear here.
              </span>
            </div>

          ) : (
            <ResponsiveContainer width="100%" height="100%">

              <BarChart
                data={historyData}
                margin={{
                  top: 15,
                  right: 15,
                  left: -12,
                  bottom: 5,
                }}
                barGap={4}
              >

                <CartesianGrid
                  stroke="#edf2f7"
                  strokeDasharray="4 4"
                  vertical={false}
                />

                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fontSize: 10,
                    fill: "#94a3b8",
                  }}
                />

                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fontSize: 10,
                    fill: "#94a3b8",
                  }}
                />

                <Tooltip
                  content={<TransactionTooltip />}
                  cursor={{
                    fill: "#f8fafc",
                  }}
                />

                <Legend
                  verticalAlign="top"
                  align="right"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{
                    fontSize: "11px",
                    paddingBottom: "16px",
                  }}
                />

                <Bar
                  dataKey="stockIn"
                  name="Stock In"
                  fill="#16a34a"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />

                <Bar
                  dataKey="stockOut"
                  name="Stock Out"
                  fill="#e11d48"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />

              </BarChart>

            </ResponsiveContainer>
          )}

        </div>

      </section>

      {/* TRANSACTION HISTORY */}

      <section className="transactions-history-card">

        {/* HEADER */}

        <div className="transactions-history-heading">

          <div>
            <h3>
              {archiveView
                ? "Archived Transactions"
                : "Complete History"}
            </h3>

            <p>
              {archiveView
                ? "View and restore previously archived records."
                : "View and manage recorded inventory movements."}
            </p>
          </div>

          <span className="transactions-record-count">
            {filteredTransactions.length} records
          </span>

        </div>

        {/* ACTIVE AND ARCHIVED TABS */}

        <div className="transaction-management-tabs">

          <button
            type="button"
            className={!archiveView ? "active" : ""}
            onClick={() => switchArchiveView(false)}
          >
            <History size={16} />

            Active Transactions

            <span>
              {activeTransactions.length}
            </span>
          </button>

          <button
            type="button"
            className={archiveView ? "active" : ""}
            onClick={() => switchArchiveView(true)}
          >
            <Archive size={16} />

            Archived Transactions

            <span>
              {archivedTransactions.length}
            </span>
          </button>

        </div>

        {/* ADMIN NOTICE */}

        {!checkingRole && isAdmin && (
          <div className="transactions-admin-notice">
            <ShieldCheck size={16} />

            <span>
              
            </span>
          </div>
        )}

        {/* SEARCH AND SORT */}

        <div className="transactions-controls">

          <div className="transactions-search">

            <Search size={17} />

            <input
              type="search"
              placeholder="Search product or RFID UID..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
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

          <div className="transactions-sort">

            <ArrowDownUp size={16} />

            <select
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value)
              }
              aria-label="Sort transactions"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>

          </div>

        </div>

        {/* FILTERS */}

        <div className="transactions-filters">

          <Filter size={15} />

          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              className={
                filter === item.id ? "active" : ""
              }
              onClick={() => setFilter(item.id)}
            >
              {item.label}

              <span>{item.count}</span>
            </button>
          ))}

        </div>

        {/* BULK SELECTION AND ACTIONS */}
        {isAdmin && (
          <div className="transactions-bulk-toolbar">
            <label className="transactions-select-all">
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleSelectAll}
                disabled={Boolean(actionLoading) || visibleIds.length === 0}
                aria-label="Select all visible transactions"
              />
              <span>Select All Visible ({visibleSelectedCount}/{visibleIds.length})</span>
            </label>
            <span className="transactions-selection-hint">
              To select more, tick the checkbox beside each transaction.
            </span>
            <div className="transactions-bulk-actions">
              {selectedTransactions.length > 0 && (
                <>
                  <button type="button" disabled={Boolean(actionLoading)} onClick={() => setSelectedIds([])}>Clear Selection</button>
                  <button type="button" disabled={Boolean(actionLoading)} onClick={() => bulkAction(archiveView ? "restore" : "archive")}>
                    {archiveView ? <ArchiveRestore size={16} /> : <Archive size={16} />}
                    {archiveView ? "Restore" : "Archive"} Selected ({selectedTransactions.length})
                  </button>
                  <button type="button" className="delete-action" disabled={Boolean(actionLoading)} onClick={() => bulkAction("delete")}>
                    <Trash2 size={16} /> Delete Selected ({selectedTransactions.length})
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* TRANSACTION RECORDS */}

        <div className="transactions-list">

          {loading || checkingRole ? (
            <div className="transactions-empty">
              <RefreshCw
                size={22}
                className="transactions-spin"
              />

              <strong>Loading transactions...</strong>
            </div>

          ) : error && transactions.length === 0 ? (
            <div className="transactions-empty">
              <Activity size={24} />

              <strong>
                Unable to retrieve transactions
              </strong>

              <span>
                Check Firebase permissions and connection.
              </span>
            </div>

          ) : filteredTransactions.length === 0 ? (
            <div className="transactions-empty">

              {archiveView ? (
                <Archive size={25} />
              ) : (
                <History size={25} />
              )}

              <strong>
                {archiveView
                  ? "No archived transactions"
                  : transactions.length === 0
                    ? "No transactions recorded"
                    : "No matching transactions"}
              </strong>

              <span>
                {archiveView
                  ? "Archived records will appear here."
                  : "Try another search term or filter."}
              </span>

            </div>

          ) : (
            filteredTransactions.map((transaction) => {
              const status =
                getTransactionStatus(transaction);

              const isStockIn = status === "STOCK IN";
              const isStockOut = status === "STOCK OUT";

              const busy =
                actionLoading === transaction.id;

              return (
                <article
                  className={`transactions-record ${selectedIds.includes(transaction.id) ? "is-selected" : ""}`}
                  key={transaction.id}
                >

                  {isAdmin && (
                    <label className="transactions-record-select" title="Select transaction">
                      <input type="checkbox" checked={selectedIds.includes(transaction.id)}
                        onChange={() => toggleSelection(transaction.id)} disabled={Boolean(actionLoading)}
                        aria-label={`Select transaction ${transaction.id}`} />
                    </label>
                  )}

                  {/* TRANSACTION ICON */}

                  <div
                    className={`transactions-record-icon ${
                      isStockIn
                        ? "stock-in"
                        : isStockOut
                          ? "stock-out"
                          : ""
                    }`}
                  >
                    {isStockIn ? (
                      <TrendingUp size={19} />
                    ) : isStockOut ? (
                      <TrendingDown size={19} />
                    ) : (
                      <Activity size={19} />
                    )}
                  </div>

                  {/* PRODUCT INFORMATION */}

                  <div className="transactions-product">

                    <strong>
                      {transaction.Product || "Unknown product"}
                    </strong>

                    <span>
                      RFID: {transaction.UID || "Not available"}
                    </span>

                    <small>
                      ID: {transaction.id}
                    </small>

                  </div>

                  {/* TRANSACTION TYPE */}

                  <div className="transactions-record-status">

                    <span
                      className={`transactions-type ${
                        isStockIn
                          ? "stock-in"
                          : isStockOut
                            ? "stock-out"
                            : ""
                      }`}
                    >
                      {status || "NO CHANGE"}
                    </span>

                    {archiveView && (
                      <span className="transactions-archived-label">
                        ARCHIVED
                      </span>
                    )}

                  </div>

                  {/* QUANTITY */}

                  <div className="transactions-record-quantity">

                    <span>Quantity Moved</span>

                    <strong
                      className={
                        isStockIn
                          ? "positive"
                          : isStockOut
                            ? "negative"
                            : ""
                      }
                    >
                      {isStockIn
                        ? "+"
                        : isStockOut
                          ? "−"
                          : ""}

                      {formatNumber(getQuantity(transaction))}{" "}
                      {transaction.Unit || ""}
                    </strong>

                  </div>

                  {/* FINAL STOCK */}

                  <div className="transactions-record-final">

                    <span>Final Stock</span>

                    <strong>
                      {transaction.FinalQuantity !== undefined &&
                      transaction.FinalQuantity !== null
                        ? formatNumber(
                            transaction.FinalQuantity
                          )
                        : "—"}
                    </strong>

                  </div>

                  {/* DATE */}

                  <div className="transactions-record-date">

                    <span>
                      <CalendarDays size={13} />

                      {formatDate(
                        getTimestamp(transaction)
                      )}
                    </span>

                    {archiveView &&
                      transaction.ArchivedAt && (
                        <small>
                          Archived:{" "}
                          {formatDate(
                            Number(transaction.ArchivedAt)
                          )}
                        </small>
                      )}

                  </div>

                  {/* ADMIN ACTIONS */}

                  {isAdmin && (
                    <div className="transactions-record-actions transactions-actions-right">

                      {busy ? (
                        <RefreshCw
                          size={18}
                          className="transactions-spin"
                        />
                      ) : (
                        <>
                          {!archiveView ? (
                            <button
                              type="button"
                              title="Archive transaction"
                              onClick={() =>
                                archiveTransaction(transaction)
                              }
                              disabled={Boolean(actionLoading)}
                            >
                              <Archive size={16} />
                              <span>Archive</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              title="Restore transaction"
                              className="restore-action"
                              onClick={() =>
                                restoreTransaction(transaction)
                              }
                              disabled={Boolean(actionLoading)}
                            >
                              <ArchiveRestore size={16} />
                              <span>Restore</span>
                            </button>
                          )}

                          <button
                            type="button"
                            title="Permanently delete transaction"
                            className="delete-action"
                            onClick={() =>
                              deleteTransaction(transaction)
                            }
                            disabled={Boolean(actionLoading)}
                          >
                            <Trash2 size={16} />
                            <span>Delete</span>
                          </button>
                        </>
                      )}

                    </div>
                  )}

                </article>
              );
            })
          )}

        </div>

        {/* FOOTER */}

        <footer className="transactions-footer">

          <span>
            Showing{" "}
            <strong>{filteredTransactions.length}</strong>{" "}
            of{" "}
            <strong>{currentSource.length}</strong>{" "}
            {archiveView ? "archived" : "active"} transactions
          </span>

          <span
            className={`transactions-footer-status ${
              connected ? "online" : "offline"
            }`}
          >
            <span />

            {connected
              ? "Realtime updates enabled"
              : "Connection unavailable"}
          </span>

        </footer>

      </section>

    </main>
  );
}

// =========================================================
// SUMMARY CARD
// =========================================================

function SummaryCard({
  title,
  value,
  description,
  icon,
  type,
}) {
  return (
    <article className="transactions-stat-card">

      <div className="transactions-stat-top">

        <span>{title}</span>

        <div className={`transactions-stat-icon ${type}`}>
          {icon}
        </div>

      </div>

      <strong className="transactions-stat-value">
        {value}
      </strong>

      <small>{description}</small>

    </article>
  );
}

// =========================================================
// CHART TOOLTIP
// =========================================================

function TransactionTooltip({ active, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  const data = payload[0]?.payload;

  if (!data) return null;

  return (
    <div className="transactions-tooltip">

      <strong>{data.label}</strong>

      <p>
        Stock In Transactions:{" "}
        <b>{data.stockIn}</b>
      </p>

      <p>
        Stock Out Transactions:{" "}
        <b>{data.stockOut}</b>
      </p>

      <small>
        Total: {data.stockIn + data.stockOut} transactions
      </small>

    </div>
  );
}

export default Transactions;
