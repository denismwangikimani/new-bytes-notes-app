import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { CheckCircle, XCircle, Loader } from "lucide-react";
import axios from "axios";
import "./PaymentConfirmation.css";

function PaymentConfirmation() {
  const [status, setStatus] = useState("loading"); // 'loading', 'success', 'error'
  const [message, setMessage] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const paymentIntentId = queryParams.get("payment_intent");
    const paymentIntentClientSecret = queryParams.get("payment_intent_client_secret"); // Stripe adds this
    const redirectStatus = queryParams.get("redirect_status");

    if (!paymentIntentId || !redirectStatus || !paymentIntentClientSecret) {
      setStatus("error");
      setMessage("Invalid payment confirmation URL. Please try again or contact support.");
      return;
    }

    if (redirectStatus === "succeeded") {
      // Payment was successful, now complete the registration on the backend
      const signupMethod = localStorage.getItem("signup_method");
      let registrationData = {
        paymentIntentId,
        signupMethod,
      };

      if (signupMethod === "email") {
        registrationData.email = localStorage.getItem("temp_email");
        registrationData.username = localStorage.getItem("temp_username");
        registrationData.password = localStorage.getItem("temp_password");
        if (!registrationData.email || !registrationData.username || !registrationData.password) {
            setStatus("error");
            setMessage("Registration details missing after payment. Please try signing up again or contact support.");
            return;
        }
      } else if (signupMethod === "google") {
        registrationData.tempUserId = localStorage.getItem("google_temp_user_id");
         if (!registrationData.tempUserId) {
            setStatus("error");
            setMessage("User session details missing after Google payment. Please try signing up again or contact support.");
            return;
        }
      } else {
        setStatus("error");
        setMessage("Could not determine signup method. Please contact support.");
        return;
      }

      axios.post("https://new-bytes-notes-backend.onrender.com/complete-payment", registrationData)
        .then((response) => {
          localStorage.setItem("token", response.data.token);
          setStatus("success");
          setMessage("Your payment was successful! Your account is now active.");

          // Clear temporary storage
          localStorage.removeItem("signup_method");
          localStorage.removeItem("temp_email");
          localStorage.removeItem("temp_username");
          localStorage.removeItem("temp_password");
          localStorage.removeItem("google_temp_user_id");
          localStorage.removeItem("google_temp_email");
          localStorage.removeItem("google_temp_username");

          setTimeout(() => {
            navigate("/notes");
          }, 3000);
        })
        .catch((error) => {
          setStatus("error");
          setMessage(error.response?.data?.message || "Payment was successful, but account activation failed. Please contact support.");
        });
    } else if (redirectStatus === "processing") {
        setStatus("loading");
        setMessage("Your payment is processing. We will update you once it's complete. You may close this page.");
    }
    else {
      setStatus("error");
      setMessage(`Payment ${redirectStatus}. Please try again or contact support.`);
    }
  }, [navigate, location.search]);

  return (
    <div className="payment-confirmation-container">
      <div className="payment-confirmation-card">
        {status === "loading" && (
          <>
            <Loader size={50} className="spinner" />
            <h2>Processing your confirmation...</h2>
            <p>{message || "Please wait while we confirm your payment status."}</p>
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
            <h2>Payment Issue</h2>
            <p>{message}</p>
            <button className="retry-button" onClick={() => navigate("/signup")}>
              Try Signup Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default PaymentConfirmation;