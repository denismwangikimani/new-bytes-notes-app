import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CheckCircle, XCircle, Loader } from "lucide-react";
import axios from "axios";
import "./PaymentConfirmation.css";

function PaymentConfirmation() {
  const [status, setStatus] = useState("loading");
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const paymentIntentId = queryParams.get("payment_intent");
    //const paymentIntentClientSecret = queryParams.get('payment_intent_client_secret');
    const redirectStatus = queryParams.get("redirect_status");

    if (!paymentIntentId || !redirectStatus) {
      setStatus("error");
      setMessage("Invalid payment confirmation URL. Please try again.");
      return;
    }

    // Payment was already validated by Stripe redirect
    if (redirectStatus === "succeeded") {
      // Complete the registration
      const email = localStorage.getItem("temp_email"); // Store email temporarily during payment flow

      axios
        .post(
          "https://new-bytes-notes-backend.onrender.com/register/complete",
          {
            email,
            username: localStorage.getItem("temp_username"),
            password: localStorage.getItem("temp_password"),
            paymentIntentId,
          }
        )
        .then((response) => {
          // Store token
          localStorage.removeItem("temp_email");
          localStorage.removeItem("temp_username");
          localStorage.removeItem("temp_password");
          localStorage.setItem("token", response.data.token);

          setStatus("success");
          setMessage(
            "Your payment was successful! Your account is now active."
          );

          // Redirect to notes page after 3 seconds
          setTimeout(() => {
            navigate("/notes");
          }, 3000);
        })
        .catch((error) => {
          setStatus("error");
          setMessage(
            "Payment was successful, but account activation failed. Please contact support."
          );
          console.error("Error completing registration:", error);
        });
    } else {
      setStatus("error");
      setMessage("Payment failed. Please try again.");
    }
  }, [navigate, location.search]);

  return (
    <div className="payment-confirmation-container">
      <div className="payment-confirmation-card">
        {status === "loading" && (
          <>
            <Loader size={50} className="spinner" />
            <h2>Processing your payment...</h2>
            <p>Please wait while we confirm your payment.</p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle size={50} color="#10b981" />
            <h2>Payment Successful!</h2>
            <p>{message}</p>
            <p className="redirect-message">
              You will be redirected to your notes in a moment...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle size={50} color="#ef4444" />
            <h2>Payment Failed</h2>
            <p>{message}</p>
            <button
              className="retry-button"
              onClick={() => navigate("/signup")}
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default PaymentConfirmation;
