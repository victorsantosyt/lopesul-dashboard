import { createClient } from "@supabase/supabase-js"
import { NextResponse } from "next/server"

export async function POST() {
  try {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        {
          error: "Missing Supabase credentials",
          instructions: "Please configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment variables",
        },
        { status: 500 },
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      db: {
        schema: "public",
      },
    })

    const results = []

    console.log("[v0] Checking database and inserting sample plans...")

    const plans = [
      {
        name: "Plano 1 Hora",
        description: "Acesso rápido por 1 hora",
        price_cents: 300,
        duration_hours: 1,
        speed_download: "10Mbps",
        speed_upload: "5Mbps",
      },
      {
        name: "Plano 3 Horas",
        description: "Acesso por 3 horas",
        price_cents: 800,
        duration_hours: 3,
        speed_download: "15Mbps",
        speed_upload: "7Mbps",
      },
      {
        name: "Plano 6 Horas",
        description: "Meio período de acesso",
        price_cents: 1500,
        duration_hours: 6,
        speed_download: "20Mbps",
        speed_upload: "10Mbps",
      },
      {
        name: "Plano 12 Horas",
        description: "Acesso por 12 horas",
        price_cents: 2500,
        duration_hours: 12,
        speed_download: "25Mbps",
        speed_upload: "12Mbps",
      },
      {
        name: "Plano 1 Dia",
        description: "Acesso por 24 horas completas",
        price_cents: 4000,
        duration_hours: 24,
        speed_download: "30Mbps",
        speed_upload: "15Mbps",
      },
    ]

    // Try to insert plans - this will fail if tables don't exist
    let plansInserted = 0
    for (const plan of plans) {
      const { error } = await supabase.from("plans").upsert(plan, {
        onConflict: "name",
        ignoreDuplicates: true,
      })

      if (!error) {
        plansInserted++
      } else {
        console.error("[v0] Error inserting plan:", error)

        // If we get a table doesn't exist error, return instructions
        if (error.code === "PGRST116" || error.message.includes("does not exist")) {
          return NextResponse.json(
            {
              error: "Database tables not found",
              message: "The database tables need to be created first. Please run the SQL scripts manually.",
              instructions: [
                "1. Go to https://supabase.com/dashboard",
                "2. Select your project: " + supabaseUrl.replace("https://", "").split(".")[0],
                "3. Click on 'SQL Editor' in the left sidebar",
                "4. Click 'New query' button",
                "5. Copy and paste the content from scripts/001_create_payment_tables.sql",
                "6. Click 'Run' to execute",
                "7. Repeat steps 4-6 for scripts/002_insert_sample_plans.sql",
                "8. Repeat steps 4-6 for scripts/003_setup_rls_policies.sql",
                "9. Refresh this page",
              ],
              scripts: [
                "/scripts/001_create_payment_tables.sql",
                "/scripts/002_insert_sample_plans.sql",
                "/scripts/003_setup_rls_policies.sql",
              ],
            },
            { status: 400 },
          )
        }
      }
    }

    results.push({
      step: "insert_plans",
      status: "success",
      message: `${plansInserted} plans inserted/updated`,
    })

    // Verify tables exist
    const { data: plansData, error: plansError } = await supabase.from("plans").select("count").limit(1)

    if (plansError) {
      return NextResponse.json(
        {
          error: "Database verification failed",
          details: plansError.message,
          instructions: [
            "Please run the SQL scripts manually in Supabase SQL Editor",
            "See the scripts in the /scripts folder",
          ],
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      success: true,
      message: "Database setup completed successfully!",
      results,
      note: "If RLS policies need adjustment, please run script 003 manually in Supabase SQL Editor",
    })
  } catch (error) {
    console.error("[v0] Database setup error:", error)
    return NextResponse.json(
      {
        error: "Failed to setup database",
        details: error instanceof Error ? error.message : "Unknown error",
        instructions: [
          "Please run the scripts manually in Supabase SQL Editor:",
          "1. Go to https://supabase.com/dashboard",
          "2. Select your project",
          "3. Go to SQL Editor",
          "4. Execute scripts/001_create_payment_tables.sql",
          "5. Execute scripts/002_insert_sample_plans.sql",
          "6. Execute scripts/003_setup_rls_policies.sql",
        ],
      },
      { status: 500 },
    )
  }
}
