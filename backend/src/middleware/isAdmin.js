// backend/src/middleware/isAdmin.js

export function isAdmin(req, res, next) {
  try {
    const role = req.user?.role || "user";
    if (role !== "admin") {
      return res.status(403).json({ message: "Forbidden: Admins only." });
    }
    next();
  } catch (err) {
    console.error("❌ [isAdmin] error:", err);
    return res.status(500).json({ message: "Server error in isAdmin middleware" });
  }
}