import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type Bindings = {
    MEDSCREEN_BUCKET: R2Bucket;
    AI_GATEWAY_URL: string;
    GROQ_API_KEY: string;
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    CF_ACCOUNT_ID: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS for all routes
app.use('/api/*', cors());

app.get('/health', (c) => c.json({ status: 'ok' }));

// Route 1: AI Scribe via Cloudflare AI Gateway & Groq (JSON Mode)
app.post('/api/scribe', async (c) => {
    try {
        const { audioTranscript, patientContext } = await c.req.json();

        if (!audioTranscript) {
            return c.json({ error: 'audioTranscript is required' }, 400);
        }

        const groqApiKey = c.env.GROQ_API_KEY;
        const aiGatewayUrl = c.env.AI_GATEWAY_URL;

        // We route Groq requests through Cloudflare AI Gateway
        const response = await fetch(`${aiGatewayUrl}/groq/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'llama3-8b-8192',
                messages: [
                    {
                        role: 'system',
                        content: `You are an AI medical scribe. Extract clinical context from the transcript into a structured JSON format. 
            Output ONLY valid JSON matching this structure: 
            {
              "summary": "string",
              "vitals": [{"label":"string", "value":"string"}],
              "observations": [{"id":"string", "label":"string", "state":"suggested"}]
            }`,
                    },
                    {
                        role: 'user',
                        content: `Patient Context: ${patientContext || 'None'}\n\nTranscript: ${audioTranscript}`,
                    },
                ],
                response_format: { type: 'json_object' },
                temperature: 0.2,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('AI Gateway Error:', errorText);
            return c.json({ error: 'Failed to process transcript' }, 500);
        }

        const data = await response.json() as any;
        const completionMessage = data.choices[0]?.message?.content;

        try {
            const parsedStruct = JSON.parse(completionMessage);
            return c.json(parsedStruct);
        } catch (parseError) {
            console.error('Failed to parse Groq output as JSON:', completionMessage);
            return c.json({ error: 'Failed to parse AI response' }, 500);
        }
    } catch (err: any) {
        console.error('Scribe Route Error:', err);
        return c.json({ error: 'Internal Server Error' }, 500);
    }
});

// Route 2: Generate S3 pre-signed upload URL for Cloudflare R2
app.get('/api/upload-url', async (c) => {
    try {
        const fileName = c.req.query('filename');
        const contentType = c.req.query('contentType');

        if (!fileName || !contentType) {
            return c.json({ error: 'filename and contentType query parameters are required' }, 400);
        }

        const accountId = c.env.CF_ACCOUNT_ID;
        const accessKeyId = c.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = c.env.R2_SECRET_ACCESS_KEY;

        if (!accountId || !accessKeyId || !secretAccessKey) {
            return c.json({ error: 'R2 credentials not fully configured in environment' }, 500);
        }

        const S3 = new S3Client({
            region: 'auto',
            endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });

        // Generate unique key to prevent collisions
        const fileKey = `${crypto.randomUUID()}-${fileName}`;

        const command = new PutObjectCommand({
            Bucket: 'medscreen',
            Key: fileKey,
            ContentType: contentType,
        });

        // URL expires in 15 minutes (900 seconds)
        const url = await getSignedUrl(S3, command, { expiresIn: 900 });

        return c.json({ url, fileKey });
    } catch (err: any) {
        console.error('Upload URL Error:', err);
        return c.json({ error: 'Failed to generate presigned URL' }, 500);
    }
});

export default app;
