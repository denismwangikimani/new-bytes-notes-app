import React, { useState, useEffect, useCallback } from "react";
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
      setIsLoading(true);
      setError(null);
      try {
        const isGoogleSignup = !!localStorage.getItem("google_temp_user_id");
        let registrationData;
        let completeUrl;

        if (isGoogleSignup) {
          registrationData = {
            paymentIntentId: paymentIntent.id,
            tempUserId: localStorage.getItem("google_temp_user_id"),
            email: localStorage.getItem("google_temp_email"), // From Google auth, stored in localStorage
            username: localStorage.getItem("google_temp_username"), // From Google auth, stored in localStorage
          };
          completeUrl =
            "https://new-bytes-notes-backend.onrender.com/auth/google/complete-payment";
        } else {
          // For regular email/password signup, use the component's state variables.
          // These were the values submitted in step 1.
          registrationData = {
            email: email, // Use state variable
            username: username, // Use state variable
            password: password, // Use state variable
            paymentIntentId: paymentIntent.id,
          };
          completeUrl =
            "https://new-bytes-notes-backend.onrender.com/register/complete";
        }

        console.log(
          "Completing registration with data:",
          registrationData,
          "to URL:",
          completeUrl
        );

        const response = await axios.post(completeUrl, registrationData);

        // Clear all temporary storage
        localStorage.removeItem("temp_email");
        localStorage.removeItem("temp_username");
        localStorage.removeItem("temp_password");
        localStorage.removeItem("google_temp_user_id");
        localStorage.removeItem("google_temp_email");
        localStorage.removeItem("google_temp_username");

        localStorage.setItem("token", response.data.token);
        navigate("/notes");
      } catch (err) {
        console.error(
          "Registration completion error:",
          err.response?.data || err.message
        );
        setError(
          err.response?.data?.message ||
            "Payment confirmed but account activation failed. Please contact support."
        );
      } finally {
        setIsLoading(false);
      }
    },
    [navigate, email, username, password]
  );

  useEffect(() => {
    if (clientSecret && step === 2) {
      const initializePayment = async () => {
        try {
          console.log(
            "Initializing payment with client secret (first chars):",
            clientSecret ? clientSecret.substring(0, 10) + "..." : "null"
          );

          const stripe = await stripePromise;

          if (!stripe) {
            console.error("Stripe failed to initialize");
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

          const form = document.getElementById("payment-form");
          if (!form) {
            console.error("Payment form not found in DOM");
            setError("Payment form could not be loaded");
            return;
          }

          // Determine the correct email for the receipt
          // Prioritize Google email if it was a Google signup flow, otherwise use the email from the form state.
          const emailForReceipt =
            localStorage.getItem("google_temp_email") || email;
          console.log("Using email for Stripe receipt:", emailForReceipt);

          // Remove previous event listener if any to prevent multiple submissions
          const newForm = form.cloneNode(true);
          form.parentNode.replaceChild(newForm, form);

          newForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            setIsLoading(true);

            try {
              const { error: stripeError, paymentIntent } =
                await stripe.confirmPayment({
                  elements,
                  confirmParams: {
                    return_url:
                      window.location.origin + "/payment-confirmation",
                    receipt_email: emailForReceipt, // Use the determined email
                  },
                  redirect: "if_required",
                });

              if (stripeError) {
                console.error("Payment confirmation error:", stripeError);
                setError(stripeError.message);
                setIsLoading(false);
              } else if (
                paymentIntent &&
                paymentIntent.status === "succeeded"
              ) {
                console.log("Payment successful, completing registration");
                await handlePaymentSuccess(paymentIntent);
              } else {
                // Handle other statuses if necessary
                console.log(
                  "Payment intent status:",
                  paymentIntent ? paymentIntent.status : "unknown"
                );
                setIsLoading(false);
              }
            } catch (err) {
              console.error("Error during payment confirmation:", err);
              setError(
                "Payment processing error: " + (err.message || err.toString())
              );
              setIsLoading(false);
            }
          });
        } catch (error) {
          console.error("Error in payment initialization:", error);
          setError("Payment system initialization failed: " + error.message);
        }
      };
      initializePayment();
    }
    // Add 'email' to dependency array as it's used in emailForReceipt
  }, [clientSecret, step, email, navigate, handlePaymentSuccess]);

  const handleGoogleSignupSuccess = async (credentialResponse) => {
    setError(null);
    setIsLoading(true);
    console.log("Google signup success raw response:", credentialResponse);
    const tokenId = credentialResponse.credential;

    try {
      const response = await axios.post(
        "https://new-bytes-notes-backend.onrender.com/auth/google", // Same backend endpoint
        { tokenId }
      );
      console.log("Backend Google signup response:", response.data);
      if (response.data.token) {
        // User already paid or doesn't require payment step
        localStorage.setItem("token", response.data.token);
        navigate("/notes");
      } else if (response.data.isPaid === false && response.data.tempUserId) {
        // Payment required
        // Set email and username state if you want them to prefill any UI elements,
        // but primarily store them for the payment intent.
        // setEmail(backendResponse.data.email); // Optional: if you want to update the main email state
        // setUsername(backendResponse.data.username || ''); // Optional: if you want to update the main username state

        localStorage.setItem("google_temp_user_id", response.data.tempUserId);
        localStorage.setItem("google_temp_email", response.data.email);
        localStorage.setItem(
          "google_temp_username",
          response.data.username || ""
        );

        // Create payment intent for Google user
        const paymentIntentResponse = await axios.post(
          "https://new-bytes-notes-backend.onrender.com/create-payment-intent",
          {
            email: response.data.email, // Use email from Google response
            amount: 1800,
            userId: response.data.tempUserId,
          }
        );
        setClientSecret(paymentIntentResponse.data.clientSecret);
        setStep(2);
        setError(null);
      } else {
        setError("Google signup failed: Unexpected response from server.");
      }
    } catch (err) {
      console.error("Google signup backend error:", err);
      if (err.response && err.response.data) {
        setError(err.response.data.message || "Google signup failed.");
      } else {
        setError("Google signup failed. Please try again.");
      }
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
            {error && !isLoading && <p className="error-message">{error}</p>} {/* Show error only if not loading */}
          </form>

          {/* "OR" separator and Google Sign up option */}
          <div style={{ textAlign: "center", margin: "20px 0", color: "#555" }}>
            OR
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "20px",
              // marginTop: "10px", // Adjusted margin
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
          {error && isLoading && <p className="error-message">{error}</p>} {/* Show error related to Google if loading */}


          <p className="login-link" style={{ marginTop: '20px' }}> {/* Ensure this is last */}
            If you already have an account,{" "}
            <Link to="/login">Login here</Link>
          </p>
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
            onClick={() => {
              setError(null); // Clear errors when going back
              setStep(1);
            }}
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