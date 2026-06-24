import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

// Simple email regex for validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { from, replyTo, subject, message, recipients } = body;

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

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'Recipients list is required and cannot be empty.' },
        { status: 400 }
      );
    }

    // 2. Clean, deduplicate, and validate emails
    // Standardize to lowercase and trim
    const cleanRecipients = recipients.map((r) => String(r).trim().toLowerCase());
    
    // Remove duplicates
    const uniqueRecipients = Array.from(new Set(cleanRecipients)).filter(Boolean);

    if (uniqueRecipients.length > 100) {
      return NextResponse.json(
        { error: 'Maximum limit of 100 recipients exceeded.' },
        { status: 400 }
      );
    }

    const validRecipients = uniqueRecipients.filter((email) => EMAIL_REGEX.test(email));

    if (validRecipients.length === 0) {
      return NextResponse.json(
        { error: 'No valid recipient email addresses found.' },
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

    // 4. Send emails in chunked parallel batches to prevent rate limits and avoid serverless timeouts
    const results = [];
    const concurrencyLimit = 10;

    for (let i = 0; i < validRecipients.length; i += concurrencyLimit) {
      const chunk = validRecipients.slice(i, i + concurrencyLimit);
      const chunkPromises = chunk.map(async (email) => {
        try {
          const response = await resend.emails.send({
            from: fromEmail,
            to: email,
            replyTo: replyTo || undefined,
            subject: subject,
            text: message,
            html: `
              <div style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 8px; background-color: #ffffff; color: #1f2937;">
                <div style="white-space: pre-line; font-size: 16px; line-height: 1.6; color: #374151;">
                  ${message.replace(/\n/g, '<br />')}
                </div>
                <hr style="margin: 24px 0; border: 0; border-top: 1px solid #e5e7eb;" />
                <p style="font-size: 12px; color: #9ca3af; text-align: center; margin: 0;">
                  Sent via Bulk Email Sender.
                </p>
              </div>
            `,
          });

          if (response.error) {
            return {
              email,
              success: false,
              error: response.error.message || 'Resend failed to deliver the email',
            };
          } else {
            return {
              email,
              success: true,
              id: response.data?.id,
            };
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred while sending';
          return {
            email,
            success: false,
            error: errorMsg,
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);

      // Add a small 100ms delay between chunks to respect rate limits gently
      if (i + concurrencyLimit < validRecipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.length - successCount;

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        successCount,
        failedCount,
      },
      results,
    });
  } catch (error) {
    console.error('Error in API /api/send:', error);
    const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred on the server.';
    return NextResponse.json(
      { error: errorMsg },
      { status: 500 }
    );
  }
}
