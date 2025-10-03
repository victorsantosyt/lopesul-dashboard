import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }

  try {
    const searchParams = request.nextUrl.searchParams
    const mac = searchParams.get("mac")

    console.log("[v0] Check access called with MAC:", mac)

    if (!mac) {
      return NextResponse.json({ error: "MAC address required", hasAccess: false }, { status: 400, headers })
    }

    const supabase = await createClient()

    const { data: payments, error: paymentError } = await supabase
      .from("payments")
      .select(`
        *,
        plans (
          id,
          name,
          duration_hours
        )
      `)
      .eq("mikrotik_username", mac)
      .eq("status", "paid")
      .order("paid_at", { ascending: false })
      .limit(1)

    console.log("[v0] Payment query result:", { payments, error: paymentError })

    if (paymentError) {
      console.error("[v0] Payment query error:", paymentError)
      return NextResponse.json(
        {
          error: "Database error",
          hasAccess: false,
          details: paymentError.message,
        },
        { status: 500, headers },
      )
    }

    if (payments && payments.length > 0) {
      const payment = payments[0]

      // Check if there's an active session for this payment
      const { data: sessions, error: sessionError } = await supabase
        .from("hotspot_sessions")
        .select("*")
        .eq("payment_id", payment.id)
        .eq("status", "active")
        .gte("end_time", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)

      console.log("[v0] Session query result:", { sessions, error: sessionError })

      if (sessions && sessions.length > 0) {
        const session = sessions[0]
        console.log("[v0] Active session found:", {
          id: session.id,
          status: session.status,
          end_time: session.end_time,
        })

        return NextResponse.json(
          {
            hasAccess: true,
            session: {
              expiresAt: session.end_time,
              planName: payment.plans?.name || "Plano Desconhecido",
              status: session.status,
            },
          },
          { headers },
        )
      }

      console.log("[v0] Payment confirmed but no active session yet for MAC:", mac)
      return NextResponse.json(
        {
          hasAccess: true,
          paymentConfirmed: true,
          message: "Payment confirmed, session will be created shortly",
        },
        { headers },
      )
    }

    console.log("[v0] No paid payment found for MAC:", mac)
    return NextResponse.json(
      {
        hasAccess: false,
        message: "No paid payment found for this device",
      },
      { headers },
    )
  } catch (error) {
    console.error("[v0] Error checking access:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        hasAccess: false,
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers },
    )
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  })
}
