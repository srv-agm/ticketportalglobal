"use client"

import { useState, useEffect, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import Image from "next/image"
import { AlertCircle, LogIn, Mail, Lock, Eye, EyeOff } from "lucide-react"
import { useTheme } from "next-themes"

interface User {
  id: string
  name: string
  email: string
  role: string
  group: string
}

// Map NextAuth error codes to user-friendly messages
const errorMessages: Record<string, string> = {
  AccessDenied: "Authentication failed. This may be due to a database connection issue. Please try again or contact support if the problem persists.",
  Configuration: "There is a problem with the server configuration. Please contact support.",
  Verification: "The verification token has expired or has already been used.",
  Default: "An error occurred during sign-in. Please try again.",
}

export function LoginForm() {
  const router = useRouter()
  const { setTheme } = useTheme()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSSOLoading, setIsSSOLoading] = useState(false)

  // Force light mode on login page only
  useEffect(() => {
    // Save current theme
    const savedTheme = localStorage.getItem("theme")
    setTheme("light")
    
    // Cleanup: restore theme when component unmounts (user navigates away)
    return () => {
      if (savedTheme && savedTheme !== "light") {
        setTheme(savedTheme)
      }
    }
  }, [setTheme])

  // Check for error in URL query parameters (from NextAuth redirects)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search)
      const errorParam = urlParams.get("error")
      if (errorParam) {
        const errorMessage = errorMessages[errorParam] || errorMessages.Default
        setError(errorMessage)
        urlParams.delete("error")
        const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : "")
        window.history.replaceState({}, "", newUrl)
      }
    }
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      if (!email || !password) {
        setError("Email and password are required")
        setIsLoading(false)
        return
      }

      // Use NextAuth's signIn function with credentials provider
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false, // We handle redirect manually
      })

      if (!result || !result.ok) {
        const errorMsg = result?.error || "Invalid email or password"
        console.error("[LoginForm] Login failed:", errorMsg)
        setError(errorMsg)
        setIsLoading(false)
        return
      }

      // Successfully authenticated, redirect to dashboard
      console.log("[LoginForm] Login successful, redirecting to dashboard")
      router.push("/dashboard")
      router.refresh()
    } catch (err) {
      console.error("[LoginForm] Error during sign-in:", err)
      const errorMessage = err instanceof Error ? err.message : "Network error"
      if (errorMessage.includes("fetch failed") || errorMessage.includes("Failed to fetch")) {
        setError("Unable to connect to the server. Please check your internet connection and try again.")
      } else {
        setError("Login failed. Please try again.")
      }
      setIsLoading(false)
    }
  }

  const handleMicrosoftSignIn = async () => {
    setError("")
    setIsSSOLoading(true)
    try {
      await signIn("azure-ad", {
        redirect: true,
        callbackUrl: "/dashboard",
      })
    } catch (err) {
      console.error("Microsoft sign-in error:", err)
      setError("Microsoft sign-in failed. Please try again.")
      setIsSSOLoading(false)
    }
  }

  return (
    <div className="relative w-full max-w-md z-10">
      {/* Main Card */}
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="relative p-8 sm:p-10">
          {/* Logo and Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <Image
                src="/mFilterIt_Logo _Login.svg"
                alt="mFilterIt Logo"
                width={200}
                height={80}
                className="w-auto h-20"
              />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
              Welcome Back
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Sign in to access your Ticket Portal
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 dark:text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Microsoft SSO Button */}
          <button
            type="button"
            onClick={handleMicrosoftSignIn}
            disabled={isSSOLoading || isLoading}
            className="w-full mb-6 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold py-3.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 23 23"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="0" y="0" width="11" height="11" fill="#F25022" />
              <rect x="12" y="0" width="11" height="11" fill="#7FBA00" />
              <rect x="0" y="12" width="11" height="11" fill="#00A4EF" />
              <rect x="12" y="12" width="11" height="11" fill="#FFB900" />
            </svg>
            <span>{isSSOLoading ? "Signing in..." : "Continue with Microsoft"}</span>
          </button>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-3 text-slate-500 dark:text-slate-400 font-medium">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Input */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@company.com"
                  className="w-full pl-12 pr-4 py-3.5 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors text-sm"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3.5 border-2 border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 dark:focus:border-blue-500 transition-colors text-sm"
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <LogIn className="w-5 h-5" />
              <span>{isLoading ? "Signing in..." : "Sign In"}</span>
            </button>
          </form>

          {/* Signup Link */}
          <div className="text-center mt-6">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Don't have an account?{" "}
              <a 
                href="/signup" 
                className="font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
              >
                Sign up
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="text-center text-slate-600 dark:text-slate-400 text-xs mt-6 font-medium">
        🔒 Secure Internal Portal
      </p>
    </div>
  )
}

export default LoginForm
