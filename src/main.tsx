import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {formatEther, parseEther, type Address} from 'viem';
import './style.css';
import {abi, CONTRACT_ADDRESS, chain, read, wallet, confirmed, encodeMetadata, errorMessage, type Auction as ChainAuction, zero} from './chain';

type Status = 'WAITING_FIRST_BID' | 'LIVE' | 'ENDED' | 'FINALIZED';
type Category = 'physical' | 'digital' | 'service';
type DemoRole = 'seller' | 'bidderB' | 'bidderC';
type Auction = {id: bigint; seller: Address; title: string; description: string; imageUrl: string; category: Category; startingPrice: bigint; bidStep: bigint; highestBidder?: Address; highestBid: bigint; endAt: number; finalized: boolean; cancelled?: boolean; hasBid?: boolean};
type TxState = {stage: 'wallet' | 'submitted' | 'success' | 'failed'; title: string; detail: string; hash?: string};

const addresses: Record<DemoRole, Address> = {seller: '0xA11cE00000000000000000000000000000000001', bidderB: '0xB0b000000000000000000000000000000000002', bidderC: '0xCaRo10000000000000000000000000000000003'};
const roleNames: Record<DemoRole, string> = {seller: '卖家 A', bidderB: '竞拍者 B', bidderC: '竞拍者 C'};
const categoryNames: Record<Category, string> = {physical: '趣味收藏', digital: '数字艺术', service: '体验权益'};
const LOT_ASSETS = ['/lots/lot-01.jpg','/lots/lot-02.jpg','/lots/lot-03.jpg','/lots/lot-05.jpg','/lots/lot-06.jpg','/lots/lot-07.jpg','/lots/lot-08.jpg','/lots/lot-09.jpg'];
const randomLotAsset = () => LOT_ASSETS[Math.floor(Math.random() * LOT_ASSETS.length)];
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
const mon = (value: bigint) => Number(formatEther(value)).toLocaleString('zh-CN', {maximumFractionDigits: 4});
const hashFor = () => `0x${crypto.randomUUID().replaceAll('-', '').padEnd(64, '0')}`;
const utf8 = (value: string) => new TextEncoder().encode(value).length;
const decodeMetadata = (uri: string) => { try { const raw = uri.startsWith('data:application/json,') ? decodeURIComponent(uri.slice('data:application/json,'.length)) : '{}'; const m = JSON.parse(raw); return {description: m.description || '', imageUrl: m.image || '', category: ['physical','digital','service'].includes(m.category) ? m.category as Category : 'digital' as Category}; } catch { return {description: '', imageUrl: '', category: 'digital' as Category}; } };
const fromChain = (id: bigint, a: ChainAuction): Auction => { const m = decodeMetadata(a.metadataURI); return {id, seller:a.seller, title:a.title, ...m, startingPrice:a.startingPrice, bidStep:a.bidStep, highestBidder:a.hasBid ? a.highestBidder : undefined, highestBid:a.highestBid, endAt:Number(a.endAt), finalized:a.finalized, cancelled:a.cancelled, hasBid:a.hasBid}; };

