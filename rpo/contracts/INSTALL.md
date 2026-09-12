# Installing the Foundry Dependencies

The `lib/` folder is git-ignored to keep the repo small. After cloning, run:

```bash
cd contracts
forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts --no-git
forge build
forge test
```

Or clone with submodules if you prefer:

```bash
git clone --recurse-submodules <repo>
```
