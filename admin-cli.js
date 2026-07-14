#!/usr/bin/env node

/**
 * LibraryHub Admin CLI Client Tool
 * Used to manage the library catalog and track updates remotely.
 */

const http = require('http');

const API_URL = process.env.API_URL || 'http://127.0.0.1:8787';
const ADMIN_KEY = process.env.ADMIN_KEY || 'nikunj2024';

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underline: '\x1b[4m',
  fgRed: '\x1b[31m',
  fgGreen: '\x1b[32m',
  fgYellow: '\x1b[33m',
  fgBlue: '\x1b[34m',
  fgMagenta: '\x1b[35m',
  fgCyan: '\x1b[36m',
  fgWhite: '\x1b[37m'
};

function printBanner() {
  console.log(`\n${COLORS.fgCyan}${COLORS.bright}========================================`);
  console.log(`         LIBRARYHUB ADMIN TOOL          `);
  console.log(`========================================${COLORS.reset}`);
}

function printHelp() {
  printBanner();
  console.log(`${COLORS.bright}Usage:${COLORS.reset}`);
  console.log(`  node admin-cli.js <command> [arguments]\n`);
  console.log(`${COLORS.bright}Commands:${COLORS.reset}`);
  console.log(`  ${COLORS.fgGreen}stats${COLORS.reset}                              Display real-time site count statistics`);
  console.log(`  ${COLORS.fgGreen}list${COLORS.reset}                               List all books in the catalog`);
  console.log(`  ${COLORS.fgGreen}delete <slug>${COLORS.reset}                      Remotely delete a book and its pages`);
  console.log(`  ${COLORS.fgGreen}update <slug> [options]${COLORS.reset}            Update book details (e.g. status, views)`);
  console.log(`                                     Options: --status=active|draft|archived`);
  console.log(`                                              --views=15000`);
  console.log(`                                              --title="New Title"`);
  console.log(`                                              --author="New Author"`);
  console.log(`  ${COLORS.fgGreen}help${COLORS.reset}                               Show this help manual\n`);
  console.log(`${COLORS.bright}Config:${COLORS.reset}`);
  console.log(`  Target API:  ${COLORS.fgBlue}${API_URL}${COLORS.reset}`);
  console.log(`  Auth Key:    ${COLORS.dim}${ADMIN_KEY}${COLORS.reset}\n`);
}

async function callApi(action, payload = {}) {
  const urlObj = new URL('/api/admin/control', API_URL);
  const data = JSON.stringify({ action, ...payload });
  
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_KEY}`,
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (res.statusCode !== 200) {
            reject(new Error(parsed.error || `HTTP ${res.statusCode}`));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Failed to parse server response: ${body}`));
        }
      });
    });
    
    req.on('error', (e) => reject(new Error(`Connection failed: ${e.message}`)));
    req.write(data);
    req.end();
  });
}

async function handleStats() {
  printBanner();
  console.log(`${COLORS.dim}Connecting to ${API_URL}...${COLORS.reset}\n`);
  try {
    const res = await callApi('get_stats');
    if (res.success && res.stats) {
      console.log(`${COLORS.fgWhite}${COLORS.bright}📊 Site Statistics Dashboard:${COLORS.reset}`);
      console.log(`----------------------------------------`);
      console.log(`📚 Total Books:        ${COLORS.fgGreen}${res.stats.total_items}${COLORS.reset}`);
      console.log(`📁 Categories:         ${COLORS.fgGreen}${res.stats.total_categories}${COLORS.reset}`);
      console.log(`📄 Total Pages/Files:  ${COLORS.fgGreen}${res.stats.total_files}${COLORS.reset}`);
      console.log(`👁️ Cumulative Views:   ${COLORS.fgGreen}${res.stats.total_views.toLocaleString()}${COLORS.reset}`);
      console.log(`----------------------------------------\n`);
    } else {
      console.log(`${COLORS.fgRed}Failed to fetch statistics.${COLORS.reset}`);
    }
  } catch (err) {
    console.log(`${COLORS.fgRed}Error: ${err.message}${COLORS.reset}\n`);
  }
}

