import { NextResponse } from "next/server";
import { Resend } from "resend";
import { RESEND_API_KEY } from "@/lib/env";

const resend = new Resend(RESEND_API_KEY);

export async function POST(req: Request) {
    try {
        const { email, imageUrl } = await req.json();

        if (!email || !imageUrl) {
            return NextResponse.json(
                { error: "Missing email or image" },
                { status: 400 }
            );
        }

        const { data, error } = await resend.emails.send({
            from: "Lithos Intelligence <onboarding@resend.dev>",
            to: [email],
            subject: "Your Daily Semiconductor Briefing",
            html: `
        <h1>Daily Semiconductor Briefing</h1>
        <p>Here is your generated infographic summary:</p>
        <img src="${imageUrl}" alt="Infographic" style="max-width: 100%; border-radius: 8px;" />
        <p>Powered by Lithos Intelligence & Gemini 3 Pro Image</p>
      `,
        });

        if (error) {
            console.error("Resend error:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("Email error:", error);
        return NextResponse.json(
            { error: "Failed to send email" },
            { status: 500 }
        );
    }
}
