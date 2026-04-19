const OpenAI = require('openai');

/**
 * Fireworks.ai Integration Module
 * This module gives the RevRecover system its "Intelligence Layer", 
 * parsing raw insurance payer denials into concrete, clinical strategies that the TinyFish Agent can execute.
 */

const FIREWORKS_API_KEY = process.env.FIREWORKS_API_KEY;

// We use the OpenAI SDK because Fireworks is OpenAI compatible!
const client = new OpenAI({
  apiKey: FIREWORKS_API_KEY || 'dummy_key', // prevents crash if not defined
  baseURL: 'https://api.fireworks.ai/inference/v1',
});

/**
 * Synthesizes a clinical strategy and specific instruction set based on a raw denial reason.
 * @param {string} denialReason - the raw text from the insurance portal
 * @param {string} claimId - the ID of the claim being processed
 * @param {string} priorAuthCode - associated Auth code if available
 * @returns {Promise<string>} The generated justification to insert into the appeal.
 */
async function generateClinicalStrategy(denialReason, claimId, priorAuthCode) {
  // Graceful degradation for dev environment if key is omitted
  if (!FIREWORKS_API_KEY) {
    console.warn('⚠️ FIREWORKS_API_KEY is missing. Using fallback mock strategy generator.');
    return `Medical necessity established for claim ${claimId}. Addressed denial [${denialReason}]. Auth tracking ref: ${priorAuthCode || 'N/A'}. Clinical criteria met. Requesting immediate reversal.`;
  }

  try {
    const prompt = `
      You are an expert Medical Biller and Coding Specialist. 
      We are appealing a denied medical claim in an automated pipeline.
      
      Claim ID: ${claimId}
      Prior Auth Ref: ${priorAuthCode || 'Unknown'}
      Denial Reason: "${denialReason}"

      Write a short, aggressive, and highly professional 2-sentence clinical justification that we should type into the appeal text box. It must cite the Prior Auth Ref if it exists, and directly argue against the denial reason. Do not include any filler text, just the exact string we should submit to the portal.
    `;

    console.log(`🧠 [Fireworks] Analyzing denial reason for ${claimId}...`);

    const completion = await client.chat.completions.create({
      model: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
      messages: [
        { role: 'system', content: 'You are a highly capable AI assistant embedded in a secure medical billing platform.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 150,
      temperature: 0.2 // keep it highly deterministic and professional
    });

    const strategy = completion.choices[0].message.content.trim();
    console.log(`✅ [Fireworks] Strategy synthesized!`);
    return strategy;

  } catch (err) {
    console.error('❌ [Fireworks] API Error:', err.message);
    // Silent fail so agent can still proceed with fallback
    return `Medical necessity established for claim ${claimId}. Addressed denial [${denialReason}]. Auth tracking ref: ${priorAuthCode || 'N/A'}. Clinical criteria met. Requesting immediate reversal.`;
  }
}

module.exports = {
  generateClinicalStrategy
};
