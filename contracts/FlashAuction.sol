// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice Testnet prototype. Descriptions do not represent custody or delivery of goods.
contract FlashAuction is ReentrancyGuard {
    uint256 public constant IDLE_WINDOW = 60;
    uint256 public auctionCount;
    enum Status { WAITING_FIRST_BID, LIVE, ENDED, FINALIZED, CANCELLED }
    struct Auction {
        address seller;
        string metadataURI;
        uint256 startingPrice;
        uint256 bidStep;
        address highestBidder;
        uint256 highestBid;
        uint64 endAt;
        bool finalized;
        bool cancelled;
    }
    mapping(uint256 => Auction) private auctions;
    mapping(address => uint256) public pendingWithdrawals;
    error AuctionNotFound();
    error InvalidPrice();
    error InvalidIncrement();
    error InvalidMetadata();
    error AuctionClosed();
    error BidTooLow(uint256 required);
    error AlreadyLeading();
    error SellerCannotBid();
    error NotEnded();
    error NotSeller();
    error HasBids();
    error NothingToWithdraw();
    error TransferFailed();
    event AuctionCreated(uint256 indexed auctionId, address indexed seller, string metadataURI, uint256 startingPrice, uint256 bidStep);
    event BidPlaced(uint256 indexed auctionId, address indexed bidder, uint256 amount, uint64 endAt);
    event AuctionFinalized(uint256 indexed auctionId, address indexed winner, address indexed seller, uint256 amount);
    event AuctionCancelled(uint256 indexed auctionId);
    event Withdrawn(address indexed account, uint256 amount);

    function createAuction(string calldata metadataURI, uint256 startingPrice, uint256 incrementBps) external returns (uint256 id) {
        // Bounds also ensure the next minimum bid remains representable.
        if (startingPrice == 0 || startingPrice > type(uint128).max) revert InvalidPrice();
        if (incrementBps == 0 || incrementBps > 10000) revert InvalidIncrement();
        if (bytes(metadataURI).length == 0 || bytes(metadataURI).length > 4096) revert InvalidMetadata();
        uint256 step = Math.mulDiv(startingPrice, incrementBps, 10000, Math.Rounding.Ceil);
        id = ++auctionCount;
        auctions[id] = Auction(msg.sender, metadataURI, startingPrice, step, address(0), 0, 0, false, false);
        emit AuctionCreated(id, msg.sender, metadataURI, startingPrice, step);
    }
    function bid(uint256 id) external payable {
        Auction storage a = existing(id);
        if (a.cancelled || a.finalized || (a.endAt != 0 && block.timestamp >= a.endAt)) revert AuctionClosed();
        if (msg.sender == a.seller) revert SellerCannotBid();
        if (msg.sender == a.highestBidder) revert AlreadyLeading();
        uint256 required = (a.highestBidder == address(0) ? a.startingPrice : a.highestBid) + a.bidStep;
        if (msg.value < required) revert BidTooLow(required);
        if (msg.value > type(uint128).max) revert InvalidPrice();
        if (a.highestBidder != address(0)) pendingWithdrawals[a.highestBidder] += a.highestBid;
        a.highestBidder = msg.sender;
        a.highestBid = msg.value;
        a.endAt = uint64(block.timestamp + IDLE_WINDOW);
        emit BidPlaced(id, msg.sender, msg.value, a.endAt);
    }
    function finalizeAuction(uint256 id) external {
        Auction storage a = existing(id);
        if (a.finalized || a.cancelled) revert AuctionClosed();
        if (a.endAt == 0 || block.timestamp < a.endAt) revert NotEnded();
        a.finalized = true;
        pendingWithdrawals[a.seller] += a.highestBid;
        emit AuctionFinalized(id, a.highestBidder, a.seller, a.highestBid);
    }
    function cancelAuction(uint256 id) external {
        Auction storage a = existing(id);
        if (msg.sender != a.seller) revert NotSeller();
        if (a.cancelled || a.finalized) revert AuctionClosed();
        if (a.highestBidder != address(0)) revert HasBids();
        a.cancelled = true;
        emit AuctionCancelled(id);
    }
    function withdraw() external nonReentrant {
        uint256 amount = pendingWithdrawals[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        pendingWithdrawals[msg.sender] = 0;
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawn(msg.sender, amount);
    }
    function getAuction(uint256 id) external view returns (Auction memory) { return existing(id); }
    function getStatus(uint256 id) external view returns (Status) {
        Auction storage a = existing(id);
        if (a.cancelled) return Status.CANCELLED;
        if (a.finalized) return Status.FINALIZED;
        if (a.endAt == 0) return Status.WAITING_FIRST_BID;
        if (block.timestamp >= a.endAt) return Status.ENDED;
        return Status.LIVE;
    }
    function existing(uint256 id) private view returns (Auction storage a) {
        if (id == 0 || id > auctionCount) revert AuctionNotFound();
        return auctions[id];
    }
}

