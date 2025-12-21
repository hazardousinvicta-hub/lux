import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GEMINI_API_KEY, RESEND_API_KEY } from "@/lib/env";
import { Resend } from "resend";
import fs from "fs";
import path from "path";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const resend = new Resend(RESEND_API_KEY);

export async function POST(req: Request) {
    try {
        const { articles, email, sector } = await req.json();

        if (!articles || !Array.isArray(articles)) {
            return NextResponse.json(
                { error: "Invalid articles data" },
                { status: 400 }
            );
        }

        // Prepare the prompt
        const newsSummary = articles
            .slice(0, 20)
            .map((a: any) => `- ${a.title} (${a.source})`)
            .join("\n");

        const generativeModel = genAI.getGenerativeModel({ model: "gemini-3-pro-image-preview" });

        let context = "semiconductor news";
        if (sector === "luxury") {
            context = "luxury market news (fashion, watches, real estate, etc.)";
        }

        const prompt = `
        You are an expert information designer. 
        1. Create a dense, information-rich infographic summarizing the following ${context}.
           - Style: Minimalist, clean lines, high contrast, easy to read. ${sector === 'luxury' ? 'Use a premium, elegant aesthetic.' : ''}
           - Aspect Ratio: 16:9 (Landscape).
           - Layout: Split into clear sections (e.g., "Market Movers", "Key Trends", "Global Impact").
           - Visuals: Use simple charts (bar/pie) or icons to represent data points.
           - Content: Include at least 10 distinct data points or headlines visually.
           - Typography: Use large, bold headers and clear body text.
        2. Also provide a text summary with at least 10 detailed bullet points.

        NEWS ITEMS:
        ${newsSummary}
        `;

        const result = await generativeModel.generateContent(prompt);
        const response = await result.response;

        // Extract text and image from parts
        let summary = "";
        let base64Image = "";
        let mimeType = "image/png";

        const parts = response.candidates?.[0]?.content?.parts || [];

        for (const part of parts) {
            if (part.text) {
                summary += part.text;
            }
            if (part.inlineData) {
                base64Image = part.inlineData.data;
                mimeType = part.inlineData.mimeType;
            }
        }

        if (!summary) summary = response.text();

        let imageUrl = "";
        let emailStatus = "skipped";
        const timestamp = new Date().toISOString();
        const id = Date.now().toString();

        if (base64Image) {
            // Save locally
            const fileName = `${id}.png`;
            const publicDir = path.join(process.cwd(), "public", "generations");
            if (!fs.existsSync(publicDir)) {
                fs.mkdirSync(publicDir, { recursive: true });
            }

            const filePath = path.join(publicDir, fileName);
            fs.writeFileSync(filePath, Buffer.from(base64Image, "base64"));

            imageUrl = `/generations/${fileName}`;

            // Save to DB
            const dbPath = path.join(process.cwd(), "data", "generations.json");
            let db = [];
            if (fs.existsSync(dbPath)) {
                db = JSON.parse(fs.readFileSync(dbPath, "utf-8"));
            }
            db.push({ id, timestamp, imageUrl, summary, sector: sector || "semiconductors" });
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

            // Send Email
            if (email) {
                try {
                    const { error } = await resend.emails.send({
                        from: 'Stock News <onboarding@resend.dev>',
                        to: email,
                        subject: `${sector === 'luxury' ? 'Luxury' : 'Daily Stock'} Briefing - ${new Date().toLocaleDateString()}`,
                        html: `
                            <h1>${sector === 'luxury' ? 'Luxury Market' : 'Daily Stock'} Briefing</h1>
                            <p>Here is your generated infographic for today:</p>
                            <img src="cid:infographic" alt="Infographic" style="max-width: 100%; border-radius: 8px;" />
                            <br/>
                            <h3>Summary</h3>
                            <div style="white-space: pre-wrap;">${summary}</div>
                        `,
                        attachments: [
                            {
                                filename: 'infographic.png',
                                content: Buffer.from(base64Image, 'base64'),
                                contentId: 'infographic'
                            }
                        ]
                    });

                    if (error) {
                        console.error("Resend error:", error);
                        emailStatus = `failed: ${error.message}`;
                    } else {
                        console.log("Email sent successfully to", email);
                        emailStatus = "success";
                    }
                } catch (emailError: any) {
                    console.error("Failed to send email:", emailError);
                    emailStatus = `failed: ${emailError?.message}`;
                }
            } else {
                console.log("No email provided, skipping email sending.");
            }

        } else {
            imageUrl = `https://placehold.co/1080x1920/1a1a1a/FFF?text=${encodeURIComponent("Image Generation Failed")}&font=roboto`;
        }

        return NextResponse.json({
            imageUrl,
            summary,
            emailStatus
        });

    } catch (error) {
        console.error("Generation error:", error);
        return NextResponse.json(
            { error: "Failed to generate infographic" },
            { status: 500 }
        );
    }
}
