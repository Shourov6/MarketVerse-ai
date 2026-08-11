import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { Loader2, Eye, EyeOff, KeyRound, CheckCircle2, ArrowRight, Sparkles, Smartphone, Lock, ShieldCheck, Zap, Store } from "lucide-react";
import { toast } from "sonner";

const demoAccounts = [
  {
    label: "Seller Demo",
    phone: "01700000001",
    password: "seller123",
    role: "Seller Dashboard",
    icon: Store,
    badge: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  },
  {
    label: "Admin Demo",
    phone: "01700000006",
    password: "admin123",
    role: "Admin Control Panel",
    icon: ShieldCheck,
    badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  },
];

export default function Login() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState(() => {
    try {
      return localStorage.getItem("marketverse_remember_phone") || "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const utils = trpc.useUtils();

  const login = trpc.auth.login.useMutation({
    onSuccess: (data) => {
      utils.auth.me.invalidate();
      toast.success(`Welcome back, ${data.role}!`);
      if (data.role === "seller") {
        navigate("/seller");
      } else if (data.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    },
    onError: (err) => {
      setError(err.message || "Unable to sign in.");
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (rememberMe) {
      try {
        localStorage.setItem("marketverse_remember_phone", phone);
      } catch {}
    } else {
      try {
        localStorage.removeItem("marketverse_remember_phone");
      } catch {}
    }
    login.mutate({ phone, password });
  };

  // Google Modal State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleName, setGoogleName] = useState("");

  const googleAuthMutation = trpc.auth.googleAuth.useMutation({
    onSuccess: (data) => {
      utils.auth.me.invalidate();
      toast.success(`Welcome back, ${data.name}! Signed in via Google.`);
      setShowGoogleModal(false);
      if (data.role === "seller") {
        navigate("/seller");
      } else if (data.role === "admin") {
        navigate("/admin");
      } else {
        navigate("/dashboard");
      }
    },
    onError: (err) => {
      setError(err.message || "Google sign-in failed.");
    },
  });

  const handleGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmail.trim()) {
      toast.error("Please enter your Google email address");
      return;
    }
    const name = googleName.trim() || googleEmail.split("@")[0];
    googleAuthMutation.mutate({
      email: googleEmail.trim().toLowerCase(),
      name,
      googleId: `google_${googleEmail.trim().replace(/[^a-zA-Z0-9]/g, "_")}`,
    });
  };

  // Forgot Password State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotIdentifier, setForgotIdentifier] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [demoOtpCode, setDemoOtpCode] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const requestOtpMutation = trpc.auth.requestPasswordResetOtp.useMutation({
    onSuccess: (data) => {
      setDemoOtpCode(data.demoOtp);
      toast.success(`OTP Code Sent to ${data.email}! Code: ${data.demoOtp}`);
      setForgotStep(2);
      setForgotError("");
    },
    onError: (err) => {
      setForgotError(err.message || "Failed to send OTP.");
    },
  });

  const verifyOtpMutation = trpc.auth.verifyResetOtp.useMutation({
    onSuccess: () => {
      toast.success("OTP Verified successfully!");
      setForgotStep(3);
      setForgotError("");
    },
    onError: (err) => {
      setForgotError(err.message || "Invalid OTP.");
    },
  });

  const resetPasswordMutation = trpc.auth.resetPasswordWithOtp.useMutation({
    onSuccess: () => {
      toast.success("Password reset successfully! You can now log in with your new password.");
      setShowForgotModal(false);
      if (forgotIdentifier.match(/^\d+$/)) {
        setPhone(forgotIdentifier);
      }
      setPassword(forgotNewPassword);
      setForgotStep(1);
      setForgotIdentifier("");
      setForgotOtp("");
      setForgotNewPassword("");
      setForgotConfirmPassword("");
      setDemoOtpCode("");
      setForgotError("");
    },
    onError: (err) => {
      setForgotError(err.message || "Failed to reset password.");
    },
  });

  const handleForgotStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotIdentifier.trim()) {
      setForgotError("Please enter your registered email or BD number.");
      return;
    }
    setForgotError("");
    requestOtpMutation.mutate({ identifier: forgotIdentifier.trim() });
  };

  const handleForgotStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotOtp.trim().length !== 6) {
      setForgotError("Please enter the 6-digit OTP code.");
      return;
    }
    setForgotError("");
    verifyOtpMutation.mutate({
      identifier: forgotIdentifier.trim(),
      otp: forgotOtp.trim(),
    });
  };

  const handleForgotStep3 = (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotNewPassword.length < 6) {
      setForgotError("Password must be at least 6 characters long.");
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError("Passwords do not match.");
      return;
    }
    setForgotError("");
    resetPasswordMutation.mutate({
      identifier: forgotIdentifier.trim(),
      otp: forgotOtp.trim(),
      newPassword: forgotNewPassword,
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 lg:p-8 relative overflow-hidden transition-colors">
      {/* Glow Orbs */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-indigo-600/15 dark:bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-600/15 dark:bg-purple-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20 mb-3 shadow-inner">
                <KeyRound className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Reset Your Password</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {forgotStep === 1 && "Enter your registered Email or BD phone number to receive a 6-digit OTP."}
                {forgotStep === 2 && `Enter the 6-digit OTP sent to ${forgotIdentifier}.`}
                {forgotStep === 3 && "Set a new secure password for your account."}
              </p>
              
              {/* Step indicator */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <span className={`h-2 rounded-full transition-all ${forgotStep === 1 ? "w-8 bg-indigo-600 dark:bg-indigo-500" : "w-2 bg-slate-200 dark:bg-slate-800"}`} />
                <span className={`h-2 rounded-full transition-all ${forgotStep === 2 ? "w-8 bg-indigo-600 dark:bg-indigo-500" : "w-2 bg-slate-200 dark:bg-slate-800"}`} />
                <span className={`h-2 rounded-full transition-all ${forgotStep === 3 ? "w-8 bg-indigo-600 dark:bg-indigo-500" : "w-2 bg-slate-200 dark:bg-slate-800"}`} />
              </div>
            </div>

            <div className="p-6">
              {forgotError ? (
                <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400">
                  {forgotError}
                </div>
              ) : null}

              {/* Step 1: Enter Identifier */}
              {forgotStep === 1 && (
                <form onSubmit={handleForgotStep1} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Email Address or BD Phone Number *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. techvault@example.com or 01700000001"
                      value={forgotIdentifier}
                      onChange={(e) => setForgotIdentifier(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:border-indigo-600 dark:focus:border-indigo-500 focus:ring-1 focus:ring-indigo-600 outline-hidden transition-all"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="flex-1 px-4 py-3 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={requestOtpMutation.isPending}
                      className="flex-1 px-4 py-3 text-xs font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {requestOtpMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <span>Send OTP</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 2: Enter OTP */}
              {forgotStep === 2 && (
                <form onSubmit={handleForgotStep2} className="space-y-4">
                  {demoOtpCode ? (
                    <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs">
                      <p className="font-bold mb-1">🔑 Demo Verification OTP Sent:</p>
                      <p className="font-mono text-lg tracking-widest font-extrabold text-amber-900 dark:text-amber-200 select-all">
                        {demoOtpCode}
                      </p>
                    </div>
                  ) : null}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Enter 6-Digit OTP Code *
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      placeholder="123456"
                      value={forgotOtp}
                      onChange={(e) => setForgotOtp(e.target.value)}
                      className="w-full px-4 py-3.5 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-center font-mono text-xl font-bold tracking-widest focus:border-indigo-600 outline-hidden transition-all"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setForgotStep(1)}
                      className="flex-1 px-4 py-3 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={verifyOtpMutation.isPending}
                      className="flex-1 px-4 py-3 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {verifyOtpMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Verify OTP"
                      )}
                    </button>
                  </div>
                </form>
              )}

              {/* Step 3: Set New Password */}
              {forgotStep === 3 && (
                <form onSubmit={handleForgotStep3} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      New Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        required
                        placeholder="At least 6 characters"
                        value={forgotNewPassword}
                        onChange={(e) => setForgotNewPassword(e.target.value)}
                        className="w-full px-4 py-3 pr-10 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:border-indigo-600 outline-hidden transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                      >
                        {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Confirm New Password *
                    </label>
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      placeholder="Re-enter new password"
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:border-indigo-600 outline-hidden transition-all"
                    />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(false)}
                      className="flex-1 px-4 py-3 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetPasswordMutation.isPending}
                      className="flex-1 px-4 py-3 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {resetPasswordMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Reset Password</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Google Sign-in Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-md p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/50">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/50 mb-3 shadow-inner">
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Sign in with Google</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Enter your real Google email address to log into MarketVerse.</p>
            </div>
            <form onSubmit={handleGoogleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Google Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. yourname@gmail.com"
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:border-indigo-600 outline-hidden transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Shourov Rahman"
                  value={googleName}
                  onChange={(e) => setGoogleName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:border-indigo-600 outline-hidden transition-all"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="flex-1 px-4 py-3 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={googleAuthMutation.isPending}
                  className="flex-1 px-4 py-3 text-xs font-semibold rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {googleAuthMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Continue"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Split Grid Card */}
      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800/80 backdrop-blur-2xl shadow-2xl overflow-hidden relative z-10">
        
        {/* Left Column: Brand Hero & Highlights */}
        <div className="lg:col-span-5 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white p-8 lg:p-12 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800/80 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
          
          <div>
            {/* Logo */}
            <div className="flex items-center gap-2.5 mb-8">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
                MarketVerse AI
              </span>
            </div>

            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span>Next-Gen Multi-Vendor Shopping</span>
              </span>
              <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white leading-tight">
                Welcome back to your personalized commerce hub.
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                Connect directly with top Bangladeshi vendors, leverage real-time AI styling assistance, and track your orders seamlessly.
              </p>
            </div>
          </div>

          {/* Quick Demo Fill Accounts */}
          <div className="mt-8 space-y-3">
            <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">⚡ Quick Demo Accounts</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2.5">
              {demoAccounts.map((acc) => {
                const Icon = acc.icon;
                return (
                  <button
                    key={acc.phone}
                    type="button"
                    onClick={() => {
                      setPhone(acc.phone);
                      setPassword(acc.password);
                      setError("");
                      toast.info(`Loaded ${acc.label} credentials! Click Sign In.`);
                    }}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 transition-all text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-slate-700/50 text-slate-300 group-hover:text-indigo-400 transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{acc.label}</p>
                        <p className="text-[11px] text-slate-400">{acc.role}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${acc.badge}`}>
                      Auto-Fill
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Sign In Form */}
        <div className="lg:col-span-7 p-8 lg:p-12 flex flex-col justify-center bg-white dark:bg-slate-900/90">
          <div className="mb-6">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Sign In to Your Account</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Enter your registered BD phone number or use Google single sign-on.
            </p>
          </div>

          {/* Continue with Google */}
          <button
            type="button"
            onClick={() => setShowGoogleModal(true)}
            disabled={googleAuthMutation.isPending}
            className="w-full flex items-center justify-center gap-3 px-4 py-3.5 border border-slate-300 dark:border-slate-700/80 rounded-2xl bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all shadow-sm cursor-pointer disabled:opacity-50 mb-6 group"
          >
            {googleAuthMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
            ) : (
              <svg className="w-5 h-5 shrink-0 group-hover:scale-105 transition-transform" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          <div className="relative my-4 mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-800" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-3 text-slate-500 dark:text-slate-400 font-medium">Or sign in with phone</span>
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">BD Mobile Number</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Smartphone className="w-4 h-4" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-hidden transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">Password</label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 cursor-pointer transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-3 rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 outline-hidden transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between py-1">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded-md border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-950 text-indigo-600 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                />
                <span>Remember me on this device</span>
              </label>
            </div>

            {error ? (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={Boolean((login as any).isPending || (login as any).isLoading)}
              className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {Boolean((login as any).isPending || (login as any).isLoading) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2">
              Don't have an account yet?{" "}
              <Link to="/signup" className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline transition-colors">
                Create an account
              </Link>
            </p>
          </form>
        </div>

      </div>
    </div>
  );
}
