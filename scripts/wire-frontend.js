const fs = require('fs');
const htmlPath = 'C:\\Users\\neilr\\AppData\\Local\\Temp\\zevi-fleet-prototype\\index.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Change const ships to let ships
html = html.replace(/const ships = \[/, 'let ships = [');

// 2. Extract the STATIC_ROUTES block
const staticStart = html.indexOf('const STATIC_ROUTES = {');
const staticEnd = html.indexOf('  };', staticStart) + 4;
const staticBlock = html.slice(staticStart, staticEnd);
const beforeStatic = html.slice(0, staticStart);
const afterStatic = html.slice(staticEnd);

// 3. Remove it from original location
html = beforeStatic + afterStatic;

// 4. Insert it after the ships array closing '  ];'
const shipsEnd = html.indexOf('  ];', html.indexOf('let ships = [')) + 4;
const beforeShipsEnd = html.slice(0, shipsEnd);
const afterShipsEnd = html.slice(shipsEnd);
html = beforeShipsEnd + '\n\n' + staticBlock + afterShipsEnd;

// 5. Add loadFleetData and initApp wrapping before the first ships.forEach(s => { after the ships array
const firstForEach = html.indexOf('  ships.forEach(s => {', shipsEnd);
const beforeForEach = html.slice(0, firstForEach);
const afterForEach = html.slice(firstForEach);
const wrapper = `  async function loadFleetData() {\n    try {\n      const res = await fetch('/api/fleet');\n      if (!res.ok) return false;\n      const data = await res.json();\n      if (!Array.isArray(data.vessels) || data.vessels.length === 0) return false;\n      ships = data.vessels;\n      return true;\n    } catch (e) {\n      console.warn('API load failed, using fallback:', e);\n      return false;\n    }\n  }\n\n  async function initApp() {\n`;
html = beforeForEach + wrapper + afterForEach;

// 6. Close initApp and add bootstrap before </script>
const scriptEnd = html.lastIndexOf('</script>');
const beforeScriptEnd = html.slice(0, scriptEnd);
const afterScriptEnd = html.slice(scriptEnd);
const bootstrap = `  }\n\n  loadFleetData()\n    .then(ok => {\n      if (!ok) console.log('Using embedded static data');\n      return initApp();\n    })\n    .catch(err => {\n      console.warn('API load failed, using fallback:', err);\n      return initApp();\n    });\n`;
html = beforeScriptEnd + '\n' + bootstrap + afterScriptEnd;

fs.writeFileSync(htmlPath, html);
console.log('Done');
