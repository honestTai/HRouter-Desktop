import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import hrouterLogo from "@/assets/icons/hrouter.svg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHRouterSession } from "@/hooks/useHRouterSession";
import { hrouterAuthApi } from "@/lib/api/hrouterPlatform";
import { extractErrorMessage } from "@/utils/errorUtils";

export function HRouterAccountGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const session = useHRouterSession();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [countdown, setCountdown] = useState(0);

  const settings = useQuery({
    queryKey: ["hrouter-account", "public-settings"],
    queryFn: hrouterAuthApi.publicSettings,
    staleTime: 10 * 60 * 1000,
  });

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(
      () => setCountdown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [countdown]);

  const auth = useMutation({
    mutationFn: () =>
      mode === "login"
        ? hrouterAuthApi.login(email.trim(), password)
        : hrouterAuthApi.register(email.trim(), password, verifyCode.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hrouter-account"] });
      toast.success(
        mode === "login"
          ? t("hrouterAccount.loginSuccess", { defaultValue: "登录成功" })
          : t("hrouterAccount.registerSuccess", {
              defaultValue: "注册成功",
            }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const sendCode = useMutation({
    mutationFn: () => hrouterAuthApi.sendVerifyCode(email.trim()),
    onSuccess: (result) => {
      setCountdown(result.countdown || 60);
      toast.success(
        t("hrouterAccount.codeSent", {
          defaultValue: "验证码已发送，请检查邮箱",
        }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  if (session) return <>{children}</>;

  const registrationEnabled = settings.data?.registration_enabled !== false;
  const emailVerifyEnabled = settings.data?.email_verify_enabled === true;
  const canSubmit =
    email.trim().includes("@") &&
    password.length >= 8 &&
    (mode === "login" || !emailVerifyEnabled || verifyCode.trim().length > 0);

  return (
    <div className="flex h-full overflow-y-auto bg-muted/20 px-6 py-8">
      <div className="m-auto w-full max-w-sm rounded-lg border border-border-default bg-background p-7 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <img
            src={hrouterLogo}
            alt="HRouter"
            className="h-10 w-10 rounded-md"
          />
          <h2 className="text-xl font-semibold">
            {t("hrouterAccount.welcome", {
              defaultValue: "登录 HRouter",
            })}
          </h2>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canSubmit) auth.mutate();
          }}
        >
          <div className="grid grid-cols-2 rounded-md bg-muted p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={
                mode === "login"
                  ? "bg-background text-foreground shadow-sm"
                  : ""
              }
              onClick={() => setMode("login")}
            >
              {t("hrouterAccount.login", { defaultValue: "登录" })}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={!registrationEnabled}
              className={
                mode === "register"
                  ? "bg-background text-foreground shadow-sm"
                  : ""
              }
              onClick={() => setMode("register")}
            >
              {t("hrouterAccount.register", { defaultValue: "注册" })}
            </Button>
          </div>

          <div className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="hrouter-email">
                {t("hrouterAccount.email", { defaultValue: "邮箱" })}
              </Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="hrouter-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="pl-9"
                  autoComplete="email"
                  placeholder="name@example.com"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hrouter-password">
                {t("hrouterAccount.password", { defaultValue: "密码" })}
              </Label>
              <Input
                id="hrouter-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                placeholder={t("hrouterAccount.passwordHint", {
                  defaultValue: "至少 8 位",
                })}
              />
            </div>
            {mode === "register" && emailVerifyEnabled && (
              <div className="space-y-1.5">
                <Label htmlFor="hrouter-code">
                  {t("hrouterAccount.verifyCode", {
                    defaultValue: "邮箱验证码",
                  })}
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="hrouter-code"
                    value={verifyCode}
                    onChange={(event) => setVerifyCode(event.target.value)}
                    inputMode="numeric"
                    maxLength={8}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    disabled={
                      !email.trim().includes("@") ||
                      countdown > 0 ||
                      sendCode.isPending
                    }
                    onClick={() => sendCode.mutate()}
                  >
                    {countdown > 0
                      ? `${countdown}s`
                      : t("hrouterAccount.sendCode", {
                          defaultValue: "发送验证码",
                        })}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Button
            type="submit"
            className="mt-6 w-full"
            disabled={!canSubmit || auth.isPending || settings.isLoading}
          >
            {auth.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login"
              ? t("hrouterAccount.login", { defaultValue: "登录" })
              : t("hrouterAccount.createAccount", {
                  defaultValue: "创建账户",
                })}
          </Button>
          {settings.isError && (
            <p className="mt-3 text-xs leading-5 text-red-500">
              {t("hrouterAccount.settingsUnavailable", {
                defaultValue: "暂时无法读取注册配置，请检查网络后重试。",
              })}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
