import React from "react";
import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  if (!token) {
    // Redirect to login if token is not present
    return <Navigate to="/" />;
  }

  return children;
}

export default ProtectedRoute;
