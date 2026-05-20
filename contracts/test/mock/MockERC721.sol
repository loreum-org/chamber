// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC721} from "lib/openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";

contract MockERC721 is ERC721 {
    /// Directory-style IPFS CID; `{base}{tokenId}` → `ipfs://.../1` etc.
    string private constant _TOKEN_URI_PREFIX = "ipfs://QmcTBMUiaDQTCt3KT3JLadwKMcBGKTYtiuhopTUafo1h9L/";

    uint256 private _nextTokenId;

    constructor(string memory name, string memory symbol) ERC721(name, symbol) {}

    function _baseURI() internal view virtual override returns (string memory) {
        return _TOKEN_URI_PREFIX;
    }

    function mint(address to) public returns (uint256) {
        uint256 tokenId = ++_nextTokenId;
        _mint(to, tokenId);
        return tokenId;
    }

    function mintWithTokenId(address to, uint256 tokenId) public {
        _mint(to, tokenId);
    }

    function burn(uint256 tokenId) public {
        _burn(tokenId);
    }
}
