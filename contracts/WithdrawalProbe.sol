// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @dev Test helper only. Not part of the frontend or testnet deployment.
interface IAuction {
    function bid(uint256 id) external payable;
    function withdraw() external;
}
contract WithdrawalProbe {
    IAuction public immutable auction;
    bool public rejectPayment;
    bool public reentrySucceeded;
    constructor(address target) { auction = IAuction(target); }
    function place(uint256 id) external payable { auction.bid{value:msg.value}(id); }
    function setReject(bool value) external { rejectPayment=value; }
    function claim() external { auction.withdraw(); }
    receive() external payable {
        require(!rejectPayment, "Recipient refuses payment");
        (bool success,) = address(auction).call(abi.encodeCall(IAuction.withdraw, ()));
        reentrySucceeded = success;
    }
}

