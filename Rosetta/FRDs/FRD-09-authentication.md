# FRD-09: User Authentication System

## Overview

This Feature Requirements Document specifies the user authentication system for Rosetta, built on **Convex Auth**. The system supports OAuth providers (GitHub, Google, Apple) and email/password authentication with email verification and password reset capabilities.

**Related Documents:**
- [PRD](../PRD.md) - Product Requirements Document
- [FRD-08: Convex Migration](./FRD-08-convex-migration.md)

---

## Authentication Methods

### OAuth Providers

| Provider | Features | Implementation |
|----------|----------|----------------|
| **GitHub** | Sign in with GitHub account | Auth.js `@auth/core/providers/github` |
| **Google** | Sign in with Google account | Auth.js `@auth/core/providers/google` |
| **Apple** | Sign in with Apple ID | Auth.js `@auth/core/providers/apple` |

### Email/Password

| Feature | Description |
|---------|-------------|
| **Sign Up** | Create account with email and password |
| **Sign In** | Authenticate with email and password |
| **Email Verification** | OTP code sent via Resend API |
| **Password Reset** | Reset password via email OTP |

---

## User Flows

### 1. Landing Page (Unauthenticated)

**Entry Point:** User visits the application root URL

**Behavior:**
- Unauthenticated users see the landing page
- Landing page showcases product features and value proposition
- "Get Started" and "Sign In" buttons open the auth modal
- Authenticated users are redirected to the main application

### 2. OAuth Sign In Flow

```mermaid
sequenceDiagram
    participant User
    participant App as React App
    participant Convex as Convex Auth
    participant Provider as OAuth Provider

    User->>App: Clicks "Sign in with GitHub"
    App->>Convex: signIn("github")
    Convex->>Provider: Redirect to OAuth consent
    Provider->>User: Show consent screen
    User->>Provider: Approve
    Provider->>Convex: Callback with auth code
    Convex->>Convex: Create/update user
    Convex->>App: Auth success
    App->>User: Redirect to main app
```

**Steps:**
1. User clicks OAuth provider button (GitHub, Google, or Apple)
2. User is redirected to provider's consent screen
3. User approves the application
4. Provider redirects back to Convex callback URL
5. Convex creates or updates user record
6. User is signed in and redirected to main application

### 3. Email/Password Sign Up Flow

```mermaid
sequenceDiagram
    participant User
    participant App as React App
    participant Convex as Convex Auth
    participant Resend as Resend API

    User->>App: Enter email, password
    App->>Convex: signIn("password", {flow: "signUp"})
    Convex->>Convex: Validate, create user
    Convex->>Resend: Send verification OTP
    Resend->>User: Email with OTP code
    Convex->>App: Awaiting verification
    App->>User: Show OTP input form
    User->>App: Enter OTP code
    App->>Convex: signIn("password", {flow: "email-verification"})
    Convex->>Convex: Verify OTP, mark email verified
    Convex->>App: Auth success
    App->>User: Redirect to main app
```

**Steps:**
1. User clicks "Sign up" tab in auth modal
2. User enters email and password
3. System validates input (email format, password strength)
4. System creates user record (unverified)
5. System sends OTP to email via Resend
6. User enters OTP code in verification form
7. System verifies OTP and marks email as verified
8. User is signed in and redirected to main application

### 4. Email/Password Sign In Flow

```mermaid
sequenceDiagram
    participant User
    participant App as React App
    participant Convex as Convex Auth

    User->>App: Enter email, password
    App->>Convex: signIn("password", {flow: "signIn"})
    Convex->>Convex: Validate credentials
    alt Email not verified
        Convex->>App: Requires verification
        App->>User: Show OTP form
    else Email verified
        Convex->>App: Auth success
        App->>User: Redirect to main app
    end
```

**Steps:**
1. User enters email and password
2. System validates credentials
3. If email not verified, redirect to verification flow
4. If verified, user is signed in

### 5. Password Reset Flow

