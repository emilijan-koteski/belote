import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { FetchError } from "@/shared/api/axiosClient";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useRegisterMutation } from "@/shared/hooks/mutations/useAuth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;

interface FieldErrors {
  email?: string;
  username?: string;
  password?: string;
  consent?: string;
}

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const registerMutation = useRegisterMutation();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  function validateEmail(value: string): string | undefined {
    if (!value) return t("auth.register.errors.emailRequired");
    if (!EMAIL_REGEX.test(value)) return t("auth.register.errors.emailInvalid");
    return undefined;
  }

  function validateUsername(value: string): string | undefined {
    if (!value) return t("auth.register.errors.usernameRequired");
    if (value.length < 3) return t("auth.register.errors.usernameTooShort");
    if (value.length > 20) return t("auth.register.errors.usernameTooLong");
    if (!USERNAME_REGEX.test(value)) return t("auth.register.errors.usernameInvalidChars");
    return undefined;
  }

  function validatePassword(value: string): string | undefined {
    if (!value) return t("auth.register.errors.passwordRequired");
    if (value.length < 8) return t("auth.register.errors.passwordTooShort");
    if (value.length > 72) return t("auth.register.errors.passwordTooLong");
    return undefined;
  }

  function handleBlur(field: keyof FieldErrors) {
    let error: string | undefined;
    if (field === "email") error = validateEmail(email);
    if (field === "username") error = validateUsername(username);
    if (field === "password") error = validatePassword(password);

    setErrors((prev) => ({ ...prev, [field]: error }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const emailError = validateEmail(email);
    const usernameError = validateUsername(username);
    const passwordError = validatePassword(password);
    const consentError = acceptedTerms ? undefined : t("auth.register.errors.consentRequired");

    if (emailError || usernameError || passwordError || consentError) {
      setErrors({
        email: emailError,
        username: usernameError,
        password: passwordError,
        consent: consentError,
      });
      return;
    }

    setErrors({});

    try {
      await registerMutation.mutateAsync({ email, username, password });
      navigate("/lobby");
    } catch (err) {
      if (err instanceof FetchError) {
        if (err.code === "EMAIL_TAKEN") {
          setErrors({ email: t("auth.register.errors.emailTaken") });
        } else if (err.code === "USERNAME_TAKEN") {
          setErrors({ username: t("auth.register.errors.usernameTaken") });
        } else if (err.code === "INVALID_EMAIL") {
          setErrors({ email: t("auth.register.errors.emailInvalid") });
        } else if (err.code === "PASSWORD_TOO_SHORT") {
          setErrors({ password: t("auth.register.errors.passwordTooShort") });
        } else if (err.code === "PASSWORD_TOO_LONG") {
          setErrors({ password: t("auth.register.errors.passwordTooLong") });
        } else if (err.code === "USERNAME_TOO_SHORT") {
          setErrors({ username: t("auth.register.errors.usernameTooShort") });
        } else if (err.code === "USERNAME_TOO_LONG") {
          setErrors({ username: t("auth.register.errors.usernameTooLong") });
        } else if (err.code === "USERNAME_INVALID_CHARS") {
          setErrors({ username: t("auth.register.errors.usernameInvalidChars") });
        } else {
          toast.error(t("auth.register.errors.registrationFailed"));
        }
      } else {
        toast.error(t("auth.register.errors.registrationFailed"));
      }
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-100 rounded-xl bg-surface p-8">
        <h1
          className="mb-6 text-center font-display text-2xl font-bold text-text-primary"
          data-testid="register-title"
        >
          {t("auth.register.title")}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid="register-form">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-text-secondary">
              {t("auth.register.emailLabel")}
            </label>
            <Input
              id="email"
              type="email"
              placeholder={t("auth.register.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => handleBlur("email")}
              aria-invalid={!!errors.email}
              data-testid="email-input"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-destructive" data-testid="email-error">
                {errors.email}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="username" className="mb-1 block text-sm text-text-secondary">
              {t("auth.register.usernameLabel")}
            </label>
            <Input
              id="username"
              type="text"
              placeholder={t("auth.register.usernamePlaceholder")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => handleBlur("username")}
              aria-invalid={!!errors.username}
              data-testid="username-input"
            />
            {errors.username && (
              <p className="mt-1 text-xs text-destructive" data-testid="username-error">
                {errors.username}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm text-text-secondary">
              {t("auth.register.passwordLabel")}
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={t("auth.register.passwordPlaceholder")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => handleBlur("password")}
                aria-invalid={!!errors.password}
                data-testid="password-input"
              />
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                onClick={() => setShowPassword(!showPassword)}
                data-testid="password-toggle"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-destructive" data-testid="password-error">
                {errors.password}
              </p>
            )}
          </div>

          <div>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                className="mt-0.5 size-4 cursor-pointer accent-primary"
                checked={acceptedTerms}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setAcceptedTerms(checked);
                  if (checked) {
                    setErrors((prev) => ({ ...prev, consent: undefined }));
                  }
                }}
                aria-invalid={!!errors.consent}
                data-testid="consent-checkbox"
              />
              <span>
                {t("auth.register.consent.prefix")}
                <Link
                  to="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                  data-testid="terms-link"
                >
                  {t("auth.register.consent.termsLink")}
                </Link>
                {t("auth.register.consent.and")}
                <Link
                  to="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                  data-testid="privacy-link"
                >
                  {t("auth.register.consent.privacyLink")}
                </Link>
                {t("auth.register.consent.suffix")}
              </span>
            </label>
            {errors.consent && (
              <p className="mt-1 text-xs text-destructive" data-testid="consent-error">
                {errors.consent}
              </p>
            )}
          </div>

          <Button
            type="submit"
            className="mt-2 h-10 w-full bg-primary text-primary-foreground font-semibold hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={registerMutation.isPending || !acceptedTerms}
            data-testid="submit-button"
          >
            {registerMutation.isPending
              ? t("auth.register.submitting")
              : t("auth.register.submitButton")}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          <Link to="/login" className="text-primary hover:underline" data-testid="login-link">
            {t("auth.register.loginLink")}
          </Link>
        </p>
      </div>

      <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-text-secondary">
        Crafted with 💚 by Emilijan Koteski
      </p>
    </div>
  );
}
