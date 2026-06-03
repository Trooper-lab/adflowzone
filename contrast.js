const fs = require('fs');
const path = require('path');

const filesToUpdate = [
  'src/components/briefing/CampaignBlock.tsx',
  'src/components/briefing/AdGroupPreview.tsx',
  'src/components/briefing/BudgetGrid.tsx',
  'src/components/briefing/TrackingTable.tsx'
];

filesToUpdate.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');

  // We bump the slate text colors for much better contrast
  content = content.replace(/text-slate-300/g, 'text-slate-500');
  content = content.replace(/text-slate-400/g, 'text-slate-600');
  content = content.replace(/text-slate-500/g, 'text-slate-700');
  content = content.replace(/text-slate-600/g, 'text-slate-800');
  content = content.replace(/text-slate-700/g, 'text-slate-900');
  
  // Bump colored badges for keywords
  content = content.replace(/text-blue-700/g, 'text-blue-900');
  content = content.replace(/bg-blue-50/g, 'bg-blue-100');
  content = content.replace(/ring-blue-100/g, 'ring-blue-200');

  content = content.replace(/text-purple-700/g, 'text-purple-900');
  content = content.replace(/bg-purple-50/g, 'bg-purple-100');
  content = content.replace(/ring-purple-100/g, 'ring-purple-200');

  fs.writeFileSync(fullPath, content);
  console.log('Updated', file);
});

// For BlueprintView, we only want to bump text-slate colors in the STRATEGIC OVERVIEW and MAIN area, not in the header or footer which have dark backgrounds.
// Actually, in BlueprintView, the light areas start at <main className="px-12 py-16 space-y-24"> and the STRATEGIC OVERVIEW starts at <div className="relative z-10 -mt-12 px-12">
// It's safer to just let me manually fix BlueprintView if needed, since it mixes dark/light themes.
