const fs = require('node:fs');
const path = require('node:path');
const solc = require('solc');
const sources = {};
function include(sourceName) {
  if (sources[sourceName]) return;
  if (sourceName.includes('..') || path.isAbsolute(sourceName)) throw new Error('Unsafe source path');
  const file = sourceName.startsWith('@') ? path.join('node_modules',sourceName) : sourceName;
  const content = fs.readFileSync(file,'utf8'); sources[sourceName]={content};
  for (const match of content.matchAll(/import\s+(?:[^;]*?\s+from\s+)?["']([^"']+)["']\s*;/g)) {
    const name=match[1];include(name.startsWith('.')?path.posix.normalize(path.posix.join(path.posix.dirname(sourceName),name)):name);
  }
}
for (const name of fs.readdirSync('contracts').filter(n => n.endsWith('.sol'))) include(`contracts/${name}`);
const input = { language: 'Solidity', sources, settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'paris', outputSelection: { '*': { '*': ['abi','evm.bytecode','evm.deployedBytecode','metadata'] } } } };
const output = JSON.parse(solc.compile(JSON.stringify(input)));
for (const e of output.errors || []) console[e.severity === 'error' ? 'error' : 'warn'](e.formattedMessage);
if ((output.errors || []).some(e => e.severity === 'error')) process.exit(1);
for (const [sourceName, contracts] of Object.entries(output.contracts)) for (const [contractName, c] of Object.entries(contracts)) {
  const dir = `artifacts/${sourceName}`; fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(`${dir}/${contractName}.json`, JSON.stringify({_format:'hh-sol-artifact-1',contractName,sourceName,abi:c.abi,bytecode:`0x${c.evm.bytecode.object}`,deployedBytecode:`0x${c.evm.deployedBytecode.object}`,linkReferences:c.evm.bytecode.linkReferences,deployedLinkReferences:c.evm.deployedBytecode.linkReferences},null,2));
}
const c = output.contracts['contracts/FlashAuction.sol'].FlashAuction;
fs.mkdirSync('src/generated',{recursive:true});
fs.writeFileSync('src/generated/contract.json',JSON.stringify({abi:c.abi,bytecode:`0x${c.evm.bytecode.object}`,deployedBytecode:`0x${c.evm.deployedBytecode.object}`},null,2));
fs.mkdirSync('verification',{recursive:true});
fs.writeFileSync('verification/standard-input.json',JSON.stringify(input,null,2));
fs.writeFileSync('verification/metadata.json',c.metadata);
console.log(`Compiled FlashAuction with ${solc.version()} (${c.evm.bytecode.object.length/2} bytes)`);

