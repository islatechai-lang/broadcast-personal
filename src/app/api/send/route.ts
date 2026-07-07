import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// Simple email regex for validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Regex to validate the `from` field: either "email@domain" or "Name <email@domain>"
const FROM_REGEX = /^(?:[^<]+<)?[^\s@]+@[^\s@]+\.[^\s@]+>?$/;

// Helper function to format plain text messages to styled HTML with button links
function formatMessageToHtml(text: string): string {
  // Regex to find links (http/https)
  const urlRegex = /(https?:\/\/[^\s]+)/g;

  // Convert links to styled buttons
  const formattedText = text.replace(urlRegex, (url) => {
    // Clean trailing punctuation from URL (e.g. dots, commas, parenthesis)
    const cleanUrl = url.replace(/[.,;:!?)]+$/, "");
    let label = "Visit Link";
    if (cleanUrl.includes("whop.com")) {
      label = "Join GG33 on Whop";
    }
    return `<div style="margin: 24px 0; text-align: center;">
      <a href="${cleanUrl}" target="_blank" style="display: inline-block; background-color: #F65312; color: #ffffff; font-weight: bold; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-size: 15px; letter-spacing: 0.5px; box-shadow: 0 4px 12px rgba(246, 83, 18, 0.2);">
        ${label}
      </a>
    </div>`;
  });

  // Replace newlines with <br />
  return formattedText.replace(/\n/g, '<br />');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { from, replyTo, subject, message, recipient } = body;

    // 1. Basic field validation
    if (!subject || typeof subject !== 'string' || subject.trim() === '') {
      return NextResponse.json(
        { error: 'Subject is required and cannot be empty.' },
        { status: 400 }
      );
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json(
        { error: 'Message is required and cannot be empty.' },
        { status: 400 }
      );
    }

    if (!recipient || typeof recipient !== 'string' || recipient.trim() === '') {
      return NextResponse.json(
        { error: 'Recipient email is required.' },
        { status: 400 }
      );
    }

    // Validate `from` field format if provided
    if (from && typeof from === 'string' && from.trim() !== '') {
      const trimmedFrom = from.trim();
      if (!FROM_REGEX.test(trimmedFrom)) {
        return NextResponse.json(
          {
            error:
              'Invalid "From Email" format. Use a full email address like "noreply@yourdomain.com" or "Your Name <noreply@yourdomain.com>". A bare domain like "yourdomain.com" is not valid.',
          },
          { status: 400 }
        );
      }
    }

    // 2. Validate recipient format
    const cleanRecipient = recipient.trim().toLowerCase();
    if (!EMAIL_REGEX.test(cleanRecipient)) {
      return NextResponse.json(
        { error: `Invalid recipient email address format: ${cleanRecipient}` },
        { status: 400 }
      );
    }

    // 3. Initialize Resend
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('RESEND_API_KEY is not configured on the server.');
      return NextResponse.json(
        { error: 'Mail server configuration error. Please contact the administrator.' },
        { status: 500 }
      );
    }

    const resend = new Resend(apiKey);
    const fromEmail = from || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    // 4. Send the single email
    try {
      const response = await resend.emails.send({
        from: fromEmail,
        to: cleanRecipient,
        replyTo: replyTo || undefined,
        subject: subject,
        text: message.replace(/<[^>]*>/g, ''),
        html: message.trim().startsWith('<')
          ? message
          : `
          <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff; color: #1f2937;">
            <div style="font-size: 16px; line-height: 1.6; color: #374151;">
              ${formatMessageToHtml(message)}
            </div>
          </div>
        `,
      });

      if (response.error) {
        return NextResponse.json(
          { error: response.error.message || 'Resend failed to deliver the email.' },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        id: response.data?.id,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred while sending';
      return NextResponse.json(
        { error: errorMsg },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in API /api/send:', error);
    const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred on the server.';
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