async function handleList() {
  printBanner();
  console.log(`${COLORS.dim}Fetching library catalog...${COLORS.reset}\n`);
  try {
    const res = await callApi('list_items');
    if (res.success && Array.isArray(res.items)) {
      if (res.items.length === 0) {
        console.log(`No items found in the library catalog.`);
        return;
      }
      
      console.log(`${COLORS.fgWhite}${COLORS.bright}📚 Library Catalog List:${COLORS.reset}`);
      console.log(`------------------------------------------------------------------------------------------------`);
      console.log(
        `${COLORS.bright}${'Title'.padEnd(35)} ${'Slug'.padEnd(25)} ${'Type'.padEnd(12)} ${'Status'.padEnd(10)} ${'Views'.padEnd(8)}${COLORS.reset}`
      );
      console.log(`------------------------------------------------------------------------------------------------`);
      
      res.items.forEach(item => {
        const title = item.title.length > 32 ? item.title.substring(0, 32) + '...' : item.title;
        let statusColor = COLORS.fgGreen;
        if (item.status === 'draft') statusColor = COLORS.fgYellow;
        if (item.status === 'archived') statusColor = COLORS.dim;

        console.log(
          `${title.padEnd(35)} ` +
          `${item.slug.padEnd(25)} ` +
          `${item.type.padEnd(12)} ` +
          `${statusColor}${item.status.padEnd(10)}${COLORS.reset} ` +
          `${item.view_count.toString().padEnd(8)}`
        );
      });
      console.log(`------------------------------------------------------------------------------------------------`);
      console.log(`Total count: ${res.items.length} items.\n`);
    }
  } catch (err) {
    console.log(`${COLORS.fgRed}Error: ${err.message}${COLORS.reset}\n`);
  }
}

async function handleDelete(slug) {
  if (!slug) {
    console.log(`${COLORS.fgRed}Error: Missing required book slug. Usage: node admin-cli.js delete <slug>${COLORS.reset}`);
    return;
  }
  printBanner();
  console.log(`${COLORS.fgRed}${COLORS.bright}⚠️ WARNING: You are about to delete book "${slug}" permanently!${COLORS.reset}`);
  console.log(`${COLORS.dim}Sending delete request...${COLORS.reset}`);
  try {
    const res = await callApi('delete_item', { slug });
    if (res.success) {
      console.log(`\n${COLORS.fgGreen}✅ Success: ${res.message}${COLORS.reset}\n`);
    }
  } catch (err) {
    console.log(`\n${COLORS.fgRed}❌ Error: ${err.message}${COLORS.reset}\n`);
  }
}

async function handleUpdate(slug, args) {
  if (!slug) {
    console.log(`${COLORS.fgRed}Error: Missing book slug. Usage: node admin-cli.js update <slug> [options]${COLORS.reset}`);
    return;
  }
  
  const payload = { slug };
  let hasFields = false;

  args.forEach(arg => {
    if (arg.startsWith('--status=')) {
      payload.status = arg.substring(9);
      hasFields = true;
    }
    if (arg.startsWith('--views=')) {
      payload.views = parseInt(arg.substring(8));
      hasFields = true;
    }
    if (arg.startsWith('--title=')) {
      payload.title = arg.substring(8);
      hasFields = true;
    }
    if (arg.startsWith('--author=')) {
      payload.author = arg.substring(9);
      hasFields = true;
    }
  });

  if (!hasFields) {
    console.log(`${COLORS.fgRed}Error: No update parameters provided. (e.g. --views=1000 or --status=draft)${COLORS.reset}`);
    return;
  }

  printBanner();
  console.log(`${COLORS.dim}Updating item details...${COLORS.reset}`);
  try {
    const res = await callApi('update_item', payload);
    if (res.success) {
      console.log(`\n${COLORS.fgGreen}✅ Success: ${res.message}${COLORS.reset}\n`);
    }
  } catch (err) {
    console.log(`\n${COLORS.fgRed}❌ Error: ${err.message}${COLORS.reset}\n`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'stats':
      await handleStats();
      break;
    case 'list':
      await handleList();
      break;
    case 'delete':
      await handleDelete(args[1]);
      break;
    case 'update':
      await handleUpdate(args[1], args.slice(2));
      break;
    case 'help':
    case undefined:
      printHelp();
      break;
    default:
      console.log(`${COLORS.fgRed}Unknown command: "${command}". Run "node admin-cli.js help" to view commands.${COLORS.reset}`);
  }
}

main();
