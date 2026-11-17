
import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Box,
  Package,
  Radio,
  Clock,
  AlertCircle,
} from "lucide-react";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { database } from "../firebase";
import "../App.css";

// =========================================================
// HELPER FUNCTIONS
// =========================================================

const getStatus = (status) =>
  String(status || "").trim().toUpperCase();

const getTimestamp = (value) => {
  if (!value) return 0;

  const numeric = Number(value);

  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric < 1000000000000
      ? numeric * 1000
      : numeric;
  }

  const parsed = new Date(value).getTime();

  return Number.isNaN(parsed) ? 0 : parsed;
};

const formatDate = (timestamp) => {
  const date = getTimestamp(timestamp);

  if (!date) return "Date unavailable";

  return new Date(date).toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const getQuantity = (item) =>
  Number(item?.Quantity ?? item?.ChangeAmount ?? 0) || 0;

// =========================================================
// ADMIN DASHBOARD
// =========================================================

function Dashboard() {
  const [inventory, setInventory] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [connected, setConnected] = useState(false);

  const [loadingInventory, setLoadingInventory] = useState(true);
  const [loadingTransactions, setLoadingTransactions] = useState(true);

  const [inventoryError, setInventoryError] = useState("");
  const [transactionError, setTransactionError] = useState("");

  // =======================================================
  // FIREBASE REALTIME DATABASE LISTENERS
  // =======================================================

  useEffect(() => {
    const inventoryRef = ref(database, "Inventory");
    const transactionsRef = ref(database, "Transactions");
    const connectionRef = ref(database, ".info/connected");

    // FIREBASE CONNECTION

    const stopConnection = onValue(
      connectionRef,
      (snapshot) => {
        setConnected(snapshot.val() === true);
      },
      (error) => {
        console.error("Connection error:", error);
        setConnected(false);
      }
    );

    // INVENTORY LISTENER

    const stopInventory = onValue(
      inventoryRef,
      (snapshot) => {
        const data = snapshot.val();

        const records = data
          ? Object.entries(data).map(([id, item]) => ({
              id,
              ...(item || {}),
            }))
          : [];

        setInventory(records);
        setInventoryError("");
        setLoadingInventory(false);
      },
      (error) => {
        console.error("Inventory error:", error);

        setInventoryError(
          "Unable to load inventory data. Please check your connection."
        );

        setLoadingInventory(false);
      }
    );

    // TRANSACTION LISTENER

    const stopTransactions = onValue(
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
            getTimestamp(b.Timestamp) -
            getTimestamp(a.Timestamp)
        );

        setTransactions(records);
        setTransactionError("");
        setLoadingTransactions(false);
      },
      (error) => {
        console.error("Transaction error:", error);

        setTransactionError(
          "Unable to load transaction records."
        );

        setLoadingTransactions(false);
      }
    );

    // CLEANUP LISTENERS

    return () => {
      stopConnection();
      stopInventory();
      stopTransactions();
    };
  }, []);

  // =======================================================
  // INVENTORY COMPUTATIONS
  // =======================================================

  const totalProducts = inventory.length;

  const totalWeight = useMemo(() => {
    return inventory.reduce(
      (sum, item) => sum + (Number(item.Weight) || 0),
      0
    );
  }, [inventory]);

  // =======================================================
  // TRANSACTION COMPUTATIONS
  // =======================================================

  const stockInCount = useMemo(
    () =>
      transactions.filter(
        (item) => getStatus(item.Status) === "STOCK IN"
      ).length,
    [transactions]
  );

  const stockOutCount = useMemo(
    () =>
      transactions.filter(
        (item) => getStatus(item.Status) === "STOCK OUT"
      ).length,
    [transactions]
  );

  // =======================================================
  // INVENTORY CHART
  // =======================================================

  const inventoryChart = useMemo(() => {
    return [...inventory]
      .map((item) => ({
        product: item.Product || item.id,
        quantity: Number(item.Quantity) || 0,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
  }, [inventory]);

  // =======================================================
  // STOCK MOVEMENT CHART
  // =======================================================

  const activityChart = useMemo(
    () => [
      {
        name: "Stock In",
        value: stockInCount,
      },
      {
        name: "Stock Out",
        value: stockOutCount,
      },
    ],
    [stockInCount, stockOutCount]
  );

  // =======================================================
  // RECENT TRANSACTION TREND
  // =======================================================

  const transactionTrend = useMemo(() => {
    return transactions
      .slice(0, 10)
      .reverse()
      .map((item, index) => ({
        record: index + 1,
        quantity: Math.abs(getQuantity(item)),
        status: getStatus(item.Status),
        product: item.Product || "Unknown product",
      }));
  }, [transactions]);

  // =======================================================
  // LATEST TRANSACTIONS
  // =======================================================

  const recentTransactions = transactions.slice(0, 5);

  // =======================================================
  // DASHBOARD INTERFACE
  // =======================================================

  return (
    <main className="pro-dashboard">

      {/* DASHBOARD HEADER */}

      <header className="pro-dashboard-header">

        <div>
          <span className="eyebrow">OVERVIEW</span>

          <h2>Inventory Dashboard</h2>

          <p>
            Live inventory levels, stock movement,
            and IoT monitoring.
          </p>
        </div>

        <div className={`pro-live ${connected ? "is-live" : ""}`}>
          <Radio size={15} />

          <span>
            {connected ? "System Live" : "System Offline"}
          </span>
        </div>

      </header>

      {/* ERROR MESSAGES */}

      {inventoryError && (
        <div className="error-message pro-error">
          <AlertCircle size={17} />
          {inventoryError}
        </div>
      )}

      {transactionError && (
        <div className="error-message pro-error">
          <AlertCircle size={17} />
          {transactionError}
        </div>
      )}

      {/* SUMMARY CARDS */}

      <section className="pro-kpi-grid">

        <KpiCard
          label="Total Products"
          value={loadingInventory ? "..." : totalProducts}
          helper="Registered inventory items"
          icon={<Package size={20} />}
        />

        <KpiCard
          label="Current Weight"
          value={
            loadingInventory
              ? "..."
              : `${totalWeight.toFixed(2)} kg`
          }
          helper="Total recorded product weight"
          icon={<Box size={20} />}
        />

        <KpiCard
          label="Stock In"
          value={loadingTransactions ? "..." : stockInCount}
          helper="Recorded stock additions"
          icon={<ArrowUpRight size={20} />}
          tone="positive"
        />

        <KpiCard
          label="Stock Out"
          value={loadingTransactions ? "..." : stockOutCount}
          helper="Recorded stock deductions"
          icon={<ArrowDownRight size={20} />}
          tone="negative"
        />

      </section>

      {/* DASHBOARD CHARTS */}

      <section className="pro-dashboard-grid">

        {/* INVENTORY LEVELS */}

        <article className="pro-card pro-inventory-card">

          <CardHeader
            title="Inventory Levels"
            subtitle="Top 10 products by current quantity"
            badge="Realtime"
          />

          <div className="pro-chart">

            {loadingInventory ? (
              <ChartEmpty text="Loading inventory..." />
            ) : inventoryError ? (
              <ChartEmpty text="Inventory data unavailable." />
            ) : inventoryChart.length === 0 ? (
              <ChartEmpty text="No inventory data available." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={inventoryChart}
                  margin={{
                    top: 10,
                    right: 12,
                    left: -18,
                    bottom: 2,
                  }}
                  barCategoryGap="30%"
                >

                  <CartesianGrid
                    stroke="#eef2f7"
                    strokeDasharray="4 4"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="product"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 11,
                      fill: "#64748b",
                    }}
                    interval={0}
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 11,
                      fill: "#94a3b8",
                    }}
                    allowDecimals={false}
                  />

                  <Tooltip
                    cursor={{ fill: "#f8fafc" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 10px 30px rgba(15,23,42,.08)",
                    }}
                  />

                  <Bar
                    dataKey="quantity"
                    name="Quantity"
                    fill="#2563eb"
                    radius={[7, 7, 2, 2]}
                    maxBarSize={46}
                  />

                </BarChart>
              </ResponsiveContainer>
            )}

          </div>

        </article>

        {/* STOCK MOVEMENT */}

        <article className="pro-card pro-activity-card">

          <CardHeader
            title="Stock Movement"
            subtitle="Stock In vs Stock Out"
          />

          <div className="pro-donut-wrap">

            {loadingTransactions ? (
              <ChartEmpty text="Loading transactions..." />
            ) : transactionError ? (
              <ChartEmpty text="Transaction data unavailable." />
            ) : transactions.length === 0 ? (
              <ChartEmpty text="No stock activity yet." />
            ) : (
              <>

                <div className="pro-donut">

                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>

                      <Pie
                        data={activityChart}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="66%"
                        outerRadius="88%"
                        paddingAngle={5}
                        stroke="none"
                      >
                        <Cell fill="#22c55e" />
                        <Cell fill="#f43f5e" />
                      </Pie>

                      <Tooltip />

                    </PieChart>
                  </ResponsiveContainer>

                  <div className="donut-center">
                    <strong>{transactions.length}</strong>
                    <span>Transactions</span>
                  </div>

                </div>

                <div className="movement-legend">

                  <div>
                    <span className="movement-dot movement-in" />
                    <span>Stock In</span>
                    <strong>{stockInCount}</strong>
                  </div>

                  <div>
                    <span className="movement-dot movement-out" />
                    <span>Stock Out</span>
                    <strong>{stockOutCount}</strong>
                  </div>

                </div>

              </>
            )}

          </div>

        </article>

        {/* RECENT ACTIVITY */}

        <article className="pro-card pro-trend-card">

          <CardHeader
            title="Recent Activity"
            subtitle="Quantity movement across recent transactions"
            icon={<Activity size={17} />}
          />

          <div className="pro-mini-chart">

            {loadingTransactions ? (
              <ChartEmpty text="Loading activity..." />
            ) : transactionError ? (
              <ChartEmpty text="Activity data unavailable." />
            ) : transactionTrend.length === 0 ? (
              <ChartEmpty text="No transaction trend yet." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={transactionTrend}
                  margin={{
                    top: 10,
                    right: 8,
                    left: -25,
                    bottom: 0,
                  }}
                >

                  <defs>
                    <linearGradient
                      id="activityFill"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#2563eb"
                        stopOpacity={0.22}
                      />

                      <stop
                        offset="95%"
                        stopColor="#2563eb"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="#eef2f7"
                    strokeDasharray="4 4"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="record"
                    axisLine={false}
                    tickLine={false}
                    tick={false}
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fontSize: 10,
                      fill: "#94a3b8",
                    }}
                    allowDecimals={false}
                  />

                  <Tooltip
                    formatter={(value) => [value, "Quantity"]}
                    labelFormatter={(label) => `Transaction ${label}`}
                  />

                  <Area
                    type="monotone"
                    dataKey="quantity"
                    name="Quantity"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                    fill="url(#activityFill)"
                  />

                </AreaChart>
              </ResponsiveContainer>
            )}

          </div>

        </article>

        {/* LATEST TRANSACTIONS */}

        <article className="pro-card pro-recent-card">

          <CardHeader
            title="Latest Transactions"
            subtitle="Latest recorded stock activity"
          />

          <div className="compact-transactions">

            {loadingTransactions ? (
              <ChartEmpty text="Loading transactions..." />
            ) : transactionError ? (
              <ChartEmpty text="Transaction records unavailable." />
            ) : recentTransactions.length === 0 ? (
              <ChartEmpty text="No transactions recorded." />
            ) : (
              recentTransactions.map((transaction) => {

                const status = getStatus(transaction.Status);
                const isIn = status === "STOCK IN";
                const isOut = status === "STOCK OUT";

                const unit = String(transaction.Unit || "");
                const quantity = getQuantity(transaction);

                return (
                  <div
                    className="compact-transaction"
                    key={transaction.id}
                  >

                    <div
                      className={`compact-icon ${
                        isIn ? "in" : isOut ? "out" : ""
                      }`}
                    >
                      {isIn ? (
                        <ArrowUpRight size={16} />
                      ) : isOut ? (
                        <ArrowDownRight size={16} />
                      ) : (
                        <Activity size={16} />
                      )}
                    </div>

                    <div className="compact-info">

                      <strong>
                        {transaction.Product || "Unknown product"}
                      </strong>

                      <span>
                        {transaction.Status || "Unknown status"}
                      </span>

                      <span>
                        <Clock
                          size={11}
                          style={{
                            display: "inline",
                            verticalAlign: "middle",
                            marginRight: 4,
                          }}
                        />
                        {formatDate(transaction.Timestamp)}
                      </span>

                    </div>

                    <strong className="compact-qty">
                      {quantity.toFixed(
                        unit.toLowerCase() === "kg" ? 2 : 0
                      )}{" "}
                      {unit}
                    </strong>

                  </div>
                );
              })
            )}

          </div>

        </article>

      </section>

    </main>
  );
}

// =========================================================
// KPI CARD COMPONENT
// =========================================================

function KpiCard({
  label,
  value,
  helper,
  icon,
  tone = "",
}) {
  return (
    <article className={`pro-kpi ${tone}`}>

      <div className="pro-kpi-top">
        <span>{label}</span>

        <div className="pro-kpi-icon">
          {icon}
        </div>
      </div>

      <strong>{value}</strong>

      <small>{helper}</small>

    </article>
  );
}

// =========================================================
// CARD HEADER COMPONENT
// =========================================================

function CardHeader({
  title,
  subtitle,
  badge,
  icon,
}) {
  return (
    <div className="pro-card-header">

      <div>

        <div className="pro-card-title">
          {icon}
          <h3>{title}</h3>
        </div>

        <p>{subtitle}</p>

      </div>

      {badge && (
        <span className="pro-card-badge">
          {badge}
        </span>
      )}

    </div>
  );
}

// =========================================================
// EMPTY STATE COMPONENT
// =========================================================

function ChartEmpty({ text }) {
  return (
    <div className="pro-empty">
      {text}
    </div>
  );
}

export default Dashboard;