```mermaid
sequenceDiagram
    participant User
    participant App as React App
    participant Convex as Convex Auth
    participant Resend as Resend API

    User->>App: Click "Forgot password?"
    App->>User: Show email input form
    User->>App: Enter email
    App->>Convex: signIn("password", {flow: "reset"})
    Convex->>Resend: Send reset OTP
    Resend->>User: Email with OTP code
    Convex->>App: Awaiting verification
    App->>User: Show OTP + new password form
    User->>App: Enter OTP and new password
    App->>Convex: signIn("password", {flow: "reset-verification"})
    Convex->>Convex: Verify OTP, update password
    Convex->>App: Auth success
    App->>User: Redirect to main app
```

**Steps:**
1. User clicks "Forgot your password?" link
2. User enters email address
3. System sends OTP to email
4. User enters OTP and new password
5. System verifies OTP and updates password
6. User is signed in with new password

### 6. Sign Out Flow

**Steps:**
1. User clicks user menu (avatar)
2. User clicks "Sign Out"
3. System clears authentication state
4. User is redirected to landing page

---

## UI Components

### Auth Modal

The auth modal is the primary authentication interface, appearing as a centered modal overlay.

**Design Specifications:**

```
┌─────────────────────────────────────────────┐
│                     ✕                       │
│                                             │
│       Sign in or create an account          │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │        Continue with GitHub         │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │        Continue with Google         │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │        Continue with Apple          │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ────────── Or continue with ──────────    │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Email                               │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ Password                            │   │
│  └─────────────────────────────────────┘   │
│                                             │
│              Forgot your password?          │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │              Sign in                │   │
│  └─────────────────────────────────────┘   │
│                                             │
│      Don't have an account? Sign up         │
│                                             │
└─────────────────────────────────────────────┘
```

**Component Structure:**

```
AuthModal
├── Header ("Sign in or create an account")
├── OAuthButtons
│   ├── GitHubButton
│   ├── GoogleButton
│   └── AppleButton
├── Divider ("Or continue with")
├── AuthForm (dynamic based on step)
│   ├── SignInForm
│   ├── SignUpForm
│   ├── EmailVerificationForm
│   └── PasswordResetForm
└── Footer (toggle between sign in/sign up)
```

### OAuth Buttons

**Visual Design:**
- Full-width buttons with provider icons
- Provider brand colors on hover
- Clear, consistent spacing

**Button Specifications:**

| Provider | Icon | Label | Hover Color |
|----------|------|-------|-------------|
| GitHub | GitHub logo | "Continue with GitHub" | #24292e |
| Google | Google logo | "Continue with Google" | #4285f4 |
| Apple | Apple logo | "Continue with Apple" | #000000 |

### Email/Password Form

**Fields:**

| Field | Type | Validation | Required |
|-------|------|------------|----------|
| Email | email | Valid email format | Yes |
| Password | password | Min 8 chars, 1 uppercase, 1 lowercase, 1 number | Yes |

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- Visual strength indicator

### Email Verification Form

```
┌─────────────────────────────────────────────┐
│                                             │
│         Verify your email address           │
│                                             │
│    We sent a code to user@example.com       │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Enter verification code             │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │             Verify                  │   │
│  └─────────────────────────────────────┘   │
│                                             │
│            Didn't receive a code?           │
│                 Resend code                 │
│                                             │
└─────────────────────────────────────────────┘
```

### Password Reset Form

**Step 1: Request Reset**
```
┌─────────────────────────────────────────────┐
│                                             │
│          Reset your password                │
│                                             │
│    Enter your email to receive a code       │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Email                               │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │           Send code                 │   │
│  └─────────────────────────────────────┘   │
│                                             │
│           Back to sign in                   │
│                                             │
└─────────────────────────────────────────────┘
```

**Step 2: Enter Code & New Password**
```
┌─────────────────────────────────────────────┐
│                                             │
│          Reset your password                │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │ Verification code                   │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ New password                        │   │
│  └─────────────────────────────────────┘   │
│  ┌─────────────────────────────────────┐   │
│  │ Confirm password                    │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  ┌─────────────────────────────────────┐   │
│  │         Reset password              │   │
│  └─────────────────────────────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

### User Menu

Located in the main application header for authenticated users.

```
┌──────────────────┐
│ [Avatar] User ▼  │
├──────────────────┤
│ ⚙ Settings       │
│ 👤 Profile       │
│ ─────────────── │
│ 🚪 Sign out      │
└──────────────────┘
```

---

## Implementation

### Convex Auth Configuration

```typescript
// convex/auth.config.ts
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
```

### Auth Setup

```typescript
// convex/auth.ts
import GitHub from "@auth/core/providers/github";
import Google from "@auth/core/providers/google";
import Apple from "@auth/core/providers/apple";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { ResendOTP } from "./ResendOTP";
import { ResendOTPPasswordReset } from "./ResendOTPPasswordReset";
import { DataModel } from "./_generated/dataModel";

