import { createPublicClient, createWalletClient, custom, http, type Address, type Abi, type Hash } from 'viem';
import { defineChain } from 'viem';
import artifact from './generated/contract.json';

export const CONTRACT_ADDRESS = '0x4efb3348e3ae211ec81a6738a3ad7b6064ed5e83' as Address;
export const chain = defineChain({id:10143,name:'Monad Testnet',nativeCurrency:{name:'MON',symbol:'MON',decimals:18},rpcUrls:{default:{http:['https://testnet-rpc.monad.xyz']}},blockExplorers:{default:{name:'MonadVision',url:'https://testnet.monadvision.com'}}});
export const abi = artifact.abi as Abi;
export const bytecode = artifact.bytecode as `0x${string}`;
export const deployedBytecode = artifact.deployedBytecode as `0x${string}`;
export const publicClient = createPublicClient({ chain, transport: http('https://testnet-rpc.monad.xyz', {timeout:20000, retryCount:1}) });
export const explorer = 'https://testnet.monadvision.com';
export interface Provider {
  request(args:{method:string;params?:unknown[] | object}):Promise<any>;
  isMetaMask?:boolean;
  providers?:Provider[];
  on?(event:string, listener:(value:any)=>void):void;
  removeListener?(event:string, listener:(value:any)=>void):void;
}
declare global { interface Window { ethereum?:Provider } }
export function provider():Provider {
  const p = window.ethereum?.providers?.find(p=>p.isMetaMask) ?? window.ethereum;
  if (!p) throw new Error('未发现钱包扩展。请先在当前浏览器安装 MetaMask，再刷新页面。');
  return p;
}
export async function wallet() {
  const p = provider();
  const accounts = await p.request({method:'eth_requestAccounts'}) as Address[];
  if (!accounts[0]) throw new Error('未选择钱包账户');
  try { await p.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x279f'}]}); }
  catch (e:any) {
    if (e.code !== 4902 && e?.data?.originalError?.code !== 4902) throw e;
    await p.request({method:'wallet_addEthereumChain',params:[{chainId:'0x279f',chainName:'Monad Testnet',nativeCurrency:{name:'Test MON',symbol:'MON',decimals:18},rpcUrls:['https://testnet-rpc.monad.xyz'],blockExplorerUrls:[explorer]}]});
  }
  if (Number(await p.request({method:'eth_chainId'})) !== 10143) throw new Error('请切换到 Monad Testnet（10143）');
  return {client:createWalletClient({account:accounts[0],chain,transport:custom(p as any)}),account:accounts[0]};
}
export type Auction = {seller:Address;title:string;metadataURI:string;startingPrice:bigint;bidStep:bigint;highestBidder:Address;highestBid:bigint;endAt:bigint;hasBid:boolean;finalized:boolean;cancelled:boolean};
export type Metadata = {title:string;description:string;category:string;image:string};
export type AuctionItem = Auction & {id:bigint;metadata:Metadata};
export const zero = '0x0000000000000000000000000000000000000000';
export async function read(address:Address, functionName:string,args:readonly unknown[]=[]):Promise<any> {
  return publicClient.readContract({address,abi,functionName,args});
}
export function metadata(uri:string):Metadata {
  try {
    if (!uri.startsWith('data:application/json,')) throw new Error('External metadata not fetched automatically');
    const m=JSON.parse(decodeURIComponent(uri.slice('data:application/json,'.length)));
    return {title:typeof m.title==='string'?m.title:'未命名拍品',description:typeof m.description==='string'?m.description:'',category:typeof m.category==='string'?m.category:'其他',image:typeof m.image==='string' && /^https:\/\//.test(m.image)?m.image:''};
  } catch {return {title:'链上拍品',description:'此拍品使用外部元数据，请核对链上发布信息。',category:'其他',image:''};}
}
export function encodeMetadata(m:Metadata) { return `data:application/json,${encodeURIComponent(JSON.stringify(m))}`; }
export function errorMessage(e:any):string {
  const name=e?.walk?.((x:any)=>x?.data?.errorName)?.data?.errorName;
  const errors:Record<string,string>={BidTooLow:'报价已落后于链上最低价。请刷新后重新报价。',AuctionClosed:'此拍卖已到期、结算或取消，不能继续出价。',AlreadyLeading:'你已经是当前领先者，无需再次报价。',SellerCannotBid:'卖家不能对自己的拍品出价。',NotEnded:'尚未到期，暂不能结算。',NothingToWithdraw:'当前没有可领取的余额。',HasBids:'已有有效出价，不能取消。',InvalidMetadata:'拍品信息过长，请缩短文字或图片网址。',NotSeller:'只有卖家可以取消尚无出价的拍卖。'};
  if (name && errors[name]) return errors[name];
  if (e?.code === 4001 || /rejected|denied/i.test(e?.shortMessage ?? e?.message ?? '')) return '你取消了钱包操作，页面没有将其记为成功。';
  return e?.shortMessage ?? e?.message ?? '请求失败，请重试。';
}
export function shareUrl(address:Address,hash:string='#/') {const u=new URL(location.href);u.search='';u.searchParams.set('contract',address);u.hash=hash;return u.toString();}
export async function confirmed(hash:Hash) {
  const receipt=await publicClient.waitForTransactionReceipt({hash,timeout:180000});
  if (receipt.status!=='success') throw new Error('链上执行失败（reverted），本次操作没有成功。');
  return receipt;
}

