const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "sala-express";

// Verify JWT and attach decoded payload to req.user
const authenticate = (req, res, next) => {
    const authHeader = req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized" });
    }

    try {
        const token = authHeader.split(" ")[1];
        req.user = jwt.verify(token, JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({
            message: "Unauthorized",
            error: error.message
        });
    }
};

// Allow only users having at least one of the given roles (e.g. "admin", "superadmin", "user")
// When "admin" is allowed, "superadmin" is also automatically allowed.
const authorize = (...allowedRoles) => (req, res, next) => {
    const roles = (req.user && req.user.roles) || [];
    const effectiveAllowed = allowedRoles.includes("admin") && !allowedRoles.includes("superadmin")
        ? [...allowedRoles, "superadmin"]
        : allowedRoles;
    const allowed = effectiveAllowed.some((role) => roles.includes(role));
    if (!allowed) {
        return res.status(403).json({ message: "Forbidden: insufficient role" });
    }
    next();
};

module.exports = { authenticate, authorize };
