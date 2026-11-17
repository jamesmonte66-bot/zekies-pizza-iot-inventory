import { push, ref, set, serverTimestamp } from "firebase/database";
import { auth, database } from "../firebase";

// Call this only after the related inventory operation succeeds.
export async function writeAuditLog({
  action,
  category = "General",
  details = "",
  targetId = "",
}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Cannot write audit log: no authenticated user.");

  const logRef = push(ref(database, "AuditLogs"));
  await set(logRef, {
    action,
    category,
    details,
    targetId,
    performedBy: user.uid,
    performedByEmail: user.email || "",
    timestamp: serverTimestamp(),
  });

  return logRef.key;
}

