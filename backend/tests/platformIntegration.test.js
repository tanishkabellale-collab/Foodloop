const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { createServerApp } = require('../server');
const { assessFoodImage } = require('../services/aiAssessmentService');

async function makeTestServer() {
  const tmpUploads = fs.mkdtempSync(path.join(os.tmpdir(), 'foodloop-test-uploads-'));
  const srv = createServerApp({
    dbPath: ':memory:',
    uploadsDir: tmpUploads,
    legacyDataFile: null,
    legacyUsersFile: null,
  });

  await new Promise((resolve) => {
    const httpServer = srv.app.listen(0, '127.0.0.1', () => {
      srv.httpServer = httpServer;
      srv.baseUrl = `http://127.0.0.1:${httpServer.address().port}`;
      resolve();
    });
  });

  srv.cleanup = () => {
    srv.httpServer?.close();
    srv.close();
    fs.rmSync(tmpUploads, { recursive: true, force: true });
  };

  return srv;
}

async function createSampleJpegBuffer(color = { r: 210, g: 55, b: 40 }) {
  return sharp({
    create: { width: 260, height: 260, channels: 3, background: color },
  })
    .jpeg()
    .toBuffer();
}

test('E2E 1: Health endpoint reports SQLite storage and Hybrid AI capabilities', async () => {
  const srv = await makeTestServer();
  try {
    const res = await fetch(`${srv.baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ok');
    assert.ok(data.storage.includes('SQLite'));
    assert.equal(data.ngos_count, 5); // 5 seeded demo NGOs
    assert.ok('local_onnx_available' in data.ai);
  } finally {
    srv.cleanup();
  }
});

test('E2E 2: Offline fresh_produce runs local ResNet-18 ONNX when available', async () => {
  const buf = await createSampleJpegBuffer();
  const result = await assessFoodImage(buf, 'fresh_produce', {
    mimeType: 'image/jpeg',
    apiKey: '',
    groqApiKey: '',
  });
  assert.equal(result.assessment_status, 'completed');
  // In workspace with resnet18_foodloop.onnx + onnxruntime-node installed, real ONNX executes
  assert.equal(result.assessment_mode, 'local_onnx_produce');
  assert.equal(result.is_demo_fallback, false);
  assert.equal(result.model_version, 'resnet18_v1.0.0_foodloop');
  assert.ok(Math.abs((result.probability_fresh + result.probability_rotten) - 1) < 0.01);
});

test('E2E 3: Full lifecycle — Donor registration, NGO profile & matching, capacity decrement, Delivery OTP', async () => {
  const srv = await makeTestServer();
  try {
    // 1. Register Donor, NGO, and Volunteer
    const regDonor = await fetch(`${srv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Campus Donor',
        email: 'donor@campus.test',
        password: 'Password123!',
        role: 'DONOR',
        organization: 'College Canteen',
      }),
    });
    assert.equal(regDonor.status, 201);
    const donorAuth = await regDonor.json();

    const regNgo = await fetch(`${srv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Real Ngo Lead',
        email: 'ngo@rescue.test',
        password: 'Password123!',
        role: 'NGO',
        organization: 'Real Relief Kitchen',
        location_text: 'Wakad, Pune',
        available_capacity_servings: 100,
        latitude: 18.6001,
        longitude: 73.7601,
      }),
    });
    assert.equal(regNgo.status, 201);
    const ngoAuth = await regNgo.json();
    assert.ok(ngoAuth.user.ngo_id, 'Registered NGO must receive an ngo_id');

    const regVol = await fetch(`${srv.baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Courier Alex',
        email: 'vol@fleet.test',
        password: 'Password123!',
        role: 'VOLUNTEER',
        organization: 'Bike Fleet',
      }),
    });
    assert.equal(regVol.status, 201);
    const volAuth = await regVol.json();

    // 2. NGO updates profile via PUT /api/ngos/me
    const putNgo = await fetch(`${srv.baseUrl}/api/ngos/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ngoAuth.token}`,
      },
      body: JSON.stringify({
        available_capacity_servings: 120,
        accepted_categories: ['cooked_meals', 'fresh_produce'],
      }),
    });
    assert.equal(putNgo.status, 200);
    const updatedNgo = (await putNgo.json()).ngo;
    assert.equal(updatedNgo.available_capacity_servings, 120);

    // 3. Donor uploads a donation with GPS coordinates
    const jpeg = await createSampleJpegBuffer();
    const form = new FormData();
    form.append('title', 'Hot Veg Biryani');
    form.append('food_category', 'cooked_meals');
    form.append('dietary_type', 'vegetarian');
    form.append('quantity', '40');
    form.append('quantity_unit', 'servings');
    form.append('pickup_available_until', new Date(Date.now() + 4 * 3600000).toISOString());
    form.append('address_text', 'Wakad Tech Hub, Pune');
    form.append('preparation_time', 'less_than_1_hour_ago');
    form.append('current_storage', 'hot_insulated');
    form.append('latitude', '18.6010');
    form.append('longitude', '73.7610');
    form.append('photo', new Blob([jpeg], { type: 'image/jpeg' }), 'meal.jpg');

    const createRes = await fetch(`${srv.baseUrl}/api/donations`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${donorAuth.token}` },
      body: form,
    });
    assert.equal(createRes.status, 201);
    const donation = await createRes.json();
    assert.equal(donation.status, 'submitted');
    assert.equal(donation.latitude, 18.601);

    // 4. SQL pushdown query + pagination check
    const queryRes = await fetch(`${srv.baseUrl}/api/donations?paginated=true&limit=5&offset=0&q=Biryani`, {
      headers: { Authorization: `Bearer ${ngoAuth.token}` },
    });
    assert.equal(queryRes.status, 200);
    const paged = await queryRes.json();
    assert.equal(paged.total, 1);
    assert.equal(paged.items[0].id, donation.id);

    // 5. Matching evaluates real registered NGO using Haversine coordinates
    const matchRes = await fetch(`${srv.baseUrl}/api/donations/${donation.id}/matches`, {
      headers: { Authorization: `Bearer ${ngoAuth.token}` },
    });
    assert.equal(matchRes.status, 200);
    const matchBody = await matchRes.json();
    assert.equal(matchBody.ngos_source, 'database_hybrid');
    const realNgoMatch = matchBody.matches.find((m) => m.ngo_id === ngoAuth.user.ngo_id);
    assert.ok(realNgoMatch, 'Real registered NGO must appear in match pool');
    assert.equal(realNgoMatch.assessments.location_mode, 'coordinates');
    assert.ok(realNgoMatch.assessments.distance_km < 1);

    // 6. State Guard: Cannot collect BEFORE accepting
    const earlyCollect = await fetch(`${srv.baseUrl}/api/donations/${donation.id}/collect`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ngoAuth.token}` },
    });
    assert.equal(earlyCollect.status, 400);

    // 7. NGO accepts donation -> decrements capacity & creates Delivery with OTPs
    const acceptRes = await fetch(`${srv.baseUrl}/api/donations/${donation.id}/accept`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ngoAuth.token}`,
      },
      body: JSON.stringify({
        matched_ngo_id: ngoAuth.user.ngo_id,
        matched_ngo_name: 'Real Relief Kitchen',
      }),
    });
    assert.equal(acceptRes.status, 200);

    // Verify NGO capacity dropped 120 -> 80
    const ngoCheck = await fetch(`${srv.baseUrl}/api/ngos/me`, {
      headers: { Authorization: `Bearer ${ngoAuth.token}` },
    });
    assert.equal((await ngoCheck.json()).ngo.available_capacity_servings, 80);

    // 8. Check role-based OTP visibility on deliveries
    const donorDelRes = await fetch(`${srv.baseUrl}/api/deliveries`, {
      headers: { Authorization: `Bearer ${donorAuth.token}` },
    });
    const donorDel = (await donorDelRes.json()).deliveries[0];
    assert.ok(donorDel.pickup_otp, 'Donor must see Pickup OTP');
    assert.equal(donorDel.delivery_otp, null, 'Donor must NOT see NGO Delivery OTP');

    const ngoDelRes = await fetch(`${srv.baseUrl}/api/deliveries`, {
      headers: { Authorization: `Bearer ${ngoAuth.token}` },
    });
    const ngoDel = (await ngoDelRes.json()).deliveries[0];
    assert.ok(ngoDel.delivery_otp, 'NGO must see Delivery OTP');

    const volDelRes = await fetch(`${srv.baseUrl}/api/deliveries`, {
      headers: { Authorization: `Bearer ${volAuth.token}` },
    });
    const volDel = (await volDelRes.json()).deliveries[0];
    assert.equal(volDel.pickup_otp, null, 'Volunteer must NOT see hidden Pickup OTP');
    assert.equal(volDel.delivery_otp, null, 'Volunteer must NOT see hidden Delivery OTP');

    // 9. Volunteer claims and executes full OTP handoff chain
    const claimRes = await fetch(`${srv.baseUrl}/api/deliveries/${volDel.id}/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${volAuth.token}`,
      },
      body: JSON.stringify({ vehicle_type: 'Insulated Food Van' }),
    });
    assert.equal(claimRes.status, 200);

    const enRouteRes = await fetch(`${srv.baseUrl}/api/deliveries/${volDel.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${volAuth.token}`,
      },
      body: JSON.stringify({ status: 'en_route_pickup' }),
    });
    assert.equal(enRouteRes.status, 200);

    // Wrong OTP must fail
    const wrongPickupOtp = await fetch(`${srv.baseUrl}/api/deliveries/${volDel.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${volAuth.token}`,
      },
      body: JSON.stringify({ status: 'picked_up', otp: '0000' }),
    });
    assert.equal(wrongPickupOtp.status, 400);

    // Valid Pickup OTP + temperature log succeeds
    const validPickup = await fetch(`${srv.baseUrl}/api/deliveries/${volDel.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${volAuth.token}`,
      },
      body: JSON.stringify({
        status: 'picked_up',
        otp: donorDel.pickup_otp,
        pickup_temp_celsius: 64.5,
      }),
    });
    assert.equal(validPickup.status, 200);
    assert.equal((await validPickup.json()).delivery.pickup_temp_celsius, 64.5);

    const inTransitRes = await fetch(`${srv.baseUrl}/api/deliveries/${volDel.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${volAuth.token}`,
      },
      body: JSON.stringify({ status: 'in_transit' }),
    });
    assert.equal(inTransitRes.status, 200);

    // Valid Delivery OTP marks delivery delivered & donation collected atomically
    const deliveredRes = await fetch(`${srv.baseUrl}/api/deliveries/${volDel.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${volAuth.token}`,
      },
      body: JSON.stringify({
        status: 'delivered',
        otp: ngoDel.delivery_otp,
        note: 'Left at kitchen counter',
      }),
    });
    assert.equal(deliveredRes.status, 200);

    const checkDonRes = await fetch(`${srv.baseUrl}/api/donations/${donation.id}`, {
      headers: { Authorization: `Bearer ${donorAuth.token}` },
    });
    assert.equal((await checkDonRes.json()).status, 'collected');

    // 10. State Guard: Cannot accept an already collected donation
    const reAcceptRes = await fetch(`${srv.baseUrl}/api/donations/${donation.id}/accept`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${ngoAuth.token}` },
    });
    assert.equal(reAcceptRes.status, 400);

    // 11. Persistent logout revocation works in SQLite
    const logoutRes = await fetch(`${srv.baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${volAuth.token}` },
    });
    assert.equal(logoutRes.status, 200);

    const afterLogoutRes = await fetch(`${srv.baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${volAuth.token}` },
    });
    assert.equal(afterLogoutRes.status, 401);
  } finally {
    srv.cleanup();
  }
});
