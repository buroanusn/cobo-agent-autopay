// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
}

contract CreditsPayment {
    IERC20 public immutable usdc;
    address public immutable treasury;
    uint256 public immutable creditsPerUsdc;
    mapping(bytes32 => bool) public fulfilledOrders;

    event CreditsPurchased(
        address indexed payer,
        address indexed creditAccount,
        bytes32 indexed orderId,
        uint256 amountUsdc,
        uint256 credits
    );

    constructor(address usdc_, address treasury_, uint256 creditsPerUsdc_) {
        require(usdc_ != address(0), "USDC_REQUIRED");
        require(treasury_ != address(0), "TREASURY_REQUIRED");
        require(creditsPerUsdc_ > 0, "RATE_REQUIRED");
        usdc = IERC20(usdc_);
        treasury = treasury_;
        creditsPerUsdc = creditsPerUsdc_;
    }

    function buyCredits(bytes32 orderId, address creditAccount, uint256 amountUsdc) external {
        require(orderId != bytes32(0), "ORDER_REQUIRED");
        require(creditAccount != address(0), "ACCOUNT_REQUIRED");
        require(amountUsdc > 0, "AMOUNT_REQUIRED");
        require(!fulfilledOrders[orderId], "ORDER_FULFILLED");

        fulfilledOrders[orderId] = true;
        require(usdc.transferFrom(msg.sender, treasury, amountUsdc), "USDC_TRANSFER_FAILED");

        uint256 credits = (amountUsdc * creditsPerUsdc) / 1e6;
        emit CreditsPurchased(msg.sender, creditAccount, orderId, amountUsdc, credits);
    }
}
