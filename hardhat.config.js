require("@nomiclabs/hardhat-waffle");


module.exports = {
  solidity: "0.8.4",
  paths: {
    artifacts: "./src/backend/artifacts",
    sources: "./src/backend/contracts",
    cache: "./src/backend/cache",
    tests: "./src/backend/test"
  },
  networks: {
    rinkeby: {
      url: 'https://eth-rinkeby.alchemyapi.io/v2/yWQ0KEf-8u-yzPwe0ZXnQ4X4PiqIcQa0',
      accounts: ['05c03559025e41e537c70e3acf0af806343c645dfa4b3b41083925ec8eb92065']
    }
  }
};
