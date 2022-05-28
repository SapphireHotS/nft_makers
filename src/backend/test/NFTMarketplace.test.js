/* eslint-disable jest/valid-expect */
const { expect } = require("chai");
const { ethers } = require("hardhat");

const toWei = (num) => ethers.utils.parseEther(num.toString())
const fromWei = (num) => ethers.utils.formatEther(num)

describe("NFTMarketplace", function(){
    let deployer, address1, address2, nft, marketplace;
    let feePercent = 1;
    let URI = "Sample URI";
    beforeEach(async function() {
        // Get contract factories
        const NFT = await ethers.getContractFactory("NFT");
        const Marketplace = await ethers.getContractFactory("Marketplace");

        [deployer, address1, address2] = await ethers.getSigners();

        nft = await NFT.deploy();
        marketplace = await Marketplace.deploy(feePercent);


    });

    describe("Deployment", function() {
        it("Should track name and symbol of the NFT collection", async function(){
            expect(await nft.name()).to.equal("DApp NFT");
            expect(await nft.symbol()).to.equal("DAPP");
        });

        it("Should track feeAccount and feePercent of the marketplace", async function(){
            expect(await marketplace.feeAccount()).to.equal(deployer.address);
            expect(await marketplace.feePercent()).to.equal(feePercent);
        });
    });

    describe("Minting NFTs", function() {
        it("Should track each minted NFT", async function(){
            // Address 1 mints an NFT
            await nft.connect(address1).mint(URI);
            expect(await nft.tokenCount()).to.equal(1);
            expect(await nft.balanceOf(address1.address)).to.equal(1);
            expect(await nft.tokenURI(1)).to.equal(URI);


            // Address 2 mints an NFT
            await nft.connect(address2).mint(URI);
            expect(await nft.tokenCount()).to.equal(2);
            expect(await nft.balanceOf(address2.address)).to.equal(1);
            expect(await nft.tokenURI(2)).to.equal(URI);
        });
    });

    describe("Making marketplace items", function() {
        let price = 1;
        beforeEach(async function () {
            //Address 1 mints an nft
            await nft.connect(address1).mint(URI);
            // Address 2 approves marketplace to spend the nft
            await nft.connect(address1).setApprovalForAll(marketplace.address, true);
        });

        it("Should track newly created item, transfer NFT from seller to marketplace and emit Offered event", async function () {
            // Address 1 offers their nft to the marketplace at a price of 1 ether
            await expect(marketplace.connect(address1).makeItem(nft.address, 1 , toWei(price)))
                .to.emit(marketplace, "Offered")
                .withArgs(
                1,
                nft.address,
                1,
                toWei(price),
                address1.address
                )
            
            // Now, the owner of the NFT should be the marketplace
            expect(await nft.ownerOf(1)).to.equal(marketplace.address);

            //Item count should now be equal to 1
            expect(await marketplace.itemCount()).to.equal(1);

            // Get item from items mapping the ncheck fields to ensure they are correct
            
            const item = await marketplace.items(1);
            expect(item.itemId).to.equal(price);
            expect(item.nft).to.equal(nft.address);
            expect(item.tokenId).to.equal(price);
            expect(item.price).to.equal(toWei(price));
            expect(item.sold).to.equal(false);

        });
        it("Should fail if the price is set to 0", async function () {
            await expect(
                marketplace.connect(address1).makeItem(nft.address, 1, 0)
            ).to.be.revertedWith("Price must be greater than zero");
        });
    });

    describe("Purcheasing marketplace items", function() {
        let price = 0.0002;
        let totalPriceInWei;
        beforeEach(async function () {
            //Address 1 mints an nft
            await nft.connect(address1).mint(URI);
            // Address 1 approves marketplace to spend the nft
            await nft.connect(address1).setApprovalForAll(marketplace.address, true);
            // Address 1 publish his item to the marketplace
            await marketplace.connect(address1).makeItem(nft.address, 1, toWei(price));
        });

        it("Should update item as sold, pay seller, transfer NFT to buyer, charge fees and emit a Bought event", async function (){
            const sellerInitialEthBalance = await address1.getBalance();
            const feeAccountInitialEthBalance = await deployer.getBalance();
            
            totalPriceInWei = await marketplace.getTotalPrice(1);
            await expect(marketplace.connect(address2).purchaseItem(1, {value: totalPriceInWei}))
                .to.emit(marketplace, "Bought")
                    .withArgs(
                    1,
                    nft.address,
                    1,
                    toWei(price),
                    address1.address,
                    address2.address
                    )
            const sellerFinalEthBal = await address1.getBalance();
            const feeAccountFinalEthBal = await deployer.getBalance();
            // Seller should receive the payment for the price of the NFT
            expect(+fromWei(sellerFinalEthBal)).to.equal(+price + +fromWei(sellerInitialEthBalance));
            
            const fee = (feePercent / 100) * price;

            // feeAccount should receive fee
            expect(+fromWei(feeAccountFinalEthBal)).to.equal(+ fee + +fromWei(feeAccountInitialEthBalance));
            // The buyer should now own the nft
            expect(await nft.ownerOf(1)).to.equal(address2.address);
            expect((await marketplace.items(1)).sold).to.equal(true);
        });
        it("Should fail for invalid item ids, sold items and when not enough ether is paid", async function () {
            // fails for invalid item ids
            await expect(
              marketplace.connect(address2).purchaseItem(2, {value: totalPriceInWei})
            ).to.be.revertedWith("Item doesn't exist");
            await expect(
              marketplace.connect(address2).purchaseItem(0, {value: totalPriceInWei})
            ).to.be.revertedWith("Item doesn't exist");
            // Fails when not enough ether is paid with the transaction. 
            // In this instance, fails when buyer only sends enough ether to cover the price of the nft
            // not the additional market fee
            await expect(
              marketplace.connect(address2).purchaseItem(1, {value: toWei(price)})
            ).to.be.revertedWith("Not enough ether to cover the item price and the market fee."); 
            // address2 purchases item 1
            totalPriceInWei = await marketplace.getTotalPrice(1);
            await marketplace.connect(address2).purchaseItem(1, {value: totalPriceInWei})
            // address2 tries purchasing item 1 after its been sold 
            await expect(
              marketplace.connect(address2).purchaseItem(1, {value: totalPriceInWei})
            ).to.be.revertedWith("Item already sold");
          });
    });

});