// Custom password provider with validation
const CustomPassword = Password<DataModel>({
  profile(params) {
    return {
      email: params.email as string,
      name: params.name as string,
    };
  },
  validatePasswordRequirements: (password: string) => {
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }
    if (!/[a-z]/.test(password)) {
      throw new Error("Password must contain a lowercase letter");
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error("Password must contain an uppercase letter");
    }
    if (!/\d/.test(password)) {
      throw new Error("Password must contain a number");
    }
  },
  verify: ResendOTP,
  reset: ResendOTPPasswordReset,
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    GitHub,
    Google,
    Apple,
    CustomPassword,
  ],
});
```

### Email OTP Provider

```typescript
// convex/ResendOTP.ts
import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import { alphabet, generateRandomString } from "oslo/crypto";

export const ResendOTP = Resend({
  id: "resend-otp",
  apiKey: process.env.AUTH_RESEND_KEY,
  
  async generateVerificationToken() {
    return generateRandomString(8, alphabet("0-9"));
  },
  
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);
    
    const { error } = await resend.emails.send({
      from: "Rosetta <noreply@rosetta.app>",
      to: [email],
      subject: "Verify your email for Rosetta",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: 'ABeeZee', Arial, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 40px; }
              .code { 
                font-size: 32px; 
                font-weight: bold; 
                letter-spacing: 4px;
                color: #007E70;
                padding: 20px;
                background: #f5f5f5;
                border-radius: 8px;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Verify your email</h1>
              <p>Enter this code to verify your email and sign in to Rosetta:</p>
              <div class="code">${token}</div>
              <p>This code expires in 10 minutes.</p>
              <p>If you didn't request this code, you can safely ignore this email.</p>
            </div>
          </body>
        </html>
      `,
    });
    
    if (error) {
      throw new Error("Could not send verification email");
    }
  },
});
```

### Password Reset OTP Provider

```typescript
// convex/ResendOTPPasswordReset.ts
import Resend from "@auth/core/providers/resend";
import { Resend as ResendAPI } from "resend";
import { alphabet, generateRandomString } from "oslo/crypto";

export const ResendOTPPasswordReset = Resend({
  id: "resend-otp-password-reset",
  apiKey: process.env.AUTH_RESEND_KEY,
  
  async generateVerificationToken() {
    return generateRandomString(8, alphabet("0-9"));
  },
  
  async sendVerificationRequest({ identifier: email, provider, token }) {
    const resend = new ResendAPI(provider.apiKey);
    
    const { error } = await resend.emails.send({
      from: "Rosetta <noreply@rosetta.app>",
      to: [email],
      subject: "Reset your Rosetta password",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: 'ABeeZee', Arial, sans-serif; }
              .container { max-width: 600px; margin: 0 auto; padding: 40px; }
              .code { 
                font-size: 32px; 
                font-weight: bold; 
                letter-spacing: 4px;
                color: #007E70;
                padding: 20px;
                background: #f5f5f5;
                border-radius: 8px;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Reset your password</h1>
              <p>Enter this code to reset your password:</p>
              <div class="code">${token}</div>
              <p>This code expires in 10 minutes.</p>
              <p>If you didn't request a password reset, you can safely ignore this email.</p>
            </div>
          </body>
        </html>
      `,
    });
    
    if (error) {
      throw new Error("Could not send password reset email");
    }
  },
});
```

### HTTP Routes

```typescript
// convex/http.ts
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();

// Add auth routes (OAuth callbacks, etc.)
auth.addHttpRoutes(http);

export default http;
```

---

## Frontend Components

### Auth Provider Setup

```typescript
// frontend/src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import App from "./App";
import { theme } from "./theme";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConvexAuthProvider client={convex}>
      <BrowserRouter>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <App />
        </ThemeProvider>
      </BrowserRouter>
    </ConvexAuthProvider>
  </React.StrictMode>
);
```

### Auth Modal Component

```typescript
// frontend/src/features/auth/AuthModal.tsx
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  Divider,
  IconButton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { OAuthButtons } from "./OAuthButtons";
