import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { User, X, LogIn, UserPlus, ShieldCheck } from "lucide-react";
import type { UserInfo, Language } from "../types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (user: UserInfo) => void;
  language: Language;
}

export default function AuthModal({ isOpen, onClose, onLogin, language }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const isZh = language === "zh";

  const t = {
    login: isZh ? "登录" : "Login",
    register: isZh ? "注册" : "Register",
    switchToRegister: isZh ? "没有账号？注册一个" : "No account? Register",
    switchToLogin: isZh ? "已有账号？去登录" : "Have an account? Login",
    username: isZh ? "用户名" : "Username",
    password: isZh ? "密码" : "Password",
    invitationCode: isZh ? "邀请码" : "Invitation Code",
    usernamePlaceholder: isZh ? "输入用户名" : "Enter username",
    passwordPlaceholder: isZh ? "输入密码（至少4位）" : "Enter password (min 4 chars)",
    invitationPlaceholder: isZh ? "输入邀请码" : "Enter invitation code",
    loginBtn: isZh ? "登录" : "Login",
    registerBtn: isZh ? "注册" : "Register",
    loggingIn: isZh ? "登录中..." : "Logging in...",
    registering: isZh ? "注册中..." : "Registering...",
    success: isZh ? "注册成功！正在登录..." : "Registered! Logging in...",
    registerBenefits: isZh
      ? "注册后你可以：\n• 上传自定义哲学家到共享池，与其他人分享\n• 将会话进度保存到云端，随时恢复\n• 浏览和使用其他用户分享的哲学家"
      : "After registering you can:\n• Upload custom philosophers to the shared pool\n• Save session progress to the cloud\n• Browse and use philosophers shared by others",
    privacy: isZh
      ? "你的云端会话仅自己可见，其他用户无法查看"
      : "Your cloud sessions are private — only you can view them",
  };

  const resetForm = () => {
    setUsername("");
    setPassword("");
    setInvitationCode("");
    setError("");
    setSuccessMsg("");
    setLoading(false);
  };

  const switchMode = () => {
    resetForm();
    setMode(mode === "login" ? "register" : "login");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!username.trim()) {
      setError(isZh ? "请输入用户名" : "Please enter a username");
      return;
    }
    if (!password || password.length < 4) {
      setError(isZh ? "密码至少需要4个字符" : "Password must be at least 4 characters");
      return;
    }
    if (mode === "register" && !invitationCode.trim()) {
      setError(isZh ? "请输入邀请码" : "Please enter an invitation code");
      return;
    }

    setLoading(true);

    try {
      let response: Response;
      if (mode === "login") {
        response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: username.trim(), password }),
        });
      } else {
        response = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: username.trim(),
            password,
            invitationCode: invitationCode.trim(),
          }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      if (mode === "register") {
        setSuccessMsg(t.success);
        setTimeout(() => {
          onLogin(data);
        }, 800);
      } else {
        onLogin(data);
      }
    } catch (err: any) {
      setError(err.message || (isZh ? "请求失败，请重试" : "Request failed, please try again"));
    } finally {
      if (mode === "login") setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
          >
            {/* Header */}
            <div className="flex justify-between items-center p-5 border-b border-neutral-100">
              <h3 className="text-lg font-semibold text-neutral-900 flex items-center gap-2">
                {mode === "login" ? (
                  <LogIn className="w-5 h-5 text-neutral-700" />
                ) : (
                  <UserPlus className="w-5 h-5 text-neutral-700" />
                )}
                {mode === "login" ? t.login : t.register}
              </h3>
              <button
                onClick={handleClose}
                className="text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Username */}
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    {t.username}
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t.usernamePlaceholder}
                    maxLength={30}
                    autoFocus
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-neutral-800 focus:border-neutral-800 transition-all"
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    {t.password}
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t.passwordPlaceholder}
                    className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-neutral-800 focus:border-neutral-800 transition-all"
                  />
                </div>

                {/* Invitation Code (register only) */}
                {mode === "register" && (
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 mb-1">
                      {t.invitationCode}
                    </label>
                    <input
                      type="text"
                      value={invitationCode}
                      onChange={(e) =>
                        setInvitationCode(e.target.value.toUpperCase())
                      }
                      placeholder={t.invitationPlaceholder}
                      className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-neutral-800 focus:border-neutral-800 transition-all tracking-wide"
                    />
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-100">
                    {error}
                  </div>
                )}

                {/* Success */}
                {successMsg && (
                  <div className="p-3 rounded-lg bg-green-50 text-green-600 text-sm font-medium border border-green-100">
                    {successMsg}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !!successMsg}
                  className="w-full py-2.5 px-4 rounded-lg bg-neutral-900 text-white font-medium text-sm hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading
                    ? mode === "login"
                      ? t.loggingIn
                      : t.registering
                    : mode === "login"
                    ? t.loginBtn
                    : t.registerBtn}
                </button>
              </form>
            </div>

            {/* Register Benefits (register mode only) */}
            {mode === "register" && (
              <div className="px-6 pb-2">
                <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                  <p className="text-xs text-indigo-800 whitespace-pre-line leading-relaxed">
                    {t.registerBenefits}
                  </p>
                  <div className="mt-3 flex items-start gap-2 text-[11px] text-indigo-600">
                    <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{t.privacy}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Footer - Switch mode */}
            <div className="p-4 bg-neutral-50 border-t border-neutral-100 text-center">
              <button
                type="button"
                onClick={switchMode}
                className="text-sm text-neutral-600 hover:text-neutral-900 underline underline-offset-4 transition-colors"
              >
                {mode === "login" ? t.switchToRegister : t.switchToLogin}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