function seedAuctions(): Auction[] {
  const now = Math.floor(Date.now() / 1000);
  return [
    {id: 1n, seller: addresses.seller, title: '创世奶娃徽章', description: '蛙士得第一枚创世纪念徽章，丑萌但很有收藏价值。', imageUrl: '/lots/lot-01.jpg', category: 'physical', startingPrice: parseEther('0.10'), bidStep: parseEther('0.03'), highestBidder: addresses.bidderB, highestBid: parseEther('0.13'), endAt: now + 48, finalized: false},
    {id: 2n, seller: addresses.bidderC, title: '抱腹奶娃 · 稳住别慌', description: '一只正在认真保护自己肚子的奶娃，等待第一位竞拍者开启60秒倒计时。', imageUrl: '/lots/lot-02.jpg', category: 'digital', startingPrice: parseEther('0.05'), bidStep: parseEther('0.01'), highestBid: 0n, endAt: 0, finalized: false},
    {id: 3n, seller: addresses.seller, title: '胜利奶娃 · V手势', description: '今天也要对竞拍结果保持乐观，适合收藏和当作头像。', imageUrl: '/lots/lot-03.jpg', category: 'digital', startingPrice: parseEther('0.08'), bidStep: parseEther('0.02'), highestBidder: addresses.bidderC, highestBid: parseEther('0.16'), endAt: now - 30, finalized: false},
    {id: 4n, seller: addresses.seller, title: '埃及奶娃 · 法老限定', description: '奶娃穿越到金字塔前，成为本季最庄严的收藏品。', imageUrl: '/lots/lot-05.jpg', category: 'physical', startingPrice: parseEther('0.12'), bidStep: parseEther('0.03'), highestBidder: addresses.bidderB, highestBid: parseEther('0.18'), endAt: now + 90, finalized: false},
    {id: 5n, seller: addresses.seller, title: '自由女神奶娃', description: '自由、阳光，以及一只看起来不太会说英语的奶娃。', imageUrl: '/lots/lot-06.jpg', category: 'digital', startingPrice: parseEther('0.09'), bidStep: parseEther('0.02'), highestBid: 0n, endAt: 0, finalized: false},
    {id: 6n, seller: addresses.seller, title: '岩壁奶娃四兄弟', description: '四位奶娃同时盯着你，谁先出价谁就是山大王。', imageUrl: '/lots/lot-07.jpg', category: 'physical', startingPrice: parseEther('0.15'), bidStep: parseEther('0.04'), highestBidder: addresses.bidderC, highestBid: parseEther('0.23'), endAt: now + 120, finalized: false},
    {id: 7n, seller: addresses.seller, title: '水手奶娃 · 不服就竞', description: '穿上水手服的奶娃，今天的目标是把价格航行到更高的地方。', imageUrl: '/lots/lot-08.jpg', category: 'service', startingPrice: parseEther('0.07'), bidStep: parseEther('0.02'), highestBid: 0n, endAt: 0, finalized: false},
    {id: 8n, seller: addresses.seller, title: '奶娃小狗 · 肉垫出价', description: '一只拥有可爱肉垫的奶娃小狗，竞拍时请保持理智。', imageUrl: '/lots/lot-09.jpg', category: 'physical', startingPrice: parseEther('0.11'), bidStep: parseEther('0.02'), highestBid: 0n, endAt: 0, finalized: false}
  ];
}

function statusOf(item: Auction, now: number): Status { if (item.finalized) return 'FINALIZED'; if (now >= item.endAt) return 'ENDED'; if (!item.highestBidder) return 'WAITING_FIRST_BID'; return 'LIVE'; }
const statusLabel: Record<Status, string> = {WAITING_FIRST_BID: '等待首拍', LIVE: '竞拍中', ENDED: '已结束 · 待结算', FINALIZED: '已成交'};

function Artwork({item, large = false}: {item: Auction; large?: boolean}) {
  return <div className={`artwork art-${Number(item.id % 3n) + 1} ${large ? 'large' : ''}`}>
    {item.imageUrl ? <img src={item.imageUrl} alt={item.title}/> : <><span className="bubble b1"/><span className="bubble b2"/><strong>{item.title.slice(0, 1)}</strong></>}
    <span className="art-pill">{categoryNames[item.category]}</span>
  </div>;
}

function TxToast({tx, close}: {tx?: TxState; close: () => void}) {
  if (!tx) return null;
  return <div className={`tx-toast tx-${tx.stage}`} role="status"><div className="tx-icon">{tx.stage === 'success' ? '✓' : tx.stage === 'failed' ? '!' : <span className="spinner"/>}</div><div><strong>{tx.title}</strong><p>{tx.detail}</p>{tx.hash && <small>链上交易 {short(tx.hash)}</small>}</div>{(tx.stage === 'success' || tx.stage === 'failed') && <button onClick={close} aria-label="关闭提示">×</button>}</div>;
}

