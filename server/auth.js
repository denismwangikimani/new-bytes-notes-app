const jwt = require("jsonwebtoken");

module.exports = async (request, response, next) => {
  try {
    // Get the token from the authorization header
    const token = await request.headers.authorization.split(" ")[1];

    // Check if the token matches the supposed origin
    const decodedToken = await jwt.verify(token, "secret");

    // Pass the user data from the token to the request object
    request.user = decodedToken;

    next();
  } catch (error) {
    response.status(401).json({
      error: "Invalid request!",
    });
  }
};
