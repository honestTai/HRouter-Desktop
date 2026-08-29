import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CircleDollarSign,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { HRouterAccountGate } from "@/components/hrouter/HRouterAccountGate";
import { HRouterPageShell } from "@/components/hrouter/HRouterPageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHRouterSession } from "@/hooks/useHRouterSession";
import { hrouterAccountApi } from "@/lib/api/hrouterPlatform";
import { extractErrorMessage } from "@/utils/errorUtils";

export function HRouterProfilePage() {
  const { t } = useTranslation();
  const session = useHRouterSession();
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const profile = useQuery({
    queryKey: ["hrouter-account", session?.user.id, "profile"],
    queryFn: hrouterAccountApi.profile,
    enabled: Boolean(session),
  });

  useEffect(() => {
    if (profile.data?.username) setUsername(profile.data.username);
  }, [profile.data?.username]);

  const updateProfile = useMutation({
    mutationFn: () => hrouterAccountApi.updateProfile(username.trim()),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["hrouter-account"] });
      toast.success(
        t("hrouterPlatform.profileUpdated", {
          defaultValue: "个人资料已更新",
        }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });
  const changePassword = useMutation({
    mutationFn: () =>
      hrouterAccountApi.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(
        t("hrouterPlatform.passwordUpdated", {
          defaultValue: "密码已修改",
        }),
      );
    },
    onError: (error) => toast.error(extractErrorMessage(error)),
  });

  const passwordError =
    newPassword.length > 0 && newPassword.length < 8
      ? t("hrouterPlatform.passwordMinLength", {
          defaultValue: "新密码至少 8 位",
        })
      : confirmPassword.length > 0 && newPassword !== confirmPassword
        ? t("hrouterPlatform.passwordMismatch", {
            defaultValue: "两次输入的密码不一致",
          })
        : "";
  const canChangePassword =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirmPassword;

  return (
    <HRouterAccountGate>
      <HRouterPageShell
        onRefresh={() => void profile.refetch()}
        refreshing={profile.isFetching}
      >
        {profile.isLoading ? (
          <div className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t("common.loading", { defaultValue: "加载中..." })}
          </div>
        ) : profile.error ? (
          <div className="border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-600">
            {extractErrorMessage(profile.error)}
          </div>
        ) : (
          <div className="space-y-5" data-tour="profile-content">
            <section className="grid gap-px overflow-hidden rounded-md border border-border-default bg-border-default sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: t("hrouterPlatform.account", {
                    defaultValue: "账户",
                  }),
                  value: profile.data?.username || "-",
                  icon: UserRound,
                },
                {
                  label: t("hrouterPlatform.email", {
                    defaultValue: "邮箱",
                  }),
                  value: profile.data?.email || "-",
                  icon: Mail,
                },
                {
                  label: t("hrouterPlatform.balance", {
                    defaultValue: "可用余额",
                  }),
                  value: `¥${Number(profile.data?.balance || 0).toFixed(2)}`,
                  icon: CircleDollarSign,
                },
                {
                  label: t("hrouterPlatform.accountStatus", {
                    defaultValue: "账户状态",
                  }),
                  value: profile.data?.status === "active" ? "正常" : "已停用",
                  icon: ShieldCheck,
                },
              ].map((item) => (
                <div key={item.label} className="min-w-0 bg-background p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </div>
                  <p className="mt-2 truncate text-sm font-semibold">
                    {item.value}
                  </p>
                </div>
              ))}
            </section>

            <div className="grid gap-5 xl:grid-cols-2">
              <section className="rounded-md border border-border-default bg-background p-5">
                <div className="mb-5 flex items-center gap-3 border-b border-border-default pb-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-500/10 text-blue-600">
                    <UserRound className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">
                      {t("hrouterPlatform.profileDetails", {
                        defaultValue: "个人资料",
                      })}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      ID: {profile.data?.id ?? "-"}
                    </p>
                  </div>
                </div>
                <Label htmlFor="profile-username">
                  {t("hrouterPlatform.username", { defaultValue: "用户名" })}
                </Label>
                <Input
                  id="profile-username"
                  className="mt-2"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                />
                <Button
                  className="mt-4"
                  disabled={!username.trim() || updateProfile.isPending}
                  onClick={() => updateProfile.mutate()}
                >
                  {updateProfile.isPending && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {t("hrouterPlatform.updateProfile", {
                    defaultValue: "更新资料",
                  })}
                </Button>
              </section>

              <section className="rounded-md border border-border-default bg-background p-5">
                <div className="mb-5 flex items-center gap-3 border-b border-border-default pb-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600">
                    <KeyRound className="h-4.5 w-4.5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-semibold">
                      {t("hrouterPlatform.securitySettings", {
                        defaultValue: "安全设置",
                      })}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t("hrouterPlatform.passwordHint", {
                        defaultValue: "修改 HRouter 账户登录密码",
                      })}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="current-password">当前密码</Label>
                    <Input
                      id="current-password"
                      type="password"
                      className="mt-2"
                      value={currentPassword}
                      onChange={(event) =>
                        setCurrentPassword(event.target.value)
                      }
                      autoComplete="current-password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new-password">新密码</Label>
                    <Input
                      id="new-password"
                      type="password"
                      className="mt-2"
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <Label htmlFor="confirm-password">确认新密码</Label>
                    <Input
                      id="confirm-password"
                      type="password"
                      className="mt-2"
                      value={confirmPassword}
                      onChange={(event) =>
                        setConfirmPassword(event.target.value)
                      }
                      autoComplete="new-password"
                    />
                  </div>
                </div>
                {passwordError && (
                  <p className="mt-2 text-xs text-red-500">{passwordError}</p>
                )}
                <Button
                  className="mt-4"
                  disabled={!canChangePassword || changePassword.isPending}
                  onClick={() => changePassword.mutate()}
                >
                  {changePassword.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LockKeyhole className="h-4 w-4" />
                  )}
                  {t("hrouterPlatform.changePassword", {
                    defaultValue: "修改密码",
                  })}
                </Button>
              </section>
            </div>
          </div>
        )}
      </HRouterPageShell>
    </HRouterAccountGate>
  );
}
