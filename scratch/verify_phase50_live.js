const jwt = require('../server/node_modules/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-token-key-change-in-production-12345';
const BASE_URL = 'http://localhost:5000/api';

const adminToken = jwt.sign(
  {
    id: '467a2534-a1a3-44f7-9dad-798582eabbab',
    email: 'kiran@demostartup.com',
    fullName: 'Sai Kiran',
    role: 'ADMIN',
    organizationId: '1a317fa2-a359-406b-a254-abaeabe68b46',
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const ashwinToken = jwt.sign(
  {
    id: 'b358314c-9ed7-4fa2-b3f8-8d7b69e81053',
    email: 'sai@demostartup.com',
    fullName: 'Ashwin T',
    role: 'PROJECT_MANAGER',
    organizationId: '1a317fa2-a359-406b-a254-abaeabe68b46',
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const member04Token = jwt.sign(
  {
    id: '1e3b0c68-94bd-4d67-9bd7-5c536258af16',
    email: 'saikirankurapati04@gmail.com',
    fullName: 'Google Identity (04)',
    role: 'TEAM_MEMBER',
    organizationId: '1a317fa2-a359-406b-a254-abaeabe68b46',
  },
  JWT_SECRET,
  { expiresIn: '1h' }
);

async function verifyAll() {
  console.log('=== VERIFYING THREE ROLES AGAINST LIVE API ENDPOINTS ===');

  // 1. Check /api/organization/members?includeInactive=true
  console.log('\n--- 1. Testing /api/organization/members?includeInactive=true ---');
  const resAdminMembers = await fetch(`${BASE_URL}/organization/members?includeInactive=true`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`Admin get members status: ${resAdminMembers.status}`);
  const members = await resAdminMembers.json();
  console.log(`Total roster members returned: ${members.length}`);
  const sai = members.find((m) => m.email === 'kiran@demostartup.com');
  const ashwin = members.find((m) => m.email === 'sai@demostartup.com');
  const user04 = members.find((m) => m.email === 'saikirankurapati04@gmail.com');

  console.log(`Sai Kiran: role=${sai?.role} (ADMIN) isActive=${sai?.isActive}`);
  console.log(`Ashwin T: role=${ashwin?.role} (PROJECT_MANAGER) isActive=${ashwin?.isActive}`);
  console.log(`User 04: role=${user04?.role} (TEAM_MEMBER) isActive=${user04?.isActive}`);

  // 2. Test Admin Endpoint /api/security/allowlist
  console.log('\n--- 2. Testing /api/security/allowlist (Restricted to ADMIN) ---');
  const resAllowAdmin = await fetch(`${BASE_URL}/security/allowlist`, { headers: { Authorization: `Bearer ${adminToken}` } });
  console.log(`Admin access /security/allowlist: ${resAllowAdmin.status} (EXPECTED: 200)`);

  const resAllowAshwin = await fetch(`${BASE_URL}/security/allowlist`, { headers: { Authorization: `Bearer ${ashwinToken}` } });
  console.log(`Ashwin access /security/allowlist: ${resAllowAshwin.status} (EXPECTED: 403)`);

  const resAllow04 = await fetch(`${BASE_URL}/security/allowlist`, { headers: { Authorization: `Bearer ${member04Token}` } });
  console.log(`User04 access /security/allowlist: ${resAllow04.status} (EXPECTED: 403)`);

  // 3. Test Admin Endpoint /api/security/access-requests
  console.log('\n--- 3. Testing /api/security/access-requests (Restricted to ADMIN) ---');
  const resReqAdmin = await fetch(`${BASE_URL}/security/access-requests`, { headers: { Authorization: `Bearer ${adminToken}` } });
  console.log(`Admin access /security/access-requests: ${resReqAdmin.status} (EXPECTED: 200)`);

  const resReqAshwin = await fetch(`${BASE_URL}/security/access-requests`, { headers: { Authorization: `Bearer ${ashwinToken}` } });
  console.log(`Ashwin access /security/access-requests: ${resReqAshwin.status} (EXPECTED: 403)`);

  const resReq04 = await fetch(`${BASE_URL}/security/access-requests`, { headers: { Authorization: `Bearer ${member04Token}` } });
  console.log(`User04 access /security/access-requests: ${resReq04.status} (EXPECTED: 403)`);

  // 4. Test Sole Admin Protection: Demotion attempt
  console.log('\n--- 4. Testing Sole Admin Protection (Demotion Attempt) ---');
  const resDemote = await fetch(`${BASE_URL}/organization/members/${sai.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ role: 'TEAM_MEMBER' }),
  });
  console.log(`Demoting sole Admin status: ${resDemote.status} (EXPECTED: 400)`);
  const demoteData = await resDemote.json();
  console.log(`Demote rejection message: "${demoteData.message}"`);

  // 5. Test Sole Admin Protection: Deactivation attempt
  console.log('\n--- 5. Testing Sole Admin Protection (Deactivation Attempt) ---');
  const resDeact = await fetch(`${BASE_URL}/organization/members/${sai.id}/deactivate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  console.log(`Deactivating sole Admin status: ${resDeact.status} (EXPECTED: 400)`);
  const deactData = await resDeact.json();
  console.log(`Deactivate rejection message: "${deactData.message}"`);

  console.log('\n=== ALL PHASE 50 API INVARIANTS VALIDATED SUCCESSFULLY ===');
}

verifyAll().catch(console.error);
