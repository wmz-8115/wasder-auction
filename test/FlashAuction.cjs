const assert = require('node:assert/strict');
const { ethers, network } = require('hardhat');
describe('FlashAuction money and timing rules', function () {
  let c,seller,a,b,other;
  const mon = ethers.parseEther;
  async function fail(p,name) {
    await assert.rejects(p,e => {
      const data=typeof e.data==='string'?e.data:e.data?.data;
      try{return c.interface.parseError(data)?.name===name;}catch{return false;}
    });
  }
  async function at(t) { await network.provider.send('evm_setNextBlockTimestamp',[Number(t)]); }
  beforeEach(async () => {
    [seller,a,b,other] = await ethers.getSigners();
    c = await (await ethers.getContractFactory('FlashAuction')).deploy(); await c.waitForDeployment();
    await c.createAuction('data:application/json,{"title":"Demo"}',mon('10'),3000);
  });
  it('requires 13 first; jump to 25 makes next minimum 28, not compound growth',async()=>{
    await fail(c.connect(a).bid(1,{value:mon('10')}),'BidTooLow');
    await c.connect(a).bid(1,{value:mon('13')});
    await c.connect(b).bid(1,{value:mon('25')});
    await fail(c.connect(a).bid(1,{value:mon('27')}),'BidTooLow');
    await c.connect(a).bid(1,{value:mon('28')});
    assert.equal((await c.getAuction(1)).highestBid,mon('28'));
    assert.equal(await c.pendingWithdrawals(a.address),mon('13'));
    assert.equal(await c.pendingWithdrawals(b.address),mon('25'));
  });
  it('refreshes 60 seconds, rejects a simultaneous stale bid, closes at exact end',async()=>{
    await c.connect(a).bid(1,{value:mon('13')});
    const initial = (await c.getAuction(1)).endAt;
    await at(initial-10n); await c.connect(b).bid(1,{value:mon('16')});
    const updated = (await c.getAuction(1)).endAt;
    assert.equal(updated,initial+50n);
    await fail(c.connect(other).bid(1,{value:mon('16')}),'BidTooLow');
    await at(updated); await fail(c.connect(a).bid(1,{value:mon('19')}),'AuctionClosed');
    assert.equal((await c.getAuction(1)).highestBidder,b.address);
    assert.equal(await c.getStatus(1),2n);
  });
  it('conserves funds: refund 13; seller 16 only after public finalization; cannot double withdraw',async()=>{
    await c.connect(a).bid(1,{value:mon('13')});
    await c.connect(b).bid(1,{value:mon('16')});
    assert.equal(await ethers.provider.getBalance(await c.getAddress()),mon('29'));
    assert.equal(await c.pendingWithdrawals(seller.address),0n);
    await c.connect(a).withdraw();
    await fail(c.connect(a).withdraw(),'NothingToWithdraw');
    assert.equal(await ethers.provider.getBalance(await c.getAddress()),mon('16'));
    await fail(c.finalizeAuction(1),'NotEnded');
    await at((await c.getAuction(1)).endAt); await c.connect(other).finalizeAuction(1);
    assert.equal(await c.pendingWithdrawals(seller.address),mon('16'));
    await fail(c.finalizeAuction(1),'AuctionClosed');
    await c.withdraw();
    assert.equal(await ethers.provider.getBalance(await c.getAddress()),0n);
    await fail(c.withdraw(),'NothingToWithdraw');
  });
  it('does not start a timer or pay seller before first bid; supports no-bid cancellation',async()=>{
    assert.equal((await c.getAuction(1)).endAt,0n);
    assert.equal(await c.getStatus(1),0n);
    await fail(c.finalizeAuction(1),'NotEnded');
    await fail(c.connect(a).cancelAuction(1),'NotSeller');
    await c.cancelAuction(1); assert.equal(await c.getStatus(1),4n);
    await fail(c.connect(a).bid(1,{value:mon('13')}),'AuctionClosed');
  });
  it('rejects seller and leading bidder self-bids and cancel after bidding',async()=>{
    await fail(c.bid(1,{value:mon('13')}),'SellerCannotBid');
    await c.connect(a).bid(1,{value:mon('13')});
    await fail(c.connect(a).bid(1,{value:mon('16')}),'AlreadyLeading');
    await fail(c.cancelAuction(1),'HasBids');
  });
  it('ceil rounding gives minimum 1 wei; rejects invalid configuration and missing IDs',async()=>{
    await c.createAuction('tiny',1,1);
    assert.equal((await c.getAuction(2)).bidStep,1n);
    await c.connect(a).bid(2,{value:2});
    await fail(c.createAuction('x',0,1),'InvalidPrice');
    await fail(c.createAuction('x',10,0),'InvalidIncrement');
    await fail(c.createAuction('x',10,10001),'InvalidIncrement');
    await fail(c.createAuction('',10,100),'InvalidMetadata');
    await fail(c.getAuction(0),'AuctionNotFound');
    await fail(c.connect(a).bid(99,{value:20}),'AuctionNotFound');
  });
  it('keeps refund balances independent across different auctions',async()=>{
    await c.createAuction('second',mon('10'),3000);
    await c.connect(a).bid(1,{value:mon('13')});
    await c.connect(a).bid(2,{value:mon('13')});
    await c.connect(b).bid(1,{value:mon('16')});
    await c.connect(b).bid(2,{value:mon('16')});
    assert.equal(await c.pendingWithdrawals(a.address),mon('26'));
    await c.connect(a).withdraw();
    assert.equal(await ethers.provider.getBalance(await c.getAddress()),mon('32'));
  });
  it('failed recipient cannot block later bidding; rejected withdrawal preserves credit; reentry fails',async()=>{
    const probe=await (await ethers.getContractFactory('WithdrawalProbe')).deploy(await c.getAddress());
    await probe.place(1,{value:mon('13')});
    await probe.setReject(true);
    await c.connect(b).bid(1,{value:mon('16')});
    const address=await probe.getAddress();
    await fail(probe.claim(),'TransferFailed');
    assert.equal(await c.pendingWithdrawals(address),mon('13'));
    await probe.setReject(false);
    await probe.claim();
    assert.equal(await probe.reentrySucceeded(),false);
    assert.equal(await c.pendingWithdrawals(address),0n);
    assert.equal(await ethers.provider.getBalance(address),mon('13'));
    assert.equal(await ethers.provider.getBalance(await c.getAddress()),mon('16'));
  });
});

