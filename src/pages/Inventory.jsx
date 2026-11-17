
import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";

import {
  AlertTriangle,
  CheckCircle,
  Package,
  Search,
  XCircle,
  Scale,
  Boxes,
  RefreshCw,
  Wifi,
  WifiOff,
  Filter,
  ArrowDownUp,
} from "lucide-react";

import { database } from "../firebase";
import "../App.css";

// =========================================================
// STOCK STATUS
// =========================================================

const getStockStatus = (item) => {
  const quantity = Number(item.Quantity) || 0;

  const minimumStock =
    item.MinStock !== undefined &&
    item.MinStock !== null &&
    item.MinStock !== ""
      ? Number(item.MinStock)
      : 1;

  if (quantity <= 0) {
    return {
      type: "out",
      label: "Out of Stock",
    };
  }

  if (quantity <= minimumStock) {
    return {
      type: "low",
      label: "Low Stock",
    };
  }

  return {
    type: "good",
    label: "In Stock",
  };
};

// =========================================================
// NUMBER FORMAT
// =========================================================

const formatNumber = (value) => {
  const number = Number(value) || 0;

  return number.toLocaleString("en-PH", {
    maximumFractionDigits: 2,
  });
};

// =========================================================
// INVENTORY COMPONENT
// =========================================================

