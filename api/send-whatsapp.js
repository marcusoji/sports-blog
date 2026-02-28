// Vercel Serverless Function for WhatsApp Integration
// api/send-whatsapp.js
// 
// This function handles sending WhatsApp messages via Twilio
// Deploy this to Vercel and it will be available at /api/send-whatsapp

// To use this, you need to:
// 1. Install Twilio: npm install twilio
// 2. Set environment variables in Vercel:
//    - TWILIO_ACCOUNT_SID
//    - TWILIO_AUTH_TOKEN
//    - TWILIO_WHATSAPP_NUMBER (e.g., whatsapp:+14155238886)

export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { to, message } = req.body;

        // Validate input
        if (!to || !message) {
            return res.status(400).json({ error: 'Missing required fields: to, message' });
        }

        // Validate phone number format
        if (!to.match(/^\+\d{10,15}$/)) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }

        // Initialize Twilio client
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

        if (!accountSid || !authToken) {
            console.error('Twilio credentials not configured');
            return res.status(500).json({ error: 'WhatsApp service not configured' });
        }

        // For production, uncomment the following code:
        /*
        const twilio = require('twilio');
        const client = twilio(accountSid, authToken);

        const messageResponse = await client.messages.create({
            body: message,
            from: fromNumber,
            to: `whatsapp:${to}`
        });

        return res.status(200).json({
            success: true,
            messageId: messageResponse.sid,
            status: messageResponse.status,
            to: to
        });
        */

        // Mock response for development/testing
        console.log('WhatsApp Message (Mock):', {
            to: to,
            from: fromNumber,
            message: message
        });

        return res.status(200).json({
            success: true,
            messageId: 'mock-' + Date.now(),
            status: 'sent',
            to: to,
            note: 'This is a mock response. Configure Twilio credentials to send actual messages.'
        });

    } catch (error) {
        console.error('WhatsApp send error:', error);
        return res.status(500).json({
            error: 'Failed to send WhatsApp message',
            details: error.message
        });
    }
}

// CORS configuration
export const config = {
    api: {
        bodyParser: true,
    },
};