function App() {
  const [route, setRoute] = useState(location.hash || '#/');
  const [items, setItems] = useState<Auction[]>([]);
  const [account, setAccount] = useState<Address>();
  const [credit, setCredit] = useState(0n);
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));
  const [tx, setTx] = useState<TxState>();
  const [filter, setFilter] = useState<'ALL' | Status>('ALL');
  const [bidText, setBidText] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => { try { const next = await read(CONTRACT_ADDRESS, 'nextAuctionId') as bigint; const rows = await Promise.all(Array.from({length: Math.max(0, Number(next - 1n))}, (_, i) => read(CONTRACT_ADDRESS, 'getAuction', [BigInt(i + 1)]).then((a: ChainAuction) => fromChain(BigInt(i + 1), a)))); setItems(rows.reverse()); if (account) setCredit(await read(CONTRACT_ADDRESS, 'pendingWithdrawals', [account]) as bigint); } catch (e) { setTx({stage:'failed',title:'无法读取 Monad 数据',detail:errorMessage(e)}); } finally {setLoading(false)} };
  useEffect(() => { const onRoute = () => {setRoute(location.hash || '#/'); setBidText(''); window.scrollTo({top: 0})}; window.addEventListener('hashchange', onRoute); const timer = window.setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000); void load(); const poll = window.setInterval(() => void load(), 5000); return () => {window.removeEventListener('hashchange', onRoute); window.clearInterval(timer); window.clearInterval(poll)} }, [account]);
  const selectedId = route.startsWith('#/auction/') ? BigInt(route.split('/')[2] || '0') : 0n;
  const selected = items.find(item => item.id === selectedId);
  const filtered = useMemo(() => items.filter(item => filter === 'ALL' || statusOf(item, now) === filter), [items, filter, now]);
  const connected = account || zero as Address;
  async function connect(): Promise<Address | undefined> { try { const w = await wallet(); setAccount(w.account); setTx({stage:'success',title:'钱包已连接',detail:`已连接 ${short(w.account)}`}); return w.account; } catch (e) {setTx({stage:'failed',title:'连接钱包失败',detail:errorMessage(e)}); return undefined} }
  async function send(name: string, args: readonly unknown[] = [], value?: bigint, success = '交易已确认') { if (tx && (tx.stage === 'wallet' || tx.stage === 'submitted')) return; try { const w = await wallet(); setAccount(w.account); setTx({stage:'wallet',title:'请在 MetaMask 中确认',detail:'确认后正在等待 Monad 测试网打包，请勿重复点击。'}); const hash = await w.client.writeContract({address: CONTRACT_ADDRESS, abi, functionName: name as never, args: args as never, value, account:w.account, chain} as never); setTx({stage:'submitted',title:'交易已提交',detail:'正在等待链上确认，请勿重复点击。',hash}); await confirmed(hash); await load(); setTx({stage:'success',title:success,detail:'链上已确认，页面数据已刷新。',hash}); return hash; } catch (e) {setTx({stage:'failed',title:'交易未完成',detail:errorMessage(e)}); return undefined;} }

  async function placeBid(item: Auction) {
    if (tx && (tx.stage === 'wallet' || tx.stage === 'submitted')) return;
    if (!account) {await connect(); return}
    if (item.seller.toLowerCase() === account.toLowerCase()) {setTx({stage: 'failed', title: '卖家不能参与自己的拍卖', detail: '请换一个钱包账户参与竞拍。'}); return}
    if (item.highestBidder?.toLowerCase() === account.toLowerCase()) {setTx({stage: 'failed', title: '你已经是当前领先者', detail: '等待其他用户继续出价即可。'}); return}
    const minimum = (item.highestBid || item.startingPrice) + item.bidStep; let value: bigint;
    try {value = parseEther(bidText || mon(minimum))} catch {setTx({stage: 'failed', title: '金额格式不正确', detail: '请输入例如 0.16 这样的 MON 金额'}); return}
    if (value < minimum) {setTx({stage: 'failed', title: '出价低于当前最低价', detail: `请至少出价 ${mon(minimum)} MON`}); return}
    const hash = await send('bid', [item.id], value, '出价成功，你暂时领先'); if (hash) setBidText('');
  }

  async function finalize(item: Auction) {
    await send('finalizeAuction', [item.id], undefined, '结算成功，款项已记入可提取余额');
  }
  async function withdraw() { if (credit === 0n) {setTx({stage: 'failed', title: '当前没有可提取余额', detail: '被超过的报价退款和成交款会出现在这里。'}); return} await send('withdraw', [], undefined, '资金已提取到你的钱包') }

  async function createAuction(data: {title: string; description: string; imageUrl: string; category: Category; price: string; percent: string}) {
    const title = data.title.trim(), description = data.description.trim(), imageUrl = data.imageUrl.trim() || randomLotAsset();
    if (!title || utf8(title) > 120) throw new Error('标题不能为空且不能超过 120 个 UTF-8 字节'); if (utf8(description) > 1200) throw new Error('描述不能超过 1200 个 UTF-8 字节'); if (utf8(imageUrl) > 500 || (imageUrl && !(/^https:\/\//.test(imageUrl) || imageUrl.startsWith('/lots/')))) throw new Error('图片网址应为 HTTPS 地址或选择内置素材');
    const price = parseEther(data.price), bps = Math.round(Number(data.percent) * 100); if (price <= 0n) throw new Error('起拍价必须大于 0'); if (!Number.isInteger(bps) || bps < 1 || bps > 10000) throw new Error('加价比例必须在 0.01%～100% 之间');
    const activeAccount = account || await connect(); if (!activeAccount) return; await send('createAuction', [title, encodeMetadata({title, description, category:data.category, image:imageUrl}), price, bps], undefined, '拍品创建成功');
  }

  return <div className="app-shell"><header className="topbar"><a className="brand" href="#/"><img src="/logo.png" alt="蛙士得 Logo"/><span><strong>蛙士得</strong><small>WASDER · ON-CHAIN AUCTION</small></span></a><nav><a className={route === '#/' ? 'active' : ''} href="#/">拍卖大厅</a><a className={route === '#/create' ? 'active' : ''} href="#/create">发布拍品</a></nav><div className="top-actions"><span className="mock-badge">● MONAD TESTNET</span><button className="wallet-button" onClick={() => void connect()}>{account ? short(account) : '连接 MetaMask'}</button></div></header><div className="mock-ribbon"><strong>已接入 Monad 测试网</strong><span>所有拍卖、报价、结算与余额均读取真实合约；仅使用测试 MON。</span></div><main>{route === '#/create' ? <CreatePage account={connected} onCreate={createAuction}/> : route.startsWith('#/auction/') ? selected ? <DetailPage item={selected} now={now} account={connected} bidText={bidText} setBidText={setBidText} bid={() => void placeBid(selected)} finalize={() => void finalize(selected)}/> : <Empty title="没有找到这件拍品" text="请返回拍卖大厅选择一件拍品。"/> : loading ? <Empty title="正在读取链上拍卖" text="Monad 测试网正在返回数据，请稍候。"/> : <Hall items={filtered} allItems={items} now={now} filter={filter} setFilter={setFilter}/>}<section className="balance-bar"><div><span>当前钱包的可提取余额</span><strong>{mon(credit)} <small>MON</small></strong><p>包括所有被超过的报价退款和卖家成交款。</p></div><button className="primary" onClick={() => void withdraw()} disabled={credit === 0n}>提取资金</button></section></main><footer><div><img src="/logo.png" alt=""/><strong>蛙士得</strong></div><p>Monad 测试网拍卖 · 请勿使用真实资产</p><span>合约：{short(CONTRACT_ADDRESS)}</span></footer><TxToast tx={tx} close={() => setTx(undefined)}/></div>;
}

function SellerDashboard({items, now, credit, withdraw}: {items: Auction[]; now: number; credit: bigint; withdraw: () => void}) {
  const own = items.filter(item => item.seller === addresses.seller);
  const live = own.filter(item => statusOf(item, now) === 'LIVE').length;
  const ended = own.filter(item => statusOf(item, now) === 'ENDED' || statusOf(item, now) === 'FINALIZED').length;
  return <section className="seller-dashboard"><div className="seller-hero"><div><span className="kicker">SELLER WORKSPACE</span><h1>欢迎回来，<em>卖家 A</em></h1><p>发布你的奶娃藏品，管理正在进行的竞拍，并在成交后提取资金。</p></div><a className="primary" href="#/create">+ 发布新拍品</a></div><div className="seller-stats"><div><span>我的拍品</span><strong>{own.length}</strong></div><div><span>正在竞拍</span><strong>{live}</strong></div><div><span>已结束</span><strong>{ended}</strong></div><div><span>可提取余额</span><strong>{mon(credit)} <small>MON</small></strong></div></div><div className="seller-section-title"><div><span className="kicker">MY AUCTIONS</span><h2>我的拍卖</h2></div><a className="secondary" href="#market">浏览公开拍卖</a></div><div className="seller-grid">{own.map(item => <a className="seller-card" key={item.id.toString()} href={`#/auction/${item.id}`}><Artwork item={item}/><div><span className={`status status-${statusOf(item, now)}`}>{statusLabel[statusOf(item, now)]}</span><h3>{item.title}</h3><p>当前价 {mon(item.highestBid || item.startingPrice)} MON</p><small>{statusOf(item, now) === 'LIVE' ? `剩余 ${Math.max(0, item.endAt - now)} 秒` : '点击查看详情'}</small></div></a>)}</div><div className="seller-funds"><div><span className="kicker">FUNDS CENTER</span><h2>资金中心</h2><p>成交款和被超过的报价退款统一进入可提取余额。</p></div><div><strong>{mon(credit)} MON</strong><button className="primary" onClick={withdraw} disabled={credit === 0n}>提取余额</button></div></div></section>;
}

function Hall({items, allItems, now, filter, setFilter}: {items: Auction[]; allItems: Auction[]; now: number; filter: 'ALL' | Status; setFilter: (x: 'ALL' | Status) => void}) {
  const live = allItems.filter(x => statusOf(x, now) === 'LIVE').length;
  return <><section className="hero"><div className="hero-copy"><span className="kicker">MONAD 上的趣味竞拍实验</span><h1>好东西，<br/><em>蛙士得！</em></h1><p>发现有趣藏品，完成一次透明、快速的链上竞价体验。每次有效出价都会重新获得60秒。</p><div className="hero-buttons"><a className="primary" href="#/create">发布一件拍品</a><a className="secondary" href="#market">看看正在竞拍什么</a></div></div><div className="hero-visual"><div className="sun"/><img src="/logo.png" alt="蛙士得黄色角色"/><span className="floating-note"><b>60</b>秒<br/>重新计时</span></div></section><section className="stats"><div><strong>{allItems.length}</strong><span>模拟拍品</span></div><div><strong>{live}</strong><span>正在竞拍</span></div><div><strong>60s</strong><span>有效出价重置</span></div><div><strong>MON</strong><span>测试网原生币</span></div></section><section className="market" id="market"><div className="section-title"><div><span className="kicker">AUCTION FLOOR</span><h2>拍卖大厅</h2></div><p>更新于刚刚 · 模拟数据</p></div><div className="filters">{([['ALL','全部'],['WAITING_FIRST_BID','等待首拍'],['LIVE','竞拍中'],['ENDED','已结束'],['FINALIZED','已成交']] as const).map(([key,label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}</button>)}</div>{items.length ? <div className="card-grid">{items.map(item => <AuctionCard key={item.id.toString()} item={item} now={now}/>)}</div> : <Empty title="这个分类还没有拍品" text="换一个分类，或者发布第一件拍品。"/>}</section></>;
}
function AuctionCard({item, now}: {item: Auction; now: number}) {const status = statusOf(item, now), price = item.highestBid || item.startingPrice, seconds = Math.max(0, item.endAt - now); return <a className="auction-card" href={`#/auction/${item.id}`}><Artwork item={item}/><div className="card-content"><div className="card-meta"><span className={`status status-${status}`}>{statusLabel[status]}</span><small>LOT {item.id.toString().padStart(3,'0')}</small></div><h3>{item.title}</h3><div className="card-bottom"><div><small>{item.highestBid ? '当前最高价' : '起拍价'}</small><strong>{mon(price)} <em>MON</em></strong></div><span>{status === 'LIVE' ? `${seconds}秒` : status === 'WAITING_FIRST_BID' ? '首拍后计时' : '查看结果'}</span></div></div></a>}

function DetailPage({item, now, account, bidText, setBidText, bid, finalize}: {item: Auction; now: number; account: Address; bidText: string; setBidText: (s: string) => void; bid: () => void; finalize: () => void}) {
  const status = statusOf(item, now), minimum = (item.highestBid || item.startingPrice) + item.bidStep, seconds = Math.max(0, item.endAt - now), isSeller = item.seller.toLowerCase() === account.toLowerCase(), isLeader = item.highestBidder?.toLowerCase() === account.toLowerCase();
  return <section className="detail-page"><div className="detail-main"><a className="back" href="#/">‹ 返回拍卖大厅</a><Artwork item={item} large/><div className="item-copy"><span className="kicker">{categoryNames[item.category]} · LOT {item.id.toString().padStart(3,'0')}</span><h1>{item.title}</h1><p>{item.description}</p><div className="seller-line"><span>卖家</span><strong>{short(item.seller)}</strong><small>{isSeller ? '这是你发布的拍品' : '模拟地址'}</small></div></div></div><aside className="bid-box"><div className="bid-head"><span className={`status status-${status}`}>{statusLabel[status]}</span><small>模拟链上数据</small></div><span className="price-label">{item.highestBid ? '当前最高价' : '起拍价'}</span><div className="current-price">{mon(item.highestBid || item.startingPrice)} <small>MON</small></div><div className="leader-row"><span>当前领先者</span><strong>{item.highestBidder ? short(item.highestBidder) : '等待第一位竞拍者'}</strong></div><div className="timer"><span>{status === 'WAITING_FIRST_BID' ? '首笔出价后开始计时' : status === 'LIVE' ? '距离本轮结束' : '本轮竞拍状态'}</span><strong>{status === 'WAITING_FIRST_BID' ? '60' : status === 'LIVE' ? seconds.toString().padStart(2,'0') : '00'}<small>秒</small></strong><p>每次有效出价都会重新获得60秒</p></div><dl><div><dt>固定加价</dt><dd>{mon(item.bidStep)} MON</dd></div><div><dt>下一笔最低</dt><dd>{mon(minimum)} MON</dd></div></dl>{(status === 'LIVE' || status === 'WAITING_FIRST_BID') && <div className="bid-form"><label>你的报价 · MON<input inputMode="decimal" value={bidText} onChange={e => setBidText(e.target.value)} placeholder={mon(minimum)}/></label><button className="quick" onClick={() => setBidText(mon(minimum))}>使用最低出价 {mon(minimum)} MON</button><button className="primary full" onClick={bid} disabled={isSeller || isLeader}>{isSeller ? '卖家不能竞拍自己的拍品' : isLeader ? '你目前正在领先' : '立即出价'}</button><p>模拟支付完整报价；被超过后，资金计入全局可提取余额。</p></div>}{status === 'ENDED' && <button className="primary full" onClick={finalize}>公开触发结算</button>}{status === 'FINALIZED' && <div className="result-box"><strong>拍卖已经成交</strong><p>赢家 {item.highestBidder ? short(item.highestBidder) : '—'} · 成交价 {mon(item.highestBid)} MON</p></div>}</aside></section>;
}

function CreatePage({account, onCreate}: {account: Address; onCreate: (data: {title: string; description: string; imageUrl: string; category: Category; price: string; percent: string}) => Promise<void>}) {
  const [form, setForm] = useState({title: '蛙士得限量收藏卡', description: '一件用于演示创建、竞价、结算完整流程的虚拟收藏品。', imageUrl: '', category: 'digital' as Category, price: '0.10', percent: '30'}), [error, setError] = useState(''); let step = '—', first = '—'; try {const p = parseEther(form.price), bps = BigInt(Math.round(Number(form.percent) * 100)), s = (p * bps + 9999n) / 10000n; step = mon(s); first = mon(p + s)} catch {}
  return <section className="create-page"><div className="create-intro"><a className="back" href="#/">‹ 返回拍卖大厅</a><span className="kicker">CREATE AN AUCTION</span><h1>发布一件<br/><em>值得被看见</em>的好物。</h1><p>填写拍品信息并设置起拍价。创建后立即进入 Monad 测试网的 3 分钟首拍窗口。</p><div className="rule-card"><strong>奶蛙素材会自动附着</strong><p>不填写图片网址时，系统会从内置奶蛙素材中随机选一张，并写入这件拍品的链上元数据。</p></div></div><form className="create-form" onSubmit={async e => {e.preventDefault(); setError(''); try {await onCreate(form)} catch (err) {setError(err instanceof Error ? err.message : '表单填写有误')}}}><div className="form-head"><div><span className="kicker">拍品信息</span><h2>创建链上拍卖</h2></div><span>发布者 {short(account)}</span></div><label>拍品名称 <small>{utf8(form.title)}/120 字节</small><input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="例如：蛙士得创世徽章"/></label><label>拍品描述 <small>{utf8(form.description)}/1200 字节</small><textarea rows={4} value={form.description} onChange={e => setForm({...form, description: e.target.value})}/></label><div className="two-cols"><label>拍品分类<select value={form.category} onChange={e => setForm({...form, category: e.target.value as Category})}><option value="digital">数字艺术</option><option value="physical">趣味收藏</option><option value="service">体验权益</option></select></label><label>图片网址（可选）<input value={form.imageUrl} onChange={e => setForm({...form, imageUrl: e.target.value})} placeholder="留空则随机附一张奶蛙素材"/></label></div><div className="two-cols"><label>起拍价 · MON<input inputMode="decimal" value={form.price} onChange={e => setForm({...form, price: e.target.value})}/></label><label>固定加价比例 · %<input inputMode="decimal" value={form.percent} onChange={e => setForm({...form, percent: e.target.value})}/></label></div><div className="price-preview"><div><span>每次固定加价</span><strong>{step} MON</strong></div><div><span>首笔最低出价</span><strong>{first} MON</strong></div></div>{error && <div className="form-error">{error}</div>}<button type="submit" className="primary full">发布到 Monad 测试网</button><p className="form-note">点击后会唤起 MetaMask；确认后拍品图片和描述会随元数据写入合约。</p></form></section>;
}
function Empty({title, text}: {title: string; text: string}) {return <section className="empty"><div>🐸</div><h2>{title}</h2><p>{text}</p><a className="secondary" href="#/">返回大厅</a></section>}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);