import { SignInForm } from "./SignInForm";
import { SignUpForm } from "./SignUpForm";
import { EmailVerification } from "./EmailVerification";
import { PasswordReset } from "./PasswordReset";

type AuthStep = "signIn" | "signUp" | "verify" | "reset" | "resetVerify";

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export function AuthModal({ open, onClose }: AuthModalProps) {
  const [step, setStep] = useState<AuthStep>("signIn");
  const [email, setEmail] = useState("");

  const handleSignUpSuccess = (email: string) => {
    setEmail(email);
    setStep("verify");
  };

  const handleResetRequest = (email: string) => {
    setEmail(email);
    setStep("resetVerify");
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          p: 2,
        },
      }}
    >
      <IconButton
        onClick={onClose}
        sx={{ position: "absolute", right: 16, top: 16 }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent>
        <Box sx={{ textAlign: "center", mb: 4 }}>
          <Typography variant="h5" fontWeight="600">
            {step === "verify"
              ? "Verify your email"
              : step === "reset" || step === "resetVerify"
              ? "Reset your password"
              : "Sign in or create an account"}
          </Typography>
        </Box>

        {(step === "signIn" || step === "signUp") && (
          <>
            <OAuthButtons />
            <Divider sx={{ my: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Or continue with
              </Typography>
            </Divider>
          </>
        )}

        {step === "signIn" && (
          <SignInForm
            onForgotPassword={() => setStep("reset")}
            onSwitchToSignUp={() => setStep("signUp")}
          />
        )}

        {step === "signUp" && (
          <SignUpForm
            onSuccess={handleSignUpSuccess}
            onSwitchToSignIn={() => setStep("signIn")}
          />
        )}

        {step === "verify" && (
          <EmailVerification
            email={email}
            onBack={() => setStep("signIn")}
          />
        )}

        {step === "reset" && (
          <PasswordReset
            onSuccess={handleResetRequest}
            onBack={() => setStep("signIn")}
          />
        )}

        {step === "resetVerify" && (
          <PasswordReset
            email={email}
            isVerifying
            onBack={() => setStep("reset")}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
```

### OAuth Buttons Component

```typescript
// frontend/src/features/auth/OAuthButtons.tsx
import { Button, Stack } from "@mui/material";
import GitHubIcon from "@mui/icons-material/GitHub";
import GoogleIcon from "@mui/icons-material/Google";
import AppleIcon from "@mui/icons-material/Apple";
import { useAuthActions } from "@convex-dev/auth/react";

export function OAuthButtons() {
  const { signIn } = useAuthActions();

  return (
    <Stack spacing={2}>
      <Button
        variant="outlined"
        fullWidth
        startIcon={<GitHubIcon />}
        onClick={() => signIn("github")}
        sx={{
          py: 1.5,
          borderColor: "grey.300",
          color: "text.primary",
          "&:hover": {
            borderColor: "#24292e",
            backgroundColor: "rgba(36, 41, 46, 0.04)",
          },
        }}
      >
        Continue with GitHub
      </Button>

      <Button
        variant="outlined"
        fullWidth
        startIcon={<GoogleIcon />}
        onClick={() => signIn("google")}
        sx={{
          py: 1.5,
          borderColor: "grey.300",
          color: "text.primary",
          "&:hover": {
            borderColor: "#4285f4",
            backgroundColor: "rgba(66, 133, 244, 0.04)",
          },
        }}
      >
        Continue with Google
      </Button>

      <Button
        variant="outlined"
        fullWidth
        startIcon={<AppleIcon />}
        onClick={() => signIn("apple")}
        sx={{
          py: 1.5,
          borderColor: "grey.300",
          color: "text.primary",
          "&:hover": {
            borderColor: "#000000",
            backgroundColor: "rgba(0, 0, 0, 0.04)",
          },
        }}
      >
        Continue with Apple
      </Button>
    </Stack>
  );
}
```

### Sign In Form Component

```typescript
// frontend/src/features/auth/SignInForm.tsx
import { useState } from "react";
import {
  Box,
  TextField,
  Button,
  Link,
  Typography,
  Alert,
} from "@mui/material";
import { useAuthActions } from "@convex-dev/auth/react";

interface SignInFormProps {
  onForgotPassword: () => void;
  onSwitchToSignUp: () => void;
}

export function SignInForm({
  onForgotPassword,
  onSwitchToSignUp,
}: SignInFormProps) {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.set("email", email);
      formData.set("password", password);
      formData.set("flow", "signIn");

      await signIn("password", formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <TextField
        label="Email"
        type="email"
        fullWidth
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        sx={{ mb: 2 }}
      />

      <TextField
        label="Password"
        type="password"
        fullWidth
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        sx={{ mb: 1 }}
      />

      <Box sx={{ textAlign: "right", mb: 2 }}>
        <Link
          component="button"
          type="button"
          variant="body2"
          onClick={onForgotPassword}
        >
          Forgot your password?
        </Link>
      </Box>

      <Button
        type="submit"
        variant="contained"
        fullWidth
        size="large"
        disabled={loading}
        sx={{ mb: 3 }}
      >
        {loading ? "Signing in..." : "Sign in"}
      </Button>

      <Typography variant="body2" textAlign="center">
        Don't have an account?{" "}
        <Link component="button" type="button" onClick={onSwitchToSignUp}>
          Sign up
        </Link>
      </Typography>
    </Box>
  );
}
```

---

## Authorization

### Protected Routes

```typescript
// frontend/src/App.tsx
import { useConvexAuth } from "convex/react";
import { Navigate, Routes, Route } from "react-router-dom";
import { LandingPage } from "./features/landing/LandingPage";
import { MainLayout } from "./components/layout/MainLayout";

function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <Navigate to="/home" replace />
          ) : (
            <LandingPage />
          )
        }
      />
      <Route
        path="/home"
        element={
          isAuthenticated ? (
            <MainLayout />
          ) : (
            <Navigate to="/" replace />
          )
        }
      />
      {/* Other protected routes */}
    </Routes>
  );
}
```

### Convex Query Authorization

All Convex queries and mutations require authentication:

```typescript
// convex/folders.ts
export const list = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }
    
    // Only return folders owned by this user
    return await ctx.db
      .query("folders")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});
