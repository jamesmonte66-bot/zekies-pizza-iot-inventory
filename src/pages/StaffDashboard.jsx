import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  onValue,
  ref,
} from "firebase/database";

import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Package,
  Radio,
  ScanLine,
} from "lucide-react";

import {
  database,
} from "../firebase";

import "../App.css";

function StaffDashboard() {
  const [inventory, setInventory] =
    useState([]);

  const [transactions, setTransactions] =
    useState([]);

  const [connected, setConnected] =
    useState(false);

  const [loading, setLoading] =
    useState(true);


  /* FIREBASE CONNECTION */

  useEffect(() => {
    const connectionRef = ref(
      database,
      ".info/connected"
    );

    return onValue(
      connectionRef,
      (snapshot) => {
        setConnected(
          snapshot.val() === true
        );
      }
    );
  }, []);


  /* INVENTORY */

  useEffect(() => {
    const inventoryRef = ref(
      database,
      "Inventory"
    );

    return onValue(
      inventoryRef,
      (snapshot) => {

        const data = snapshot.val();

        if (!data) {
          setInventory([]);
          return;
        }

        const records =
          Object.entries(data).map(
            ([id, item]) => ({
              id,
              ...item,
            })
          );

        setInventory(records);
      }
    );
  }, []);


  /* TRANSACTIONS */

  useEffect(() => {
    const transactionsRef = ref(
      database,
      "Transactions"
    );

    return onValue(
      transactionsRef,
      (snapshot) => {

        const data = snapshot.val();

        if (!data) {
          setTransactions([]);
          setLoading(false);
          return;
        }

        const records =
          Object.entries(data)
            .map(([id, item]) => ({
              id,
              ...item,
            }))
            .sort(
              (a, b) =>
                Number(
                  b.Timestamp || b.id
                ) -
                Number(
                  a.Timestamp || a.id
                )
            );

        setTransactions(records);

        setLoading(false);
      }
    );
  }, []);


  /* STATISTICS */

  const stats = useMemo(() => {

    const stockIn =
      transactions.filter(
        (item) =>
          item.Status === "STOCK IN"
      ).length;

    const stockOut =
      transactions.filter(
        (item) =>
          item.Status === "STOCK OUT"
      ).length;

    return {
      products: inventory.length,
      stockIn,
      stockOut,
      transactions:
        transactions.length,
    };

  }, [inventory, transactions]);


  const recentTransactions =
    transactions.slice(0, 6);


  return (
    <div className="staff-dashboard">

      {/* HEADER */}

      <header className="staff-dashboard-header">

        <div>

          <span className="eyebrow">
            Staff Workspace
          </span>

          <h2>
            Inventory Dashboard
          </h2>

          <p>
            Monitor Zekie's Pizza stock
            and recent inventory activity.
          </p>

        </div>


        <div
          className={
            connected
              ? "staff-system-status online"
              : "staff-system-status offline"
          }
        >

          <span />

          {connected
            ? "System Online"
            : "System Offline"}

        </div>

      </header>


      {/* KPI CARDS */}

      <div className="staff-kpi-grid">

        <div className="staff-kpi-card">

          <div className="staff-kpi-icon products">
            <Package size={21} />
          </div>

          <div>
            <span>
              Products
            </span>

            <strong>
              {stats.products}
            </strong>

            <small>
              Inventory records
            </small>
          </div>

        </div>


        <div className="staff-kpi-card">

          <div className="staff-kpi-icon stockin">
            <ArrowUpRight size={21} />
          </div>

          <div>
            <span>
              Stock In
            </span>

            <strong>
              {stats.stockIn}
            </strong>

            <small>
              Recorded additions
            </small>
          </div>

        </div>


        <div className="staff-kpi-card">

          <div className="staff-kpi-icon stockout">
            <ArrowDownRight size={21} />
          </div>

          <div>
            <span>
              Stock Out
            </span>

            <strong>
              {stats.stockOut}
            </strong>

            <small>
              Recorded deductions
            </small>
          </div>

        </div>


        <div className="staff-kpi-card">

          <div className="staff-kpi-icon activity">
            <ScanLine size={21} />
          </div>

          <div>
            <span>
              Transactions
            </span>

            <strong>
              {stats.transactions}
            </strong>

            <small>
              Total activity
            </small>
          </div>

        </div>

      </div>


      {/* MAIN STAFF CONTENT */}

      <div className="staff-dashboard-grid">

        {/* CURRENT INVENTORY */}

        <section className="staff-panel">

          <div className="staff-panel-header">

            <div>

              <div className="staff-panel-title">
                <Boxes size={18} />

                <h3>
                  Current Inventory
                </h3>
              </div>

              <p>
                Latest product stock levels
              </p>

            </div>

            <span className="staff-count">
              {inventory.length} products
            </span>

          </div>


          <div className="staff-table-wrapper">

            <table className="staff-table">

              <thead>
                <tr>
                  <th>Product</th>
                  <th>Weight</th>
                  <th>Quantity</th>
                  <th>Unit</th>
                </tr>
              </thead>

              <tbody>

                {inventory.length === 0 ? (

                  <tr>
                    <td
                      colSpan="4"
                      className="empty-state"
                    >
                      No inventory records.
                    </td>
                  </tr>

                ) : (

                  inventory
                    .slice(0, 8)
                    .map((item) => (

                      <tr key={item.id}>

                        <td>

                          <div className="staff-product">

                            <div>
                              <Package
                                size={17}
                              />
                            </div>

                            <strong>
                              {item.Product ||
                                item.id}
                            </strong>

                          </div>

                        </td>

                        <td>
                          {Number(
                            item.Weight || 0
                          ).toFixed(2)}{" "}
                          kg
                        </td>

                        <td className="staff-quantity">
                          {Number(
                            item.Quantity || 0
                          ).toFixed(2)}
                        </td>

                        <td>
                          {item.Unit || "-"}
                        </td>

                      </tr>

                    ))

                )}

              </tbody>

            </table>

          </div>

        </section>


        {/* RECENT ACTIVITY */}

        <section className="staff-panel">

          <div className="staff-panel-header">

            <div>

              <div className="staff-panel-title">
                <Radio size={18} />

                <h3>
                  Recent Activity
                </h3>
              </div>

              <p>
                Latest stock movement
              </p>

            </div>

          </div>


          <div className="staff-activity-list">

            {loading ? (

              <div className="empty-state">
                Loading activity...
              </div>

            ) : recentTransactions.length === 0 ? (

              <div className="empty-state">
                No transactions yet.
              </div>

            ) : (

              recentTransactions.map(
                (transaction) => {

                  const stockOut =
                    transaction.Status ===
                    "STOCK OUT";

                  return (

                    <div
                      className="staff-activity-item"
                      key={transaction.id}
                    >

                      <div
                        className={
                          stockOut
                            ? "staff-activity-icon out"
                            : "staff-activity-icon in"
                        }
                      >

                        {stockOut ? (
                          <ArrowDownRight
                            size={18}
                          />
                        ) : (
                          <ArrowUpRight
                            size={18}
                          />
                        )}

                      </div>


                      <div className="staff-activity-info">

                        <strong>
                          {transaction.Product ||
                            "Unknown Product"}
                        </strong>

                        <span>
                          {transaction.Status ||
                            "NO CHANGE"}
                        </span>

                      </div>


                      <div className="staff-activity-quantity">

                        <strong>
                          {Number(
                            transaction.Quantity ||
                              0
                          ).toFixed(
                            transaction.Unit ===
                              "kg"
                              ? 2
                              : 0
                          )}
                        </strong>

                        <span>
                          {transaction.Unit || ""}
                        </span>

                      </div>

                    </div>

                  );
                }
              )

            )}

          </div>

        </section>

      </div>

    </div>
  );
}

export default StaffDashboard;