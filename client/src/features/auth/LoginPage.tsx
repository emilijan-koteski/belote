import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { FetchError } from "@/shared/api/axiosClient";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { useLoginMutation } from "@/shared/hooks/mutations/useAuth";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  email?: string;
  password?: string;
}

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  function validateEmail(value: string): string | undefined {
    if (!value) return t("auth.login.errors.emailRequired");
    if (!EMAIL_REGEX.test(value)) return t("auth.login.errors.emailInvalid");
    return undefined;
  }

  function validatePassword(value: string): string | undefined {
    if (!value) return t("auth.login.errors.passwordRequired");
    return undefined;
  }

  function handleBlur(field: keyof FieldErrors) {
    let error: string | undefined;
    if (field === "email") error = validateEmail(email);
    if (field === "password") error = validatePassword(password);

    setErrors((prev) => ({ ...prev, [field]: error }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (emailError || passwordError) {
      setErrors({ email: emailError, password: passwordError });
      return;
    }

    setErrors({});
    setFormError(null);

    try {
      await loginMutation.mutateAsync({ email, password });
      navigate("/lobby");
    } catch (err) {
      if (err instanceof FetchError) {
        if (err.status === 401) {
          setFormError(t("auth.login.errors.invalidCredentials"));
        } else {
          toast.error(t("auth.login.errors.loginFailed"));
        }
      } else {
        toast.error(t("auth.login.errors.loginFailed"));
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-100 rounded-xl bg-surface p-8">
        <h1
          className="mb-6 text-center font-display text-2xl font-bold text-text-primary"
          data-testid="login-title"
        >
          {t("auth.login.title")}
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4" data-testid="login-form">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm text-text-secondary">
              {t("auth.login.emailLabel")}
            </label>
            <Input
              id="email"
              type="email"
              placeholder={t("auth.login.emailPlaceholder")}
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
            <label htmlFor="password" className="mb-1 block text-sm text-text-secondary">
              {t("auth.login.passwordLabel")}
            </label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder={t("auth.login.passwordPlaceholder")}
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

          {formError && (
            <p className="text-xs text-destructive" data-testid="form-error">
              {formError}
            </p>
          )}

          <Button
            type="submit"
            className="mt-2 h-10 w-full bg-primary text-primary-foreground font-semibold hover:bg-primary/80 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={loginMutation.isPending}
            data-testid="submit-button"
          >
            {loginMutation.isPending ? t("auth.login.submitting") : t("auth.login.submitButton")}
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-text-secondary">
          <Link to="/register" className="text-primary hover:underline" data-testid="register-link">
            {t("auth.login.registerLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
