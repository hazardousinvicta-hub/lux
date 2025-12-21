import { NextResponse } from "next/server";
import { Resend } from "resend";
import { RESEND_API_KEY } from "@/lib/env";
import fs from "fs";
import path from "path";

const resend = new Resend(RESEND_API_KEY);

export async function POST(req: Request) {
    try {
        const { id, email } = await req.json();

        if (!id || !email) {
            return NextResponse.json(
                { error: "Missing id or email" },
                { status: 400 }
            );
        }

        const dbPath = path.join(process.cwd(), "data", "generations.json");
        let generation = null;

        if (fs.existsSync(dbPath)) {
            const db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
            generation = db.find((g: any) => g.id === id);
        }

        if (!generation) {
            return NextResponse.json(
                { error: "Generation not found" },
                { status: 404 }
            );
        }

        const imagePath = path.join(process.cwd(), "public", "generations", `${id}.png`);
        let imageHtml = "";
        let attachments = [];

        if (fs.existsSync(imagePath)) {
            const imageBuffer = fs.readFileSync(imagePath);
            attachments.push({
                filename: 'infographic.png',
                content: imageBuffer,
                contentId: 'infographic'
            });
            imageHtml = `<img src="cid:infographic" alt="Infographic" style="max-width: 100%; border-radius: 8px;" />`;
        } else {
            imageHtml = `<p><em>[Infographic image not found on server]</em></p>`;
        }

        const { error } = await resend.emails.send({
            from: 'Stock News <onboarding@resend.dev>',
            to: email,
            subject: `Stock Briefing Archive - ${new Date(generation.timestamp).toLocaleDateString()}`,
            html: `
                <h1>Stock Briefing Archive</h1>
                <p>Here is the requested infographic from ${new Date(generation.timestamp).toLocaleString()}:</p>
                ${imageHtml}
                <br/>
                <h3>Summary</h3>
                <div style="white-space: pre-wrap;">${generation.summary}</div>
            `,
            attachments: attachments
        });

        if (error) {
            console.error("Resend error:", error);
            return NextResponse.json(
                { error: error.message },
                { status: 400 }
            );
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error("Email error:", error);
        return NextResponse.json(
            { error: error?.message || "Failed to send email" },
            { status: 500 }
        );
    }
}
