const fleetHandler = require('../api/fleet');
const routeHandler = require('../api/route');
const vesselHandler = require('../api/vessel/[id]');
const deploymentHandler = require('../api/deployment/[id]');
const alertsHandler = require('../api/alerts');

function mockRes() {
  return {
    _status: 200,
    _headers: {},
    _body: null,
    setHeader(name, value) { this._headers[name] = value; },
    status(code) { this._status = code; return this; },
    json(obj) { this._body = obj; return this; },
    end() { return this; }
  };
}

function test(name, handler, req) {
  const res = mockRes();
  handler(req, res);
  console.log(`\n${name}`);
  console.log('Status:', res._status);
  console.log('Body keys:', Object.keys(res._body).join(', '));
  return res._body;
}

console.log('Testing API endpoints...');

const fleet = test('GET /api/fleet', fleetHandler, { method: 'GET' });
console.log('Vessels:', fleet.vessels.length);
console.log('Route keys:', fleet.routeKeys.length);

const route = test('GET /api/route', routeHandler, { method: 'GET', url: '/api/route?voyage=Shanghai%20%E2%86%92%20Long%20Beach' });
console.log('Points:', route.points.length);

const vessel = test('GET /api/vessel/V01', vesselHandler, { method: 'GET', url: '/api/vessel/V01' });
console.log('Vessel:', vessel.vessel.name);
console.log('Components:', vessel.components.length);
console.log('Sensors:', vessel.sensors.length);
console.log('Products:', vessel.products.length);

const deploymentId = vessel.deployment ? vessel.deployment.id : 'DEP-001';
const deployment = test(`GET /api/deployment/${deploymentId}`, deploymentHandler, { method: 'GET', url: `/api/deployment/${deploymentId}` });
console.log('Deployment:', deployment.deployment.id);
console.log('Components:', deployment.components.length);

const alerts = test('GET /api/alerts', alertsHandler, { method: 'GET' });
console.log('Alerts:', alerts.alerts.length);

console.log('\nAll tests passed.');
