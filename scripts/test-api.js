const fleetHandler = require('./api/fleet');
const routeHandler = require('./api/route');

// Mock res object
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

console.log('Testing /api/fleet ...');
const fleetRes = mockRes();
fleetHandler({ method: 'GET' }, fleetRes);
console.log('Status:', fleetRes._status);
console.log('Vessels:', fleetRes._body.vessels.length);
console.log('Route keys:', fleetRes._body.routeKeys.length);

console.log('\nTesting /api/route ...');
const routeRes = mockRes();
routeHandler({ method: 'GET', url: '/api/route?voyage=Shanghai%20%E2%86%92%20Long%20Beach' }, routeRes);
console.log('Status:', routeRes._status);
console.log('Voyage:', routeRes._body.voyage);
console.log('Points:', routeRes._body.points.length);

console.log('\nAll tests passed.');