function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("name");

  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");

  // =======================================================
  // FIREBASE REALTIME LISTENER
  // =======================================================

  useEffect(() => {
    const inventoryRef = ref(database, "Inventory");
    const connectionRef = ref(database, ".info/connected");

    const unsubscribeConnection = onValue(
      connectionRef,
      (snapshot) => {
        setConnected(snapshot.val() === true);
      },
      (firebaseError) => {
        console.error("Connection error:", firebaseError);
        setConnected(false);
      }
    );

    const unsubscribeInventory = onValue(
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
        setError("");
        setLoading(false);
      },
      (firebaseError) => {
        console.error("Inventory loading error:", firebaseError);

        setError(
          firebaseError.code === "PERMISSION_DENIED"
            ? "Access denied. You do not have permission to view inventory."
            : "Unable to load inventory. Please check your Firebase connection."
        );

        setLoading(false);
      }
    );

    return () => {
      unsubscribeConnection();
      unsubscribeInventory();
    };
  }, []);

  // =======================================================
  // INVENTORY STATISTICS
  // =======================================================

  const totalProducts = inventory.length;

  const totalQuantity = useMemo(
    () =>
      inventory.reduce(
        (total, item) =>
          total + (Number(item.Quantity) || 0),
        0
      ),
    [inventory]
  );

  const totalWeight = useMemo(
    () =>
      inventory.reduce(
        (total, item) =>
          total + (Number(item.Weight) || 0),
        0
      ),
    [inventory]
  );

  const lowStockItems = useMemo(
    () =>
      inventory.filter(
        (item) => getStockStatus(item).type === "low"
      ),
    [inventory]
  );

  const outOfStockItems = useMemo(
    () =>
      inventory.filter(
        (item) => getStockStatus(item).type === "out"
      ),
    [inventory]
  );

  const inStockItems = totalProducts -
    lowStockItems.length -
    outOfStockItems.length;

  // =======================================================
  // FILTER AND SEARCH
  // =======================================================

  const filteredInventory = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    let records = inventory.filter((item) => {
      const matchesSearch =
        String(item.Product || item.id)
          .toLowerCase()
          .includes(keyword) ||
        String(item.UID || "")
          .toLowerCase()
          .includes(keyword);

      const status = getStockStatus(item).type;

      const matchesFilter =
        filter === "all" || status === filter;

      return matchesSearch && matchesFilter;
    });

    records = [...records].sort((a, b) => {
      if (sortOrder === "quantity") {
        return (
          (Number(b.Quantity) || 0) -
          (Number(a.Quantity) || 0)
        );
      }

      if (sortOrder === "weight") {
        return (
          (Number(b.Weight) || 0) -
          (Number(a.Weight) || 0)
        );
      }

      return String(a.Product || a.id).localeCompare(
        String(b.Product || b.id)
      );
    });

    return records;
  }, [inventory, search, filter, sortOrder]);

  // =======================================================
  // FILTER OPTIONS
  // =======================================================

  const filters = [
    {
      id: "all",
      label: "All Products",
      count: totalProducts,
    },
    {
      id: "good",
      label: "In Stock",
      count: inStockItems,
    },
    {
      id: "low",
      label: "Low Stock",
      count: lowStockItems.length,
    },
    {
      id: "out",
      label: "Out of Stock",
      count: outOfStockItems.length,
    },
  ];

  // =======================================================
  // INTERFACE
  // =======================================================

  return (
    <main className="inventory-page">

      {/* =================================================
          PAGE HEADER
          ================================================= */}

      <header className="inventory-heading">

        <div>
          <span className="inventory-eyebrow">
            INVENTORY MANAGEMENT
          </span>

          <h2>Stock Inventory</h2>

          <p>
            Monitor product quantities, weight measurements,
            and current stock conditions.
          </p>
        </div>

        <div
          className={`inventory-live-status ${
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

          <span className="inventory-live-dot" />
        </div>

      </header>

      {/* =================================================
          ERROR MESSAGE
          ================================================= */}

      {error && (
        <div className="inventory-error">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* =================================================
          SUMMARY CARDS
          ================================================= */}

      <section className="inventory-summary-grid">

        <SummaryCard
          icon={<Package size={21} />}
          label="Total Products"
          value={loading ? "..." : formatNumber(totalProducts)}
          description="Registered products"
          tone="blue"
        />

        <SummaryCard
          icon={<Boxes size={21} />}
          label="Total Stock Quantity"
          value={loading ? "..." : formatNumber(totalQuantity)}
          description="Combined current quantity"
          tone="purple"
        />

        <SummaryCard
          icon={<Scale size={21} />}
          label="Total Weight"
          value={loading ? "..." : `${formatNumber(totalWeight)} kg`}
          description="Recorded inventory weight"
          tone="green"
        />

        <SummaryCard
          icon={<AlertTriangle size={21} />}
          label="Needs Attention"
          value={
            loading
              ? "..."
              : lowStockItems.length + outOfStockItems.length
          }
          description="Low and out-of-stock products"
          tone="orange"
        />

      </section>

      {/* =================================================
          STOCK ALERTS
          ================================================= */}

      {!loading &&
        !error &&
        (lowStockItems.length > 0 ||
          outOfStockItems.length > 0) && (

          <section className="inventory-alert-section">

            <div className="inventory-section-heading">

              <div className="inventory-section-icon warning">
                <AlertTriangle size={20} />
              </div>

              <div>
                <h3>Stock Alerts</h3>

                <p>
                  Products requiring inventory attention.
                </p>
              </div>

              <span className="inventory-alert-total">
                {lowStockItems.length + outOfStockItems.length} Alerts
              </span>

            </div>

            <div className="inventory-alert-grid">

              {outOfStockItems.map((item) => (
                <div
                  className="inventory-alert-card out"
                  key={item.id}
                >
                  <div className="inventory-alert-symbol">
                    <XCircle size={19} />
                  </div>

                  <div className="inventory-alert-details">
                    <strong>
                      {item.Product || item.id}
                    </strong>

                    <span>
                      Out of stock
                    </span>
                  </div>

                  <strong className="inventory-alert-quantity">
                    0 {item.Unit || ""}
                  </strong>
                </div>
              ))}

              {lowStockItems.map((item) => {
                const minimumStock =
                  item.MinStock !== undefined &&
                  item.MinStock !== null &&
                  item.MinStock !== ""
                    ? Number(item.MinStock)
                    : 1;

                return (
                  <div
                    className="inventory-alert-card low"
                    key={item.id}
                  >
                    <div className="inventory-alert-symbol">
                      <AlertTriangle size={19} />
                    </div>

                    <div className="inventory-alert-details">
                      <strong>
                        {item.Product || item.id}
                      </strong>

                      <span>
                        Minimum: {formatNumber(minimumStock)}{" "}
                        {item.Unit || ""}
                      </span>
                    </div>

                    <strong className="inventory-alert-quantity">
                      {formatNumber(item.Quantity)} {item.Unit || ""}
                    </strong>
                  </div>
                );
              })}

            </div>

          </section>
        )}

      {/* =================================================
          ALL STOCK GOOD
          ================================================= */}

      {!loading &&
        !error &&
        inventory.length > 0 &&
        lowStockItems.length === 0 &&
        outOfStockItems.length === 0 && (

          <div className="inventory-success-banner">

            <CheckCircle size={20} />

            <div>
              <strong>All stock levels are good</strong>

              <span>
                No products are currently below their minimum stock level.
              </span>
            </div>

          </div>
        )}

      {/* =================================================
          INVENTORY TABLE
          ================================================= */}

      <section className="inventory-main-card">

        {/* TABLE HEADER */}

        <div className="inventory-table-heading">

          <div>
            <h3>All Stock Inventory</h3>

            <p>
              Real-time product information from Firebase.
            </p>
          </div>

          <div className="inventory-search-box">
            <Search size={18} />

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
                <XCircle size={16} />
              </button>
            )}

          </div>

        </div>

        {/* FILTER AND SORT */}

        <div className="inventory-toolbar">

          <div className="inventory-filter-list">

            <Filter size={16} />

            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  filter === item.id ? "selected" : ""
                }
                onClick={() => setFilter(item.id)}
              >
                {item.label}

                <span>{item.count}</span>
              </button>
            ))}

          </div>

          <div className="inventory-sort">

            <ArrowDownUp size={16} />

            <select
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value)
              }
              aria-label="Sort inventory"
            >
              <option value="name">Product Name</option>
              <option value="quantity">Stock Quantity</option>
              <option value="weight">Weight</option>
            </select>

          </div>

        </div>

        {/* TABLE */}

        <div className="inventory-table-wrapper">

          <table className="inventory-modern-table">

            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>RFID UID</th>
                <th>WEIGHT</th>
                <th>QUANTITY</th>
                <th>UNIT</th>
                <th>STOCK STATUS</th>
              </tr>
            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td colSpan="6">
                    <div className="inventory-empty-state">
                      <RefreshCw size={22} className="inventory-spinner" />
                      <strong>Loading inventory...</strong>
                      <span>Retrieving product records.</span>
                    </div>
                  </td>
                </tr>

              ) : error ? (
                <tr>
                  <td colSpan="6">
                    <div className="inventory-empty-state error">
                      <AlertTriangle size={24} />
                      <strong>Unable to retrieve inventory</strong>
                      <span>Check Firebase permissions and connection.</span>
                    </div>
                  </td>
                </tr>

              ) : filteredInventory.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="inventory-empty-state">
                      <Package size={25} />

                      <strong>
                        {inventory.length === 0
                          ? "No products registered"
                          : "No matching products found"}
                      </strong>

                      <span>
                        {inventory.length === 0
                          ? "Product records will appear here after registration."
                          : "Try another search term or stock filter."}
                      </span>
                    </div>
                  </td>
                </tr>

              ) : (
                filteredInventory.map((item) => {
                  const status = getStockStatus(item);

                  return (
                    <tr key={item.id}>

                      {/* PRODUCT */}

                      <td>
                        <div className="inventory-product-cell">

                          <div className="inventory-product-icon">
                            <Package size={19} />
                          </div>

                          <div>
                            <strong>
                              {item.Product || item.id}
                            </strong>

                            <span>
                              Product ID: {item.id}
                            </span>
                          </div>

                        </div>
                      </td>

                      {/* RFID */}

                      <td>
                        <span className="inventory-uid">
                          {item.UID || "Not available"}
                        </span>
                      </td>

                      {/* WEIGHT */}

                      <td>
                        <strong className="inventory-number">
                          {formatNumber(item.Weight)}
                        </strong>

                        <span className="inventory-unit-label">
                          kg
                        </span>
                      </td>

                      {/* QUANTITY */}

                      <td>
                        <strong className="inventory-number">
                          {formatNumber(item.Quantity)}
                        </strong>
                      </td>

                      {/* UNIT */}

                      <td>
                        <span className="inventory-unit-badge">
                          {item.Unit || "-"}
                        </span>
                      </td>

                      {/* STATUS */}

                      <td>
                        <span
                          className={`inventory-status-badge ${status.type}`}
                        >

                          {status.type === "good" && (
                            <CheckCircle size={14} />
                          )}

                          {status.type === "low" && (
                            <AlertTriangle size={14} />
                          )}

                          {status.type === "out" && (
                            <XCircle size={14} />
                          )}

                          {status.label}

                        </span>
                      </td>

                    </tr>
                  );
                })
              )}

            </tbody>

          </table>

        </div>

        {/* TABLE FOOTER */}

        <div className="inventory-table-footer">

          <span>
            Showing <strong>{filteredInventory.length}</strong> of{" "}
            <strong>{inventory.length}</strong> products
          </span>

          <span className="inventory-footer-live">
            <span />
            Automatically updated
          </span>

        </div>

      </section>

    </main>
  );
}

// =========================================================
// SUMMARY CARD
// =========================================================

function SummaryCard({
  icon,
  label,
  value,
  description,
  tone,
}) {
  return (
    <article className="inventory-stat-card">

      <div className={`inventory-stat-icon ${tone}`}>
        {icon}
      </div>

      <div className="inventory-stat-content">

        <span>{label}</span>

        <strong>{value}</strong>

        <small>{description}</small>

      </div>

    </article>
  );
}

export default Inventory;
