import twilioLib from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const fromNumber = process.env.TWILIO_WHATSAPP_FROM!;

if (!accountSid || !authToken) {
  console.warn('⚠️  TWILIO_* envs ausentes — webhook vai falhar');
}

export const twilio = accountSid && authToken ? twilioLib(accountSid, authToken) : null;

export async function sendWhatsapp(to: string, body: string): Promise<void> {
  if (!twilio) {
    console.warn('Twilio client não inicializado — skip send');
    return;
  }
  const target = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  await twilio.messages.create({ from: fromNumber, to: target, body });
}
