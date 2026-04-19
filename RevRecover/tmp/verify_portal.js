async function verify() {
  const baseUrl = 'http://localhost:3001';
  
  try {
    console.log('--- Verifying Portal HTML ---');
    const portalRes = await fetch(`${baseUrl}/portal`);
    console.log(`GET /portal: ${portalRes.status} ${portalRes.statusText}`);
    const text = await portalRes.text();
    console.log(`Contains "AetnaCare Provider": ${text.includes('AetnaCare Provider')}`);

    console.log('\n--- Verifying API portal-claims ---');
    const claimsRes = await fetch(`${baseUrl}/api/portal-claims`);
    const claimsData = await claimsRes.json();
    console.log(`GET /api/portal-claims: ${claimsRes.status}`);
    console.log(`Claims Count: ${claimsData.claims.length}`);
    console.log(`Agent Session Active: ${claimsData.agentSessionActive}`);

    console.log('\n--- Verifying API portal-submit ---');
    const submitRes = await fetch(`${baseUrl}/api/portal-submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claimId: 'CLM-992-81A', notes: 'Verified by script' })
    });
    console.log(`POST /api/portal-submit: ${submitRes.status}`);
    
    console.log('\n--- Final Claim State Check ---');
    const finalClaimsRes = await fetch(`${baseUrl}/api/portal-claims`);
    const finalData = await finalClaimsRes.json();
    const updatedClaim = finalData.claims.find(c => c.id === 'CLM-992-81A');
    console.log(`Claim CLM-992-81A Status: ${updatedClaim.status}`);

  } catch (err) {
    console.error('Verification failed:', err.message);
  }
}

verify();
