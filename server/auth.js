const jwt = require("jsonwebtoken");

// Middleware to authenticate requests using JWT
module.exports = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error(
        "Auth Middleware: Authorization header missing or malformed."
      );
      throw new Error("Authorization header missing or malformed");
    }
    const token = authHeader.split(" ")[1];
    // console.log("Auth Middleware: Token received (first 20 chars):", token ? token.substring(0, 20) + "..." : "null");

    const decodedToken = jwt.verify(token, process.env.JWT_SECRET || "secret");
    // console.log("Auth Middleware: Decoded token:", decodedToken);

    if (
      !decodedToken.userId ||
      typeof decodedToken.isPaid === "undefined" ||
      !decodedToken.email
    ) {
      console.error("Auth Middleware: Token payload incomplete.", decodedToken);
      throw new Error(
        "Token payload is incomplete. Required fields: userId, email, isPaid."
      );
    }

    req.user = {
      userId: decodedToken.userId,
      email: decodedToken.email,
      isPaid: decodedToken.isPaid,
    };
    // console.log("Auth Middleware: req.user set:", req.user);
    next();
  } catch (error) {
    console.error("Auth Middleware Error:", error.name, "-", error.message);
    // For debugging, you might want to log the token that failed, but be cautious in production.
    // console.error("Auth Middleware: Failing token (Authorization header):", req.headers.authorization);

    if (error.name === "JsonWebTokenError") {
      return res
        .status(401)
        .json({ message: "Invalid token", details: error.message });
    }
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Token expired", details: error.message });
    }
    // Default for other errors (e.g., payload incomplete, header missing)
    return res
      .status(401)
      .json({ message: "Authentication failed", details: error.message });
  }
};
