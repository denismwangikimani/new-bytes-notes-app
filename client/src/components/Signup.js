/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { CreditCard, Loader } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import { GoogleLogin } from "@react-oauth/google";
import "../App.css";
import "./Signup.css";

// Add this debugging line at the top of your component
console.log(
  "Environment variable available:",
  !!process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY
);

// Replace the current stripePromise initialization with:
// For testing only - replace with environment variable in production
const STRIPE_KEY =
  "pk_test_51RLgZK2SdIR6sGRrLXeA3kPssrIB1juqUkn10tuey54MHqhdKU6KV8yeCh0vqJdcckYiaOLR3zh6QwXZXixlQ7gA00AkY9e0jO";
const stripePromise = loadStripe(STRIPE_KEY);
console.log("Stripe Promise initialized with key:", STRIPE_KEY);

function Signup() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [clientSecret, setClientSecret] = useState("");
  const navigate = useNavigate();

  // Store tempUserId from backend to link payment
  const [tempUserId, setTempUserId] = useState(null);

  // Store Stripe elements and instance references
  const [stripeElement, setStripeElement] = useState(null);
  const [stripeInstance, setStripeInstance] = useState(null);

  // API Base URL - centralized for easy switching between environments
  const API_BASE_URL = process.env.REACT_APP_API_URL || "https://new-bytes-notes-backend.onrender.com";

  const handleNextStep = async (e) => {
    // For Email/Password signup
    e.preventDefault();
    if (!email || !username || !password) {
      setError("All fields are required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    setIsLoading(true);
    setError(null);

    try {
      console.log("Initiating email signup with:", { email, username, password: "******" });
      
      // Step 1: Initiate Email Signup
      const initiateResponse = await axios.post(
        `${API_BASE_URL}/initiate-email-signup`,
        { email, username, password },
        { 
          headers: { 
            'Content-Type': 'application/json',
            // Include CORS headers if needed
            'Accept': 'application/json'
          } 
        }
      );

      console.log("Initiate response:", initiateResponse.data);
      const currentTempUserId = initiateResponse.data.tempUserId;
      setTempUserId(currentTempUserId); // Store tempUserId from backend

      // Store details needed for final completion in localStorage
      localStorage.setItem("signup_method", "email");
      localStorage.setItem("temp_email", email);
      localStorage.setItem("temp_username", username);
      localStorage.setItem("temp_password", password); // Store password to send at final step

      // Step 2: Create Payment Session
      console.log("Creating payment session for tempUserId:", currentTempUserId);
      const paymentResponse = await axios.post(
        `${API_BASE_URL}/create-payment-session`,
        {
          tempUserId: currentTempUserId,
          email: email, // For Stripe customer and receipt
        }
      );
      
      console.log("Payment session created:", paymentResponse.data);
      setClientSecret(paymentResponse.data.clientSecret);
      setStep(2);
    } catch (err) {
      console.error("Signup error:", err);
      setError(
        err.response?.data?.message ||
          "Failed to initiate signup. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignupSuccess = async (credentialResponse) => {
    setError(null);
    setIsLoading(true);
    const tokenId = credentialResponse.credential;

    try {
      console.log("Google signup with token ID:", tokenId.substring(0, 10) + "...");
      
      // Step 1: Initiate Google Signup
      const initiateResponse = await axios.post(
        `${API_BASE_URL}/google/initiate-signup`,
        { tokenId }
      );

      console.log("Google signup response:", initiateResponse.data);

      if (initiateResponse.data.token) {
        // User already exists and is paid
        localStorage.setItem("token", initiateResponse.data.token);
        navigate("/notes");
        return;
      }

      if (
        initiateResponse.data.isPaid === false &&
        initiateResponse.data.tempUserId
      ) {
        const {
          tempUserId: googleTempUserId,
          email: googleEmail,
          username: googleUsername,
        } = initiateResponse.data;
        setTempUserId(googleTempUserId);

        localStorage.setItem("signup_method", "google");
        localStorage.setItem("google_temp_user_id", googleTempUserId);
        localStorage.setItem("google_temp_email", googleEmail);
        localStorage.setItem("google_temp_username", googleUsername || "");

        // Step 2: Create Payment Session for Google user
        console.log("Creating payment session for Google user:", googleTempUserId);
        const paymentResponse = await axios.post(
          `${API_BASE_URL}/create-payment-session`,
          {
            tempUserId: googleTempUserId,
            email: googleEmail, // Use email from Google response for Stripe
          }
        );
        
        console.log("Payment session created for Google user:", paymentResponse.data);
        setClientSecret(paymentResponse.data.clientSecret);
        setStep(2);
      } else {
        setError("Google signup failed: Unexpected response from server.");
      }
    } catch (err) {
      console.error("Google signup error:", err);
      setError(
        err.response?.data?.message || "Google signup failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignupError = (error) => {
    console.error("Google signup failed on client:", error);
    setError(
      "Google signup failed. Please try again or ensure cookies are enabled."
    );
    setIsLoading(false);
  };

  // This function is called if Stripe's confirmPayment succeeds WITHOUT a redirect
  const completeRegistrationAfterPayment = async (paymentIntentId) => {
    setIsLoading(true);
    setError(null);
    try {
      const signupMethod = localStorage.getItem("signup_method");
      let registrationData = {
        paymentIntentId,
        signupMethod,
      };

      if (signupMethod === "email") {
        registrationData.email = localStorage.getItem("temp_email");
        registrationData.username = localStorage.getItem("temp_username");
        registrationData.password = localStorage.getItem("temp_password"); // Send password again
      } else if (signupMethod === "google") {
        registrationData.tempUserId = localStorage.getItem(
          "google_temp_user_id"
        );
      } else {
        throw new Error("Invalid signup method");
      }

      console.log("Completing registration after payment:", {
        ...registrationData,
        password: registrationData.password ? "******" : undefined
      });

      const response = await axios.post(
        `${API_BASE_URL}/complete-payment`,
        registrationData
      );

      console.log("Registration complete:", response.data);
      localStorage.setItem("token", response.data.token);

      // Clear temporary storage
      localStorage.removeItem("signup_method");
      localStorage.removeItem("temp_email");
      localStorage.removeItem("temp_username");
      localStorage.removeItem("temp_password");
      localStorage.removeItem("google_temp_user_id");
      localStorage.removeItem("google_temp_email");
      localStorage.removeItem("google_temp_username");

      setTempUserId(null); // Clear tempUserId state

      navigate("/notes");
    } catch (err) {
      console.error("Registration completion error:", err);
      setError(
        err.response?.data?.message ||
          "Payment confirmed but account activation failed. Please contact support."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSubmit = async (event) => {
    event.preventDefault();

    if (isLoading || !stripeInstance || !stripeElement) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const signupMethod = localStorage.getItem("signup_method");
    let emailForReceipt = "";
    if (signupMethod === "email") {
      emailForReceipt = localStorage.getItem("temp_email");
    } else if (signupMethod === "google") {
      emailForReceipt = localStorage.getItem("google_temp_email");
    }

    try {
      console.log("Confirming payment with Stripe");
      const { error: stripeError, paymentIntent } =
        await stripeInstance.confirmPayment({
          elements: stripeElement,
          confirmParams: {
            return_url: `${window.location.origin}/payment-confirmation`, // For redirect scenario
            receipt_email: emailForReceipt,
          },
          redirect: "if_required", // Important for handling SCA
        });

      if (stripeError) {
        console.error("Stripe payment error:", stripeError);
        setError(stripeError.message || "Payment failed.");
      } else if (paymentIntent && paymentIntent.status === "succeeded") {
        // Payment succeeded without redirect
        console.log("Payment succeeded without redirect:", paymentIntent.id);
        await completeRegistrationAfterPayment(paymentIntent.id);
      } else if (paymentIntent && paymentIntent.status === "requires_action") {
        // Additional action needed, Stripe handles redirect if configured.
        console.log("Payment requires additional action");
        setError(
          "Further action required to complete payment. Please follow the prompts."
        );
      }
      // If no paymentIntent, redirect is happening, handled by PaymentConfirmation.js
    } catch (err) {
      console.error("Payment processing error:", err);
      setError(err.message || "An error occurred processing your payment.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let paymentElementInstance = null;

    if (clientSecret && step === 2) {
      const initializePayment = async () => {
        try {
          console.log("Initializing Stripe payment with client secret");
          // Get a new instance of stripe
          const stripe = await stripePromise;
          if (!stripe || !mounted) {
            return;
          }

          setStripeInstance(stripe);

          // Create elements instance
          const elements = stripe.elements({
            clientSecret,
            appearance: { theme: "stripe" /* ... */ },
          });

          // Create and mount the payment element
          paymentElementInstance = elements.create("payment");
          if (mounted) {
            const paymentContainer = document.getElementById("payment-element");
            if (paymentContainer) {
              paymentElementInstance.mount("#payment-element");
              setStripeElement(elements);
            }
          }
        } catch (error) {
          console.error("Stripe initialization error:", error);
          if (mounted) {
            setError("Failed to initialize payment system: " + error.message);
          }
        }
      };

      initializePayment();
    }

    // Cleanup function
    return () => {
      mounted = false;
      // Unmount the payment element if it exists
      if (paymentElementInstance) {
        try {
          paymentElementInstance.unmount();
        } catch (err) {
          console.log("Error unmounting Stripe element:", err);
        }
      }
    };
  }, [clientSecret, step]); // Remove isLoading and completeRegistrationAfterPayment from dependencies

  // Reset page when going back to step 1
  const handleBackToAccountDetails = () => {
    setError(null);
    setClientSecret("");
    setTempUserId(null);
    // Clear all signup-related localStorage items
    localStorage.removeItem("signup_method");
    localStorage.removeItem("temp_email");
    localStorage.removeItem("temp_username");
    localStorage.removeItem("temp_password");
    localStorage.removeItem("google_temp_user_id");
    localStorage.removeItem("google_temp_email");
    localStorage.removeItem("google_temp_username");
    setStep(1);
  };

  return (
    <div className="auth-container">
      <h2>Welcome to Byte-Notes!</h2>

      {step === 1 ? (
        <>
          <div className="pricing-summary">
            <h3>One-Time Purchase - $18</h3>
            <p>Get lifetime access to all Byte-Notes features</p>
            <ul className="benefits-list">
              <li>Create unlimited notes</li>
              <li>AI-powered features</li>
              <li>Sync across all devices</li>
              <li>File uploads and media integration</li>
            </ul>
          </div>
          <form onSubmit={handleNextStep} className="auth-form">
            <h3>Create Your Account (Email & Password)</h3>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              required
              disabled={isLoading}
            />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              required
              disabled={isLoading}
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min. 6 characters)"
              required
              disabled={isLoading}
            />
            <button type="submit" className="next-button" disabled={isLoading}>
              {isLoading && !clientSecret ? (
                <>
                  <Loader size={18} className="spinner" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <span>Continue to Payment</span>
                  <CreditCard size={18} />
                </>
              )}
            </button>
            {error && <p className="error-message">{error}</p>}
          </form>
          <div style={{ textAlign: "center", margin: "20px 0", color: "#555" }}>
            OR
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "20px",
            }}
          >
            <GoogleLogin
              onSuccess={handleGoogleSignupSuccess}
              onError={handleGoogleSignupError}
              useOneTap={false}
              shape="rectangular"
              theme="outline"
              size="large"
              text="signup_with"
            />
          </div>
          <p className="login-link" style={{ marginTop: "20px" }}>
            If you already have an account, <Link to="/login">Login here</Link>
          </p>
        </>
      ) : (
        // Step 2: Payment
        <div className="payment-container">
          <h3>Complete Your Purchase</h3>
          <div className="payment-summary">
            <div className="payment-details">
              <span>One-time payment</span>
              <span className="payment-amount">$18.00</span>
            </div>
            <p>You'll get lifetime access to all Byte-Notes features</p>
          </div>

          <form id="payment-form" onSubmit={handlePaymentSubmit}>
            <div id="payment-element"></div>
            <button
              id="submit-button"
              type="submit"
              disabled={isLoading || !clientSecret || !stripeElement}
            >
              {isLoading ? (
                <>
                  <Loader size={18} className="spinner" />
                  <span>Processing...</span>
                </>
              ) : (
                "Pay Now"
              )}
            </button>
            {error && <p className="error-message">{error}</p>}
          </form>

          <button
            className="back-button"
            onClick={handleBackToAccountDetails}
            disabled={isLoading}
          >
            Back to Account Details
          </button>
        </div>
      )}
    </div>
  );
}

export default Signup;