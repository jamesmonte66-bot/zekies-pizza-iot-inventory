
import { useEffect, useMemo, useState } from "react";

import {
  initializeApp,
  getApps,
} from "firebase/app";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signOut,
} from "firebase/auth";

import {
  get,
  onValue,
  ref,
  set,
  update,
} from "firebase/database";

import {
  Search,
  UserPlus,
  Users,
  UserCheck,
  UserX,
  Pencil,
  Power,
  X,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  MapPin,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ShieldCheck,
} from "lucide-react";

import {
  auth,
  database,
  firebaseConfig,
} from "../firebase";

import "../App.css";

// =========================================================
// CONFIGURATION
// =========================================================

const BRANCH = "Villanueva-Branch";

// =========================================================
// SECONDARY FIREBASE AUTHENTICATION
// =========================================================

const staffApp =
  getApps().find(
    (app) => app.name === "staffManagementApp"
  ) ||
  initializeApp(
    firebaseConfig,
    "staffManagementApp"
  );

const staffAuth = getAuth(staffApp);

// =========================================================
// STAFF MANAGEMENT COMPONENT
// =========================================================

function RegisterStaff() {
  const [staff, setStaff] = useState([]);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  // =======================================================
  // VERIFY ADMIN
  // =======================================================

  const verifyAdmin = async () => {
    const currentAdmin = auth.currentUser;

    if (!currentAdmin) {
      throw new Error(
        "Please log in using your Admin account."
      );
    }

    const adminSnapshot = await get(
      ref(database, `Users/${currentAdmin.uid}`)
    );

    if (!adminSnapshot.exists()) {
      throw new Error("Admin profile not found.");
    }

    const adminData = adminSnapshot.val();

    if (
      adminData.role !== "admin" ||
      adminData.status !== "active"
    ) {
      throw new Error(
        "Only an active Admin can manage Staff accounts."
      );
    }

    return currentAdmin.uid;
  };

  // =======================================================
  // REALTIME STAFF LISTENER
  // =======================================================

  useEffect(() => {
    let active = true;

    const usersRef = ref(database, "Users");

    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        if (!active) return;

        const data = snapshot.val() || {};

        const staffRecords = Object.entries(data)
          .filter(
            ([, item]) => item?.role === "staff"
          )
          .map(([uid, item]) => ({
            uid,
            ...item,
          }))
          .sort((a, b) =>
            String(a.fullName || "").localeCompare(
              String(b.fullName || "")
            )
          );

        setStaff(staffRecords);
        setError("");
        setLoading(false);
      },
      (firebaseError) => {
        console.error(
          "Staff loading error:",
          firebaseError
        );

        if (active) {
          setError(
            "Unable to load Staff accounts. Check your Firebase connection and permissions."
          );

          setLoading(false);
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  // =======================================================
  // STAFF STATISTICS
  // =======================================================

  const activeStaff = staff.filter(
    (item) => item.status === "active"
  ).length;

  const inactiveStaff = staff.filter(
    (item) => item.status !== "active"
  ).length;

  // =======================================================
  // SEARCH STAFF
  // =======================================================

  const filteredStaff = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return staff;

    return staff.filter((item) =>
      `${item.fullName || ""} ${item.email || ""}`
        .toLowerCase()
        .includes(keyword)
    );
  }, [staff, search]);

  // =======================================================
  // RESET FORM
  // =======================================================

  const resetForm = () => {
    setForm({
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    });

    setEditingStaff(null);
    setShowForm(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  // =======================================================
  // OPEN CREATE FORM
  // =======================================================

  const openCreateForm = () => {
    setError("");
    setSuccess("");
    setEditingStaff(null);

    setForm({
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    });

    setShowForm(true);
  };

  // =======================================================
  // OPEN EDIT FORM
  // =======================================================

  const openEditForm = (item) => {
    setError("");
    setSuccess("");

    setEditingStaff(item);

    setForm({
      fullName: item.fullName || "",
      email: item.email || "",
      password: "",
      confirmPassword: "",
    });

    setShowForm(true);
  };

  // =======================================================
  // INPUT HANDLER
  // =======================================================

  const handleChange = (event) => {
    const { name, value } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // =======================================================
  // CREATE STAFF ACCOUNT
  // =======================================================

  const createStaff = async () => {
    const fullName = form.fullName.trim();
    const email = form.email.trim().toLowerCase();

    // VALIDATION

    if (
      !fullName ||
      !email ||
      !form.password ||
      !form.confirmPassword
    ) {
      throw new Error(
        "Please complete all required fields."
      );
    }

    if (
      fullName.length < 2 ||
      fullName.length > 100
    ) {
      throw new Error(
        "Please enter a valid staff name."
      );
    }

    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      throw new Error(
        "Please enter a valid email address."
      );
    }

    if (form.password.length < 6) {
      throw new Error(
        "Password must contain at least 6 characters."
      );
    }

    if (form.password !== form.confirmPassword) {
      throw new Error("Passwords do not match.");
    }

    // VERIFY ADMIN

    const adminUid = await verifyAdmin();

    let newUser = null;
    let profileSaved = false;

    try {
      // CREATE AUTHENTICATION ACCOUNT

      const credential =
        await createUserWithEmailAndPassword(
          staffAuth,
          email,
          form.password
        );

      newUser = credential.user;

      // VERIFY ADMIN SESSION

      if (auth.currentUser?.uid !== adminUid) {
        throw new Error(
          "Admin session changed. Please log in again."
        );
      }

      // CREATE STAFF PROFILE

      const staffProfile = {
        uid: newUser.uid,
        fullName,
        email,
        role: "staff",
        branch: BRANCH,
        status: "active",
        createdAt: Date.now(),
      };

      await set(
        ref(database, `Users/${newUser.uid}`),
        staffProfile
      );

      profileSaved = true;

    } catch (creationError) {
      // ROLLBACK INCOMPLETE ACCOUNT

      if (newUser && !profileSaved) {
        try {
          await deleteUser(newUser);
        } catch (rollbackError) {
          console.error(
            "Account rollback failed:",
            rollbackError
          );

          throw new Error(
            "Staff profile creation failed and the Authentication account could not be removed. Please check Firebase Authentication before retrying.",
            { cause: rollbackError }
          );
        }
      }

      throw creationError;

    } finally {
      // CLOSE SECONDARY SESSION

      if (staffAuth.currentUser) {
        try {
          await signOut(staffAuth);
        } catch (signOutError) {
          console.error(
            "Secondary sign-out error:",
            signOutError
          );
        }
      }
    }
  };

  // =======================================================
  // EDIT STAFF INFORMATION
  // =======================================================

  const editStaff = async () => {
    if (!editingStaff) return;

    const fullName = form.fullName.trim();

    if (
      fullName.length < 2 ||
      fullName.length > 100
    ) {
      throw new Error(
        "Please enter a valid staff name."
      );
    }

    const adminUid = await verifyAdmin();

    if (auth.currentUser?.uid !== adminUid) {
      throw new Error(
        "Admin session changed. Please log in again."
      );
    }

    await update(
      ref(database, `Users/${editingStaff.uid}`),
      {
        fullName,
        updatedAt: Date.now(),
      }
    );
  };

  // =======================================================
  // SAVE FORM
  // =======================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await verifyAdmin();

      if (editingStaff) {
        await editStaff();

        setSuccess(
          "Staff information updated successfully."
        );
      } else {
        await createStaff();

        setSuccess(
          "Staff account created successfully."
        );
      }

      resetForm();

    } catch (firebaseError) {
      console.error(
        "Staff management error:",
        firebaseError
      );

      const errorMessages = {
        "auth/email-already-in-use":
          "This email address is already registered.",

        "auth/invalid-email":
          "Please enter a valid email address.",

        "auth/weak-password":
          "Password must contain at least 6 characters.",

        "auth/network-request-failed":
          "Network error. Please check your internet connection.",
      };

      setError(
        errorMessages[firebaseError.code] ||
        firebaseError.message ||
        "Unable to save Staff account."
      );

    } finally {
      setSaving(false);
    }
  };

  // =======================================================
  // DEACTIVATE / REACTIVATE ACCOUNT
  // =======================================================

  const toggleStatus = async (item) => {
    const isActive = item.status === "active";

    const action = isActive
      ? "deactivate"
      : "reactivate";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${item.fullName || "this staff account"}?`
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");

    try {
      await verifyAdmin();

      await update(
        ref(database, `Users/${item.uid}`),
        {
          status: isActive ? "inactive" : "active",
          updatedAt: Date.now(),
        }
      );

      setSuccess(
        `${item.fullName || "Staff account"} successfully ${action}d.`
      );

    } catch (firebaseError) {
      console.error(
        "Account status error:",
        firebaseError
      );

      setError(
        firebaseError.message ||
        "Unable to update account status."
      );
    }
  };

  // =======================================================
  // STAFF MANAGEMENT INTERFACE
  // =======================================================

  return (
    <main className="staff-management">

      {/* HEADER */}

      <header className="staff-management-header">

        <div>
          <span className="staff-eyebrow">
            ADMINISTRATION
          </span>

          <h2>Staff Management</h2>

          <p>
            Manage authorized staff accounts for Zekie's Pizza.
          </p>
        </div>

        <button
          type="button"
          className="staff-primary-button"
          onClick={openCreateForm}
        >
          <UserPlus size={18} />
          Create Staff Account
        </button>

      </header>

      {/* ERROR MESSAGE */}

      {error && (
        <div
          className="staff-alert staff-alert-error"
          role="alert"
        >
          <AlertCircle size={17} />
          {error}
        </div>
      )}

      {/* SUCCESS MESSAGE */}

      {success && (
        <div
          className="staff-alert staff-alert-success"
          role="status"
        >
          <CheckCircle size={17} />
          {success}
        </div>
      )}

      {/* STATISTICS */}

      <section className="staff-stats">

        <StatCard
          icon={<Users size={21} />}
          label="Total Staff"
          value={loading ? "..." : staff.length}
        />

        <StatCard
          icon={<UserCheck size={21} />}
          label="Active Accounts"
          value={loading ? "..." : activeStaff}
          tone="active"
        />

        <StatCard
          icon={<UserX size={21} />}
          label="Inactive Accounts"
          value={loading ? "..." : inactiveStaff}
          tone="inactive"
        />

      </section>

      {/* STAFF TABLE */}

      <section className="staff-table-card">

        <div className="staff-table-header">

          <div>
            <h3>Registered Staff</h3>

            <p>
              View and manage registered staff accounts.
            </p>
          </div>

          <div className="staff-search">

            <Search size={17} />

            <input
              type="search"
              placeholder="Search name or email..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

          </div>

        </div>

        <div className="staff-table-wrapper">

          <table className="staff-table">

            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Branch</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>

              {loading ? (
                <tr>
                  <td colSpan="6" className="staff-empty">
                    <RefreshCw size={20} />
                    Loading staff accounts...
                  </td>
                </tr>

              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan="6" className="staff-empty">
                    No staff accounts found.
                  </td>
                </tr>

              ) : (
                filteredStaff.map((item) => (

                  <tr key={item.uid}>

                    <td>
                      <div className="staff-member">

                        <div className="staff-avatar">
                          {(item.fullName || "S")
                            .charAt(0)
                            .toUpperCase()}
                        </div>

                        <div>
                          <strong>
                            {item.fullName || "Unnamed Staff"}
                          </strong>

                          <span>
                            {item.email || "No email"}
                          </span>
                        </div>

                      </div>
                    </td>

                    <td>
                      {item.branch || "Not assigned"}
                    </td>

                    <td>
                      <span className="staff-role">
                        Staff
                      </span>
                    </td>

                    <td>
                      <span
                        className={`staff-status ${
                          item.status === "active"
                            ? "status-active"
                            : "status-inactive"
                        }`}
                      >
                        {item.status === "active"
                          ? "Active"
                          : "Inactive"}
                      </span>
                    </td>

                    <td>
                      {item.createdAt
                        ? new Date(
                            Number(item.createdAt)
                          ).toLocaleDateString("en-PH")
                        : "—"}
                    </td>

                    <td>
                      <div className="staff-actions">

                        <button
                          type="button"
                          title="Edit Staff"
                          onClick={() => openEditForm(item)}
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          type="button"
                          title={
                            item.status === "active"
                              ? "Deactivate Staff"
                              : "Reactivate Staff"
                          }
                          onClick={() => toggleStatus(item)}
                          className={
                            item.status === "active"
                              ? "deactivate-action"
                              : "activate-action"
                          }
                        >
                          <Power size={16} />
                        </button>

                      </div>
                    </td>

                  </tr>

                ))
              )}

            </tbody>

          </table>

        </div>

        <div className="staff-table-footer">
          Showing {filteredStaff.length} of {staff.length} staff accounts
        </div>

      </section>

      {/* CREATE / EDIT MODAL */}

      {showForm && (

        <div
          className="staff-modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              resetForm();
            }
          }}
        >

          <div
            className="staff-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-modal-title"
          >

            <div className="staff-modal-header">

              <div>
                <span className="staff-eyebrow">
                  STAFF ACCOUNTS
                </span>

                <h3 id="staff-modal-title">
                  {editingStaff
                    ? "Edit Staff Information"
                    : "Create Staff Account"}
                </h3>

                <p>
                  {editingStaff
                    ? "Update the selected staff member's information."
                    : "Register a trusted staff member."}
                </p>
              </div>

              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                aria-label="Close form"
              >
                <X size={20} />
              </button>

            </div>

            <form onSubmit={handleSubmit}>

              {/* FULL NAME */}

              <label>
                Full Name

                <div className="staff-form-input">
                  <User size={17} />

                  <input
                    name="fullName"
                    value={form.fullName}
                    onChange={handleChange}
                    placeholder="Enter full name"
                    maxLength={100}
                    required
                    disabled={saving}
                  />
                </div>
              </label>

              {/* EMAIL */}

              <label>
                Email Address

                <div className="staff-form-input">
                  <Mail size={17} />

                  <input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    placeholder="Enter email address"
                    required
                    disabled={saving || !!editingStaff}
                  />
                </div>
              </label>

              {/* BRANCH */}

              <label>
                Assigned Branch

                <div className="staff-form-input">
                  <MapPin size={17} />

                  <input
                    value="Villanueva Branch"
                    disabled
                    readOnly
                  />
                </div>
              </label>

              {/* PASSWORD */}

              {!editingStaff && (
                <>
                  <label>
                    Password

                    <div className="staff-form-input">
                      <Lock size={17} />

                      <input
                        type={
                          showPassword ? "text" : "password"
                        }
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        placeholder="Minimum 6 characters"
                        minLength={6}
                        required
                        disabled={saving}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowPassword((previous) => !previous)
                        }
                        aria-label="Toggle password visibility"
                      >
                        {showPassword
                          ? <EyeOff size={17} />
                          : <Eye size={17} />}
                      </button>
                    </div>
                  </label>

                  <label>
                    Confirm Password

                    <div className="staff-form-input">
                      <Lock size={17} />

                      <input
                        type={
                          showConfirmPassword
                            ? "text"
                            : "password"
                        }
                        name="confirmPassword"
                        value={form.confirmPassword}
                        onChange={handleChange}
                        placeholder="Confirm password"
                        required
                        disabled={saving}
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirmPassword(
                            (previous) => !previous
                          )
                        }
                        aria-label="Toggle confirmation visibility"
                      >
                        {showConfirmPassword
                          ? <EyeOff size={17} />
                          : <Eye size={17} />}
                      </button>
                    </div>
                  </label>
                </>
              )}

              {/* ROLE INFORMATION */}

              <div className="staff-modal-note">

                <ShieldCheck size={18} />

                <span>
                  {editingStaff
                    ? "Only the staff member's name will be updated. Role and account identity remain unchanged."
                    : "The account will automatically receive the Staff role and Villanueva Branch assignment."}
                </span>

              </div>

              {/* MODAL ACTIONS */}

              <div className="staff-modal-actions">

                <button
                  type="button"
                  className="staff-cancel-button"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="staff-primary-button"
                  disabled={saving}
                >
                  {saving
                    ? "Saving..."
                    : editingStaff
                      ? "Save Changes"
                      : "Create Account"}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </main>
  );
}

// =========================================================
// STATISTICS CARD
// =========================================================

function StatCard({
  icon,
  label,
  value,
  tone = "",
}) {
  return (
    <article className={`staff-stat-card ${tone}`}>

      <div className="staff-stat-icon">
        {icon}
      </div>

      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>

    </article>
  );
}

export default RegisterStaff;
