const jwt = require("jsonwebtoken");
const User = require("./db/userModel");

module.exports = async (req, res, next) => {
  try {
    // Get the token from the authorization header
    const token = req.headers.authorization.split(" ")[1];
    
    // Verify the token
    const decodedToken = jwt.verify(token, "secret");
    
    // Extract user info from token
    const userId = decodedToken.userId;
    
    // Get user from database to check payment status
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(401).json({ message: "Authentication failed - User not found" });
    }
    
    // Check if user has paid (for protected features)
    if (req.originalUrl.includes('/api/ai/') && !user.isPaid) {
      return res.status(403).json({ 
        message: "Access denied - This feature requires a paid account",
        requiresPayment: true
      });
    }
    
    // Add user to request object
    req.user = {
      userId: userId,
      email: decodedToken.email,
      isPaid: user.isPaid
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ message: "Authentication failed" });
  }
};