```

---

## Environment Variables

### Convex Dashboard

```bash
# Site URL (for OAuth redirects)
SITE_URL=http://localhost:5173

# JWT Keys (generated via script)
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
JWKS={"keys":[...]}

# GitHub OAuth
AUTH_GITHUB_ID=your_github_client_id
AUTH_GITHUB_SECRET=your_github_client_secret

# Google OAuth
AUTH_GOOGLE_ID=your_google_client_id
AUTH_GOOGLE_SECRET=your_google_client_secret

# Apple OAuth
AUTH_APPLE_ID=your_apple_client_id
AUTH_APPLE_SECRET=your_apple_client_secret

# Resend (for email OTPs)
AUTH_RESEND_KEY=your_resend_api_key
```

### Frontend (.env)

```bash
VITE_CONVEX_URL=https://your-project.convex.cloud
```

---

## Security Considerations

### Password Security
- Passwords hashed using secure algorithms (handled by Convex Auth)
- Minimum strength requirements enforced
- Rate limiting on failed attempts

### OAuth Security
- PKCE flow for OAuth providers
- State parameter validation
- Secure token storage

### Session Security
- JWT tokens with short expiration
- Secure cookie settings
- CSRF protection

### Email Security
- OTP codes expire after 10 minutes
- Rate limiting on OTP requests
- No sensitive data in emails

---

## Error Handling

| Error | User Message |
|-------|-------------|
| Invalid credentials | "Invalid email or password" |
| Email already exists | "An account with this email already exists" |
| Invalid OTP | "Invalid verification code" |
| OTP expired | "Verification code has expired. Please request a new one." |
| Rate limited | "Too many attempts. Please try again later." |
| OAuth error | "Sign in failed. Please try again." |

---

## Testing Strategy

### Unit Tests
- Form validation logic
- Password strength validation
- Error handling

### Integration Tests
- OAuth flow (mock providers)
- Email/password sign up/sign in
- Password reset flow

### E2E Tests
- Complete sign up flow
- Complete sign in flow
- Password reset flow
- Protected route access

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-31 | Rosetta Team | Initial FRD for authentication system |
