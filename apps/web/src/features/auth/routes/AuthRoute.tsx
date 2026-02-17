import { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import axios, { AxiosError } from "axios";

import { login, register } from "../../../shared/api/auth";

type AuthTab = "login" | "register";

type AuthFormState = {
  email: string;
  password: string;
};

type AuthReason = "required" | "expired" | null;

function validateEmail(email: string): string | null {
  if (!email.trim()) return "Email is required.";
  // pragmatic email check; avoids rejecting valid but uncommon emails
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Enter a valid email address.";
  return null;
}

function validatePassword(password: string, tab: AuthTab): string | null {
  if (!password) return "Password is required.";
  if (tab === "register" && password.length < 8) return "Password must be at least 8 characters.";
  return null;
}

function toFriendlyApiError(e: unknown): string {
  if (axios.isAxiosError(e)) {
    const err = e as AxiosError<any>;
    const status = err.response?.status;
    const data = err.response?.data;

    const msgFromApi =
      (typeof data === "object" && data && (data.detail ?? data.message ?? data.error)) ||
      (typeof data === "string" ? data : null);

    if (status === 401) return "Invalid email or password.";
    if (status === 409) return "An account with this email already exists.";
    if (typeof msgFromApi === "string" && msgFromApi.trim().length > 0) return msgFromApi;
    if (status && status >= 500) return "Server error. Please try again in a moment.";
    return "Request failed. Please check your connection and try again.";
  }
  return "Unexpected error. Please try again.";
}

function initialTabFromQuery(tab: string | null): AuthTab {
  return tab === "register" ? "register" : "login";
}

function authReasonFromQuery(reason: string | null): AuthReason {
  if (reason === "required" || reason === "expired") return reason;
  return null;
}

export function AuthRoute() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTab] = useState<AuthTab>(() => initialTabFromQuery(searchParams.get("tab")));
  const [state, setState] = useState<AuthFormState>({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const redirectTo = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const next = sp.get("next");

    if (!next) return "/today";

    // URLSearchParams.get() already decodes percent-encoding.
    // Avoid decodeURIComponent() here to prevent double-decoding ambiguity.

    // Prevent open redirects.
    // - must be a site-relative path
    // - must not be protocol-relative ("//evil.com")
    if (!next.startsWith("/") || next.startsWith("//")) return "/today";

    return next;
  }, [location.search]);

  const authReason = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return authReasonFromQuery(sp.get("reason"));
  }, [location.search]);

  const title = tab === "login" ? "Welcome back" : "Create your account";
  const subtitle = tab === "login" ? "Sign in to continue." : "Create an account to start tracking.";

  const reasonAlert =
    authReason === "expired"
      ? "Your session expired. Please sign in again."
      : authReason === "required"
        ? "Please sign in to continue."
        : null;

  function onChangeTab(next: AuthTab) {
    setTab(next);
    setSubmitError(null);
    setFieldErrors({});
    setSearchParams((prev) => {
      const n = new URLSearchParams(prev);
      n.set("tab", next);
      return n;
    });
  }

  function validateForm(): boolean {
    const emailError = validateEmail(state.email);
    const passwordError = validatePassword(state.password, tab);

    const nextErrors: typeof fieldErrors = {
      ...(emailError ? { email: emailError } : {}),
      ...(passwordError ? { password: passwordError } : {}),
    };

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!validateForm()) return;

    try {
      setSubmitting(true);
      if (tab === "login") await login({ email: state.email.trim(), password: state.password });
      else await register({ email: state.email.trim(), password: state.password });

      navigate(redirectTo, { replace: true });
    } catch (err) {
      setSubmitError(toFriendlyApiError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 4, sm: 6 } }}>
      <Card variant="outlined">
        <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
          <Stack spacing={2.25}>
            <Box>
              <Typography variant="h5" fontWeight={700}>
                {title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            </Box>

            {reasonAlert ? (
              <Alert severity="info" data-testid="auth-reason-alert">
                {reasonAlert}
              </Alert>
            ) : null}

            <Tabs value={tab} onChange={(_, v) => onChangeTab(v)} aria-label="Authentication tabs">
              <Tab label="Sign in" value="login" />
              <Tab label="Create account" value="register" />
            </Tabs>

            <Divider />

            {submitError ? <Alert severity="error">{submitError}</Alert> : null}

            <Box component="form" onSubmit={onSubmit} noValidate>
              <Stack spacing={2}>
                <TextField
                  label="Email"
                  name="email"
                  type="email"
                  autoFocus
                  autoComplete={tab === "login" ? "username" : "email"}
                  value={state.email}
                  onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
                  error={Boolean(fieldErrors.email)}
                  helperText={fieldErrors.email}
                  disabled={submitting}
                  inputProps={{ "data-testid": "auth-email" }}
                />

                <TextField
                  label="Password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
                  value={state.password}
                  onChange={(e) => setState((s) => ({ ...s, password: e.target.value }))}
                  error={Boolean(fieldErrors.password)}
                  helperText={fieldErrors.password ?? (tab === "register" ? "Minimum 8 characters." : "")}
                  disabled={submitting}
                  inputProps={{ "data-testid": "auth-password" }}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            onClick={() => setShowPassword((v) => !v)}
                            edge="end"
                            tabIndex={-1}
                          >
                            {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    },
                  }}
                />

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={submitting}
                  data-testid="auth-submit"
                >
                  {submitting
                    ? tab === "login"
                      ? "Signing in…"
                      : "Creating account…"
                    : tab === "login"
                      ? "Sign in"
                      : "Create account"}
                </Button>

                <Typography variant="caption" color="text.secondary">
                  By continuing, you agree to the app storing tokens locally to keep you signed in.
                </Typography>
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}
