import { type NextRequest, NextResponse } from "next/server"

/**
 * This endpoint is a wrapper for the login form to handle redirection.
 * The actual authentication is done through NextAuth's credentials provider.
 * This endpoint should NOT be used directly - use NextAuth's signIn() instead.
 * 
 * This endpoint is deprecated and kept for backwards compatibility.
 * The login form should call NextAuth's signIn("credentials", {...}) instead.
 */
export async function POST(request: NextRequest) {
  try {
    // This endpoint should not be used directly anymore
    // Return 405 Method Not Allowed to encourage use of NextAuth's signIn
    return NextResponse.json(
      { 
        error: "Direct login API is deprecated. Please use the NextAuth credentials provider.",
        message: "This endpoint should not be called directly. Use NextAuth's signIn() function instead."
      },
      { status: 405 }
    )
  } catch (error) {
    console.error("[Login API] Route error:", error)
    return NextResponse.json(
      { 
        error: "Internal server error"
      },
      { status: 500 }
    )
  }
}
