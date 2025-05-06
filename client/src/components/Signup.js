import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { CreditCard, Loader } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
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
  const [step, setStep] = useState(1); // Step 1: Account details, Step 2: Payment
  const [clientSecret, setClientSecret] = useState("");
  const navigate = useNavigate();

  const handleNextStep = async (e) => {
    e.preventDefault();

    if (!email || !username || !password) {
      setError("All fields are required");
      return;
    }

    setIsLoading(true);

    try {
      // Create an account first (without finalizing it)
      const response = await axios.post(
        "https://new-bytes-notes-backend.onrender.com/register/initiate",
        {
          email,
          username,
          password,
        }
      );

      // Store temporary user data for the complete registration
      localStorage.setItem("temp_email", email);
      localStorage.setItem("temp_username", username);
      localStorage.setItem("temp_password", password);

      // Now create a payment intent to get client secret
      const paymentResponse = await axios.post(
        "https://new-bytes-notes-backend.onrender.com/create-payment-intent",
        {
          email,
          amount: 1800, // $18.00 in cents
          userId: response.data.userId, // Temporary user ID from first step
        }
      );

      // Store the client secret
      setClientSecret(paymentResponse.data.clientSecret);

      // Move to payment step
      setStep(2);
      setError(null);
    } catch (err) {
      if (err.response && err.response.data) {
        setError(err.response.data.message);
      } else {
        setError("Failed to create account. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = useCallback(
    async (paymentIntent) => {
      try {
        // Complete the registration with payment confirmation
        const response = await axios.post(
          "https://new-bytes-notes-backend.onrender.com/register/complete",
          {
            email,
            paymentIntentId: paymentIntent.id,
          }
        );

        // Store token and navigate to notes
        localStorage.setItem("token", response.data.token);
        navigate("/notes");
      } catch (err) {
        setError(
          "Payment confirmed but account activation failed. Please contact support."
        );
      }
    },
    [email, navigate]
  );

  useEffect(() => {
    if (clientSecret && step === 2) {
      // When we have the client secret and we're on the payment step,
      // load the payment element
      const initializePayment = async () => {
        const stripe = await stripePromise;

        if (!stripe) {
          setError("Could not initialize payment system");
          return;
        }

        const elements = stripe.elements({
          clientSecret,
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#4f46e5",
            },
          },
        });

        const paymentElement = elements.create("payment");
        paymentElement.mount("#payment-element");

        // Handle form submission
        const form = document.getElementById("payment-form");
        form.addEventListener("submit", async (event) => {
          event.preventDefault();
          setIsLoading(true);

          const { error, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
              return_url: window.location.origin + "/payment-confirmation",
              receipt_email: email,
            },
            redirect: "if_required",
          });

          if (error) {
            setError(error.message);
            setIsLoading(false);
          } else if (paymentIntent && paymentIntent.status === "succeeded") {
            await handlePaymentSuccess(paymentIntent);
          }
        });
      };

      initializePayment();
    }
  }, [clientSecret, step, email, navigate, handlePaymentSuccess]);

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
            <h3>Create Your Account</h3>
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
              placeholder="Password"
              required
              disabled={isLoading}
            />
            <button type="submit" className="next-button" disabled={isLoading}>
              {isLoading ? (
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
            <p className="login-link">
              If you already have an account,{" "}
              <Link to="/login">Login here</Link>
            </p>
          </form>
        </>
      ) : (
        <div className="payment-container">
          <h3>Complete Your Purchase</h3>
          <div className="payment-summary">
            <div className="payment-details">
              <span>One-time payment</span>
              <span className="payment-amount">$18.00</span>
            </div>
            <p>You'll get lifetime access to all Byte-Notes features</p>
          </div>

          <form id="payment-form">
            <div id="payment-element"></div>
            <button id="submit-button" disabled={isLoading}>
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
            onClick={() => setStep(1)}
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
