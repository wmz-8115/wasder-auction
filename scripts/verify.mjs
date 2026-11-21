import fs from 'node:fs';
const deployment=JSON.parse(fs.readFileSync('public/deployment.json','utf8'));
if(deployment.chainId!==10143 || !/^0x[0-9a-fA-F]{40}$/.test(deployment.address ?? ''))throw new Error('先把真实测试网部署地址填入 public/deployment.json');
const payload={chainId:10143,contractAddress:deployment.address,contractName:'contracts/FlashAuction.sol:FlashAuction',compilerVersion:'v0.8.28+commit.7893614a',standardJsonInput:JSON.parse(fs.readFileSync('verification/standard-input.json','utf8')),foundryMetadata:JSON.parse(fs.readFileSync('verification/metadata.json','utf8'))};
const response=await fetch('https://agents.devnads.com/v1/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
console.log('Verification API status:',response.status);console.log(await response.text());if(!response.ok)process.exitCode=1;

